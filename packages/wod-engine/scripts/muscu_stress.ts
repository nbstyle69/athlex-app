import { generateMuscu, targetAvailable, CATALOG_SNAPSHOT, BANK_V1, MUSCU_TARGETS, MUSCU_OBJECTIVES, MUSCU_DURATIONS } from '../src';
import type { MuscuEquipment, MuscuLevel, MuscuParams } from '../src';

const relax: Record<string, number> = {};
let n = 0; let out = 0;
const eqs: MuscuEquipment[] = ['none', 'box', 'gym'];
const lvls: MuscuLevel[] = ['debutant', 'inter', 'avance'];
for (const target of MUSCU_TARGETS) for (const objective of MUSCU_OBJECTIVES) for (const equipment of eqs) for (const level of lvls) for (const budget_min of MUSCU_DURATIONS.express) {
  if (objective === 'force' && equipment === 'none') continue;
  if (!targetAvailable(CATALOG_SNAPSHOT, target, equipment, level)) continue;
  for (let seed = 1; seed <= (process.argv[2] ? Number(process.argv[2]) : 5); seed++) {
    const p: MuscuParams = { entry: 'express', target, objective, equipment, level, budget_min };
    const w = generateMuscu(p, CATALOG_SNAPSHOT, BANK_V1, seed);
    n++;
    const dev = Math.abs(w.estimate.seconds - budget_min * 60) / (budget_min * 60);
    if (dev > 0.10) { out++; if (out < 6) console.log('OUT', target, objective, equipment, level, budget_min, seed, w.estimate.minutes, w.generator.relaxations.join(','), w.blocks[0].exercises.map((e) => `${e.name} ${e.sets}x${e.reps}`).join(' | ')); }
    for (const r of w.generator.relaxations) relax[r] = (relax[r] ?? 0) + 1;
  }
}
console.log({ n, out, relax });
const w = generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', equipment: 'gym', level: 'inter', budget_min: 45, one_rep_max: { bench: 90, press: 55 } }, CATALOG_SNAPSHOT, BANK_V1, 3);
console.log(w.description);
console.log(JSON.stringify(w.generator));
