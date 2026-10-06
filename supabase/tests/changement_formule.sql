-- ═════════════════════════════════════════════════════════════════════════════
-- Changement de formule par le membre (migration 20270147)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box A : gérant G (…e0, owner_id), co-gérant C (…e1), coach K (…e2), formules
-- P1 (a1, abonnement), P2 (a2, abonnement), P3 (a3, inactive), P4 (a4, carnet).
-- Box B : gérant H (…e3), formules b1, b2. Box Z (archivage programmé) et box X
-- (archivée), formules d1/d2 et e1/e2. U (…30) n'est membre de rien.
-- Membres de A (suffixe) :
--   10 M1  comptoir, P1, engagé    15 MPA en pause         19 MNP sans formule
--   11 M2  comptoir, P1            16 MCA résiliation programmée
--   12 MS  Stripe actif, P1        17 MIN inactif
--   13 MPD statut past_due         18 MSC Stripe résilié (donc comptoir)
--   14 MPS past_due_since seul
-- 20 MB comptoir dans B (b1) ; 21 MZ dans Z (d1) ; 22 MX dans X (e1).
-- Les écritures « serveur » sont jouées sous service_role ou par le
-- superutilisateur du rejeu (webhook, Manager).
--   C0  structure : colonnes, table, index unique partiel, RLS et ses deux
--       règles, droits ; fonctions SECURITY DEFINER, search_path, EXECUTE pour
--       service_role seulement ; définitions épinglées ; fonctions existantes de
--       box_members inchangées ;
--   C1  request_plan_change : cas nominaux (comptoir, Stripe résilié, sans
--       formule, engagé) et chaque code d'erreur ; aucune ligne écrite en
--       cas de refus ;
--   C2  une demande crée sa notification au gérant (plan_change_request) ;
--   C3  une seule demande en attente : PLAN_CHANGE_PENDING_EXISTS, index ;
--   C4  cancel_plan_change_request : vrai puis faux, la demande d'un autre
--       intacte, nouvelle demande possible ensuite ;
--   C5  decide_plan_change_request : coach, membre, gérant d'une autre box et
--       acteur absent refusés (PLAN_CHANGE_FORBIDDEN), demande inconnue
--       (PLAN_CHANGE_NOT_FOUND) ; acceptation par le co-gérant : plan_id écrit,
--       engagement intact, groupes de la formule suivis ; double décision sans
--       effet ; refus par le gérant principal ; acceptation refusée si le
--       membre est passé en impayé, la demande reste en attente et se refuse ;
--   C6  RLS : le membre lit ses lignes, le gérant et le co-gérant leur box, le
--       coach et le gérant d'une autre box rien d'autre, anon rien ; aucune
--       écriture client, même gérant ;
--   C7  les fonctions sont refusées à anon et authenticated ;
--   C8  colonnes de box_members : ni écrites (MEMBRE_FACTURATION_RESERVEE) ni
--       lues par un client ; get_my_membership_billing les rend à leur membre ;
--   C9  box_stripe_portal : ni lue ni écrite par un client, la clé serveur oui ;
--   M   mutations : chaque contrôle ci-dessus échoue quand on retire ce qu'il
--       prouve ;
--   R   retour arrière (supabase/retours/…) : définitions d'avant aux md5 de
--       prod, droits et commentaire compris, objets ajoutés supprimés.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Changement de formule par le membre'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9e7-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e1','e2','e3','e4','e5','10','11','12','13','14','15','16','17','18','19','20','21','22','30']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9e7-0000000000' || s)::uuid, 'cfm-' || s || '@test.invalid', 'cfm_' || s
  FROM unnest(ARRAY['e0','e1','e2','e3','e4','e5','10','11','12','13','14','15','16','17','18','19','20','21','22','30']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9e7-000000000001', 'Box formule A', 'CFMA', '00000000-0000-4000-a9e7-0000000000e0'),
  ('00000000-0000-4000-b9e7-000000000002', 'Box formule B', 'CFMB', '00000000-0000-4000-a9e7-0000000000e3'),
  ('00000000-0000-4000-b9e7-000000000003', 'Box formule Z', 'CFMZ', '00000000-0000-4000-a9e7-0000000000e4'),
  ('00000000-0000-4000-b9e7-000000000004', 'Box formule X', 'CFMX', '00000000-0000-4000-a9e7-0000000000e5');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active)
SELECT ('00000000-0000-4000-c9e7-0000000000' || p)::uuid, ('00000000-0000-4000-b9e7-00000000000' || b)::uuid, n, 5000, t, act
  FROM (VALUES
    ('a1', '1', 'Mensuel', 'subscription', true),
    ('a2', '1', 'Annuel',  'subscription', true),
    ('a3', '1', 'Ancienne', 'subscription', false),
    ('a4', '1', 'Carnet',  'pack', true),
    ('b1', '2', 'B1', 'subscription', true),
    ('b2', '2', 'B2', 'subscription', true),
    ('d1', '3', 'Z1', 'subscription', true),
    ('d2', '3', 'Z2', 'subscription', true),
    ('e1', '4', 'X1', 'subscription', true),
    ('e2', '4', 'X2', 'subscription', true)
  ) v(p, b, n, t, act);
-- (box, suffixe, rôle, statut, formule, statut d'abonnement, abonnement Stripe,
--  impayé depuis, pause, résiliation programmée)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, stripe_subscription_id,
                                past_due_since, subscription_paused, subscription_cancel_at_period_end, commitment_end_date)
SELECT ('00000000-0000-4000-b9e7-00000000000' || b)::uuid, ('00000000-0000-4000-a9e7-0000000000' || m)::uuid, r, st,
       ('00000000-0000-4000-c9e7-0000000000' || p)::uuid, ss, sub, depuis, pause, resil,
       CASE WHEN m = '10' THEN '2027-06-30 00:00+00'::timestamptz END
  FROM (VALUES
    ('1', 'e1', 'owner',  'active',   NULL, NULL,       NULL,      NULL::timestamptz, false, false),
    ('1', 'e2', 'coach',  'active',   NULL, NULL,       NULL,      NULL, false, false),
    ('1', '10', 'member', 'active',   'a1', 'active',   NULL,      NULL, false, false),
    ('1', '11', 'member', 'active',   'a1', 'active',   NULL,      NULL, false, false),
    ('1', '12', 'member', 'active',   'a1', 'active',   'sub_cfm', NULL, false, false),
    ('1', '13', 'member', 'active',   'a1', 'past_due', NULL,      NULL, false, false),
    ('1', '14', 'member', 'active',   'a1', 'active',   NULL,      now() - interval '1 day', false, false),
    ('1', '15', 'member', 'active',   'a1', 'active',   NULL,      NULL, true,  false),
    ('1', '16', 'member', 'active',   'a1', 'active',   NULL,      NULL, false, true),
    ('1', '17', 'member', 'inactive', 'a1', 'active',   NULL,      NULL, false, false),
    ('1', '18', 'member', 'active',   'a1', 'canceled', 'sub_old', NULL, false, false),
    ('1', '19', 'member', 'active',   NULL, NULL,       NULL,      NULL, false, false),
    ('2', '20', 'member', 'active',   'b1', 'active',   NULL,      NULL, false, false),
    ('3', '21', 'member', 'active',   'd1', 'active',   NULL,      NULL, false, false),
    ('4', '22', 'member', 'active',   'e1', 'active',   NULL,      NULL, false, false)
  ) v(b, m, r, st, p, ss, sub, depuis, pause, resil);
