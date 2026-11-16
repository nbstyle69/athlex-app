-- Décor du test local des scripts de la démo historique (test-rejeu.sh).
-- Joué sur une copie de la base de rejeu, jamais en prod.
--   AthleX Fitness (id réel) : gérant (900), membre réel (901), testapple (906),
--     reviewer (905, dans internal.demo_accounts, adresse hors domaine),
--     6 comptes de démo 1..6 (@demo.athlexapp.eu, dans internal.demo_accounts) ;
--   box N (« NBS2 ») : gérant 903, membre réel 904 ;
--   tournois d'AthleX Fitness : TD1 tableau terminé entre comptes de démo
--     (matchs, ELO de match, ELO de clôture), TD2 ligue en cours (division, scores
--     validés), TX tableau terminé entre deux réels (hors listes) ;
--   WODs : W1 créé par le démo 1, scoré par les démos (ELO calculé) ; W2 du gérant,
--     scoré par le réel ; un compte de démo hors internal.demo_accounts (907).
\set ON_ERROR_STOP on
SET search_path = public, extensions;

CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a599-' || lpad(n::text, 12, '0'))::uuid $$;

INSERT INTO auth.users (id, email)
SELECT pg_temp.u(n), CASE
         WHEN n <= 6  THEN 'prenom' || n || '.nom@demo.athlexapp.eu'
         WHEN n = 905 THEN 'reviewer-905@test.invalid'
         WHEN n = 907 THEN 'hors.liste@demo.athlexapp.eu'
         ELSE 'reel-' || n || '@test.invalid' END
  FROM (SELECT generate_series(1, 6) UNION ALL SELECT unnest(ARRAY[900, 901, 903, 904, 905, 906, 907])) v(n);
INSERT INTO public.profiles (id, email, username)
SELECT id, email, 'h599_' || right(id::text, 4) FROM auth.users WHERE id::text LIKE '00000000-0000-4000-a599-%'
ON CONFLICT (id) DO NOTHING;
INSERT INTO internal.demo_accounts (user_id) SELECT pg_temp.u(n) FROM unnest(ARRAY[1, 2, 3, 4, 5, 6, 905]) n;

INSERT INTO public.boxes (id, name, invite_code, owner_id, allowed_tournament_formats) VALUES
  ('d3d0b0a0-0000-4000-a000-000000000001', 'AthleX Fitness (test)', 'H599AF', pg_temp.u(900), '{simple,bracket,swiss,league_div}'),
  ('00000000-0000-4000-b599-00000000000b', 'NBS2 (test)', 'H599N', pg_temp.u(903), '{simple}');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active) VALUES
  ('00000000-0000-4000-c599-0000000000a1', 'd3d0b0a0-0000-4000-a000-000000000001', 'Illimité', 9900, 'subscription', true);
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(n), CASE n WHEN 900 THEN 'owner' WHEN 6 THEN 'coach' ELSE 'member' END, 'active'
  FROM unnest(ARRAY[1, 2, 3, 4, 5, 6, 900, 901, 905, 906, 907]) n;
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT '00000000-0000-4000-b599-00000000000b', pg_temp.u(n), CASE n WHEN 903 THEN 'owner' ELSE 'member' END, 'active'
  FROM unnest(ARRAY[903, 904]) n;

-- Tournois.
INSERT INTO public.tournaments (id, name, level, status, format, box_id, max_participants, third_place_match, created_by) VALUES
  ('00000000-0000-4000-d599-000000000001', 'TD1', 'rx', 'completed', 'bracket', 'd3d0b0a0-0000-4000-a000-000000000001', 4, false, pg_temp.u(900)),
  ('00000000-0000-4000-d599-000000000002', 'TD2', 'rx', 'active', 'league_div', 'd3d0b0a0-0000-4000-a000-000000000001', 8, false, pg_temp.u(900)),
  ('00000000-0000-4000-d599-000000000003', 'TX',  'rx', 'completed', 'bracket', 'd3d0b0a0-0000-4000-a000-000000000001', 2, false, pg_temp.u(900));
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT '00000000-0000-4000-d599-000000000001'::uuid, pg_temp.u(n) FROM generate_series(1, 4) n
UNION ALL SELECT '00000000-0000-4000-d599-000000000002', pg_temp.u(n) FROM generate_series(3, 6) n
UNION ALL SELECT '00000000-0000-4000-d599-000000000003', pg_temp.u(n) FROM unnest(ARRAY[900, 901]) n;
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status, bracket_board, bracket_stage) VALUES
  ('00000000-0000-4000-e599-000000000001', '00000000-0000-4000-d599-000000000001', 'Demi', 'For Time', 'closed', 'winner', 1),
  ('00000000-0000-4000-e599-000000000002', '00000000-0000-4000-d599-000000000001', 'Finale', 'For Time', 'closed', 'winner', 0),
  ('00000000-0000-4000-e599-000000000003', '00000000-0000-4000-d599-000000000003', 'Finale X', 'For Time', 'closed', 'winner', 0);
