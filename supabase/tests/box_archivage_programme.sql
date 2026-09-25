-- ═════════════════════════════════════════════════════════════════════════════
-- Archivage programmé d'une box (migration 20270127)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Boxes : B1 ouverte, B2 en archivage programmé, B3 archivée, B5 ouverte
-- (éditrice d'une offre gratuite). Candidats U1 (rejoindre, programme,
-- comptoir), U2 (invitation), U3 (droits en attente), X (hors box), M2 (membre
-- de B2, abonné Stripe), SA (super-admin).
--   E1 rejoindre par code (nouveau membre, ex-membre réactivé) ; E2 invitation (consommer, présenter) ; E3 essai
--      (réserver, lister) ; E4 offre gratuite (box abonnée ou éditrice) ;
--      E5 droits en attente ; E6 inscription à un programme ; E7 vente au
--      comptoir ; E8 écritures directes du gérant (la clé serveur passe) ;
--      E9 box_accepts_entries — chacun refusé en B2 (BOX_ARCHIVAGE_PROGRAMME)
--      et en B3 (BOX_ARCHIVEE), accepté en B1 ;
--   L  annuaire : B2 invisible pour anon et hors box, visible de ses membres,
--      de son gérant et du super-admin ;
--   A  archivage automatique : A1 à A6 (un type d'abonnement qui paie chacun)
--      restent programmées ; A7 (abonnement « manual » et membre au comptoir)
--      et A8 (rien) sont archivées et journalisées ; A1 est archivée dès que
--      son abonnement se termine ; la tâche cron est planifiée ;
--   P  l'acheteur d'un programme payé en une fois lit encore le programme et
--      son contenu, une fois la box archivée ;
--   U  annulation : refusée au gérant, impossible sur une box archivée ou non
--      programmée ; par le super-admin, elle rouvre les entrées ;
--   R  alerte : fin de période dépassée de plus de 2 jours seulement ;
--      super-admin seulement.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Box : archivage programmé, entrées fermées, archivage automatique'

BEGIN;

-- ── Utilisateurs (…a9b0-…) ────────────────────────────────────────────────────
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9b0-0000000000' || s)::uuid
  FROM unnest(ARRAY['01','02','03','05','0a','0b','0c','0d','0e','0f','10','11','12','13','14','15','16','17','18','19','1a','1b','1c']) s;
INSERT INTO public.profiles (id, email, username, role)
SELECT ('00000000-0000-4000-a9b0-0000000000' || s)::uuid, 'arc-' || s || '@test.invalid', 'arc_' || s,
       CASE s WHEN '0f' THEN 'super_admin' ELSE 'athlete' END
  FROM unnest(ARRAY['01','02','03','05','0a','0b','0c','0d','0e','0f','10','11','12','13','14','15','16','17','18','19','1a','1b','1c']) s;
-- 01 O1, 02 O2, 03 O3, 05 O5 (gérants) ; 0a U1, 0b U2, 0c U3, 0d X, 0e M2, 0f SA ;
-- 10 à 19 gérants des boxes A1 à A8, P et R ; 1a acheteur du programme ; 1b membre au comptoir ;
-- 1c ex-membre de B2 (adhésion inactive).

-- ── Boxes (…b9b0-…) ──────────────────────────────────────────────────────────
INSERT INTO public.boxes (id, name, invite_code, owner_id, is_active, archived_at, archive_scheduled_at, archive_scheduled_by)
SELECT ('00000000-0000-4000-b9b0-0000000000' || k)::uuid, 'Box ' || k, 'ARC' || k,
       ('00000000-0000-4000-a9b0-0000000000' || o)::uuid, true,
       CASE WHEN k = '03' THEN now() END,
       CASE WHEN k IN ('02','a1','a2','a3','a4','a5','a6','a7','a8','9f','c1','c2') THEN now() - interval '1 day' END,
       CASE WHEN k IN ('02','a1','a2','a3','a4','a5','a6','a7','a8','9f','c1','c2') THEN '00000000-0000-4000-a9b0-00000000000f'::uuid END
  FROM (VALUES ('01','01'), ('02','02'), ('03','03'), ('05','05'),
               ('a1','10'), ('a2','11'), ('a3','12'), ('a4','13'), ('a5','14'), ('a6','15'), ('a7','16'), ('a8','17'),
               ('9f','18'), ('c1','19'), ('c2','19'), ('c3','19')) v(k, o);
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT ('00000000-0000-4000-b9b0-0000000000' || k)::uuid, ('00000000-0000-4000-a9b0-0000000000' || o)::uuid, 'owner', 'active'
  FROM (VALUES ('01','01'), ('02','02'), ('03','03'), ('05','05')) v(k, o);
-- M2 : membre de B2, abonné Stripe (B2 paie encore : elle reste programmée).
INSERT INTO public.box_members (box_id, member_id, role, status, subscription_status, stripe_subscription_id)
VALUES ('00000000-0000-4000-b9b0-000000000002', '00000000-0000-4000-a9b0-00000000000e', 'member', 'active', 'active', 'sub_arc_m2');
INSERT INTO public.box_members (box_id, member_id, role, status)
VALUES ('00000000-0000-4000-b9b0-000000000002', '00000000-0000-4000-a9b0-00000000001c', 'member', 'inactive');

-- ── Décor d'entrée, par box B1, B2, B3 ───────────────────────────────────────
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type)
SELECT ('00000000-0000-4000-c9b0-0000000000' || t || k)::uuid, ('00000000-0000-4000-b9b0-00000000000' || k)::uuid,
       CASE t WHEN '1' THEN 'Essai' ELSE 'Comptoir' END, CASE t WHEN '1' THEN 0 ELSE 5000 END,
       CASE t WHEN '1' THEN 'trial' ELSE 'subscription' END
  FROM unnest(ARRAY['1','2','3']) k, unnest(ARRAY['1','2']) t;
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time)
SELECT ('00000000-0000-4000-d9b0-00000000000' || k)::uuid, ('00000000-0000-4000-b9b0-00000000000' || k)::uuid,
       'Cours ' || k, CURRENT_DATE + 2, '18:00', '19:00'
  FROM unnest(ARRAY['1','2','3']) k;
