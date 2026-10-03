-- ═════════════════════════════════════════════════════════════════════════════
-- Notifications du gérant (D4b, PR 1) : résultat de l'envoi et co-gérants
--
-- Appliquée en prod : OUI, le 03/10/2026 à 16:17 UTC, avec PGCLIENTENCODING=UTF8,
-- sur GO de Nab. Dump des schémas public et internal avec droits
-- db-dumps/2026-10-03/athlex-prod-public-internal-20261003T160601Z.dump,
-- sha256 0021d536f25a28d87dd05475adfac268c04dafb11ab6cbe1b6ff9b4ae9bf7531 vérifié
-- après aller-retour, 135 TABLE DATA, 450 ACL, 346 POLICY ; précontrôles : md5
-- des trois règles (f1c07d7a…, 18a7a39e…, 4df9fd82…), is_box_owner aa018646…,
-- is_box_owner_admin e61752a6…, ni colonne, ni déclencheur, ni garde ; 3 lignes,
-- empreinte du contenu 59bcdd522dc6ba021d861808d1bdcd5b ; fonction déployée
-- identique à la copie avant-d4b-pr1 ; vérifications : colonne integer NULL,
-- déclencheur O / tgtype 23 / sans colonnes, seul sur la table, garde
-- SECURITY INVOKER au md5 51b20f187c6ae258914332a2fd349939 (sans CR), EXECUTE
-- fermé à anon et authenticated, box_notifs_owner = is_box_owner_admin(box_id)
-- (md5 88f31044…), deux règles de lecture inchangées, 3 lignes à la même
-- empreinte, delivered_count NULL partout ; test réel en transaction annulée sur
-- AthleX Fitness (co-gérant fictif accepté, delivered_count = 1 refusé 42501,
-- coach fictif refusé par la RLS, clé serveur : réservation conditionnelle puis
-- seconde réservation refusée puis résultat posé, co-gérant qui réécrit refusé),
-- sans trace ; audit des droits en prod 38/38 (T13 compris). Fonction
-- send-box-notification déployée le même jour à 16:19 UTC (source identique à
-- la branche, sondes 401 sans JWT, journaux sans erreur).
--
-- Trois changements sur `public.box_notifications` :
--
--   a) colonne `delivered_count integer NULL` : nombre d'appareils qu'Expo a
--      acceptés pour cette notification (tickets « ok »), 0 compris. NULL veut
--      dire « notification antérieure à cette migration, ou pas encore envoyée ».
--      Écrite par la fonction edge `send-box-notification`, avec la clé serveur :
--      d'abord 0 par une mise à jour conditionnelle (`WHERE delivered_count IS
--      NULL`) qui réserve l'envoi, puis le nombre définitif. Une notification
--      qui a déjà un résultat n'est jamais renvoyée (409 `Already sent`).
--
--   b) garde `internal.garder_resultat_notification()` (BEFORE INSERT OR UPDATE,
--      ligne par ligne, toutes colonnes) : pour un rôle client (`authenticated`,
--      `anon`), une insertion doit laisser `delivered_count` à NULL et une mise à
--      jour ne doit pas le changer ; refus 42501 `NOTIF_RESULTAT_RESERVE`. Un
--      gérant ne peut donc ni inventer ni réécrire le résultat d'un envoi. La
--      clé serveur et les fonctions SECURITY DEFINER passent (`current_user` est
--      alors leur rôle), sur le modèle de `internal.garder_role_cogerant`
--      (20270139). Une réécriture à l'identique passe.
--
--   c) `box_notifs_owner` : gérant ET co-gérants. La règle part de la définition
--      relevée en prod le 03/10/2026 (lecture seule, search_path de la prod
--      `"$user", public, extensions`) et ne change que la fonction appelée :
--
--        prod       : FOR ALL USING (is_box_owner(box_id))
--                     md5 de qual f1c07d7a6bbd6c505f6de2e3cbbc151a, sans WITH CHECK
--        migration  : FOR ALL USING (is_box_owner_admin(box_id)), sans WITH CHECK
--
--      `public.is_box_owner_admin` (20261101, md5 de pg_get_functiondef en prod
--      e61752a60abf9ec18f3b5e0571cc3c4f, identique au dépôt) est la règle
--      « gérant ou co-gérant » déjà utilisée pour l'argent : `boxes.owner_id`,
--      ou ligne `box_members` `role = 'owner'` active, ou administrateur de la
--      plateforme (`profiles.role` admin / super_admin). Le coach et le membre
--      simple restent sans écriture. Les deux règles de lecture des membres
--      (`box_notifs_member_read`, md5 18a7a39e…, et `notif_member_read`,
--      md5 4df9fd82…) ne sont pas touchées.
--
-- Relevé de prod du 03/10/2026 (lecture seule) : 3 lignes dans la table, aucun
-- déclencheur, RLS active ; `authenticated` a SELECT, INSERT, UPDATE, DELETE ;
-- `public.is_box_owner` au md5 aa0186463d1c06497093850cb591357f.
--
-- Contrôlée par `supabase/tests/notifications_gerant_resultat.sql` (rejouée par
-- la CI, retour arrière compris) et par le contrôle T13 de l'audit des droits
-- (`scripts/lib/controle-grants-tables.mjs`).
--
-- Ordre d'application : cette migration, puis la fonction `send-box-notification`
-- de la même PR. L'ordre inverse ne casse rien : la fonction journalise l'échec
-- d'écriture de `delivered_count` sans changer sa réponse.
--
-- Retour arrière (transactionnel ; d'abord redéployer l'ancienne fonction,
-- copie gardée dans C:\Users\NBS\athlex-retour-arriere-send-box-notification\
-- avant-d4b-pr1, identique au dépôt `d9b3382` ; vérifié sur le rejeu par la
-- suite de tests : après lui, `box_notifs_owner` revient au md5 de prod
-- f1c07d7a…, les deux autres règles sont inchangées, ni colonne, ni
-- déclencheur, ni fonction ne subsistent) :
--
--   BEGIN;
--   DROP TRIGGER trg_box_notifications_garde_resultat ON public.box_notifications;
--   DROP FUNCTION internal.garder_resultat_notification();
--   DROP POLICY box_notifs_owner ON public.box_notifications;
--   CREATE POLICY box_notifs_owner ON public.box_notifications
--     USING (public.is_box_owner(box_id));
--   ALTER TABLE public.box_notifications DROP COLUMN delivered_count;
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- a) Résultat de l'envoi.
ALTER TABLE public.box_notifications ADD COLUMN delivered_count integer NULL;
COMMENT ON COLUMN public.box_notifications.delivered_count IS
  'Appareils acceptés par Expo (tickets ok) ; NULL = antérieure ou pas encore envoyée. Écrit par send-box-notification (clé serveur) seulement.';

-- b) Garde : seule la clé serveur écrit le résultat.
CREATE FUNCTION internal.garder_resultat_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.delivered_count IS NOT NULL THEN
      RAISE EXCEPTION 'NOTIF_RESULTAT_RESERVE: seul le serveur écrit le résultat d''un envoi.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.delivered_count IS DISTINCT FROM OLD.delivered_count THEN
    RAISE EXCEPTION 'NOTIF_RESULTAT_RESERVE: seul le serveur écrit le résultat d''un envoi.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.garder_resultat_notification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_box_notifications_garde_resultat
  BEFORE INSERT OR UPDATE ON public.box_notifications
  FOR EACH ROW EXECUTE FUNCTION internal.garder_resultat_notification();

-- c) Gérant et co-gérants créent et lisent les notifications de leur box.
DROP POLICY box_notifs_owner ON public.box_notifications;
CREATE POLICY box_notifs_owner ON public.box_notifications
  USING (public.is_box_owner_admin(box_id));

COMMIT;
