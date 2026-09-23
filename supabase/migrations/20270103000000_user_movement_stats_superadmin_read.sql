-- ═════════════════════════════════════════════════════════════════════════════
-- Lecture des cumuls de mouvement par le super-admin — lot Manager, M4
--
-- Appliquée en prod : non
--
-- L'onglet Statistiques de `/admin/movements` du Manager
-- (`components/admin/MovementStats.tsx`) lit `user_movement_stats` depuis le
-- navigateur, sous le JWT du super-admin. La seule policy de lecture de la table
-- est `movement_stats_own_read` (`user_id = auth.uid()`) : mesuré en prod le
-- 23/09/2026 en lecture seule, chacun des deux comptes super-admin y voyait
-- 0 ligne sur 20, et l'écran affichait « 0 mouvements trackés ».
--
-- Une policy de lecture pour le super-admin, calquée EXACTEMENT sur
-- `superadmin_read_badges` d'`athlete_badges` (relevée en prod le 23/09) :
-- PERMISSIVE, rôles `public`, `FOR SELECT`, `USING (public.is_super_admin())`.
-- Même helper — `is_super_admin()`, SECURITY DEFINER, vrai si le profil de
-- `auth.uid()` porte `role = 'super_admin'` — pour qu'une seule définition dise
-- qui est super-admin.
--
-- Ce que la migration ne fait pas :
--   * aucune autre policy modifiée : l'athlète lit toujours ses seules lignes,
--     un gérant de box n'en lit pas davantage qu'aujourd'hui ;
--   * aucun droit d'écriture : la policy est `FOR SELECT`, et aucune policy
--     d'écriture n'existe sur cette table — la RLS continue de refuser toute
--     écriture client, super-admin compris ; les cumuls ne s'écrivent que par
--     `increment_movement_stats` et le crédit serveur des tournois ;
--   * `movement_credit_ledger` n'est pas touché : ni l'écran ni aucun autre code
--     du Manager ou de l'app ne le lit.
--
-- Rejouable : `DROP POLICY IF EXISTS` puis `CREATE POLICY`.
-- Contrôlée par `supabase/tests/user_movement_stats_superadmin.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS user_movement_stats_superadmin_read ON public.user_movement_stats;
CREATE POLICY user_movement_stats_superadmin_read ON public.user_movement_stats
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_super_admin());

COMMIT;