INSERT INTO public.box_invitations (box_id, email, token_hash, expires_at)
SELECT ('00000000-0000-4000-b9b0-00000000000' || k)::uuid, 'arc-0b@test.invalid',
       encode(sha256(('tok-arc-' || k)::bytea), 'hex'), now() + interval '7 days'
  FROM unnest(ARRAY['1','2','3']) k;
INSERT INTO public.programs (id, box_id, title, price_cents, type, invite_code)
SELECT ('00000000-0000-4000-e9b0-00000000000' || k)::uuid, ('00000000-0000-4000-b9b0-00000000000' || k)::uuid,
       'Programme ' || k, 0, 'ongoing', 'ARCP' || k
  FROM unnest(ARRAY['1','2','3']) k;
-- Offres gratuites publiées : B2 (éditrice fermée) et B5 (ouverte).
INSERT INTO public.box_programming (id, publisher_box_id, title, is_published)
VALUES ('00000000-0000-4000-f9b0-000000000002', '00000000-0000-4000-b9b0-000000000002', 'Offre B2', true),
       ('00000000-0000-4000-f9b0-000000000005', '00000000-0000-4000-b9b0-000000000005', 'Offre B5', true);
-- Droits en attente de U3 : un carnet en B1, un en B2.
INSERT INTO public.pending_entitlements (email, kind, payload)
SELECT 'arc-0c@test.invalid', 'credit',
       jsonb_build_object('box_id', '00000000-0000-4000-b9b0-00000000000' || k, 'credits', 5, 'validity_days', 30)
  FROM unnest(ARRAY['1','2']) k;

