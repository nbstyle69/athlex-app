-- ═════════════════════════════════════════════════════════════════════════════
-- Garde sur l'état d'archivage d'une box (migration 20270130)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Gérant G (…e0, owner_id), co-gérant C (…e1), coach K (…e2), membre M (…e3),
-- super-admin A (…ef), anon. B1 ouverte, B2 programmée, B3 archivée, B4 à B6
-- pour la clé serveur et les fonctions d'archivage.
-- Actions : programmer (archive_scheduled_at), changer l'auteur de la
-- programmation (archive_scheduled_by), déprogrammer, archiver (archived_at),
-- changer l'auteur de l'archivage (archived_by), réactiver.
--   R1  règles réelles : le gérant et le co-gérant, qui ont le droit d'écrire
--       leur box, sont refusés (42501, BOX_ARCHIVAGE_RESERVE) pour chaque
--       action ; le coach et le membre ne changent rien ; rien n'a bougé ;
--   R2  règle d'écriture ouverte à tous et droit UPDATE donné à anon (dans la
--       transaction) : gérant, co-gérant, coach, membre et anon sont refusés
--       pour chaque action, réactivation comprise ; rien n'a bougé ;
--   R3  une valeur réécrite à l'identique passe (le gérant enregistre sa box) ;
--   R4  la clé serveur programme, archive, réactive et déprogramme ;
--   R5  `unschedule_box_archive` appelée par le super-admin avec son jeton
--       d'utilisateur (auth.role() = authenticated) passe ;
--   R6  l'archivage automatique (`internal.archiver_boxes_echues`) passe.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Garde sur l''état d''archivage d''une box'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9bf-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', 'ef']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9bf-0000000000' || s)::uuid, 'bga-' || s || '@test.invalid', 'bga_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'e3', 'ef']) s;
UPDATE public.profiles SET role = 'super_admin' WHERE id = '00000000-0000-4000-a9bf-0000000000ef';
INSERT INTO public.boxes (id, name, invite_code, owner_id, is_listed, archive_scheduled_at, archive_scheduled_by, archived_at, archived_by)
SELECT ('00000000-0000-4000-b9bf-00000000000' || n)::uuid, 'Box R' || n, 'BGA' || n, '00000000-0000-4000-a9bf-0000000000e0', true,
       CASE WHEN n IN ('2', '5', '6') THEN now() - interval '1 day' END,
       CASE WHEN n IN ('2', '5', '6') THEN '00000000-0000-4000-a9bf-0000000000ef'::uuid END,
       CASE WHEN n = '3' THEN now() - interval '1 day' END,
       CASE WHEN n = '3' THEN '00000000-0000-4000-a9bf-0000000000ef'::uuid END
  FROM unnest(ARRAY['1', '2', '3', '4', '5', '6']) n;
INSERT INTO public.box_members (box_id, member_id, role, status)
SELECT ('00000000-0000-4000-b9bf-00000000000' || b)::uuid, ('00000000-0000-4000-a9bf-0000000000' || m)::uuid, r, 'active'
  FROM unnest(ARRAY['1', '2', '3']) b,
       (VALUES ('e1', 'owner'), ('e2', 'coach'), ('e3', 'member')) v(m, r);

CREATE FUNCTION pg_temp.etat() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(id::text || ':' || coalesce(archive_scheduled_at::text, '-') || ':' || coalesce(archive_scheduled_by::text, '-')
                    || ':' || coalesce(archived_at::text, '-') || ':' || coalesce(archived_by::text, '-'), '|' ORDER BY id)
    FROM public.boxes WHERE id::text LIKE '00000000-0000-4000-b9bf-%';
$$;

DO $t$
DECLARE
  B1 constant text := '''00000000-0000-4000-b9bf-000000000001''';
  B2 constant text := '''00000000-0000-4000-b9bf-000000000002''';
  B3 constant text := '''00000000-0000-4000-b9bf-000000000003''';
  ACTIONS constant text[] := ARRAY[
    'UPDATE public.boxes SET archive_scheduled_at = now() WHERE id = ' || B1,
    'UPDATE public.boxes SET archive_scheduled_by = ''00000000-0000-4000-a9bf-0000000000e0'' WHERE id = ' || B2,
    'UPDATE public.boxes SET archive_scheduled_at = NULL, archive_scheduled_by = NULL WHERE id = ' || B2,
    'UPDATE public.boxes SET archived_at = now() WHERE id = ' || B1,
    'UPDATE public.boxes SET archived_by = ''00000000-0000-4000-a9bf-0000000000e0'' WHERE id = ' || B1,
    'UPDATE public.boxes SET archived_at = NULL, archived_by = NULL WHERE id = ' || B3];
  v_avant text;
  v_qui text;
  v_action text;
  v_sqlstate text;
  v_message text;
  v_passage int;
