// Génère samples.md : 10 WODs rendus par intention × discipline, pour relecture.
// Usage : npx tsx packages/wod-engine/scripts/samples.ts > packages/wod-engine/samples.md
// Régénération ciblée (mêmes seeds, lues dans le fichier existant) :
//   npx tsx packages/wod-engine/scripts/samples.ts --only 5,11,24 packages/wod-engine/samples.md
import { readFileSync } from 'fs';
import { generateBlocC, CATALOG_SNAPSHOT, BANK_V1, CATEGORY_LABEL, categoriesFor, BANK_VERSION, ENGINE_VERSION } from '../src';
import type { GenerateParams, Intention, FormatChoice, Vest, Discipline, GeneratedWod } from '../src';

const F_INT: Intention[] = ['mixed', 'cardio', 'force', 'gym'];
const H_INT: Intention[] = ['interval', 'engine', 'aerobic', 'run', 'core'];
const F_DUR = [8, 12, 15, 20, 30];
const H_DUR = [15, 20, 30, 45];
const FMTS: FormatChoice[] = ['surprise', 'amrap', 'for_time', 'emom', 'chipper', 'stations', 'interval', 'surprise'];
const VESTS: Vest[] = ['none', 'optional', 'required'];
const DAY = ['Back Squat', 'Thruster', 'Pull-ups'];

function plan(discipline: Discipline, intention: Intention, k: number): GenerateParams {
  const durs = discipline === 'functional' ? F_DUR : H_DUR;
  if (k >= 8) {
    return {
      entry: 'after_class', discipline, budget_min: [10, 15, 20][k - 8], intention, format: 'surprise',
      after_class: { day_movements: DAY }, vest: discipline === 'hybrid' ? 'none' : undefined,
    };
  }
  return {
    entry: 'express', discipline, budget_min: durs[k % durs.length], intention, format: FMTS[k % FMTS.length],
    vest: discipline === 'hybrid' ? VESTS[k % VESTS.length] : undefined,
  };
}

const LABEL: Record<string, string> = {
  express: 'Express', after_class: 'Après la classe', functional: 'Functional', hybrid: 'Hybrid',
  surprise: 'Surprise', amrap: 'AMRAP', for_time: 'For time', emom: 'EMOM', chipper: 'Chipper', stations: 'Stations', interval: 'Intervalles',
  none: 'sans gilet', optional: 'gilet optionnel', required: 'gilet obligatoire',
};

/** Bloc markdown d'un WOD (du titre `####` à la ligne de métadonnées incluse). */
function renderSample(n: number, p: GenerateParams, w: GeneratedWod, seed: number): string[] {
  const out: string[] = [];
  const entrees = [
    LABEL[p.entry], LABEL[p.discipline], `${p.budget_min}'`, `intention ${p.intention}`, `format ${LABEL[p.format ?? 'surprise']}`,
    p.vest ? LABEL[p.vest] : null,
    p.after_class ? `WOD du jour : ${p.after_class.day_movements.join(', ')}` : null,
  ].filter(Boolean).join(' · ');
  out.push(`#### ${n}. ${w.title}`);
  out.push('');
  out.push(`**Entrées** : ${entrees}`);
  out.push('');
  out.push('```');
  out.push(w.description);
  out.push('```');
  out.push('');
  const est = categoriesFor(p.discipline).map((c) => `${CATEGORY_LABEL[c]} ${w.estimate.by_category[c]!.minutes.toFixed(1)}' (${w.estimate.by_category[c]!.target})`).join(' · ');
  out.push(`Estimation : ${est}${w.blocks[0].timecap != null ? ` · cap ${Math.floor(w.blocks[0].timecap / 60)}:${String(w.blocks[0].timecap % 60).padStart(2, '0')}` : ''}`);
  out.push('');
  const relax = w.generator.relaxations.length ? ` · relâché : ${w.generator.relaxations.join(', ')}` : '';
  out.push(`_Squelette \`${w.generator.skeleton_id}\` · seed ${seed} · tirage ${w.generator.attempts}${relax} · signature \`${w.signature}\`_`);
  return out;
}

/** Plans dans l'ordre du fichier : n (1-based) → paramètres. */
function allPlans(): GenerateParams[] {
  const plans: GenerateParams[] = [];
  for (const discipline of ['functional', 'hybrid'] as const) {
    for (const intention of discipline === 'functional' ? F_INT : H_INT) {
      for (let k = 0; k < 10; k++) plans.push(plan(discipline, intention, k));
    }
  }
  return plans;
}

function full(): string {
  const out: string[] = [];
  out.push('# Échantillon générateur — 10 WODs par intention × discipline');
  out.push('');
  out.push(`Moteur ${ENGINE_VERSION} · catalogue v${CATALOG_SNAPSHOT.version} · banque v${BANK_VERSION}. Sortie texte telle que l'athlète la lirait (\`title\` + \`description\`), suivie de l'estimation par catégorie et des métadonnées du tirage. Tout est régénérable à l'identique depuis la seed.`);
  out.push('');
  let n = 0;
  const seen = new Set<string>();
  for (const discipline of ['functional', 'hybrid'] as const) {
    out.push(`## ${LABEL[discipline]}`);
    out.push('');
    for (const intention of discipline === 'functional' ? F_INT : H_INT) {
      out.push(`### ${LABEL[discipline]} · ${intention}`);
      out.push('');
      for (let k = 0; k < 10; k++) {
        const p = plan(discipline, intention, k);
        let seed = 1000 + n * 7;
        let w = generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, seed);
        for (let tries = 0; tries < 30 && seen.has(w.generator.skeleton_id + w.signature); tries++) {
          seed++;
          w = generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, seed);
        }
        process.stderr.write(`${discipline}/${intention}#${k} ${w.generator.skeleton_id}\n`);
        seen.add(w.generator.skeleton_id + w.signature);
        n++;
        out.push(...renderSample(n, p, w, seed), '');
      }
    }
  }
  return out.join('\n');
}

/** Remplace uniquement les WODs listés, à la seed lue dans le fichier existant. */
function only(list: number[], file: string): string {
  const src = readFileSync(file, 'utf8');
  const plans = allPlans();
  const version = `Moteur ${ENGINE_VERSION} · catalogue v${CATALOG_SNAPSHOT.version} · banque v${BANK_VERSION}.`;
  let text = src.replace(/^Moteur .*?banque v\d+\./m, version);
  for (const n of list) {
    const re = new RegExp(`^#### ${n}\\. [\\s\\S]*?^_Squelette .*? · seed (\\d+) · .*$`, 'm');
    const m = re.exec(text);
    if (!m) throw new Error(`WOD #${n} introuvable dans ${file}`);
    const seed = Number(m[1]);
    const p = plans[n - 1];
    const w = generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, seed);
    process.stderr.write(`#${n} seed ${seed} ${w.generator.skeleton_id}\n`);
    text = text.slice(0, m.index) + renderSample(n, p, w, seed).join('\n') + text.slice(m.index + m[0].length);
  }
  return text;
}

const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
if (onlyIdx >= 0) {
  const list = argv[onlyIdx + 1].split(',').map(Number);
  process.stdout.write(only(list, argv[onlyIdx + 2]));
} else {
  process.stdout.write(full());
}
