-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270166000000_movement_stats_keys_kb.sql
-- (nbstyle69/AthleX-Manager#453, PR 3c-0)
--
-- À jouer en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test le rejoue dans sa transaction annulée).
--
-- Retire les deux lignes de movement_stats_keys et remet à NULL le badge_key de
-- kb_deadlift et kb_front_squat. Les crédits déjà inscrits au registre sous
-- deadlift / squat par ces lignes restent (comme pour tout crédit passé) ;
-- seuls les crédits futurs reviennent à « rien ». movement_catalog.updated_at
-- de ces deux lignes garde la date du retour (déclencheur de la table).
--
-- Gardes : l'état d'après 20270166 doit être exactement celui attendu, et
-- chaque écriture doit toucher exactement deux lignes ; sinon rien n'est écrit.
-- Le client doit revenir en même temps (MOVEMENT_MAP sans les deux entrées),
-- sinon le test jest movementStatsKeys ne correspond plus à la base.
-- ═════════════════════════════════════════════════════════════════════════════

DO $retour$
DECLARE
  n int;
BEGIN
  IF (SELECT count(*) FROM public.movement_stats_keys
       WHERE (catalog_id, stats_key) IN (('kb_deadlift', 'deadlift'), ('kb_front_squat', 'squat'))) <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT: les deux clés de 20270166 sont absentes ou modifiées : rien n''est écrit';
  END IF;
  IF (SELECT count(*) FROM public.movement_catalog
       WHERE (id, badge_key) IN (('kb_deadlift', 'mv_deadlifts'), ('kb_front_squat', 'mv_squat'))) <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_RETOUR_ETAT: badge_key de kb_deadlift / kb_front_squat inattendu : rien n''est écrit';
  END IF;

  DELETE FROM public.movement_stats_keys
   WHERE (catalog_id, stats_key) IN (('kb_deadlift', 'deadlift'), ('kb_front_squat', 'squat'));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_RETOUR_LIGNES: % ligne(s) retirée(s) de movement_stats_keys au lieu de 2', n;
  END IF;

  UPDATE public.movement_catalog
     SET badge_key = NULL
   WHERE (id, badge_key) IN (('kb_deadlift', 'mv_deadlifts'), ('kb_front_squat', 'mv_squat'));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_RETOUR_LIGNES: % ligne(s) de movement_catalog modifiée(s) au lieu de 2', n;
  END IF;
END
$retour$;
