-- ═════════════════════════════════════════════════════════════════════════════
-- Programmation automatique (J1) — squelettes de séance `discipline = 'session'`.
--
-- FICHIER GÉNÉRÉ par packages/wod-engine/scripts/export-bank.ts depuis
-- packages/wod-engine/src/bank/session.ts (DDL : scripts/wod_skeletons_session.ddl.sql).
-- Ne pas éditer à la main : relancer le script.
--
-- Appliquée en prod : NON.
--
-- Additif et rejouable : élargit les CHECK de `wod_skeletons` (discipline
-- `session`, format `session`) et insère les 6 squelettes de séance
-- CrossFit / Hyrox (lundi → samedi : S1_snatch … S6_long). `definition` =
-- `SessionSkeleton` du package (échauffement, bloc A, bloc B optionnel, filtre
-- du bloc C, finishers). Le moteur lit les lignes `active` et retombe sur le
-- snapshot embarqué (`SESSION_SKELETONS`) hors ligne ou sur une base sans ces
-- lignes. Les lignes functional / hybrid / musculation ne sont pas touchées.
--
-- Prérequis : 20261215000000_wod_skeletons_musculation.sql (CHECK muscu).
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.wod_skeletons DROP CONSTRAINT IF EXISTS wod_skeletons_discipline_check;
ALTER TABLE public.wod_skeletons ADD CONSTRAINT wod_skeletons_discipline_check
  CHECK (discipline IN ('functional','hybrid','musculation','session'));

ALTER TABLE public.wod_skeletons DROP CONSTRAINT IF EXISTS wod_skeletons_format_check;
ALTER TABLE public.wod_skeletons ADD CONSTRAINT wod_skeletons_format_check
  CHECK (format IN ('amrap','for_time','rounds_for_time','chipper','emom','interval','ladder','death_by','tabata','stations','continuous','strength_session','session'));

ALTER TABLE public.wod_skeletons DROP CONSTRAINT IF EXISTS wod_skeletons_session_format;
ALTER TABLE public.wod_skeletons ADD CONSTRAINT wod_skeletons_session_format
  CHECK ((discipline = 'session') = (format = 'session'));
