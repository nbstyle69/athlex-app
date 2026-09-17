-- ═════════════════════════════════════════════════════════════════════════════
-- Archivage réversible d'une box.
--
-- Appliquée en prod : OUI (17/09/2026 20:44 UTC, dump `athlex-prod-public-20260917T204118Z.dump`
-- dans `db-dumps/2026-09-17`, sha256 `378690446d6fd939b461339aeacbdb043ed08baf69ea3ba8176a680398c99ae3`).
-- Vérifié après application : les deux colonnes, l'index partiel, la policy RESTRICTIVE
-- active sur `anon, authenticated`, les deux fonctions SECURITY DEFINER filtrées, et
-- **aucune box archivée** (4 box, `archived_at` nul partout).
--
-- Une box archivée disparaît des annuaires, des recherches et des listes, perd
-- l'accès de ses membres, et n'est plus générée — mais ne perd RIEN : aucune
-- ligne n'est supprimée, et `archived_at = NULL` la réveille telle quelle.
--
-- Additif et rejouable :
--   1. `boxes.archived_at` / `archived_by`, plus un index partiel.
--   2. Une policy RESTRICTIVE sur `boxes`.
--   3. Le filtre dans les deux fonctions SECURITY DEFINER qui listent des box.
--
-- ── Pourquoi une policy RESTRICTIVE, et pas un filtre dans les policies ──────
--
-- `boxes` porte sept policies, toutes PERMISSIVE, dont deux autorisent la
-- lecture sans condition (`boxes_select_all`, `public_read_by_invite`, toutes
-- deux `USING (true)`). Les policies permissives se combinent par OU : ajouter
-- `archived_at IS NULL` à l'une d'elles ne refuserait jamais rien, puisqu'une
-- autre dit déjà oui à tout. Il aurait fallu réécrire les sept.
--
-- Une policy RESTRICTIVE se combine par ET avec le résultat des permissives :
-- une seule ligne suffit, les sept autres ne bougent pas, et le masquage couvre
-- du même coup l'app mobile — l'annuaire, la fiche de box et le sélecteur de box
-- du classement — sans livrer de nouvelle version.
--
-- `service_role` contourne la RLS (`rolbypassrls`) : le back-office continue de
-- voir les box archivées, ce qui est nécessaire pour les rouvrir.
--
-- ── Ce qui continue de voir une box archivée ────────────────────────────────
--
-- `wod_scores`, `elo_history`, `box_elo_history` et la facturation référencent
-- la box sans passer par ses policies : l'historique d'un athlète et les
-- écritures comptables ne changent pas. C'est le sens d'« archiver » plutôt que
-- « supprimer ».
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1. Colonnes ─────────────────────────────────────────────────────────────
ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.boxes.archived_at IS
  'Date d''archivage. NULL = box active. Une box archivée sort des annuaires et des listes et devient invisible à ses membres (policy boxes_hide_archived) ; aucune donnée n''est supprimée, remettre NULL la réveille.';
COMMENT ON COLUMN public.boxes.archived_by IS
  'Administrateur ayant archivé la box. ON DELETE SET NULL : la trace de l''archivage survit à la suppression de son auteur.';

-- Index partiel : les box archivées sont la minorité qu'on cherche (onglet
-- « Archivées »), les actives se lisent par les index existants.
CREATE INDEX IF NOT EXISTS idx_boxes_archived
  ON public.boxes (archived_at DESC) WHERE archived_at IS NOT NULL;

-- ─── 2. Masquage par policy restrictive ──────────────────────────────────────
-- FOR ALL et pas FOR SELECT : une box archivée ne doit pas non plus être
-- modifiable par son gérant (`boxes_owner_write`, `boxes_coowner_manage` sont
-- des policies d'écriture permissives, qu'une restriction SELECT ne borne pas).
-- L'INSERT reste possible : une box neuve a `archived_at IS NULL`.
DROP POLICY IF EXISTS boxes_hide_archived ON public.boxes;
CREATE POLICY boxes_hide_archived ON public.boxes
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (archived_at IS NULL)
  WITH CHECK (archived_at IS NULL);

-- ─── 3. Les deux fonctions SECURITY DEFINER ──────────────────────────────────
-- Elles s'exécutent avec les droits de leur propriétaire et ne sont donc PAS
-- soumises à la policy ci-dessus : sans ce filtre, un gérant continuerait de
-- voir sa box archivée dans son sélecteur de box, et un membre garderait son
-- `box_id` dans toutes les policies qui s'appuient sur `get_user_box_ids()`.

CREATE OR REPLACE FUNCTION public.get_my_admin_boxes()
RETURNS TABLE(id uuid, name text, slug text, owner_id uuid, city text, logo_url text, is_active boolean, created_at timestamptz, allowed_tournament_formats text[], my_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    b.id, b.name, b.slug, b.owner_id, b.city, b.logo_url, b.is_active,
    b.created_at, b.allowed_tournament_formats,
    r.my_role
  FROM public.boxes b
  JOIN (
    SELECT box_id, MIN(rank) AS rank, CASE WHEN MIN(rank) = 1 THEN 'owner' ELSE 'coach' END AS my_role
    FROM (
      SELECT bx.id AS box_id, 1 AS rank
      FROM public.boxes bx
      WHERE bx.owner_id = auth.uid()
      UNION ALL
      SELECT bm.box_id, CASE WHEN bm.role = 'owner' THEN 1 ELSE 2 END
      FROM public.box_members bm
      WHERE bm.member_id = auth.uid()
        AND bm.role IN ('owner', 'coach')
        AND COALESCE(bm.status, 'active') = 'active'
    ) titres
    GROUP BY box_id
  ) r ON r.box_id = b.id
  WHERE auth.uid() IS NOT NULL
    AND b.archived_at IS NULL
  ORDER BY b.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_box_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT bm.box_id
  FROM public.box_members bm
  JOIN public.boxes b ON b.id = bm.box_id
  WHERE bm.member_id = auth.uid()
    AND bm.status = 'active'
    AND b.archived_at IS NULL;
$function$;

NOTIFY pgrst, 'reload schema';
