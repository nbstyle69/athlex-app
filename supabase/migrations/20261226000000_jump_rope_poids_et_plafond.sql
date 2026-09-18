-- ═════════════════════════════════════════════════════════════════════════════
-- Corde à sauter : poids de tirage relevé, volume borné par un plafond de classe.
--
-- Appliquée en prod : NON.
--
-- Additif et rejouable. Suite de 20261225 (trois slots ouverts à la corde) et
-- du correctif moteur `FAMILY_CAP_FACTOR`.
--
--   1. `movement_catalog.weight_functional` de `double_under` : 9 → 10. Le
--      facteur de famille et les trois slots plafonnent à ~6 % d'apparition ;
--      le poids est le seul levier restant, et 10 est le haut de l'échelle :
--      les cinq poids de tirage sont bornés 0–10 par contrainte (20261211).
--      13 avait été retenu avant de le savoir ; le rejeu CI l'a refusé.
--   2. `wod_volume_caps` reçoit un plafond de classe pour la famille
--      `jump_rope` : 200 reps à la référence RX, décliné par catégorie comme
--      les autres (× 0,7 en Scaled / Inter, × 1,3 en Elite / Pro).
--
-- Pourquoi le plafond. Le facteur de famille (× 4, soit 400 reps en RX) débloque
-- la corde mais laisse passer des volumes absurdes : médiane à 44 reps, mais 9 %
-- des tirages entre 300 et 400. Trois cents double unders discréditent le
-- générateur plus sûrement que leur absence. Le plafond de classe REMPLACE le
-- générique modulé depuis le correctif du `Math.min` — c'est ce correctif qui
-- rend cette ligne opérante, elle n'aurait rien fait avant.
--
-- Coût mesuré, assumé : 6,4 % d'apparition sans plafond tombent à 4,8 % avec,
-- poids à 10 (4,0 à 6,2 % sur huit blocs de 500). La fréquence paie la sobriété du volume.
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.movement_catalog SET weight_functional = 10, updated_at = now()
  WHERE id = 'double_under';

INSERT INTO public.wod_volume_caps (label, ids, family, band, unit, rx_total, active, version)
VALUES
  ('corde à sauter', NULL, 'jump_rope', NULL, 'reps', 200, true, 3)
ON CONFLICT (label) DO UPDATE
  SET ids = EXCLUDED.ids, family = EXCLUDED.family, band = EXCLUDED.band,
      unit = EXCLUDED.unit, rx_total = EXCLUDED.rx_total,
      active = EXCLUDED.active, version = EXCLUDED.version;
