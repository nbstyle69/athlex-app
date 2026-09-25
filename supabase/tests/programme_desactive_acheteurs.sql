-- ═════════════════════════════════════════════════════════════════════════════
-- Programme désactivé : ses acheteurs actifs le lisent encore (migration 20270123)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B, gérant O (…e0), super-admin S (…e9). Programmes de B : P1 désactivé,
-- P2 désactivé (acheté par U2 seulement), P3 actif. Inscriptions à P1 :
-- A1 active, A2 cancelled, A3 expired, A4 refunded, A5 pending ; N n'a rien.
--   P1  A1 lit P1, et la jointure du Whiteboard program_members → programs
--       le renvoie ;
--   P2  A2 à A5 (cancelled, expired, refunded, pending) ne lisent pas P1 ;
--   P3  N (non-acheteur) ne lit pas P1 ;
--   P4  la fonction, appelée par A1 avec l'id de P2 (programme d'un autre
--       acheteur), renvoie faux — et vrai pour P1 ;
--   P5  anon lit exactement les programmes actifs, comme avant, et n'a pas
--       EXECUTE sur la fonction (PUBLIC non plus) ;
--   P6  gérant, super-admin et utilisateur connecté quelconque lisent les
--       programmes exactement comme avant, sans erreur de récursion ;
--   P7  les règles de programs et de program_members sont figées (md5 de leur
--       définition, la nouvelle comprise).
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Programme désactivé : lecture par ses acheteurs actifs'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9dd-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', 'e9', '01', '02', '03', '04', '05', '06', '07']) s;
INSERT INTO public.profiles (id, email, username, role)
SELECT ('00000000-0000-4000-a9dd-0000000000' || s)::uuid, 'pda-' || s || '@test.invalid', 'pda_' || s,
       CASE WHEN s = 'e9' THEN 'super_admin' ELSE 'athlete' END
  FROM unnest(ARRAY['e0', 'e9', '01', '02', '03', '04', '05', '06', '07']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9dd-000000000001', 'Box programmes', 'PDA1', '00000000-0000-4000-a9dd-0000000000e0');
INSERT INTO public.programs (id, box_id, title, price_cents, type, invite_code, is_active) VALUES
  ('00000000-0000-4000-c9dd-000000000001', '00000000-0000-4000-b9dd-000000000001', 'P1 désactivé', 2900, 'ongoing', 'PDAP01', false),
  ('00000000-0000-4000-c9dd-000000000002', '00000000-0000-4000-b9dd-000000000001', 'P2 désactivé', 2900, 'ongoing', 'PDAP02', false),
  ('00000000-0000-4000-c9dd-000000000003', '00000000-0000-4000-b9dd-000000000001', 'P3 actif',     2900, 'ongoing', 'PDAP03', true);
-- A1..A5 sur P1 (…01 à …05) ; U2 (…07) sur P2 ; N (…06) sans inscription.
INSERT INTO public.program_members (program_id, user_id, status, provenance)
SELECT ('00000000-0000-4000-c9dd-00000000000' || p)::uuid, ('00000000-0000-4000-a9dd-0000000000' || u)::uuid, st, 'staff'
  FROM (VALUES ('1', '01', 'active'), ('1', '02', 'cancelled'), ('1', '03', 'expired'),
               ('1', '04', 'refunded'), ('1', '05', 'pending'), ('2', '07', 'active')) v(p, u, st);

CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_qui IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);
    PERFORM set_config('role', 'anon', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9dd-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
END $$;

DO $t$
DECLARE
  v_n int;
  v_qui text;
  v_lus text;
  v_actifs text;
  v_box text;
  v_tous text;
  v_attendu text;
  v_etat text;
  P1 constant uuid := '00000000-0000-4000-c9dd-000000000001';
  P2 constant uuid := '00000000-0000-4000-c9dd-000000000002';
BEGIN
  -- Attendus « comme avant », calculés sans RLS.
  SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_actifs FROM public.programs WHERE is_active;
  SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_box FROM public.programs
   WHERE is_active OR box_id = '00000000-0000-4000-b9dd-000000000001';
  SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_tous FROM public.programs;

  -- P1 : l'acheteur actif lit P1, directement et par la jointure du Whiteboard.
  PERFORM pg_temp.en_tant_que('01');
  BEGIN
    SELECT count(*) INTO v_n FROM public.programs WHERE id = P1;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'none', true);
    RAISE EXCEPTION 'P1 : la lecture de programs par l''acheteur échoue : %', SQLERRM;
  END;
  IF v_n <> 1 THEN PERFORM set_config('role', 'none', true); RAISE EXCEPTION 'P1 : l''acheteur actif ne lit pas le programme désactivé'; END IF;
  SELECT count(*) INTO v_n FROM public.program_members pm JOIN public.programs p ON p.id = pm.program_id
   WHERE pm.user_id = auth.uid() AND pm.status = 'active' AND p.id = P1 AND p.title = 'P1 désactivé';
  PERFORM set_config('role', 'none', true);
  IF v_n <> 1 THEN RAISE EXCEPTION 'P1 : la jointure program_members → programs ne renvoie pas le programme'; END IF;

  -- P3 : le non-acheteur ne lit pas P1.
  PERFORM pg_temp.en_tant_que('06');
  SELECT count(*) INTO v_n FROM public.programs WHERE id = P1;
  PERFORM set_config('role', 'none', true);
  IF v_n <> 0 THEN RAISE EXCEPTION 'P3 : un non-acheteur lit le programme désactivé'; END IF;

  -- P2 : cancelled, expired, refunded, pending ne lisent pas P1.
  FOREACH v_qui IN ARRAY ARRAY['02', '03', '04', '05'] LOOP
    PERFORM pg_temp.en_tant_que(v_qui);
    SELECT count(*) INTO v_n FROM public.programs WHERE id = P1;
    PERFORM set_config('role', 'none', true);
    IF v_n <> 0 THEN RAISE EXCEPTION 'P2 : l''acheteur % (statut non actif) lit le programme désactivé', v_qui; END IF;
  END LOOP;

  -- P4 : la fonction ne répond que pour l'appelant.
  PERFORM pg_temp.en_tant_que('01');
  IF public.program_in_my_active_membership(P2) OR NOT public.program_in_my_active_membership(P1) THEN
    PERFORM set_config('role', 'none', true);
    RAISE EXCEPTION 'P4 : program_in_my_active_membership ne répond pas pour l''appelant seul';
  END IF;
  PERFORM set_config('role', 'none', true);

  -- P5 : anon, comme avant ; pas d'EXECUTE pour anon ni PUBLIC.
  v_etat := NULL;
  PERFORM pg_temp.en_tant_que(NULL);
  BEGIN
    SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_lus FROM public.programs;
  EXCEPTION WHEN OTHERS THEN v_etat := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  IF v_etat IS NOT NULL THEN RAISE EXCEPTION 'P5 : la lecture de programs par anon échoue : %', v_etat; END IF;
  IF v_lus <> v_actifs THEN RAISE EXCEPTION 'P5 : anon ne lit plus exactement les programmes actifs'; END IF;
  IF has_function_privilege('anon', 'public.program_in_my_active_membership(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'P5 : anon a EXECUTE sur program_in_my_active_membership';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = 'public.program_in_my_active_membership(uuid)'::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'P5 : PUBLIC a EXECUTE sur program_in_my_active_membership';
  END IF;

  -- P6 : gérant, super-admin, utilisateur quelconque : comme avant, sans erreur.
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e9', '06', '01'] LOOP
    v_etat := NULL;
    PERFORM pg_temp.en_tant_que(v_qui);
    BEGIN
      SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_lus FROM public.programs;
    EXCEPTION WHEN OTHERS THEN v_etat := SQLERRM;
    END;
    PERFORM set_config('role', 'none', true);
    IF v_etat IS NOT NULL THEN RAISE EXCEPTION 'P6 : la lecture de programs par % échoue : %', v_qui, v_etat; END IF;
    v_attendu := CASE v_qui WHEN 'e0' THEN v_box
                            WHEN 'e9' THEN v_tous
                            WHEN '06' THEN v_actifs
                            ELSE (SELECT string_agg(x, ',' ORDER BY x)
                                    FROM unnest(string_to_array(v_actifs, ',') || P1::text) x WHERE x <> '')
                 END;
    IF v_lus IS DISTINCT FROM v_attendu THEN
      RAISE EXCEPTION 'P6 : % ne lit pas les programmes attendus', v_qui;
    END IF;
  END LOOP;

  -- P7 : règles de programs et de program_members figées. Le texte d'une règle
  -- dépend du search_path de la session (`auth.uid()` s'affiche `uid()` si
  -- `auth` y figure) : il est fixé, comme en prod.
  PERFORM set_config('search_path', 'public', true);
  SELECT md5(string_agg(concat_ws('|', tablename, policyname, permissive, roles::text, cmd, qual, with_check), E'\n'
                        ORDER BY tablename, policyname))
    INTO v_etat FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('programs', 'program_members');
  IF v_etat <> 'cc9cf5dd1877d359757611be3a5f7a8b' THEN
    RAISE EXCEPTION 'P7 : les règles de programs / program_members ont changé (md5 %)', v_etat;
  END IF;
END $t$;

ROLLBACK;
\echo '    P1 à P7 OK'
