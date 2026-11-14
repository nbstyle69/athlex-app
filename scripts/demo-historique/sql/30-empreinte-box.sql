-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — empreinte de TOUTES les box (AthleX Fitness, Crossfit
-- NBS2 et les autres), en LECTURE SEULE, calculée par la base (md5).
--   prise « avant purge » (juste avant 90) :
--     psql … -v box=<uuid> -v exclus='{…}' -v attendu=<n> -v acceptes='{…}' \
--            -v tournois='{…}' -v sortie=<fichier hors dépôt> -f 30-empreinte-box.sql
--     tournois = tournois supprimés ET archivés (leurs lignes changent).
--   comparaison (après 99) :
--     psql … -v reference=<même fichier> -f 30-empreinte-box.sql
--
-- Tables lues au catalogue : `boxes` et chaque table de public qui a une
-- colonne box_id (une table ajoutée demain est couverte). Lignes écartées à la
-- prise : celles qui citent un compte à purger (toute clé étrangère d'une
-- colonne vers auth.users ou profiles) et celles des tournois listés.
-- Chaque ligne restante est figée (table, box, md5 de la ligne sans les
-- colonnes updated_at et member_count) : à la comparaison, chacune doit être
-- encore là, identique, sinon STOP. Les lignes nouvelles (activité réelle,
-- WOD gardé avec created_by à NULL…) sont comptées pour information.
-- Le fichier ne contient que des uuid techniques et des md5.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, MDY';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET search_path = "$user", public, extensions;
\if :{?reference}
  \i :reference
  SELECT set_config('histo.comptes', current_setting('histo.ref_comptes'), false) AS c,
         set_config('histo.tournois', current_setting('histo.ref_tournois'), false) AS t,
         set_config('histo.box', current_setting('histo.ref_box'), false) AS b \gset histo_
\else
  \ir comptes.sql
  SELECT set_config('histo.tournois', :'tournois', false) AS t \gset histo_
\endif

DO $empreinte$
DECLARE
  r       record;
  v_where text;
  v_txt   text;
  v_tout  text[] := '{}';
BEGIN
  FOR r IN SELECT c.oid::regclass AS t, c.relname = 'boxes' AS est_boxes,
                  EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = c.oid AND attname = 'tournament_id' AND NOT attisdropped) AS a_tournoi
             FROM pg_class c
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
              AND (c.relname = 'boxes' OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = c.oid AND attname = 'box_id' AND NOT attisdropped))
            ORDER BY 1 LOOP
    SELECT string_agg(format('(x.%I IS NULL OR NOT x.%I = ANY (current_setting(''histo.comptes'')::uuid[]))', a.attname, a.attname), ' AND ')
      INTO v_where
      FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
     WHERE k.contype = 'f' AND cardinality(k.conkey) = 1 AND k.conrelid = r.t
       AND k.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass);
    v_where := coalesce(v_where, 'true');
    IF r.a_tournoi THEN
      v_where := v_where || ' AND (x.tournament_id IS NULL OR NOT x.tournament_id = ANY (current_setting(''histo.tournois'')::uuid[]))';
    END IF;
    IF r.t = 'public.tournaments'::regclass THEN
      v_where := v_where || ' AND NOT x.id = ANY (current_setting(''histo.tournois'')::uuid[])';
    END IF;
    EXECUTE format('SELECT string_agg(concat_ws('','', %L, %s, md5((to_jsonb(x) - ''updated_at'' - ''member_count'')::text)), '';'')
                      FROM %s x WHERE %s', r.t::text, CASE WHEN r.est_boxes THEN 'x.id' ELSE 'x.box_id' END, r.t, v_where) INTO v_txt;
    IF v_txt IS NOT NULL THEN v_tout := v_tout || v_txt; END IF;
  END LOOP;
  PERFORM set_config('histo.lignes', array_to_string(v_tout, ';'), false);
END $empreinte$;

\if :{?reference}
DO $comparer$
DECLARE
  r       record;
  v_ecart text := '';
  v_n     bigint := 0;
BEGIN
  FOR r IN
    WITH ref AS (SELECT l, count(*) AS c FROM unnest(string_to_array(current_setting('histo.ref_lignes'), ';')) l WHERE l <> '' GROUP BY l),
         cur AS (SELECT l, count(*) AS c FROM unnest(string_to_array(current_setting('histo.lignes'), ';')) l WHERE l <> '' GROUP BY l),
         j AS (SELECT coalesce(ref.l, cur.l) AS l, coalesce(ref.c, 0) AS avant, coalesce(cur.c, 0) AS apres FROM ref FULL JOIN cur ON cur.l = ref.l)
    SELECT split_part(l, ',', 1) AS t, CASE WHEN split_part(l, ',', 2) = current_setting('histo.box') THEN 'AthleX Fitness' ELSE 'autres box' END AS b,
           sum(avant) AS figees, sum(greatest(avant - apres, 0)) AS ko, sum(greatest(apres - avant, 0)) AS nouvelles
      FROM j GROUP BY 1, 2 ORDER BY 2, 1
  LOOP
    v_n := v_n + r.figees;
    IF r.ko > 0 OR r.nouvelles > 0 THEN
      RAISE NOTICE 'HISTO_BOX % / % : % ligne(s) figée(s), % modifiée(s) ou supprimée(s), % nouvelle(s) (information)', r.b, r.t, r.figees, r.ko, r.nouvelles;
    END IF;
    IF r.ko > 0 THEN
      v_ecart := v_ecart || format(' %s / %s : %s ligne(s) figée(s) modifiée(s) ou supprimée(s) ;', r.b, r.t, r.ko);
    END IF;
  END LOOP;
  IF v_ecart <> '' THEN
    RAISE EXCEPTION 'HISTO_EMPREINTE_BOX:%', v_ecart;
  END IF;
  RAISE NOTICE 'HISTO_EMPREINTE_BOX identique : % ligne(s) figée(s), toutes présentes et inchangées', v_n;
END $comparer$;
\else
\pset tuples_only on
\pset format unaligned
\o :sortie
SELECT format('SELECT set_config(%L, %L, false) AS comptes, set_config(%L, %L, false) AS tournois, set_config(%L, %L, false) AS box, set_config(%L, %L, false) AS lignes \gset histo_ref_',
              'histo.ref_comptes', current_setting('histo.comptes'), 'histo.ref_tournois', current_setting('histo.tournois'),
              'histo.ref_box', current_setting('histo.box'), 'histo.ref_lignes', current_setting('histo.lignes'));
\o
\pset tuples_only off
\pset format aligned
SELECT 'HISTO_EMPREINTE_BOX prise : ' || coalesce(array_length(string_to_array(nullif(current_setting('histo.lignes'), ''), ';'), 1), 0)
       || ' ligne(s) figée(s), ' || count(DISTINCT split_part(l, ',', 2)) || ' box' AS info
  FROM unnest(string_to_array(current_setting('histo.lignes'), ';')) l;
\endif
