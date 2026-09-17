/**
 * Échantillons de la piste Hybrid pour relecture :
 *   npx tsx packages/wod-engine/scripts/samples_hybrid.ts > samples-hybrid.md
 *
 * Deux semaines consécutives (la seconde reçoit les signatures de la première en
 * anti-répétition), puis une semaine de simulation complète (`iso_week % 8 === 0`).
 * Les graines sont celles de la fonction edge : hash(box, piste, année, semaine, regen).
 */
import {
  generateWeek, hashSeed, CATALOG_SNAPSHOT, BANK_V1, DAY_LABEL, SESSION_ENGINE_VERSION, SESSION_BANK_VERSION,
  hybridJumpReps, hybridRunMeters, revealAt, weekDates,
} from '../src';
import type { GeneratedWeek } from '../src';

const BOX = '00000000-0000-4000-8000-00000000f17e';
const YEAR = 2026;
const out: string[] = [];
const p = (s = '') => out.push(s);

function renderWeek(w: GeneratedWeek, title: string): void {
  const dates = weekDates(w.iso_year, w.iso_week);
  p(`## ${title}`);
  p();
  p(`seed \`${w.seed}\` · révélation par défaut \`${revealAt(w.iso_year, w.iso_week)}\` (dimanche 18:00 Paris)`);
  p(`course et ergs de la semaine : **${(hybridRunMeters(w.sessions) / 1000).toFixed(1)} km** · répétitions sautées : ${hybridJumpReps(w.sessions)}`);
  p(w.relaxations.length ? `**relâchements : ${w.relaxations.join(', ')}**` : 'aucun relâchement');
  p();
  for (const s of w.sessions) {
    const relax = s.generator.relaxations;
    p(`### ${DAY_LABEL[s.day]} ${dates[s.day - 1]} · ${s.label} · ${s.total_minutes}' (budget ${s.budget_min}')`);
    p();
    p(`squelette \`${s.generator.skeleton_id}\``
      + (s.bloc_c ? ` · bloc de travail \`${s.bloc_c.generator.skeleton_id}\` · intention **${s.bloc_c.intention}** · RPE ${s.bloc_c.stimulus.rpe}` : ' · séance chronométrée, sans bloc tiré')
      + ` · course ${s.run_meters ?? 0} m`
      + (relax.length ? ` · **relâchements : ${relax.join(', ')}**` : ''));
    p();
    for (const b of s.blocks) {
      p(`**${b.block_name} · ${b.title}**${b.leaderboard_enabled ? ' — *classement activé*' : ''}`);
      p();
      p('```');
      p(b.description.trimEnd());
      p('```');
      if (b.notes) p(`> ${b.notes}`);
      p();
    }
  }
}

p('# Échantillons — piste Hybrid (programmation de box)');
p();
p(`Moteur séance \`${SESSION_ENGINE_VERSION}\` · banque séance v${SESSION_BANK_VERSION} · catalogue v${CATALOG_SNAPSHOT.version}.`);
p(`Box fictive \`${BOX}\`, profil de référence Men / Inter — les autres catégories sont dans chaque ligne de mouvement.`);
p();
p('Structure fixe lundi → samedi : intervalles, force et stations, course, engine, course compromise, simulation.');
p('Le bloc de travail est tiré dans la banque Hybrid existante, restreinte par jour ; les blocs A (stations, intervalles de course, enchaînement chronométré) vivent dans les squelettes.');
p();

const journal: string[][] = [];
for (const wk of [40, 41]) {
  const w = generateWeek(
    { iso_year: YEAR, iso_week: wk, track: 'hybrid', recent_signatures: journal.slice(-4).flat() },
    CATALOG_SNAPSHOT, BANK_V1, hashSeed(BOX, 'hybrid', YEAR, wk, 0),
  );
  journal.push(w.signatures);
  renderWeek(w, `${YEAR}-W${wk} (lundi ${weekDates(YEAR, wk)[0]})`);
}

const full = generateWeek(
  { iso_year: YEAR, iso_week: 48, track: 'hybrid', recent_signatures: journal.slice(-4).flat() },
  CATALOG_SNAPSHOT, BANK_V1, hashSeed(BOX, 'hybrid', YEAR, 48, 0),
);
renderWeek(full, `${YEAR}-W48 (lundi ${weekDates(YEAR, 48)[0]}) — semaine de simulation complète`);

console.log(out.join('\n'));
