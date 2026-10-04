/**
 * Contrat de format partagé avec le Manager : le même fichier
 * (fixtures/strength-line-contract.json, identique octet pour octet à
 * AthleX-Manager lib/__fixtures__) est vérifié des deux côtés.
 */
import contract from './fixtures/strength-line-contract.json';
import { parseStrengthLine, serializeStrength, StrengthEntry } from '../utils/strengthBlock';

type Fields = { name?: string; sets?: number; reps?: number; pctOfMax?: number; restSec?: number };
type Case = { line: string; expected: Fields | null; serialize: boolean };

const KEYS = ['name', 'sets', 'reps', 'pctOfMax', 'restSec'] as const;

/** Champs du contrat ; absent = non défini ou null, reps à 0 (inconnues) = absent. */
function project(e: StrengthEntry): Fields {
  const out: Fields = {};
  if (e.name != null) out.name = e.name;
  if (e.sets != null) out.sets = e.sets;
  if (e.reps != null && e.reps >= 1) out.reps = e.reps;
  if (e.pctOfMax != null) out.pctOfMax = e.pctOfMax;
  if (e.restSec != null) out.restSec = e.restSec;
  return out;
}

describe('contrat de format des lignes de bloc musculation (partagé avec le Manager)', () => {
  const cases = contract.cases as Case[];

  it('couvre les cinq cas convenus', () => {
    expect(cases).toHaveLength(5);
  });

  it.each(cases.map(c => [c.line, c] as const))('lit « %s »', (_line, c) => {
    const e = parseStrengthLine(c.line);
    if (c.expected === null) {
      expect(e).toBeNull();
      return;
    }
    expect(e).not.toBeNull();
    expect(project(e!)).toEqual(c.expected);
    for (const k of KEYS) if (!(k in c.expected)) expect(project(e!)[k]).toBeUndefined();
  });

  it.each(cases.filter(c => c.serialize).map(c => [c.line, c] as const))('écrit « %s » à partir des champs', (_line, c) => {
    const f = c.expected!;
    const entry: StrengthEntry = {
      name: f.name!, sets: f.sets!, reps: f.reps ?? 0, load: null, unit: 'kg',
      restSec: f.restSec ?? null, tempo: null,
      ...(f.pctOfMax != null ? { pctOfMax: f.pctOfMax } : {}),
    };
    expect(serializeStrength(entry)).toBe(c.line);
  });
});
