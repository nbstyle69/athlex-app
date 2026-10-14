-- ═════════════════════════════════════════════════════════════════════════════
-- #556 : extend_all_class_schedules() fermée aux clients, et la tâche cron des
-- plannings réparée.
--
-- Appliquée en prod : non.
--
-- Constat en prod, lecture seule (session en default_transaction_read_only),
-- le 14/10/2026 — md5 de pg_get_functiondef calculés par la base :
--   * public.extend_all_class_schedules() : md5 b93015385cad4ce232b1c7f6ed45cc5f,
--     SECURITY DEFINER, propriétaire postgres, search_path=public, 14 vrais CR
--     dans le corps. EXECUTE à authenticated (hérité du baseline, jamais retiré
--     par 20261112) et service_role. Aucun appel client (app, Manager, Edge
--     Functions, fonctions, vues, déclencheurs).
--   * public.generate_class_schedules_from_templates(uuid, integer) :
--     md5 ef1c1ab86c10aad3fb3b66ff704adc34. Depuis 20261112, garde
--     auth.uid() IS NULL → 42501, puis NOT is_box_admin → 42501.
--   * Tâche extend-class-schedules-daily (0 2 * * *, postgres) :
--     « SELECT public.extend_all_class_schedules(); ». Une session cron n'a pas
--     d'auth.uid() : 55 échecs d'affilée depuis le 21/08/2026, « Authentification
--     requise ». Les plannings ne s'étendent plus seuls.
--
-- Ce que fait cette migration :
--   1. internal.generer_plannings_box : la SEULE copie de la logique
--      d'insertion (lundi courant, p_weeks_ahead normalisé, NOT EXISTS sur
--      box, date, heure de début, titre). Sans garde client ; postgres seul.
--   2. internal.etendre_plannings_boxes : la boucle sur les box à modèles
--      actifs, pour le chemin serveur. Postgres seul.
--   3. public.generate_class_schedules_from_templates garde ses deux gardes,
--      dans le même ordre et avec les mêmes messages, puis délègue au 1.
--      Le comportement vu du Manager ne change pas.
--   4. public.extend_all_class_schedules délègue au 2 et n'est plus
--      exécutable par PUBLIC, anon ni authenticated. La tâche cron appelle
--      toujours la même chose : rien à y changer.
--
-- Retour arrière : supabase/retours/20270155000000_plannings_cron_internal.sql
-- Contrôles : supabase/tests/plannings_cron_internal.sql, audit T19b (22 → 21),
-- schema_internal_ferme.sql (I1 à I3).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. La logique d'insertion, une seule fois ────────────────────────────────
CREATE FUNCTION internal.generer_plannings_box(p_box_id uuid, p_weeks_ahead integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted INT := 0;
  v_start_date DATE := CURRENT_DATE - ((EXTRACT(ISODOW FROM CURRENT_DATE)::INT - 1));
  v_end_date DATE;
BEGIN
  IF p_weeks_ahead IS NULL OR p_weeks_ahead < 1 THEN
    p_weeks_ahead := 8;
  END IF;

  v_end_date := v_start_date + (p_weeks_ahead * 7) - 1;

  WITH ins AS (
    INSERT INTO class_schedules
      (box_id, title, description, coach, scheduled_date, start_time, end_time, max_capacity)
    SELECT
      t.box_id, t.title, t.description, t.coach,
      d::date, t.start_time, t.end_time, t.max_capacity
    FROM schedule_templates t
    CROSS JOIN generate_series(v_start_date, v_end_date, INTERVAL '1 day') AS d
    WHERE t.box_id = p_box_id
      AND t.is_active = TRUE
      AND EXTRACT(ISODOW FROM d)::INT = t.day_of_week
      AND NOT EXISTS (
        SELECT 1 FROM class_schedules cs
        WHERE cs.box_id = t.box_id
          AND cs.scheduled_date = d::date
          AND cs.start_time = t.start_time
          AND cs.title = t.title
      )
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$function$;
REVOKE ALL ON FUNCTION internal.generer_plannings_box(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;

-- ── 2. Le chemin serveur ─────────────────────────────────────────────────────
CREATE FUNCTION internal.etendre_plannings_boxes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INT := 0;
  v_box RECORD;
BEGIN
  FOR v_box IN
    SELECT DISTINCT box_id
    FROM schedule_templates
    WHERE is_active = TRUE
  LOOP
    v_total := v_total + internal.generer_plannings_box(v_box.box_id, 8);
  END LOOP;
  RETURN v_total;
END;
$function$;
REVOKE ALL ON FUNCTION internal.etendre_plannings_boxes() FROM PUBLIC, anon, authenticated, service_role;

-- ── 3. La porte du Manager : mêmes gardes, puis délégation ───────────────────
CREATE OR REPLACE FUNCTION public.generate_class_schedules_from_templates(p_box_id uuid, p_weeks_ahead integer DEFAULT 8)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_box_admin(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : cette box ne vous appartient pas' USING ERRCODE = '42501';
  END IF;

  RETURN internal.generer_plannings_box(p_box_id, p_weeks_ahead);
END;
$function$;

-- ── 4. La porte du cron : délégation, fermée aux clients ─────────────────────
CREATE OR REPLACE FUNCTION public.extend_all_class_schedules()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN internal.etendre_plannings_boxes();
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.extend_all_class_schedules() FROM PUBLIC, anon, authenticated;
