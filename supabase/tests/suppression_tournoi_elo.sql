-- ═════════════════════════════════════════════════════════════════════════════
-- Supprimer un tournoi retire l'ELO qu'il a apporté (migration 20270109)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Quatre athlètes à 1000 ELO, cinq tournois, chacun avec sa source d'ELO réelle :
--   T1 tableau : deux matchs (A bat B, A bat C) ;
--   T2 tableau : un match (A bat C) + un récapitulatif de clôture (non appliqué) ;
--   T3 compétition classique : clôturée par `finalize_tournament_elo` ;
--   T4 ligue : ELO de WOD par `compute_league_wod_elo` ;
--   T5 tableau : un match (B bat D), supprimé SEUL.
--   X1 supprimer T1 retire exactement ses deux matchs ; T2, T3, T4 intacts ;
--   X2 supprimer T2 retire son match, pas son récapitulatif ;
--   X3 supprimer T3 retire la clôture (ELO, match, victoire) ;
--   X4 supprimer T4 retire l'ELO de WOD ;
--   X5 supprimer un match seul (T5) rend son effet, le tournoi reste ;
--   X6 tout supprimé : chaque profil est revenu EXACTEMENT à 1000 / 0 / 0, et
--      il ne reste aucun historique de ces tournois.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Suppression d''un tournoi : l''ELO apporté est retiré'

BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a900-000000000009'),
  ('00000000-0000-4000-a900-00000000000a'), ('00000000-0000-4000-a900-00000000000b'),
  ('00000000-0000-4000-a900-00000000000c'), ('00000000-0000-4000-a900-00000000000d');
INSERT INTO public.profiles (id, email, username) VALUES
  ('00000000-0000-4000-a900-000000000009', 'sup-gerant@test.invalid', 'sup_gerant'),
  ('00000000-0000-4000-a900-00000000000a', 'sup-a@test.invalid', 'sup_a'),
  ('00000000-0000-4000-a900-00000000000b', 'sup-b@test.invalid', 'sup_b'),
  ('00000000-0000-4000-a900-00000000000c', 'sup-c@test.invalid', 'sup_c'),
  ('00000000-0000-4000-a900-00000000000d', 'sup-d@test.invalid', 'sup_d');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b900-000000000001', 'Box suppression', 'SUPT', '00000000-0000-4000-a900-000000000009');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-000000000009', 'owner', 'active');

INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status) VALUES
  ('00000000-0000-4000-c900-000000000001', 'T1', 'rx', 'bracket',    '00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-000000000009', 'active'),
  ('00000000-0000-4000-c900-000000000002', 'T2', 'rx', 'bracket',    '00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-000000000009', 'active'),
  ('00000000-0000-4000-c900-000000000003', 'T3', 'rx', 'simple',     '00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-000000000009', 'active'),
  ('00000000-0000-4000-c900-000000000004', 'T4', 'rx', 'league_div', '00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-000000000009', 'active'),
  ('00000000-0000-4000-c900-000000000005', 'T5', 'rx', 'bracket',    '00000000-0000-4000-b900-000000000001', '00000000-0000-4000-a900-000000000009', 'active');

-- T1 et T2 : matchs terminés (l'ELO s'applique par le trigger de match).
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status) VALUES
  ('00000000-0000-4000-c900-000000000001', 1, 1, 'winner', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000b', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000b', 'completed'),
  ('00000000-0000-4000-c900-000000000001', 2, 1, 'winner', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000c', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000c', 'completed'),
  ('00000000-0000-4000-c900-000000000002', 1, 1, 'winner', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000c', '00000000-0000-4000-a900-00000000000a', '00000000-0000-4000-a900-00000000000c', 'completed');
-- T2 : un récapitulatif de clôture de tableau, qui n'a RIEN appliqué au profil.
INSERT INTO public.tournament_elo_history (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change)
VALUES ('00000000-0000-4000-c900-000000000002', '00000000-0000-4000-a900-00000000000a', 1, 2, 1000, 1000, 1040, 40);

-- T3 : compétition classique, deux scores validés, clôturée pour de vrai.
INSERT INTO public.tournament_participants (tournament_id, athlete_id) VALUES
  ('00000000-0000-4000-c900-000000000003', '00000000-0000-4000-a900-00000000000b'),
  ('00000000-0000-4000-c900-000000000003', '00000000-0000-4000-a900-00000000000d');
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f900-000000000003', '00000000-0000-4000-c900-000000000003', 'WOD T3', 'For Time');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c900-000000000003', '00000000-0000-4000-f900-000000000003', '00000000-0000-4000-a900-00000000000b', '300', 'validated'),
  ('00000000-0000-4000-c900-000000000003', '00000000-0000-4000-f900-000000000003', '00000000-0000-4000-a900-00000000000d', '400', 'validated');

