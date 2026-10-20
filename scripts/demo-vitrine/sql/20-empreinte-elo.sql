-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — empreinte de contrôle de l'ELO des comptes réels
-- protégés (proteges.sql), en LECTURE SEULE, calculée par la base.
--   prise (juste avant le premier seed) :
--     psql … -v box=<uuid> -v sortie=<fichier hors dépôt> -f 20-empreinte-elo.sql
--   comparaison (après la purge) :
--     psql … -v box=<uuid> -v reference=<même fichier>   -f 20-empreinte-elo.sql
-- Le fichier ne contient que des identifiants techniques (uuid des comptes
-- protégés, figés à la prise) et un md5 + un nombre de lignes par table.
-- Tables : profiles (elo, total_matches, wins, losses), box_elo (hors updated_at),
-- elo_history, box_elo_history, tournament_elo_history,
-- tournament_match_elo_history, tournament_wod_elo_history.
-- Comparaison : toute différence → exception avec la liste des tables ; rien
-- n'est corrigé (décision au cas par cas par Nab).
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
SELECT set_config('vitrine.box', :'box', false) AS box \gset vitrine_
\ir proteges.sql
\if :{?reference}
  \i :reference
  SELECT set_config('vitrine.ids', current_setting('vitrine.ref_ids'), false) AS ids \gset vitrine_
\else
  SELECT set_config('vitrine.ids', current_setting('vitrine.proteges'), false) AS ids \gset vitrine_
\endif

SELECT set_config('vitrine.empreinte', (
  SELECT json_object_agg(t, json_build_object('lignes', n, 'md5', coalesce(m, '-')) ORDER BY t)::text FROM (
    SELECT 'profiles' AS t, count(*) AS n, md5(string_agg(concat_ws(':', id, elo, total_matches, wins, losses), '|' ORDER BY id)) AS m
      FROM public.profiles WHERE id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL
    SELECT 'box_elo', count(*), md5(string_agg(concat_ws(':', member_id, box_id, elo, matches, wins), '|' ORDER BY member_id, box_id))
      FROM public.box_elo WHERE member_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL
    SELECT 'elo_history', count(*), md5(string_agg(h::text, '|' ORDER BY h.id))
      FROM public.elo_history h WHERE h.member_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL
    SELECT 'box_elo_history', count(*), md5(string_agg(h::text, '|' ORDER BY h.id))
      FROM public.box_elo_history h WHERE h.member_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL
    SELECT 'tournament_elo_history', count(*), md5(string_agg(h::text, '|' ORDER BY h.id))
      FROM public.tournament_elo_history h WHERE h.athlete_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL
    SELECT 'tournament_match_elo_history', count(*), md5(string_agg(h::text, '|' ORDER BY h.id))
      FROM public.tournament_match_elo_history h WHERE h.athlete_id = ANY (current_setting('vitrine.ids')::uuid[])
    UNION ALL
    SELECT 'tournament_wod_elo_history', count(*), md5(string_agg(h::text, '|' ORDER BY h.id))
      FROM public.tournament_wod_elo_history h WHERE h.athlete_id = ANY (current_setting('vitrine.ids')::uuid[])
  ) x), false) AS empreinte \gset vitrine_

\if :{?reference}
DO $comparer$
DECLARE
  v_ref   jsonb := current_setting('vitrine.ref_empreinte')::jsonb;
  v_now   jsonb := current_setting('vitrine.empreinte')::jsonb;
  v_ecart text  := '';
  k       text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(v_ref || v_now) LOOP
    IF v_ref -> k IS DISTINCT FROM v_now -> k THEN
      v_ecart := v_ecart || format(' %s (lignes %s → %s)', k, v_ref -> k ->> 'lignes', v_now -> k ->> 'lignes');
    END IF;
  END LOOP;
  IF v_ecart <> '' THEN
    RAISE EXCEPTION 'VITRINE_EMPREINTE: écart sur%', v_ecart;
  END IF;
  RAISE NOTICE 'VITRINE_EMPREINTE identique (% compte(s) protégé(s) à la prise, % aujourd''hui)',
    cardinality(current_setting('vitrine.ids')::uuid[]), cardinality(current_setting('vitrine.proteges')::uuid[]);
END $comparer$;
\else
\pset tuples_only on
\pset format unaligned
\o :sortie
SELECT format('SELECT set_config(%L, %L, false) AS ids, set_config(%L, %L, false) AS empreinte \gset vitrine_ref_',
              'vitrine.ref_ids', current_setting('vitrine.ids'), 'vitrine.ref_empreinte', current_setting('vitrine.empreinte'));
\o
\pset tuples_only off
\pset format aligned
SELECT 'VITRINE_EMPREINTE prise : ' || cardinality(current_setting('vitrine.ids')::uuid[]) || ' compte(s) protégé(s)' AS info;
\endif
