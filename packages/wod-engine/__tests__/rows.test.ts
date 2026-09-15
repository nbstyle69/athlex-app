/**
 * Export / import de la banque vers `wod_skeletons` + `wod_volume_caps` :
 * aller-retour sans perte, filtrage des lignes inactives, repli sur BANK_V1.
 */
import {
  BANK_V1, BANK_VERSION, bankFromRows, skeletonToRow, movementCapToRow, movementCapFromRow,
  generateBlocC, CATALOG_SNAPSHOT,
} from '../src';
import type { GenerateParams } from '../src';

const skeletonRows = BANK_V1.skeletons.map((sk) => skeletonToRow(sk, BANK_VERSION));
const capRows = BANK_V1.movement_caps.map((c) => movementCapToRow(c, BANK_VERSION));

describe('lignes Supabase ↔ banque embarquée', () => {
  it('chaque squelette est porté par une ligne cohérente (id, discipline, format, definition)', () => {
    for (const r of skeletonRows) {
      expect(r.definition.id).toBe(r.id);
      expect(r.definition.discipline).toBe(r.discipline);
      expect(r.definition.format).toBe(r.format);
      expect(r.active).toBe(true);
      expect(r.version).toBe(BANK_VERSION);
    }
    expect(new Set(skeletonRows.map((r) => r.id)).size).toBe(BANK_V1.skeletons.length);
  });

  it('les plafonds §5.4 font l’aller-retour sans perte', () => {
    for (const c of BANK_V1.movement_caps) {
      expect(movementCapFromRow(movementCapToRow(c, BANK_VERSION))).toEqual(c);
    }
    const labels = capRows.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const r of capRows) expect(Boolean(r.ids?.length) || Boolean(r.family)).toBe(true);
  });

  it('bankFromRows reconstruit une banque équivalente à BANK_V1', () => {
    const bank = bankFromRows(skeletonRows, capRows);
    expect(bank.version).toBe(BANK_VERSION);
    expect(bank.skeletons).toEqual(BANK_V1.skeletons);
    expect(bank.movement_caps).toEqual(BANK_V1.movement_caps);
    expect(bank.volume_caps).toEqual(BANK_V1.volume_caps);
  });

  it('ignore les lignes inactives et lève sur un jeu vide (repli côté appelant)', () => {
    const partial = skeletonRows.map((r, i) => ({ ...r, active: i !== 0 }));
    const bank = bankFromRows(partial, capRows);
    expect(bank.skeletons).toHaveLength(BANK_V1.skeletons.length - 1);
    expect(bank.skeletons.find((s) => s.id === skeletonRows[0].id)).toBeUndefined();

    expect(() => bankFromRows([], capRows)).toThrow();
    expect(() => bankFromRows(skeletonRows, capRows.map((r) => ({ ...r, active: false })))).toThrow();
  });

  it('la banque relue produit le même WOD que BANK_V1 à graine égale', () => {
    const params: GenerateParams = {
      entry: 'express', discipline: 'functional', budget_min: 15, format: 'surprise', intention: 'mixed',
      vest: 'none', exclude: [], profile_category: 'rx', recent_signatures: [],
    };
    const fromRows = bankFromRows(skeletonRows, capRows);
    for (const seed of [1, 42, 4242]) {
      expect(generateBlocC(params, CATALOG_SNAPSHOT, fromRows, seed))
        .toEqual(generateBlocC(params, CATALOG_SNAPSHOT, BANK_V1, seed));
    }
  });
});
