/**
 * Musculation de box en plusieurs cartes (#620, #635) : `muscuWeekRows` écrit chaque journée en
 * Échauffement · une carte par exercice · Retour au calme. La séance tirée ne change pas : même graine,
 * mêmes exercices, mêmes séries, mêmes signatures de run, mêmes relaxations, aucun appel au RNG de plus.
 */
import {
  runWeekGeneration, weekSeed, weekDates, publishAtFor, partieExercice, generateMuscuWeek,
  MUSCU_WEEK_DAYS, MUSCU_WEEKLY_CAP_SETS, CATALOG_SNAPSHOT, BANK_V1,
} from '../src';
import type { BoxWodInsert, ExistingAutoRow, GeneratedMuscuWeek, MuscuWod, SessionStructuredBlock, Track } from '../src';
import { Base, avecJournal } from './instantane/chemins';

const C = CATALOG_SNAPSHOT;
const B = BANK_V1;
const BOX = 'box-620';

/** Base de l'instantané, avec l'état « édité / scoré » des lignes (conservation des jours). */
class Db extends Base {
  marques = new Map<string, { edited_at: string | null; scored: boolean }>();
  async listAutoRows(run_id: string): Promise<ExistingAutoRow[]> {
    return this.wods.filter((w) => w.auto_run_id === run_id)
      .map((w) => ({ id: w.id, scheduled_date: w.scheduled_date, edited_at: null, scored: false, ...this.marques.get(w.id) }));
  }
}
function base(tracks: Track[] = ['musculation'], box = BOX): Db {
  const db = new Db();
  db.boxes = [{ id: box, owner_id: 'owner', tracks }];
  return db;
}
const semaineDirecte = (iso_week: number, box = BOX, recent: string[] = []): GeneratedMuscuWeek =>
  generateMuscuWeek({ iso_year: 2027, iso_week, recent_signatures: recent }, C, B, weekSeed(box, 'musculation', 2027, iso_week, 0));

/** La carte, moins ce qui en fait une carte : doit redonner la séance du jour. */
const sansCarte = (w: MuscuWod) => ({ ...w, blocks: null, estimate: null, rendu: { ...w.rendu, partie: undefined, premiere: undefined }, title: null, description: null, notes: null });
const parDate = (rows: BoxWodInsert[]) => {
  const m = new Map<string, BoxWodInsert[]>();
  for (const r of rows) m.set(r.scheduled_date, [...(m.get(r.scheduled_date) ?? []), r]);
  return m;
};

describe('le tirage ne change pas', () => {
  it('MUSCU_WEEK_DAYS, durées et plafond hebdo inchangés', () => {
    expect(MUSCU_WEEK_DAYS).toEqual([
      { day: 1, target: 'push', budget_min: 45 }, { day: 2, target: 'jambes', budget_min: 45 }, { day: 4, target: 'pull', budget_min: 45 },
      { day: 5, target: 'fessiers_ischios', budget_min: 45 }, { day: 6, target: 'tronc', budget_min: 20 },
    ]);
    expect(MUSCU_WEEKLY_CAP_SETS).toBe(16);
  });

  // 12 semaines (les trois objectifs, deux fois) × 4 box : graines différentes
  const CAS = [...Array(12).keys()].flatMap((i) => [0, 1, 2, 3].map((b) => ({ iso_week: i + 1, box: `box-620-${b}` })));

  it.each(CAS)('semaine $iso_week, $box : graine, signatures, relaxations, exercices et séries identiques à la séance tirée', async ({ iso_week, box }) => {
    const db = base(['musculation'], box);
    const [out] = await runWeekGeneration(db, C, B, { now: new Date(0), target: { iso_year: 2027, iso_week } });
    expect(out.status).toBe('done');
    const week = semaineDirecte(iso_week, box);
    const run = db.runs[0];
    expect(run.seed).toBe(week.seed);
    expect(run.signatures).toEqual(week.days.map((d) => d.wod.signature));
    expect(run.relaxations).toEqual(week.relaxations);
    const dates = weekDates(2027, iso_week);
    const rows = parDate(db.wods);
    expect([...rows.keys()].sort()).toEqual(week.days.map((d) => dates[d.day - 1]).sort());
    for (const d of week.days) {
      const cartes = rows.get(dates[d.day - 1])!;
      const muscu = cartes.filter((r) => r.block_name === 'strength').map((r) => r.wod_json as MuscuWod);
      const exs = d.wod.blocks[0].exercises;
      // mêmes exercices, mêmes séries, mêmes charges, dans l'ordre de la séance : un par carte
      expect(muscu.map((w) => w.blocks[0].exercises)).toEqual(exs.map((e) => [e]));
      expect(muscu.map((w) => w.rendu?.partie)).toEqual(exs.map((e) => partieExercice(d.target, e)));
      for (const w of muscu) {
        expect(sansCarte(w)).toEqual(sansCarte(d.wod));
        expect(w.signature).toBe(d.wod.signature);
      }
      expect(muscu.reduce((s, w) => s + w.estimate.seconds, 0)).toBe(d.wod.estimate.seconds);
    }
  });

  it('aucun appel au RNG ajouté : même journal que la seule génération de la semaine', async () => {
    for (const iso_week of [1, 3, 5, 6]) {
      const direct = await avecJournal(() => { semaineDirecte(iso_week); return { texte: [], sortie: null }; });
      const prog = await avecJournal(async () => {
        await runWeekGeneration(base(), C, B, { now: new Date(0), target: { iso_year: 2027, iso_week } });
        return { texte: [], sortie: null };
      });
      expect(direct.tirages.length).toBeGreaterThan(0);
      expect(prog.tirages).toEqual(direct.tirages);
    }
  });
});

