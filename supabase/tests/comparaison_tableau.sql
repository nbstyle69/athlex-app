-- ═════════════════════════════════════════════════════════════════════════════
-- Comparaison en tableau (migration 20270112)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Un tableau, un tour 1 de dix matchs aux scores choisis, décidé par
-- `decide_bracket_round` appelée par le gérant :
--   C1 un For Time terminé (9:30) bat un CAP (150 reps) ;
--   C2 entre deux CAP, le plus de reps gagne ;
--   C3 deux CAP aux mêmes reps : le tie-break le plus bas gagne ;
--   C4 deux terminés : le temps le plus bas gagne ;
--   C5 hors For Time (AMRAP) : le score le plus haut gagne ;
--   C6 égalité parfaite, ou score non validé : le match reste à la main, motif rendu ;
--   C7 l'encodage hérité « 999999 + reps » vaut CAP ;
--   C8 un athlète n'a pas le droit d'appeler la RPC ;
--   C9 le WOD du match prime sur celui passé par le Manager ; sans WOD, motif ;
--   C10 seuls les matchs en attente du tour demandé sont touchés.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Comparaison en tableau : la règle du serveur'

BEGIN;

-- Gérant …c0, athlètes …01 à …18 (hex).
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a97c-0000000000' || lpad(to_hex(n), 2, '0'))::uuid FROM generate_series(1, 24) n
UNION ALL SELECT '00000000-0000-4000-a97c-0000000000c0';
INSERT INTO public.profiles (id, email, username)
SELECT id, 'cmp-' || right(id::text, 2) || '@test.invalid', 'cmp_' || right(id::text, 2) FROM auth.users
 WHERE id::text LIKE '00000000-0000-4000-a97c-%';
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b97c-000000000001', 'Box comparaison', 'CMPT', '00000000-0000-4000-a97c-0000000000c0');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b97c-000000000001', '00000000-0000-4000-a97c-0000000000c0', 'owner', 'active'),
  ('00000000-0000-4000-b97c-000000000001', '00000000-0000-4000-a97c-000000000001', 'member', 'active');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status) VALUES
  ('00000000-0000-4000-c97c-000000000001', 'Tableau comparaison', 'rx', 'bracket',
   '00000000-0000-4000-b97c-000000000001', '00000000-0000-4000-a97c-0000000000c0', 'active');
INSERT INTO public.tournament_wods (id, tournament_id, title, type) VALUES
  ('00000000-0000-4000-f97c-000000000001', '00000000-0000-4000-c97c-000000000001', 'Fran', 'For Time'),
  ('00000000-0000-4000-f97c-000000000002', '00000000-0000-4000-c97c-000000000001', 'Cindy', 'AMRAP');

-- Matchs : (tour, n°, p1, p2, wod du match, statut, vainqueur).
CREATE TEMP TABLE _m AS
SELECT * FROM (VALUES
  ('C1',  1, 1, '01', '02', NULL, 'pending', NULL),
  ('C2',  1, 2, '03', '04', NULL, 'pending', NULL),
  ('C3',  1, 3, '05', '06', NULL, 'pending', NULL),
  ('C4',  1, 4, '07', '08', NULL, 'pending', NULL),
  ('C5',  1, 5, '09', '0a', '2',  'pending', NULL),
  ('C6a', 1, 6, '0b', '0c', NULL, 'pending', NULL),
  ('C6b', 1, 7, '0d', '0e', NULL, 'pending', NULL),
  ('C7',  1, 8, '0f', '10', NULL, 'pending', NULL),
  ('C10a',1, 9, '11', '12', NULL, 'completed', '12'),
  ('C10b',2, 1, '13', '14', NULL, 'pending', NULL),
  ('C9',  3, 1, '15', '16', NULL, 'pending', NULL)
) v(cas, round, num, p1, p2, wod, status, winner);

INSERT INTO public.tournament_bracket_matches
  (tournament_id, round, match_number, side, participant1_id, participant2_id, wod_id, status, winner_id)
SELECT '00000000-0000-4000-c97c-000000000001', round, num, 'winner',
       ('00000000-0000-4000-a97c-0000000000' || p1)::uuid, ('00000000-0000-4000-a97c-0000000000' || p2)::uuid,
       ('00000000-0000-4000-f97c-00000000000' || wod)::uuid, status,
       ('00000000-0000-4000-a97c-0000000000' || winner)::uuid
  FROM _m;

