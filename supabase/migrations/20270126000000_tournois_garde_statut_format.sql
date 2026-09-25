-- ═════════════════════════════════════════════════════════════════════════════
-- Tournois : le format ne change jamais, le statut n'avance que vers l'avant
--
-- Appliquée en prod : NON
--
-- Décision du 25/09/2026. Le Manager (#387, #388) empêche déjà son formulaire
-- de changer le format et de faire reculer le statut ; la même garde vit
-- désormais en base, pour tout chemin d'écriture (app, Manager, clé serveur,
-- SQL) :
--   * `format` : jamais modifié après la création (`FORMAT_FIGE`) ;
--   * `status` :
--       - `open` → `active` : permis (démarrage manuel, cron, ouverture d'un WOD) ;
--       - `active` → `open` : refusé (`STATUT_RECUL`) ;
--       - `completed` → autre chose : refusé (`TOURNOI_CLOTURE`) ;
--       - passage à `completed` : seulement par la clôture dédiée,
--         `finalize_tournament_elo`, qui calcule l'ELO final ; une mise à jour
--         directe est refusée (`CLOTURE_DEDIEE`).
--
-- Reconnaître la clôture dédiée : `finalize_tournament_elo` pose, juste
-- avant sa mise à jour, le réglage `athlex.cloture_tournoi` à l'identifiant
-- du tournoi qu'elle clôt — local à la transaction (`set_config(…, true)`),
-- remis à vide juste après. La garde n'accepte `completed` que si ce réglage
-- vaut l'identifiant de la ligne mise à jour. Pourquoi ce moyen :
--   * aucun client ne peut le poser : PostgREST n'expose ni `SET` ni
--     `set_config` (hors du schéma exposé), et aucune fonction exposée ne pose
--     ce réglage à partir d'une entrée de l'appelant ;
--   * il ne vaut que pour ce tournoi et cette transaction : il ne peut ni
--     fuir vers une autre ligne, ni survivre à la requête ;
--   * c'est le motif déjà en place pour le placement en ligue
--     (`athlex.affectation_divisions`, migration 20270115) ;
--   * les autres moyens sont moins sûrs : `current_user` vaut le propriétaire
--     dans toute fonction SECURITY DEFINER (il laisserait passer le cron ou
--     n'importe quelle autre fonction), et `pg_trigger_depth()` ne distingue
--     pas la clôture d'un autre déclencheur.
--
-- `finalize_tournament_elo` est reprise de sa définition en prod, octet pour
-- octet ; seule change sa mise à jour du statut, encadrée par le réglage.
--
-- Contrôlée par `supabase/tests/tournois_garde_statut_format.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE FUNCTION internal.garder_statut_format_tournoi()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.format IS DISTINCT FROM OLD.format THEN
    RAISE EXCEPTION 'FORMAT_FIGE: le format d''un tournoi ne change pas après sa création.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'TOURNOI_CLOTURE: un tournoi clôturé ne change plus de statut.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'completed' THEN
    IF current_setting('athlex.cloture_tournoi', true) IS DISTINCT FROM OLD.id::text THEN
      RAISE EXCEPTION 'CLOTURE_DEDIEE: un tournoi se clôture par la clôture dédiée, qui calcule l''ELO final, pas par une mise à jour directe.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'active' AND NEW.status = 'open' THEN
    RAISE EXCEPTION 'STATUT_RECUL: un tournoi démarré ne revient pas aux inscriptions.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.garder_statut_format_tournoi() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_tournaments_statut_format
  BEFORE UPDATE OF status, format ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION internal.garder_statut_format_tournoi();

CREATE OR REPLACE FUNCTION public.finalize_tournament_elo(p_tournament_id uuid)
 RETURNS TABLE(athlete_id uuid, username text, final_rank integer, elo_before integer, elo_after integer, elo_change integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
DECLARE
  v_box_id  uuid;
  v_format  text;
  v_status  text;
  v_n       int;
  v_avg     int;
  v_pending int;
  v_alive   int;
  v_bad     int;
  k_tourn   constant numeric := 48;
BEGIN
  SELECT t.box_id, t.format, t.status INTO v_box_id, v_format, v_status
    FROM tournaments t WHERE t.id = p_tournament_id;
  IF v_box_id IS NULL THEN
    RAISE EXCEPTION 'TOURNOI_INCONNU' USING ERRCODE = 'no_data_found';
  END IF;

  -- Gérant ou co-gérant de la box du tournoi. Pas le coach.
  IF NOT public.is_box_owner_admin(v_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box du tournoi requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('t:' || p_tournament_id::text));

  -- Idempotence par refus : une clôture ne se rejoue pas.
  IF v_status = 'completed'
     OR EXISTS (SELECT 1 FROM tournament_elo_history h WHERE h.tournament_id = p_tournament_id) THEN
    RAISE EXCEPTION 'TOURNOI_DEJA_CLOTURE : l''ELO de ce tournoi a déjà été distribué'
      USING ERRCODE = 'check_violation';
  END IF;

  CREATE TEMP TABLE _ft_rank (athlete_id uuid PRIMARY KEY, final_rank int NOT NULL) ON COMMIT DROP;

  IF v_format = 'simple' THEN
    SELECT COUNT(*) INTO v_pending FROM tournament_scores s
     WHERE s.tournament_id = p_tournament_id AND s.status = 'pending';
    IF v_pending > 0 THEN
      RAISE EXCEPTION 'SCORES_EN_ATTENTE : % score(s) à valider ou rejeter avant la clôture', v_pending
        USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO _ft_rank SELECT s.athlete_id, s.final_rank FROM public.tournament_classique_standings(p_tournament_id) s;

  ELSIF v_format IN ('bracket', 'swiss') THEN
    INSERT INTO _ft_rank
      SELECT s.athlete_id, s.final_rank FROM public.tournament_bracket_standings(p_tournament_id) s;
    SELECT COUNT(*) INTO v_alive FROM public.tournament_bracket_standings(p_tournament_id) s WHERE s.still_alive;
    IF v_alive > 0 OR NOT EXISTS (SELECT 1 FROM _ft_rank WHERE final_rank = 1) THEN
      RAISE EXCEPTION 'TABLEAU_NON_TERMINE : % athlète(s) encore en lice', v_alive
        USING ERRCODE = 'check_violation';
    END IF;
    -- Inscrits jamais entrés dans le tableau : derniers, ex-aequo.
    INSERT INTO _ft_rank
      SELECT tp.athlete_id, (SELECT COUNT(*) FROM _ft_rank) + 1
        FROM tournament_participants tp
       WHERE tp.tournament_id = p_tournament_id
         AND NOT EXISTS (SELECT 1 FROM _ft_rank r WHERE r.athlete_id = tp.athlete_id);

  ELSIF v_format = 'league_div' THEN
    INSERT INTO _ft_rank
      SELECT tdm.athlete_id,
             RANK() OVER (ORDER BY d.level ASC, tdm.points DESC, COALESCE(tdm.rank, 999999) ASC)::int
        FROM tournament_division_members tdm
        JOIN tournament_divisions d ON d.id = tdm.division_id
       WHERE d.tournament_id = p_tournament_id;
  ELSE
    RAISE EXCEPTION 'FORMAT_INCONNU : %', v_format;
  END IF;

  SELECT COUNT(*) INTO v_n FROM _ft_rank;

  IF v_format = 'simple' THEN
    -- Classique : l'ELO du tournoi se distribue ici (k = 48, même formule que
    -- `calcTournamentElo` côté web et que l'ancienne compute_tournament_elo).
    CREATE TEMP TABLE _ft_field ON COMMIT DROP AS
      SELECT r.athlete_id, r.final_rank, COALESCE(p.elo, 1000)::int AS elo
        FROM _ft_rank r JOIN profiles p ON p.id = r.athlete_id;
    SELECT ROUND(AVG(elo))::int INTO v_avg FROM _ft_field;

    CREATE TEMP TABLE _ft_deltas ON COMMIT DROP AS
      SELECT f.athlete_id, f.final_rank, f.elo AS elo_before,
             CASE WHEN v_n < 2 THEN 0 ELSE
               ROUND( k_tourn * (
                 ((v_n - f.final_rank)::numeric / (v_n - 1))
                 - (1 / (1 + POWER(10, (v_avg - f.elo) / 400.0)))
               ) )::int END AS elo_change
        FROM _ft_field f;

    INSERT INTO tournament_elo_history
      (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change)
    SELECT p_tournament_id, d.athlete_id, d.final_rank, v_n, v_avg,
           d.elo_before, GREATEST(100, d.elo_before + d.elo_change),
           GREATEST(100, d.elo_before + d.elo_change) - d.elo_before
      FROM _ft_deltas d;

    UPDATE profiles p
       SET elo           = GREATEST(100, d.elo_before + d.elo_change),
           total_matches = p.total_matches + 1,
           wins          = p.wins + (CASE WHEN d.final_rank = 1 THEN 1 ELSE 0 END)
      FROM _ft_deltas d
     WHERE p.id = d.athlete_id;

  ELSE
    -- Tableaux et ligue : ELO déjà distribué match par match / WOD par WOD.
    -- Ligne récapitulative, aucun point ajouté, profil inchangé.
    INSERT INTO tournament_elo_history
      (tournament_id, athlete_id, final_rank, participants_count, avg_opponent_elo, elo_before, elo_after, elo_change)
    SELECT p_tournament_id, r.athlete_id, r.final_rank, v_n,
           ROUND(AVG(COALESCE(p.elo, 1000)) OVER ())::int,
           COALESCE(
             (SELECT h.elo_before FROM tournament_match_elo_history h
               WHERE h.tournament_id = p_tournament_id AND h.athlete_id = r.athlete_id
               ORDER BY h.created_at ASC, h.id ASC LIMIT 1),
             (SELECT h.elo_before FROM tournament_wod_elo_history h
               WHERE h.tournament_id = p_tournament_id AND h.athlete_id = r.athlete_id
               ORDER BY h.created_at ASC, h.id ASC LIMIT 1),
             COALESCE(p.elo, 1000)),
           COALESCE(p.elo, 1000),
           COALESCE(p.elo, 1000) - COALESCE(
             (SELECT h.elo_before FROM tournament_match_elo_history h
               WHERE h.tournament_id = p_tournament_id AND h.athlete_id = r.athlete_id
               ORDER BY h.created_at ASC, h.id ASC LIMIT 1),
             (SELECT h.elo_before FROM tournament_wod_elo_history h
               WHERE h.tournament_id = p_tournament_id AND h.athlete_id = r.athlete_id
               ORDER BY h.created_at ASC, h.id ASC LIMIT 1),
             COALESCE(p.elo, 1000))
      FROM _ft_rank r JOIN profiles p ON p.id = r.athlete_id;
  END IF;

  -- Seule voie vers « completed » : la garde `internal.garder_statut_format_tournoi`
  -- reconnaît ce réglage, local à la transaction et limité à ce tournoi.
  PERFORM set_config('athlex.cloture_tournoi', p_tournament_id::text, true);
  UPDATE tournaments SET status = 'completed' WHERE id = p_tournament_id;
  PERFORM set_config('athlex.cloture_tournoi', '', true);

  -- Invariant : profil = dernier elo_after, pour chaque participant, avant de
  -- rendre la main. Un écart annule toute la transaction.
  SELECT COUNT(*) INTO v_bad
    FROM tournament_elo_history h JOIN profiles p ON p.id = h.athlete_id
   WHERE h.tournament_id = p_tournament_id AND p.elo <> h.elo_after;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'ELO_INCOHERENT : % profil(s) ≠ elo_after après clôture', v_bad
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN QUERY
    SELECT h.athlete_id, p.username, h.final_rank, h.elo_before, h.elo_after, h.elo_change
      FROM tournament_elo_history h JOIN profiles p ON p.id = h.athlete_id
     WHERE h.tournament_id = p_tournament_id
     ORDER BY h.final_rank, p.username;
END;
$function$;

COMMIT;
