import { CATALOG_SNAPSHOT, FUNCTIONAL_CATEGORIES, movementById, cadenceFor, loadsFor, nameKey } from '../src';
import type { Band, Unit } from '../src';
import { MOVEMENT_CATALOG } from '../../../src/utils/movementsCatalog';
import { badgePrefixFor } from '../../../src/utils/movementBadgeKeys';
import { normalizeMovement } from '../../../src/utils/tournamentUtils';

// Mouvements tirables en metcon : actifs avec un poids Functional ou Hybrid (les exercices
// musculation seule — M1 — sont actifs mais à poids metcon 0).
const active = CATALOG_SNAPSHOT.movements.filter((m) => m.active && (m.weight_functional > 0 || m.weight_hybrid > 0));
const BANDS: Band[] = ['light', 'medium', 'heavy'];

describe('catalogue embarqué (catalogue-v1.csv)', () => {
  it('compte 95 mouvements metcon actifs + les mouvements legacy inactifs (+ 155 exercices musculation seule)', () => {
    expect(active).toHaveLength(95);
    expect(CATALOG_SNAPSHOT.movements.length).toBe(109 + 155);
    expect(CATALOG_SNAPSHOT.movements.filter((m) => !m.active).every((m) => m.weight_functional === 0 && m.weight_hybrid === 0)).toBe(true);
  });

  it('ids et noms uniques, Weighted Vest absent', () => {
    const ids = new Set(CATALOG_SNAPSHOT.movements.map((m) => m.id));
    const names = new Set(CATALOG_SNAPSHOT.movements.map((m) => nameKey(m.name)));
    expect(ids.size).toBe(CATALOG_SNAPSHOT.movements.length);
    expect(names.size).toBe(CATALOG_SNAPSHOT.movements.length);
    expect(CATALOG_SNAPSHOT.movements.some((m) => /vest/i.test(m.name))).toBe(false);
  });

  it('chaque mouvement actif a une cadence et des plages pour chacune de ses unités et des 6 catégories Functional', () => {
    for (const m of active) {
      expect(m.units_allowed.length).toBeGreaterThan(0);
      expect(m.units_allowed).toContain(m.unit_default);
      for (const u of m.units_allowed) {
        const ranges = m.rep_ranges?.[u];
        expect({ id: m.id, unit: u, ranges }).toMatchObject({ ranges: expect.anything() });
        for (const f of ['amrap', 'for_time', 'emom', 'interval'] as const) {
          const r = ranges?.[f];
          expect({ id: m.id, unit: u, f, r }).toMatchObject({ r: expect.any(Array) });
          expect(r![0]).toBeGreaterThan(0);
          expect(r![1]).toBeGreaterThanOrEqual(r![0]);
        }
        for (const c of FUNCTIONAL_CATEGORIES) {
          const cad = cadenceFor(m, c, u);
          expect({ id: m.id, unit: u, c, cad }).toMatchObject({ cad: expect.any(Number) });
          expect(cad!).toBeGreaterThan(0);
        }
      }
    }
  });

  it('les ergs acceptent cal et m, Plank Hold est en secondes, Box Jump en cm', () => {
    for (const id of ['row', 'bike_erg', 'ski_erg']) {
      const m = movementById(CATALOG_SNAPSHOT, id)!;
      expect(m.units_allowed.sort()).toEqual(['cal', 'm']);
    }
    expect(movementById(CATALOG_SNAPSHOT, 'plank_hold')!.unit_default).toBe('s');
    const box = movementById(CATALOG_SNAPSHOT, 'box_jump')!;
    expect(box.load_unit).toBe('cm');
    expect(loadsFor(box, 'rx', 'medium')).toEqual([60, 50]);
  });

  it('chaque mouvement chargé a ses 3 bandes [H, F] pour les 6 catégories et une unité de charge', () => {
    for (const m of active.filter((x) => x.loads)) {
      expect(m.load_unit).not.toBeNull();
      for (const c of FUNCTIONAL_CATEGORIES) for (const b of BANDS) {
        const pair = loadsFor(m, c, b);
        expect({ id: m.id, c, b, pair }).toMatchObject({ pair: expect.any(Array) });
        expect(pair).toHaveLength(2);
        expect(pair![0]).toBeGreaterThan(0);
        expect(pair![1]).toBeGreaterThan(0);
      }
      // Hybrid dérivé : Women = rx[F], Men = rx[H], Pro = rxplus
      expect(loadsFor(m, 'women', 'medium')).toEqual([loadsFor(m, 'rx', 'medium')![1]]);
      expect(loadsFor(m, 'men_pro', 'medium')).toEqual([loadsFor(m, 'rxplus', 'medium')![0]]);
    }
  });

  it('tout id de substitution ou de variante existe dans le catalogue', () => {
    for (const m of CATALOG_SNAPSHOT.movements) {
      for (const id of Object.values(m.substitutions ?? {})) {
        expect({ from: m.id, sub: id, ok: !!movementById(CATALOG_SNAPSHOT, id!) }).toMatchObject({ ok: true });
      }
      if (m.variant_up) expect({ from: m.id, up: m.variant_up, ok: !!movementById(CATALOG_SNAPSHOT, m.variant_up) }).toMatchObject({ ok: true });
    }
  });

  it('les mouvements déjà connus de l’app gardent exactement leur nom (crédit de badges)', () => {
    const appNames = new Map(MOVEMENT_CATALOG.map((m) => [nameKey(m.name), m.name]));
    const catalogKeys = new Set(CATALOG_SNAPSHOT.movements.map((m) => nameKey(m.name)));
    for (const [key, name] of appNames) {
      expect({ name, present: catalogKeys.has(key) }).toMatchObject({ present: true });
      const row = CATALOG_SNAPSHOT.movements.find((m) => nameKey(m.name) === key)!;
      expect(row.name).toBe(name);
    }
  });

  it('badge_key suit les mappings de badges de l’app pour chaque nom', () => {
    for (const m of CATALOG_SNAPSHOT.movements) {
      const key = normalizeMovement(m.name).key;
      const unit = (m.unit_default === 's' ? 'reps' : m.unit_default) as Exclude<Unit, 's'>;
      const expected = badgePrefixFor(key, unit) ?? null;
      expect({ id: m.id, name: m.name, badge_key: m.badge_key }).toEqual({ id: m.id, name: m.name, badge_key: expected });
    }
  });
});
