-- ═════════════════════════════════════════════════════════════════════════════
-- get_box_billing renvoie le changement de formule programmé (migration 20270150)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B1 : gérant principal O (…e0, boxes.owner_id), co-gérant CG (…e3, rôle
-- owner), coach C (…e1), membre M1 (…01) avec un changement programmé vers la
-- formule F2 au 01/11/2026, membre M2 (…02) sans changement. Box B2 : gérant
-- O2 (…e4), membre M3 (…03) avec un changement programmé.
--   S1  le gérant principal reçoit scheduled_plan_id et scheduled_change_at
--       (valeurs pour M1, NULL pour M2), les autres colonnes toujours servies ;
--   S2  le co-gérant reçoit la même chose ;
--   S3  coach, simple membre et gérant d'une AUTRE box : refus 42501, comme
--       avant (le coach ne voit ni les colonnes d'argent ni ces deux champs) ;
--       le gérant de B2 ne reçoit que sa box ;
--   S4  anon : pas d'EXECUTE, l'appel est refusé ; PUBLIC n'a rien ;
--       authenticated et service_role ont EXECUTE ;
--   S5  signature : les deux champs en fin de retour, avec leurs types ;
--       commentaire du lot 6 conservé ;
--   S6  empreinte : md5 de la définition épinglé (celui que l'application en
--       prod doit retrouver) ;
--   M   mutations : chaque contrôle échoue quand on retire ce qu'il prouve ;
--   R   retour arrière (supabase/retours/…) : définition, droits et
--       commentaire d'avant (md5 c96d2dc554cdc4e3e240f526a38ecb98).
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> get_box_billing : changement de formule programmé'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9cc-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', 'e1', 'e3', 'e4', '01', '02', '03']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9cc-0000000000' || s)::uuid, 'gbc-' || s || '@test.invalid', 'gbc_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e3', 'e4', '01', '02', '03']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9cc-000000000001', 'Box changement 1', 'GBC1', '00000000-0000-4000-a9cc-0000000000e0'),
  ('00000000-0000-4000-b9cc-000000000002', 'Box changement 2', 'GBC2', '00000000-0000-4000-a9cc-0000000000e4');
INSERT INTO public.membership_plans (id, box_id, name, price_cents, plan_type, is_active) VALUES
  ('00000000-0000-4000-c9cc-0000000000f1', '00000000-0000-4000-b9cc-000000000001', 'Mensuel', 4900, 'subscription', true),
  ('00000000-0000-4000-c9cc-0000000000f2', '00000000-0000-4000-b9cc-000000000001', '3 séances', 3500, 'subscription', true),
  ('00000000-0000-4000-c9cc-0000000000f3', '00000000-0000-4000-b9cc-000000000002', 'Autre', 3000, 'subscription', true);
INSERT INTO public.box_members (box_id, member_id, role, status, plan_id, subscription_status, payment_method_type,
                                stripe_subscription_id, scheduled_plan_id, scheduled_change_at, stripe_schedule_id)
