-- ═════════════════════════════════════════════════════════════════════════════
-- Notifications push au gérant : file d'attente et déclencheurs (migration 20270143)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : gérant G (…e0, owner_id), co-gérant C (…e1), coach K (…e2), membres
-- M1 à M4 (…10 à …13), formule P. Box BA archivée (gérant …21), membre M5 (…14).
-- Les écritures « serveur » (webhook, fonctions) sont jouées par le
-- superutilisateur du rejeu, comme la clé serveur passe la garde de facturation.
--   F0  structure : table, RLS, clé unique, droits ; fonction SECURITY DEFINER
--       fermée aux clients ; six déclencheurs AFTER ligne par ligne (le sixième,
--       demande de changement de formule, vient de 20270147) ; les
--       fonctions existantes des trois tables aux md5 de prod (04/10/2026) ;
--   F1  subscription_paid : création active (INSERT), activation d'une ligne
--       en attente (UPDATE), réabonnement (nouvel identifiant) : une ligne
--       chacune ; renouvellement, webhook rejoué, retour d'impayé ou reprise
--       sous le même identifiant, comptoir : aucune ;
--   F2  payment_failed : NULL → date, une ligne ; relance (date gardée) et
--       changement de date : aucune ; nouvel impayé après régularisation : une ;
--   F3  booked_without_plan : une alerte, une ligne, heure du cours à Paris et
--       auteur ; alerte résolue : aucune ;
--   F4  invitation_accepted : une ligne ; réécriture « accepted », révocation :
--       aucune ; acceptée → en attente → acceptée : toujours une seule ;
--   F5  box archivée : rien ;
--   F6  droits : anon et authenticated ne lisent ni n'écrivent la table et
--       n'exécutent pas la fonction ; la clé serveur lit et n'écrit que les
--       colonnes d'envoi ;
--   F7  une erreur de mise en file ne bloque pas l'écriture d'origine ;
--   F8  mutations : chaque contrôle ci-dessus échoue quand on retire ce qu'il
--       prouve (WHEN des déclencheurs, déclencheur désactivé, clé unique,
--       contrôle d'archivage, rattrapage d'erreur, droits, RLS) ;
--   F9  retour arrière de l'en-tête de la migration, joué tel quel.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Notifications du gérant : file d''attente et déclencheurs'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9d5-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', '10', '11', '12', '13', '14', '21']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9d5-0000000000' || s)::uuid, 'ngf-' || s || '@test.invalid', 'ngf_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', '10', '11', '12', '13', '14', '21']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9d5-000000000001', 'Box file', 'NGF1', '00000000-0000-4000-a9d5-0000000000e0'),
  ('00000000-0000-4000-b9d5-000000000002', 'Box archivée', 'NGF2', '00000000-0000-4000-a9d5-000000000021');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type) VALUES
  ('00000000-0000-4000-c9d5-0000000000a1', '00000000-0000-4000-b9d5-000000000001', 'Illimité', 8900, 'subscription');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9d5-000000000001', '00000000-0000-4000-a9d5-0000000000e1', 'owner',  'active'),
  ('00000000-0000-4000-b9d5-000000000001', '00000000-0000-4000-a9d5-0000000000e2', 'coach',  'active'),
  -- M1 : invité Stripe, en attente de paiement.
  ('00000000-0000-4000-b9d5-000000000001', '00000000-0000-4000-a9d5-000000000010', 'member', 'inactive'),
  -- M3 : au comptoir.
  ('00000000-0000-4000-b9d5-000000000001', '00000000-0000-4000-a9d5-000000000012', 'member', 'active'),
  ('00000000-0000-4000-b9d5-000000000002', '00000000-0000-4000-a9d5-000000000014', 'member', 'active');
UPDATE public.box_members SET subscription_status = 'pending_payment'
 WHERE member_id = '00000000-0000-4000-a9d5-000000000010';
