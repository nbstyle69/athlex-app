-- ═════════════════════════════════════════════════════════════════════════════
-- Le rôle co-gérant réservé au gérant principal (migration 20270139)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Box B : gérant principal G (…e0, owner_id, avec sa ligne `owner` comme en
-- prod), co-gérants C1 (…e1) et C2 (…e3), coach K (…e2), membres M1 (…10),
-- M2 (…11). Box B2 : C1 et C2 y sont aussi co-gérants ; box B3 : C1 seul
-- (déplacement d'une ligne de co-gérant vers une autre box).
--   G0  structure : déclencheur BEFORE INSERT OR UPDATE OR DELETE, ligne par
--       ligne, sur toutes les colonnes ; fonction fermée aux clients ;
--   G1  règles réelles : C1 refusé (42501, MEMBRE_ROLE_COGERANT_RESERVE) pour
--       promouvoir M1, rétrograder C2 (membre, coach), bannir ou désactiver
--       C2, insérer un co-gérant, supprimer la ligne de C2, la déplacer vers
--       une autre personne ou une autre box, rétrograder la ligne de G ;
--       rien n'a bougé ;
--   G2  règle d'écriture ouverte à tous (dans la transaction) : C1, K et M1
--       refusés sur les mêmes gestes ; M1 ne se promeut pas ; rien n'a bougé ;
--   G3  C1 gère les rôles member ↔ coach ; il renonce à son propre rôle (vers
--       coach), ne se le redonne pas, et quitte la box ;
--   G4  gérant principal : parcours du Manager « nommer un co-gérant »
--       (rétrogradation de l'actuel, puis promotion), insertion d'un
--       co-gérant, suppression de la ligne d'un co-gérant, bannissement ;
--   G5  clé serveur : promotion et suppression ; réécriture à l'identique par
--       C1 acceptée ; autres colonnes de la ligne d'un co-gérant libres ;
--   G6  mutation : déclencheur désactivé, la promotion par C1 passe (le refus
--       de G1 vient bien de la garde).
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Rôle co-gérant réservé au gérant principal'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9c3-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', '10', '11', '20', '21']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9c3-0000000000' || s)::uuid, 'bgc-' || s || '@test.invalid', 'bgc_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', '10', '11', '20', '21']) s;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b9c3-000000000001', 'Box co-gérance', 'BGC1', '00000000-0000-4000-a9c3-0000000000e0'),
  ('00000000-0000-4000-b9c3-000000000002', 'Box co-gérance 2', 'BGC2', '00000000-0000-4000-a9c3-000000000021'),
  ('00000000-0000-4000-b9c3-000000000003', 'Box co-gérance 3', 'BGC3', '00000000-0000-4000-a9c3-000000000021');
