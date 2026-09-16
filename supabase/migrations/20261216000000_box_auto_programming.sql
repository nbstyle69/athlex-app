-- ═════════════════════════════════════════════════════════════════════════════
-- Programmation automatique de box — J1 : flags, journal, colonnes `box_wods`.
--
-- Appliquée en prod : OUI (16/09/2026 19:41 UTC, dump `20260916T194119Z` dans le bucket privé `db-dumps`).
--
-- Additif et rejouable. Ce lot pose le socle serveur de la fonction edge
-- `generate-box-week` (dimanche 18:00 Europe/Paris, cron DÉSACTIVÉ par défaut,
-- voir docs/RUNBOOK_CRONS.md) :
--
--   boxes.auto_programming          bool   default false  — opt-in par box
--   boxes.auto_programming_tracks   text[] default {}     — 'functional' | 'musculation'
--   box_wods.source                 text   default 'manual' — 'auto' pour les lignes
--                                                            posées par la fonction
--   box_wods.edited_at              timestamptz — posé par trigger dès qu'un
--                                   humain modifie une ligne `auto` (la
--                                   régénération la conserve alors)
--   box_wods.auto_run_id            uuid → box_auto_programming_runs
--   box_auto_programming_runs       journal : une ligne par box × piste ×
--                                   semaine ISO (idempotence, seed,
--                                   regen_counter, statut, erreur, wod_ids)
--
-- `box_programming_runs` (Marketplace, autre schéma) n'est pas réutilisé.
-- La visibilité « tout le monde » demandée par le brief se traduit par
-- `audience = 'all'` + `publish_at` (dimanche 18:00 Paris) : `box_wods` n'a
-- pas de `wod_visibility_mode`.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1. Flags de box ─────────────────────────────────────────────────────────
ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS auto_programming boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_programming_tracks text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.boxes DROP CONSTRAINT IF EXISTS boxes_auto_programming_tracks_check;
ALTER TABLE public.boxes ADD CONSTRAINT boxes_auto_programming_tracks_check
  CHECK (auto_programming_tracks <@ ARRAY['functional','musculation']::text[]);

COMMENT ON COLUMN public.boxes.auto_programming IS
  'Programmation automatique hebdomadaire (fonction edge generate-box-week). false = rien n''est généré pour cette box.';
COMMENT ON COLUMN public.boxes.auto_programming_tracks IS
  'Pistes générées quand auto_programming est vrai : functional (séance A/B/C 60 min, lun→sam) et/ou musculation (5 séances, lun/mar/jeu/ven/sam).';

-- L'interrupteur est réservé à l'administration de la plateforme (J2, Manager
-- super-admin) et au backend : un gérant ou co-gérant, qui peut par ailleurs
-- modifier sa box (`boxes_owner_write`, `boxes_coowner_manage`), est refusé
-- s'il touche à l'un des deux flags.
CREATE OR REPLACE FUNCTION public.trg_boxes_auto_programming_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (NEW.auto_programming IS DISTINCT FROM OLD.auto_programming
      OR NEW.auto_programming_tracks IS DISTINCT FROM OLD.auto_programming_tracks)
     AND NOT public.request_is_backend()
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role IN ('admin','super_admin')
     )
  THEN
    RAISE EXCEPTION 'Accès refusé : programmation automatique réservée à un administrateur'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.trg_boxes_auto_programming_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS boxes_auto_programming_guard ON public.boxes;
CREATE TRIGGER boxes_auto_programming_guard
  BEFORE UPDATE OF auto_programming, auto_programming_tracks ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.trg_boxes_auto_programming_guard();

-- ─── 2. Journal des runs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.box_auto_programming_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id            uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  track             text NOT NULL CHECK (track IN ('functional','musculation')),
  iso_year          integer NOT NULL,
  iso_week          integer NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  generator_version text NOT NULL,
  seed              bigint NOT NULL,
  regen_counter     integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','error','skipped')),
  error             text,
  wod_ids           uuid[] NOT NULL DEFAULT '{}'::uuid[],
  signatures        text[] NOT NULL DEFAULT '{}'::text[],
  relaxations       text[] NOT NULL DEFAULT '{}'::text[],
  generated_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (box_id, track, iso_year, iso_week)
);

COMMENT ON TABLE public.box_auto_programming_runs IS
  'Journal de generate-box-week : une ligne par box × piste × semaine ISO. La clé unique porte l''idempotence ; regen_counter change le seed à la régénération.';

CREATE INDEX IF NOT EXISTS idx_box_auto_programming_runs_box
  ON public.box_auto_programming_runs (box_id, iso_year DESC, iso_week DESC);

CREATE OR REPLACE FUNCTION public.trg_box_auto_programming_runs_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS box_auto_programming_runs_touch ON public.box_auto_programming_runs;
CREATE TRIGGER box_auto_programming_runs_touch
  BEFORE UPDATE ON public.box_auto_programming_runs
  FOR EACH ROW EXECUTE FUNCTION public.trg_box_auto_programming_runs_touch();

ALTER TABLE public.box_auto_programming_runs ENABLE ROW LEVEL SECURITY;

-- Lecture : gérant / co-gérant / admin de la box. Écriture : service_role seul
-- (la fonction edge) — aucune policy d'écriture pour authenticated.
DROP POLICY IF EXISTS box_auto_programming_runs_select ON public.box_auto_programming_runs;
CREATE POLICY box_auto_programming_runs_select ON public.box_auto_programming_runs
  FOR SELECT TO authenticated
  USING (public.is_box_owner_admin(box_id));

REVOKE ALL ON TABLE public.box_auto_programming_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.box_auto_programming_runs TO authenticated;
GRANT ALL ON TABLE public.box_auto_programming_runs TO service_role;

-- ─── 3. Colonnes `box_wods` ──────────────────────────────────────────────────
ALTER TABLE public.box_wods
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_run_id uuid REFERENCES public.box_auto_programming_runs(id) ON DELETE SET NULL;

ALTER TABLE public.box_wods DROP CONSTRAINT IF EXISTS box_wods_source_check;
ALTER TABLE public.box_wods ADD CONSTRAINT box_wods_source_check
  CHECK (source IN ('manual','auto'));

COMMENT ON COLUMN public.box_wods.source IS
  'manual = saisi par un humain (éditeur, import, Marketplace, app) ; auto = posé par generate-box-week.';
COMMENT ON COLUMN public.box_wods.edited_at IS
  'Première modification humaine d''une ligne auto (trigger). Une ligne auto éditée ou scorée n''est jamais remplacée par une régénération.';

CREATE INDEX IF NOT EXISTS idx_box_wods_auto_run ON public.box_wods (auto_run_id) WHERE auto_run_id IS NOT NULL;

-- Toute modification d'une ligne `auto` qui ne vient pas du backend (service_role,
-- cron, migration) marque `edited_at`. Le contenu seul compte : un simple
-- changement de `publish_at`/`is_published` par la box vaut aussi édition (elle a
-- pris la main sur le jour).
CREATE OR REPLACE FUNCTION public.trg_box_wods_mark_edited()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.source = 'auto' AND NEW.edited_at IS NULL AND NOT public.request_is_backend() THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS box_wods_mark_edited ON public.box_wods;
CREATE TRIGGER box_wods_mark_edited
  BEFORE UPDATE ON public.box_wods
  FOR EACH ROW
  WHEN (OLD.source = 'auto')
  EXECUTE FUNCTION public.trg_box_wods_mark_edited();

REVOKE ALL ON FUNCTION public.trg_box_wods_mark_edited() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_box_auto_programming_runs_touch() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
