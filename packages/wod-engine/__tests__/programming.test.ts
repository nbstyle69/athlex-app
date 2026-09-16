/**
 * Programmation automatique (J1 §8) — couche pure `runWeekGeneration` sur une
 * base en mémoire : idempotence, régénération, conservation des jours édités
 * ou scorés (mardi scoré), `publish_at` dimanche 18:00 Paris, seeds.
 */
import {
  runWeekGeneration, weekSeed, revealAt, weekDates, nextIsoWeek, crossfitWeekRows, muscuWeekRows,
  generateWeek, generateMuscuWeek, CATALOG_SNAPSHOT, BANK_V1, TRACK_GROUP_NAME, PROGRAMMING_VERSION,
} from '../src';
import type { ProgrammingDb, ProgrammingBox, RunRow, BoxWodInsert, ExistingAutoRow, Track } from '../src';

interface StoredWod extends BoxWodInsert { id: string; edited_at: string | null; scored: boolean }

class MemoryDb implements ProgrammingDb {
  boxes: ProgrammingBox[] = [];
  runs: RunRow[] = [];
  wods: StoredWod[] = [];
  groups: Array<{ box_id: string; name: string }> = [];
  private seq = 0;
  private nextId(prefix: string): string { this.seq += 1; return `${prefix}-${this.seq}`; }

  async listEnabledBoxes(): Promise<ProgrammingBox[]> { return this.boxes; }
  async getRun(box_id: string, track: Track, iso_year: number, iso_week: number): Promise<RunRow | null> {
    return this.runs.find((r) => r.box_id === box_id && r.track === track && r.iso_year === iso_year && r.iso_week === iso_week) ?? null;
  }
  async upsertRun(run: Omit<RunRow, 'id'>): Promise<RunRow> {
    const i = this.runs.findIndex((r) => r.box_id === run.box_id && r.track === run.track && r.iso_year === run.iso_year && r.iso_week === run.iso_week);
    if (i >= 0) { this.runs[i] = { ...run, id: this.runs[i].id }; return this.runs[i]; }
    const row = { ...run, id: this.nextId('run') };
    this.runs.push(row);
    return row;
  }
  async updateRun(id: string, patch: Partial<RunRow>): Promise<void> {
    const i = this.runs.findIndex((r) => r.id === id);
    this.runs[i] = { ...this.runs[i], ...patch };
  }
  async recentSignatures(box_id: string, track: Track, before: { iso_year: number; iso_week: number }, weeks: number): Promise<string[]> {
    return this.runs
      .filter((r) => r.box_id === box_id && r.track === track && r.status === 'done' && r.iso_year === before.iso_year && r.iso_week < before.iso_week && r.iso_week >= before.iso_week - weeks)
      .flatMap((r) => r.signatures);
  }
  async listAutoRows(run_id: string): Promise<ExistingAutoRow[]> {
    return this.wods.filter((w) => w.auto_run_id === run_id && w.source === 'auto')
      .map((w) => ({ id: w.id, scheduled_date: w.scheduled_date, edited_at: w.edited_at, scored: w.scored }));
  }
  async deleteRows(ids: string[]): Promise<void> { this.wods = this.wods.filter((w) => !ids.includes(w.id)); }
  async insertRows(rows: BoxWodInsert[]): Promise<string[]> {
    const ids: string[] = [];
    for (const r of rows) { const id = this.nextId('wod'); this.wods.push({ ...r, id, edited_at: null, scored: false }); ids.push(id); }
    return ids;
  }
  async ensureGroup(box_id: string, name: string): Promise<void> {
    if (!this.groups.some((g) => g.box_id === box_id && g.name === name)) this.groups.push({ box_id, name });
  }
}

const BOX = 'box-fitness-test';
const OWNER = 'owner-test';
const NOW = new Date('2027-03-14T17:00:00Z'); // dimanche 14/03/2027 → cible 2027-W11
const TARGET = { iso_year: 2027, iso_week: 11 };

function fresh(tracks: Track[] = ['crossfit', 'musculation']): MemoryDb {
  const db = new MemoryDb();
  db.boxes = [{ id: BOX, owner_id: OWNER, tracks }];
  return db;
}

