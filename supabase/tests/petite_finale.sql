-- ═════════════════════════════════════════════════════════════════════════════
-- Petite finale optionnelle en élimination simple (migration 20270114)
--
-- Rejoué par `scripts/db-replay.sh`, donc par la CI sur chaque PR.
-- Trois tableaux simples, joués par le gérant (le plus petit uuid gagne) :
-- T8 à 8 athlètes avec l'option, T8n à 8 sans l'option, T6 à 6 avec l'option
-- (une demi-finale jouée par exemption).
--   P1 avec l'option, la petite finale naît avec la finale, entre les deux
--      perdants des demi-finales ;
--   P2 sans l'option, aucune petite finale ;
--   P3 une demi-finale jouée par exemption : pas de petite finale ;
--   P4 l'ELO de match s'applique à la petite finale ;
--   P5 finale jouée, petite finale en attente : ses deux athlètes restent en
--      lice ; jouée, son vainqueur est 3e et son perdant 4e ;
--   P6 sans l'option, les deux demi-finalistes restent 3es ex-aequo.
-- Tout est joué dans une transaction annulée : rien ne subsiste.
-- ═════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
\echo '==> Petite finale : optionnelle, en élimination simple'

BEGIN;

INSERT INTO auth.users (id)
SELECT ('00000000-0000-4000-a93e-00000000000' || n)::uuid FROM generate_series(0, 8) n;
INSERT INTO public.profiles (id, email, username)
SELECT ('00000000-0000-4000-a93e-00000000000' || n)::uuid, 'pf-' || n || '@test.invalid', 'pf_' || n
  FROM generate_series(0, 8) n;
INSERT INTO public.boxes (id, name, invite_code, owner_id) VALUES
  ('00000000-0000-4000-b93e-000000000001', 'Box petite finale', 'PFTS', '00000000-0000-4000-a93e-000000000000');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES
  ('00000000-0000-4000-b93e-000000000001', '00000000-0000-4000-a93e-000000000000', 'owner', 'active');
INSERT INTO public.tournaments (id, name, level, format, box_id, created_by, status, third_place_match)
SELECT id::uuid, nom, 'rx', 'bracket', '00000000-0000-4000-b93e-000000000001', '00000000-0000-4000-a93e-000000000000', 'active', opt
  FROM (VALUES ('00000000-0000-4000-c93e-000000000008', 'T8', true),
               ('00000000-0000-4000-c93e-000000000080', 'T8n', false),
               ('00000000-0000-4000-c93e-000000000006', 'T6', true)) v(id, nom, opt);
-- Tour 1 : 1-2, 3-4, 5-6, 7-8 (T6 : jusqu'à 5-6).
INSERT INTO public.tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status)
SELECT t::uuid, 1, k, 'winner', ('00000000-0000-4000-a93e-00000000000' || (2 * k - 1))::uuid,
       ('00000000-0000-4000-a93e-00000000000' || (2 * k))::uuid, 'pending'
  FROM (VALUES ('00000000-0000-4000-c93e-000000000008', 4), ('00000000-0000-4000-c93e-000000000080', 4),
               ('00000000-0000-4000-c93e-000000000006', 3)) v(t, n),
       LATERAL generate_series(1, v.n) k;

-- Le gérant tranche un tour (le plus petit uuid gagne), côté donné, puis avance.
CREATE FUNCTION pg_temp.jouer(p_t uuid, p_r int, p_side text) RETURNS void LANGUAGE sql AS $$
  UPDATE public.tournament_bracket_matches
     SET winner_id = LEAST(participant1_id, participant2_id), loser_id = GREATEST(participant1_id, participant2_id),
         status = 'completed', completed_at = now()
   WHERE tournament_id = p_t AND round = p_r AND side = p_side AND status = 'pending'
$$;
CREATE FUNCTION pg_temp.rang(p_t uuid, p_n int) RETURNS int LANGUAGE sql AS $$
  SELECT final_rank FROM public.tournament_bracket_standings(p_t)
   WHERE athlete_id = ('00000000-0000-4000-a93e-00000000000' || p_n)::uuid
$$;
CREATE FUNCTION pg_temp.en_lice(p_t uuid, p_n int) RETURNS boolean LANGUAGE sql AS $$
  SELECT still_alive FROM public.tournament_bracket_standings(p_t)
   WHERE athlete_id = ('00000000-0000-4000-a93e-00000000000' || p_n)::uuid
