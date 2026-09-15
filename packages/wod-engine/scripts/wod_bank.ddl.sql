-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur de WOD v1 — banque de squelettes + plafonds de volume §5.4.
--
-- FICHIER GÉNÉRÉ par packages/wod-engine/scripts/export-bank.ts depuis
-- packages/wod-engine/src/bank (DDL : scripts/wod_bank.ddl.sql).
-- Ne pas éditer à la main : relancer le script.
--
-- Appliquée en prod : NON (dump avant toute application).
--
-- Additif et rejouable :
--   1. `wod_skeletons` — un squelette par ligne, la définition complète
--      (`Skeleton` du package) en jsonb. Le moteur lit les lignes `active`
--      et retombe sur le snapshot embarqué (`BANK_V1`) hors ligne.
--   2. `wod_volume_caps` — la table §5.4 : plafond de volume total par WOD
--      pour une classe de mouvements (`ids` ou `family` + `band`), à la
--      référence RX. Scaled / Inter × 0,7 ; Elite / Pro × 1,3 (facteur du package).
--
-- Lecture : tout utilisateur connecté (le générateur tourne sur l'appareil).
-- Écriture : service_role uniquement (export / back-office signé, PR 3).
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.wod_skeletons (
  id          text PRIMARY KEY,
  discipline  text NOT NULL CHECK (discipline IN ('functional','hybrid')),
  format      text NOT NULL
    CHECK (format IN ('amrap','for_time','rounds_for_time','chipper','emom','interval','ladder','death_by','tabata','stations','continuous')),
  definition  jsonb NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  version     smallint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wod_skeletons_definition_id CHECK (definition->>'id' = id)
);

COMMENT ON TABLE public.wod_skeletons IS
  'Banque de squelettes du générateur de WOD (packages/wod-engine/src/bank). `definition` = Skeleton complet ; snapshot embarqué en repli hors ligne.';

CREATE INDEX IF NOT EXISTS idx_wod_skeletons_active
  ON public.wod_skeletons (discipline, format) WHERE active;

CREATE TABLE IF NOT EXISTS public.wod_volume_caps (
  label       text PRIMARY KEY,
  ids         text[],
  family      text
    CHECK (family IS NULL OR family IN ('barbell','dumbbell','kettlebell','gym','bodyweight','erg','run','sled','carry','sandbag','wallball','jump_rope','box','other')),
  band        text CHECK (band IS NULL OR band IN ('light','medium','heavy')),
  unit        text NOT NULL CHECK (unit IN ('reps','cal','m','s')),
  rx_total    integer NOT NULL CHECK (rx_total > 0),
  active      boolean NOT NULL DEFAULT true,
  version     smallint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wod_volume_caps_class CHECK (
    (ids IS NOT NULL AND cardinality(ids) > 0 AND family IS NULL)
    OR (ids IS NULL AND family IS NOT NULL)
  )
);

COMMENT ON TABLE public.wod_volume_caps IS
  'Plafonds §5.4 du générateur de WOD : volume total par WOD et par classe de mouvements (ids ou family+band), à la référence RX.';

-- ── RLS : lecture authentifiée, écriture service_role ────────────────────────
ALTER TABLE public.wod_skeletons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wod_volume_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wod_skeletons_select_authenticated ON public.wod_skeletons;
CREATE POLICY wod_skeletons_select_authenticated ON public.wod_skeletons
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS wod_volume_caps_select_authenticated ON public.wod_volume_caps;
CREATE POLICY wod_volume_caps_select_authenticated ON public.wod_volume_caps
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON TABLE public.wod_skeletons FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.wod_skeletons TO authenticated;
GRANT ALL ON TABLE public.wod_skeletons TO service_role;

REVOKE ALL ON TABLE public.wod_volume_caps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.wod_volume_caps TO authenticated;
GRANT ALL ON TABLE public.wod_volume_caps TO service_role;
