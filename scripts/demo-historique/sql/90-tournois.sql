-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — tournois des comptes de démo (étape 2, sur feu vert).
--
-- Joué comme `postgres`, en une transaction, avec PGCLIENTENCODING=UTF8, après
-- 80-releve-purge.sql conforme :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> \
--        -v ids='{…}' -v archiver='{…}' -f scripts/demo-historique/sql/90-tournois.sql
--   ids      : tournois SUPPRIMÉS. Un tournoi au résultat validé n'y figure
--              qu'avec l'accord explicite de Nab : leurs résultats sont alors
--              supprimés malgré les deux gardes de conservation, désactivées par
--              leur nom le temps de la transaction :
--                tournaments                .trg_tournaments_resultats_conserves
--                tournament_bracket_matches .trg_bracket_matches_termine_conserve
--   archiver : tournois ARCHIVÉS (archived_at posé s'il ne l'est pas), conservés
--              avec leurs résultats ; à la suppression des comptes, leurs matchs
--              gardent leur ligne, participants à NULL (relevé 80, classe archive).
-- Interdits ici : session_replication_role, DISABLE TRIGGER ALL.
-- Avant le COMMIT : les deux déclencheurs doivent être réactivés (pg_trigger),
-- plus aucune ligne ne doit se rapporter aux tournois supprimés, et chaque
-- tournoi à archiver doit l'être ; sinon exception, donc ROLLBACK (ALTER TABLE
-- est transactionnel : les déclencheurs reviennent aussi).
-- Rejoué après coup : ne trouve rien, ne supprime rien, repasse les contrôles.
-- Testé par scripts/demo-historique/sql/test-rejeu.sh (rejeu local, mutations).
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('histo.box', :'box', true), set_config('histo.ids', :'ids', true), set_config('histo.archiver', :'archiver', true);

CREATE TEMP TABLE histo_tournois ON COMMIT DROP AS
SELECT t.id FROM public.tournaments t
 WHERE t.id = ANY (current_setting('histo.ids')::uuid[])
   AND t.box_id = current_setting('histo.box')::uuid;
CREATE TEMP TABLE histo_divisions ON COMMIT DROP AS
SELECT d.id FROM public.tournament_divisions d WHERE d.tournament_id IN (SELECT id FROM histo_tournois);
-- tournament_elo_history.tournament_id est en SET NULL : une ligne oubliée
-- survivrait orpheline, invisible par tournament_id. On la suit par son id.
CREATE TEMP TABLE histo_elo_cloture ON COMMIT DROP AS
SELECT h.id FROM public.tournament_elo_history h WHERE h.tournament_id IN (SELECT id FROM histo_tournois);

DO $avant$
DECLARE
  v_ids   uuid[] := current_setting('histo.ids')::uuid[];
  v_autre int;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'HISTO_ROLE: à jouer sous un rôle serveur (postgres)';
  END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'HISTO_REPLICATION: session_replication_role doit rester origin';
  END IF;
  -- Un identifiant listé qui appartient à une autre box : on n'y touche pas, et on s'arrête.
  SELECT count(*) INTO v_autre FROM public.tournaments
   WHERE id = ANY (v_ids) AND box_id <> current_setting('histo.box')::uuid;
  IF v_autre > 0 THEN
    RAISE EXCEPTION 'HISTO_BOX: % tournoi(s) listé(s) appartiennent à une autre box', v_autre;
  END IF;
  SELECT count(*) INTO v_autre FROM unnest(current_setting('histo.archiver')::uuid[]) a(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = a.id AND t.box_id = current_setting('histo.box')::uuid);
  IF v_autre > 0 THEN
    RAISE EXCEPTION 'HISTO_BOX: % tournoi(s) à archiver absent(s) de la box', v_autre;
  END IF;
  IF v_ids && current_setting('histo.archiver')::uuid[] THEN
    RAISE EXCEPTION 'HISTO_LISTES: un tournoi est à la fois à supprimer et à archiver';
  END IF;
  RAISE NOTICE 'HISTO_PURGE_AVANT listes=% trouves=% matchs=% scores=% inscrits=%',
    cardinality(v_ids), (SELECT count(*) FROM histo_tournois),
    (SELECT count(*) FROM public.tournament_bracket_matches WHERE tournament_id IN (SELECT id FROM histo_tournois)),
    (SELECT count(*) FROM public.tournament_scores WHERE tournament_id IN (SELECT id FROM histo_tournois)),
    (SELECT count(*) FROM public.tournament_participants WHERE tournament_id IN (SELECT id FROM histo_tournois));
