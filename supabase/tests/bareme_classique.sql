-- ═════════════════════════════════════════════════════════════════════════════
-- Compétition classique : barème de l'app, calculé par la base (migration 20270116)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--   B1 cas de référence (étape 0 du chantier), un For Time : A et B en 8:00,
--      C en 9:30, D au CAP à 150 reps, E au CAP à 140 reps, F sans score.
--      Attendu : A 100, B 100 (rang 1 partagé), C 95 (rang 3, le 2 est sauté),
--      D 93, E 91, F 0 ;
--   B2 le tie-break départage d'abord : A (30) devant B (40) ;
--   B3 un tie-break donné passe devant un tie-break absent ;
--   B4 un score For Time illisible est ignoré : aucun rang, aucun point ;
--   B5 un score rejeté ou en attente sort du classement ;
--   B7 la clôture ELO du format `simple` suit ce classement : rang final
--      partagé à égalité de points (A et B 1ers, C 3e) ;
--   B6 deux WOD (dont un AMRAP : le plus haut gagne) : les points s'additionnent,
--      rang final partagé et rang suivant sauté ;
--   B8 la table de points est celle de l'app, au-delà du 50e rang compris.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Compétition classique : barème de l''app, calculé par la base'

BEGIN;

-- Gérant …0 ; athlètes A à H = …1 à …8.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9b1-00000000000' || n)::uuid FROM generate_series(0, 8) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9b1-00000000000' || n)::uuid, 'bc-' || n || '@test.invalid',
       'bc_' || substr('0ABCDEFGH', n + 1, 1)
  FROM generate_series(0, 8) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9b1-000000000001', 'Box barème', 'BCTS', '00000000-0000-4000-a9b1-000000000000');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9b1-000000000001', '00000000-0000-4000-a9b1-000000000000', 'owner', 'active');

-- T1 : le cas de référence, puis ses variantes (T2 tie-break, T3 tie-break
-- absent, T4 score illisible, T5 rejeté / en attente), et T6 à deux WOD.
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status)
SELECT ('00000000-0000-4000-c9b1-00000000000' || n)::uuid, 'T' || n, 'rx', 'simple',
       '00000000-0000-4000-b9b1-000000000001', '00000000-0000-4000-a9b1-000000000000', 'active'
  FROM generate_series(1, 6) n;
INSERT INTO public.tournament_wods (id, tournament_id, title, type)
SELECT ('00000000-0000-4000-f9b1-00000000000' || n)::uuid, ('00000000-0000-4000-c9b1-00000000000' || n)::uuid, 'Fran', 'For Time'
  FROM generate_series(1, 6) n;
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f9b1-000000000016', '00000000-0000-4000-c9b1-000000000006', 'Cindy', 'AMRAP');

-- Inscrits : A à F partout, G et H en plus sur T4 et T5.
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT ('00000000-0000-4000-c9b1-00000000000' || t)::uuid, ('00000000-0000-4000-a9b1-00000000000' || a)::uuid
  FROM generate_series(1, 6) t, generate_series(1, 6) a;
INSERT INTO public.tournament_participants (tournament_id, athlete_id)
SELECT ('00000000-0000-4000-c9b1-00000000000' || t)::uuid, ('00000000-0000-4000-a9b1-00000000000' || a)::uuid
  FROM unnest(ARRAY[4, 5]) t, unnest(ARRAY[7, 8]) a;

-- Le cas de référence sur les six tournois (WOD Fran de chacun).
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, capped, tiebreak_value, status)
SELECT ('00000000-0000-4000-c9b1-00000000000' || t)::uuid, ('00000000-0000-4000-f9b1-00000000000' || t)::uuid,
       ('00000000-0000-4000-a9b1-00000000000' || a)::uuid, sc, cap,
       CASE WHEN t = 2 AND a = 1 THEN 30 WHEN t = 2 AND a = 2 THEN 40 WHEN t = 3 AND a = 1 THEN 30 END,
       'validated'
  FROM generate_series(1, 6) t,
       (VALUES (1, '8:00', false), (2, '8:00', false), (3, '9:30', false), (4, '150', true), (5, '140', true)) v(a, sc, cap);
-- T4 : G a un For Time illisible. T5 : G rejeté en 7:00, H en attente en 7:30.
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c9b1-000000000004', '00000000-0000-4000-f9b1-000000000004', '00000000-0000-4000-a9b1-000000000007', 'abc', 'validated'),
  ('00000000-0000-4000-c9b1-000000000005', '00000000-0000-4000-f9b1-000000000005', '00000000-0000-4000-a9b1-000000000007', '7:00', 'rejected'),
  ('00000000-0000-4000-c9b1-000000000005', '00000000-0000-4000-f9b1-000000000005', '00000000-0000-4000-a9b1-000000000008', '7:30', 'pending');
-- T6 : Cindy (AMRAP) : F 300, E 250, D 250, C 200, B 150, A 100.
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status)
SELECT '00000000-0000-4000-c9b1-000000000006', '00000000-0000-4000-f9b1-000000000016',
       ('00000000-0000-4000-a9b1-00000000000' || a)::uuid, sc, 'validated'
  FROM (VALUES (6, '300'), (5, '250'), (4, '250'), (3, '200'), (2, '150'), (1, '100')) v(a, sc);

