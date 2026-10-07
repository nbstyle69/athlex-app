-- ═════════════════════════════════════════════════════════════════════════════
-- Stockage « tournament-banners » : écriture réservée au staff de la box du
-- tournoi et aux admins (migration 20270149)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, après le
-- rejeu complet des migrations : public.is_box_admin et les tables qu'elle lit
-- sont ceux de la prod (empreintes vérifiées en Q0).
-- Box A (…0a) et box B (…0b) ; …0c est un uuid de box inexistante.
-- Comptes : M (…01, membre de A), G (…02, gérant de A : boxes.owner_id),
-- CG (…03, co-gérant actif de A : box_members.role owner), C (…04, coach actif
-- de A), CI (…05, coach inactif de A), SB (…06, gérant de B), AD (…07, admin),
-- SA (…08, super_admin).
-- Objets : « <A>/b1.png », « <A>/b2.png » et « <B>/b3.png » dans
-- tournament-banners ; av, l'avatar de M (« <M>/a.png ») dans avatars.
-- Les droits de la plateforme sur storage.objects et storage.buckets (anon,
-- authenticated, service_role : tous, comme en prod) et l'index unique
-- (bucket_id, name) de la prod sont reproduits dans la transaction : sans eux,
-- un refus viendrait du droit et non des policies, et l'upsert n'aurait pas de
-- conflit à résoudre.
--
--   Q0  is_box_admin et les tables qu'elle lit (boxes, box_members, profiles)
--       à leur empreinte de prod : définition, SECURITY DEFINER, même
--       propriétaire que les tables, RLS active non forcée, colonnes lues ;
--   Q1  lecture des bannières par tous, anon compris ;
--   Q2  dépôt dans « <box>/… » : accepté pour G, CG, C, AD, SA dans A et pour
--       SB dans B ; refusé pour CI, M, SB dans A et anon ; refusé (42501, sans
--       erreur SQL) pour un nom sans dossier, un dossier non-uuid (y compris
--       pour l'admin) et une box inexistante ; uuid de A en majuscules :
--       accepté pour G ; upsert (INSERT … ON CONFLICT DO UPDATE, le chemin
--       `upsert: true` du Manager) : accepté pour G et ligne écrasée, refusé
--       pour M ;
--   Q3  modification : aucune pour M, CI, SB (dans A) et anon (comptage) ;
--       acceptée pour C dans A ; G ne déplace une bannière ni vers B ni vers
--       avatars ; M ne fait pas entrer son avatar dans tournament-banners ;
--   Q4  suppression : aucune, pour aucun client, staff et admins compris
--       (comptage) ;
--   Q5  définitions : anciennes policies absentes, nouvelles épinglées, lecture,
--       stockage public et tournaments_box_admin_manage à leur empreinte de prod ;
--   Q6  retour arrière (supabase/retours/20270149000000_tournament_banners_staff.sql) :
--       retour exact aux empreintes de prod du 07/10/2026, et M y redépose
--       (contre-exemple) ; annulé avec la transaction.
-- Chaque refus est prouvé par un comptage, pas par le seul code d'erreur : un
-- UPDATE ou un DELETE filtré par la RLS rend « OK » sans rien toucher.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Stockage tournament-banners réservé au staff de la box'

BEGIN;

GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE UNIQUE INDEX tbs_bucketid_objname ON storage.objects (bucket_id, name);

INSERT INTO storage.buckets (id, name, public) VALUES
  ('tournament-banners', 'tournament-banners', true), ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9fe-0000000000' || s)::uuid
  FROM unnest(ARRAY['01','02','03','04','05','06','07','08']) s;
INSERT INTO public.profiles (id, email, username, role)
SELECT ('00000000-0000-4000-a9fe-0000000000' || s)::uuid, 'tbs-' || s || '@test.invalid', 'tbs_' || s, r
  FROM (VALUES ('01', 'member'), ('02', 'box_owner'), ('03', 'member'), ('04', 'member'),
               ('05', 'member'), ('06', 'box_owner'), ('07', 'admin'), ('08', 'super_admin')) v(s, r);
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9fe-00000000000a', 'Box TBS A', 'TBSA', '00000000-0000-4000-a9fe-000000000002'),
  ('00000000-0000-4000-b9fe-00000000000b', 'Box TBS B', 'TBSB', '00000000-0000-4000-a9fe-000000000006');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9fe-00000000000a', '00000000-0000-4000-a9fe-000000000001', 'member', 'active'),
  ('00000000-0000-4000-b9fe-00000000000a', '00000000-0000-4000-a9fe-000000000003', 'owner', 'active'),
  ('00000000-0000-4000-b9fe-00000000000a', '00000000-0000-4000-a9fe-000000000004', 'coach', 'active'),
  ('00000000-0000-4000-b9fe-00000000000a', '00000000-0000-4000-a9fe-000000000005', 'coach', 'inactive');

INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
  ('tournament-banners', '00000000-0000-4000-b9fe-00000000000a/b1.png', '{"v": 1}'),
  ('tournament-banners', '00000000-0000-4000-b9fe-00000000000a/b2.png', '{"v": 1}'),
  ('tournament-banners', '00000000-0000-4000-b9fe-00000000000b/b3.png', '{"v": 1}');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('avatars', '00000000-0000-4000-a9fe-000000000001/a.png', '00000000-0000-4000-a9fe-000000000001');

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe ou « anon ») ; rend « OK »,
-- « OK <n> » pour un `SELECT count(*)`, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK'; n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui = 'anon' THEN '' ELSE '00000000-0000-4000-a9fe-0000000000' || p_qui END, true);
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

