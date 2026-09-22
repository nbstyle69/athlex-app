-- ═════════════════════════════════════════════════════════════════════════════
-- Plafond par appel d'`increment_movement_stats` — lot badges 4b, PR 1
--
-- Appliquée en prod : non
--
-- Depuis la 4a, les badges `mv_*` se décident sur `user_movement_stats`. Or
-- cette table est alimentée par `increment_movement_stats`, que l'athlète
-- appelle lui-même, sans aucune borne : un seul appel à un million de reps
-- débloquait n'importe quel badge de mouvement. La garde existante force la
-- cible à `auth.uid()` — elle empêche de créditer autrui, pas de se créditer
-- soi-même.
--
-- ── Les valeurs ──────────────────────────────────────────────────────────────
--
--   reps : 2 000   ·   m : 50 000   ·   cal : 1 500      (arbitrage de Nab, 22/09/2026)
--
-- Calibrées sur ce que la 1.0.56 envoie réellement en usage normal, mesuré en
-- faisant tourner `computeCompletedMovements` — la fonction du client — sur
-- des WOD de coach classiques (un appel par ligne) :
--
--   Murph                        pull_up 100 · push_up 200 · air_squat 300 · run 1 600 m
--   Cindy, 25 tours              pull_up 125 · push_up 250 · air_squat 375
--   5 Rounds For Time : 100 DU   double_under 500 · toes_to_bar 100
--   Marathon au rameur           row 42 195 m
--   AMRAP 20 : 20 cal Row…       row 400 cal · burpee 200
--
-- Ces mesures ne sont pas figées ici : elles vivent dans
-- `supabase/seed/movement_credit_caps_cases.json`, qu'un test jest recalcule par
-- le vrai code du client et que `supabase/tests/movement_credit_caps.sql` rejoue
-- contre ces plafonds. Si le calcul du client change, les deux le verront.
--
-- ── Pourquoi `wod_volume_caps` n'est pas la bonne base ──────────────────────
--
-- `wod_volume_caps` est un plafond PAR WOD DU GÉNÉRATEUR, sur vingt familles de
-- mouvements (tractions 75, corde à sauter 200, T2B 60…). Mais ce chemin-ci ne
-- crédite pas que des WOD générés : le Whiteboard, le détail d'un WOD et le WOD
-- du jour créditent du TEXTE LIBRE écrit par un coach, et en AMRAP la quantité
-- est multipliée par le score que l'athlète saisit. Un plafond tiré de
-- `wod_volume_caps` refuserait Murph (100 tractions contre 75).
--
-- Et un refus est silencieux dans la 1.0.56 : `logMovementReps` ignore le
-- `{ error }` que renvoie la RPC, après avoir déjà écrit `movement_logs`. Un
-- plafond trop bas ferait donc perdre des crédits légitimes sans que personne
-- ne le voie — d'où des valeurs posées au-dessus des maxima normaux mesurés.
--
-- ── La limite assumée ────────────────────────────────────────────────────────
--
-- Un plafond PAR APPEL ne borne pas le TOTAL : dix appels à 2 000 reps restent
-- possibles, et `logMovementReps` fait un appel par ligne. Ce lot écarte
-- l'appel absurde, pas l'accumulation. La fenêtre glissante de 24 h par
-- athlète, mouvement et unité arrive avec la PR 2, sur le registre
-- `movement_credit_ledger` — le serveur ne peut pas se fier à `movement_logs`,
-- que l'athlète écrit en direct.
--
-- ── Les quantités qui ne sont pas des crédits (relecture de Nab, 22/09/2026) ──
--
--   NULL ou 0     → retour immédiat, sans erreur ni écriture ;
--   négative      → refus en 22003 : elle décrémentait le cumul, et aurait
--                   permis de contourner la fenêtre de 24 h de la PR 2 ;
--   charge < 0    → refus en 22003 (aucun plafond de charge dans ce lot).
--
-- Mesuré sur base de rejeu avant ce lot : un crédit de -30 faisait passer un
-- cumul de 50 à 20. Un `NULL`, lui, ne corrompait pas la ligne — `total_reps`
-- est NOT NULL, l'appel échouait en 23502 — mais c'était une erreur brute pour
-- un appel qui n'avait simplement rien à créditer.
--
-- ── Structure ────────────────────────────────────────────────────────────────
--
-- Une table plutôt que des constantes dans le corps : la PR 2 lira les mêmes
-- valeurs pour sa fenêtre (trois fois le plafond par appel), et une exception
-- par mouvement pourra s'ajouter par une ligne, sans réécrire la fonction.
-- `movement` nul = la valeur de l'unité ; aucune exception n'est posée ici.
--
-- Le plafond s'applique à TOUT appelant, `service_role` compris : aucun chemin
-- serveur n'appelle cette RPC aujourd'hui, et le crédit des scores de tournoi
-- (PR 2) écrira par sa propre fonction, pas par celle-ci.
--
-- Rejouable : `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT`, `CREATE OR REPLACE`.
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Les plafonds ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.movement_credit_caps (
  unit     text   NOT NULL CHECK (unit IN ('reps', 'm', 'cal')),
  -- Nul : valeur de l'unité, pour tous les mouvements. Renseigné : exception
  -- nominative pour ce mouvement (aucune aujourd'hui).
  movement text,
  per_call bigint NOT NULL CHECK (per_call > 0)
);

-- Une seule valeur par (unité, mouvement), la valeur d'unité comprise : une
-- clé primaire n'accepterait pas le nul qui la désigne.
CREATE UNIQUE INDEX IF NOT EXISTS movement_credit_caps_unite_mouvement
  ON public.movement_credit_caps (unit, COALESCE(movement, ''));

COMMENT ON TABLE public.movement_credit_caps IS
  'Plafond par appel d''increment_movement_stats, par unité (movement nul) avec exceptions par mouvement possibles. Lue seulement par la fonction ; aucun accès client.';

INSERT INTO public.movement_credit_caps (unit, movement, per_call) VALUES
  ('reps', NULL,  2000),
  ('m',    NULL, 50000),
  ('cal',  NULL,  1500)
ON CONFLICT (unit, COALESCE(movement, '')) DO UPDATE SET per_call = EXCLUDED.per_call;

-- Personne côté client n'a à lire ni écrire ces valeurs : seule la fonction,
-- SECURITY DEFINER, les consulte. Les privilèges par défaut donnent ALL à
-- anon/authenticated sur toute table neuve de `public` — d'où le REVOKE.
ALTER TABLE public.movement_credit_caps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.movement_credit_caps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.movement_credit_caps TO service_role;

-- ── 2. La fonction, avec son plafond ────────────────────────────────────────
-- Corps repris de `20261204_movement_stats_unit.sql` ; seul le contrôle du
-- plafond est ajouté, après la validation de l'unité. La signature à quatre
-- arguments délègue à celle-ci : elle hérite du plafond sans être touchée.

CREATE OR REPLACE FUNCTION public.increment_movement_stats(
  p_user_id  uuid,
  p_movement text,
  p_reps     integer,
  p_weight   numeric,
  p_unit     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_target uuid;
  v_unit   text := COALESCE(p_unit, 'reps');
  v_cap    bigint;
BEGIN
  v_target := CASE WHEN auth.role() = 'service_role'
                     THEN COALESCE(p_user_id, auth.uid())
                   ELSE auth.uid() END;
  IF v_target IS NULL THEN RETURN; END IF;
  IF v_unit NOT IN ('reps', 'm', 'cal') THEN
    RAISE EXCEPTION 'increment_movement_stats: unité inconnue %', v_unit;
  END IF;

  -- Rien à créditer : on sort sans rien écrire. Un `NULL` échappait à la
  -- comparaison au plafond et faisait échouer l'`ON CONFLICT` en 23502
  -- (`total_reps` est NOT NULL) ; un zéro créait une ligne vide ou ne touchait
  -- que `updated_at`. Le Whiteboard envoie réellement 0 : en AMRAP et en Max
  -- Reps, il passe un score nul au découpage.
  IF p_reps IS NULL OR p_reps = 0 THEN
    RETURN;
  END IF;

  -- Un crédit négatif décrémentait le cumul. Avec la fenêtre de 24 h de la
  -- PR 2, il permettrait de la contourner — des débits compensant des
  -- crédits. La 1.0.56 n'en envoie jamais en usage normal (scores refusés à
  -- zéro ou en dessous, quantités lues par des motifs sans signe).
  IF p_reps < 0 THEN
    RAISE EXCEPTION 'increment_movement_stats : quantité négative refusée — % % de %',
      p_reps, v_unit, p_movement
      USING ERRCODE = '22003';
  END IF;

  -- Charge négative : même refus. Pas de plafond de charge dans ce lot —
  -- `best_weight` n'alimente aujourd'hui ni badge ni classement.
  IF p_weight < 0 THEN
    RAISE EXCEPTION 'increment_movement_stats : charge négative refusée — % kg sur %',
      p_weight, p_movement
      USING ERRCODE = '22003';
  END IF;

  -- L'exception nominative du mouvement l'emporte sur la valeur de l'unité.
  SELECT per_call INTO v_cap
    FROM public.movement_credit_caps
   WHERE unit = v_unit AND (movement = p_movement OR movement IS NULL)
   ORDER BY movement IS NULL
   LIMIT 1;

  -- Aucun plafond configuré pour l'unité : on refuse plutôt que de laisser
  -- passer sans borne. Une ligne supprimée par erreur ne doit pas rouvrir la
  -- porte que ce lot ferme.
  IF v_cap IS NULL THEN
    RAISE EXCEPTION 'increment_movement_stats : aucun plafond configuré pour l''unité % — crédit refusé', v_unit
      USING ERRCODE = '22003';
  END IF;

  IF p_reps > v_cap THEN
    RAISE EXCEPTION 'increment_movement_stats : % % de % dépassent le plafond par appel (% %)',
      p_reps, v_unit, p_movement, v_cap, v_unit
      USING ERRCODE = '22003',
            HINT = 'Un seul appel ne peut pas créditer plus que ce plafond ; il vaut pour chaque ligne d''un WOD.';
  END IF;

  INSERT INTO public.user_movement_stats (user_id, movement, unit, total_reps, best_weight, updated_at)
  VALUES (v_target, p_movement, v_unit, p_reps, p_weight, now())
  ON CONFLICT (user_id, movement, unit) DO UPDATE SET
    total_reps  = user_movement_stats.total_reps + p_reps,
    best_weight = GREATEST(user_movement_stats.best_weight, p_weight),
    updated_at  = now();
END;
$$;

-- Droits inchangés : un CREATE OR REPLACE les conserve, on les réaffirme pour
-- qu'une base rejouée depuis ce fichier seul soit juste.
REVOKE ALL ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_movement_stats(uuid, text, integer, numeric, text) TO service_role;

COMMIT;
