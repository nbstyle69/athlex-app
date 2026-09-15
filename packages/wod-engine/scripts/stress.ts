import { generateBlocC, CATALOG_SNAPSHOT, BANK_V1, NoValidWod } from '../src';
import type { GenerateParams, FormatChoice, Intention } from '../src';
const N = Number(process.argv[2] ?? 30);
const FMTS: FormatChoice[] = ['surprise', 'amrap', 'for_time', 'emom', 'chipper', 'stations', 'interval'];
const grid: GenerateParams[] = [];
for (const b of [8, 12, 15, 20, 30]) for (const i of ['mixed', 'cardio', 'force', 'gym'] as Intention[]) for (const f of FMTS)
  grid.push({ entry: 'express', discipline: 'functional', budget_min: b, intention: i, format: f });
for (const b of [15, 20, 30, 45]) for (const i of ['interval', 'engine', 'aerobic', 'run', 'core'] as Intention[]) for (const f of FMTS) for (const v of ['none', 'required', 'optional'] as const)
  grid.push({ entry: 'express', discipline: 'hybrid', budget_min: b, intention: i, format: f, vest: v });
for (const b of [10, 15, 20]) for (const d of ['functional', 'hybrid'] as const) for (const i of (d === 'functional' ? ['mixed', 'cardio', 'force', 'gym'] : ['interval', 'engine', 'aerobic', 'run', 'core']) as Intention[])
  grid.push({ entry: 'after_class', discipline: d, budget_min: b, intention: i, format: 'surprise', after_class: { day_movements: ['Back Squat', 'Thrusters'] } });
const fails = new Map<string, number>(); let ok = 0, ko = 0; const attempts: number[] = []; const skel = new Map<string, number>();
for (const p of grid) {
  let prevSig = '';
  for (let s = 1; s <= N; s++) {
    try {
      const w = generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, s); ok++;
      attempts.push(w.generator.attempts); skel.set(w.generator.skeleton_id, (skel.get(w.generator.skeleton_id) ?? 0) + 1);
      if (w.signature === prevSig) console.log('DUP SIG', JSON.stringify(p), s);
      prevSig = w.signature;
    } catch (e) {
      ko++;
      const k = `${p.entry} ${p.discipline} ${p.budget_min} ${p.intention} ${p.format} ${p.vest ?? ''}`;
      fails.set(k, (fails.get(k) ?? 0) + 1);
      if ((fails.get(k) ?? 0) === 1 && e instanceof NoValidWod) console.log(k, '→', JSON.stringify(e.reasons).slice(0, 300));
      else if (!(e instanceof NoValidWod)) console.log(k, 'ERR', (e as Error).message);
    }
  }
}
console.log({ ok, ko, combos: grid.length, failingCombos: fails.size, meanAttempts: attempts.reduce((a, b) => a + b, 0) / attempts.length, maxAttempts: Math.max(...attempts) });
console.log([...skel.entries()].sort());
