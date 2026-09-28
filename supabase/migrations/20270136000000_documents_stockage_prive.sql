-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « documents » privé, et plus aucun accès client aux documents de box
--
-- Appliquée en prod : OUI, le 28/09/2026 à 21:15 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public, internal et storage avec droits
-- db-dumps/2026-09-28/athlex-prod-public-internal-storage-20260928T211427Z.dump,
-- sha256 bb5db6a0470e464fdfd3eb29eaf09d55f3e5f540e99667b0bf2d6d3381aab657 vérifié
-- après aller-retour, 142 TABLE DATA, 456 ACL, 380 POLICY ; précontrôle (md5
-- calculés avec le search_path de la prod) : les 7 policies à leurs empreintes,
-- stockage public, ACL anon=rm / authenticated=arwdm, delete_user_account
-- f891e2df…, 2 objets et 2 lignes ; vérifications : stockage privé, 0 policy sur
-- documents et sur box_documents, RLS active, aucun droit client, service_role
-- inchangé, delete_user_account inchangée, objets et lignes identiques (md5
-- d4819ffa… et 0d6b14a6… avant/après), anon = 0 et authenticated sans jeton = 0 ;
-- audit des droits grants-prod.yml 33/33, S1 à S3 compris, sous athlex_audit_ro.)
--
-- Constat en prod, lecture seule, le 28/09/2026 (md5 calculés par la base, avec
-- le search_path de la prod "$user", public, extensions) :
--   * storage.buckets 'documents' : public = true, sans limite de taille ni de
--     type. Toute URL `/object/public/documents/<chemin>` sert le fichier sans
--     compte ni règle ; les 2 lignes de box_documents stockent justement cette
--     URL publique ;
--   * policy `public_read_documents` (SELECT, rôle public, qual md5
--     e0811ac08942a9f37a1e016937b57a3c) : `bucket_id = 'documents'` sans autre
--     condition. anon lisait et listait les 2 objets du stockage, noms compris
--     (test SET LOCAL ROLE anon : 2 ; authenticated sans jeton : 2).
-- Ampleur : 2 PDF d'une seule box. La table box_documents elle-même n'était pas
-- lisible par anon (ses policies exigent auth.uid()).
--
-- Décision de Nab (28/09/2026) : l'écran Documents est retiré de l'app (PR app
-- séparée) ; les fichiers et les lignes existants sont conservés. Donc :
--   * le stockage passe en privé ;
--   * les 3 policies client du stockage sont supprimées (lecture, dépôt,
--     suppression) : plus aucune règle client sur `documents` ;
--   * les 4 policies de box_documents sont supprimées et anon / authenticated
--     perdent tout droit sur la table. La RLS reste active : seule la clé
--     serveur (service_role, BYPASSRLS, droits inchangés) lit ou écrit. Le
--     Manager ne compte box_documents qu'avec la clé serveur (suppression d'une
--     box) : inchangé ;
--   * aucun fichier ni aucune ligne supprimés.
--
-- Inchangé : public.delete_user_account() (md5 f891e2df88f9c57d8802a3b17e9128bb),
-- SECURITY DEFINER, qui efface toujours les fichiers `documents` d'un compte
-- supprimé ; les FK de box_documents (box en CASCADE, auteur en SET NULL).
--
-- Remplace, pour `documents`, la partie jamais appliquée de
-- migrations_archive/20260820_lot1c_c_buckets_prives.sql (lot 1C-c2). Le
-- stockage `message-attachments`, visé par le même fichier, fait l'objet d'un
-- lot séparé.
--
-- Pour l'audit des droits (contrôles S1 à S3, scripts/lib/controle-stockage-documents.mjs,
-- rejoué par la CI et par grants-prod.yml sous athlex_audit_ro) : ce rôle lit
-- les colonnes id et public de storage.buckets (USAGE sur le schéma storage,
-- SELECT de colonnes, policy de lecture réservée à ce rôle, sinon la RLS lui
-- montrerait 0 ligne). Même modèle que 20270105.
--
-- Contrôlée par `supabase/tests/documents_stockage_prive.sql`.
--
-- Retour arrière (transactionnel, vérifié sur le rejeu contre les empreintes de
-- prod du 28/09/2026 : 7 policies ci-dessous, bucket public = true, ACL anon
-- {SELECT, MAINTAIN} et authenticated {SELECT, INSERT, UPDATE, DELETE, MAINTAIN}) :
--
--   BEGIN;
--   UPDATE storage.buckets SET public = true WHERE id = 'documents';
--   -- e0811ac08942a9f37a1e016937b57a3c
--   CREATE POLICY public_read_documents ON storage.objects FOR SELECT
--     USING (bucket_id = 'documents'::text);
--   -- with_check 9e545a323e57db45e255e31b220b7f0b
--   CREATE POLICY documents_insert_own ON storage.objects FOR INSERT TO authenticated
--     WITH CHECK ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
--   -- 610eb83f5149310f41aa4e2a66a0d854
--   CREATE POLICY documents_delete_own ON storage.objects FOR DELETE TO authenticated
--     USING ((bucket_id = 'documents'::text) AND ((owner = auth.uid()) OR ((storage.foldername(name))[1] = (auth.uid())::text)));
--   -- 79c1ca051b48bf299d7c30e763588129
--   CREATE POLICY delete_own_documents ON public.box_documents FOR DELETE
--     USING (auth.uid() = uploaded_by);
--   -- f8ef5eca3ac932ab268bb92489716ede
--   CREATE POLICY documents_member_read ON public.box_documents FOR SELECT
--     USING ((auth.uid() IS NOT NULL) AND (((box_id IS NULL) AND (uploaded_by = auth.uid()))
--       OR (box_id IN (SELECT public.get_user_box_ids() AS get_user_box_ids)) OR (uploaded_by = auth.uid())));
--   -- with_check ebaaa7fa1d14a7e1f16f10c7fc8ce696
--   CREATE POLICY insert_box_documents ON public.box_documents FOR INSERT
--     WITH CHECK ((auth.uid() = uploaded_by) AND ((box_id IS NULL)
--       OR (box_id IN (SELECT public.get_user_box_ids() AS get_user_box_ids)) OR public.is_box_admin(box_id)));
--   -- 830c3b3e413d0d77e7ca370c2b1a7f7c
--   CREATE POLICY read_box_documents ON public.box_documents FOR SELECT
--     USING ((auth.uid() IS NOT NULL) AND (((box_id IS NULL) AND (uploaded_by = auth.uid()))
--       OR (box_id IN (SELECT box_members.box_id FROM public.box_members WHERE (box_members.member_id = auth.uid())))
--       OR (uploaded_by = auth.uid())));
--   GRANT SELECT, MAINTAIN ON public.box_documents TO anon;
--   GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON public.box_documents TO authenticated;
--   DROP POLICY buckets_select_audit_ro ON storage.buckets;
--   REVOKE SELECT (id, public) ON storage.buckets FROM athlex_audit_ro;
--   REVOKE USAGE ON SCHEMA storage FROM athlex_audit_ro;
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'documents';

-- Définitions en prod : voir l'en-tête (retour arrière).
DROP POLICY public_read_documents ON storage.objects;
DROP POLICY documents_insert_own ON storage.objects;
DROP POLICY documents_delete_own ON storage.objects;

DROP POLICY delete_own_documents ON public.box_documents;
DROP POLICY documents_member_read ON public.box_documents;
DROP POLICY insert_box_documents ON public.box_documents;
DROP POLICY read_box_documents ON public.box_documents;

REVOKE ALL ON public.box_documents FROM anon, authenticated;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athlex_audit_ro') THEN
    RAISE NOTICE 'rôle athlex_audit_ro absent : rien à faire sur cette base.';
    RETURN;
  END IF;

  GRANT USAGE ON SCHEMA storage TO athlex_audit_ro;
  GRANT SELECT (id, public) ON storage.buckets TO athlex_audit_ro;

  DROP POLICY IF EXISTS buckets_select_audit_ro ON storage.buckets;
  CREATE POLICY buckets_select_audit_ro ON storage.buckets
    AS PERMISSIVE FOR SELECT TO athlex_audit_ro
    USING (true);
END
$migration$;

COMMIT;
