-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — empreinte de la box et des lignes à ne pas toucher, en
-- LECTURE SEULE, calculée par la base (md5). Essai (étape 3) et application.
--   prise :       psql … -v box=<uuid> -v sortie=<fichier hors dépôt>    -f 30-empreinte-box.sql
--   comparaison : psql … -v box=<uuid> -v reference=<même fichier>      -f 30-empreinte-box.sql
--
-- (a) Lignes qui ne doivent pas bouger, STRICT (aucune ligne modifiée,
--     supprimée ni ajoutée) : comptes A = membres de la box présents dans
--     internal.demo_accounts (reviewer, comptes de démo historiques) + comptes
--     réels protégés (proteges.sql), figés à la prise. Tables : box_members
--     (adhésion à la box), profiles (elo, compteurs, level), elo_history,
--     box_elo (hors updated_at), box_elo_history, wod_scores, class_reservations,
--     athlete_badges, user_movement_stats (hors updated_at) ; et les tournois
--     de la box existant à la prise, avec leurs matchs.
-- (b) Agrégats de la box : la ligne `boxes`, ses formules (STRICT) ; ses
--     créneaux et ses WODs existant à la prise (LIGNES FIGÉES : chacune
--     identique) ; les créneaux et WODs créés depuis (cron
--     extend-class-schedules-daily, programmation) sont comptés pour
--     information seulement.
-- Colonnes exclues : box_elo.updated_at, user_movement_stats.updated_at.
-- Le fichier ne contient que des uuid techniques et des md5.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, MDY';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET search_path = "$user", public, extensions;
SELECT set_config('vitrine.box', :'box', false) AS box \gset vitrine_
\ir proteges.sql
\if :{?reference}
  \i :reference
  SELECT set_config('vitrine.a', current_setting('vitrine.ref_a'), false) AS a,
         set_config('vitrine.t', current_setting('vitrine.ref_t'), false) AS t \gset vitrine_
\else
  SELECT set_config('vitrine.a', coalesce((
           SELECT array_agg(id ORDER BY id)::text FROM (
             SELECT d.user_id AS id FROM internal.demo_accounts d
               JOIN public.box_members bm ON bm.member_id = d.user_id AND bm.box_id = current_setting('vitrine.box')::uuid
             UNION SELECT unnest(current_setting('vitrine.proteges')::uuid[])) x), '{}'), false) AS a,
         set_config('vitrine.t', coalesce((
           SELECT array_agg(id ORDER BY id)::text FROM public.tournaments WHERE box_id = current_setting('vitrine.box')::uuid), '{}'), false) AS t \gset vitrine_
\endif

-- (a) et (b) stricts : « table,lignes,md5 » ; (b) figées : « table,id,md5 ».
SELECT set_config('vitrine.strict', (
  SELECT string_agg(concat_ws(',', t, n, coalesce(m, '-')), ';' ORDER BY t) FROM (
    SELECT 'a.box_members' AS t, count(*) AS n, md5(string_agg(x::text, '|' ORDER BY x.id)) AS m FROM public.box_members x
     WHERE x.box_id = current_setting('vitrine.box')::uuid AND x.member_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.profiles', count(*), md5(string_agg(concat_ws(':', id, elo, total_matches, wins, losses, level), '|' ORDER BY id))
      FROM public.profiles WHERE id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.elo_history', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.elo_history x
     WHERE x.member_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.box_elo', count(*), md5(string_agg(concat_ws(':', member_id, box_id, elo, matches, wins), '|' ORDER BY member_id, box_id))
      FROM public.box_elo WHERE member_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.box_elo_history', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.box_elo_history x
     WHERE x.member_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.wod_scores', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.wod_scores x
     WHERE x.member_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.class_reservations', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.class_reservations x
     WHERE x.member_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.athlete_badges', count(*), md5(string_agg(x::text, '|' ORDER BY x::text)) FROM public.athlete_badges x
     WHERE x.athlete_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.user_movement_stats', count(*), md5(string_agg(concat_ws(':', user_id, movement, unit, total_reps, best_weight), '|' ORDER BY user_id, movement, unit))
      FROM public.user_movement_stats WHERE user_id = ANY (current_setting('vitrine.a')::uuid[])
    UNION ALL SELECT 'a.tournaments', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.tournaments x
     WHERE x.id = ANY (current_setting('vitrine.t')::uuid[])
    UNION ALL SELECT 'a.tournament_bracket_matches', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.tournament_bracket_matches x
     WHERE x.tournament_id = ANY (current_setting('vitrine.t')::uuid[])
    UNION ALL SELECT 'b.boxes', count(*), md5(string_agg(x::text, '|')) FROM public.boxes x WHERE x.id = current_setting('vitrine.box')::uuid
    UNION ALL SELECT 'b.membership_plans', count(*), md5(string_agg(x::text, '|' ORDER BY x.id)) FROM public.membership_plans x
     WHERE x.box_id = current_setting('vitrine.box')::uuid) s), false) AS strict \gset vitrine_

