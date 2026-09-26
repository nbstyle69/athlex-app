-- ═════════════════════════════════════════════════════════════════════════════
-- boxes.archive_notified_at (migration 20270129)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Gérant G (…e0), co-gérant C (…e1), super-admin A (…ef) ; boxes B1 à B4 de G.
--   N1  la colonne : timestamptz, NULL par défaut, non lisible par anon ;
--   N2  la clé serveur la renseigne sur une box programmée, et une nouvelle
--       écriture de la programmation (reprise) la garde ;
--   N3  `unschedule_box_archive` (super-admin) la remet à vide ;
--   N4  archivage automatique (`internal.archiver_boxes_echues`) : gardée ;
--   N5  réactivation par la clé serveur (archived_at et programmation à NULL) :
--       remise à vide ; réactivation d'une box archivée sans programmation
--       (archived_at seul à NULL) : remise à vide aussi ;
--   N6  un gérant ou un co-gérant ne peut ni la renseigner ni l'effacer
--       (42501, BOX_ARCHIVE_NOTIFIED_AT) ; il modifie toujours le reste de sa
--       box sans y toucher ;
--   N7  un gérant ne peut plus effacer lui-même la programmation (20270130) :
--       refusé, la colonne reste ;
--   N8  la clé serveur ne peut pas la poser sur une box ni programmée ni
--       archivée (elle y reste vide).
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> boxes.archive_notified_at'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a9be-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'ef']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a9be-0000000000' || s)::uuid, 'ban-' || s || '@test.invalid', 'ban_' || s
  FROM unnest(ARRAY['e0', 'e1', 'ef']) s;
UPDATE public.profiles SET role = 'super_admin' WHERE id = '00000000-0000-4000-a9be-0000000000ef';
INSERT INTO public.boxes (id, name, invite_code, owner_id, archive_scheduled_at, archived_at) VALUES
  ('00000000-0000-4000-b9be-000000000001', 'Box N1', 'BAN1', '00000000-0000-4000-a9be-0000000000e0', now() - interval '1 day', NULL),
  ('00000000-0000-4000-b9be-000000000002', 'Box N2', 'BAN2', '00000000-0000-4000-a9be-0000000000e0', now() - interval '1 day', NULL),
  ('00000000-0000-4000-b9be-000000000003', 'Box N3', 'BAN3', '00000000-0000-4000-a9be-0000000000e0', NULL, now() - interval '1 day'),
  ('00000000-0000-4000-b9be-000000000004', 'Box N4', 'BAN4', '00000000-0000-4000-a9be-0000000000e0', NULL, NULL);
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b9be-000000000001', '00000000-0000-4000-a9be-0000000000e1', 'owner', 'active');

-- Rôles : la clé serveur, un utilisateur connecté (JWT), ou le rôle d'administration.
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_qui = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    PERFORM set_config('role', 'service_role', true);
  ELSE
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a9be-0000000000' || p_qui, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('role', 'authenticated', true);
  END IF;