END $avant$;

ALTER TABLE public.tournaments DISABLE TRIGGER trg_tournaments_resultats_conserves;
ALTER TABLE public.tournament_bracket_matches DISABLE TRIGGER trg_bracket_matches_termine_conserve;

-- Historiques sans clé étrangère vers le tournoi (ou en SET NULL) : à la main.
DELETE FROM public.tournament_match_elo_history WHERE tournament_id IN (SELECT id FROM histo_tournois);
DELETE FROM public.tournament_wod_elo_history   WHERE tournament_id IN (SELECT id FROM histo_tournois);
DELETE FROM public.tournament_elo_history       WHERE tournament_id IN (SELECT id FROM histo_tournois);
-- Le reste part en cascade : wods, scores, inscrits, matchs, divisions et leurs
-- membres, saisons, journal des notifications de tournoi.
DELETE FROM public.tournaments WHERE id IN (SELECT id FROM histo_tournois);

ALTER TABLE public.tournaments ENABLE TRIGGER trg_tournaments_resultats_conserves;
-- Archivage (déclencheurs de conservation actifs : on ne fait que poser la date).
UPDATE public.tournaments SET archived_at = now()
 WHERE id = ANY (current_setting('histo.archiver')::uuid[]) AND archived_at IS NULL
   AND box_id = current_setting('histo.box')::uuid;
ALTER TABLE public.tournament_bracket_matches ENABLE TRIGGER trg_bracket_matches_termine_conserve;

DO $apres$
DECLARE
  v_ids    uuid[] := current_setting('histo.ids')::uuid[];
  v_actifs int;
  v_reste  bigint;
BEGIN
  SELECT count(*) INTO v_actifs FROM pg_trigger
   WHERE tgenabled = 'O'
     AND ((tgrelid = 'public.tournaments'::regclass AND tgname = 'trg_tournaments_resultats_conserves')
       OR (tgrelid = 'public.tournament_bracket_matches'::regclass AND tgname = 'trg_bracket_matches_termine_conserve'));
  IF v_actifs <> 2 THEN
    RAISE EXCEPTION 'HISTO_DECLENCHEURS: % déclencheur(s) de conservation actif(s) sur 2 : ROLLBACK', v_actifs;
  END IF;

  SELECT (SELECT count(*) FROM public.tournaments                  WHERE id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_wods              WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_scores            WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_participants      WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_bracket_matches   WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_divisions         WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_division_members  WHERE division_id IN (SELECT id FROM histo_divisions))
       + (SELECT count(*) FROM public.tournament_season_history    WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_notifications_sent WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_elo_history       WHERE tournament_id = ANY (v_ids)
                                                                      OR id IN (SELECT id FROM histo_elo_cloture))
       + (SELECT count(*) FROM public.tournament_match_elo_history WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_wod_elo_history   WHERE tournament_id = ANY (v_ids))
    INTO v_reste;
  IF v_reste <> 0 THEN
    RAISE EXCEPTION 'HISTO_RESTE: % ligne(s) encore liée(s) aux tournois listés : ROLLBACK', v_reste;
  END IF;
  SELECT count(*) INTO v_reste FROM public.tournaments
   WHERE id = ANY (current_setting('histo.archiver')::uuid[]) AND archived_at IS NULL;
  IF v_reste <> 0 THEN
    RAISE EXCEPTION 'HISTO_ARCHIVE: % tournoi(s) à archiver non archivé(s) : ROLLBACK', v_reste;
  END IF;
  RAISE NOTICE 'HISTO_PURGE_APRES declencheurs_actifs=% reste=0 archives=%', v_actifs,
    (SELECT count(*) FROM public.tournaments WHERE id = ANY (current_setting('histo.archiver')::uuid[]) AND archived_at IS NOT NULL);
END $apres$;

COMMIT;
