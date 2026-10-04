-- ═════════════════════════════════════════════════════════════════════════════
-- Notifications du gérant : résultat de l'envoi et co-gérants (migration 20270142)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : gérant principal G (…e0, owner_id, sans ligne box_members, comme 3
-- gérants sur 4 en prod), co-gérant C (…e1, ligne `owner` active), coach K
-- (…e2), membres M1 (…10) et M2 (…11). Box B2 : gérant O2 (…21), où C n'est rien.
--   N0  structure : colonne `delivered_count` integer NULL ; déclencheur BEFORE
--       INSERT OR UPDATE, ligne par ligne, toutes colonnes, actif ; fonction
--       fermée aux clients ; `box_notifs_owner` FOR ALL sur
--       `is_box_owner_admin(box_id)` sans WITH CHECK ; les deux règles de
--       lecture des membres au md5 de prod (relevé du 03/10/2026) ;
--   N1  G et C créent une notification dans B ; C lit toutes celles de B ;
--   N2  K et M1 ne créent rien dans B ; C ne crée rien dans B2 ; K ne modifie
--       rien ;
--   N3  lecture des membres inchangée : M1 lit « tous » et les siennes, pas
--       celle de M2 ;
--   N4  `delivered_count` : refusé à G à l'insertion, refusé à G et C en mise à
--       jour (42501, NOTIF_RESULTAT_RESERVE) ; une mise à jour d'une autre
--       colonne et une réécriture à l'identique passent ; la clé serveur pose 0
--       puis 2 ;
--   N5  mutations : règle remise sur `is_box_owner`, C est refusé (N1 vient
--       bien de la nouvelle règle) ; déclencheur désactivé, C réécrit le
--       résultat (N4 vient bien de la garde) ;
--   N6  retour arrière de l'en-tête de la migration, joué tel quel : la règle
--       revient au md5 de prod f1c07d7a…, les deux autres sont inchangées, ni
--       colonne, ni déclencheur, ni fonction ne subsistent.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Notifications du gérant : résultat de l''envoi et co-gérants'

BEGIN;
-- pg_policies rend les expressions selon le search_path : celui de la prod,
-- pour comparer aux md5 relevés.
SET LOCAL search_path TO "$user", public, extensions;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9d4-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', '10', '11', '21']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9d4-0000000000' || s)::uuid, 'ngr-' || s || '@test.invalid', 'ngr_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', '10', '11', '21']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9d4-000000000001', 'Box notifications', 'NGR1', '00000000-0000-4000-a9d4-0000000000e0'),
  ('00000000-0000-4000-b9d4-000000000002', 'Box notifications 2', 'NGR2', '00000000-0000-4000-a9d4-000000000021');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9d4-000000000001', '00000000-0000-4000-a9d4-0000000000e1', 'owner',  'active'),
  ('00000000-0000-4000-b9d4-000000000001', '00000000-0000-4000-a9d4-0000000000e2', 'coach',  'active'),
  ('00000000-0000-4000-b9d4-000000000001', '00000000-0000-4000-a9d4-000000000010', 'member', 'active'),
  ('00000000-0000-4000-b9d4-000000000001', '00000000-0000-4000-a9d4-000000000011', 'member', 'active');
-- Notifications existantes de B : une à tous, une à M2 seul.
INSERT INTO public.box_notifications (id, box_id, title, target, created_by) VALUES
  ('00000000-0000-4000-c9d4-000000000001', '00000000-0000-4000-b9d4-000000000001', 'À tous', 'all', '00000000-0000-4000-a9d4-0000000000e0'),
  ('00000000-0000-4000-c9d4-000000000002', '00000000-0000-4000-b9d4-000000000001', 'À M2', '00000000-0000-4000-a9d4-000000000011', '00000000-0000-4000-a9d4-0000000000e0');

-- Exécute `p_sql` sous l'identité `p_qui` (…e0, …e1, …e2, …10 ou « service ») ;
-- rend le résultat, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9d4-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql INTO v;
    v := coalesce(v, 'OK');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.qual(p_nom text) RETURNS text LANGUAGE sql AS $$
  SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_notifications' AND policyname = p_nom;
$$;

DO $t$
DECLARE
  B  constant text := '00000000-0000-4000-b9d4-000000000001';
  B2 constant text := '00000000-0000-4000-b9d4-000000000002';
  N_TOUS constant text := '00000000-0000-4000-c9d4-000000000001';
  REFUS_RLS constant text := '42501: new row violates row-level security policy%';
  REFUS_GARDE constant text := '42501: NOTIF_RESULTAT_RESERVE:%';
  -- Insère une notification « all » dans la box %L ; rend le nombre de lignes.
  INS constant text := 'WITH m AS (INSERT INTO public.box_notifications (box_id, title, target) VALUES (%L, ''Test'', ''all'') RETURNING 1) SELECT count(*)::text FROM m';
  INS_RESULTAT constant text := 'WITH m AS (INSERT INTO public.box_notifications (box_id, title, target, delivered_count) VALUES (%L, ''Test'', ''all'', 3) RETURNING 1) SELECT count(*)::text FROM m';
  MAJ constant text := 'WITH m AS (UPDATE public.box_notifications SET %s WHERE id = %L RETURNING 1) SELECT count(*)::text FROM m';
  LUES constant text := 'SELECT string_agg(title, '','' ORDER BY title COLLATE "C") FROM public.box_notifications WHERE box_id = %L';
  v text;
  v_qui text;
