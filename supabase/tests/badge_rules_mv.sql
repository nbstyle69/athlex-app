-- ═════════════════════════════════════════════════════════════════════════════
-- Badges de mouvement `mv_*` : règles, parité avec le client, badges inchangés
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
--
-- La moitié centrale de ce fichier ne contient aucun cas : elle les lit dans
-- `supabase/seed/badge_rules_cases.json` (transporté ici par un `.sql` généré),
-- le même fichier que le test jest de parité. Deux jeux de cas divergeraient, et
-- le plus indulgent des deux deviendrait la vérité.
--
-- La comparaison est EXHAUSTIVE : pour chaque cas, on demande sa condition aux
-- 187 badges et on compare l'ensemble obtenu à la liste attendue. Vérifier
-- seulement les badges attendus laisserait passer un badge accordé en trop —
-- c'est justement ce qu'une règle trop large produirait.
--
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Badges mv_* : regles, parite, badges inchanges'

BEGIN;

\i supabase/seed/badge_rules_cases.sql

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Un athlète pour la parité (ses cumuls changent à chaque cas), un second
-- laissé vierge pour les badges non `mv_*`.
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-a100-000000000001'),
  ('00000000-0000-4000-a100-000000000002');

INSERT INTO public.profiles (id, email, username, elo) VALUES
  ('00000000-0000-4000-a100-000000000001', 'parite@test.invalid', 'parite_1', 900),
  ('00000000-0000-4000-a100-000000000002', 'inchange@test.invalid', 'inchange_1', 900);

-- ── R01 · la table des règles couvre le catalogue, et rien d'autre ──────────
DO $$
DECLARE v_sans_regle text; v_orpheline text;
BEGIN
  SELECT string_agg(badge_key, ', ' ORDER BY badge_key) INTO v_sans_regle
    FROM public.badges_catalog c
   WHERE c.badge_key LIKE 'mv\_%'
     AND NOT EXISTS (SELECT 1 FROM public.badge_rules r WHERE r.badge_key = c.badge_key);
  IF v_sans_regle IS NOT NULL THEN
    RAISE EXCEPTION 'R01a : badges mv_* sans règle — %', v_sans_regle;
  END IF;

  SELECT string_agg(badge_key, ', ' ORDER BY badge_key) INTO v_orpheline
    FROM public.badge_rules r WHERE r.badge_key NOT LIKE 'mv\_%';
  IF v_orpheline IS NOT NULL THEN
    RAISE EXCEPTION 'R01b : règle posée sur un badge non mv_* — %', v_orpheline;
  END IF;

  -- Un contre-exemple : sur une table vide, tout ce qui suit serait vert.
  IF (SELECT count(*) FROM public.badge_rules) < 100 THEN
    RAISE EXCEPTION 'R01c : % règles seulement — le jeu de règles n''a pas été semé',
      (SELECT count(*) FROM public.badge_rules);
  END IF;
END $$;

-- ── P · parité avec le client, cas par cas, sur les 187 badges ─────────────
DO $$
DECLARE
  v_ath     uuid := '00000000-0000-4000-a100-000000000001';
  c         jsonb;
  v_nom     text;
  v_obtenus text[];
  v_attendus text[];
  v_refuse  text;
  v_cas     int := 0;
BEGIN
  FOR c IN SELECT jsonb_array_elements(donnees -> 'cas') FROM cas_parite LOOP
    v_cas := v_cas + 1;
    v_nom := c ->> 'nom';

    DELETE FROM public.user_movement_stats WHERE user_id = v_ath;
    INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps)
    SELECT v_ath, x ->> 'movement', x ->> 'unit', (x ->> 'total_reps')::bigint
      FROM jsonb_array_elements(c -> 'cumuls') x;

    SELECT COALESCE(array_agg(badge_key ORDER BY badge_key), '{}')
      INTO v_obtenus
      FROM public.badge_rules
     WHERE public.badge_condition_met(v_ath, badge_key);

    SELECT COALESCE(array_agg(v ORDER BY v), '{}')
      INTO v_attendus
      FROM jsonb_array_elements_text(c -> 'attendus') v;

    IF v_obtenus IS DISTINCT FROM v_attendus THEN
      RAISE EXCEPTION 'P/% (%) : obtenu % — attendu %', v_cas, v_nom,
        array_to_string(v_obtenus, ', '), array_to_string(v_attendus, ', ');
    END IF;

    -- Les refus explicites sont déjà couverts par la comparaison exhaustive ;
    -- on les rejoue quand même, parce qu'ils nomment l'erreur qu'on redoute
    -- (mauvaise unité, mouvement voisin) au lieu d'un écart d'ensembles.
    FOR v_refuse IN SELECT jsonb_array_elements_text(c -> 'refuses') LOOP
      IF public.badge_condition_met(v_ath, v_refuse) THEN
        RAISE EXCEPTION 'P/% (%) : % accordé alors qu''il doit être refusé', v_cas, v_nom, v_refuse;
      END IF;
    END LOOP;
  END LOOP;

  IF v_cas < 5 THEN
    RAISE EXCEPTION 'P : % cas seulement — le fichier de cas n''a pas été chargé', v_cas;
  END IF;
  RAISE NOTICE 'parité : % cas, 187 badges interrogés par cas', v_cas;
