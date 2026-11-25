-- ═════════════════════════════════════════════════════════════════════════════
-- Invitation box → box à une offre de programmation (migration 20270167, #461)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Comptes : GE (…e0) gère la box éditrice E et la box R ; GI (…e1) gère la box
-- invitée I ; GT (…e2) gère la box tierce T et les box de décor ; CE (…c0) est
-- coach de E, CI (…c1) coach de I.
-- Offres de E : OP payante « invitation », OC payante « catalogue », OF
-- gratuite « catalogue », ON non publiée, OFI gratuite « invitation », OD
-- gratuite « catalogue » (dépubliée puis supprimée) ; OR payante de R (limite).
--   D1  droits : les huit fonctions et la fonction de policy pour authenticated
--       seulement ; les fonctions d'internal pour aucun client ; la table des
--       invitations sans écriture client ;
--   S1  recherche : gérant seulement (coach, tiers refusés), 2 lettres, nom
--       seul, 10 résultats, ni la box éditrice ni les box archivées ou en
--       archivage, drapeaux already_subscribed et invitation_pending ;
--   E1  envoi : coach et tiers refusés ; offre non publiée, box propre, box
--       archivée, box en archivage, box déjà abonnée, message de 281
--       caractères, tarif inconnu, « au prix de l'offre » sur une offre
--       gratuite : refus nommés ; envoi accepté, 14 jours de validité ;
--   E2  doublon en attente refusé ; « Renvoyer » après un refus accepté ;
--   E3  20 invitations par 24 h glissantes : la 21e refusée, acceptée dès
--       qu'une des 20 a plus de 24 h ;
--   A1  annuler : gérant de l'éditrice seulement, en attente seulement ;
--   A2  refuser : gérant de l'invitée seulement, pas après expiration ;
--   A3  accepter : coach refusé, « au prix de l'offre » refusé, après
--       expiration refusé ; « Offerte » sur une offre payante « invitation » :
--       abonnement actif lié à l'invitation, sans application automatique,
--       invitation acceptée ;
--   G1  insert ou update client qui pose invitation_id ou
--       revoked_by_publisher_at : refusé ;
--   G2  offre « invitation » activée sans invitation : refusée, même par le
--       backend et par subscribe_free_programming ; avec invitation : passe ;
--       un renouvellement past_due → active n'est pas bloqué ;
--   C1  catalogue sans les offres « invitation », sauf pour la box abonnée ;
--   P1  lecture d'une offre « invitation » : éditrice, box invitée, box
--       abonnée oui ; box tierce non ; anon non ;
--   L1  lecture de la table des invitations : gérants des deux box seulement ;
--   L2  listes reçues et envoyées ;
--   R2  retrait : non-éditrice refusée, accès non offert refusé ; fin au lundi
--       suivant 00:00 (Paris), application automatique coupée et non
--       rallumable, WOD déjà posés intacts, rien de posé ensuite ; second
--       retrait refusé ;
--   X1  expiration par internal.expire_programming_invitations() et tâche
--       pg_cron quotidienne en SQL ;
--   X2  dépublier annule les invitations en attente, pas les acceptées ;
--       supprimer l'offre supprime ses invitations ;
--   F1  définitions épinglées : garde, catalogue, policy ;
--   R1  retour arrière : refusé tant qu'une invitation existe ; ensuite les
--       trois définitions reviennent aux md5 de prod et les objets ajoutés
--       disparaissent.
-- Les corps épinglés (md5) sont à mettre à jour, en connaissance de cause,
-- par la prochaine migration qui redéfinit la garde, le catalogue ou la policy.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Invitation box → box (20270167)'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a461-0000000000' || s)::uuid FROM unnest(ARRAY['e0', 'e1', 'e2', 'c0', 'c1']) s;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a461-0000000000' || s)::uuid, 'inv-' || s || '@test.invalid', 'inv_' || s
  FROM unnest(ARRAY['e0', 'e1', 'e2', 'c0', 'c1']) s;

INSERT INTO public.boxes (id, name, invite_code, owner_id, archived_at, archive_scheduled_at) VALUES
  ('00000000-0000-4000-b461-0000000000e0', 'Box Editrice',              'I461E', '00000000-0000-4000-a461-0000000000e0', NULL, NULL),
  ('00000000-0000-4000-b461-0000000000e1', 'Box Rafale',                'I461R', '00000000-0000-4000-a461-0000000000e0', NULL, NULL),
  ('00000000-0000-4000-b461-0000000000a1', 'Box Invitation Invitee',    'I461I', '00000000-0000-4000-a461-0000000000e1', NULL, NULL),
  ('00000000-0000-4000-b461-0000000000a2', 'Box Invitation Tierce',     'I461T', '00000000-0000-4000-a461-0000000000e2', NULL, NULL),
  ('00000000-0000-4000-b461-0000000000a3', 'Box Invitation Archivee',   'I461A', '00000000-0000-4000-a461-0000000000e2', now(), NULL),
  ('00000000-0000-4000-b461-0000000000a4', 'Box Invitation Programmee', 'I461P', '00000000-0000-4000-a461-0000000000e2', NULL, now()),
  ('00000000-0000-4000-b461-0000000000a5', 'Box Invitation Abonnee',    'I461S', '00000000-0000-4000-a461-0000000000e2', NULL, NULL);
-- 21 cibles pour la limite et la recherche.
INSERT INTO public.boxes (id, name, invite_code, owner_id)
SELECT ('00000000-0000-4000-b461-0000000001' || lpad(n::text, 2, '0'))::uuid, 'Cible Invitation ' || lpad(n::text, 2, '0'),
       'I461C' || n, '00000000-0000-4000-a461-0000000000e2'
  FROM generate_series(1, 21) n;

INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b461-0000000000e0', '00000000-0000-4000-a461-0000000000c0', 'coach', 'active'),
  ('00000000-0000-4000-b461-0000000000a1', '00000000-0000-4000-a461-0000000000c1', 'coach', 'active');

