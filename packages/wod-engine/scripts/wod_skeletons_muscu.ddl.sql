-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur Musculation V1 (M1) — squelettes `discipline = 'musculation'`.
--
-- FICHIER GÉNÉRÉ par packages/wod-engine/scripts/export-bank.ts depuis
-- packages/wod-engine/src/bank/muscu.ts (DDL : scripts/wod_skeletons_muscu.ddl.sql).
-- Ne pas éditer à la main : relancer le script.
--
-- Appliquée en prod : NON.
--
-- Additif et rejouable : élargit les CHECK de `wod_skeletons` (discipline
-- `musculation`, format `strength_session`) et insère les 39 squelettes
-- (13 cibles × 3 objectifs). `definition` = `MuscuSkeleton` du package ;
-- le moteur lit les lignes `active` et retombe sur le snapshot embarqué
-- (`MUSCU_SKELETONS`) hors ligne ou sur une base sans ces lignes.
-- Les lignes functional / hybrid (version 3) ne sont pas touchées.
--
-- Prérequis côté app : l'app 1.0.53 charge toutes les lignes actives sans
-- filtrer la discipline ; ne pas appliquer avant le build embarquant M1.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.wod_skeletons DROP CONSTRAINT IF EXISTS wod_skeletons_discipline_check;
ALTER TABLE public.wod_skeletons ADD CONSTRAINT wod_skeletons_discipline_check
  CHECK (discipline IN ('functional','hybrid','musculation'));

ALTER TABLE public.wod_skeletons DROP CONSTRAINT IF EXISTS wod_skeletons_format_check;
ALTER TABLE public.wod_skeletons ADD CONSTRAINT wod_skeletons_format_check
  CHECK (format IN ('amrap','for_time','rounds_for_time','chipper','emom','interval','ladder','death_by','tabata','stations','continuous','strength_session'));

ALTER TABLE public.wod_skeletons DROP CONSTRAINT IF EXISTS wod_skeletons_muscu_format;
ALTER TABLE public.wod_skeletons ADD CONSTRAINT wod_skeletons_muscu_format
  CHECK ((discipline = 'musculation') = (format = 'strength_session'));

ALTER TABLE public.wod_volume_caps DROP CONSTRAINT IF EXISTS wod_volume_caps_family_check;
ALTER TABLE public.wod_volume_caps ADD CONSTRAINT wod_volume_caps_family_check
  CHECK (family IS NULL OR family IN ('barbell','dumbbell','kettlebell','gym','bodyweight','erg','run','sled','carry','sandbag','wallball','jump_rope','box','machine','cable','other'));
