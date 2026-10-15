-- ═════════════════════════════════════════════════════════════════════════════
-- Classement global sans les comptes de démo (#565)
--
-- Appliquée en prod : NON.
--
-- Décisions de Nab (15/10/2026) : le classement global ELO n'affiche plus les
-- comptes de démo (46 des 50 premières places), par un filtre de lecture. Rien
-- n'est effacé : ELO, résultats et adhésions restent tels quels.
--
-- 1. Marqueur : internal.demo_accounts (user_id, created_at). Un seul critère,
--    qui ne dit rien d'autre que « compte de démo » : ni facturation, ni garde
--    d'accès, ni groupe. Fermée aux clients (schéma internal, sans USAGE pour
--    anon ni authenticated, contrôle I2) : seules les deux fonctions ci-dessous
--    la lisent. Après la revue Apple, la vider fait réapparaître tout le monde.
-- 2. Peuplée ici, une fois, avec 150 comptes :
--      147 : démo et reviewer passés sur « Accès démo » par 20270157, repris
--            de internal.acces_demo_sauvegarde (catégories demo et reviewer),
--            pas d'une adresse ;
--      3   : les coachs de démo d'AthleX Fitness, restés hors formule (lignes
--            coach) : adhésion active non « member » sur la box du seed, adresse
--            en @demo.athlexapp.eu, propriétaires d'aucune box.
--    Garde-fou : comptés AVANT toute écriture ; sur une base qui a la sauvegarde
--    de 20270157 remplie, autre chose que 147 / 3 lève une exception (rien
--    d'écrit). Sauvegarde vide (rejeu CI) : rien n'est écrit, rien n'échoue.
--    Aucune ligne de box_members ni de membership_plans n'est écrite.
-- 3. public.global_leaderboard(limit, offset) : le classement global (podium et
--    liste de l'app), mêmes colonnes que la requête qu'il remplace, ordre ELO
--    décroissant puis id (pages stables), 100 lignes au plus par appel.
--    public.global_elo_rank(elo) : rang mondial (Accueil, Compétition), profils
--    hors démo dont l'ELO est plus haut, plus un.
--    SECURITY DEFINER pour lire le marqueur ; elles ne rendent que des colonnes
--    déjà lisibles par tous (public_read_profiles). EXECUTE explicite à
--    authenticated et service_role (K1 a fermé le privilège par défaut), pas à
--    anon : l'app ne montre le classement qu'une fois connecté.
-- 4. Périmètre : rien d'autre. Tournois, poules, ligue, whiteboard de box,
--    onglets Équipes et Boxes lisent leurs propres sources, inchangées ; aucune
--    règle RLS, aucune vue, aucune table existante n'est touchée.
-- 5. Retour arrière : supabase/retours/20270159000000_classement_sans_demo.sql.
-- Contrôlée par supabase/tests/classement_sans_demo.sql.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS internal.demo_accounts (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE internal.demo_accounts FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE internal.demo_accounts IS
  'Comptes de démo exclus du classement global (#565). Lue seulement par global_leaderboard et global_elo_rank. La vider fait réapparaître tout le monde.';

DO $migration$
DECLARE
  c_box   constant uuid := 'd3d0b0a0-0000-4000-a000-000000000001';
  v_sauv  int;
  v_coach int;
BEGIN
  DROP TABLE IF EXISTS classement_demo_cible;
  CREATE TEMP TABLE classement_demo_cible ON COMMIT DROP AS
  SELECT DISTINCT bm.member_id AS user_id, 'sauvegarde' AS origine
    FROM internal.acces_demo_sauvegarde s
    JOIN public.box_members bm ON bm.id = s.box_member_id
   WHERE s.categorie IN ('demo', 'reviewer');

  INSERT INTO classement_demo_cible
  SELECT DISTINCT bm.member_id, 'coach'
    FROM public.box_members bm
    JOIN auth.users u ON u.id = bm.member_id
   WHERE bm.box_id = c_box
     AND bm.status = 'active'
     AND bm.role <> 'member'
     AND lower(u.email) LIKE '%@demo.athlexapp.eu'
     AND NOT EXISTS (SELECT 1 FROM public.boxes b WHERE b.owner_id = bm.member_id)
     AND bm.member_id NOT IN (SELECT user_id FROM classement_demo_cible);

  SELECT count(*) FILTER (WHERE origine = 'sauvegarde'), count(*) FILTER (WHERE origine = 'coach')
    INTO v_sauv, v_coach FROM classement_demo_cible;

  IF v_sauv = 0 THEN
    RAISE NOTICE 'Classement sans démo : sauvegarde de 20270157 vide, aucun compte inscrit.';
    RETURN;
  END IF;
  IF v_sauv <> 147 OR v_coach <> 3 THEN
    RAISE EXCEPTION 'CLASSEMENT_DEMO_COMPTES: sauvegarde %, coachs % (attendu 147, 3) : rien n''est écrit', v_sauv, v_coach;
  END IF;

  INSERT INTO internal.demo_accounts (user_id)
  SELECT user_id FROM classement_demo_cible
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Classement sans démo : % comptes inscrits (% repris de la sauvegarde, % coachs).', v_sauv + v_coach, v_sauv, v_coach;
END $migration$;

CREATE OR REPLACE FUNCTION public.global_leaderboard(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, username text, level text, elo integer, wins integer, total_matches integer, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.username, p.level, p.elo, p.wins, p.total_matches, p.avatar_url
    FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = p.id)
   ORDER BY p.elo DESC, p.id
   LIMIT least(greatest(coalesce(p_limit, 30), 0), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.global_elo_rank(p_elo integer)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer + 1
    FROM public.profiles p
   WHERE p.elo > p_elo
     AND NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = p.id);
$$;

REVOKE ALL ON FUNCTION public.global_leaderboard(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.global_elo_rank(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_leaderboard(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.global_elo_rank(integer) TO authenticated, service_role;
