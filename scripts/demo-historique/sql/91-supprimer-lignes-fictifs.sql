-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — lignes « fictif » du relevé (80-releve-purge.sql) :
-- hors tables de box, créées par les comptes de démo eux-mêmes et citées par une
-- clé en mise à NULL (ou par défaut). Elles sont SUPPRIMÉES avant la
-- suppression des comptes, pour ne laisser aucune ligne orpheline. Joué comme
-- `postgres`, en une transaction, après 90-tournois.sql :
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v releve=<fichier de 80> \
--        -f scripts/demo-historique/sql/91-supprimer-lignes-fictifs.sql
-- Chaque ligne est revérifiée (elle cite encore un compte purgé et aucun compte
-- non purgé, rien ne la référence) ; sinon exception, donc ROLLBACK.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
BEGIN;
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
      FROM unnest(string_to_array(current_setting('histo.releve'), ';')) l
     WHERE split_part(l, ',', 5) = 'fictif'
  LOOP
    -- La ligne ne doit citer aucun compte non purgé, sur aucune de ses clés vers un compte.
    SELECT string_agg(format('(%I IS NOT NULL AND NOT %I = ANY (current_setting(''histo.comptes'')::uuid[]))', a.attname, a.attname), ' OR ')
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
        RAISE EXCEPTION 'HISTO_FICTIF_REFERENCE: %.% = % est référencée (%) : rien n''est supprimé', r.tbl, r.pk_col, r.pk, v_ref.q;
      END IF;
    END LOOP;
    EXECUTE format('DELETE FROM %s WHERE %I::text = $1 AND %I = ANY (current_setting(''histo.comptes'')::uuid[]) AND NOT (%s)',
                   r.tbl, r.pk_col, r.col, v_reel) USING r.pk;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'HISTO_FICTIF: %.% = % introuvable ou cite un compte non purgé', r.tbl, r.pk_col, r.pk;
    END IF;
    v_total := v_total + 1;
  END LOOP;
  RAISE NOTICE 'HISTO_FICTIFS supprimees=%', v_total;
END $fictifs$;

-- Groupes de messages listés au relevé (`groupes`, décision de Nab), garde
-- revérifiée : groupe de la box, membres tous parmi les comptes purgés, aucun
-- message, aucune référence ; sinon exception, ROLLBACK.
DO $groupes$
DECLARE
  v_grp     uuid[] := coalesce(nullif(current_setting('histo.groupes', true), ''), '{}')::uuid[];
  v_comptes uuid[] := current_setting('histo.comptes')::uuid[];
  r         record;
  n         int;
BEGIN
  FOR r IN SELECT g.id, x.box_id,
                  (SELECT count(*) FROM unnest(x.members) m WHERE NOT m = ANY (v_comptes)) AS hors_demo,
                  (SELECT count(*) FROM public.messages y WHERE y.group_id = g.id)
                + (SELECT count(*) FROM public.group_messages y WHERE y.group_id = g.id)
                + (SELECT count(*) FROM public.box_messages y WHERE y.target_group_id = g.id)
                + (SELECT count(*) FROM public.membership_plan_groups y WHERE y.group_id = g.id)
                + (SELECT count(*) FROM public.wod_group_access y WHERE y.group_id = g.id)
                + (SELECT count(*) FROM public.box_programming_subscriptions y WHERE g.id = ANY (y.default_group_ids)) AS refs
             FROM unnest(v_grp) g(id) LEFT JOIN public.message_groups x ON x.id = g.id LOOP
    CONTINUE WHEN r.box_id IS NULL;   -- déjà supprimé (rejeu)
    IF r.hors_demo > 0 OR r.refs > 0 THEN
      RAISE EXCEPTION 'HISTO_GROUPE: % : % membre(s) hors comptes purgés, % message(s) ou référence(s) : ROLLBACK', r.id, r.hors_demo, r.refs;
    END IF;
    DELETE FROM public.message_groups x WHERE x.id = r.id AND x.box_id = current_setting('histo.box')::uuid
       AND x.members <@ v_comptes;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'HISTO_GROUPE: % hors de la box ou introuvable : ROLLBACK', r.id; END IF;
    RAISE NOTICE 'HISTO_GROUPE % supprimé', r.id;
  END LOOP;
END $groupes$;

COMMIT;
