-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — signalement, en LECTURE SEULE, au début de chaque
-- `refresh`, `tournaments` et `purge` :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> -f scripts/demo-vitrine/sql/10-contact-elo.sql
-- Un compte réel protégé (proteges.sql) a un score sur un WOD où un compte
-- vitrine a aussi scoré : compute_wod_elo / compute_box_elo l'ont classé ou le
-- classeront parmi les fictifs, et la purge ne le défait pas (étape 2c). STOP
-- avant toute écriture : « WOD, date, nombre de comptes concernés », sans
-- aucun identifiant de personne.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
SELECT set_config('vitrine.box', :'box', false) AS box \gset vitrine_
\ir proteges.sql

DO $contact$
DECLARE
  r      record;
  v_liste text := '';
BEGIN
  FOR r IN
    SELECT w.id, w.scheduled_date, count(DISTINCT p.member_id) AS n
      FROM public.box_wods w
      JOIN public.wod_scores f ON f.wod_id = w.id
      JOIN auth.users u ON u.id = f.member_id
       AND lower(u.email) ~ '^demo\.vitrine\+((0[1-9]|[1-4][0-9]|50)|coach)@athlexapp\.eu$'
      JOIN public.wod_scores p ON p.wod_id = w.id
       AND p.member_id = ANY (current_setting('vitrine.proteges')::uuid[])
     WHERE w.box_id = current_setting('vitrine.box')::uuid
     GROUP BY w.id, w.scheduled_date
     ORDER BY w.scheduled_date, w.id
  LOOP
    v_liste := v_liste || format(' [WOD %s, %s, %s compte(s)]', r.id, r.scheduled_date, r.n);
  END LOOP;
  IF v_liste <> '' THEN
    RAISE EXCEPTION 'VITRINE_CONTACT: compte(s) réel(s) protégé(s) sur un WOD scoré par des fictifs :%', v_liste;
  END IF;
  RAISE NOTICE 'VITRINE_CONTACT aucun (% compte(s) protégé(s))', cardinality(current_setting('vitrine.proteges')::uuid[]);
END $contact$;
