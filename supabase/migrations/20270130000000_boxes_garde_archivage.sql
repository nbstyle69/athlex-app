-- ═════════════════════════════════════════════════════════════════════════════
-- Garde sur l'état d'archivage d'une box (faille relevée dans #378)
--
-- Appliquée en prod : NON.
--
-- La faille : `authenticated` a UPDATE sur toute la table `boxes`, et les
-- règles d'écriture (`boxes_owner_write`, `box_owner_full`,
-- `boxes_coowner_manage`) laissent le gérant et le co-gérant écrire leur box.
-- Aucune garde ne protégeait `archive_scheduled_at` : un gérant pouvait effacer
-- lui-même, depuis le navigateur, l'archivage programmé de sa box — ce que
-- `unschedule_box_archive` réserve au super-admin — ou en poser un (constaté en
-- prod le 25/09/2026, en transaction annulée).
--
-- La garde de #378 (`archive_notified_at`) est étendue aux quatre colonnes de
-- l'état d'archivage : `archive_scheduled_at`, `archive_scheduled_by`,
-- `archived_at`, `archived_by`. Un rôle client (`authenticated`, `anon`) ne
-- peut ni les poser, ni les effacer, ni les modifier, quelle que soit la règle
-- RLS d'écriture : refus 42501 `BOX_ARCHIVAGE_RESERVE` (et toujours
-- `BOX_ARCHIVE_NOTIFIED_AT` pour la date d'envoi de l'e-mail). Une valeur
-- réécrite à l'identique passe. La création d'une box par un client est déjà
-- refusée (`prevent_client_box_insert`).
--
-- Le rôle client se lit dans `current_user`, pas dans `auth.role()` : un
-- super-admin peut appeler `unschedule_box_archive` avec son jeton
-- d'utilisateur, `auth.role()` y vaut `authenticated`, alors que l'écriture est
-- faite par la fonction (SECURITY DEFINER, `current_user` = son propriétaire).
-- La fonction de garde est donc SECURITY INVOKER. Restent autorisés : la clé
-- serveur (`service_role` : routes super-admin du Manager, dont « Réactiver »
-- et `archive-schedule`), les fonctions d'archivage (`unschedule_box_archive`,
-- `internal.archiver_boxes_echues` par la tâche `box_archive_sweep`) et les
-- rôles d'administration.
--
-- Chemins relevés qui écrivent ces colonnes, tous hors rôle client : Manager
-- (routes admin `archive` et `archive-schedule`, `createServiceClient`), les
-- deux fonctions ci-dessus, `scripts/test-box-archivage.mjs` (clé serveur),
-- les tests SQL (rôle d'administration). Aucune écriture de l'app ni des
-- autres mises à jour de `boxes` du Manager ne touche ces colonnes.
--
-- Remplace `internal.garder_archive_notified_at` et son déclencheur par
-- `internal.garder_archivage_box` / `trg_boxes_garde_archivage` ; la remise à
-- vide d'`archive_notified_at` (#378) est reprise telle quelle.
--
-- Contrôlée par `supabase/tests/boxes_garde_archivage.sql` (et
-- `supabase/tests/boxes_archive_notified_at.sql`).
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER trg_boxes_archive_notified_at ON public.boxes;
DROP FUNCTION internal.garder_archive_notified_at();

CREATE FUNCTION internal.garder_archivage_box()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.archive_notified_at IS DISTINCT FROM OLD.archive_notified_at THEN
      RAISE EXCEPTION 'BOX_ARCHIVE_NOTIFIED_AT: seule la clé serveur renseigne l''envoi de l''e-mail d''archivage.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.archive_scheduled_at IS DISTINCT FROM OLD.archive_scheduled_at
       OR NEW.archive_scheduled_by IS DISTINCT FROM OLD.archive_scheduled_by
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.archived_by IS DISTINCT FROM OLD.archived_by THEN
      RAISE EXCEPTION 'BOX_ARCHIVAGE_RESERVE: l''archivage d''une box se programme, s''annule, s''applique et se lève par le super-admin seulement.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  IF NEW.archived_at IS NULL AND NEW.archive_scheduled_at IS NULL THEN
    NEW.archive_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.garder_archivage_box() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_boxes_garde_archivage
  BEFORE UPDATE OF archive_notified_at, archive_scheduled_at, archive_scheduled_by, archived_at, archived_by ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION internal.garder_archivage_box();

COMMIT;
