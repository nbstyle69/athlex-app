-- Strict Press devient sa propre clé de compteur (`strict_press` / `mv_strict_press`),
-- séparée de la famille `press` (Push Press / Push Jerk / S2OH). Paliers du schéma barre
-- existant : 100 / 500 / 1000 / 5000. Aucun compteur existant à migrer (clé nouvelle).
BEGIN;

UPDATE public.badges_catalog SET description = '100 Press cumulés (push/jerk)'
WHERE badge_key = 'mv_press_100';

INSERT INTO public.badges_catalog (badge_key, title, description, icon, category, sort_order) VALUES
  ('mv_strict_press_100',  'Strict Press Rookie',  '100 Strict Press cumulés',  '🔱', 'movement', 369),
  ('mv_strict_press_500',  'Strict Press Addict',  '500 Strict Press cumulés',  '🔱', 'movement', 370),
  ('mv_strict_press_1000', 'Strict Press Machine', '1000 Strict Press cumulés', '🔱', 'movement', 371),
  ('mv_strict_press_5000', 'Strict Press Legend',  '5000 Strict Press cumulés', '🔱', 'movement', 372)
ON CONFLICT (badge_key) DO NOTHING;

COMMIT;
