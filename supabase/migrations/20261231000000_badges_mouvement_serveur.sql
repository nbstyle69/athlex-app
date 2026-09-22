-- ═════════════════════════════════════════════════════════════════════════════
-- Badges de mouvement (`mv_*`) reconnus par le serveur — lot badges 4a
--
-- Appliquée en prod : non
--
-- Constat (vérification prod du 21/09, `docs/audits/VERIF_PROD_TOURNOIS_BADGES.md`
-- et état des lieux du 22/09) : `badge_condition_met` n'a aucune branche pour
-- les clés `mv_*` et retombe sur `RETURN false`. `claim_badge` refuse donc les
-- 187 badges de mouvement publiés au catalogue — l'athlète qui termine un WOD
-- ne peut débloquer aucun d'entre eux. Les 1 893 attributions existantes ne
-- viennent pas de là : elles ont été posées par le chemin gestionnaire de box,
-- à partir de `movement_rep_counts`.
--
-- ── Où vivent les règles ─────────────────────────────────────────────────────
--
-- La condition d'un badge `mv_*` tient en (mouvement(s), unité, seuil). Aucune
-- de ces trois informations n'est en base aujourd'hui : `badges_catalog` ne
-- porte que des libellés, et la jonction préfixe → (mouvement, unité) n'existe
-- que dans le TypeScript du client. Recopier cette table dans le corps d'une
-- fonction PL/pgSQL aurait créé une seconde source qui dérive — c'est
-- exactement ce qui est arrivé à `mv_sdlhp`, oublié d'une liste redéclarée.
--
-- D'où la table `badge_rules` (arbitrage de Nab, 22/09/2026) : un catalogue de
-- règles, lisible par tous, écrit par les seules migrations. Son contenu vient
-- du fichier canonique `supabase/seed/badge_rules.json`, produit par
-- `scripts/generate-badge-rules.mjs` à partir du TypeScript du client et des
-- `INSERT` de catalogue du dépôt. Un test jest échoue si le fichier et le
-- TypeScript divergent ; un test SQL rejoué par la CI juge le serveur sur les
-- mêmes cas que le client.
--
-- ── Source de vérité des cumuls : `user_movement_stats`, et elle seule ───────
--
-- Deux tables de cumul coexistent en prod. `user_movement_stats` (alimentée par
-- `increment_movement_stats`, qui force la cible à `auth.uid()`) est celle que
-- l'athlète alimente et que l'app relit ; `movement_rep_counts` est écrite en
-- direct par le back-office et porte les cumuls dont sont issues les
-- attributions existantes. La règle retenue ne lit que la première.
--
-- `movement_rep_counts` n'est ni lue, ni modifiée, ni supprimée ici : son
-- abandon est le lot 4b. Aucune ligne d'`athlete_badges` n'est touchée, aucun
-- rattrapage n'est fait — et il n'y en a pas à faire : à ce jour, aucun athlète
-- n'atteint un palier sans détenir déjà le badge correspondant.
--
-- ── Ce que la migration ajoute au catalogue, et pourquoi ─────────────────────
--
-- 147 des 187 badges `mv_*` n'existent dans le dépôt que dans
-- `supabase/migrations_archive/20260321_movement_tracking.sql`, jamais rejoué,
-- et le baseline est un instantané de SCHÉMA (sans données). Une base
-- reconstruite n'a donc que 40 de ces badges au catalogue, alors que la prod en
-- a 187 — j'ai comparé les deux listes : les clés du dépôt sont exactement
-- celles de la prod. Sans ce rattrapage de catalogue, la clé étrangère de
-- `badge_rules` ne tiendrait pas au rejeu et les tests ne porteraient que sur
-- 40 badges. Les lignes sont reprises verbatim de l'archive, en
-- `ON CONFLICT DO NOTHING` : en production, où elles existent déjà, c'est une
-- opération blanche.
--
-- Aucun badge non `mv_*` ne change de comportement : les branches existantes de
-- `badge_condition_met` sont reprises à l'identique, et `claim_badge` n'est pas
-- touchée (elle reste la seule porte d'entrée, et reste idempotente).
--
-- Rejouable : `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`,
-- `CREATE OR REPLACE`. Contrôlée par `supabase/tests/badge_rules_mv.sql`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Catalogue : les 147 badges que le rejeu n'avait pas ──────────────────
-- Repris verbatim de `migrations_archive/20260321_movement_tracking.sql`.

INSERT INTO public.badges_catalog (badge_key, title, description, icon, category, sort_order) VALUES
  ('mv_thrusters_100',    'Thruster Rookie',      '100 Thrusters cumulés',      '🏋️', 'movement', 100),
  ('mv_thrusters_500',    'Thruster Addict',      '500 Thrusters cumulés',      '🏋️', 'movement', 101),
  ('mv_thrusters_1000',   'Thruster Machine',     '1000 Thrusters cumulés',     '🏋️', 'movement', 102),
  ('mv_thrusters_5000',   'Thruster Legend',       '5000 Thrusters cumulés',     '🏋️', 'movement', 103),
  ('mv_deadlifts_100',    'Deadlift Rookie',      '100 Deadlifts cumulés',      '⚡', 'movement', 104),
  ('mv_deadlifts_500',    'Deadlift Addict',      '500 Deadlifts cumulés',      '⚡', 'movement', 105),
  ('mv_deadlifts_1000',   'Deadlift Machine',     '1000 Deadlifts cumulés',     '⚡', 'movement', 106),
  ('mv_deadlifts_5000',   'Deadlift Legend',       '5000 Deadlifts cumulés',     '⚡', 'movement', 107),
  ('mv_clean_100',        'Clean Rookie',         '100 Cleans cumulés (toutes variantes)', '💪', 'movement', 108),
  ('mv_clean_500',        'Clean Addict',         '500 Cleans cumulés',         '💪', 'movement', 109),
  ('mv_clean_1000',       'Clean Machine',        '1000 Cleans cumulés',        '💪', 'movement', 110),
  ('mv_clean_5000',       'Clean Legend',           '5000 Cleans cumulés',        '💪', 'movement', 111),
  ('mv_snatch_100',       'Snatch Rookie',        '100 Snatches cumulés (toutes variantes)', '🎯', 'movement', 112),
  ('mv_snatch_500',       'Snatch Addict',        '500 Snatches cumulés',       '🎯', 'movement', 113),
  ('mv_snatch_1000',      'Snatch Machine',       '1000 Snatches cumulés',      '🎯', 'movement', 114),
  ('mv_snatch_5000',      'Snatch Legend',          '5000 Snatches cumulés',      '🎯', 'movement', 115),
  ('mv_squat_100',        'Squat Rookie',         '100 Squats cumulés (toutes variantes)', '🦵', 'movement', 116),
  ('mv_squat_500',        'Squat Addict',         '500 Squats cumulés',         '🦵', 'movement', 117),
  ('mv_squat_1000',       'Squat Machine',        '1000 Squats cumulés',        '🦵', 'movement', 118),
  ('mv_squat_5000',       'Squat Legend',           '5000 Squats cumulés',        '🦵', 'movement', 119),
  ('mv_press_100',        'Press Rookie',         '100 Press cumulés (strict/push/jerk)', '🔱', 'movement', 120),
  ('mv_press_500',        'Press Addict',         '500 Press cumulés',          '🔱', 'movement', 121),
  ('mv_press_1000',       'Press Machine',        '1000 Press cumulés',         '🔱', 'movement', 122),
  ('mv_press_5000',       'Press Legend',           '5000 Press cumulés',         '🔱', 'movement', 123),
  ('mv_cj_100',           'C&J Rookie',           '100 Clean & Jerks cumulés',  '🔥', 'movement', 124),
  ('mv_cj_500',           'C&J Addict',           '500 Clean & Jerks cumulés',  '🔥', 'movement', 125),
  ('mv_cj_1000',          'C&J Machine',          '1000 Clean & Jerks cumulés', '🔥', 'movement', 126),
  ('mv_cj_5000',          'C&J Legend',             '5000 Clean & Jerks cumulés', '🔥', 'movement', 127),
  ('mv_ohs_100',          'OHS Rookie',           '100 Overhead Squats cumulés','🏛️', 'movement', 128),
  ('mv_ohs_500',          'OHS Addict',           '500 Overhead Squats cumulés','🏛️', 'movement', 129),
  ('mv_ohs_1000',         'OHS Machine',          '1000 Overhead Squats cumulés','🏛️', 'movement', 130),
  ('mv_sdlhp_100',        'SDLHP Rookie',         '100 Sumo Deadlift HP',       '⚡', 'movement', 131),
  ('mv_db_snatch_100',    'DB Snatch Rookie',     '100 DB Snatches cumulés',    '🔔', 'movement', 140),
  ('mv_db_snatch_500',    'DB Snatch Addict',     '500 DB Snatches cumulés',    '🔔', 'movement', 141),
  ('mv_db_snatch_1000',   'DB Snatch Machine',    '1000 DB Snatches cumulés',   '🔔', 'movement', 142),
  ('mv_db_thruster_100',  'DB Thruster Rookie',   '100 DB Thrusters cumulés',   '🏋️', 'movement', 143),
  ('mv_db_thruster_500',  'DB Thruster Addict',   '500 DB Thrusters cumulés',   '🏋️', 'movement', 144),
  ('mv_db_thruster_1000', 'DB Thruster Machine',  '1000 DB Thrusters cumulés',  '🏋️', 'movement', 145),
  ('mv_devil_press_100',  'Devil Press Rookie',   '100 Devil Press cumulés',    '😈', 'movement', 146),
  ('mv_devil_press_500',  'Devil Press Addict',   '500 Devil Press cumulés',    '😈', 'movement', 147),
  ('mv_devil_press_1000', 'Devil Press Machine',  '1000 Devil Press cumulés',   '😈', 'movement', 148),
  ('mv_db_lunge_100',     'DB Lunge Rookie',      '100 DB Lunges cumulés',      '🦵', 'movement', 149),
  ('mv_db_lunge_500',     'DB Lunge Addict',      '500 DB Lunges cumulés',      '🦵', 'movement', 150),
  ('mv_db_lunge_1000',    'DB Lunge Machine',     '1000 DB Lunges cumulés',     '🦵', 'movement', 151),
  ('mv_db_cj_100',        'DB C&J Rookie',        '100 DB Clean & Jerks',       '🔥', 'movement', 152),
  ('mv_db_cj_500',        'DB C&J Addict',        '500 DB Clean & Jerks',       '🔥', 'movement', 153),
  ('mv_db_cj_1000',       'DB C&J Machine',       '1000 DB Clean & Jerks',      '🔥', 'movement', 154),
  ('mv_db_push_press_100','DB Push Press Rookie',  '100 DB Push Press',          '🔱', 'movement', 155),
  ('mv_db_push_press_500','DB Push Press Addict',  '500 DB Push Press',          '🔱', 'movement', 156),
  ('mv_kb_swing_100',     'KB Swing Rookie',      '100 KB Swings cumulés',      '🔔', 'movement', 160),
  ('mv_kb_swing_500',     'KB Swing Addict',      '500 KB Swings cumulés',      '🔔', 'movement', 161),
  ('mv_kb_swing_1000',    'KB Swing Machine',     '1000 KB Swings cumulés',     '🔔', 'movement', 162),
  ('mv_kb_swing_5000',    'KB Swing Legend',        '5000 KB Swings cumulés',     '🔔', 'movement', 163),
  ('mv_goblet_squat_100', 'Goblet Squat Rookie',  '100 Goblet Squats cumulés',  '🦵', 'movement', 164),
  ('mv_goblet_squat_500', 'Goblet Squat Addict',  '500 Goblet Squats cumulés',  '🦵', 'movement', 165),
  ('mv_kb_snatch_100',    'KB Snatch Rookie',     '100 KB Snatches cumulés',    '🎯', 'movement', 166),
  ('mv_kb_snatch_500',    'KB Snatch Addict',     '500 KB Snatches cumulés',    '🎯', 'movement', 167),
  ('mv_kb_cj_100',        'KB C&J Rookie',        '100 KB Clean & Jerks',       '🔥', 'movement', 168),
  ('mv_kb_cj_500',        'KB C&J Addict',        '500 KB Clean & Jerks',       '🔥', 'movement', 169),
  ('mv_turkish_gu_100',   'Turkish Get-up Rookie', '100 Turkish Get-ups',        '🎯', 'movement', 170),
  ('mv_turkish_gu_500',   'Turkish Get-up Addict', '500 Turkish Get-ups',        '🎯', 'movement', 171),
  ('mv_kb_thruster_100',  'KB Thruster Rookie',   '100 KB Thrusters cumulés',   '🏋️', 'movement', 172),
  ('mv_kb_thruster_500',  'KB Thruster Addict',   '500 KB Thrusters cumulés',   '🏋️', 'movement', 173),
  ('mv_box_jump_100',     'Box Jump Rookie',      '100 Box Jumps cumulés',      '📦', 'movement', 180),
  ('mv_box_jump_500',     'Box Jump Addict',      '500 Box Jumps cumulés',      '📦', 'movement', 181),
  ('mv_box_jump_1000',    'Box Jump Machine',     '1000 Box Jumps cumulés',     '📦', 'movement', 182),
  ('mv_burpee_bj_100',    'Burpee Box Jump Rookie','100 Burpee Box Jumps',      '📦', 'movement', 183),
  ('mv_burpee_bj_500',    'Burpee Box Jump Addict','500 Burpee Box Jumps',      '📦', 'movement', 184),
  ('mv_du_500',           'DU Rookie',            '500 Double Unders cumulés',  '🪢', 'movement', 190),
  ('mv_du_2000',          'DU Addict',            '2000 Double Unders cumulés', '🪢', 'movement', 191),
  ('mv_du_5000',          'DU Machine',           '5000 Double Unders cumulés', '🪢', 'movement', 192),
  ('mv_du_10000',         'DU Legend',              '10000 Double Unders cumulés','🪢', 'movement', 193),
  ('mv_su_1000',          'Single Under Rookie',  '1000 Single Unders',         '🪢', 'movement', 194),
  ('mv_su_5000',          'Single Under Machine', '5000 Single Unders',         '🪢', 'movement', 195),
  ('mv_pullup_100',       'Pull-up Rookie',       '100 Pull-ups cumulés',       '💪', 'movement', 200),
  ('mv_pullup_500',       'Pull-up Addict',       '500 Pull-ups cumulés',       '💪', 'movement', 201),
  ('mv_pullup_1000',      'Pull-up Machine',      '1000 Pull-ups cumulés',      '💪', 'movement', 202),
  ('mv_pullup_5000',      'Pull-up Legend',         '5000 Pull-ups cumulés',      '💪', 'movement', 203),
  ('mv_c2b_100',          'C2B Rookie',           '100 Chest-to-bar cumulés',   '💪', 'movement', 204),
  ('mv_c2b_500',          'C2B Addict',           '500 Chest-to-bar cumulés',   '💪', 'movement', 205),
  ('mv_c2b_1000',         'C2B Machine',          '1000 Chest-to-bar cumulés',  '💪', 'movement', 206),
  ('mv_t2b_100',          'T2B Rookie',           '100 Toes-to-bar cumulés',    '🦵', 'movement', 207),
  ('mv_t2b_500',          'T2B Addict',           '500 Toes-to-bar cumulés',    '🦵', 'movement', 208),
  ('mv_t2b_1000',         'T2B Machine',          '1000 Toes-to-bar cumulés',   '🦵', 'movement', 209),
  ('mv_bmu_100',          'Bar MU Rookie',        '100 Bar Muscle-ups cumulés', '🏆', 'movement', 210),
  ('mv_bmu_500',          'Bar MU Addict',        '500 Bar Muscle-ups cumulés', '🏆', 'movement', 211),
  ('mv_k2e_100',          'K2E Rookie',           '100 Knees-to-elbows',        '🦵', 'movement', 212),
  ('mv_k2e_500',          'K2E Addict',           '500 Knees-to-elbows',        '🦵', 'movement', 213),
  ('mv_pullover_100',     'Pull-Over Rookie',     '100 Pull-Overs cumulés',     '💪', 'movement', 214),
  ('mv_pullover_500',     'Pull-Over Addict',     '500 Pull-Overs cumulés',     '💪', 'movement', 215),
  ('mv_ring_mu_50',       'Ring MU Rookie',       '50 Ring Muscle-ups cumulés', '🏆', 'movement', 220),
  ('mv_ring_mu_200',      'Ring MU Addict',       '200 Ring Muscle-ups cumulés','🏆', 'movement', 221),
  ('mv_ring_mu_500',      'Ring MU Machine',      '500 Ring Muscle-ups cumulés','🏆', 'movement', 222),
  ('mv_ring_dip_100',     'Ring Dip Rookie',      '100 Ring Dips cumulés',      '💪', 'movement', 223),
  ('mv_ring_dip_500',     'Ring Dip Addict',      '500 Ring Dips cumulés',      '💪', 'movement', 224),
  ('mv_ring_row_100',     'Ring Row Rookie',      '100 Ring Rows cumulés',      '💪', 'movement', 225),
  ('mv_ring_row_500',     'Ring Row Addict',      '500 Ring Rows cumulés',      '💪', 'movement', 226),
  ('mv_burpee_100',       'Burpee Rookie',        '100 Burpees cumulés',        '🤮', 'movement', 230),
  ('mv_burpee_500',       'Burpee Addict',        '500 Burpees cumulés',        '🤮', 'movement', 231),
  ('mv_burpee_1000',      'Burpee Machine',       '1000 Burpees cumulés',       '🤮', 'movement', 232),
  ('mv_burpee_5000',      'Burpee Legend',          '5000 Burpees cumulés',       '🤮', 'movement', 233),
  ('mv_air_squat_100',    'Air Squat Rookie',     '100 Air Squats cumulés',     '🦵', 'movement', 234),
  ('mv_air_squat_500',    'Air Squat Addict',     '500 Air Squats cumulés',     '🦵', 'movement', 235),
  ('mv_air_squat_1000',   'Air Squat Machine',    '1000 Air Squats cumulés',    '🦵', 'movement', 236),
  ('mv_air_squat_5000',   'Air Squat Legend',      '5000 Air Squats cumulés',    '🦵', 'movement', 237),
  ('mv_pushup_100',       'Push-up Rookie',       '100 Push-ups cumulés',       '💪', 'movement', 238),
  ('mv_pushup_500',       'Push-up Addict',       '500 Push-ups cumulés',       '💪', 'movement', 239),
  ('mv_pushup_1000',      'Push-up Machine',      '1000 Push-ups cumulés',      '💪', 'movement', 240),
  ('mv_pushup_5000',      'Push-up Legend',        '5000 Push-ups cumulés',      '💪', 'movement', 241),
  ('mv_situp_100',        'Sit-up Rookie',        '100 Sit-ups cumulés',        '🦵', 'movement', 242),
  ('mv_situp_500',        'Sit-up Addict',        '500 Sit-ups cumulés',        '🦵', 'movement', 243),
  ('mv_situp_1000',       'Sit-up Machine',       '1000 Sit-ups cumulés',       '🦵', 'movement', 244),
  ('mv_lunge_100',        'Lunge Rookie',         '100 Lunges cumulés',         '🦵', 'movement', 245),
  ('mv_lunge_500',        'Lunge Addict',         '500 Lunges cumulés',         '🦵', 'movement', 246),
  ('mv_lunge_1000',       'Lunge Machine',        '1000 Lunges cumulés',        '🦵', 'movement', 247),
  ('mv_pistol_100',       'Pistol Squat Rookie',  '100 Pistol Squats cumulés',  '🎯', 'movement', 248),
  ('mv_pistol_500',       'Pistol Squat Addict',  '500 Pistol Squats cumulés',  '🎯', 'movement', 249),
  ('mv_hspu_100',         'HSPU Rookie',          '100 HSPU cumulés',           '🤸', 'movement', 250),
  ('mv_hspu_500',         'HSPU Addict',          '500 HSPU cumulés',           '🤸', 'movement', 251),
  ('mv_hspu_1000',        'HSPU Machine',         '1000 HSPU cumulés',          '🤸', 'movement', 252),
  ('mv_wallwalk_100',     'Wall Walk Rookie',     '100 Wall Walks cumulés',     '🤸', 'movement', 253),
  ('mv_wallwalk_500',     'Wall Walk Addict',     '500 Wall Walks cumulés',     '🤸', 'movement', 254),
  ('mv_vup_100',          'V-up Rookie',          '100 V-ups cumulés',          '🦵', 'movement', 255),
  ('mv_vup_500',          'V-up Addict',          '500 V-ups cumulés',          '🦵', 'movement', 256),
  ('mv_hollow_100',       'Hollow Rock Rookie',   '100 Hollow Rocks cumulés',   '🦵', 'movement', 257),
  ('mv_hollow_500',       'Hollow Rock Addict',   '500 Hollow Rocks cumulés',   '🦵', 'movement', 258),
  ('mv_mtclimber_100',    'Mt. Climber Rookie',   '100 Mountain Climbers',      '🏔️', 'movement', 259),
  ('mv_mtclimber_500',    'Mt. Climber Addict',   '500 Mountain Climbers',      '🏔️', 'movement', 260),
  ('mv_wallball_100',     'Wall Ball Rookie',     '100 Wall Balls cumulés',     '🏐', 'movement', 270),
  ('mv_wallball_500',     'Wall Ball Addict',     '500 Wall Balls cumulés',     '🏐', 'movement', 271),
  ('mv_wallball_1000',    'Wall Ball Machine',    '1000 Wall Balls cumulés',    '🏐', 'movement', 272),
  ('mv_wallball_5000',    'Wall Ball Legend',      '5000 Wall Balls cumulés',    '🏐', 'movement', 273),
  ('mv_mb_slam_100',      'MB Slam Rookie',       '100 Med Ball Slams cumulés', '🏐', 'movement', 274),
  ('mv_mb_slam_500',      'MB Slam Addict',       '500 Med Ball Slams cumulés', '🏐', 'movement', 275),
  ('mv_row_500',          'Rameur Rookie',        '500 cal Rameur cumulées',    '🚣', 'movement', 280),
  ('mv_row_2000',         'Rameur Addict',        '2000 cal Rameur cumulées',   '🚣', 'movement', 281),
  ('mv_row_5000',         'Rameur Machine',       '5000 cal Rameur cumulées',   '🚣', 'movement', 282),
  ('mv_bike_500',         'Assault Bike Rookie',  '500 cal Bike cumulées',      '🚴', 'movement', 283),
  ('mv_bike_2000',        'Assault Bike Addict',  '2000 cal Bike cumulées',     '🚴', 'movement', 284),
  ('mv_ski_500',          'Ski Erg Rookie',       '500 cal Ski cumulées',       '⛷️', 'movement', 285),
  ('mv_ski_2000',         'Ski Erg Addict',       '2000 cal Ski cumulées',      '⛷️', 'movement', 286),
  ('mv_polyvalent_5',     'Polyvalent',           '5 mouvements avec 100+ reps', '🎯', 'movement', 290),
  ('mv_polyvalent_10',    'Touche-à-tout',        '10 mouvements avec 100+ reps','🎯', 'movement', 291),
  ('mv_polyvalent_20',    'Maître des mouvements','20 mouvements avec 100+ reps','🎯', 'movement', 292),
  ('mv_total_10k',        '10K Club',             '10 000 reps totales cumulées','🏛️', 'movement', 293),
  ('mv_total_50k',        '50K Club',             '50 000 reps totales cumulées','🏛️', 'movement', 294),
  ('mv_total_100k',       '100K Club',            '100 000 reps totales cumulées','🏛️', 'movement', 295)
ON CONFLICT (badge_key) DO NOTHING;

-- ── 2. La table des règles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.badge_rules (
  badge_key              text PRIMARY KEY
                           REFERENCES public.badges_catalog(badge_key) ON DELETE CASCADE,
  -- `movement` : cumul d'une famille de mouvements dans une unité.
  -- `total`    : somme de tous les mouvements comptés, en reps.
  -- `polyvalent` : nombre de mouvements dépassant `per_movement_threshold`.
  rule_kind              text NOT NULL CHECK (rule_kind IN ('movement', 'total', 'polyvalent')),
  unit                   text NOT NULL CHECK (unit IN ('reps', 'm', 'cal')),
  threshold              bigint NOT NULL CHECK (threshold > 0),
  -- Les clés canoniques comptées, regroupements compris : `mv_burpee` compte
  -- aussi les burpees box jump, `mv_squat` les variantes de squat. Pour les
  -- méta-badges, c'est l'espace de clés connu tout entier — une ligne héritée
  -- dont la clé n'est pas un mouvement (« work_hsw », « rounds ») ne compte pas.
  movement_keys          text[] NOT NULL CHECK (cardinality(movement_keys) > 0),
  per_movement_threshold integer CHECK (per_movement_threshold > 0),
  -- Le seuil par mouvement n'a de sens que pour la polyvalence, et il lui est
  -- indispensable : la contrainte dit les deux à la fois.
  CONSTRAINT badge_rules_seuil_par_mouvement
    CHECK ((rule_kind = 'polyvalent') = (per_movement_threshold IS NOT NULL))
);

COMMENT ON TABLE public.badge_rules IS
  'Conditions des badges de mouvement (mv_*), lues par badge_condition_met. Catalogue : lecture ouverte, écriture réservée aux migrations et à service_role. Contenu généré depuis supabase/seed/badge_rules.json.';

ALTER TABLE public.badge_rules ENABLE ROW LEVEL SECURITY;

-- Catalogue : tout le monde peut lire, y compris sans session — l'app doit
-- pouvoir afficher « 100 tractions pour ce badge » avant connexion.
DROP POLICY IF EXISTS badge_rules_public_read ON public.badge_rules;
CREATE POLICY badge_rules_public_read ON public.badge_rules FOR SELECT USING (true);

-- Les privilèges par défaut de la stack donnent ALL à anon/authenticated sur
-- toute table créée dans `public` : sans ce REVOKE, un rôle client pourrait
-- réécrire la condition de ses propres badges.
REVOKE ALL ON TABLE public.badge_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.badge_rules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.badge_rules TO service_role;

-- ── 3. Les 187 règles ───────────────────────────────────────────────────────
-- Générées : `node scripts/generate-badge-rules.mjs`. Ne pas éditer à la main —
-- le test jest compare ce contenu au TypeScript du client.

INSERT INTO public.badge_rules (badge_key, rule_kind, unit, threshold, movement_keys, per_movement_threshold) VALUES
  ('mv_air_squat_100', 'movement', 'reps', 100, ARRAY['air_squat'], NULL),
  ('mv_air_squat_1000', 'movement', 'reps', 1000, ARRAY['air_squat'], NULL),
  ('mv_air_squat_500', 'movement', 'reps', 500, ARRAY['air_squat'], NULL),
  ('mv_air_squat_5000', 'movement', 'reps', 5000, ARRAY['air_squat'], NULL),
  ('mv_bench_press_100', 'movement', 'reps', 100, ARRAY['bench_press'], NULL),
  ('mv_bench_press_1000', 'movement', 'reps', 1000, ARRAY['bench_press'], NULL),
  ('mv_bench_press_500', 'movement', 'reps', 500, ARRAY['bench_press'], NULL),
  ('mv_bench_press_5000', 'movement', 'reps', 5000, ARRAY['bench_press'], NULL),
  ('mv_bike_10000', 'movement', 'cal', 10000, ARRAY['bike'], NULL),
  ('mv_bike_2000', 'movement', 'cal', 2000, ARRAY['bike'], NULL),
  ('mv_bike_500', 'movement', 'cal', 500, ARRAY['bike'], NULL),
  ('mv_bike_5000', 'movement', 'cal', 5000, ARRAY['bike'], NULL),
  ('mv_bike_m_100000', 'movement', 'm', 100000, ARRAY['bike'], NULL),
  ('mv_bike_m_25000', 'movement', 'm', 25000, ARRAY['bike'], NULL),
  ('mv_bike_m_250000', 'movement', 'm', 250000, ARRAY['bike'], NULL),
  ('mv_bmu_100', 'movement', 'reps', 100, ARRAY['bar_muscle_up'], NULL),
  ('mv_bmu_500', 'movement', 'reps', 500, ARRAY['bar_muscle_up'], NULL),
  ('mv_box_jump_100', 'movement', 'reps', 100, ARRAY['box_jump'], NULL),
  ('mv_box_jump_1000', 'movement', 'reps', 1000, ARRAY['box_jump'], NULL),
  ('mv_box_jump_500', 'movement', 'reps', 500, ARRAY['box_jump'], NULL),
  ('mv_burpee_100', 'movement', 'reps', 100, ARRAY['burpee', 'burpee_box_jump'], NULL),
  ('mv_burpee_1000', 'movement', 'reps', 1000, ARRAY['burpee', 'burpee_box_jump'], NULL),
  ('mv_burpee_500', 'movement', 'reps', 500, ARRAY['burpee', 'burpee_box_jump'], NULL),
  ('mv_burpee_5000', 'movement', 'reps', 5000, ARRAY['burpee', 'burpee_box_jump'], NULL),
  ('mv_burpee_bj_100', 'movement', 'reps', 100, ARRAY['burpee_box_jump'], NULL),
  ('mv_burpee_bj_500', 'movement', 'reps', 500, ARRAY['burpee_box_jump'], NULL),
  ('mv_c2b_100', 'movement', 'reps', 100, ARRAY['chest_to_bar'], NULL),
  ('mv_c2b_1000', 'movement', 'reps', 1000, ARRAY['chest_to_bar'], NULL),
  ('mv_c2b_500', 'movement', 'reps', 500, ARRAY['chest_to_bar'], NULL),
  ('mv_cj_100', 'movement', 'reps', 100, ARRAY['clean_and_jerk'], NULL),
  ('mv_cj_1000', 'movement', 'reps', 1000, ARRAY['clean_and_jerk'], NULL),
  ('mv_cj_500', 'movement', 'reps', 500, ARRAY['clean_and_jerk'], NULL),
  ('mv_cj_5000', 'movement', 'reps', 5000, ARRAY['clean_and_jerk'], NULL),
  ('mv_clean_100', 'movement', 'reps', 100, ARRAY['clean'], NULL),
  ('mv_clean_1000', 'movement', 'reps', 1000, ARRAY['clean'], NULL),
  ('mv_clean_500', 'movement', 'reps', 500, ARRAY['clean'], NULL),
  ('mv_clean_5000', 'movement', 'reps', 5000, ARRAY['clean'], NULL),
  ('mv_clean_pull_100', 'movement', 'reps', 100, ARRAY['clean_pull'], NULL),
  ('mv_clean_pull_1000', 'movement', 'reps', 1000, ARRAY['clean_pull'], NULL),
  ('mv_clean_pull_500', 'movement', 'reps', 500, ARRAY['clean_pull'], NULL),
  ('mv_clean_pull_5000', 'movement', 'reps', 5000, ARRAY['clean_pull'], NULL),
  ('mv_db_cj_100', 'movement', 'reps', 100, ARRAY['db_cj'], NULL),
  ('mv_db_cj_1000', 'movement', 'reps', 1000, ARRAY['db_cj'], NULL),
  ('mv_db_cj_500', 'movement', 'reps', 500, ARRAY['db_cj'], NULL),
  ('mv_db_lunge_100', 'movement', 'reps', 100, ARRAY['db_lunge'], NULL),
  ('mv_db_lunge_1000', 'movement', 'reps', 1000, ARRAY['db_lunge'], NULL),
  ('mv_db_lunge_500', 'movement', 'reps', 500, ARRAY['db_lunge'], NULL),
  ('mv_db_push_press_100', 'movement', 'reps', 100, ARRAY['db_push_press'], NULL),
  ('mv_db_push_press_500', 'movement', 'reps', 500, ARRAY['db_push_press'], NULL),
  ('mv_db_snatch_100', 'movement', 'reps', 100, ARRAY['db_snatch'], NULL),
  ('mv_db_snatch_1000', 'movement', 'reps', 1000, ARRAY['db_snatch'], NULL),
  ('mv_db_snatch_500', 'movement', 'reps', 500, ARRAY['db_snatch'], NULL),
  ('mv_db_strict_press_100', 'movement', 'reps', 100, ARRAY['db_strict_press'], NULL),
  ('mv_db_strict_press_1000', 'movement', 'reps', 1000, ARRAY['db_strict_press'], NULL),
  ('mv_db_strict_press_500', 'movement', 'reps', 500, ARRAY['db_strict_press'], NULL),
  ('mv_db_thruster_100', 'movement', 'reps', 100, ARRAY['db_thruster'], NULL),
  ('mv_db_thruster_1000', 'movement', 'reps', 1000, ARRAY['db_thruster'], NULL),
  ('mv_db_thruster_500', 'movement', 'reps', 500, ARRAY['db_thruster'], NULL),
  ('mv_deadlifts_100', 'movement', 'reps', 100, ARRAY['deadlift'], NULL),
  ('mv_deadlifts_1000', 'movement', 'reps', 1000, ARRAY['deadlift'], NULL),
  ('mv_deadlifts_500', 'movement', 'reps', 500, ARRAY['deadlift'], NULL),
  ('mv_deadlifts_5000', 'movement', 'reps', 5000, ARRAY['deadlift'], NULL),
  ('mv_devil_press_100', 'movement', 'reps', 100, ARRAY['devil_press'], NULL),
  ('mv_devil_press_1000', 'movement', 'reps', 1000, ARRAY['devil_press'], NULL),
  ('mv_devil_press_500', 'movement', 'reps', 500, ARRAY['devil_press'], NULL),
  ('mv_du_10000', 'movement', 'reps', 10000, ARRAY['double_under'], NULL),
  ('mv_du_2000', 'movement', 'reps', 2000, ARRAY['double_under'], NULL),
  ('mv_du_500', 'movement', 'reps', 500, ARRAY['double_under'], NULL),
  ('mv_du_5000', 'movement', 'reps', 5000, ARRAY['double_under'], NULL),
  ('mv_goblet_squat_100', 'movement', 'reps', 100, ARRAY['goblet_squat'], NULL),
  ('mv_goblet_squat_500', 'movement', 'reps', 500, ARRAY['goblet_squat'], NULL),
  ('mv_hollow_100', 'movement', 'reps', 100, ARRAY['hollow_rock'], NULL),
  ('mv_hollow_500', 'movement', 'reps', 500, ARRAY['hollow_rock'], NULL),
  ('mv_hspu_100', 'movement', 'reps', 100, ARRAY['hspu'], NULL),
  ('mv_hspu_1000', 'movement', 'reps', 1000, ARRAY['hspu'], NULL),
  ('mv_hspu_500', 'movement', 'reps', 500, ARRAY['hspu'], NULL),
  ('mv_k2e_100', 'movement', 'reps', 100, ARRAY['knees_to_elbow'], NULL),
  ('mv_k2e_500', 'movement', 'reps', 500, ARRAY['knees_to_elbow'], NULL),
  ('mv_kb_cj_100', 'movement', 'reps', 100, ARRAY['kb_cj'], NULL),
  ('mv_kb_cj_500', 'movement', 'reps', 500, ARRAY['kb_cj'], NULL),
  ('mv_kb_snatch_100', 'movement', 'reps', 100, ARRAY['kb_snatch'], NULL),
  ('mv_kb_snatch_500', 'movement', 'reps', 500, ARRAY['kb_snatch'], NULL),
  ('mv_kb_swing_100', 'movement', 'reps', 100, ARRAY['kb_swing'], NULL),
  ('mv_kb_swing_1000', 'movement', 'reps', 1000, ARRAY['kb_swing'], NULL),
  ('mv_kb_swing_500', 'movement', 'reps', 500, ARRAY['kb_swing'], NULL),
  ('mv_kb_swing_5000', 'movement', 'reps', 5000, ARRAY['kb_swing'], NULL),
  ('mv_kb_thruster_100', 'movement', 'reps', 100, ARRAY['kb_thruster'], NULL),
  ('mv_kb_thruster_500', 'movement', 'reps', 500, ARRAY['kb_thruster'], NULL),
  ('mv_lunge_100', 'movement', 'reps', 100, ARRAY['lunge'], NULL),
  ('mv_lunge_1000', 'movement', 'reps', 1000, ARRAY['lunge'], NULL),
  ('mv_lunge_500', 'movement', 'reps', 500, ARRAY['lunge'], NULL),
  ('mv_mb_slam_100', 'movement', 'reps', 100, ARRAY['mb_slam'], NULL),
  ('mv_mb_slam_500', 'movement', 'reps', 500, ARRAY['mb_slam'], NULL),
  ('mv_mtclimber_100', 'movement', 'reps', 100, ARRAY['mountain_climber'], NULL),
  ('mv_mtclimber_500', 'movement', 'reps', 500, ARRAY['mountain_climber'], NULL),
  ('mv_ohs_100', 'movement', 'reps', 100, ARRAY['overhead_squat'], NULL),
  ('mv_ohs_1000', 'movement', 'reps', 1000, ARRAY['overhead_squat'], NULL),
  ('mv_ohs_500', 'movement', 'reps', 500, ARRAY['overhead_squat'], NULL),
  ('mv_pistol_100', 'movement', 'reps', 100, ARRAY['pistol_squat'], NULL),
  ('mv_pistol_500', 'movement', 'reps', 500, ARRAY['pistol_squat'], NULL),
  ('mv_polyvalent_10', 'polyvalent', 'reps', 10, ARRAY['air_squat', 'bar_muscle_up', 'bench_press', 'bike', 'box_jump', 'burpee', 'burpee_box_jump', 'chest_to_bar', 'clean', 'clean_and_jerk', 'clean_pull', 'db_cj', 'db_push_press', 'db_snatch', 'db_strict_press', 'db_thruster', 'deadlift', 'devil_press', 'double_under', 'goblet_squat', 'hollow_rock', 'hspu', 'kb_cj', 'kb_snatch', 'kb_swing', 'kb_thruster', 'knees_to_elbow', 'lunge', 'mb_slam', 'mountain_climber', 'muscle_up', 'overhead_squat', 'pistol_squat', 'press', 'pull_over', 'pull_up', 'push_up', 'ring_dip', 'ring_muscle_up', 'ring_row', 'row', 'run', 'sdlhp', 'single_under', 'sit_up', 'ski_erg', 'snatch', 'snatch_balance', 'snatch_high_pull', 'squat', 'strict_press', 'thruster', 'toes_to_bar', 'turkish_get_up', 'v_up', 'wall_ball', 'wall_walk'], 100),
  ('mv_polyvalent_20', 'polyvalent', 'reps', 20, ARRAY['air_squat', 'bar_muscle_up', 'bench_press', 'bike', 'box_jump', 'burpee', 'burpee_box_jump', 'chest_to_bar', 'clean', 'clean_and_jerk', 'clean_pull', 'db_cj', 'db_push_press', 'db_snatch', 'db_strict_press', 'db_thruster', 'deadlift', 'devil_press', 'double_under', 'goblet_squat', 'hollow_rock', 'hspu', 'kb_cj', 'kb_snatch', 'kb_swing', 'kb_thruster', 'knees_to_elbow', 'lunge', 'mb_slam', 'mountain_climber', 'muscle_up', 'overhead_squat', 'pistol_squat', 'press', 'pull_over', 'pull_up', 'push_up', 'ring_dip', 'ring_muscle_up', 'ring_row', 'row', 'run', 'sdlhp', 'single_under', 'sit_up', 'ski_erg', 'snatch', 'snatch_balance', 'snatch_high_pull', 'squat', 'strict_press', 'thruster', 'toes_to_bar', 'turkish_get_up', 'v_up', 'wall_ball', 'wall_walk'], 100),
  ('mv_polyvalent_5', 'polyvalent', 'reps', 5, ARRAY['air_squat', 'bar_muscle_up', 'bench_press', 'bike', 'box_jump', 'burpee', 'burpee_box_jump', 'chest_to_bar', 'clean', 'clean_and_jerk', 'clean_pull', 'db_cj', 'db_push_press', 'db_snatch', 'db_strict_press', 'db_thruster', 'deadlift', 'devil_press', 'double_under', 'goblet_squat', 'hollow_rock', 'hspu', 'kb_cj', 'kb_snatch', 'kb_swing', 'kb_thruster', 'knees_to_elbow', 'lunge', 'mb_slam', 'mountain_climber', 'muscle_up', 'overhead_squat', 'pistol_squat', 'press', 'pull_over', 'pull_up', 'push_up', 'ring_dip', 'ring_muscle_up', 'ring_row', 'row', 'run', 'sdlhp', 'single_under', 'sit_up', 'ski_erg', 'snatch', 'snatch_balance', 'snatch_high_pull', 'squat', 'strict_press', 'thruster', 'toes_to_bar', 'turkish_get_up', 'v_up', 'wall_ball', 'wall_walk'], 100),
  ('mv_press_100', 'movement', 'reps', 100, ARRAY['press'], NULL),
  ('mv_press_1000', 'movement', 'reps', 1000, ARRAY['press'], NULL),
  ('mv_press_500', 'movement', 'reps', 500, ARRAY['press'], NULL),
  ('mv_press_5000', 'movement', 'reps', 5000, ARRAY['press'], NULL),
  ('mv_pullover_100', 'movement', 'reps', 100, ARRAY['pull_over'], NULL),
  ('mv_pullover_500', 'movement', 'reps', 500, ARRAY['pull_over'], NULL),
  ('mv_pullup_100', 'movement', 'reps', 100, ARRAY['pull_up'], NULL),
  ('mv_pullup_1000', 'movement', 'reps', 1000, ARRAY['pull_up'], NULL),
  ('mv_pullup_500', 'movement', 'reps', 500, ARRAY['pull_up'], NULL),
  ('mv_pullup_5000', 'movement', 'reps', 5000, ARRAY['pull_up'], NULL),
  ('mv_pushup_100', 'movement', 'reps', 100, ARRAY['push_up'], NULL),
  ('mv_pushup_1000', 'movement', 'reps', 1000, ARRAY['push_up'], NULL),
  ('mv_pushup_500', 'movement', 'reps', 500, ARRAY['push_up'], NULL),
  ('mv_pushup_5000', 'movement', 'reps', 5000, ARRAY['push_up'], NULL),
  ('mv_ring_dip_100', 'movement', 'reps', 100, ARRAY['ring_dip'], NULL),
  ('mv_ring_dip_500', 'movement', 'reps', 500, ARRAY['ring_dip'], NULL),
  ('mv_ring_mu_200', 'movement', 'reps', 200, ARRAY['ring_muscle_up'], NULL),
  ('mv_ring_mu_50', 'movement', 'reps', 50, ARRAY['ring_muscle_up'], NULL),
  ('mv_ring_mu_500', 'movement', 'reps', 500, ARRAY['ring_muscle_up'], NULL),
  ('mv_ring_row_100', 'movement', 'reps', 100, ARRAY['ring_row'], NULL),
  ('mv_ring_row_500', 'movement', 'reps', 500, ARRAY['ring_row'], NULL),
  ('mv_row_2000', 'movement', 'cal', 2000, ARRAY['row'], NULL),
  ('mv_row_500', 'movement', 'cal', 500, ARRAY['row'], NULL),
  ('mv_row_5000', 'movement', 'cal', 5000, ARRAY['row'], NULL),
  ('mv_row_m_10000', 'movement', 'm', 10000, ARRAY['row'], NULL),
  ('mv_row_m_100000', 'movement', 'm', 100000, ARRAY['row'], NULL),
  ('mv_row_m_250000', 'movement', 'm', 250000, ARRAY['row'], NULL),
  ('mv_row_m_42195', 'movement', 'm', 42195, ARRAY['row'], NULL),
  ('mv_run_10000', 'movement', 'm', 10000, ARRAY['run'], NULL),
  ('mv_run_100000', 'movement', 'm', 100000, ARRAY['run'], NULL),
  ('mv_run_250000', 'movement', 'm', 250000, ARRAY['run'], NULL),
  ('mv_run_42195', 'movement', 'm', 42195, ARRAY['run'], NULL),
  ('mv_sdlhp_100', 'movement', 'reps', 100, ARRAY['sdlhp'], NULL),
  ('mv_situp_100', 'movement', 'reps', 100, ARRAY['sit_up'], NULL),
  ('mv_situp_1000', 'movement', 'reps', 1000, ARRAY['sit_up'], NULL),
  ('mv_situp_500', 'movement', 'reps', 500, ARRAY['sit_up'], NULL),
  ('mv_ski_2000', 'movement', 'cal', 2000, ARRAY['ski_erg'], NULL),
  ('mv_ski_500', 'movement', 'cal', 500, ARRAY['ski_erg'], NULL),
  ('mv_ski_5000', 'movement', 'cal', 5000, ARRAY['ski_erg'], NULL),
  ('mv_ski_m_10000', 'movement', 'm', 10000, ARRAY['ski_erg'], NULL),
  ('mv_ski_m_100000', 'movement', 'm', 100000, ARRAY['ski_erg'], NULL),
  ('mv_ski_m_42195', 'movement', 'm', 42195, ARRAY['ski_erg'], NULL),
  ('mv_snatch_100', 'movement', 'reps', 100, ARRAY['snatch'], NULL),
  ('mv_snatch_1000', 'movement', 'reps', 1000, ARRAY['snatch'], NULL),
  ('mv_snatch_500', 'movement', 'reps', 500, ARRAY['snatch'], NULL),
  ('mv_snatch_5000', 'movement', 'reps', 5000, ARRAY['snatch'], NULL),
  ('mv_snatch_balance_100', 'movement', 'reps', 100, ARRAY['snatch_balance'], NULL),
  ('mv_snatch_balance_1000', 'movement', 'reps', 1000, ARRAY['snatch_balance'], NULL),
  ('mv_snatch_balance_500', 'movement', 'reps', 500, ARRAY['snatch_balance'], NULL),
  ('mv_snatch_balance_5000', 'movement', 'reps', 5000, ARRAY['snatch_balance'], NULL),
  ('mv_snatch_hp_100', 'movement', 'reps', 100, ARRAY['snatch_high_pull'], NULL),
  ('mv_snatch_hp_1000', 'movement', 'reps', 1000, ARRAY['snatch_high_pull'], NULL),
  ('mv_snatch_hp_500', 'movement', 'reps', 500, ARRAY['snatch_high_pull'], NULL),
  ('mv_snatch_hp_5000', 'movement', 'reps', 5000, ARRAY['snatch_high_pull'], NULL),
  ('mv_squat_100', 'movement', 'reps', 100, ARRAY['air_squat', 'goblet_squat', 'overhead_squat', 'squat'], NULL),
  ('mv_squat_1000', 'movement', 'reps', 1000, ARRAY['air_squat', 'goblet_squat', 'overhead_squat', 'squat'], NULL),
  ('mv_squat_500', 'movement', 'reps', 500, ARRAY['air_squat', 'goblet_squat', 'overhead_squat', 'squat'], NULL),
  ('mv_squat_5000', 'movement', 'reps', 5000, ARRAY['air_squat', 'goblet_squat', 'overhead_squat', 'squat'], NULL),
  ('mv_strict_press_100', 'movement', 'reps', 100, ARRAY['strict_press'], NULL),
  ('mv_strict_press_1000', 'movement', 'reps', 1000, ARRAY['strict_press'], NULL),
  ('mv_strict_press_500', 'movement', 'reps', 500, ARRAY['strict_press'], NULL),
  ('mv_strict_press_5000', 'movement', 'reps', 5000, ARRAY['strict_press'], NULL),
  ('mv_su_1000', 'movement', 'reps', 1000, ARRAY['single_under'], NULL),
  ('mv_su_5000', 'movement', 'reps', 5000, ARRAY['single_under'], NULL),
  ('mv_t2b_100', 'movement', 'reps', 100, ARRAY['toes_to_bar'], NULL),
  ('mv_t2b_1000', 'movement', 'reps', 1000, ARRAY['toes_to_bar'], NULL),
  ('mv_t2b_500', 'movement', 'reps', 500, ARRAY['toes_to_bar'], NULL),
  ('mv_thrusters_100', 'movement', 'reps', 100, ARRAY['thruster'], NULL),
  ('mv_thrusters_1000', 'movement', 'reps', 1000, ARRAY['thruster'], NULL),
  ('mv_thrusters_500', 'movement', 'reps', 500, ARRAY['thruster'], NULL),
  ('mv_thrusters_5000', 'movement', 'reps', 5000, ARRAY['thruster'], NULL),
  ('mv_total_100k', 'total', 'reps', 100000, ARRAY['air_squat', 'bar_muscle_up', 'bench_press', 'bike', 'box_jump', 'burpee', 'burpee_box_jump', 'chest_to_bar', 'clean', 'clean_and_jerk', 'clean_pull', 'db_cj', 'db_push_press', 'db_snatch', 'db_strict_press', 'db_thruster', 'deadlift', 'devil_press', 'double_under', 'goblet_squat', 'hollow_rock', 'hspu', 'kb_cj', 'kb_snatch', 'kb_swing', 'kb_thruster', 'knees_to_elbow', 'lunge', 'mb_slam', 'mountain_climber', 'muscle_up', 'overhead_squat', 'pistol_squat', 'press', 'pull_over', 'pull_up', 'push_up', 'ring_dip', 'ring_muscle_up', 'ring_row', 'row', 'run', 'sdlhp', 'single_under', 'sit_up', 'ski_erg', 'snatch', 'snatch_balance', 'snatch_high_pull', 'squat', 'strict_press', 'thruster', 'toes_to_bar', 'turkish_get_up', 'v_up', 'wall_ball', 'wall_walk'], NULL),
  ('mv_total_10k', 'total', 'reps', 10000, ARRAY['air_squat', 'bar_muscle_up', 'bench_press', 'bike', 'box_jump', 'burpee', 'burpee_box_jump', 'chest_to_bar', 'clean', 'clean_and_jerk', 'clean_pull', 'db_cj', 'db_push_press', 'db_snatch', 'db_strict_press', 'db_thruster', 'deadlift', 'devil_press', 'double_under', 'goblet_squat', 'hollow_rock', 'hspu', 'kb_cj', 'kb_snatch', 'kb_swing', 'kb_thruster', 'knees_to_elbow', 'lunge', 'mb_slam', 'mountain_climber', 'muscle_up', 'overhead_squat', 'pistol_squat', 'press', 'pull_over', 'pull_up', 'push_up', 'ring_dip', 'ring_muscle_up', 'ring_row', 'row', 'run', 'sdlhp', 'single_under', 'sit_up', 'ski_erg', 'snatch', 'snatch_balance', 'snatch_high_pull', 'squat', 'strict_press', 'thruster', 'toes_to_bar', 'turkish_get_up', 'v_up', 'wall_ball', 'wall_walk'], NULL),
  ('mv_total_50k', 'total', 'reps', 50000, ARRAY['air_squat', 'bar_muscle_up', 'bench_press', 'bike', 'box_jump', 'burpee', 'burpee_box_jump', 'chest_to_bar', 'clean', 'clean_and_jerk', 'clean_pull', 'db_cj', 'db_push_press', 'db_snatch', 'db_strict_press', 'db_thruster', 'deadlift', 'devil_press', 'double_under', 'goblet_squat', 'hollow_rock', 'hspu', 'kb_cj', 'kb_snatch', 'kb_swing', 'kb_thruster', 'knees_to_elbow', 'lunge', 'mb_slam', 'mountain_climber', 'muscle_up', 'overhead_squat', 'pistol_squat', 'press', 'pull_over', 'pull_up', 'push_up', 'ring_dip', 'ring_muscle_up', 'ring_row', 'row', 'run', 'sdlhp', 'single_under', 'sit_up', 'ski_erg', 'snatch', 'snatch_balance', 'snatch_high_pull', 'squat', 'strict_press', 'thruster', 'toes_to_bar', 'turkish_get_up', 'v_up', 'wall_ball', 'wall_walk'], NULL),
  ('mv_turkish_gu_100', 'movement', 'reps', 100, ARRAY['turkish_get_up'], NULL),
  ('mv_turkish_gu_500', 'movement', 'reps', 500, ARRAY['turkish_get_up'], NULL),
  ('mv_vup_100', 'movement', 'reps', 100, ARRAY['v_up'], NULL),
  ('mv_vup_500', 'movement', 'reps', 500, ARRAY['v_up'], NULL),
  ('mv_wallball_100', 'movement', 'reps', 100, ARRAY['wall_ball'], NULL),
  ('mv_wallball_1000', 'movement', 'reps', 1000, ARRAY['wall_ball'], NULL),
  ('mv_wallball_500', 'movement', 'reps', 500, ARRAY['wall_ball'], NULL),
  ('mv_wallball_5000', 'movement', 'reps', 5000, ARRAY['wall_ball'], NULL),
  ('mv_wallwalk_100', 'movement', 'reps', 100, ARRAY['wall_walk'], NULL),
  ('mv_wallwalk_500', 'movement', 'reps', 500, ARRAY['wall_walk'], NULL)
ON CONFLICT (badge_key) DO UPDATE SET
  rule_kind              = EXCLUDED.rule_kind,
  unit                   = EXCLUDED.unit,
  threshold              = EXCLUDED.threshold,
  movement_keys          = EXCLUDED.movement_keys,
  per_movement_threshold = EXCLUDED.per_movement_threshold;

-- ── 4. La branche `mv_*` de `badge_condition_met` ───────────────────────────
-- Le reste de la fonction est repris mot pour mot de `20261116_lot5c_
-- programmes_par_box.sql` : aucun autre badge ne change de comportement. La
-- branche est posée AVANT le `CASE`, parce qu'un `CASE` sur une valeur ne sait
-- pas reconnaître un préfixe.

CREATE OR REPLACE FUNCTION public.badge_condition_met(p_athlete_id uuid, p_badge_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_elo   integer;
  v_count integer;
  v_rule  public.badge_rules%ROWTYPE;
  v_total bigint;
BEGIN
  IF p_athlete_id IS NULL THEN
    RETURN false;
  END IF;

  -- ── Badges de mouvement : la règle est en base, le cumul aussi ────────────
  IF p_badge_key LIKE 'mv\_%' THEN
    SELECT * INTO v_rule FROM public.badge_rules WHERE badge_key = p_badge_key;
    IF NOT FOUND THEN
      -- Badge `mv_*` publié au catalogue sans règle : jamais réclamable, comme
      -- avant ce lot. Silencieux volontairement — `claim_badge` répond déjà
      -- « condition_non_remplie », et un badge sans règle est un oubli de
      -- migration, pas une tentative de l'athlète.
      RETURN false;
    END IF;

    IF v_rule.rule_kind = 'polyvalent' THEN
      -- Nombre de mouvements dépassant le seuil par mouvement. La clé primaire
      -- de `user_movement_stats` est (user, movement, unit) : une ligne par
      -- mouvement, donc compter les lignes revient à compter les mouvements.
      SELECT count(*) INTO v_count
        FROM public.user_movement_stats
       WHERE user_id = p_athlete_id
         AND unit = v_rule.unit
         AND movement = ANY (v_rule.movement_keys)
         AND total_reps >= v_rule.per_movement_threshold;
      RETURN v_count >= v_rule.threshold;
    END IF;

    -- `movement` et `total` se calculent pareil : une somme sur les mouvements
    -- comptés, dans l'unité de la règle. Seule l'étendue de `movement_keys`
    -- les distingue — une famille d'un côté, l'espace de clés entier de l'autre.
    SELECT COALESCE(sum(total_reps), 0) INTO v_total
      FROM public.user_movement_stats
     WHERE user_id = p_athlete_id
       AND unit = v_rule.unit
       AND movement = ANY (v_rule.movement_keys);
    RETURN v_total >= v_rule.threshold;
  END IF;

  CASE p_badge_key

    -- Bienvenue : porté par tout profil existant.
    WHEN 'level_scaled' THEN
      RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = p_athlete_id);

    -- Paliers de classement : ELO réel du profil.
    WHEN 'level_inter', 'level_rx', 'level_rx_plus', 'level_elite', 'level_pro' THEN
      SELECT elo INTO v_elo FROM public.profiles WHERE id = p_athlete_id;
      IF v_elo IS NULL THEN RETURN false; END IF;
      RETURN v_elo >= CASE p_badge_key
        WHEN 'level_inter'    THEN 1001
        WHEN 'level_rx'       THEN 1200
        WHEN 'level_rx_plus'  THEN 1400
        WHEN 'level_elite'    THEN 1600
        WHEN 'level_pro'      THEN 1800
      END;

    -- Premier score : une ligne de score existe réellement.
    WHEN 'first_score' THEN
      RETURN EXISTS (SELECT 1 FROM public.tournament_scores      WHERE athlete_id = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.daily_tournament_scores WHERE user_id    = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.wod_scores              WHERE member_id  = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.generated_wod_scores    WHERE user_id    = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.inter_scores            WHERE athlete_id = p_athlete_id)
          OR EXISTS (SELECT 1 FROM public.scores                  WHERE athlete_id = p_athlete_id);

    -- Palmarès : rang final distribué par l'organisateur à la clôture.
    WHEN 'first_win' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.tournament_elo_history
         WHERE athlete_id = p_athlete_id AND final_rank = 1
      );

    WHEN 'champion_5' THEN
      SELECT count(*) INTO v_count
        FROM public.tournament_elo_history
       WHERE athlete_id = p_athlete_id AND final_rank = 1;
      RETURN v_count >= 5;

    WHEN 'podium' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.tournament_elo_history
         WHERE athlete_id = p_athlete_id AND final_rank BETWEEN 1 AND 3
      );

    WHEN 'veteran_10' THEN
      SELECT count(DISTINCT tournament_id) INTO v_count
        FROM public.tournament_participants
       WHERE athlete_id = p_athlete_id;
      RETURN v_count >= 10;

    -- Social : amitiés réellement acceptées, dans les deux sens.
    WHEN 'social_5' THEN
      SELECT count(*) INTO v_count
        FROM public.friendships
       WHERE status = 'accepted'
         AND (requester_id = p_athlete_id OR addressee_id = p_athlete_id);
      RETURN v_count >= 5;

    -- Messages réellement envoyés (chat de groupe + messagerie directe).
    WHEN 'chatty_50' THEN
      SELECT (SELECT count(*) FROM public.group_messages WHERE sender_id = p_athlete_id)
           + (SELECT count(*) FROM public.messages       WHERE sender_id = p_athlete_id)
        INTO v_count;
      RETURN v_count >= 50;

    ELSE
      -- Badge sans source serveur fiable : jamais réclamable.
      RETURN false;
  END CASE;
END;
$function$;

COMMENT ON FUNCTION public.badge_condition_met(uuid, text) IS
  'Condition serveur d''un badge. Les badges mv_* lisent leur règle dans badge_rules et leur cumul dans user_movement_stats ; les autres branches sont inchangées. Appelée seulement par claim_badge.';

-- La fonction reste hors de portée des rôles clients : `claim_badge` est la
-- seule porte d'entrée, et elle seule décide pour `auth.uid()`.
REVOKE ALL ON FUNCTION public.badge_condition_met(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
