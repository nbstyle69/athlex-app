-- ═════════════════════════════════════════════════════════════════════════════
-- Langue du compte enregistrée pour le serveur (#531, migration 20270161)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR, depuis la
-- racine du dépôt (la migration et son retour arrière sont rejoués par \i).
--   K1  notification_preferences.language : fr, en et NULL acceptés, 'de'
--       refusé à l'insertion comme à la mise à jour ;
--   K2  A ne lit ni n'écrit la langue de B (lecture, mise à jour, insertion,
--       upsert) ; A écrit la sienne ;
--   K3  upserts croisés, comme l'app : l'upsert de langue ne touche aucune
--       préférence, l'upsert des préférences ne touche pas la langue ;
--   K4  langues_destinataires : EXECUTE à service_role seul (ni anon, ni
--       authenticated, ni PUBLIC), appel refusé à anon et authenticated ;
--       SECURITY INVOKER, STABLE, search_path vide ;
--   K5  ordre de la règle, appelée en service_role : préférence > jeton le
--       plus récent qui a une langue > jeton sans langue ignoré > 'fr' ;
--       compte sans ligne ni jeton → 'fr' ; tableau vide → aucune ligne ;
--   R   retour arrière : fonction et colonne retirées ; puis la migration
--       rejouée depuis cet état : mêmes droits.
-- Mutations : jouées localement (liste et résultat dans la PR) ; chacune fait
-- échouer ce fichier. Tout est joué dans une transaction annulée.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Langue du compte (notification_preferences.language, langues_destinataires)'

BEGIN;
SET LOCAL search_path = "$user", public, extensions;

CREATE FUNCTION pg_temp.u(s text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-a161-0000000000' || s)::uuid $$;
GRANT EXECUTE ON FUNCTION pg_temp.u(text) TO PUBLIC; -- appelée sous anon et authenticated

-- A (…0a), B (…0b) ; règle : P préférence, J jetons, N préférence nulle,
-- S sans rien, T jetons sans langue, C et D jetons sans updated_at.
INSERT INTO auth.users (id)
SELECT pg_temp.u(s) FROM unnest(ARRAY['0a', '0b', '01', '02', '03', '04', '05', '06', '07']) s;

-- Appel comme le vrai client : rôle authenticated + auth.uid().
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', pg_temp.u(p_qui)::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

-- ── K1 : CHECK ────────────────────────────────────────────────────────────────
DO $t$
BEGIN
  INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('0a'), 'fr');
  UPDATE public.notification_preferences SET language = 'en' WHERE user_id = pg_temp.u('0a');
  UPDATE public.notification_preferences SET language = NULL WHERE user_id = pg_temp.u('0a');
  BEGIN
    INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('0b'), 'de');
    RAISE EXCEPTION 'K1 : language = de accepté à l''insertion';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.notification_preferences SET language = 'de' WHERE user_id = pg_temp.u('0a');
    RAISE EXCEPTION 'K1 : language = de accepté à la mise à jour';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  DELETE FROM public.notification_preferences WHERE user_id = pg_temp.u('0a');
END $t$;

-- ── K2 : chacun sa ligne ──────────────────────────────────────────────────────
INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('0b'), 'en');

DO $t$
DECLARE
  v_n int;
  v_lang text;