INSERT INTO public.box_programming (id, publisher_box_id, title, is_published, billing, price_cents, visibility, weeks_count) VALUES
  ('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000e0', 'Inv OP', true,  'monthly', 2900, 'invitation', 1),
  ('00000000-0000-4000-d461-000000000002', '00000000-0000-4000-b461-0000000000e0', 'Inv OC', true,  'monthly', 1900, 'catalogue',  1),
  ('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-0000000000e0', 'Inv OF', true,  'free',    0,    'catalogue',  1),
  ('00000000-0000-4000-d461-000000000004', '00000000-0000-4000-b461-0000000000e0', 'Inv ON', false, 'free',    0,    'catalogue',  1),
  ('00000000-0000-4000-d461-000000000005', '00000000-0000-4000-b461-0000000000e0', 'Inv OFI', true, 'free',    0,    'invitation', 1),
  ('00000000-0000-4000-d461-000000000006', '00000000-0000-4000-b461-0000000000e1', 'Inv OR', true,  'monthly', 900,  'catalogue',  1),
  ('00000000-0000-4000-d461-000000000007', '00000000-0000-4000-b461-0000000000e0', 'Inv OD', true,  'free',    0,    'catalogue',  1);
INSERT INTO public.box_programming_wods (programming_id, week_number, day_of_week, title)
SELECT ('00000000-0000-4000-d461-00000000000' || n)::uuid, 1, 1, 'Lundi ' || n FROM generate_series(1, 7) n;

-- S est déjà abonnée à OC (posé par le backend : paiement Stripe).
INSERT INTO public.box_programming_subscriptions (id, programming_id, subscriber_box_id, status) VALUES
  ('00000000-0000-4000-f461-0000000000a5', '00000000-0000-4000-d461-000000000002', '00000000-0000-4000-b461-0000000000a5', 'active');

