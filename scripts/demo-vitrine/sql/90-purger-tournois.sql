-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — purge des tournois de vitrine (étape 5, sur feu vert).
--
-- Joué comme `postgres`, en une transaction, avec PGCLIENTENCODING=UTF8 :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> \
--        -v ids='{<uuid>,<uuid>,…}' -f scripts/demo-vitrine/sql/90-purger-tournois.sql
-- `ids` = les identifiants de scripts/demo-vitrine/vitrine.ids.json.
--
-- Exception validée par Nab pour ces seuls tournois : leurs résultats sont
-- supprimés malgré les deux gardes de conservation. Seuls ces deux
-- déclencheurs nommés sont désactivés, le temps de la transaction :
--   tournaments                .trg_tournaments_resultats_conserves
--   tournament_bracket_matches .trg_bracket_matches_termine_conserve
-- Interdits ici : session_replication_role, DISABLE TRIGGER ALL.
-- Avant le COMMIT : les deux déclencheurs doivent être réactivés (pg_trigger) et
-- plus aucune ligne ne doit se rapporter à ces tournois ; sinon exception, donc
-- ROLLBACK (ALTER TABLE est transactionnel : les déclencheurs reviennent aussi).
-- Rejoué après coup : ne trouve rien, ne supprime rien, repasse les contrôles.
-- Testé par scripts/demo-vitrine/sql/test-rejeu.sh (rejeu local, mutations).
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('vitrine.box', :'box', true), set_config('vitrine.ids', :'ids', true);

CREATE TEMP TABLE vitrine_tournois ON COMMIT DROP AS
SELECT t.id FROM public.tournaments t
 WHERE t.id = ANY (current_setting('vitrine.ids')::uuid[])
   AND t.box_id = current_setting('vitrine.box')::uuid;
CREATE TEMP TABLE vitrine_divisions ON COMMIT DROP AS
SELECT d.id FROM public.tournament_divisions d WHERE d.tournament_id IN (SELECT id FROM vitrine_tournois);
-- tournament_elo_history.tournament_id est en SET NULL : une ligne oubliée
-- survivrait orpheline, invisible par tournament_id. On la suit par son id.
CREATE TEMP TABLE vitrine_elo_cloture ON COMMIT DROP AS
SELECT h.id FROM public.tournament_elo_history h WHERE h.tournament_id IN (SELECT id FROM vitrine_tournois);

DO $avant$
DECLARE
  v_ids   uuid[] := current_setting('vitrine.ids')::uuid[];
  v_autre int;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'VITRINE_ROLE: à jouer sous un rôle serveur (postgres)';
  END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'VITRINE_REPLICATION: session_replication_role doit rester origin';
  END IF;
  -- Un identifiant listé qui appartient à une autre box : on n'y touche pas, et on s'arrête.
  SELECT count(*) INTO v_autre FROM public.tournaments
   WHERE id = ANY (v_ids) AND box_id <> current_setting('vitrine.box')::uuid;
  IF v_autre > 0 THEN
    RAISE EXCEPTION 'VITRINE_BOX: % tournoi(s) listé(s) appartiennent à une autre box', v_autre;
  END IF;
  RAISE NOTICE 'VITRINE_PURGE_AVANT listes=% trouves=% matchs=% scores=% inscrits=%',
    cardinality(v_ids), (SELECT count(*) FROM vitrine_tournois),
    (SELECT count(*) FROM public.tournament_bracket_matches WHERE tournament_id IN (SELECT id FROM vitrine_tournois)),
    (SELECT count(*) FROM public.tournament_scores WHERE tournament_id IN (SELECT id FROM vitrine_tournois)),
    (SELECT count(*) FROM public.tournament_participants WHERE tournament_id IN (SELECT id FROM vitrine_tournois));
END $avant$;

ALTER TABLE public.tournaments DISABLE TRIGGER trg_tournaments_resultats_conserves;
ALTER TABLE public.tournament_bracket_matches DISABLE TRIGGER trg_bracket_matches_termine_conserve;

-- Historiques sans clé étrangère vers le tournoi (ou en SET NULL) : à la main.
DELETE FROM public.tournament_match_elo_history WHERE tournament_id IN (SELECT id FROM vitrine_tournois);
DELETE FROM public.tournament_wod_elo_history   WHERE tournament_id IN (SELECT id FROM vitrine_tournois);
DELETE FROM public.tournament_elo_history       WHERE tournament_id IN (SELECT id FROM vitrine_tournois);
-- Le reste part en cascade : wods, scores, inscrits, matchs, divisions et leurs
-- membres, saisons, journal des notifications de tournoi.
DELETE FROM public.tournaments WHERE id IN (SELECT id FROM vitrine_tournois);

ALTER TABLE public.tournaments ENABLE TRIGGER trg_tournaments_resultats_conserves;
ALTER TABLE public.tournament_bracket_matches ENABLE TRIGGER trg_bracket_matches_termine_conserve;

DO $apres$
DECLARE
  v_ids    uuid[] := current_setting('vitrine.ids')::uuid[];
  v_actifs int;
  v_reste  bigint;
BEGIN
  SELECT count(*) INTO v_actifs FROM pg_trigger
   WHERE tgenabled = 'O'
     AND ((tgrelid = 'public.tournaments'::regclass AND tgname = 'trg_tournaments_resultats_conserves')
       OR (tgrelid = 'public.tournament_bracket_matches'::regclass AND tgname = 'trg_bracket_matches_termine_conserve'));
  IF v_actifs <> 2 THEN
    RAISE EXCEPTION 'VITRINE_DECLENCHEURS: % déclencheur(s) de conservation actif(s) sur 2 : ROLLBACK', v_actifs;
  END IF;

  SELECT (SELECT count(*) FROM public.tournaments                  WHERE id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_wods              WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_scores            WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_participants      WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_bracket_matches   WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_divisions         WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_division_members  WHERE division_id IN (SELECT id FROM vitrine_divisions))
       + (SELECT count(*) FROM public.tournament_season_history    WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_notifications_sent WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_elo_history       WHERE tournament_id = ANY (v_ids)
                                                                      OR id IN (SELECT id FROM vitrine_elo_cloture))
       + (SELECT count(*) FROM public.tournament_match_elo_history WHERE tournament_id = ANY (v_ids))
       + (SELECT count(*) FROM public.tournament_wod_elo_history   WHERE tournament_id = ANY (v_ids))
    INTO v_reste;
  IF v_reste <> 0 THEN
    RAISE EXCEPTION 'VITRINE_RESTE: % ligne(s) encore liée(s) aux tournois de vitrine : ROLLBACK', v_reste;
  END IF;
  RAISE NOTICE 'VITRINE_PURGE_APRES declencheurs_actifs=% reste=%', v_actifs, v_reste;
END $apres$;

COMMIT;
