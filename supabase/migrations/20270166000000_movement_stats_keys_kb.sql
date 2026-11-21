-- ═════════════════════════════════════════════════════════════════════════════
-- KB Deadlift et KB Front Squat comptent pour les badges deadlift et squat
-- (nbstyle69/AthleX-Manager#453, PR 3c-0, décision A de Nab)
--
-- Appliquée en prod : OUI, le 21/11/2026 à 22:15, heure de Paris lue par la
-- base, avec PGCLIENTENCODING=UTF8 (commit c8a9b0e0, sha256 du fichier
-- a9054e4f…57b5). Dump des schémas public et internal avec droits
-- db-dumps/2026-11-21/athlex-prod-public-internal-20261121T211419Z.dump,
-- sha256 a97b9d41803f30882c22dd86594c3f8a42b532c9740b74a75412bc485c4c6fb4,
-- aller-retour vérifié ; 141 TABLE DATA, 486 ACL, 348 POLICY. Précontrôle :
-- aucune clé pour les deux ids, badge_key NULL, deadlift → mv_deadlifts,
-- front_squat → mv_squat ; 0 WOD de tournoi citant ces ids, 0 score validé,
-- 0 ligne de registre liée. movement_stats_keys 72 → 74 lignes (md5
-- ab3f0b5f… → 174ca541…, ceux du rejeu) ; badge_key du catalogue 9dc9d497… →
-- 1c833288… (prévu en base), 323 autres lignes inchangées ; registre, cumuls
-- et badges identiques ; audit des droits 48/48 avant et après ; test réel
-- annulé sur AthleX Fitness (crédit deadlift 21 et squat 15), aucune trace.
-- Pas de BEGIN/COMMIT dans ce fichier : il se joue en UNE transaction :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- Retour arrière : supabase/retours/20270166000000_movement_stats_keys_kb.sql.
--
-- Migration de données. Le client ajoute 'kb deadlift' → deadlift et
-- 'kb front squat' → squat à MOVEMENT_MAP ; le pont serveur, généré par ce même
-- normaliseur (scripts/generate-movement-stats-keys.mjs, test jest
-- movementStatsKeys), doit dire la même chose, sinon un WOD de tournoi
-- structuré créditerait autrement qu'un WOD en lignes de l'app.
--
--   1. movement_stats_keys : kb_deadlift → deadlift, kb_front_squat → squat
--      (aujourd'hui sans ligne : ces deux ids ne créditaient rien).
--   2. movement_catalog.badge_key de ces deux ids : NULL → la valeur que le
--      catalogue porte déjà pour deadlift (mv_deadlifts) et front_squat
--      (mv_squat). Le test jest exige que les ids à correspondance soient
--      exactement ceux qui ont un badge_key, de la même famille.
--
-- 20270102 n'est pas modifiée : son INSERT reste l'état de départ.
--
-- Effet : seuls les crédits FUTURS changent. Aucun déclencheur n'écoute
-- movement_stats_keys ni movement_catalog.badge_key ; rien n'est recalculé ici.
-- Un score validé d'un WOD citant ces ids serait en revanche recrédité (pour
-- ces lignes) si ce score ou ce WOD est modifié plus tard
-- (trg_tournament_scores_credits, trg_tournament_wods_credits : le crédit est
-- recalculé par différence avec le registre).
--
-- Gardes : l'état d'avant doit être exactement celui attendu, et chaque
-- écriture doit toucher exactement les lignes prévues ; sinon tout échoue et
-- rien n'est écrit.
-- ═════════════════════════════════════════════════════════════════════════════

DO $migration$
DECLARE
  n int;
BEGIN
  -- ── Garde d'avant ──────────────────────────────────────────────────────────
  IF (SELECT count(*) FROM public.movement_catalog
       WHERE (id, name) IN (('kb_deadlift', 'KB Deadlift'), ('kb_front_squat', 'KB Front Squat'))
         AND badge_key IS NULL) <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_ETAT: kb_deadlift / kb_front_squat absents du catalogue, renommés ou déjà rattachés à un badge : rien n''est écrit';
  END IF;
  IF (SELECT count(*) FROM public.movement_catalog
       WHERE (id, badge_key) IN (('deadlift', 'mv_deadlifts'), ('front_squat', 'mv_squat'))) <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_ETAT: badge_key de deadlift / front_squat inattendu : rien n''est écrit';
  END IF;
  IF EXISTS (SELECT 1 FROM public.movement_stats_keys
              WHERE catalog_id IN ('kb_deadlift', 'kb_front_squat')) THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_ETAT: kb_deadlift / kb_front_squat ont déjà une clé : rien n''est écrit';
  END IF;

  -- ── 1. Le pont ─────────────────────────────────────────────────────────────
  INSERT INTO public.movement_stats_keys (catalog_id, stats_key) VALUES
    ('kb_deadlift', 'deadlift'),
    ('kb_front_squat', 'squat');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_LIGNES: % ligne(s) insérée(s) dans movement_stats_keys au lieu de 2', n;
  END IF;

  -- ── 2. Le badge du catalogue ───────────────────────────────────────────────
  UPDATE public.movement_catalog c
     SET badge_key = v.badge_key
    FROM (VALUES ('kb_deadlift', 'mv_deadlifts'), ('kb_front_squat', 'mv_squat')) AS v(id, badge_key)
   WHERE c.id = v.id AND c.badge_key IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'MOVEMENT_STATS_KEYS_KB_LIGNES: % ligne(s) de movement_catalog modifiée(s) au lieu de 2', n;
  END IF;
END
$migration$;
