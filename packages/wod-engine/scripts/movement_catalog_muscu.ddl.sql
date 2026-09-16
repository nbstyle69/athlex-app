-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur Musculation V1 (M1) — colonnes musculation du catalogue.
--
-- FICHIER GÉNÉRÉ par packages/wod-engine/scripts/import-catalog.cjs depuis
-- packages/wod-engine/catalog/catalogue-musculation-v1.csv
-- (DDL : scripts/movement_catalog_muscu.ddl.sql). Ne pas éditer à la main.
--
-- Appliquée en prod : NON.
--
-- Additif et rejouable :
--   1. `movement_catalog` — familles `machine` / `cable` autorisées, colonnes
--      musculation (brief M1 §3). Les 18 exercices déjà présents dans le
--      catalogue metcon reçoivent les colonnes sur leur ligne (pas de doublon) ;
--      les nouveaux sont créés `active = true`, `weight_functional =
--      weight_hybrid = 0` (jamais tirés en metcon).
--   2. Aucune ligne metcon existante n'est modifiée en dehors des colonnes
--      musculation : `active` (tirage metcon) est conservé tel quel, les 14
--      lignes legacy inactives le restent (Strict Press compris : tirable en
--      musculation via ses colonnes muscu, jamais en metcon).
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.movement_catalog DROP CONSTRAINT IF EXISTS movement_catalog_family_check;
ALTER TABLE public.movement_catalog ADD CONSTRAINT movement_catalog_family_check
  CHECK (family IN ('barbell','dumbbell','kettlebell','gym','bodyweight','erg','run','sled','carry','sandbag','wallball','jump_rope','box','machine','cable','other'));

ALTER TABLE public.movement_catalog
  ADD COLUMN IF NOT EXISTS discipline_muscu  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muscle_primary    text
    CHECK (muscle_primary IS NULL OR muscle_primary IN ('pecs','epaules','epaules_ant','epaules_post','triceps','dos','lombaires','biceps','quadriceps','ischios','fessiers','mollets','tronc','trapezes','avant_bras','obliques','coiffe')),
  ADD COLUMN IF NOT EXISTS muscle_secondary  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compound          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unilateral        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level_min         text CHECK (level_min IS NULL OR level_min IN ('debutant','inter','avance')),
  ADD COLUMN IF NOT EXISTS load_mode         text CHECK (load_mode IS NULL OR load_mode IN ('1rm','rpe','bodyweight')),
  ADD COLUMN IF NOT EXISTS rm_reference      text CHECK (rm_reference IS NULL OR rm_reference IN ('back_squat','deadlift','bench','press','hip_thrust')),
  ADD COLUMN IF NOT EXISTS rm_factor         numeric(4,2) CHECK (rm_factor IS NULL OR rm_factor > 0),
  ADD COLUMN IF NOT EXISTS seconds_per_rep   numeric(4,1) CHECK (seconds_per_rep IS NULL OR seconds_per_rep > 0),
  ADD COLUMN IF NOT EXISTS setup_s           integer CHECK (setup_s IS NULL OR setup_s >= 0),
  ADD COLUMN IF NOT EXISTS objectives        text[] NOT NULL DEFAULT '{}'
    CHECK (objectives <@ ARRAY['hypertrophie','force','endurance']::text[]),
  -- {"hypertrophie":[8,12],"force":[3,5],"endurance":[15,20]} — reps, secondes (gainage) ou mètres (carry)
  ADD COLUMN IF NOT EXISTS rep_ranges_muscu  jsonb,
  ADD COLUMN IF NOT EXISTS weight_bodyweight smallint NOT NULL DEFAULT 0 CHECK (weight_bodyweight BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS weight_box        smallint NOT NULL DEFAULT 0 CHECK (weight_box BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS weight_gym        smallint NOT NULL DEFAULT 0 CHECK (weight_gym BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS muscu_unit        text NOT NULL DEFAULT 'reps' CHECK (muscu_unit IN ('reps','s','m'));

ALTER TABLE public.movement_catalog DROP CONSTRAINT IF EXISTS movement_catalog_muscu_coherent;
ALTER TABLE public.movement_catalog ADD CONSTRAINT movement_catalog_muscu_coherent CHECK (
  NOT discipline_muscu OR (
    muscle_primary IS NOT NULL AND level_min IS NOT NULL AND load_mode IS NOT NULL
    AND seconds_per_rep IS NOT NULL AND setup_s IS NOT NULL
    AND cardinality(objectives) > 0 AND rep_ranges_muscu IS NOT NULL
    AND (load_mode <> '1rm' OR (rm_reference IS NOT NULL AND rm_factor IS NOT NULL))
    AND (weight_bodyweight + weight_box + weight_gym) > 0
  )
);

COMMENT ON COLUMN public.movement_catalog.discipline_muscu IS
  'Tirable par le générateur Musculation (brief M1). Les colonnes muscle_primary … muscu_unit ne sont renseignées que pour ces lignes.';
COMMENT ON COLUMN public.movement_catalog.rep_ranges_muscu IS
  'Plages par objectif : {"hypertrophie":[8,12],"force":[3,5],"endurance":[15,20]} — en reps, secondes (muscu_unit = s) ou mètres (m).';
COMMENT ON COLUMN public.movement_catalog.rm_factor IS
  'Charge = 1RM(rm_reference) × rm_factor × % de l''objectif, arrondi à 2,5 kg (load_mode = 1rm).';

CREATE INDEX IF NOT EXISTS idx_movement_catalog_muscu
  ON public.movement_catalog (muscle_primary) WHERE discipline_muscu;
