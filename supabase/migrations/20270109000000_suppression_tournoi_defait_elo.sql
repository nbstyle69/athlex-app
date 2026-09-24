-- ═════════════════════════════════════════════════════════════════════════════
-- Supprimer un tournoi retire l'ELO qu'il a apporté — tournois, PR 4
--
-- Appliquée en prod : OUI, le 24/09/2026 à 12:21:02 UTC, avec PGCLIENTENCODING=UTF8 ; 4e des
-- dix migrations du chantier, appliquées dans l'ordre (dump des schémas public et internal
-- avec droits db-dumps/2026-09-24/athlex-prod-public-internal-20260924T122049Z.dump, sha256 ec899f565f525cc46be01204d29ba2f811031984eb64968535a231676205609f vérifié
-- après aller-retour ; précontrôles : objets du chantier identiques à ceux de master rejoué,
-- aucun tournoi swiss ni league_div ; vérifications : md5 identiques avant et après des
-- tables du chantier, des profils, des policies, des droits des tables et des autres
-- fonctions, objets identiques à la référence droits compris, aucun double encodage ;
-- audit grants-prod.yml relancé à 12:24 UTC : 29/29).
--
-- Supprimer un tournoi supprimait en cascade ses matchs, WOD et scores, mais
-- laissait sur les profils l'ELO et les compteurs que le tournoi avait apportés.
-- La migration 20261129 avait voulu garder les historiques après suppression,
-- pour qu'un profil reste égal à son dernier `elo_after` ; la règle produit est
-- désormais l'inverse : l'ELO d'un tournoi supprimé est retiré, sur le même
-- principe que les cumuls de mouvement — tout ce qui a été appliqué est défait,
-- rien de plus — et ses historiques disparaissent avec lui.
--
-- Ce qu'un tournoi a appliqué aux profils, source par source :
--   * ELO de match (`tournament_match_elo_history`, formats bracket / swiss) :
--     ELO + delta, `total_matches` + 1, `wins` + 1 au vainqueur ;
--   * ELO de WOD de ligue (`tournament_wod_elo_history`, format league_div) :
--     ELO + delta, `total_matches` + 1, `wins` + 1 au premier ;
--   * clôture (`tournament_elo_history`) : APPLIQUÉE au format `simple` seulement
--     (ELO + écart, `total_matches` + 1, `wins` + 1 au premier) ; pour les
--     autres formats c'est un simple récapitulatif, qu'on efface sans rien
--     retirer.
--
-- `internal.defaire_elo_tournoi(tournoi, format)` retire exactement ces sommes,
-- puis efface ces historiques. Elle est appelée :
--   * par un trigger BEFORE DELETE sur `tournaments` (le format est encore lu
--     sur la ligne supprimée) ;
-- et la suppression d'un SEUL match de tableau défait son effet par la fonction
-- de la PR 1 (`apply_bracket_match_elo`, qui traite déjà `DELETE`), branchée ici
-- en BEFORE DELETE — BEFORE, car la clé `match_id → SET NULL` s'exécute avant
-- un trigger AFTER. Quand c'est le tournoi qu'on supprime, son historique de
-- match est déjà effacé au moment où les matchs partent en cascade : rien n'est
-- défait deux fois.
--
-- Hors de cette PR : supprimer un WOD de ligue seul (son ELO de WOD reste). Le
-- plancher de 100 est gardé au retrait.
--
-- Contrôlée par `supabase/tests/suppression_tournoi_elo.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION internal.defaire_elo_tournoi(p_tournament_id uuid, p_format text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. ELO de match.
  UPDATE profiles p
     SET elo           = GREATEST(100, p.elo - s.delta),
         total_matches = GREATEST(0, p.total_matches - s.n),
         wins          = GREATEST(0, p.wins - s.w)
    FROM (SELECT athlete_id, SUM(elo_delta) AS delta, COUNT(*) AS n,
                 COUNT(*) FILTER (WHERE result = 'win') AS w
            FROM tournament_match_elo_history
           WHERE tournament_id = p_tournament_id
           GROUP BY athlete_id) s
   WHERE p.id = s.athlete_id;
  DELETE FROM tournament_match_elo_history WHERE tournament_id = p_tournament_id;

  -- 2. ELO de WOD de ligue.
  UPDATE profiles p
     SET elo           = GREATEST(100, p.elo - s.delta),
         total_matches = GREATEST(0, p.total_matches - s.n),
         wins          = GREATEST(0, p.wins - s.w)
    FROM (SELECT athlete_id, SUM(elo_delta) AS delta, COUNT(*) AS n,
                 COUNT(*) FILTER (WHERE rank = 1) AS w
            FROM tournament_wod_elo_history
           WHERE tournament_id = p_tournament_id
           GROUP BY athlete_id) s
   WHERE p.id = s.athlete_id;
  DELETE FROM tournament_wod_elo_history WHERE tournament_id = p_tournament_id;

  -- 3. Clôture : retirée au format simple seulement (ailleurs, récapitulatif).
  IF p_format = 'simple' THEN
    UPDATE profiles p
       SET elo           = GREATEST(100, p.elo - h.elo_change),
           total_matches = GREATEST(0, p.total_matches - 1),
           wins          = CASE WHEN h.final_rank = 1 THEN GREATEST(0, p.wins - 1) ELSE p.wins END
      FROM tournament_elo_history h
     WHERE h.tournament_id = p_tournament_id
       AND p.id = h.athlete_id;
  END IF;
  DELETE FROM tournament_elo_history WHERE tournament_id = p_tournament_id;
END;
$function$;
REVOKE ALL ON FUNCTION internal.defaire_elo_tournoi(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_tournaments_defaire_elo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM internal.defaire_elo_tournoi(OLD.id, OLD.format);
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION public.trg_tournaments_defaire_elo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tournaments_defaire_elo ON public.tournaments;
CREATE TRIGGER trg_tournaments_defaire_elo
  BEFORE DELETE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.trg_tournaments_defaire_elo();

-- Un match de tableau supprimé seul rend l'ELO qu'il avait apporté (PR 1).
DROP TRIGGER IF EXISTS trg_bracket_match_elo_suppression ON public.tournament_bracket_matches;
CREATE TRIGGER trg_bracket_match_elo_suppression
  BEFORE DELETE ON public.tournament_bracket_matches
  FOR EACH ROW EXECUTE FUNCTION public.apply_bracket_match_elo();

COMMIT;
