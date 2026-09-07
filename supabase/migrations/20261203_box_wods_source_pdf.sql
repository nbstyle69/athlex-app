-- Import PDF de programmation (TheHub) : chaque WOD importé garde la trace du
-- PDF d'origine, de la page et du profil de source qui l'a produit
-- (`kplus-perf`, `generic`…), pour relire la page en cas de doute et pour
-- mesurer la qualité de chaque profil.
--
-- Le PDF lui-même est conservé dans un bucket privé `wod-sources`, rangé par
-- box (`{box_id}/{fichier}.pdf`) : lecture et écriture réservées au staff de la
-- box (`is_box_staff`), rien de public.
BEGIN;

ALTER TABLE public.box_wods
  ADD COLUMN IF NOT EXISTS source_pdf_url text,
  ADD COLUMN IF NOT EXISTS source_page    smallint,
  ADD COLUMN IF NOT EXISTS source_profile text;

COMMENT ON COLUMN public.box_wods.source_pdf_url IS
  'Chemin Storage (bucket wod-sources) du PDF de programmation importé, null pour un WOD saisi à la main.';
COMMENT ON COLUMN public.box_wods.source_page IS
  'Page du PDF (1-based) dont ce WOD a été extrait.';
COMMENT ON COLUMN public.box_wods.source_profile IS
  'Profil de source de l''importateur PDF (kplus-perf, generic…).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('wod-sources', 'wod-sources', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "wod_sources_staff_read"   ON storage.objects;
DROP POLICY IF EXISTS "wod_sources_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "wod_sources_staff_delete" ON storage.objects;

CREATE POLICY "wod_sources_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'wod-sources'
    AND public.is_box_staff(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "wod_sources_staff_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'wod-sources'
    AND public.is_box_staff(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "wod_sources_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'wod-sources'
    AND public.is_box_staff(((storage.foldername(name))[1])::uuid)
  );

COMMIT;
