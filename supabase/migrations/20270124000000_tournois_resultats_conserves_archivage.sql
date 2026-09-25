-- ═════════════════════════════════════════════════════════════════════════════
-- Tournois : un résultat validé ne disparaît jamais ; archivage des tournois
--
-- Appliquée en prod : NON
--
-- Décision produit du 25/09/2026 : un résultat validé ne disparaît jamais, mais
-- une erreur de saisie se corrige.
--   * supprimer un tournoi qui a un résultat validé : refusé ; on l'archive, son
--     ELO et ses historiques restent ;
--   * supprimer un match de tableau terminé : refusé ; la correction passe par
--     la remise à jouer ou le choix du vainqueur, qui recalculent l'ELO
--     (#348), comme le forfait posé sur un match terminé (#355) — inchangés ;
--   * droits inchangés : gérant, co-gérant, coach et admin plateforme
--     (`is_box_admin`) suppriment un tournoi sans résultat et archivent.
--
-- « Résultat validé » d'un tournoi (`internal.tournoi_resultat_valide`) — ce
-- qu'une suppression effacerait et que la règle protège :
--   * statut `completed` : le tournoi est clôturé ;
--   * un match de tableau terminé (`completed`) ou déclaré forfait
--     (`forfeit`) : un résultat sportif, avec ou sans ELO. Une exemption
--     (`bye`) n'en est pas un : posée par le tirage, sans adversaire ni ELO —
--     régénérer un tableau pas encore joué doit rester possible ;
--   * un score validé (`tournament_scores.status = 'validated'`) ;
--   * une saison de ligue close (`tournament_season_history`), qui partirait en
--     cascade avec le tournoi ;
--   * une ligne d'historique ELO rattachée au tournoi : match
--     (`tournament_match_elo_history`), WOD de ligue calculé
--     (`tournament_wod_elo_history`), clôture (`tournament_elo_history`). Elle
--     prouve qu'un ELO a été appliqué, même si le résultat qui l'a produit a
--     changé depuis (score rejeté après calcul, par exemple).
-- « Match terminé » : `completed` ou `forfeit`, ou un historique ELO de match —
-- le même critère, à l'échelle du match.
--
-- Les deux déclencheurs qui retiraient l'ELO à la suppression (#351) sont
-- retirés : `trg_tournaments_defaire_elo` (tournoi) et
-- `trg_bracket_match_elo_suppression` (match seul). Avec les refus, ce qu'ils
-- pourraient retirer ne peut plus être supprimé : ils n'ont plus d'effet utile.
-- Les garder ne serait pas neutre : `trg_tournaments_defaire_elo` passe AVANT
-- le refus (ordre alphabétique des déclencheurs BEFORE) et efface les
-- historiques ELO qui devaient bloquer la suppression — un tournoi dont seul un
-- historique prouve le résultat se supprimerait, ELO retiré (constaté par une
-- mutation du test). Les retirer rend la règle structurelle. Leurs
-- fonctions restent, inertes : `apply_bracket_match_elo` sert toujours à
-- l'INSERT et l'UPDATE (`trg_bracket_match_elo`, corrections comprises) ;
-- `trg_tournaments_defaire_elo()` et `internal.defaire_elo_tournoi()` ne sont
-- plus appelées.
--
-- La suppression en cascade est refusée elle aussi : supprimer une box dont un
-- tournoi a un résultat validé échoue. C'est déjà la règle du Manager, dont la
-- suppression d'une box refuse toute box qui a un tournoi (« Archive-la
-- plutôt »), et rien d'autre ne supprime une box. Supprimer un compte ne
-- supprime aucun match (participants en SET NULL).
--
-- Archivage : `tournaments.archived_at`, posé par `archive_tournament` et
-- retiré par `unarchive_tournament`, avec les droits de la suppression :
-- `is_box_admin` de la box du tournoi, ou la clé serveur. Les deux fonctions
-- sont SECURITY INVOKER : la mise à jour passe par la RLS de `tournaments`,
-- comme la suppression, et `is_privileged_backend()` lit le vrai rôle de
-- l'appelant. Aucune autre colonne, aucun ELO, aucun historique, aucun
-- résultat n'est touché. Aucune lecture ne change ici : masquer les tournois
-- archivés viendra dans les lots app et Manager.
--
-- Données existantes : rien n'est modifié ; les 4 lignes de clôture orphelines
-- restent.
--
-- Contrôlée par `supabase/tests/suppression_tournoi_elo.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.tournaments ADD COLUMN archived_at timestamptz;

-- La raison pour laquelle un tournoi ne peut pas être supprimé, ou NULL.
CREATE FUNCTION internal.tournoi_resultat_valide(p_tournament_id uuid, p_status text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_status = 'completed' THEN 'tournoi clôturé'
    WHEN EXISTS (SELECT 1 FROM public.tournament_bracket_matches m
                  WHERE m.tournament_id = p_tournament_id AND m.status IN ('completed', 'forfeit'))
      THEN 'match de tableau terminé'
    WHEN EXISTS (SELECT 1 FROM public.tournament_scores s
                  WHERE s.tournament_id = p_tournament_id AND s.status = 'validated')
      THEN 'score validé'
    WHEN EXISTS (SELECT 1 FROM public.tournament_season_history h WHERE h.tournament_id = p_tournament_id)
      THEN 'saison close'
    WHEN EXISTS (SELECT 1 FROM public.tournament_match_elo_history h WHERE h.tournament_id = p_tournament_id)
      THEN 'historique ELO de match'
    WHEN EXISTS (SELECT 1 FROM public.tournament_wod_elo_history h WHERE h.tournament_id = p_tournament_id)
      THEN 'ELO de WOD de ligue calculé'
    WHEN EXISTS (SELECT 1 FROM public.tournament_elo_history h WHERE h.tournament_id = p_tournament_id)
      THEN 'historique ELO de clôture'
  END;
$function$;
REVOKE ALL ON FUNCTION internal.tournoi_resultat_valide(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION internal.refuser_suppression_tournoi_valide()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_raison text := internal.tournoi_resultat_valide(OLD.id, OLD.status);
BEGIN
  IF v_raison IS NOT NULL THEN
    RAISE EXCEPTION 'TOURNOI_AVEC_RESULTATS: ce tournoi a des résultats validés (%) et ne peut pas être supprimé. Archive-le à la place : son ELO et ses résultats sont conservés.', v_raison
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION internal.refuser_suppression_tournoi_valide() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION internal.refuser_suppression_match_termine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status IN ('completed', 'forfeit')
     OR EXISTS (SELECT 1 FROM public.tournament_match_elo_history h WHERE h.match_id = OLD.id) THEN
    RAISE EXCEPTION 'MATCH_TERMINE: un match terminé ne peut pas être supprimé. Pour corriger le résultat, remets le match à jouer ou choisis le vainqueur : l''ELO est recalculé.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION internal.refuser_suppression_match_termine() FROM PUBLIC, anon, authenticated;

DROP TRIGGER trg_tournaments_defaire_elo ON public.tournaments;
DROP TRIGGER trg_bracket_match_elo_suppression ON public.tournament_bracket_matches;

CREATE TRIGGER trg_tournaments_resultats_conserves
  BEFORE DELETE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION internal.refuser_suppression_tournoi_valide();

CREATE TRIGGER trg_bracket_matches_termine_conserve
  BEFORE DELETE ON public.tournament_bracket_matches
  FOR EACH ROW EXECUTE FUNCTION internal.refuser_suppression_match_termine();

-- Archivage : mêmes droits que la suppression (is_box_admin de la box du tournoi, ou clé serveur).
CREATE FUNCTION public.archive_tournament(p_tournament_id uuid)
 RETURNS timestamptz
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_box uuid;
  v_archived timestamptz;
BEGIN
  SELECT box_id INTO v_box FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNOI_INCONNU' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_box_admin(v_box) OR public.is_privileged_backend()) THEN
    RAISE EXCEPTION 'Accès refusé : gérant, co-gérant ou coach de la box du tournoi requis'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.tournaments
     SET archived_at = COALESCE(archived_at, now())
   WHERE id = p_tournament_id
  RETURNING archived_at INTO v_archived;
  RETURN v_archived;
END;
$function$;
REVOKE ALL ON FUNCTION public.archive_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_tournament(uuid) TO authenticated, service_role;

CREATE FUNCTION public.unarchive_tournament(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_box uuid;
BEGIN
  SELECT box_id INTO v_box FROM public.tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOURNOI_INCONNU' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (public.is_box_admin(v_box) OR public.is_privileged_backend()) THEN
    RAISE EXCEPTION 'Accès refusé : gérant, co-gérant ou coach de la box du tournoi requis'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.tournaments SET archived_at = NULL WHERE id = p_tournament_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.unarchive_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unarchive_tournament(uuid) TO authenticated, service_role;

COMMIT;