END $$;

-- ── C01 · une règle absente ne laisse rien passer ──────────────────────────
-- Un badge `mv_*` publié sans règle doit être refusé, comme avant ce lot.
DO $$
BEGIN
  INSERT INTO public.badges_catalog (badge_key, title, description, category, sort_order)
  VALUES ('mv_zz_sonde_100', 'Sonde', 'badge sans règle', 'movement', 9999);
  IF public.badge_condition_met('00000000-0000-4000-a100-000000000001', 'mv_zz_sonde_100') THEN
    RAISE EXCEPTION 'C01 : un badge mv_* sans règle a été accordé';
  END IF;
END $$;

-- ── D01 · double demande : sans effet la seconde fois ──────────────────────
DO $$
DECLARE v1 jsonb; v2 jsonb; v_lignes int;
BEGIN
  DELETE FROM public.user_movement_stats WHERE user_id = '00000000-0000-4000-a100-000000000001';
  INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps)
  VALUES ('00000000-0000-4000-a100-000000000001', 'pull_up', 'reps', 100);

  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub  = '00000000-0000-4000-a100-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  v1 := public.claim_badge('mv_pullup_100');
  v2 := public.claim_badge('mv_pullup_100');
  RESET ROLE;

  IF (v1 ->> 'awarded') <> 'true' THEN
    RAISE EXCEPTION 'D01a : première demande refusée — %', v1;
  END IF;
  IF (v2 ->> 'ok') <> 'true' OR (v2 ->> 'awarded') <> 'false' THEN
    RAISE EXCEPTION 'D01b : seconde demande mal rendue — %', v2;
  END IF;

  SELECT count(*) INTO v_lignes FROM public.athlete_badges
   WHERE athlete_id = '00000000-0000-4000-a100-000000000001' AND badge_key = 'mv_pullup_100';
  IF v_lignes <> 1 THEN
    RAISE EXCEPTION 'D01c : % ligne(s) posée(s) pour un badge réclamé deux fois', v_lignes;
  END IF;
END $$;

-- ── D02 · l'athlète sous le seuil se voit refuser par le serveur ───────────
-- Le pendant du précédent : la réponse doit nommer la condition, pas l'absence.
DO $$
DECLARE v jsonb;
BEGIN
  DELETE FROM public.user_movement_stats WHERE user_id = '00000000-0000-4000-a100-000000000001';
  INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps)
  VALUES ('00000000-0000-4000-a100-000000000001', 'pull_up', 'reps', 99);

  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub  = '00000000-0000-4000-a100-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';
  v := public.claim_badge('mv_pullup_500');
  RESET ROLE;

  IF (v ->> 'awarded') <> 'false' OR (v ->> 'reason') <> 'condition_non_remplie' THEN
    RAISE EXCEPTION 'D02 : réponse inattendue sous le seuil — %', v;
  END IF;
END $$;

-- ── G01 · `badge_rules` : lecture ouverte, écriture fermée aux clients ─────
-- Le refus doit venir du GRANT, et le message doit le prouver. Un refus de RLS
-- rend le même SQLSTATE 42501 : une assertion posée sur le code de retour
-- resterait verte si le privilège d'écriture était rendu à `authenticated` et
-- que seule l'absence de policy retenait l'écriture. Ce n'est pas la même
-- garde, et ce n'est pas la même solidité.
DO $$
DECLARE
  v_role  text;
  v_geste text;
  v_lu    int;
  v_err   text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', v_role);

    EXECUTE 'SELECT count(*) FROM public.badge_rules' INTO v_lu;
    IF v_lu < 100 THEN
      RAISE EXCEPTION 'G01a : % ne lit que % règle(s) — le catalogue doit rester lisible', v_role, v_lu;
    END IF;

    -- La cible est la sonde posée par C01 : une clé déjà prise ferait buter
    -- l'insertion sur l'unicité avant d'atteindre le contrôle de privilège, et
    -- le refus obtenu ne prouverait plus rien.
    FOREACH v_geste IN ARRAY ARRAY[
      $i$INSERT INTO public.badge_rules (badge_key, rule_kind, unit, threshold, movement_keys)
         VALUES ('mv_zz_sonde_100', 'movement', 'reps', 1, ARRAY['pull_up'])$i$,
      $u$UPDATE public.badge_rules SET threshold = 1 WHERE badge_key = 'mv_pullup_100'$u$,
      $d$DELETE FROM public.badge_rules WHERE badge_key = 'mv_pullup_100'$d$
    ] LOOP
      v_err := NULL;
      BEGIN
        EXECUTE v_geste;
      EXCEPTION WHEN others THEN v_err := SQLERRM;
      END;

      IF v_err IS NULL THEN
        RAISE EXCEPTION 'G01b : % a pu écrire dans badge_rules — %', v_role, left(v_geste, 40);
      END IF;
      IF v_err NOT LIKE '%permission denied for table%' THEN
        RAISE EXCEPTION 'G01c : refus de % obtenu autrement que par le GRANT (%) — %',
          v_role, v_err, left(v_geste, 40);
      END IF;
    END LOOP;

    RESET ROLE;
  END LOOP;
