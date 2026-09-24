-- ═════════════════════════════════════════════════════════════════════════════
-- Grande finale avec reset — tournois, PR 6
--
-- Appliquée en prod : NON
--
-- Règle produit : « Grande finale en double élimination avec reset : si le
-- vainqueur de la branche des perdants gagne la finale, un second match décisif
-- est joué. »
--
-- Jusqu'ici, la grande finale n'était jamais créée par le serveur : le Manager
-- la créait à la main, et un seul match décidait, même quand le vainqueur du
-- tableau des perdants battait l'invaincu (qui n'avait alors qu'une défaite).
--
-- `advance_bracket_round` (swiss) :
--   * quand il reste un invaincu et un seul athlète à une défaite, crée la
--     grande finale (côté `grand_final`, tour suivant, l'invaincu en premier) ;
--   * après la grande finale, si son vainqueur avait déjà perdu (il venait du
--     tableau des perdants), crée le match décisif : même paire, tour suivant ;
--   * une grande finale déjà créée par le Manager est tolérée : aucune seconde
--     n'est créée, et le match décisif suit la sienne de la même façon.
-- `tournament_bracket_standings` (double élimination) :
--   * la DERNIÈRE grande finale décide du champion et du deuxième ;
--   * tant qu'elle n'est pas jouée, ou qu'un match décisif est dû sans être
--     créé, personne n'est champion : la clôture refuse (TABLEAU_NON_TERMINE).
--
-- Données en prod : aucun tournoi en double élimination.
--
-- Contrôlée par `supabase/tests/double_elimination.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.advance_bracket_round(p_tournament_id uuid, p_completed_round integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_format text;
  v_pending int;
  v_winners uuid[];
  v_losers  uuid[];
  v_lb_prev_winners uuid[];
  v_match_num int := 1;
  v_count int;
  i int;
  v_zero  uuid[];
  v_un    uuid[];
  v_reste uuid[];
  v_n_s   int;
  v_n_l   int;
  v_crees int := 0;
  v_gf    record;
  v_n_gf  int;
BEGIN
  IF NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'Not authorized: only the box owner/coach or an admin can manage this tournament';
  END IF;

  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id;

  SELECT count(*) INTO v_pending
    FROM public.tournament_bracket_matches
    WHERE tournament_id = p_tournament_id
      AND round = p_completed_round AND winner_id IS NULL;
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Round % has % unfinished matches', p_completed_round, v_pending;
  END IF;

  -- Idempotency: if the next round already exists, do nothing (avoids the
  -- duplicate-key error when "Round suivant" is triggered more than once).
  IF EXISTS (
    SELECT 1 FROM public.tournament_bracket_matches
    WHERE tournament_id = p_tournament_id
      AND round = p_completed_round + 1
  ) THEN
    RETURN 0;
  END IF;

  IF v_format = 'bracket' THEN
    SELECT array_agg(winner_id ORDER BY match_number) INTO v_winners
      FROM public.tournament_bracket_matches
      WHERE tournament_id = p_tournament_id
        AND round = p_completed_round AND side = 'winner';

    v_count := COALESCE(array_length(v_winners, 1), 0);
    IF v_count <= 1 THEN RETURN 0; END IF;  -- final reached

    i := 1;
    WHILE i <= v_count LOOP
      IF i + 1 <= v_count THEN
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
        VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'winner',
                v_winners[i], v_winners[i+1], 'pending');
      ELSE
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, winner_id, status, completed_at)
        VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'winner',
                v_winners[i], v_winners[i], 'bye', now());
      END IF;
      v_match_num := v_match_num + 1;
      i := i + 2;
    END LOOP;
    RETURN v_match_num - 1;

  ELSIF v_format = 'swiss' THEN
    -- Grande finale déjà là (créée ici, ou à la main par le Manager) : seul le
    -- match décisif peut suivre (migration 20270111). Il se joue quand le
    -- vainqueur de la finale avait déjà perdu, donc venait du tableau des perdants.
    SELECT count(*) INTO v_n_gf
      FROM public.tournament_bracket_matches
     WHERE tournament_id = p_tournament_id AND side = 'grand_final';
    IF v_n_gf > 0 THEN
      SELECT round, participant1_id, participant2_id, winner_id INTO v_gf
        FROM public.tournament_bracket_matches
       WHERE tournament_id = p_tournament_id AND side = 'grand_final'
       ORDER BY round DESC LIMIT 1;
      IF v_n_gf = 1 AND v_gf.round = p_completed_round AND v_gf.winner_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.tournament_bracket_matches m
                      WHERE m.tournament_id = p_tournament_id
                        AND m.side IN ('winner', 'loser') AND m.status <> 'bye'
                        AND m.winner_id IS NOT NULL
                        AND v_gf.winner_id IN (m.participant1_id, m.participant2_id)
                        AND m.winner_id <> v_gf.winner_id) THEN
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
        VALUES (p_tournament_id, v_gf.round + 1, 1, 'grand_final',
                CASE WHEN v_gf.winner_id = v_gf.participant1_id THEN v_gf.participant2_id ELSE v_gf.participant1_id END,
                v_gf.winner_id, 'pending');
        RETURN 1;
      END IF;
      RETURN 0;
    END IF;

    -- Double élimination (migration 20270110). Défaites de chaque athlète du
    -- tableau, sur tous les matchs décidés (une exemption n'en est pas une) :
    -- 0 → tableau des gagnants, 1 → tableau des perdants, 2 → éliminé.
    SELECT array_agg(j.pid) FILTER (WHERE j.pertes = 0),
           array_agg(j.pid) FILTER (WHERE j.pertes = 1)
      INTO v_zero, v_un
      FROM (
        SELECT p.pid,
               (SELECT count(*) FROM public.tournament_bracket_matches m
                 WHERE m.tournament_id = p_tournament_id
                   AND m.side IN ('winner', 'loser')
                   AND m.status <> 'bye'
                   AND m.winner_id IS NOT NULL
                   AND p.pid IN (m.participant1_id, m.participant2_id)
                   AND m.winner_id <> p.pid) AS pertes
          FROM (SELECT participant1_id AS pid FROM public.tournament_bracket_matches
                 WHERE tournament_id = p_tournament_id AND round = 1 AND side = 'winner'
                UNION
                SELECT participant2_id FROM public.tournament_bracket_matches
                 WHERE tournament_id = p_tournament_id AND round = 1 AND side = 'winner') p
         WHERE p.pid IS NOT NULL
      ) j;

    -- Tableau des gagnants : les invaincus, dans l'ordre des matchs du tour joué.
    SELECT array_agg(z.pid ORDER BY m.match_number NULLS LAST, z.pid) INTO v_winners
      FROM unnest(COALESCE(v_zero, '{}'::uuid[])) AS z(pid)
      LEFT JOIN public.tournament_bracket_matches m
        ON m.tournament_id = p_tournament_id AND m.round = p_completed_round
       AND m.side = 'winner' AND z.pid IN (m.participant1_id, m.participant2_id);

    -- Tableau des perdants : TOUS les athlètes à une défaite. S : vainqueurs du
    -- tableau des perdants au tour joué (exemptés compris) ; L : les autres,
    -- dans l'ordre des matchs du tableau des gagnants où ils ont perdu.
    SELECT array_agg(u.pid ORDER BY m.match_number) INTO v_lb_prev_winners
      FROM unnest(COALESCE(v_un, '{}'::uuid[])) AS u(pid)
      JOIN public.tournament_bracket_matches m
        ON m.tournament_id = p_tournament_id AND m.round = p_completed_round
       AND m.side = 'loser' AND m.winner_id = u.pid;
    SELECT array_agg(u.pid ORDER BY m.match_number NULLS LAST, u.pid) INTO v_losers
      FROM unnest(COALESCE(v_un, '{}'::uuid[])) AS u(pid)
      LEFT JOIN public.tournament_bracket_matches m
        ON m.tournament_id = p_tournament_id AND m.round = p_completed_round
       AND m.side = 'winner' AND u.pid IN (m.participant1_id, m.participant2_id)
     WHERE NOT (u.pid = ANY (COALESCE(v_lb_prev_winners, '{}'::uuid[])));

    v_count := COALESCE(array_length(v_winners, 1), 0);
    v_n_s   := COALESCE(array_length(v_lb_prev_winners, 1), 0);
    v_n_l   := COALESCE(array_length(v_losers, 1), 0);

    -- Un invaincu et un seul athlète à une défaite : les deux tableaux sont
    -- joués, la grande finale les oppose (l'invaincu en premier).
    IF v_count <= 1 AND v_n_s + v_n_l <= 1 THEN
      IF v_count = 1 AND v_n_s + v_n_l = 1 THEN
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
        VALUES (p_tournament_id, p_completed_round + 1, 1, 'grand_final',
                v_winners[1], COALESCE(v_lb_prev_winners[1], v_losers[1]), 'pending');
        RETURN 1;
      END IF;
      RETURN 0;
    END IF;

    -- Tour suivant du tableau des gagnants, exemption si impair.
    IF v_count >= 2 THEN
      i := 1;
      WHILE i <= v_count LOOP
        IF i + 1 <= v_count THEN
          INSERT INTO public.tournament_bracket_matches
            (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
          VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'winner',
                  v_winners[i], v_winners[i+1], 'pending');
        ELSE
          INSERT INTO public.tournament_bracket_matches
            (tournament_id, round, match_number, side, participant1_id, winner_id, status, completed_at)
          VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'winner',
                  v_winners[i], v_winners[i], 'bye', now());
        END IF;
        v_crees := v_crees + 1;
        v_match_num := v_match_num + 1;
        i := i + 2;
      END LOOP;
    END IF;

    -- Tour suivant du tableau des perdants : S[i] contre L[i], puis le reste
    -- entre soi, exemption si impair. Personne n'est omis.
    v_reste := COALESCE(v_lb_prev_winners[LEAST(v_n_s, v_n_l) + 1 : v_n_s], '{}'::uuid[])
            || COALESCE(v_losers[LEAST(v_n_s, v_n_l) + 1 : v_n_l], '{}'::uuid[]);
    v_match_num := 1;
    i := 1;
    WHILE i <= LEAST(v_n_s, v_n_l) LOOP
      INSERT INTO public.tournament_bracket_matches
        (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
      VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'loser',
              v_lb_prev_winners[i], v_losers[i], 'pending');
      v_crees := v_crees + 1;
      v_match_num := v_match_num + 1;
      i := i + 1;
    END LOOP;
    i := 1;
    WHILE i <= COALESCE(array_length(v_reste, 1), 0) LOOP
      IF i + 1 <= array_length(v_reste, 1) THEN
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
        VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'loser',
                v_reste[i], v_reste[i+1], 'pending');
      ELSE
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, winner_id, status, completed_at)
        VALUES (p_tournament_id, p_completed_round + 1, v_match_num, 'loser',
                v_reste[i], v_reste[i], 'bye', now());
      END IF;
      v_crees := v_crees + 1;
      v_match_num := v_match_num + 1;
      i := i + 2;
    END LOOP;

    RETURN v_crees;
  END IF;

  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tournament_bracket_standings(p_tournament_id uuid)
 RETURNS TABLE(athlete_id uuid, final_rank integer, still_alive boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_format   text;
  v_double   boolean;
  v_has_lb   boolean;
  v_max_wb   int;
  v_max_lb   int;
  v_champion uuid;
  v_runner   uuid;
BEGIN
  SELECT t.format INTO v_format FROM public.tournaments t WHERE t.id = p_tournament_id;
  v_double := (v_format = 'swiss');

  DROP TABLE IF EXISTS _bs_m;
  CREATE TEMP TABLE _bs_m ON COMMIT DROP AS
    SELECT m.round, COALESCE(m.side, 'winner') AS side, m.participant1_id, m.participant2_id,
           m.winner_id,
           COALESCE(m.loser_id,
                    CASE WHEN m.winner_id = m.participant1_id THEN m.participant2_id
                         WHEN m.winner_id = m.participant2_id THEN m.participant1_id END) AS loser_id
      FROM public.tournament_bracket_matches m
     WHERE m.tournament_id = p_tournament_id;

  SELECT EXISTS (SELECT 1 FROM _bs_m WHERE side IN ('loser', 'grand_final')) INTO v_has_lb;
  IF NOT v_double OR NOT v_has_lb THEN
    -- Simple élimination sur le winner bracket.
    SELECT MAX(round) INTO v_max_wb FROM _bs_m WHERE side = 'winner';
    SELECT m.winner_id INTO v_champion
      FROM _bs_m m
     WHERE m.side = 'winner' AND m.round = v_max_wb AND m.winner_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM _bs_m l WHERE l.side = 'winner' AND l.loser_id = m.winner_id)
     LIMIT 1;

    RETURN QUERY
      WITH p AS (
        SELECT DISTINCT pid FROM (
          SELECT participant1_id pid FROM _bs_m WHERE side = 'winner'
          UNION ALL SELECT participant2_id FROM _bs_m WHERE side = 'winner'
        ) u WHERE pid IS NOT NULL
      ),
      k AS (
        SELECT p.pid,
               (SELECT MAX(round) FROM _bs_m l WHERE l.side = 'winner' AND l.loser_id = p.pid) AS er
          FROM p
      ),
      keyed AS (
        SELECT k.pid,
               CASE WHEN k.pid = v_champion THEN 'Infinity'::numeric
                    WHEN k.er IS NULL THEN v_max_wb + 0.5
                    ELSE k.er END AS key,
               (k.pid <> COALESCE(v_champion, '00000000-0000-0000-0000-000000000000'::uuid) AND k.er IS NULL) AS alive
          FROM k
      )
      SELECT keyed.pid, RANK() OVER (ORDER BY keyed.key DESC)::int, keyed.alive FROM keyed;
    RETURN;
  END IF;

  -- Double élimination : WB + LB + grande finale.
  SELECT COALESCE(MAX(round), 0) INTO v_max_lb FROM _bs_m WHERE side = 'loser';
  -- La DERNIÈRE grande finale décide (le match décisif s'il existe) ; non jouée,
  -- personne n'est encore champion. Une seule finale, gagnée par l'athlète venu
  -- du tableau des perdants : le match décisif reste à jouer (migration 20270111).
  SELECT m.winner_id, m.loser_id INTO v_champion, v_runner
    FROM _bs_m m WHERE m.side = 'grand_final' ORDER BY m.round DESC LIMIT 1;
  IF (SELECT count(*) FROM _bs_m WHERE side = 'grand_final') = 1
     AND EXISTS (SELECT 1 FROM _bs_m WHERE side IN ('winner', 'loser') AND loser_id = v_champion) THEN
    v_champion := NULL;
    v_runner   := NULL;
  END IF;

  RETURN QUERY
    WITH p AS (
      SELECT DISTINCT pid FROM (
        SELECT participant1_id pid FROM _bs_m UNION ALL SELECT participant2_id FROM _bs_m
      ) u WHERE pid IS NOT NULL
    ),
    k AS (
      SELECT p.pid,
             (SELECT MAX(round) FROM _bs_m l WHERE l.side = 'loser' AND l.loser_id = p.pid) AS lb_round
        FROM p
    ),
    keyed AS (
      SELECT k.pid,
             CASE WHEN k.pid = v_champion THEN 'Infinity'::numeric
                  WHEN k.pid = v_runner   THEN v_max_lb + 2
                  WHEN k.lb_round IS NOT NULL THEN k.lb_round
                  ELSE v_max_lb + 1 END AS key,
             (k.pid IS DISTINCT FROM v_champion AND k.pid IS DISTINCT FROM v_runner AND k.lb_round IS NULL) AS alive
        FROM k
    )
    SELECT keyed.pid, RANK() OVER (ORDER BY keyed.key DESC)::int, keyed.alive FROM keyed;
END;
$function$;

COMMIT;
