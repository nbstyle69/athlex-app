-- ═════════════════════════════════════════════════════════════════════════════
-- État de l'abonnement, langue des jetons, catalogue (migration 20270128)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B1 (délai d'impayé 3 jours, gérant O1 …e0) : M1 (…01) en impayé depuis
-- 5 jours, abonnement Stripe, deux arrêts journalisés ; M2 (…02) en impayé
-- depuis 1 jour, au comptoir, aucun arrêt. Box B2 (délai 7 jours) : M3 (…03)
-- en impayé depuis 10 jours.
--   A1  M1 reçoit ses nouveaux champs : délai de sa box, suspendu, abonnement
--       Stripe, et le DERNIER arrêt (date et mode) ; les colonnes d'avant sont
--       toujours servies ;
--   A2  M2 : non suspendu, sans Stripe, sans arrêt ;
--   A3  `suspended` est `internal.membership_suspendu` pour chaque adhésion
--       de M1, M2 et M3 (trois cas : délai de la box dépassé, pas encore,
--       délai par défaut dépassé) ;
--   A4  chacun ne lit que ses propres adhésions ;
--   A5  droits (EXECUTE pour authenticated et service_role seulement),
--       commentaire du lot 6 conservé, corps épinglé ;
--   L1  langue d'un jeton : fr, en et NULL acceptés, toute autre valeur
--       refusée à l'insertion comme à la mise à jour ;
--   L2  un utilisateur ne change pas la langue du jeton d'un autre ;
--   C1  catalogue d'une box (gérant G …e1) : l'offre d'une box ouverte est
--       listée ; celles d'une box en archivage programmé et d'une box archivée
--       ne le sont plus, sauf l'offre à laquelle la box est déjà abonnée ;
--   C2  un non-gérant est toujours refusé, et le corps est épinglé.
-- Les corps épinglés (md5) sont à mettre à jour, en connaissance de cause,
-- par la prochaine migration qui redéfinit la fonction.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> État de l''abonnement, langue des jetons, catalogue'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9bc-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', 'e1', 'e2', '01', '02', '03']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9bc-0000000000' || s)::uuid, 'eal-' || s || '@test.invalid', 'eal_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', '01', '02', '03']) s;

INSERT INTO public.boxes (id, name, invite_code, owner_id, dunning_grace_days, archived_at, archive_scheduled_at) VALUES
  ('00000000-0000-4000-b9bc-000000000001', 'Box impayes', 'EAL1', '00000000-0000-4000-a9bc-0000000000e0', 3, NULL, NULL),
  ('00000000-0000-4000-b9bc-000000000002', 'Box delai 7', 'EAL2', '00000000-0000-4000-a9bc-0000000000e0', 7, NULL, NULL),
  -- Catalogue : S abonnée ; éditrices ouverte (PO), programmée (PS), archivée
  -- directement, sans programmation (PA), programmée avec une offre à laquelle
  -- S est abonnée (PK).
  ('00000000-0000-4000-b9bc-0000000000a0', 'Box abonnee',    'EALS',  '00000000-0000-4000-a9bc-0000000000e1', 7, NULL, NULL),
  ('00000000-0000-4000-b9bc-0000000000a1', 'Box ouverte',    'EALPO', '00000000-0000-4000-a9bc-0000000000e2', 7, NULL, NULL),
  ('00000000-0000-4000-b9bc-0000000000a2', 'Box programmee', 'EALPS', '00000000-0000-4000-a9bc-0000000000e2', 7, NULL, now()),
  ('00000000-0000-4000-b9bc-0000000000a3', 'Box archivee',   'EALPA', '00000000-0000-4000-a9bc-0000000000e2', 7, now(), NULL),
  ('00000000-0000-4000-b9bc-0000000000a4', 'Box programmee abonnee', 'EALPK', '00000000-0000-4000-a9bc-0000000000e2', 7, NULL, now());

