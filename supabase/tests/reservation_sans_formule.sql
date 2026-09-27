-- ═════════════════════════════════════════════════════════════════════════════
-- Réservation sans formule : refusée au membre, signalée au gérant (migration 20270133)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : propriétaire O (…e0, owner_id, sans ligne box_members), co-gérant K
-- (…e2), coach C (…e1), coach inactif X (…e3). Box B2 : propriétaire P (…e4).
-- Membres de B (… suffixe) :
--   01 NF   ni formule ni crédit          07 NF2  idem, inscrit par le staff
--   02 NFS  formule abonnement, statut NULL 08 NF3  idem, créneau plein
--   03 SUB  abonnement actif + carnet     09 NF4  idem, attente puis promu
--   04 CRE  carnet disponible             10 TRI  abonnement trialing
--   05 EPU  carnet épuisé                 11 PDU  impayé dans le délai (7 j)
--   06 SUS  impayé depuis 10 j (suspendu) 12 CAN  abonnement résilié
--   13 EXT  n'est pas membre de B
--
--   S1  NF se réserve (confirmed, puis waiting) : NO_ACTIVE_PLAN, aucune ligne ;
--   S2  NF3 sur un créneau plein (la capacité l'aurait rétrogradé) : NO_ACTIVE_PLAN ;
--   S3  NFS, CAN, EXT : NO_ACTIVE_PLAN ;
--   S4  staff sans formule (C, O par owner_id, K) : accepté ; X (coach inactif) :
--       NO_ACTIVE_PLAN ;
--   S5  C inscrit NF2 : acceptée, une alerte ouverte (créateur, réservation) ;
--       O l'inscrit à nouveau : pas de seconde alerte ouverte ; après résolution,
--       une nouvelle inscription rouvre une alerte ; le staff qui inscrit SUB
--       ou un coach n'ouvre pas d'alerte ;
--   S6  clé serveur pour NF : acceptée, aucune alerte ; essai (member_id NULL) :
--       accepté, aucune alerte ;
--   S7  SUB : accepté sans crédit débité ; CRE : crédit débité ; EPU :
--       NO_CREDITS_LEFT inchangé ; SUS : MEMBERSHIP_PAST_DUE, prioritaire ;
--       TRI, PDU : acceptés ;
--   S8  C inscrit NF4 en attente (alerte), alerte résolue, place libérée par O :
--       NF4 promu, aucune nouvelle alerte ;
--   S9  box_member_alerts : NF et C ne lisent rien et n'écrivent pas (42501),
--       O et K lisent ; NF, C et P (autre box) ne résolvent pas ; O résout ;
--       anon ne lit pas ;
--   S10 internal.membre_a_formule rend, pour chaque membre, le verdict de
--       consume_credit_on_reservation (« passe sans formule » ou non) ;
--   S11 définitions figées : consume_credit_on_reservation inchangée
--       (f6bc083f…), nouvelles définitions épinglées ; droits : fonctions
--       internal fermées aux rôles clients, table sans écriture client, RLS.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Réservation sans formule : refus NO_ACTIVE_PLAN et alerte au gérant'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a95f-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0','e1','e2','e3','e4','01','02','03','04','05','06','07','08','09','10','11','12','13']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a95f-0000000000' || s)::uuid, 'rsf-' || s || '@test.invalid', 'rsf_' || s
  FROM unnest(ARRAY['e0','e1','e2','e3','e4','01','02','03','04','05','06','07','08','09','10','11','12','13']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b95f-000000000001', 'Box sans formule', 'RSF1', '00000000-0000-4000-a95f-0000000000e0'),
  ('00000000-0000-4000-b95f-000000000002', 'Autre box', 'RSF2', '00000000-0000-4000-a95f-0000000000e4');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type) VALUES
  ('00000000-0000-4000-e95f-000000000001', '00000000-0000-4000-b95f-000000000001', 'Illimité', 8900, 'subscription');