-- ── Archivage automatique : A1 à A8 ──────────────────────────────────────────
INSERT INTO public.box_members (box_id, member_id, role, status, subscription_status, stripe_subscription_id, subscription_current_period_end)
VALUES ('00000000-0000-4000-b9b0-0000000000a1', '00000000-0000-4000-a9b0-00000000000a', 'member', 'active', 'active',   'sub_arc_a1', NULL),
       ('00000000-0000-4000-b9b0-0000000000a2', '00000000-0000-4000-a9b0-00000000000a', 'member', 'active', 'past_due', 'sub_arc_a2', NULL),
       -- A7 : un membre au comptoir (sans Stripe) ;
       ('00000000-0000-4000-b9b0-0000000000a7', '00000000-0000-4000-a9b0-00000000001b', 'member', 'active', 'active',   NULL, NULL),
       -- R1 / R2 / R3 : fins de période dépassées de 3 jours, de 1 jour, de 5 jours (R3 non programmée).
       ('00000000-0000-4000-b9b0-0000000000c1', '00000000-0000-4000-a9b0-00000000000a', 'member', 'active', 'active', 'sub_arc_r1', now() - interval '3 days'),
       ('00000000-0000-4000-b9b0-0000000000c2', '00000000-0000-4000-a9b0-00000000000a', 'member', 'active', 'active', 'sub_arc_r2', now() - interval '1 day'),
       ('00000000-0000-4000-b9b0-0000000000c3', '00000000-0000-4000-a9b0-00000000000a', 'member', 'active', 'active', 'sub_arc_r3', now() - interval '5 days');
INSERT INTO public.programs (id, box_id, title, price_cents, type, invite_code) VALUES
  ('00000000-0000-4000-e9b0-0000000000a3', '00000000-0000-4000-b9b0-0000000000a3', 'Programme A3', 2900, 'ongoing', 'ARCPA3'),
  ('00000000-0000-4000-e9b0-00000000009f', '00000000-0000-4000-b9b0-00000000009f', 'Programme P',  4900, 'fixed',   'ARCPP');
INSERT INTO public.program_members (program_id, user_id, status, provenance, stripe_subscription_id, stripe_payment_intent) VALUES
  -- A3 : un abonnement de programme ;
  ('00000000-0000-4000-e9b0-0000000000a3', '00000000-0000-4000-a9b0-00000000000a', 'active', 'stripe', 'sub_arc_a3', NULL),
  -- P : un achat en une fois (ne retarde rien, garde la lecture).
  ('00000000-0000-4000-e9b0-00000000009f', '00000000-0000-4000-a9b0-00000000001a', 'active', 'stripe', NULL, 'pi_arc_p');
INSERT INTO public.box_programming (id, publisher_box_id, title, is_published, billing, price_cents) VALUES
  ('00000000-0000-4000-f9b0-0000000000a4', '00000000-0000-4000-b9b0-0000000000a4', 'Offre A4', true, 'monthly', 1900),
  ('00000000-0000-4000-f9b0-0000000000b5', '00000000-0000-4000-b9b0-000000000005', 'Offre B5 payante', true, 'monthly', 1900);
INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status, stripe_subscription_id) VALUES
  -- A4 : une offre vendue ; A5 : une offre achetée, en impayé.
  ('00000000-0000-4000-f9b0-0000000000a4', '00000000-0000-4000-b9b0-000000000005', 'active',   'sub_arc_a4'),
  ('00000000-0000-4000-f9b0-0000000000b5', '00000000-0000-4000-b9b0-0000000000a5', 'past_due', 'sub_arc_a5');
INSERT INTO public.box_subscriptions (box_id, status, plan_tier, billing_source) VALUES
  -- A6 : l'abonnement de la box à AthleX, en essai ; A7 : offert (manual).
  ('00000000-0000-4000-b9b0-0000000000a6', 'trialing', 'trial',    'stripe'),
  ('00000000-0000-4000-b9b0-0000000000a7', 'active',   'complete', 'manual');

-- P : le contenu du programme (une séance, un jour de repos).
INSERT INTO public.box_wods (id, box_id, title, is_published, scheduled_date) VALUES
  ('00000000-0000-4000-9b00-00000000009f', '00000000-0000-4000-b9b0-00000000009f', 'Séance P', true, CURRENT_DATE);
INSERT INTO public.wod_program_access (wod_id, program_id) VALUES
  ('00000000-0000-4000-9b00-00000000009f', '00000000-0000-4000-e9b0-00000000009f');
INSERT INTO public.program_rest_days (program_id, program_week, program_day) VALUES
  ('00000000-0000-4000-e9b0-00000000009f', 1, 7);

-- ── Outils ───────────────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_qui = 'admin' THEN
    RETURN;
  ELSIF p_qui IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('role', 'anon', true);
  ELSIF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9b0-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
