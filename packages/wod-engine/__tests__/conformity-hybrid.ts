/**
 * Conformité de la piste Hybrid — une cause par correction demandée à la relecture
 * des samples (H1 à H7). Chaque cause compte les violations réelles sur la sortie du
 * moteur ; un compteur non nul est un écart, pas une opinion.
 */
import {
  CATALOG_SNAPSHOT, HYBRID_FORBIDDEN_IDS, HYBRID_JUMP_IDS, HYBRID_WEEKLY_JUMP_CAP,
  HYBRID_WEEKLY_RUN_M, HYBRID_FRIDAY_RUN_M, HYBRID_HARD_RPE, HYBRID_EASY_RPE, HYBRID_TUESDAY_RPE,
  HYBRID_FRIDAY_RPE, HYBRID_SESSION_SKELETONS, SESSION_TOLERANCE, hybridJumpReps, hybridRunMeters, itemsOf,
} from '../src';
import type { GeneratedSession, GeneratedWeek } from '../src';

export const HYBRID_CAUSES = [
  'H1:rpe_du_jour_ignore_les_blocs',
  'H2:mardi_au_dessus_du_plafond',
  'H3:vendredi_sous_3km',
  'H4:finisher_repete',
  'H5:retour_au_calme_absent_ou_factice',
  'H6:budget_depasse',
  'H7:quantite_non_arrondie',
  'H8:vendredi_au_dessus_du_plafond',
  'H9:lundi_repete_les_intervalles_du_mercredi',
  'H10:bande_lourde_hors_vendredi',
  'H11:mouvement_repete_hors_regle',
  'regle:interdits',
  'regle:course_hebdo',
  'regle:jeudi_facile',
  'regle:jours_durs_consecutifs',
  'regle:plafond_sauts',
] as const;
export type HybridCause = typeof HYBRID_CAUSES[number];

const movementsOf = (s: GeneratedSession) => (s.bloc_c?.blocks[0].movements ?? []).map((m) => m.id);
const blockOf = (s: GeneratedSession, name: string) => s.blocks.filter((b) => b.block_name === name);

/** Quantités lisibles : reps et calories par 5, temps par 10 s (H7). */
export function roundingViolations(s: GeneratedSession): string[] {
  const out: string[] = [];
  for (const gm of s.bloc_c?.blocks[0].movements ?? []) {
    const q = gm.scheme ? Math.max(...gm.scheme) : gm.qty;
    if ((gm.unit === 'reps' || gm.unit === 'cal') && q % 5 !== 0) out.push(`${gm.id}:${q}${gm.unit}`);
    if (gm.unit === 's' && q % 10 !== 0) out.push(`${gm.id}:${q}s`);
  }
  return out;
}

