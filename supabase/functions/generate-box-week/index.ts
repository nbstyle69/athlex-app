// Edge Function: generate-box-week
// ------------------------------------------------------------------
// Programmation automatique de box (J1). Pour chaque box `auto_programming`
// et chacune de ses `auto_programming_tracks`, génère la semaine ISO SUIVANTE
// (lundi → samedi) et la pose dans `box_wods` (`source = 'auto'`,
// `audience = 'all'`, `publish_at` = dimanche 18:00 Europe/Paris).
//
// Toute la décision (seed déterministe, idempotence, régénération, lignes
// conservées) vit dans le package `wod-engine` (`runWeekGeneration`), livré ici
// en bundle ESM commité (`wod-engine.bundle.js`, scripts/bundle-edge.mjs) :
// Deno ne lit pas les imports TypeScript sans extension du package.
//
// Appel (pg_cron ou manuel), CRON_SECRET obligatoire (fail-closed) :
//   POST {}                                  → semaine suivante, toutes les box
//   POST { "box_id": "…" }                   → une box seulement
//   POST { "iso_year": 2026, "iso_week": 40 } → semaine cible explicite
//   POST { "regen": { "box_id": "…", "track": "functional" } }
//         → régénère (regen_counter + 1) ; les jours édités ou scorés restent.
//   POST { "box_id": "…", "tracks": ["hybrid"] }
//         → ne pose que ces pistes (∩ pistes actives) ; absent = toutes, inchangé.
//
// Le cron est DÉSACTIVÉ par défaut : voir docs/RUNBOOK_CRONS.md.
// ------------------------------------------------------------------
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
// Le bundle est du JS ; ses types sont ceux du package source (type-check via
// `deno check --sloppy-imports`, cf. __tests__/edge-bundle.test.ts).
//
// DÉPLOIEMENT : `node scripts/deploy-edge.mjs generate-box-week`, jamais
// `supabase functions deploy` en direct. La directive `@deno-types` et
// l'`import type` ci-dessous ne survivent pas au déploiement : la CLI Supabase
// les suit vers les sources du moteur, dont elle ouvre les spécificateurs sans
// ajouter `.ts`, et `packages/wod-engine/src/bank` est un répertoire — elle
// échoue en `EISDIR` avant même de téléverser le bundle. Le script déploie une
// copie sans ces deux lignes ; type-only, elles sont de toute façon effacées à
// l'exécution, et la fonction déployée ne dépend que du bundle.
// @deno-types="../../../packages/wod-engine/src/index.ts"
import {
  BANK_V1, CATALOG_SNAPSHOT, bankFromRows, catalogFromRows, runWeekGeneration, revealFromRow, TRACKS,
} from './wod-engine.bundle.js';
import type {
  BoxWodInsert, Catalog, ExistingAutoRow, ProgrammingBox, ProgrammingDb, RunRow, SkeletonBank, Track,
} from '../../../packages/wod-engine/src/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  box_id?: string;
  iso_year?: number;
  iso_week?: number;
  regen?: { box_id: string; track: Track };
  /** pistes à générer, parmi functional | hybrid | musculation ; absent = toutes les pistes actives */
  tracks?: string[];
}

const isTrack = (t: unknown): t is Track => typeof t === 'string' && (TRACKS as readonly string[]).includes(t);

async function loadCatalog(admin: SupabaseClient): Promise<{ catalog: Catalog; source: string }> {
  const { data, error } = await admin.from('movement_catalog').select('*');
  if (error || !data?.length) return { catalog: CATALOG_SNAPSHOT, source: 'snapshot' };
  const catalog = catalogFromRows(data);
  return catalog.movements.some((m) => m.active) ? { catalog, source: 'table' } : { catalog: CATALOG_SNAPSHOT, source: 'snapshot' };
}

async function loadBank(admin: SupabaseClient): Promise<{ bank: SkeletonBank; source: string }> {
  const [sk, caps] = await Promise.all([
    admin.from('wod_skeletons').select('*').eq('active', true),
    admin.from('wod_volume_caps').select('*').eq('active', true),
  ]);
  if (sk.error || caps.error || !sk.data?.length || !caps.data?.length) return { bank: BANK_V1, source: 'snapshot' };
  try {
    return { bank: bankFromRows(sk.data, caps.data), source: 'table' };
  } catch {
    return { bank: BANK_V1, source: 'snapshot' };
  }
}

