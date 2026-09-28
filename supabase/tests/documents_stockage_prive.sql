-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « documents » privé, box_documents fermée aux clients (migration 20270136)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box A : propriétaire OA (…01), membre M1 (…02, auteur d'un document), membre
-- U (…04, auteur d'un document, supprime son compte en D5). Box B : membre M2 (…03).
-- Les droits de la plateforme sur storage.objects et storage.buckets (anon,
-- authenticated, service_role : tous, comme en prod le 28/09/2026) sont reproduits dans la
-- transaction : sans eux, un refus viendrait du droit et non des policies, et
-- le test ne distinguerait rien.
--
--   D1  anon, authenticated sans jeton, l'auteur, le propriétaire de la box et
--       un membre d'une autre box ne listent ni ne lisent aucun objet de
--       `documents` ; contre-exemple : anon lit toujours `avatars` ;
--   D2  l'auteur ne dépose plus, ne modifie ni ne supprime rien dans `documents` ;
--   D3  box_documents : SELECT, INSERT, UPDATE, DELETE refusés par le droit
--       (42501 « permission denied for table ») à anon, à l'auteur et au
--       propriétaire de la box ;
--   D4  contre-exemple : la clé serveur lit toujours les 2 lignes et les 2 objets ;
--   D5  delete_user_account efface toujours les fichiers `documents` du compte
--       supprimé ; sa ligne box_documents reste (auteur à NULL), les fichiers
--       des autres restent ;
--   D6  définitions : stockage privé, aucune policy client sur `documents` ni sur
--       box_documents, RLS active, aucun droit client, service_role inchangé,
--       delete_user_account à son empreinte de prod, lecture de l'audit ;
--   D7  retour arrière de l'en-tête : retour exact aux empreintes de prod du
--       28/09/2026 (7 policies, stockage public, ACL), dans une
--       sous-transaction annulée.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Stockage documents privé, box_documents fermée aux clients'

BEGIN;

GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9dc-0000000000' || s)::uuid FROM unnest(ARRAY['01','02','03','04']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9dc-0000000000' || s)::uuid, 'dsp-' || s || '@test.invalid', 'dsp_' || s
  FROM unnest(ARRAY['01','02','03','04']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9dc-00000000000a', 'Box A', 'DSPA', '00000000-0000-4000-a9dc-000000000001'),
  ('00000000-0000-4000-b9dc-00000000000b', 'Box B', 'DSPB', '00000000-0000-4000-a9dc-000000000003');
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT ('00000000-0000-4000-b9dc-00000000000' || b)::uuid, ('00000000-0000-4000-a9dc-0000000000' || m)::uuid, r, 'active'
  FROM (VALUES ('01', 'a', 'owner'), ('02', 'a', 'member'), ('04', 'a', 'member'), ('03', 'b', 'member')) v(m, b, r);

-- Deux documents (M1 et U), un avatar de M1 pour le contre-exemple.
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('documents', '00000000-0000-4000-a9dc-000000000002/1.pdf', '00000000-0000-4000-a9dc-000000000002'),
  ('documents', '00000000-0000-4000-a9dc-000000000004/2.pdf', '00000000-0000-4000-a9dc-000000000004'),
  ('avatars',   '00000000-0000-4000-a9dc-000000000002/a.png', '00000000-0000-4000-a9dc-000000000002');
INSERT INTO public.box_documents (id, box_id, uploaded_by, title, file_url) VALUES
  ('00000000-0000-4000-c9dc-000000000001', '00000000-0000-4000-b9dc-00000000000a',
   '00000000-0000-4000-a9dc-000000000002', 'Doc 1', 'x/1.pdf'),
  ('00000000-0000-4000-c9dc-000000000002', '00000000-0000-4000-b9dc-00000000000a',
   '00000000-0000-4000-a9dc-000000000004', 'Doc 2', 'x/2.pdf');

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe, « service », « anon » ou
-- « auth0 » = authenticated sans jeton) ; rend « OK », « OK <n> » pour un
-- `SELECT count(*)`, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui IN ('service', 'anon', 'auth0') THEN '' ELSE '00000000-0000-4000-a9dc-0000000000' || p_qui END, true);
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

DO $t$
DECLARE
  v text;
  q text;
  m text;
