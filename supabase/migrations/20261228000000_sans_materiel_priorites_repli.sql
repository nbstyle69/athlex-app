-- ═════════════════════════════════════════════════════════════════════════════
-- Les 55 exercices sans matériel sont des replis en Box et en Salle.
--
-- Appliquée en prod : OUI, le 18/09/2026 à 20:26:49 UTC (dump db-dumps/2026-09-18/athlex-prod-public-20260918T202555Z.dump avant).
--
-- Additif et rejouable : trois UPDATE sur des lignes existantes, aucune ligne
-- créée ni supprimée. Suite de 20261227.
--
-- Relecture de l'échantillon (Nab, 18/09/2026) : « Tirage élastique un bras »
-- sortait en exercice principal du Pull d'une box qui a un rig, des barres et
-- des haltères, et « Single-Leg RDL au poids du corps » en principal des
-- Fessiers & ischios. Les 55 ajouts avaient reçu leur priorité authored (1 à 5)
-- dans TOUS les modes ; ce sont des replis, pas des premiers choix :
--
--   1. `priority` des 55 : 4 pour les deux meilleures options authored d'un
--      geste, 5 pour les autres — derrière tout mouvement chargé en Box / Salle.
--   2. `priority_bodyweight` recalculé pour tout le catalogue sans matériel :
--      rang dense par (muscle × geste × rôle) sur l'ordre AUTHORED des 55
--      (posé ici) et sur `priority` pour les autres, plafonné à 3 — même
--      COALESCE que le snapshot embarqué. L'ordre sans matériel ne bouge pas.
--   3. « Écartés à l'élastique » se lit comme un écarté de pecs ; le mouvement
--      modélisé est le pull-apart (arrière d'épaule) : renommé.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1 + 3. Priorité de repli et ordre authored des 55, nom du pull-apart.
UPDATE public.movement_catalog AS m
   SET priority = v.priority,
       priority_bodyweight = v.authored,
       name = v.name,
       updated_at = now()
  FROM (VALUES
  ('pike_push_up_elevated', 4, 1, 'Pike Push-Ups surélevées'),
  ('hindu_push_up', 5, 2, 'Pompes Hindu'),
  ('handstand_hold', 5, 3, 'Handstand Hold'),
  ('prone_ytw', 4, 1, 'Prone Y-T-W'),
  ('reverse_snow_angel', 4, 1, 'Reverse Snow Angels'),
  ('diamond_push_up_decline', 4, 1, 'Pompes diamant déclinées'),
  ('floor_triceps_extension', 4, 1, 'Extensions triceps au sol'),
  ('close_push_up_box', 5, 2, 'Pompes serrées sur box'),
  ('archer_push_up', 5, 1, 'Pompes archer'),
  ('decline_push_up_wall', 5, 2, 'Pompes déclinées pieds au mur'),
  ('weighted_bag_push_up', 5, 3, 'Pompes lestées (sac)'),
  ('inverted_row_table', 4, 1, 'Rowing inversé sous table'),
  ('superman_pull', 4, 3, 'Superman Pull'),
  ('scapular_pull_up', 5, 3, 'Scapular Pull-Ups'),
  ('band_pull_apart', 4, 2, 'Pull-apart à l''élastique'),
  ('chin_up_supine', 4, 1, 'Tractions supination'),
  ('band_biceps_curl', 4, 1, 'Curls à l''élastique'),
  ('towel_curl_isometric', 5, 2, 'Curls isométriques à la serviette'),
  ('bar_hang_shrug', 4, 1, 'Shrugs suspendus à la barre'),
  ('scapular_push_up', 5, 2, 'Scapular Push-Ups'),
  ('dead_hang', 4, 1, 'Suspension passive'),
  ('fingertip_push_up', 4, 1, 'Pompes sur les doigts'),
  ('bodyweight_wrist_curl', 5, 2, 'Flexions de poignet au poids du corps'),
  ('band_external_rotation', 4, 1, 'Rotations externes à l''élastique'),
  ('band_face_pull', 4, 2, 'Face Pull à l''élastique'),
  ('prone_external_rotation', 5, 3, 'Rotations externes à plat ventre'),
  ('band_lat_pulldown_kneeling', 4, 1, 'Tirage vertical élastique à genoux'),
  ('band_single_arm_pulldown', 4, 3, 'Tirage élastique un bras'),
  ('band_bent_over_row', 4, 3, 'Rowing élastique buste penché'),
  ('inverted_row_feet_elevated', 4, 2, 'Rowing inversé pieds surélevés'),
  ('towel_row_post', 5, 3, 'Rowing serviette autour d''un poteau'),
  ('band_lat_pulldown', 4, 2, 'Tirage vertical à l''élastique'),
  ('band_face_pull_high', 4, 3, 'Face Pull élastique haut'),
  ('band_curl_supine_grip', 4, 2, 'Curls élastique prise supination large'),
  ('band_hammer_curl', 4, 3, 'Curls marteau à l''élastique'),
  ('chair_step_up', 4, 1, 'Step-up sur chaise'),
  ('lateral_lunge', 4, 2, 'Fente latérale'),
  ('bird_dog_hold', 4, 1, 'Bird Dog tenu'),
  ('pallof_press_band', 4, 1, 'Pallof Press à l''élastique'),
  ('prone_ytw_hold', 4, 2, 'Prone Y-T-W tenu'),
  ('band_row', 4, 3, 'Rowing à l''élastique'),
  ('scapular_pull_floor', 5, 3, 'Scapular Pull au sol'),
  ('band_overhead_triceps_extension', 4, 2, 'Extensions triceps élastique au-dessus de la tête'),
  ('bulgarian_split_squat_chair', 4, 1, 'Fentes bulgares (pied sur chaise)'),
  ('reverse_lunge_slow', 5, 2, 'Fente arrière lente'),
  ('jump_squat', 4, 1, 'Squat sauté'),
  ('cossack_squat', 5, 2, 'Cossack Squat'),
  ('shrimp_squat', 5, 3, 'Shrimp Squat'),
  ('sissy_squat', 5, 3, 'Sissy Squat'),
  ('jumping_lunge', 5, 3, 'Fentes sautées'),
  ('single_leg_calf_raise', 4, 1, 'Mollets unilatéraux'),
  ('nordic_curl_assisted', 4, 1, 'Nordic Curl assisté'),
  ('weighted_dead_bug', 5, 1, 'Dead Bug lesté'),
  ('floor_toes_to_bar', 5, 1, 'Toes-to-Bar au sol'),
  ('side_plank_rotation', 4, 2, 'Side Plank avec rotation')
  ) AS v(id, priority, authored, name)
 WHERE m.id = v.id;

-- 2. Ordre sans matériel recalculé sur tout le catalogue : les 55 par leur
-- ordre authored (colonne posée juste au-dessus), les autres par `priority`.
UPDATE public.movement_catalog
   SET priority_bodyweight = NULL
 WHERE discipline_muscu AND load_mode = 'bodyweight' AND weight_bodyweight > 0
   AND id NOT IN (SELECT id FROM (VALUES ('pike_push_up_elevated'), ('hindu_push_up'), ('handstand_hold'), ('prone_ytw'), ('reverse_snow_angel'), ('diamond_push_up_decline'), ('floor_triceps_extension'), ('close_push_up_box'), ('archer_push_up'), ('decline_push_up_wall'), ('weighted_bag_push_up'), ('inverted_row_table'), ('superman_pull'), ('scapular_pull_up'), ('band_pull_apart'), ('chin_up_supine'), ('band_biceps_curl'), ('towel_curl_isometric'), ('bar_hang_shrug'), ('scapular_push_up'), ('dead_hang'), ('fingertip_push_up'), ('bodyweight_wrist_curl'), ('band_external_rotation'), ('band_face_pull'), ('prone_external_rotation'), ('band_lat_pulldown_kneeling'), ('band_single_arm_pulldown'), ('band_bent_over_row'), ('inverted_row_feet_elevated'), ('towel_row_post'), ('band_lat_pulldown'), ('band_face_pull_high'), ('band_curl_supine_grip'), ('band_hammer_curl'), ('chair_step_up'), ('lateral_lunge'), ('bird_dog_hold'), ('pallof_press_band'), ('prone_ytw_hold'), ('band_row'), ('scapular_pull_floor'), ('band_overhead_triceps_extension'), ('bulgarian_split_squat_chair'), ('reverse_lunge_slow'), ('jump_squat'), ('cossack_squat'), ('shrimp_squat'), ('sissy_squat'), ('jumping_lunge'), ('single_leg_calf_raise'), ('nordic_curl_assisted'), ('weighted_dead_bug'), ('floor_toes_to_bar'), ('side_plank_rotation')) AS n(id));

WITH classe AS (
  SELECT id, dense_rank() OVER (
           PARTITION BY muscle_primary, movement_group, compound
           ORDER BY COALESCE(priority_bodyweight, priority)
         ) AS rang
    FROM public.movement_catalog
   WHERE discipline_muscu AND load_mode = 'bodyweight' AND weight_bodyweight > 0
)
UPDATE public.movement_catalog AS m
   SET priority_bodyweight = LEAST(c.rang, 3)
  FROM classe AS c
 WHERE c.id = m.id;
