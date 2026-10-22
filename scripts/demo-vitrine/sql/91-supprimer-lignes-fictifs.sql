-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — lignes « fictif » du relevé (80-releve-purge.sql) : créées
-- par les comptes fictifs eux-mêmes et citées par une clé en mise à NULL (ou par
-- défaut). Règle (README) : elles sont SUPPRIMÉES, avant la suppression des
-- comptes, pour ne laisser aucune ligne orpheline. Joué comme `postgres`, en une
-- transaction, après 90-purger-tournois.sql :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v comptes='{…}' -v releve=<fichier> \
--        -f scripts/demo-vitrine/sql/91-supprimer-lignes-fictifs.sql
-- Chaque ligne est revérifiée (elle cite encore un compte purgé et aucun compte
-- non purgé) ; sinon exception, donc ROLLBACK.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('vitrine.comptes', :'comptes', true) AS c \gset vitrine_
\i :releve

DO $fictifs$
DECLARE
  r       record;
  n       int;
  v_total int := 0;
  v_reel  text;
  v_ref   record;
BEGIN
  FOR r IN
    SELECT split_part(l, ',', 1) AS tbl, split_part(l, ',', 2) AS pk_col, split_part(l, ',', 3) AS pk, split_part(l, ',', 4) AS col
      FROM unnest(string_to_array(current_setting('vitrine.releve'), ';')) l
     WHERE split_part(l, ',', 5) = 'fictif'
  LOOP
    -- La ligne ne doit citer aucun compte non purgé, sur aucune de ses clés vers un compte.
    SELECT string_agg(format('(%I IS NOT NULL AND NOT %I = ANY (current_setting(''vitrine.comptes'')::uuid[]))', a.attname, a.attname), ' OR ')
      INTO v_reel
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.conrelid = r.tbl::regclass
       AND c.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass);
    -- Et rien ne doit la référencer : sa suppression n'emporte aucune autre ligne.
    FOR v_ref IN
      SELECT format('SELECT count(*) FROM %s WHERE %I::text = $1', c.conrelid::regclass, a.attname) AS q
        FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f' AND c.confrelid = r.tbl::regclass AND cardinality(c.conkey) = 1
    LOOP
      EXECUTE v_ref.q INTO n USING r.pk;
      IF n > 0 THEN
        RAISE EXCEPTION 'VITRINE_FICTIF_REFERENCE: %.% = % est référencée (%) : rien n''est supprimé', r.tbl, r.pk_col, r.pk, v_ref.q;
      END IF;
    END LOOP;
    EXECUTE format('DELETE FROM %s WHERE %I::text = $1 AND %I = ANY (current_setting(''vitrine.comptes'')::uuid[]) AND NOT (%s)',
                   r.tbl, r.pk_col, r.col, v_reel) USING r.pk;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'VITRINE_FICTIF: %.% = % introuvable ou cite un compte non purgé', r.tbl, r.pk_col, r.pk;
    END IF;
    v_total := v_total + 1;
  END LOOP;
  RAISE NOTICE 'VITRINE_FICTIFS supprimees=%', v_total;
END $fictifs$;

COMMIT;
