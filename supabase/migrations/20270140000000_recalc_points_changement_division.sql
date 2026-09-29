-- ═════════════════════════════════════════════════════════════════════════════
-- Les points de division sont recalculés quand la division d'un score change
--
-- Appliquée en prod : OUI, le 29/09/2026 à 15:41:48 UTC, avec PGCLIENTENCODING=UTF8,
-- en une transaction, sur GO de Nab. Dump des schémas public et internal avec
-- droits db-dumps/2026-09-29/athlex-prod-public-internal-20260929T154044Z.dump,
-- sha256 8fba31115be3b3cffce67c3b5102ec5bc95385a02fb630095df760f3d0552b0e vérifié
-- après aller-retour, 135 TABLE DATA, 449 ACL, 346 POLICY ; précontrôles (trois
-- passages identiques, search_path de la prod) : déclencheur au md5 10e94e68…
-- (UPDATE OF status, score_value), fonctions fbeaa152… et 6dedca85… et leurs
-- droits, déclencheurs de tournament_scores e3629460… (4), aucune ligue à
-- divisions ; vérifications : déclencheur au md5 du rejeu e306d2d9… (O, tgtype
-- 29, UPDATE OF status, score_value, division_id), ensemble des déclencheurs
-- 46d18dd4… comme au rejeu, fonctions et droits inchangés, tournament_scores et
-- tournament_division_members identiques avant et après ; test réel en
-- transaction annulée (R2 à R4, sans la mutation R1), sans trace ; audit des
-- droits en prod 37/37.
--
-- Le Manager (#413) permet au staff de corriger `tournament_scores.division_id`
-- (division figée du score de ligue, 20270108). Le déclencheur
-- `trg_recalc_division_points_on_scores` ne réagissait qu'à `status` et
-- `score_value` : une division corrigée ne recalculait rien jusqu'au score
-- suivant.
--
-- Relevé du 29/09/2026 en prod (lecture seule) :
--   AFTER INSERT OR DELETE OR UPDATE OF status, score_value, FOR EACH ROW,
--   tgtype 29, activé (O), définition au md5 10e94e687cb0ffd94867defc6150efb8 ;
--   fonction public.trg_recalc_division_points() au md5
--   fbeaa15291d0febbd2b925aad8f2ada7 (sans CR), qui appelle
--   internal.recalc_division_points (md5 6dedca85b4d98d124b25cc265a1234dc) ;
--   aucune ligue à divisions ni score de ligue.
--
-- Seul changement : `division_id` rejoint les colonnes surveillées. La fonction
-- ne change pas : elle recalcule le tournoi ENTIER, donc l'ancienne et la
-- nouvelle division du score, avec la même logique que pour un changement de
-- statut ou de score. `recalc_division_points` n'est pas ouverte aux gérants.
--
-- Contrôlée par `supabase/tests/recalc_points_changement_division.sql`.
--
-- Retour arrière (transactionnel ; vérifié sur le rejeu — la définition revient
-- au md5 de prod 10e94e687cb0ffd94867defc6150efb8) :
--
--   BEGIN;
--   DROP TRIGGER trg_recalc_division_points_on_scores ON public.tournament_scores;
--   CREATE TRIGGER trg_recalc_division_points_on_scores
--     AFTER INSERT OR DELETE OR UPDATE OF status, score_value ON public.tournament_scores
--     FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_division_points();
--   COMMIT;
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER trg_recalc_division_points_on_scores ON public.tournament_scores;
CREATE TRIGGER trg_recalc_division_points_on_scores
  AFTER INSERT OR DELETE OR UPDATE OF status, score_value, division_id ON public.tournament_scores
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_division_points();

COMMIT;
