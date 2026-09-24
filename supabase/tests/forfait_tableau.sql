-- ═════════════════════════════════════════════════════════════════════════════
-- Forfait en tableau (migration 20270113)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Quatre athlètes à 1000 ELO, un tableau simple (T1) et une double
-- élimination (T2) :
--   F1 un forfait ne fait bouger ni l'ELO ni les compteurs, et n'écrit aucun
--      historique ;
--   F2 un match terminé passé en forfait voit son ELO retiré exactement ;
--   F3 l'athlète présent passe au tour suivant ;
--   F4 en double élimination, le forfait est une défaite : l'absent passe au
--      tableau des perdants ;
--   F5 un forfait incohérent (sans perdant, ou vainqueur hors du match) est refusé ;
--   F6 un tableau qui a un forfait ne se régénère plus.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Forfait en tableau : l''adversaire passe, aucun ELO'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9f0-00000000000' || n)::uuid FROM generate_series(0, 4) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9f0-00000000000' || n)::uuid, 'ff-' || n || '@test.invalid', 'ff_' || n
  FROM generate_series(0, 4) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9f0-000000000001', 'Box forfait', 'FFTS', '00000000-0000-4000-a9f0-000000000000');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9f0-000000000001', '00000000-0000-4000-a9f0-000000000000', 'owner', 'active');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status) VALUES
  ('00000000-0000-4000-c9f0-000000000001', 'T1', 'rx', 'bracket', '00000000-0000-4000-b9f0-000000000001', '00000000-0000-4000-a9f0-000000000000', 'active'),
  ('00000000-0000-4000-c9f0-000000000002', 'T2', 'rx', 'swiss',   '00000000-0000-4000-b9f0-000000000001', '00000000-0000-4000-a9f0-000000000000', 'active');
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT t, ('00000000-0000-4000-a9f0-00000000000' || n)::uuid
  FROM unnest(ARRAY['00000000-0000-4000-c9f0-000000000001', '00000000-0000-4000-c9f0-000000000002']::uuid[]) t,
       generate_series(1, 4) n;
-- Tour 1 des deux tableaux : 1 contre 2, 3 contre 4.
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
SELECT t, 1, k, 'winner', ('00000000-0000-4000-a9f0-00000000000' || (2 * k - 1))::uuid,
       ('00000000-0000-4000-a9f0-00000000000' || (2 * k))::uuid, 'pending'
  FROM unnest(ARRAY['00000000-0000-4000-c9f0-000000000001', '00000000-0000-4000-c9f0-000000000002']::uuid[]) t,
       generate_series(1, 2) k;

DO $t$
DECLARE
  v_t1 constant uuid := '00000000-0000-4000-c9f0-000000000001';
  v_t2 constant uuid := '00000000-0000-4000-c9f0-000000000002';
  a1 constant uuid := '00000000-0000-4000-a9f0-000000000001';
  a2 constant uuid := '00000000-0000-4000-a9f0-000000000002';
  a3 constant uuid := '00000000-0000-4000-a9f0-000000000003';
  a4 constant uuid := '00000000-0000-4000-a9f0-000000000004';
  v_ok boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9f0-000000000000', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- F1 : 2 absent, 1 passe.
  UPDATE public.tournament_bracket_matches SET status = 'forfeit', winner_id = a1, loser_id = a2, completed_at = now()
   WHERE tournament_id = v_t1 AND round = 1 AND match_number = 1;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (a1, a2) AND (elo, total_matches, wins) <> (1000, 0, 0))
     OR EXISTS (SELECT 1 FROM public.tournament_match_elo_history WHERE tournament_id = v_t1) THEN
    RAISE EXCEPTION 'F1 : le forfait a fait bouger l''ELO ou écrit un historique';
  END IF;

  -- F2 : 3 bat 4 (l'ELO bouge : contre-exemple), puis le match passe en forfait de 4.
  UPDATE public.tournament_bracket_matches SET status = 'completed', winner_id = a3, loser_id = a4, completed_at = now()
   WHERE tournament_id = v_t1 AND round = 1 AND match_number = 2;
  IF (SELECT elo FROM public.profiles WHERE id = a3) = 1000 THEN
    RAISE EXCEPTION 'contre-exemple : le match terminé n''a pas fait bouger l''ELO';
  END IF;
  UPDATE public.tournament_bracket_matches SET status = 'forfeit'
   WHERE tournament_id = v_t1 AND round = 1 AND match_number = 2;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (a3, a4) AND (elo, total_matches, wins) <> (1000, 0, 0))
     OR EXISTS (SELECT 1 FROM public.tournament_match_elo_history WHERE tournament_id = v_t1) THEN
    RAISE EXCEPTION 'F2 : passé en forfait, le match garde son ELO';
  END IF;

  -- F3 : les présents (1 et 3) se retrouvent au tour 2.
  PERFORM public.advance_bracket_round(v_t1, 1);
  IF NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                  WHERE tournament_id = v_t1 AND round = 2 AND participant1_id = a1 AND participant2_id = a3) THEN
    RAISE EXCEPTION 'F3 : les vainqueurs par forfait ne sont pas au tour 2';
  END IF;

  -- F4 : double élimination, 2 absent au tour 1 : il joue le tour 2 côté perdants.
  UPDATE public.tournament_bracket_matches SET status = 'forfeit', winner_id = a1, loser_id = a2, completed_at = now()
   WHERE tournament_id = v_t2 AND round = 1 AND match_number = 1;
  UPDATE public.tournament_bracket_matches SET status = 'completed', winner_id = a3, loser_id = a4, completed_at = now()
   WHERE tournament_id = v_t2 AND round = 1 AND match_number = 2;
  PERFORM public.advance_bracket_round(v_t2, 1);
  IF NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                  WHERE tournament_id = v_t2 AND round = 2 AND side = 'loser' AND a2 IN (participant1_id, participant2_id))
     OR EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                 WHERE tournament_id = v_t2 AND round = 2 AND side = 'winner' AND a2 IN (participant1_id, participant2_id)) THEN
    RAISE EXCEPTION 'F4 : l''absent n''est pas passé au tableau des perdants';
  END IF;

  -- F5 : forfaits incohérents refusés.
  v_ok := false;
  BEGIN
    UPDATE public.tournament_bracket_matches SET status = 'forfeit', winner_id = a1, loser_id = NULL
     WHERE tournament_id = v_t1 AND round = 2;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'F5 : forfait sans perdant accepté'; END IF;
  v_ok := false;
  BEGIN
    UPDATE public.tournament_bracket_matches SET status = 'forfeit', winner_id = a2, loser_id = a1
     WHERE tournament_id = v_t1 AND round = 2;
  EXCEPTION WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'F5 : forfait gagné par un athlète hors du match accepté'; END IF;

  -- F6 : T1 n'a que des forfaits terminés : on ne le régénère plus.
  v_ok := false;
  BEGIN
    PERFORM public.generate_bracket_round_1(v_t1);
  EXCEPTION WHEN raise_exception THEN v_ok := SQLERRM LIKE 'Cannot regenerate%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'F6 : un tableau avec des forfaits a pu être régénéré'; END IF;

  RAISE NOTICE 'forfait en tableau : F1 à F6 conformes';
END $t$;

ROLLBACK;
