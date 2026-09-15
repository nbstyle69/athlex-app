-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur de WOD v1 — catalogue de mouvements + historique structuré.
--
-- FICHIER GÉNÉRÉ par packages/wod-engine/scripts/import-catalog.cjs depuis
-- packages/wod-engine/catalog/catalogue-v1.csv (DDL : scripts/movement_catalog.ddl.sql).
-- Ne pas éditer à la main : relancer le script.
--
-- Appliquée en prod : NON (dump avant toute application).
--
-- Additif et rejouable :
--   1. `movement_catalog` — un mouvement par ligne, la source du tirage ET
--      du back-office (PR 3). Les mouvements de l'ancien catalogue app absents
--      du CSV y figurent avec `active = false` (crédit de badges, back-office).
--      `Weighted Vest` n'y est pas : le gilet est un paramètre de génération.
--   2. `generated_wods.wod_json` — le WOD structuré complet (`GeneratedWod`,
--      rounds et signature inclus). Les colonnes texte existantes restent le
--      rendu lisible ; l'anti-répétition lit `wod_json->>'signature'`.
--
-- Lecture : tout utilisateur connecté (le générateur tourne sur l'appareil).
-- Écriture : service_role uniquement (import / back-office signé, PR 3).
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.movement_catalog (
  id                text PRIMARY KEY,
  name              text NOT NULL UNIQUE,
  family            text NOT NULL
    CHECK (family IN ('barbell','dumbbell','kettlebell','gym','bodyweight','erg','run','sled','carry','sandbag','wallball','jump_rope','box','other')),
  pattern           text[] NOT NULL DEFAULT '{}'
    CHECK (pattern <@ ARRAY['squat','hinge','push_v','push_h','pull_v','pull_h','carry','lunge','core','mono']::text[]),
  modality          text NOT NULL CHECK (modality IN ('W','G','M')),
  grip              text NOT NULL CHECK (grip IN ('none','low','high')),
  shoulder_load     text NOT NULL CHECK (shoulder_load IN ('none','low','high')),
  unit_default      text NOT NULL CHECK (unit_default IN ('reps','cal','m','s')),
  units_allowed     text[] NOT NULL DEFAULT '{reps}'
    CHECK (units_allowed <@ ARRAY['reps','cal','m','s']::text[] AND unit_default = ANY (units_allowed)),
  load_unit         text CHECK (load_unit IN ('kg','cm')),
  weight_functional smallint NOT NULL DEFAULT 0 CHECK (weight_functional BETWEEN 0 AND 10),
  weight_hybrid     smallint NOT NULL DEFAULT 0 CHECK (weight_hybrid BETWEEN 0 AND 10),
  equipment         text[] NOT NULL DEFAULT '{}',
  -- { "rx": { "cal": 3.6, "m": 0.2 }, ... } — secondes par unité, par catégorie Functional
  cadence           jsonb,
  -- { "rx": { "light": [43, 30], "medium": [...], "heavy": [...] }, ... } — [H, F]
  loads             jsonb,
  -- { "reps": { "amrap": [9, 15], "for_time": [...], "emom": [...], "interval": [...] }, "m": {...} }
  rep_ranges        jsonb,
  -- { "scaled": "box_step_up", "inter": "..." } — id de remplacement par catégorie
  substitutions     jsonb,
  variant_up        text REFERENCES public.movement_catalog(id),
  badge_key         text,
  active            boolean NOT NULL DEFAULT true,
  version           integer NOT NULL DEFAULT 1,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.movement_catalog IS
  'Catalogue de mouvements du générateur de WOD (catalogue-v1). active=false : mouvement de l''ancien catalogue app, gardé pour les badges et le back-office, jamais tiré.';
COMMENT ON COLUMN public.movement_catalog.badge_key IS
  'Préfixe de badge (mv_*) rempli depuis MOVEMENT_BADGE_PREFIX / CARDIO_BADGE_PREFIX ; null = pas de badge.';
COMMENT ON COLUMN public.movement_catalog.cadence IS
  'Secondes par unité par catégorie Functional puis par unité : {"rx":{"cal":3.6,"m":0.2}}. Hybrid : Women/Men → rx, Pro → rxplus.';
COMMENT ON COLUMN public.movement_catalog.loads IS
  'Charges [H,F] par catégorie Functional et bande light/medium/heavy. Hybrid : Women = rx[F], Men = rx[H], Pro = rxplus.';

CREATE INDEX IF NOT EXISTS idx_movement_catalog_active ON public.movement_catalog (active) WHERE active;
CREATE INDEX IF NOT EXISTS idx_movement_catalog_family ON public.movement_catalog (family);

CREATE OR REPLACE FUNCTION public.movement_catalog_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS movement_catalog_touch_updated_at ON public.movement_catalog;
CREATE TRIGGER movement_catalog_touch_updated_at
  BEFORE UPDATE ON public.movement_catalog
  FOR EACH ROW EXECUTE FUNCTION public.movement_catalog_touch_updated_at();

ALTER TABLE public.movement_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movement_catalog_select_authenticated ON public.movement_catalog;
CREATE POLICY movement_catalog_select_authenticated ON public.movement_catalog
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON TABLE public.movement_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.movement_catalog TO authenticated;
GRANT ALL ON TABLE public.movement_catalog TO service_role;

-- ─── Historique : le WOD structuré à côté du rendu texte ─────────────────────
ALTER TABLE public.generated_wods
  ADD COLUMN IF NOT EXISTS wod_json jsonb;

COMMENT ON COLUMN public.generated_wods.wod_json IS
  'GeneratedWod complet (packages/wod-engine) : blocs, rounds, estimation, signature. Les colonnes texte restent le rendu.';

CREATE INDEX IF NOT EXISTS idx_gen_wods_user_signature
  ON public.generated_wods (user_id, created_at DESC)
  WHERE wod_json IS NOT NULL;
