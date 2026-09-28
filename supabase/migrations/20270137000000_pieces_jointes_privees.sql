-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « message-attachments » privé : une pièce jointe se lit comme le
-- message qui la porte
--
-- Appliquée en prod : OUI, le 28/09/2026 à 22:07 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public, internal et storage avec droits
-- db-dumps/2026-09-28/athlex-prod-public-internal-storage-20260928T220703Z.dump,
-- sha256 2244202c291d6b4154389eb19abe6201a6397f4f7b9c1f568b3c7ce39414feba vérifié
-- après aller-retour, 142 TABLE DATA, 458 ACL, 374 POLICY ; précontrôle (md5
-- calculés avec le search_path de la prod) : stockage public, public_read_attachments
-- 3de7fe44… et auth_upload_attachments 768135bd…, delete_user_account f891e2df…,
-- 2 objets, 16 messages de groupe dont 2 avec pièce jointe (comme à l'inventaire) ;
-- vérifications : stockage privé, anciennes policies absentes,
-- message_attachments_lecture 2050adb5… et message_attachments_depot 20c0111a…,
-- réservées à authenticated, identiques au rejeu ; anon = 0 et authenticated sans
-- jeton = 0 ; objets et messages identiques (md5 cdd17c32… et c411cf81…
-- avant/après) ; audit des droits grants-prod.yml 35/35, S1 à S5 compris.)
--
-- Constat en prod, lecture seule, le 28/09/2026 (md5 calculés par la base, avec
-- le search_path de la prod "$user", public, extensions) :
--   * storage.buckets 'message-attachments' : public = true. Toute URL
--     `/object/public/message-attachments/<chemin>` sert l'image sans compte ;
--   * `public_read_attachments` (SELECT, rôle public, qual md5
--     3de7fe4413b0a6e531037057217a2f3b) : `bucket_id = 'message-attachments'`
--     sans autre condition. anon listait et lisait les 2 objets ;
--   * `auth_upload_attachments` (INSERT, rôle public, with_check md5
--     768135bdeb61f65d61dbddb863061a7c) : tout compte connecté déposait
--     n'importe où dans le stockage ;
--   * aucune policy UPDATE ni DELETE (seules la clé serveur et
--     delete_user_account suppriment).
-- Données : 2 objets, tous deux au chemin plat (anciens builds, avant le
-- 04/08/2026) : l'un cité par un message de groupe (URL publique), l'autre par
-- la seule ancienne table `messages`, que l'app ne lit plus.
--
-- Décisions de Nab et de Claude (conception), 28/09/2026 :
--   * lecture, rôle authenticated :
--       - l'auteur du fichier (owner) : l'expéditeur voit son image avant
--         l'insertion du message ;
--       - quiconque peut lire un message du groupe dont le premier dossier porte
--         l'identifiant. La requête sur group_messages s'exécute avec les droits
--         de l'appelant : c'est la RLS des messages qui décide (membre du
--         groupe, ou propriétaire de la box), sans recopier sa logique ni passer
--         par une fonction SECURITY DEFINER. La règle de lecture d'un message ne
--         dépend que de son groupe : lire un message du groupe, c'est pouvoir
--         lire celui qui cite le fichier. Un co-gérant ne lit donc que les
--         groupes dont il est membre, comme pour les messages ;
--       - fichier au chemin plat (anciens builds) : quiconque peut lire le
--         message de groupe qui le cite, sous l'une des deux formes enregistrées
--         (chemin nu, ou URL publique qui se termine par
--         `/message-attachments/<chemin>`) ;
--       - un fichier cité par la seule ancienne table `messages` reste lisible
--         par son auteur et par la clé serveur, pas par les membres ;
--   * dépôt, rôle authenticated : premier dossier = un groupe dont l'appelant
--     est membre (vue message_group_members, déjà utilisée par les policies de
--     group_messages), nom de fichier commençant par son uid ; c'est le chemin
--     `<group_id>/<uid>_<ts>_<aléa>.<ext>` de l'app depuis le Lot 1C-c ;
--   * suppression : aucune policy client, comme avant.
--
-- Pas de récursion : aucune policy de group_messages ni de message_groups, ni
-- la vue message_group_members, ne lit storage.objects. Le premier dossier
-- n'est converti en uuid que s'il en a la forme : la recherche passe par
-- l'index idx_group_messages_group_id (group_id, created_at). Le dossier est lu
-- par split_part / strpos plutôt que storage.foldername, dont le rejeu n'a
-- qu'une imitation (elle garde le nom du fichier) : la règle se juge pareil
-- sur le rejeu et en prod.
--
-- Remplace, pour `message-attachments`, la partie jamais appliquée de
-- migrations_archive/20260820_lot1c_c_buckets_prives.sql.
--
-- Inchangé : public.delete_user_account() (md5 f891e2df88f9c57d8802a3b17e9128bb),
-- qui efface les objets `message-attachments` dont le compte est l'auteur.
--
-- Contrôlée par `supabase/tests/pieces_jointes_privees.sql` et par les
-- contrôles S4 et S5 de l'audit des droits
-- (scripts/lib/controle-stockage-pieces-jointes.mjs).
--
-- Retour arrière (transactionnel, vérifié sur le rejeu contre les empreintes de
-- prod du 28/09/2026) :
--
--   BEGIN;
--   UPDATE storage.buckets SET public = true WHERE id = 'message-attachments';
--   DROP POLICY message_attachments_lecture ON storage.objects;
--   DROP POLICY message_attachments_depot ON storage.objects;
--   -- 3de7fe4413b0a6e531037057217a2f3b
--   CREATE POLICY public_read_attachments ON storage.objects FOR SELECT
--     USING (bucket_id = 'message-attachments'::text);
--   -- with_check 768135bdeb61f65d61dbddb863061a7c
--   CREATE POLICY auth_upload_attachments ON storage.objects FOR INSERT
--     WITH CHECK ((bucket_id = 'message-attachments'::text) AND (auth.uid() IS NOT NULL));
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'message-attachments';

-- Définitions en prod : voir l'en-tête (retour arrière).
DROP POLICY public_read_attachments ON storage.objects;
DROP POLICY auth_upload_attachments ON storage.objects;

CREATE POLICY message_attachments_lecture ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.group_messages m
        WHERE m.group_id = CASE
          WHEN split_part(objects.name, '/', 1)
               ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND strpos(objects.name, '/') > 0
          THEN split_part(objects.name, '/', 1)::uuid
        END
      )
      OR (
        strpos(objects.name, '/') = 0
        AND EXISTS (
          SELECT 1 FROM public.group_messages m
          WHERE m.attachment_url = objects.name
             OR right(m.attachment_url, length('/message-attachments/' || objects.name))
                = '/message-attachments/' || objects.name
        )
      )
    )
  );

CREATE POLICY message_attachments_depot ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND split_part(name, '/', 1) IN (
      SELECT g.group_id::text FROM public.message_group_members g
      WHERE g.member_id = auth.uid()
    )
    AND split_part(name, '/', 2) LIKE auth.uid()::text || '\_%'
  );

COMMIT;
