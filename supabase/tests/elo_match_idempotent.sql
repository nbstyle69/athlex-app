-- ═════════════════════════════════════════════════════════════════════════════
-- ELO de match de tableau appliqué une seule fois (migration 20270106)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--   M1 un match terminé applique l'ELO et les compteurs une fois ;
--   M2 réécrire le même résultat (même vainqueur, même statut) ne change rien —
--      ni ELO, ni compteurs, ni historique ;
--   M3 changer de vainqueur défait l'ancien effet et applique le nouveau ;
--   M4 remettre le match à jouer rend tout ; le rejouer réapplique une fois ;
--   M5 changer le perdant (participant remplacé) déplace l'effet sur le nouveau ;
--   M6 une exemption (bye), un match sans second participant ou en attente
--      n'apportent rien ;
--   M7 le retrait est exact même si l'ELO a bougé entre-temps par ailleurs ;
--   M8 les compteurs restent cohérents avec l'historique à chaque étape.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> ELO de match de tableau appliqué une seule fois'

BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a600-000000000001'), ('00000000-0000-4000-a600-000000000002'),
  ('00000000-0000-4000-a600-000000000003'), ('00000000-0000-4000-a600-000000000009');
INSERT INTO public.profiles (id, email, username) VALUES
  ('00000000-0000-4000-a600-000000000001', 'elo-a@test.invalid', 'elo_a'),
  ('00000000-0000-4000-a600-000000000002', 'elo-b@test.invalid', 'elo_b'),
  ('00000000-0000-4000-a600-000000000003', 'elo-c@test.invalid', 'elo_c'),
  ('00000000-0000-4000-a600-000000000009', 'elo-gerant@test.invalid', 'elo_gerant');
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b600-000000000001', 'Box ELO', 'ELOM', '00000000-0000-4000-a600-000000000009');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by) VALUES
  ('00000000-0000-4000-c600-000000000001', 'Tournoi ELO', 'rx', 'bracket',
   '00000000-0000-4000-b600-000000000001', '00000000-0000-4000-a600-000000000009');

-- Outils : l'état ELO d'un athlète, et la cohérence compteurs ↔ historique.
CREATE TEMP TABLE zz_etat (nom text PRIMARY KEY, id uuid);
INSERT INTO zz_etat VALUES
  ('A', '00000000-0000-4000-a600-000000000001'),
  ('B', '00000000-0000-4000-a600-000000000002'),
  ('C', '00000000-0000-4000-a600-000000000003');

CREATE FUNCTION pg_temp.etat(p_nom text) RETURNS text LANGUAGE sql AS $$
  SELECT p.elo || '/' || p.total_matches || '/' || p.wins
    FROM public.profiles p JOIN zz_etat e ON e.id = p.id WHERE e.nom = p_nom