BEGIN
  v_avant := pg_temp.etat();

  FOR v_passage IN 1..2 LOOP
    IF v_passage = 2 THEN
      -- Règle d'écriture ouverte à tous : la garde doit tenir seule.
      DROP POLICY boxes_hide_archived ON public.boxes;
      DROP POLICY boxes_hide_archive_scheduled ON public.boxes;
      CREATE POLICY zz_ecriture_ouverte ON public.boxes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
      GRANT UPDATE ON public.boxes TO anon;
    END IF;
    FOREACH v_qui IN ARRAY ARRAY['e0', 'e1', 'e2', 'e3', 'anon'] LOOP
      FOREACH v_action IN ARRAY ACTIONS LOOP
        v_sqlstate := NULL; v_message := NULL;
        IF v_qui = 'anon' THEN
          PERFORM set_config('request.jwt.claim.sub', '', true);
          PERFORM set_config('request.jwt.claim.role', 'anon', true);
          PERFORM set_config('role', 'anon', true);
        ELSE
          PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9bf-0000000000' || v_qui, true);
          PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
          PERFORM set_config('role', 'authenticated', true);
        END IF;
        BEGIN
          EXECUTE v_action;
        EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE; v_message := SQLERRM;
        END;
        PERFORM set_config('role', 'none', true);
        PERFORM set_config('request.jwt.claim.role', '', true);
        PERFORM set_config('request.jwt.claim.sub', '', true);
        -- R1 : le gérant et le co-gérant écrivent leur box ; la réactivation
        -- d'une box archivée leur est déjà cachée par la RLS (0 ligne).
        -- R2 : tout le monde passe la RLS, la garde refuse tout.
        IF (v_passage = 2 OR (v_qui IN ('e0', 'e1') AND v_action NOT LIKE '%archived_at = NULL%'))
           AND (v_sqlstate IS DISTINCT FROM '42501' OR v_message NOT LIKE 'BOX_ARCHIVAGE_RESERVE:%') THEN
          RAISE EXCEPTION 'R% : % n''est pas refusé par la garde pour « % » (obtenu : % %)',
            v_passage, v_qui, v_action, coalesce(v_sqlstate, 'accepté'), v_message;
        END IF;
      END LOOP;
    END LOOP;
    IF pg_temp.etat() IS DISTINCT FROM v_avant THEN
      RAISE EXCEPTION 'R% : l''état d''archivage a bougé : % au lieu de %', v_passage, pg_temp.etat(), v_avant;
    END IF;
  END LOOP;

  -- R3 : réécriture à l'identique (enregistrement de la box par le gérant).
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9bf-0000000000e0', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  v_message := NULL;
  BEGIN
    UPDATE public.boxes SET name = 'Box R2 bis', archive_scheduled_at = archive_scheduled_at, archive_scheduled_by = archive_scheduled_by,
                            archived_at = archived_at, archived_by = archived_by
     WHERE id = '00000000-0000-4000-b9bf-000000000002';
  EXCEPTION WHEN OTHERS THEN v_message := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  IF (SELECT name FROM public.boxes WHERE id = '00000000-0000-4000-b9bf-000000000002') IS DISTINCT FROM 'Box R2 bis' THEN
    RAISE EXCEPTION 'R3 : la réécriture à l''identique a été refusée (%)', v_message;
  END IF;

  -- R4 : la clé serveur.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.boxes SET archive_scheduled_at = now(), archive_scheduled_by = '00000000-0000-4000-a9bf-0000000000ef' WHERE id = '00000000-0000-4000-b9bf-000000000004';
  UPDATE public.boxes SET archived_at = now(), archived_by = '00000000-0000-4000-a9bf-0000000000ef', archive_scheduled_at = NULL, archive_scheduled_by = NULL
   WHERE id = '00000000-0000-4000-b9bf-000000000004';
  UPDATE public.boxes SET archived_at = NULL, archived_by = NULL WHERE id = '00000000-0000-4000-b9bf-000000000004';
  UPDATE public.boxes SET archive_scheduled_at = NULL, archive_scheduled_by = NULL WHERE id = '00000000-0000-4000-b9bf-000000000005';
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  IF EXISTS (SELECT 1 FROM public.boxes WHERE id IN ('00000000-0000-4000-b9bf-000000000004', '00000000-0000-4000-b9bf-000000000005')
              AND (archived_at IS NOT NULL OR archive_scheduled_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'R4 : la clé serveur n''a pas pu programmer, archiver, réactiver ou déprogrammer';
  END IF;

  -- R5 : le super-admin, avec son jeton d'utilisateur, par la fonction d'annulation.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9bf-0000000000ef', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.unschedule_box_archive('00000000-0000-4000-b9bf-000000000002');
  EXCEPTION WHEN OTHERS THEN v_message := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF (SELECT archive_scheduled_at FROM public.boxes WHERE id = '00000000-0000-4000-b9bf-000000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'R5 : unschedule_box_archive refusée au super-admin (%)', v_message;
  END IF;

  -- R6 : l'archivage automatique (B6 programmée, rien ne paie).
  PERFORM internal.archiver_boxes_echues();
  IF (SELECT archived_at FROM public.boxes WHERE id = '00000000-0000-4000-b9bf-000000000006') IS NULL THEN
    RAISE EXCEPTION 'R6 : l''archivage automatique n''a pas archivé B6';
  END IF;
END $t$;

ROLLBACK;
\echo '    R1 à R6 OK'