function makeDb(admin: SupabaseClient): ProgrammingDb {
  const fail = (ctx: string, e: { message: string } | null) => {
    if (e) throw new Error(`${ctx}: ${e.message}`);
  };
  return {
    async listEnabledBoxes(): Promise<ProgrammingBox[]> {
      const REVEAL_COLS = 'auto_programming_reveal_mode, auto_programming_reveal_dow, auto_programming_reveal_time';
      // `archived_at is null` ici et pas par policy : cette fonction tourne en
      // service_role, qui contourne la RLS. Une box archivée ne doit plus être
      // générée, quel que soit son flag (migration 20261224).
      const read = (cols: string) => admin.from('boxes').select(cols)
        .eq('auto_programming', true)
        .is('archived_at', null);
      // Base antérieure à 20261224 : `archived_at` n'existe pas, on relit sans.
      const readSafe = async (cols: string) => {
        const r = await read(cols);
        if (r.error && (r.error.code === '42703' || r.error.code === 'PGRST204')) {
          return await admin.from('boxes').select(cols).eq('auto_programming', true);
        }
        return r;
      };
      // Colonnes de révélation absentes (base antérieure à 20261221) : `42703` / `PGRST204`,
      // on relit sans elles et `revealFromRow` rend le défaut J1.
      let { data, error } = await readSafe(`id, owner_id, auto_programming_tracks, ${REVEAL_COLS}`);
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        ({ data, error } = await readSafe('id, owner_id, auto_programming_tracks'));
      }
      fail('boxes', error);
      return ((data ?? []) as Record<string, unknown>[]).map((b) => ({
        id: b.id as string,
        owner_id: (b.owner_id as string | null) ?? null,
        tracks: ((b.auto_programming_tracks as string[] | null) ?? []).filter(isTrack),
        reveal: revealFromRow(
          b.auto_programming_reveal_mode, b.auto_programming_reveal_dow, b.auto_programming_reveal_time,
        ),
      }));
    },
    async getRun(box_id, track, iso_year, iso_week) {
      const { data, error } = await admin.from('box_auto_programming_runs').select('*')
        .eq('box_id', box_id).eq('track', track).eq('iso_year', iso_year).eq('iso_week', iso_week).maybeSingle();
      fail('runs.select', error);
      return (data as RunRow | null) ?? null;
    },
    async upsertRun(run) {
      const { data, error } = await admin.from('box_auto_programming_runs')
        .upsert(run, { onConflict: 'box_id,track,iso_year,iso_week' })
        .select('*').single();
      fail('runs.upsert', error);
      return data as RunRow;
    },
    async updateRun(id, patch) {
      const { error } = await admin.from('box_auto_programming_runs').update(patch).eq('id', id);
      fail('runs.update', error);
    },
    async recentSignatures(box_id, track, before, weeks) {
      // Semaines ISO précédentes, tous millésimes : on trie par (année, semaine)
      // et on garde les `weeks` dernières runs `done` strictement avant la cible.
      const { data, error } = await admin.from('box_auto_programming_runs')
        .select('iso_year, iso_week, signatures')
        .eq('box_id', box_id).eq('track', track).eq('status', 'done')
        .order('iso_year', { ascending: false }).order('iso_week', { ascending: false })
        .limit(weeks + 1);
      fail('runs.recent', error);
      return (data ?? [])
        .filter((r) => r.iso_year < before.iso_year || (r.iso_year === before.iso_year && r.iso_week < before.iso_week))
        .slice(0, weeks)
        .flatMap((r) => (r.signatures as string[]) ?? []);
    },
    async listAutoRows(run_id): Promise<ExistingAutoRow[]> {
      const { data, error } = await admin.from('box_wods')
        .select('id, scheduled_date, edited_at, wod_scores(id)')
        .eq('auto_run_id', run_id).eq('source', 'auto');
      fail('box_wods.select', error);
      return (data ?? []).map((r) => ({
        id: r.id as string,
        scheduled_date: r.scheduled_date as string,
        edited_at: (r.edited_at as string | null) ?? null,
        scored: Array.isArray(r.wod_scores) && r.wod_scores.length > 0,
      }));
    },
    async deleteRows(ids) {
      const { error } = await admin.from('box_wods').delete().in('id', ids);
      fail('box_wods.delete', error);
    },
    async insertRows(rows: BoxWodInsert[]) {
      const put = (r: BoxWodInsert[]) => admin.from('box_wods').insert(r).select('id');
      // Colonne `track` absente (base antérieure à 20261223) : `42703` / `PGRST204`.
      // On repose les mêmes lignes sans elle plutôt que de faire tomber toute la
      // génération — la semaine est posée, seuls les onglets du Whiteboard
      // attendent la migration. Contrairement à `listEnabledBoxes`, le repli est
      // ici sur l'ÉCRITURE : une lecture `select('*')` ne peut pas lever 42703.
      let { data, error } = await put(rows);
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        ({ data, error } = await put(rows.map(({ track: _track, ...rest }) => rest as BoxWodInsert)));
      }
      fail('box_wods.insert', error);
      return (data ?? []).map((r) => r.id as string);
    },
    async ensureGroup(box_id, name, created_by) {
      const { data, error } = await admin.from('message_groups').select('id')
        .eq('box_id', box_id).eq('name', name).limit(1);
      fail('message_groups.select', error);
      if (data?.length) return;
      // `wod_visibility_mode` n'admet que daily | weekly : la semaine entière
      // est le réglage le plus proche du « tout le monde voit » du brief.
      const { error: e2 } = await admin.from('message_groups')
        .insert({ box_id, name, created_by, members: [], wod_visibility_mode: 'weekly' });
      fail('message_groups.insert', e2);
    },
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const provided = req.headers.get('x-cron-secret') ?? '';
    if (!cronSecret || provided !== cronSecret) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let body: Body = {};
    try { body = (await req.json()) as Body; } catch { /* corps vide = défauts */ }
    if (body.regen && !isTrack(body.regen.track)) return json({ error: 'regen.track invalide' }, 400);
    if (body.tracks !== undefined && (!Array.isArray(body.tracks) || !body.tracks.every(isTrack))) {
      return json({ error: 'tracks invalide : tableau parmi functional | hybrid | musculation' }, 400);
    }

    const [{ catalog, source: catalogSource }, { bank, source: bankSource }] = await Promise.all([loadCatalog(admin), loadBank(admin)]);
    const started = Date.now();
    const outcomes = await runWeekGeneration(makeDb(admin), catalog, bank, {
      now: new Date(),
      target: body.iso_year && body.iso_week ? { iso_year: body.iso_year, iso_week: body.iso_week } : undefined,
      regen: body.regen,
      only_box_id: body.box_id ?? body.regen?.box_id,
      tracks: body.tracks as Track[] | undefined,
    });
    return json({
      ok: true,
      catalog: catalogSource,
      bank: bankSource,
      ms: Date.now() - started,
      done: outcomes.filter((o) => o.status === 'done').length,
      kept: outcomes.filter((o) => o.status === 'kept').length,
      errors: outcomes.filter((o) => o.status === 'error').length,
      outcomes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