$$;
CREATE FUNCTION pg_temp.attendre(p_etape text, p_nom text, p_attendu text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pg_temp.etat(p_nom) IS DISTINCT FROM p_attendu THEN
    RAISE EXCEPTION '% : % vaut % (elo/matchs/victoires), attendu %', p_etape, p_nom, pg_temp.etat(p_nom), p_attendu;
  END IF;
END $$;
-- M8 : pour chaque athlète, ELO de départ + somme des deltas = ELO, et compteurs = historique.
CREATE FUNCTION pg_temp.coherent(p_etape text, p_depart jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT e.nom, p.elo, p.total_matches, p.wins,
           (p_depart->>e.nom)::int + COALESCE(SUM(h.elo_delta), 0) AS elo_attendu,
           COUNT(h.id) AS matchs, COUNT(h.id) FILTER (WHERE h.result = 'win') AS victoires
      FROM zz_etat e JOIN public.profiles p ON p.id = e.id
      LEFT JOIN public.tournament_match_elo_history h ON h.athlete_id = e.id
     GROUP BY e.nom, p.elo, p.total_matches, p.wins
  LOOP
    IF r.elo <> r.elo_attendu OR r.total_matches <> r.matchs OR r.wins <> r.victoires THEN
      RAISE EXCEPTION 'M8 % : % incohérent (elo % pour %, matchs % pour %, victoires % pour %)',
        p_etape, r.nom, r.elo, r.elo_attendu, r.total_matches, r.matchs, r.wins, r.victoires;
    END IF;
  END LOOP;
END $$;

INSERT INTO public.tournament_bracket_matches (id, tournament_id, round, match_number, side, participant1_id, participant2_id, status)
VALUES ('00000000-0000-4000-d600-000000000001', '00000000-0000-4000-c600-000000000001', 1, 1, 'winner',
        '00000000-0000-4000-a600-000000000001', '00000000-0000-4000-a600-000000000002', 'pending');

DO $t$
DECLARE
  m constant uuid := '00000000-0000-4000-d600-000000000001';
  a constant uuid := '00000000-0000-4000-a600-000000000001';
  b constant uuid := '00000000-0000-4000-a600-000000000002';
  c constant uuid := '00000000-0000-4000-a600-000000000003';
  depart constant jsonb := '{"A":1000,"B":1000,"C":1000}';
  v_hist_avant text;
BEGIN
  -- M1 : A bat B, à ELO égaux : delta 16.
  UPDATE public.tournament_bracket_matches SET winner_id = a, loser_id = b, status = 'completed', completed_at = now() WHERE id = m;
  PERFORM pg_temp.attendre('M1', 'A', '1016/1/1');
  PERFORM pg_temp.attendre('M1', 'B', '984/1/0');
  PERFORM pg_temp.coherent('M1', depart);

  -- M2 : réécritures du même résultat — rien ne bouge, l'historique non plus.
  SELECT string_agg(id::text || created_at::text, ',' ORDER BY id) INTO v_hist_avant
    FROM public.tournament_match_elo_history WHERE match_id = m;
  UPDATE public.tournament_bracket_matches SET winner_id = a, status = 'completed' WHERE id = m;
  UPDATE public.tournament_bracket_matches SET status = 'completed', completed_at = now(), notes = 'revu' WHERE id = m;
  UPDATE public.tournament_bracket_matches SET winner_id = a, loser_id = b, status = 'completed', participant1_id = a, participant2_id = b WHERE id = m;
  PERFORM pg_temp.attendre('M2', 'A', '1016/1/1');
  PERFORM pg_temp.attendre('M2', 'B', '984/1/0');
  IF (SELECT string_agg(id::text || created_at::text, ',' ORDER BY id) FROM public.tournament_match_elo_history WHERE match_id = m)
     IS DISTINCT FROM v_hist_avant THEN
    RAISE EXCEPTION 'M2 : l''historique a été réécrit alors que le résultat n''a pas changé';
  END IF;

  -- M3 : B devient vainqueur — l'effet de A est défait, celui de B appliqué.
  UPDATE public.tournament_bracket_matches SET winner_id = b, loser_id = a WHERE id = m;
  PERFORM pg_temp.attendre('M3', 'A', '984/1/0');
  PERFORM pg_temp.attendre('M3', 'B', '1016/1/1');
  PERFORM pg_temp.coherent('M3', depart);
  IF (SELECT count(*) FROM public.tournament_match_elo_history WHERE match_id = m) <> 2 THEN
    RAISE EXCEPTION 'M3 : l''historique ne porte pas exactement deux lignes';
  END IF;

  -- M4 : remis à jouer → tout est rendu ; rejoué → appliqué une fois.
  UPDATE public.tournament_bracket_matches SET winner_id = NULL, loser_id = NULL, status = 'active', completed_at = NULL WHERE id = m;
  PERFORM pg_temp.attendre('M4', 'A', '1000/0/0');
  PERFORM pg_temp.attendre('M4', 'B', '1000/0/0');
  IF EXISTS (SELECT 1 FROM public.tournament_match_elo_history WHERE match_id = m) THEN
    RAISE EXCEPTION 'M4 : un historique subsiste pour un match remis à jouer';
  END IF;
  UPDATE public.tournament_bracket_matches SET winner_id = a, loser_id = b, status = 'completed' WHERE id = m;
  UPDATE public.tournament_bracket_matches SET winner_id = a, loser_id = b, status = 'completed' WHERE id = m;
  PERFORM pg_temp.attendre('M4', 'A', '1016/1/1');
  PERFORM pg_temp.attendre('M4', 'B', '984/1/0');
  PERFORM pg_temp.coherent('M4', depart);

  -- M5 : le perdant change (B remplacé par C), A reste vainqueur.
  UPDATE public.tournament_bracket_matches SET participant2_id = c, loser_id = c WHERE id = m;
  PERFORM pg_temp.attendre('M5', 'A', '1016/1/1');
  PERFORM pg_temp.attendre('M5', 'B', '1000/0/0');
  PERFORM pg_temp.attendre('M5', 'C', '984/1/0');
  PERFORM pg_temp.coherent('M5', depart);

  -- M7 : l'ELO de A bouge ailleurs (+50), puis le match est remis à jouer : on
  -- retire exactement ce que le match avait apporté, pas plus.
  UPDATE public.profiles SET elo = elo + 50 WHERE id = a;
  UPDATE public.tournament_bracket_matches SET winner_id = NULL, loser_id = NULL, status = 'active' WHERE id = m;
  PERFORM pg_temp.attendre('M7', 'A', '1050/0/0');
  PERFORM pg_temp.attendre('M7', 'C', '1000/0/0');
  RAISE NOTICE 'M1–M5, M7, M8 ok';
END $t$;

-- M6 : exemption, second participant absent, match en attente — aucun effet.
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, winner_id, status, completed_at)
VALUES ('00000000-0000-4000-c600-000000000001', 1, 2, 'winner', '00000000-0000-4000-a600-000000000002',
        '00000000-0000-4000-a600-000000000002', 'bye', now());
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, winner_id, status)
VALUES ('00000000-0000-4000-c600-000000000001', 1, 3, 'winner', '00000000-0000-4000-a600-000000000003',
        '00000000-0000-4000-a600-000000000003', 'completed');
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, winner_id, status)
VALUES ('00000000-0000-4000-c600-000000000001', 1, 4, 'winner', '00000000-0000-4000-a600-000000000002',
        '00000000-0000-4000-a600-000000000003', '00000000-0000-4000-a600-000000000002', 'pending');
DO $t$
BEGIN
  PERFORM pg_temp.attendre('M6', 'B', '1000/0/0');
  PERFORM pg_temp.attendre('M6', 'C', '1000/0/0');
  IF EXISTS (SELECT 1 FROM public.tournament_match_elo_history h
               JOIN public.tournament_bracket_matches m ON m.id = h.match_id WHERE m.match_number IN (2, 3, 4)) THEN
    RAISE EXCEPTION 'M6 : un match sans vrai résultat a produit de l''ELO';
  END IF;
  RAISE NOTICE 'M6 ok';
END $t$;

ROLLBACK;
\echo '    ok'