END $$;

-- ── N · badges non `mv_*` : comportement inchangé ──────────────────────────
-- Un athlète vierge : les neuf familles doivent répondre exactement ce qu'elles
-- répondaient avant ce lot. Puis on pose le décor minimal de quatre d'entre
-- elles et on exige le vrai — sans quoi « tout est faux » passerait pour un
-- succès.
DO $$
DECLARE
  v_ath uuid := '00000000-0000-4000-a100-000000000002';
  v_cle text;
BEGIN
  -- `level_scaled` est vrai dès qu'un profil existe : il n'est pas dans la liste
  -- des refus, il est vérifié juste après.
  FOREACH v_cle IN ARRAY ARRAY['level_inter', 'level_rx', 'level_rx_plus', 'level_elite',
                               'level_pro', 'first_score', 'first_win', 'champion_5',
                               'podium', 'veteran_10', 'social_5', 'chatty_50'] LOOP
    IF public.badge_condition_met(v_ath, v_cle) THEN
      RAISE EXCEPTION 'N1 : % accordé à un athlète vierge', v_cle;
    END IF;
  END LOOP;

  IF NOT public.badge_condition_met(v_ath, 'level_scaled') THEN
    RAISE EXCEPTION 'N2 : level_scaled refusé alors que le profil existe';
  END IF;

  -- ELO
  UPDATE public.profiles SET elo = 1200 WHERE id = v_ath;
  IF NOT public.badge_condition_met(v_ath, 'level_rx') THEN
    RAISE EXCEPTION 'N3 : level_rx refusé à 1200 d''ELO';
  END IF;
  IF public.badge_condition_met(v_ath, 'level_elite') THEN
    RAISE EXCEPTION 'N4 : level_elite accordé à 1200 d''ELO';
  END IF;

  -- Premier score
  INSERT INTO public.wod_scores (id, member_id, score_value, capped)
  VALUES ('00000000-0000-4000-f100-000000000001', v_ath, 120, false);
  IF NOT public.badge_condition_met(v_ath, 'first_score') THEN
    RAISE EXCEPTION 'N5 : first_score refusé alors qu''une ligne de score existe';
  END IF;

  -- Social : cinq amitiés acceptées
  INSERT INTO auth.users (id)
  SELECT ('00000000-0000-4000-a200-00000000000' || i)::uuid FROM generate_series(1, 5) i;
  INSERT INTO public.profiles (id, email, username)
  SELECT ('00000000-0000-4000-a200-00000000000' || i)::uuid,
         'ami' || i || '@test.invalid', 'ami_' || i FROM generate_series(1, 5) i;
  INSERT INTO public.friendships (requester_id, addressee_id, status)
  SELECT v_ath, ('00000000-0000-4000-a200-00000000000' || i)::uuid, 'accepted'
    FROM generate_series(1, 5) i;
  IF NOT public.badge_condition_met(v_ath, 'social_5') THEN
    RAISE EXCEPTION 'N6 : social_5 refusé avec cinq amitiés acceptées';
  END IF;

  -- Messages : quarante-neuf ne suffisent pas, cinquante oui.
  INSERT INTO public.messages (sender_id, content)
  SELECT v_ath, 'message ' || i FROM generate_series(1, 49) i;
  IF public.badge_condition_met(v_ath, 'chatty_50') THEN
    RAISE EXCEPTION 'N7 : chatty_50 accordé à 49 messages';
  END IF;
  INSERT INTO public.messages (sender_id, content) VALUES (v_ath, 'le cinquantième');
  IF NOT public.badge_condition_met(v_ath, 'chatty_50') THEN
    RAISE EXCEPTION 'N8 : chatty_50 refusé à 50 messages';
  END IF;

  -- Et un badge hors catalogue reste refusé, comme avant.
  IF public.badge_condition_met(v_ath, 'badge_qui_n_existe_pas') THEN
    RAISE EXCEPTION 'N9 : une clé inconnue a été accordée';
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'badge_rules_mv : R01, P, C01, D01, D02, G01, N OK'; END $$;

ROLLBACK;
