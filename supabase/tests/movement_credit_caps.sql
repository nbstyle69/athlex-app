-- ═════════════════════════════════════════════════════════════════════════════
-- Plafond par appel d'`increment_movement_stats`
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--
-- Deux moitiés, et la seconde compte autant que la première :
--   * les bornes, unité par unité : juste sous le plafond, au plafond, au-delà ;
--   * les usages NORMAUX mesurés (Murph, Cindy, 5 × 100 DU, marathon au rameur,
--     AMRAP à 20 cal) doivent passer. Un plafond qui refuserait Murph serait
--     pire que pas de plafond : dans la 1.0.56, le refus est silencieux, le
--     crédit légitime se perd sans que personne ne le voie. Ces appels ne sont
--     pas recopiés ici : ils viennent de `movement_credit_caps_cases.json`,
--     qu'un test jest recalcule avec le vrai code du client.
--
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Plafonds d''increment_movement_stats'

BEGIN;

\i supabase/seed/movement_credit_caps_cases.sql

INSERT INTO auth.users (id) VALUES ('00000000-0000-4000-a300-000000000001');
INSERT INTO public.profiles (id, email, username)
VALUES ('00000000-0000-4000-a300-000000000001', 'plafond@test.invalid', 'plafond_1');

-- Un appel comme le ferait l'app : sous le rôle `authenticated`, avec le JWT de
-- l'athlète. Rend 'ok', ou le SQLSTATE et le message du refus. Le rôle est
-- rétabli avant de rendre la main, pour que les lectures de contrôle se
-- fassent avec les droits du test.
CREATE FUNCTION pg_temp.appel(p_role text, p_mouvement text, p_unite text, p_quantite integer,
                               p_charge numeric DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',  '00000000-0000-4000-a300-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config('role', p_role, true);
  BEGIN
    PERFORM public.increment_movement_stats(
      '00000000-0000-4000-a300-000000000001', p_mouvement, p_quantite, p_charge, p_unite);
    r := 'ok';
  EXCEPTION WHEN others THEN
    r := SQLSTATE || '|' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  RETURN r;
END $$;

CREATE FUNCTION pg_temp.cumul(p_mouvement text, p_unite text)
RETURNS bigint LANGUAGE sql AS $$
  SELECT COALESCE(sum(total_reps), 0) FROM public.user_movement_stats
   WHERE user_id = '00000000-0000-4000-a300-000000000001'
     AND movement = p_mouvement AND unit = p_unite;
$$;

-- ── V01 · les valeurs retenues sont celles de la base ──────────────────────
-- Épinglées : les changer doit être un choix délibéré, visible dans une PR.
DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(unit || '=' || per_call, ' ' ORDER BY unit) INTO v
    FROM public.movement_credit_caps WHERE movement IS NULL;
  IF v IS DISTINCT FROM 'cal=1500 m=50000 reps=2000' THEN
    RAISE EXCEPTION 'V01 : plafonds inattendus — % (attendu cal=1500 m=50000 reps=2000)', v;
  END IF;
  IF EXISTS (SELECT 1 FROM public.movement_credit_caps WHERE movement IS NOT NULL) THEN
    RAISE EXCEPTION 'V01 : une exception par mouvement a été posée sans que ce test le sache';
  END IF;
END $$;

-- ── B · les bornes, unité par unité ────────────────────────────────────────
-- Chaque unité sur son propre mouvement : les cumuls se lisent sans mélange.
DO $$
DECLARE
  u      record;
  r      text;
  avant  bigint;
BEGIN
  FOR u IN SELECT * FROM (VALUES ('reps', 'pull_up', 2000), ('m', 'run', 50000), ('cal', 'row', 1500))
                  AS t(unite, mouvement, plafond) LOOP

    r := pg_temp.appel('authenticated', u.mouvement, u.unite, u.plafond - 1);
    IF r <> 'ok' THEN
      RAISE EXCEPTION 'B/% : juste sous le plafond (%) refusé — %', u.unite, u.plafond - 1, r;
    END IF;

    r := pg_temp.appel('authenticated', u.mouvement, u.unite, u.plafond);
    IF r <> 'ok' THEN
      RAISE EXCEPTION 'B/% : AU plafond (%) refusé — la borne est inclusive — %', u.unite, u.plafond, r;
    END IF;

    avant := pg_temp.cumul(u.mouvement, u.unite);
    r := pg_temp.appel('authenticated', u.mouvement, u.unite, u.plafond + 1);
    IF r NOT LIKE '22003|%' THEN
      RAISE EXCEPTION 'B/% : au-delà du plafond (%) non refusé en 22003 — %', u.unite, u.plafond + 1, r;
    END IF;

    -- Le message doit nommer les quatre éléments : c'est lui que lira la
    -- personne qui cherche pourquoi un crédit manque.
    IF r NOT LIKE '%' || u.mouvement || '%'
       OR r NOT LIKE '%' || (u.plafond + 1) || ' ' || u.unite || '%'
       OR r NOT LIKE '%(' || u.plafond || ' ' || u.unite || ')%' THEN
      RAISE EXCEPTION 'B/% : message de refus incomplet — %', u.unite, r;
    END IF;

    -- Et le refus n'a rien crédité.
    IF pg_temp.cumul(u.mouvement, u.unite) <> avant THEN
      RAISE EXCEPTION 'B/% : l''appel refusé a quand même modifié le cumul', u.unite;
    END IF;
    IF avant <> (u.plafond - 1) + u.plafond THEN
      RAISE EXCEPTION 'B/% : cumul % après deux appels acceptés, attendu %',
        u.unite, avant, (u.plafond - 1) + u.plafond;
    END IF;
  END LOOP;
END $$;

-- ── N · les usages normaux mesurés passent tous ────────────────────────────
DO $$
DECLARE
  c       jsonb;
  x       jsonb;
  r       text;
  n       int := 0;
BEGIN
  -- Repartir de zéro : les cumuls de B ne doivent pas se mêler à ceux-ci.
  DELETE FROM public.user_movement_stats WHERE user_id = '00000000-0000-4000-a300-000000000001';

  FOR c IN SELECT jsonb_array_elements(donnees -> 'cas') FROM cas_plafonds LOOP
    FOR x IN SELECT jsonb_array_elements(c -> 'credits') LOOP
      r := pg_temp.appel('authenticated', x ->> 'movement', x ->> 'unit', (x ->> 'quantite')::int);
      IF r <> 'ok' THEN
        RAISE EXCEPTION 'N (%) : usage normal refusé — % % de % — %',
          c ->> 'nom', x ->> 'quantite', x ->> 'unit', x ->> 'movement', r;
      END IF;
      n := n + 1;
    END LOOP;
  END LOOP;

  IF n < 10 THEN
    RAISE EXCEPTION 'N : % appel(s) seulement — le fichier de cas n''a pas été chargé', n;
  END IF;

  -- Les deux lignes de course de Murph se cumulent : un appel par ligne.
  IF pg_temp.cumul('run', 'm') <> 3200 THEN
    RAISE EXCEPTION 'N : Murph devait créditer 3 200 m de course, obtenu %', pg_temp.cumul('run', 'm');
  END IF;
  RAISE NOTICE 'usages normaux : % appels acceptés', n;
END $$;

-- ── S · la signature à quatre arguments hérite du plafond ───────────────────
DO $$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',  '00000000-0000-4000-a300-000000000001', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.increment_movement_stats('00000000-0000-4000-a300-000000000001', 'push_up', 2001, NULL);
    r := 'ok';
  EXCEPTION WHEN others THEN r := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  IF r <> '22003' THEN
    RAISE EXCEPTION 'S : la signature historique laisse passer 2 001 reps — %', r;
  END IF;
END $$;

-- ── R · `service_role` n'est pas exempté ───────────────────────────────────
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.appel('service_role', 'sit_up', 'reps', 2001);
  IF r NOT LIKE '22003|%' THEN
    RAISE EXCEPTION 'R : service_role crédite au-delà du plafond — %', r;
  END IF;
END $$;

-- ── F · sans plafond configuré, on refuse ──────────────────────────────────
-- Une ligne supprimée par erreur ne doit pas rouvrir la porte.
DO $$
DECLARE r text;
BEGIN
  DELETE FROM public.movement_credit_caps WHERE unit = 'cal' AND movement IS NULL;
  r := pg_temp.appel('authenticated', 'bike', 'cal', 1);
  IF r NOT LIKE '22003|%aucun plafond%' THEN
    RAISE EXCEPTION 'F : unité sans plafond configuré laissée ouverte — %', r;
  END IF;
END $$;

-- ── E · une exception par mouvement l'emporte sur l'unité ──────────────────
-- La structure promet d'accueillir des exceptions : on vérifie qu'elle tient
-- sa promesse, sans en laisser aucune derrière (transaction annulée).
DO $$
DECLARE r text;
BEGIN
  INSERT INTO public.movement_credit_caps (unit, movement, per_call) VALUES ('reps', 'rope_climb', 50);
  r := pg_temp.appel('authenticated', 'rope_climb', 'reps', 51);
  IF r NOT LIKE '22003|%(50 reps)%' THEN
    RAISE EXCEPTION 'E1 : l''exception par mouvement n''a pas été appliquée — %', r;
  END IF;
  r := pg_temp.appel('authenticated', 'air_squat', 'reps', 51);
  IF r <> 'ok' THEN
    RAISE EXCEPTION 'E2 : l''exception d''un mouvement a débordé sur un autre — %', r;
  END IF;
END $$;

-- ── Q · les quantités qui ne sont pas des crédits ──────────────────────────
-- « Aucune écriture » se prouve par l'emplacement physique de la ligne
-- (`ctid`) : dans une même transaction `now()` ne bouge pas, un `updated_at`
-- réécrit à l'identique ne dirait rien, alors qu'un UPDATE déplace la ligne.
CREATE FUNCTION pg_temp.ligne(p_mouvement text)
RETURNS text LANGUAGE sql AS $$
  SELECT ctid::text || '|' || total_reps || '|' || COALESCE(best_weight::text, 'nul')
    FROM public.user_movement_stats
   WHERE user_id = '00000000-0000-4000-a300-000000000001' AND movement = p_mouvement AND unit = 'reps';
$$;

DO $$
DECLARE r text; avant text;
BEGIN
  DELETE FROM public.user_movement_stats WHERE user_id = '00000000-0000-4000-a300-000000000001';
  r := pg_temp.appel('authenticated', 'pull_up', 'reps', 50, 20);
  IF r <> 'ok' THEN RAISE EXCEPTION 'Q : décor refusé — %', r; END IF;
  avant := pg_temp.ligne('pull_up');

  -- Q1 · NULL : ni erreur, ni écriture, cumul intact.
  r := pg_temp.appel('authenticated', 'pull_up', 'reps', NULL);
  IF r <> 'ok' THEN
    RAISE EXCEPTION 'Q1 : une quantité NULL lève une erreur au lieu d''être ignorée — %', r;
  END IF;
  IF pg_temp.ligne('pull_up') IS DISTINCT FROM avant THEN
    RAISE EXCEPTION 'Q1 : une quantité NULL a réécrit la ligne — % → %', avant, pg_temp.ligne('pull_up');
  END IF;

  -- Q2 · zéro : ni écriture sur une ligne existante, ni ligne créée.
  r := pg_temp.appel('authenticated', 'pull_up', 'reps', 0);
  IF r <> 'ok' OR pg_temp.ligne('pull_up') IS DISTINCT FROM avant THEN
    RAISE EXCEPTION 'Q2a : un crédit nul a écrit — % · % → %', r, avant, pg_temp.ligne('pull_up');
  END IF;
  r := pg_temp.appel('authenticated', 'v_up', 'reps', 0);
  IF r <> 'ok' OR pg_temp.ligne('v_up') IS NOT NULL THEN
    RAISE EXCEPTION 'Q2b : un crédit nul a créé une ligne — % · %', r, pg_temp.ligne('v_up');
  END IF;

  -- Q3 · négatif : refusé en 22003, message complet, cumul intact.
  r := pg_temp.appel('authenticated', 'pull_up', 'reps', -30);
  IF r NOT LIKE '22003|%négative%' OR r NOT LIKE '%-30 reps de pull_up%' THEN
    RAISE EXCEPTION 'Q3 : un crédit négatif n''est pas refusé comme attendu — %', r;
  END IF;
  IF pg_temp.ligne('pull_up') IS DISTINCT FROM avant THEN
    RAISE EXCEPTION 'Q3 : le crédit négatif a modifié le cumul — % → %', avant, pg_temp.ligne('pull_up');
  END IF;

  -- Q4 · charge négative : refusée en 22003, cumul intact.
  r := pg_temp.appel('authenticated', 'pull_up', 'reps', 10, -5);
  IF r NOT LIKE '22003|%charge négative%' THEN
    RAISE EXCEPTION 'Q4 : une charge négative n''est pas refusée — %', r;
  END IF;
  IF pg_temp.ligne('pull_up') IS DISTINCT FROM avant THEN
    RAISE EXCEPTION 'Q4 : l''appel à charge négative a écrit — % → %', avant, pg_temp.ligne('pull_up');
  END IF;

  -- Q5 · charge NULL : le crédit passe, la meilleure charge reste.
  r := pg_temp.appel('authenticated', 'pull_up', 'reps', 10, NULL);
  IF r <> 'ok' THEN RAISE EXCEPTION 'Q5 : crédit sans charge refusé — %', r; END IF;
  IF split_part(pg_temp.ligne('pull_up'), '|', 2) <> '60'
     OR split_part(pg_temp.ligne('pull_up'), '|', 3) <> '20' THEN
    RAISE EXCEPTION 'Q5 : attendu 60 reps et meilleure charge 20 — obtenu %', pg_temp.ligne('pull_up');
  END IF;
END $$;

-- ── G · aucun rôle client ne lit ni n'écrit les plafonds ───────────────────
DO $$
DECLARE v_role text; v_err text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    PERFORM set_config('role', v_role, true);
    v_err := NULL;
    BEGIN
      EXECUTE 'SELECT count(*) FROM public.movement_credit_caps';
    EXCEPTION WHEN others THEN v_err := SQLERRM;
    END;
    IF v_err IS NULL OR v_err NOT LIKE '%permission denied for table%' THEN
      RAISE EXCEPTION 'G1 : % lit les plafonds, ou en est empêché autrement que par le GRANT — %', v_role, v_err;
    END IF;

    v_err := NULL;
    BEGIN
      EXECUTE $u$UPDATE public.movement_credit_caps SET per_call = 999999999$u$;
    EXCEPTION WHEN others THEN v_err := SQLERRM;
    END;
    IF v_err IS NULL OR v_err NOT LIKE '%permission denied for table%' THEN
      RAISE EXCEPTION 'G2 : % peut relever les plafonds — %', v_role, v_err;
    END IF;
    PERFORM set_config('role', 'none', true);
  END LOOP;
END $$;

DO $$ BEGIN RAISE NOTICE 'movement_credit_caps : V01, B, N, S, R, F, E, Q, G OK'; END $$;

ROLLBACK;
