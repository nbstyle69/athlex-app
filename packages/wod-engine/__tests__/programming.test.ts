/**
 * Programmation automatique (J1 §8) — couche pure `runWeekGeneration` sur une
 * base en mémoire : idempotence, régénération, conservation des jours édités
 * ou scorés (mardi scoré), `publish_at` dimanche 18:00 Paris, seeds.
 */
import {
  runWeekGeneration, weekSeed, revealAt, weekDates, nextIsoWeek, functionalWeekRows, muscuWeekRows,
  generateWeek, generateMuscuWeek, CATALOG_SNAPSHOT, BANK_V1, TRACK_GROUP_NAME, PROGRAMMING_VERSION,
  DEFAULT_REVEAL, revealFromRow, parisInstant, weeklyRevealDate, publishAtFor,
} from '../src';
import type { ProgrammingDb, ProgrammingBox, RunRow, BoxWodInsert, ExistingAutoRow, Track, RevealConfig } from '../src';

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

function fresh(tracks: Track[] = ['functional', 'musculation']): MemoryDb {
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
    expect(weekSeed(BOX, 'functional', 2027, 11, 0)).toBe(weekSeed(BOX, 'functional', 2027, 11, 0));
    expect(weekSeed(BOX, 'functional', 2027, 11, 0)).not.toBe(weekSeed(BOX, 'functional', 2027, 11, 1));
    expect(weekSeed(BOX, 'functional', 2027, 11, 0)).not.toBe(weekSeed(BOX, 'musculation', 2027, 11, 0));
    expect(weekSeed(BOX, 'functional', 2027, 11, 0)).not.toBe(weekSeed('autre-box', 'functional', 2027, 11, 0));
  });

  it('lignes box_wods : audience all, publish_at dimanche, source auto, leaderboard sur le seul bloc C / jamais en muscu', () => {
    const ctx = { box_id: BOX, created_by: OWNER, run_id: 'run-x', ...TARGET };
    const week = generateWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7);
    const rows = functionalWeekRows(week, ctx);
    expect(rows.every((r) => r.audience === 'all' && r.publish_at === revealAt(2027, 11) && r.source === 'auto' && r.is_published && r.auto_run_id === 'run-x')).toBe(true);
    expect(rows.filter((r) => r.leaderboard_enabled).every((r) => r.block_name === 'wod')).toBe(true);
    expect(new Set(rows.map((r) => r.scheduled_date)).size).toBe(6);
    const muscu = muscuWeekRows(generateMuscuWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7), ctx);
    expect(muscu).toHaveLength(5);
    expect(muscu.every((r) => !r.leaderboard_enabled && r.wod_type === 'strength' && r.block_name === 'strength')).toBe(true);
  });

  it('chaque ligne porte sa piste (20261223) : les onglets du Whiteboard filtrent dessus', () => {
    const ctx = { box_id: BOX, created_by: OWNER, run_id: 'run-t', ...TARGET };
    const fonctionnel = functionalWeekRows(generateWeek({ ...TARGET, track: 'functional' }, CATALOG_SNAPSHOT, BANK_V1, 7), ctx);
    const hybrid = functionalWeekRows(generateWeek({ ...TARGET, track: 'hybrid' }, CATALOG_SNAPSHOT, BANK_V1, 7), ctx);
    const muscu = muscuWeekRows(generateMuscuWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7), ctx);
    expect(fonctionnel.every((r) => r.track === 'functional')).toBe(true);
    expect(hybrid.every((r) => r.track === 'hybrid')).toBe(true);
    expect(muscu.every((r) => r.track === 'musculation')).toBe(true);
    // Jamais null : `null` est la valeur des WODs saisis par un coach.
    expect([...fonctionnel, ...hybrid, ...muscu].some((r) => !r.track)).toBe(false);
  });
});

