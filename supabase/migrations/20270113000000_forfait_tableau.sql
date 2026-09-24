-- ═════════════════════════════════════════════════════════════════════════════
-- Forfait en tableau — tournois, PR 8
--
-- Appliquée en prod : OUI, le 24/09/2026 à 12:22:02 UTC, avec PGCLIENTENCODING=UTF8 ; 8e des
-- dix migrations du chantier, appliquées dans l'ordre (dump des schémas public et internal
-- avec droits db-dumps/2026-09-24/athlex-prod-public-internal-20260924T122149Z.dump, sha256 2dc8da2efa75a43df21e7ede51158712bbf0bdcc875ceb7a3eb4a8f7cd6529c8 vérifié
-- après aller-retour ; précontrôles : objets du chantier identiques à ceux de master rejoué,
-- aucun tournoi swiss ni league_div ; vérifications : md5 identiques avant et après des
-- tables du chantier, des profils, des policies, des droits des tables et des autres
-- fonctions, objets identiques à la référence droits compris, aucun double encodage ;
-- audit grants-prod.yml relancé à 12:24 UTC : 29/29).
--
-- Règle produit : « Forfait : l'absent perd le match, l'adversaire passe au tour
-- suivant, aucun point ELO ne bouge pour ce match. »
--
-- Un match de tableau n'avait que les statuts pending / active / completed /
-- bye : un forfait s'écrivait comme une victoire, et l'ELO bougeait.
--
--   * statut `forfeit` : le vainqueur est l'athlète présent, le perdant
--     l'absent. Une contrainte garantit qu'un forfait a bien ses deux athlètes,
--     tous deux du match, et distincts ;
--   * aucun ELO : le trigger de la PR 1 n'applique l'ELO qu'à un match
--     `completed`. Un match terminé passé en forfait voit son ELO retiré
--     exactement, par le même trigger ;
--   * l'adversaire passe : `advance_bracket_round` et le classement lisent le
--     vainqueur, quel que soit le statut. En double élimination, le forfait
--     compte comme une défaite de l'absent ;
--   * `generate_bracket_round_1` refuse de régénérer un tableau qui a un
--     forfait, comme un match terminé.
-- Le Manager écrit le forfait directement sur le match, comme il écrit un
-- vainqueur ; aucune RPC n'est ajoutée.
--
-- Données en prod : aucune ligne n'a le statut `forfeit` (il n'existait pas).
--
-- Contrôlée par `supabase/tests/forfait_tableau.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.tournament_bracket_matches
  DROP CONSTRAINT tournament_bracket_matches_status_check,
  ADD CONSTRAINT tournament_bracket_matches_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'bye'::text, 'forfeit'::text])),
  ADD CONSTRAINT tournament_bracket_matches_forfait_check
    CHECK (status <> 'forfeit' OR (
      winner_id IS NOT NULL AND loser_id IS NOT NULL AND winner_id <> loser_id
      AND winner_id IN (participant1_id, participant2_id)
      AND loser_id  IN (participant1_id, participant2_id)));

CREATE OR REPLACE FUNCTION public.generate_bracket_round_1(p_tournament_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_format text;
  v_participants uuid[];
  v_count int;
  v_match_num int := 1;
  i int;
BEGIN
  IF NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'Not authorized: only the box owner/coach or an admin can manage this tournament';
  END IF;

  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id;
  IF v_format NOT IN ('bracket','swiss') THEN
    RAISE EXCEPTION 'Tournament format % does not use brackets', v_format;
  END IF;

  IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches
             WHERE tournament_id = p_tournament_id AND status IN ('completed', 'forfeit')) THEN
    RAISE EXCEPTION 'Cannot regenerate: tournament already has completed matches';
  END IF;
  DELETE FROM public.tournament_bracket_matches WHERE tournament_id = p_tournament_id;

  SELECT array_agg(athlete_id ORDER BY random()) INTO v_participants
    FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id;

  v_count := COALESCE(array_length(v_participants, 1), 0);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to generate a bracket';
  END IF;

  i := 1;
  WHILE i <= v_count LOOP
    IF i + 1 <= v_count THEN
      INSERT INTO public.tournament_bracket_matches
        (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
      VALUES (p_tournament_id, 1, v_match_num, 'winner',
              v_participants[i], v_participants[i+1], 'pending');
    ELSE
      -- BYE: auto-advance
      INSERT INTO public.tournament_bracket_matches
        (tournament_id, round, match_number, side, participant1_id, winner_id, status, completed_at)
      VALUES (p_tournament_id, 1, v_match_num, 'winner',
              v_participants[i], v_participants[i], 'bye', now());
    END IF;
    v_match_num := v_match_num + 1;
    i := i + 2;
  END LOOP;

  RETURN v_match_num - 1;
END;
$function$;

COMMIT;