INSERT INTO public.box_members (id, box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-f9c3-0000000000e0', '00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-a9c3-0000000000e0', 'owner',  'active'),
  ('00000000-0000-4000-f9c3-0000000000e1', '00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-a9c3-0000000000e1', 'owner',  'active'),
  ('00000000-0000-4000-f9c3-0000000000e3', '00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-a9c3-0000000000e3', 'owner',  'active'),
  ('00000000-0000-4000-f9c3-0000000000e2', '00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-a9c3-0000000000e2', 'coach',  'active'),
  ('00000000-0000-4000-f9c3-000000000010', '00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-a9c3-000000000010', 'member', 'active'),
  ('00000000-0000-4000-f9c3-000000000011', '00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-a9c3-000000000011', 'member', 'active'),
  ('00000000-0000-4000-f9c3-0000000002e1', '00000000-0000-4000-b9c3-000000000002', '00000000-0000-4000-a9c3-0000000000e1', 'owner',  'active'),
  ('00000000-0000-4000-f9c3-0000000002e3', '00000000-0000-4000-b9c3-000000000002', '00000000-0000-4000-a9c3-0000000000e3', 'owner',  'active'),
  ('00000000-0000-4000-f9c3-0000000003e1', '00000000-0000-4000-b9c3-000000000003', '00000000-0000-4000-a9c3-0000000000e1', 'owner',  'active');

-- Exécute `p_sql` sous l'identité `p_qui` (…e0, …e1, …e2, …10 ou « service ») ;
-- rend le résultat, ou « SQLSTATE: message ».
CREATE FUNCTION pg_temp.faire(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  IF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9c3-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  BEGIN
    EXECUTE p_sql INTO v;
    v := coalesce(v, 'OK');
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ': ' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  RETURN v;
END $$;

-- L'état qui compte : (ligne, box, membre, rôle, statut) de toutes les lignes des deux box.
CREATE FUNCTION pg_temp.etat() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(concat_ws(':', id, box_id, member_id, role, status), ',' ORDER BY id)
    FROM public.box_members
   WHERE box_id IN ('00000000-0000-4000-b9c3-000000000001', '00000000-0000-4000-b9c3-000000000002', '00000000-0000-4000-b9c3-000000000003');
$$;

DO $t$
DECLARE
  B  constant text := '00000000-0000-4000-b9c3-000000000001';
  B2 constant text := '00000000-0000-4000-b9c3-000000000002';
  REFUS constant text := '42501: MEMBRE_ROLE_COGERANT_RESERVE:%';
  MAJ constant text := 'WITH m AS (UPDATE public.box_members SET %s WHERE id = ''00000000-0000-4000-f9c3-0000000000%s'' RETURNING 1) SELECT count(*)::text FROM m';
  -- Gestes interdits à tout autre que le gérant principal : (libellé, SQL).
  GESTES constant text[] := ARRAY[
    'promouvoir M1',           format(MAJ, 'role = ''owner''', '10'),
    'rétrograder C2 (membre)', format(MAJ, 'role = ''member''', 'e3'),
    'rétrograder C2 (coach)',  format(MAJ, 'role = ''coach''', 'e3'),
    'bannir C2',               format(MAJ, 'status = ''banned''', 'e3'),
    'désactiver C2',           format(MAJ, 'status = ''inactive''', 'e3'),
    'rétrograder G',           format(MAJ, 'role = ''member''', 'e0'),
    'déplacer C2 (personne)',  format(MAJ, 'member_id = ''00000000-0000-4000-a9c3-000000000020''', 'e3'),
    'déplacer C2 (box seule)', format(MAJ, 'box_id = ''00000000-0000-4000-b9c3-000000000003''', 'e3'),
    'insérer un co-gérant',    format('WITH m AS (INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9c3-000000000020'', ''owner'', ''active'') RETURNING 1) SELECT count(*)::text FROM m', '00000000-0000-4000-b9c3-000000000001'),
    'supprimer C2',            'WITH m AS (DELETE FROM public.box_members WHERE id = ''00000000-0000-4000-f9c3-0000000000e3'' RETURNING 1) SELECT count(*)::text FROM m'];
  v text;
  v_qui text;
  v_i int;
  v_passage int;
  v_avant text := pg_temp.etat();
BEGIN
  -- G0 : structure.
  IF (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'public.box_members'::regclass AND t.tgname = 'trg_box_members_garde_cogerant'
         AND t.tgenabled = 'O' AND t.tgtype = (1 | 2 | 4 | 8 | 16) AND coalesce(array_length(t.tgattr::int2[], 1), 0) = 0) <> 1 THEN
    RAISE EXCEPTION 'G0 : trg_box_members_garde_cogerant absent, inactif, ou pas BEFORE INSERT OR UPDATE OR DELETE sur toutes les colonnes';
  END IF;
  IF has_function_privilege('authenticated', 'internal.garder_role_cogerant()', 'EXECUTE')
     OR has_function_privilege('anon', 'internal.garder_role_cogerant()', 'EXECUTE') THEN
    RAISE EXCEPTION 'G0 : internal.garder_role_cogerant() exécutable par un client';
  END IF;

  -- G1 (règles réelles) puis G2 (règle d'écriture ouverte à tous).
  FOR v_passage IN 1..2 LOOP
    IF v_passage = 2 THEN
      CREATE POLICY zz_ecriture_ouverte ON public.box_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    FOREACH v_qui IN ARRAY CASE WHEN v_passage = 1 THEN ARRAY['e1'] ELSE ARRAY['e1', 'e2', '10'] END LOOP
      FOR v_i IN 1..array_length(GESTES, 1) / 2 LOOP
        v := pg_temp.faire(v_qui, GESTES[2 * v_i]);
        IF v NOT LIKE REFUS THEN
          RAISE EXCEPTION 'G% : % n''est pas refusé pour « % » (obtenu : %)', v_passage, v_qui, GESTES[2 * v_i - 1], v;
        END IF;
      END LOOP;
    END LOOP;
    IF v_passage = 2 THEN
      -- M1 ne se promeut pas lui-même.
      v := pg_temp.faire('10', format(MAJ, 'role = ''owner''', '10'));
      IF v NOT LIKE REFUS THEN RAISE EXCEPTION 'G2 : M1 se promeut co-gérant (%)', v; END IF;
      DROP POLICY zz_ecriture_ouverte ON public.box_members;
    END IF;
    IF pg_temp.etat() IS DISTINCT FROM v_avant THEN
      RAISE EXCEPTION 'G% : l''état a bougé : % au lieu de %', v_passage, pg_temp.etat(), v_avant;
    END IF;
  END LOOP;

  -- G3 : le co-gérant gère member ↔ coach, renonce à son rôle, quitte la box.
  v := pg_temp.faire('e1', format(MAJ, 'role = ''coach''', '10'));
  IF v <> '1' THEN RAISE EXCEPTION 'G3 : C1 ne passe pas M1 coach (%)', v; END IF;
  v := pg_temp.faire('e1', format(MAJ, 'role = ''member''', 'e2'));
  IF v <> '1' THEN RAISE EXCEPTION 'G3 : C1 ne passe pas K membre (%)', v; END IF;
  v := pg_temp.faire('e1', format(MAJ, 'role = ''coach''', 'e1'));
  IF v <> '1' THEN RAISE EXCEPTION 'G3 : C1 ne renonce pas à son rôle (%)', v; END IF;
  -- Redevenu coach, il n'a plus d'écriture sur la table : on le remet co-gérant
  -- inactif (clé serveur) pour vérifier que la garde, elle, refuse qu'il se
  -- réactive, sous une règle ouverte.
  v := pg_temp.faire('service', format(MAJ, 'role = ''owner'', status = ''inactive''', 'e1'));
  IF v <> '1' THEN RAISE EXCEPTION 'G3 : la clé serveur ne remet pas C1 co-gérant inactif (%)', v; END IF;
  CREATE POLICY zz_ecriture_ouverte ON public.box_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
  v := pg_temp.faire('e1', format(MAJ, 'status = ''active''', 'e1'));
  IF v NOT LIKE REFUS THEN RAISE EXCEPTION 'G3 : C1 se redonne le rôle de co-gérant actif (%)', v; END IF;
  DROP POLICY zz_ecriture_ouverte ON public.box_members;
  v := pg_temp.faire('service', format(MAJ, 'status = ''active''', 'e1'));
  IF v <> '1' THEN RAISE EXCEPTION 'G3 : la clé serveur ne réactive pas C1 (%)', v; END IF;
  v := pg_temp.faire('e1', 'WITH m AS (DELETE FROM public.box_members WHERE id = ''00000000-0000-4000-f9c3-0000000000e1'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'G3 : C1 ne quitte pas la box (%)', v; END IF;

  -- G4 : le gérant principal. Parcours du Manager « nommer un co-gérant » :
  -- l'actuel (C2) repasse membre, puis M2 est promu.
  v := pg_temp.faire('e0', format('WITH m AS (UPDATE public.box_members SET role = ''member'' WHERE member_id = ''00000000-0000-4000-a9c3-0000000000e3'' AND box_id = %L RETURNING 1) SELECT count(*)::text FROM m', B));
  IF v <> '1' THEN RAISE EXCEPTION 'G4 : G ne rétrograde pas le co-gérant actuel (%)', v; END IF;
  v := pg_temp.faire('e0', format('WITH m AS (UPDATE public.box_members SET role = ''owner'' WHERE member_id = ''00000000-0000-4000-a9c3-000000000011'' AND box_id = %L RETURNING 1) SELECT count(*)::text FROM m', B));
  IF v <> '1' THEN RAISE EXCEPTION 'G4 : G ne nomme pas le nouveau co-gérant (%)', v; END IF;
  v := pg_temp.faire('e0', format('WITH m AS (INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9c3-000000000020'', ''owner'', ''active'') RETURNING 1) SELECT count(*)::text FROM m', B));
  IF v <> '1' THEN RAISE EXCEPTION 'G4 : G n''insère pas un co-gérant (%)', v; END IF;
  v := pg_temp.faire('e0', format(MAJ, 'status = ''banned''', '11'));
  IF v <> '1' THEN RAISE EXCEPTION 'G4 : G ne bannit pas un co-gérant (%)', v; END IF;
  v := pg_temp.faire('e0', 'WITH m AS (DELETE FROM public.box_members WHERE member_id = ''00000000-0000-4000-a9c3-000000000020'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'G4 : G ne supprime pas la ligne d''un co-gérant (%)', v; END IF;

  -- G5 : clé serveur ; réécriture à l'identique ; autres colonnes libres.
  v := pg_temp.faire('service', format(MAJ, 'role = ''owner''', '10'));
  IF v <> '1' THEN RAISE EXCEPTION 'G5 : la clé serveur ne promeut pas (%)', v; END IF;
  v := pg_temp.faire('service', 'WITH m AS (DELETE FROM public.box_members WHERE id = ''00000000-0000-4000-f9c3-000000000010'' RETURNING 1) SELECT count(*)::text FROM m');
  IF v <> '1' THEN RAISE EXCEPTION 'G5 : la clé serveur ne supprime pas (%)', v; END IF;
  v := pg_temp.faire('service', format('WITH m AS (INSERT INTO public.box_members (box_id, member_id, role, status) VALUES (%L, ''00000000-0000-4000-a9c3-0000000000e1'', ''owner'', ''active'') RETURNING 1) SELECT count(*)::text FROM m', B));
  IF v <> '1' THEN RAISE EXCEPTION 'G5 : la clé serveur n''insère pas un co-gérant (%)', v; END IF;
  v := pg_temp.faire('e1', format('WITH m AS (UPDATE public.box_members SET role = ''owner'', status = ''active'', member_id = member_id, box_id = box_id WHERE box_id = %L AND member_id = ''00000000-0000-4000-a9c3-0000000000e0'' RETURNING 1) SELECT count(*)::text FROM m', B));
  IF v <> '1' THEN RAISE EXCEPTION 'G5 : réécriture à l''identique refusée (%)', v; END IF;
  v := pg_temp.faire('e1', format('WITH m AS (UPDATE public.box_members SET joined_at = now() WHERE box_id = %L AND member_id = ''00000000-0000-4000-a9c3-0000000000e0'' RETURNING 1) SELECT count(*)::text FROM m', B));
  IF v <> '1' THEN RAISE EXCEPTION 'G5 : autre colonne de la ligne d''un co-gérant refusée (%)', v; END IF;

  -- G6 : mutation. Sans le déclencheur, le premier geste de G1 passe.
  ALTER TABLE public.box_members DISABLE TRIGGER trg_box_members_garde_cogerant;
  v := pg_temp.faire('e1', format('WITH m AS (UPDATE public.box_members SET role = ''owner'' WHERE box_id = %L AND member_id = ''00000000-0000-4000-a9c3-0000000000e2'' RETURNING 1) SELECT count(*)::text FROM m', B));
  ALTER TABLE public.box_members ENABLE TRIGGER trg_box_members_garde_cogerant;
  IF v <> '1' THEN RAISE EXCEPTION 'G6 : déclencheur désactivé, la promotion par C1 ne passe pas (%) : G1 ne prouve rien', v; END IF;
END $t$;

ROLLBACK;
\echo '    G0 à G6 OK'
