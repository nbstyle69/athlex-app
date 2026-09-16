-- movement_totals : refermer la vue recréée par 20261204.
--
-- 20261118 (lot 5e) avait retiré le SELECT de `anon` sur cette vue : sans
-- `security_invoker`, elle sert le volume de répétitions de TOUS les athlètes
-- avec les droits de son propriétaire, RLS de `movement_logs` jamais évaluée.
-- 20261204 l'a recréée (DROP + CREATE, un total par unité) avec les grants par
-- défaut du fichier : `GRANT ALL … TO anon / authenticated`. Constaté par
-- scripts/test-grants.mjs (T1, T2, T8) et par l'audit de prod en lecture seule.
--
-- Rejouable : ALTER VIEW SET est idempotent, REVOKE sans objet est sans effet.

ALTER VIEW public.movement_totals SET (security_invoker = true);

REVOKE ALL ON TABLE public.movement_totals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.movement_totals FROM authenticated;
GRANT SELECT ON TABLE public.movement_totals TO authenticated;

COMMENT ON VIEW public.movement_totals IS
  'Total de répétitions par athlète, mouvement et unité. security_invoker : chaque lecteur ne voit que ses lignes de movement_logs (RLS movement_logs_own_read).';
