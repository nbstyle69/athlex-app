-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « partner-logos » : dépôt, modification et suppression réservés aux
-- admins de la plateforme
--
-- Appliquée en prod : NON.
--
-- Constat en prod, lecture seule (session en default_transaction_read_only et
-- transaction READ ONLY), le 06/10/2026 — md5 calculés par la base, avec le
-- search_path de la prod "$user", public, extensions :
--   * storage.buckets 'partner-logos' : public = true, sans limite de taille ni
--     de type ; 0 objet ; public.partners : 0 ligne ;
--   * `admin_upload_partner_logo` (INSERT, rôle public, with_check md5
--     e19d5b7dc3fd05079df6397622a7b2a6), `admin_update_partner_logo` (UPDATE,
--     rôle public, qual md5 e19d5b7d…, sans with_check) et
--     `admin_delete_partner_logo` (DELETE, rôle public, qual md5 e19d5b7d…) :
--     `bucket_id = 'partner-logos' AND auth.uid() IS NOT NULL`. Malgré leur nom,
--     tout compte connecté dépose, remplace ou supprime un logo de partenaire,
--     et peut faire entrer dans ce stockage un objet qu'il peut modifier
--     ailleurs (l'UPDATE sans with_check juge la nouvelle ligne avec sa qual) ;
--   * `public_read_partner_logos` (SELECT, rôle public, qual md5
--     6cb143c112d399f7c51c1426d9457f16) : lecture publique des logos ;
--   * public.partners : `admin_manage_partners` (ALL, qual et with_check md5
--     da5ede061536c834148c8d9356cd43ca) réserve la gestion aux comptes dont
--     profiles.role vaut 'super_admin' ou 'admin' ;
--   * public.prevent_role_escalation() (md5 505d808ef532d34d846554de913abe6f,
--     trigger trg_prevent_role_escalation) : un client ne modifie pas son rôle ;
--   * comptes : 2 super_admin, 0 admin.
-- Le Manager (/admin/partners) dépose le logo depuis le navigateur, avec la
-- session de l'admin et `upsert: true` (INSERT, et UPDATE si le nom existe).
-- L'app ne fait que lire public.partners et les URL publiques des logos.
--
-- Décisions de Nab et de Claude (conception), 06/10/2026 :
--   * dépôt, modification, suppression : rôle authenticated, et le compte est
--     admin de la plateforme — même prédicat que `admin_manage_partners` et que
--     les policies `assets_admin_*` du stockage `assets` ;
--   * la modification juge aussi la nouvelle ligne (WITH CHECK) : un objet ne
--     sort de ce stockage, ni n'y entre, que par un admin ;
--   * les trois anciennes policies sont supprimées : des policies permissives
--     s'additionnent, en garder une laisserait l'écriture ouverte ;
--   * inchangés : la lecture publique (`public_read_partner_logos`), le
--     stockage public, `admin_manage_partners`, prevent_role_escalation.
-- Hors périmètre (noté, pas traité) : limite de taille et de type du stockage,
-- le stockage `tournament-banners`, le traitement d'erreur d'envoi du Manager.
--
-- Pas de récursion : le prédicat lit public.profiles avec les droits de
-- l'appelant ; aucune policy de profiles ne lit storage.objects. Un admin lit
-- sa propre ligne de profiles (public_read_profiles, et id = auth.uid()).
--
-- Contrôlée par `supabase/tests/partner_logos_admin.sql` et par le contrôle
-- S6 de l'audit des droits (scripts/lib/controle-stockage-partner-logos.mjs).
--
-- Retour arrière (transactionnel, rejoué par le test contre les empreintes de
-- prod du 06/10/2026) :
--
--   psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 \
--     -f supabase/retours/20270148000000_partner_logos_admin.sql
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY admin_upload_partner_logo ON storage.objects;
DROP POLICY admin_update_partner_logo ON storage.objects;
DROP POLICY admin_delete_partner_logo ON storage.objects;

CREATE POLICY partner_logos_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'partner-logos'
    AND EXISTS (SELECT 1 FROM public.profiles
                 WHERE profiles.id = auth.uid()
                   AND profiles.role = ANY (ARRAY['super_admin', 'admin']))
  );

CREATE POLICY partner_logos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (SELECT 1 FROM public.profiles
                 WHERE profiles.id = auth.uid()
                   AND profiles.role = ANY (ARRAY['super_admin', 'admin']))
  )
  WITH CHECK (
    bucket_id = 'partner-logos'
    AND EXISTS (SELECT 1 FROM public.profiles
                 WHERE profiles.id = auth.uid()
                   AND profiles.role = ANY (ARRAY['super_admin', 'admin']))
  );

CREATE POLICY partner_logos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'partner-logos'
    AND EXISTS (SELECT 1 FROM public.profiles
                 WHERE profiles.id = auth.uid()
                   AND profiles.role = ANY (ARRAY['super_admin', 'admin']))
  );

COMMIT;
