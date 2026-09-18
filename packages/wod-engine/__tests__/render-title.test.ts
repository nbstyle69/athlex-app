/**
 * G2 — le titre garde trois mouvements et DIT quand il en reste.
 * « EMOM 8 · FRONT SQUAT / RING DIPS / BIKE ERG » cachait un quatrième
 * mouvement ; il affiche désormais « … / BIKE ERG +1 ».
 */
import { generateBlocC, CATALOG_SNAPSHOT, BANK_V1 } from '../src';
import type { GeneratedWod } from '../src';

function tirages(n: number): GeneratedWod[] {
  const out: GeneratedWod[] = [];
  const F = ['surprise', 'emom', 'stations', 'chipper', 'for_time', 'amrap', 'interval'] as const;
  for (let i = 0; i < n; i++) {
    try {
      out.push(generateBlocC(
        { entry: 'express', discipline: 'functional', budget_min: [8, 12, 15, 20][i % 4], intention: 'mixed', format: F[i % F.length], profile_category: 'rx' },
        CATALOG_SNAPSHOT, BANK_V1, 2100 + i,
      ));
    } catch { /* rejeté */ }
  }
  return out;
}

const nomsDuTitre = (w: GeneratedWod) => [...new Set(w.blocks[0].movements.filter((m) => m.round === undefined || m.round === 1).map((m) => m.name))];

describe('titre du WOD', () => {
  const wods = tirages(400);
  const longs = wods.filter((w) => nomsDuTitre(w).length > 3);
  const courts = wods.filter((w) => nomsDuTitre(w).length <= 3);

  it('l\'échantillon contient des blocs de quatre mouvements et plus', () => {
    expect(longs.length).toBeGreaterThan(0);
    expect(courts.length).toBeGreaterThan(0);
  });

  it('un bloc de plus de trois mouvements annonce le reste en « +N »', () => {
    for (const w of longs) {
      const reste = nomsDuTitre(w).length - 3;
      expect(w.title).toMatch(new RegExp(` \\+${reste}$`));
    }
  });

  it('un bloc de trois mouvements ou moins n\'annonce rien', () => {
    for (const w of courts) expect(w.title).not.toMatch(/ \+\d+$/);
  });

  it('les trois premiers noms restent ceux du bloc, dans l\'ordre', () => {
    for (const w of longs) {
      const [a, b, c] = nomsDuTitre(w);
      expect(w.title).toContain(`${a} / ${b} / ${c} +`);
    }
  });
});
