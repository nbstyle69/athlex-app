-- ═════════════════════════════════════════════════════════════════════════════
-- Divisions : capacité, affectation par ELO, placement manuel — tournois, PR 10
--
-- Appliquée en prod : NON
--
-- Règle produit : « Divisions : affectation automatique par niveau ELO, avec une
-- capacité maximale par division fixée par le gérant ; au-delà, l'athlète va
-- dans la division suivante. Le gérant peut aussi placer lui-même un athlète
-- dans une division, et ce placement manuel n'est jamais écrasé par
-- l'affectation automatique. »
--
-- Jusqu'ici, tout nouvel inscrit d'une ligue allait dans la division du bas
-- (`auto_assign_lowest_division`), et `max_members` n'était lu nulle part.
--
--   * `tournament_division_members.placement` : `auto` ou `manual`. Toute
--     écriture du client (le Manager) qui place ou déplace un athlète le marque
--     `manual` ; seul le serveur écrit `auto`. Un retour explicite à `auto` par
--     le gérant est respecté. Les lignes existantes passent à `manual` : rien de
--     ce qui est déjà en place ne bougera ;
--   * `internal.affecter_divisions(tournoi)` : les athlètes à placer sont triés
--     par ELO décroissant ; chacun va dans la première division, du haut vers le
--     bas, qui a encore de la place (`max_members`, sans limite si NULL) ; la
--     dernière division prend le reste. Un placement manuel occupe sa place et
--     n'est jamais déplacé.
--       - tant que le tournoi n'a aucun score validé (la ligue n'a pas
--         commencé), tous les placements `auto` sont recalculés ;
--       - ensuite, seuls les nouveaux inscrits sont placés : à partir de la
--         division où leur ELO les classe, puis vers le bas s'il n'y a plus de
--         place. Les promotions et relégations ne sont donc jamais défaites ;
--   * à l'inscription (trigger sur `tournament_participants`, qui remplace
--     `auto_assign_lowest_division`) et à la demande du gérant
--     (`public.affecter_divisions`, par exemple après avoir créé les divisions).
-- Un athlète n'est jamais dans deux divisions du même tournoi.
--
-- Données en prod : aucun tournoi `league_div`. La colonne est ajoutée à
-- `manual` ; rien d'autre ne change.
--
-- Contrôlée par `supabase/tests/divisions_capacite.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.tournament_division_members
  ADD COLUMN placement text NOT NULL DEFAULT 'manual'
    CONSTRAINT tournament_division_members_placement_check CHECK (placement IN ('auto', 'manual'));
COMMENT ON COLUMN public.tournament_division_members.placement IS
  'auto : placé par l''affectation par ELO (peut être recalculé avant le début de la ligue) ; manual : placé par le gérant, jamais déplacé par l''affectation.';

-- Placement : une écriture du client marque « manual », sauf retour explicite à « auto ».
CREATE OR REPLACE FUNCTION public.trg_division_members_placement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('athlex.affectation_divisions', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.placement := 'manual';
  ELSIF NEW.division_id IS DISTINCT FROM OLD.division_id
        AND NEW.placement IS NOT DISTINCT FROM OLD.placement THEN
    NEW.placement := 'manual';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.trg_division_members_placement() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_division_members_placement
  BEFORE INSERT OR UPDATE OF division_id, placement ON public.tournament_division_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_division_members_placement();

CREATE OR REPLACE FUNCTION internal.affecter_divisions(p_tournament_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_divs   uuid[];
  v_aff    uuid[];
  v_caps   bigint[];
  v_occ    bigint[];
  v_libre  boolean;
  v_a      record;
  v_rang   bigint;
  v_cumul  bigint;
  v_depart int;
  v_cible  int;
  v_n      int;
  v_places int := 0;
BEGIN
  IF (SELECT format FROM tournaments WHERE id = p_tournament_id) IS DISTINCT FROM 'league_div' THEN
    RETURN 0;
  END IF;
  SELECT array_agg(id ORDER BY level), array_agg(COALESCE(max_members, 2147483647)::bigint ORDER BY level)
    INTO v_divs, v_caps
    FROM tournament_divisions WHERE tournament_id = p_tournament_id;
  v_n := COALESCE(array_length(v_divs, 1), 0);
  IF v_n = 0 THEN
    RETURN 0;
  END IF;

  -- La ligue a-t-elle commencé ? Avant : tout placement « auto » se recalcule.
  v_libre := NOT EXISTS (SELECT 1 FROM tournament_scores
                          WHERE tournament_id = p_tournament_id AND status = 'validated');

  PERFORM set_config('athlex.affectation_divisions', 'on', true);

  -- À placer : les inscrits sans division, et (avant la ligue) les placements « auto ».
  SELECT array_agg(x.athlete_id) INTO v_aff FROM (
    SELECT tp.athlete_id FROM tournament_participants tp
     WHERE tp.tournament_id = p_tournament_id
       AND NOT EXISTS (SELECT 1 FROM tournament_division_members m
                        WHERE m.athlete_id = tp.athlete_id AND m.division_id = ANY (v_divs))
    UNION
    SELECT m.athlete_id FROM tournament_division_members m
     WHERE v_libre AND m.division_id = ANY (v_divs) AND m.placement = 'auto'
  ) x;
  v_aff := COALESCE(v_aff, '{}');

  -- Places déjà prises, par division : tout ce qui ne se replace pas.
  SELECT array_agg((SELECT count(*) FROM tournament_division_members m
                     WHERE m.division_id = d AND NOT (m.athlete_id = ANY (v_aff)))
                   ORDER BY o)
    INTO v_occ
    FROM unnest(v_divs) WITH ORDINALITY AS u(d, o);

  FOR v_a IN
    SELECT p.id AS athlete_id, p.elo FROM profiles p
     WHERE p.id = ANY (v_aff)
     ORDER BY p.elo DESC NULLS LAST, p.id
  LOOP
    v_depart := 1;
    IF NOT v_libre THEN
      -- Division où son ELO le classe parmi les inscrits, d'après les capacités.
      SELECT count(*) INTO v_rang
        FROM tournament_participants tp JOIN profiles p ON p.id = tp.athlete_id
       WHERE tp.tournament_id = p_tournament_id AND p.elo > v_a.elo;
      v_cumul := 0;
      v_depart := v_n;
      FOR k IN 1..v_n LOOP
        v_cumul := v_cumul + v_caps[k];
        IF v_rang < v_cumul THEN v_depart := k; EXIT; END IF;
      END LOOP;
    END IF;
    v_cible := v_n;
    FOR k IN v_depart..v_n LOOP
      IF v_occ[k] < v_caps[k] THEN v_cible := k; EXIT; END IF;
    END LOOP;
    v_occ[v_cible] := v_occ[v_cible] + 1;

    UPDATE tournament_division_members
       SET division_id = v_divs[v_cible], placement = 'auto',
           points = CASE WHEN division_id = v_divs[v_cible] THEN points ELSE 0 END,
           rank   = CASE WHEN division_id = v_divs[v_cible] THEN rank END
     WHERE athlete_id = v_a.athlete_id AND division_id = ANY (v_divs);
    IF NOT FOUND THEN
      INSERT INTO tournament_division_members (division_id, athlete_id, points, rank, placement)
      VALUES (v_divs[v_cible], v_a.athlete_id, 0, NULL, 'auto');
    END IF;
    v_places := v_places + 1;
  END LOOP;

  PERFORM set_config('athlex.affectation_divisions', 'off', true);
  RETURN v_places;
END;
$function$;
REVOKE ALL ON FUNCTION internal.affecter_divisions(uuid) FROM PUBLIC, anon, authenticated;

-- À l'inscription, à la place de « toujours la division du bas ».
DROP TRIGGER IF EXISTS trg_auto_assign_lowest_division ON public.tournament_participants;
DROP FUNCTION IF EXISTS public.auto_assign_lowest_division();

CREATE OR REPLACE FUNCTION public.trg_participants_affecter_division()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM internal.affecter_divisions(NEW.tournament_id);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.trg_participants_affecter_division() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_participants_affecter_division
  AFTER INSERT ON public.tournament_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_participants_affecter_division();

-- À la demande du gérant (divisions créées après les inscriptions, capacités changées).
CREATE OR REPLACE FUNCTION public.affecter_divisions(p_tournament_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'Not authorized: only the box owner/coach or an admin can manage this tournament'
      USING ERRCODE = '42501';
  END IF;
  RETURN internal.affecter_divisions(p_tournament_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.affecter_divisions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affecter_divisions(uuid) TO authenticated, service_role;

COMMIT;