describe('révélation par box (20261221) — modes weekly / daily', () => {
  const ctxFor = (reveal?: RevealConfig) => ({ box_id: BOX, created_by: OWNER, run_id: 'run-r', ...TARGET, reveal });
  const rowsFor = (reveal?: RevealConfig) =>
    functionalWeekRows(generateWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7), ctxFor(reveal));

  it('défaut = comportement J1 : dimanche 18:00 Paris, semaine entière', () => {
    expect(DEFAULT_REVEAL).toEqual({ mode: 'weekly', dow: 0, time: '18:00' });
    expect(revealAt(2027, 11, DEFAULT_REVEAL)).toBe(revealAt(2027, 11));
    expect(publishAtFor('2027-03-18', 2027, 11)).toBe('2027-03-14T17:00:00.000Z');
    // une box sans colonnes de révélation garde le dimanche 18:00
    expect(new Set(rowsFor(undefined).map((r) => r.publish_at))).toEqual(new Set(['2027-03-14T17:00:00.000Z']));
  });

  it('weekly : le jour dow de la semaine précédente, le lundi ciblé lui-même si dow = 1', () => {
    expect(weeklyRevealDate(2027, 11, 0)).toBe('2027-03-14'); // dimanche
    expect(weeklyRevealDate(2027, 11, 1)).toBe('2027-03-15'); // lundi de la semaine ciblée
    expect(weeklyRevealDate(2027, 11, 6)).toBe('2027-03-13'); // samedi d'avant
    expect(weeklyRevealDate(2027, 11, 2)).toBe('2027-03-09'); // mardi d'avant
    expect(revealAt(2027, 11, { mode: 'weekly', dow: 6, time: '08:00' })).toBe('2027-03-13T07:00:00.000Z'); // CET
    expect(revealAt(2027, 11, { mode: 'weekly', dow: 1, time: '06:30' })).toBe('2027-03-15T05:30:00.000Z');
    expect(revealAt(2027, 20, { mode: 'weekly', dow: 6, time: '08:00' })).toBe('2027-05-15T06:00:00.000Z'); // CEST
  });

  it('weekly : les 21 lignes de la semaine partagent le même publish_at', () => {
    const rows = rowsFor({ mode: 'weekly', dow: 6, time: '08:00' });
    expect(new Set(rows.map((r) => r.publish_at))).toEqual(new Set(['2027-03-13T07:00:00.000Z']));
  });

  it('daily : chaque carte à l’heure locale de son propre jour (CET et CEST)', () => {
    const daily: RevealConfig = { mode: 'daily', dow: 0, time: '07:00' };
    expect(publishAtFor('2027-03-15', 2027, 11, daily)).toBe('2027-03-15T06:00:00.000Z'); // CET
    expect(publishAtFor('2027-05-17', 2027, 20, daily)).toBe('2027-05-17T05:00:00.000Z'); // CEST
    const rows = rowsFor(daily);
    // un publish_at par jour de séance, chacun le matin du jour concerné
    const byDate = new Map(rows.map((r) => [r.scheduled_date, r.publish_at]));
    expect([...byDate.keys()].sort()).toEqual(weekDates(2027, 11));
    for (const [date, at] of byDate) expect(at).toBe(`${date}T06:00:00.000Z`);
    const muscu = muscuWeekRows(generateMuscuWeek({ ...TARGET }, CATALOG_SNAPSHOT, BANK_V1, 7), ctxFor(daily));
    for (const r of muscu) expect(r.publish_at).toBe(`${r.scheduled_date}T06:00:00.000Z`);
    expect(new Set(muscu.map((r) => r.publish_at)).size).toBe(5);
  });

  it('parisInstant : minuit, secondes, CET / CEST, et le jour du changement d’heure', () => {
    expect(parisInstant('2027-03-15', '00:00')).toBe('2027-03-14T23:00:00.000Z');
    expect(parisInstant('2027-03-15', '18:30:45')).toBe('2027-03-15T17:30:45.000Z');
    expect(parisInstant('2027-03-28', '18:00')).toBe('2027-03-28T16:00:00.000Z'); // bascule CEST ce jour-là
    expect(parisInstant('2027-10-31', '18:00')).toBe('2027-10-31T17:00:00.000Z'); // retour CET
  });

  it('revealFromRow : colonne absente, nulle ou hors domaine → défaut J1', () => {
    expect(revealFromRow('daily', 3, '07:15:00')).toEqual({ mode: 'daily', dow: 3, time: '07:15:00' });
    expect(revealFromRow(undefined, undefined, undefined)).toEqual(DEFAULT_REVEAL);
    expect(revealFromRow(null, null, null)).toEqual(DEFAULT_REVEAL);
    expect(revealFromRow('hebdo', 9, 'midi')).toEqual(DEFAULT_REVEAL);
    expect(revealFromRow('weekly', '5', '08:00')).toEqual({ mode: 'weekly', dow: 5, time: '08:00' });
  });

  it('runWeekGeneration : la révélation de la box est celle des lignes posées', async () => {
    const db = fresh(['musculation']);
    db.boxes[0].reveal = { mode: 'daily', dow: 0, time: '06:45' };
    await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(db.wods).toHaveLength(5);
    for (const w of db.wods) expect(w.publish_at).toBe(`${w.scheduled_date}T05:45:00.000Z`);
  });
});

