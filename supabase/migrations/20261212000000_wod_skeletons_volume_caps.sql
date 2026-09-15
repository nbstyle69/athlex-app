-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur de WOD v1 — banque de squelettes + plafonds de volume §5.4.
--
-- FICHIER GÉNÉRÉ par packages/wod-engine/scripts/export-bank.ts depuis
-- packages/wod-engine/src/bank (DDL : scripts/wod_bank.ddl.sql).
-- Ne pas éditer à la main : relancer le script.
--
-- Appliquée en prod : OUI (15/09/2026, dump `20260915T125815Z` dans le bucket privé `db-dumps`).
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

-- ── Seed : banque v3 (25 squelettes, généré par packages/wod-engine/scripts/export-bank.ts) ──
INSERT INTO public.wod_skeletons (id, discipline, format, definition, active, version)
VALUES
  ('couplet_for_time_21_15_9', 'functional', 'for_time', '{"id":"couplet_for_time_21_15_9","discipline":"functional","format":"for_time","durations":[8,12],"intentions":["mixed","gym","force"],"band_by_intention":{"mixed":"medium","force":"heavy","gym":"light"},"scheme":[21,15,9],"scheme_by_band":{"heavy":[9,7,5]},"rounds":"scheme","slots":[{"pick":{"family":["barbell","dumbbell"],"pattern_any":["squat","hinge","push_v"]},"qty":"scheme"},{"pick":{"family":["gym"],"pattern_any":["pull_v","push_v","core"],"pattern_not_of_slot":0},"qty":"scheme"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":9,"note":"Sprint, sets courts dès le round 1."}}'::jsonb, true, 3),
  ('couplet_amrap_short', 'functional', 'amrap', '{"id":"couplet_amrap_short","discipline":"functional","format":"amrap","durations":[8,12],"intentions":["mixed","cardio","gym"],"band_by_intention":{"mixed":"medium","cardio":"light","gym":"light"},"rounds":"amrap","slots":[{"pick":{"modality":["W","M"],"pattern_any":["squat","hinge","push_v","mono"]},"qty":"range"},{"pick":{"modality":["G","M"],"pattern_not_of_slot":0},"qty":"range"}],"score_type":"rounds_reps","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Allure constante, pas de set cassé avant la mi-temps."}}'::jsonb, true, 3),
  ('triplet_amrap_mid', 'functional', 'amrap', '{"id":"triplet_amrap_mid","discipline":"functional","format":"amrap","durations":[12,15,20],"intentions":["mixed","cardio"],"band_by_intention":{"mixed":"medium","cardio":"light"},"rounds":"amrap","slots":[{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["barbell","dumbbell","kettlebell","wallball"],"pattern_any":["squat","hinge","push_v"]},"qty":"range"},{"pick":{"family":["gym","bodyweight"],"pattern_any":["pull_v","core","mono"],"pattern_not_of_slot":1},"qty":"range"}],"score_type":"rounds_reps","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":7.5,"note":"Tenable 20 min, transitions rapides."}}'::jsonb, true, 3),
  ('triplet_rounds_for_time', 'functional', 'rounds_for_time', '{"id":"triplet_rounds_for_time","discipline":"functional","format":"rounds_for_time","durations":[12,15,20],"intentions":["mixed","force"],"band_by_intention":{"mixed":"medium","force":"heavy"},"rounds":{"min":3,"max":5},"max_rounds_by_band":{"heavy":4},"slots":[{"pick":{"family":["barbell"],"pattern_any":["hinge","squat"]},"qty":"range"},{"pick":{"family":["erg","box","jump_rope"]},"qty":"range"},{"pick":{"family":["gym"],"pattern_any":["pull_v","push_v"],"no_shared_high_grip_with":0},"qty":"range"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":8,"note":"Rounds réguliers, la barre ne se pose pas avant la fin du set."}}'::jsonb, true, 3),
  ('chipper_descending', 'functional', 'chipper', '{"id":"chipper_descending","discipline":"functional","format":"chipper","durations":[15,20],"intentions":["mixed","cardio"],"band_by_intention":{"mixed":"medium","cardio":"light"},"scheme":[50,40,30,20,10],"rounds":"scheme","barbell_low_scheme":true,"slots":[{"pick":{"family":["erg"],"unit":"cal"},"qty":"scheme"},{"pick":{"family":["box","jump_rope"]},"qty":"scheme"},{"pick":{"family":["kettlebell","dumbbell","wallball"]},"qty":"scheme"},{"pick":{"family":["barbell"],"band":"light"},"qty":"scheme"},{"pick":{"family":["bodyweight"],"pattern_any":["core","mono"]},"qty":"scheme"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":7.5,"note":"Gestion, pas de sprint avant le dernier tiers."}}'::jsonb, true, 3),
  ('chipper_stations_erg', 'functional', 'chipper', '{"id":"chipper_stations_erg","discipline":"functional","format":"chipper","durations":[20,30],"intentions":["mixed","cardio"],"band_by_intention":{"mixed":"medium","cardio":"light"},"rounds":{"min":1,"max":1},"slots":[{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["sled","carry","sandbag"],"unit":"m"},"qty":"range"},{"pick":{"family":["erg"],"unit":"cal"},"qty":"range","role":"erg différent du (1)"},{"pick":{"family":["kettlebell","dumbbell","wallball"]},"qty":"range"},{"pick":{"family":["run"],"unit":"m"},"qty":"range","qty_max":800},{"pick":{"family":["bodyweight","gym"],"pattern_any":["core","pull_v","push_v"]},"qty":"range"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":7,"note":"Stations enchaînées, ergs à 85 %."}}'::jsonb, true, 3),
  ('emom_alternating', 'functional', 'emom', '{"id":"emom_alternating","discipline":"functional","format":"emom","durations":[12,15,20],"intentions":["mixed","gym","force"],"band_by_intention":{"mixed":"medium","gym":"light","force":"heavy"},"rest":{"every_s":60},"station_count":{"by_duration":{"12":3,"15":3,"20":4}},"max_station_work_s":40,"slots":[{"pick":{"family":["barbell"]},"qty":"range"},{"pick":{"family":["gym"]},"qty":"range"},{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["bodyweight"]},"qty":"range","optional":true}],"score_type":"reps_total","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":7,"note":"Chaque station ≤ 40 s de travail, le repos est la consigne."}}'::jsonb, true, 3),
  ('interval_work_rest', 'functional', 'interval', '{"id":"interval_work_rest","discipline":"functional","format":"interval","durations":[15,20],"intentions":["mixed","cardio","force"],"band_by_intention":{"mixed":"medium","cardio":"light","force":"heavy"},"rest":{"every_s":[180,240]},"rounds":{"min":4,"max":6},"max_work_fraction":0.65,"slots":[{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["barbell","dumbbell"],"pattern_any":["hinge","squat"]},"qty":"range"},{"pick":{"family":["bodyweight"],"pattern_any":["mono"]},"qty":"range"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":9,"note":"Chaque intervalle est un sprint, repos complet."}}'::jsonb, true, 3),
  ('ladder_ascending', 'functional', 'ladder', '{"id":"ladder_ascending","discipline":"functional","format":"ladder","durations":[10,15],"intentions":["mixed","gym"],"band_by_intention":{"mixed":"medium","gym":"light"},"scheme":[3,6,9],"rounds":"scheme","slots":[{"pick":{"family":["barbell","dumbbell"],"pattern_any":["squat","push_v","hinge"]},"qty":"scheme"},{"pick":{"family":["gym"],"pattern_any":["pull_v","core"],"pattern_not_of_slot":0},"qty":"scheme"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":8,"note":"Les premiers paliers se font sans poser la barre."}}'::jsonb, true, 3),
  ('death_by', 'functional', 'death_by', '{"id":"death_by","discipline":"functional","format":"death_by","durations":[10,15],"intentions":["mixed","force"],"band_by_intention":{"mixed":"medium","force":"heavy"},"rest":{"every_s":60},"slots":[{"pick":{"modality":["M"],"pattern_any":["mono"],"unit":"cal"},"qty":"fixed","fixed":5,"optional":true,"role":"buy-in"},{"pick":{"family":["barbell"],"pattern_any":["hinge","squat","push_v"]},"qty":"minute"}],"score_type":"reps_total","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":9,"note":"S''arrête quand la minute n''est plus tenue."}}'::jsonb, true, 3),
  ('tabata_pair', 'functional', 'tabata', '{"id":"tabata_pair","discipline":"functional","format":"tabata","durations":[8,10],"intentions":["cardio","gym"],"band_by_intention":{"cardio":"light","gym":"light"},"rest":{"work_s":20,"rest_s":10},"rounds":{"min":8,"max":8},"slots":[{"pick":{"family":["bodyweight","erg"]},"qty":"range"},{"pick":{"family":["bodyweight","gym"],"pattern_not_of_slot":0},"qty":"range"}],"score_type":"reps_total","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Score = somme des reps min de chaque bloc."}}'::jsonb, true, 3),
  ('heavy_couplet', 'functional', 'rounds_for_time', '{"id":"heavy_couplet","discipline":"functional","format":"rounds_for_time","durations":[10,15],"intentions":["force"],"band_by_intention":{"force":"heavy"},"rounds":{"min":5,"max":7},"slots":[{"pick":{"family":["barbell"],"pattern_any":["hinge","squat","push_v"]},"qty":"range","reps_range":[3,5]},{"pick":{"modality":["M"],"pattern_any":["mono"],"family":["erg","run","jump_rope"]},"qty":"range"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Charge lourde, sets non cassés, le mono sert de récupération active."}}'::jsonb, true, 3),
  ('engine_long_amrap', 'functional', 'amrap', '{"id":"engine_long_amrap","discipline":"functional","format":"amrap","durations":[20,30],"intentions":["cardio"],"band_by_intention":{"cardio":"light"},"rounds":"amrap","slots":[{"pick":{"family":["erg","run"]},"qty":"range"},{"pick":{"family":["bodyweight","gym"],"pattern_any":["mono","core","pull_v","push_v"]},"qty":"range"},{"pick":{"family":["kettlebell","wallball","dumbbell"],"band":"light"},"qty":"range"},{"pick":{"family":["erg","run"]},"qty":"range","role":"erg différent du (1) ou run"}],"score_type":"rounds_reps","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":6.5,"note":"Zone 3, respiration contrôlée du début à la fin."}}'::jsonb, true, 3),
  ('gym_density', 'functional', 'emom', '{"id":"gym_density","discipline":"functional","format":"emom","durations":[10,15],"intentions":["gym"],"band_by_intention":{"gym":"light"},"rest":{"every_s":90},"max_station_work_s":60,"slots":[{"pick":{"family":["gym"],"pattern_any":["pull_v","push_v"]},"qty":"range","reps_range":[5,12]},{"pick":{"ids":["hollow_rock","ghd_sit_up","plank_hold","toes_to_bar"],"no_shared_high_grip_with":0},"qty":"range"}],"score_type":"reps_total","cap_factor":1,"allow_variant_up":true,"stimulus":{"rpe":6.5,"note":"Technique, aucun échec musculaire."}}'::jsonb, true, 3),
  ('stations_rotation', 'functional', 'stations', '{"id":"stations_rotation","discipline":"functional","format":"stations","durations":[20,30],"intentions":["mixed","cardio"],"band_by_intention":{"mixed":"medium","cardio":"light"},"rest":{"work_s":[60,90],"rest_s":[15,30]},"rounds":{"min":2,"max":4},"station_count":{"min":4,"max":5},"no_consecutive_erg":true,"slots":[{"pick":{"family":["erg","run"]},"qty":"range"},{"pick":{"family":["kettlebell","dumbbell","wallball","sandbag","sled","box"]},"qty":"range"},{"pick":{"family":["erg","run"]},"qty":"range","role":"erg différent du (1)"},{"pick":{"family":["kettlebell","dumbbell","wallball","sandbag","sled","box"],"pattern_not_of_slot":1},"qty":"range"},{"pick":{"family":["kettlebell","dumbbell","wallball","sandbag","sled","box","bodyweight","gym"],"pattern_not_of_slot":3},"qty":"range","optional":true}],"score_type":"reps_total","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Max effort sur chaque station, repos incomplet voulu."}}'::jsonb, true, 3),
  ('run_into_station', 'hybrid', 'rounds_for_time', '{"id":"run_into_station","discipline":"hybrid","format":"rounds_for_time","durations":[20,30,45],"intentions":["interval","engine","run"],"band_by_intention":{"interval":"medium","engine":"light","run":"light"},"rounds":{"min":4,"max":6},"slots":[{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed_range":[400,800]},{"pick":{"ids":["sled_push","sled_pull","sandbag_lunge","db_farmer_carry","wall_ball","burpee_broad_jump","ski_erg","row"],"erg_unit":"m"},"qty":"range","rotate_per_round":true}],"score_type":"time","cap_factor":1.25,"allow_variant_up":false,"stimulus":{"rpe":8.5,"note":"Allure course à 90 % du 5 km, stations sans pause."}}'::jsonb, true, 3),
  ('stations_interval', 'hybrid', 'stations', '{"id":"stations_interval","discipline":"hybrid","format":"stations","durations":[20,30],"intentions":["interval"],"band_by_intention":{"interval":"medium"},"rest":{"work_s":90,"rest_s":30},"rounds":{"min":2,"max":3},"station_count":{"min":4,"max":5},"no_consecutive_erg":true,"slots":[{"pick":{"ids":["ski_erg","row","bike_erg","wall_ball","burpee_broad_jump","sandbag_lunge","sled_push","db_farmer_carry","kb_swing_russian"],"erg_unit":"cal"},"qty":"range"},{"pick":{"ids":["ski_erg","row","bike_erg","wall_ball","burpee_broad_jump","sandbag_lunge","sled_push","db_farmer_carry","kb_swing_russian"],"erg_unit":"cal","pattern_not_of_slot":0},"qty":"range"},{"pick":{"ids":["ski_erg","row","bike_erg","wall_ball","burpee_broad_jump","sandbag_lunge","sled_push","db_farmer_carry","kb_swing_russian"],"erg_unit":"cal","pattern_not_of_slot":1},"qty":"range"},{"pick":{"ids":["ski_erg","row","bike_erg","wall_ball","burpee_broad_jump","sandbag_lunge","sled_push","db_farmer_carry","kb_swing_russian"],"erg_unit":"cal","pattern_not_of_slot":2},"qty":"range"},{"pick":{"ids":["ski_erg","row","bike_erg","wall_ball","burpee_broad_jump","sandbag_lunge","sled_push","db_farmer_carry","kb_swing_russian"],"erg_unit":"cal","pattern_not_of_slot":3},"qty":"range","optional":true}],"score_type":"reps_total","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":8.5,"note":"Alternance jambes / épaules / mono, 90 s de travail max effort."}}'::jsonb, true, 3),
  ('amrap_distances', 'hybrid', 'amrap', '{"id":"amrap_distances","discipline":"hybrid","format":"amrap","durations":[15,20],"intentions":["interval","engine"],"band_by_intention":{"interval":"medium","engine":"light"},"rounds":"amrap","slots":[{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed_range":[200,400]},{"pick":{"ids":["sled_push","sled_pull"],"unit":"m"},"qty":"fixed","fixed_range":[25,50]},{"pick":{"ids":["wall_ball","sandbag_lunge"]},"qty":"range"},{"pick":{"family":["erg"],"unit":"cal"},"qty":"fixed","fixed_range":[10,20]}],"score_type":"rounds_reps","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Allure constante, chaque round dans les 15 s du précédent."}}'::jsonb, true, 3),
  ('erg_pyramid', 'hybrid', 'for_time', '{"id":"erg_pyramid","discipline":"hybrid","format":"for_time","durations":[20,30],"intentions":["engine","aerobic"],"band_by_intention":{"engine":"light","aerobic":"light"},"scheme":[250,500,750,500,250],"rounds":"scheme","slots":[{"pick":{"ids":["row","ski_erg","bike_erg"],"unit":"m"},"qty":"scheme"},{"pick":{"ids":["sandbag_lunge","walking_lunge","db_farmer_carry","burpee_broad_jump"]},"qty":"fixed","fixed_by_id":{"sandbag_lunge":20,"walking_lunge":20,"db_farmer_carry":50,"burpee_broad_jump":10},"role":"entre chaque palier"}],"score_type":"time","cap_factor":1.25,"allow_variant_up":false,"stimulus":{"rpe":7,"note":"Pyramide à allure régulière, la station courte relance sans casser le rythme."}}'::jsonb, true, 3),
  ('sled_repeats', 'hybrid', 'interval', '{"id":"sled_repeats","discipline":"hybrid","format":"interval","durations":[15,20],"intentions":["force","interval"],"band_by_intention":{"force":"heavy","interval":"heavy"},"rest":{"every_s":180},"rounds":{"min":5,"max":7},"max_work_fraction":0.75,"slots":[{"pick":{"ids":["sled_push"],"unit":"m"},"qty":"fixed","fixed_range":[25,30]},{"pick":{"ids":["sled_pull","sandbag_carry"],"unit":"m"},"qty":"fixed","fixed_by_id":{"sled_pull":25,"sandbag_carry":50}},{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed_range":[100,200]}],"score_type":"time","cap_factor":1.25,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Lourd et court, repos réel entre les tours."}}'::jsonb, true, 3),
  ('compromised_run', 'hybrid', 'rounds_for_time', '{"id":"compromised_run","discipline":"hybrid","format":"rounds_for_time","durations":[20,30],"intentions":["interval","run"],"band_by_intention":{"interval":"medium","run":"medium"},"rounds":{"min":3,"max":4},"slots":[{"pick":{"ids":["sled_push","sandbag_lunge","wall_ball","db_farmer_carry"]},"qty":"range","role":"station lourde 60-90 s"},{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed_range":[600,1000]}],"score_type":"time","cap_factor":1.25,"allow_variant_up":false,"stimulus":{"rpe":8,"note":"Courir vite sur des jambes fatiguées : allure 5 km + 15 s/km."}}'::jsonb, true, 3),
  ('half_sim', 'hybrid', 'rounds_for_time', '{"id":"half_sim","discipline":"hybrid","format":"rounds_for_time","durations":[15,20],"intentions":["interval"],"band_by_intention":{"interval":"medium"},"rounds":{"min":4,"max":4},"slots":[],"variants":[{"id":"A","slots":[{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed_range":[500,800]},{"pick":{"ids":["ski_erg","sled_push","sled_pull","burpee_broad_jump"],"erg_unit":"m"},"qty":"fixed","fixed_by_id":{"ski_erg":500,"sled_push":25,"sled_pull":25,"burpee_broad_jump":40},"rotate_per_round":true,"role":"une station différente par round"}]},{"id":"B","slots":[{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed_range":[500,800]},{"pick":{"ids":["row","db_farmer_carry","sandbag_lunge","wall_ball"],"erg_unit":"m"},"qty":"fixed","fixed_by_id":{"row":500,"db_farmer_carry":100,"sandbag_lunge":50,"wall_ball":50},"rotate_per_round":true,"role":"une station différente par round"}]}],"score_type":"time","cap_factor":1.2,"allow_variant_up":false,"stimulus":{"rpe":9,"note":"Demi-course, gérer comme un jour de compétition."}}'::jsonb, true, 3),
  ('engine_continuous', 'hybrid', 'continuous', '{"id":"engine_continuous","discipline":"hybrid","format":"continuous","durations":[20,30,45],"intentions":["aerobic"],"band_by_intention":{"aerobic":"light"},"rounds":{"min":1,"max":6},"slots":[{"pick":{"ids":["row","ski_erg"],"unit":"m"},"qty":"fixed","fixed":500},{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed":400},{"pick":{"ids":["bike_erg"],"unit":"m"},"qty":"fixed","fixed":1000},{"pick":{"ids":["sandbag_carry","db_farmer_carry"],"unit":"m"},"qty":"fixed","fixed":200,"optional":true}],"station_count":{"min":3,"max":4},"score_type":"distance","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":6,"note":"Zone 3, conversation difficile mais possible. Rotation sans repos jusqu''au budget."}}'::jsonb, true, 3),
  ('core_carry_finisher', 'hybrid', 'rounds_for_time', '{"id":"core_carry_finisher","discipline":"hybrid","format":"rounds_for_time","durations":[10,15,20],"intentions":["core"],"band_by_intention":{"core":"light"},"rounds":{"min":3,"max":6},"slots":[{"pick":{"ids":["db_farmer_carry","sandbag_carry"],"unit":"m"},"qty":"fixed","fixed_range":[50,100]},{"pick":{"ids":["hollow_rock","plank_hold","sit_up","ghd_sit_up"]},"qty":"range"},{"pick":{"family":["erg","run"],"pattern_any":["mono"],"erg_unit":"cal"},"qty":"range","optional":true,"role":"mono"}],"score_type":"time","cap_factor":1.25,"allow_variant_up":false,"stimulus":{"rpe":6,"note":"Posture et gainage, jamais à l''échec."}}'::jsonb, true, 3),
  ('run_intervals', 'hybrid', 'interval', '{"id":"run_intervals","discipline":"hybrid","format":"interval","durations":[10,15,20],"intentions":["run"],"band_by_intention":{"run":"light"},"slots":[],"variants":[{"id":"A","slots":[{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed":400}],"rounds":{"min":4,"max":8},"rest":{"rest_s":60}},{"id":"B","slots":[{"pick":{"ids":["run"],"unit":"m"},"qty":"fixed","fixed":800}],"rounds":{"min":2,"max":5},"rest":{"rest_s":90}},{"id":"C","slots":[{"pick":{"ids":["shuttle_run"],"unit":"m"},"qty":"fixed","fixed":200}],"rounds":{"min":6,"max":12},"rest":{"rest_s":45}}],"score_type":"time","cap_factor":1,"allow_variant_up":false,"stimulus":{"rpe":8.5,"note":"Allure 5 km ou plus vite, régularité entre répétitions."}}'::jsonb, true, 3)
