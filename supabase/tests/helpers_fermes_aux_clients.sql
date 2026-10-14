-- ═════════════════════════════════════════════════════════════════════════════
-- Argent — K1 (#552) : les helpers « _* » de public sont fermés aux clients,
-- et les fonctions créées ensuite ne naissent plus ouvertes.
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Tout se joue dans UNE transaction annulée.
--
-- Par de vrais appels, sous chaque rôle (SET LOCAL ROLE), pas seulement par le
-- catalogue : c'est l'appel d'un compte connecté qui posait le droit payant.
--   H1  _upsert_program_member : anon et authenticated → 42501 ; service_role
--       → l'appel passe et écrit l'adhésion (contre-exemple : la fermeture ne
--       casse pas le chemin serveur).
--   H2  _log_box_cash_payment : anon, authenticated ET service_role → 42501,
--       comme depuis 20270151.
--   H3  _daily_official_template : anon et authenticated → 42501.
--   H4  une fonction créée par postgres dans public naît fermée à anon et
--       authenticated (20270154), ouverte à service_role.
--   H5  idem pour une fonction créée par supabase_admin (20270155).
--   R   retour arrière (supabase/retours/2027015[45]…) : authenticated retrouve
--       l'EXECUTE et les défauts se rouvrent — puis tout est annulé.
-- Le refus est attendu AVANT l'évaluation du corps : les arguments NULL
-- suffisent, un 42501 ne peut pas venir d'une garde interne.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

BEGIN;

-- Appel sous un rôle : 'ok' ou le SQLSTATE de l'échec.
CREATE FUNCTION pg_temp.appel(p_role text, p_sql text) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN SQLSTATE;
  END;
  RESET ROLE;
  RETURN 'ok';
END $$;

-- Décor minimal, celui de scripts/test-programme-relatif.sh.
INSERT INTO auth.users (id, email) VALUES ('5f520000-0000-4000-8000-000000000002', 'k1@test.local');
INSERT INTO public.profiles (id, username, email) VALUES ('5f520000-0000-4000-8000-000000000002', 'k1', 'k1@test.local');
INSERT INTO public.boxes (id, name, owner_id, invite_code)
VALUES ('5f520000-0000-4000-8000-000000000001', 'Box K1', '5f520000-0000-4000-8000-000000000002', 'K1HELPER');
INSERT INTO public.programs (id, box_id, owner_id, title, type, price_cents, invite_code)
VALUES ('5f520000-0000-4000-8000-000000000004', '5f520000-0000-4000-8000-000000000001',
        '5f520000-0000-4000-8000-000000000002', 'P', 'ongoing', 1000, 'PK1HELPR');

DO $$
DECLARE
  c_upsert text := $q$SELECT public._upsert_program_member('5f520000-0000-4000-8000-000000000004',
                      '5f520000-0000-4000-8000-000000000002', NULL, 'staff')$q$;
  c_log    text := 'SELECT public._log_box_cash_payment(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)';
  c_tpl    text := 'SELECT public._daily_official_template(current_date)';
  r text;
  v text;
BEGIN
  -- ── H1 ─────────────────────────────────────────────────────────────────────
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    v := pg_temp.appel(r, c_upsert);
    IF v <> '42501' THEN
      RAISE EXCEPTION 'H1 : % appelle _upsert_program_member (%, 42501 attendu)', r, v
        USING HINT = 'Un compte connecté s''inscrit à un programme payant sans paiement. Rejoue 20270154.';
    END IF;
  END LOOP;
  v := pg_temp.appel('service_role', c_upsert);
  IF v <> 'ok' OR NOT EXISTS (SELECT 1 FROM public.program_members
                               WHERE program_id = '5f520000-0000-4000-8000-000000000004'
                                 AND user_id = '5f520000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'H1 : service_role n''inscrit plus par _upsert_program_member (%)', v;
  END IF;

  -- ── H2 ─────────────────────────────────────────────────────────────────────
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    v := pg_temp.appel(r, c_log);
    IF v <> '42501' THEN
      RAISE EXCEPTION 'H2 : % appelle _log_box_cash_payment (%, 42501 attendu)', r, v
        USING HINT = 'Le journal des encaissements ne s''écrit que par les RPC du gérant (20270151, 20270154).';
    END IF;
  END LOOP;

  -- ── H3 ─────────────────────────────────────────────────────────────────────
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    v := pg_temp.appel(r, c_tpl);
    IF v <> '42501' THEN
      RAISE EXCEPTION 'H3 : % appelle _daily_official_template (%, 42501 attendu)', r, v;
    END IF;
  END LOOP;

  RAISE NOTICE 'helpers_fermes_aux_clients : H1, H2, H3 OK';
END $$;

-- ── H4 / H5 : ce qui naîtra demain ───────────────────────────────────────────
SET LOCAL ROLE postgres;
CREATE FUNCTION public.k1_sonde_postgres() RETURNS int LANGUAGE sql AS 'SELECT 1';
RESET ROLE;
SET LOCAL ROLE supabase_admin;
CREATE FUNCTION public.k1_sonde_supabase_admin() RETURNS int LANGUAGE sql AS 'SELECT 1';
RESET ROLE;

DO $$
DECLARE f text; r text; v text;
BEGIN
  FOREACH f IN ARRAY ARRAY['k1_sonde_postgres', 'k1_sonde_supabase_admin'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      v := pg_temp.appel(r, format('SELECT public.%I()', f));
      IF v <> '42501' THEN
        RAISE EXCEPTION '% : une fonction neuve (%) naît exécutable par % (%)',
          CASE f WHEN 'k1_sonde_postgres' THEN 'H4' ELSE 'H5' END, f, r, v
          USING HINT = 'Privilèges par défaut de public rouverts : rejoue 20270154 / 20270155.';
      END IF;
    END LOOP;
    -- Contre-exemple : la sonde est bien appelable par le serveur.
    IF pg_temp.appel('service_role', format('SELECT public.%I()', f)) <> 'ok' THEN
      RAISE EXCEPTION 'H4/H5 : service_role n''appelle pas %, la sonde ne mesure rien', f;
    END IF;
  END LOOP;
  RAISE NOTICE 'helpers_fermes_aux_clients : H4, H5 OK';
END $$;

-- ── R : le retour arrière rouvre exactement ce qu'il doit ────────────────────
\i supabase/retours/20270155000000_defauts_supabase_admin_fermes.sql
\i supabase/retours/20270154000000_helpers_fermes_aux_clients.sql

SET LOCAL ROLE postgres;
CREATE FUNCTION public.k1_sonde_retour() RETURNS int LANGUAGE sql AS 'SELECT 1';
RESET ROLE;

DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public._upsert_program_member(uuid,uuid,date,text,integer,integer,text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public._daily_official_template(date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._upsert_program_member(uuid,uuid,date,text,integer,integer,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._log_box_cash_payment(uuid,uuid,uuid,uuid,text,integer,date,date,uuid,integer,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.k1_sonde_retour()', 'EXECUTE') THEN
    RAISE EXCEPTION 'R : le retour arrière ne rétablit pas l''état d''avant 20270154';
  END IF;
  RAISE NOTICE 'helpers_fermes_aux_clients : R OK';
END $$;

ROLLBACK;
