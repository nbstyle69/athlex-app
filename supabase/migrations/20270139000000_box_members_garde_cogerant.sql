-- ═════════════════════════════════════════════════════════════════════════════
-- Le rôle co-gérant ne se donne et ne se retire que par le gérant principal
-- (écart A du lot sécurité Manager)
--
-- Appliquée en prod : NON.
--
-- La faille (relevé du 29/09/2026 en prod, lecture seule) : `authenticated` a
-- INSERT, UPDATE et DELETE sur `box_members`, et `box_members_coowner_manage`
-- (FOR ALL, `is_box_owner_member(box_id)`) laisse tout co-gérant actif écrire
-- n'importe quelle ligne de sa box. Un co-gérant peut donc nommer un autre
-- co-gérant (page /members du Manager, écriture directe), qui aura accès à
-- l'argent, ou retirer ce rôle à un autre co-gérant. Aucun déclencheur de
-- `box_members` ne regarde `role` (garde de facturation 20270132 : « ni
-- `status` ni `role` ne sont gardés »).
--
-- Règle : pour un rôle client (`authenticated`, `anon`), seul le gérant
-- principal (`boxes.owner_id`, `is_box_owner`) donne ou retire le rôle
-- `owner` d'une ligne de `box_members` ; refus 42501
-- `MEMBRE_ROLE_COGERANT_RESERVE`. Sont refusés à tout autre client :
--   - une insertion avec `role = 'owner'` ;
--   - une mise à jour d'une ligne dont l'ancien ou le nouveau rôle est `owner`
--     qui change `role`, `member_id`, `box_id` ou `status` (sans quoi déplacer
--     une ligne de co-gérant vers une autre personne contournerait la règle,
--     d'où un déclencheur sur toutes les colonnes et pas `UPDATE OF role` ;
--     `status` parce que `is_box_owner_member` exige `active` : bannir ou
--     désactiver un co-gérant lui retire le rôle, le réactiver le lui rend) ;
--   - la suppression de la ligne `owner` d'un AUTRE membre.
-- Restent permis :
--   - au co-gérant : renoncer à son propre rôle (sa ligne, `member_id =
--     auth.uid()` : tout changement qui ne le rend pas co-gérant actif) et
--     quitter la box (`box_members_self_leave`) ; gérer les rôles `member` et
--     `coach` ;
--   - au gérant principal : tout, dont le parcours du Manager « nommer un
--     co-gérant » (rétrogradation de l'actuel puis promotion) ;
--   - la clé serveur, les fonctions SECURITY DEFINER (`join_box_by_invite`…,
--     `current_user` = leur propriétaire) et les rôles d'administration.
-- Une réécriture à l'identique passe. Les autres colonnes d'une ligne `owner`
-- (facturation exceptée, gardée par 20270132) restent libres.
--
-- La garde lit `current_user` (SECURITY INVOKER), sur le modèle de
-- `internal.garder_facturation_membre` ; `is_box_owner` et `auth.uid()` sont
-- exécutables par `authenticated` (vérifié en prod le 29/09/2026).
--
-- En prod le 29/09/2026 : une seule ligne `role = 'owner'`, celle d'un gérant
-- principal ; aucun co-gérant n'est concerné.
--
-- Contrôlée par `supabase/tests/box_members_garde_cogerant.sql` et par le
-- contrôle T12 de l'audit des droits (`scripts/lib/controle-grants-tables.mjs`).
--
-- Retour arrière (transactionnel, additif pur : aucune définition de prod n'est
-- remplacée ; vérifié sur le rejeu — après lui, règles, droits et déclencheurs
-- de box_members identiques à l'état d'avant la migration) :
--
--   BEGIN;
--   DROP TRIGGER trg_box_members_garde_cogerant ON public.box_members;
--   DROP FUNCTION internal.garder_role_cogerant();
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE FUNCTION internal.garder_role_cogerant()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'owner' AND NOT public.is_box_owner(NEW.box_id) THEN
      RAISE EXCEPTION 'MEMBRE_ROLE_COGERANT_RESERVE: seul le gérant principal nomme ou retire un co-gérant.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' AND OLD.member_id IS DISTINCT FROM auth.uid()
       AND NOT public.is_box_owner(OLD.box_id) THEN
      RAISE EXCEPTION 'MEMBRE_ROLE_COGERANT_RESERVE: seul le gérant principal nomme ou retire un co-gérant.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF (OLD.role = 'owner' OR NEW.role = 'owner')
     AND ROW(NEW.role, NEW.member_id, NEW.box_id, NEW.status)
         IS DISTINCT FROM ROW(OLD.role, OLD.member_id, OLD.box_id, OLD.status)
     AND NOT (public.is_box_owner(OLD.box_id) AND public.is_box_owner(NEW.box_id))
     -- Renonciation : sur sa propre ligne de co-gérant, tout ce qui ne le
     -- rend pas (de nouveau) co-gérant actif.
     AND NOT (OLD.role = 'owner' AND OLD.member_id = auth.uid()
              AND NEW.member_id = OLD.member_id AND NEW.box_id = OLD.box_id
              AND NOT (NEW.role = 'owner' AND NEW.status IS NOT DISTINCT FROM 'active')) THEN
    RAISE EXCEPTION 'MEMBRE_ROLE_COGERANT_RESERVE: seul le gérant principal nomme ou retire un co-gérant.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.garder_role_cogerant() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_box_members_garde_cogerant
  BEFORE INSERT OR UPDATE OR DELETE ON public.box_members
  FOR EACH ROW EXECUTE FUNCTION internal.garder_role_cogerant();

COMMIT;