BEGIN
  PERFORM pg_temp.en_tant_que('0a');
  SELECT count(*) INTO v_n FROM public.notification_preferences WHERE user_id = pg_temp.u('0b');
  IF v_n <> 0 THEN RAISE EXCEPTION 'K2 : A lit la ligne de B'; END IF;
  UPDATE public.notification_preferences SET language = 'fr' WHERE user_id = pg_temp.u('0b');
  -- Sans WHERE : la policy d'UPDATE seule décide des lignes touchées.
  UPDATE public.notification_preferences SET language = 'fr';
  -- Insertion pour un compte qui n'a pas encore de ligne (S).
  BEGIN
    INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('04'), 'en');
    RAISE EXCEPTION 'K2 : A crée la ligne de langue d''un autre compte';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('0b'), 'fr')
      ON CONFLICT (user_id) DO UPDATE SET language = EXCLUDED.language;
    RAISE EXCEPTION 'K2 : A écrit la langue de B par upsert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- A écrit et relit la sienne.
  INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('0a'), 'en')
    ON CONFLICT (user_id) DO UPDATE SET language = EXCLUDED.language;
  SELECT language INTO v_lang FROM public.notification_preferences WHERE user_id = pg_temp.u('0a');
  IF v_lang IS DISTINCT FROM 'en' THEN RAISE EXCEPTION 'K2 : A ne relit pas sa langue (%)', v_lang; END IF;
  PERFORM set_config('role', 'none', true);

  SELECT language INTO v_lang FROM public.notification_preferences WHERE user_id = pg_temp.u('0b');
  IF v_lang IS DISTINCT FROM 'en' THEN RAISE EXCEPTION 'K2 : A a changé la langue de B (%)', v_lang; END IF;
END $t$;

-- ── K3 : upserts croisés, sous la forme qu'envoie PostgREST ───────────────────
DO $t$
DECLARE r record;
BEGIN
  PERFORM pg_temp.en_tant_que('0a');
  -- saveNotificationPrefs : préférences seules.
  INSERT INTO public.notification_preferences (user_id, daily_reminder, reminder_hour, updated_at)
  VALUES (pg_temp.u('0a'), false, 7, now())
  ON CONFLICT (user_id) DO UPDATE SET daily_reminder = EXCLUDED.daily_reminder,
    reminder_hour = EXCLUDED.reminder_hour, updated_at = EXCLUDED.updated_at;
  -- Langue seule.
  INSERT INTO public.notification_preferences (user_id, language) VALUES (pg_temp.u('0a'), 'fr')
  ON CONFLICT (user_id) DO UPDATE SET language = EXCLUDED.language;
  SELECT * INTO r FROM public.notification_preferences WHERE user_id = pg_temp.u('0a');
  PERFORM set_config('role', 'none', true);
  IF r.language IS DISTINCT FROM 'fr' OR r.daily_reminder IS DISTINCT FROM false OR r.reminder_hour IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'K3 : upserts croisés : %', row_to_json(r);
  END IF;
END $t$;

