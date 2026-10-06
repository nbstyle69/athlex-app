-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270148000000_partner_logos_admin.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test partner_logos_admin.sql le rejoue dans sa
-- propre transaction annulée).
--
-- Policies rétablies à l'identique (md5 de pg_get_expr, search_path
-- "$user", public, extensions ; relevés de prod du 06/10/2026, à recontrôler
-- en prod avant l'application) :
--   admin_upload_partner_logo   INSERT  with_check e19d5b7dc3fd05079df6397622a7b2a6
--   admin_update_partner_logo   UPDATE  qual       e19d5b7dc3fd05079df6397622a7b2a6
--   admin_delete_partner_logo   DELETE  qual       e19d5b7dc3fd05079df6397622a7b2a6
-- Rouvre l'écriture du stockage à tout compte connecté : à ne jouer que pour
-- annuler la migration.
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY partner_logos_admin_insert ON storage.objects;
DROP POLICY partner_logos_admin_update ON storage.objects;
DROP POLICY partner_logos_admin_delete ON storage.objects;

CREATE POLICY admin_upload_partner_logo ON storage.objects FOR INSERT
  WITH CHECK ((bucket_id = 'partner-logos'::text) AND (auth.uid() IS NOT NULL));
CREATE POLICY admin_update_partner_logo ON storage.objects FOR UPDATE
  USING ((bucket_id = 'partner-logos'::text) AND (auth.uid() IS NOT NULL));
CREATE POLICY admin_delete_partner_logo ON storage.objects FOR DELETE
  USING ((bucket_id = 'partner-logos'::text) AND (auth.uid() IS NOT NULL));