INSERT INTO public.box_members (id, box_id, member_id, role, status, subscription_status, past_due_since, stripe_subscription_id) VALUES
  ('00000000-0000-4000-c9bc-000000000001', '00000000-0000-4000-b9bc-000000000001', '00000000-0000-4000-a9bc-000000000001',
   'member', 'active', 'past_due', now() - interval '5 days', 'sub_eal_01'),
  ('00000000-0000-4000-c9bc-000000000002', '00000000-0000-4000-b9bc-000000000001', '00000000-0000-4000-a9bc-000000000002',
   'member', 'active', 'past_due', now() - interval '1 day', NULL),
  ('00000000-0000-4000-c9bc-000000000003', '00000000-0000-4000-b9bc-000000000002', '00000000-0000-4000-a9bc-000000000003',
   'member', 'active', 'past_due', now() - interval '10 days', 'sub_eal_03');

-- Deux arrêts pour M1 : le plus ancien en fin de période, le plus récent immédiat.
INSERT INTO public.box_member_subscription_actions (box_id, box_member_id, member_id, action, mode, actor_id, created_at) VALUES
  ('00000000-0000-4000-b9bc-000000000001', '00000000-0000-4000-c9bc-000000000001', '00000000-0000-4000-a9bc-000000000001',
   'stop', 'period_end', '00000000-0000-4000-a9bc-0000000000e0', now() - interval '2 days'),
  ('00000000-0000-4000-b9bc-000000000001', '00000000-0000-4000-c9bc-000000000001', '00000000-0000-4000-a9bc-000000000001',
   'stop', 'now', '00000000-0000-4000-a9bc-0000000000e0', now() - interval '1 hour');

INSERT INTO public.box_programming (id, publisher_box_id, title, is_published) VALUES
  ('00000000-0000-4000-d9bc-0000000000a1', '00000000-0000-4000-b9bc-0000000000a1', 'Offre ouverte', true),
  ('00000000-0000-4000-d9bc-0000000000a2', '00000000-0000-4000-b9bc-0000000000a2', 'Offre programmee', true),
  ('00000000-0000-4000-d9bc-0000000000a3', '00000000-0000-4000-b9bc-0000000000a3', 'Offre archivee', true),
  ('00000000-0000-4000-d9bc-0000000000a4', '00000000-0000-4000-b9bc-0000000000a4', 'Offre programmee abonnee', true);
INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status) VALUES
  ('00000000-0000-4000-d9bc-0000000000a4', '00000000-0000-4000-b9bc-0000000000a0', 'active');

INSERT INTO public.push_tokens (id, user_id, token, platform) VALUES
  ('00000000-0000-4000-e9bc-000000000002', '00000000-0000-4000-a9bc-000000000002', 'ExponentPushToken[eal-02]', 'ios');

-- Appel comme le vrai client : rôle authenticated + auth.uid().
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9bc-0000000000' || p_qui, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

DO $t$
DECLARE
  r record;
  v_n int;
  v_sqlstate text;
  v_lang text;
  v_j jsonb;