BEGIN
  -- N0 : structure.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'box_notifications' AND column_name = 'delivered_count'
         AND data_type = 'integer' AND is_nullable = 'YES' AND column_default IS NULL) <> 1 THEN
    RAISE EXCEPTION 'N0 : box_notifications.delivered_count absente, ou pas integer NULL sans défaut';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'public.box_notifications'::regclass AND t.tgname = 'trg_box_notifications_garde_resultat'
         AND t.tgenabled = 'O' AND t.tgtype = (1 | 2 | 4 | 16) AND coalesce(array_length(t.tgattr::int2[], 1), 0) = 0) <> 1 THEN
    RAISE EXCEPTION 'N0 : trg_box_notifications_garde_resultat absent, inactif, ou pas BEFORE INSERT OR UPDATE sur toutes les colonnes';
  END IF;
  IF has_function_privilege('authenticated', 'internal.garder_resultat_notification()', 'EXECUTE')
     OR has_function_privilege('anon', 'internal.garder_resultat_notification()', 'EXECUTE') THEN
    RAISE EXCEPTION 'N0 : internal.garder_resultat_notification() exécutable par un client';
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'box_notifications' AND policyname = 'box_notifs_owner'
         AND cmd = 'ALL' AND roles = '{public}' AND with_check IS NULL) <> 1
     OR pg_temp.qual('box_notifs_owner') IS DISTINCT FROM 'is_box_owner_admin(box_id)' THEN
    RAISE EXCEPTION 'N0 : box_notifs_owner n''est pas FOR ALL USING (is_box_owner_admin(box_id)) sans WITH CHECK (qual : %)', pg_temp.qual('box_notifs_owner');
  END IF;
  IF md5(pg_temp.qual('box_notifs_member_read')) <> '18a7a39ea6a30a951b455e88acce715b'
     OR md5(pg_temp.qual('notif_member_read')) <> '4df9fd82eb3b3eaf8d77e4809e7c6c9d' THEN
    RAISE EXCEPTION 'N0 : une règle de lecture des membres a changé (box_notifs_member_read %, notif_member_read %)',
      md5(pg_temp.qual('box_notifs_member_read')), md5(pg_temp.qual('notif_member_read'));
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_notifications') <> 3 THEN
    RAISE EXCEPTION 'N0 : box_notifications n''a plus exactement trois règles';
  END IF;

  -- N1 : gérant principal et co-gérant créent ; le co-gérant lit tout.
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1'] LOOP
    v := pg_temp.faire(v_qui, format(INS, B));
    IF v <> '1' THEN RAISE EXCEPTION 'N1 : % ne crée pas de notification dans B (%)', v_qui, v; END IF;
  END LOOP;
  v := pg_temp.faire('e1', format(LUES, B));
  IF v <> 'Test,Test,À M2,À tous' THEN RAISE EXCEPTION 'N1 : le co-gérant ne lit pas toutes les notifications de B (%)', v; END IF;

  -- N2 : coach et membre ne créent rien ; le co-gérant ne crée rien ailleurs ; le coach ne modifie rien.
  FOREACH v_qui IN ARRAY ARRAY['e2', '10'] LOOP
    v := pg_temp.faire(v_qui, format(INS, B));
    IF v NOT LIKE REFUS_RLS THEN RAISE EXCEPTION 'N2 : % crée une notification dans B (%)', v_qui, v; END IF;
  END LOOP;
  v := pg_temp.faire('e1', format(INS, B2));
  IF v NOT LIKE REFUS_RLS THEN RAISE EXCEPTION 'N2 : le co-gérant de B crée une notification dans B2 (%)', v; END IF;
  v := pg_temp.faire('e2', format(MAJ, 'title = ''Modifié''', N_TOUS));
  IF v <> '0' THEN RAISE EXCEPTION 'N2 : le coach modifie une notification (%)', v; END IF;

  -- N3 : lecture des membres inchangée.
  v := pg_temp.faire('10', format(LUES, B));
  IF v <> 'Test,Test,À tous' THEN RAISE EXCEPTION 'N3 : M1 lit % au lieu des notifications à tous', v; END IF;
  v := pg_temp.faire('11', format(LUES, B));
  IF v <> 'Test,Test,À M2,À tous' THEN RAISE EXCEPTION 'N3 : M2 ne lit pas la sienne (%)', v; END IF;

  -- N4 : le résultat n'est écrit que par la clé serveur.
  v := pg_temp.faire('e0', format(INS_RESULTAT, B));
  IF v NOT LIKE REFUS_GARDE THEN RAISE EXCEPTION 'N4 : le gérant insère un résultat (%)', v; END IF;
  v := pg_temp.faire('service', format(MAJ, 'delivered_count = 0', N_TOUS));
  IF v <> '1' OR (SELECT delivered_count FROM public.box_notifications WHERE id = N_TOUS::uuid) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'N4 : la clé serveur ne pose pas delivered_count = 0 (%)', v;
  END IF;
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1'] LOOP
    v := pg_temp.faire(v_qui, format(MAJ, 'delivered_count = 5', N_TOUS));
    IF v NOT LIKE REFUS_GARDE THEN RAISE EXCEPTION 'N4 : % réécrit le résultat (%)', v_qui, v; END IF;
    v := pg_temp.faire(v_qui, format(MAJ, 'delivered_count = NULL', N_TOUS));
    IF v NOT LIKE REFUS_GARDE THEN RAISE EXCEPTION 'N4 : % efface le résultat (%)', v_qui, v; END IF;
  END LOOP;
  v := pg_temp.faire('e0', format(MAJ, 'title = ''À tous (corrigé)''', N_TOUS));
  IF v <> '1' THEN RAISE EXCEPTION 'N4 : le gérant ne corrige plus le titre (%)', v; END IF;
  v := pg_temp.faire('e1', format(MAJ, 'delivered_count = delivered_count', N_TOUS));
  IF v <> '1' THEN RAISE EXCEPTION 'N4 : une réécriture à l''identique est refusée (%)', v; END IF;
  v := pg_temp.faire('service', format(MAJ, 'delivered_count = 2', N_TOUS));
  IF v <> '1' OR (SELECT delivered_count FROM public.box_notifications WHERE id = N_TOUS::uuid) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'N4 : la clé serveur ne pose pas delivered_count = 2 (%)', v;
  END IF;

  -- N5 : mutations.
  DROP POLICY box_notifs_owner ON public.box_notifications;
  CREATE POLICY box_notifs_owner ON public.box_notifications USING (public.is_box_owner(box_id));
  v := pg_temp.faire('e1', format(INS, B));
  IF v NOT LIKE REFUS_RLS THEN RAISE EXCEPTION 'N5 : règle remise sur is_box_owner, le co-gérant crée encore (%) : N1 ne prouve rien', v; END IF;
  DROP POLICY box_notifs_owner ON public.box_notifications;
  CREATE POLICY box_notifs_owner ON public.box_notifications USING (public.is_box_owner_admin(box_id));
  ALTER TABLE public.box_notifications DISABLE TRIGGER trg_box_notifications_garde_resultat;
  v := pg_temp.faire('e1', format(MAJ, 'delivered_count = 5', N_TOUS));
  ALTER TABLE public.box_notifications ENABLE TRIGGER trg_box_notifications_garde_resultat;
  IF v <> '1' THEN RAISE EXCEPTION 'N5 : déclencheur désactivé, le co-gérant ne réécrit pas le résultat (%) : N4 ne prouve rien', v; END IF;