INSERT INTO public.tournament_wods (id, tournament_id, title, type, status) VALUES
  ('00000000-0000-4000-e599-000000000004', '00000000-0000-4000-d599-000000000002', 'Journée 1', 'AMRAP', 'active');
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status, wod_id) VALUES
  ('00000000-0000-4000-d599-000000000001', 1, 1, 'winner', pg_temp.u(1), pg_temp.u(2), pg_temp.u(1), pg_temp.u(2), 'completed', '00000000-0000-4000-e599-000000000001'),
  ('00000000-0000-4000-d599-000000000001', 1, 2, 'winner', pg_temp.u(3), pg_temp.u(4), pg_temp.u(3), pg_temp.u(4), 'completed', '00000000-0000-4000-e599-000000000001'),
  ('00000000-0000-4000-d599-000000000001', 2, 1, 'winner', pg_temp.u(1), pg_temp.u(3), pg_temp.u(1), pg_temp.u(3), 'completed', '00000000-0000-4000-e599-000000000002'),
  ('00000000-0000-4000-d599-000000000003', 1, 1, 'winner', pg_temp.u(900), pg_temp.u(901), pg_temp.u(901), pg_temp.u(900), 'completed', '00000000-0000-4000-e599-000000000003');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status, validated_by, validated_at)
SELECT '00000000-0000-4000-d599-000000000001', '00000000-0000-4000-e599-000000000001', pg_temp.u(n), (300 + n)::text, 'validated', pg_temp.u(6), now() FROM generate_series(1, 4) n;
INSERT INTO public.tournament_elo_history (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change)
SELECT '00000000-0000-4000-d599-000000000001', pg_temp.u(n), n, 4, 1000, 1000, 1000, 0 FROM generate_series(1, 4) n;
INSERT INTO public.tournament_divisions (id, tournament_id, name, level, max_members) VALUES
  ('00000000-0000-4000-f599-000000000001', '00000000-0000-4000-d599-000000000002', 'D1', 1, 4);
INSERT INTO public.tournament_division_members (division_id, athlete_id)
SELECT '00000000-0000-4000-f599-000000000001', pg_temp.u(n) FROM generate_series(3, 6) n ON CONFLICT DO NOTHING;
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
SELECT '00000000-0000-4000-d599-000000000002', '00000000-0000-4000-e599-000000000004', pg_temp.u(n), (100 + n)::text, 'validated' FROM generate_series(3, 6) n;

-- WODs : W1 créé par le démo 1, scoré par les démos 1..3 ; W2 du gérant, scoré par le réel 901.
INSERT INTO public.box_wods (id, box_id, created_by, title, wod_type, scheduled_date, is_published, leaderboard_enabled) VALUES
  ('00000000-0000-4000-e599-0000000000f1', 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(1), 'WOD démo', 'amrap', current_date - 40, true, true),
  ('00000000-0000-4000-e599-0000000000f2', 'd3d0b0a0-0000-4000-a000-000000000001', pg_temp.u(900), 'WOD réel', 'amrap', current_date - 2, true, true);
INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value, rx, scaled)
SELECT '00000000-0000-4000-e599-0000000000f1'::uuid, pg_temp.u(n), 'd3d0b0a0-0000-4000-a000-000000000001'::uuid, 'reps', 100 + n, true, false FROM generate_series(1, 3) n
UNION ALL SELECT '00000000-0000-4000-e599-0000000000f2', pg_temp.u(901), 'd3d0b0a0-0000-4000-a000-000000000001', 'reps', 120, true, false;
INSERT INTO public.elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank)
SELECT 'd3d0b0a0-0000-4000-a000-000000000001'::uuid, '00000000-0000-4000-e599-0000000000f1'::uuid, pg_temp.u(n), 1000, 1000 + 10 - n, 10 - n, n FROM generate_series(1, 3) n
UNION ALL SELECT 'd3d0b0a0-0000-4000-a000-000000000001', '00000000-0000-4000-e599-0000000000f2', pg_temp.u(901), 1000, 1012, 12, 1;
-- Amitié entre deux comptes de démo (part en cascade, sans contact).
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (pg_temp.u(1), pg_temp.u(2), 'accepted');

