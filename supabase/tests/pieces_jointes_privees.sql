-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « message-attachments » privé (migration 20270137)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box A : propriétaire OA (…01, owner_id), co-gérant KO (…02, rôle owner, membre
-- d'aucun groupe), M1 (…03), M2 (…04), V (…05, auteur de fichiers d'anciens
-- builds). Box B : MB (…06).
-- Groupes : G1 (A : OA, M1, M2, V), G2 « Coachs » (A : M1), G3 (A : M2, aucun
-- message), GB (B : MB).
-- Objets :
--   o1  G1/<M1>_1.png   cité par un message de G1 sous forme d'URL publique
--   o2  G2/<M1>_2.png   cité par un message de G2 sous forme de chemin
--   o3  <V>_legacy.png  chemin plat, cité par un message de G1 (URL publique)
--   o4  <V>_old.png     chemin plat, cité par la seule ancienne table messages
--   o5  G3/<M2>_p.png   déposé, pas encore de message
-- Les droits de la plateforme sur storage.objects et storage.buckets (anon,
-- authenticated, service_role : tous, comme en prod) sont reproduits dans la
-- transaction : sans eux, un refus viendrait du droit et non des policies.
--
--   P1  lecture : la matrice complète (anon, autre box, co-gérant non membre,
--       membres, propriétaire de la box, auteur), pour un message en URL publique
--       et pour un message en chemin, un fichier plat cité par un message de
--       groupe, un fichier cité par la seule ancienne table, un fichier sans
--       message encore ;
--   P2  dépôt : accepté dans un groupe dont on est membre avec son uid ; refusé
--       hors de ses groupes, avec l'uid d'un autre, au chemin plat, pour un
--       co-gérant non membre et pour anon ;
--   P3  aucune modification ni suppression par un client ;
--   P4  delete_user_account efface toujours les pièces jointes du compte ;
--   P5  définitions : stockage privé, anciennes policies absentes, les deux
--       nouvelles épinglées, delete_user_account à son empreinte de prod ;
--   P6  retour arrière de l'en-tête : retour exact aux empreintes de prod du
--       28/09/2026, dans une sous-transaction annulée.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Stockage message-attachments privé'

BEGIN;

GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9ec-0000000000' || s)::uuid FROM unnest(ARRAY['01','02','03','04','05','06']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9ec-0000000000' || s)::uuid, 'pjp-' || s || '@test.invalid', 'pjp_' || s
  FROM unnest(ARRAY['01','02','03','04','05','06']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9ec-00000000000a', 'Box A', 'PJPA', '00000000-0000-4000-a9ec-000000000001'),
  ('00000000-0000-4000-b9ec-00000000000b', 'Box B', 'PJPB', '00000000-0000-4000-a9ec-000000000006');
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT ('00000000-0000-4000-b9ec-00000000000' || b)::uuid, ('00000000-0000-4000-a9ec-0000000000' || m)::uuid, r, 'active'
  FROM (VALUES ('01', 'a', 'owner'), ('02', 'a', 'owner'), ('03', 'a', 'member'), ('04', 'a', 'member'),
               ('05', 'a', 'member'), ('06', 'b', 'owner')) v(m, b, r);
INSERT INTO public.message_groups (id, box_id, name, members) VALUES
  ('00000000-0000-4000-99ec-0000000000a1', '00000000-0000-4000-b9ec-00000000000a', 'Général',
   ARRAY['00000000-0000-4000-a9ec-000000000001', '00000000-0000-4000-a9ec-000000000003',
         '00000000-0000-4000-a9ec-000000000004', '00000000-0000-4000-a9ec-000000000005']::uuid[]),
  ('00000000-0000-4000-99ec-0000000000a2', '00000000-0000-4000-b9ec-00000000000a', 'Coachs',
   ARRAY['00000000-0000-4000-a9ec-000000000003']::uuid[]),
  ('00000000-0000-4000-99ec-0000000000a3', '00000000-0000-4000-b9ec-00000000000a', 'Nouveau',
   ARRAY['00000000-0000-4000-a9ec-000000000004']::uuid[]),
  ('00000000-0000-4000-99ec-0000000000b1', '00000000-0000-4000-b9ec-00000000000b', 'Box B',
   ARRAY['00000000-0000-4000-a9ec-000000000006']::uuid[]);

-- Nom des objets, par clé courte.
CREATE FUNCTION pg_temp.o(k text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE k
    WHEN 'o1' THEN '00000000-0000-4000-99ec-0000000000a1/00000000-0000-4000-a9ec-000000000003_1.png'
    WHEN 'o2' THEN '00000000-0000-4000-99ec-0000000000a2/00000000-0000-4000-a9ec-000000000003_2.png'
    WHEN 'o3' THEN '00000000-0000-4000-a9ec-000000000005_legacy.png'
    WHEN 'o4' THEN '00000000-0000-4000-a9ec-000000000005_old.png'
    WHEN 'o5' THEN '00000000-0000-4000-99ec-0000000000a3/00000000-0000-4000-a9ec-000000000004_p.png'
  END
$$;

INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'message-attachments', pg_temp.o(k), ('00000000-0000-4000-a9ec-0000000000' || u)::uuid
  FROM (VALUES ('o1', '03'), ('o2', '03'), ('o3', '05'), ('o4', '05'), ('o5', '04')) v(k, u);

INSERT INTO public.group_messages (group_id, sender_id, content, attachment_url) VALUES
  ('00000000-0000-4000-99ec-0000000000a1', '00000000-0000-4000-a9ec-000000000003', '📷 Image',
   'https://prod.supabase.co/storage/v1/object/public/message-attachments/' || pg_temp.o('o1')),
  ('00000000-0000-4000-99ec-0000000000a2', '00000000-0000-4000-a9ec-000000000003', '📷 Image', pg_temp.o('o2')),
  ('00000000-0000-4000-99ec-0000000000a1', '00000000-0000-4000-a9ec-000000000005', '📷 Image',
   'https://prod.supabase.co/storage/v1/object/public/message-attachments/' || pg_temp.o('o3')),
  ('00000000-0000-4000-99ec-0000000000b1', '00000000-0000-4000-a9ec-000000000006', 'Bonjour', NULL);
INSERT INTO public.messages (box_id, sender_id, content, message_type, attachment_url) VALUES
  ('00000000-0000-4000-b9ec-00000000000a', '00000000-0000-4000-a9ec-000000000005', '📷 Image', 'general',
   'https://prod.supabase.co/storage/v1/object/public/message-attachments/' || pg_temp.o('o4'));

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe, « service » ou « anon ») ;
-- rend « OK », « OK <n> » pour un `SELECT count(*)`, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui IN ('service', 'anon') THEN '' ELSE '00000000-0000-4000-a9ec-0000000000' || p_qui END, true);
  PERFORM set_config('request.jwt.claim.role',
    CASE p_qui WHEN 'service' THEN 'service_role' WHEN 'anon' THEN 'anon' ELSE 'authenticated' END, true);
  PERFORM set_config('role',
    CASE p_qui WHEN 'service' THEN 'service_role' WHEN 'anon' THEN 'anon' ELSE 'authenticated' END, true);
  BEGIN
    IF p_sql ILIKE 'select count(*)%' THEN
      EXECUTE p_sql INTO n;
      v := 'OK ' || n;
    ELSE
      EXECUTE p_sql;
    END IF;
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v;
END $$;

-- `p_qui` voit-il l'objet `k` ?
CREATE FUNCTION pg_temp.voit(p_qui text, k text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format(
    'SELECT count(*) FROM storage.objects WHERE bucket_id = %L AND name = %L', 'message-attachments', pg_temp.o(k)));
$$;

DO $t$
DECLARE
  v text;
  r record;
