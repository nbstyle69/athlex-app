-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — liste des comptes à purger, posée dans le réglage de
-- session `histo.comptes` (uuid[]). Inclus par \ir depuis 20, 30, 80 et 99 :
-- une seule définition. Lecture seule.
--   Comptes à purger = internal.demo_accounts, sauf les uuid de `exclus`
--   (reviewer Apple : son entrée demo_accounts reste).
-- Variables psql : box (AthleX Fitness), exclus (uuid[]), attendu (nombre),
-- acceptes (uuid[] : comptes réels dont un contact est accepté explicitement
-- par Nab, par uuid, jamais par pseudo : reviewer, testapple).
-- Gardes (exception, donc rien d'écrit ensuite) :
--   - chaque uuid de `exclus` est dans internal.demo_accounts ;
--   - le nombre de comptes vaut `attendu` ;
--   - chaque compte a une adresse en @demo.athlexapp.eu ;
--   - aucun compte n'est rattaché à une autre box que `box`, ni gérant d'une box.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT set_config('histo.box', :'box', false) AS b, set_config('histo.exclus', :'exclus', false) AS e,
       set_config('histo.attendu', :'attendu', false) AS n, set_config('histo.acceptes', :'acceptes', false) AS a \gset histo_
SELECT set_config('histo.comptes', coalesce((
  SELECT array_agg(d.user_id ORDER BY d.user_id)::text FROM internal.demo_accounts d
   WHERE NOT d.user_id = ANY (current_setting('histo.exclus')::uuid[])), '{}'), false) AS comptes \gset histo_

DO $comptes$
DECLARE
  v_comptes uuid[] := current_setting('histo.comptes')::uuid[];
  v_box     uuid   := current_setting('histo.box')::uuid;
  n         bigint;
BEGIN
  SELECT count(*) INTO n FROM unnest(current_setting('histo.exclus')::uuid[]) e(id)
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = e.id);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_EXCLUS: % compte(s) exclu(s) absent(s) de internal.demo_accounts', n; END IF;
  IF cardinality(v_comptes) <> current_setting('histo.attendu')::int THEN
    RAISE EXCEPTION 'HISTO_NOMBRE: % compte(s) à purger, % attendu(s)', cardinality(v_comptes), current_setting('histo.attendu');
  END IF;
  SELECT count(*) INTO n FROM unnest(v_comptes) c(id)
   WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id AND lower(u.email) ~ '^[^@]+@demo\.athlexapp\.eu$');
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_DOMAINE: % compte(s) sans adresse en @demo.athlexapp.eu', n; END IF;
  SELECT count(*) INTO n FROM public.box_members bm WHERE bm.member_id = ANY (v_comptes) AND bm.box_id <> v_box;
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_AUTRE_BOX: % rattachement(s) d''un compte à purger à une autre box', n; END IF;
  SELECT count(*) INTO n FROM public.boxes b WHERE b.owner_id = ANY (v_comptes);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_GERANT: % box(es) dont le gérant est un compte à purger', n; END IF;
END $comptes$;