BEGIN
  -- ── D1 : personne ne liste ni ne lit `documents` ─────────────────────────
  FOREACH m IN ARRAY ARRAY['anon', 'auth0', '02', '01', '03', '04'] LOOP
    v := pg_temp.faire(m, $q$SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents'$q$);
    IF v <> 'OK 0' THEN RAISE EXCEPTION 'D1 : % voit des objets de documents : % (OK 0 attendu)', m, v; END IF;
  END LOOP;
  v := pg_temp.faire('anon', $q$SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'$q$);
  IF v <> 'OK 1' THEN RAISE EXCEPTION 'D1 : anon ne lit plus avatars : % (contre-exemple, OK 1 attendu)', v; END IF;

  -- ── D2 : l'auteur n'écrit plus dans `documents` ──────────────────────────
  v := pg_temp.faire('02', $q$INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('documents', '00000000-0000-4000-a9dc-000000000002/3.pdf', '00000000-0000-4000-a9dc-000000000002')$q$);
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'D2 : M1 dépose dans son dossier : % (42501 attendu)', v; END IF;
  v := pg_temp.faire('02', $q$UPDATE storage.objects SET name = name || '.bak' WHERE bucket_id = 'documents'$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'D2 : UPDATE de M1 : %', v; END IF;
  v := pg_temp.faire('02', $q$DELETE FROM storage.objects WHERE bucket_id = 'documents'$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'D2 : DELETE de M1 : %', v; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name NOT LIKE '%.bak') <> 2 THEN
    RAISE EXCEPTION 'D2 : M1 a modifié ou supprimé un objet de documents';
  END IF;

  -- ── D3 : box_documents fermée par le droit ───────────────────────────────
  FOREACH q IN ARRAY ARRAY[
    'SELECT count(*) FROM public.box_documents',
    $q$INSERT INTO public.box_documents (box_id, uploaded_by, title, file_url) VALUES
       ('00000000-0000-4000-b9dc-00000000000a', '00000000-0000-4000-a9dc-000000000002', 'Nouveau', 'x/3.pdf')$q$,
    $q$UPDATE public.box_documents SET title = 'Modifié' WHERE uploaded_by = '00000000-0000-4000-a9dc-000000000002'$q$,
    $q$DELETE FROM public.box_documents WHERE uploaded_by = '00000000-0000-4000-a9dc-000000000002'$q$
  ] LOOP
    FOREACH m IN ARRAY ARRAY['anon', '02', '01'] LOOP
      v := pg_temp.faire(m, q);
      IF v NOT LIKE '42501: permission denied for table box_documents%' THEN
        RAISE EXCEPTION 'D3 : % : « % » : % (refus du droit attendu)', m, left(q, 40), v;
      END IF;
    END LOOP;
  END LOOP;

  -- ── D4 : la clé serveur lit toujours tout ────────────────────────────────
  v := pg_temp.faire('service', 'SELECT count(*) FROM public.box_documents');
  IF v <> 'OK 2' THEN RAISE EXCEPTION 'D4 : clé serveur sur box_documents : % (OK 2 attendu)', v; END IF;
  v := pg_temp.faire('service', $q$SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents'$q$);
  IF v <> 'OK 2' THEN RAISE EXCEPTION 'D4 : clé serveur sur documents : % (OK 2 attendu)', v; END IF;

  -- ── D5 : la suppression de compte efface toujours ses documents ──────────
  v := pg_temp.faire('04', 'SELECT public.delete_user_account()');
  IF v <> 'OK' THEN RAISE EXCEPTION 'D5 : delete_user_account de U : %', v; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'documents'
              AND name LIKE '00000000-0000-4000-a9dc-000000000004/%') THEN
    RAISE EXCEPTION 'D5 : le fichier documents de U a survécu à la suppression du compte';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'documents'
                  AND name LIKE '00000000-0000-4000-a9dc-000000000002/%') THEN
    RAISE EXCEPTION 'D5 : le fichier documents de M1 a disparu';
  END IF;
  IF (SELECT uploaded_by FROM public.box_documents WHERE id = '00000000-0000-4000-c9dc-000000000002') IS NOT NULL
     OR (SELECT count(*) FROM public.box_documents) <> 2 THEN
    RAISE EXCEPTION 'D5 : lignes box_documents après suppression du compte : attendu 2 lignes, auteur de U à NULL';
  END IF;

  RAISE NOTICE 'stockage documents : D1 à D5 conformes';
END $t$;

-- ── D6 : définitions ─────────────────────────────────────────────────────────
-- Le search_path de la prod : pg_get_expr et pg_get_functiondef qualifient
-- sinon autrement, et les empreintes ne se comparent plus.
SET LOCAL search_path TO "$user", public, extensions;

DO $t$
DECLARE v text;
BEGIN
  IF (SELECT public FROM storage.buckets WHERE id = 'documents') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'D6 : le stockage documents n''est pas privé';
  END IF;

  SELECT string_agg(polname, ', ') INTO v FROM pg_policy
   WHERE polrelid = 'storage.objects'::regclass
     AND (coalesce(pg_get_expr(polqual, polrelid), '') || coalesce(pg_get_expr(polwithcheck, polrelid), '')) LIKE '%''documents''%';
  IF v IS NOT NULL THEN RAISE EXCEPTION 'D6 : policies encore posées sur documents : %', v; END IF;

  SELECT string_agg(polname, ', ') INTO v FROM pg_policy WHERE polrelid = 'public.box_documents'::regclass;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'D6 : policies encore posées sur box_documents : %', v; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_documents'::regclass) THEN
    RAISE EXCEPTION 'D6 : RLS désactivée sur box_documents';
  END IF;

  SELECT string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ', ') INTO v
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE c.oid = 'public.box_documents'::regclass AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole);
  IF v IS NOT NULL THEN RAISE EXCEPTION 'D6 : droits client sur box_documents : %', v; END IF;

  IF NOT (has_table_privilege('service_role', 'public.box_documents', 'SELECT')
          AND has_table_privilege('service_role', 'public.box_documents', 'INSERT')
          AND has_table_privilege('service_role', 'public.box_documents', 'UPDATE')
          AND has_table_privilege('service_role', 'public.box_documents', 'DELETE')) THEN
    RAISE EXCEPTION 'D6 : service_role a perdu un droit sur box_documents';
  END IF;

  v := md5(pg_get_functiondef('public.delete_user_account()'::regprocedure));
  IF v <> 'f891e2df88f9c57d8802a3b17e9128bb' THEN
    RAISE EXCEPTION 'D6 : delete_user_account modifiée (md5 %, prod f891e2df88f9c57d8802a3b17e9128bb)', v;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athlex_audit_ro') AND NOT (
       has_schema_privilege('athlex_audit_ro', 'storage', 'USAGE')
       AND has_column_privilege('athlex_audit_ro', 'storage.buckets', 'public', 'SELECT')
       AND NOT has_table_privilege('athlex_audit_ro', 'storage.buckets', 'SELECT')
       AND EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'storage.buckets'::regclass
                     AND polname = 'buckets_select_audit_ro'
                     AND polroles = ARRAY['athlex_audit_ro'::regrole::oid])) THEN
    RAISE EXCEPTION 'D6 : lecture de storage.buckets par athlex_audit_ro absente ou trop large';
  END IF;

  RAISE NOTICE 'stockage documents : D6 conforme';
