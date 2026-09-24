-- ═════════════════════════════════════════════════════════════════════════════
-- Journal des arrêts d'abonnement (migration 20270120) — chantier S1
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B1 : gérant O1 (propriétaire), coach C, athlètes M et M2. Box B2 : gérant
-- O2, athlète M3. Les écritures passent par `service_role`, comme la route du
-- Manager avec la clé serveur.
--   J1  l'ajout par la clé serveur est accepté ;
--   J2  une mise à jour (autre que notified_at) est refusée ;
--   J3  la suppression est refusée : par le trigger (même au propriétaire des
--       tables), par les droits pour la clé serveur, et TRUNCATE aussi ;
--   J4  notified_at se renseigne une fois : NULL → date accepté ; puis le
--       changer, l'effacer, ou le poser avec une autre colonne est refusé ;
--   J5  lecture : le gérant de la box voit ses arrêts ; un autre gérant, un
--       coach, un athlète ne voient rien ; anon n'a pas le droit de lire ;
--   J6  une même souscription Stripe ne s'arrête qu'une fois ; sans identifiant
--       Stripe, plusieurs lignes restent possibles ;
--   J7  supprimer un membre (adhésion puis compte) ou une box n'est pas bloqué,
--       et l'historique reste intact ;
--   J8  à l'insertion : box inconnue, adhésion d'un autre membre, auteur non
--       gérant → refusés ;
--   J9  ni anon ni authenticated ne peuvent écrire, même le gérant ;
--   J10 action et mode hors liste, remboursement en fin de période → refusés.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Journal des arrêts d''abonnement : ajout seul, lecture par le gérant'

BEGIN;

-- O1 …01, O2 …02, C …03, M …04, M2 …05, M3 …06.
INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9a5-00000000000' || n)::uuid FROM generate_series(1, 6) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9a5-00000000000' || n)::uuid, 'ja-' || n || '@test.invalid', 'ja_' || n
  FROM generate_series(1, 6) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9a5-000000000001', 'Box J1', 'JAB1', '00000000-0000-4000-a9a5-000000000001'),
  ('00000000-0000-4000-b9a5-000000000002', 'Box J2', 'JAB2', '00000000-0000-4000-a9a5-000000000002');