describe('semaine cible, seed, publish_at', () => {
  it('nextIsoWeek : dimanche soir Paris → semaine suivante', () => {
    expect(nextIsoWeek(NOW)).toEqual(TARGET);
    expect(nextIsoWeek(new Date('2026-12-27T17:30:00Z'))).toEqual({ iso_year: 2026, iso_week: 53 });
    expect(nextIsoWeek(new Date('2027-01-03T17:30:00Z'))).toEqual({ iso_year: 2027, iso_week: 1 });
  });

  it('weekDates : lundi → samedi ; revealAt : dimanche 18:00 Europe/Paris (CET et CEST)', () => {
    expect(weekDates(2027, 11)).toEqual(['2027-03-15', '2027-03-16', '2027-03-17', '2027-03-18', '2027-03-19', '2027-03-20']);
    expect(revealAt(2027, 11)).toBe('2027-03-14T17:00:00.000Z'); // CET
    expect(revealAt(2027, 20)).toBe('2027-05-16T16:00:00.000Z'); // CEST
  });

  it('seed déterministe : box × piste × année × semaine × regen_counter', () => {
    expect(weekSeed(BOX, 'crossfit', 2027, 11, 0)).toBe(weekSeed(BOX, 'crossfit', 2027, 11, 0));
    expect(weekSeed(BOX, 'crossfit', 2027, 11, 0)).not.toBe(weekSeed(BOX, 'crossfit', 2027, 11, 1));
    expect(weekSeed(BOX, 'crossfit', 2027, 11, 0)).not.toBe(weekSeed(BOX, 'musculation', 2027, 11, 0));
    expect(weekSeed(BOX, 'crossfit', 2027, 11, 0)).not.toBe(weekSeed('autre-box', 'crossfit', 2027, 11, 0));
  });

  it('lignes box_wods : audience all, publish_at dimanche, source auto, leaderboard sur le seul bloc C / jamais en muscu', () => {
    const ctx = { box_id: BOX, created_by: OWNER, run_id: 'run-x', ...TARGET };
    const week = generateWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7);
    const rows = crossfitWeekRows(week, ctx);
    expect(rows.every((r) => r.audience === 'all' && r.publish_at === revealAt(2027, 11) && r.source === 'auto' && r.is_published && r.auto_run_id === 'run-x')).toBe(true);
    expect(rows.filter((r) => r.leaderboard_enabled).every((r) => r.block_name === 'wod')).toBe(true);
    expect(new Set(rows.map((r) => r.scheduled_date)).size).toBe(6);
    const muscu = muscuWeekRows(generateMuscuWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7), ctx);
    expect(muscu).toHaveLength(5);
    expect(muscu.every((r) => !r.leaderboard_enabled && r.wod_type === 'strength' && r.block_name === 'strength')).toBe(true);
  });
});