-- T4 : ligue, une division (C, D), un WOD, deux scores validés.
INSERT INTO public.tournament_divisions (id, tournament_id, name, level) VALUES
  ('00000000-0000-4000-e900-000000000004', '00000000-0000-4000-c900-000000000004', 'Élite', 1);
INSERT INTO public.tournament_division_members (division_id, athlete_id) VALUES
  ('00000000-0000-4000-e900-000000000004', '00000000-0000-4000-a900-00000000000c'),
  ('00000000-0000-4000-e900-000000000004', '00000000-0000-4000-a900-00000000000d');
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f900-000000000004', '00000000-0000-4000-c900-000000000004', 'WOD T4', 'AMRAP');
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, status) VALUES
  ('00000000-0000-4000-c900-000000000004', '00000000-0000-4000-f900-000000000004', '00000000-0000-4000-a900-00000000000c', '100', 'validated'),
  ('00000000-0000-4000-c900-000000000004', '00000000-0000-4000-f900-000000000004', '00000000-0000-4000-a900-00000000000d', '90', 'validated');

-- Clôture de T3 et ELO du WOD de T4, par le gérant, comme le Manager.
DO $t$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a900-000000000009', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.finalize_tournament_elo('00000000-0000-4000-c900-000000000003');
  PERFORM public.compute_league_wod_elo('00000000-0000-4000-f900-000000000004');
  PERFORM set_config('role', 'none', true);
END $t$;

-- T5 : un match (B bat D), dont on supprimera le seul match.
INSERT INTO public.tournament_bracket_matches (id, tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, loser_id, status) VALUES
  ('00000000-0000-4000-d900-000000000005', '00000000-0000-4000-c900-000000000005', 1, 1, 'winner',
   '00000000-0000-4000-a900-00000000000b', '00000000-0000-4000-a900-00000000000d', '00000000-0000-4000-a900-00000000000b', '00000000-0000-4000-a900-00000000000d', 'completed');

-- Outils.
CREATE TEMP TABLE zz_ath (nom text PRIMARY KEY, id uuid);
INSERT INTO zz_ath VALUES ('A', '00000000-0000-4000-a900-00000000000a'), ('B', '00000000-0000-4000-a900-00000000000b'),
                          ('C', '00000000-0000-4000-a900-00000000000c'), ('D', '00000000-0000-4000-a900-00000000000d');
CREATE FUNCTION pg_temp.profils() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(z.nom || '=' || p.elo || '/' || p.total_matches || '/' || p.wins, ' ' ORDER BY z.nom)
    FROM zz_ath z JOIN public.profiles p ON p.id = z.id
$$;
-- Ce qu'un tournoi a appliqué, lu dans ses historiques (clôture comptée au format simple seulement).
CREATE FUNCTION pg_temp.apport(p_tournoi uuid) RETURNS TABLE (athlete uuid, delta int, n int, w int) LANGUAGE sql AS $$
  SELECT athlete_id, SUM(d)::int, SUM(n)::int, SUM(w)::int FROM (
    SELECT athlete_id, elo_delta d, 1 n, (result = 'win')::int w FROM public.tournament_match_elo_history WHERE tournament_id = p_tournoi
    UNION ALL
    SELECT athlete_id, elo_delta, 1, (rank = 1)::int FROM public.tournament_wod_elo_history WHERE tournament_id = p_tournoi
    UNION ALL
    SELECT h.athlete_id, h.elo_change, 1, (h.final_rank = 1)::int FROM public.tournament_elo_history h
      JOIN public.tournaments t ON t.id = h.tournament_id AND t.format = 'simple' WHERE h.tournament_id = p_tournoi
  ) x GROUP BY athlete_id