SELECT set_config('vitrine.figees', coalesce((
  SELECT string_agg(concat_ws(',', t, id, m), ';' ORDER BY t, id) FROM (
    SELECT 'b.class_schedules' AS t, x.id::text AS id, md5(x::text) AS m FROM public.class_schedules x
     WHERE x.box_id = current_setting('vitrine.box')::uuid
    UNION ALL SELECT 'b.box_wods', x.id::text, md5(x::text) FROM public.box_wods x
     WHERE x.box_id = current_setting('vitrine.box')::uuid) f), ''), false) AS figees \gset vitrine_

\if :{?reference}
DO $comparer$
DECLARE
  r       record;
  v_ecart text := '';
  v_info  text := '';
BEGIN
  FOR r IN
    WITH ref AS (SELECT split_part(l, ',', 1) t, l FROM unnest(string_to_array(current_setting('vitrine.ref_strict'), ';')) l),
         cur AS (SELECT split_part(l, ',', 1) t, l FROM unnest(string_to_array(current_setting('vitrine.strict'), ';')) l)
    SELECT coalesce(ref.t, cur.t) AS t, ref.l AS avant, cur.l AS apres FROM ref FULL JOIN cur ON cur.t = ref.t ORDER BY 1
  LOOP
    RAISE NOTICE 'VITRINE_BOX % : lignes % → % %', r.t, split_part(r.avant, ',', 2), split_part(r.apres, ',', 2),
      CASE WHEN r.avant IS NOT DISTINCT FROM r.apres THEN 'identique' ELSE 'DIFFÉRENT' END;
    IF r.avant IS DISTINCT FROM r.apres THEN
      v_ecart := v_ecart || format(' %s (lignes %s → %s) ;', r.t, split_part(r.avant, ',', 2), split_part(r.apres, ',', 2));
    END IF;
  END LOOP;
  FOR r IN
    WITH ref AS (SELECT l FROM unnest(string_to_array(current_setting('vitrine.ref_figees'), ';')) l WHERE l <> ''),
         cur AS (SELECT l FROM unnest(string_to_array(current_setting('vitrine.figees'), ';')) l WHERE l <> ''),
         ko  AS (SELECT l FROM ref EXCEPT SELECT l FROM cur),
         neuf AS (SELECT l FROM cur WHERE split_part(l, ',', 2) NOT IN (SELECT split_part(l, ',', 2) FROM ref))
    SELECT t, sum(n) AS n, sum(ko) AS ko, sum(nouv) AS nouvelles FROM (
      SELECT split_part(ref.l, ',', 1) AS t, 1 AS n, (ko.l IS NOT NULL)::int AS ko, 0 AS nouv
        FROM ref LEFT JOIN ko ON ko.l = ref.l
      UNION ALL SELECT split_part(l, ',', 1), 0, 0, 1 FROM neuf) x
     GROUP BY t ORDER BY t
  LOOP
    RAISE NOTICE 'VITRINE_BOX % : % ligne(s) figée(s), % modifiée(s) ou supprimée(s) ; % nouvelle(s) (information)', r.t, r.n, r.ko, r.nouvelles;
    IF r.ko > 0 THEN
      v_ecart := v_ecart || format(' %s : %s ligne(s) figée(s) modifiée(s) ou supprimée(s) ;', r.t, r.ko);
    END IF;
  END LOOP;
  IF v_ecart <> '' THEN
    RAISE EXCEPTION 'VITRINE_EMPREINTE_BOX:%', v_ecart;
  END IF;
  RAISE NOTICE 'VITRINE_EMPREINTE_BOX identique (% compte(s) A, % tournoi(s) existant(s))',
    cardinality(current_setting('vitrine.a')::uuid[]), cardinality(current_setting('vitrine.t')::uuid[]);
END $comparer$;
\else
\pset tuples_only on
\pset format unaligned
\o :sortie
SELECT format('SELECT set_config(%L, %L, false) AS a, set_config(%L, %L, false) AS t, set_config(%L, %L, false) AS strict, set_config(%L, %L, false) AS figees \gset vitrine_ref_',
              'vitrine.ref_a', current_setting('vitrine.a'), 'vitrine.ref_t', current_setting('vitrine.t'),
              'vitrine.ref_strict', current_setting('vitrine.strict'), 'vitrine.ref_figees', current_setting('vitrine.figees'));
\o
\pset tuples_only off
\pset format aligned
SELECT 'VITRINE_EMPREINTE_BOX prise : ' || cardinality(current_setting('vitrine.a')::uuid[]) || ' compte(s) A, '
       || cardinality(current_setting('vitrine.t')::uuid[]) || ' tournoi(s), '
       || coalesce(array_length(string_to_array(nullif(current_setting('vitrine.figees'), ''), ';'), 1), 0) || ' ligne(s) figée(s)' AS info;
\endif
