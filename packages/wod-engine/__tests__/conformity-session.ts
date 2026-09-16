/**
 * Détecteurs P1–P3 des séances Functional / Hybrid (relecture des samples J1).
 * Chaque violation est préfixée `[P<n>]` ; `countSessionByCause` en fait les compteurs.
 */
import type { GeneratedSession, GeneratedWeek, SessionBlockAOption, SessionBlockBOption, SessionStructuredBlock } from '../src';
import { SESSION_SKELETONS, SKILL_STEP_S } from '../src';

export const SESSION_CAUSES = ['P1', 'P2', 'P3'] as const;
export type SessionCause = (typeof SESSION_CAUSES)[number];

const GENERIC_STEP = /hollow \/ arch, scap, kip|la répétition partielle ou assistée/i;

function structuredOf(s: GeneratedSession, kind: SessionStructuredBlock['kind']): SessionStructuredBlock | null {
  for (const b of s.blocks) {
    const j = b.wod_json;
    if ('kind' in j && j.kind === kind) return j;
  }
  return null;
}

function optionA(s: GeneratedSession): SessionBlockAOption | null {
  const sk = SESSION_SKELETONS.find((x) => x.id === s.generator.skeleton_id);
  const a = s.blocks.find((b) => b.block_name === 'strength' || b.block_name === 'skill');
  if (!sk?.block_a || !a || !('option_id' in a.wod_json)) return null;
  return sk.block_a.find((o) => o.id === (a.wod_json as SessionStructuredBlock).option_id) ?? null;
}

function optionB(s: GeneratedSession): SessionBlockBOption | null {
  const sk = SESSION_SKELETONS.find((x) => x.id === s.generator.skeleton_id);
  const b = structuredOf(s, 'building');
  return (b && sk?.block_b?.find((o) => o.id === b.option_id)) ?? null;
}

/** P1 · bloc B : ≠ A (hors complexe), pattern ≠ pattern lourd de A, dans les options du squelette, unique dans la semaine. */
export function p1Violations(week: GeneratedWeek): string[] {
  const out: string[] = [];
  const seen = new Map<string, number>();
  for (const s of week.sessions) {
    const b = optionB(s);
    if (!b) continue;
    const a = optionA(s);
    const aIds = new Set([a?.movement, ...(a?.complex ?? [])].filter((x): x is string => !!x));
    if (aIds.has(b.movement) || aIds.has(b.movement.replace(/^strict_/, ''))) out.push(`[P1] B = A (${b.movement}) jour ${s.day}`);
    if (s.heavy_pattern && b.pattern === s.heavy_pattern) out.push(`[P1] pattern de B = pattern lourd de A (${b.pattern}) jour ${s.day}`);
    const prev = seen.get(b.movement);
    if (prev !== undefined) out.push(`[P1] B répété dans la semaine (${b.movement}) jours ${prev} et ${s.day}`);
    seen.set(b.movement, s.day);
  }
  return out;
}

/** P2 · finisher : unique dans la semaine, absent des 4 semaines précédentes. */
export function p2Violations(week: GeneratedWeek, previousWeeks: GeneratedWeek[]): string[] {
  const out: string[] = [];
  const recent = new Set(previousWeeks.slice(-4).flatMap((w) => w.sessions.map((s) => s.finisher_id).filter((x): x is string => !!x)));
  const seen = new Map<string, number>();
  for (const s of week.sessions) {
    if (!s.finisher_id) continue;
    if (recent.has(s.finisher_id)) out.push(`[P2] finisher des 4 semaines précédentes (${s.finisher_id}) semaine ${week.iso_week} jour ${s.day}`);
    const prev = seen.get(s.finisher_id);
    if (prev !== undefined) out.push(`[P2] finisher répété dans la semaine (${s.finisher_id}) jours ${prev} et ${s.day}`);
    seen.set(s.finisher_id, s.day);
  }
  return out;
}

/** P3 · skill : étapes A et B propres au skill (pas de texte générique), rendues avec leur durée. */
export function p3Violations(week: GeneratedWeek): string[] {
  const out: string[] = [];
  for (const s of week.sessions) {
    const skill = s.blocks.find((b) => b.block_name === 'skill');
    if (!skill) continue;
    const a = optionA(s);
    if (!a?.skill) { out.push(`[P3] skill sans option A jour ${s.day}`); continue; }
    if (GENERIC_STEP.test(skill.description)) out.push(`[P3] progression générique (${a.id})`);
    if (!skill.description.includes(`Étape A : ${a.skill.progression.a}`)) out.push(`[P3] étape A absente du rendu (${a.id})`);
    if (!skill.description.includes(`Étape B : ${a.skill.progression.b}`)) out.push(`[P3] étape B absente du rendu (${a.id})`);
    if (!skill.description.includes(`${SKILL_STEP_S / 60}'`)) out.push(`[P3] durée des étapes absente (${a.id})`);
  }
  return out;
}

export function sessionViolations(week: GeneratedWeek, previousWeeks: GeneratedWeek[]): string[] {
  return [...p1Violations(week), ...p2Violations(week, previousWeeks), ...p3Violations(week)];
}

export function countSessionByCause(violations: string[]): Record<SessionCause, number> {
  const out = Object.fromEntries(SESSION_CAUSES.map((c) => [c, 0])) as Record<SessionCause, number>;
  for (const v of violations) {
    const m = /^\[(P\d+)\]/.exec(v);
    if (m && m[1] in out) out[m[1] as SessionCause]++;
  }
  return out;
}
