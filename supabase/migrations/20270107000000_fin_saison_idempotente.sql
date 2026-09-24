-- ═════════════════════════════════════════════════════════════════════════════
-- Fin de saison idempotente — tournois, PR 2
--
-- Appliquée en prod : NON
--
-- `end_season_and_advance` (ligues à divisions) archive le classement de la
-- saison, applique promotions et relégations, remet les points à zéro et passe
-- à la saison suivante. Rien n'empêchait un second appel (double clic, second
-- onglet) : il archivait une « nouvelle » saison à 0 point, rejouait promotions
-- et relégations sur ce classement vide — donc sur un ordre arbitraire — et
-- sautait une saison.
--
-- Désormais :
--   * la ligne du tournoi est verrouillée (`FOR UPDATE`) : deux appels
--     simultanés se sérialisent ;
--   * `p_saison_attendue` (facultatif) : la saison que l'appelant veut clore.
--     Si ce n'est plus la saison en cours, rien ne bouge et la saison en cours
--     est rendue. C'est la voie sûre, que le lot Manager adoptera ;
--   * sans ce paramètre (appel actuel du Manager), un appel ne fait rien si la
--     saison précédente vient d'être close et que la saison en cours n'a encore
--     aucun score validé. Clore volontairement une saison vide reste possible
--     avec `p_saison_attendue`.
-- Le reste du corps est celui du dépôt (identique à la prod aux blancs près,
-- relevé le 24/09/2026), inchangé.
--
-- La signature change (paramètre ajouté avec défaut) : la fonction est
-- recréée, ses droits remis à l'identique — `authenticated` et `service_role`,
-- ni PUBLIC ni `anon`. Les appels existants `rpc('end_season_and_advance',
-- { p_tournament_id })` continuent de fonctionner.
--
-- Contrôlée par `supabase/tests/fin_saison_idempotente.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION IF EXISTS public.end_season_and_advance(uuid);

CREATE FUNCTION public.end_season_and_advance(p_tournament_id uuid, p_saison_attendue integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_format text;
  v_season int;
  d record;
  upper_div uuid;
  lower_div uuid;
BEGIN
  IF NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'Not authorized: only the box owner/coach or an admin can manage this tournament';
  END IF;

  -- Verrou sur la ligne du tournoi : deux appels simultanés se sérialisent, et
  -- le second lit la saison que le premier vient d'écrire.
  SELECT format, current_season
    INTO v_format, v_season
    FROM public.tournaments
    WHERE id = p_tournament_id
    FOR UPDATE;

  IF v_format <> 'league_div' THEN
    RAISE EXCEPTION 'Tournament % is not a league_div tournament', p_tournament_id;
  END IF;

  -- ── 0. Idempotence : un second appel ne saute pas de saison ──────────────
  -- Avec la saison attendue : si elle n'est plus la saison en cours, elle a déjà
  -- été close (double clic, second onglet) — rien ne bouge.
  IF p_saison_attendue IS NOT NULL AND p_saison_attendue IS DISTINCT FROM v_season THEN
    RETURN v_season;
  END IF;
  -- Sans elle (appel actuel du Manager) : la saison précédente vient d'être
  -- close et la saison en cours n'a encore aucun score validé — c'est un second
  -- appel, pas une fin de saison. Clore une saison vide reste possible en
  -- passant p_saison_attendue.
  IF p_saison_attendue IS NULL
     AND EXISTS (SELECT 1 FROM public.tournament_season_history h
                  WHERE h.tournament_id = p_tournament_id AND h.season_number = v_season - 1)
     AND NOT EXISTS (SELECT 1 FROM public.tournament_scores s
                       JOIN public.tournament_wods w ON w.id = s.tournament_wod_id
                      WHERE w.tournament_id = p_tournament_id
                        AND w.season_number = v_season
                        AND s.status = 'validated') THEN
    RETURN v_season;
  END IF;

  -- ── 1. Snapshot standings into history with outcome ──────────────────
  WITH ranked AS (
    SELECT
      tdm.id,
      tdm.division_id,
      tdm.athlete_id,
      tdm.points,
      tdiv.level AS div_level,
      tdiv.name  AS div_name,
      tdiv.promote_count,
      tdiv.relegate_count,
      ROW_NUMBER() OVER (
        PARTITION BY tdm.division_id
        ORDER BY tdm.points DESC, COALESCE(tdm.rank, 999999) ASC
      ) AS final_rank,
      COUNT(*) OVER (PARTITION BY tdm.division_id) AS div_size
    FROM public.tournament_division_members tdm
    JOIN public.tournament_divisions tdiv ON tdiv.id = tdm.division_id
    WHERE tdiv.tournament_id = p_tournament_id
  )
  INSERT INTO public.tournament_season_history
    (tournament_id, season_number, division_id, division_level, division_name,
     athlete_id, final_rank, final_points, outcome)
  SELECT
    p_tournament_id,
    v_season,
    r.division_id,
    r.div_level,
    r.div_name,
    r.athlete_id,
    r.final_rank,
    r.points,
    CASE
      WHEN r.div_level = 1 AND r.final_rank = 1 THEN 'champion'
      WHEN r.final_rank <= r.promote_count AND r.div_level > 1 THEN 'promoted'
      WHEN r.final_rank > r.div_size - r.relegate_count
           AND EXISTS (SELECT 1 FROM public.tournament_divisions tdiv2
                       WHERE tdiv2.tournament_id = p_tournament_id
                         AND tdiv2.level = r.div_level + 1) THEN 'relegated'
      ELSE 'stayed'
    END
  FROM ranked r
  ON CONFLICT (tournament_id, season_number, athlete_id) DO NOTHING;

  -- ── 2. Compute moves into temp table (NO mutation yet) ───────────────
  CREATE TEMP TABLE IF NOT EXISTS _season_moves (
    athlete_id      uuid PRIMARY KEY,
    new_division_id uuid NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE TABLE _season_moves;

  FOR d IN
    SELECT * FROM public.tournament_divisions
    WHERE tournament_id = p_tournament_id
    ORDER BY level
  LOOP
    -- Promote top N to upper division (level - 1) if exists
    IF d.promote_count > 0 AND d.level > 1 THEN
      SELECT id INTO upper_div FROM public.tournament_divisions
        WHERE tournament_id = p_tournament_id AND level = d.level - 1;
      IF upper_div IS NOT NULL THEN
        INSERT INTO _season_moves (athlete_id, new_division_id)
        SELECT athlete_id, upper_div
        FROM public.tournament_division_members
        WHERE division_id = d.id
        ORDER BY points DESC, COALESCE(rank, 999999) ASC
        LIMIT d.promote_count
        ON CONFLICT (athlete_id) DO NOTHING;
      END IF;
    END IF;

    -- Relegate bottom N to lower division (level + 1) if exists
    IF d.relegate_count > 0 THEN
      SELECT id INTO lower_div FROM public.tournament_divisions
        WHERE tournament_id = p_tournament_id AND level = d.level + 1;
      IF lower_div IS NOT NULL THEN
        INSERT INTO _season_moves (athlete_id, new_division_id)
        SELECT athlete_id, lower_div
        FROM public.tournament_division_members
        WHERE division_id = d.id
        ORDER BY points ASC, COALESCE(rank, 0) DESC
        LIMIT d.relegate_count
        ON CONFLICT (athlete_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  -- ── 3. Apply all moves atomically ────────────────────────────────────
  UPDATE public.tournament_division_members tdm
    SET division_id = sm.new_division_id,
        points      = 0,
        rank        = NULL
    FROM _season_moves sm,
         public.tournament_divisions tdiv
    WHERE tdm.athlete_id = sm.athlete_id
      AND tdm.division_id = tdiv.id
      AND tdiv.tournament_id = p_tournament_id;

  -- ── 4. Reset points & rank for everyone (clean slate) ────────────────
  UPDATE public.tournament_division_members tdm
    SET points = 0, rank = NULL
    FROM public.tournament_divisions tdiv
    WHERE tdiv.id = tdm.division_id
      AND tdiv.tournament_id = p_tournament_id;

  -- ── 5. Increment current_season ──────────────────────────────────────
  UPDATE public.tournaments
    SET current_season = v_season + 1
    WHERE id = p_tournament_id;

  RETURN v_season + 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.end_season_and_advance(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_season_and_advance(uuid, integer) TO authenticated, service_role;

COMMIT;