$$;
-- Profils attendus après avoir retiré l'apport d'un tournoi.
CREATE FUNCTION pg_temp.attendu_sans(p_tournoi uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(z.nom || '=' || (p.elo - COALESCE(a.delta, 0)) || '/' || (p.total_matches - COALESCE(a.n, 0))
                    || '/' || (p.wins - COALESCE(a.w, 0)), ' ' ORDER BY z.nom)
    FROM zz_ath z JOIN public.profiles p ON p.id = z.id LEFT JOIN pg_temp.apport(p_tournoi) a ON a.athlete = z.id
$$;
CREATE FUNCTION pg_temp.historique(p_tournoi uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.tournament_match_elo_history WHERE tournament_id = p_tournoi)
       + (SELECT count(*) FROM public.tournament_wod_elo_history WHERE tournament_id = p_tournoi)
       + (SELECT count(*) FROM public.tournament_elo_history WHERE tournament_id = p_tournoi)
$$;

DO $t$
DECLARE
  attendu text;
  autres_avant text;
  t1 constant uuid := '00000000-0000-4000-c900-000000000001';
  t2 constant uuid := '00000000-0000-4000-c900-000000000002';
  t3 constant uuid := '00000000-0000-4000-c900-000000000003';
  t4 constant uuid := '00000000-0000-4000-c900-000000000004';
  t5 constant uuid := '00000000-0000-4000-c900-000000000005';
BEGIN
  -- Contre-exemples : chaque source a bien appliqué quelque chose.
  IF pg_temp.historique(t1) <> 4 OR pg_temp.historique(t2) <> 3 OR pg_temp.historique(t3) <> 2
     OR pg_temp.historique(t4) <> 2 OR pg_temp.historique(t5) <> 2 THEN
    RAISE EXCEPTION 'contre-exemple : historiques inattendus (T1 %, T2 %, T3 %, T4 %, T5 %)',
      pg_temp.historique(t1), pg_temp.historique(t2), pg_temp.historique(t3), pg_temp.historique(t4), pg_temp.historique(t5);
  END IF;
  IF pg_temp.profils() = 'A=1000/0/0 B=1000/0/0 C=1000/0/0 D=1000/0/0' THEN
    RAISE EXCEPTION 'contre-exemple : aucun ELO n''a été appliqué';
  END IF;

  -- X1 : supprimer T1.
  attendu := pg_temp.attendu_sans(t1);
  SELECT string_agg(x, ',') INTO autres_avant FROM (
    SELECT md5(string_agg(h::text, ',' ORDER BY h.id)) x FROM public.tournament_match_elo_history h WHERE tournament_id IN (t2, t5)
    UNION ALL SELECT md5(string_agg(h::text, ',' ORDER BY h.id)) FROM public.tournament_wod_elo_history h WHERE tournament_id = t4
    UNION ALL SELECT md5(string_agg(h::text, ',' ORDER BY h.id)) FROM public.tournament_elo_history h WHERE tournament_id IN (t2, t3)) y;
  DELETE FROM public.tournaments WHERE id = t1;
  IF pg_temp.profils() IS DISTINCT FROM attendu THEN
    RAISE EXCEPTION 'X1 : après suppression de T1, % au lieu de %', pg_temp.profils(), attendu;
  END IF;
  IF pg_temp.historique(t1) <> 0 THEN RAISE EXCEPTION 'X1 : il reste un historique de T1'; END IF;
  IF (SELECT string_agg(x, ',') FROM (
        SELECT md5(string_agg(h::text, ',' ORDER BY h.id)) x FROM public.tournament_match_elo_history h WHERE tournament_id IN (t2, t5)
        UNION ALL SELECT md5(string_agg(h::text, ',' ORDER BY h.id)) FROM public.tournament_wod_elo_history h WHERE tournament_id = t4
        UNION ALL SELECT md5(string_agg(h::text, ',' ORDER BY h.id)) FROM public.tournament_elo_history h WHERE tournament_id IN (t2, t3)) y)
     IS DISTINCT FROM autres_avant THEN
    RAISE EXCEPTION 'X1 : la suppression de T1 a touché l''historique d''un autre tournoi';
  END IF;

  -- X2 : T2 — son match est retiré, pas son récapitulatif (+40 jamais appliqué).
  attendu := pg_temp.attendu_sans(t2);
  DELETE FROM public.tournaments WHERE id = t2;
  IF pg_temp.profils() IS DISTINCT FROM attendu THEN
    RAISE EXCEPTION 'X2 : après suppression de T2, % au lieu de %', pg_temp.profils(), attendu;
  END IF;

  -- X3 : T3 — la clôture classique est retirée.
  attendu := pg_temp.attendu_sans(t3);
  DELETE FROM public.tournaments WHERE id = t3;
  IF pg_temp.profils() IS DISTINCT FROM attendu THEN
    RAISE EXCEPTION 'X3 : après suppression de T3, % au lieu de %', pg_temp.profils(), attendu;
  END IF;

  -- X4 : T4 — l'ELO de WOD de ligue est retiré.
  attendu := pg_temp.attendu_sans(t4);
  DELETE FROM public.tournaments WHERE id = t4;
  IF pg_temp.profils() IS DISTINCT FROM attendu THEN
    RAISE EXCEPTION 'X4 : après suppression de T4, % au lieu de %', pg_temp.profils(), attendu;
  END IF;

  -- X5 : supprimer le seul match de T5 rend son effet ; le tournoi reste.
  DELETE FROM public.tournament_bracket_matches WHERE id = '00000000-0000-4000-d900-000000000005';
  IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = t5) OR pg_temp.historique(t5) <> 0 THEN
    RAISE EXCEPTION 'X5 : la suppression d''un match seul n''a pas défait son effet';
  END IF;

  -- X6 : tout est rendu, exactement.
  DELETE FROM public.tournaments WHERE id = t5;
  IF pg_temp.profils() IS DISTINCT FROM 'A=1000/0/0 B=1000/0/0 C=1000/0/0 D=1000/0/0' THEN
    RAISE EXCEPTION 'X6 : les profils ne sont pas revenus à leur état de départ : %', pg_temp.profils();
  END IF;
  RAISE NOTICE 'X1–X6 ok';
END $t$;

ROLLBACK;
\echo '    ok'