END $t$;

-- N6 : retour arrière de l'en-tête de la migration, tel quel (sans BEGIN/COMMIT :
-- on est déjà dans la transaction du test).
DROP TRIGGER trg_box_notifications_garde_resultat ON public.box_notifications;
DROP FUNCTION internal.garder_resultat_notification();
DROP POLICY box_notifs_owner ON public.box_notifications;
CREATE POLICY box_notifs_owner ON public.box_notifications
  USING (public.is_box_owner(box_id));
ALTER TABLE public.box_notifications DROP COLUMN delivered_count;

DO $t$
BEGIN
  IF md5(pg_temp.qual('box_notifs_owner')) <> 'f1c07d7a6bbd6c505f6de2e3cbbc151a'
     OR (SELECT count(*) FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'box_notifications' AND policyname = 'box_notifs_owner'
            AND cmd = 'ALL' AND roles = '{public}' AND with_check IS NULL) <> 1 THEN
    RAISE EXCEPTION 'N6 : après retour arrière, box_notifs_owner n''est pas celle de la prod (md5 %)', md5(pg_temp.qual('box_notifs_owner'));
  END IF;
  IF md5(pg_temp.qual('box_notifs_member_read')) <> '18a7a39ea6a30a951b455e88acce715b'
     OR md5(pg_temp.qual('notif_member_read')) <> '4df9fd82eb3b3eaf8d77e4809e7c6c9d'
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_notifications') <> 3 THEN
    RAISE EXCEPTION 'N6 : après retour arrière, les règles de lecture ne sont pas celles de la prod';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'box_notifications' AND column_name = 'delivered_count')
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.box_notifications'::regclass AND NOT tgisinternal)
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'internal' AND p.proname = 'garder_resultat_notification') THEN
    RAISE EXCEPTION 'N6 : après retour arrière, il reste la colonne, un déclencheur ou la fonction de garde';
  END IF;
END $t$;

ROLLBACK;
\echo '    N0 à N6 OK'
