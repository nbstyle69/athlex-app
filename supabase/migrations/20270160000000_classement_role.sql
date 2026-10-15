-- ═════════════════════════════════════════════════════════════════════════════
-- Classement global : global_leaderboard rend aussi `role` (#565, suite)
--
-- Appliquée en prod : OUI, le 15/10/2026 à 17:51 UTC, avec PGCLIENTENCODING=UTF8,
-- sur feu vert de Nab. Pas de BEGIN/COMMIT dans ce fichier : il se joue en UNE
-- transaction par psql -1 (DROP, CREATE et GRANT ensemble) :
--   psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- Dump des schémas public et internal avec droits
-- db-dumps/2026-10-15/athlex-prod-public-internal-20261015T175054Z.dump,
-- sha256 e52550896b3f49765366ed18b1db1ac0ce4e1b31a8a4205a4fb9cbc941c61219
-- vérifié après aller-retour, 141 TABLE DATA, 484 ACL, 348 POLICY ; précontrôle
-- juste avant : md5 82ec38f7… (définition de 20270159) ; après : md5 275c3f85…,
-- 8 colonnes, EXECUTE à authenticated et service_role, anon refusé ; appel
-- authentifié : 8 colonnes, aucun compte de démo ; audit des droits 47/47.
--
-- Pourquoi : la page publique /classement du Manager filtre sur role = 'member'.
-- La basculer sur la RPC sans `role` y ferait entrer coachs, gérants et admins.
-- La RPC rend donc `role` et l'appelant filtre comme aujourd'hui ; aucun filtre
-- de rôle dans la RPC elle-même. global_elo_rank ne change pas.
--
-- 1. Garde de dérive : la définition en place doit être celle de 20270159
--    (md5 de pg_get_functiondef relevé en prod le 15/10/2026), ou déjà la
--    nouvelle (rejeu : rien à faire). Toute autre définition lève une exception
--    et rien n'est écrit.
-- 2. Postgres refuse un CREATE OR REPLACE qui change les colonnes de sortie :
--    DROP puis CREATE, dans la même transaction (psql -1). Le DROP efface les
--    droits : REVOKE / GRANT EXECUTE reposés ici, à authenticated et
--    service_role (K1), pas à anon. Signature inchangée : l'instantané T19b
--    ne bouge pas.
-- 3. `role` est lisible en direct par authenticated (et anon) sur profiles
--    (droit de colonne, vérifié en prod le 15/10/2026) : la RPC ne rend rien
--    de plus qu'une requête directe (test C8 de classement_role.sql).
-- 4. Retour arrière : supabase/retours/20270160000000_classement_role.sql
--    (définition à 7 colonnes de 20270159, droits reposés).
-- Contrôlée par supabase/tests/classement_role.sql.
-- ═════════════════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  v_md5 text := md5(pg_get_functiondef('public.global_leaderboard(integer, integer)'::regprocedure));
BEGIN
  IF v_md5 NOT IN ('82ec38f7b325da5dd435ae43dfb0b3a6', '275c3f85af23ea5fa3291b9a391850d5') THEN
    RAISE EXCEPTION 'CLASSEMENT_ROLE_DERIVE: définition de global_leaderboard inattendue (md5 %) : rien n''est écrit', v_md5;
  END IF;
END $garde$;

DROP FUNCTION public.global_leaderboard(integer, integer);

CREATE FUNCTION public.global_leaderboard(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.username, p.level, p.elo, p.wins, p.total_matches, p.avatar_url, p.role
    FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = p.id)
   ORDER BY p.elo DESC, p.id
   LIMIT least(greatest(coalesce(p_limit, 30), 0), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.global_leaderboard(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_leaderboard(integer, integer) TO authenticated, service_role;
