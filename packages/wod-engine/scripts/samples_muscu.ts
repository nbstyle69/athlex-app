// Génère samples-musculation.md : 5 séances rendues par cible × objectif + 10 « Après ma classe », pour relecture.
// Usage : npx tsx packages/wod-engine/scripts/samples_muscu.ts > packages/wod-engine/samples-musculation.md
import {
  generateMuscu, targetAvailable, availableTargets, afterClassMuscles, CATALOG_SNAPSHOT, BANK_V1, MUSCU_TARGETS, MUSCU_OBJECTIVES,
  MUSCU_DURATIONS, MUSCU_ENGINE_VERSION, MUSCU_BANK_VERSION, TARGET_LABEL, OBJECTIVE_LABEL, EQUIPMENT_LABEL, LEVEL_LABEL,
} from '../src';
import type { MuscuParams, MuscuEquipment, MuscuLevel, MuscuWod, RmReference } from '../src';

const EQ: MuscuEquipment[] = ['gym', 'box', 'none', 'gym', 'box'];
const LV: MuscuLevel[] = ['inter', 'avance', 'debutant', 'debutant', 'inter'];
const RM: Array<Partial<Record<RmReference, number>> | null> = [
  { back_squat: 110, deadlift: 140, bench: 85, press: 55, hip_thrust: 150 }, null, null, null, { back_squat: 140, deadlift: 180, bench: 105, press: 65, hip_thrust: 190 },
];
// poids de corps connu sur la 1re et la 5e (lest des tractions / dips = 10 %), inconnu ailleurs (« lesté léger »)
const BW: Array<number | null> = [72, null, null, null, 88];
const AFTER_CLASS = [
  ['Back Squat', 'Thruster'], ['Pull-ups', 'Push-ups', 'Strict Press'], ['Deadlift', 'Box Jumps', 'Run 400 m'],
  ['Wall Balls', 'Row', 'Burpees'], ['Bench Press', 'Toes-to-Bar'], ['Clean & Jerk', 'Double-Unders'],
  ['Handstand Push-ups', 'Ring Rows'], ['Front Squat', 'Kettlebell Swings'], ['Run 800 m', 'Sit-ups'], ['Snatch', 'Bar Muscle-ups'],
];

const out: string[] = [];
const p = (s = '') => out.push(s);
let idx = 0;

function block(params: MuscuParams, seed: number, w: MuscuWod) {
  idx++;
  const ac = params.entry === 'after_class' ? ` · après « ${params.after_class!.day_movements.join(' + ')} »` : '';
  p(`### #${idx} — ${TARGET_LABEL[params.target]} · ${OBJECTIVE_LABEL[params.objective]} · ${params.budget_min}' · ${EQUIPMENT_LABEL[params.equipment]} · ${LEVEL_LABEL[params.level]}${ac}`);
  p();
  p(`seed \`${seed}\` · squelette \`${w.generator.skeleton_id}\` · 1RM ${params.one_rep_max ? 'connus (' + Object.entries(params.one_rep_max).map(([k, v]) => `${k} ${v}`).join(', ') + ')' : 'inconnus'}${params.bodyweight_kg ? ` · PdC ${params.bodyweight_kg} kg` : ''}` +
    (w.generator.relaxations.length ? ` · relâchements : ${w.generator.relaxations.join(', ')}` : '') +
    (w.after_class ? ` · muscles exclus : ${w.after_class.excluded_muscles.join(', ') || 'aucun'} · cible suggérée : ${w.after_class.suggested_target ? TARGET_LABEL[w.after_class.suggested_target] : 'aucune (Tronc par défaut)'}` : ''));
  p();
  p('```');
  p(w.description);
  p('```');
  p();
}

p('# Échantillons — Générateur Musculation V1 (M1)');
p();
p(`Moteur \`${MUSCU_ENGINE_VERSION}\` · banque musculation v${MUSCU_BANK_VERSION} · catalogue v${CATALOG_SNAPSHOT.version} (${CATALOG_SNAPSHOT.movements.filter((m) => m.muscu).length} exercices).`);
p('5 séances par cible × objectif (matériel, niveau et durée variés, 1RM et poids de corps connus sur la 1re et la 5e), puis 10 « Après ma classe ».');
p('Une combinaison absente est une cible indisponible avec ce matériel (sans matériel : Pull, Dos, Épaules, Bras — trop peu d’exercices poids du corps sur deux muscles distincts ; Force sans matériel exclue par le brief).');
p();
p('Cibles disponibles par matériel × niveau :');
p();
for (const eq of ['none', 'box', 'gym'] as const) for (const lv of ['debutant', 'inter', 'avance'] as const) {
  const miss = MUSCU_TARGETS.filter((t) => !availableTargets(CATALOG_SNAPSHOT, eq, lv).includes(t));
  p(`- ${EQUIPMENT_LABEL[eq]} · ${LEVEL_LABEL[lv]} : ${miss.length ? 'toutes sauf ' + miss.map((t) => TARGET_LABEL[t]).join(', ') : 'toutes'}`);
}
p();

for (const target of MUSCU_TARGETS) {
  p(`## ${TARGET_LABEL[target]}`);
  p();
  for (const objective of MUSCU_OBJECTIVES) {
    for (let k = 0; k < 5; k++) {
      let equipment = EQ[k];
      const level = LV[k];
      if (objective === 'force' && equipment === 'none') equipment = 'box';
      if (!targetAvailable(CATALOG_SNAPSHOT, target, equipment, level)) equipment = 'box';
      if (target === 'tronc' && objective === 'force') {
        // M8 : Force grisée en Tronc — numéro (et graine) réservés pour ne pas décaler les entrées suivantes
        idx++;
        p(`### #${idx} — ${TARGET_LABEL[target]} · ${OBJECTIVE_LABEL[objective]} — indisponible (M8 : pas d’objectif Force en Tronc)`);
        p();
        continue;
      }
      const durations = target === 'tronc' ? MUSCU_DURATIONS.tronc : MUSCU_DURATIONS.express;
      const budget_min = durations[(k + MUSCU_TARGETS.indexOf(target)) % durations.length];
      const params: MuscuParams = { entry: 'express', target, objective, equipment, level, budget_min, one_rep_max: level === 'debutant' ? null : RM[k], bodyweight_kg: level === 'debutant' ? null : BW[k] };
      const seed = 1000 + idx;
      block(params, seed, generateMuscu(params, CATALOG_SNAPSHOT, BANK_V1, seed));
    }
  }
}

p('## Après ma classe');
p();
for (let k = 0; k < AFTER_CLASS.length; k++) {
  const day = AFTER_CLASS[k];
  const equipment: MuscuEquipment = k % 3 === 0 ? 'gym' : 'box';
  const level = LV[k % LV.length];
  const budget_min = MUSCU_DURATIONS.after_class[k % MUSCU_DURATIONS.after_class.length];
  const objective = k % 2 ? 'endurance' : 'hypertrophie';
  // cible = celle suggérée par le moteur à partir des muscles du WOD du jour (Tronc si tout est pris)
  const ac = afterClassMuscles(CATALOG_SNAPSHOT, { day_movements: day });
  const params: MuscuParams = { entry: 'after_class', target: ac.suggested_target ?? 'tronc', objective, equipment, level, budget_min, after_class: { day_movements: day }, one_rep_max: RM[k % RM.length], bodyweight_kg: BW[k % BW.length] };
  const seed = 2000 + k;
  block(params, seed, generateMuscu(params, CATALOG_SNAPSHOT, BANK_V1, seed));
}

process.stdout.write(out.join('\n') + '\n');
