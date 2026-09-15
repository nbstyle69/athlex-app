import { generateBlocC, CATALOG_SNAPSHOT, BANK_V1 } from '../src';
import type { GenerateParams } from '../src';
for (const sk of BANK_V1.skeletons) {
  const bank = { ...BANK_V1, skeletons: [sk] };
  const p: GenerateParams = { entry: 'express', discipline: sk.discipline, budget_min: sk.durations[0], intention: sk.intentions[0], format: 'surprise', vest: sk.discipline === 'hybrid' ? 'optional' : undefined };
  try { const w = generateBlocC(p, CATALOG_SNAPSHOT, bank, 7); console.log(`\n### ${sk.id} (${p.budget_min}' ${p.intention}) — ${w.title}\n${w.description}\nest=${w.estimate.reference_minutes.toFixed(1)} cap=${w.time_cap_seconds} rounds=${w.rounds} wod_type=${w.wod_type}`); }
  catch (e: any) { console.log(`\n### ${sk.id} KO`, JSON.stringify(e.reasons ?? e.message)); }
}
