/**
 * B10 (lot B) — les records gymniques du profil pilotent le générateur.
 *
 * Sans record : comportement par catégorie, inchangé. Avec 12 tractions et
 * 0 muscle-up : aucun muscle-up tiré, volume de tractions ≤ 7 par WOD. Profil
 * complet : rien ne change.
 */
import { generateBlocC, CATALOG_SNAPSHOT, BANK_V1, GYM_RECORD_FRACTION } from '../src';
import type { GenerateParams, GeneratedWod } from '../src';

const base: GenerateParams = { entry: 'express', discipline: 'functional', budget_min: 15, intention: 'gym', profile_category: 'rx' };
const draw = (p: GenerateParams, seed: number): GeneratedWod | null => { try { return generateBlocC(p, CATALOG_SNAPSHOT, BANK_V1, seed); } catch { return null; } };
/** Plus grosse série ou plus gros round du mouvement dans le WOD. */
const perSetOf = (w: GeneratedWod, id: string): number =>
  Math.max(0, ...w.blocks[0].movements.filter((m) => m.id === id).map((m) => (m.scheme ? Math.max(...m.scheme) : m.qty)));
const idsOf = (w: GeneratedWod) => w.blocks[0].movements.map((m) => m.id);

describe('B10 — records gymniques', () => {
  it('la règle est 50 % du record par série ou par round', () => {
    expect(GYM_RECORD_FRACTION).toBe(0.5);
  });

  it('profil sans aucun record gym : même sortie que sans le champ (200 tirages)', () => {
    for (let i = 0; i < 200; i++) {
      const a = draw(base, 3000 + i);
      const b = draw({ ...base, gym_records: undefined }, 3000 + i);
      const c = draw({ ...base, gym_records: {} }, 3000 + i);
      expect(b?.signature ?? null).toBe(a?.signature ?? null);
      expect(c?.signature ?? null).toBe(a?.signature ?? null);
    }
  });

  it('12 tractions, 0 muscle-up : aucun muscle-up ni chest-to-bar tiré, jamais plus de 6 tractions par série ou par round (400 tirages)', () => {
    const gym_records = { pull_up: 12, chest_to_bar: 0, bar_muscle_up: 0, ring_muscle_up: 0, toes_to_bar: 0, handstand_push_up: 0, strict_handstand_push_up: 0, ring_dip: 0 };
    let strictes = 0;
    for (let i = 0; i < 400; i++) {
      const w = draw({ ...base, budget_min: [8, 12, 15, 20][i % 4], intention: (['gym', 'mixed'] as const)[i % 2], gym_records }, 4000 + i);
      if (!w) continue;
      for (const id of idsOf(w)) expect(['ring_muscle_up', 'bar_muscle_up', 'chest_to_bar', 'toes_to_bar', 'handstand_push_up', 'strict_handstand_push_up', 'ring_dip']).not.toContain(id);
      if (idsOf(w).includes('pull_up')) { strictes++; expect(perSetOf(w, 'pull_up')).toBeLessThanOrEqual(6); }
    }
    expect(strictes).toBeGreaterThan(0);
  });

  it('record 30 : des tractions strictes sortent, jamais plus de 15 par série ou par round', () => {
    let strictes = 0;
    for (let i = 0; i < 400; i++) {
      const w = draw({ ...base, budget_min: [8, 12, 15, 20][i % 4], gym_records: { pull_up: 30 } }, 9000 + i);
      if (!w) continue;
      if (idsOf(w).includes('pull_up')) { strictes++; expect(perSetOf(w, 'pull_up')).toBeLessThanOrEqual(15); }
    }
    expect(strictes).toBeGreaterThan(30);
  });

  it("un muscle-up sans record descend sa chaîne : chest-to-bar (record 20) borné à 10 par série, jamais de muscle-up", () => {
    const gym_records = { pull_up: 30, chest_to_bar: 20, bar_muscle_up: 0, ring_muscle_up: 0 };
    let c2b = 0;
    for (let i = 0; i < 300; i++) {
      const w = draw({ ...base, budget_min: [8, 12, 15][i % 3], gym_records }, 5000 + i);
      if (!w) continue;
      expect(idsOf(w)).not.toContain('ring_muscle_up');
      expect(idsOf(w)).not.toContain('bar_muscle_up');
      if (idsOf(w).includes('chest_to_bar')) { c2b++; expect(perSetOf(w, 'chest_to_bar')).toBeLessThanOrEqual(10); }
    }
    expect(c2b).toBeGreaterThan(0);
  });

  it('profil complet, records élevés : comportement RX normal, même sortie (200 tirages)', () => {
    const gym_records = { pull_up: 200, chest_to_bar: 200, bar_muscle_up: 200, ring_muscle_up: 200, toes_to_bar: 200, handstand_push_up: 200, strict_handstand_push_up: 200, ring_dip: 200 };
    for (let i = 0; i < 200; i++) {
      const a = draw(base, 6000 + i);
      const b = draw({ ...base, gym_records }, 6000 + i);
      expect(b?.signature ?? null).toBe(a?.signature ?? null);
    }
  });
});