-- (suffixe, rôle, statut, avec formule ?, statut d'abonnement, impayé depuis)
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, past_due_since)
SELECT '00000000-0000-4000-b95f-000000000001', ('00000000-0000-4000-a95f-0000000000' || m)::uuid, r, st,
       CASE WHEN avec_plan THEN '00000000-0000-4000-e95f-000000000001'::uuid END, ss, depuis
  FROM (VALUES
    ('e1', 'coach',  'active',   false, NULL,       NULL::timestamptz),
    ('e2', 'owner',  'active',   false, NULL,       NULL),
    ('e3', 'coach',  'inactive', false, NULL,       NULL),
    ('01', 'member', 'active',   false, NULL,       NULL),
    ('02', 'member', 'active',   true,  NULL,       NULL),
    ('03', 'member', 'active',   true,  'active',   NULL),
    ('04', 'member', 'active',   false, NULL,       NULL),
    ('05', 'member', 'active',   false, NULL,       NULL),
    ('06', 'member', 'active',   true,  'past_due', now() - interval '10 days'),
    ('07', 'member', 'active',   false, NULL,       NULL),
    ('08', 'member', 'active',   false, NULL,       NULL),
    ('09', 'member', 'active',   false, NULL,       NULL),
    ('10', 'member', 'active',   true,  'trialing', NULL),
    ('11', 'member', 'active',   true,  'past_due', now() - interval '1 day'),
    ('12', 'member', 'active',   true,  'canceled', NULL)
  ) v(m, r, st, avec_plan, ss, depuis);

-- Carnets : SUB (disponible, ne doit pas bouger), CRE (disponible), EPU (épuisé).
INSERT INTO public.member_class_credits (id, member_id, box_id, credits_total, credits_used, expires_at, status)
SELECT ('00000000-0000-4000-c95f-0000000000' || m)::uuid, ('00000000-0000-4000-a95f-0000000000' || m)::uuid,
       '00000000-0000-4000-b95f-000000000001', 10, u, now() + interval '90 days', s
  FROM (VALUES ('03', 0, 'active'), ('04', 0, 'active'), ('05', 10, 'exhausted')) v(m, u, s);

-- Créneaux de demain : 1 à 29 larges ; 30 et 31 à une place.
INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity)
SELECT ('00000000-0000-4000-d95f-0000000000' || lpad(n::text, 2, '0'))::uuid,
       '00000000-0000-4000-b95f-000000000001', 'WOD ' || n, CURRENT_DATE + 1, '18:00', '19:00',
       CASE WHEN n >= 30 THEN 1 ELSE 15 END
  FROM generate_series(1, 31) n;
-- Les créneaux à une place sont occupés par SUB (posé hors rôle client).
INSERT INTO public.class_reservations (id, schedule_id, member_id, box_id, status)
SELECT ('00000000-0000-4000-f95f-0000000000' || n)::uuid, ('00000000-0000-4000-d95f-0000000000' || n)::uuid,
       '00000000-0000-4000-a95f-000000000003', '00000000-0000-4000-b95f-000000000001', 'confirmed'
  FROM (VALUES ('30'), ('31')) v(n);

-- Exécute `p_sql` sous l'identité `p_qui` (suffixe, « service » ou « anon ») ;
-- rend « OK » ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text := 'OK';
BEGIN
  IF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSIF p_qui = 'anon' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a95f-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN v;
END $$;

-- Inscrit `p_membre` au créneau `p_creneau` de B, sous l'identité `p_qui`.
CREATE FUNCTION pg_temp.reserver(p_qui text, p_membre text, p_creneau int, p_statut text DEFAULT 'confirmed')
RETURNS text LANGUAGE sql AS $$
  SELECT pg_temp.faire(p_qui, format(
    'INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status) VALUES (%L, %L, %L, %L)',
    '00000000-0000-4000-d95f-0000000000' || lpad(p_creneau::text, 2, '0'),
    '00000000-0000-4000-a95f-0000000000' || p_membre,
    '00000000-0000-4000-b95f-000000000001', p_statut));
$$;

