-- ═════════════════════════════════════════════════════════════════════════════
-- Retour arrière de 20270156000000_plannings_cron_internal.sql
--
-- À jouer en UNE transaction :  psql "$PROD_DB_URL" -1 -v ON_ERROR_STOP=1 -f <ce fichier>
-- (pas de BEGIN/COMMIT ici : le test plannings_cron_internal.sql le rejoue
-- dans sa propre transaction annulée).
--
-- Définitions rétablies octet pour octet (relevé de prod du 14/10/2026,
-- md5 de pg_get_functiondef calculés par la base, à recontrôler avant
-- l'application) :
--   generate_class_schedules_from_templates(uuid,integer)  ef1c1ab86c10aad3fb3b66ff704adc34
--   extend_all_class_schedules()                          b93015385cad4ce232b1c7f6ed45cc5f
-- Le corps de extend_all porte 14 CR en prod : il est reconstruit par
-- replace(…, E'\n', E'\r\n'), après retrait de tout CR que l'extraction du
-- fichier aurait pu ajouter, pour ne pas dépendre des fins de ligne du dépôt.
-- Droits rétablis : extend_all exécutable par authenticated et service_role,
-- pas par anon. Remet la tâche cron en échec chaque nuit, et rouvre
-- extend_all aux comptes connectés : à ne jouer que pour annuler la migration.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_class_schedules_from_templates(p_box_id uuid, p_weeks_ahead integer DEFAULT 8)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_box_admin(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : cette box ne vous appartient pas' USING ERRCODE = '42501';
  END IF;

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
$function$
;

DO $retour$
BEGIN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.extend_all_class_schedules()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS ' || quote_literal(replace(replace($corps$
DECLARE
  v_total INT := 0;
  v_box RECORD;
BEGIN
  FOR v_box IN
    SELECT DISTINCT box_id
    FROM schedule_templates
    WHERE is_active = TRUE
  LOOP
    v_total := v_total + public.generate_class_schedules_from_templates(v_box.box_id, 8);
  END LOOP;
  RETURN v_total;
END;
$corps$, E'\r', ''), E'\n', E'\r\n'));
END $retour$;
GRANT EXECUTE ON FUNCTION public.extend_all_class_schedules() TO authenticated;

DROP FUNCTION internal.etendre_plannings_boxes();
DROP FUNCTION internal.generer_plannings_box(uuid, integer);