UPDATE public.boxes SET archive_scheduled_at = now() + interval '20 days' WHERE id = '00000000-0000-4000-b9e7-000000000003';
UPDATE public.boxes SET archived_at = now() WHERE id = '00000000-0000-4000-b9e7-000000000004';
-- Groupes de messagerie suivis par formule (trg_sync_member_plan_groups).
INSERT INTO public.message_groups (id, box_id, name, members) VALUES
  ('00000000-0000-4000-d9e7-0000000000a1', '00000000-0000-4000-b9e7-000000000001', 'Groupe P1', ARRAY['00000000-0000-4000-a9e7-000000000010'::uuid]),
  ('00000000-0000-4000-d9e7-0000000000a2', '00000000-0000-4000-b9e7-000000000001', 'Groupe P2', ARRAY[]::uuid[]);
INSERT INTO public.membership_plan_groups (plan_id, group_id) VALUES
  ('00000000-0000-4000-c9e7-0000000000a1', '00000000-0000-4000-d9e7-0000000000a1'),
  ('00000000-0000-4000-c9e7-0000000000a2', '00000000-0000-4000-d9e7-0000000000a2');

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a9e7-0000000000' || s)::uuid $$;
CREATE FUNCTION pg_temp.b(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-b9e7-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.p(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-c9e7-0000000000' || s)::uuid $$;

-- Exécute `p_sql` (qui rend une valeur) sous l'identité `p_qui` (suffixe,
-- « service » ou « anon »), dans un sous-bloc. `p_annuler` : le sous-bloc est
-- annulé même réussi, après lecture du résultat. Rend le résultat (« OK » si
-- NULL) ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text, p_annuler boolean DEFAULT false) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF p_qui IN ('service', 'anon') THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
    PERFORM set_config('role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', pg_temp.u(p_qui)::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql INTO v;
    v := coalesce(v, 'OK');
    IF p_annuler THEN RAISE EXCEPTION USING ERRCODE = 'CFM00', MESSAGE = v; END IF;
  EXCEPTION
    WHEN SQLSTATE 'CFM00' THEN v := SQLERRM;
    WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;

-- Verdict d'un appel : « OK » (un identifiant ou rien), le code PLAN_CHANGE_…,
-- ou le texte brut.
CREATE FUNCTION pg_temp.verdict(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v ~ '^[0-9a-f-]{36}$' OR v = 'OK' THEN 'OK'
              WHEN v ~ '^\w{5}: PLAN_CHANGE_\w+:' THEN split_part(split_part(v, ': ', 2), ':', 1)
              ELSE v END;
$$;

-- Demande de `m` dans la box `b` vers la formule `p`, par la clé serveur.
CREATE FUNCTION pg_temp.demander(m text, b int, p text, p_annuler boolean DEFAULT false) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire('service', format('SELECT public.request_plan_change(%L, %L, %L)::text',
                                         pg_temp.u(m), pg_temp.b(b), pg_temp.p(p)), p_annuler);
$$;
CREATE FUNCTION pg_temp.decider(r uuid, acteur text, accepter boolean, p_annuler boolean DEFAULT false) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire('service', format('SELECT public.decide_plan_change_request(%L, %L, %L)::text',
                                         r, CASE WHEN acteur IS NULL THEN NULL ELSE pg_temp.u(acteur) END, accepter), p_annuler);
$$;
-- Joue `p_sql` puis lit `p_lecture` (instruction suivante : elle voit l'écriture),
-- et annule les deux. Rend « résultat|lecture » ou l'erreur.
CREATE FUNCTION pg_temp.essai(p_sql text, p_lecture text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text; w text;
BEGIN
  BEGIN
    EXECUTE p_sql INTO v;
    EXECUTE p_lecture INTO w;
    RAISE EXCEPTION USING ERRCODE = 'CFM00', MESSAGE = coalesce(v, 'OK') || '|' || coalesce(w, '');
  EXCEPTION
    WHEN SQLSTATE 'CFM00' THEN RETURN SQLERRM;
    WHEN OTHERS THEN RETURN SQLSTATE || ': ' || SQLERRM;
  END;
END $$;
CREATE FUNCTION pg_temp.demande_en_file(m text) RETURNS text LANGUAGE sql AS $$
  SELECT split_part(pg_temp.essai(
    format('SELECT public.request_plan_change(%L, %L, %L)::text', pg_temp.u(m), pg_temp.b(1), pg_temp.p('a2')),
    format('SELECT count(*)::text FROM public.box_manager_notifications WHERE type = ''plan_change_request'' AND member_id = %L', pg_temp.u(m))), '|', 2);
$$;
CREATE FUNCTION pg_temp.acceptee_puis_formule(r uuid) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.essai(format('SELECT public.decide_plan_change_request(%L, %L, true)::text', r, pg_temp.u('e0')),
                       format('SELECT right(plan_id::text, 2) FROM public.box_members WHERE member_id = %L', pg_temp.u('10')));
$$;
CREATE FUNCTION pg_temp.annuler_demande(m text, b int) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire('service', format('SELECT public.cancel_plan_change_request(%L, %L)::text', pg_temp.u(m), pg_temp.b(b)));
$$;
CREATE FUNCTION pg_temp.formule(m text) RETURNS text LANGUAGE sql AS $$
  SELECT right(plan_id::text, 2) FROM public.box_members WHERE member_id = pg_temp.u(m);
$$;
-- Ce que lit `qui` dans box_plan_change_requests : « n:membres:boxes » (suffixes
-- triés), ou l'erreur.
CREATE FUNCTION pg_temp.lu(qui text) RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(qui, 'SELECT count(*) || '':'' || coalesce(string_agg(DISTINCT right(member_id::text, 2), '','' ORDER BY right(member_id::text, 2)), '''')
                                 || '':'' || coalesce(string_agg(DISTINCT right(box_id::text, 1), '','' ORDER BY right(box_id::text, 1)), '''')
                            FROM public.box_plan_change_requests');
$$;
CREATE FUNCTION pg_temp.def(f text) RETURNS text LANGUAGE sql AS $$ SELECT pg_get_functiondef(f::regprocedure) $$;
-- Rejoue `f` avec un remplacement dans sa définition ; échoue s'il ne change rien.
CREATE FUNCTION pg_temp.muter(f text, de text, vers text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text := pg_temp.def(f);
BEGIN
  IF strpos(d, de) = 0 THEN RAISE EXCEPTION 'mutation sans effet sur % : « % » absent', f, de; END IF;
  EXECUTE replace(d, de, vers);
END $$;

DO $t$
DECLARE
  REFUS constant text := '42501: %';
  v text;
  v_cas record;
  r1 uuid; r2 uuid; r3 uuid; rb uuid;
  v_def text;
BEGIN
  -- ── C0 : structure ────────────────────────────────────────────────────────
  IF (SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY column_name) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'box_members'
         AND column_name IN ('scheduled_plan_id', 'scheduled_change_at', 'stripe_schedule_id'))
     IS DISTINCT FROM 'scheduled_change_at timestamp with time zone, scheduled_plan_id uuid, stripe_schedule_id text' THEN
    RAISE EXCEPTION 'C0 : colonnes de box_members';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.box_members'::regclass AND contype = 'f'
                    AND pg_get_constraintdef(oid) = 'FOREIGN KEY (scheduled_plan_id) REFERENCES membership_plans(id) ON DELETE SET NULL') THEN
    RAISE EXCEPTION 'C0 : clé étrangère de scheduled_plan_id';
  END IF;
  IF (SELECT pg_get_indexdef(indexrelid) FROM pg_index WHERE indexrelid = 'public.box_plan_change_requests_une_en_attente'::regclass)
     IS DISTINCT FROM 'CREATE UNIQUE INDEX box_plan_change_requests_une_en_attente ON public.box_plan_change_requests USING btree (box_id, member_id) WHERE (status = ''pending''::text)' THEN
    RAISE EXCEPTION 'C0 : index unique partiel';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_plan_change_requests'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_stripe_portal'::regclass) THEN
    RAISE EXCEPTION 'C0 : RLS';
  END IF;
  IF (SELECT string_agg(policyname || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || qual, ' | ' ORDER BY policyname)
        FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('box_plan_change_requests', 'box_stripe_portal'))
     IS DISTINCT FROM 'box_plan_change_requests_lecture_gerant SELECT authenticated is_box_owner_admin(box_id) | box_plan_change_requests_lecture_membre SELECT authenticated (member_id = auth.uid())' THEN
    RAISE EXCEPTION 'C0 : règles RLS';
  END IF;
  SELECT string_agg(c.relname || ':' || a.grantee::regrole::text || ':' || a.privilege_type, ',' ORDER BY c.relname, a.grantee::regrole::text, a.privilege_type) INTO v
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE c.oid IN ('public.box_plan_change_requests'::regclass, 'public.box_stripe_portal'::regclass)
     AND a.grantee <> c.relowner;
  IF v IS DISTINCT FROM 'box_plan_change_requests:authenticated:SELECT,box_plan_change_requests:service_role:SELECT,box_stripe_portal:service_role:DELETE,box_stripe_portal:service_role:INSERT,box_stripe_portal:service_role:SELECT,box_stripe_portal:service_role:UPDATE' THEN
    RAISE EXCEPTION 'C0 : droits des tables (%)', v;
  END IF;
  FOR v_cas IN SELECT * FROM (VALUES
    ('public.request_plan_change(uuid,uuid,uuid)'),
    ('public.cancel_plan_change_request(uuid,uuid)'),
    ('public.decide_plan_change_request(uuid,uuid,boolean)'),
    ('internal.refus_changement_formule(uuid,uuid,uuid)')
  ) t(sig) LOOP
    SELECT string_agg(coalesce(nullif(a.grantee::regrole::text, '-'), 'PUBLIC') || ':' || a.privilege_type, ',' ORDER BY a.grantee::regrole::text) INTO v
      FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = v_cas.sig::regprocedure AND a.grantee <> p.proowner;
    IF v IS DISTINCT FROM (CASE WHEN v_cas.sig LIKE 'internal.%' THEN NULL ELSE 'service_role:EXECUTE' END) THEN
      RAISE EXCEPTION 'C0 : droits de % (%)', v_cas.sig, v;
    END IF;
    IF NOT (SELECT prosecdef AND proconfig = ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = v_cas.sig::regprocedure) THEN
      RAISE EXCEPTION 'C0 : % pas SECURITY DEFINER à search_path fixé', v_cas.sig;
    END IF;
  END LOOP;
  -- Définitions de la migration, épinglées.
  SELECT string_agg(a.fn || ' ' || md5(pg_temp.def(a.fn)), ', ') INTO v
  FROM (VALUES
    ('public.request_plan_change(uuid,uuid,uuid)', '06fadcdb84857ec179f014cfc7f77690'),
    ('public.cancel_plan_change_request(uuid,uuid)', '0208fa64ff58d791616d4082d2d70cf3'),
    ('public.decide_plan_change_request(uuid,uuid,boolean)', 'e30941fe71a7eb3fc1bc84992e06fb35'),
    ('internal.refus_changement_formule(uuid,uuid,uuid)', '8cc12cb3197cc5cf71c284357a1fba2f'),
    ('public.get_my_membership_billing()', 'b4ca55006146fc83bc3da8eff1260234'),
    ('internal.garder_facturation_membre()', 'b50e8f8843dbe51848862942b3f3602f'),
    ('internal.filer_notification_gerant()', 'df14724f0a600ea18fb1056e7148b940')
  ) a(fn, attendu)
  WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'C0 : définitions différentes du fichier : %', v; END IF;
  IF (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation') IS DISTINCT FROM '05e9de13a14666cd9b5d99040e8da0c3' THEN
    RAISE EXCEPTION 'C0 : déclencheur de la garde (%)', (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation');
  END IF;
  IF (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_notif_gerant_changement_formule') IS DISTINCT FROM
     'CREATE TRIGGER trg_notif_gerant_changement_formule AFTER INSERT ON public.box_plan_change_requests FOR EACH ROW EXECUTE FUNCTION internal.filer_notification_gerant(''plan_change_request'')' THEN
    RAISE EXCEPTION 'C0 : déclencheur de notification';
  END IF;
  -- Fonctions existantes de box_members, aux md5 de prod (04/10/2026) ;
  -- update_box_member_count : md5 du rejeu (la prod porte des CR).
  SELECT string_agg(a.fn, ', ') INTO v
  FROM (VALUES
    ('internal.garder_role_cogerant()', 'a3f6d592e30b88f0099e3e3e0f27e08f'),
    ('internal.refuser_entree_directe_box()', '73b868ed7881131d0e746a9b95645c0d'),
    ('public.update_box_member_count()', '163d943ff7816e332f965e1b4d477420'),
    ('public.release_reservations_on_revoke()', '5970975ea59649147d9c59a99caa93e8'),
    ('public.sync_member_plan_groups()', 'b27819449b9a72407fbce288e8727121'),
    ('public.is_box_owner_admin(uuid)', 'e61752a6')
  ) a(fn, attendu)
  WHERE left(md5(pg_temp.def(a.fn)), length(a.attendu)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'C0 : fonctions existantes modifiées : %', v; END IF;

  -- ── C1 : request_plan_change, chaque cas (sous-bloc annulé) ───────────────
  FOR v_cas IN SELECT * FROM (VALUES
    ('10', 1, 'a2', 'OK'),
    ('18', 1, 'a2', 'OK'),
    ('19', 1, 'a2', 'OK'),
    ('30', 1, 'a2', 'PLAN_CHANGE_NOT_MEMBER'),
    ('17', 1, 'a2', 'PLAN_CHANGE_NOT_MEMBER'),
    ('20', 1, 'a2', 'PLAN_CHANGE_NOT_MEMBER'),
    ('21', 3, 'd2', 'PLAN_CHANGE_BOX_CLOSED'),
    ('22', 4, 'e2', 'PLAN_CHANGE_BOX_CLOSED'),
    ('12', 1, 'a2', 'PLAN_CHANGE_NOT_COUNTER'),
    ('13', 1, 'a2', 'PLAN_CHANGE_PAST_DUE'),
    ('14', 1, 'a2', 'PLAN_CHANGE_PAST_DUE'),
    ('15', 1, 'a2', 'PLAN_CHANGE_PAUSED'),
    ('16', 1, 'a2', 'PLAN_CHANGE_CANCEL_SCHEDULED'),
    ('10', 1, 'b1', 'PLAN_CHANGE_INVALID_PLAN'),
    ('10', 1, 'a3', 'PLAN_CHANGE_INVALID_PLAN'),
    ('10', 1, 'a4', 'PLAN_CHANGE_INVALID_PLAN'),
    ('10', 1, 'a1', 'PLAN_CHANGE_SAME_PLAN')
  ) t(m, b, p, attendu) LOOP
    v := pg_temp.demander(v_cas.m, v_cas.b, v_cas.p, true);
    IF pg_temp.verdict(v) IS DISTINCT FROM v_cas.attendu THEN
      RAISE EXCEPTION 'C1 : % dans % vers % : % au lieu de %', v_cas.m, v_cas.b, v_cas.p, v, v_cas.attendu;
    END IF;
    IF v_cas.attendu <> 'OK' AND v NOT LIKE '23514: %' THEN RAISE EXCEPTION 'C1 : % pas en check_violation', v; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.box_plan_change_requests) OR EXISTS (SELECT 1 FROM public.box_manager_notifications WHERE type = 'plan_change_request') THEN
    RAISE EXCEPTION 'C1 : des lignes subsistent après les appels annulés';
  END IF;

  -- Demande réelle de M1 (engagé, comptoir, P1 → P2).
  r1 := pg_temp.demander('10', 1, 'a2')::uuid;
  IF (SELECT row(box_id, member_id, from_plan_id, to_plan_id, status, decided_at, decided_by)::text
        FROM public.box_plan_change_requests WHERE id = r1)
     IS DISTINCT FROM row(pg_temp.b(1), pg_temp.u('10'), pg_temp.p('a1'), pg_temp.p('a2'), 'pending', NULL::timestamptz, NULL::uuid)::text THEN
    RAISE EXCEPTION 'C1 : ligne de la demande de M1';
  END IF;

  -- ── C2 : notification au gérant ───────────────────────────────────────────
  IF (SELECT count(*) FROM public.box_manager_notifications
       WHERE type = 'plan_change_request' AND event_ref = r1::text AND box_id = pg_temp.b(1)
         AND member_id = pg_temp.u('10') AND plan_id = pg_temp.p('a2') AND sent_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'C2 : la demande de M1 n''est pas en file pour le gérant';
  END IF;

  -- ── C3 : une seule demande en attente ─────────────────────────────────────
  v := pg_temp.demander('10', 1, 'a2', true);
  IF pg_temp.verdict(v) <> 'PLAN_CHANGE_PENDING_EXISTS' OR v NOT LIKE '23514: %' THEN RAISE EXCEPTION 'C3 : seconde demande (%)', v; END IF;
  BEGIN
    INSERT INTO public.box_plan_change_requests (box_id, member_id, to_plan_id) VALUES (pg_temp.b(1), pg_temp.u('10'), pg_temp.p('a2'));
    RAISE EXCEPTION 'C3 : deux demandes en attente pour M1';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- ── C4 : annulation ───────────────────────────────────────────────────────
  r2 := pg_temp.demander('11', 1, 'a2')::uuid;
  IF pg_temp.annuler_demande('11', 1) <> 'true' THEN RAISE EXCEPTION 'C4 : annulation de M2'; END IF;
  IF (SELECT status = 'cancelled' AND decided_by = pg_temp.u('11') AND decided_at IS NOT NULL
        FROM public.box_plan_change_requests WHERE id = r2) IS NOT TRUE THEN
    RAISE EXCEPTION 'C4 : demande de M2 pas annulée';
  END IF;
  IF pg_temp.annuler_demande('11', 1) <> 'false' THEN RAISE EXCEPTION 'C4 : seconde annulation sans « false »'; END IF;
  IF pg_temp.annuler_demande('19', 1) <> 'false' THEN RAISE EXCEPTION 'C4 : annulation sans demande'; END IF;
  IF (SELECT status FROM public.box_plan_change_requests WHERE id = r1) <> 'pending' THEN RAISE EXCEPTION 'C4 : la demande de M1 a bougé'; END IF;
  r2 := pg_temp.demander('11', 1, 'a2')::uuid;

  -- ── C5 : décision ─────────────────────────────────────────────────────────
  FOR v_cas IN SELECT * FROM (VALUES ('e2'), ('10'), ('e3'), (NULL)) t(acteur) LOOP
    v := pg_temp.decider(r1, v_cas.acteur, true);
    IF pg_temp.verdict(v) <> 'PLAN_CHANGE_FORBIDDEN' OR v NOT LIKE REFUS THEN
      RAISE EXCEPTION 'C5 : acteur % (%)', coalesce(v_cas.acteur, 'absent'), v;
    END IF;
  END LOOP;
  IF pg_temp.verdict(pg_temp.decider(gen_random_uuid(), 'e0', true)) <> 'PLAN_CHANGE_NOT_FOUND' THEN RAISE EXCEPTION 'C5 : demande inconnue'; END IF;
  IF (SELECT status FROM public.box_plan_change_requests WHERE id = r1) <> 'pending' OR pg_temp.formule('10') <> 'a1' THEN
    RAISE EXCEPTION 'C5 : un acteur refusé a décidé';
  END IF;
  -- Acceptation par le co-gérant.
  v := pg_temp.decider(r1, 'e1', true);
  IF v <> '{"status": "accepted", "decided": true}' THEN RAISE EXCEPTION 'C5 : acceptation (%)', v; END IF;
  IF pg_temp.formule('10') <> 'a2'
     OR (SELECT commitment_end_date FROM public.box_members WHERE member_id = pg_temp.u('10')) <> '2027-06-30 00:00+00'
     OR (SELECT decided_by FROM public.box_plan_change_requests WHERE id = r1) <> pg_temp.u('e1') THEN
    RAISE EXCEPTION 'C5 : acceptation : formule, engagement ou décideur';
  END IF;
  IF (SELECT string_agg(right(id::text, 2), ',' ORDER BY id) FROM public.message_groups
       WHERE box_id = pg_temp.b(1) AND pg_temp.u('10') = ANY (members)) IS DISTINCT FROM 'a2' THEN
    RAISE EXCEPTION 'C5 : groupes de formule non suivis';
  END IF;
  -- Double décision : sans effet.
  v := pg_temp.decider(r1, 'e0', false);
  IF v <> '{"status": "accepted", "decided": false}' OR pg_temp.formule('10') <> 'a2' THEN RAISE EXCEPTION 'C5 : double décision (%)', v; END IF;
  v := pg_temp.decider(r1, 'e0', true);
  IF v <> '{"status": "accepted", "decided": false}' THEN RAISE EXCEPTION 'C5 : double acceptation (%)', v; END IF;
  -- Refus par le gérant principal.
  v := pg_temp.decider(r2, 'e0', false);
  IF v <> '{"status": "refused", "decided": true}' OR pg_temp.formule('11') <> 'a1' THEN RAISE EXCEPTION 'C5 : refus (%)', v; END IF;
  -- Impayé survenu après la demande : acceptation refusée, refus possible.
  r3 := pg_temp.demander('10', 1, 'a1')::uuid;
  UPDATE public.box_members SET past_due_since = now() WHERE member_id = pg_temp.u('10');
  v := pg_temp.decider(r3, 'e1', true);
  IF pg_temp.verdict(v) <> 'PLAN_CHANGE_PAST_DUE' OR pg_temp.formule('10') <> 'a2'
     OR (SELECT status FROM public.box_plan_change_requests WHERE id = r3) <> 'pending' THEN
    RAISE EXCEPTION 'C5 : acceptation en impayé (%)', v;
  END IF;
  IF pg_temp.decider(r3, 'e0', false) <> '{"status": "refused", "decided": true}' THEN RAISE EXCEPTION 'C5 : refus en impayé'; END IF;
  UPDATE public.box_members SET past_due_since = NULL WHERE member_id = pg_temp.u('10');

  -- ── C6 : RLS et écritures client ──────────────────────────────────────────
  rb := pg_temp.demander('20', 2, 'b2')::uuid;
  r3 := pg_temp.demander('10', 1, 'a1')::uuid;
  FOR v_cas IN SELECT * FROM (VALUES
    ('10', '3:10:1'), ('11', '2:11:1'), ('20', '1:20:2'),
    ('e0', '5:10,11:1'), ('e1', '5:10,11:1'), ('e3', '1:20:2'),
    ('e2', '0::'), ('30', '0::')
  ) t(qui, attendu) LOOP
    IF pg_temp.lu(v_cas.qui) IS DISTINCT FROM v_cas.attendu THEN
      RAISE EXCEPTION 'C6 : % lit % au lieu de %', v_cas.qui, pg_temp.lu(v_cas.qui), v_cas.attendu;
    END IF;
  END LOOP;
  IF pg_temp.lu('anon') NOT LIKE REFUS THEN RAISE EXCEPTION 'C6 : anon lit (%)', pg_temp.lu('anon'); END IF;
  FOR v_cas IN SELECT * FROM (VALUES ('e0'), ('e1'), ('10')) t(qui) LOOP
    FOREACH v IN ARRAY ARRAY[
      format('INSERT INTO public.box_plan_change_requests (box_id, member_id, to_plan_id) VALUES (%L, %L, %L)', pg_temp.b(1), pg_temp.u('11'), pg_temp.p('a2')),
      'WITH m AS (UPDATE public.box_plan_change_requests SET status = ''accepted'' RETURNING 1) SELECT count(*)::text FROM m',
      'WITH m AS (DELETE FROM public.box_plan_change_requests RETURNING 1) SELECT count(*)::text FROM m'
    ] LOOP
      IF pg_temp.faire(v_cas.qui, v) NOT LIKE REFUS THEN RAISE EXCEPTION 'C6 : % écrit : %', v_cas.qui, v; END IF;
    END LOOP;
  END LOOP;

  -- ── C7 : fonctions refusées aux clients ───────────────────────────────────
  FOR v_cas IN SELECT * FROM (VALUES ('anon'), ('e0'), ('10')) t(qui) LOOP
    FOREACH v IN ARRAY ARRAY[
      format('SELECT public.request_plan_change(%L, %L, %L)::text', pg_temp.u('11'), pg_temp.b(1), pg_temp.p('a2')),
      format('SELECT public.cancel_plan_change_request(%L, %L)::text', pg_temp.u('10'), pg_temp.b(1)),
      format('SELECT public.decide_plan_change_request(%L, %L, true)::text', r3, pg_temp.u('e0'))
    ] LOOP
      IF pg_temp.faire(v_cas.qui, v) NOT LIKE '42501: permission denied for function %' THEN
        RAISE EXCEPTION 'C7 : % exécute : % (%)', v_cas.qui, v, pg_temp.faire(v_cas.qui, v);
      END IF;
    END LOOP;
  END LOOP;

  -- ── C8 : colonnes de box_members ──────────────────────────────────────────
  FOREACH v IN ARRAY ARRAY[
    format('scheduled_plan_id = %L', pg_temp.p('a2')), 'scheduled_change_at = now()', 'stripe_schedule_id = ''sub_sched_pirate'''
  ] LOOP
    FOR v_cas IN SELECT * FROM (VALUES ('e0'), ('e1')) t(qui) LOOP
      IF pg_temp.faire(v_cas.qui, format('WITH m AS (UPDATE public.box_members SET %s WHERE member_id = %L RETURNING 1) SELECT count(*)::text FROM m', v, pg_temp.u('11')))
         NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE%' THEN
        RAISE EXCEPTION 'C8 : % écrit %', v_cas.qui, v;
      END IF;
    END LOOP;
    IF pg_temp.faire('11', format('SELECT %s::text FROM public.box_members WHERE member_id = %L', split_part(v, ' ', 1), pg_temp.u('11')))
       NOT LIKE '42501: permission denied%' THEN
      RAISE EXCEPTION 'C8 : M2 lit %', split_part(v, ' ', 1);
    END IF;
  END LOOP;
  IF pg_temp.faire('e0', format('INSERT INTO public.box_members (box_id, member_id, role, status, scheduled_change_at) VALUES (%L, %L, ''member'', ''active'', now())', pg_temp.b(1), pg_temp.u('30')))
     NOT LIKE '42501: MEMBRE_FACTURATION_RESERVEE%' THEN
    RAISE EXCEPTION 'C8 : insertion avec un changement programmé';
  END IF;
  v := pg_temp.faire('service', format('WITH m AS (UPDATE public.box_members SET scheduled_plan_id = %L, scheduled_change_at = ''2026-11-01 00:00+00'', stripe_schedule_id = ''sub_sched_1'' WHERE member_id = %L RETURNING 1) SELECT count(*)::text FROM m', pg_temp.p('a2'), pg_temp.u('11')));
  IF v <> '1' THEN RAISE EXCEPTION 'C8 : la clé serveur n''écrit pas le changement programmé (%)', v; END IF;
  v := pg_temp.faire('11', 'SELECT string_agg(right(scheduled_plan_id::text, 2) || ''@'' || to_char(scheduled_change_at AT TIME ZONE ''UTC'', ''YYYY-MM-DD''), '','') FROM public.get_my_membership_billing()');
  IF v <> 'a2@2026-11-01' THEN RAISE EXCEPTION 'C8 : get_my_membership_billing de M2 (%)', v; END IF;
  v := pg_temp.faire('10', 'SELECT count(*) FILTER (WHERE scheduled_plan_id IS NULL AND scheduled_change_at IS NULL)::text FROM public.get_my_membership_billing()');
  IF v <> '1' THEN RAISE EXCEPTION 'C8 : get_my_membership_billing de M1 (%)', v; END IF;

  -- ── C9 : configuration du portail Stripe ──────────────────────────────────
  v := pg_temp.faire('service', format('WITH m AS (INSERT INTO public.box_stripe_portal VALUES (%L, ''bpc_cfm'') RETURNING 1) SELECT count(*)::text FROM m', pg_temp.b(1)));
  IF v <> '1' OR pg_temp.faire('service', 'SELECT stripe_portal_configuration_id FROM public.box_stripe_portal') <> 'bpc_cfm' THEN
    RAISE EXCEPTION 'C9 : la clé serveur n''écrit ou ne lit pas (%)', v;
  END IF;
  FOR v_cas IN SELECT * FROM (VALUES ('anon'), ('e0'), ('e1'), ('10')) t(qui) LOOP
    FOREACH v IN ARRAY ARRAY[
      'SELECT count(*)::text FROM public.box_stripe_portal',
      format('INSERT INTO public.box_stripe_portal VALUES (%L, ''bpc_pirate'')', pg_temp.b(2)),
      'WITH m AS (UPDATE public.box_stripe_portal SET stripe_portal_configuration_id = ''x'' RETURNING 1) SELECT count(*)::text FROM m'
    ] LOOP
      IF pg_temp.faire(v_cas.qui, v) NOT LIKE '42501: permission denied%' THEN RAISE EXCEPTION 'C9 : % passe : %', v_cas.qui, v; END IF;
    END LOOP;
  END LOOP;

  -- ── M : mutations ─────────────────────────────────────────────────────────
  -- C1 : chaque refus retiré de la règle laisse passer son cas.
  v_def := pg_temp.def('internal.refus_changement_formule(uuid,uuid,uuid)');
  FOR v_cas IN SELECT * FROM (VALUES
    ('PLAN_CHANGE_NOT_MEMBER', '17', 1, 'a2'),
    ('PLAN_CHANGE_BOX_CLOSED', '21', 3, 'd2'),
    ('PLAN_CHANGE_NOT_COUNTER', '12', 1, 'a2'),
    ('PLAN_CHANGE_PAST_DUE', '14', 1, 'a2'),
    ('PLAN_CHANGE_PAUSED', '15', 1, 'a2'),
    ('PLAN_CHANGE_CANCEL_SCHEDULED', '16', 1, 'a2'),
    ('PLAN_CHANGE_INVALID_PLAN', '19', 1, 'a4'),
    ('PLAN_CHANGE_SAME_PLAN', '19', 1, 'a2')
  ) t(code, m, b, p) LOOP
    IF v_cas.code = 'PLAN_CHANGE_SAME_PLAN' THEN
      UPDATE public.box_members SET plan_id = pg_temp.p('a2') WHERE member_id = pg_temp.u('19');
    END IF;
    PERFORM pg_temp.muter('internal.refus_changement_formule(uuid,uuid,uuid)', 'RETURN ''' || v_cas.code || ':', 'RETURN NULL; RETURN ''' || v_cas.code || ':');
    v := pg_temp.demander(v_cas.m, v_cas.b, v_cas.p, true);
    EXECUTE v_def;
    IF pg_temp.verdict(v) = v_cas.code THEN RAISE EXCEPTION 'M : % retiré, encore refusé : C1 ne prouve rien', v_cas.code; END IF;
    IF v_cas.code = 'PLAN_CHANGE_SAME_PLAN' THEN
      UPDATE public.box_members SET plan_id = NULL WHERE member_id = pg_temp.u('19');
    END IF;
  END LOOP;
  -- C1 : la suspension (impayé ancien) ne passe pas non plus sans le contrôle d'impayé.
  PERFORM pg_temp.muter('internal.refus_changement_formule(uuid,uuid,uuid)', 'bm.subscription_status = ''past_due'' OR', 'false AND');
  IF pg_temp.verdict(pg_temp.demander('13', 1, 'a2', true)) <> 'OK' THEN RAISE EXCEPTION 'M : statut past_due non contrôlé, encore refusé'; END IF;
  EXECUTE v_def;

  -- C2 : la notification vient du déclencheur et de sa branche.
  ALTER TABLE public.box_plan_change_requests DISABLE TRIGGER trg_notif_gerant_changement_formule;
  v := pg_temp.demande_en_file('19');
  ALTER TABLE public.box_plan_change_requests ENABLE TRIGGER trg_notif_gerant_changement_formule;
  IF v <> '0' THEN RAISE EXCEPTION 'M : déclencheur coupé, la demande est encore en file : C2 ne prouve rien (%)', v; END IF;
  v_def := pg_temp.def('internal.filer_notification_gerant()');
  PERFORM pg_temp.muter('internal.filer_notification_gerant()', 'v_type = ''plan_change_request''', 'v_type = ''zz''');
  v := pg_temp.demande_en_file('19');
  EXECUTE v_def;
  IF v <> '0' THEN RAISE EXCEPTION 'M : branche retirée, la demande est encore en file : C2 ne prouve rien (%)', v; END IF;
  IF pg_temp.demande_en_file('19') <> '1' THEN RAISE EXCEPTION 'M : la file n''est pas observée'; END IF;

  -- C3 : sans l'index unique, une seconde demande en attente passe.
  DROP INDEX public.box_plan_change_requests_une_en_attente;
  IF pg_temp.verdict(pg_temp.demander('10', 1, 'a1', true)) <> 'OK' THEN RAISE EXCEPTION 'M : index retiré, seconde demande encore refusée : C3 ne prouve rien'; END IF;
  CREATE UNIQUE INDEX box_plan_change_requests_une_en_attente
    ON public.box_plan_change_requests (box_id, member_id) WHERE status = 'pending';

  -- C4 : sans l'écriture conditionnelle, une seconde annulation rend vrai.
  v_def := pg_temp.def('public.cancel_plan_change_request(uuid,uuid)');
  PERFORM pg_temp.muter('public.cancel_plan_change_request(uuid,uuid)', ' AND status = ''pending''', '');
  v := pg_temp.faire('service', format('SELECT public.cancel_plan_change_request(%L, %L)::text', pg_temp.u('11'), pg_temp.b(1)), true);
  EXECUTE v_def;
  IF v <> 'true' THEN RAISE EXCEPTION 'M : annulation sans condition, encore « false » : C4 ne prouve rien (%)', v; END IF;

  -- C5 : acteur coach, double décision, écriture de plan_id, règle rejouée.
  v_def := pg_temp.def('public.decide_plan_change_request(uuid,uuid,boolean)');
  PERFORM pg_temp.muter('public.decide_plan_change_request(uuid,uuid,boolean)', 'role = ''owner''', 'role IN (''owner'', ''coach'')');
  v := pg_temp.decider(r3, 'e2', true, true);
  EXECUTE v_def;
  IF pg_temp.verdict(v) = 'PLAN_CHANGE_FORBIDDEN' THEN RAISE EXCEPTION 'M : coach admis, encore refusé : C5 ne prouve rien'; END IF;
  PERFORM pg_temp.muter('public.decide_plan_change_request(uuid,uuid,boolean)', 'WHERE id = p_request_id AND status = ''pending''', 'WHERE id = p_request_id');
  v := pg_temp.decider(r1, 'e0', false, true);
  EXECUTE v_def;
  IF v <> '{"status": "refused", "decided": true}' THEN RAISE EXCEPTION 'M : sans condition, la double décision est encore sans effet : C5 ne prouve rien (%)', v; END IF;
  PERFORM pg_temp.muter('public.decide_plan_change_request(uuid,uuid,boolean)',
    'UPDATE public.box_members SET plan_id = r.to_plan_id' || E'
' || '     WHERE box_id = r.box_id AND member_id = r.member_id;', 'NULL;');
  v := pg_temp.acceptee_puis_formule(r3);
  EXECUTE v_def;
  IF v NOT LIKE '%"decided": true}|a2' THEN RAISE EXCEPTION 'M : sans écriture, plan_id change encore : C5 ne prouve rien (%)', v; END IF;
  IF pg_temp.acceptee_puis_formule(r3) NOT LIKE '%"decided": true}|a1' THEN
    RAISE EXCEPTION 'M : l''écriture de plan_id n''est pas observée';
  END IF;
  UPDATE public.box_members SET past_due_since = now() WHERE member_id = pg_temp.u('10');
  PERFORM pg_temp.muter('public.decide_plan_change_request(uuid,uuid,boolean)', 'v_refus := internal.refus_changement_formule(r.member_id, r.box_id, r.to_plan_id);', 'v_refus := NULL;');
  v := pg_temp.decider(r3, 'e1', true, true);
  EXECUTE v_def;
  UPDATE public.box_members SET past_due_since = NULL WHERE member_id = pg_temp.u('10');
  IF v <> '{"status": "accepted", "decided": true}' THEN RAISE EXCEPTION 'M : règle non rejouée, encore refusé : C5 ne prouve rien (%)', v; END IF;

  -- C6 : chaque règle borne sa lecture ; le refus d'écriture tient au droit et à la RLS.
  ALTER POLICY box_plan_change_requests_lecture_gerant ON public.box_plan_change_requests USING (true);
  IF pg_temp.lu('e3') = '1:20:2' OR pg_temp.lu('e2') = '0::' THEN RAISE EXCEPTION 'M : règle gérant ouverte, lectures inchangées : C6 ne prouve rien'; END IF;
  ALTER POLICY box_plan_change_requests_lecture_gerant ON public.box_plan_change_requests USING (public.is_box_owner_admin(box_id));
  ALTER POLICY box_plan_change_requests_lecture_membre ON public.box_plan_change_requests USING (true);
  IF pg_temp.lu('11') = '2:11:1' THEN RAISE EXCEPTION 'M : règle membre ouverte, lecture inchangée : C6 ne prouve rien'; END IF;
  ALTER POLICY box_plan_change_requests_lecture_membre ON public.box_plan_change_requests USING (member_id = auth.uid());
  GRANT SELECT ON public.box_plan_change_requests TO anon;
  IF pg_temp.lu('anon') <> '0::' THEN RAISE EXCEPTION 'M : SELECT accordé à anon, la RLS devrait rendre 0 ligne (%)', pg_temp.lu('anon'); END IF;
  ALTER TABLE public.box_plan_change_requests DISABLE ROW LEVEL SECURITY;
  IF pg_temp.lu('anon') = '0::' OR pg_temp.lu('anon') LIKE REFUS THEN RAISE EXCEPTION 'M : SELECT accordé et RLS coupée, anon ne lit rien : C6 ne prouve rien'; END IF;
  REVOKE SELECT ON public.box_plan_change_requests FROM anon;
  v := format('WITH m AS (DELETE FROM public.box_plan_change_requests WHERE id = %L RETURNING 1) SELECT count(*)::text FROM m', rb);
  IF pg_temp.faire('e0', v, true) NOT LIKE REFUS THEN RAISE EXCEPTION 'M : sans RLS ni droit, le gérant supprime'; END IF;
  GRANT DELETE ON public.box_plan_change_requests TO authenticated;
  IF pg_temp.faire('e0', v, true) <> '1' THEN RAISE EXCEPTION 'M : droit accordé et RLS coupée, la suppression est encore refusée : C6 ne prouve rien'; END IF;
  ALTER TABLE public.box_plan_change_requests ENABLE ROW LEVEL SECURITY;
  IF pg_temp.faire('e0', v, true) <> '0' THEN RAISE EXCEPTION 'M : droit accordé, la RLS devrait tout filtrer'; END IF;
  REVOKE DELETE ON public.box_plan_change_requests FROM authenticated;

  -- C7 : l'EXECUTE accordé ouvre l'appel.
  GRANT EXECUTE ON FUNCTION public.request_plan_change(uuid, uuid, uuid) TO authenticated;
  IF pg_temp.verdict(pg_temp.faire('11', format('SELECT public.request_plan_change(%L, %L, %L)::text', pg_temp.u('11'), pg_temp.b(1), pg_temp.p('a2')), true)) <> 'OK' THEN
    RAISE EXCEPTION 'M : EXECUTE accordé, encore refusé : C7 ne prouve rien';
  END IF;
  REVOKE EXECUTE ON FUNCTION public.request_plan_change(uuid, uuid, uuid) FROM authenticated;

  -- C8 : la garde (corps et liste de colonnes) et le droit de lecture.
  v := format('WITH m AS (UPDATE public.box_members SET scheduled_change_at = now() WHERE member_id = %L RETURNING 1) SELECT count(*)::text FROM m', pg_temp.u('10'));
  v_def := pg_temp.def('internal.garder_facturation_membre()');
  PERFORM pg_temp.muter('internal.garder_facturation_membre()', 'NEW.scheduled_change_at,', 'OLD.scheduled_change_at,');
  IF pg_temp.faire('e0', v, true) <> '1' THEN RAISE EXCEPTION 'M : garde sans la colonne, encore refusé : C8 ne prouve rien'; END IF;
  EXECUTE v_def;
  DROP TRIGGER trg_box_members_garde_facturation ON public.box_members;
  CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();
  IF pg_temp.faire('e0', v, true) <> '1' THEN RAISE EXCEPTION 'M : déclencheur sans la colonne, encore refusé : C8 ne prouve rien'; END IF;
  DROP TRIGGER trg_box_members_garde_facturation ON public.box_members;
  CREATE TRIGGER trg_box_members_garde_facturation BEFORE INSERT OR UPDATE OF plan_id, subscription_status, stripe_subscription_id, stripe_checkout_session_id, subscription_current_period_end, subscription_cancel_at_period_end, amount_cents, platform_fee_cents, commitment_end_date, subscription_paused, pause_started_at, pause_resumes_at, payment_method_type, past_due_since, dunning_attempts, last_payment_error, dunning_reminders_sent, dunning_last_reminder_at, billing_day, scheduled_plan_id, scheduled_change_at, stripe_schedule_id, status ON public.box_members FOR EACH ROW EXECUTE FUNCTION internal.garder_facturation_membre();
  GRANT SELECT (scheduled_plan_id) ON public.box_members TO authenticated;
  IF pg_temp.faire('11', format('SELECT right(scheduled_plan_id::text, 2) FROM public.box_members WHERE member_id = %L', pg_temp.u('11'))) <> 'a2' THEN
    RAISE EXCEPTION 'M : lecture accordée, encore refusée : C8 ne prouve rien';
  END IF;
  REVOKE SELECT (scheduled_plan_id) ON public.box_members FROM authenticated;

  -- C9 : droit puis RLS.
  GRANT SELECT ON public.box_stripe_portal TO authenticated;
  IF pg_temp.faire('e0', 'SELECT count(*)::text FROM public.box_stripe_portal') <> '0' THEN RAISE EXCEPTION 'M : SELECT accordé, la RLS devrait rendre 0 ligne'; END IF;
  ALTER TABLE public.box_stripe_portal DISABLE ROW LEVEL SECURITY;
  IF pg_temp.faire('e0', 'SELECT count(*)::text FROM public.box_stripe_portal') <> '1' THEN RAISE EXCEPTION 'M : SELECT accordé et RLS coupée, rien lu : C9 ne prouve rien'; END IF;
  ALTER TABLE public.box_stripe_portal ENABLE ROW LEVEL SECURITY;
  REVOKE SELECT ON public.box_stripe_portal FROM authenticated;
END $t$;

-- Les mutations n'ont rien laissé : définitions et droits revenus au fichier.
DO $t$
BEGIN
  IF (SELECT string_agg(md5(pg_temp.def(f)), ',') FROM unnest(ARRAY[
        'public.cancel_plan_change_request(uuid,uuid)', 'public.decide_plan_change_request(uuid,uuid,boolean)',
        'internal.refus_changement_formule(uuid,uuid,uuid)', 'internal.garder_facturation_membre()',
        'internal.filer_notification_gerant()']) f)
     IS DISTINCT FROM '0208fa64ff58d791616d4082d2d70cf3,e30941fe71a7eb3fc1bc84992e06fb35,8cc12cb3197cc5cf71c284357a1fba2f,b50e8f8843dbe51848862942b3f3602f,df14724f0a600ea18fb1056e7148b940'
     OR (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation') <> '05e9de13a14666cd9b5d99040e8da0c3' THEN
    RAISE EXCEPTION 'M : une définition mutée n''est pas revenue';
  END IF;
END $t$;

-- ── R : retour arrière ────────────────────────────────────────────────────────
\i supabase/retours/20270147000000_changement_formule.sql
DO $t$
DECLARE v text;
BEGIN
  SELECT string_agg(a.fn || ' ' || md5(pg_temp.def(a.fn)), ', ') INTO v
  FROM (VALUES
    ('public.get_my_membership_billing()', '6b3770f8bcf03c86b7e68f2e680c734e'),
    ('internal.garder_facturation_membre()', '2c8c6335dd9ec48f9e2899af6f24dffc'),
    ('internal.filer_notification_gerant()', '6b0bb58f80f3eeeaa883d838ae5049ce')
  ) a(fn, attendu)
  WHERE md5(pg_temp.def(a.fn)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'R : définitions de prod non rétablies : %', v; END IF;
  IF (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_box_members_garde_facturation') <> '28761293666c139c12bf0f687c07eaf1' THEN
    RAISE EXCEPTION 'R : déclencheur de la garde non rétabli';
  END IF;
  IF has_function_privilege('anon', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_my_membership_billing()', 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = 'public.get_my_membership_billing()'::regprocedure AND a.grantee = 0)
     OR obj_description('public.get_my_membership_billing()'::regprocedure, 'pg_proc') IS DISTINCT FROM
        'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.' THEN
    RAISE EXCEPTION 'R : droits ou commentaire de get_my_membership_billing';
  END IF;
  IF to_regclass('public.box_plan_change_requests') IS NOT NULL OR to_regclass('public.box_stripe_portal') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('request_plan_change', 'cancel_plan_change_request', 'decide_plan_change_request', 'refus_changement_formule'))
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'box_members'
                  AND column_name IN ('scheduled_plan_id', 'scheduled_change_at', 'stripe_schedule_id'))
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notif_gerant_changement_formule')
     OR EXISTS (SELECT 1 FROM public.box_manager_notifications WHERE type = 'plan_change_request') THEN
    RAISE EXCEPTION 'R : un objet ajouté subsiste';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'box_manager_notifications_type_check')
     <> 'CHECK ((type = ANY (ARRAY[''subscription_paid''::text, ''payment_failed''::text, ''booked_without_plan''::text, ''invitation_accepted''::text])))' THEN
    RAISE EXCEPTION 'R : contrainte de type de la file non rétablie';
  END IF;
END $t$;

ROLLBACK;
\echo '    C0 à C9, M et R OK'