BEGIN
  -- ── P1 : lecture ─────────────────────────────────────────────────────────
  -- (identité, objet, attendu) ; 1 = voit, 0 = ne voit pas.
  FOR r IN SELECT * FROM (VALUES
    ('anon', 'o1', 0), ('anon', 'o2', 0), ('anon', 'o3', 0), ('anon', 'o4', 0), ('anon', 'o5', 0),
    ('06',   'o1', 0), ('06',   'o2', 0), ('06',   'o3', 0), ('06',   'o4', 0), ('06',   'o5', 0),
    ('02',   'o1', 0), ('02',   'o2', 0), ('02',   'o3', 0), ('02',   'o4', 0), ('02',   'o5', 0),
    ('03',   'o1', 1), ('03',   'o2', 1), ('03',   'o3', 1), ('03',   'o4', 0), ('03',   'o5', 0),
    ('04',   'o1', 1), ('04',   'o2', 0), ('04',   'o3', 1), ('04',   'o4', 0), ('04',   'o5', 1),
    ('05',   'o1', 1), ('05',   'o2', 0), ('05',   'o3', 1), ('05',   'o4', 1), ('05',   'o5', 0),
    ('01',   'o1', 1), ('01',   'o2', 1), ('01',   'o3', 1), ('01',   'o4', 0), ('01',   'o5', 0)
  ) t(qui, k, attendu) LOOP
    v := pg_temp.voit(r.qui, r.k);
    IF v <> 'OK ' || r.attendu THEN
      RAISE EXCEPTION 'P1 : % sur % : % (OK % attendu)', r.qui, r.k, v, r.attendu;
    END IF;
  END LOOP;

  -- ── P2 : dépôt ───────────────────────────────────────────────────────────
  v := pg_temp.faire('04', format($q$INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('message-attachments', %L, '00000000-0000-4000-a9ec-000000000004')$q$,
    '00000000-0000-4000-99ec-0000000000a1/00000000-0000-4000-a9ec-000000000004_new.png'));
  IF v <> 'OK' THEN RAISE EXCEPTION 'P2 : M2 dans G1 avec son uid refusé : %', v; END IF;

  FOR r IN SELECT * FROM (VALUES
    ('04', '00000000-0000-4000-99ec-0000000000a2/00000000-0000-4000-a9ec-000000000004_x.png', 'hors de ses groupes'),
    ('04', '00000000-0000-4000-99ec-0000000000a1/00000000-0000-4000-a9ec-000000000003_x.png', 'uid d''un autre'),
    ('04', '00000000-0000-4000-a9ec-000000000004_flat.png', 'chemin plat'),
    ('04', '00000000-0000-4000-99ec-0000000000a1/00000000-0000-4000-a9ec-000000000004x.png', 'uid sans séparateur'),
    ('02', '00000000-0000-4000-99ec-0000000000a1/00000000-0000-4000-a9ec-000000000002_x.png', 'co-gérant non membre'),
    ('anon', '00000000-0000-4000-99ec-0000000000a1/x.png', 'anon')
  ) t(qui, nom, cas) LOOP
    v := pg_temp.faire(r.qui, format($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('message-attachments', %L)$q$, r.nom));
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P2 : dépôt %, % : % (42501 attendu)', r.cas, r.qui, v; END IF;
  END LOOP;

  -- ── P3 : ni modification ni suppression ──────────────────────────────────
  v := pg_temp.faire('04', $q$DELETE FROM storage.objects WHERE bucket_id = 'message-attachments'$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'P3 : DELETE de M2 : %', v; END IF;
  v := pg_temp.faire('03', $q$UPDATE storage.objects SET name = name || '.bak' WHERE bucket_id = 'message-attachments'$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'P3 : UPDATE de M1 : %', v; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'message-attachments' AND name NOT LIKE '%.bak') <> 6 THEN
    RAISE EXCEPTION 'P3 : un client a modifié ou supprimé une pièce jointe';
  END IF;

  -- ── P4 : la suppression de compte efface les pièces jointes de l'auteur ──
  v := pg_temp.faire('05', 'SELECT public.delete_user_account()');
  IF v <> 'OK' THEN RAISE EXCEPTION 'P4 : delete_user_account de V : %', v; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'message-attachments' AND name IN (pg_temp.o('o3'), pg_temp.o('o4'))) THEN
    RAISE EXCEPTION 'P4 : une pièce jointe de V a survécu à la suppression du compte';
  END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'message-attachments') <> 4 THEN
    RAISE EXCEPTION 'P4 : la suppression du compte de V a emporté les pièces jointes des autres';
  END IF;

  RAISE NOTICE 'pièces jointes : P1 à P4 conformes';
END $t$;