SELECT ('00000000-0000-4000-b9cc-00000000000' || b)::uuid, ('00000000-0000-4000-a9cc-0000000000' || m)::uuid,
       r, 'active', pl::uuid, ss, pmt, sub, sp::uuid, sa::timestamptz, sch
  FROM (VALUES
    ('1', 'e0', 'owner',  NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('1', 'e3', 'owner',  NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('1', 'e1', 'coach',  NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('1', '01', 'member', '00000000-0000-4000-c9cc-0000000000f1', 'active', 'card', 'sub_gbc_01',
                          '00000000-0000-4000-c9cc-0000000000f2', '2026-11-01 09:00:00+00', 'sub_sched_gbc_01'),
    ('1', '02', 'member', '00000000-0000-4000-c9cc-0000000000f1', 'active', 'sepa_debit', 'sub_gbc_02', NULL, NULL, NULL),
    ('2', 'e4', 'owner',  NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('2', '03', 'member', '00000000-0000-4000-c9cc-0000000000f3', 'active', 'card', 'sub_gbc_03',
                          '00000000-0000-4000-c9cc-0000000000f3', '2026-12-01 09:00:00+00', 'sub_sched_gbc_03')
  ) v(b, m, r, pl, ss, pmt, sub, sp, sa, sch);

CREATE FUNCTION pg_temp.def(f text) RETURNS text LANGUAGE sql AS $$ SELECT pg_get_functiondef(f::regprocedure) $$;
-- Rejoue `f` avec un remplacement dans sa définition ; échoue s'il ne change rien.
CREATE FUNCTION pg_temp.muter(f text, de text, vers text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text := pg_temp.def(f);
BEGIN
  IF strpos(d, de) = 0 THEN RAISE EXCEPTION 'mutation sans effet sur % : « % » absent', f, de; END IF;
  EXECUTE replace(d, de, vers);
END $$;

-- Ce que `p_qui` (suffixe, ou 'anon') lit de get_box_billing(box `p_b`), comme
-- le vrai client (rôle + auth.uid()) : une ligne par membre non staff,
-- « membre:formule programmée:date (UTC):moyen de paiement », ou le SQLSTATE.
CREATE FUNCTION pg_temp.voit(p_qui text, p_b text DEFAULT '1') RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',
    CASE WHEN p_qui = 'anon' THEN '' ELSE '00000000-0000-4000-a9cc-0000000000' || p_qui END, true);
  PERFORM set_config('request.jwt.claim.role', CASE p_qui WHEN 'anon' THEN 'anon' ELSE 'authenticated' END, true);
  PERFORM set_config('role', CASE p_qui WHEN 'anon' THEN 'anon' ELSE 'authenticated' END, true);
  BEGIN
    SELECT coalesce(string_agg(
             right(b.member_id::text, 2) || ':' || coalesce(right(b.scheduled_plan_id::text, 2), '-') || ':'
             || coalesce(to_char(b.scheduled_change_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '-') || ':'
             || coalesce(b.payment_method_type, '-'),
             ' ' ORDER BY b.member_id), 'vide')
      INTO v
      FROM public.get_box_billing(('00000000-0000-4000-b9cc-00000000000' || p_b)::uuid) b
     WHERE b.role = 'member';
  EXCEPTION WHEN OTHERS THEN v := 'refus ' || SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;

DO $t$
DECLARE
  ATTENDU constant text := '01:f2:2026-11-01:card 02:-:-:sepa_debit';
  F constant text := 'public.get_box_billing(uuid)';
  v text;
  v_qui text;
  v_def text;
BEGIN
  -- S1, S2 : gérant principal et co-gérant.
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e3'] LOOP
    v := pg_temp.voit(v_qui);
    IF v IS DISTINCT FROM ATTENDU THEN
      RAISE EXCEPTION 'S1/S2 : % ne lit pas le changement programmé (obtenu : %)', v_qui, v;
    END IF;
  END LOOP;

  -- S3 : coach, simple membre, gérant d'une autre box → 42501 ; ce dernier ne lit que sa box.
  FOREACH v_qui IN ARRAY ARRAY['e1', '01', 'e4'] LOOP
    v := pg_temp.voit(v_qui);
    IF v IS DISTINCT FROM 'refus 42501' THEN
      RAISE EXCEPTION 'S3 : % n''est pas refusé en 42501 (obtenu : %)', v_qui, v;
    END IF;
  END LOOP;
  IF pg_temp.voit('e4', '2') IS DISTINCT FROM '03:f3:2026-12-01:card' THEN
    RAISE EXCEPTION 'S3 : le gérant de B2 ne lit pas sa propre box (%)', pg_temp.voit('e4', '2');
  END IF;

  -- S4 : anon, PUBLIC, authenticated, service_role.
  IF pg_temp.voit('anon') IS DISTINCT FROM 'refus 42501' THEN
    RAISE EXCEPTION 'S4 : anon n''est pas refusé (obtenu : %)', pg_temp.voit('anon');
  END IF;
  IF has_function_privilege('anon', F, 'EXECUTE') THEN RAISE EXCEPTION 'S4 : anon a EXECUTE'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = F::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'S4 : PUBLIC a EXECUTE';
  END IF;
  IF NOT has_function_privilege('authenticated', F, 'EXECUTE') OR NOT has_function_privilege('service_role', F, 'EXECUTE') THEN
    RAISE EXCEPTION 'S4 : authenticated ou service_role a perdu EXECUTE';
  END IF;

  -- S5 : signature et commentaire.
  IF pg_get_function_result(F::regprocedure) NOT LIKE '%, payment_method_type text, scheduled_plan_id uuid, scheduled_change_at timestamp with time zone)' THEN
    RAISE EXCEPTION 'S5 : retour inattendu : %', pg_get_function_result(F::regprocedure);
  END IF;
  IF obj_description(F::regprocedure, 'pg_proc') IS DISTINCT FROM
     'Lot 6 : « qui paie quoi », nominatif, réservé au gérant et au co-gérant. Le coach en est exclu — il programme, il n''encaisse pas.' THEN
    RAISE EXCEPTION 'S5 : commentaire perdu ou modifié';
  END IF;

  -- S6 : empreinte.
  IF md5(pg_temp.def(F)) <> 'a8ff6b799b42aa9b1af318a46b31fa2d' THEN
    RAISE EXCEPTION 'S6 : la définition de get_box_billing n''est plus celle de 20270150 (md5 %)', md5(pg_temp.def(F));
  END IF;

  -- ── M : mutations ─────────────────────────────────────────────────────────
  v_def := pg_temp.def(F);
  -- S1/S2 : sans l'un des deux champs, la lecture du gérant change.
  PERFORM pg_temp.muter(F, 'bm.scheduled_plan_id, bm.scheduled_change_at', 'NULL::uuid, bm.scheduled_change_at');
  IF pg_temp.voit('e0') = ATTENDU THEN RAISE EXCEPTION 'M : scheduled_plan_id retiré, S1 ne le voit pas'; END IF;
  EXECUTE v_def;
  PERFORM pg_temp.muter(F, 'bm.scheduled_plan_id, bm.scheduled_change_at', 'bm.scheduled_plan_id, NULL::timestamptz');
  IF pg_temp.voit('e3') = ATTENDU THEN RAISE EXCEPTION 'M : scheduled_change_at retiré, S2 ne le voit pas'; END IF;
  EXECUTE v_def;
  -- S3 : sans la garde, le coach lit.
  PERFORM pg_temp.muter(F, 'IF NOT public.is_box_owner_admin(p_box_id) THEN', 'IF false THEN');
  IF pg_temp.voit('e1') = 'refus 42501' THEN RAISE EXCEPTION 'M : garde retirée, coach encore refusé : S3 ne prouve rien'; END IF;
  EXECUTE v_def;
  -- S3 : sans le filtre de box, le gérant de B2 lirait aussi B1 (sa propre lecture change).
  PERFORM pg_temp.muter(F, 'WHERE bm.box_id = p_box_id', 'WHERE true');
  IF pg_temp.voit('e4', '2') = '03:f3:2026-12-01:card' THEN RAISE EXCEPTION 'M : filtre de box retiré, S3 ne le voit pas'; END IF;
  EXECUTE v_def;
  -- S4 : EXECUTE rendu à anon, il n'est plus refusé en 42501 par les droits.
  GRANT EXECUTE ON FUNCTION public.get_box_billing(uuid) TO anon;
  IF NOT has_function_privilege('anon', F, 'EXECUTE') THEN RAISE EXCEPTION 'M : S4 ne voit pas EXECUTE pour anon'; END IF;
  REVOKE EXECUTE ON FUNCTION public.get_box_billing(uuid) FROM anon;
  -- S6 : toute réécriture change l'empreinte.
  PERFORM pg_temp.muter(F, 'STABLE SECURITY DEFINER', 'VOLATILE SECURITY DEFINER');
  IF md5(pg_temp.def(F)) = md5(v_def) THEN RAISE EXCEPTION 'M : S6 ne voit pas une réécriture'; END IF;
  EXECUTE v_def;
  IF md5(pg_temp.def(F)) <> md5(v_def) THEN RAISE EXCEPTION 'M : définition non rétablie après les mutations'; END IF;
END $t$;

-- ── R : retour arrière ────────────────────────────────────────────────────────
\i supabase/retours/20270150000000_get_box_billing_changement_programme.sql
DO $t$
DECLARE F constant text := 'public.get_box_billing(uuid)';
BEGIN
  IF md5(pg_temp.def(F)) <> 'c96d2dc554cdc4e3e240f526a38ecb98' THEN
    RAISE EXCEPTION 'R : définition d''avant non rétablie (md5 %)', md5(pg_temp.def(F));
  END IF;
  IF has_function_privilege('anon', F, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', F, 'EXECUTE')
     OR NOT has_function_privilege('service_role', F, 'EXECUTE')
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = F::regprocedure AND a.grantee = 0)
     OR obj_description(F::regprocedure, 'pg_proc') IS DISTINCT FROM
        'Lot 6 : « qui paie quoi », nominatif, réservé au gérant et au co-gérant. Le coach en est exclu — il programme, il n''encaisse pas.' THEN
    RAISE EXCEPTION 'R : droits ou commentaire de get_box_billing';
  END IF;
  IF pg_get_function_result(F::regprocedure) LIKE '%scheduled%' THEN
    RAISE EXCEPTION 'R : les champs scheduled_* sont encore servis';
  END IF;
END $t$;

ROLLBACK;
\echo '    S1 à S6, M et R OK'
