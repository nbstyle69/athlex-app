-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur de WOD v1 — PR 3 (Manager) : WOD structuré à côté du rendu texte
-- sur les WODs du Whiteboard.
--
-- Appliquée en prod : NON (dump avant toute application).
--
-- Additif et rejouable : `box_wods.wod_json` reçoit le WOD structuré écrit par
-- l'éditeur du Manager (et, plus tard, par « Ajouter au Whiteboard » de l'app).
-- `description` reste la source de vérité côté athlète tant qu'aucun écran ne
-- lit la colonne ; le Manager écrit derrière un garde (retry sans la colonne sur
-- 42703 / PGRST204) pour que l'ordre merge / application n'ait pas d'importance.
-- Aucune policy ni grant à ajouter : la colonne suit ceux de `box_wods`.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.box_wods
  ADD COLUMN IF NOT EXISTS wod_json jsonb;

COMMENT ON COLUMN public.box_wods.wod_json IS
  'WOD structuré ({version, source, format, movements[], …}) écrit par l''éditeur du Manager ; description reste le rendu lisible et la source de vérité athlète.';
