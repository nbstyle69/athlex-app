-- ═════════════════════════════════════════════════════════════════════════════
-- Box vitrine (#523) — « comptes réels protégés » de la box `vitrine.box`, posés
-- dans le réglage de session `vitrine.proteges` (uuid[]). Inclus par \ir depuis
-- 10-contact-elo.sql et 20-empreinte-elo.sql, et lu par vitrine.ts : une seule
-- définition. Lecture seule.
-- Protégés = gérant de la box + tous ses membres et son staff (tout statut),
--            hors internal.demo_accounts (reviewer, comptes de démo historiques,
--            et comptes vitrine une fois activés) et hors comptes vitrine.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT set_config('vitrine.proteges', coalesce((
  SELECT array_agg(id ORDER BY id)::text FROM (
    SELECT bm.member_id AS id FROM public.box_members bm WHERE bm.box_id = current_setting('vitrine.box')::uuid
    UNION
    SELECT b.owner_id FROM public.boxes b WHERE b.id = current_setting('vitrine.box')::uuid AND b.owner_id IS NOT NULL
    EXCEPT
    SELECT d.user_id FROM internal.demo_accounts d
    EXCEPT
    SELECT u.id FROM auth.users u
     WHERE lower(u.email) ~ '^demo\.vitrine\+((0[1-9]|[1-4][0-9]|50)|coach)@athlexapp\.eu$') p), '{}'), false) AS proteges \gset vitrine_