-- M4 : abonnement Stripe activé AVANT la migration (déclencheurs coupés le temps de l'écrire).
ALTER TABLE public.box_members DISABLE TRIGGER trg_notif_gerant_abonnement_creation;
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, stripe_subscription_id) VALUES
  ('00000000-0000-4000-b9d5-000000000001', '00000000-0000-4000-a9d5-000000000013', 'member', 'active',
   '00000000-0000-4000-c9d5-0000000000a1', 'active', 'sub_ngf_ancien');
ALTER TABLE public.box_members ENABLE TRIGGER trg_notif_gerant_abonnement_creation;
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time) VALUES
  ('00000000-0000-4000-d9d5-000000000001', '00000000-0000-4000-b9d5-000000000001', 'WOD', DATE '2026-11-03', '18:30', '19:30');
INSERT INTO public.class_reservations (id, schedule_id, member_id, box_id, status) VALUES
  ('00000000-0000-4000-d9d5-0000000000f1', '00000000-0000-4000-d9d5-000000000001', '00000000-0000-4000-a9d5-000000000011',
   '00000000-0000-4000-b9d5-000000000001', 'confirmed');
INSERT INTO public.box_invitations (id, box_id, email, token_hash, expires_at, payment_mode) VALUES
  ('00000000-0000-4000-e9d5-000000000001', '00000000-0000-4000-b9d5-000000000001', 'ngf-i1@test.invalid', 'ngf-h1', now() + interval '7 days', 'stripe'),
  ('00000000-0000-4000-e9d5-000000000002', '00000000-0000-4000-b9d5-000000000001', 'ngf-i2@test.invalid', 'ngf-h2', now() + interval '7 days', 'box'),
  ('00000000-0000-4000-e9d5-000000000003', '00000000-0000-4000-b9d5-000000000002', 'ngf-i3@test.invalid', 'ngf-h3', now() + interval '7 days', 'box');
-- Une seule écriture de la box archivée après ses données : l'archivage.
UPDATE public.boxes SET archived_at = now() WHERE id = '00000000-0000-4000-b9d5-000000000002';

