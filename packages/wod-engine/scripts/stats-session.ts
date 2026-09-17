import { CATALOG_SNAPSHOT } from '../src/catalog/snapshot';
import { BANK_V1 } from '../src/bank';
import { generateWeek, generateMuscuWeek, hashSeed } from '../src/session';

const relax = new Map<string, number>();
const tot = new Map<number, number[]>();
let sigDup = 0; let consecutive = 0; let gymOver = 0; let muscuOver = 0; const mrelax = new Map<string, number>();
const recent: string[] = [];
for (let w = 1; w <= 52; w++) {
  const seed = hashSeed('box-stats', 2027, w);
  const week = generateWeek({ iso_year: 2027, iso_week: w, recent_signatures: recent.slice(-24) }, CATALOG_SNAPSHOT, BANK_V1, seed);
  for (const r of week.relaxations) relax.set(r, (relax.get(r) ?? 0) + 1);
  const sigs = new Set<string>();
  for (const s of week.sessions) {
    if (recent.slice(-24).includes(s.signature) || sigs.has(s.signature)) sigDup++;
    sigs.add(s.signature);
    (tot.get(s.day) ?? tot.set(s.day, []).get(s.day)!).push(s.total_minutes);
    for (const r of s.generator.relaxations) relax.set(`d${s.day}:${r}`, (relax.get(`d${s.day}:${r}`) ?? 0) + 1);
  }
  for (let i = 1; i < week.sessions.length; i++) {
    if (week.sessions[i].bloc_c!.generator.skeleton_id === week.sessions[i - 1].bloc_c!.generator.skeleton_id) consecutive++;
  }
  if (week.gym_volume.pull > 150 || week.gym_volume.hspu > 80) gymOver++;
  recent.push(...week.sessions.map((s) => s.signature));
  const m = generateMuscuWeek({ iso_year: 2027, iso_week: w }, CATALOG_SNAPSHOT, BANK_V1, seed);
  for (const r of m.relaxations) mrelax.set(r.replace(/^[a-z_]+:/, ''), (mrelax.get(r.replace(/^[a-z_]+:/, '')) ?? 0) + 1);
  if (Object.values(m.sets_by_muscle).some((n) => (n ?? 0) > 16)) muscuOver++;
}
console.log('relax', [...relax.entries()].sort());
for (const [d, arr] of tot) console.log('day', d, 'min', Math.min(...arr), 'max', Math.max(...arr), 'mean', (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
console.log({ sigDup, consecutive, gymOver, muscuOver });
console.log('muscu relax', [...mrelax.entries()].sort());
