-- ═════════════════════════════════════════════════════════════════════════════
-- Petite finale optionnelle en élimination simple — tournois, PR 9
--
-- Appliquée en prod : NON
--
-- Règle produit : « Petite finale (3e place) en bracket simple : optionnelle,
-- choisie par le gérant à la création du tournoi. »
--
--   * `tournaments.third_place_match` (faux par défaut) : l'option du gérant ;
--   * côté `third_place` sur les matchs de tableau ;
--   * `advance_bracket_round` (élimination simple) : en créant la finale, crée
--     aussi la petite finale entre les deux perdants des demi-finales, si
--     l'option est cochée. Une demi-finale jouée par exemption n'a pas de
--     perdant : pas de petite finale ;
--   * l'ELO de match s'y applique comme à tout match (`apply_bracket_match_elo`) ;
--   * `tournament_bracket_standings` : son vainqueur est 3e, son perdant 4e ;
--     tant qu'elle n'est pas jouée, ses deux athlètes restent en lice et la
--     clôture refuse (TABLEAU_NON_TERMINE).
-- Double élimination : inchangée (le 3e y est le perdant de la finale des perdants).
--
-- Données en prod : la colonne est ajoutée à faux ; rien d'autre ne change.
--
-- Contrôlée par `supabase/tests/petite_finale.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.tournaments
  ADD COLUMN third_place_match boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.tournaments.third_place_match IS
  'Élimination simple : match pour la 3e place entre les perdants des demi-finales (choix du gérant à la création).';

ALTER TABLE public.tournament_bracket_matches
  DROP CONSTRAINT tournament_bracket_matches_side_check,
  ADD CONSTRAINT tournament_bracket_matches_side_check
    CHECK (side = ANY (ARRAY['winner'::text, 'loser'::text, 'grand_final'::text, 'third_place'::text]));

CREATE OR REPLACE FUNCTION public.apply_bracket_match_elo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  k_match constant numeric := 32;
  v_id      uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_win     uuid;
  v_lose    uuid;
  v_rec_win  uuid;
  v_rec_lose uuid;
  v_we      int;
  v_le      int;
  v_exp_w   numeric;
  v_delta   int;
  v_after_w int;
  v_after_l int;
  h         record;
BEGIN
  -- Deux écritures concurrentes du même match se sérialisent.
  PERFORM pg_advisory_xact_lock(hashtext('elo-match:' || v_id::text));

  -- 1. L'effet voulu, déduit de l'état du match.
  IF TG_OP <> 'DELETE'
     AND NEW.winner_id IS NOT NULL
     AND NEW.status = 'completed'
     AND NEW.side IN ('winner', 'loser', 'grand_final', 'third_place')
     AND NEW.participant1_id IS NOT NULL
     AND NEW.participant2_id IS NOT NULL
     AND NEW.participant1_id <> NEW.participant2_id
     AND NEW.winner_id IN (NEW.participant1_id, NEW.participant2_id) THEN
    v_win  := NEW.winner_id;
    v_lose := CASE WHEN NEW.winner_id = NEW.participant1_id
                   THEN NEW.participant2_id ELSE NEW.participant1_id END;
  END IF;

  -- 2. L'effet enregistré.
  SELECT athlete_id INTO v_rec_win  FROM tournament_match_elo_history WHERE match_id = v_id AND result = 'win';
  SELECT athlete_id INTO v_rec_lose FROM tournament_match_elo_history WHERE match_id = v_id AND result = 'loss';

  -- 3. Rien ne change : l'ELO n'est pas appliqué une seconde fois.
  IF v_rec_win IS NOT DISTINCT FROM v_win AND v_rec_lose IS NOT DISTINCT FROM v_lose THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- 4. Défaire exactement ce qui avait été appliqué.
  FOR h IN SELECT * FROM tournament_match_elo_history WHERE match_id = v_id LOOP
    UPDATE profiles p
       SET elo           = GREATEST(100, p.elo - h.elo_delta),
           total_matches = GREATEST(0, p.total_matches - 1),
           wins          = CASE WHEN h.result = 'win' THEN GREATEST(0, p.wins - 1) ELSE p.wins END
     WHERE p.id = h.athlete_id;
  END LOOP;
  DELETE FROM tournament_match_elo_history WHERE match_id = v_id;

  -- 5. Appliquer le nouvel effet, s'il y en a un.
  IF v_win IS NOT NULL THEN
    SELECT COALESCE(elo, 1000) INTO v_we FROM profiles WHERE id = v_win;
    SELECT COALESCE(elo, 1000) INTO v_le FROM profiles WHERE id = v_lose;
    IF v_we IS NOT NULL AND v_le IS NOT NULL THEN
      v_exp_w := 1.0 / (1.0 + POWER(10, (v_le - v_we) / 400.0));
      v_delta := ROUND(k_match * (1 - v_exp_w))::int;
      IF v_delta < 1 THEN v_delta := 1; END IF;   -- écart minimal garanti

      v_after_w := GREATEST(100, v_we + v_delta);
      v_after_l := GREATEST(100, v_le - v_delta);

      INSERT INTO tournament_match_elo_history
        (match_id, tournament_id, athlete_id, opponent_id, result, elo_before, elo_after, elo_delta)
      VALUES
        (v_id, NEW.tournament_id, v_win,  v_lose, 'win',  v_we, v_after_w, v_after_w - v_we),
        (v_id, NEW.tournament_id, v_lose, v_win,  'loss', v_le, v_after_l, v_after_l - v_le);

      UPDATE profiles SET elo = v_after_w, total_matches = total_matches + 1, wins = wins + 1 WHERE id = v_win;
      UPDATE profiles SET elo = v_after_l, total_matches = total_matches + 1                    WHERE id = v_lose;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

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

    -- Petite finale (option du tournoi, migration 20270114) : créée avec la
    -- finale, entre les deux perdants des demi-finales. Une demi-finale jouée
    -- par exemption n'a pas de perdant : pas de petite finale.
    IF v_count = 2 AND (SELECT t.third_place_match FROM public.tournaments t WHERE t.id = p_tournament_id) THEN
      SELECT array_agg(COALESCE(m.loser_id,
                                CASE WHEN m.winner_id = m.participant1_id THEN m.participant2_id ELSE m.participant1_id END)
                       ORDER BY m.match_number)
        INTO v_losers
        FROM public.tournament_bracket_matches m
       WHERE m.tournament_id = p_tournament_id AND m.round = p_completed_round
         AND m.side = 'winner' AND m.status <> 'bye';
      IF COALESCE(array_length(v_losers, 1), 0) = 2 THEN
        INSERT INTO public.tournament_bracket_matches
          (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
        VALUES (p_tournament_id, p_completed_round + 1, 1, 'third_place', v_losers[1], v_losers[2], 'pending');
      END IF;
    END IF;

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
  v_pf       record;
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

    -- Petite finale (migration 20270114) : son vainqueur passe devant l'autre
    -- demi-finaliste ; tant qu'elle n'est pas jouée, ses deux athlètes restent en lice.
    SELECT m.winner_id, m.participant1_id, m.participant2_id INTO v_pf
      FROM _bs_m m WHERE m.side = 'third_place' LIMIT 1;

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
                    WHEN k.pid = v_pf.winner_id THEN k.er + 0.5
                    ELSE k.er END AS key,
               ((k.pid <> COALESCE(v_champion, '00000000-0000-0000-0000-000000000000'::uuid) AND k.er IS NULL)
                OR COALESCE(v_pf.winner_id IS NULL AND k.pid IN (v_pf.participant1_id, v_pf.participant2_id), false)) AS alive
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
