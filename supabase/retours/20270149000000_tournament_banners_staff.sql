-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270149000000_tournament_banners_staff.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test tournament_banners_staff.sql le rejoue
-- dans sa propre transaction annulée).
--
-- Policies rétablies à l'identique (md5 de pg_get_expr, search_path
-- "$user", public, extensions ; relevés de prod du 07/10/2026, à recontrôler
-- en prod avant l'application) :
--   Authenticated users can upload tournament banners  INSERT  authenticated  with_check bb48837eee1ecad33bfed90bca199cd2
--   Authenticated users can update tournament banners  UPDATE  authenticated  qual       bb48837eee1ecad33bfed90bca199cd2
-- Rouvre l'écriture du stockage à tout compte connecté : à ne jouer que pour
-- annuler la migration.
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY tournament_banners_staff_insert ON storage.objects;
DROP POLICY tournament_banners_staff_update ON storage.objects;

CREATE POLICY "Authenticated users can upload tournament banners" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'tournament-banners'::text));
CREATE POLICY "Authenticated users can update tournament banners" ON storage.objects
  FOR UPDATE TO authenticated USING ((bucket_id = 'tournament-banners'::text));
