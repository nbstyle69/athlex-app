/**
 * Le tirage ne dépend pas de l'ordre des lignes de la base.
 *
 * `fetchBank` lisait `wod_skeletons` sans `ORDER BY` ; le moteur filtre les
 * squelettes dans l'ordre du tableau et `movementCapFor` retourne le PREMIER
 * plafond qui correspond. Un `UPDATE` déplaçant les lignes dans le tas suffisait
 * donc à changer le WOD d'une graine donnée — mesuré le 21/09/2026 en appliquant
 * la migration 20261229 : 232 tirages sur 672 changés alors que les définitions
 * étaient identiques. `bankFromRows` trie désormais, quel que soit l'appelant.
 */
import {
  BANK_V1, BANK_VERSION, MUSCU_BANK_VERSION, bankFromRows, generateBlocC, generateMuscu,
  skeletonToRow, movementCapToRow, muscuSkeletonToRow, CATALOG_SNAPSHOT,
} from '../src';
import type { AnySkeletonRow, VolumeCapRow } from '../src';

/** Mélange déterministe (pas de hasard dans un test) : rotation et inversion. */
function melange<T>(xs: readonly T[], decalage: number): T[] {
  const out = [...xs];
  out.reverse();
  return [...out.slice(decalage), ...out.slice(0, decalage)];
}

const skeletonRows: AnySkeletonRow[] = [
  ...BANK_V1.skeletons.map((s) => skeletonToRow(s, BANK_VERSION)),
  ...BANK_V1.muscu_skeletons.map((s) => muscuSkeletonToRow(s, MUSCU_BANK_VERSION)),
];
const capRows: VolumeCapRow[] = BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION));

const metconCas = (() => {
  const out: Array<[Parameters<typeof generateBlocC>[0], number]> = [];
  for (const discipline of ['functional', 'hybrid'] as const) {
    for (const budget_min of [8, 12, 15, 20, 30]) {
      for (const intention of discipline === 'functional' ? (['mixed', 'force', 'gym'] as const) : (['interval', 'engine', 'run'] as const)) {
        for (let seed = 1; seed <= 4; seed++) {
          out.push([{ entry: 'express', discipline, budget_min, intention, profile_category: discipline === 'functional' ? 'rx' : 'men' }, seed]);
        }
      }
    }
  }
  return out;
})();

const signatures = (bank: ReturnType<typeof bankFromRows>) =>
  metconCas.map(([p, seed]) => {
    try { return generateBlocC(p, CATALOG_SNAPSHOT, bank, seed).signature; } catch { return 'rejet'; }
  });

describe('bankFromRows — ordre des lignes', () => {
  const reference = bankFromRows(skeletonRows, capRows);

  it("range les lignes dans l'ordre de la banque embarquée — base et repli hors-ligne restent d'accord", () => {
    expect(reference.skeletons.map((s) => s.id)).toEqual(BANK_V1.skeletons.map((s) => s.id));
    expect(reference.movement_caps).toEqual(BANK_V1.movement_caps);
    expect(reference.muscu_skeletons.map((s) => s.id)).toEqual(BANK_V1.muscu_skeletons.map((s) => s.id));
  });

  it("une ligne que le snapshot ne connaît pas encore se range après, par id, sans bouger les autres", () => {
    const inedit = (id: string) => ({ ...skeletonToRow(BANK_V1.skeletons[0], BANK_VERSION), id, definition: { ...BANK_V1.skeletons[0], id } });
    const bank = bankFromRows(melange([...skeletonRows, inedit('zzz_nouveau'), inedit('aaa_nouveau')], 3), melange(capRows, 1));
    expect(bank.skeletons.map((s) => s.id)).toEqual([...BANK_V1.skeletons.map((s) => s.id), 'aaa_nouveau', 'zzz_nouveau']);
  });

  it.each([1, 3, 7, 13])('lignes mélangées (décalage %i) : même banque, mêmes tirages à graine égale', (decalage) => {
    const bank = bankFromRows(melange(skeletonRows, decalage), melange(capRows, decalage));
    expect(bank.skeletons.map((s) => s.id)).toEqual(reference.skeletons.map((s) => s.id));
    expect(bank.movement_caps).toEqual(reference.movement_caps);
    expect(signatures(bank)).toEqual(signatures(reference));
    // et l'identité avec la banque embarquée tient, quel que soit l'ordre reçu
    expect(signatures(bank)).toEqual(signatures(BANK_V1));
  });

  it('la Musculation aussi : mêmes séances à graine égale', () => {
    const bank = bankFromRows(melange(skeletonRows, 5), melange(capRows, 2));
    for (const target of ['push', 'pull', 'jambes', 'fessiers', 'tronc'] as const) {
      for (let seed = 1; seed <= 4; seed++) {
        const p = { entry: 'express' as const, target, objective: 'hypertrophie' as const, budget_min: 30, equipment: 'box' as const, level: 'inter' as const };
        expect(generateMuscu(p, CATALOG_SNAPSHOT, bank, seed).signature)
          .toBe(generateMuscu(p, CATALOG_SNAPSHOT, reference, seed).signature);
      }
    }
  });

  it("l'échantillon mesure vraiment quelque chose : des tirages aboutissent", () => {
    expect(signatures(reference).filter((s) => s !== 'rejet').length).toBeGreaterThan(metconCas.length / 2);
  });
});