END $$;
CREATE FUNCTION pg_temp.sortir() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- Exécute une instruction sous une identité : l'erreur, ou le résultat en texte.
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.en_tant_que(p_qui);
  BEGIN
    IF p_sql ~* '^\s*(insert|update|delete)' THEN
      EXECUTE p_sql;
    ELSE
      EXECUTE p_sql INTO v;
    END IF;
    v := coalesce(v, 'OK');
  EXCEPTION WHEN OTHERS THEN v := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.b(k text) RETURNS text LANGUAGE sql AS $$ SELECT '00000000-0000-4000-b9b0-0000000000' || k $$;
CREATE FUNCTION pg_temp.archivee(k text) RETURNS boolean LANGUAGE sql AS $$
  SELECT archived_at IS NOT NULL FROM public.boxes WHERE id = pg_temp.b(k)::uuid $$;

DO $t$
DECLARE
  v text;
  k text;
  n int;
BEGIN
  -- E1 : rejoindre par code.
  v := pg_temp.faire('0a', 'SELECT public.join_box_by_invite(''ARC01'')::text');
  IF v <> pg_temp.b('01') THEN RAISE EXCEPTION 'E1 : rejoindre une box ouverte : %', v; END IF;
  v := pg_temp.faire('0a', 'SELECT public.join_box_by_invite(''ARC02'')::text');
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E1 : rejoindre une box programmée : %', v; END IF;
  v := pg_temp.faire('0a', 'SELECT public.join_box_by_invite(''ARC03'')::text');
  IF v NOT LIKE 'BOX_ARCHIVEE%' THEN RAISE EXCEPTION 'E1 : rejoindre une box archivée : %', v; END IF;
  -- La réactivation d'un ex-membre passe par une mise à jour, hors déclencheur.
  v := pg_temp.faire('1c', 'SELECT public.join_box_by_invite(''ARC02'')::text');
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E1 : réactivation d''un ex-membre dans une box programmée : %', v; END IF;
  v := pg_temp.faire('0e', 'SELECT public.join_box_by_invite(''ARC02'')::text');
  IF v <> pg_temp.b('02') THEN RAISE EXCEPTION 'E1 : le membre déjà actif ne retrouve plus sa box : %', v; END IF;

  -- E2 : invitation (présenter, puis consommer).
  v := pg_temp.faire(NULL, 'SELECT public.peek_box_invitation(''tok-arc-2'')->>''reason''');
  IF v IS DISTINCT FROM 'box_archivage_programme' THEN RAISE EXCEPTION 'E2 : présentation d''une invitation de box programmée : %', v; END IF;
  v := pg_temp.faire('0b', 'SELECT public.consume_box_invitation(''tok-arc-2'')->>''reason''');
  IF v IS DISTINCT FROM 'box_archivage_programme' THEN RAISE EXCEPTION 'E2 : invitation de box programmée : %', v; END IF;
  v := pg_temp.faire('0b', 'SELECT public.consume_box_invitation(''tok-arc-3'')->>''reason''');
  IF v IS DISTINCT FROM 'box_archivee' THEN RAISE EXCEPTION 'E2 : invitation de box archivée : %', v; END IF;
  v := pg_temp.faire('0b', 'SELECT public.consume_box_invitation(''tok-arc-1'')->>''ok''');
  IF v IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'E2 : invitation de box ouverte : %', v; END IF;

  -- E3 : essai.
  v := pg_temp.faire(NULL, format('SELECT public.list_public_trial_slots(%L)->>''reason''', pg_temp.b('02')));
  IF v IS DISTINCT FROM 'box_archivage_programme' THEN RAISE EXCEPTION 'E3 : créneaux d''essai d''une box programmée : %', v; END IF;
  v := pg_temp.faire(NULL, format('SELECT public.book_trial_slot(%L, ''00000000-0000-4000-d9b0-000000000002'', ''Jean'', NULL, ''essai-arc@test.invalid'')->>''reason''', pg_temp.b('02')));
  IF v IS DISTINCT FROM 'box_archivage_programme' THEN RAISE EXCEPTION 'E3 : essai dans une box programmée : %', v; END IF;
  v := pg_temp.faire(NULL, format('SELECT public.book_trial_slot(%L, ''00000000-0000-4000-d9b0-000000000003'', ''Jean'', NULL, ''essai-arc@test.invalid'')->>''reason''', pg_temp.b('03')));
  IF v IS DISTINCT FROM 'box_archivee' THEN RAISE EXCEPTION 'E3 : essai dans une box archivée : %', v; END IF;
  v := pg_temp.faire(NULL, format('SELECT public.book_trial_slot(%L, ''00000000-0000-4000-d9b0-000000000001'', ''Jean'', NULL, ''essai-arc@test.invalid'')->>''ok''', pg_temp.b('01')));
  IF v IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'E3 : essai dans une box ouverte : %', v; END IF;

  -- E4 : offre gratuite.
  v := pg_temp.faire('01', format('SELECT public.subscribe_free_programming(''00000000-0000-4000-f9b0-000000000002'', %L)::text', pg_temp.b('01')));
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E4 : abonnement à l''offre d''une éditrice programmée : %', v; END IF;
  v := pg_temp.faire('02', format('SELECT public.subscribe_free_programming(''00000000-0000-4000-f9b0-000000000005'', %L)::text', pg_temp.b('02')));
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E4 : abonnement d''une box programmée : %', v; END IF;
  v := pg_temp.faire('01', format('SELECT public.subscribe_free_programming(''00000000-0000-4000-f9b0-000000000005'', %L)->>''status''', pg_temp.b('01')));
  IF v IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'E4 : abonnement d''une box ouverte à une offre ouverte : %', v; END IF;

  -- E5 : droits en attente — celui de B1 est réclamé, celui de B2 reste en attente.
  v := pg_temp.faire('service', 'SELECT public.claim_pending_entitlements(''00000000-0000-4000-a9b0-00000000000c'', ''arc-0c@test.invalid'')::text');
  IF v IS DISTINCT FROM '1'
     OR (SELECT count(*) FROM public.pending_entitlements WHERE email = 'arc-0c@test.invalid' AND claimed_at IS NULL
          AND payload->>'box_id' = pg_temp.b('02')) <> 1 THEN
    RAISE EXCEPTION 'E5 : droits en attente : % réclamé(s), celui de la box programmée doit rester en attente', v;
  END IF;

  -- E6 : inscription à un programme.
  FOREACH k IN ARRAY ARRAY['2', '3', '1'] LOOP
    v := pg_temp.faire('admin', format('SELECT public._upsert_program_member(%L, ''00000000-0000-4000-a9b0-00000000000a'', NULL, ''staff'')::text',
                                    '00000000-0000-4000-e9b0-00000000000' || k));
    PERFORM pg_temp.sortir();
    IF (k = '2' AND v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%') OR (k = '3' AND v NOT LIKE 'BOX_ARCHIVEE%')
       OR (k = '1' AND v LIKE 'BOX_%') THEN
      RAISE EXCEPTION 'E6 : inscription au programme de B% : %', k, v;
    END IF;
  END LOOP;

  -- E7 : vente au comptoir.
  FOREACH k IN ARRAY ARRAY['2', '3', '1'] LOOP
    v := pg_temp.faire('admin', format('SELECT public._log_box_cash_payment(%L, ''00000000-0000-4000-a9b0-00000000000a'', NULL, %L, ''renewal'')::text',
                                    pg_temp.b('0' || k), '00000000-0000-4000-c9b0-0000000000' || '2' || k));
    IF (k = '2' AND v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME: Cette box est en cours d''archivage%')
       OR (k = '3' AND v NOT LIKE 'BOX_ARCHIVEE%') OR (k = '1' AND v LIKE 'BOX_%') THEN
      RAISE EXCEPTION 'E7 : vente au comptoir en B% : %', k, v;
    END IF;
  END LOOP;

  -- E8 : écritures directes du gérant ; la clé serveur passe.
  v := pg_temp.faire('02', format('INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9b0-00000000000d'', ''member'', ''active'')', pg_temp.b('02')));
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E8 : ajout direct d''un membre dans une box programmée : %', v; END IF;
  v := pg_temp.faire('03', format('INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9b0-00000000000d'', ''member'', ''active'')', pg_temp.b('03')));
  IF v NOT LIKE 'BOX_ARCHIVEE%' THEN RAISE EXCEPTION 'E8 : ajout direct d''un membre dans une box archivée : %', v; END IF;
  v := pg_temp.faire('02', format('INSERT INTO public.box_invitations (box_id, email, token_hash, expires_at) VALUES (%L, ''arc-x@test.invalid'', ''h-arc-x'', now() + interval ''1 day'')', pg_temp.b('02')));
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E8 : invitation créée dans une box programmée : %', v; END IF;
  v := pg_temp.faire('01', format('INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status) VALUES (''00000000-0000-4000-f9b0-000000000002'', %L, ''active'')', pg_temp.b('01')));
  IF v NOT LIKE 'BOX_ARCHIVAGE_PROGRAMME%' THEN RAISE EXCEPTION 'E8 : abonnement direct à l''offre d''une éditrice programmée : %', v; END IF;
  v := pg_temp.faire('01', format('INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9b0-00000000000d'', ''member'', ''active'')', pg_temp.b('01')));
  IF v <> 'OK' THEN RAISE EXCEPTION 'E8 : ajout direct d''un membre dans une box ouverte : %', v; END IF;
  v := pg_temp.faire('service', format('INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9b0-00000000000c'', ''member'', ''active'')', pg_temp.b('02')));
  IF v <> 'OK' THEN RAISE EXCEPTION 'E8 : la clé serveur (webhook) ne peut plus écrire dans une box programmée : %', v; END IF;

  -- E9 : la règle unique.
  IF NOT public.box_accepts_entries(pg_temp.b('01')::uuid) OR public.box_accepts_entries(pg_temp.b('02')::uuid)
     OR public.box_accepts_entries(pg_temp.b('03')::uuid) THEN
    RAISE EXCEPTION 'E9 : box_accepts_entries ne suit pas la règle';
  END IF;

  -- L : annuaire.
  v := pg_temp.faire(NULL, format('SELECT count(*)::text FROM public.boxes WHERE id IN (%L, %L)', pg_temp.b('01'), pg_temp.b('02')));
  IF v <> '1' THEN RAISE EXCEPTION 'L : anon voit % box(es) sur B1, B2 (attendu 1)', v; END IF;
  v := pg_temp.faire('0d', format('SELECT count(*)::text FROM public.boxes WHERE id = %L', pg_temp.b('02')));
  IF v <> '0' THEN RAISE EXCEPTION 'L : un utilisateur hors box voit la box programmée'; END IF;
  FOREACH k IN ARRAY ARRAY['0e', '02', '0f'] LOOP
    v := pg_temp.faire(k, format('SELECT count(*)::text FROM public.boxes WHERE id = %L', pg_temp.b('02')));
    IF v <> '1' THEN RAISE EXCEPTION 'L : % (membre, gérant ou super-admin) ne voit plus la box programmée : %', k, v; END IF;
  END LOOP;

  -- A : la tâche est planifiée ; archivage automatique.
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'box_archive_sweep' AND command LIKE '%internal.archiver_boxes_echues()%') THEN
    RAISE EXCEPTION 'A : la tâche box_archive_sweep n''est pas planifiée';
  END IF;
  n := internal.archiver_boxes_echues();
  FOREACH k IN ARRAY ARRAY['a1', 'a2', 'a3', 'a4', 'a5', 'a6'] LOOP
    IF pg_temp.archivee(k) THEN RAISE EXCEPTION 'A : % a été archivée alors qu''un abonnement paie encore', k; END IF;
  END LOOP;
  IF NOT pg_temp.archivee('a7') THEN RAISE EXCEPTION 'A : A7 (manual + comptoir) n''a pas été archivée'; END IF;
  IF NOT pg_temp.archivee('a8') THEN RAISE EXCEPTION 'A : A8 (rien ne paie) n''a pas été archivée'; END IF;
  IF pg_temp.archivee('01') OR pg_temp.archivee('02') THEN RAISE EXCEPTION 'A : une box ouverte ou qui paie encore a été archivée'; END IF;
  IF (SELECT count(*) FROM public.box_auto_archive_log WHERE box_id IN (pg_temp.b('a7')::uuid, pg_temp.b('a8')::uuid)
        AND scheduled_by = '00000000-0000-4000-a9b0-00000000000f') <> 2
     OR (SELECT archived_by FROM public.boxes WHERE id = pg_temp.b('a8')::uuid) IS DISTINCT FROM '00000000-0000-4000-a9b0-00000000000f' THEN
    RAISE EXCEPTION 'A : archivage automatique non journalisé ou sans auteur';
  END IF;
  UPDATE public.box_members SET subscription_status = 'cancelled' WHERE box_id = pg_temp.b('a1')::uuid;
  PERFORM internal.archiver_boxes_echues();
  IF NOT pg_temp.archivee('a1') THEN RAISE EXCEPTION 'A : A1 n''est pas archivée une fois son abonnement terminé'; END IF;

  -- P : l'acheteur du programme payé en une fois, box archivée.
  IF NOT pg_temp.archivee('9f') THEN RAISE EXCEPTION 'P : décor — la box du programme n''a pas été archivée'; END IF;
  v := pg_temp.faire('1a', 'SELECT ((SELECT count(*) FROM public.programs WHERE id = ''00000000-0000-4000-e9b0-00000000009f'')
                              || ''/'' || (SELECT count(*) FROM public.box_wods WHERE id = ''00000000-0000-4000-9b00-00000000009f'')
                              || ''/'' || (SELECT count(*) FROM public.wod_program_access WHERE program_id = ''00000000-0000-4000-e9b0-00000000009f'')
                              || ''/'' || (SELECT count(*) FROM public.program_rest_days WHERE program_id = ''00000000-0000-4000-e9b0-00000000009f''))');
  IF v <> '1/1/1/1' THEN RAISE EXCEPTION 'P : l''acheteur ne lit plus son programme ou son contenu (programme/séance/lien/repos = %)', v; END IF;

  -- U : annulation.
  v := pg_temp.faire('02', format('SELECT ''OK'' FROM public.unschedule_box_archive(%L)', pg_temp.b('02')));
  IF v NOT LIKE 'Accès refusé%' THEN RAISE EXCEPTION 'U : le gérant annule l''archivage : %', v; END IF;
  v := pg_temp.faire('0f', format('SELECT ''OK'' FROM public.unschedule_box_archive(%L)', pg_temp.b('03')));
  IF v NOT LIKE 'BOX_DEJA_ARCHIVEE%' THEN RAISE EXCEPTION 'U : annulation sur une box archivée : %', v; END IF;
  v := pg_temp.faire('0f', format('SELECT ''OK'' FROM public.unschedule_box_archive(%L)', pg_temp.b('01')));
  IF v NOT LIKE 'ARCHIVAGE_NON_PROGRAMME%' THEN RAISE EXCEPTION 'U : annulation sur une box non programmée : %', v; END IF;
  v := pg_temp.faire('0f', format('SELECT ''OK'' FROM public.unschedule_box_archive(%L)', pg_temp.b('02')));
  IF v <> 'OK' OR NOT public.box_accepts_entries(pg_temp.b('02')::uuid) THEN RAISE EXCEPTION 'U : annulation par le super-admin : %', v; END IF;
  v := pg_temp.faire('0a', 'SELECT public.join_box_by_invite(''ARC02'')::text');
  IF v <> pg_temp.b('02') THEN RAISE EXCEPTION 'U : les entrées ne sont pas rouvertes : %', v; END IF;
  IF (SELECT subscription_status FROM public.box_members WHERE box_id = pg_temp.b('02')::uuid AND member_id = '00000000-0000-4000-a9b0-00000000000e') <> 'active' THEN
    RAISE EXCEPTION 'U : l''annulation a touché un abonnement';
  END IF;

  -- R : alerte.
  v := pg_temp.faire('01', 'SELECT count(*)::text FROM public.box_archive_overdue()');
  IF v NOT LIKE 'Accès refusé%' THEN RAISE EXCEPTION 'R : alerte ouverte à un gérant : %', v; END IF;
  v := pg_temp.faire('0f', format('SELECT string_agg(box_id::text, '','') FROM public.box_archive_overdue() WHERE box_id::text LIKE %L', '%-b9b0-%'));
  IF v IS DISTINCT FROM pg_temp.b('c1') THEN RAISE EXCEPTION 'R : alerte : % (attendu R1 seule)', v; END IF;
END $t$;

ROLLBACK;
\echo '    E1 à E9, L, A, P, U, R OK'