$$;

DO $t$
DECLARE
  t8  constant uuid := '00000000-0000-4000-c93e-000000000008';
  t8n constant uuid := '00000000-0000-4000-c93e-000000000080';
  t6  constant uuid := '00000000-0000-4000-c93e-000000000006';
  v_t uuid;
  v_pf record;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-a93e-000000000000', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Tours 1 et 2 des trois tableaux : la finale naît au tour 3.
  FOREACH v_t IN ARRAY ARRAY[t8, t8n, t6] LOOP
    PERFORM pg_temp.jouer(v_t, 1, 'winner');
    PERFORM public.advance_bracket_round(v_t, 1);
    PERFORM pg_temp.jouer(v_t, 2, 'winner');
    PERFORM public.advance_bracket_round(v_t, 2);
  END LOOP;

  -- P1 : T8, demi-finales 1-3 et 5-7 : petite finale 3 contre 7, au tour de la finale.
  SELECT * INTO v_pf FROM public.tournament_bracket_matches WHERE tournament_id = t8 AND side = 'third_place';
  IF v_pf.id IS NULL OR v_pf.round <> 3
     OR ARRAY[v_pf.participant1_id, v_pf.participant2_id] <> ARRAY['00000000-0000-4000-a93e-000000000003', '00000000-0000-4000-a93e-000000000007']::uuid[]
     OR NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = t8 AND round = 3 AND side = 'winner') THEN
    RAISE EXCEPTION 'P1 : pas de petite finale 3 contre 7 au tour de la finale';
  END IF;
  -- P2 et P3.
  IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = t8n AND side = 'third_place') THEN
    RAISE EXCEPTION 'P2 : petite finale créée sans l''option';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = t6 AND side = 'third_place')
     OR NOT EXISTS (SELECT 1 FROM public.tournament_bracket_matches WHERE tournament_id = t6 AND round = 3 AND side = 'winner') THEN
    RAISE EXCEPTION 'P3 : petite finale créée alors qu''une demi-finale s''est jouée par exemption';
  END IF;

  -- P5 : finales jouées, petite finale de T8 en attente.
  FOREACH v_t IN ARRAY ARRAY[t8, t8n, t6] LOOP
    PERFORM pg_temp.jouer(v_t, 3, 'winner');
  END LOOP;
  IF NOT pg_temp.en_lice(t8, 3) OR NOT pg_temp.en_lice(t8, 7) THEN
    RAISE EXCEPTION 'P5 : petite finale en attente, et ses athlètes ne sont plus en lice';
  END IF;
  PERFORM pg_temp.jouer(t8, 3, 'third_place');
  IF (pg_temp.rang(t8, 1), pg_temp.rang(t8, 5), pg_temp.rang(t8, 3), pg_temp.rang(t8, 7), pg_temp.rang(t8, 2))
     IS DISTINCT FROM (1, 2, 3, 4, 5)
     OR EXISTS (SELECT 1 FROM public.tournament_bracket_standings(t8) WHERE still_alive) THEN
    RAISE EXCEPTION 'P5 : classement après la petite finale : 1→%, 5→%, 3→%, 7→%, 2→%',
      pg_temp.rang(t8, 1), pg_temp.rang(t8, 5), pg_temp.rang(t8, 3), pg_temp.rang(t8, 7), pg_temp.rang(t8, 2);
  END IF;

  -- P4 : la petite finale a son historique d'ELO (deux lignes).
  IF (SELECT count(*) FROM public.tournament_match_elo_history WHERE match_id = v_pf.id) <> 2 THEN
    RAISE EXCEPTION 'P4 : la petite finale n''a pas appliqué d''ELO';
  END IF;

  -- P6 : sans l'option, 3 et 7 sont 3es ex-aequo, et personne n'est en lice.
  IF pg_temp.rang(t8n, 3) <> 3 OR pg_temp.rang(t8n, 7) <> 3
     OR EXISTS (SELECT 1 FROM public.tournament_bracket_standings(t8n) WHERE still_alive) THEN
    RAISE EXCEPTION 'P6 : sans petite finale, le classement a changé';
  END IF;

  RAISE NOTICE 'petite finale : P1 à P6 conformes';
END $t$;

ROLLBACK;