-- Dépôt d'un objet `p_nom` dans tournament-banners par `p_qui`.
CREATE FUNCTION pg_temp.deposer(p_qui text, p_nom text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format(
    $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('tournament-banners', %L)$q$, p_nom));
$$;

-- Nombre d'objets du stockage (vu par le superutilisateur, hors RLS).
CREATE FUNCTION pg_temp.n(p_bucket text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM storage.objects WHERE bucket_id = p_bucket;
$$;

-- ── Q0 : is_box_admin et les tables qu'elle lit, à leur empreinte de prod ────
SET LOCAL search_path TO "$user", public, extensions;

DO $t$
DECLARE v text;
BEGIN
  v := md5(pg_get_functiondef('public.is_box_admin(uuid)'::regprocedure));
  IF v <> '288f82516d5a94118918ef1ac7292172' THEN
    RAISE EXCEPTION 'Q0 : is_box_admin modifiée (md5 %)', v;
  END IF;

  -- Propriétaire de la fonction = propriétaire des tables, RLS non forcée : la
  -- fonction (SECURITY DEFINER) les lit sans repasser par leurs policies.
  SELECT string_agg(c.relname || '|' || c.relrowsecurity || '|' || c.relforcerowsecurity || '|'
                    || (c.relowner = p.proowner) || '|' || x.cols, E'\n' ORDER BY c.relname)
    INTO v
    FROM pg_proc p
    CROSS JOIN pg_class c
    CROSS JOIN LATERAL (
      SELECT md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY a.attname)) cols
        FROM pg_attribute a
       WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname IN ('id', 'owner_id', 'box_id', 'member_id', 'role', 'status')) x
   WHERE p.oid = 'public.is_box_admin(uuid)'::regprocedure AND p.prosecdef
     AND c.oid IN ('public.boxes'::regclass, 'public.box_members'::regclass, 'public.profiles'::regclass);
  IF v IS DISTINCT FROM concat_ws(E'\n',
       'box_members|true|false|true|d24df01b133bb8c588d00a0ef3c4ea76',
       'boxes|true|false|true|c21bdb204f5d7a583fdf06ec9bc6880c',
       'profiles|true|false|true|e6ee9d22e35ba9f97445de3c2e2e4952') THEN
    RAISE EXCEPTION 'Q0 : tables lues par is_box_admin ≠ prod :%', E'\n' || coalesce(v, '(fonction non SECURITY DEFINER)');
  END IF;

  RAISE NOTICE 'tournament-banners : Q0 conforme';
END $t$;

RESET search_path;

DO $t$
DECLARE
  v text;
  r record;
  a constant text := '00000000-0000-4000-b9fe-00000000000a';
  b constant text := '00000000-0000-4000-b9fe-00000000000b';