describe('runWeekGeneration (base en mémoire)', () => {
  it('première passe : une run done par piste, 6 jours CrossFit + 5 jours Muscu, groupes créés, relâchements journalisés', async () => {
    const db = fresh();
    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(out.map((o) => [o.track, o.status, o.regen_counter])).toEqual([['crossfit', 'done', 0], ['musculation', 'done', 0]]);
    expect(db.runs).toHaveLength(2);
    for (const r of db.runs) {
      expect(r.status).toBe('done');
      expect(r.generator_version).toBe(PROGRAMMING_VERSION);
      expect(r.seed).toBe(weekSeed(BOX, r.track, 2027, 11, 0));
      expect(r.wod_ids.length).toBeGreaterThan(0);
      expect(Array.isArray(r.relaxations)).toBe(true);
    }
    const cf = db.wods.filter((w) => w.auto_run_id === db.runs[0].id);
    expect(new Set(cf.map((w) => w.scheduled_date)).size).toBe(6);
    expect(db.wods.filter((w) => w.auto_run_id === db.runs[1].id)).toHaveLength(5);
    expect(db.groups.map((g) => g.name).sort()).toEqual(Object.values(TRACK_GROUP_NAME).sort());
    expect(db.runs[0].wod_ids.sort()).toEqual(cf.map((w) => w.id).sort());
  });

  it('idempotent : deuxième invocation → kept, rien réécrit ; même seed → mêmes lignes', async () => {
    const db = fresh(['crossfit']);
    await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    const snapshot = JSON.stringify(db.wods);
    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(out[0].status).toBe('kept');
    expect(JSON.stringify(db.wods)).toBe(snapshot);

    const db2 = fresh(['crossfit']);
    await runWeekGeneration(db2, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    const strip = (w: StoredWod) => ({ ...w, id: '', auto_run_id: '' });
    expect(db2.wods.map(strip)).toEqual(db.wods.map(strip));
  });

  it('régénération avec mardi scoré et vendredi édité : ces jours sont conservés, les autres remplacés, regen_counter + 1, run id stable', async () => {
    const db = fresh(['crossfit']);
    await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    const run0 = { ...db.runs[0] };
    const tuesday = db.wods.filter((w) => w.scheduled_date === '2027-03-16');
    const friday = db.wods.filter((w) => w.scheduled_date === '2027-03-19');
    tuesday.find((w) => w.block_name === 'wod')!.scored = true;
    friday[0].edited_at = '2027-03-18T10:00:00Z';
    const before = db.wods.map((w) => w.id);

    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW, regen: { box_id: BOX, track: 'crossfit' } });
    expect(out[0]).toMatchObject({ status: 'done', regen_counter: 1, kept_dates: ['2027-03-16', '2027-03-19'] });
    expect(out[0].deleted).toBe(before.length - tuesday.length - friday.length);
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].id).toBe(run0.id);
    expect(db.runs[0].regen_counter).toBe(1);
    expect(db.runs[0].seed).toBe(weekSeed(BOX, 'crossfit', 2027, 11, 1));
    expect(db.runs[0].seed).not.toBe(run0.seed);

    // Tous les blocs du mardi et du vendredi sont là, à l'identique.
    for (const w of [...tuesday, ...friday]) expect(db.wods.find((x) => x.id === w.id)).toEqual(w);
    // Les autres jours sont de nouvelles lignes, un jeu complet par date.
    const others = db.wods.filter((w) => !['2027-03-16', '2027-03-19'].includes(w.scheduled_date));
    expect(others.every((w) => !before.includes(w.id))).toBe(true);
    expect(new Set(others.map((w) => w.scheduled_date))).toEqual(new Set(['2027-03-15', '2027-03-17', '2027-03-18', '2027-03-20']));
    expect(db.runs[0].wod_ids.sort()).toEqual(db.wods.map((w) => w.id).sort());
    // Une troisième passe sans regen ne touche à rien.
    const again = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(again[0].status).toBe('kept');
  });

  it('erreur moteur → run error journalisée, pas de ligne insérée, puis reprise sans regen', async () => {
    const db = fresh(['crossfit']);
    const broken = { ...BANK_V1, session_skeletons: [] };
    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, broken, { now: NOW });
    expect(out[0].status).toBe('error');
    expect(db.runs[0].status).toBe('error');
    expect(db.runs[0].error).toBeTruthy();
    expect(db.wods).toHaveLength(0);
    const retry = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(retry[0]).toMatchObject({ status: 'done', regen_counter: 0 });
    expect(db.runs).toHaveLength(1);
  });

  it('signatures des 4 semaines précédentes reprises du journal ; only_box_id et cible explicite', async () => {
    const db = fresh(['crossfit']);
    db.boxes.push({ id: 'autre', owner_id: null, tracks: ['crossfit'] });
    for (let w = 7; w <= 11; w++) {
      const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW, target: { iso_year: 2027, iso_week: w }, only_box_id: BOX });
      expect(out).toHaveLength(1);
      expect(out[0].status).toBe('done');
    }
    const sigs = db.runs.filter((r) => r.box_id === BOX).flatMap((r) => r.signatures);
    expect(new Set(sigs).size).toBe(sigs.length);
    expect(db.runs.filter((r) => r.box_id === 'autre')).toHaveLength(0);
  });
});
