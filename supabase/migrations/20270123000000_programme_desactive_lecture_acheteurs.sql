-- ═════════════════════════════════════════════════════════════════════════════
-- Programme désactivé : ses acheteurs actifs le lisent encore
--
-- Appliquée en prod : OUI, le 25/09/2026 à 15:40 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-25/athlex-prod-public-internal-20260925T153958Z.dump,
-- sha256 652b4761f9b4bfea36e4c05c14f03604641e8bc2a08c8bd9005a4eaa4633080e vérifié
-- après aller-retour, 132 TABLE DATA, 416 ACL, 342 POLICY ; précontrôles : les
-- 6 règles de programs et program_members identiques au relevé (md5
-- 8502c61993eca450456d08291003d73b, search_path public), fonction et règle
-- absentes ; vérifications : md5 de programs et program_members identiques
-- avant/après, fonction (md5 e8715253f8bfb3ac9fa0a0d647c1edbc) et règle
-- identiques au fichier, EXECUTE pour authenticated et service_role seulement,
-- règles existantes inchangées, le gérant lit ses 4 programmes sans erreur ;
-- audit des droits en prod 29/29 ; tests réels en transaction annulée.)
--
-- Décision produit : les acheteurs d'un programme désactivé gardent l'accès
-- jusqu'à la fin de leur période payée (S4, PR AthleX-Manager #385, « Arrêter
-- les abonnements à la fin de leur période et désactiver le programme »).
--
-- Jusqu'ici, la seule règle qui laissait un acheteur lire la ligne `programs`
-- était `read_active_programs` (`is_active = true`). Le Whiteboard et le Profil
-- joignent `program_members` → `programs` : pour un programme désactivé, la
-- jointure revenait vide et le programme disparaissait de l'app. Le contenu,
-- lui, ne dépend pas de `is_active` (`wod_in_my_active_program`,
-- `wod_program_access_member_read`, `program_rest_days_member_read`).
--
-- Acheteur actif : `program_members.status = 'active'`, le critère de
-- `wod_in_my_active_program` et de `set_program_start_date`. Le webhook Connect
-- passe la ligne à `cancelled` en fin d'abonnement, `refunded` au
-- remboursement : l'accès tombe alors de lui-même.
--
-- Pourquoi une fonction et pas une règle qui lit `program_members` : les règles
-- de `program_members` (`read_own_membership`, `owner_admin_manage_pm`) relisent
-- `programs`. Une règle de `programs` qui lirait `program_members` ferait
-- boucler PostgreSQL (« infinite recursion detected in policy for relation
-- programs ») sur TOUTE lecture de `programs` par `authenticated`. La fonction,
-- en SECURITY DEFINER, lit `program_members` sans repasser par ses règles. Elle
-- ne répond que pour l'appelant (`auth.uid()`). Elle vit dans `public` parce
-- qu'une règle s'évalue avec les droits de l'appelant : `authenticated` doit
-- pouvoir l'exécuter (`internal` lui est fermé). La règle est `TO authenticated` :
-- `anon` ne l'évalue jamais et n'a pas besoin d'EXECUTE.
--
-- Ajout seul : `read_active_programs` et les règles de `program_members` ne
-- changent pas. Aucun index : l'index unique (program_id, user_id) de
-- `program_members` couvre la recherche.
--
-- Contrôlée par `supabase/tests/programme_desactive_acheteurs.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE FUNCTION public.program_in_my_active_membership(p_program_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.program_members pm
     WHERE pm.program_id = p_program_id
       AND pm.user_id = auth.uid()
       AND pm.status = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.program_in_my_active_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_in_my_active_membership(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.program_in_my_active_membership(uuid) IS
  'Vrai si l''appelant a une inscription active (status = active) à ce programme. Prédicat de la règle buyer_read_purchased_programs de programs : en SECURITY DEFINER, elle lit program_members sans repasser par ses règles, qui relisent programs — une règle de programs qui lirait program_members directement ferait boucler PostgreSQL (infinite recursion) sur toute lecture de programs.';

CREATE POLICY buyer_read_purchased_programs ON public.programs
  FOR SELECT TO authenticated
  USING (public.program_in_my_active_membership(id));

COMMIT;
