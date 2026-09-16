// Génère samples-programmation.md : 2 semaines complètes Functional / Hybrid (12 séances)
// et 2 semaines complètes Musculation (10 séances), telles que la fonction edge
// `generate-box-week` les poserait dans `box_wods` pour une box fictive.
// Usage : npx tsx packages/wod-engine/scripts/samples_session.ts > packages/wod-engine/samples-programmation.md
import {
  generateWeek, generateMuscuWeek, weekSeed, weekDates, revealAt, muscuObjectiveForWeek, renderMuscu,
  CATALOG_SNAPSHOT, BANK_V1, DAY_LABEL, SESSION_ENGINE_VERSION, SESSION_BANK_VERSION, WEEKLY_GYM_CAPS,
  MUSCU_WEEKLY_CAP_SETS, TARGET_LABEL, OBJECTIVE_LABEL, TRACK_LABEL,
} from '../src';
import type { GeneratedSession, GeneratedWeek, GeneratedMuscuWeek } from '../src';

const BOX_ID = '00000000-0000-4000-8000-00000000f17e'; // box fictive « AthleX Fitness (échantillon) »
const YEAR = 2026;
const CF_WEEKS = [40, 41];
const MU_WEEKS = [40, 43]; // deux objectifs différents du cycle (hypertrophie / force)

const out: string[] = [];
const p = (s = '') => out.push(s);
const BLOCK_LABEL: Record<string, string> = {
  warmup: 'Échauffement', strength: 'Bloc A', weightlifting: 'Bloc A', skill: 'Bloc A', building: 'Bloc B', wod: 'Bloc C', finisher: 'Finisher',
};

function session(s: GeneratedSession, date: string, idx: number) {
  const relax = s.generator.relaxations;
  p(`### #${idx} — ${DAY_LABEL[s.day]} ${date} · ${s.label} · ${s.total_minutes}' (budget ${s.budget_min}')`);
  p();
  p(`squelette \`${s.generator.skeleton_id}\` · bloc C \`${s.bloc_c.generator.skeleton_id}\` · intention **${s.bloc_c.intention}** · pattern lourd écarté du C : ${s.heavy_pattern ?? 'aucun'}` +
    ` · signature \`${s.signature}\`` + (relax.length ? ` · **relâchements : ${relax.join(', ')}**` : ' · aucun relâchement'));
  p();
  for (const b of s.blocks) {
    p(`**${BLOCK_LABEL[b.block_name] ?? b.block_name} · ${b.minutes}' · ${b.title}**` + (b.block_name === 'wod' ? ` · leaderboard ${b.leaderboard_enabled ? 'oui' : 'non'}` : ''));
    p();
    p('```');
    p(b.description);
    p('```');
    if (b.notes) { p(); p(`_${b.notes}_`); }
    p();
  }
}

function cfWeek(w: GeneratedWeek, idx: { n: number }) {
  const dates = weekDates(w.iso_year, w.iso_week);
  p(`## ${TRACK_LABEL.functional} — ${w.iso_year}-W${String(w.iso_week).padStart(2, '0')} (lundi ${dates[0]})`);
  p();
  p(`seed \`${w.seed}\` · publication \`publish_at = ${revealAt(w.iso_year, w.iso_week)}\` (dimanche 18:00 Paris) · volume gym RX de la semaine : pull ${w.gym_volume.pull}/${WEEKLY_GYM_CAPS.pull}, HSPU ${w.gym_volume.hspu}/${WEEKLY_GYM_CAPS.hspu}` +
    (w.relaxations.length ? ` · **relâchements semaine : ${w.relaxations.join(', ')}**` : ' · aucun relâchement semaine'));
  p();
  for (const s of w.sessions) { idx.n++; session(s, dates[s.day - 1], idx.n); }
}

function muWeek(w: GeneratedMuscuWeek, idx: { n: number }) {
  const dates = weekDates(w.iso_year, w.iso_week);
  p(`## ${TRACK_LABEL.musculation} — ${w.iso_year}-W${String(w.iso_week).padStart(2, '0')} (lundi ${dates[0]}) · objectif **${OBJECTIVE_LABEL[w.objective]}**`);
  p();
  const sets = Object.entries(w.sets_by_muscle).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([m, n]) => `${m} ${n}`).join(', ');
  p(`seed \`${w.seed}\` · publication \`publish_at = ${revealAt(w.iso_year, w.iso_week)}\` · leaderboard désactivé sur les 5 séances · séries hebdo par muscle principal (plafond ${MUSCU_WEEKLY_CAP_SETS}) : ${sets}` +
    (w.relaxations.length ? ` · **relâchements semaine : ${w.relaxations.join(', ')}**` : ' · aucun relâchement semaine'));
  p();
  for (const d of w.days) {
    idx.n++;
    const relax = d.wod.generator.relaxations;
    p(`### #${idx.n} — ${DAY_LABEL[d.day]} ${dates[d.day - 1]} · ${TARGET_LABEL[d.target]} · ${OBJECTIVE_LABEL[w.objective]} · ${d.wod.estimate.minutes}' (budget ${d.budget_min}')`);
    p();
    p(`squelette \`${d.wod.generator.skeleton_id}\` · signature \`${d.wod.signature}\`` + (relax.length ? ` · **relâchements : ${relax.join(', ')}**` : ' · aucun relâchement'));
    p();
    p('```');
    p(renderMuscu(d.wod));
    p('```');
    p();
  }
}

p('# Échantillons — Programmation automatique AthleX Fitness (J1)');
p();
p(`Moteur séance \`${SESSION_ENGINE_VERSION}\` · banque séance v${SESSION_BANK_VERSION} · catalogue v${CATALOG_SNAPSHOT.version}. Box fictive \`${BOX_ID}\`, seed = hash(box, piste, année ISO, semaine ISO, regen 0) — exactement ce que \`generate-box-week\` poserait dans \`box_wods\` (source \`auto\`, audience \`all\`).`);
p();
p('Deux semaines consécutives Functional / Hybrid (la seconde reçoit les signatures de la première en anti-répétition), puis deux semaines Musculation sur deux objectifs du cycle. Les relâchements sont imprimés tels que journalisés dans `box_auto_programming_runs.relaxations`.');
p();
p('Cycle Musculation par semaine ISO : ' + [1, 2, 3, 4, 5, 6, 7].map((w) => `W${w} ${OBJECTIVE_LABEL[muscuObjectiveForWeek(w)]}`).join(' · '));
p();

const idx = { n: 0 };
let recent: string[] = [];
for (const wk of CF_WEEKS) {
  const w = generateWeek({ iso_year: YEAR, iso_week: wk, recent_signatures: recent }, CATALOG_SNAPSHOT, BANK_V1, weekSeed(BOX_ID, 'functional', YEAR, wk, 0));
  cfWeek(w, idx);
  recent = [...recent, ...w.sessions.map((s) => s.signature)];
}
idx.n = 0;
recent = [];
for (const wk of MU_WEEKS) {
  const w = generateMuscuWeek({ iso_year: YEAR, iso_week: wk, recent_signatures: recent }, CATALOG_SNAPSHOT, BANK_V1, weekSeed(BOX_ID, 'musculation', YEAR, wk, 0));
  muWeek(w, idx);
  recent = [...recent, ...w.days.map((d) => d.wod.signature)];
}

process.stdout.write(out.join('\n') + '\n');
