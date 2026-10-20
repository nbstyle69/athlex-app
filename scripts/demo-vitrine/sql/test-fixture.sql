-- Décor du test local des scripts SQL de la box vitrine (test-rejeu.sh).
-- Joué sur une copie de la base de rejeu, jamais en prod.
--   AthleX Fitness (id réel) : gérant, un membre réel, formule « Accès démo »,
--     50 membres demo.vitrine+NN et le coach, une alerte ouverte sur +07 ;
--   box jetable J : gérant, les membres +01..04 et le coach (rattachés aussi à J),
--     sa propre formule « Accès démo » ;
--   box jetable sale K : un membre réel → refusée ;
--   tournois d'AthleX Fitness : TV1 bracket terminé (matchs, ELO, clôture), TV2
--     ligue en cours (divisions, scores validés), TX bracket terminé NON listé ;
--   tournoi TK dans la box K.
\set ON_ERROR_STOP on
SET search_path = public, extensions;

CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a523-' || lpad(n::text, 12, '0'))::uuid $$;

-- 1..50 membres fictifs, 51 coach, 900 gérant AF, 901 réel AF, 902 gérant J,
-- 903 gérant K, 904 réel K, 905 compte au motif voisin (demo.vitrine+51) dans AF.
INSERT INTO auth.users (id, email)
SELECT pg_temp.u(n), CASE
         WHEN n <= 50 THEN 'demo.vitrine+' || lpad(n::text, 2, '0') || '@athlexapp.eu'
         WHEN n = 51  THEN 'demo.vitrine+coach@athlexapp.eu'
         WHEN n = 905 THEN 'demo.vitrine+51@athlexapp.eu'
         ELSE 'reel-' || n || '@test.invalid' END
  FROM (SELECT generate_series(1, 51) UNION ALL SELECT unnest(ARRAY[900, 901, 902, 903, 904, 905])) v(n);
INSERT INTO public.profiles (id, email, username)
SELECT id, email, 'v523_' || right(id::text, 4) FROM auth.users WHERE id::text LIKE '00000000-0000-4000-a523-%'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.boxes (id, name, invite_code, owner_id, allowed_tournament_formats) VALUES
  ('d3d0b0a0-0000-4000-a000-000000000001', 'AthleX Fitness (test)', 'V523AF', pg_temp.u(900), '{simple,bracket,swiss,league_div}'),
  ('00000000-0000-4000-b523-00000000000a', 'Jetable J', 'V523J', pg_temp.u(902), '{simple,bracket}'),
  ('00000000-0000-4000-b523-00000000000b', 'Jetable K', 'V523K', pg_temp.u(903), '{simple}');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active) VALUES
  ('00000000-0000-4000-c523-0000000000a1', 'd3d0b0a0-0000-4000-a000-000000000001', 'Accès démo', 0, 'subscription', false),
  ('00000000-0000-4000-c523-0000000000a2', 'd3d0b0a0-0000-4000-a000-000000000001', 'Illimité', 9900, 'subscription', true),
  ('00000000-0000-4000-c523-0000000000b1', '00000000-0000-4000-b523-00000000000a', 'Accès démo', 0, 'subscription', false),
  ('00000000-0000-4000-c523-0000000000c1', '00000000-0000-4000-b523-00000000000b', 'Accès démo', 0, 'subscription', false);

-- Rattachements comme join_box_by_invite : actif, sans formule ni abonnement.
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(n), CASE n WHEN 900 THEN 'owner' WHEN 51 THEN 'coach' ELSE 'member' END, 'active'
  FROM (SELECT generate_series(1, 51) UNION ALL SELECT unnest(ARRAY[900, 901, 905])) v(n);
UPDATE public.box_members SET plan_id = '00000000-0000-4000-c523-0000000000a2', subscription_status = 'active', payment_method_type = 'cash'
 WHERE member_id = pg_temp.u(901);
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b523-00000000000a', pg_temp.u(n), CASE n WHEN 902 THEN 'owner' WHEN 51 THEN 'coach' ELSE 'member' END, 'active'
  FROM unnest(ARRAY[1, 2, 3, 4, 51, 902]) n;
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b523-00000000000b', pg_temp.u(n), CASE n WHEN 903 THEN 'owner' WHEN 51 THEN 'coach' ELSE 'member' END, 'active'
  FROM unnest(ARRAY[1, 2, 3, 4, 51, 903, 904]) n;