-- Exécute `p_sql` sous l'identité `p_qui` (« anon », « service » ou un suffixe
-- d'utilisateur) ; rend le résultat, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF p_qui IN ('service', 'anon') THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
    PERFORM set_config('role', CASE p_qui WHEN 'service' THEN 'service_role' ELSE 'anon' END, true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9d5-0000000000' || p_qui, true);
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

-- Lignes de la file pour ce type (et cette référence, si donnée).
CREATE FUNCTION pg_temp.nb(p_type text, p_ref text DEFAULT NULL) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.box_manager_notifications
  WHERE type = p_type AND (p_ref IS NULL OR event_ref = p_ref);
$$;

CREATE FUNCTION pg_temp.def() RETURNS text LANGUAGE sql AS $$
  SELECT pg_get_functiondef('internal.filer_notification_gerant()'::regprocedure);
$$;

DO $t$
DECLARE
  B   constant uuid := '00000000-0000-4000-b9d5-000000000001';
  BA  constant uuid := '00000000-0000-4000-b9d5-000000000002';
  P   constant uuid := '00000000-0000-4000-c9d5-0000000000a1';
  M1  constant uuid := '00000000-0000-4000-a9d5-000000000010';
  M2  constant uuid := '00000000-0000-4000-a9d5-000000000011';
  M3  constant uuid := '00000000-0000-4000-a9d5-000000000012';
  M4  constant uuid := '00000000-0000-4000-a9d5-000000000013';
  M5  constant uuid := '00000000-0000-4000-a9d5-000000000014';
  K   constant uuid := '00000000-0000-4000-a9d5-0000000000e2';
  I1  constant uuid := '00000000-0000-4000-e9d5-000000000001';
  I2  constant uuid := '00000000-0000-4000-e9d5-000000000002';
  I3  constant uuid := '00000000-0000-4000-e9d5-000000000003';
  REFUS constant text := '42501: permission denied%';
  v_n int;
  v text;
  v_qui text;
  v_def text;
  v_impaye timestamptz := '2026-10-04 09:15:00.123456+00';
  v_alerte uuid;
  r record;
BEGIN
  -- ── F0 : structure ────────────────────────────────────────────────────────
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_manager_notifications'::regclass) THEN
    RAISE EXCEPTION 'F0 : RLS inactive sur box_manager_notifications';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_manager_notifications') THEN
    RAISE EXCEPTION 'F0 : une règle RLS existe sur box_manager_notifications (aucune attendue)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.box_manager_notifications'::regclass AND contype = 'u'
                    AND pg_get_constraintdef(oid) = 'UNIQUE (type, event_ref)') THEN
    RAISE EXCEPTION 'F0 : pas de clé unique (type, event_ref)';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'internal.filer_notification_gerant()'::regprocedure) THEN
    RAISE EXCEPTION 'F0 : filer_notification_gerant n''est pas SECURITY DEFINER';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgfoid = 'internal.filer_notification_gerant()'::regprocedure
         AND t.tgenabled = 'O' AND (t.tgtype & 3) = 1) <> 6 THEN
    RAISE EXCEPTION 'F0 : il faut six déclencheurs AFTER, ligne par ligne, actifs, sur filer_notification_gerant';
  END IF;
  -- Fonctions existantes des tables touchées, aux md5 de prod (04/10/2026) ;
  -- update_box_member_count : md5 du rejeu (la prod porte des CR, 82f49d09…).
  SELECT string_agg(a.fn || ' ' || coalesce(md5(pg_get_functiondef(a.fn::regprocedure)), 'absente'), ', ') INTO v
  FROM (VALUES
    ('internal.garder_facturation_membre()', 'b50e8f8843dbe51848862942b3f3602f'), -- 20270147
    ('internal.garder_role_cogerant()', 'a3f6d592e30b88f0099e3e3e0f27e08f'),
    ('internal.refuser_entree_directe_box()', '73b868ed7881131d0e746a9b95645c0d'),
    ('public.update_box_member_count()', '163d943ff7816e332f965e1b4d477420'),
    ('public.release_reservations_on_revoke()', '5970975ea59649147d9c59a99caa93e8'),
    ('public.sync_member_plan_groups()', 'b27819449b9a72407fbce288e8727121'),
    ('internal.alerter_reservation_sans_formule()', 'c7d278376a5fd40f7370e3b5da50f263')
  ) a(fn, attendu)
  WHERE md5(pg_get_functiondef(a.fn::regprocedure)) IS DISTINCT FROM a.attendu;
  IF v IS NOT NULL THEN RAISE EXCEPTION 'F0 : fonctions existantes modifiées : %', v; END IF;

  -- ── F1 : nouvel abonnement ────────────────────────────────────────────────
  -- Création de la ligne par le webhook (pas de ligne existante).
  INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, stripe_subscription_id)
  VALUES (B, M2, 'member', 'active', P, 'active', 'sub_ngf_m2');
  IF pg_temp.nb('subscription_paid', 'sub_ngf_m2') <> 1 THEN RAISE EXCEPTION 'F1 : création active, pas une ligne'; END IF;
  -- Activation de la ligne en attente (activateMembership).
  UPDATE public.box_members SET status = 'active', plan_id = P, subscription_status = 'active',
         stripe_subscription_id = 'sub_ngf_m1', past_due_since = NULL
   WHERE box_id = B AND member_id = M1;
  IF pg_temp.nb('subscription_paid', 'sub_ngf_m1') <> 1 THEN RAISE EXCEPTION 'F1 : activation, pas une ligne'; END IF;
  SELECT member_id, plan_id INTO r FROM public.box_manager_notifications WHERE event_ref = 'sub_ngf_m1';
  IF r.member_id IS DISTINCT FROM M1 OR r.plan_id IS DISTINCT FROM P THEN RAISE EXCEPTION 'F1 : membre ou formule faux (%)', r; END IF;
  -- Webhook rejoué, renouvellement (invoice.paid), statut réécrit : rien de plus.
  UPDATE public.box_members SET subscription_status = 'active', stripe_subscription_id = 'sub_ngf_m1'
   WHERE box_id = B AND member_id = M1;
  UPDATE public.box_members SET subscription_status = 'active', past_due_since = NULL, dunning_attempts = 0
   WHERE box_id = B AND member_id = M1;
  -- Retour d'impayé et reprise après pause, sous l'identifiant d'avant la migration.
  UPDATE public.box_members SET subscription_status = 'past_due' WHERE box_id = B AND member_id = M4;
  UPDATE public.box_members SET subscription_status = 'active' WHERE box_id = B AND member_id = M4;
  UPDATE public.box_members SET subscription_status = 'cancelled' WHERE box_id = B AND member_id = M4;
  UPDATE public.box_members SET subscription_status = 'active' WHERE box_id = B AND member_id = M4;
  -- Comptoir : actif sans abonnement Stripe.
  UPDATE public.box_members SET subscription_status = 'active', payment_method_type = 'cash'
   WHERE box_id = B AND member_id = M3;
  IF pg_temp.nb('subscription_paid') <> 2 THEN
    RAISE EXCEPTION 'F1 : renouvellement, rejeu, retour d''impayé, reprise ou comptoir mis en file (% lignes)', pg_temp.nb('subscription_paid');
  END IF;
  -- Réabonnement : nouvel identifiant.
  UPDATE public.box_members SET subscription_status = 'active', stripe_subscription_id = 'sub_ngf_m4_bis'
   WHERE box_id = B AND member_id = M4;
  IF pg_temp.nb('subscription_paid', 'sub_ngf_m4_bis') <> 1 OR pg_temp.nb('subscription_paid') <> 3 THEN
    RAISE EXCEPTION 'F1 : réabonnement, pas exactement une ligne de plus';
  END IF;

  -- ── F2 : paiement échoué ──────────────────────────────────────────────────
  UPDATE public.box_members SET subscription_status = 'past_due', past_due_since = v_impaye, dunning_attempts = 1
   WHERE box_id = B AND member_id = M1;
  IF pg_temp.nb('payment_failed') <> 1 THEN RAISE EXCEPTION 'F2 : impayé, pas une ligne'; END IF;
  -- Relance : date gardée, compteur incrémenté. Puis date déplacée.
  UPDATE public.box_members SET past_due_since = v_impaye, dunning_attempts = 2 WHERE box_id = B AND member_id = M1;
  UPDATE public.box_members SET past_due_since = v_impaye + interval '1 day' WHERE box_id = B AND member_id = M1;
  IF pg_temp.nb('payment_failed') <> 1 THEN RAISE EXCEPTION 'F2 : relance ou date déplacée mise en file'; END IF;
  -- Régularisé, puis nouvel impayé : un nouvel épisode.
  UPDATE public.box_members SET subscription_status = 'active', past_due_since = NULL WHERE box_id = B AND member_id = M1;
  UPDATE public.box_members SET subscription_status = 'past_due', past_due_since = v_impaye + interval '30 days'
   WHERE box_id = B AND member_id = M1;
  IF pg_temp.nb('payment_failed') <> 2 THEN RAISE EXCEPTION 'F2 : second épisode d''impayé, pas une ligne de plus'; END IF;

  -- ── F3 : inscription sans formule ─────────────────────────────────────────
  INSERT INTO public.box_member_alerts (box_id, member_id, reservation_id, kind, created_by)
  VALUES (B, M2, '00000000-0000-4000-d9d5-0000000000f1', 'reservation_sans_formule', K)
  RETURNING id INTO v_alerte;
  IF pg_temp.nb('booked_without_plan', v_alerte::text) <> 1 THEN RAISE EXCEPTION 'F3 : alerte, pas une ligne'; END IF;
  SELECT class_starts_at, actor_id, member_id INTO r FROM public.box_manager_notifications WHERE event_ref = v_alerte::text;
  IF r.class_starts_at IS DISTINCT FROM timestamptz '2026-11-03 17:30:00+00' OR r.actor_id IS DISTINCT FROM K
     OR r.member_id IS DISTINCT FROM M2 THEN
    RAISE EXCEPTION 'F3 : heure (18:30 à Paris = 17:30 UTC en novembre), auteur ou membre faux (%)', r;
  END IF;
  UPDATE public.box_member_alerts SET resolved_at = now() WHERE id = v_alerte;
  IF pg_temp.nb('booked_without_plan') <> 1 THEN RAISE EXCEPTION 'F3 : résolution mise en file'; END IF;

  -- ── F4 : invitation acceptée ──────────────────────────────────────────────
  UPDATE public.box_invitations SET status = 'accepted', accepted_by = M3, accepted_at = now() WHERE id = I1;
  IF pg_temp.nb('invitation_accepted', I1::text) <> 1 THEN RAISE EXCEPTION 'F4 : acceptation, pas une ligne'; END IF;
  UPDATE public.box_invitations SET status = 'accepted', accepted_at = now() WHERE id = I1;
  UPDATE public.box_invitations SET status = 'revoked' WHERE id = I2;
  UPDATE public.box_invitations SET status = 'pending' WHERE id = I1;
  UPDATE public.box_invitations SET status = 'accepted' WHERE id = I1;
  IF pg_temp.nb('invitation_accepted') <> 1 THEN
    RAISE EXCEPTION 'F4 : réécriture, révocation ou seconde acceptation mise en file (% lignes)', pg_temp.nb('invitation_accepted');
  END IF;

  -- ── F5 : box archivée ─────────────────────────────────────────────────────
  UPDATE public.box_invitations SET status = 'accepted', accepted_by = M5 WHERE id = I3;
  UPDATE public.box_members SET subscription_status = 'active', stripe_subscription_id = 'sub_ngf_ba' WHERE box_id = BA AND member_id = M5;
  UPDATE public.box_members SET past_due_since = v_impaye WHERE box_id = BA AND member_id = M5;
  IF EXISTS (SELECT 1 FROM public.box_manager_notifications WHERE box_id = BA) THEN
    RAISE EXCEPTION 'F5 : une box archivée met en file';
  END IF;

  -- ── F6 : droits ───────────────────────────────────────────────────────────
  FOREACH v_qui IN ARRAY ARRAY['anon', 'e0', 'e1'] LOOP
    FOREACH v IN ARRAY ARRAY[
      'SELECT count(*)::text FROM public.box_manager_notifications',
      format('INSERT INTO public.box_manager_notifications (box_id, type, event_ref, member_id) VALUES (%L, ''payment_failed'', ''x'', %L)', B, M1),
      'WITH m AS (UPDATE public.box_manager_notifications SET sent_at = now() RETURNING 1) SELECT count(*)::text FROM m',
      'WITH m AS (DELETE FROM public.box_manager_notifications RETURNING 1) SELECT count(*)::text FROM m'
    ] LOOP
      IF pg_temp.faire(v_qui, v) NOT LIKE REFUS THEN
        RAISE EXCEPTION 'F6 : % passe : % (%)', v_qui, v, pg_temp.faire(v_qui, v);
      END IF;
    END LOOP;
    IF has_function_privilege(CASE v_qui WHEN 'anon' THEN 'anon' ELSE 'authenticated' END,
                              'internal.filer_notification_gerant()', 'EXECUTE') THEN
      RAISE EXCEPTION 'F6 : % exécute filer_notification_gerant', v_qui;
    END IF;
  END LOOP;
  v := pg_temp.faire('service', 'SELECT count(*)::text FROM public.box_manager_notifications');
  IF v <> '7' THEN RAISE EXCEPTION 'F6 : la clé serveur ne lit pas la file (%)', v; END IF;
  v := pg_temp.faire('service', format('WITH m AS (UPDATE public.box_manager_notifications SET claimed_at = now(), attempts = 1, sent_at = now(), delivered_count = 2, last_error = NULL WHERE event_ref = %L RETURNING 1) SELECT count(*)::text FROM m', 'sub_ngf_m2'));
  IF v <> '1' THEN RAISE EXCEPTION 'F6 : la clé serveur n''écrit pas les colonnes d''envoi (%)', v; END IF;
  FOREACH v IN ARRAY ARRAY[
    'WITH m AS (UPDATE public.box_manager_notifications SET member_id = member_id RETURNING 1) SELECT count(*)::text FROM m',
    format('INSERT INTO public.box_manager_notifications (box_id, type, event_ref, member_id) VALUES (%L, ''payment_failed'', ''x'', %L)', B, M1),
    'WITH m AS (DELETE FROM public.box_manager_notifications RETURNING 1) SELECT count(*)::text FROM m'
  ] LOOP
    IF pg_temp.faire('service', v) NOT LIKE REFUS THEN
      RAISE EXCEPTION 'F6 : la clé serveur passe : % (%)', v, pg_temp.faire('service', v);
    END IF;
  END LOOP;

  -- ── F7 : la file ne bloque pas l'écriture d'origine ───────────────────────
  ALTER TABLE public.box_manager_notifications ADD CONSTRAINT ngf_casse CHECK (false) NOT VALID;
  UPDATE public.box_members SET stripe_subscription_id = 'sub_ngf_m2_bis' WHERE box_id = B AND member_id = M2;
  IF (SELECT stripe_subscription_id FROM public.box_members WHERE box_id = B AND member_id = M2) <> 'sub_ngf_m2_bis'
     OR pg_temp.nb('subscription_paid', 'sub_ngf_m2_bis') <> 0 THEN
    RAISE EXCEPTION 'F7 : file en erreur, l''écriture d''origine n''est pas passée seule';
  END IF;

  -- ── F8 : mutations ────────────────────────────────────────────────────────
  v_def := pg_temp.def();
  -- F7 sans le rattrapage : l'écriture d'origine échoue.
  EXECUTE regexp_replace(v_def, 'EXCEPTION WHEN OTHERS THEN.*?SQLERRM;', '', 's');
  IF pg_temp.def() = v_def THEN RAISE EXCEPTION 'F8 : mutation du rattrapage non appliquée'; END IF;
  BEGIN
    UPDATE public.box_members SET stripe_subscription_id = 'sub_ngf_m2_ter' WHERE box_id = B AND member_id = M2;
    RAISE EXCEPTION 'F8 : rattrapage retiré, l''écriture passe encore : F7 ne prouve rien';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  EXECUTE v_def;
  ALTER TABLE public.box_manager_notifications DROP CONSTRAINT ngf_casse;

  -- F5 sans le contrôle d'archivage : la box archivée met en file.
  EXECUTE replace(v_def, 'archived_at IS NULL', 'true');
  UPDATE public.box_invitations SET status = 'pending' WHERE id = I3;
  UPDATE public.box_invitations SET status = 'accepted' WHERE id = I3;
  IF pg_temp.nb('invitation_accepted', I3::text) <> 1 THEN RAISE EXCEPTION 'F8 : archivage non contrôlé, rien en file : F5 ne prouve rien'; END IF;
  EXECUTE v_def;

  -- F1 sans « nouvel identifiant » : le retour d'impayé de M4 sous l'ancien identifiant notifie.
  ALTER TABLE public.box_members DISABLE TRIGGER trg_notif_gerant_abonnement_nouveau;
  UPDATE public.box_members SET stripe_subscription_id = 'sub_ngf_ancien', subscription_status = 'past_due' WHERE box_id = B AND member_id = M4;
  ALTER TABLE public.box_members ENABLE TRIGGER trg_notif_gerant_abonnement_nouveau;
  CREATE TRIGGER ngf_mutant AFTER UPDATE OF subscription_status ON public.box_members FOR EACH ROW
    WHEN (NEW.subscription_status = 'active' AND NEW.stripe_subscription_id IS NOT NULL
          AND OLD.subscription_status IS DISTINCT FROM 'active')
    EXECUTE FUNCTION internal.filer_notification_gerant('subscription_paid');
  UPDATE public.box_members SET subscription_status = 'active' WHERE box_id = B AND member_id = M4;
  DROP TRIGGER ngf_mutant ON public.box_members;
  IF pg_temp.nb('subscription_paid', 'sub_ngf_ancien') <> 1 THEN
    RAISE EXCEPTION 'F8 : règle « statut vers actif », le retour d''impayé ne notifie pas : F1 ne prouve rien';
  END IF;

  -- F2 sans « NULL → date » : la date déplacée ouvre un nouvel épisode.
  CREATE TRIGGER ngf_mutant AFTER UPDATE OF past_due_since ON public.box_members FOR EACH ROW
    WHEN (NEW.past_due_since IS NOT NULL)
    EXECUTE FUNCTION internal.filer_notification_gerant('payment_failed');
  UPDATE public.box_members SET past_due_since = v_impaye + interval '31 days' WHERE box_id = B AND member_id = M1;
  DROP TRIGGER ngf_mutant ON public.box_members;
  IF pg_temp.nb('payment_failed') <> 3 THEN RAISE EXCEPTION 'F8 : sans transition, la date déplacée ne notifie pas : F2 ne prouve rien'; END IF;

  -- F4 sans transition : une réécriture « accepted » notifie (invitation acceptée avant la migration).
  ALTER TABLE public.box_invitations DISABLE TRIGGER trg_notif_gerant_invitation;
  UPDATE public.box_invitations SET status = 'accepted', accepted_by = M1 WHERE id = I2;
  ALTER TABLE public.box_invitations ENABLE TRIGGER trg_notif_gerant_invitation;
  UPDATE public.box_invitations SET status = 'accepted' WHERE id = I2;
  IF pg_temp.nb('invitation_accepted', I2::text) <> 0 THEN RAISE EXCEPTION 'F4 : réécriture « accepted » mise en file'; END IF;
  CREATE TRIGGER ngf_mutant AFTER UPDATE OF status ON public.box_invitations FOR EACH ROW
    WHEN (NEW.status = 'accepted')
    EXECUTE FUNCTION internal.filer_notification_gerant('invitation_accepted');
  UPDATE public.box_invitations SET status = 'accepted' WHERE id = I2;
  DROP TRIGGER ngf_mutant ON public.box_invitations;
  IF pg_temp.nb('invitation_accepted', I2::text) <> 1 THEN RAISE EXCEPTION 'F8 : sans transition, la réécriture ne notifie pas : F4 ne prouve rien'; END IF;

  -- F3 : la ligne vient bien du déclencheur.
  ALTER TABLE public.box_member_alerts DISABLE TRIGGER trg_notif_gerant_sans_formule;
  INSERT INTO public.box_member_alerts (box_id, member_id, kind, created_by) VALUES (B, M2, 'reservation_sans_formule', K);
  ALTER TABLE public.box_member_alerts ENABLE TRIGGER trg_notif_gerant_sans_formule;
  IF pg_temp.nb('booked_without_plan') <> 1 THEN RAISE EXCEPTION 'F8 : déclencheur coupé, l''alerte est encore mise en file : F3 ne prouve rien'; END IF;

  -- Clé unique : sans elle, un même événement entre deux fois.
  BEGIN
    INSERT INTO public.box_manager_notifications (box_id, type, event_ref, member_id) VALUES (B, 'invitation_accepted', I1::text, M3);
    RAISE EXCEPTION 'F8 : un événement entre deux fois dans la file';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  ALTER TABLE public.box_manager_notifications DROP CONSTRAINT box_manager_notifications_evenement_unique;
  INSERT INTO public.box_manager_notifications (box_id, type, event_ref, member_id) VALUES (B, 'invitation_accepted', I1::text, M3)
  RETURNING id INTO v_alerte;
  IF pg_temp.nb('invitation_accepted', I1::text) <> 2 THEN RAISE EXCEPTION 'F8 : sans clé unique, le doublon est encore refusé'; END IF;
  DELETE FROM public.box_manager_notifications WHERE id = v_alerte;
  ALTER TABLE public.box_manager_notifications ADD CONSTRAINT box_manager_notifications_evenement_unique UNIQUE (type, event_ref);

  -- F6 : le refus vient du droit, puis de la RLS ; l'EXECUTE vient du catalogue.
  GRANT SELECT ON public.box_manager_notifications TO authenticated;
  v := pg_temp.faire('e0', 'SELECT count(*)::text FROM public.box_manager_notifications');
  IF v <> '0' THEN RAISE EXCEPTION 'F8 : SELECT accordé, le gérant devrait lire 0 ligne sous RLS (%)', v; END IF;
  ALTER TABLE public.box_manager_notifications DISABLE ROW LEVEL SECURITY;
  v := pg_temp.faire('e0', 'SELECT count(*)::text FROM public.box_manager_notifications');
  IF v = '0' OR v LIKE REFUS THEN RAISE EXCEPTION 'F8 : SELECT accordé et RLS coupée, le gérant ne lit rien (%) : F6 ne prouve rien', v; END IF;
  ALTER TABLE public.box_manager_notifications ENABLE ROW LEVEL SECURITY;
  REVOKE SELECT ON public.box_manager_notifications FROM authenticated;
  GRANT EXECUTE ON FUNCTION internal.filer_notification_gerant() TO authenticated;
  IF NOT has_function_privilege('authenticated', 'internal.filer_notification_gerant()', 'EXECUTE') THEN
    RAISE EXCEPTION 'F8 : EXECUTE accordé et non vu';
  END IF;
  REVOKE EXECUTE ON FUNCTION internal.filer_notification_gerant() FROM authenticated;