-- Appel comme le vrai client : rôle authenticated, auth.uid(), et un JWT dont
-- le rôle n'est pas service_role (request_is_backend() faux).
CREATE FUNCTION pg_temp.en_tant_que(p_qui text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a461-0000000000' || p_qui, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-a461-0000000000' || p_qui, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;
-- Retour au serveur (psql, rôle de session) : request_is_backend() vrai.
CREATE FUNCTION pg_temp.serveur() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END $$;
-- Joue p_sql sous p_qui ('' = serveur) ; rend 'ok' ou 'SQLSTATE message'.
CREATE FUNCTION pg_temp.essai(p_qui text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v text := 'ok';
BEGIN
  IF p_qui <> '' THEN PERFORM pg_temp.en_tant_que(p_qui); END IF;
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN v := SQLSTATE || ' ' || SQLERRM;
  END;
  PERFORM pg_temp.serveur();
  RETURN v;
END $$;
CREATE FUNCTION pg_temp.refus(p_etiquette text, p_qui text, p_sql text, p_attendu text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v text := pg_temp.essai(p_qui, p_sql);
BEGIN
  IF v NOT LIKE p_attendu || '%' THEN
    RAISE EXCEPTION '% : attendu « % », obtenu « % »', p_etiquette, p_attendu, v;
  END IF;
END $$;
CREATE FUNCTION pg_temp.accord(p_etiquette text, p_qui text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v text := pg_temp.essai(p_qui, p_sql);
BEGIN
  IF v <> 'ok' THEN
    RAISE EXCEPTION '% : refusé à tort : %', p_etiquette, v;
  END IF;
END $$;
-- Envoi d'une invitation, rend son id.
CREATE FUNCTION pg_temp.inviter(p_offre text, p_box text, p_tarif text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v jsonb;
BEGIN
  PERFORM pg_temp.en_tant_que('e0');
  v := public.send_programming_invitation(('00000000-0000-4000-d461-00000000000' || p_offre)::uuid,
                                          ('00000000-0000-4000-b461-00000' || p_box)::uuid, p_tarif, NULL);
  PERFORM pg_temp.serveur();
  RETURN (v ->> 'invitation_id')::uuid;
END $$;
-- Le retour au serveur se fait depuis le rôle client : les fonctions de pg_temp
-- n'ont pas d'EXECUTE par défaut sur cette base.
GRANT EXECUTE ON FUNCTION pg_temp.serveur() TO authenticated, anon;

DO $t$
DECLARE
  r record;
  v text;
  v_n int;
  v_id uuid;
  v_inv_i uuid;      -- OP → I, « Offerte »
  v_inv_prix uuid;   -- OC → I, « au prix de l'offre »
  v_inv_ofi uuid;    -- OFI → T
  v_sub uuid;
  v_fin timestamptz;
  v_wods int;
BEGIN
  -- ── D1 · droits ───────────────────────────────────────────────────────────
  SELECT string_agg(format('%s:%s:%s', p.oid::regprocedure, ro.rolname,
                           has_function_privilege(ro.rolname, p.oid, 'EXECUTE')), ', ' ORDER BY p.proname, ro.rolname)
    INTO v
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   CROSS JOIN (VALUES ('anon'), ('authenticated')) ro(rolname)
   WHERE n.nspname = 'public'
     AND p.proname IN ('search_boxes_for_invitation', 'send_programming_invitation', 'cancel_programming_invitation',
                       'decline_programming_invitation', 'accept_programming_invitation',
                       'revoke_offered_programming_access', 'list_my_programming_invitations',
                       'list_programming_invitations_sent', 'programming_visible_by_invitation')
     AND has_function_privilege(ro.rolname, p.oid, 'EXECUTE') <> (ro.rolname = 'authenticated');
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'D1 : droits d''exécution inattendus : %', v;
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef AND p.proname IN ('search_boxes_for_invitation',
         'send_programming_invitation', 'cancel_programming_invitation', 'decline_programming_invitation',
         'accept_programming_invitation', 'revoke_offered_programming_access', 'list_my_programming_invitations',
         'list_programming_invitations_sent', 'programming_visible_by_invitation')
         AND 'search_path=public, pg_temp' = ANY (p.proconfig)) <> 9 THEN
    RAISE EXCEPTION 'D1 : les neuf fonctions ne sont pas toutes SECURITY DEFINER à search_path fixé';
  END IF;
  IF has_function_privilege('authenticated', 'internal.expire_programming_invitations()', 'EXECUTE')
     OR has_function_privilege('anon', 'internal.expire_programming_invitations()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'internal.annuler_invitations_offre_depubliee()', 'EXECUTE') THEN
    RAISE EXCEPTION 'D1 : une fonction d''internal est exécutable par un client';
  END IF;
  IF has_table_privilege('authenticated', 'public.box_programming_invitations', 'INSERT')
     OR has_table_privilege('authenticated', 'public.box_programming_invitations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.box_programming_invitations', 'DELETE')
     OR has_table_privilege('anon', 'public.box_programming_invitations', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.box_programming_invitations', 'SELECT')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.box_programming_invitations'::regclass) THEN
    RAISE EXCEPTION 'D1 : droits ou RLS de box_programming_invitations inattendus';
  END IF;
  IF (SELECT visibility FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000002') <> 'catalogue'
     OR (SELECT column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'box_programming' AND column_name = 'visibility') <> '''catalogue''::text' THEN
    RAISE EXCEPTION 'D1 : visibility ne vaut pas catalogue par défaut';
  END IF;
  PERFORM pg_temp.refus('D1 visibilité inconnue', '',
    $$UPDATE public.box_programming SET visibility = 'privee' WHERE id = '00000000-0000-4000-d461-000000000002'$$, '23514');

  -- ── S1 · recherche ────────────────────────────────────────────────────────
  PERFORM pg_temp.refus('S1 coach', 'c0',
    $$SELECT * FROM public.search_boxes_for_invitation('00000000-0000-4000-d461-000000000001', 'Invitation')$$, '42501 Accès refusé');
  PERFORM pg_temp.refus('S1 tiers', 'e2',
    $$SELECT * FROM public.search_boxes_for_invitation('00000000-0000-4000-d461-000000000001', 'Invitation')$$, '42501 Accès refusé');
  PERFORM pg_temp.refus('S1 une lettre', 'e0',
    $$SELECT * FROM public.search_boxes_for_invitation('00000000-0000-4000-d461-000000000001', ' B ')$$,
    '22023 INVITATION_RECHERCHE_COURTE');
  PERFORM pg_temp.en_tant_que('e0');
  SELECT count(*) INTO v_n FROM public.search_boxes_for_invitation('00000000-0000-4000-d461-000000000001', 'cible invit');
  SELECT string_agg(s.name || ':' || s.already_subscribed || ':' || s.invitation_pending, ',' ORDER BY s.name) INTO v
    FROM public.search_boxes_for_invitation('00000000-0000-4000-d461-000000000002', 'Box ') s;
  PERFORM pg_temp.serveur();
  IF v_n <> 10 THEN
    RAISE EXCEPTION 'S1 : 10 résultats attendus, % obtenus', v_n;
  END IF;
  -- Ni E (éditrice), ni A (archivée), ni P (en archivage) ; S abonnée à OC.
  IF v IS DISTINCT FROM 'Box Invitation Abonnee:true:false,Box Invitation Invitee:false:false,Box Invitation Tierce:false:false,Box Rafale:false:false' THEN
    RAISE EXCEPTION 'S1 : recherche inattendue : %', v;
  END IF;
  -- « % » et « _ » sont des lettres, pas des jokers.
  PERFORM pg_temp.en_tant_que('e0');
  SELECT count(*) INTO v_n FROM public.search_boxes_for_invitation('00000000-0000-4000-d461-000000000001', '%%');
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'S1 : « %% » sert de joker (% résultats)', v_n;
  END IF;
  -- Nom et drapeaux seulement : aucune autre colonne.
  IF (SELECT string_agg(a, ',' ORDER BY o) FROM unnest(
        (SELECT proargnames FROM pg_proc WHERE oid = 'public.search_boxes_for_invitation(uuid, text)'::regprocedure))
        WITH ORDINALITY u(a, o)) <> 'p_programming_id,p_q,box_id,name,already_subscribed,invitation_pending' THEN
    RAISE EXCEPTION 'S1 : colonnes de recherche inattendues';
  END IF;

  -- ── E1 · envoi ────────────────────────────────────────────────────────────
  PERFORM pg_temp.refus('E1 coach', 'c0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1', 'offered')$$, '42501 Accès refusé');
  PERFORM pg_temp.refus('E1 tiers', 'e2',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1', 'offered')$$, '42501 Accès refusé');
  PERFORM pg_temp.refus('E1 gérant de la box invitée', 'e1',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1', 'offered')$$, '42501 Accès refusé');
  PERFORM pg_temp.refus('E1 non publiée', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000004', '00000000-0000-4000-b461-0000000000a1', 'offered')$$,
    '23514 INVITATION_OFFRE_NON_PUBLIEE');
  PERFORM pg_temp.refus('E1 box propre', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000e0', 'offered')$$,
    '23514 INVITATION_BOX_PROPRE');
  PERFORM pg_temp.refus('E1 box archivée', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a3', 'offered')$$,
    '23514 INVITATION_BOX_ARCHIVEE');
  PERFORM pg_temp.refus('E1 box en archivage', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a4', 'offered')$$,
    '23514 INVITATION_BOX_ARCHIVEE');
  PERFORM pg_temp.refus('E1 déjà abonnée', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000002', '00000000-0000-4000-b461-0000000000a5', 'offered')$$,
    '23514 INVITATION_DEJA_ABONNEE');
  PERFORM pg_temp.refus('E1 message de 281 caractères', 'e0',
    format($$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1', 'offered', %L)$$,
           repeat('é', 281)),
    '23514 INVITATION_MESSAGE_TROP_LONG');
  PERFORM pg_temp.refus('E1 tarif inconnu', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1', 'free')$$,
    '23514 INVITATION_TARIF');
  PERFORM pg_temp.refus('E1 prix d''une offre gratuite', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-0000000000a1', 'offer_price')$$,
    '23514 INVITATION_TARIF');
  -- Message de 280 caractères exactement : accepté.
  PERFORM pg_temp.en_tant_que('e0');
  v_inv_i := (public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1',
                                                 'offered', repeat('é', 280)) ->> 'invitation_id')::uuid;
  PERFORM pg_temp.serveur();
  SELECT * INTO r FROM public.box_programming_invitations WHERE id = v_inv_i;
  IF r.status <> 'pending' OR r.publisher_box_id <> '00000000-0000-4000-b461-0000000000e0'
     OR r.expires_at <> r.created_at + interval '14 days' OR r.invited_by <> '00000000-0000-4000-a461-0000000000e0'
     OR char_length(r.message) <> 280 OR r.pricing <> 'offered' THEN
    RAISE EXCEPTION 'E1 : invitation inattendue : %', row_to_json(r);
  END IF;
  v_inv_prix := pg_temp.inviter('2', '00000a1', 'offer_price');

  -- ── E2 · doublon, renvoi ──────────────────────────────────────────────────
  PERFORM pg_temp.refus('E2 doublon en attente', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a1', 'offer_price')$$,
    '23514 INVITATION_EN_ATTENTE');
  v_id := pg_temp.inviter('3', '00000a2', 'offered');
  PERFORM pg_temp.accord('E2 refus par T', 'e2', format('SELECT public.decline_programming_invitation(%L)', v_id));
  PERFORM pg_temp.accord('E2 renvoi après refus', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-0000000000a2', 'offered')$$);
  -- Échue, pas encore passée en expired par la tâche : le renvoi passe.
  UPDATE public.box_programming_invitations SET expires_at = now() - interval '1 second'
   WHERE programming_id = '00000000-0000-4000-d461-000000000003' AND invited_box_id = '00000000-0000-4000-b461-0000000000a2' AND status = 'pending';
  PERFORM pg_temp.accord('E2 renvoi après échéance', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-0000000000a2', 'offered')$$);
  IF (SELECT string_agg(status, ',' ORDER BY created_at, status) FROM public.box_programming_invitations
       WHERE programming_id = '00000000-0000-4000-d461-000000000003' AND invited_box_id = '00000000-0000-4000-b461-0000000000a2')
     <> 'declined,expired,pending' THEN
    RAISE EXCEPTION 'E2 : historique inattendu : %', (SELECT string_agg(status, ',' ORDER BY created_at, status)
      FROM public.box_programming_invitations WHERE invited_box_id = '00000000-0000-4000-b461-0000000000a2'
       AND programming_id = '00000000-0000-4000-d461-000000000003');
  END IF;

  -- ── E3 · 20 par 24 h glissantes (box R, offre OR) ─────────────────────────
  FOR v_n IN 1..20 LOOP
    PERFORM pg_temp.inviter('6', '00001' || lpad(v_n::text, 2, '0'), 'offer_price');
  END LOOP;
  PERFORM pg_temp.refus('E3 21e invitation', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000006', '00000000-0000-4000-b461-000000000121', 'offer_price')$$,
    '23514 INVITATION_LIMITE');
  -- Une annulation ne rend pas de place : la limite compte les envois.
  PERFORM pg_temp.accord('E3 annulation', 'e0', format('SELECT public.cancel_programming_invitation(%L)',
    (SELECT id FROM public.box_programming_invitations WHERE invited_box_id = '00000000-0000-4000-b461-000000000101')));
  PERFORM pg_temp.refus('E3 21e après annulation', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000006', '00000000-0000-4000-b461-000000000121', 'offer_price')$$,
    '23514 INVITATION_LIMITE');
  UPDATE public.box_programming_invitations SET created_at = now() - interval '24 hours 1 second'
   WHERE invited_box_id = '00000000-0000-4000-b461-000000000102';
  PERFORM pg_temp.accord('E3 21e quand une a plus de 24 h', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000006', '00000000-0000-4000-b461-000000000121', 'offer_price')$$);
  -- La limite est par box éditrice : E n'est pas touchée par les envois de R.
  PERFORM pg_temp.accord('E3 autre box éditrice', 'e0',
    $$SELECT public.send_programming_invitation('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-000000000121', 'offered')$$);

  -- ── A1 · annuler ──────────────────────────────────────────────────────────
  v_id := pg_temp.inviter('3', '00000a1', 'offered');
  PERFORM pg_temp.refus('A1 box invitée', 'e1', format('SELECT public.cancel_programming_invitation(%L)', v_id), '42501 Accès refusé');
  PERFORM pg_temp.refus('A1 coach éditrice', 'c0', format('SELECT public.cancel_programming_invitation(%L)', v_id), '42501 Accès refusé');
  PERFORM pg_temp.accord('A1 gérant éditrice', 'e0', format('SELECT public.cancel_programming_invitation(%L)', v_id));
  PERFORM pg_temp.refus('A1 deux fois', 'e0', format('SELECT public.cancel_programming_invitation(%L)', v_id),
    '23514 INVITATION_PLUS_EN_ATTENTE');
  IF (SELECT status FROM public.box_programming_invitations WHERE id = v_id) <> 'cancelled' THEN
    RAISE EXCEPTION 'A1 : invitation non annulée';
  END IF;

  -- ── A2 · refuser ──────────────────────────────────────────────────────────
  v_id := pg_temp.inviter('3', '00000a1', 'offered');
  PERFORM pg_temp.refus('A2 éditrice', 'e0', format('SELECT public.decline_programming_invitation(%L)', v_id), '42501 Accès refusé');
  PERFORM pg_temp.refus('A2 coach invitée', 'c1', format('SELECT public.decline_programming_invitation(%L)', v_id), '42501 Accès refusé');
  UPDATE public.box_programming_invitations SET expires_at = now() - interval '1 second' WHERE id = v_id;
  PERFORM pg_temp.refus('A2 après expiration', 'e1', format('SELECT public.decline_programming_invitation(%L)', v_id),
    '23514 INVITATION_EXPIREE');
  UPDATE public.box_programming_invitations SET expires_at = now() + interval '1 day' WHERE id = v_id;
  PERFORM pg_temp.accord('A2 gérant invitée', 'e1', format('SELECT public.decline_programming_invitation(%L)', v_id));
  SELECT * INTO r FROM public.box_programming_invitations WHERE id = v_id;
  IF r.status <> 'declined' OR r.responded_at IS NULL THEN
    RAISE EXCEPTION 'A2 : refus inattendu : %', row_to_json(r);
  END IF;

  -- ── C1 / P1 avant acceptation ─────────────────────────────────────────────
  PERFORM pg_temp.en_tant_que('e1');
  SELECT string_agg(c.title || ':' || c.subscribed, ',' ORDER BY c.title) INTO v
    FROM public.list_programming_catalog('00000000-0000-4000-b461-0000000000a1') c WHERE c.title LIKE 'Inv %';
  PERFORM pg_temp.serveur();
  IF v IS DISTINCT FROM 'Inv OC:false,Inv OD:false,Inv OF:false,Inv OR:false' THEN
    RAISE EXCEPTION 'C1 : catalogue de I inattendu : %', v;
  END IF;
  PERFORM pg_temp.en_tant_que('e2');
  SELECT count(*) INTO v_n FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000001';
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'P1 : la box tierce lit l''offre « invitation »';
  END IF;
  PERFORM pg_temp.en_tant_que('e2');
  SELECT count(*) INTO v_n FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000002';
  PERFORM pg_temp.serveur();
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'P1 : la box tierce ne lit plus une offre « catalogue »';
  END IF;
  PERFORM pg_temp.en_tant_que('e1');
  SELECT count(*) INTO v_n FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000001';
  PERFORM pg_temp.serveur();
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'P1 : la box invitée (en attente) ne lit pas l''offre';
  END IF;
  PERFORM pg_temp.en_tant_que('c1');
  SELECT count(*) INTO v_n FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000001';
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'P1 : le coach de la box invitée lit l''offre avant tout abonnement';
  END IF;
  PERFORM pg_temp.en_tant_que('c0');
  SELECT count(*) INTO v_n FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000001';
  PERFORM pg_temp.serveur();
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'P1 : l''éditrice ne lit plus son offre';
  END IF;
  PERFORM set_config('role', 'anon', true);
  SELECT count(*) INTO v_n FROM public.box_programming WHERE title LIKE 'Inv %';
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'P1 : anon lit des offres';
  END IF;

  -- ── L1 / L2 · lectures ────────────────────────────────────────────────────
  PERFORM pg_temp.en_tant_que('e2');
  SELECT count(*) INTO v_n FROM public.box_programming_invitations WHERE invited_box_id = '00000000-0000-4000-b461-0000000000a1';
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN RAISE EXCEPTION 'L1 : une box tierce lit les invitations de I'; END IF;
  PERFORM pg_temp.en_tant_que('c1');
  SELECT count(*) INTO v_n FROM public.box_programming_invitations;
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN RAISE EXCEPTION 'L1 : le coach de I lit des invitations'; END IF;
  PERFORM pg_temp.en_tant_que('e1');
  SELECT count(*) INTO v_n FROM public.box_programming_invitations;
  PERFORM pg_temp.serveur();
  IF v_n <> 4 THEN RAISE EXCEPTION 'L1 : GI lit % invitations au lieu de 4', v_n; END IF;
  PERFORM pg_temp.refus('L1 insert client direct', 'e0',
    $$INSERT INTO public.box_programming_invitations (programming_id, publisher_box_id, invited_box_id, pricing)
      VALUES ('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000e0', '00000000-0000-4000-b461-0000000000a2', 'offered')$$,
    '42501');
  PERFORM pg_temp.refus('L2 reçues : coach', 'c1',
    $$SELECT * FROM public.list_my_programming_invitations('00000000-0000-4000-b461-0000000000a1')$$, '42501 Accès refusé');
  PERFORM pg_temp.en_tant_que('e1');
  SELECT string_agg(l.title || ':' || l.pricing || ':' || l.publisher_box_name || ':' || l.wods_total || ':'
                    || (l.preview_week1 -> 0 ->> 'day'), ',' ORDER BY l.title) INTO v
    FROM public.list_my_programming_invitations('00000000-0000-4000-b461-0000000000a1') l;
  PERFORM pg_temp.serveur();
  IF v IS DISTINCT FROM 'Inv OC:offer_price:Box Editrice:1:1,Inv OP:offered:Box Editrice:1:1' THEN
    RAISE EXCEPTION 'L2 : invitations reçues inattendues : %', v;
  END IF;
  PERFORM pg_temp.refus('L2 envoyées : box invitée', 'e1',
    $$SELECT * FROM public.list_programming_invitations_sent('00000000-0000-4000-d461-000000000003')$$, '42501 Accès refusé');
  -- Échue mais encore « pending » en base : la liste dit expired.
  UPDATE public.box_programming_invitations SET expires_at = now() - interval '1 second'
   WHERE programming_id = '00000000-0000-4000-d461-000000000003' AND invited_box_id = '00000000-0000-4000-b461-0000000000a2' AND status = 'pending';
  PERFORM pg_temp.en_tant_que('e0');
  SELECT string_agg(s.invited_box_name || ':' || s.status, ',' ORDER BY s.invited_box_name, s.status) INTO v
    FROM public.list_programming_invitations_sent('00000000-0000-4000-d461-000000000003') s
   WHERE s.invited_box_name LIKE 'Box %';
  PERFORM pg_temp.serveur();
  IF v IS DISTINCT FROM 'Box Invitation Invitee:cancelled,Box Invitation Invitee:declined,Box Invitation Tierce:declined,Box Invitation Tierce:expired,Box Invitation Tierce:expired' THEN
    RAISE EXCEPTION 'L2 : invitations envoyées inattendues : %', v;
  END IF;

  -- ── A3 · accepter ─────────────────────────────────────────────────────────
  PERFORM pg_temp.refus('A3 coach invitée', 'c1', format('SELECT public.accept_programming_invitation(%L)', v_inv_i), '42501 Accès refusé');
  PERFORM pg_temp.refus('A3 éditrice', 'e0', format('SELECT public.accept_programming_invitation(%L)', v_inv_i), '42501 Accès refusé');
  PERFORM pg_temp.refus('A3 au prix de l''offre', 'e1', format('SELECT public.accept_programming_invitation(%L)', v_inv_prix),
    '23514 INVITATION_PAIEMENT_REQUIS');
  UPDATE public.box_programming_invitations SET expires_at = now() - interval '1 second' WHERE id = v_inv_i;
  PERFORM pg_temp.refus('A3 après expiration', 'e1', format('SELECT public.accept_programming_invitation(%L)', v_inv_i),
    '23514 INVITATION_EXPIREE');
  UPDATE public.box_programming_invitations SET expires_at = now() + interval '1 day' WHERE id = v_inv_i;
  PERFORM pg_temp.en_tant_que('e1');
  v_sub := (public.accept_programming_invitation(v_inv_i) ->> 'subscription_id')::uuid;
  PERFORM pg_temp.serveur();
  SELECT * INTO r FROM public.box_programming_subscriptions WHERE id = v_sub;
  IF r.status <> 'active' OR r.invitation_id IS DISTINCT FROM v_inv_i OR r.auto_apply_weekly
     OR r.subscriber_box_id <> '00000000-0000-4000-b461-0000000000a1'
     OR r.current_period_end IS NOT NULL OR r.revoked_by_publisher_at IS NOT NULL
     OR r.stripe_subscription_id IS NOT NULL
     OR EXTRACT(isodow FROM r.week_anchor) <> 1 OR r.week_anchor <= (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'A3 : abonnement inattendu : %', row_to_json(r);
  END IF;
  SELECT * INTO r FROM public.box_programming_invitations WHERE id = v_inv_i;
  IF r.status <> 'accepted' OR r.subscription_id IS DISTINCT FROM v_sub OR r.responded_at IS NULL THEN
    RAISE EXCEPTION 'A3 : invitation inattendue après acceptation : %', row_to_json(r);
  END IF;
  -- Le réglage posé pour la garde ne survit pas à l'écriture.
  IF COALESCE(current_setting('athlex.invitation_programmation', true), '') <> '' THEN
    RAISE EXCEPTION 'A3 : le réglage athlex.invitation_programmation reste posé';
  END IF;
  PERFORM pg_temp.refus('A3 deux fois', 'e1', format('SELECT public.accept_programming_invitation(%L)', v_inv_i),
    '23514 INVITATION_PLUS_EN_ATTENTE');

  -- ── C1 / P1 après acceptation ─────────────────────────────────────────────
  PERFORM pg_temp.en_tant_que('e1');
  SELECT string_agg(c.title || ':' || c.subscribed, ',' ORDER BY c.title) INTO v
    FROM public.list_programming_catalog('00000000-0000-4000-b461-0000000000a1') c WHERE c.title LIKE 'Inv %';
  PERFORM pg_temp.serveur();
  IF v IS DISTINCT FROM 'Inv OC:false,Inv OD:false,Inv OF:false,Inv OP:true,Inv OR:false' THEN
    RAISE EXCEPTION 'C1 : catalogue de I abonnée inattendu : %', v;
  END IF;
  PERFORM pg_temp.en_tant_que('e2');
  SELECT string_agg(c.title, ',' ORDER BY c.title) INTO v
    FROM public.list_programming_catalog('00000000-0000-4000-b461-0000000000a2') c WHERE c.title LIKE 'Inv %';
  PERFORM pg_temp.serveur();
  IF v IS DISTINCT FROM 'Inv OC,Inv OD,Inv OF,Inv OR' THEN
    RAISE EXCEPTION 'C1 : catalogue de T inattendu : %', v;
  END IF;
  PERFORM pg_temp.en_tant_que('c1');
  SELECT count(*) INTO v_n FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000001';
  PERFORM pg_temp.serveur();
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'P1 : le coach de la box abonnée ne lit pas l''offre (couleurs de /wods)';
  END IF;

  -- ── G1 · invitation_id et revoked_by_publisher_at posés par le client ────
  PERFORM pg_temp.refus('G1 insert client avec invitation_id', 'e2',
    format($$INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status, invitation_id)
             VALUES ('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-0000000000a2', 'active', %L)$$, v_inv_i),
    '42501 INVITATION_RESERVEE');
  -- Le même insert sans invitation_id passe (offre gratuite) : c'est bien la colonne qui est refusée.
  PERFORM pg_temp.accord('G1 insert client sans invitation_id', 'e2',
    $$INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status)
      VALUES ('00000000-0000-4000-d461-000000000003', '00000000-0000-4000-b461-0000000000a2', 'active')$$);
  PERFORM pg_temp.refus('G1 update client de invitation_id', 'e2',
    format($$UPDATE public.box_programming_subscriptions SET invitation_id = %L
             WHERE programming_id = '00000000-0000-4000-d461-000000000003' AND subscriber_box_id = '00000000-0000-4000-b461-0000000000a2'$$, v_inv_i),
    '42501 INVITATION_RESERVEE');
  PERFORM pg_temp.refus('G1 update client de revoked_by_publisher_at', 'e1',
    format('UPDATE public.box_programming_subscriptions SET revoked_by_publisher_at = now() WHERE id = %L', v_sub),
    '42501 INVITATION_RESERVEE');
  -- Réglage forgé sur une invitation « Offerte » en attente de la même offre,
  -- mais pour une autre box : refusé.
  v_id := pg_temp.inviter('3', '00000a1', 'offered');
  PERFORM set_config('athlex.invitation_programmation', v_id::text, true);
  PERFORM pg_temp.refus('G1 réglage de garde forgé, invitation d''une autre box', 'e2',
    format($$UPDATE public.box_programming_subscriptions SET invitation_id = %L
              WHERE programming_id = '00000000-0000-4000-d461-000000000003' AND subscriber_box_id = '00000000-0000-4000-b461-0000000000a2'$$,
           v_id),
    '42501 INVITATION_RESERVEE');
  PERFORM set_config('athlex.invitation_programmation', '', true);
  -- Offre payante (OC) : l'insert client actif reste refusé comme avant.
  PERFORM pg_temp.refus('G1 offre payante sans paiement', 'e2',
    $$INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status)
      VALUES ('00000000-0000-4000-d461-000000000002', '00000000-0000-4000-b461-0000000000a2', 'active')$$,
    '42501 PAID_PROGRAMMING');

  -- ── G2 · offre « invitation » sans invitation ─────────────────────────────
  PERFORM pg_temp.refus('G2 backend sans invitation', '',
    $$INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status)
      VALUES ('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-0000000000a2', 'active')$$,
    '42501 INVITATION_REQUISE');
  PERFORM pg_temp.refus('G2 abonnement gratuit sans invitation', 'e2',
    $$SELECT public.subscribe_free_programming('00000000-0000-4000-d461-000000000005', '00000000-0000-4000-b461-0000000000a2')$$,
    '42501 INVITATION_REQUISE');
  v_inv_ofi := pg_temp.inviter('5', '00000a2', 'offered');
  PERFORM pg_temp.accord('G2 abonnement gratuit avec invitation', 'e2',
    $$SELECT public.subscribe_free_programming('00000000-0000-4000-d461-000000000005', '00000000-0000-4000-b461-0000000000a2')$$);
  -- Le paiement Stripe d'une invitation « au prix de l'offre » (PR 3) : backend, invitation en attente.
  PERFORM pg_temp.inviter('1', '0000121', 'offer_price');
  PERFORM pg_temp.accord('G2 backend avec invitation en attente', '',
    $$INSERT INTO public.box_programming_subscriptions (programming_id, subscriber_box_id, status)
      VALUES ('00000000-0000-4000-d461-000000000001', '00000000-0000-4000-b461-000000000121', 'active')$$);
  -- Renouvellement d'un abonnement existant : past_due → active n'est pas une entrée.
  UPDATE public.box_programming SET visibility = 'invitation' WHERE id = '00000000-0000-4000-d461-000000000002';
  UPDATE public.box_programming_subscriptions SET status = 'past_due' WHERE id = '00000000-0000-4000-f461-0000000000a5';
  PERFORM pg_temp.accord('G2 renouvellement', '',
    $$UPDATE public.box_programming_subscriptions SET status = 'active' WHERE id = '00000000-0000-4000-f461-0000000000a5'$$);
  UPDATE public.box_programming_subscriptions SET status = 'canceled' WHERE id = '00000000-0000-4000-f461-0000000000a5';
  PERFORM pg_temp.refus('G2 réabonnement après résiliation', '',
    $$UPDATE public.box_programming_subscriptions SET status = 'active' WHERE id = '00000000-0000-4000-f461-0000000000a5'$$,
    '42501 INVITATION_REQUISE');
  UPDATE public.box_programming SET visibility = 'catalogue' WHERE id = '00000000-0000-4000-d461-000000000002';

  -- ── R2 · retrait d'un accès « Offert » ────────────────────────────────────
  -- Une semaine déjà posée chez I depuis OP.
  INSERT INTO public.box_wods (box_id, title, is_published, scheduled_date, source_programming_id)
  VALUES ('00000000-0000-4000-b461-0000000000a1', 'Posé', true, CURRENT_DATE, '00000000-0000-4000-d461-000000000001');
  SELECT count(*) INTO v_wods FROM public.box_wods WHERE box_id = '00000000-0000-4000-b461-0000000000a1';
  -- La box abonnée allume l'application automatique : geste ouvert.
  PERFORM pg_temp.accord('R2 application automatique', 'e1',
    format('UPDATE public.box_programming_subscriptions SET auto_apply_weekly = true WHERE id = %L', v_sub));
  PERFORM pg_temp.refus('R2 box abonnée', 'e1', format('SELECT public.revoke_offered_programming_access(%L)', v_sub), '42501 Accès refusé');
  PERFORM pg_temp.refus('R2 coach éditrice', 'c0', format('SELECT public.revoke_offered_programming_access(%L)', v_sub), '42501 Accès refusé');
  PERFORM pg_temp.refus('R2 accès non offert', 'e0',
    $$SELECT public.revoke_offered_programming_access('00000000-0000-4000-f461-0000000000a5')$$, '23514 ACCES_NON_OFFERT');
  PERFORM pg_temp.en_tant_que('e0');
  v_fin := (public.revoke_offered_programming_access(v_sub) ->> 'access_ends_at')::timestamptz;
  PERFORM pg_temp.serveur();
  SELECT * INTO r FROM public.box_programming_subscriptions WHERE id = v_sub;
  -- Lundi 00:00 à Paris, dans les 7 jours à venir, strictement après maintenant.
  IF r.current_period_end IS DISTINCT FROM v_fin
     OR EXTRACT(isodow FROM (v_fin AT TIME ZONE 'Europe/Paris')) <> 1
     OR (v_fin AT TIME ZONE 'Europe/Paris')::time <> '00:00'
     OR v_fin <= now() OR v_fin > now() + interval '7 days'
     OR r.revoked_by_publisher_at IS NULL OR r.auto_apply_weekly OR r.status <> 'active'
     OR r.invitation_id IS DISTINCT FROM v_inv_i THEN
    RAISE EXCEPTION 'R2 : retrait inattendu (fin %) : %', v_fin, row_to_json(r);
  END IF;
  IF (SELECT count(*) FROM public.box_wods WHERE box_id = '00000000-0000-4000-b461-0000000000a1') <> v_wods THEN
    RAISE EXCEPTION 'R2 : le retrait a touché des WOD posés';
  END IF;
  IF COALESCE(current_setting('athlex.retrait_acces_offert', true), '') <> '' THEN
    RAISE EXCEPTION 'R2 : le réglage athlex.retrait_acces_offert reste posé';
  END IF;
  PERFORM pg_temp.refus('R2 rallumer l''application automatique', 'e1',
    format('UPDATE public.box_programming_subscriptions SET auto_apply_weekly = true WHERE id = %L', v_sub),
    '23514 ACCES_RETIRE');
  PERFORM pg_temp.refus('R2 deux fois', 'e0', format('SELECT public.revoke_offered_programming_access(%L)', v_sub),
    '23514 ACCES_DEJA_RETIRE');
  PERFORM pg_temp.refus('R2 la box abonnée efface la fin', 'e1',
    format('UPDATE public.box_programming_subscriptions SET current_period_end = NULL WHERE id = %L', v_sub),
    '42501 PAID_PROGRAMMING');
  -- La pose du lundi suivant (dimanche 18:00) ne pose plus rien chez I.
  PERFORM public.materialize_box_programming((v_fin AT TIME ZONE 'Europe/Paris')::date);
  IF (SELECT count(*) FROM public.box_wods WHERE box_id = '00000000-0000-4000-b461-0000000000a1') <> v_wods THEN
    RAISE EXCEPTION 'R2 : une semaine a été posée après le retrait';
  END IF;
  -- Après le lundi : l'accès est fini pour toutes les lectures qui filtrent sur la fin.
  UPDATE public.box_programming_subscriptions SET current_period_end = now() - interval '1 second' WHERE id = v_sub;
  PERFORM pg_temp.en_tant_que('e1');
  SELECT count(*) INTO v_n FROM public.list_applicable_programmings('00000000-0000-4000-b461-0000000000a1')
   WHERE programming_id = '00000000-0000-4000-d461-000000000001';
  PERFORM pg_temp.serveur();
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'R2 : l''offre reste applicable après la fin de l''accès';
  END IF;
  -- « Renvoyer » après un retrait : nouvelle invitation acceptée, accès rouvert.
  v_id := pg_temp.inviter('1', '00000a1', 'offered');
  PERFORM pg_temp.accord('R2 réinvitation acceptée', 'e1', format('SELECT public.accept_programming_invitation(%L)', v_id));
  SELECT * INTO r FROM public.box_programming_subscriptions WHERE id = v_sub;
  IF r.invitation_id IS DISTINCT FROM v_id OR r.current_period_end IS NOT NULL OR r.revoked_by_publisher_at IS NOT NULL THEN
    RAISE EXCEPTION 'R2 : réinvitation inattendue : %', row_to_json(r);
  END IF;

  -- ── X1 · expiration ───────────────────────────────────────────────────────
  UPDATE public.box_programming_invitations SET expires_at = now() - interval '1 second' WHERE id = v_inv_prix;
  v_n := internal.expire_programming_invitations();
  IF v_n < 1
     OR (SELECT status FROM public.box_programming_invitations WHERE id = v_inv_prix) <> 'expired'
     OR EXISTS (SELECT 1 FROM public.box_programming_invitations WHERE status = 'pending' AND expires_at <= now()) THEN
    RAISE EXCEPTION 'X1 : expiration inattendue (% passées, statut %)', v_n,
      (SELECT status FROM public.box_programming_invitations WHERE id = v_inv_prix);
  END IF;
  IF (SELECT status FROM public.box_programming_invitations WHERE id = v_inv_ofi) <> 'pending' THEN
    RAISE EXCEPTION 'X1 : une invitation valide a expiré';
  END IF;
  IF to_regclass('cron.job') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'programming-invitations-expire'
                      AND schedule = '23 3 * * *'
                      AND command LIKE '%internal.expire_programming_invitations()%'
                      AND command NOT LIKE '%http%') THEN
    RAISE EXCEPTION 'X1 : tâche pg_cron absente ou inattendue';
  END IF;

  -- ── X2 · dépublier, supprimer ─────────────────────────────────────────────
  v_id := pg_temp.inviter('7', '00000a1', 'offered');
  PERFORM pg_temp.en_tant_que('e1');
  PERFORM public.accept_programming_invitation(v_id);
  PERFORM pg_temp.serveur();
  v_id := pg_temp.inviter('7', '00000a2', 'offered');
  PERFORM pg_temp.accord('X2 dépublier', 'e0',
    $$UPDATE public.box_programming SET is_published = false WHERE id = '00000000-0000-4000-d461-000000000007'$$);
  IF (SELECT string_agg(status, ',' ORDER BY status) FROM public.box_programming_invitations
       WHERE programming_id = '00000000-0000-4000-d461-000000000007') <> 'accepted,cancelled' THEN
    RAISE EXCEPTION 'X2 : dépublication inattendue : %', (SELECT string_agg(status, ',' ORDER BY status)
      FROM public.box_programming_invitations WHERE programming_id = '00000000-0000-4000-d461-000000000007');
  END IF;
  DELETE FROM public.box_programming WHERE id = '00000000-0000-4000-d461-000000000007';
  IF EXISTS (SELECT 1 FROM public.box_programming_invitations WHERE programming_id = '00000000-0000-4000-d461-000000000007') THEN
    RAISE EXCEPTION 'X2 : invitations restées après suppression de l''offre';
  END IF;

  -- ── F1 · définitions épinglées ────────────────────────────────────────────
  IF md5(pg_get_functiondef('public.guard_box_programming_subscription()'::regprocedure)) <> '344a90c407ea17743dacd0b4e9ff536d' THEN
    RAISE EXCEPTION 'F1 : la garde n''est plus celle de 20270167 (md5 %)',
      md5(pg_get_functiondef('public.guard_box_programming_subscription()'::regprocedure));
  END IF;
  IF md5(pg_get_functiondef('public.list_programming_catalog(uuid)'::regprocedure)) <> 'c15f6e946d0f8b87cac9ae6432c6be4f' THEN
    RAISE EXCEPTION 'F1 : le catalogue n''est plus celui de 20270167 (md5 %)',
      md5(pg_get_functiondef('public.list_programming_catalog(uuid)'::regprocedure));
  END IF;
  SELECT md5(array_to_string(roles::text[], ',') || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''))
    INTO v FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_programming' AND policyname = 'box_programming_select';
  IF v IS DISTINCT FROM '51250a15282ecc21415368b56331d6b0' THEN
    RAISE EXCEPTION 'F1 : la policy box_programming_select n''est plus celle de 20270167 (md5 %)', v;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.box_programming_invitations) THEN
    RAISE EXCEPTION 'R1 : aucune invitation pour prouver le refus du retour';
  END IF;
END $t$;

-- R1 : le retour arrière, d'abord refusé (des invitations existent)…
SAVEPOINT avant_retour;
\set ON_ERROR_STOP off
\echo '    (R1 : le refus attendu du retour arrière suit)'
\i supabase/retours/20270167000000_programming_invitations.sql
\set ON_ERROR_STOP on
\if :ERROR
ROLLBACK TO SAVEPOINT avant_retour;
\else
\echo 'R1 : le retour arrière a agi alors que des invitations existent'
SELECT 1 / 0;
\endif

-- … puis joué sur une base sans invitation.
DELETE FROM public.box_programming_invitations;
\i supabase/retours/20270167000000_programming_invitations.sql

DO $r$
DECLARE
  v text;
BEGIN
  IF md5(pg_get_functiondef('public.guard_box_programming_subscription()'::regprocedure)) <> '396574b203eb878a8a1cbcbcbaf5bf53' THEN
    RAISE EXCEPTION 'R1 : garde différente de la prod après retour (md5 %)',
      md5(pg_get_functiondef('public.guard_box_programming_subscription()'::regprocedure));
  END IF;
  IF md5(pg_get_functiondef('public.list_programming_catalog(uuid)'::regprocedure)) <> '06329551f541f43204806c3bfeffc4da' THEN
    RAISE EXCEPTION 'R1 : catalogue différent de la prod après retour (md5 %)',
      md5(pg_get_functiondef('public.list_programming_catalog(uuid)'::regprocedure));
  END IF;
  SELECT md5(array_to_string(roles::text[], ',') || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''))
    INTO v FROM pg_policies WHERE schemaname = 'public' AND tablename = 'box_programming' AND policyname = 'box_programming_select';
  IF v IS DISTINCT FROM 'e0101c97b3047731ff3bf08fdb0e243e' THEN
    RAISE EXCEPTION 'R1 : policy différente de la prod après retour (md5 %)', v;
  END IF;
  IF to_regclass('public.box_programming_invitations') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND ((table_name = 'box_programming' AND column_name = 'visibility')
                   OR (table_name = 'box_programming_subscriptions' AND column_name IN ('invitation_id', 'revoked_by_publisher_at'))))
     OR EXISTS (SELECT 1 FROM pg_proc WHERE proname IN ('search_boxes_for_invitation', 'send_programming_invitation',
                 'cancel_programming_invitation', 'decline_programming_invitation', 'accept_programming_invitation',
                 'revoke_offered_programming_access', 'list_my_programming_invitations', 'list_programming_invitations_sent',
                 'programming_visible_by_invitation', 'expire_programming_invitations', 'annuler_invitations_offre_depubliee'))
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_box_programming_depubliee_invitations')
     OR (to_regclass('cron.job') IS NOT NULL
         AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'programming-invitations-expire')) THEN
    RAISE EXCEPTION 'R1 : un objet de 20270167 subsiste après retour';
  END IF;
END $r$;

ROLLBACK;
\echo '    D1, S1, E1 à E3, A1 à A3, G1, G2, C1, P1, L1, L2, R2, X1, X2, F1, R1 OK'