BEGIN
  -- A1 : M1.
  PERFORM pg_temp.en_tant_que('01');
  SELECT * INTO r FROM public.get_my_membership_billing();
  PERFORM set_config('role', 'none', true);
  IF r.box_id IS DISTINCT FROM '00000000-0000-4000-b9bc-000000000001'
     OR r.subscription_status IS DISTINCT FROM 'past_due'
     OR r.status IS DISTINCT FROM 'active'
     OR r.dunning_grace_days IS DISTINCT FROM 3
     OR r.past_due_since IS NULL
     OR r.suspended IS DISTINCT FROM true
     OR r.has_stripe_subscription IS DISTINCT FROM true
     OR r.stop_mode IS DISTINCT FROM 'now'
     OR r.stopped_at IS DISTINCT FROM (SELECT max(created_at) FROM public.box_member_subscription_actions
                                        WHERE box_member_id = '00000000-0000-4000-c9bc-000000000001') THEN
    RAISE EXCEPTION 'A1 : champs de M1 inattendus : %', row_to_json(r);
  END IF;

  -- A2 : M2.
  PERFORM pg_temp.en_tant_que('02');
  SELECT * INTO r FROM public.get_my_membership_billing();
  PERFORM set_config('role', 'none', true);
  IF r.suspended IS DISTINCT FROM false
     OR r.has_stripe_subscription IS DISTINCT FROM false
     OR r.stopped_at IS NOT NULL OR r.stop_mode IS NOT NULL
     OR r.dunning_grace_days IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'A2 : champs de M2 inattendus : %', row_to_json(r);
  END IF;

  -- A3 : suspended est la règle de suspension, adhésion par adhésion.
  CREATE TEMP TABLE eal_lu (member_id uuid, box_id uuid, suspended boolean) ON COMMIT DROP;
  FOR r IN SELECT m FROM unnest(ARRAY['01', '02', '03']) m LOOP
    PERFORM pg_temp.en_tant_que(r.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('box_id', b.box_id, 'suspended', b.suspended)), '[]') INTO v_j
      FROM public.get_my_membership_billing() b;
    PERFORM set_config('role', 'none', true);
    INSERT INTO eal_lu SELECT ('00000000-0000-4000-a9bc-0000000000' || r.m)::uuid, (e->>'box_id')::uuid, (e->>'suspended')::boolean
      FROM jsonb_array_elements(v_j) e;
  END LOOP;
  SELECT count(*) INTO v_n FROM eal_lu l
   WHERE l.suspended IS NOT DISTINCT FROM internal.membership_suspendu(l.member_id, l.box_id);
  IF v_n <> 3 OR (SELECT count(*) FROM eal_lu WHERE suspended) <> 2 THEN
    RAISE EXCEPTION 'A3 : suspended ne suit pas internal.membership_suspendu (% sur 3 conformes, % suspendus sur 2)',
      v_n, (SELECT count(*) FROM eal_lu WHERE suspended);
  END IF;

  -- A4 : ses propres adhésions seulement.
  IF (SELECT count(*) FROM eal_lu) <> 3
     OR (SELECT count(*) FROM eal_lu l
          JOIN public.box_members bm ON bm.box_id = l.box_id AND bm.member_id = l.member_id) <> 3 THEN
    RAISE EXCEPTION 'A4 : chacun devrait lire exactement son adhésion (% lignes pour 3 membres)', (SELECT count(*) FROM eal_lu);
  END IF;
  PERFORM pg_temp.en_tant_que('e2');
  SELECT count(*) INTO v_n FROM public.get_my_membership_billing();
  PERFORM set_config('role', 'none', true);
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'A4 : un utilisateur sans adhésion lit % ligne(s)', v_n;
  END IF;

  -- A5 : droits, commentaire, corps.
  IF has_function_privilege('anon', 'public.get_my_membership_billing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A5 : anon a EXECUTE sur get_my_membership_billing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = 'public.get_my_membership_billing()'::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'A5 : PUBLIC a EXECUTE sur get_my_membership_billing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_my_membership_billing()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_my_membership_billing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A5 : authenticated ou service_role a perdu EXECUTE sur get_my_membership_billing';
  END IF;
  IF obj_description('public.get_my_membership_billing()'::regprocedure, 'pg_proc') IS DISTINCT FROM
     'Lot 6 : son propre abonnement, par auth.uid(). Remplace la lecture directe des colonnes nominatives de box_members.' THEN
    RAISE EXCEPTION 'A5 : commentaire de get_my_membership_billing perdu ou modifié';
  END IF;
  IF md5(pg_get_functiondef('public.get_my_membership_billing()'::regprocedure)) <> '6b3770f8bcf03c86b7e68f2e680c734e' THEN
    RAISE EXCEPTION 'A5 : la définition de get_my_membership_billing n''est plus celle de 20270128 (md5 %)',
      md5(pg_get_functiondef('public.get_my_membership_billing()'::regprocedure));
  END IF;

  -- L1 : langue d'un jeton.
  PERFORM pg_temp.en_tant_que('01');
  INSERT INTO public.push_tokens (user_id, token, platform, language) VALUES
    ('00000000-0000-4000-a9bc-000000000001', 'ExponentPushToken[eal-fr]', 'ios', 'fr'),
    ('00000000-0000-4000-a9bc-000000000001', 'ExponentPushToken[eal-en]', 'android', 'en'),
    ('00000000-0000-4000-a9bc-000000000001', 'ExponentPushToken[eal-nul]', 'android', NULL);
  PERFORM set_config('role', 'none', true);
  FOREACH v_lang IN ARRAY ARRAY['de', 'FR', 'en-US', ''] LOOP
    v_sqlstate := NULL;
    PERFORM pg_temp.en_tant_que('01');
    BEGIN
      INSERT INTO public.push_tokens (user_id, token, platform, language)
      VALUES ('00000000-0000-4000-a9bc-000000000001', 'ExponentPushToken[eal-x]', 'ios', v_lang);
    EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
    END;
    PERFORM set_config('role', 'none', true);
    IF v_sqlstate IS DISTINCT FROM '23514' THEN
      RAISE EXCEPTION 'L1 : la langue « % » n''est pas refusée à l''insertion (obtenu : %)', v_lang, coalesce(v_sqlstate, 'acceptée');
    END IF;
  END LOOP;
  v_sqlstate := NULL;
  PERFORM pg_temp.en_tant_que('01');
  BEGIN
    UPDATE public.push_tokens SET language = 'es' WHERE token = 'ExponentPushToken[eal-fr]';
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  UPDATE public.push_tokens SET language = 'en' WHERE token = 'ExponentPushToken[eal-fr]';
  PERFORM set_config('role', 'none', true);
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'L1 : la langue « es » n''est pas refusée à la mise à jour (obtenu : %)', coalesce(v_sqlstate, 'acceptée');
  END IF;
  IF (SELECT string_agg(coalesce(language, 'NULL'), ',' ORDER BY token) FROM public.push_tokens
       WHERE user_id = '00000000-0000-4000-a9bc-000000000001') IS DISTINCT FROM 'en,en,NULL' THEN
    RAISE EXCEPTION 'L1 : langues de M1 inattendues : %', (SELECT string_agg(coalesce(language, 'NULL'), ',' ORDER BY token)
      FROM public.push_tokens WHERE user_id = '00000000-0000-4000-a9bc-000000000001');
  END IF;

  -- L2 : pas la langue du jeton d'un autre.
  PERFORM pg_temp.en_tant_que('01');
  UPDATE public.push_tokens SET language = 'en' WHERE id = '00000000-0000-4000-e9bc-000000000002';
  PERFORM set_config('role', 'none', true);
  IF (SELECT language FROM public.push_tokens WHERE id = '00000000-0000-4000-e9bc-000000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'L2 : M1 a changé la langue du jeton de M2';
  END IF;

  -- C1 : catalogue de la box abonnée.
  PERFORM pg_temp.en_tant_que('e1');
  SELECT string_agg(c.title || ':' || c.subscribed, ',' ORDER BY c.title) INTO v_lang
    FROM public.list_programming_catalog('00000000-0000-4000-b9bc-0000000000a0') c
   WHERE c.publisher_box_id::text LIKE '00000000-0000-4000-b9bc-%';
  PERFORM set_config('role', 'none', true);
  IF v_lang IS DISTINCT FROM 'Offre ouverte:false,Offre programmee abonnee:true' THEN
    RAISE EXCEPTION 'C1 : catalogue inattendu : %', v_lang;
  END IF;

  -- C2 : non-gérant refusé ; corps épinglé.
  v_sqlstate := NULL;
  PERFORM pg_temp.en_tant_que('01');
  BEGIN
    PERFORM * FROM public.list_programming_catalog('00000000-0000-4000-b9bc-0000000000a0');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'C2 : un non-gérant n''est pas refusé en 42501 (obtenu : %)', coalesce(v_sqlstate, 'aucune erreur');
  END IF;
  IF md5(pg_get_functiondef('public.list_programming_catalog(uuid)'::regprocedure)) <> '06329551f541f43204806c3bfeffc4da' THEN
    RAISE EXCEPTION 'C2 : la définition de list_programming_catalog n''est plus celle de 20270128 (md5 %)',
      md5(pg_get_functiondef('public.list_programming_catalog(uuid)'::regprocedure));
  END IF;
END $t$;

ROLLBACK;
\echo '    A1 à A5, L1, L2, C1, C2 OK'
