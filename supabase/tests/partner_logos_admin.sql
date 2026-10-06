-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « partner-logos » : écriture réservée aux admins (migration 20270148)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, après le
-- rejeu complet des migrations : les policies et le trigger de public.profiles
-- sont ceux de la prod (empreintes vérifiées en P5).
-- Comptes : M (…01, membre), G (…02, gérant d'une box, role box_owner),
-- A (…03, admin), SA (…04, super_admin).
-- Objets : l1 « logo-1.png » et l2 « logo-2.png » dans partner-logos ; av,
-- l'avatar de M (« <M>/a.png ») dans avatars.
-- Les droits de la plateforme sur storage.objects et storage.buckets (anon,
-- authenticated, service_role : tous, comme en prod) et l'index unique
-- (bucket_id, name) de la prod sont reproduits dans la transaction : sans eux,
-- un refus viendrait du droit et non des policies, et l'upsert n'aurait pas de
-- conflit à résoudre.
--
--   P0  l'admin lit son propre rôle sous RLS : profiles a la RLS active,
--       authenticated ne la contourne pas, A et SA voient leur ligne admin, M et
--       G ne se voient pas admin ; et si la lecture de profiles leur était
--       refusée, le dépôt de A serait refusé (le prédicat passe bien par RLS) ;
--   P1  lecture des logos par tous, anon compris ;
--   P2  dépôt : accepté pour A et SA, refusé pour M, G et anon ; upsert
--       (INSERT … ON CONFLICT DO UPDATE, le chemin `upsert: true` du Manager)
--       accepté pour A, refusé pour M ;
--   P3  modification : aucune pour M, G, anon ; acceptée pour A ; aucun objet
--       ne sort du stockage (A vers avatars) ni n'y entre (M depuis son avatar) ;
--   P4  suppression : aucune pour M, G, anon ; acceptée pour SA ;
--   P5  définitions : anciennes policies absentes, nouvelles épinglées, lecture,
--       stockage public, admin_manage_partners et prevent_role_escalation à leur
--       empreinte de prod ;
--   P6  retour arrière (supabase/retours/20270148000000_partner_logos_admin.sql) :
--       retour exact aux empreintes de prod du 06/10/2026, et M y redépose
--       (contre-exemple) ; annulé avec la transaction.
-- Chaque refus est prouvé par un comptage, pas par le seul code d'erreur : un
-- UPDATE ou un DELETE filtré par la RLS rend « OK » sans rien toucher.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Stockage partner-logos réservé aux admins'

BEGIN;

GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE UNIQUE INDEX plg_bucketid_objname ON storage.objects (bucket_id, name);

INSERT INTO storage.buckets (id, name, public) VALUES
  ('partner-logos', 'partner-logos', true), ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9fd-0000000000' || s)::uuid FROM unnest(ARRAY['01','02','03','04']) s;
INSERT INTO public.profiles (id, email, username, role)
SELECT ('00000000-0000-4000-a9fd-0000000000' || s)::uuid, 'plg-' || s || '@test.invalid', 'plg_' || s, r
  FROM (VALUES ('01', 'member'), ('02', 'box_owner'), ('03', 'admin'), ('04', 'super_admin')) v(s, r);
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9fd-00000000000a', 'Box PLG', 'PLGA', '00000000-0000-4000-a9fd-000000000002');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9fd-00000000000a', '00000000-0000-4000-a9fd-000000000002', 'owner', 'active'),
  ('00000000-0000-4000-b9fd-00000000000a', '00000000-0000-4000-a9fd-000000000001', 'member', 'active');

INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
  ('partner-logos', 'logo-1.png', '{"v": 1}'),
  ('partner-logos', 'logo-2.png', '{"v": 1}');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('avatars', '00000000-0000-4000-a9fd-000000000001/a.png', '00000000-0000-4000-a9fd-000000000001');

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe ou « anon ») ; rend « OK »,
-- « OK <n> » pour un `SELECT count(*)`, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui = 'anon' THEN '' ELSE '00000000-0000-4000-a9fd-0000000000' || p_qui END, true);
  PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'anon' THEN 'anon' ELSE 'authenticated' END, true);
  PERFORM set_config('role', CASE p_qui WHEN 'anon' THEN 'anon' ELSE 'authenticated' END, true);
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