END $t$;

-- F9 : d'abord le retour arrière de 20270147, qui s'appuie sur cette file (ordre
-- inverse des migrations), puis celui de l'en-tête de la migration, tel quel (sans BEGIN/COMMIT :
-- on est déjà dans la transaction du test).
\i supabase/retours/20270147000000_changement_formule.sql
DROP TRIGGER trg_notif_gerant_abonnement_creation ON public.box_members;
DROP TRIGGER trg_notif_gerant_abonnement_nouveau ON public.box_members;
DROP TRIGGER trg_notif_gerant_impaye ON public.box_members;
DROP TRIGGER trg_notif_gerant_sans_formule ON public.box_member_alerts;
DROP TRIGGER trg_notif_gerant_invitation ON public.box_invitations;
DROP FUNCTION internal.filer_notification_gerant();
DROP TABLE public.box_manager_notifications;

DO $t$
BEGIN
  IF to_regclass('public.box_manager_notifications') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'internal' AND p.proname = 'filer_notification_gerant')
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname LIKE 'trg_notif_gerant%') THEN
    RAISE EXCEPTION 'F9 : après retour arrière, il reste la table, la fonction ou un déclencheur';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
       WHERE tgrelid IN ('public.box_members'::regclass, 'public.box_member_alerts'::regclass, 'public.box_invitations'::regclass)
         AND NOT tgisinternal) <> 7 THEN
    RAISE EXCEPTION 'F9 : après retour arrière, les déclencheurs d''origine ne sont pas les sept de la prod';
  END IF;
END $t$;

ROLLBACK;
\echo '    F0 à F9 OK'