-- Points par athlète (lettre) : « A:100 B:100 … » ; avec le rang final : « A:100/1 … ».
CREATE FUNCTION pg_temp.classement(p_t int, p_rang boolean DEFAULT false) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(p.username || ':' || s.points || CASE WHEN p_rang THEN '/' || s.final_rank ELSE '' END, ' ' ORDER BY p.username)
    FROM public.tournament_classique_standings(('00000000-0000-4000-c9b1-00000000000' || p_t)::uuid) s
    JOIN public.profiles p ON p.id = s.athlete_id
$$;

DO $t$
DECLARE
  v text;
BEGIN
  -- B1 : le cas de référence.
  v := pg_temp.classement(1);
  IF v <> 'bc_A:100 bc_B:100 bc_C:95 bc_D:93 bc_E:91 bc_F:0' THEN
    RAISE EXCEPTION 'B1 : cas de référence : % (attendu A 100, B 100, C 95, D 93, E 91, F 0)', v;
  END IF;
  IF (SELECT string_agg(wod_rank || '', ',' ORDER BY wod_rank) FROM public.tournament_classique_wod_ranks('00000000-0000-4000-c9b1-000000000001'))
     <> '1,1,3,4,5' THEN
    RAISE EXCEPTION 'B1 : rangs sur le WOD : 1,1,3,4,5 attendus (F sans score, sans rang)';
  END IF;

  -- B2 et B3 : le tie-break départage d'abord.
  v := pg_temp.classement(2);
  IF v NOT LIKE 'bc_A:100 bc_B:97 bc_C:95 %' THEN
    RAISE EXCEPTION 'B2 : tie-break 30 contre 40 : %', v;
  END IF;
  v := pg_temp.classement(3);
  IF v NOT LIKE 'bc_A:100 bc_B:97 bc_C:95 %' THEN
    RAISE EXCEPTION 'B3 : tie-break donné contre tie-break absent : %', v;
  END IF;

  -- B4 : le score illisible de G ne prend aucun rang (il n'est pas premier).
  IF EXISTS (SELECT 1 FROM public.tournament_classique_wod_ranks('00000000-0000-4000-c9b1-000000000004')
              WHERE athlete_id = '00000000-0000-4000-a9b1-000000000007')
     OR pg_temp.classement(4) NOT LIKE 'bc_A:100 bc_B:100 bc_C:95 bc_D:93 bc_E:91 bc_F:0 bc_G:0%' THEN
    RAISE EXCEPTION 'B4 : score illisible : %', pg_temp.classement(4);
  END IF;

  -- B5 : rejeté et en attente ne comptent pas.
  IF pg_temp.classement(5) <> 'bc_A:100 bc_B:100 bc_C:95 bc_D:93 bc_E:91 bc_F:0 bc_G:0 bc_H:0' THEN
    RAISE EXCEPTION 'B5 : score rejeté ou en attente compté : %', pg_temp.classement(5);
  END IF;
  -- … et un score validé puis rejeté sort du classement.
  UPDATE public.tournament_scores SET status = 'rejected'
   WHERE tournament_id = '00000000-0000-4000-c9b1-000000000005' AND athlete_id = '00000000-0000-4000-a9b1-000000000003';
  IF pg_temp.classement(5) NOT LIKE 'bc_A:100 bc_B:100 bc_C:0 bc_D:95 bc_E:93 %' THEN
    RAISE EXCEPTION 'B5 : score rejeté après validation : %', pg_temp.classement(5);
  END IF;

  -- B7 : la clôture du format simple, par le gérant, suit ce classement.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9b1-000000000000', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.finalize_tournament_elo('00000000-0000-4000-c9b1-000000000001');
  SELECT string_agg(p.username || '/' || h.final_rank, ' ' ORDER BY p.username) INTO v
    FROM public.tournament_elo_history h JOIN public.profiles p ON p.id = h.athlete_id
   WHERE h.tournament_id = '00000000-0000-4000-c9b1-000000000001';
  IF v <> 'bc_A/1 bc_B/1 bc_C/3 bc_D/4 bc_E/5 bc_F/6' THEN
    RAISE EXCEPTION 'B7 : clôture : rangs % (attendu A/1 B/1 C/3 D/4 E/5 F/6)', v;
  END IF;

  -- B6 : Fran + Cindy (F 300 : 100 ; D et E 250 : 2es ex-aequo, 97 ; C 200 : 4e,
  -- 93 ; B 150 : 91 ; A 100 : 89). Totaux : B 191, D 190, A 189, C et E 188
  -- (4es ex-aequo, le 5e rang est sauté), F 100.
  v := pg_temp.classement(6, true);
  IF v <> 'bc_A:189/3 bc_B:191/1 bc_C:188/4 bc_D:190/2 bc_E:188/4 bc_F:100/6' THEN
    RAISE EXCEPTION 'B6 : deux WOD : %', v;
  END IF;

  -- B8 : la table de l'app.
  IF ARRAY[public.tournament_cf_points(1), public.tournament_cf_points(2), public.tournament_cf_points(3),
           public.tournament_cf_points(20), public.tournament_cf_points(21), public.tournament_cf_points(50),
           public.tournament_cf_points(51), public.tournament_cf_points(60), public.tournament_cf_points(100),
           public.tournament_cf_points(0)]
     <> ARRAY[100, 97, 95, 61, 60, 31, 30, 21, 1, 0] THEN
    RAISE EXCEPTION 'B8 : table de points différente de celle de l''app';
  END IF;

  RAISE NOTICE 'barème classique : B1 à B8 conformes';
END $t$;

ROLLBACK;
