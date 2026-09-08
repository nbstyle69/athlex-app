-- Catalogue haltéro élargi (12 mouvements) + retouche des libellés Bike mètres.
--
-- 1. Les badges mètres de Bike prennent le même nom que la série calories
--    (« Assault Bike … »), validation des libellés cardio. Mise à jour en
--    place : le seed `20261204_badges_cardio_paliers.sql` est déjà en prod.
-- 2. Nouveaux paliers, schéma existant des barres (100 / 500 / 1000 / 5000
--    reps, Rookie / Addict / Machine / Legend) pour les mouvements qui ont
--    leur propre clé : Bench Press, Snatch Balance, Snatch High Pull,
--    Clean Pull. Schéma existant des haltères (100 / 500 / 1000) pour
--    DB Strict Press. Les autres mouvements ajoutés au catalogue rejoignent
--    des compteurs existants : Tall Clean → `mv_clean`, Power Jerk / Split
--    Jerk / Back Rack Split Jerk / Strict Press → `mv_press` (« strict/push/
--    jerk »), Zercher Squat → `mv_squat` (« toutes variantes »), Wall Walk →
--    `mv_wallwalk`. Aucun palier inventé.
-- Idempotent : les lignes déjà présentes ne sont pas réécrites.

BEGIN;

UPDATE public.badges_catalog SET title = 'Assault Bike 25K'       WHERE badge_key = 'mv_bike_m_25000';
UPDATE public.badges_catalog SET title = 'Assault Bike Centurion' WHERE badge_key = 'mv_bike_m_100000';
UPDATE public.badges_catalog SET title = 'Assault Bike Légende'   WHERE badge_key = 'mv_bike_m_250000';

INSERT INTO public.badges_catalog (badge_key, title, description, icon, category, sort_order) VALUES
  -- Barres : 100 / 500 / 1000 / 5000
  ('mv_bench_press_100',     'Bench Press Rookie',       '100 Bench Press cumulés',        '🏋️', 'movement', 350),
  ('mv_bench_press_500',     'Bench Press Addict',       '500 Bench Press cumulés',        '🏋️', 'movement', 351),
  ('mv_bench_press_1000',    'Bench Press Machine',      '1000 Bench Press cumulés',       '🏋️', 'movement', 352),
  ('mv_bench_press_5000',    'Bench Press Legend',       '5000 Bench Press cumulés',       '🏋️', 'movement', 353),
  ('mv_snatch_balance_100',  'Snatch Balance Rookie',    '100 Snatch Balance cumulés',     '🎯', 'movement', 354),
  ('mv_snatch_balance_500',  'Snatch Balance Addict',    '500 Snatch Balance cumulés',     '🎯', 'movement', 355),
  ('mv_snatch_balance_1000', 'Snatch Balance Machine',   '1000 Snatch Balance cumulés',    '🎯', 'movement', 356),
  ('mv_snatch_balance_5000', 'Snatch Balance Legend',    '5000 Snatch Balance cumulés',    '🎯', 'movement', 357),
  ('mv_snatch_hp_100',       'Snatch High Pull Rookie',  '100 Snatch High Pulls cumulés',  '🎯', 'movement', 358),
  ('mv_snatch_hp_500',       'Snatch High Pull Addict',  '500 Snatch High Pulls cumulés',  '🎯', 'movement', 359),
  ('mv_snatch_hp_1000',      'Snatch High Pull Machine', '1000 Snatch High Pulls cumulés', '🎯', 'movement', 360),
  ('mv_snatch_hp_5000',      'Snatch High Pull Legend',  '5000 Snatch High Pulls cumulés', '🎯', 'movement', 361),
  ('mv_clean_pull_100',      'Clean Pull Rookie',        '100 Clean Pulls cumulés',        '💪', 'movement', 362),
  ('mv_clean_pull_500',      'Clean Pull Addict',        '500 Clean Pulls cumulés',        '💪', 'movement', 363),
  ('mv_clean_pull_1000',     'Clean Pull Machine',       '1000 Clean Pulls cumulés',       '💪', 'movement', 364),
  ('mv_clean_pull_5000',     'Clean Pull Legend',        '5000 Clean Pulls cumulés',       '💪', 'movement', 365),
  -- Haltères : 100 / 500 / 1000
  ('mv_db_strict_press_100', 'DB Strict Press Rookie',   '100 DB Strict Press cumulés',    '🔱', 'movement', 366),
  ('mv_db_strict_press_500', 'DB Strict Press Addict',   '500 DB Strict Press cumulés',    '🔱', 'movement', 367),
  ('mv_db_strict_press_1000','DB Strict Press Machine',  '1000 DB Strict Press cumulés',   '🔱', 'movement', 368)
ON CONFLICT (badge_key) DO NOTHING;

COMMIT;