-- Une alerte ouverte (réservation faite par un staff pour +07 sans formule) :
-- elle a déjà filé sa notification gérant ; le script ne doit rien filer de plus.
INSERT INTO public.box_member_alerts (box_id, member_id, kind, created_by)
VALUES ('d3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(7), 'reservation_sans_formule', pg_temp.u(51));

-- Tournois.
INSERT INTO public.tournaments (id, name, level, status, format, box_id, max_participants, third_place_match) VALUES
  ('00000000-0000-4000-d523-000000000001', 'TV1', 'rx', 'completed', 'bracket', 'd3d0b0a0-0000-4000-a000-000000000001', 4, true),
  ('00000000-0000-4000-d523-000000000002', 'TV2', 'rx', 'active', 'league_div', 'd3d0b0a0-0000-4000-a000-000000000001', 8, false),
  ('00000000-0000-4000-d523-000000000003', 'TX',  'rx', 'completed', 'bracket', 'd3d0b0a0-0000-4000-a000-000000000001', 2, false),
  ('00000000-0000-4000-d523-000000000004', 'TK',  'rx', 'open', 'simple', '00000000-0000-4000-b523-00000000000b', 8, false);
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT '00000000-0000-4000-d523-000000000001'::uuid, pg_temp.u(n) FROM generate_series(1, 4) n
UNION ALL SELECT '00000000-0000-4000-d523-000000000002', pg_temp.u(n) FROM generate_series(5, 8) n
UNION ALL SELECT '00000000-0000-4000-d523-000000000003', pg_temp.u(n) FROM unnest(ARRAY[9, 10]) n;
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status, bracket_board, bracket_stage) VALUES
  ('00000000-0000-4000-e523-000000000001', '00000000-0000-4000-d523-000000000001', 'Demi', 'For Time', 'closed', 'winner', 1),
  ('00000000-0000-4000-e523-000000000002', '00000000-0000-4000-d523-000000000001', 'Finale', 'For Time', 'closed', 'winner', 0),
  ('00000000-0000-4000-e523-000000000003', '00000000-0000-4000-d523-000000000003', 'Finale X', 'For Time', 'closed', 'winner', 0);
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status) VALUES
  ('00000000-0000-4000-e523-000000000004', '00000000-0000-4000-d523-000000000002', 'Journée 1', 'AMRAP', 'active');
-- Matchs terminés : trg_bracket_match_elo écrit tournament_match_elo_history.
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status, wod_id) VALUES
  ('00000000-0000-4000-d523-000000000001', 1, 1, 'winner', pg_temp.u(1), pg_temp.u(2), pg_temp.u(1), pg_temp.u(2), 'completed', '00000000-0000-4000-e523-000000000001'),
  ('00000000-0000-4000-d523-000000000001', 1, 2, 'winner', pg_temp.u(3), pg_temp.u(4), pg_temp.u(3), pg_temp.u(4), 'completed', '00000000-0000-4000-e523-000000000001'),
  ('00000000-0000-4000-d523-000000000001', 2, 1, 'winner', pg_temp.u(1), pg_temp.u(3), pg_temp.u(1), pg_temp.u(3), 'completed', '00000000-0000-4000-e523-000000000002'),
  ('00000000-0000-4000-d523-000000000001', 2, 2, 'third_place', pg_temp.u(2), pg_temp.u(4), pg_temp.u(2), pg_temp.u(4), 'forfeit', '00000000-0000-4000-e523-000000000002'),
  ('00000000-0000-4000-d523-000000000003', 1, 1, 'winner', pg_temp.u(9), pg_temp.u(10), pg_temp.u(9), pg_temp.u(10), 'completed', '00000000-0000-4000-e523-000000000003');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
SELECT '00000000-0000-4000-d523-000000000001', '00000000-0000-4000-e523-000000000001', pg_temp.u(n), (300 + n)::text, 'validated' FROM generate_series(1, 4) n;
INSERT INTO public.tournament_elo_history (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change)
SELECT '00000000-0000-4000-d523-000000000001', pg_temp.u(n), n, 4, 1000, 1000, 1000, 0 FROM generate_series(1, 4) n;
-- Ligue : divisions, membres, scores validés (points recalculés par déclencheur).
INSERT INTO public.tournament_divisions (id, tournament_id, name, level, max_members) VALUES
  ('00000000-0000-4000-f523-000000000001', '00000000-0000-4000-d523-000000000002', 'D1', 1, 4);
INSERT INTO public.tournament_division_members (division_id, athlete_id)
SELECT '00000000-0000-4000-f523-000000000001', pg_temp.u(n) FROM generate_series(5, 8) n
ON CONFLICT DO NOTHING;
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
SELECT '00000000-0000-4000-d523-000000000002', '00000000-0000-4000-e523-000000000004', pg_temp.u(n), (100 + n)::text, 'validated' FROM generate_series(5, 8) n;
