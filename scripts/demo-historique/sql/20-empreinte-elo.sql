-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — empreinte de l'ELO de TOUS les comptes qui restent,
-- en LECTURE SEULE, calculée par la base (md5).
--   prise (juste avant 90) :
--     psql … -v box=<uuid> -v exclus='{…}' -v attendu=<n> -v acceptes='{…}' \
--            -v tournois='{…}' -v sortie=<fichier hors dépôt> -f 20-empreinte-elo.sql
--   comparaison (après 99) :
--     psql … -v reference=<même fichier> -f 20-empreinte-elo.sql
--
-- Lignes figées : chaque ligne de elo_history, box_elo_history,
-- tournament_elo_history, tournament_match_elo_history et
-- tournament_wod_elo_history d'un compte qui n'est PAS à purger (comptes.sql),
-- hors tournois supprimés (`tournois`), avec son md5. À la comparaison, chacune
-- doit exister encore, inchangée ; sinon STOP, rien n'est corrigé.
-- Les lignes nouvelles ne sont pas contrôlées (activité réelle entre-temps).
-- ELO courant (profiles.elo et compteurs) des mêmes comptes : information,
-- « N inchangé(s), M changé(s) », sans identifiant, sans arrêt.
-- Le fichier ne contient que des uuid techniques et des md5.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
-- Réglages qui changent le texte d'une ligne : fixés, pour qu'une prise et une
-- comparaison faites dans deux sessions donnent le même md5.
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, MDY';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET search_path = "$user", public, extensions;
\if :{?reference}
  \i :reference
  SELECT set_config('histo.comptes', current_setting('histo.ref_comptes'), false) AS c,
         set_config('histo.tournois', current_setting('histo.ref_tournois'), false) AS t \gset histo_
\else
  \ir comptes.sql
  SELECT set_config('histo.tournois', :'tournois', false) AS t \gset histo_
\endif

-- Lignes d'historique, « table,id,md5 » séparées par « ; ».
SELECT set_config('histo.lignes', coalesce((
  SELECT string_agg(concat_ws(',', t, id, m), ';' ORDER BY t, id) FROM (
    SELECT 'elo_history' AS t, h.id::text AS id, md5(h::text) AS m FROM public.elo_history h
     WHERE NOT h.member_id = ANY (current_setting('histo.comptes')::uuid[])
    UNION ALL SELECT 'box_elo_history', h.id::text, md5(h::text) FROM public.box_elo_history h
     WHERE NOT h.member_id = ANY (current_setting('histo.comptes')::uuid[])
    UNION ALL SELECT 'tournament_elo_history', h.id::text, md5(h::text) FROM public.tournament_elo_history h
     WHERE NOT h.athlete_id = ANY (current_setting('histo.comptes')::uuid[])
       AND (h.tournament_id IS NULL OR NOT h.tournament_id = ANY (current_setting('histo.tournois')::uuid[]))
    UNION ALL SELECT 'tournament_match_elo_history', h.id::text, md5(h::text) FROM public.tournament_match_elo_history h
     WHERE NOT h.athlete_id = ANY (current_setting('histo.comptes')::uuid[])
       AND NOT h.tournament_id = ANY (current_setting('histo.tournois')::uuid[])
    UNION ALL SELECT 'tournament_wod_elo_history', h.id::text, md5(h::text) FROM public.tournament_wod_elo_history h
     WHERE NOT h.athlete_id = ANY (current_setting('histo.comptes')::uuid[])
       AND NOT h.tournament_id = ANY (current_setting('histo.tournois')::uuid[])) x), ''), false) AS lignes \gset histo_

-- ELO courant par compte restant, « id,md5 » : information seulement.
SELECT set_config('histo.courant', coalesce((
  SELECT string_agg(concat_ws(',', p.id, md5(concat_ws(':', p.elo, p.total_matches, p.wins, p.losses))), ';' ORDER BY p.id)
    FROM public.profiles p WHERE NOT p.id = ANY (current_setting('histo.comptes')::uuid[])), ''), false) AS courant \gset histo_

\if :{?reference}
DO $comparer$
DECLARE
  r          record;
  v_m        text;
  v_ecart    text := '';
  v_figees   int := 0;
  v_change   int := 0;
  v_inchange int := 0;
BEGIN
  FOR r IN
    WITH ref AS (SELECT l FROM unnest(string_to_array(current_setting('histo.ref_lignes'), ';')) l WHERE l <> ''),
         cur AS (SELECT l FROM unnest(string_to_array(current_setting('histo.lignes'), ';')) l),
         ko  AS (SELECT l FROM ref EXCEPT SELECT l FROM cur)
    SELECT split_part(ref.l, ',', 1) AS t, count(*) AS n, count(ko.l) AS ko
      FROM ref LEFT JOIN ko ON ko.l = ref.l GROUP BY 1 ORDER BY 1
  LOOP
    v_figees := v_figees + r.n;
    RAISE NOTICE 'HISTO_EMPREINTE_ELO % : % ligne(s) figée(s), % modifiée(s) ou supprimée(s)', r.t, r.n, r.ko;
    IF r.ko > 0 THEN
      v_ecart := v_ecart || format(' %s : %s ligne(s) figée(s) modifiée(s) ou supprimée(s) sur %s ;', r.t, r.ko, r.n);
    END IF;
  END LOOP;
  FOR r IN
    SELECT split_part(l, ',', 1) AS id, split_part(l, ',', 2) AS m
      FROM unnest(string_to_array(current_setting('histo.ref_courant'), ';')) l WHERE l <> ''
  LOOP
    v_m := NULL;
    SELECT split_part(c, ',', 2) INTO v_m
      FROM unnest(string_to_array(current_setting('histo.courant'), ';')) c WHERE split_part(c, ',', 1) = r.id;
    IF v_m IS NOT DISTINCT FROM r.m THEN v_inchange := v_inchange + 1; ELSE v_change := v_change + 1; END IF;
  END LOOP;
  RAISE NOTICE 'HISTO_ELO_COURANT (information) : % compte(s) inchangé(s), % changé(s)', v_inchange, v_change;
  IF v_ecart <> '' THEN
    RAISE EXCEPTION 'HISTO_EMPREINTE_ELO:%', v_ecart;
  END IF;
  RAISE NOTICE 'HISTO_EMPREINTE_ELO lignes figées intactes : %', v_figees;
END $comparer$;
\else
\pset tuples_only on
\pset format unaligned
\o :sortie
SELECT format('SELECT set_config(%L, %L, false) AS comptes, set_config(%L, %L, false) AS tournois, set_config(%L, %L, false) AS lignes, set_config(%L, %L, false) AS courant \gset histo_ref_',
              'histo.ref_comptes', current_setting('histo.comptes'), 'histo.ref_tournois', current_setting('histo.tournois'),
              'histo.ref_lignes', current_setting('histo.lignes'), 'histo.ref_courant', current_setting('histo.courant'));
\o
\pset tuples_only off
\pset format aligned
SELECT 'HISTO_EMPREINTE_ELO prise : ' || coalesce(array_length(string_to_array(nullif(current_setting('histo.lignes'), ''), ';'), 1), 0)
       || ' ligne(s) figée(s), ' || coalesce(array_length(string_to_array(nullif(current_setting('histo.courant'), ''), ';'), 1), 0) || ' compte(s)' AS info;
\endif
