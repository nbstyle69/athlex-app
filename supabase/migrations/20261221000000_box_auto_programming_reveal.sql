-- ═════════════════════════════════════════════════════════════════════════════
-- Programmation automatique — mode et horaire de révélation par box.
--
-- Appliquée en prod : NON.
--
-- Additif et rejouable. J1 révélait toute la semaine le dimanche 18:00 Paris,
-- en dur dans le moteur (`REVEAL_HOUR_PARIS`). Ces trois colonnes rendent la
-- règle propre à la box ; `generate-box-week` les lit et en déduit `publish_at` :
--
--   auto_programming_reveal_mode  'weekly' (défaut) — toutes les cartes ensemble,
--                                 le jour `dow` de la semaine qui précède le lundi
--                                 ciblé (le lundi lui-même si `dow = 1`), à `time` ;
--                                 'daily' — chaque carte à `time` le jour de sa séance.
--   auto_programming_reveal_dow   0 = dimanche … 6 = samedi (convention `extract(dow)`),
--                                 ignoré en 'daily'.
--   auto_programming_reveal_time  heure locale Europe/Paris (jamais UTC : le moteur
--                                 applique CET / CEST au jour de la révélation).
--
-- Les défauts reproduisent exactement le comportement J1 : une box existante ne
-- change pas de révélation. Le garde `boxes_auto_programming_guard` n'est pas
-- étendu à ces colonnes (voir la PR) : elles ne commandent pas la génération.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS auto_programming_reveal_mode text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS auto_programming_reveal_dow smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_programming_reveal_time time NOT NULL DEFAULT '18:00';

ALTER TABLE public.boxes DROP CONSTRAINT IF EXISTS boxes_auto_programming_reveal_mode_check;
ALTER TABLE public.boxes ADD CONSTRAINT boxes_auto_programming_reveal_mode_check
  CHECK (auto_programming_reveal_mode IN ('daily','weekly'));

ALTER TABLE public.boxes DROP CONSTRAINT IF EXISTS boxes_auto_programming_reveal_dow_check;
ALTER TABLE public.boxes ADD CONSTRAINT boxes_auto_programming_reveal_dow_check
  CHECK (auto_programming_reveal_dow BETWEEN 0 AND 6);

COMMENT ON COLUMN public.boxes.auto_programming_reveal_mode IS
  'weekly = toutes les cartes de la semaine révélées ensemble (jour auto_programming_reveal_dow précédant le lundi) ; daily = chaque carte le jour de sa séance.';
COMMENT ON COLUMN public.boxes.auto_programming_reveal_dow IS
  'Jour de la révélation hebdomadaire, 0 = dimanche … 6 = samedi ; 1 (lundi) = le lundi de la semaine ciblée elle-même. Ignoré en mode daily.';
COMMENT ON COLUMN public.boxes.auto_programming_reveal_time IS
  'Heure locale Europe/Paris de la révélation ; generate-box-week applique CET / CEST du jour pour écrire box_wods.publish_at en UTC.';
