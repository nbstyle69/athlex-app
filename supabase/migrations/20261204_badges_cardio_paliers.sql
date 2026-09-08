-- Cardio — paliers de badges en mètres et nouveaux paliers en calories.
--
-- Les badges `mv_row_*`, `mv_bike_*`, `mv_ski_*` existants comptent des
-- calories (leurs descriptions le disent déjà) : clés et libellés conservés.
-- Un préfixe par unité côté app : `mv_row` = cal, `mv_row_m` = mètres ;
-- idem bike / ski. `mv_run` est nouveau (mètres uniquement).
--
-- Paliers validés (réponse reco cardio) ; 42 195 m = « Marathon » partout.
-- Idempotent : les lignes déjà présentes ne sont pas réécrites.

BEGIN;

INSERT INTO public.badges_catalog (badge_key, title, description, icon, category, sort_order) VALUES
  -- Bike — calories (compléments des 500 / 2000 existants)
  ('mv_bike_5000',    'Assault Bike Machine',   '5000 cal Bike cumulées',        '🚴', 'movement', 300),
  ('mv_bike_10000',   'Assault Bike Légende',   '10 000 cal Bike cumulées',      '🚴', 'movement', 301),
  -- Ski — calories (complément des 500 / 2000 existants)
  ('mv_ski_5000',     'Ski Erg Machine',        '5000 cal Ski cumulées',         '⛷️', 'movement', 302),
  -- Row — mètres
  ('mv_row_m_10000',  'Rameur 10K',             '10 km de Rameur cumulés',       '🚣', 'movement', 310),
  ('mv_row_m_42195',  'Rameur Marathon',        '42,195 km de Rameur cumulés',   '🚣', 'movement', 311),
  ('mv_row_m_100000', 'Rameur Centurion',       '100 km de Rameur cumulés',      '🚣', 'movement', 312),
  ('mv_row_m_250000', 'Rameur Légende',         '250 km de Rameur cumulés',      '🚣', 'movement', 313),
  -- Bike — mètres
  ('mv_bike_m_25000',  'Bike 25K',              '25 km de Bike cumulés',         '🚴', 'movement', 320),
  ('mv_bike_m_100000', 'Bike Centurion',        '100 km de Bike cumulés',        '🚴', 'movement', 321),
  ('mv_bike_m_250000', 'Bike Légende',          '250 km de Bike cumulés',        '🚴', 'movement', 322),
  -- Ski — mètres
  ('mv_ski_m_10000',  'Ski Erg 10K',            '10 km de Ski cumulés',          '⛷️', 'movement', 330),
  ('mv_ski_m_42195',  'Ski Erg Marathon',       '42,195 km de Ski cumulés',      '⛷️', 'movement', 331),
  ('mv_ski_m_100000', 'Ski Erg Centurion',      '100 km de Ski cumulés',         '⛷️', 'movement', 332),
  -- Run — mètres
  ('mv_run_10000',    'Runner 10K',             '10 km de course cumulés',       '🏃', 'movement', 340),
  ('mv_run_42195',    'Runner Marathon',        '42,195 km de course cumulés',   '🏃', 'movement', 341),
  ('mv_run_100000',   'Runner Centurion',       '100 km de course cumulés',      '🏃', 'movement', 342),
  ('mv_run_250000',   'Runner Légende',         '250 km de course cumulés',      '🏃', 'movement', 343)
ON CONFLICT (badge_key) DO NOTHING;

COMMIT;