describe('cartes écrites', () => {
  it.each([1, 3, 5])('semaine %i : Échauffement · une carte par exercice · Retour au calme (Tronc compris), sort_order 0..n, mêmes colonnes de journée', async (iso_week) => {
    const db = base();
    await runWeekGeneration(db, C, B, { now: new Date(0), target: { iso_year: 2027, iso_week } });
    const run = db.runs[0];
    expect(run.wod_ids.sort()).toEqual(db.wods.map((w) => w.id).sort());
    const week = semaineDirecte(iso_week);
    for (const [date, cartes] of parDate(db.wods)) {
      const d = week.days.find((x) => weekDates(2027, iso_week)[x.day - 1] === date)!;
      expect(cartes.map((r) => r.block_name)).toEqual(['warmup', ...d.wod.blocks[0].exercises.map(() => 'strength'), 'cooldown']);
      expect(cartes.map((r) => r.sort_order)).toEqual(cartes.map((_, i) => i));
      for (const r of cartes) {
        expect(r).toMatchObject({
          scheduled_date: date, publish_at: publishAtFor(date, 2027, iso_week), track: 'musculation', source: 'auto', auto_run_id: run.id,
          audience: 'all', is_published: true, leaderboard_enabled: false, time_cap_seconds: null, rounds: null, box_id: BOX, created_by: 'owner',
        });
      }
      const muscu = cartes.filter((r) => r.block_name === 'strength');
      // une carte d'exercice = une strength_session d'un exercice
      for (const r of muscu) {
        expect(r.wod_type).toBe('strength');
        expect((r.wod_json as MuscuWod).blocks.map((b) => [b.kind, b.exercises.length])).toEqual([['strength_session', 1]]);
      }
      // note du stimulus sur la première carte d'exercice seulement
      expect(muscu.map((r) => r.notes)).toEqual(muscu.map((_, i) => (i === 0 ? d.wod.notes : null)));
      expect(muscu.map((r) => (r.wod_json as MuscuWod).rendu?.premiere)).toEqual(muscu.map((_, i) => i === 0));
      // échauffement et retour au calme : sans grille, sans score
      for (const r of cartes.filter((x) => x.block_name !== 'strength')) {
        expect(r.wod_type).toBe('custom');
        expect(r.notes).toBeNull();
        const j = r.wod_json as SessionStructuredBlock;
        expect(j).toMatchObject({ source: 'generator', discipline: 'session', v: 2, kind: r.block_name, steps: null, finisher: null, gym_reps_rx: {} });
        expect(Object.keys(j)).not.toContain('blocks');
        expect(r.description).not.toMatch(/ × /);
      }
    }
  });

  it('régénération : une carte d\'exercice scorée garde toute la journée, les autres jours sont remplacés', async () => {
    const db = base();
    const target = { iso_year: 2027, iso_week: 11 };
    await runWeekGeneration(db, C, B, { now: new Date(0), target });
    const mardi = db.wods.filter((w) => w.scheduled_date === '2027-03-16');
    const n = mardi.length;
    expect(n).toBeGreaterThan(4);
    db.marques.set(mardi[n - 2].id, { edited_at: null, scored: true });
    const avant = db.wods.map((w) => w.id);
    const [out] = await runWeekGeneration(db, C, B, { now: new Date(0), target, regen: { box_id: BOX, track: 'musculation' } });
    expect(out).toMatchObject({ status: 'done', regen_counter: 1, kept_dates: ['2027-03-16'], deleted: avant.length - n });
    for (const w of mardi) expect(db.wods.find((x) => x.id === w.id)).toEqual(w);
    const autres = db.wods.filter((w) => w.scheduled_date !== '2027-03-16');
    expect(autres.every((w) => !avant.includes(w.id))).toBe(true);
    const autresJours = parDate(autres);
    expect(autresJours.size).toBe(4);
    for (const c of autresJours.values()) expect(c.map((w) => w.block_name).join()).toMatch(/^warmup(,strength)+,cooldown$/);
    expect(db.runs[0].wod_ids.sort()).toEqual(db.wods.map((w) => w.id).sort());
  });
});
