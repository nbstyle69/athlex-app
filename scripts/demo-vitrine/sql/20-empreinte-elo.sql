-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — empreinte de contrôle de l'ELO des comptes réels
-- protégés (proteges.sql), en LECTURE SEULE, calculée par la base.
--   prise (juste avant le premier seed) :
--     psql … -v box=<uuid> -v sortie=<fichier hors dépôt> -f 20-empreinte-elo.sql
--   comparaison (fin de la purge) :
--     psql … -v box=<uuid> -v reference=<même fichier>   -f 20-empreinte-elo.sql
--
-- La contamination par les fictifs n'entre que par compute_wod_elo /
-- compute_box_elo sur un WOD scoré par un fictif, ou par un tournoi de vitrine
-- (étape 2c). L'empreinte ne fige donc que ce qui existait à la prise :
--   1. LIGNES FIGÉES : chaque ligne des comptes protégés dans elo_history,
--      box_elo_history, tournament_elo_history, tournament_match_elo_history et
--      tournament_wod_elo_history, avec son md5 (calculé par la base). À la
--      comparaison, chacune doit exister encore, inchangée ; sinon STOP.
--   2. Les lignes NOUVELLES ne sont pas contrôlées ici : ailleurs (autres WODs,
--      autres box, autres tournois), elles sont permises ; au contact des
--      fictifs, 80-releve-purge.sql les arrête avant toute suppression.
--   3. ELO COURANT (profiles.elo et compteurs, box_elo de la box), pour
--      information : « inchangé » / « changé », en nombre de comptes, sans
--      identifiant et sans arrêter le script (il bouge légitimement).
-- Le fichier ne contient que des uuid techniques et des md5.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
-- Réglages qui changent le texte d'une ligne (ligne::text, dates, flottants) :
-- fixés ici, pour qu'une prise et une comparaison faites dans deux sessions
-- différentes donnent le même md5. search_path = celui de la prod.
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, MDY';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET search_path = "$user", public, extensions;
SELECT set_config('vitrine.box', :'box', false) AS box \gset vitrine_
\ir proteges.sql
\if :{?reference}
  \i :reference
  SELECT set_config('vitrine.ids', current_setting('vitrine.ref_ids'), false) AS ids \gset vitrine_
\else
  SELECT set_config('vitrine.ids', current_setting('vitrine.proteges'), false) AS ids \gset vitrine_
\endif

-- Lignes d'historique des comptes, « table,id,md5 » séparées par « ; ».
SELECT set_config('vitrine.lignes', coalesce((
  SELECT string_agg(concat_ws(',', t, id, m), ';' ORDER BY t, id) FROM (
    SELECT 'elo_history' AS t, h.id::text AS id, md5(h::text) AS m FROM public.elo_history h
     WHERE h.member_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL SELECT 'box_elo_history', h.id::text, md5(h::text) FROM public.box_elo_history h
     WHERE h.member_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL SELECT 'tournament_elo_history', h.id::text, md5(h::text) FROM public.tournament_elo_history h
     WHERE h.athlete_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL SELECT 'tournament_match_elo_history', h.id::text, md5(h::text) FROM public.tournament_match_elo_history h
     WHERE h.athlete_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL SELECT 'tournament_wod_elo_history', h.id::text, md5(h::text) FROM public.tournament_wod_elo_history h
     WHERE h.athlete_id = ANY (current_setting('vitrine.ids')::uuid[])) x), ''), false) AS lignes \gset vitrine_

-- ELO courant par compte, « id,md5 » : information seulement.
SELECT set_config('vitrine.courant', coalesce((
  SELECT string_agg(concat_ws(',', p.id, md5(concat_ws(':', p.elo, p.total_matches, p.wins, p.losses, be.elo, be.matches, be.wins))), ';' ORDER BY p.id)
    FROM public.profiles p
    LEFT JOIN public.box_elo be ON be.member_id = p.id AND be.box_id = current_setting('vitrine.box')::uuid
   WHERE p.id = ANY (current_setting('vitrine.ids')::uuid[])), ''), false) AS courant \gset vitrine_

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
  -- 1. Lignes figées : présentes et inchangées.
  FOR r IN
    WITH ref AS (SELECT l FROM unnest(string_to_array(current_setting('vitrine.ref_lignes'), ';')) l WHERE l <> ''),
         cur AS (SELECT l FROM unnest(string_to_array(current_setting('vitrine.lignes'), ';')) l),
         ko  AS (SELECT l FROM ref EXCEPT SELECT l FROM cur)
    SELECT split_part(ref.l, ',', 1) AS t, count(*) AS n, count(ko.l) AS ko
      FROM ref LEFT JOIN ko ON ko.l = ref.l
     GROUP BY 1 ORDER BY 1
  LOOP
    v_figees := v_figees + r.n;
    IF r.ko > 0 THEN
      v_ecart := v_ecart || format(' %s : %s ligne(s) figée(s) modifiée(s) ou supprimée(s) sur %s ;', r.t, r.ko, r.n);
    END IF;
  END LOOP;

  -- 3. ELO courant : information, par compte, en nombre.
  FOR r IN
    SELECT split_part(l, ',', 1) AS id, split_part(l, ',', 2) AS m
      FROM unnest(string_to_array(current_setting('vitrine.ref_courant'), ';')) l WHERE l <> ''
  LOOP
    SELECT split_part(c, ',', 2) INTO v_m
      FROM unnest(string_to_array(current_setting('vitrine.courant'), ';')) c WHERE split_part(c, ',', 1) = r.id;
    IF v_m IS NOT DISTINCT FROM r.m THEN v_inchange := v_inchange + 1; ELSE v_change := v_change + 1; END IF;
  END LOOP;
  RAISE NOTICE 'VITRINE_ELO_COURANT (information) : % compte(s) inchangé(s), % changé(s)', v_inchange, v_change;

  IF v_ecart <> '' THEN
    RAISE EXCEPTION 'VITRINE_EMPREINTE:%', v_ecart;
  END IF;
  RAISE NOTICE 'VITRINE_EMPREINTE lignes figées intactes : % (% compte(s) protégé(s) à la prise)',
    v_figees, cardinality(current_setting('vitrine.ids')::uuid[]);
END $comparer$;
\else
\pset tuples_only on
\pset format unaligned
\o :sortie
SELECT format('SELECT set_config(%L, %L, false) AS ids, set_config(%L, %L, false) AS lignes, set_config(%L, %L, false) AS courant \gset vitrine_ref_',
              'vitrine.ref_ids', current_setting('vitrine.ids'),
              'vitrine.ref_lignes', current_setting('vitrine.lignes'),
              'vitrine.ref_courant', current_setting('vitrine.courant'));
\o
\pset tuples_only off
\pset format aligned
SELECT 'VITRINE_EMPREINTE prise : ' || cardinality(current_setting('vitrine.ids')::uuid[]) || ' compte(s) protégé(s), '
       || coalesce(array_length(string_to_array(nullif(current_setting('vitrine.lignes'), ''), ';'), 1), 0) || ' ligne(s) figée(s)' AS info;
\endif
