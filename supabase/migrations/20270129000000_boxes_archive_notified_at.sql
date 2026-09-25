-- ═════════════════════════════════════════════════════════════════════════════
-- boxes.archive_notified_at : l'e-mail d'archivage est parti
--
-- Appliquée en prod : OUI, le 25/09/2026 à 22:36 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-25/athlex-prod-public-internal-20260925T223607Z.dump,
-- sha256 908ed49a29009974418e18cb05d6d02bfb5a673ca136fb20d06040e935e3d2c3 vérifié
-- après aller-retour, 133 TABLE DATA, 433 ACL, 345 POLICY ; précontrôles : ni
-- colonne, ni fonction, ni déclencheur de ce nom, 3 déclencheurs sur boxes,
-- unschedule_box_archive et internal.archiver_boxes_echues identiques au dépôt,
-- prevent_client_box_insert identique aux fins de ligne près (8 retours chariot
-- dans le corps en prod), règles de boxes identiques à search_path égal, 3 boxes
-- dont aucune archivée ni programmée ; vérifications : fonction identique au
-- rejeu octet pour octet (md5 5b8de3a3030511521b8816fe0793e24b, EXECUTE pour
-- son propriétaire seulement), déclencheur et colonne conformes, anon ne la
-- lit pas, boxes (hors colonne ajoutée), ses règles et ses droits identiques
-- avant/après ; audit des droits en prod 29/29 ; tests réels en transaction
-- annulée, sans trace.)
--
-- Pourquoi : le suivi Manager (AthleX-Manager #391) déduit « e-mail
-- d'archivage envoyé une seule fois » de l'état des abonnements ; dans un cas
-- rare, l'e-mail ne partirait jamais. La colonne le rend exact : le Manager la
-- renseigne à l'envoi (sa PR 3), avec la clé serveur.
--
-- 1. `boxes.archive_notified_at` (timestamptz, NULL par défaut) : date d'envoi de
--    l'e-mail d'archivage.
--
-- 2. Remise à vide : dès qu'une box n'est plus ni archivée ni en archivage
--    programmé (`archived_at` et `archive_scheduled_at` tous deux NULL), la
--    colonne repasse à NULL, par un déclencheur BEFORE UPDATE sur `boxes`.
--    Une règle unique plutôt qu'une ligne dans chaque chemin, parce que la
--    plupart écrivent `boxes` directement. Chemins relevés qui effacent l'état
--    programmé ou archivé :
--      `unschedule_box_archive` (annulation, super-admin ou clé serveur) ;
--      réactivation par le Manager, clé serveur : `archived_at` (et, avec #391,
--        les quatre colonnes d'archivage) remis à NULL ;
--      écriture directe d'un gérant sur sa box (`archive_scheduled_at` n'a
--        aucune garde : voir la PR).
--    Sans effet sur la colonne : la programmation (#390/#391), l'archivage
--    immédiat et l'archivage automatique (`internal.archiver_boxes_echues`),
--    qui laissent la box programmée ou archivée.
--
-- 3. Droits : seules la clé serveur et les tâches la modifient. Un rôle client
--    (`authenticated`, `anon`) qui la change est refusé (42501,
--    `BOX_ARCHIVE_NOTIFIED_AT`), même gérant ou co-gérant : `authenticated` a
--    le droit UPDATE sur toute la table, un retrait par colonne n'y changerait
--    rien. La remise à vide par le déclencheur, elle, vaut pour tous. `anon`
--    ne la lit pas (ses droits sont par colonne). La création d'une box par un
--    client est déjà refusée (`prevent_client_box_insert`).
--
-- Contrôlée par `supabase/tests/boxes_archive_notified_at.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.boxes ADD COLUMN archive_notified_at timestamptz;

COMMENT ON COLUMN public.boxes.archive_notified_at IS
  'Date d''envoi de l''e-mail d''archivage (Manager, clé serveur). Remise à NULL quand la box n''est plus ni archivée ni en archivage programmé. Non modifiable par un rôle client.';

CREATE FUNCTION internal.garder_archive_notified_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.archive_notified_at IS DISTINCT FROM OLD.archive_notified_at
     AND coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'BOX_ARCHIVE_NOTIFIED_AT: seule la clé serveur renseigne l''envoi de l''e-mail d''archivage.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.archived_at IS NULL AND NEW.archive_scheduled_at IS NULL THEN
    NEW.archive_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.garder_archive_notified_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_boxes_archive_notified_at
  BEFORE UPDATE OF archive_notified_at, archived_at, archive_scheduled_at ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION internal.garder_archive_notified_at();

COMMIT;
