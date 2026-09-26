-- ═════════════════════════════════════════════════════════════════════════════
-- WOD de tableau préparés à l'avance : chaque match reçoit le WOD de son étape
--
-- Appliquée en prod : NON.
--
-- Besoin (validé le 26/09/2026) : un gérant prépare avant le début d'un tournoi
-- à tableau le WOD de chaque étape — tours du tableau des gagnants, tours du
-- tableau des perdants, grande finale, match décisif, petite finale — et
-- chaque match reçoit automatiquement le WOD de son étape à sa création.
-- Avant : `bracket_stage` (distance à la finale) n'était lu par aucune
-- fonction serveur ; le Manager et l'app le convertissaient en tour chacun à
-- sa façon, et les matchs naissaient sans WOD.
--
-- 1. `tournament_wods.bracket_board` : le tableau de l'étape.
--      `winner`            bracket_stage >= 0 : distance à la finale des gagnants
--                          (0 = finale) — le sens déjà stocké ;
--      `loser`             bracket_stage >= 1 : tour des perdants, depuis le début ;
--      `grand_final`, `grand_final_reset` (match décisif), `third_place` (petite
--      finale) : sans étape.
--    Contrainte CHECK (pas d'étape sans tableau, ni de tableau incohérent avec
--    son étape) ; index unique partiel : un seul WOD par étape d'un tournoi.
--    Les WOD qui portaient déjà une étape reçoivent `winner` (2 en prod) : leur
--    sens ne change pas.
--    Compatibilité : le formulaire actuel du Manager écrit `bracket_stage` sans
--    `bracket_board`. Jusqu'à sa mise à jour, un WOD écrit avec une étape mais
--    sans tableau reçoit `winner` (le sens de ce qu'il écrit), plutôt que d'être
--    refusé par la contrainte.
--
-- 2. Déclencheur BEFORE INSERT sur `tournament_bracket_matches` : un match créé
--    sans WOD, hors exemption, reçoit le WOD prévu pour son étape, s'il existe ;
--    sinon il reste sans WOD, comme avant. Un seul endroit pour tous les chemins
--    de création : tirage, tour suivant, grande finale et match décisif créés par
--    la base, grande finale créée à la main par le Manager. Étape d'un match,
--    décidée par la base seule :
--      gagnants, tour global r  → `winner`, W − r, W = ⌈log₂ N₁⌉, N₁ = participants
--                                 du tirage (inscrits pendant le tirage, puis
--                                 participants des matchs du tour 1) ;
--      perdants, tour global r  → `loser`, r − 1 (le tableau des perdants commence
--                                 au tour global 2) ;
--      première ligne `grand_final` du tournoi → `grand_final` ; la suivante →
--                                 `grand_final_reset` (sans WOD prévu : aucun) ;
--      `third_place`            → `third_place`, sinon le WOD de la finale
--                                 (`winner`, 0).
--    `decide_bracket_round` lit déjà d'abord le WOD du match : inchangée.
--
-- 3. `tournament_bracket_stages(tournoi)` : les étapes à proposer, dans l'ordre
--    (gagnants du premier tour à la finale, petite finale, perdants, grande
--    finale, match décisif), avec leurs libellés FR et EN validés. Nombre de
--    participants : ceux du tirage s'il a eu lieu, sinon `max_participants`.
--    Le nombre de tours des perdants est simulé selon les règles de
--    `advance_bracket_round` (appariements et exemptions ne dépendent que des
--    effectifs). Réservée au gérant du tournoi (et à la clé serveur).
--
-- Aucun match existant n'est modifié : le déclencheur n'agit qu'à l'insertion.
--
-- Contrôlée par `supabase/tests/bracket_wods_prevus.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Le tableau de l'étape ─────────────────────────────────────────────────
ALTER TABLE public.tournament_wods ADD COLUMN bracket_board text;
UPDATE public.tournament_wods SET bracket_board = 'winner' WHERE bracket_stage IS NOT NULL;
-- En CASE, pour que la condition soit toujours vraie ou fausse : une
-- comparaison avec NULL la rendrait inconnue, et un CHECK inconnu passe.
ALTER TABLE public.tournament_wods ADD CONSTRAINT tournament_wods_bracket_board_check CHECK (
  CASE
    WHEN bracket_board IS NULL THEN bracket_stage IS NULL
    WHEN bracket_board = 'winner' THEN COALESCE(bracket_stage >= 0, false)
    WHEN bracket_board = 'loser' THEN COALESCE(bracket_stage >= 1, false)
    WHEN bracket_board IN ('grand_final', 'grand_final_reset', 'third_place') THEN bracket_stage IS NULL
    ELSE false
  END
);
COMMENT ON COLUMN public.tournament_wods.bracket_board IS
  'Tableau de l''étape prévue pour ce WOD : winner (bracket_stage = distance à la finale des gagnants), loser (bracket_stage = tour des perdants, depuis 1), grand_final, grand_final_reset, third_place (sans étape). Chaque match créé reçoit le WOD de son étape.';
CREATE FUNCTION internal.tableau_par_defaut_wod()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.bracket_stage IS NOT NULL AND NEW.bracket_board IS NULL THEN
    NEW.bracket_board := 'winner';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.tableau_par_defaut_wod() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_tournament_wods_tableau_par_defaut
  BEFORE INSERT OR UPDATE OF bracket_stage, bracket_board ON public.tournament_wods
  FOR EACH ROW EXECUTE FUNCTION internal.tableau_par_defaut_wod();

CREATE UNIQUE INDEX tournament_wods_etape_unique
  ON public.tournament_wods (tournament_id, bracket_board, COALESCE(bracket_stage, -1))
  WHERE bracket_board IS NOT NULL;

-- ── Nombre de tours du tableau des gagnants pour n participants : ⌈log₂ n⌉ ──
CREATE FUNCTION internal.tours_gagnants(p_n integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(min(k), 0)::int FROM generate_series(0, 30) k WHERE (1::bigint << k) >= GREATEST(p_n, 1);
$function$;
REVOKE ALL ON FUNCTION internal.tours_gagnants(integer) FROM PUBLIC, anon, authenticated;

-- ── 2. Le WOD prévu, posé à la création du match ─────────────────────────────
CREATE FUNCTION internal.poser_wod_prevu()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_board text;
  v_stage integer;
  v_n     integer;
  v_wod   uuid;
BEGIN
  IF NEW.wod_id IS NOT NULL OR NEW.status = 'bye' THEN
    RETURN NEW;
  END IF;

  IF NEW.side = 'winner' THEN
    IF NEW.round = 1 THEN
      -- Pendant le tirage : les inscrits, que `generate_bracket_round_1` apparie tous.
      SELECT count(*) INTO v_n FROM public.tournament_participants WHERE tournament_id = NEW.tournament_id;
    ELSE
      SELECT count(DISTINCT x.pid) INTO v_n
        FROM public.tournament_bracket_matches m,
             LATERAL (VALUES (m.participant1_id), (m.participant2_id)) AS x(pid)
       WHERE m.tournament_id = NEW.tournament_id AND m.round = 1 AND m.side = 'winner' AND x.pid IS NOT NULL;
    END IF;
    v_board := 'winner';
    v_stage := internal.tours_gagnants(v_n) - NEW.round;
  ELSIF NEW.side = 'loser' THEN
    v_board := 'loser';
    v_stage := NEW.round - 1;
  ELSIF NEW.side = 'grand_final' THEN
    v_board := CASE WHEN EXISTS (SELECT 1 FROM public.tournament_bracket_matches
                                  WHERE tournament_id = NEW.tournament_id AND side = 'grand_final')
                    THEN 'grand_final_reset' ELSE 'grand_final' END;
  ELSIF NEW.side = 'third_place' THEN
    v_board := 'third_place';
  ELSE
    RETURN NEW;
  END IF;

  SELECT id INTO v_wod FROM public.tournament_wods
   WHERE tournament_id = NEW.tournament_id AND bracket_board = v_board
     AND bracket_stage IS NOT DISTINCT FROM v_stage;
  IF v_wod IS NULL AND v_board = 'third_place' THEN
    SELECT id INTO v_wod FROM public.tournament_wods
     WHERE tournament_id = NEW.tournament_id AND bracket_board = 'winner' AND bracket_stage = 0;
  END IF;

  NEW.wod_id := v_wod;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION internal.poser_wod_prevu() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_bracket_matches_wod_prevu
  BEFORE INSERT ON public.tournament_bracket_matches
  FOR EACH ROW EXECUTE FUNCTION internal.poser_wod_prevu();

-- ── 3. Les étapes à proposer ─────────────────────────────────────────────────
CREATE FUNCTION public.tournament_bracket_stages(p_tournament_id uuid)
 RETURNS TABLE(ordre integer, bracket_board text, bracket_stage integer, label_fr text, label_en text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_t       record;
  v_n       integer;
  v_w       integer;
  v_double  boolean;
  v_i       integer := 0;
  v_d       integer;
  -- Simulation du tableau des perdants (règles d'advance_bracket_round).
  v_u       integer;
  v_drops   integer;
  v_s       integer := 0;
  v_l       integer;
  v_tours_p integer := 0;
  lib_fr    text[];
  lib_en    text[];
BEGIN
  IF NOT (public.is_tournament_manager(p_tournament_id) OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'Accès refusé : gérant du tournoi requis' USING ERRCODE = '42501';
  END IF;

  SELECT t.format, t.max_participants, t.third_place_match INTO v_t
    FROM public.tournaments t WHERE t.id = p_tournament_id;
  IF NOT FOUND OR v_t.format NOT IN ('bracket', 'swiss') THEN
    RETURN;
  END IF;
  v_double := v_t.format = 'swiss';

  SELECT count(DISTINCT x.pid) INTO v_n
    FROM public.tournament_bracket_matches m,
         LATERAL (VALUES (m.participant1_id), (m.participant2_id)) AS x(pid)
   WHERE m.tournament_id = p_tournament_id AND m.round = 1 AND m.side = 'winner' AND x.pid IS NOT NULL;
  IF v_n < 2 THEN
    v_n := GREATEST(COALESCE(v_t.max_participants, 2), 2);
  END IF;
  v_w := internal.tours_gagnants(v_n);

  IF v_double THEN
    lib_fr := ARRAY['Finale des gagnants', 'Demi-finale des gagnants', 'Quart de finale des gagnants',
                    '8e de finale des gagnants', '16e de finale des gagnants', '32e de finale des gagnants'];
    lib_en := ARRAY['Winners'' final', 'Winners'' semi-final', 'Winners'' quarter-final',
                    'Winners'' round of 16', 'Winners'' round of 32', 'Winners'' round of 64'];
  ELSE
    lib_fr := ARRAY['Finale', 'Demi-finale', 'Quart de finale', '8e de finale', '16e de finale', '32e de finale'];
    lib_en := ARRAY['Final', 'Semi-final', 'Quarter-final', 'Round of 16', 'Round of 32', 'Round of 64'];
  END IF;

  -- Tableau des gagnants, du premier tour à la finale.
  FOR v_d IN REVERSE (v_w - 1)..0 LOOP
    v_i := v_i + 1;
    ordre := v_i; bracket_board := 'winner'; bracket_stage := v_d;
    label_fr := COALESCE(lib_fr[v_d + 1], CASE WHEN v_double THEN format('%s tours avant la finale des gagnants', v_d)
                                                ELSE format('%s tours avant la finale', v_d) END);
    label_en := COALESCE(lib_en[v_d + 1], CASE WHEN v_double THEN format('%s rounds before the winners'' final', v_d)
                                                ELSE format('%s rounds before the final', v_d) END);
    RETURN NEXT;
  END LOOP;

  IF NOT v_double THEN
    -- Petite finale : option du tournoi, et au moins une demi-finale.
    IF v_t.third_place_match AND v_w >= 2 THEN
      v_i := v_i + 1;
      ordre := v_i; bracket_board := 'third_place'; bracket_stage := NULL;
      label_fr := 'Petite finale'; label_en := 'Third-place match';
      RETURN NEXT;
    END IF;
    RETURN;
  END IF;

  -- Tableau des perdants : autant de tours que la double élimination en jouera.
  v_u := (v_n + 1) / 2;
  v_drops := v_n / 2;
  LOOP
    v_l := v_drops;
    EXIT WHEN v_u <= 1 AND v_s + v_l <= 1;
    v_drops := 0;
    IF v_u >= 2 THEN
      v_drops := v_u / 2;
      v_u := (v_u + 1) / 2;
    END IF;
    v_s := LEAST(v_s, v_l) + (abs(v_s - v_l) + 1) / 2;
    v_tours_p := v_tours_p + 1;
  END LOOP;
  FOR v_d IN 1..v_tours_p LOOP
    v_i := v_i + 1;
    ordre := v_i; bracket_board := 'loser'; bracket_stage := v_d;
    label_fr := format('Tour %s des perdants', v_d);
    label_en := format('Losers'' round %s', v_d);
    RETURN NEXT;
  END LOOP;

  v_i := v_i + 1;
  ordre := v_i; bracket_board := 'grand_final'; bracket_stage := NULL;
  label_fr := 'Grande finale'; label_en := 'Grand final';
  RETURN NEXT;
  v_i := v_i + 1;
  ordre := v_i; bracket_board := 'grand_final_reset'; bracket_stage := NULL;
  label_fr := 'Grande finale — match décisif'; label_en := 'Grand final — decider';
  RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.tournament_bracket_stages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tournament_bracket_stages(uuid) TO authenticated, service_role;

COMMIT;
