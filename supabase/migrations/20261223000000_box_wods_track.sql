-- ═════════════════════════════════════════════════════════════════════════════
-- La piste de programmation portée par la carte.
--
-- Appliquée en prod : NON.
--
-- Additif et rejouable. Depuis 20261222 une box peut avoir trois pistes
-- actives ; la génération les pose toutes le même jour, en `audience = 'all'`,
-- et le Whiteboard affichait jusqu'à huit cartes empilées. La décision produit
-- est de garder les trois programmations visibles de tous et de basculer par
-- onglets : il faut donc que la carte sache de quelle piste elle vient.
--
-- `null` n'est PAS un défaut en attente : c'est la valeur des WODs saisis par un
-- coach, qui n'appartiennent à aucune piste et forment l'onglet « Box ». Une
-- ligne `source = 'auto'` porte toujours sa piste (`generate-box-week` l'écrit).
--
-- L'index est partiel : sur 942 lignes, 890 sont `manual` et resteraient `null`
-- à jamais — les indexer coûterait sans jamais servir un filtre par piste.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.box_wods ADD COLUMN IF NOT EXISTS track text NULL;

ALTER TABLE public.box_wods DROP CONSTRAINT IF EXISTS box_wods_track_check;
ALTER TABLE public.box_wods ADD CONSTRAINT box_wods_track_check
  CHECK (track IS NULL OR track IN ('functional','hybrid','musculation'));

COMMENT ON COLUMN public.box_wods.track IS
  'Piste de programmation de la carte : functional | hybrid | musculation, ou NULL pour un WOD saisi par un coach (onglet « Box » du Whiteboard). Écrite par generate-box-week sur chaque ligne source = auto.';

CREATE INDEX IF NOT EXISTS idx_box_wods_track
  ON public.box_wods (box_id, scheduled_date, track) WHERE track IS NOT NULL;

-- Rétroactif : les lignes déjà posées tiennent leur piste de leur run. Le
-- filtre `track IS NULL` rend l'instruction rejouable et, avec `source = 'auto'`,
-- garantit qu'aucune ligne `manual` n'est touchée même si l'une d'elles portait
-- un `auto_run_id` résiduel.
UPDATE public.box_wods AS w
   SET track = r.track
  FROM public.box_auto_programming_runs AS r
 WHERE w.auto_run_id = r.id
   AND w.source = 'auto'
   AND w.track IS NULL;
