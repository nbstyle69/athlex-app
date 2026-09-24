-- ═════════════════════════════════════════════════════════════════════════════
-- Double élimination complète : aucun athlète omis — tournois, PR 5
--
-- Appliquée en prod : NON
--
-- `advance_bracket_round`, branche `swiss` (double élimination), appariait le
-- tableau des perdants par `LEAST(…)` des deux effectifs, sans exemption : à 8
-- athlètes, un vainqueur du tableau des perdants ne rejouait jamais et n'était
-- jamais éliminé ; à 5, 6 ou 7, un vainqueur isolé du tableau des gagnants
-- était oublié. Seul l'effectif de 4 convergeait.
--
-- Désormais, après le tour r :
--   * chaque athlète du tableau a un nombre de défaites, compté sur tous les
--     matchs décidés (une exemption n'en est pas une) : 0 → tableau des
--     gagnants, 1 → tableau des perdants, 2 → éliminé ;
--   * tableau des gagnants : les invaincus, appariés dans l'ordre des matchs du
--     tour, exemption si impair ;
--   * tableau des perdants : TOUS les athlètes à une défaite. Les vainqueurs du
--     tableau des perdants au tour r rencontrent d'abord les nouveaux perdants
--     du tableau des gagnants, le reste s'apparie entre soi, exemption si impair ;
--   * les deux tableaux avancent au même numéro de tour r + 1 : le tableau des
--     perdants né du tour 1 porte le tour 2 (il portait le tour 1) ;
--   * quand il reste un invaincu et un seul athlète à une défaite, les tableaux
--     sont joués (rendu 0). La grande finale est l'objet de la PR 6.
-- Un athlète n'est éliminé qu'à sa deuxième défaite, et personne n'est omis.
-- L'élimination simple (`bracket`) est inchangée.
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

    -- Un invaincu et au plus un athlète à une défaite : les deux tableaux sont
    -- joués. La grande finale se crée ailleurs.
    IF v_count <= 1 AND v_n_s + v_n_l <= 1 THEN
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

COMMIT;
