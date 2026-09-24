-- ═════════════════════════════════════════════════════════════════════════════
-- ELO de match de tableau : appliqué une seule fois par match — tournois, PR 1
--
-- Appliquée en prod : NON
--
-- `apply_bracket_match_elo` (trigger de `tournament_bracket_matches`) défaisait
-- l'effet d'un match quand son vainqueur changeait, mais RÉAPPLIQUAIT l'ELO à
-- chaque réécriture d'un match terminé sans changement de vainqueur : l'historique
-- était protégé (`ON CONFLICT DO NOTHING`), pas le profil — l'ELO et les
-- compteurs `total_matches` / `wins` s'ajoutaient une seconde fois. Un match
-- supprimé ne rendait rien.
--
-- Désormais l'effet se déduit de l'ÉTAT du match et se compare à l'effet
-- ENREGISTRÉ dans `tournament_match_elo_history` :
--   * effet voulu = (vainqueur, perdant) d'un vrai match 1 contre 1 terminé
--     (`completed`, côté winner / loser / grand_final, deux participants
--     distincts, vainqueur parmi eux) ; sinon aucun ;
--   * voulu = enregistré (mêmes vainqueur et perdant, ou aucun des deux) → rien ;
--   * sinon l'effet enregistré est défait EXACTEMENT (ELO moins le delta
--     enregistré, `total_matches` − 1 pour les deux, `wins` − 1 pour le
--     vainqueur enregistré), son historique supprimé, puis le nouvel effet
--     appliqué et enregistré.
-- Le trigger d'écriture surveille aussi `participant1_id` et `participant2_id` :
-- changer de perdant change l'effet.
--
-- Hors de cette PR : la suppression d'un match ou d'un tournoi (PR 4). La
-- fonction sait déjà traiter `TG_OP = 'DELETE'` (effet voulu : aucun) ; c'est la
-- PR 4 qui posera le trigger BEFORE DELETE — BEFORE, car la clé
-- `match_id → SET NULL` s'exécute avant un trigger AFTER et masquerait l'historique.
--
-- Inchangé : la formule (K = 32, delta minimal 1, plancher 100), les tables.
-- Le plancher 100 est gardé au retrait par sûreté : il ne s'écarte du delta
-- exact que si l'athlète est passé sous 100 entre-temps.
--
-- Relevé en prod le 24/09/2026, lecture seule : 133 matchs terminés, 133
-- historiques de deux lignes conformes à l'état de leur match, 0 orphelin —
-- aucune reprise de données n'est nécessaire.
--
-- Contrôlée par `supabase/tests/elo_match_idempotent.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_bracket_match_elo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  k_match constant numeric := 32;
  v_id      uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  v_win     uuid;
  v_lose    uuid;
  v_rec_win  uuid;
  v_rec_lose uuid;
  v_we      int;
  v_le      int;
  v_exp_w   numeric;
  v_delta   int;
  v_after_w int;
  v_after_l int;
  h         record;
BEGIN
  -- Deux écritures concurrentes du même match se sérialisent.
  PERFORM pg_advisory_xact_lock(hashtext('elo-match:' || v_id::text));

  -- 1. L'effet voulu, déduit de l'état du match.
  IF TG_OP <> 'DELETE'
     AND NEW.winner_id IS NOT NULL
     AND NEW.status = 'completed'
     AND NEW.side IN ('winner', 'loser', 'grand_final')
     AND NEW.participant1_id IS NOT NULL
     AND NEW.participant2_id IS NOT NULL
     AND NEW.participant1_id <> NEW.participant2_id
     AND NEW.winner_id IN (NEW.participant1_id, NEW.participant2_id) THEN
    v_win  := NEW.winner_id;
    v_lose := CASE WHEN NEW.winner_id = NEW.participant1_id
                   THEN NEW.participant2_id ELSE NEW.participant1_id END;
  END IF;

  -- 2. L'effet enregistré.
  SELECT athlete_id INTO v_rec_win  FROM tournament_match_elo_history WHERE match_id = v_id AND result = 'win';
  SELECT athlete_id INTO v_rec_lose FROM tournament_match_elo_history WHERE match_id = v_id AND result = 'loss';

  -- 3. Rien ne change : l'ELO n'est pas appliqué une seconde fois.
  IF v_rec_win IS NOT DISTINCT FROM v_win AND v_rec_lose IS NOT DISTINCT FROM v_lose THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- 4. Défaire exactement ce qui avait été appliqué.
  FOR h IN SELECT * FROM tournament_match_elo_history WHERE match_id = v_id LOOP
    UPDATE profiles p
       SET elo           = GREATEST(100, p.elo - h.elo_delta),
           total_matches = GREATEST(0, p.total_matches - 1),
           wins          = CASE WHEN h.result = 'win' THEN GREATEST(0, p.wins - 1) ELSE p.wins END
     WHERE p.id = h.athlete_id;
  END LOOP;
  DELETE FROM tournament_match_elo_history WHERE match_id = v_id;

  -- 5. Appliquer le nouvel effet, s'il y en a un.
  IF v_win IS NOT NULL THEN
    SELECT COALESCE(elo, 1000) INTO v_we FROM profiles WHERE id = v_win;
    SELECT COALESCE(elo, 1000) INTO v_le FROM profiles WHERE id = v_lose;
    IF v_we IS NOT NULL AND v_le IS NOT NULL THEN
      v_exp_w := 1.0 / (1.0 + POWER(10, (v_le - v_we) / 400.0));
      v_delta := ROUND(k_match * (1 - v_exp_w))::int;
      IF v_delta < 1 THEN v_delta := 1; END IF;   -- écart minimal garanti

      v_after_w := GREATEST(100, v_we + v_delta);
      v_after_l := GREATEST(100, v_le - v_delta);

      INSERT INTO tournament_match_elo_history
        (match_id, tournament_id, athlete_id, opponent_id, result, elo_before, elo_after, elo_delta)
      VALUES
        (v_id, NEW.tournament_id, v_win,  v_lose, 'win',  v_we, v_after_w, v_after_w - v_we),
        (v_id, NEW.tournament_id, v_lose, v_win,  'loss', v_le, v_after_l, v_after_l - v_le);

      UPDATE profiles SET elo = v_after_w, total_matches = total_matches + 1, wins = wins + 1 WHERE id = v_win;
      UPDATE profiles SET elo = v_after_l, total_matches = total_matches + 1                    WHERE id = v_lose;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Le trigger d'écriture surveille aussi les participants (changer de perdant change l'effet).
DROP TRIGGER IF EXISTS trg_bracket_match_elo ON public.tournament_bracket_matches;
CREATE TRIGGER trg_bracket_match_elo
  AFTER INSERT OR UPDATE OF winner_id, status, participant1_id, participant2_id
  ON public.tournament_bracket_matches
  FOR EACH ROW EXECUTE FUNCTION public.apply_bracket_match_elo();

COMMIT;
