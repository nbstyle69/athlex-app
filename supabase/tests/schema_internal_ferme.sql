-- ═════════════════════════════════════════════════════════════════════════════
-- Le schéma `internal` reste hors de portée des rôles clients
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--
-- Pourquoi ce test existe alors que `tournament_scores_gardes.sql` (T13) vérifie
-- déjà `internal.recalc_division_points` : T13 nomme UNE fonction. La prochaine
-- fonction posée dans `internal` — et c'est bien la vocation du schéma d'en
-- accueillir d'autres — naîtrait sans contrôle. Ici on ne nomme rien : la règle
-- porte sur le schéma entier, donc elle vaut pour ce qui n'est pas encore écrit.
--
-- Ce qui est en jeu : les fonctions d'`internal` portent le corps SANS garde de
-- rôle (la garde est dans leur jumelle de `public`). Leur inaccessibilité EST
-- leur protection. Un `GRANT` de dépannage, ou un `CREATE FUNCTION` posé là sans
-- y penser, suffirait à rendre le traitement appelable par n'importe quel compte
-- connecté — et rien ne le dirait.
--
-- Pendant local du contrôle `controlerSchemaInternal` (`scripts/lib/
-- controle-schema-internal.mjs`), que `test-grants.mjs` joue sur la pile jetable
-- et `audit-grants-prod.mjs` sur la production : même règle aux trois endroits,
-- parce que la plus permissive des trois deviendrait sinon la vraie.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_ouvertes text;
  v_usage    text;
  v_nb       int;
BEGIN
  -- ── I1 · aucune fonction du schéma n'est exécutable par un rôle client ────
  -- Toutes les fonctions, pas une liste : c'est ce qui couvre celles à venir.
  SELECT string_agg(format('%s → %s', r.rolname, p.oid::regprocedure), ', ' ORDER BY r.rolname)
    INTO v_ouvertes
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
   WHERE n.nspname = 'internal'
     AND p.prokind IN ('f', 'p')
     AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');

  IF v_ouvertes IS NOT NULL THEN
    RAISE EXCEPTION 'I1 : une fonction du schéma internal est exécutable par un rôle client — %', v_ouvertes
      USING HINT = 'Ces fonctions n''ont aucune garde dans leur corps. Révoque l''EXECUTE ; '
                   'si un client doit déclencher ce traitement, la porte est une fonction '
                   'de `public` qui vérifie l''appelant.';
  END IF;

  -- ── I2 · le schéma lui-même ne s'ouvre pas ────────────────────────────────
  -- Second verrou, et il couvre les fonctions à venir : tant qu'il tient, un
  -- EXECUTE ouvert par erreur ne suffit pas à rendre la fonction appelable.
  -- Les deux verrous tombent séparément, d'où deux contrôles.
  SELECT string_agg(r.rolname, ', ' ORDER BY r.rolname)
    INTO v_usage
    FROM (VALUES ('anon'), ('authenticated')) AS r(rolname)
   WHERE has_schema_privilege(r.rolname, 'internal', 'USAGE');

  IF v_usage IS NOT NULL THEN
    RAISE EXCEPTION 'I2 : le schéma internal accorde USAGE à %', v_usage
      USING HINT = 'REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;';
  END IF;

  -- ── I3 · contre-exemple : le test a bien une matière ──────────────────────
  -- Sur un schéma vide, I1 et I2 sont verts sans rien prouver.
  SELECT count(*) INTO v_nb
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'internal' AND p.prokind IN ('f', 'p');

  IF v_nb = 0 THEN
    RAISE EXCEPTION 'I3 : le schéma internal est vide ou absent — I1 et I2 ne contrôlent rien'
      USING HINT = 'Si `internal` a été retiré, retire ce test dans la même PR.';
  END IF;

  RAISE NOTICE 'schema_internal_ferme : I1, I2, I3 OK (% fonction(s) dans internal)', v_nb;
END $$;