END $$;
CREATE FUNCTION pg_temp.notifiee(p_box text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT archive_notified_at FROM public.boxes WHERE id = ('00000000-0000-4000-b9be-00000000000' || p_box)::uuid;
$$;

DO $t$
DECLARE
  v_sqlstate text;
  v_message text;
  v_qui text;
  v_n int;
BEGIN
  -- N1 : la colonne.
  IF (SELECT format_type(atttypid, atttypmod) || '/' || attnotnull::text || '/' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-')
        FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = 'public.boxes'::regclass AND a.attname = 'archive_notified_at') IS DISTINCT FROM 'timestamp with time zone/false/-' THEN
    RAISE EXCEPTION 'N1 : colonne archive_notified_at absente ou mal typée';
  END IF;
  IF has_column_privilege('anon', 'public.boxes', 'archive_notified_at', 'SELECT') THEN
    RAISE EXCEPTION 'N1 : anon lit archive_notified_at';
  END IF;

  -- N2 : la clé serveur la renseigne ; une reprise de la programmation la garde.
  PERFORM pg_temp.en_tant_que('service');
  UPDATE public.boxes SET archive_notified_at = now() WHERE id IN ('00000000-0000-4000-b9be-000000000001', '00000000-0000-4000-b9be-000000000002', '00000000-0000-4000-b9be-000000000003');
  UPDATE public.boxes SET archive_scheduled_at = now() WHERE id = '00000000-0000-4000-b9be-000000000002';
  PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  IF pg_temp.notifiee('1') IS NULL OR pg_temp.notifiee('2') IS NULL OR pg_temp.notifiee('3') IS NULL THEN
    RAISE EXCEPTION 'N2 : la clé serveur ne la renseigne pas, ou une reprise de la programmation l''efface';
  END IF;

  -- N6 : gérant et co-gérant refusés, dans les deux sens ; le reste de la box reste modifiable.
  FOREACH v_qui IN ARRAY ARRAY['e0', 'e1'] LOOP
    FOR v_n IN 1..2 LOOP
      v_sqlstate := NULL; v_message := NULL;
      PERFORM pg_temp.en_tant_que(v_qui);
      BEGIN
        IF v_n = 1 THEN
          UPDATE public.boxes SET archive_notified_at = NULL WHERE id = '00000000-0000-4000-b9be-000000000001';
        ELSE
          UPDATE public.boxes SET archive_notified_at = now() - interval '5 days' WHERE id = '00000000-0000-4000-b9be-000000000001';
        END IF;
      EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE; v_message := SQLERRM;
      END;
      PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
      IF v_sqlstate IS DISTINCT FROM '42501' OR v_message NOT LIKE 'BOX_ARCHIVE_NOTIFIED_AT:%' THEN
        RAISE EXCEPTION 'N6 : % a pu modifier archive_notified_at (écriture %, obtenu : % %)', v_qui, v_n, coalesce(v_sqlstate, 'acceptée'), v_message;
      END IF;
    END LOOP;
  END LOOP;
  PERFORM pg_temp.en_tant_que('e0');
  UPDATE public.boxes SET tagline = 'Nouvelle accroche' WHERE id = '00000000-0000-4000-b9be-000000000001';
  PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  IF (SELECT tagline FROM public.boxes WHERE id = '00000000-0000-4000-b9be-000000000001') IS DISTINCT FROM 'Nouvelle accroche'
     OR pg_temp.notifiee('1') IS NULL THEN
    RAISE EXCEPTION 'N6 : le gérant ne modifie plus sa box, ou la colonne a bougé';
  END IF;

  -- N3 : l'annulation par le super-admin la remet à vide.
  PERFORM pg_temp.en_tant_que('ef');
  PERFORM public.unschedule_box_archive('00000000-0000-4000-b9be-000000000001');
  PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  IF pg_temp.notifiee('1') IS NOT NULL THEN
    RAISE EXCEPTION 'N3 : unschedule_box_archive laisse archive_notified_at';
  END IF;

  -- N4 : l'archivage automatique la garde (B2 ne paie plus rien).
  PERFORM internal.archiver_boxes_echues();
  IF (SELECT archived_at FROM public.boxes WHERE id = '00000000-0000-4000-b9be-000000000002') IS NULL THEN
    RAISE EXCEPTION 'N4 : décor — B2 n''a pas été archivée';
  END IF;
  IF pg_temp.notifiee('2') IS NULL THEN
    RAISE EXCEPTION 'N4 : l''archivage automatique efface archive_notified_at';
  END IF;

  -- N5 : réactivation par la clé serveur, avec ou sans programmation.
  PERFORM pg_temp.en_tant_que('service');
  UPDATE public.boxes SET archived_at = NULL, archived_by = NULL, archive_scheduled_at = NULL, archive_scheduled_by = NULL
   WHERE id = '00000000-0000-4000-b9be-000000000002';
  UPDATE public.boxes SET archived_at = NULL, archived_by = NULL WHERE id = '00000000-0000-4000-b9be-000000000003';
  PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  IF pg_temp.notifiee('2') IS NOT NULL OR pg_temp.notifiee('3') IS NOT NULL THEN
    RAISE EXCEPTION 'N5 : une réactivation laisse archive_notified_at (B2 %, B3 %)', pg_temp.notifiee('2'), pg_temp.notifiee('3');
  END IF;

  -- N7 : le gérant ne peut plus effacer lui-même la programmation (20270130) :
  -- refus, et la colonne reste. La clé serveur la lève ensuite (pour N8).
  UPDATE public.boxes SET archive_scheduled_at = now(), archive_notified_at = now() WHERE id = '00000000-0000-4000-b9be-000000000004';
  v_sqlstate := NULL; v_message := NULL;
  PERFORM pg_temp.en_tant_que('e0');
  BEGIN
    UPDATE public.boxes SET archive_scheduled_at = NULL WHERE id = '00000000-0000-4000-b9be-000000000004';
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE; v_message := SQLERRM;
  END;
  PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  IF v_sqlstate IS DISTINCT FROM '42501' OR v_message NOT LIKE 'BOX_ARCHIVAGE_RESERVE:%' OR pg_temp.notifiee('4') IS NULL THEN
    RAISE EXCEPTION 'N7 : le gérant a effacé la programmation (obtenu : % %)', coalesce(v_sqlstate, 'acceptée'), v_message;
  END IF;
  UPDATE public.boxes SET archive_scheduled_at = NULL WHERE id = '00000000-0000-4000-b9be-000000000004';

  -- N8 : sur une box ni programmée ni archivée, elle reste vide.
  PERFORM pg_temp.en_tant_que('service');
  UPDATE public.boxes SET archive_notified_at = now() WHERE id = '00000000-0000-4000-b9be-000000000004';
  PERFORM set_config('role', 'none', true); PERFORM set_config('request.jwt.claim.role', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  IF pg_temp.notifiee('4') IS NOT NULL THEN
    RAISE EXCEPTION 'N8 : archive_notified_at posée sur une box ouverte';
  END IF;
END $t$;

ROLLBACK;
\echo '    N1 à N8 OK'
