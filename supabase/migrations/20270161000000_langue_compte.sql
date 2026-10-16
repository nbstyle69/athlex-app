-- ═════════════════════════════════════════════════════════════════════════════
-- Langue du compte enregistrée pour le serveur (#531, PR S1)
--
-- Appliquée en prod : non.
-- À jouer en UNE transaction (pas de BEGIN/COMMIT dans ce fichier) :
--   PGCLIENTENCODING=UTF8 psql "$PROD_DB_URL" -X -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- Pourquoi : 186 comptes sur 201 n'ont aucun jeton push, et 12 jetons sur 19
-- n'ont pas de langue (prod, 16/10/2026). Les e-mails et les push au membre ne
-- peuvent pas compter sur push_tokens.language seul.
--
-- 1. notification_preferences.language (fr | en, NULL = jamais écrite), écrite
--    par l'app à chaque choix de langue et au démarrage. RLS inchangée
--    (« Users manage own notification prefs », auth.uid() = user_id) : chacun
--    ne lit et n'écrit que sa ligne. Ni policy ni table nouvelle.
-- 2. public.langues_destinataires(uuid[]) : règle unique, partagée par les
--    fonctions Edge et le Manager —
--      préférence → langue du jeton le plus récent qui en a une → 'fr'.
--    SECURITY INVOKER : appelée par service_role (BYPASSRLS), seul à pouvoir
--    l'exécuter (contrôle T20 de l'audit des droits).
-- 3. Retour arrière : supabase/retours/20270161000000_langue_compte.sql.
-- Contrôlée par supabase/tests/langue_compte.sql.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notification_preferences
  ADD COLUMN language text,
  ADD CONSTRAINT notification_preferences_language_check CHECK (language IN ('fr', 'en'));
COMMENT ON COLUMN public.notification_preferences.language IS
  'Langue choisie dans l''app (fr | en), écrite par l''app ; NULL = jamais écrite. Lue par le serveur pour les push et e-mails.';

-- Langue de chaque destinataire, règle unique (préférence → jeton le plus récent → fr).
CREATE FUNCTION public.langues_destinataires(p_users uuid[])
RETURNS TABLE (user_id uuid, language text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT u.id,
         coalesce(np.language,
                  (SELECT t.language FROM public.push_tokens t
                    WHERE t.user_id = u.id AND t.language IS NOT NULL
                    ORDER BY coalesce(t.updated_at, t.created_at) DESC LIMIT 1),
                  'fr')
  FROM unnest(p_users) AS u(id)
  LEFT JOIN public.notification_preferences np ON np.user_id = u.id;
$$;
REVOKE ALL ON FUNCTION public.langues_destinataires(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.langues_destinataires(uuid[]) TO service_role;