BEGIN
  -- Les rôles semés sont bien ceux attendus.
  IF (SELECT string_agg(role, ',' ORDER BY id) FROM public.profiles
       WHERE id::text LIKE '00000000-0000-4000-a9fe-%')
     <> 'member,box_owner,member,member,member,box_owner,admin,super_admin' THEN
    RAISE EXCEPTION 'semis : rôles des comptes de test inattendus';
  END IF;

  -- ── Q1 : lecture par tous ────────────────────────────────────────────────
  FOR r IN SELECT unnest(ARRAY['anon', '01', '02', '03', '04', '05', '06', '07', '08']) AS qui LOOP
    v := pg_temp.faire(r.qui, $q$SELECT count(*) FROM storage.objects WHERE bucket_id = 'tournament-banners'$q$);
    IF v <> 'OK 3' THEN RAISE EXCEPTION 'Q1 : % lit les bannières : % (OK 3 attendu)', r.qui, v; END IF;
  END LOOP;

  -- ── Q2 : dépôt ───────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM (VALUES
      ('05', a || '/ci.png',                                    'CI dans A'),
      ('01', a || '/m.png',                                     'M dans A'),
      ('06', a || '/sb.png',                                    'SB dans A'),
      ('anon', a || '/anon.png',                                'anon dans A'),
      ('02', 'sans-dossier.png',                                'G, nom sans dossier'),
      ('02', 'pas-un-uuid/x.png',                               'G, dossier non-uuid'),
      ('02', '00000000-0000-4000-b9fe-00000000000c/x.png',      'G, box inexistante'),
      ('07', 'sans-dossier.png',                                'AD, nom sans dossier'),
      ('07', 'pas-un-uuid/x.png',                               'AD, dossier non-uuid'),
      ('07', a || 'x/y.png',                                    'AD, dossier uuid prolongé')
    ) t(qui, nom, cas) LOOP
    v := pg_temp.deposer(r.qui, r.nom);
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q2 : dépôt (%) : % (42501 attendu)', r.cas, v; END IF;
  END LOOP;
  IF pg_temp.n('tournament-banners') <> 3 THEN RAISE EXCEPTION 'Q2 : un dépôt refusé a été écrit'; END IF;

  FOR r IN SELECT * FROM (VALUES
      ('02', a || '/g.png',         'G dans A'),
      ('03', a || '/cg.png',        'CG dans A'),
      ('04', a || '/c.png',         'C dans A'),
      ('07', a || '/ad.png',        'AD dans A'),
      ('08', a || '/sa.png',        'SA dans A'),
      ('06', b || '/sb.png',        'SB dans B'),
      ('02', upper(a) || '/maj.png', 'G, uuid de A en majuscules')
    ) t(qui, nom, cas) LOOP
    v := pg_temp.deposer(r.qui, r.nom);
    IF v <> 'OK' THEN RAISE EXCEPTION 'Q2 : dépôt (%) refusé : %', r.cas, v; END IF;
  END LOOP;
  IF pg_temp.n('tournament-banners') <> 10 THEN RAISE EXCEPTION 'Q2 : les dépôts du staff n''ont pas été écrits'; END IF;

  -- upsert : écrasement d'un nom existant.
  v := pg_temp.faire('01', format($q$INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('tournament-banners', %L, '{"v": 9}')
    ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = excluded.metadata$q$, a || '/b1.png'));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q2 : upsert de M : % (42501 attendu)', v; END IF;
  v := pg_temp.faire('02', format($q$INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('tournament-banners', %L, '{"v": 2}')
    ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = excluded.metadata$q$, a || '/b1.png'));
  IF v <> 'OK' THEN RAISE EXCEPTION 'Q2 : upsert de G refusé : %', v; END IF;
  IF (SELECT metadata->>'v' FROM storage.objects
       WHERE bucket_id = 'tournament-banners' AND name = a || '/b1.png') <> '2' THEN
    RAISE EXCEPTION 'Q2 : l''upsert de G n''a pas écrasé la bannière';
  END IF;
  IF pg_temp.n('tournament-banners') <> 10 THEN RAISE EXCEPTION 'Q2 : l''upsert a créé un objet'; END IF;

  -- ── Q3 : modification ────────────────────────────────────────────────────
  FOR r IN SELECT unnest(ARRAY['01', '05', '06', 'anon']) AS qui LOOP
    v := pg_temp.faire(r.qui, format($q$UPDATE storage.objects SET name = name || '.x', metadata = '{"v": 0}'
      WHERE bucket_id = 'tournament-banners' AND name LIKE %L$q$, a || '/%'));
    IF v NOT IN ('OK') AND v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q3 : UPDATE de % : %', r.qui, v; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'tournament-banners'
              AND (name LIKE '%.x' OR metadata->>'v' = '0')) THEN
    RAISE EXCEPTION 'Q3 : un non-staff a modifié une bannière de A';
  END IF;

  v := pg_temp.faire('04', format($q$UPDATE storage.objects SET name = %L
    WHERE bucket_id = 'tournament-banners' AND name = %L$q$, a || '/b2-bis.png', a || '/b2.png'));
  IF v <> 'OK' OR NOT EXISTS (SELECT 1 FROM storage.objects
                               WHERE bucket_id = 'tournament-banners' AND name = a || '/b2-bis.png') THEN
    RAISE EXCEPTION 'Q3 : modification de C dans A refusée : %', v;
  END IF;

  -- Changement de box : G ne déplace pas une bannière de A vers B.
  v := pg_temp.faire('02', format($q$UPDATE storage.objects SET name = %L
    WHERE bucket_id = 'tournament-banners' AND name = %L$q$, b || '/g.png', a || '/g.png'));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q3 : G déplace une bannière vers B : % (42501 attendu)', v; END IF;
  -- Sortie : G ne déplace pas une bannière vers un autre stockage.
  v := pg_temp.faire('02', format($q$UPDATE storage.objects SET bucket_id = 'avatars'
    WHERE bucket_id = 'tournament-banners' AND name = %L$q$, a || '/g.png'));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q3 : sortie d''une bannière par G : % (42501 attendu)', v; END IF;
  -- Entrée : M ne fait pas entrer son avatar dans tournament-banners, même
  -- renommé sous le dossier de A.
  v := pg_temp.faire('01', format($q$UPDATE storage.objects SET bucket_id = 'tournament-banners', name = %L
    WHERE bucket_id = 'avatars' AND name = '00000000-0000-4000-a9fe-000000000001/a.png'$q$, a || '/entree.png'));
  IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q3 : entrée de l''avatar de M : % (42501 attendu)', v; END IF;
  IF pg_temp.n('tournament-banners') <> 10 OR pg_temp.n('avatars') <> 1
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'tournament-banners' AND name = a || '/g.png') THEN
    RAISE EXCEPTION 'Q3 : un objet a changé de box ou de stockage';
  END IF;

  -- ── Q4 : suppression, refusée à tous les clients ─────────────────────────
  FOR r IN SELECT unnest(ARRAY['anon', '01', '02', '03', '04', '05', '06', '07', '08']) AS qui LOOP
    v := pg_temp.faire(r.qui, $q$DELETE FROM storage.objects WHERE bucket_id = 'tournament-banners'$q$);
    IF v NOT IN ('OK') AND v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'Q4 : DELETE de % : %', r.qui, v; END IF;
  END LOOP;
  IF pg_temp.n('tournament-banners') <> 10 THEN RAISE EXCEPTION 'Q4 : un client a supprimé une bannière'; END IF;

  RAISE NOTICE 'tournament-banners : Q1 à Q4 conformes';
