-- ═════════════════════════════════════════════════════════════════════════════
-- La corde à sauter entre dans trois squelettes Functional de plus.
--
-- Appliquée en prod : OUI, le 18/09/2026 à 20:26:48 UTC (dump db-dumps/2026-09-18/athlex-prod-public-20260918T202555Z.dump avant).
--
-- Additif et rejouable : trois `UPDATE` de `wod_skeletons.definition`, aucune
-- ligne créée ni supprimée, aucune autre table touchée.
--
-- Contexte. `double_under` ne sortait JAMAIS du générateur Functional : mesuré
-- 0 sur 3 000 tirages le 17/09/2026. La cause tient au plafond générique de
-- volume, corrigé dans le moteur (`FAMILY_CAP_FACTOR`, facteur 4 pour
-- `jump_rope`) et non ici. Mais le plafond seul ne suffit pas : seuls deux
-- squelettes offraient en pratique un slot à la corde, tirés 8 % du temps.
--
-- Les trois slots élargis, choisis là où la corde a un sens :
--   interval_work_rest  slot 2  bodyweight mono  → + jump_rope
--   triplet_amrap_mid   slot 2  gym / bodyweight → + jump_rope
--   emom_alternating    slot 3  station bodyweight optionnelle → + jump_rope
--
-- Rien d'autre ne change dans ces définitions : les `UPDATE` sont générés
-- depuis la banque embarquée (`skeletonToRow`), et `seed-sync.test.ts` refuse
-- tout écart entre ce fichier et le snapshot.
--
-- `version` reste à 3, comme l'a fait 20261222 en modifiant la banque Hybrid.
-- Le fait que `BANK_VERSION` ne bouge pas quand la banque change est un écart
-- de convention signalé dans la PR, pas corrigé ici.
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.wod_skeletons SET definition = '{"id":"interval_work_rest","discipline":"functional","format":"interval","durations":[15,20],"intentions":["mixed","cardio","force"],"band_by_intention":{"mixed":"medium","cardio":"light","force":"heavy"},"rest":{"every_s":[180,240]},"rounds":{"min":4,"max":6},"max_work_fraction":0.65,"slots":[{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["barbell","dumbbell"],"pattern_any":["hinge","squat"]},"qty":"range"},{"pick":{"family":["bodyweight","jump_rope"],"pattern_any":["mono"]},"qty":"range"}],"score_type":"time","cap_factor":1.4,"allow_variant_up":false,"stimulus":{"rpe":9,"note":"Chaque intervalle est un sprint, repos complet."}}'::jsonb, version = 3, updated_at = now()
  WHERE id = 'interval_work_rest' AND discipline = 'functional';

UPDATE public.wod_skeletons SET definition = '{"id":"triplet_amrap_mid","discipline":"functional","format":"amrap","durations":[12,15,20],"intentions":["mixed","cardio"],"band_by_intention":{"mixed":"medium","cardio":"light"},"rounds":"amrap","slots":[{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["barbell","dumbbell","kettlebell","wallball"],"pattern_any":["squat","hinge","push_v"]},"qty":"range"},{"pick":{"family":["gym","bodyweight","jump_rope"],"pattern_any":["pull_v","core","mono"],"pattern_not_of_slot":1},"qty":"range"}],"score_type":"rounds_reps","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":7.5,"note":"Tenable 20 min, transitions rapides."}}'::jsonb, version = 3, updated_at = now()
  WHERE id = 'triplet_amrap_mid' AND discipline = 'functional';

UPDATE public.wod_skeletons SET definition = '{"id":"emom_alternating","discipline":"functional","format":"emom","durations":[12,15,20],"intentions":["mixed","gym","force"],"band_by_intention":{"mixed":"medium","gym":"light","force":"heavy"},"rest":{"every_s":60},"station_count":{"by_duration":{"12":3,"15":3,"20":4}},"max_station_work_s":40,"slots":[{"pick":{"family":["barbell"]},"qty":"range"},{"pick":{"family":["gym"]},"qty":"range"},{"pick":{"family":["erg"],"unit":"cal"},"qty":"range"},{"pick":{"family":["bodyweight","jump_rope"]},"qty":"range","optional":true}],"score_type":"reps_total","cap_factor":1.4,"allow_variant_up":true,"stimulus":{"rpe":7,"note":"Chaque station ≤ 40 s de travail, le repos est la consigne."}}'::jsonb, version = 3, updated_at = now()
  WHERE id = 'emom_alternating' AND discipline = 'functional';