-- Nombre de lignes lues par `p_qui`, ou -1 si la lecture est refusée.
CREATE FUNCTION pg_temp.compter(p_qui text, p_sql text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.faire(p_qui, format('SELECT set_config(''rsf.n'', (SELECT count(*) FROM (%s) t)::text, true)', p_sql));
  n := COALESCE(NULLIF(current_setting('rsf.n', true), ''), '-1')::int;
  PERFORM set_config('rsf.n', '', true);
  RETURN n;
END $$;

CREATE FUNCTION pg_temp.resas(p_membre text) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.class_reservations
   WHERE member_id = ('00000000-0000-4000-a95f-0000000000' || p_membre)::uuid;
$$;
CREATE FUNCTION pg_temp.alertes(p_membre text, p_ouvertes boolean) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.box_member_alerts
   WHERE member_id = ('00000000-0000-4000-a95f-0000000000' || p_membre)::uuid
     AND (NOT p_ouvertes OR resolved_at IS NULL);
$$;

DO $t$
DECLARE
  v text;
  m text;
  a record;
  v_alerte uuid;
BEGIN
  -- ── S1 : sans formule, pour lui-même, confirmed puis waiting ──────────────
  v := pg_temp.reserver('01', '01', 1);
  IF v NOT LIKE '23514: NO_ACTIVE_PLAN%' THEN RAISE EXCEPTION 'S1 : NF confirmed : % (NO_ACTIVE_PLAN attendu)', v; END IF;
  v := pg_temp.reserver('01', '01', 2, 'waiting');
  IF v NOT LIKE '23514: NO_ACTIVE_PLAN%' THEN RAISE EXCEPTION 'S1 : NF waiting : % (NO_ACTIVE_PLAN attendu)', v; END IF;
  IF pg_temp.resas('01') <> 0 THEN RAISE EXCEPTION 'S1 : une réservation de NF a été créée'; END IF;

  -- ── S2 : créneau plein, la capacité l'aurait rétrogradé en attente ────────
  v := pg_temp.reserver('08', '08', 30);
  IF v NOT LIKE '23514: NO_ACTIVE_PLAN%' THEN RAISE EXCEPTION 'S2 : NF3 sur créneau plein : % (NO_ACTIVE_PLAN attendu)', v; END IF;
  IF pg_temp.resas('08') <> 0 THEN RAISE EXCEPTION 'S2 : NF3 a été placé en liste d''attente'; END IF;

  -- ── S3 : formule sans statut, abonnement résilié, hors de la box ──────────
  FOREACH m IN ARRAY ARRAY['02', '12', '13'] LOOP
    v := pg_temp.reserver(m, m, 3);
    IF v NOT LIKE '23514: NO_ACTIVE_PLAN%' THEN RAISE EXCEPTION 'S3 : membre % : % (NO_ACTIVE_PLAN attendu)', m, v; END IF;
  END LOOP;

  -- ── S4 : le staff n'a pas besoin de formule ───────────────────────────────
  FOREACH m IN ARRAY ARRAY['e1', 'e0', 'e2'] LOOP
    v := pg_temp.reserver(m, m, 4);
    IF v <> 'OK' THEN RAISE EXCEPTION 'S4 : staff % refusé : %', m, v; END IF;
  END LOOP;
  v := pg_temp.reserver('e3', 'e3', 4);
  IF v NOT LIKE '23514: NO_ACTIVE_PLAN%' THEN RAISE EXCEPTION 'S4 : coach inactif : % (NO_ACTIVE_PLAN attendu)', v; END IF;
  IF (SELECT count(*) FROM public.box_member_alerts) <> 0 THEN RAISE EXCEPTION 'S4 : alerte ouverte hors inscription par le staff'; END IF;

  -- ── S5 : le staff inscrit NF2 : une alerte, pas de doublon ────────────────
  v := pg_temp.reserver('e1', '07', 5);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S5 : inscription de NF2 par le coach refusée : %', v; END IF;
  SELECT * INTO a FROM public.box_member_alerts WHERE member_id = '00000000-0000-4000-a95f-000000000007';
  IF a.id IS NULL OR a.kind <> 'reservation_sans_formule' OR a.resolved_at IS NOT NULL
     OR a.box_id <> '00000000-0000-4000-b95f-000000000001'
     OR a.created_by IS DISTINCT FROM '00000000-0000-4000-a95f-0000000000e1'
     OR a.reservation_id IS DISTINCT FROM (SELECT id FROM public.class_reservations
                                            WHERE member_id = '00000000-0000-4000-a95f-000000000007') THEN
    RAISE EXCEPTION 'S5 : alerte absente ou mal remplie : %', a;
  END IF;
  v := pg_temp.reserver('e0', '07', 6);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S5 : seconde inscription de NF2 refusée : %', v; END IF;
  IF pg_temp.alertes('07', false) <> 1 THEN RAISE EXCEPTION 'S5 : % alertes pour NF2 (1 attendue)', pg_temp.alertes('07', false); END IF;
  -- Le staff inscrit un membre qui a une formule (SUB), puis un coach (C) : pas d'alerte.
  v := pg_temp.reserver('e1', '03', 14);
  IF v <> 'OK' OR pg_temp.alertes('03', false) <> 0 THEN RAISE EXCEPTION 'S5 : SUB inscrit par le coach : % / alerte ouverte', v; END IF;
  v := pg_temp.reserver('e0', 'e1', 14);
  IF v <> 'OK' OR pg_temp.alertes('e1', false) <> 0 THEN RAISE EXCEPTION 'S5 : coach inscrit par O : % / alerte ouverte', v; END IF;
  UPDATE public.box_member_alerts SET resolved_at = now() WHERE id = a.id;
  v := pg_temp.reserver('e2', '07', 7);
  IF v <> 'OK' OR pg_temp.alertes('07', true) <> 1 OR pg_temp.alertes('07', false) <> 2 THEN
    RAISE EXCEPTION 'S5 : après résolution, pas de nouvelle alerte ouverte (%)', v;
  END IF;

  -- ── S6 : clé serveur, essai ───────────────────────────────────────────────
  v := pg_temp.reserver('service', '01', 8);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S6 : clé serveur refusée : %', v; END IF;
  INSERT INTO public.box_prospects (id, box_id, first_name, email)
  VALUES ('00000000-0000-4000-a95f-0000000000f1', '00000000-0000-4000-b95f-000000000001', 'Essai', 'rsf-essai@test.invalid');
  v := pg_temp.faire('service', $q$INSERT INTO public.class_reservations (schedule_id, box_id, member_id, prospect_id, is_trial, status)
    VALUES ('00000000-0000-4000-d95f-000000000008', '00000000-0000-4000-b95f-000000000001', NULL,
            '00000000-0000-4000-a95f-0000000000f1', true, 'confirmed')$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S6 : essai refusé : %', v; END IF;
  IF pg_temp.alertes('01', false) <> 0 OR (SELECT count(*) FROM public.box_member_alerts WHERE member_id IS NULL) <> 0 THEN
    RAISE EXCEPTION 'S6 : alerte ouverte pour la clé serveur ou l''essai';
  END IF;

  -- ── S7 : les cas de formule, inchangés ────────────────────────────────────
  v := pg_temp.reserver('03', '03', 9);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S7 : SUB refusé : %', v; END IF;
  IF (SELECT credits_used FROM public.member_class_credits WHERE id = '00000000-0000-4000-c95f-000000000003') <> 0
     OR (SELECT credit_id FROM public.class_reservations WHERE schedule_id = '00000000-0000-4000-d95f-000000000009') IS NOT NULL THEN
    RAISE EXCEPTION 'S7 : SUB : un crédit a été débité';
  END IF;
  v := pg_temp.reserver('04', '04', 10);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S7 : CRE refusé : %', v; END IF;
  IF (SELECT credits_used FROM public.member_class_credits WHERE id = '00000000-0000-4000-c95f-000000000004') <> 1 THEN
    RAISE EXCEPTION 'S7 : CRE : crédit non débité';
  END IF;
  v := pg_temp.reserver('05', '05', 11);
  IF v <> '23514: NO_CREDITS_LEFT: aucun crédit disponible pour cette box' THEN
    RAISE EXCEPTION 'S7 : EPU : « % » (NO_CREDITS_LEFT inchangé attendu)', v;
  END IF;
  v := pg_temp.reserver('06', '06', 12);
  IF v NOT LIKE '23514: MEMBERSHIP_PAST_DUE%' THEN RAISE EXCEPTION 'S7 : SUS : % (MEMBERSHIP_PAST_DUE attendu)', v; END IF;
  FOREACH m IN ARRAY ARRAY['10', '11'] LOOP
    v := pg_temp.reserver(m, m, 13);
    IF v <> 'OK' THEN RAISE EXCEPTION 'S7 : membre % (abonnement valable) refusé : %', m, v; END IF;
  END LOOP;

  -- ── S8 : liste d'attente par le staff, puis promotion ─────────────────────
  v := pg_temp.reserver('e1', '09', 31, 'waiting');
  IF v <> 'OK' OR (SELECT status FROM public.class_reservations
                    WHERE member_id = '00000000-0000-4000-a95f-000000000009') <> 'waiting' THEN
    RAISE EXCEPTION 'S8 : NF4 non inscrit en attente par le coach : %', v;
  END IF;
  IF pg_temp.alertes('09', true) <> 1 THEN RAISE EXCEPTION 'S8 : pas d''alerte à l''inscription en attente'; END IF;
  UPDATE public.box_member_alerts SET resolved_at = now()
   WHERE member_id = '00000000-0000-4000-a95f-000000000009';
  v := pg_temp.faire('e0', $q$DELETE FROM public.class_reservations WHERE id = '00000000-0000-4000-f95f-000000000031'$q$);
  IF v <> 'OK' THEN RAISE EXCEPTION 'S8 : libération de la place refusée : %', v; END IF;
  IF (SELECT status FROM public.class_reservations
       WHERE member_id = '00000000-0000-4000-a95f-000000000009') <> 'confirmed' THEN
    RAISE EXCEPTION 'S8 : NF4 n''a pas été promu';
  END IF;
  IF pg_temp.alertes('09', false) <> 1 OR pg_temp.alertes('09', true) <> 0 THEN
    RAISE EXCEPTION 'S8 : la promotion a ouvert une alerte';
  END IF;

  -- ── S9 : qui lit, écrit et résout box_member_alerts ───────────────────────
  SELECT id INTO v_alerte FROM public.box_member_alerts
   WHERE member_id = '00000000-0000-4000-a95f-000000000007' AND resolved_at IS NULL;
  FOREACH m IN ARRAY ARRAY['07', 'e1', 'e4'] LOOP
    IF pg_temp.compter(m, 'SELECT 1 FROM public.box_member_alerts') <> 0 THEN
      RAISE EXCEPTION 'S9 : % lit box_member_alerts', m;
    END IF;
  END LOOP;
  FOREACH m IN ARRAY ARRAY['e0', 'e2'] LOOP
    IF pg_temp.compter(m, 'SELECT 1 FROM public.box_member_alerts') <> 3 THEN
      RAISE EXCEPTION 'S9 : % lit % alerte(s) (3 attendues)', m, pg_temp.compter(m, 'SELECT 1 FROM public.box_member_alerts');
    END IF;
  END LOOP;
  IF pg_temp.compter('anon', 'SELECT 1 FROM public.box_member_alerts') <> -1 THEN
    RAISE EXCEPTION 'S9 : anon lit box_member_alerts';
  END IF;
  FOREACH m IN ARRAY ARRAY['07', 'e1', 'e0'] LOOP
    v := pg_temp.faire(m, format($q$INSERT INTO public.box_member_alerts (box_id, member_id, kind)
      VALUES ('00000000-0000-4000-b95f-000000000001', '00000000-0000-4000-a95f-000000000001', 'reservation_sans_formule')$q$));
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'S9 : INSERT par % : % (42501 attendu)', m, v; END IF;
    v := pg_temp.faire(m, format('UPDATE public.box_member_alerts SET resolved_at = now() WHERE id = %L', v_alerte));
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'S9 : UPDATE par % : % (42501 attendu)', m, v; END IF;
    v := pg_temp.faire(m, format('DELETE FROM public.box_member_alerts WHERE id = %L', v_alerte));
    IF v NOT LIKE '42501:%' THEN RAISE EXCEPTION 'S9 : DELETE par % : % (42501 attendu)', m, v; END IF;
  END LOOP;
  FOREACH m IN ARRAY ARRAY['07', 'e1', 'e4'] LOOP
    v := pg_temp.faire(m, format('SELECT public.resoudre_alerte_membre(%L)', v_alerte));
    IF v NOT LIKE '42501: ALERTE_INTROUVABLE%' THEN RAISE EXCEPTION 'S9 : % résout l''alerte : %', m, v; END IF;
  END LOOP;
  IF pg_temp.alertes('07', true) <> 1 THEN RAISE EXCEPTION 'S9 : l''alerte a changé avant la résolution par O'; END IF;
  v := pg_temp.faire('e0', format('SELECT public.resoudre_alerte_membre(%L)', v_alerte));
  IF v <> 'OK' OR NOT EXISTS (SELECT 1 FROM public.box_member_alerts WHERE id = v_alerte AND resolved_at IS NOT NULL
                                 AND resolved_by = '00000000-0000-4000-a95f-0000000000e0') THEN
    RAISE EXCEPTION 'S9 : O ne résout pas l''alerte : %', v;
  END IF;
  v := pg_temp.faire('e0', format('SELECT public.resoudre_alerte_membre(%L)', v_alerte));
  IF v NOT LIKE '42501: ALERTE_INTROUVABLE%' THEN RAISE EXCEPTION 'S9 : seconde résolution acceptée : %', v; END IF;

  RAISE NOTICE 'réservation sans formule : S1 à S9 conformes';
END $t$;

-- ── S10 : membre_a_formule rend le verdict de consume_credit_on_reservation ──
-- Verdict de consume : « passe sans formule » quand l'insertion (clé serveur)
-- passe sans crédit ET qu'un carnet neuf, ajouté ensuite, est bien débité (donc
-- aucun abonnement ne l'a court-circuité). Carnet épuisé ou crédit débité à la
-- première insertion : formule.
DO $t$
DECLARE
  m text;
  v text;
  v_libre boolean;
  v_membre uuid;
  n int := 0;
BEGIN
  FOREACH m IN ARRAY ARRAY['e0','e1','e2','e3','01','02','03','04','05','06','07','08','09','10','11','12','13'] LOOP
    v_membre := ('00000000-0000-4000-a95f-0000000000' || m)::uuid;
    BEGIN
      v := pg_temp.reserver('service', m, 20);
      IF v LIKE '23514: NO_CREDITS_LEFT%' THEN
        v_libre := false;
      ELSIF v <> 'OK' THEN
        RAISE EXCEPTION 'S10 : insertion serveur pour % : %', m, v;
      ELSIF (SELECT credit_id FROM public.class_reservations
              WHERE member_id = v_membre AND schedule_id = '00000000-0000-4000-d95f-000000000020') IS NOT NULL THEN
        v_libre := false;
      ELSE
        INSERT INTO public.member_class_credits (member_id, box_id, credits_total, credits_used, expires_at, status)
        VALUES (v_membre, '00000000-0000-4000-b95f-000000000001', 5, 0, now() + interval '30 days', 'active');
        v := pg_temp.reserver('service', m, 21);
        IF v <> 'OK' THEN RAISE EXCEPTION 'S10 : seconde insertion serveur pour % : %', m, v; END IF;
        v_libre := (SELECT credit_id FROM public.class_reservations
                     WHERE member_id = v_membre AND schedule_id = '00000000-0000-4000-d95f-000000000021') IS NOT NULL;
      END IF;
      RAISE EXCEPTION 'rsf_annule:%', v_libre;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'rsf_annule:%' THEN RAISE; END IF;
      v_libre := split_part(SQLERRM, ':', 2)::boolean;
    END;
    IF internal.membre_a_formule('00000000-0000-4000-b95f-000000000001', v_membre) = v_libre THEN
      RAISE EXCEPTION 'S10 : membre % : membre_a_formule = %, consume_credit_on_reservation le laisse passer sans formule = %',
        m, NOT v_libre, v_libre;
    END IF;
    n := n + 1;
  END LOOP;
  -- Contre-exemple : les deux verdicts sont représentés.
  IF NOT EXISTS (SELECT 1 FROM unnest(ARRAY['01','02','12','13']) s
                  WHERE NOT internal.membre_a_formule('00000000-0000-4000-b95f-000000000001', ('00000000-0000-4000-a95f-0000000000' || s)::uuid))
     OR NOT internal.membre_a_formule('00000000-0000-4000-b95f-000000000001', '00000000-0000-4000-a95f-000000000003') THEN
    RAISE EXCEPTION 'S10 : le jeu ne couvre pas les deux verdicts';
  END IF;
  RAISE NOTICE 'S10 : membre_a_formule = consume_credit_on_reservation sur % membres', n;
END $t$;

-- ── S11 : définitions figées et droits ────────────────────────────────────────
DO $t$
DECLARE
  f record;
  v text;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('public.consume_credit_on_reservation()',       'f6bc083f4c67cc88faa558a4eb061d29'),
    ('internal.bloquer_reservation_impaye()',        '3910a8d07c3da0fddf35f0b05bd75952'),
    ('internal.membre_a_formule(uuid,uuid)',         '471b0e75ce212bda0e400c2ab546920f'),
    ('internal.est_staff_box(uuid,uuid)',            'f2829621c684819c49e3864b3acaaf9f'),
    ('internal.alerter_reservation_sans_formule()',  'c7d278376a5fd40f7370e3b5da50f263'),
    ('public.resoudre_alerte_membre(uuid)',          '816c05e1fa2380891c711f315f589f1d')
  ) t(sig, attendu) LOOP
    v := md5(pg_get_functiondef(f.sig::regprocedure));
    IF v <> f.attendu THEN
      RAISE EXCEPTION 'S11 : % a changé (md5 %, % attendu)', f.sig, v, f.attendu;
    END IF;
  END LOOP;

  IF (SELECT md5(pg_get_triggerdef(oid)) FROM pg_trigger WHERE tgname = 'trg_aa_bloque_impaye') <> 'ee71f92c8da50966eda067414c68430f' THEN
    RAISE EXCEPTION 'S11 : trg_aa_bloque_impaye a changé';
  END IF;
  IF (SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_zz_alerte_sans_formule')
     <> 'CREATE TRIGGER trg_zz_alerte_sans_formule AFTER INSERT ON public.class_reservations FOR EACH ROW EXECUTE FUNCTION internal.alerter_reservation_sans_formule()' THEN
    RAISE EXCEPTION 'S11 : trg_zz_alerte_sans_formule a changé';
  END IF;

  IF EXISTS (SELECT 1 FROM (VALUES ('anon'), ('authenticated')) r(role),
                    (VALUES ('internal.membre_a_formule(uuid,uuid)'), ('internal.est_staff_box(uuid,uuid)'),
                            ('internal.alerter_reservation_sans_formule()')) p(sig)
              WHERE has_function_privilege(r.role, p.sig::regprocedure, 'EXECUTE')) THEN
    RAISE EXCEPTION 'S11 : une fonction internal est exécutable par un rôle client';
  END IF;
  IF has_function_privilege('anon', 'public.resoudre_alerte_membre(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.resoudre_alerte_membre(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'S11 : droits de resoudre_alerte_membre';
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES ('anon'), ('authenticated')) r(role),
                    (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
              WHERE has_table_privilege(r.role, 'public.box_member_alerts', p.priv)) THEN
    RAISE EXCEPTION 'S11 : un rôle client écrit box_member_alerts';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_member_alerts'::regclass) THEN
    RAISE EXCEPTION 'S11 : RLS désactivée sur box_member_alerts';
  END IF;
  RAISE NOTICE 'S11 : définitions et droits conformes';
END $t$;

ROLLBACK;
