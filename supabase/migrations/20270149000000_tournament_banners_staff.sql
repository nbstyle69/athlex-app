-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « tournament-banners » : dépôt et modification réservés au staff de
-- la box du tournoi (gérant, co-gérant, coach actif) et aux admins
--
-- Appliquée en prod : NON
--
-- Constat en prod, lecture seule (session en default_transaction_read_only et
-- transaction READ ONLY), les 06 et 07/10/2026 — md5 calculés par la base, avec
-- le search_path de la prod "$user", public, extensions :
--   * storage.buckets 'tournament-banners' : public = true, sans limite de
--     taille ni de type ; 6 objets, tous de forme <box_id>/<horodatage>.<ext>,
--     dans une seule box, déposés par son gérant ; public.tournaments : 10
--     lignes, 0 banner_url renseignée (les 6 objets sont orphelins) ;
--     public.inter_competitions : 0 ligne ;
--   * « Authenticated users can upload tournament banners » (INSERT, rôle
--     authenticated, with_check md5 bb48837eee1ecad33bfed90bca199cd2) et
--     « Authenticated users can update tournament banners » (UPDATE, rôle
--     authenticated, qual md5 bb48837e…, sans with_check) :
--     `bucket_id = 'tournament-banners'`. Tout compte connecté dépose ou
--     remplace la bannière de n'importe quelle box, et peut faire entrer dans
--     ce stockage un objet qu'il peut modifier ailleurs (l'UPDATE sans
--     with_check juge la nouvelle ligne avec sa qual) ;
--   * « Public read access for tournament banners » (SELECT, rôle public, qual
--     md5 bb48837e…) : lecture publique des bannières ;
--   * aucune policy DELETE : aucun client ne supprime une bannière ;
--   * public.is_box_admin(uuid) (md5 288f82516d5a94118918ef1ac7292172) :
--     gérant (boxes.owner_id), co-gérant ou coach actif (box_members.role
--     owner ou coach, status active ou NULL), admin ou super_admin ; SECURITY
--     DEFINER, STABLE, search_path public, pg_temp, propriétaire postgres ;
--     c'est déjà le prédicat de `tournaments_box_admin_manage` (qual et
--     with_check md5 0736e320a21a87c57b2a29c5fcb9557d) ;
--   * public.boxes, box_members, profiles : RLS active, non forcée,
--     propriétaire postgres.
-- Le Manager (components/tournaments/TournamentForm.tsx) dépose la bannière
-- depuis le navigateur, avec la session de l'utilisateur, au chemin
-- `<boxId>/<Date.now()>.<ext>` et `upsert: true` ; boxId est la box active à la
-- création, la box du tournoi à la modification. Il ne supprime jamais
-- d'objet. Les compétitions inter-box (super-admin) prennent une URL saisie,
-- sans dépôt. L'app ne fait que lire banner_url.
--
-- Décisions de Nab et de Claude (conception), 07/10/2026 :
--   * chemin imposé `<box_id>/<fichier>` (celui du Manager) ; dépôt et
--     modification : rôle authenticated, et public.is_box_admin du premier
--     dossier du chemin. Le dossier est lu avec split_part et strpos (pas
--     storage.foldername, imité au rejeu) ; sa forme d'uuid est vérifiée dans
--     un CASE avant la conversion : un nom mal formé est refusé, sans erreur
--     SQL ;
--   * la modification juge aussi la nouvelle ligne (WITH CHECK) : une bannière
--     ne change ni de box ni de stockage, et rien n'y entre, hors staff ;
--   * pas de policy DELETE, comme aujourd'hui ;
--   * les deux anciennes policies d'écriture sont supprimées : des policies
--     permissives s'additionnent, en garder une laisserait l'écriture ouverte ;
--   * inchangés : la lecture publique, le stockage public, les policies de
--     public.tournaments, public.is_box_admin. Les 6 objets existants suivent
--     déjà la forme imposée : aucune reprise. Aucun changement de code, ni dans
--     l'app ni dans le Manager.
-- Hors périmètre (noté, pas traité) : limite de taille et de type du stockage,
-- message d'erreur d'envoi brut dans le Manager.
--
-- Pas de récursion : is_box_admin est SECURITY DEFINER, propriété de postgres,
-- qui possède boxes, box_members et profiles (RLS non forcée) : elle les lit
-- sans repasser par leurs policies, et aucune ne lit storage.objects.
--
-- Contrôlée par `supabase/tests/tournament_banners_staff.sql` et par le
-- contrôle S7 de l'audit des droits
-- (scripts/lib/controle-stockage-tournament-banners.mjs).
--
-- Retour arrière (transactionnel, rejoué par le test contre les empreintes de
-- prod du 07/10/2026) :
--
--   psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 \
--     -f supabase/retours/20270149000000_tournament_banners_staff.sql
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY "Authenticated users can upload tournament banners" ON storage.objects;
DROP POLICY "Authenticated users can update tournament banners" ON storage.objects;

CREATE POLICY tournament_banners_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tournament-banners'
    AND strpos(name, '/') > 0
    AND CASE WHEN split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN public.is_box_admin(split_part(name, '/', 1)::uuid)
             ELSE false END
  );

CREATE POLICY tournament_banners_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tournament-banners'
    AND strpos(name, '/') > 0
    AND CASE WHEN split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN public.is_box_admin(split_part(name, '/', 1)::uuid)
             ELSE false END
  )
  WITH CHECK (
    bucket_id = 'tournament-banners'
    AND strpos(name, '/') > 0
    AND CASE WHEN split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN public.is_box_admin(split_part(name, '/', 1)::uuid)
             ELSE false END
  );

COMMIT;