END $t$;

-- ── D7 : retour arrière de l'en-tête, contre les empreintes de prod ─────────
DO $t$
DECLARE v text;
BEGIN
  BEGIN
    UPDATE storage.buckets SET public = true WHERE id = 'documents';
    CREATE POLICY public_read_documents ON storage.objects FOR SELECT
      USING (bucket_id = 'documents'::text);
    CREATE POLICY documents_insert_own ON storage.objects FOR INSERT TO authenticated
      WITH CHECK ((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
    CREATE POLICY documents_delete_own ON storage.objects FOR DELETE TO authenticated
      USING ((bucket_id = 'documents'::text) AND ((owner = auth.uid()) OR ((storage.foldername(name))[1] = (auth.uid())::text)));
    CREATE POLICY delete_own_documents ON public.box_documents FOR DELETE
      USING (auth.uid() = uploaded_by);
    CREATE POLICY documents_member_read ON public.box_documents FOR SELECT
      USING ((auth.uid() IS NOT NULL) AND (((box_id IS NULL) AND (uploaded_by = auth.uid()))
        OR (box_id IN (SELECT public.get_user_box_ids() AS get_user_box_ids)) OR (uploaded_by = auth.uid())));
    CREATE POLICY insert_box_documents ON public.box_documents FOR INSERT
      WITH CHECK ((auth.uid() = uploaded_by) AND ((box_id IS NULL)
        OR (box_id IN (SELECT public.get_user_box_ids() AS get_user_box_ids)) OR public.is_box_admin(box_id)));
    CREATE POLICY read_box_documents ON public.box_documents FOR SELECT
      USING ((auth.uid() IS NOT NULL) AND (((box_id IS NULL) AND (uploaded_by = auth.uid()))
        OR (box_id IN (SELECT box_members.box_id FROM public.box_members WHERE (box_members.member_id = auth.uid())))
        OR (uploaded_by = auth.uid())));
    GRANT SELECT, MAINTAIN ON public.box_documents TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON public.box_documents TO authenticated;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athlex_audit_ro') THEN
      DROP POLICY buckets_select_audit_ro ON storage.buckets;
      REVOKE SELECT (id, public) ON storage.buckets FROM athlex_audit_ro;
      REVOKE USAGE ON SCHEMA storage FROM athlex_audit_ro;
    END IF;

    -- Empreintes relevées en prod le 28/09/2026 (étape 1) : nom, commande, rôles, md5 qual, md5 with_check.
    SELECT string_agg(e, E'\n' ORDER BY e) INTO v FROM (
      SELECT p.polname || '|' || p.polcmd::text || '|'
             || array_to_string(array(SELECT CASE WHEN r = 0 THEN 'public' ELSE r::regrole::text END
                                        FROM unnest(p.polroles) r ORDER BY 1), ',') || '|'
             || md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '')) || '|'
             || md5(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) AS e
        FROM pg_policy p
       WHERE p.polrelid = 'public.box_documents'::regclass
          OR (p.polrelid = 'storage.objects'::regclass
              AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
                   || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) LIKE '%''documents''%')
    ) s;
    IF v IS DISTINCT FROM concat_ws(E'\n',
         'delete_own_documents|d|public|79c1ca051b48bf299d7c30e763588129|d41d8cd98f00b204e9800998ecf8427e',
         'documents_delete_own|d|authenticated|610eb83f5149310f41aa4e2a66a0d854|d41d8cd98f00b204e9800998ecf8427e',
         'documents_insert_own|a|authenticated|d41d8cd98f00b204e9800998ecf8427e|9e545a323e57db45e255e31b220b7f0b',
         'documents_member_read|r|public|f8ef5eca3ac932ab268bb92489716ede|d41d8cd98f00b204e9800998ecf8427e',
         'insert_box_documents|a|public|d41d8cd98f00b204e9800998ecf8427e|ebaaa7fa1d14a7e1f16f10c7fc8ce696',
         'public_read_documents|r|public|e0811ac08942a9f37a1e016937b57a3c|d41d8cd98f00b204e9800998ecf8427e',
         'read_box_documents|r|public|830c3b3e413d0d77e7ca370c2b1a7f7c|d41d8cd98f00b204e9800998ecf8427e') THEN
      RAISE EXCEPTION 'D7 : policies après retour arrière ≠ prod :%', E'\n' || coalesce(v, '(aucune)');
    END IF;

    IF (SELECT public FROM storage.buckets WHERE id = 'documents') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'D7 : stockage non redevenu public';
    END IF;

    SELECT string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' ORDER BY a.grantee::regrole::text, a.privilege_type) INTO v
      FROM pg_class c, aclexplode(c.relacl) a
     WHERE c.oid = 'public.box_documents'::regclass AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole);
    IF v IS DISTINCT FROM 'anon:MAINTAIN,anon:SELECT,authenticated:DELETE,authenticated:INSERT,authenticated:MAINTAIN,authenticated:SELECT,authenticated:UPDATE' THEN
      RAISE EXCEPTION 'D7 : ACL après retour arrière ≠ prod (anon=rm, authenticated=arwdm) : %', v;
    END IF;

    RAISE EXCEPTION USING ERRCODE = 'P0D07', MESSAGE = 'retour arrière conforme';
  EXCEPTION WHEN SQLSTATE 'P0D07' THEN
    RAISE NOTICE 'stockage documents : D7 conforme (retour arrière annulé)';
  END;

  -- La sous-transaction est bien annulée : l'état de la migration est revenu.
  IF (SELECT public FROM storage.buckets WHERE id = 'documents') IS DISTINCT FROM false
     OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.box_documents'::regclass) THEN
    RAISE EXCEPTION 'D7 : le retour arrière n''a pas été annulé';
  END IF;
END $t$;

ROLLBACK;