INSERT INTO public.box_members (id, box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-d9a5-000000000001', '00000000-0000-4000-b9a5-000000000001', '00000000-0000-4000-a9a5-000000000001', 'owner',  'active'),
  ('00000000-0000-4000-d9a5-000000000003', '00000000-0000-4000-b9a5-000000000001', '00000000-0000-4000-a9a5-000000000003', 'coach',  'active'),
  ('00000000-0000-4000-d9a5-000000000004', '00000000-0000-4000-b9a5-000000000001', '00000000-0000-4000-a9a5-000000000004', 'member', 'active'),
  ('00000000-0000-4000-d9a5-000000000005', '00000000-0000-4000-b9a5-000000000001', '00000000-0000-4000-a9a5-000000000005', 'member', 'active'),
  ('00000000-0000-4000-d9a5-000000000002', '00000000-0000-4000-b9a5-000000000002', '00000000-0000-4000-a9a5-000000000002', 'owner',  'active'),
  ('00000000-0000-4000-d9a5-000000000006', '00000000-0000-4000-b9a5-000000000002', '00000000-0000-4000-a9a5-000000000006', 'member', 'active');

CREATE TEMP TABLE _vu (qui text, n int);
GRANT INSERT ON _vu TO authenticated, anon;

DO $t$
DECLARE
  b1 constant uuid := '00000000-0000-4000-b9a5-000000000001';
  b2 constant uuid := '00000000-0000-4000-b9a5-000000000002';
  o1 constant uuid := '00000000-0000-4000-a9a5-000000000001';
  o2 constant uuid := '00000000-0000-4000-a9a5-000000000002';
  c  constant uuid := '00000000-0000-4000-a9a5-000000000003';
  m  constant uuid := '00000000-0000-4000-a9a5-000000000004';
  m2 constant uuid := '00000000-0000-4000-a9a5-000000000005';
  m3 constant uuid := '00000000-0000-4000-a9a5-000000000006';
  bm_m  constant uuid := '00000000-0000-4000-d9a5-000000000004';
  bm_m2 constant uuid := '00000000-0000-4000-d9a5-000000000005';
  bm_m3 constant uuid := '00000000-0000-4000-d9a5-000000000006';
  v_r1 uuid; v_r2 uuid; v_r3 uuid;
  v_avant text;
  v_ok boolean;
  v_msg text;
BEGIN
  -- ── J1 : ajouts par la clé serveur ──────────────────────────────────────────
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO public.box_member_subscription_actions
    (box_id, box_member_id, member_id, action, mode, refund_cents, stripe_subscription_id, stripe_refund_id, actor_id)
  VALUES (b1, bm_m, m, 'stop', 'now', 1500, 'sub_J1', 're_J1', o1) RETURNING id INTO v_r1;
  INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, stripe_subscription_id, actor_id)
  VALUES (b1, bm_m2, m2, 'stop', 'period_end', 'sub_J2', o1) RETURNING id INTO v_r2;
  INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, actor_id)
  VALUES (b2, bm_m3, m3, 'stop', 'period_end', o2) RETURNING id INTO v_r3;
  PERFORM set_config('role', 'none', true);
  IF (SELECT count(*) FROM public.box_member_subscription_actions WHERE box_id IN (b1, b2)) <> 3 THEN
    RAISE EXCEPTION 'J1 : les trois ajouts de la clé serveur ne sont pas tous là';
  END IF;

  -- ── J2 : pas de réécriture ─────────────────────────────────────────────────
  PERFORM set_config('role', 'service_role', true);
  v_ok := false;
  BEGIN
    UPDATE public.box_member_subscription_actions SET refund_cents = 1 WHERE id = v_r1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'APPEND_ONLY%';
  END;
  PERFORM set_config('role', 'none', true);
  IF NOT v_ok THEN RAISE EXCEPTION 'J2 : un arrêt journalisé a pu être réécrit'; END IF;

  -- ── J3 : pas de suppression ────────────────────────────────────────────────
  v_ok := false;
  BEGIN
    DELETE FROM public.box_member_subscription_actions WHERE id = v_r1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'APPEND_ONLY%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'J3 : le trigger laisse supprimer un arrêt journalisé'; END IF;
  v_ok := false;
  BEGIN
    TRUNCATE public.box_member_subscription_actions;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'APPEND_ONLY%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'J3 : le journal a pu être vidé (TRUNCATE)'; END IF;
  PERFORM set_config('role', 'service_role', true);
  v_ok := false;
  BEGIN
    DELETE FROM public.box_member_subscription_actions WHERE id = v_r1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'permission denied%';
  END;
  PERFORM set_config('role', 'none', true);
  IF NOT v_ok THEN RAISE EXCEPTION 'J3 : la clé serveur détient le droit DELETE sur le journal'; END IF;

  -- ── J4 : notified_at, une fois ─────────────────────────────────────────────
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.box_member_subscription_actions SET notified_at = now() WHERE id = v_r1;
  PERFORM set_config('role', 'none', true);
  IF (SELECT notified_at FROM public.box_member_subscription_actions WHERE id = v_r1) IS NULL THEN
    RAISE EXCEPTION 'J4 : la première pose de notified_at n''a pas été acceptée';
  END IF;
  PERFORM set_config('role', 'service_role', true);
  FOREACH v_msg IN ARRAY ARRAY['changer', 'effacer', 'avec une autre colonne'] LOOP
    v_ok := false;
    BEGIN
      IF v_msg = 'changer' THEN
        UPDATE public.box_member_subscription_actions SET notified_at = now() + interval '1 day' WHERE id = v_r1;
      ELSIF v_msg = 'effacer' THEN
        UPDATE public.box_member_subscription_actions SET notified_at = NULL WHERE id = v_r1;
      ELSE
        UPDATE public.box_member_subscription_actions SET notified_at = now(), mode = 'now' WHERE id = v_r2;  -- v_r2 est en fin de période
      END IF;
    EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'APPEND_ONLY%';
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'J4 : notified_at : « % » a été accepté', v_msg; END IF;
  END LOOP;
  PERFORM set_config('role', 'none', true);

  -- ── J5 : qui lit quoi ──────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  FOREACH v_msg IN ARRAY ARRAY['O1', 'O2', 'coach', 'athlète'] LOOP
    PERFORM set_config('request.jwt.claim.sub',
      (CASE v_msg WHEN 'O1' THEN o1 WHEN 'O2' THEN o2 WHEN 'coach' THEN c ELSE m END)::text, true);
    PERFORM set_config('role', 'authenticated', true);
    INSERT INTO _vu SELECT v_msg, count(*) FROM public.box_member_subscription_actions WHERE box_id = b1;
    PERFORM set_config('role', 'none', true);
  END LOOP;
  IF (SELECT n FROM _vu WHERE qui = 'O1') <> 2 THEN
    RAISE EXCEPTION 'J5 : le gérant de la box ne voit pas ses deux arrêts';
  END IF;
  IF (SELECT n FROM _vu WHERE qui = 'O2') <> 0 THEN RAISE EXCEPTION 'J5 : un autre gérant voit les arrêts de la box'; END IF;
  IF (SELECT n FROM _vu WHERE qui = 'coach') <> 0 THEN RAISE EXCEPTION 'J5 : un coach voit les arrêts de la box'; END IF;
  IF (SELECT n FROM _vu WHERE qui = 'athlète') <> 0 THEN RAISE EXCEPTION 'J5 : un athlète voit les arrêts de la box'; END IF;
  PERFORM set_config('role', 'anon', true);
  v_ok := false;
  BEGIN
    INSERT INTO _vu SELECT 'anon', count(*) FROM public.box_member_subscription_actions;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  PERFORM set_config('role', 'none', true);
  IF NOT v_ok THEN RAISE EXCEPTION 'J5 : anon peut lire le journal'; END IF;

  -- ── J6 : une souscription ne s'arrête qu'une fois ──────────────────────────
  PERFORM set_config('role', 'service_role', true);
  v_ok := false;
  BEGIN
    INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, stripe_subscription_id, actor_id)
    VALUES (b1, bm_m, m, 'stop', 'period_end', 'sub_J1', o1);
  EXCEPTION WHEN unique_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'J6 : la même souscription Stripe a été arrêtée deux fois'; END IF;
  INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, actor_id)
  VALUES (b2, bm_m3, m3, 'stop', 'now', o2);
  PERFORM set_config('role', 'none', true);

  -- ── J8 : intégrité à l'insertion ───────────────────────────────────────────
  PERFORM set_config('role', 'service_role', true);
  FOREACH v_msg IN ARRAY ARRAY['box inconnue', 'adhésion d''un autre membre', 'auteur coach'] LOOP
    v_ok := false;
    BEGIN
      INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, actor_id)
      VALUES (CASE WHEN v_msg = 'box inconnue' THEN '00000000-0000-4000-b9a5-0000000000ff'::uuid ELSE b1 END,
              bm_m, CASE WHEN v_msg LIKE 'adhésion%' THEN m2 ELSE m END, 'stop', 'period_end',
              CASE WHEN v_msg = 'auteur coach' THEN c ELSE o1 END);
    EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN v_ok := SQLERRM LIKE 'JOURNAL_ARRET%';
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'J8 : insertion acceptée malgré : %', v_msg; END IF;
  END LOOP;
  PERFORM set_config('role', 'none', true);

  -- ── J9 : aucune écriture cliente ───────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', o1::text, true);
  FOREACH v_msg IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    PERFORM set_config('role', v_msg, true);
    v_ok := false;
    BEGIN
      INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, actor_id)
      VALUES (b1, bm_m, m, 'stop', 'period_end', o1);
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    PERFORM set_config('role', 'none', true);
    IF NOT v_ok THEN RAISE EXCEPTION 'J9 : % a pu écrire dans le journal', v_msg; END IF;
  END LOOP;

  -- ── J10 : valeurs contraintes ──────────────────────────────────────────────
  PERFORM set_config('role', 'service_role', true);
  FOREACH v_msg IN ARRAY ARRAY['action', 'mode', 'remboursement en fin de période'] LOOP
    v_ok := false;
    BEGIN
      INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, refund_cents, actor_id)
      VALUES (b1, bm_m, m,
              CASE WHEN v_msg = 'action' THEN 'pause' ELSE 'stop' END,
              CASE WHEN v_msg = 'mode' THEN 'plus_tard' ELSE 'period_end' END,
              CASE WHEN v_msg LIKE 'remboursement%' THEN 500 ELSE 0 END, o1);
    EXCEPTION WHEN check_violation THEN v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'J10 : valeur hors règle acceptée : %', v_msg; END IF;
  END LOOP;
  PERFORM set_config('role', 'none', true);

  -- ── J7 : supprimer un membre ou une box n'est pas bloqué, l'historique reste ─
  SELECT md5(string_agg(to_jsonb(a)::text, '|' ORDER BY id)) INTO v_avant
    FROM public.box_member_subscription_actions a WHERE box_id IN (b1, b2);
  DELETE FROM public.box_members WHERE id = bm_m2;          -- le membre quitte la box
  DELETE FROM auth.users WHERE id = m2;                     -- puis supprime son compte
  DELETE FROM public.boxes WHERE id = b2;                   -- et une box disparaît
  IF (SELECT md5(string_agg(to_jsonb(a)::text, '|' ORDER BY id))
        FROM public.box_member_subscription_actions a WHERE box_id IN (b1, b2)) IS DISTINCT FROM v_avant THEN
    RAISE EXCEPTION 'J7 : l''historique a changé après la suppression d''un membre ou d''une box';
  END IF;

  RAISE NOTICE 'journal des arrêts d''abonnement : J1 à J10 conformes';
END $t$;

ROLLBACK;