describe('runWeekGeneration (base en mémoire)', () => {
  it('première passe : une run done par piste, 6 jours Functional + 5 jours Muscu, groupes créés, relâchements journalisés', async () => {
    const db = fresh();
    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(out.map((o) => [o.track, o.status, o.regen_counter])).toEqual([['functional', 'done', 0], ['musculation', 'done', 0]]);
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
    // un groupe par piste *activée* : la box de ce test n'a pas la piste Hybrid
    expect(db.groups.map((g) => g.name).sort()).toEqual(db.boxes[0].tracks.map((t) => TRACK_GROUP_NAME[t]).sort());
    expect(db.runs[0].wod_ids.sort()).toEqual(cf.map((w) => w.id).sort());
  });

  it('idempotent : deuxième invocation → kept, rien réécrit ; même seed → mêmes lignes', async () => {
    const db = fresh(['functional']);
    await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    const snapshot = JSON.stringify(db.wods);
    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    expect(out[0].status).toBe('kept');
    expect(JSON.stringify(db.wods)).toBe(snapshot);

    const db2 = fresh(['functional']);
    await runWeekGeneration(db2, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    const strip = (w: StoredWod) => ({ ...w, id: '', auto_run_id: '' });
    expect(db2.wods.map(strip)).toEqual(db.wods.map(strip));
  });

  it('régénération avec mardi scoré et vendredi édité : ces jours sont conservés, les autres remplacés, regen_counter + 1, run id stable', async () => {
    const db = fresh(['functional']);
    await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW });
    const run0 = { ...db.runs[0] };
    const tuesday = db.wods.filter((w) => w.scheduled_date === '2027-03-16');
    const friday = db.wods.filter((w) => w.scheduled_date === '2027-03-19');
    tuesday.find((w) => w.block_name === 'wod')!.scored = true;
    friday[0].edited_at = '2027-03-18T10:00:00Z';
    const before = db.wods.map((w) => w.id);

    const out = await runWeekGeneration(db, CATALOG_SNAPSHOT, BANK_V1, { now: NOW, regen: { box_id: BOX, track: 'functional' } });
    expect(out[0]).toMatchObject({ status: 'done', regen_counter: 1, kept_dates: ['2027-03-16', '2027-03-19'] });
    expect(out[0].deleted).toBe(before.length - tuesday.length - friday.length);
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].id).toBe(run0.id);
    expect(db.runs[0].regen_counter).toBe(1);
    expect(db.runs[0].seed).toBe(weekSeed(BOX, 'functional', 2027, 11, 1));
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
    const db = fresh(['functional']);
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
    const db = fresh(['functional']);
    db.boxes.push({ id: 'autre', owner_id: null, tracks: ['functional'] });
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