-- Tables d'Auth que le rejeu ne fournit pas (souches à l'image de GoTrue, clés
-- comprises ; vérifiées contre le catalogue de prod). refresh_tokens.user_id est
-- du texte SANS clé étrangère : seule la session l'emporte en cascade.
CREATE TABLE IF NOT EXISTS auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text, user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE, provider text DEFAULT 'email', identity_data jsonb DEFAULT '{}');
CREATE TABLE IF NOT EXISTS auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (id bigserial PRIMARY KEY, token varchar(255), user_id varchar(255), revoked boolean DEFAULT false, session_id uuid REFERENCES auth.sessions (id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS auth.mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE, factor_type text DEFAULT 'totp', status text DEFAULT 'verified');
CREATE TABLE IF NOT EXISTS auth.mfa_challenges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), factor_id uuid NOT NULL REFERENCES auth.mfa_factors (id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES auth.sessions (id) ON DELETE CASCADE, authentication_method text DEFAULT 'password');
CREATE TABLE IF NOT EXISTS auth.one_time_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE, token_type text DEFAULT 'recovery_token');
-- Pour les démos 1..6, le reviewer, testapple et le réel : identité, session
-- (avec AMR et jeton lié), facteur MFA (avec défi), jeton à usage unique ; plus
-- un jeton de rafraîchissement ancien SANS session (user_id seul).
INSERT INTO auth.identities (provider_id, user_id) SELECT pg_temp.u(n)::text, pg_temp.u(n) FROM unnest(ARRAY[1, 2, 3, 4, 5, 6, 901, 905, 906]) n;
INSERT INTO auth.sessions (user_id) SELECT pg_temp.u(n) FROM unnest(ARRAY[1, 2, 3, 4, 5, 6, 901, 905, 906]) n;
INSERT INTO auth.mfa_amr_claims (session_id) SELECT id FROM auth.sessions;
INSERT INTO auth.refresh_tokens (token, user_id, session_id) SELECT 't-' || user_id, user_id::text, id FROM auth.sessions;
INSERT INTO auth.refresh_tokens (token, user_id, session_id) SELECT 'ancien-' || pg_temp.u(n), pg_temp.u(n)::text, NULL FROM unnest(ARRAY[1, 2, 901, 905]) n;
INSERT INTO auth.mfa_factors (user_id) SELECT pg_temp.u(n) FROM unnest(ARRAY[1, 2, 3, 901, 905, 906]) n;
INSERT INTO auth.mfa_challenges (factor_id) SELECT id FROM auth.mfa_factors;
INSERT INTO auth.one_time_tokens (user_id) SELECT pg_temp.u(n) FROM unnest(ARRAY[1, 2, 901, 906]) n;

-- Décisions du 16/11 : le reviewer (accepté) figure dans les tournois de démo
-- (inscription, division, score de TD2 ; ELO de match et de tournoi de TD1),
-- il a un ami de démo et une ligne box_elo ; un groupe de messages de la box,
-- créé par le gérant, ne contient que des comptes de démo.
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES ('00000000-0000-4000-d599-000000000002', pg_temp.u(905));
INSERT INTO public.tournament_division_members (division_id, athlete_id) VALUES ('00000000-0000-4000-f599-000000000001', pg_temp.u(905)) ON CONFLICT DO NOTHING;
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
VALUES ('00000000-0000-4000-d599-000000000002', '00000000-0000-4000-e599-000000000004', pg_temp.u(905), '150', 'validated');
INSERT INTO public.tournament_elo_history (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change)
VALUES ('00000000-0000-4000-d599-000000000001', pg_temp.u(905), 5, 5, 1000, 1000, 1000, 0);
INSERT INTO public.tournament_match_elo_history (match_id, tournament_id, athlete_id, opponent_id, result, elo_before, elo_after, elo_delta)
SELECT id, tournament_id, pg_temp.u(905), pg_temp.u(1), 'loss', 1000, 990, -10 FROM public.tournament_bracket_matches
 WHERE tournament_id = '00000000-0000-4000-d599-000000000001' AND round = 2;
INSERT INTO public.friendships (requester_id, addressee_id, status) VALUES (pg_temp.u(905), pg_temp.u(3), 'accepted');
INSERT INTO public.box_elo (member_id, box_id, elo, matches, wins) VALUES (pg_temp.u(905), 'd3d0b0a0-0000-4000-a000-000000000001', 1012, 7, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.message_groups (id, box_id, name, created_by, members) VALUES
  ('00000000-0000-4000-9599-000000000001', 'd3d0b0a0-0000-4000-a000-000000000001', 'Groupe démo', pg_temp.u(900), ARRAY[pg_temp.u(1), pg_temp.u(2)]);