ON CONFLICT (id) DO UPDATE SET
  discipline = EXCLUDED.discipline, format = EXCLUDED.format, definition = EXCLUDED.definition,
  active = EXCLUDED.active, version = EXCLUDED.version, updated_at = now();

-- ── Seed : plafonds §5.4 (19 classes) ──
INSERT INTO public.wod_volume_caps (label, ids, family, band, unit, rx_total, active, version)
VALUES
  ('HSPU', ARRAY['handstand_push_up']::text[], NULL, NULL, 'reps', 45, true, 3),
  ('strict HSPU', ARRAY['strict_handstand_push_up']::text[], NULL, NULL, 'reps', 20, true, 3),
  ('C2B', ARRAY['chest_to_bar']::text[], NULL, NULL, 'reps', 60, true, 3),
  ('pull-ups', ARRAY['pull_up']::text[], NULL, NULL, 'reps', 75, true, 3),
  ('T2B', ARRAY['toes_to_bar']::text[], NULL, NULL, 'reps', 60, true, 3),
  ('BMU', ARRAY['bar_muscle_up']::text[], NULL, NULL, 'reps', 20, true, 3),
  ('RMU', ARRAY['ring_muscle_up']::text[], NULL, NULL, 'reps', 15, true, 3),
  ('rope climb', ARRAY['rope_climb', 'legless_rope_climb']::text[], NULL, NULL, 'reps', 8, true, 3),
  ('wall walk', ARRAY['wall_walk']::text[], NULL, NULL, 'reps', 12, true, 3),
  ('HS walk', ARRAY['handstand_walk']::text[], NULL, NULL, 'm', 60, true, 3),
  ('barre heavy', NULL, 'barbell', 'heavy', 'reps', 25, true, 3),
  ('barre medium', NULL, 'barbell', 'medium', 'reps', 60, true, 3),
  ('barre light', NULL, 'barbell', 'light', 'reps', 90, true, 3),
  ('wall balls', ARRAY['wall_ball']::text[], NULL, NULL, 'reps', 150, true, 3),
  ('devil press', ARRAY['devil_press']::text[], NULL, NULL, 'reps', 30, true, 3),
  ('burpee box jump over', ARRAY['burpee_box_jump_over']::text[], NULL, NULL, 'reps', 40, true, 3),
  ('box jump over', ARRAY['box_jump_over']::text[], NULL, NULL, 'reps', 60, true, 3),
  ('DB snatch', ARRAY['db_snatch']::text[], NULL, NULL, 'reps', 60, true, 3),
  ('burpees', ARRAY['burpee', 'bar_facing_burpee', 'burpee_over_the_bar', 'burpee_box_jump']::text[], NULL, NULL, 'reps', 60, true, 3)
ON CONFLICT (label) DO UPDATE SET
  ids = EXCLUDED.ids, family = EXCLUDED.family, band = EXCLUDED.band, unit = EXCLUDED.unit,
  rx_total = EXCLUDED.rx_total, active = EXCLUDED.active, version = EXCLUDED.version, updated_at = now();
