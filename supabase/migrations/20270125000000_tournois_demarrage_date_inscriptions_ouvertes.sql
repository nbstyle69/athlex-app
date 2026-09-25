-- ═════════════════════════════════════════════════════════════════════════════
-- Tournois : démarrage à la date de début ; option « inscriptions ouvertes
-- pendant le tournoi » — tournois, PR 10
--
-- Appliquée en prod : OUI, le 25/09/2026 à 17:55 UTC, avec PGCLIENTENCODING=UTF8
-- (dump des schémas public et internal avec droits
-- db-dumps/2026-09-25/athlex-prod-public-internal-20260925T175423Z.dump,
-- sha256 9d66b4b3824f7dcd7a973fe346e6f69e5d6a3792292f6acf0e4fceabc0062eee vérifié
-- après aller-retour, 132 TABLE DATA, 422 ACL, 343 POLICY ; précontrôles : les
-- six fonctions concernées identiques au dépôt (aucun écart de fin de ligne),
-- déclencheurs et cron inchangés, 8 tournois dont 2 « open » (1 à date passée) ;
-- vérifications : md5 de tournaments (hors colonne ajoutée), des participants,
-- des divisions et des WOD identiques avant/après, définitions, droits et
-- déclencheur identiques au fichier ; audit des droits en prod 29/29 ; le
-- tournoi « open » à date passée a démarré au passage du cron de 18:00 UTC ;
-- tests réels en transaction annulée.)
--
-- Décisions du 25/09/2026.
--
-- Démarrage automatique. Un tournoi « open » passe « active » à sa date de
-- début, à 00:00 heure de Paris, ou à l'ouverture de son premier WOD si elle
-- arrive avant. Le mécanisme existant reste (`trg_tournament_wod_activation`,
-- cron `tournament_activation_sweep` toutes les 15 minutes, qui appelle
-- `sync_tournament_activation`) ; le cron reçoit le critère de date. Sans
-- date de début, seul le premier WOD compte. Un tournoi archivé ne démarre
-- jamais automatiquement. Le jour est celui de `start_date` lu à Paris : le
-- Manager enregistre minuit heure locale, une date saisie avec une heure
-- démarre quand même à 00:00 ce jour-là.
--
-- Inscriptions (`tournaments.registrations_open_during_tournament`, fausse
-- par défaut : les tournois existants gardent leur comportement). La règle
-- vit en un seul endroit, `internal.motif_refus_inscription(tournoi,
-- athlète)`, qui rend la raison d'un refus ou NULL :
--   * toujours : tournoi archivé, hors de la box, genre cible, `max_participants`
--     atteint — les conditions d'avant, plus l'archivage ;
--   * tournoi « open » : inscription permise ;
--   * tournoi terminé, ou démarré sans l'option : refusée ;
--   * démarré avec l'option, selon le format :
--       - compétition classique : permise ;
--       - tableau et double élimination : permise tant que le premier tour
--         n'est pas tiré (aucun match), refusée ensuite (« tableau déjà tiré ») ;
--       - ligue : permise seulement s'il reste de la place dans la division
--         la plus basse (le plus grand `level`, capacité `max_members`) ;
--         refusée sinon, sans débordement ni placement ailleurs.
-- `can_join_tournament` (le prédicat de la règle d'inscription de l'athlète)
-- n'en est plus que le reflet. Un déclencheur BEFORE INSERT sur
-- `tournament_participants` dit la raison en clair : pour l'athlète qui
-- s'inscrit lui-même, la règle entière ; pour tous, staff et clé serveur
-- compris, le refus sur un tournoi archivé. Le staff ajoute toujours un
-- participant, comme avant, sauf sur un tournoi archivé.
--
-- Placement en ligue. Avant le démarrage, rien ne change
-- (`internal.affecter_divisions`, #357). Après, `trg_participants_affecter_division`
-- ne place plus le nouvel inscrit par son ELO avec débordement, et ne
-- recalcule plus les placements des autres : il le met dans la division la
-- plus basse s'il y reste de la place, et nulle part sinon (un ajout du staff
-- dans une division pleine reste à placer à la main).
--
-- WOD déjà passés pour un inscrit tardif : un WOD n'accepte un score que s'il
-- est actif et dans sa fenêtre (`tournament_wod_accepts_scores`, inchangée) ;
-- un WOD fermé à l'inscription le reste donc pour lui, et il y a 0 point
-- (aucun score). Le WOD en cours à son inscription lui est ouvert, comme aux
-- autres.
--
-- Contrôlée par `supabase/tests/tournois_demarrage_inscriptions.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.tournaments
  ADD COLUMN registrations_open_during_tournament boolean NOT NULL DEFAULT false;

-- La raison pour laquelle cet athlète ne peut pas s'inscrire, ou NULL.
CREATE FUNCTION internal.motif_refus_inscription(p_tournament_id uuid, p_athlete_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  t record;
  v_div uuid;
  v_cap integer;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN 'TOURNOI_INCONNU: ce tournoi n''existe pas.';
  END IF;
  IF t.archived_at IS NOT NULL THEN
    RETURN 'TOURNOI_ARCHIVE: ce tournoi est archivé, les inscriptions sont fermées.';
  END IF;
  IF NOT (
       EXISTS (SELECT 1 FROM public.boxes b WHERE b.id = t.box_id AND b.owner_id = p_athlete_id)
    OR EXISTS (SELECT 1 FROM public.box_members bm
                WHERE bm.box_id = t.box_id AND bm.member_id = p_athlete_id
                  AND COALESCE(bm.status, 'active') = 'active')
    OR EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = p_athlete_id AND p.role IN ('admin', 'super_admin'))
  ) THEN
    RETURN 'HORS_BOX: ce tournoi est réservé aux membres de la box.';
  END IF;
  IF COALESCE(t.gender_target, 'mix') <> 'mix'
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_athlete_id AND p.gender = t.gender_target) THEN
    RETURN 'GENRE_CIBLE: ce tournoi est réservé à une autre catégorie.';
  END IF;
  IF (SELECT count(*) FROM public.tournament_participants tp WHERE tp.tournament_id = t.id)
     >= COALESCE(t.max_participants, 2147483647) THEN
    RETURN 'TOURNOI_COMPLET: le nombre maximal de participants est atteint.';
  END IF;

  IF t.status = 'open' THEN
    RETURN NULL;
  END IF;
  IF t.status <> 'active' THEN
    RETURN 'INSCRIPTIONS_FERMEES: le tournoi est terminé.';
  END IF;
  IF NOT t.registrations_open_during_tournament THEN
    RETURN 'INSCRIPTIONS_FERMEES: le tournoi a démarré, les inscriptions sont closes.';
  END IF;

  IF t.format IN ('bracket', 'swiss') THEN
    IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches m WHERE m.tournament_id = t.id) THEN
      RETURN 'TABLEAU_DEJA_TIRE: le tableau est déjà tiré, les inscriptions sont closes.';
    END IF;
  ELSIF t.format = 'league_div' THEN
    SELECT d.id, d.max_members INTO v_div, v_cap
      FROM public.tournament_divisions d
     WHERE d.tournament_id = t.id
     ORDER BY d.level DESC
     LIMIT 1;
    IF v_div IS NULL THEN
      RETURN 'DIVISION_INDISPONIBLE: la ligue n''a pas de division ouverte aux inscriptions.';
    END IF;
    IF (SELECT count(*) FROM public.tournament_division_members m WHERE m.division_id = v_div)
       >= COALESCE(v_cap, 2147483647) THEN
      RETURN 'DIVISION_PLEINE: la division d''entrée de la ligue est complète.';
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION internal.motif_refus_inscription(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Prédicat de la règle d'inscription de l'athlète : le reflet de la règle.
CREATE OR REPLACE FUNCTION public.can_join_tournament(p_tournament_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND internal.motif_refus_inscription(p_tournament_id, auth.uid()) IS NULL;
$function$;

-- La raison en clair, avant la règle RLS (qui ne dirait que « row-level
-- security »). Le staff et la clé serveur ne sont arrêtés que par l'archivage.
CREATE FUNCTION internal.controler_inscription_tournoi()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_box uuid;
  v_archive timestamptz;
  v_motif text;
BEGIN
  SELECT box_id, archived_at INTO v_box, v_archive FROM public.tournaments WHERE id = NEW.tournament_id;
  IF v_archive IS NOT NULL THEN
    RAISE EXCEPTION 'TOURNOI_ARCHIVE: ce tournoi est archivé, les inscriptions sont fermées.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF auth.uid() IS NOT DISTINCT FROM NEW.athlete_id AND NOT public.is_box_admin(v_box) THEN
    v_motif := internal.motif_refus_inscription(NEW.tournament_id, NEW.athlete_id);
    IF v_motif IS NOT NULL THEN
      RAISE EXCEPTION '%', v_motif USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.controler_inscription_tournoi() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_participants_controle_inscription
  BEFORE INSERT ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION internal.controler_inscription_tournoi();

-- Placement en ligue : inchangé avant le démarrage ; ensuite, la division la
-- plus basse s'il y reste de la place, nulle part sinon.
CREATE OR REPLACE FUNCTION public.trg_participants_affecter_division()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
  v_format text;
  v_div uuid;
  v_cap integer;
BEGIN
  SELECT status, format INTO v_status, v_format FROM tournaments WHERE id = NEW.tournament_id;
  IF v_status = 'open' THEN
    PERFORM internal.affecter_divisions(NEW.tournament_id);
    RETURN NEW;
  END IF;
  IF v_format IS DISTINCT FROM 'league_div'
     OR EXISTS (SELECT 1 FROM tournament_division_members m JOIN tournament_divisions d ON d.id = m.division_id
                 WHERE d.tournament_id = NEW.tournament_id AND m.athlete_id = NEW.athlete_id) THEN
    RETURN NEW;
  END IF;
  SELECT id, max_members INTO v_div, v_cap
    FROM tournament_divisions WHERE tournament_id = NEW.tournament_id
   ORDER BY level DESC LIMIT 1;
  IF v_div IS NOT NULL
     AND (SELECT count(*) FROM tournament_division_members WHERE division_id = v_div) < COALESCE(v_cap, 2147483647) THEN
    PERFORM set_config('athlex.affectation_divisions', 'on', true);
    INSERT INTO tournament_division_members (division_id, athlete_id, points, rank, placement)
    VALUES (v_div, NEW.athlete_id, 0, NULL, 'auto');
    PERFORM set_config('athlex.affectation_divisions', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

-- Démarrage : premier WOD ouvert, ou date de début atteinte (00:00 à Paris) ;
-- jamais un tournoi archivé.
CREATE OR REPLACE FUNCTION public.sync_tournament_activation()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  UPDATE tournaments t
     SET status = 'active'
   WHERE t.status = 'open'
     AND t.archived_at IS NULL
     AND (
       EXISTS (
         SELECT 1 FROM tournament_wods w
          WHERE w.tournament_id = t.id
            AND w.status = 'active'
            AND (w.opens_at IS NULL OR w.opens_at <= now())
       )
       OR ((t.start_date AT TIME ZONE 'Europe/Paris')::date::timestamp AT TIME ZONE 'Europe/Paris') <= now()
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_tournament_wod_activation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'active' AND (NEW.opens_at IS NULL OR NEW.opens_at <= now()) THEN
    UPDATE tournaments SET status = 'active'
     WHERE id = NEW.tournament_id AND status = 'open' AND archived_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
