-- ═════════════════════════════════════════════════════════════════════════════
-- Marketplace ↔ Whiteboard — une box abonnée reçoit bien ses WOD.
--
-- Constat de la recon (10/09/2026) : l'abonnement NBS2 → « ATHX BLOC 2 » est
-- actif, le cron tourne, et rien n'apparaît — parce que l'offre publiée est
-- VIDE (le contenu de RAW vit dans une semaine type privée), que rien
-- n'interdit de publier une offre vide, et que le cron ne pose jamais la
-- semaine 1 (ancrage = lundi de l'abonnement, cible = lundi suivant).
--
-- Ce lot, en une migration additive et rejouable :
--
--   1. `box_wods.audience` (all | groups | none) — la visibilité devient une
--      colonne explicite, lue par `wod_access_allowed`, au lieu d'être déduite
--      de l'absence de `wod_group_access`. Le DÉFAUT de colonne reste 'all' :
--      le back-office mobile insère aujourd'hui sans `audience`, un défaut
--      'none' rendrait ses WOD invisibles et imposerait un build store. Les
--      écrivains qui connaissent la colonne (Manager, RPC, cron) la posent
--      toujours explicitement ; deux triggers gardent le legacy cohérent
--      (`wod_group_access` posé → 'groups' ; dernier groupe retiré → 'all').
--   2. Ancrage : à l'abonnement `week_anchor` = lundi SUIVANT (la première pose
--      auto est la semaine 1) ; une application manuelle de la semaine N sur le
--      lundi M réaligne `week_anchor = M − 7·(N−1)`.
--   3. Un seul cron effectif (garde « 18h Paris » quand aucun lundi n'est passé),
--      et un journal `box_programming_runs` par abonnement traité.
--   4. Cartes reçues d'une offre : contenu verrouillé par trigger, suppression et
--      déplacement libres.
--   5. Une offre se remplit depuis le Whiteboard (`sync_wod_to_offer`,
--      `copy_week_to_offer`, propagation par trigger) et ne se publie plus vide
--      (`publish_programming`).
-- ═════════════════════════════════════════════════════════════════════════════

-- ═══ 1. Schéma ════════════════════════════════════════════════════════════════

-- ─── 1.a Visibilité explicite + backfill (une seule fois : quand la colonne
--         vient d'être créée ; un rejeu ne retouche pas un choix déjà posé).
DO $$
DECLARE
  v_nouvelle boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'box_wods' AND column_name = 'audience'
  ) INTO v_nouvelle;

  IF v_nouvelle THEN
    ALTER TABLE public.box_wods
      ADD COLUMN audience text NOT NULL DEFAULT 'all'
      CONSTRAINT box_wods_audience_check CHECK (audience IN ('all', 'groups', 'none'));

    -- L'existant reste visible EXACTEMENT comme avant :
    --   des groupes            → 'groups' (membres des groupes) ;
    --   un programme seulement → 'none'  (les inscrits passent par la branche
    --                                     programme, la box ne voit rien) ;
    --   séance relative        → 'none'  (jamais sur le Whiteboard de la box) ;
    --   rien                   → 'all'.
    UPDATE public.box_wods w
       SET audience = CASE
         WHEN EXISTS (SELECT 1 FROM public.wod_group_access g WHERE g.wod_id = w.id) THEN 'groups'
         WHEN w.scheduled_date IS NULL THEN 'none'
         WHEN EXISTS (SELECT 1 FROM public.wod_program_access a WHERE a.wod_id = w.id) THEN 'none'
         ELSE 'all'
       END;
  END IF;
END $$;

COMMENT ON COLUMN public.box_wods.audience IS
  'Qui voit ce WOD dans la box : all = toute la box, groups = membres des groupes de wod_group_access, none = personne (les programmes athlètes restent un canal séparé, cf. wod_access_allowed).';

CREATE INDEX IF NOT EXISTS idx_box_wods_audience
  ON public.box_wods (box_id, scheduled_date)
  WHERE audience <> 'all';

-- ─── 1.b Abonnement : couleur + visibilité par défaut pour la pose auto
ALTER TABLE public.box_programming_subscriptions
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'sky',
  ADD COLUMN IF NOT EXISTS default_audience text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS default_group_ids uuid[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'box_prog_subs_color_check') THEN
    ALTER TABLE public.box_programming_subscriptions
      ADD CONSTRAINT box_prog_subs_color_check
      CHECK (color IN ('sky', 'violet', 'amber', 'rose', 'teal', 'orange', 'lime', 'fuchsia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'box_prog_subs_default_audience_check') THEN
    ALTER TABLE public.box_programming_subscriptions
      ADD CONSTRAINT box_prog_subs_default_audience_check
      CHECK (default_audience IN ('all', 'groups', 'none'));
  END IF;
END $$;

-- T1 : tout écrivain qui omet l'ancrage (webhook Stripe du Manager tant qu'il
-- n'est pas redéployé) obtient le lundi SUIVANT, pas le lundi courant.
ALTER TABLE public.box_programming_subscriptions
  ALTER COLUMN week_anchor
  SET DEFAULT (date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7);

COMMENT ON COLUMN public.box_programming_subscriptions.color IS
  'Couleur choisie par le gérant abonné (clé de palette, rendu côté Manager) : contour des cartes reçues.';
COMMENT ON COLUMN public.box_programming_subscriptions.default_audience IS
  'Visibilité posée par le cron sur les cartes reçues ; reprise de la dernière application manuelle.';
COMMENT ON COLUMN public.box_programming_subscriptions.default_group_ids IS
  'Groupes posés par le cron quand default_audience = groups ; reprise de la dernière application manuelle.';

-- ─── 1.c Offres : détails exigés à la publication
ALTER TABLE public.box_programming
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS equipment text;

-- ─── 1.d Contenu d'offre alimenté depuis le Whiteboard
ALTER TABLE public.box_programming_wods
  ADD COLUMN IF NOT EXISTS origin_box_wod_id uuid REFERENCES public.box_wods(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_programming_wods_origin
  ON public.box_programming_wods (programming_id, origin_box_wod_id)
  WHERE origin_box_wod_id IS NOT NULL;

COMMENT ON COLUMN public.box_programming_wods.origin_box_wod_id IS
  'WOD maison dont cette ligne est la copie synchronisée (trigger box_wods_propagate_to_offer). NULL = contenu saisi ou copié sans lien.';

-- ─── 1.e Journal du cron
CREATE TABLE IF NOT EXISTS public.box_programming_runs (
  id              bigserial PRIMARY KEY,
  ran_at          timestamptz NOT NULL DEFAULT now(),
  target_monday   date NOT NULL,
  subscription_id uuid,
  box_id          uuid,
  programming_id  uuid,
  week_number     smallint,
  inserted        integer NOT NULL DEFAULT 0,
  skipped         integer NOT NULL DEFAULT 0,
  note            text
);

COMMENT ON TABLE public.box_programming_runs IS
  'Journal de materialize_box_programming : une ligne par abonnement traité (inserted / skipped / empty_week), plus une ligne de synthèse par run (subscription_id NULL, note = run).';

CREATE INDEX IF NOT EXISTS idx_box_programming_runs_box
  ON public.box_programming_runs (box_id, ran_at DESC);

ALTER TABLE public.box_programming_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS box_programming_runs_select ON public.box_programming_runs;
CREATE POLICY box_programming_runs_select ON public.box_programming_runs
  FOR SELECT TO authenticated
  USING (box_id IS NOT NULL AND public.manages_box(box_id));

-- Écriture : service_role et les fonctions SECURITY DEFINER seulement.
REVOKE ALL ON TABLE public.box_programming_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.box_programming_runs TO authenticated;
GRANT ALL ON TABLE public.box_programming_runs TO service_role;
REVOKE ALL ON SEQUENCE public.box_programming_runs_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.box_programming_runs_id_seq TO service_role;

-- ═══ 2. Données prod (idempotent) ════════════════════════════════════════════
-- Unique abonnement en prod (NBS2 → ATHX BLOC 2), ancré au lundi de
-- l'abonnement (07/09) : passé au lundi suivant pour que la première pose auto
-- soit la semaine 1 (T1). Ne touche que cet ancrage-là ; sur base vierge : 0 ligne.
UPDATE public.box_programming_subscriptions
   SET week_anchor = DATE '2026-09-14'
 WHERE id = 'e6b6c408-bffc-4c61-b1ea-9451053e0ec0'
   AND programming_id = 'e0650f06-beeb-468c-9405-dda72a62d219'
   AND week_anchor = DATE '2026-09-07';

-- ═══ 3. Cohérence legacy de `audience` (écrivains qui ignorent la colonne) ════
-- Le mobile (et le Manager jusqu'à son redéploiement) posent des lignes
-- d'accès sans toucher `audience`. Ces triggers reproduisent l'ancienne
-- sémantique : des groupes → 'groups' ; un programme → 'none' ; plus aucun
-- groupe → 'all'. Un écrivain qui POSE `audience` explicitement doit le faire
-- APRÈS ses lignes d'accès : c'est sa valeur qui reste.
CREATE OR REPLACE FUNCTION public.box_wods_audience_from_group_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.box_wods
       SET audience = 'groups'
     WHERE id = NEW.wod_id AND audience = 'all';
    RETURN NEW;
  END IF;

  -- Dernier groupe retiré d'un WOD 'groups' : sans ce retour, le WOD resterait
  -- « visible par ces groupes » avec zéro groupe — invisible sans que rien ne
  -- l'affiche. (Suppression du WOD lui-même : 0 ligne touchée, sans effet.)
  UPDATE public.box_wods w
     SET audience = 'all'
   WHERE w.id = OLD.wod_id
     AND w.audience = 'groups'
     AND NOT EXISTS (SELECT 1 FROM public.wod_group_access g WHERE g.wod_id = w.id);
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_box_wods_audience_group_insert ON public.wod_group_access;
CREATE TRIGGER trg_box_wods_audience_group_insert
  AFTER INSERT ON public.wod_group_access
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_audience_from_group_access();

DROP TRIGGER IF EXISTS trg_box_wods_audience_group_delete ON public.wod_group_access;
CREATE TRIGGER trg_box_wods_audience_group_delete
  AFTER DELETE ON public.wod_group_access
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_audience_from_group_access();

CREATE OR REPLACE FUNCTION public.box_wods_audience_from_program_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Avant ce lot, rattacher un WOD à un programme le fermait au reste de la
  -- box : un WOD encore 'all' au moment du rattachement suit la même règle.
  UPDATE public.box_wods
     SET audience = 'none'
   WHERE id = NEW.wod_id AND audience = 'all';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_box_wods_audience_program_insert ON public.wod_program_access;
CREATE TRIGGER trg_box_wods_audience_program_insert
  AFTER INSERT ON public.wod_program_access
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_audience_from_program_access();

-- Une séance de programme relative (sans date) n'est jamais un WOD de la box :
-- son audience est 'none' quoi qu'en dise l'écrivain.
CREATE OR REPLACE FUNCTION public.box_wods_audience_relative_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.scheduled_date IS NULL THEN
    NEW.audience := 'none';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_box_wods_audience_relative ON public.box_wods;
CREATE TRIGGER trg_box_wods_audience_relative
  BEFORE INSERT OR UPDATE OF scheduled_date, audience ON public.box_wods
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_audience_relative_session();

-- ═══ 4. RLS athlète : `audience` décide, la branche programme reste ══════════
-- `wod_access_allowed` garde aussi les lectures dérivées (20261115 : scores,
-- complétions, ELO, commentaires, réactions). La branche programme est
-- conservée telle quelle : un inscrit actif lit la séance et son classement
-- même si `audience = 'none'` — les programmes athlètes sont un canal séparé.
CREATE OR REPLACE FUNCTION public.wod_access_allowed(p_wod_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.box_wods w
       WHERE w.id = p_wod_id AND w.audience = 'all'
    )
    OR EXISTS (
      SELECT 1
      FROM public.box_wods w
      JOIN public.wod_group_access g ON g.wod_id = w.id
      JOIN public.message_groups mg ON mg.id = g.group_id
      WHERE w.id = p_wod_id
        AND w.audience = 'groups'
        AND auth.uid() = ANY (mg.members)
    )
    OR EXISTS (
      SELECT 1
      FROM public.wod_program_access a
      JOIN public.program_members pm ON pm.program_id = a.program_id
      WHERE a.wod_id = p_wod_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    );
$$;

-- ═══ 5. Ancrage à l'abonnement : lundi suivant ═══════════════════════════════
CREATE OR REPLACE FUNCTION public.subscribe_free_programming(
  p_programming_id uuid,
  p_subscriber_box_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog   record;
  -- Lundi SUIVANT (Paris) : la première pose automatique est la semaine 1.
  v_anchor date := date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7;
  v_id     uuid;
BEGIN
  IF NOT public.manages_box(p_subscriber_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou coach de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, publisher_box_id, is_published, COALESCE(price_cents, 0) AS price_cents,
         COALESCE(billing, 'free') AS billing
    INTO v_prog
  FROM public.box_programming
  WHERE id = p_programming_id;

  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programmation introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT v_prog.is_published THEN
    RAISE EXCEPTION 'Cette programmation n''est pas publiée' USING ERRCODE = 'check_violation';
  END IF;
  IF v_prog.publisher_box_id = p_subscriber_box_id THEN
    RAISE EXCEPTION 'Une box ne s''abonne pas à sa propre offre' USING ERRCODE = 'check_violation';
  END IF;
  IF v_prog.price_cents > 0 OR v_prog.billing <> 'free' THEN
    RAISE EXCEPTION
      'PAID_PROGRAMMING : cette offre est payante — elle passe par le paiement Stripe'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.box_programming_subscriptions
    (programming_id, subscriber_box_id, status, week_anchor, created_by)
  VALUES (p_programming_id, p_subscriber_box_id, 'active', v_anchor, auth.uid())
  ON CONFLICT (programming_id, subscriber_box_id)
  DO UPDATE SET status = 'active',
                week_anchor = v_anchor,
                created_by = COALESCE(auth.uid(), public.box_programming_subscriptions.created_by)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('subscription_id', v_id, 'status', 'active', 'week_anchor', v_anchor);
END;
$function$;

REVOKE ALL ON FUNCTION public.subscribe_free_programming(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscribe_free_programming(uuid, uuid) TO authenticated, service_role;

-- ═══ 6. Appliquer une semaine : audience explicite, réalignement de l'ancrage ═
-- Ajouter un paramètre crée une seconde fonction : l'ancienne signature est
-- retirée explicitement, sinon les appels nommés tombent en « not unique ».
DROP FUNCTION IF EXISTS public.apply_program_week(text, uuid, integer, date, uuid[], boolean);

CREATE OR REPLACE FUNCTION public.apply_program_week(
  p_source_kind   text,
  p_source_id     uuid,
  p_week          integer,
  p_target_monday date,
  p_audience      text,
  p_group_ids     uuid[] DEFAULT NULL,
  p_replace       boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_src       record;
  v_groups_in uuid[] := COALESCE(p_group_ids, '{}'::uuid[]);
  v_dates     date[];
  v_conflicts integer := 0;
  v_deleted   integer := 0;
  v_kept      integer := 0;
  v_kept_rows jsonb   := '[]'::jsonb;
  v_inserted  integer := 0;
  v_skipped   integer := 0;
  v_groups    integer := 0;
  v_anchor    date;
  wodrow      record;
  v_wod_id    uuid;
  v_group_id  uuid;
BEGIN
  IF p_audience IS NULL OR p_audience NOT IN ('all', 'groups', 'none') THEN
    RAISE EXCEPTION 'Visibilité requise : all, groups ou none (reçu : %)', COALESCE(p_audience, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_audience = 'groups' AND cardinality(v_groups_in) = 0 THEN
    RAISE EXCEPTION 'Visibilité « ces groupes » : au moins un groupe requis'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_audience <> 'groups' THEN
    v_groups_in := '{}'::uuid[];
  END IF;

  SELECT * INTO v_src
    FROM public.resolve_program_week_source(p_source_kind, p_source_id, p_week);

  IF EXTRACT(ISODOW FROM p_target_monday)::int <> 1 THEN
    RAISE EXCEPTION 'La semaine cible doit commencer un lundi (reçu : %)', p_target_monday;
  END IF;

  -- Les groupes doivent appartenir à la box cible : sinon on ouvrirait un WOD
  -- aux membres d'une autre box.
  IF cardinality(v_groups_in) > 0 AND EXISTS (
    SELECT 1 FROM unnest(v_groups_in) g(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.message_groups mg
        WHERE mg.id = g.id AND mg.box_id = v_src.box_id
     )
  ) THEN
    RAISE EXCEPTION 'Groupe hors de la box cible'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT array_agg(DISTINCT p_target_monday + (pw.day_of_week - 1))
    INTO v_dates
    FROM public.box_programming_wods pw
   WHERE pw.programming_id = v_src.programming_id
     AND pw.week_number = p_week;

  IF v_dates IS NULL THEN
    RAISE EXCEPTION 'La semaine % de cette source ne contient aucun WOD', p_week;
  END IF;

  SELECT count(*) INTO v_conflicts
    FROM public.box_wods w
   WHERE w.box_id = v_src.box_id
     AND w.scheduled_date = ANY (v_dates);

  IF v_conflicts > 0 AND NOT p_replace THEN
    RAISE EXCEPTION 'Ces jours portent déjà % WOD', v_conflicts
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_conflicts > 0 THEN
    SELECT count(*),
           COALESCE(jsonb_agg(jsonb_build_object(
             'date', w.scheduled_date, 'title', w.title
           ) ORDER BY w.scheduled_date), '[]'::jsonb)
      INTO v_kept, v_kept_rows
      FROM public.box_wods w
     WHERE w.box_id = v_src.box_id
       AND w.scheduled_date = ANY (v_dates)
       AND (EXISTS (SELECT 1 FROM public.wod_scores s WHERE s.wod_id = w.id)
            OR EXISTS (SELECT 1 FROM public.wod_completions c WHERE c.wod_id = w.id));

    WITH removed AS (
      DELETE FROM public.box_wods w
       WHERE w.box_id = v_src.box_id
         AND w.scheduled_date = ANY (v_dates)
         AND NOT EXISTS (SELECT 1 FROM public.wod_scores s WHERE s.wod_id = w.id)
         AND NOT EXISTS (SELECT 1 FROM public.wod_completions c WHERE c.wod_id = w.id)
      RETURNING 1
    )
    SELECT count(*) INTO v_deleted FROM removed;
  END IF;

  FOR wodrow IN
    SELECT * FROM public.box_programming_wods
     WHERE programming_id = v_src.programming_id
       AND week_number = p_week
     ORDER BY day_of_week, sort_order
  LOOP
    INSERT INTO public.box_wods (
      box_id, created_by, title, description, wod_type,
      scheduled_date, time_cap_seconds, rounds, is_published,
      publish_at, sort_order, source_programming_id, source_programming_wod_id,
      notes, block_name, video_url, leaderboard_enabled,
      emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
      audience
    )
    VALUES (
      v_src.box_id, COALESCE(v_src.created_by, auth.uid()), wodrow.title,
      wodrow.description, wodrow.wod_type,
      p_target_monday + (wodrow.day_of_week - 1),
      wodrow.time_cap_seconds, wodrow.rounds, true,
      now(), wodrow.sort_order, v_src.programming_id, wodrow.id,
      wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
      wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds,
      p_audience
    )
    ON CONFLICT (box_id, scheduled_date, source_programming_wod_id)
      WHERE source_programming_wod_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_wod_id;

    IF v_wod_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_inserted := v_inserted + 1;

    FOREACH v_group_id IN ARRAY v_groups_in LOOP
      INSERT INTO public.wod_group_access (wod_id, group_id)
      VALUES (v_wod_id, v_group_id)
      ON CONFLICT (wod_id, group_id) DO NOTHING;
      v_groups := v_groups + 1;
    END LOOP;
  END LOOP;

  -- Marketplace : la pose manuelle de la semaine N sur M réaligne l'ancrage
  -- (M − 7·(N−1)) pour que l'auto enchaîne sur N+1, et mémorise la visibilité
  -- choisie pour les poses automatiques suivantes.
  IF p_source_kind = 'subscription' THEN
    v_anchor := p_target_monday - 7 * (p_week - 1);
    UPDATE public.box_programming_subscriptions
       SET week_anchor = v_anchor,
           default_audience = p_audience,
           default_group_ids = v_groups_in
     WHERE id = p_source_id;
  END IF;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'replaced', v_deleted,
    'kept_with_results', v_kept,
    'kept_details', v_kept_rows,
    'skipped', v_skipped,
    'group_links', v_groups,
    'audience', p_audience,
    'week_anchor', v_anchor,
    'box_id', v_src.box_id,
    'week', p_week,
    'target_monday', p_target_monday
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_program_week(text, uuid, integer, date, text, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_program_week(text, uuid, integer, date, text, uuid[], boolean) TO authenticated, service_role;

-- ═══ 7. Le cron : un seul job effectif, visibilité de l'abonnement, journal ═══
CREATE OR REPLACE FUNCTION public.materialize_box_programming(p_target_monday date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_monday     date;
  v_reveal     timestamptz;
  v_total      integer := 0;
  v_subs       integer := 0;
  v_inserted   integer;
  v_skipped    integer;
  v_has_source boolean;
  v_groups     uuid[];
  v_audience   text;
  v_wod_id     uuid;
  v_group_id   uuid;
  sub          record;
  wodrow       record;
  v_weeknum    int;
BEGIN
  -- T2 : deux jobs pg_cron (16h et 17h UTC) couvrent CET/CEST ; seul celui qui
  -- tombe à 18h Paris agit. Un lundi explicite (tests, admin) passe la garde.
  IF p_target_monday IS NULL
     AND EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int <> 18 THEN
    RETURN 0;
  END IF;

  v_monday := COALESCE(
    p_target_monday,
    date_trunc('week', (now() AT TIME ZONE 'Europe/Paris'))::date + 7
  );
  v_reveal := ((v_monday - 1)::text || ' 18:00:00 Europe/Paris')::timestamptz;

  FOR sub IN
    SELECT s.*, p.weeks_count
    FROM public.box_programming_subscriptions s
    JOIN public.box_programming p ON p.id = s.programming_id
    WHERE s.status = 'active'
      AND s.auto_apply_weekly
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ORDER BY s.created_at
  LOOP
    v_subs := v_subs + 1;
    v_inserted := 0;
    v_skipped := 0;
    -- `%` sur un écart négatif (ancrage dans le futur) donnerait une semaine 0
    -- ou négative : on ramène dans 1..weeks_count.
    v_weeknum := (((((v_monday - sub.week_anchor) / 7) % GREATEST(sub.weeks_count, 1))
                   + GREATEST(sub.weeks_count, 1)) % GREATEST(sub.weeks_count, 1)) + 1;

    SELECT EXISTS (
      SELECT 1 FROM public.box_programming_wods
       WHERE programming_id = sub.programming_id AND week_number = v_weeknum
    ) INTO v_has_source;

    IF NOT v_has_source THEN
      INSERT INTO public.box_programming_runs
        (target_monday, subscription_id, box_id, programming_id, week_number, inserted, skipped, note)
      VALUES (v_monday, sub.id, sub.subscriber_box_id, sub.programming_id, v_weeknum, 0, 0, 'empty_week');
      CONTINUE;
    END IF;

    v_audience := sub.default_audience;
    -- Les groupes mémorisés qui existent encore dans la box abonnée ; s'il n'en
    -- reste aucun, 'groups' sans groupe n'a pas de sens → 'none'.
    SELECT COALESCE(array_agg(mg.id), '{}'::uuid[]) INTO v_groups
      FROM public.message_groups mg
     WHERE mg.id = ANY (sub.default_group_ids)
       AND mg.box_id = sub.subscriber_box_id;
    IF v_audience = 'groups' AND cardinality(v_groups) = 0 THEN
      v_audience := 'none';
    END IF;
    IF v_audience <> 'groups' THEN
      v_groups := '{}'::uuid[];
    END IF;

    FOR wodrow IN
      SELECT * FROM public.box_programming_wods
      WHERE programming_id = sub.programming_id AND week_number = v_weeknum
      ORDER BY day_of_week, sort_order
    LOOP
      INSERT INTO public.box_wods (
        box_id, created_by, title, description, wod_type,
        scheduled_date, time_cap_seconds, rounds, is_published,
        publish_at, sort_order, source_programming_id, source_programming_wod_id,
        notes, block_name, video_url, leaderboard_enabled,
        emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
        audience
      )
      VALUES (
        sub.subscriber_box_id, sub.created_by, wodrow.title, wodrow.description,
        wodrow.wod_type, v_monday + (wodrow.day_of_week - 1),
        wodrow.time_cap_seconds, wodrow.rounds, true,
        v_reveal, wodrow.sort_order, sub.programming_id, wodrow.id,
        wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
        wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds,
        v_audience
      )
      ON CONFLICT (box_id, scheduled_date, source_programming_wod_id)
        WHERE source_programming_wod_id IS NOT NULL DO NOTHING
      RETURNING id INTO v_wod_id;

      IF v_wod_id IS NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      v_inserted := v_inserted + 1;

      FOREACH v_group_id IN ARRAY v_groups LOOP
        INSERT INTO public.wod_group_access (wod_id, group_id)
        VALUES (v_wod_id, v_group_id)
        ON CONFLICT (wod_id, group_id) DO NOTHING;
      END LOOP;
    END LOOP;

    v_total := v_total + v_inserted;

    INSERT INTO public.box_programming_runs
      (target_monday, subscription_id, box_id, programming_id, week_number, inserted, skipped, note)
    VALUES (
      v_monday, sub.id, sub.subscriber_box_id, sub.programming_id, v_weeknum,
      v_inserted, v_skipped,
      CASE WHEN v_inserted > 0 THEN 'inserted' ELSE 'skipped' END
    );
  END LOOP;

  INSERT INTO public.box_programming_runs
    (target_monday, subscription_id, box_id, programming_id, week_number, inserted, skipped, note)
  VALUES (v_monday, NULL, NULL, NULL, NULL, v_total, v_subs, 'run');

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.materialize_box_programming(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_box_programming(date) TO service_role;

-- ═══ 8. Remplir une offre depuis le Whiteboard ════════════════════════════════
-- Garde commune : l'offre est une VRAIE offre (pas une semaine type) de la box
-- que l'appelant dirige (décision de vente → gérant / co-gérant).
CREATE OR REPLACE FUNCTION public.assert_offer_editor(p_programming_id uuid)
 RETURNS public.box_programming
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog public.box_programming;
BEGIN
  SELECT * INTO v_prog FROM public.box_programming WHERE id = p_programming_id;
  IF v_prog.id IS NULL OR v_prog.is_template THEN
    RAISE EXCEPTION 'Offre introuvable' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_box_owner_admin(v_prog.publisher_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou co-gérant de la box éditrice requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v_prog;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_offer_editor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_offer_editor(uuid) TO authenticated, service_role;

-- Un WOD maison → sa copie synchronisée dans l'offre, semaine N, jour déduit de
-- la date. Upsert sur (offre, WOD d'origine).
CREATE OR REPLACE FUNCTION public.sync_wod_to_offer(
  p_box_wod_id     uuid,
  p_programming_id uuid,
  p_week           integer
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog public.box_programming;
  v_wod  public.box_wods;
  v_id   uuid;
BEGIN
  v_prog := public.assert_offer_editor(p_programming_id);

  SELECT * INTO v_wod FROM public.box_wods WHERE id = p_box_wod_id;
  IF v_wod.id IS NULL OR v_wod.box_id IS DISTINCT FROM v_prog.publisher_box_id THEN
    RAISE EXCEPTION 'WOD introuvable dans la box éditrice' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_wod.scheduled_date IS NULL THEN
    RAISE EXCEPTION 'Une séance sans date ne se copie pas dans une offre (jour indéterminé)'
      USING ERRCODE = 'check_violation';
  END IF;
  -- Une carte reçue d'une autre box ne se revend pas.
  IF v_wod.source_programming_wod_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.box_programming sp
     WHERE sp.id = v_wod.source_programming_id
       AND sp.publisher_box_id IS DISTINCT FROM v_prog.publisher_box_id
  ) THEN
    RAISE EXCEPTION 'WOD reçu d''une programmation : il ne se copie pas dans une offre'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_week IS NULL OR p_week < 1 OR p_week > v_prog.weeks_count THEN
    RAISE EXCEPTION 'Semaine % hors de l''offre (1..%)', p_week, v_prog.weeks_count
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.box_programming_wods (
    programming_id, week_number, day_of_week, title, description, wod_type,
    time_cap_seconds, rounds, sort_order, notes, block_name, video_url,
    leaderboard_enabled, emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
    origin_box_wod_id
  )
  VALUES (
    p_programming_id, p_week, EXTRACT(ISODOW FROM v_wod.scheduled_date)::smallint,
    v_wod.title, v_wod.description, v_wod.wod_type,
    v_wod.time_cap_seconds, v_wod.rounds, v_wod.sort_order, v_wod.notes, v_wod.block_name,
    v_wod.video_url, v_wod.leaderboard_enabled, v_wod.emom_interval_minutes,
    v_wod.tabata_work_seconds, v_wod.tabata_rest_seconds,
    v_wod.id
  )
  ON CONFLICT (programming_id, origin_box_wod_id) WHERE origin_box_wod_id IS NOT NULL
  DO UPDATE SET
    week_number = EXCLUDED.week_number,
    day_of_week = EXCLUDED.day_of_week,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    wod_type = EXCLUDED.wod_type,
    time_cap_seconds = EXCLUDED.time_cap_seconds,
    rounds = EXCLUDED.rounds,
    sort_order = EXCLUDED.sort_order,
    notes = EXCLUDED.notes,
    block_name = EXCLUDED.block_name,
    video_url = EXCLUDED.video_url,
    leaderboard_enabled = EXCLUDED.leaderboard_enabled,
    emom_interval_minutes = EXCLUDED.emom_interval_minutes,
    tabata_work_seconds = EXCLUDED.tabata_work_seconds,
    tabata_rest_seconds = EXCLUDED.tabata_rest_seconds
  RETURNING id INTO v_id;

  UPDATE public.box_programming SET updated_at = now() WHERE id = p_programming_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_wod_to_offer(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_wod_to_offer(uuid, uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unsync_wod_from_offer(
  p_box_wod_id     uuid,
  p_programming_id uuid
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog    public.box_programming;
  v_deleted integer;
BEGIN
  v_prog := public.assert_offer_editor(p_programming_id);

  WITH removed AS (
    DELETE FROM public.box_programming_wods
     WHERE programming_id = p_programming_id
       AND origin_box_wod_id = p_box_wod_id
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM removed;

  IF v_deleted > 0 THEN
    UPDATE public.box_programming SET updated_at = now() WHERE id = p_programming_id;
  END IF;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.unsync_wod_from_offer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unsync_wod_from_offer(uuid, uuid) TO authenticated, service_role;

-- Une semaine entière → une semaine de l'offre.
--   whiteboard : les WOD datés de la box sur la semaine, hors cartes reçues
--                d'une autre box → copies synchronisées (origin_box_wod_id) ;
--   template   : les lignes d'une semaine type → copies sans lien.
CREATE OR REPLACE FUNCTION public.copy_week_to_offer(
  p_source_kind    text,
  p_box_id         uuid,
  p_source_monday  date,
  p_template_id    uuid,
  p_programming_id uuid,
  p_week           integer,
  p_replace        boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog     public.box_programming;
  v_tpl      record;
  v_copied   integer := 0;
  v_replaced integer := 0;
  v_existing integer := 0;
  wodrow     record;
BEGIN
  v_prog := public.assert_offer_editor(p_programming_id);

  IF p_week IS NULL OR p_week < 1 OR p_week > v_prog.weeks_count THEN
    RAISE EXCEPTION 'Semaine % hors de l''offre (1..%)', p_week, v_prog.weeks_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_source_kind = 'whiteboard' THEN
    IF p_box_id IS DISTINCT FROM v_prog.publisher_box_id THEN
      RAISE EXCEPTION 'La semaine copiée doit venir de la box éditrice'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_source_monday IS NULL OR EXTRACT(ISODOW FROM p_source_monday)::int <> 1 THEN
      RAISE EXCEPTION 'La semaine source doit commencer un lundi (reçu : %)', p_source_monday;
    END IF;
  ELSIF p_source_kind = 'template' THEN
    SELECT p.id, p.publisher_box_id INTO v_tpl
      FROM public.box_programming p
     WHERE p.id = p_template_id AND p.is_template;
    IF v_tpl.id IS NULL OR v_tpl.publisher_box_id IS DISTINCT FROM v_prog.publisher_box_id THEN
      RAISE EXCEPTION 'Semaine type introuvable pour cette box'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    RAISE EXCEPTION 'Source inconnue : %', p_source_kind;
  END IF;

  SELECT count(*) INTO v_existing
    FROM public.box_programming_wods
   WHERE programming_id = p_programming_id AND week_number = p_week;

  IF p_replace THEN
    WITH removed AS (
      DELETE FROM public.box_programming_wods
       WHERE programming_id = p_programming_id AND week_number = p_week
      RETURNING 1
    )
    SELECT count(*) INTO v_replaced FROM removed;
  END IF;

  IF p_source_kind = 'whiteboard' THEN
    FOR wodrow IN
      SELECT w.id
        FROM public.box_wods w
       WHERE w.box_id = p_box_id
         AND w.scheduled_date >= p_source_monday
         AND w.scheduled_date <  p_source_monday + 7
         AND NOT (
           w.source_programming_wod_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM public.box_programming sp
              WHERE sp.id = w.source_programming_id
                AND sp.publisher_box_id IS DISTINCT FROM v_prog.publisher_box_id
           )
         )
       ORDER BY w.scheduled_date, w.sort_order
    LOOP
      PERFORM public.sync_wod_to_offer(wodrow.id, p_programming_id, p_week);
      v_copied := v_copied + 1;
    END LOOP;
  ELSE
    FOR wodrow IN
      SELECT * FROM public.box_programming_wods
       WHERE programming_id = p_template_id AND week_number = 1
       ORDER BY day_of_week, sort_order
    LOOP
      INSERT INTO public.box_programming_wods (
        programming_id, week_number, day_of_week, title, description, wod_type,
        time_cap_seconds, rounds, sort_order, notes, block_name, video_url,
        leaderboard_enabled, emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds
      )
      VALUES (
        p_programming_id, p_week, wodrow.day_of_week, wodrow.title, wodrow.description,
        wodrow.wod_type, wodrow.time_cap_seconds, wodrow.rounds, wodrow.sort_order,
        wodrow.notes, wodrow.block_name, wodrow.video_url, wodrow.leaderboard_enabled,
        wodrow.emom_interval_minutes, wodrow.tabata_work_seconds, wodrow.tabata_rest_seconds
      );
      v_copied := v_copied + 1;
    END LOOP;
  END IF;

  IF v_copied = 0 THEN
    RAISE EXCEPTION 'Aucun WOD à copier depuis cette source' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.box_programming SET updated_at = now() WHERE id = p_programming_id;

  RETURN jsonb_build_object(
    'copied', v_copied,
    'replaced', v_replaced,
    'existing_before', v_existing,
    'week', p_week
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.copy_week_to_offer(text, uuid, date, uuid, uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_week_to_offer(text, uuid, date, uuid, uuid, integer, boolean) TO authenticated, service_role;

-- ═══ 9. Publier : jamais une offre vide ═══════════════════════════════════════
CREATE OR REPLACE FUNCTION public.publish_programming(p_id uuid, p_publish boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_prog        public.box_programming;
  v_manques     text[] := '{}';
  v_vides       text;
BEGIN
  v_prog := public.assert_offer_editor(p_id);

  IF p_publish THEN
    IF length(btrim(COALESCE(v_prog.description, ''))) < 80 THEN
      v_manques := array_append(v_manques, 'description trop courte (80 caractères minimum)');
    END IF;
    IF btrim(COALESCE(v_prog.goal, '')) = '' THEN
      v_manques := array_append(v_manques, 'objectif manquant');
    END IF;
    IF btrim(COALESCE(v_prog.target_audience, '')) = '' THEN
      v_manques := array_append(v_manques, 'public visé manquant');
    END IF;

    SELECT string_agg(n::text, ', ' ORDER BY n)
      INTO v_vides
      FROM generate_series(1, v_prog.weeks_count) n
     WHERE NOT EXISTS (
       SELECT 1 FROM public.box_programming_wods w
        WHERE w.programming_id = p_id AND w.week_number = n
     );
    IF v_vides IS NOT NULL THEN
      v_manques := array_prepend('Semaines vides : ' || v_vides, v_manques);
    END IF;

    IF cardinality(v_manques) > 0 THEN
      RAISE EXCEPTION '%', array_to_string(v_manques, ' ; ')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.box_programming
     SET is_published = p_publish, updated_at = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'is_published', p_publish);
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_programming(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_programming(uuid, boolean) TO authenticated, service_role;

-- ═══ 10. Listes enrichies ═════════════════════════════════════════════════════
-- Le type de retour change : CREATE OR REPLACE ne le permet pas.
DROP FUNCTION IF EXISTS public.list_applicable_programmings(uuid);

CREATE FUNCTION public.list_applicable_programmings(p_box_id uuid)
 RETURNS TABLE (
   subscription_id     uuid,
   programming_id      uuid,
   title               text,
   publisher_box_name  text,
   weeks_count         integer,
   days_per_week       integer,
   auto_apply_weekly   boolean,
   current_period_end  timestamptz,
   color               text,
   default_audience    text,
   default_group_ids   uuid[],
   week_anchor         date,
   wod_counts          integer[]
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.manages_box(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou coach de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT s.id, p.id, p.title, pb.name, p.weeks_count::int, p.days_per_week::int,
           s.auto_apply_weekly, s.current_period_end,
           s.color, s.default_audience, s.default_group_ids, s.week_anchor,
           -- index 1..weeks_count : nombre de WOD de chaque semaine (0 = vide)
           (SELECT array_agg(COALESCE(c.n, 0)::int ORDER BY wk.n)
              FROM generate_series(1, p.weeks_count) wk(n)
              LEFT JOIN (
                SELECT w.week_number, count(*) AS n
                  FROM public.box_programming_wods w
                 WHERE w.programming_id = p.id
                 GROUP BY w.week_number
              ) c ON c.week_number = wk.n)
      FROM public.box_programming_subscriptions s
      JOIN public.box_programming p ON p.id = s.programming_id
      LEFT JOIN public.boxes pb ON pb.id = p.publisher_box_id
     WHERE s.subscriber_box_id = p_box_id
       AND s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
     ORDER BY p.title;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_applicable_programmings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_applicable_programmings(uuid) TO authenticated, service_role;

-- Catalogue : les offres publiées des autres box, avec de quoi juger avant de
-- s'abonner (WOD par semaine, objectif, public, matériel, aperçu semaine 1).
CREATE OR REPLACE FUNCTION public.list_programming_catalog(p_box_id uuid)
 RETURNS TABLE (
   programming_id      uuid,
   title               text,
   description         text,
   discipline          text,
   level               text,
   days_per_week       integer,
   weeks_count         integer,
   billing             text,
   price_cents         integer,
   currency            text,
   publisher_box_id    uuid,
   publisher_box_name  text,
   goal                text,
   target_audience     text,
   equipment           text,
   wods_total          integer,
   wods_per_week       integer[],
   preview_week1       jsonb,
   subscribed          boolean
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.manages_box(p_box_id) THEN
    RAISE EXCEPTION 'Accès refusé : gérant ou coach de la box requis'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT p.id, p.title, p.description, p.discipline, p.level,
           p.days_per_week::int, p.weeks_count::int, p.billing, p.price_cents, p.currency,
           p.publisher_box_id, pb.name,
           p.goal, p.target_audience, p.equipment,
           (SELECT count(*)::int FROM public.box_programming_wods w WHERE w.programming_id = p.id),
           (SELECT array_agg(COALESCE(c.n, 0)::int ORDER BY wk.n)
              FROM generate_series(1, p.weeks_count) wk(n)
              LEFT JOIN (
                SELECT w.week_number, count(*) AS n
                  FROM public.box_programming_wods w
                 WHERE w.programming_id = p.id
                 GROUP BY w.week_number
              ) c ON c.week_number = wk.n),
           -- [{day, titles:[...]}] pour la semaine 1, jour par jour
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day_of_week, 'titles', d.titles)
                                      ORDER BY d.day_of_week), '[]'::jsonb)
              FROM (
                SELECT w.day_of_week, jsonb_agg(w.title ORDER BY w.sort_order) AS titles
                  FROM public.box_programming_wods w
                 WHERE w.programming_id = p.id AND w.week_number = 1
                 GROUP BY w.day_of_week
              ) d),
           EXISTS (
             SELECT 1 FROM public.box_programming_subscriptions s
              WHERE s.programming_id = p.id
                AND s.subscriber_box_id = p_box_id
                AND s.status = 'active'
           )
      FROM public.box_programming p
      LEFT JOIN public.boxes pb ON pb.id = p.publisher_box_id
     WHERE p.is_published
       AND NOT p.is_template
       AND p.publisher_box_id <> p_box_id
     ORDER BY p.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_programming_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_programming_catalog(uuid) TO authenticated, service_role;

-- ═══ 11. Triggers sur box_wods : verrou des cartes reçues, propagation ════════
-- Une carte reçue d'une offre d'une AUTRE box garde le contenu de l'éditeur :
-- l'UI désactive le crayon, le serveur garantit. Les copies d'une semaine type
-- (source = programmation de la box elle-même) restent du contenu maison,
-- librement modifiable.
CREATE OR REPLACE FUNCTION public.box_wods_lock_marketplace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.source_programming_wod_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.box_programming p
     WHERE p.id = OLD.source_programming_id
       AND NOT p.is_template
       AND p.publisher_box_id IS DISTINCT FROM OLD.box_id
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.title                 IS DISTINCT FROM OLD.title
  OR NEW.description           IS DISTINCT FROM OLD.description
  OR NEW.wod_type              IS DISTINCT FROM OLD.wod_type
  OR NEW.time_cap_seconds      IS DISTINCT FROM OLD.time_cap_seconds
  OR NEW.rounds                IS DISTINCT FROM OLD.rounds
  OR NEW.notes                 IS DISTINCT FROM OLD.notes
  OR NEW.block_name            IS DISTINCT FROM OLD.block_name
  OR NEW.video_url             IS DISTINCT FROM OLD.video_url
  OR NEW.emom_interval_minutes IS DISTINCT FROM OLD.emom_interval_minutes
  OR NEW.tabata_work_seconds   IS DISTINCT FROM OLD.tabata_work_seconds
  OR NEW.tabata_rest_seconds   IS DISTINCT FROM OLD.tabata_rest_seconds
  THEN
    RAISE EXCEPTION 'WOD reçu d''une programmation : non modifiable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_box_wods_lock_marketplace ON public.box_wods;
CREATE TRIGGER trg_box_wods_lock_marketplace
  BEFORE UPDATE ON public.box_wods
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_lock_marketplace();

-- Le WOD maison modifié met à jour ses copies dans les offres (T6). Les cartes
-- déjà posées chez les abonnés sont des snapshots : elles ne bougent pas.
CREATE OR REPLACE FUNCTION public.box_wods_propagate_to_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.box_programming_wods w
     SET title = NEW.title,
         description = NEW.description,
         wod_type = NEW.wod_type,
         time_cap_seconds = NEW.time_cap_seconds,
         rounds = NEW.rounds,
         sort_order = NEW.sort_order,
         notes = NEW.notes,
         block_name = NEW.block_name,
         video_url = NEW.video_url,
         leaderboard_enabled = NEW.leaderboard_enabled,
         emom_interval_minutes = NEW.emom_interval_minutes,
         tabata_work_seconds = NEW.tabata_work_seconds,
         tabata_rest_seconds = NEW.tabata_rest_seconds,
         day_of_week = CASE
           WHEN NEW.scheduled_date IS NOT NULL THEN EXTRACT(ISODOW FROM NEW.scheduled_date)::smallint
           ELSE w.day_of_week
         END
   WHERE w.origin_box_wod_id = NEW.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_box_wods_propagate_to_offer ON public.box_wods;
CREATE TRIGGER trg_box_wods_propagate_to_offer
  AFTER UPDATE OF title, description, wod_type, time_cap_seconds, rounds, sort_order,
                  notes, block_name, video_url, leaderboard_enabled,
                  emom_interval_minutes, tabata_work_seconds, tabata_rest_seconds,
                  scheduled_date
  ON public.box_wods
  FOR EACH ROW EXECUTE FUNCTION public.box_wods_propagate_to_offer();