END $t$;

-- ── Q5 : définitions ─────────────────────────────────────────────────────────
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
          || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) LIKE '%tournament-banners%';
$$;

DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.empreintes();
  IF v IS DISTINCT FROM concat_ws(E'\n',
       'Public read access for tournament banners|r|public|bb48837eee1ecad33bfed90bca199cd2|d41d8cd98f00b204e9800998ecf8427e',
       'tournament_banners_staff_insert|a|authenticated|d41d8cd98f00b204e9800998ecf8427e|cbaed6906b7eef101dbdbddecd1bc10b',
       'tournament_banners_staff_update|w|authenticated|cbaed6906b7eef101dbdbddecd1bc10b|cbaed6906b7eef101dbdbddecd1bc10b') THEN
    RAISE EXCEPTION 'Q5 : policies de tournament-banners :%', E'\n' || coalesce(v, '(aucune)');
  END IF;

  IF (SELECT public FROM storage.buckets WHERE id = 'tournament-banners') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Q5 : le stockage tournament-banners n''est plus public';
  END IF;

  SELECT md5(coalesce(pg_get_expr(polqual, polrelid), '')) || '/' || md5(coalesce(pg_get_expr(polwithcheck, polrelid), ''))
    INTO v FROM pg_policy WHERE polrelid = 'public.tournaments'::regclass AND polname = 'tournaments_box_admin_manage';
  IF v IS DISTINCT FROM '0736e320a21a87c57b2a29c5fcb9557d/0736e320a21a87c57b2a29c5fcb9557d' THEN
    RAISE EXCEPTION 'Q5 : tournaments_box_admin_manage modifiée (%)', v;
  END IF;

  RAISE NOTICE 'tournament-banners : Q5 conforme';
END $t$;

-- ── Q6 : retour arrière (supabase/retours/…), contre les empreintes de prod ──
\i supabase/retours/20270149000000_tournament_banners_staff.sql
DO $t$
DECLARE v text;
BEGIN
  v := pg_temp.empreintes();
  IF v IS DISTINCT FROM concat_ws(E'\n',
       'Authenticated users can update tournament banners|w|authenticated|bb48837eee1ecad33bfed90bca199cd2|d41d8cd98f00b204e9800998ecf8427e',
       'Authenticated users can upload tournament banners|a|authenticated|d41d8cd98f00b204e9800998ecf8427e|bb48837eee1ecad33bfed90bca199cd2',
       'Public read access for tournament banners|r|public|bb48837eee1ecad33bfed90bca199cd2|d41d8cd98f00b204e9800998ecf8427e') THEN
    RAISE EXCEPTION 'Q6 : policies après retour arrière ≠ prod :%', E'\n' || coalesce(v, '(aucune)');
  END IF;

  -- Contre-exemple : sous les anciennes policies, le membre dépose.
  v := pg_temp.deposer('01', '00000000-0000-4000-b9fe-00000000000a/trou.png');
  IF v <> 'OK' THEN RAISE EXCEPTION 'Q6 : sous les anciennes policies, M ne dépose pas : %', v; END IF;

  RAISE NOTICE 'tournament-banners : Q6 conforme (retour arrière annulé avec la transaction)';
END $t$;

ROLLBACK;
