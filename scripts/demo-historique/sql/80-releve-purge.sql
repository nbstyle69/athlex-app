-- ═════════════════════════════════════════════════════════════════════════════
-- Démo historique (#523) — relevé avant purge, en LECTURE SEULE, joué avant
-- toute écriture (avant 90-tournois.sql).
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v box=<uuid> -v exclus='{…}' -v attendu=<n> \
--        -v acceptes='{…}' -v supprimer='{…}' -v archiver='{…}' -v releve=<fichier hors dépôt> \
--        -f scripts/demo-historique/sql/80-releve-purge.sql
--   supprimer : tournois supprimés par 90 (accord explicite de Nab s'ils ont
--               un résultat validé) ; archiver : tournois archivés par 90.
--
-- Fermeture de la purge, calculée au catalogue, sans rien écrire (en mémoire,
-- dans un bloc PL/pgSQL : la lecture seule refuse même les tables temporaires).
-- On part des comptes (auth.users) et des tournois à supprimer (plus leurs
-- historiques d'ELO, que 90 supprime à la main), puis on suit chaque clé
-- étrangère, toutes colonnes, jusqu'au point fixe :
--   `c`         la ligne part aussi (et l'on continue depuis elle) ;
--   `n` / `d`   la ligne reste, colonne mise à NULL / défaut ;
--   `a` / `r`   la suppression échouerait.
-- Le chiffrage (lignes supprimées par table) en sort directement.
--
-- Classes et arrêts (STOP = exception, rien n'est écrit ensuite) :
--   contact       ligne SUPPRIMÉE qui cite un compte réel (hors comptes purgés et
--                 hors `acceptes`) : amitié, message, réaction, inscription… STOP ;
--   accepte       même chose, compte réel dans `acceptes` : affiché, sans arrêt ;
--   bloquant      clé `a` / `r` vers une ligne supprimée, ligne non supprimée : STOP ;
--   reel          ligne mise à NULL qui cite un compte réel hors `acceptes` : STOP ;
--   accepte_nul   ligne mise à NULL qui cite un compte de `acceptes` : STOP aussi
--                 (elle resterait orpheline) ;
--   tournoi_autre ligne mise à NULL d'un tournoi hors des deux listes : STOP ;
--   archive       ligne mise à NULL d'un tournoi archivé : reste, colonne à NULL ;
--   garde         ligne mise à NULL d'une table de box (box_id) qui ne cite que
--                 des comptes purgés : WOD, programmation… de la box, GARDÉE avec
--                 sa colonne à NULL (la box, ses WODs et sa programmation restent) ;
--   fictif        ligne mise à NULL hors table de box, qui ne cite que des comptes purgés : supprimée
--                 par 91 ; STOP si une ligne non supprimée la référence (WOD d'un
--                 compte de démo scoré ou programmé par un réel…) ou si elle n'a
--                 pas de clé primaire simple ;
--   stripe        ligne de la fermeture avec une colonne *stripe* renseignée : STOP.
-- Arrêts aussi : compte réel hors `acceptes` avec une ligne d'ELO de WOD sur un
-- WOD scoré par un compte purgé ; compte purgé dans un tableau d'uuid d'une
-- ligne qui reste (message_groups.members, messages.read_by) ; liste d'attente
-- derrière un compte purgé ; fichier de stockage d'un compte purgé ; tournoi
-- listé hors de la box ou dans les deux listes.
-- Écrit dans `releve` (identifiants techniques seulement) une instruction
-- set_config que 91, 99 et supprimer-comptes.ts rejouent : lignes mises à NULL
-- (par clé primaire), liste des comptes et des exclus figée à ce relevé.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
SET default_transaction_read_only = on;
SET search_path = "$user", public, extensions;
\ir comptes.sql
SELECT set_config('histo.supprimer', :'supprimer', false) AS s, set_config('histo.archiver', :'archiver', false) AS a \gset histo_

DO $releve$
DECLARE
  v_comptes uuid[] := current_setting('histo.comptes')::uuid[];
  v_acc     uuid[] := current_setting('histo.acceptes')::uuid[];
  v_sup     uuid[] := current_setting('histo.supprimer')::uuid[];
  v_arc     uuid[] := current_setting('histo.archiver')::uuid[];
  sup       jsonb := '{}';   -- oid de table → ctid des lignes supprimées
  nul       jsonb := '{}';   -- oid de table → { colonne → ctid des lignes mises à NULL }
  ar        jsonb := '{}';   -- oid de table → { colonne → ctid des lignes bloquantes }
  classes   text[] := '{}';  -- « table|colonne|classe|pk_col|pk »
  c         record;
  r         record;
  k         text;
  v_tids    tid[];
  v_new     tid[];
  v_txt     text[];
  v_avant   bigint;
  v_tours   int := 0;
  n         bigint;
  v_stop    text := '';
  v_reel    text;
  v_acce    text;
  v_tid     boolean;
  v_boxcol  boolean;
  v_pk      text;
  v_stripe  text;
BEGIN
  IF v_sup && v_arc THEN RAISE EXCEPTION 'HISTO_LISTES: un tournoi est à la fois à supprimer et à archiver'; END IF;
  SELECT count(*) INTO n FROM unnest(v_sup || v_arc) t(id)
   WHERE NOT EXISTS (SELECT 1 FROM public.tournaments x WHERE x.id = t.id AND x.box_id = current_setting('histo.box')::uuid);
  IF n > 0 THEN RAISE EXCEPTION 'HISTO_TOURNOI_BOX: % tournoi(s) listé(s) absent(s) de la box', n; END IF;

  -- Tournois listés : état et motif de conservation (internal.tournoi_resultat_valide).
  FOR r IN SELECT t.id, t.status, t.format, t.archived_at IS NOT NULL AS archive, internal.tournoi_resultat_valide(t.id, t.status) AS raison,
                  CASE WHEN t.id = ANY (v_sup) THEN 'supprimer' ELSE 'archiver' END AS sort,
                  (SELECT count(*) FROM public.tournament_participants p WHERE p.tournament_id = t.id) AS inscrits,
                  (SELECT count(*) FROM public.tournament_participants p WHERE p.tournament_id = t.id AND NOT p.athlete_id = ANY (v_comptes)) AS hors_comptes
             FROM public.tournaments t WHERE t.id = ANY (v_sup || v_arc) ORDER BY t.created_at, t.id LOOP
    RAISE NOTICE 'HISTO_TOURNOI % : % (%), archivé %, résultat validé : %, inscrits % dont % hors comptes purgés → %',
      r.id, r.status, r.format, r.archive, coalesce(r.raison, 'non'), r.inscrits, r.hors_comptes, r.sort;
  END LOOP;

  -- Graines : comptes, tournois à supprimer et leurs historiques sans clé (90).
  FOR r IN SELECT 'auth.users'::regclass AS t, format('id = ANY (%L::uuid[])', v_comptes) AS w
           UNION ALL SELECT 'public.tournaments', format('id = ANY (%L::uuid[])', v_sup)
           UNION ALL SELECT 'public.tournament_match_elo_history', format('tournament_id = ANY (%L::uuid[])', v_sup)
           UNION ALL SELECT 'public.tournament_wod_elo_history', format('tournament_id = ANY (%L::uuid[])', v_sup)
           UNION ALL SELECT 'public.tournament_elo_history', format('tournament_id = ANY (%L::uuid[])', v_sup) LOOP
    EXECUTE format('SELECT coalesce(array_agg(ctid), ''{}'') FROM %s WHERE %s', r.t, r.w) INTO v_tids;
    IF cardinality(v_tids) > 0 THEN sup := sup || jsonb_build_object(r.t::oid::text, to_jsonb(v_tids::text[])); END IF;
  END LOOP;

  -- Point fixe.
  LOOP
    SELECT coalesce(sum(jsonb_array_length(value)), 0) INTO v_avant FROM jsonb_each(sup);
    v_tours := v_tours + 1;
    FOR c IN
      SELECT x.conrelid, x.confrelid, x.confdeltype::text AS del,
             string_agg(format('ch.%I = p.%I', ca.attname, pa.attname), ' AND ' ORDER BY i.n) AS cond,
             string_agg(ca.attname::text, '+' ORDER BY i.n) AS col
        FROM pg_constraint x
        CROSS JOIN LATERAL unnest(x.conkey, x.confkey) WITH ORDINALITY i(ck, pk, n)
        JOIN pg_attribute ca ON ca.attrelid = x.conrelid AND ca.attnum = i.ck
        JOIN pg_attribute pa ON pa.attrelid = x.confrelid AND pa.attnum = i.pk
       WHERE x.contype = 'f' AND x.confrelid::text IN (SELECT jsonb_object_keys(sup))
       GROUP BY x.oid, x.conrelid, x.confrelid, x.confdeltype
    LOOP
      v_tids := ARRAY(SELECT jsonb_array_elements_text(sup -> c.confrelid::oid::text))::tid[];
      EXECUTE format('SELECT coalesce(array_agg(DISTINCT ch.ctid), ''{}'') FROM %s ch JOIN %s p ON %s WHERE p.ctid = ANY ($1)',
                     c.conrelid::regclass, c.confrelid::regclass, c.cond) INTO v_new USING v_tids;
      CONTINUE WHEN cardinality(v_new) = 0;
      k := c.conrelid::oid::text;
      IF c.del = 'c' THEN
        sup := sup || jsonb_build_object(k, to_jsonb(ARRAY(SELECT DISTINCT e FROM unnest(
                 ARRAY(SELECT jsonb_array_elements_text(coalesce(sup -> k, '[]'))) || v_new::text[]) e ORDER BY e)));
      ELSIF c.del IN ('n', 'd') THEN
        nul := jsonb_set(nul || jsonb_build_object(k, coalesce(nul -> k, '{}')), ARRAY[k, c.col], to_jsonb(ARRAY(SELECT DISTINCT e FROM unnest(
                 ARRAY(SELECT jsonb_array_elements_text(coalesce(nul -> k -> c.col, '[]'))) || v_new::text[]) e ORDER BY e)));
      ELSE
        ar := jsonb_set(ar || jsonb_build_object(k, coalesce(ar -> k, '{}')), ARRAY[k, c.col], to_jsonb(ARRAY(SELECT DISTINCT e FROM unnest(
                 ARRAY(SELECT jsonb_array_elements_text(coalesce(ar -> k -> c.col, '[]'))) || v_new::text[]) e ORDER BY e)));
      END IF;
    END LOOP;
    SELECT coalesce(sum(jsonb_array_length(value)), 0) INTO n FROM jsonb_each(sup);
    EXIT WHEN n = v_avant;
    IF v_tours > 50 THEN RAISE EXCEPTION 'HISTO_FERMETURE: pas de point fixe après 50 tours'; END IF;
  END LOOP;
  RAISE NOTICE 'HISTO_FERMETURE % tour(s), % ligne(s) supprimée(s)', v_tours, n;

  -- Chiffrage.
  FOR r IN SELECT key::oid::regclass::text AS t, jsonb_array_length(value) AS n FROM jsonb_each(sup) ORDER BY 1 LOOP
    RAISE NOTICE 'HISTO_CHIFFRAGE % = %', r.t, r.n;
  END LOOP;

  -- Classement, table par table.
  FOR r IN SELECT key AS k, 'sup' AS quoi, NULL::text AS col, value AS tids FROM jsonb_each(sup)
           UNION ALL SELECT t.key, 'nul', cc.key, cc.value FROM jsonb_each(nul) t, jsonb_each(t.value) cc
           UNION ALL SELECT t.key, 'ar', cc.key, cc.value FROM jsonb_each(ar) t, jsonb_each(t.value) cc LOOP
    v_tids := ARRAY(SELECT jsonb_array_elements_text(r.tids))::tid[];
    IF r.quoi <> 'sup' THEN   -- une ligne qui part en cascade n'est ni mise à NULL ni bloquante
      v_tids := ARRAY(SELECT unnest(v_tids) EXCEPT SELECT jsonb_array_elements_text(coalesce(sup -> r.k, '[]'))::tid);
      CONTINUE WHEN cardinality(v_tids) = 0;
    END IF;
    CONTINUE WHEN r.quoi = 'sup' AND r.k::oid::regclass::text LIKE 'auth.%';
    SELECT string_agg(format('(%I IS NOT NULL AND NOT %I = ANY (%L::uuid[]) AND NOT %I = ANY (%L::uuid[]))', a.attname, a.attname, v_comptes, a.attname, v_acc), ' OR '),
           string_agg(format('(%I = ANY (%L::uuid[]))', a.attname, v_acc), ' OR ')
      INTO v_reel, v_acce
      FROM pg_constraint x JOIN pg_attribute a ON a.attrelid = x.conrelid AND a.attnum = x.conkey[1]
     WHERE x.contype = 'f' AND cardinality(x.conkey) = 1 AND x.conrelid = r.k::oid
       AND x.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass);
    v_reel := coalesce(v_reel, 'false'); v_acce := coalesce(v_acce, 'false');
    IF r.k::oid = 'public.tournament_match_elo_history'::regclass::oid THEN   -- adversaire sans clé étrangère
      v_reel := v_reel || format(' OR (opponent_id IS NOT NULL AND NOT opponent_id = ANY (%L::uuid[]) AND NOT opponent_id = ANY (%L::uuid[]))', v_comptes, v_acc);
      v_acce := v_acce || format(' OR (opponent_id = ANY (%L::uuid[]))', v_acc);
    END IF;
    SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = r.k::oid AND attname = 'tournament_id' AND NOT attisdropped) INTO v_tid;
    SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = r.k::oid AND attname = 'box_id' AND NOT attisdropped) INTO v_boxcol;
    v_pk := NULL;
    SELECT a.attname INTO v_pk FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE i.indrelid = r.k::oid AND i.indisprimary AND i.indnatts = 1;
    EXECUTE format('SELECT coalesce(array_agg(concat_ws(''|'', %L, %L, c, %L, pk)), ''{}'') FROM (
                      SELECT CASE WHEN %L = ''ar'' THEN ''bloquant''
                                  WHEN %L = ''sup'' THEN CASE WHEN %s THEN ''contact'' WHEN %s THEN ''accepte'' END
                                  WHEN %s THEN ''reel''
                                  WHEN %s THEN ''archive''
                                  WHEN %s THEN ''tournoi_autre''
                                  WHEN %s THEN ''accepte_nul''
                                  WHEN %s THEN ''garde''
                                  ELSE ''fictif'' END AS c, %s AS pk
                        FROM %s x WHERE x.ctid = ANY ($1)) y WHERE c IS NOT NULL',
                   r.k::oid::regclass::text, coalesce(r.col, '-'), coalesce(v_pk, ''),
                   r.quoi, r.quoi, v_reel, v_acce, v_reel,
                   CASE WHEN v_tid THEN format('x.tournament_id = ANY (%L::uuid[])', v_arc) ELSE 'false' END,
                   CASE WHEN v_tid THEN 'x.tournament_id IS NOT NULL' ELSE 'false' END, v_acce,
                   CASE WHEN v_boxcol THEN 'x.box_id IS NOT NULL' ELSE 'false' END,
                   CASE WHEN v_pk IS NULL THEN '''''' ELSE format('x.%I::text', v_pk) END,
                   r.k::oid::regclass) INTO v_txt USING v_tids;
    classes := classes || v_txt;
    -- Colonnes *stripe* renseignées.
    SELECT string_agg(format('%I IS NOT NULL', attname), ' OR ') INTO v_stripe
      FROM pg_attribute WHERE attrelid = r.k::oid AND attnum > 0 AND NOT attisdropped AND attname ILIKE '%stripe%';
    IF v_stripe IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM %s x WHERE x.ctid = ANY ($1) AND (%s)', r.k::oid::regclass, v_stripe) INTO n USING v_tids;
      IF n > 0 THEN classes := classes || format('%s|%s|stripe||', r.k::oid::regclass, coalesce(r.col, '-')); END IF;
    END IF;
  END LOOP;

  FOR r IN SELECT split_part(l, '|', 1) AS t, split_part(l, '|', 2) AS col, split_part(l, '|', 3) AS classe,
                  count(*) AS n, count(*) FILTER (WHERE split_part(l, '|', 5) = '') AS sans_pk
             FROM unnest(classes) l GROUP BY 1, 2, 3 ORDER BY 1, 2, 3 LOOP
    RAISE NOTICE 'HISTO_RELEVE %.% % = %', r.t, r.col, r.classe, r.n;
    IF r.classe IN ('contact', 'bloquant', 'reel', 'accepte_nul', 'tournoi_autre', 'stripe') THEN
      v_stop := v_stop || format(' %s.%s=%s (%s)', r.t, r.col, r.n, r.classe);
    ELSIF r.classe = 'fictif' AND r.sans_pk > 0 THEN
      v_stop := v_stop || format(' %s.%s=%s (sans clé primaire simple)', r.t, r.col, r.sans_pk);
    END IF;
  END LOOP;

  -- Ligne « fictif » référencée par une ligne qui reste : 91 ne pourrait pas la
  -- supprimer sans emporter cette ligne (WOD d'un compte de démo scoré ou
  -- programmé par un réel…).
  FOR r IN SELECT x.conrelid, x.confrelid, f.pks, f.pk_col,
                  (SELECT string_agg(format('ch.%I = p.%I', ca.attname, pa.attname), ' AND ')
                     FROM unnest(x.conkey, x.confkey) i(ck, pk)
                     JOIN pg_attribute ca ON ca.attrelid = x.conrelid AND ca.attnum = i.ck
                     JOIN pg_attribute pa ON pa.attrelid = x.confrelid AND pa.attnum = i.pk) AS cond
             FROM (SELECT split_part(l, '|', 1)::regclass AS t, split_part(l, '|', 4) AS pk_col, array_agg(split_part(l, '|', 5)) AS pks
                     FROM unnest(classes) l WHERE split_part(l, '|', 3) = 'fictif' AND split_part(l, '|', 5) <> '' GROUP BY 1, 2) f
             JOIN pg_constraint x ON x.contype = 'f' AND x.confrelid = f.t LOOP
    EXECUTE format('SELECT count(*) FROM %s ch JOIN %s p ON %s WHERE p.%I::text = ANY ($1) AND NOT ch.ctid = ANY ($2)',
                   r.conrelid::regclass, r.confrelid::regclass, r.cond, r.pk_col)
      INTO n USING r.pks, ARRAY(SELECT jsonb_array_elements_text(coalesce(sup -> r.conrelid::oid::text, '[]')))::tid[];
    IF n > 0 THEN
      RAISE NOTICE 'HISTO_RELEVE % fictif_reference (par %) = %', r.confrelid::regclass, r.conrelid::regclass, n;
      v_stop := v_stop || format(' %s=%s (ligne d''un compte de démo référencée par %s)', r.confrelid::regclass, n, r.conrelid::regclass);
    END IF;
  END LOOP;

  -- Contacts nommés par le brief, comptés un par un (STOP si ≥ 1, hors `acceptes`).
  FOR r IN
    SELECT 'reaction_ou_commentaire_sur_contenu_reel' AS t, (
             (SELECT count(*) FROM public.score_reactions x JOIN public.wod_scores s ON s.id = x.score_id
               WHERE x.user_id = ANY (v_comptes) AND NOT s.member_id = ANY (v_comptes) AND NOT s.member_id = ANY (v_acc))
           + (SELECT count(*) FROM public.score_comments x JOIN public.wod_scores s ON s.id = x.score_id
               WHERE x.author_id = ANY (v_comptes) AND NOT s.member_id = ANY (v_comptes) AND NOT s.member_id = ANY (v_acc))
           + (SELECT count(*) FROM public.box_article_comments x JOIN public.box_articles a ON a.id = x.article_id
               WHERE x.user_id = ANY (v_comptes) AND NOT a.author_id = ANY (v_comptes) AND NOT a.author_id = ANY (v_acc))
           + (SELECT count(*) FROM public.box_article_likes x JOIN public.box_articles a ON a.id = x.article_id
               WHERE x.user_id = ANY (v_comptes) AND NOT a.author_id = ANY (v_comptes) AND NOT a.author_id = ANY (v_acc))
           + (SELECT count(*) FROM public.message_replies x JOIN public.messages m ON m.id = x.parent_message_id
               WHERE x.sender_id = ANY (v_comptes) AND NOT m.sender_id = ANY (v_comptes) AND NOT m.sender_id = ANY (v_acc))) AS n
    UNION ALL SELECT 'achat_ou_suivi_de_programme', count(*) FROM public.program_members WHERE user_id = ANY (v_comptes)
    UNION ALL SELECT 'offre_marketplace_d_un_compte_de_demo', count(*) FROM public.programs WHERE owner_id = ANY (v_comptes)
    UNION ALL SELECT 'wod_de_demo_score_par_un_reel', count(*) FROM public.wod_scores s JOIN public.box_wods w ON w.id = s.wod_id
               WHERE w.created_by = ANY (v_comptes) AND NOT s.member_id = ANY (v_comptes) AND NOT s.member_id = ANY (v_acc)
    UNION ALL SELECT 'wod_de_demo_programme', count(*) FROM public.box_programming_wods p JOIN public.box_wods w ON w.id = p.origin_box_wod_id
               WHERE w.created_by = ANY (v_comptes)
  LOOP
    RAISE NOTICE 'HISTO_CONTACT % = %', r.t, r.n;
    IF r.n > 0 THEN v_stop := v_stop || format(' %s=%s', r.t, r.n); END IF;
  END LOOP;
  -- Compétitions inter-box et événements : toute ligne touchée par la purge.
  FOR r IN SELECT split_part(l, '|', 1) AS t, count(*) AS n FROM unnest(classes) l
            WHERE split_part(l, '|', 1) ~ '^(public\.)?(inter_|competition|physical_competitions|event)' GROUP BY 1
           UNION ALL
           SELECT key::oid::regclass::text, jsonb_array_length(value) FROM jsonb_each(sup)
            WHERE key::oid::regclass::text ~ '^(public\.)?(inter_|competition|physical_competitions|event)' LOOP
    RAISE NOTICE 'HISTO_CONTACT inter_box % = %', r.t, r.n;
    v_stop := v_stop || format(' %s=%s (compétition inter-box ou événement)', r.t, r.n);
  END LOOP;

  -- ELO de WOD d'un compte réel sur un WOD scoré par un compte purgé.
  FOR r IN
    WITH wods AS (SELECT DISTINCT wod_id FROM public.wod_scores WHERE member_id = ANY (v_comptes))
    SELECT 'elo_history' AS t, count(*) FILTER (WHERE NOT h.member_id = ANY (v_acc)) AS n, count(*) FILTER (WHERE h.member_id = ANY (v_acc)) AS a
      FROM public.elo_history h WHERE NOT h.member_id = ANY (v_comptes) AND h.wod_id IN (SELECT wod_id FROM wods)
    UNION ALL
    SELECT 'box_elo_history', count(*) FILTER (WHERE NOT h.member_id = ANY (v_acc)), count(*) FILTER (WHERE h.member_id = ANY (v_acc))
      FROM public.box_elo_history h WHERE NOT h.member_id = ANY (v_comptes) AND h.wod_id IN (SELECT wod_id FROM wods)
  LOOP
    RAISE NOTICE 'HISTO_CONTACT_ELO % : % ligne(s) de compte réel, % de compte accepté', r.t, r.n, r.a;
    IF r.n > 0 THEN v_stop := v_stop || format(' %s=%s (ELO de WOD d''un compte réel au contact des comptes de démo)', r.t, r.n); END IF;
  END LOOP;

  SELECT count(*) INTO n FROM public.message_groups g WHERE g.members && v_comptes
     AND NOT g.ctid = ANY (ARRAY(SELECT jsonb_array_elements_text(coalesce(sup -> 'public.message_groups'::regclass::oid::text, '[]')))::tid[]);
  IF n > 0 THEN v_stop := v_stop || format(' message_groups.members=%s (compte purgé dans un groupe qui reste)', n); END IF;
  SELECT count(*) INTO n FROM public.messages m WHERE m.read_by && v_comptes
     AND NOT m.ctid = ANY (ARRAY(SELECT jsonb_array_elements_text(coalesce(sup -> 'public.messages'::regclass::oid::text, '[]')))::tid[]);
  IF n > 0 THEN v_stop := v_stop || format(' messages.read_by=%s (compte purgé dans un message qui reste)', n); END IF;

  SELECT count(*) INTO n FROM public.class_reservations w
   WHERE w.status = 'waiting' AND NOT w.member_id = ANY (v_comptes)
     AND w.schedule_id IN (SELECT schedule_id FROM public.class_reservations WHERE member_id = ANY (v_comptes) AND status = 'confirmed');
  IF n > 0 THEN v_stop := v_stop || format(' class_reservations.waiting=%s (promotion à la purge)', n); END IF;

  SELECT count(*) INTO n FROM storage.objects o
   WHERE o.owner = ANY (v_comptes) OR to_jsonb(o) ->> 'owner_id' = ANY (v_comptes::text[])
      OR split_part(o.name, '/', 1) = ANY (v_comptes::text[]);
  RAISE NOTICE 'HISTO_STOCKAGE % fichier(s) de comptes purgés', n;
  IF n > 0 THEN v_stop := v_stop || format(' storage.objects=%s (fichiers des comptes : non traités par ces scripts)', n); END IF;

  -- Relevé pour 91 et 99 : lignes mises à NULL, « table,pk_col,pk,col,classe ».
  PERFORM set_config('histo.releve_sortie', coalesce((
    SELECT string_agg(concat_ws(',', split_part(l, '|', 1), split_part(l, '|', 4), split_part(l, '|', 5), split_part(l, '|', 2), split_part(l, '|', 3)), ';' ORDER BY l)
      FROM unnest(classes) l WHERE split_part(l, '|', 3) IN ('fictif', 'archive')), ''), false);

  IF v_stop <> '' THEN
    RAISE EXCEPTION 'HISTO_BLOQUANT:%', v_stop;
  END IF;
  RAISE NOTICE 'HISTO_RELEVE conforme : % compte(s), % tournoi(s) à supprimer, % à archiver',
    cardinality(v_comptes), cardinality(v_sup), cardinality(v_arc);
END $releve$;

\pset tuples_only on
\pset format unaligned
\o :releve
SELECT format('SELECT set_config(%L, %L, false) AS r, set_config(%L, %L, false) AS c, set_config(%L, %L, false) AS e \gset histo_',
              'histo.releve', current_setting('histo.releve_sortie'), 'histo.comptes', current_setting('histo.comptes'),
              'histo.exclus', current_setting('histo.exclus'));
\o
\pset tuples_only off
\pset format aligned
