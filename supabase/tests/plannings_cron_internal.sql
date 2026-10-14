-- ═════════════════════════════════════════════════════════════════════════════
-- #556 : extend_all_class_schedules() fermée aux clients, la logique des
-- plannings dans internal, la tâche cron réparée (20270155).
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Tout se joue dans UNE transaction annulée.
--
--   P1  extend_all_class_schedules : anon et authenticated → 42501.
--   P2  generate_class_schedules_from_templates garde ses deux gardes, dans cet
--       ordre et avec ces messages : sans auth.uid() → « Authentification
--       requise » ; compte connecté hors de la box → « Accès refusé : cette box
--       ne vous appartient pas ». C'est ce qui prouve que la délégation à
--       internal n'a rien affaibli.
--   P3  le gérant génère toujours ses créneaux par cette porte : 2 modèles
--       actifs × 2 semaines = 4 lignes, puis 0 au second appel.
--   P4  le chemin serveur, sans auth.uid() : extend_all (ce qu'appelle la
--       tâche cron) étend chaque box à modèles actifs sur 8 semaines, laisse
--       la box sans modèle actif vide, et internal.etendre_plannings_boxes
--       rappelée aussitôt n'insère rien (NOT EXISTS).
--       Le rejeu crée les fonctions en supabase_admin : le chemin serveur est
--       appelé en superutilisateur, comme le cron en propriétaire (postgres)
--       en prod.
--   P5  les deux fonctions d'internal : anon, authenticated et service_role
--       → 42501 (en plus du contrôle catalogue I1 à I3).
--   R   retour arrière (supabase/retours/20270155…) : les deux définitions
--       retrouvent leur md5 de prod, CR compris, extend_all redevient
--       exécutable par authenticated (pas par anon), internal est nettoyé —
--       puis tout est annulé.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

BEGIN;