-- Nombre d'objets du stockage (vu par le superutilisateur, hors RLS).
CREATE FUNCTION pg_temp.n(p_bucket text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM storage.objects WHERE bucket_id = p_bucket;
$$;

DO $t$
DECLARE
  v text;
  r record;
BEGIN
  -- Les rôles semés sont bien ceux attendus (le trigger de profiles laisse
  -- passer le superutilisateur).
  IF (SELECT string_agg(role, ',' ORDER BY id) FROM public.profiles
       WHERE id::text LIKE '00000000-0000-4000-a9fd-%') <> 'member,box_owner,admin,super_admin' THEN
    RAISE EXCEPTION 'semis : rôles des comptes de test inattendus';
  END IF;

  -- ── P0 : l'admin lit son propre rôle sous RLS ─────────────────────────────
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass) THEN
    RAISE EXCEPTION 'P0 : la RLS de public.profiles n''est pas active';
  END IF;
  IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'P0 : authenticated contourne la RLS';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('01', 0), ('02', 0), ('03', 1), ('04', 1)) t(qui, attendu) LOOP
    v := pg_temp.faire(r.qui, $q$SELECT count(*) FROM public.profiles
      WHERE id = auth.uid() AND role = ANY (ARRAY['super_admin', 'admin'])$q$);
    IF v <> 'OK ' || r.attendu THEN
      RAISE EXCEPTION 'P0 : % lit son rôle admin : % (OK % attendu)', r.qui, v, r.attendu;
    END IF;
  END LOOP;
  -- Contre-épreuve : si la RLS de profiles cachait sa ligne à l'admin, son dépôt
  -- serait refusé — le prédicat passe bien par la lecture sous RLS.
  BEGIN
    CREATE POLICY plg_p0_cache_profiles ON public.profiles AS RESTRICTIVE
      FOR SELECT TO authenticated USING (false);
    v := pg_temp.faire('03', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('partner-logos', 'p0.png')$q$);
    IF v NOT LIKE '42501:%' THEN
      RAISE EXCEPTION 'P0 : dépôt de A accepté alors que sa ligne de profiles lui est cachée : %', v;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0P00', MESSAGE = 'contre-épreuve conforme';
  EXCEPTION WHEN SQLSTATE 'P0P00' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'plg_p0_cache_profiles') THEN
    RAISE EXCEPTION 'P0 : la contre-épreuve n''a pas été annulée';
  END IF;

  -- ── P1 : lecture par tous ────────────────────────────────────────────────
  FOR r IN SELECT unnest(ARRAY['anon', '01', '02', '03', '04']) AS qui LOOP
    v := pg_temp.faire(r.qui, $q$SELECT count(*) FROM storage.objects WHERE bucket_id = 'partner-logos'$q$);
    IF v <> 'OK 2' THEN RAISE EXCEPTION 'P1 : % lit les logos : % (OK 2 attendu)', r.qui, v; END IF;
  END LOOP;

  -- ── P2 : dépôt ───────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM (VALUES ('01', 'M'), ('02', 'G'), ('anon', 'anon')) t(qui, cas) LOOP
    v := pg_temp.faire(r.qui, format(
      $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('partner-logos', %L)$q$, 'refus-' || r.cas || '.png'));
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P2 : dépôt de % : % (42501 attendu)', r.cas, v; END IF;
  END LOOP;
  IF pg_temp.n('partner-logos') <> 2 THEN RAISE EXCEPTION 'P2 : un non-admin a déposé un logo'; END IF;

  v := pg_temp.faire('03', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('partner-logos', 'admin.png')$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'P2 : dépôt de A refusé : %', v; END IF;
  v := pg_temp.faire('04', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('partner-logos', 'super.png')$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'P2 : dépôt de SA refusé : %', v; END IF;
  IF pg_temp.n('partner-logos') <> 4 THEN RAISE EXCEPTION 'P2 : les dépôts admin n''ont pas été écrits'; END IF;

  -- upsert : écrasement d'un nom existant.
  v := pg_temp.faire('01', $q$INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('partner-logos', 'logo-1.png', '{"v": 9}')
    ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = excluded.metadata$q$);
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P2 : upsert de M : % (42501 attendu)', v; END IF;
  v := pg_temp.faire('03', $q$INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('partner-logos', 'logo-1.png', '{"v": 2}')
    ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = excluded.metadata$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'P2 : upsert de A refusé : %', v; END IF;
  IF (SELECT metadata->>'v' FROM storage.objects WHERE bucket_id = 'partner-logos' AND name = 'logo-1.png') <> '2' THEN
    RAISE EXCEPTION 'P2 : l''upsert de A n''a pas écrasé le logo';
  END IF;

  -- ── P3 : modification ────────────────────────────────────────────────────
  FOR r IN SELECT unnest(ARRAY['01', '02', 'anon']) AS qui LOOP
    v := pg_temp.faire(r.qui, $q$UPDATE storage.objects SET name = name || '.x', metadata = '{"v": 0}'
      WHERE bucket_id = 'partner-logos'$q$);
    IF v NOT IN ('OK') AND v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P3 : UPDATE de % : %', r.qui, v; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'partner-logos'
              AND (name LIKE '%.x' OR metadata->>'v' = '0')) THEN
    RAISE EXCEPTION 'P3 : un non-admin a modifié un logo';
  END IF;

  v := pg_temp.faire('03', $q$UPDATE storage.objects SET name = 'logo-2-bis.png'
    WHERE bucket_id = 'partner-logos' AND name = 'logo-2.png'$q$);
  IF v <> 'OK' OR NOT EXISTS (SELECT 1 FROM storage.objects
                               WHERE bucket_id = 'partner-logos' AND name = 'logo-2-bis.png') THEN
    RAISE EXCEPTION 'P3 : modification de A refusée : %', v;
  END IF;

  -- Sortie : A ne déplace pas un logo vers un autre stockage.
  v := pg_temp.faire('03', $q$UPDATE storage.objects SET bucket_id = 'avatars'
    WHERE bucket_id = 'partner-logos' AND name = 'admin.png'$q$);
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P3 : sortie d''un logo par A : % (42501 attendu)', v; END IF;
  -- Entrée : M ne fait pas entrer son avatar dans partner-logos.
  v := pg_temp.faire('01', $q$UPDATE storage.objects SET bucket_id = 'partner-logos'
    WHERE bucket_id = 'avatars' AND name = '00000000-0000-4000-a9fd-000000000001/a.png'$q$);
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P3 : entrée de l''avatar de M : % (42501 attendu)', v; END IF;
  IF pg_temp.n('partner-logos') <> 4 OR pg_temp.n('avatars') <> 1 THEN
    RAISE EXCEPTION 'P3 : un objet a changé de stockage';
  END IF;

  -- ── P4 : suppression ─────────────────────────────────────────────────────
  FOR r IN SELECT unnest(ARRAY['01', '02', 'anon']) AS qui LOOP
    v := pg_temp.faire(r.qui, $q$DELETE FROM storage.objects WHERE bucket_id = 'partner-logos'$q$);
    IF v NOT IN ('OK') AND v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'P4 : DELETE de % : %', r.qui, v; END IF;
  END LOOP;
  IF pg_temp.n('partner-logos') <> 4 THEN RAISE EXCEPTION 'P4 : un non-admin a supprimé un logo'; END IF;

  v := pg_temp.faire('04', $q$DELETE FROM storage.objects WHERE bucket_id = 'partner-logos' AND name = 'super.png'$q$);
  IF v <> 'OK' OR pg_temp.n('partner-logos') <> 3 THEN
    RAISE EXCEPTION 'P4 : suppression de SA refusée : %', v;
  END IF;

  RAISE NOTICE 'partner-logos : P0 à P4 conformes';
END $t$;

-- ── P5 : définitions ─────────────────────────────────────────────────────────
SET LOCAL search_path TO "$user", public, extensions;

CREATE FUNCTION pg_temp.empreintes() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(p.polname || '|' || p.polcmd::text || '|'
           || array_to_string(array(SELECT CASE WHEN r = 0 THEN 'public' ELSE r::regrole::text END
                                      FROM unnest(p.polroles) r ORDER BY 1), ',') || '|'
           || md5(coalesce(pg_get_expr(p.polqual, p.polrelid), '')) || '|'
           || md5(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')), E'\n' ORDER BY p.polname)
    FROM pg_policy p
   WHERE p.polrelid = 'storage.objects'::regclass
     AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
          || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) LIKE '%partner-logos%';
$$;

DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.empreintes();
  IF v IS DISTINCT FROM concat_ws(E'\n',
       'partner_logos_admin_delete|d|authenticated|2f0edf55546927699dcd713983c1736d|d41d8cd98f00b204e9800998ecf8427e',
       'partner_logos_admin_insert|a|authenticated|d41d8cd98f00b204e9800998ecf8427e|2f0edf55546927699dcd713983c1736d',
       'partner_logos_admin_update|w|authenticated|2f0edf55546927699dcd713983c1736d|2f0edf55546927699dcd713983c1736d',
       'public_read_partner_logos|r|public|6cb143c112d399f7c51c1426d9457f16|d41d8cd98f00b204e9800998ecf8427e') THEN
    RAISE EXCEPTION 'P5 : policies de partner-logos :%', E'\n' || coalesce(v, '(aucune)');
  END IF;

  IF (SELECT public FROM storage.buckets WHERE id = 'partner-logos') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'P5 : le stockage partner-logos n''est plus public';
  END IF;

  SELECT md5(coalesce(pg_get_expr(polqual, polrelid), '')) || '/' || md5(coalesce(pg_get_expr(polwithcheck, polrelid), ''))
    INTO v FROM pg_policy WHERE polrelid = 'public.partners'::regclass AND polname = 'admin_manage_partners';
  IF v IS DISTINCT FROM 'da5ede061536c834148c8d9356cd43ca/da5ede061536c834148c8d9356cd43ca' THEN
    RAISE EXCEPTION 'P5 : admin_manage_partners modifiée (%)', v;
  END IF;

  v := md5(pg_get_functiondef('public.prevent_role_escalation()'::regprocedure));
  IF v <> '505d808ef532d34d846554de913abe6f' THEN
    RAISE EXCEPTION 'P5 : prevent_role_escalation modifiée (md5 %)', v;
  END IF;

  RAISE NOTICE 'partner-logos : P5 conforme';
END $t$;

-- ── P6 : retour arrière (supabase/retours/…), contre les empreintes de prod ──
\i supabase/retours/20270148000000_partner_logos_admin.sql
DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.empreintes();
  IF v IS DISTINCT FROM concat_ws(E'\n',
       'admin_delete_partner_logo|d|public|e19d5b7dc3fd05079df6397622a7b2a6|d41d8cd98f00b204e9800998ecf8427e',
       'admin_update_partner_logo|w|public|e19d5b7dc3fd05079df6397622a7b2a6|d41d8cd98f00b204e9800998ecf8427e',
       'admin_upload_partner_logo|a|public|d41d8cd98f00b204e9800998ecf8427e|e19d5b7dc3fd05079df6397622a7b2a6',
       'public_read_partner_logos|r|public|6cb143c112d399f7c51c1426d9457f16|d41d8cd98f00b204e9800998ecf8427e') THEN
    RAISE EXCEPTION 'P6 : policies après retour arrière ≠ prod :%', E'\n' || coalesce(v, '(aucune)');
  END IF;

  -- Contre-exemple : sous les anciennes policies, le membre dépose.
  v := pg_temp.faire('01', $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('partner-logos', 'trou.png')$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'P6 : sous les anciennes policies, M ne dépose pas : %', v; END IF;

  RAISE NOTICE 'partner-logos : P6 conforme (retour arrière annulé avec la transaction)';
END $t$;

ROLLBACK;