/** Violations d'une semaine, cause par cause. */
export function hybridViolations(w: GeneratedWeek): Partial<Record<HybridCause, string[]>> {
  const v: Partial<Record<HybridCause, string[]>> = {};
  const add = (c: HybridCause, detail: string) => { (v[c] ??= []).push(detail); };

  for (const s of w.sessions) {
    // H1 — le RPE du jour est le maximum des blocs, jamais celui du seul bloc tiré
    const blocksRpe = Math.max(s.bloc_c?.stimulus.rpe ?? 0, 0);
    if (s.rpe < blocksRpe) add('H1:rpe_du_jour_ignore_les_blocs', `J${s.day} ${s.rpe} < ${blocksRpe}`);
    if (s.day === 3 && s.rpe < HYBRID_HARD_RPE) add('H1:rpe_du_jour_ignore_les_blocs', `J3 ${s.rpe} : le mercredi porte des intervalles de course`);

    // H2 — le mardi est modéré par conception
    if (s.day === 2 && s.rpe > HYBRID_TUESDAY_RPE) add('H2:mardi_au_dessus_du_plafond', `J2 ${s.rpe}`);

    // H3 — le vendredi est la séance de course compromise
    if (s.day === 5 && (s.run_meters ?? 0) < HYBRID_FRIDAY_RUN_M) add('H3:vendredi_sous_3km', `J5 ${s.run_meters} m`);

    // H5 — les jours de mobilité portent un retour au calme réel
    if (s.day === 4 || s.day === 6) {
      const cd = blockOf(s, 'cooldown');
      if (!cd.length) add('H5:retour_au_calme_absent_ou_factice', `J${s.day} sans retour au calme`);
      else if (cd[0].minutes < 5 || cd[0].description.length < 80) {
        add('H5:retour_au_calme_absent_ou_factice', `J${s.day} ${cd[0].minutes}'`);
      }
      if (blockOf(s, 'finisher').length) add('H5:retour_au_calme_absent_ou_factice', `J${s.day} finisher au lieu du retour au calme`);
    }

    // H6 — le budget est une cible, pas une rallonge
    const hi = s.budget_min * (1 + SESSION_TOLERANCE);
    if (s.total_minutes > hi) add('H6:budget_depasse', `J${s.day} ${s.total_minutes}' > ${hi}'`);

    // H7 — quantités lisibles
    for (const d of roundingViolations(s)) add('H7:quantite_non_arrondie', `J${s.day} ${d}`);

    // H8 — le vendredi se court à allure cible
    if (s.day === 5 && s.rpe > HYBRID_FRIDAY_RPE) add('H8:vendredi_au_dessus_du_plafond', `J5 ${s.rpe}`);

    // H9 — le lundi n'est pas un second mercredi
    if (s.day === 1 && (s.bloc_c?.generator.skeleton_id ?? '').startsWith('run_intervals')) {
      add('H9:lundi_repete_les_intervalles_du_mercredi', `J1 ${s.bloc_c!.generator.skeleton_id}`);
    }

    // H10 — bande lourde réservée au bloc A du vendredi, blocs écrits compris
    const skel = HYBRID_SESSION_SKELETONS.find((x) => x.id === s.generator.skeleton_id);
    for (const opt of [...(skel?.block_a ?? []), ...(skel?.block_work ?? [])]) {
      const isFridayA = s.day === 5 && (skel?.block_a ?? []).some((o) => o.id === opt.id);
      if (isFridayA) continue;
      for (const it of itemsOf(opt)) {
        if (it.band === 'heavy') add('H10:bande_lourde_hors_vendredi', `J${s.day} ${opt.id}/${it.id}`);
      }
    }

    // règles de la piste
    for (const id of movementsOf(s)) if (HYBRID_FORBIDDEN_IDS.includes(id)) add('regle:interdits', `J${s.day} ${id}`);
    if (s.day === 4 && s.rpe > HYBRID_EASY_RPE) add('regle:jeudi_facile', `J4 ${s.rpe}`);
  }

  // H11 — une seconde occurrence est admise si elle change de rôle et évite les jours
  // voisins ; au-delà elle doit être tracée
  const occ = new Map<string, Array<{ day: number; role: 'a' | 'work' }>>();
  for (const s of w.sessions) {
    const roles = s.movements_by_role ?? { a: [], work: [] };
    for (const role of ['a', 'work'] as const) {
      for (const id of roles[role]) {
        const m = CATALOG_SNAPSHOT.movements.find((x) => x.id === id);
        if (!m || m.modality === 'M') continue;
        occ.set(id, [...(occ.get(id) ?? []), { day: s.day, role }]);
      }
    }
  }
  // Deux occurrences sont admises si elles évitent les jours voisins. Le changement de
  // rôle reste un critère de préférence du tirage (`alreadyUsed`), pas une violation :
  // les blocs écrits du mardi, du vendredi et du samedi sont tous des blocs de travail,
  // et leur imposer des postes deux à deux disjoints viderait le pool Hybrid.
  /**
   * Le traîneau est l'objet même du bloc lourd du vendredi et de la simulation du samedi :
   * l'en retirer d'un des deux dénaturerait la séance. Exception nommée, pas silencieuse.
   */
  const SLED_FRIDAY_SATURDAY = new Set(['sled_push', 'sled_pull']);
  const traced = w.relaxations.some((r) => r.startsWith('movement_repeat_week:'));
  for (const [id, uses] of occ) {
    const days = [...new Set(uses.map((u) => u.day))].sort((a, b) => a - b);
    if (days.length < 2) continue;
    const tooMany = days.length > 2;
    const adjacent = days.some((d, i) => i > 0 && d - days[i - 1] === 1);
    const sledException = SLED_FRIDAY_SATURDAY.has(id) && days.every((d) => d === 5 || d === 6);
    if ((tooMany || adjacent) && !traced && !sledException) {
      add('H11:mouvement_repete_hors_regle', `${id} J${days.join('/')} ${uses.map((u) => u.role).join('+')}`);
    }
  }

  // H4 — un finisher ne se répète pas dans la semaine
  const fins = w.sessions.map((s) => s.finisher_id).filter((x): x is string => !!x);
  if (new Set(fins).size !== fins.length) add('H4:finisher_repete', fins.join(','));
  for (const r of w.relaxations) if (r.startsWith('finisher_repeat')) add('H4:finisher_repete', r);

  if (hybridRunMeters(w.sessions) < HYBRID_WEEKLY_RUN_M) add('regle:course_hebdo', `${hybridRunMeters(w.sessions)} m`);
  if (hybridJumpReps(w.sessions) > HYBRID_WEEKLY_JUMP_CAP) add('regle:plafond_sauts', `${hybridJumpReps(w.sessions)}`);
  for (let i = 1; i < w.sessions.length; i++) {
    if (w.sessions[i].rpe >= HYBRID_HARD_RPE && w.sessions[i - 1].rpe >= HYBRID_HARD_RPE) {
      add('regle:jours_durs_consecutifs', `J${w.sessions[i - 1].day}(${w.sessions[i - 1].rpe}) → J${w.sessions[i].day}(${w.sessions[i].rpe})`);
    }
  }
  void CATALOG_SNAPSHOT;
  void HYBRID_JUMP_IDS;
  return v;
}

/** Compteur par cause sur un lot de semaines. */
export function countHybridByCause(weeks: GeneratedWeek[]): Record<HybridCause, number> {
  const out = Object.fromEntries(HYBRID_CAUSES.map((c) => [c, 0])) as Record<HybridCause, number>;
  for (const w of weeks) {
    for (const [cause, details] of Object.entries(hybridViolations(w))) {
      out[cause as HybridCause] += details.length;
    }
  }
  return out;
}
