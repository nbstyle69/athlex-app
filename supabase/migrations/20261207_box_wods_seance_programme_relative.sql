-- Séances de programme athlète : ancrage relatif « semaine N × jour J »
-- au lieu d'une date calendaire.
--
-- Un programme athlète (« Prog Muscu — 13 semaines · 5j/sem ») se vend et se
-- suit à partir de la date de souscription de chaque acheteur : sa séance n'a
-- pas de date, elle a une position (semaine 3, mercredi). Jusqu'ici le contenu
-- d'un programme était un `box_wods` daté rattaché par `wod_program_access`
-- (lot 5-C) — ce qui le posait de fait sur le Whiteboard de la box, alors que
-- le programme est une programmation payante reçue EN PLUS des blocs de la box.
--
-- Décision : une séance de programme reste une ligne `box_wods` (même
-- `description`, mêmes parseurs, même `wod_program_access`, même
-- `wod_access_allowed`), mais SANS `scheduled_date` et AVEC
-- `program_week`/`program_day`. Toutes les lectures Whiteboard (Manager, app,
-- RPC apply_program_week / semaines types, stats) filtrent sur
-- `scheduled_date` : une séance relative n'y entre jamais, sans toucher à ces
-- lectures. Inversement un WOD du Whiteboard garde sa date et n'a jamais de
-- semaine/jour — c'est le CHECK ci-dessous qui interdit un objet hybride.
--
-- Un WOD Whiteboard restreint à un programme (date + wod_program_access, cas
-- « WOD ELITE » en prod) reste exactement ce qu'il est : daté, sur le Whiteboard,
-- visible des acheteurs. Rien à convertir : 0 séance relative n'existe.
BEGIN;

-- Garde AVANT tout changement de schéma : la colonne est encore NOT NULL,
-- toute ligne sans date serait un état inconnu qu'on refuse de relire.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.box_wods WHERE scheduled_date IS NULL) THEN
    RAISE EXCEPTION 'box_wods : des lignes sans scheduled_date existent avant la migration';
  END IF;
END $$;

ALTER TABLE public.box_wods
  ALTER COLUMN scheduled_date DROP NOT NULL;

ALTER TABLE public.box_wods
  ADD COLUMN IF NOT EXISTS program_week smallint,
  ADD COLUMN IF NOT EXISTS program_day  smallint;

ALTER TABLE public.box_wods DROP CONSTRAINT IF EXISTS box_wods_ancrage_check;
ALTER TABLE public.box_wods ADD CONSTRAINT box_wods_ancrage_check CHECK (
  (scheduled_date IS NOT NULL AND program_week IS NULL AND program_day IS NULL)
  OR
  (scheduled_date IS NULL
   AND program_week IS NOT NULL AND program_week >= 1
   AND program_day IS NOT NULL AND program_day BETWEEN 1 AND 7)
);
-- Les `IS NOT NULL` explicites comptent : sans eux, une ligne sans date NI
-- semaine évalue le CHECK à NULL, que Postgres accepte.

COMMENT ON COLUMN public.box_wods.program_week IS
  'Séance de programme athlète : semaine relative (1..durée), exclusive de scheduled_date.';
COMMENT ON COLUMN public.box_wods.program_day IS
  'Séance de programme athlète : jour relatif ISO (1 = lundi … 7 = dimanche), exclusive de scheduled_date.';

CREATE INDEX IF NOT EXISTS box_wods_programme_relatif_idx
  ON public.box_wods (program_week, program_day, sort_order)
  WHERE scheduled_date IS NULL;

COMMIT;