-- ── P5 : définitions ─────────────────────────────────────────────────────────
SET LOCAL search_path TO "$user", public, extensions;

DO $t$
DECLARE v text;
BEGIN
  IF (SELECT public FROM storage.buckets WHERE id = 'message-attachments') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'P5 : le stockage message-attachments n''est pas privé';
  END IF;

  SELECT string_agg(p.polname || '|' || p.polcmd::text || '|'
           || array_to_string(array(SELECT CASE WHEN r = 0 THEN 'public' ELSE r::regrole::text END
                                      FROM unnest(p.polroles) r ORDER BY 1), ',') || '|'
           || md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '')) || '|'
           || md5(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')), E'\n' ORDER BY p.polname) INTO v
    FROM pg_policy p
   WHERE p.polrelid = 'storage.objects'::regclass
     AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
          || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) LIKE '%message-attachments%';
  IF v IS DISTINCT FROM concat_ws(E'\n',
       'message_attachments_depot|a|authenticated|d41d8cd98f00b204e9800998ecf8427e|20c0111a62db482996558a65a414e133',
       'message_attachments_lecture|r|authenticated|2050adb5902790d5705f30c4f11d6885|d41d8cd98f00b204e9800998ecf8427e') THEN
    RAISE EXCEPTION 'P5 : policies de message-attachments :%', E'\n' || coalesce(v, '(aucune)');
  END IF;

  v := md5(pg_get_functiondef('public.delete_user_account()'::regprocedure));
  IF v <> 'f891e2df88f9c57d8802a3b17e9128bb' THEN
    RAISE EXCEPTION 'P5 : delete_user_account modifiée (md5 %)', v;
  END IF;

  RAISE NOTICE 'pièces jointes : P5 conforme';
END $t$;

-- ── P6 : retour arrière de l'en-tête, contre les empreintes de prod ─────────
DO $t$
DECLARE v text;
BEGIN
  BEGIN
    UPDATE storage.buckets SET public = true WHERE id = 'message-attachments';
    DROP POLICY message_attachments_lecture ON storage.objects;
    DROP POLICY message_attachments_depot ON storage.objects;
    CREATE POLICY public_read_attachments ON storage.objects FOR SELECT
      USING (bucket_id = 'message-attachments'::text);
    CREATE POLICY auth_upload_attachments ON storage.objects FOR INSERT
      WITH CHECK ((bucket_id = 'message-attachments'::text) AND (auth.uid() IS NOT NULL));

    SELECT string_agg(p.polname || '|' || p.polcmd::text || '|'
             || array_to_string(array(SELECT CASE WHEN r = 0 THEN 'public' ELSE r::regrole::text END
                                        FROM unnest(p.polroles) r ORDER BY 1), ',') || '|'
             || md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '')) || '|'
             || md5(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')), E'\n' ORDER BY p.polname) INTO v
      FROM pg_policy p
     WHERE p.polrelid = 'storage.objects'::regclass
       AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
            || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) LIKE '%message-attachments%';
    IF v IS DISTINCT FROM concat_ws(E'\n',
         'auth_upload_attachments|a|public|d41d8cd98f00b204e9800998ecf8427e|768135bdeb61f65d61dbddb863061a7c',
         'public_read_attachments|r|public|3de7fe4413b0a6e531037057217a2f3b|d41d8cd98f00b204e9800998ecf8427e') THEN
      RAISE EXCEPTION 'P6 : policies après retour arrière ≠ prod :%', E'\n' || coalesce(v, '(aucune)');
    END IF;
    IF (SELECT public FROM storage.buckets WHERE id = 'message-attachments') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'P6 : stockage non redevenu public';
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0P06', MESSAGE = 'retour arrière conforme';
  EXCEPTION WHEN SQLSTATE 'P0P06' THEN
    RAISE NOTICE 'pièces jointes : P6 conforme (retour arrière annulé)';
  END;

  IF (SELECT public FROM storage.buckets WHERE id = 'message-attachments') IS DISTINCT FROM false
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'storage.objects'::regclass
                     AND polname = 'message_attachments_lecture') THEN
    RAISE EXCEPTION 'P6 : le retour arrière n''a pas été annulé';
  END IF;
END $t$;

ROLLBACK;
