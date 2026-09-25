-- ═════════════════════════════════════════════════════════════════════════════
-- get_box_billing renvoie le moyen de paiement (migration 20270122)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B1, gérant O1 (…e0), coach C1 (…e1), membres M1 (card), M2 (sepa_debit),
-- M3 (NULL, comptoir) ; X1 (…e2), membre d'aucune box.
--   G1  le gérant reçoit payment_method_type : card, sepa_debit et NULL, et
--       les autres colonnes sont toujours servies ;
--   G2  un non-gérant (coach de la box, simple membre, utilisateur d'une autre
--       box) est refusé en 42501 ;
--   G3  droits : anon et PUBLIC n'ont pas EXECUTE ; authenticated et
--       service_role l'ont (les droits d'avant le DROP) ;
--   G4  le commentaire du lot 6 est conservé ;
--   G5  le corps est épinglé (md5 de la définition) : une réécriture repartie
--       d'une autre version que celle de la prod — la baseline par exemple —
--       fait rougir la CI. À mettre à jour, en connaissance de cause, par la
--       prochaine migration qui redéfinit la fonction.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> get_box_billing : moyen de paiement'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9bb-0000000000' || s)::uuid
  FROM unnest(ARRAY['e0', 'e1', 'e2', '01', '02', '03']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9bb-0000000000' || s)::uuid, 'gbb-' || s || '@test.invalid', 'gbb_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', '01', '02', '03']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9bb-000000000001', 'Box facturation', 'GBB1', '00000000-0000-4000-a9bb-0000000000e0');
INSERT INTO public.box_members (box_id, member_id, role, status, subscription_status, payment_method_type, stripe_subscription_id)
SELECT '00000000-0000-4000-b9bb-000000000001', ('00000000-0000-4000-a9bb-0000000000' || m)::uuid,
       r, 'active', ss, pmt, sub
  FROM (VALUES
    ('e0', 'owner',  NULL,     NULL,         NULL),
    ('e1', 'coach',  NULL,     NULL,         NULL),
    ('01', 'member', 'active', 'card',       'sub_gbb_01'),
    ('02', 'member', 'active', 'sepa_debit', 'sub_gbb_02'),
    ('03', 'member', 'active', NULL,         NULL)
  ) v(m, r, ss, pmt, sub);

-- Appel comme le vrai client : rôle authenticated + auth.uid().
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9bb-0000000000' || p_qui, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

DO $t$
DECLARE
  v_n int;
  v_sqlstate text;
  v_qui text;
BEGIN
  -- G1 : le gérant reçoit la colonne, avec la bonne valeur par membre.
  PERFORM pg_temp.en_tant_que('e0');
  SELECT count(*) INTO v_n
    FROM public.get_box_billing('00000000-0000-4000-b9bb-000000000001') b
   WHERE (b.member_id = '00000000-0000-4000-a9bb-000000000001' AND b.payment_method_type = 'card'
          AND b.has_stripe_sub AND b.subscription_status = 'active' AND b.role = 'member')
      OR (b.member_id = '00000000-0000-4000-a9bb-000000000002' AND b.payment_method_type = 'sepa_debit'
          AND b.has_stripe_sub)
      OR (b.member_id = '00000000-0000-4000-a9bb-000000000003' AND b.payment_method_type IS NULL
          AND NOT b.has_stripe_sub);
  PERFORM set_config('role', 'none', true);
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'G1 : le gérant ne reçoit pas card / sepa_debit / NULL (% ligne(s) conforme(s) sur 3)', v_n;
  END IF;

  -- G2 : coach, simple membre, utilisateur hors box → 42501.
  FOREACH v_qui IN ARRAY ARRAY['e1', '01', 'e2'] LOOP
    v_sqlstate := NULL;
    PERFORM pg_temp.en_tant_que(v_qui);
    BEGIN
      PERFORM * FROM public.get_box_billing('00000000-0000-4000-b9bb-000000000001');
    EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
    END;
    PERFORM set_config('role', 'none', true);
    IF v_sqlstate IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'G2 : % n''est pas refusé en 42501 (obtenu : %)', v_qui, coalesce(v_sqlstate, 'aucune erreur');
    END IF;
  END LOOP;

  -- G3 : droits.
  IF has_function_privilege('anon', 'public.get_box_billing(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'G3 : anon a EXECUTE sur get_box_billing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
              WHERE p.oid = 'public.get_box_billing(uuid)'::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'G3 : PUBLIC a EXECUTE sur get_box_billing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_box_billing(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_box_billing(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'G3 : authenticated ou service_role a perdu EXECUTE sur get_box_billing';
  END IF;

  -- G4 : commentaire conservé.
  IF obj_description('public.get_box_billing(uuid)'::regprocedure, 'pg_proc') IS DISTINCT FROM
     'Lot 6 : « qui paie quoi », nominatif, réservé au gérant et au co-gérant. Le coach en est exclu — il programme, il n''encaisse pas.' THEN
    RAISE EXCEPTION 'G4 : commentaire de get_box_billing perdu ou modifié';
  END IF;

  -- G5 : corps épinglé.
  IF md5(pg_get_functiondef('public.get_box_billing(uuid)'::regprocedure)) <> 'c96d2dc554cdc4e3e240f526a38ecb98' THEN
    RAISE EXCEPTION 'G5 : la définition de get_box_billing n''est plus celle de 20270122 (md5 %)',
      md5(pg_get_functiondef('public.get_box_billing(uuid)'::regprocedure));
  END IF;
END $t$;

ROLLBACK;
\echo '    G1 à G5 OK'