-- Appel sous un rôle et un auth.uid() donnés (NULL : aucun) : 'ok:<résultat>'
-- ou '<SQLSTATE>:<message>'.
CREATE FUNCTION pg_temp.appel(p_role text, p_uid uuid, p_sql text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  PERFORM set_config('request.jwt.claims', '', true);
  IF p_role IS NOT NULL THEN
    EXECUTE format('SET LOCAL ROLE %I', p_role);
  END IF;
  BEGIN
    EXECUTE p_sql INTO v;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN SQLSTATE || ':' || SQLERRM;
  END;
  RESET ROLE;
  RETURN 'ok:' || coalesce(v, '');
END $$;

-- Décor : G gère A (2 modèles actifs, 1 inactif) et C (aucun modèle actif) ;
-- X gère B (1 modèle actif), pas A.
INSERT INTO auth.users (id, email) VALUES
  ('55600000-0000-4000-8000-0000000000a1', 'g556@test.local'),
  ('55600000-0000-4000-8000-0000000000a2', 'x556@test.local');
INSERT INTO public.profiles (id, username, email) VALUES
  ('55600000-0000-4000-8000-0000000000a1', 'g556', 'g556@test.local'),
  ('55600000-0000-4000-8000-0000000000a2', 'x556', 'x556@test.local');
INSERT INTO public.boxes (id, name, owner_id, invite_code) VALUES
  ('55600000-0000-4000-8000-0000000000b1', 'Box A 556', '55600000-0000-4000-8000-0000000000a1', 'P556BOXA'),
  ('55600000-0000-4000-8000-0000000000b2', 'Box B 556', '55600000-0000-4000-8000-0000000000a2', 'P556BOXB'),
  ('55600000-0000-4000-8000-0000000000b3', 'Box C 556', '55600000-0000-4000-8000-0000000000a1', 'P556BOXC');
INSERT INTO public.schedule_templates (box_id, title, day_of_week, start_time, end_time, is_active) VALUES
  ('55600000-0000-4000-8000-0000000000b1', 'WOD',   1, '07:00', '08:00', true),
  ('55600000-0000-4000-8000-0000000000b1', 'WOD',   3, '18:00', '19:00', true),
  ('55600000-0000-4000-8000-0000000000b1', 'Yoga',  2, '12:00', '13:00', false),
  ('55600000-0000-4000-8000-0000000000b2', 'Open',  5, '09:00', '10:00', true),
  ('55600000-0000-4000-8000-0000000000b3', 'Stand', 4, '10:00', '11:00', false);

CREATE FUNCTION pg_temp.creneaux(p_box uuid) RETURNS bigint
LANGUAGE sql AS $$ SELECT count(*) FROM public.class_schedules WHERE box_id = p_box $$;

DO $$
DECLARE
  g uuid := '55600000-0000-4000-8000-0000000000a1';
  x uuid := '55600000-0000-4000-8000-0000000000a2';
  c_gen_a text := $q$SELECT public.generate_class_schedules_from_templates('55600000-0000-4000-8000-0000000000b1', 2)$q$;
  r text;
  v text;
  n_avant bigint;
BEGIN
  -- ── P1 ─────────────────────────────────────────────────────────────────────
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    v := pg_temp.appel(r, g, 'SELECT public.extend_all_class_schedules()');
    IF v NOT LIKE '42501:%' THEN
      RAISE EXCEPTION 'P1 : % appelle extend_all_class_schedules (%), 42501 attendu', r, v
        USING HINT = 'Un client génère les créneaux de toutes les box. Rejoue 20270155.';
    END IF;
  END LOOP;

  -- ── P2 ─────────────────────────────────────────────────────────────────────
  v := pg_temp.appel('authenticated', NULL, c_gen_a);
  IF v <> '42501:Authentification requise' THEN
    RAISE EXCEPTION 'P2 : sans auth.uid(), generate répond « % »', v
      USING HINT = 'Attendu : 42501 « Authentification requise », AVANT la garde is_box_admin.';
  END IF;
  v := pg_temp.appel('authenticated', x, c_gen_a);
  IF v <> '42501:Accès refusé : cette box ne vous appartient pas' THEN
    RAISE EXCEPTION 'P2 : un gérant d''une autre box appelle generate sur A : « % »', v;
  END IF;
  IF pg_temp.creneaux('55600000-0000-4000-8000-0000000000b1') <> 0 THEN
    RAISE EXCEPTION 'P2 : un appel refusé a quand même inséré des créneaux';
  END IF;

  -- ── P3 ─────────────────────────────────────────────────────────────────────
  v := pg_temp.appel('authenticated', g, c_gen_a);
  IF v <> 'ok:4' OR pg_temp.creneaux('55600000-0000-4000-8000-0000000000b1') <> 4 THEN
    RAISE EXCEPTION 'P3 : le gérant génère sa box : % (ok:4 attendu), % ligne(s)',
      v, pg_temp.creneaux('55600000-0000-4000-8000-0000000000b1');
  END IF;
  v := pg_temp.appel('authenticated', g, c_gen_a);
  IF v <> 'ok:0' THEN
    RAISE EXCEPTION 'P3 : second appel du gérant : % (ok:0 attendu, NOT EXISTS)', v;
  END IF;

  -- ── P4 ─────────────────────────────────────────────────────────────────────
  SELECT count(*) INTO n_avant FROM public.class_schedules;
  v := pg_temp.appel(NULL, NULL, 'SELECT public.extend_all_class_schedules()');
  IF v NOT LIKE 'ok:%' THEN
    RAISE EXCEPTION 'P4 : la tâche cron échoue toujours : %', v;
  END IF;
  IF pg_temp.creneaux('55600000-0000-4000-8000-0000000000b1') <> 16
     OR pg_temp.creneaux('55600000-0000-4000-8000-0000000000b2') <> 8
     OR pg_temp.creneaux('55600000-0000-4000-8000-0000000000b3') <> 0 THEN
    RAISE EXCEPTION 'P4 : créneaux après le cron A=% (16), B=% (8), C=% (0)',
      pg_temp.creneaux('55600000-0000-4000-8000-0000000000b1'),
      pg_temp.creneaux('55600000-0000-4000-8000-0000000000b2'),
      pg_temp.creneaux('55600000-0000-4000-8000-0000000000b3');
  END IF;
  IF substr(v, 4)::bigint <> (SELECT count(*) FROM public.class_schedules) - n_avant THEN
    RAISE EXCEPTION 'P4 : extend_all annonce % ligne(s), % insérée(s)', substr(v, 4),
      (SELECT count(*) FROM public.class_schedules) - n_avant;
  END IF;
  v := pg_temp.appel(NULL, NULL, 'SELECT internal.etendre_plannings_boxes()');
  IF v <> 'ok:0' THEN
    RAISE EXCEPTION 'P4 : second passage du chemin serveur : % (ok:0 attendu, NOT EXISTS)', v;
  END IF;

  -- ── P5 ─────────────────────────────────────────────────────────────────────
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH v IN ARRAY ARRAY[
      'SELECT internal.etendre_plannings_boxes()',
      $q$SELECT internal.generer_plannings_box('55600000-0000-4000-8000-0000000000b1', 8)$q$
    ] LOOP
      IF pg_temp.appel(r, g, v) NOT LIKE '42501:%' THEN
        RAISE EXCEPTION 'P5 : % appelle « % » (%)', r, v, pg_temp.appel(r, g, v)
          USING HINT = 'internal est réservé à postgres : REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role.';
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'plannings_cron_internal : P1, P2, P3, P4, P5 OK';
END $$;

-- ── R : le retour arrière rétablit la prod du 14/10/2026 ─────────────────────
\i supabase/retours/20270155000000_plannings_cron_internal.sql

DO $$
DECLARE v text;
BEGIN
  v := md5(pg_get_functiondef('public.generate_class_schedules_from_templates(uuid,integer)'::regprocedure));
  IF v <> 'ef1c1ab86c10aad3fb3b66ff704adc34' THEN
    RAISE EXCEPTION 'R : generate_class_schedules_from_templates restaurée avec md5 %', v;
  END IF;
  v := md5(pg_get_functiondef('public.extend_all_class_schedules()'::regprocedure));
  IF v <> 'b93015385cad4ce232b1c7f6ed45cc5f' THEN
    RAISE EXCEPTION 'R : extend_all_class_schedules restaurée avec md5 % (CR du corps ?)', v;
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.extend_all_class_schedules()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.extend_all_class_schedules()', 'EXECUTE')
     OR to_regprocedure('internal.etendre_plannings_boxes()') IS NOT NULL
     OR to_regprocedure('internal.generer_plannings_box(uuid,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'R : droits ou schéma internal différents de l''état d''avant 20270155';
  END IF;
  RAISE NOTICE 'plannings_cron_internal : R OK';
END $$;

ROLLBACK;
