-- ═════════════════════════════════════════════════════════════════════════════
-- Écriture des scores de tournoi et garde du recalcul des divisions
--
-- Appliquée en prod : NON.
--
-- Trois défauts confirmés sur les définitions réellement déployées
-- (`docs/audits/VERIF_PROD_TOURNOIS_BADGES.md`, PR #330) :
--
--   1. La policy INSERT de `tournament_scores` n'impose ni `status = 'pending'`
--      ni l'inscription de l'athlète au tournoi : un athlète pouvait déposer un
--      score déjà « validated », sur un tournoi auquel il n'est pas inscrit.
--   2. La policy UPDATE n'a pas de `WITH CHECK` : `USING` ne contraint que la
--      ligne lue. Un athlète pouvait faire passer sa propre ligne `pending` à
--      `validated`. Elle exigeait aussi une ancienne ligne `pending`, ce qui
--      faisait échouer EN SILENCE (0 ligne, aucune erreur remontée) la
--      correction d'un score rejeté — que l'app propose pourtant
--      (`TournamentWODScreen.tsx` : UPDATE quand la ligne est `rejected`).
--   3. `recalc_division_points` n'a aucune garde de rôle dans son corps : seule
--      son ACL la protège aujourd'hui.
--
-- ── Pourquoi la garde ne peut pas être posée telle quelle ────────────────────
--
-- `recalc_division_points` a UN seul appelant : le trigger
-- `trg_recalc_division_points_on_scores`, AFTER INSERT/DELETE/UPDATE sur
-- `tournament_scores`. Autrement dit CHAQUE soumission de score par un athlète
-- l'appelle, dans tous les formats de tournoi — le filtre `league_div` est à
-- l'intérieur de la fonction. Une garde posée en tête aurait cassé la
-- soumission de score pour tout le monde.
--
-- Une garde sur `current_user` ne marcherait pas davantage : la fonction est
-- SECURITY DEFINER, `current_user` y vaut toujours son propriétaire, y compris
-- lors d'un appel direct d'un athlète par PostgREST — elle ne refuserait
-- personne.
--
-- D'où la séparation retenue (Nab, 21/09/2026) : ce que la base fait pour
-- elle-même d'un côté, ce qu'un client a le droit de demander de l'autre.
--
--   * `internal.recalc_division_points` : le corps actuel, sans garde, dans un
--     schéma que PostgREST n'expose pas, EXECUTE révoqué à PUBLIC / anon /
--     authenticated. C'est elle que le trigger appelle.
--   * `public.recalc_division_points` : même nom, même signature, mêmes droits
--     EXECUTE (postgres, service_role). Elle porte la garde, fondée sur
--     l'identité RÉELLE de l'appelant (`auth.role()`, qui lit le JWT), puis
--     délègue à l'interne.
--
-- Rejouable : `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `DROP TRIGGER IF
-- EXISTS`. Aucune donnée touchée — `tournament_scores` est vide en prod.
-- Contrôlée par `supabase/tests/tournament_scores_gardes.sql`, rejoué par la CI
-- à la suite de `scripts/db-replay.sh`.
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Schéma interne : hors de portée de PostgREST et des rôles clients ────
CREATE SCHEMA IF NOT EXISTS internal;
COMMENT ON SCHEMA internal IS
  'Fonctions que la base appelle pour elle-même (triggers). Jamais exposé par PostgREST, jamais exécutable par anon / authenticated.';
REVOKE ALL ON SCHEMA internal FROM PUBLIC;
REVOKE ALL ON SCHEMA internal FROM anon, authenticated;

-- ── 2. Le corps actuel, sans garde, appelé par le trigger ──────────────────
-- Copie conforme de la définition déployée, relevée le 21/09/2026 : cette
-- migration ne change pas le calcul, seulement qui a le droit de le demander.
CREATE OR REPLACE FUNCTION internal.recalc_division_points(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $internal$
DECLARE
  v_format text;
BEGIN
  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id;
  IF v_format IS DISTINCT FROM 'league_div' THEN
    RETURN;
  END IF;

  UPDATE public.tournament_division_members tdm
  SET points = 0
  FROM public.tournament_divisions d
  WHERE d.id = tdm.division_id
    AND d.tournament_id = p_tournament_id;

  WITH scored AS (
    SELECT
      tdm.id AS member_id,
      ts.tournament_wod_id,
      tdm.division_id,
      (tw.type = 'For Time') AS is_time,
      NULLIF(substring(ts.score_value from '^(-?[0-9]+(?:\.[0-9]+)?)'), '')::numeric AS raw_num,
      COALESCE(ts.capped, false) AS raw_capped
    FROM public.tournament_scores ts
    JOIN public.tournament_wods tw ON tw.id = ts.tournament_wod_id
    JOIN public.tournament_division_members tdm ON tdm.athlete_id = ts.athlete_id
    JOIN public.tournament_divisions d ON d.id = tdm.division_id
    WHERE d.tournament_id = p_tournament_id
      AND ts.tournament_id = p_tournament_id
      AND ts.status = 'validated'
  ),
  normalized AS (
    -- Normalisation de l'encodage hérité DNF_BASE (999999 + reps).
    SELECT s.member_id, s.tournament_wod_id, s.division_id, s.is_time,
           CASE WHEN s.is_time AND s.raw_num >= 999999 THEN s.raw_num - 999999 ELSE s.raw_num END AS num,
           (s.is_time AND (s.raw_capped OR s.raw_num >= 999999)) AS capped
      FROM scored s
  ),
  ranked AS (
    SELECT
      n.member_id,
      ROW_NUMBER() OVER (
        PARTITION BY n.tournament_wod_id, n.division_id
        ORDER BY
          (CASE WHEN n.capped THEN 1 ELSE 0 END) ASC,
          CASE WHEN n.is_time AND NOT n.capped
               THEN COALESCE(n.num,  'Infinity'::numeric) END ASC  NULLS LAST,
          CASE WHEN n.is_time AND     n.capped
               THEN COALESCE(n.num, '-Infinity'::numeric) END DESC NULLS LAST,
          CASE WHEN NOT n.is_time
               THEN COALESCE(n.num, '-Infinity'::numeric) END DESC NULLS LAST
      ) AS rk
    FROM normalized n
  ),
  totals AS (
    SELECT member_id, SUM(GREATEST(1, 100 - (rk::int - 1) * 3)) AS pts
    FROM ranked
    GROUP BY member_id
  )
  UPDATE public.tournament_division_members tdm
  SET points = totals.pts
  FROM totals
  WHERE tdm.id = totals.member_id;
END;
$internal$;

COMMENT ON FUNCTION internal.recalc_division_points(uuid) IS
  'Recalcul des points de division, sans garde d''appelant. Réservée au trigger des scores ; la version publique porte la garde.';

-- Les privilèges par défaut de Supabase accordent EXECUTE aux rôles clients sur
-- toute fonction nouvelle : on le retire explicitement, schéma exposé ou non.
REVOKE ALL ON FUNCTION internal.recalc_division_points(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal.recalc_division_points(uuid) FROM anon, authenticated;

-- ── 3. Le trigger passe désormais par la fonction interne ──────────────────
CREATE OR REPLACE FUNCTION public.trg_recalc_division_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $trg$
DECLARE
  v_tournament_id uuid;
BEGIN
  v_tournament_id := COALESCE(NEW.tournament_id, OLD.tournament_id);
  IF v_tournament_id IS NOT NULL THEN
    -- Chemin déclenché par la soumission de l'athlète : il ne doit PAS passer
    -- par la garde d'appelant de la version publique.
    PERFORM internal.recalc_division_points(v_tournament_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$trg$;

-- ── 4. La fonction publique : garde d'appelant, puis délégation ────────────
-- `auth.role()` lit le JWT de la requête (les deux formes, plate et JSON) :
--   * NULL         → aucun JWT : connexion directe, pg_cron, psql de migration ;
--   * service_role → clé de service (fonction edge, script serveur) ;
--   * sinon        → un utilisateur : il lui faut gérer CE tournoi.
CREATE OR REPLACE FUNCTION public.recalc_division_points(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $pub$
DECLARE
  v_role text := auth.role();
BEGIN
  IF v_role IS NOT NULL
     AND v_role <> 'service_role'
     AND NOT public.is_tournament_manager(p_tournament_id) THEN
    RAISE EXCEPTION 'recalc_division_points : réservé au gestionnaire du tournoi'
      USING ERRCODE = '42501';
  END IF;

  PERFORM internal.recalc_division_points(p_tournament_id);
END;
$pub$;

COMMENT ON FUNCTION public.recalc_division_points(uuid) IS
  'Recalcul des points de division demandé par un client. Garde : service_role, connexion sans JWT, ou gestionnaire du tournoi. Le trigger des scores passe par internal.recalc_division_points.';

-- Droits EXECUTE inchangés (postgres, service_role) : `CREATE OR REPLACE` les
-- conserve. Les retraits ci-dessous sont des no-op défensifs — ni `anon` ni
-- `authenticated` ne les détiennent — qui fixent l'intention dans le fichier.
REVOKE ALL ON FUNCTION public.recalc_division_points(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_division_points(uuid) FROM anon, authenticated;

-- ── 5. INSERT : soi-même, en `pending`, inscrit au tournoi, WOD ouvert ─────
DROP POLICY IF EXISTS "tournament_scores_owner_insert" ON public.tournament_scores;
CREATE POLICY "tournament_scores_owner_insert"
  ON public.tournament_scores FOR INSERT
  WITH CHECK (
    (
      auth.uid() = athlete_id
      AND status = 'pending'
      AND EXISTS (
        SELECT 1 FROM public.tournament_participants p
         WHERE p.tournament_id = tournament_scores.tournament_id
           AND p.athlete_id    = tournament_scores.athlete_id
      )
      AND public.tournament_wod_accepts_scores(tournament_wod_id, tournament_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
       WHERE t.id = tournament_scores.tournament_id
         AND public.is_box_admin(t.box_id)
    )
  );

-- ── 6. UPDATE : corriger un `pending` OU un `rejected`, retour en `pending` ─
-- `USING` lit l'ancienne ligne, `WITH CHECK` contraint la nouvelle. Sans le
-- second, l'athlète passait sa ligne à `validated` ; sans `rejected` dans le
-- premier, la correction d'un score rejeté échouait en silence.
DROP POLICY IF EXISTS "tournament_scores_owner_update_pending" ON public.tournament_scores;
CREATE POLICY "tournament_scores_owner_update_pending"
  ON public.tournament_scores FOR UPDATE
  USING (
    (
      auth.uid() = athlete_id
      AND status IN ('pending', 'rejected')
      AND public.tournament_wod_accepts_scores(tournament_wod_id, tournament_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
       WHERE t.id = tournament_scores.tournament_id
         AND public.is_box_admin(t.box_id)
    )
  )
  WITH CHECK (
    (
      auth.uid() = athlete_id
      AND status = 'pending'
    )
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
       WHERE t.id = tournament_scores.tournament_id
         AND public.is_box_admin(t.box_id)
    )
  );

-- ── 7. Colonnes que l'athlète ne possède pas ───────────────────────────────
-- Une policy ne peut pas comparer l'ancienne et la nouvelle ligne : c'est le
-- rôle de ce trigger. `notes` n'y figure pas — l'athlète l'écrit (sa remarque)
-- et le staff s'en sert aujourd'hui comme motif de rejet ; déplacer ce motif
-- vers `admin_message` est un lot client, signalé dans la PR.
CREATE OR REPLACE FUNCTION public.trg_tournament_scores_colonnes_reservees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $res$
DECLARE
  v_role  text := auth.role();
  v_staff boolean;
BEGIN
  -- `service_role` (la fonction edge `analyze-tournament-score` écrit
  -- `ai_analysis`) et les connexions sans JWT (migration, cron) passent.
  IF v_role IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT public.is_box_admin(t.box_id) INTO v_staff
    FROM public.tournaments t WHERE t.id = NEW.tournament_id;
  IF COALESCE(v_staff, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.tournament_id        IS DISTINCT FROM OLD.tournament_id
     OR NEW.tournament_wod_id IS DISTINCT FROM OLD.tournament_wod_id
     OR NEW.athlete_id        IS DISTINCT FROM OLD.athlete_id
     OR NEW.validated_by      IS DISTINCT FROM OLD.validated_by
     OR NEW.validated_at      IS DISTINCT FROM OLD.validated_at
     OR NEW.admin_message     IS DISTINCT FROM OLD.admin_message
     OR NEW.elo_points        IS DISTINCT FROM OLD.elo_points
     OR NEW.ai_analysis       IS DISTINCT FROM OLD.ai_analysis THEN
    RAISE EXCEPTION 'tournament_scores : colonne réservée au staff du tournoi'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$res$;

REVOKE ALL ON FUNCTION public.trg_tournament_scores_colonnes_reservees() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_tournament_scores_colonnes_reservees() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_tournament_scores_colonnes_reservees ON public.tournament_scores;
CREATE TRIGGER trg_tournament_scores_colonnes_reservees
  BEFORE UPDATE ON public.tournament_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_tournament_scores_colonnes_reservees();

COMMIT;
