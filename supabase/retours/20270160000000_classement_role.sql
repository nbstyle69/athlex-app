-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270160000000_classement_role.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : les tests le rejouent dans leur propre
-- transaction annulée).
--
-- Repose global_leaderboard à 7 colonnes, définition de 20270159 relevée en
-- prod le 15/10/2026 (md5 de pg_get_functiondef 82ec38f7…), puis ses droits :
-- le DROP les efface. Avant de le jouer, le Manager ne doit plus lire `role`
-- dans la RPC.
-- ═════════════════════════════════════════════════════════════════════════════

DROP FUNCTION public.global_leaderboard(integer, integer);

CREATE FUNCTION public.global_leaderboard(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id, p.username, p.level, p.elo, p.wins, p.total_matches, p.avatar_url
    FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = p.id)
   ORDER BY p.elo DESC, p.id
   LIMIT least(greatest(coalesce(p_limit, 30), 0), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$function$
;

REVOKE ALL ON FUNCTION public.global_leaderboard(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_leaderboard(integer, integer) TO authenticated, service_role;