-- Scores : (athlète, wod, score, cap, tie-break, statut).
INSERT INTO public.tournament_scores (tournament_id, tournament_wod_id, athlete_id, score_value, capped, tiebreak_value, status)
SELECT '00000000-0000-4000-c97c-000000000001', ('00000000-0000-4000-f97c-00000000000' || wod)::uuid,
       ('00000000-0000-4000-a97c-0000000000' || a)::uuid, score, cap, tb, st
  FROM (VALUES
    ('01', '1', '9:30',    false, NULL::numeric, 'validated'),   -- C1 terminé
    ('02', '1', '150',     true,  NULL, 'validated'),            -- C1 CAP (150 < 570 : l'ancienne règle le faisait gagner)
    ('03', '1', '140',     true,  NULL, 'validated'),            -- C2
    ('04', '1', '150',     true,  NULL, 'validated'),
    ('05', '1', '150',     true,  300,  'validated'),            -- C3
    ('06', '1', '150',     true,  280,  'validated'),
    ('07', '1', '8:00',    false, NULL, 'validated'),            -- C4
    ('08', '1', '8:10',    false, NULL, 'validated'),
    ('09', '2', '200',     false, NULL, 'validated'),            -- C5 (AMRAP, WOD du match)
    ('0a', '2', '210',     false, NULL, 'validated'),
    ('09', '1', '5:00',    false, NULL, 'validated'),            -- C9 : sur le WOD du Manager, 09 gagnerait
    ('0a', '1', '6:00',    false, NULL, 'validated'),
    ('0b', '1', '8:00',    false, NULL, 'validated'),            -- C6a égalité parfaite
    ('0c', '1', '8:00',    false, NULL, 'validated'),
    ('0d', '1', '7:00',    false, NULL, 'validated'),            -- C6b : l'adversaire n'est pas validé
    ('0e', '1', '6:00',    false, NULL, 'pending'),
    ('0f', '1', '1000149', false, NULL, 'validated'),            -- C7 : hérité, CAP à 150 reps
    ('10', '1', '155',     true,  NULL, 'validated'),
    ('11', '1', '5:00',    false, NULL, 'validated'),            -- C10a : déjà décidé à la main
    ('12', '1', '9:00',    false, NULL, 'validated'),
    ('13', '1', '5:00',    false, NULL, 'validated'),            -- C10b : autre tour
    ('14', '1', '9:00',    false, NULL, 'validated')
  ) v(a, wod, score, cap, tb, st);

CREATE TEMP TABLE _r (match_id uuid, winner_id uuid, motif text);
GRANT INSERT ON _r TO authenticated;

DO $t$
DECLARE
  v_t constant uuid := '00000000-0000-4000-c97c-000000000001';
  v_ok boolean;
BEGIN
  -- C8 : un athlète est refusé.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a97c-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  v_ok := false;
  BEGIN
    PERFORM public.decide_bracket_round(v_t, 1, '00000000-0000-4000-f97c-000000000001');
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'C8 : un athlète a pu décider les matchs du tableau'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = v_t AND round = 1 AND status = 'completed' AND match_number <> 9) THEN
    RAISE EXCEPTION 'C8 : un match a été décidé par l''appel refusé';
  END IF;

  -- Le gérant décide le tour 1 sur Fran, puis le tour 3 sans WOD.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a97c-0000000000c0', true);
  INSERT INTO _r SELECT * FROM public.decide_bracket_round(v_t, 1, '00000000-0000-4000-f97c-000000000001');
  INSERT INTO _r SELECT * FROM public.decide_bracket_round(v_t, 3, NULL);
  PERFORM set_config('role', 'none', true);
END $t$;

-- Verdict par cas : vainqueur attendu (ou motif), vainqueur et motif obtenus.
DO $t$
DECLARE
  v record;
  v_bad text := '';
BEGIN
  FOR v IN
    SELECT e.cas, e.attendu, e.motif_attendu, m.winner_id, m.status, r.motif,
           (r.match_id IS NOT NULL) AS rendu
      FROM (VALUES
        ('C1', '01', NULL), ('C2', '04', NULL), ('C3', '06', NULL), ('C4', '07', NULL),
        ('C5', '0a', NULL), ('C6a', NULL, 'egalite'), ('C6b', NULL, 'score_manquant'),
        ('C7', '10', NULL), ('C9', NULL, 'wod_absent')
      ) e(cas, attendu, motif_attendu)
      JOIN _m ON _m.cas = e.cas
      JOIN public.tournament_bracket_matches m
        ON m.tournament_id = '00000000-0000-4000-c97c-000000000001' AND m.round = _m.round AND m.match_number = _m.num
      LEFT JOIN _r r ON r.match_id = m.id
  LOOP
    IF NOT v.rendu
       OR (v.attendu IS NOT NULL AND (v.winner_id IS DISTINCT FROM ('00000000-0000-4000-a97c-0000000000' || v.attendu)::uuid
                                      OR v.status <> 'completed' OR v.motif IS NOT NULL))
       OR (v.attendu IS NULL AND (v.winner_id IS NOT NULL OR v.status <> 'pending' OR v.motif IS DISTINCT FROM v.motif_attendu)) THEN
      v_bad := v_bad || format(' %s (vainqueur %s, motif %s) ;', v.cas, right(v.winner_id::text, 2), v.motif);
    END IF;
  END LOOP;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'cas non conformes :%', v_bad;
  END IF;

  -- C10 : le match déjà décidé et celui du tour 2 n'ont pas bougé, et ne sont pas rendus.
  IF (SELECT winner_id FROM public.tournament_bracket_matches
       WHERE tournament_id = '00000000-0000-4000-c97c-000000000001' AND round = 1 AND match_number = 9)
       <> '00000000-0000-4000-a97c-000000000012'
     OR EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                 WHERE tournament_id = '00000000-0000-4000-c97c-000000000001' AND round = 2 AND winner_id IS NOT NULL)
     OR (SELECT count(*) FROM _r) <> 9 THEN
    RAISE EXCEPTION 'C10 : un match hors du périmètre (déjà décidé, ou d''un autre tour) a été touché ou rendu';
  END IF;
  RAISE NOTICE 'comparaison en tableau : C1 à C10 conformes';
END $t$;

ROLLBACK;