-- ── K4 : droits de la fonction ────────────────────────────────────────────────
CREATE FUNCTION pg_temp.droits(p_etape text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  f oid := to_regprocedure('public.langues_destinataires(uuid[])');
  p record;
BEGIN
  IF f IS NULL THEN RAISE EXCEPTION '% : langues_destinataires absente', p_etape; END IF;
  IF has_function_privilege('service_role', f, 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION '% : service_role ne peut pas exécuter langues_destinataires', p_etape;
  END IF;
  IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc x, aclexplode(x.proacl) a WHERE x.oid = f AND a.grantee = 0) THEN
    RAISE EXCEPTION '% : langues_destinataires ouverte à anon, authenticated ou PUBLIC', p_etape;
  END IF;
  SELECT x.prosecdef, x.provolatile, x.proconfig INTO p FROM pg_proc x WHERE x.oid = f;
  IF p.prosecdef OR p.provolatile <> 's' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""'] THEN
    RAISE EXCEPTION '% : attendu SECURITY INVOKER, STABLE, search_path vide : %', p_etape, row_to_json(p);
  END IF;
END $$;
SELECT pg_temp.droits('K4');

DO $t$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    PERFORM set_config('role', r, true);
    BEGIN
      PERFORM * FROM public.langues_destinataires(ARRAY[pg_temp.u('0b')]);
      RAISE EXCEPTION 'K4 : % exécute langues_destinataires', r;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    PERFORM set_config('role', 'none', true);
  END LOOP;
END $t$;

-- ── K5 : la règle, appelée comme le serveur ───────────────────────────────────
INSERT INTO public.notification_preferences (user_id, language) VALUES
  (pg_temp.u('01'), 'en'),  -- P : la préférence l'emporte sur un jeton fr plus récent
  (pg_temp.u('03'), NULL);  -- N : ligne sans langue → jetons
INSERT INTO public.push_tokens (user_id, token, platform, language, created_at, updated_at) VALUES
  (pg_temp.u('01'), 'ExponentPushToken[k-01]', 'ios', 'fr', now(), now()),
  -- J : le plus récent des jetons qui ont une langue, par updated_at (02b,
  -- créé avant 02a mais mis à jour après)
  (pg_temp.u('02'), 'ExponentPushToken[k-02a]', 'ios', 'en', now() - interval '2 days', now() - interval '2 days'),
  (pg_temp.u('02'), 'ExponentPushToken[k-02b]', 'android', 'fr', now() - interval '3 days', now() - interval '1 day'),
  -- N : un jeton sans langue plus récent est ignoré
  (pg_temp.u('03'), 'ExponentPushToken[k-03a]', 'ios', 'en', now() - interval '2 days', now() - interval '2 days'),
  (pg_temp.u('03'), 'ExponentPushToken[k-03b]', 'ios', NULL, now(), now()),
  -- T : aucun jeton n'a de langue
  (pg_temp.u('05'), 'ExponentPushToken[k-05]', 'ios', NULL, now(), now()),
  -- C : updated_at absent, created_at le plus récent fait foi
  (pg_temp.u('06'), 'ExponentPushToken[k-06a]', 'ios', 'fr', now() - interval '5 days', now() - interval '5 days'),
  (pg_temp.u('06'), 'ExponentPushToken[k-06b]', 'ios', 'en', now() - interval '1 day', NULL),
  -- D : updated_at absent sur le plus ancien : il ne passe pas devant
  (pg_temp.u('07'), 'ExponentPushToken[k-07a]', 'ios', 'fr', now() - interval '1 day', now() - interval '1 day'),
  (pg_temp.u('07'), 'ExponentPushToken[k-07b]', 'ios', 'en', now() - interval '5 days', NULL);

DO $t$
DECLARE
  v_obtenu text;
  v_attendu text := '01:en,02:fr,03:en,04:fr,05:fr,06:en,07:fr,0b:en';
  v_n int;
BEGIN
  PERFORM set_config('role', 'service_role', true);
  SELECT string_agg(right(user_id::text, 2) || ':' || language, ',' ORDER BY user_id::text) INTO v_obtenu
    FROM public.langues_destinataires(ARRAY[pg_temp.u('01'), pg_temp.u('02'), pg_temp.u('03'), pg_temp.u('04'),
                                            pg_temp.u('05'), pg_temp.u('06'), pg_temp.u('07'), pg_temp.u('0b')]);
  SELECT count(*) INTO v_n FROM public.langues_destinataires(ARRAY[]::uuid[]);
  PERFORM set_config('role', 'none', true);
  IF v_obtenu IS DISTINCT FROM v_attendu THEN
    RAISE EXCEPTION 'K5 : règle : obtenu %, attendu %', v_obtenu, v_attendu;
  END IF;
  IF v_n <> 0 THEN RAISE EXCEPTION 'K5 : tableau vide → % ligne(s)', v_n; END IF;
END $t$;

-- ── R : retour arrière, puis la migration rejouée depuis cet état ─────────────
-- Aucun droit par défaut sur les fonctions recréées ici : seuls comptent les
-- GRANT explicites de la migration (le rejeu tourne sous supabase_admin, dont
-- les privilèges par défaut ouvrent EXECUTE à authenticated). Annulé avec le reste.
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, service_role;

\i supabase/retours/20270161000000_langue_compte.sql
DO $t$
BEGIN
  IF to_regprocedure('public.langues_destinataires(uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'R : langues_destinataires toujours là après le retour';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
               AND table_name = 'notification_preferences' AND column_name = 'language') THEN
    RAISE EXCEPTION 'R : notification_preferences.language toujours là après le retour';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_preferences_language_check') THEN
    RAISE EXCEPTION 'R : contrainte de langue toujours là après le retour';
  END IF;
END $t$;

\i supabase/migrations/20270161000000_langue_compte.sql
SELECT pg_temp.droits('R rejeu');

ROLLBACK;
\echo '    K1 à K5 et R OK'
