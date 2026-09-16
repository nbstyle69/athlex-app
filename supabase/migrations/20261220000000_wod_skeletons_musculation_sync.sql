-- ═════════════════════════════════════════════════════════════════════════════
-- Générateur Musculation — resynchronisation des squelettes `discipline = 'musculation'`.
--
-- Le seed de 20261215 (commit c2f88b1) est antérieur aux règles M1–M10 (91b3854 :
-- `groups`, `pair`, listes `ids`, rôles) et aux retouches M2 (29dc4b8) : en prod, le
-- moteur lisait 39 squelettes d'une version que les tests n'ont jamais vue (écart
-- constaté par packages/wod-engine/__tests__/seed-sync.test.ts le 16/09/2026).
-- Ce fichier réaligne les 39 lignes sur le snapshot embarqué packages/wod-engine/src/bank/muscu.ts
-- (MUSCU_BANK_VERSION = 2), `definition` exacte.
--
-- GÉNÉRÉ avec les mêmes helpers que packages/wod-engine/scripts/export-bank.ts
-- (muscuSkeletonToRow + JSON.stringify). Contrôlé par seed-sync.test.ts
-- (seed 20261215 + 20261220 = snapshot).
--
-- Appliquée en prod : NON.
--
-- Idempotent : UPDATE par id, valeur cible constante, aucune ligne créée.
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.wod_skeletons SET definition = '{"id":"push_hypertrophie","discipline":"musculation","format":"strength_session","target":"push","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"pecs"},{"role":"secondary_compound","muscle":"epaules"},{"role":"isolation","muscle":"pecs","groups":["fly"]},{"role":"isolation","muscle":"epaules","groups":["raise"]},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'push_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"push_force","discipline":"musculation","format":"strength_session","target":"push","objective":"force","slots":[{"role":"main_compound","muscle":"pecs"},{"role":"main_compound","muscle":"epaules"},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"isolation","muscle":"epaules_post","optional":true,"groups":["fly"]},{"role":"isolation","muscle":"epaules","optional":true,"groups":["raise"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'push_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"push_endurance","discipline":"musculation","format":"strength_session","target":"push","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"pecs"},{"role":"secondary_compound","muscle":"epaules"},{"role":"isolation","muscle":"pecs","groups":["fly"]},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"isolation","muscle":"epaules","optional":true,"groups":["raise"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'push_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"pull_hypertrophie","discipline":"musculation","format":"strength_session","target":"pull","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"dos","groups":["row"]},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"biceps"},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]},{"role":"core","muscle":["tronc","lombaires"],"optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'pull_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"pull_force","discipline":"musculation","format":"strength_session","target":"pull","objective":"force","slots":[{"role":"main_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"dos","groups":["row"]},{"role":"isolation","muscle":"biceps"},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]},{"role":"isolation","muscle":"epaules_post","optional":true,"groups":["fly"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'pull_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"pull_endurance","discipline":"musculation","format":"strength_session","target":"pull","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"dos","groups":["row"]},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"biceps"},{"role":"core","muscle":["tronc","lombaires"],"optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'pull_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"jambes_hypertrophie","discipline":"musculation","format":"strength_session","target":"jambes","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"quadriceps"},{"role":"secondary_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"secondary_compound","muscle":["quadriceps","fessiers"],"unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"quadriceps","pair":true},{"role":"isolation","muscle":"ischios","ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"calves","muscle":"mollets"}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'jambes_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"jambes_force","discipline":"musculation","format":"strength_session","target":"jambes","objective":"force","slots":[{"role":"main_compound","muscle":"quadriceps"},{"role":"main_compound","muscle":["ischios","fessiers"]},{"role":"secondary_compound","muscle":"quadriceps","optional":true,"unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"ischios","optional":true,"ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"calves","muscle":"mollets","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'jambes_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"jambes_endurance","discipline":"musculation","format":"strength_session","target":"jambes","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"quadriceps"},{"role":"secondary_compound","muscle":["ischios","fessiers"]},{"role":"isolation","muscle":["quadriceps","fessiers"],"pair":true},{"role":"calves","muscle":"mollets"},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'jambes_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"bas_hypertrophie","discipline":"musculation","format":"strength_session","target":"bas","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"quadriceps"},{"role":"secondary_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"secondary_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"isolation","muscle":["quadriceps","fessiers"],"pair":true},{"role":"isolation","muscle":"ischios","optional":true,"ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"core","muscle":["tronc","lombaires"],"optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'bas_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"bas_force","discipline":"musculation","format":"strength_session","target":"bas","objective":"force","slots":[{"role":"main_compound","muscle":"quadriceps"},{"role":"secondary_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"secondary_compound","muscle":"fessiers","optional":true,"ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"isolation","muscle":["quadriceps","fessiers"],"pair":true},{"role":"core","muscle":["lombaires","tronc"],"optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'bas_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"bas_endurance","discipline":"musculation","format":"strength_session","target":"bas","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"quadriceps"},{"role":"secondary_compound","muscle":"fessiers"},{"role":"isolation","muscle":["ischios","fessiers"],"pair":true},{"role":"core","muscle":"tronc"},{"role":"calves","muscle":"mollets","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'bas_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"full_body_hypertrophie","discipline":"musculation","format":"strength_session","target":"full_body","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"quadriceps"},{"role":"main_compound","muscle":"pecs"},{"role":"secondary_compound","muscle":"dos"},{"role":"secondary_compound","muscle":["ischios","fessiers"]},{"role":"isolation","muscle":"epaules","optional":true},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'full_body_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"full_body_force","discipline":"musculation","format":"strength_session","target":"full_body","objective":"force","slots":[{"role":"main_compound","muscle":"quadriceps"},{"role":"main_compound","muscle":"pecs"},{"role":"main_compound","muscle":"dos"},{"role":"secondary_compound","muscle":"ischios","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'full_body_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"full_body_endurance","discipline":"musculation","format":"strength_session","target":"full_body","objective":"endurance","slots":[{"role":"secondary_compound","muscle":["quadriceps","fessiers"]},{"role":"secondary_compound","muscle":"pecs"},{"role":"secondary_compound","muscle":"dos"},{"role":"secondary_compound","muscle":["ischios","fessiers"]},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'full_body_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"tronc_hypertrophie","discipline":"musculation","format":"strength_session","target":"tronc","objective":"hypertrophie","slots":[{"role":"core","muscle":"tronc"},{"role":"core","muscle":["obliques","tronc"]},{"role":"core","muscle":"lombaires"},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'tronc_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"tronc_force","discipline":"musculation","format":"strength_session","target":"tronc","objective":"force","slots":[{"role":"core","muscle":"tronc"},{"role":"core","muscle":"obliques"},{"role":"core","muscle":"lombaires"},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'tronc_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"tronc_endurance","discipline":"musculation","format":"strength_session","target":"tronc","objective":"endurance","slots":[{"role":"core","muscle":"tronc","ids":["pallof_press","dead_bug","plank_hold","hollow_hold","ab_wheel","vacuum"]},{"role":"core","muscle":["obliques","tronc"],"ids":["side_plank","db_side_bend","oblique_crunch","hanging_oblique_raise","oblique_bench_raise","rotation_machine","crunch_with_rotation","standing_rotation"]},{"role":"core","muscle":"tronc","ids":["db_farmer_carry","suitcase_carry"]},{"role":"core","muscle":"lombaires"}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'tronc_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"haut_hypertrophie","discipline":"musculation","format":"strength_session","target":"haut","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"pecs"},{"role":"main_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"epaules"},{"role":"isolation","muscle":"biceps"},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"isolation","muscle":"epaules_post","optional":true,"groups":["fly"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'haut_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"haut_force","discipline":"musculation","format":"strength_session","target":"haut","objective":"force","slots":[{"role":"main_compound","muscle":"pecs"},{"role":"main_compound","muscle":"epaules"},{"role":"main_compound","muscle":"dos","groups":["pull_v"]},{"role":"isolation","muscle":"triceps","optional":true,"groups":["triceps_ext"]},{"role":"isolation","muscle":"epaules_post","optional":true,"groups":["fly"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'haut_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"haut_endurance","discipline":"musculation","format":"strength_session","target":"haut","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"pecs"},{"role":"secondary_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"epaules"},{"role":"isolation","muscle":["biceps","triceps"]},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'haut_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"dos_hypertrophie","discipline":"musculation","format":"strength_session","target":"dos","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"dos","groups":["row"]},{"role":"isolation","muscle":"dos","optional":true,"pair":true},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]},{"role":"isolation","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'dos_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"dos_force","discipline":"musculation","format":"strength_session","target":"dos","objective":"force","slots":[{"role":"main_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"dos","groups":["row"]},{"role":"isolation","muscle":"trapezes","groups":["shrug"]},{"role":"isolation","muscle":"epaules_post","optional":true,"groups":["fly"]},{"role":"isolation","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'dos_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"dos_endurance","discipline":"musculation","format":"strength_session","target":"dos","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"dos","groups":["pull_v"]},{"role":"secondary_compound","muscle":"dos","groups":["row"]},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"lombaires"},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'dos_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"epaules_hypertrophie","discipline":"musculation","format":"strength_session","target":"epaules","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"epaules"},{"role":"isolation","muscle":"epaules","groups":["raise"]},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'epaules_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"epaules_force","discipline":"musculation","format":"strength_session","target":"epaules","objective":"force","slots":[{"role":"main_compound","muscle":"epaules"},{"role":"isolation","muscle":"epaules","groups":["raise"]},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'epaules_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"epaules_endurance","discipline":"musculation","format":"strength_session","target":"epaules","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"epaules"},{"role":"isolation","muscle":"epaules","groups":["raise"]},{"role":"isolation","muscle":"epaules_post","groups":["fly"]},{"role":"isolation","muscle":"trapezes","optional":true,"groups":["shrug"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'epaules_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"bras_hypertrophie","discipline":"musculation","format":"strength_session","target":"bras","objective":"hypertrophie","slots":[{"role":"secondary_compound","muscle":"triceps","ids":["close_grip_bench","close_grip_dips","machine_dips","diamond_push_up","dips"]},{"role":"isolation","muscle":"biceps"},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"isolation","muscle":"avant_bras","optional":true,"groups":["carry"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'bras_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"bras_force","discipline":"musculation","format":"strength_session","target":"bras","objective":"force","slots":[{"role":"main_compound","muscle":"triceps","ids":["close_grip_bench","close_grip_dips","machine_dips","diamond_push_up","dips"]},{"role":"isolation","muscle":"biceps"},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'bras_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"bras_endurance","discipline":"musculation","format":"strength_session","target":"bras","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"triceps","ids":["close_grip_bench","close_grip_dips","machine_dips","diamond_push_up","dips"]},{"role":"isolation","muscle":"biceps"},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'bras_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"pecs_hypertrophie","discipline":"musculation","format":"strength_session","target":"pecs","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"pecs"},{"role":"isolation","muscle":"pecs","groups":["fly"]},{"role":"isolation","muscle":"pecs","groups":["pull_v"]},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"core","muscle":"tronc","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'pecs_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"pecs_force","discipline":"musculation","format":"strength_session","target":"pecs","objective":"force","slots":[{"role":"main_compound","muscle":"pecs"},{"role":"isolation","muscle":"pecs","groups":["fly"]},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"isolation","muscle":"pecs","optional":true,"groups":["pull_v"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'pecs_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"pecs_endurance","discipline":"musculation","format":"strength_session","target":"pecs","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"pecs"},{"role":"isolation","muscle":"pecs","groups":["fly"]},{"role":"isolation","muscle":"triceps","groups":["triceps_ext"]},{"role":"isolation","muscle":"pecs","optional":true,"groups":["pull_v"]}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'pecs_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"fessiers_hypertrophie","discipline":"musculation","format":"strength_session","target":"fessiers","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"secondary_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"secondary_compound","muscle":"fessiers","unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"ischios","ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"isolation","muscle":"fessiers","pair":true,"ids":["glute_kickback","cable_pull_through","frog_pump","hip_abduction_machine","cable_hip_abduction","banded_hip_abduction"]},{"role":"core","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'fessiers_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"fessiers_force","discipline":"musculation","format":"strength_session","target":"fessiers","objective":"force","slots":[{"role":"main_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"main_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"secondary_compound","muscle":"fessiers","optional":true,"unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"ischios","optional":true,"ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"core","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'fessiers_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"fessiers_endurance","discipline":"musculation","format":"strength_session","target":"fessiers","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"secondary_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"secondary_compound","muscle":"fessiers","unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"fessiers","pair":true,"ids":["glute_kickback","cable_pull_through","frog_pump","hip_abduction_machine","cable_hip_abduction","banded_hip_abduction"]},{"role":"isolation","muscle":"ischios","optional":true,"ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"core","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'fessiers_endurance' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"fessiers_ischios_hypertrophie","discipline":"musculation","format":"strength_session","target":"fessiers_ischios","objective":"hypertrophie","slots":[{"role":"main_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"main_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"secondary_compound","muscle":["fessiers","ischios"],"unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"ischios","ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"isolation","muscle":"fessiers","pair":true,"ids":["glute_kickback","cable_pull_through","frog_pump","hip_abduction_machine","cable_hip_abduction","banded_hip_abduction"]},{"role":"core","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'fessiers_ischios_hypertrophie' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"fessiers_ischios_force","discipline":"musculation","format":"strength_session","target":"fessiers_ischios","objective":"force","slots":[{"role":"main_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"main_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"secondary_compound","muscle":["fessiers","ischios"],"optional":true,"unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"ischios","optional":true,"ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"core","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'fessiers_ischios_force' AND discipline = 'musculation';

UPDATE public.wod_skeletons SET definition = '{"id":"fessiers_ischios_endurance","discipline":"musculation","format":"strength_session","target":"fessiers_ischios","objective":"endurance","slots":[{"role":"secondary_compound","muscle":"ischios","ids":["romanian_deadlift","db_rdl","good_morning","bodyweight_single_leg_rdl"]},{"role":"secondary_compound","muscle":"fessiers","ids":["hip_thrust","db_hip_thrust","hip_thrust_machine"]},{"role":"secondary_compound","muscle":["fessiers","ischios"],"unilateral":true,"groups":["lunge"]},{"role":"isolation","muscle":"ischios","ids":["leg_curl","nordic_curl","bodyweight_single_leg_rdl"]},{"role":"isolation","muscle":"fessiers","pair":true,"ids":["glute_kickback","cable_pull_through","frog_pump","hip_abduction_machine","cable_hip_abduction","banded_hip_abduction"]},{"role":"core","muscle":"lombaires","optional":true}]}'::jsonb, version = 2, updated_at = now()
  WHERE id = 'fessiers_ischios_endurance' AND discipline = 'musculation';
