/**
 * Contrat de format partagé avec le Manager : le même fichier
 * (fixtures/strength-line-contract.json, identique octet pour octet à
 * AthleX-Manager lib/__fixtures__) est vérifié des deux côtés.
 */
import contract from './fixtures/strength-line-contract.json';
import { parseStrengthLine, serializeStrength, StrengthComplex, StrengthEntry } from '../utils/strengthBlock';

type Fields = {
  name?: string; sets?: number; reps?: number; load?: number; unit?: string; pctOfMax?: number;
  restSec?: number; tempo?: string; loadNote?: string; complex?: StrengthComplex;
};
type Case = { line: string; expected: Fields | null; serialize: boolean };

const KEYS = ['name', 'sets', 'reps', 'load', 'unit', 'pctOfMax', 'restSec', 'tempo', 'loadNote', 'complex'] as const;

/** Champs du contrat ; absent = non défini ou null, reps à 0 (inconnues) = absent, unit seulement avec une charge. */
function project(e: StrengthEntry): Fields {
  const out: Fields = {};
  if (e.name != null) out.name = e.name;
  if (e.sets != null) out.sets = e.sets;
  if (e.reps != null && e.reps >= 1) out.reps = e.reps;
  if (e.load != null) { out.load = e.load; out.unit = e.unit; }
  if (e.pctOfMax != null) out.pctOfMax = e.pctOfMax;
  if (e.restSec != null) out.restSec = e.restSec;
  if (e.tempo != null) out.tempo = e.tempo;
  if (e.loadNote != null) out.loadNote = e.loadNote;
  if (e.complex != null) out.complex = e.complex;
  return out;
}

describe('contrat de format des lignes de bloc musculation (partagé avec le Manager)', () => {
  const cases = contract.cases as Case[];

  it('version 2 : les cinq cas d\'origine et ceux des complexes (#454)', () => {
    expect(contract.version).toBe(2);
    expect(cases).toHaveLength(15);
    expect(cases.filter(c => c.expected?.complex)).toHaveLength(4);
    expect(cases.filter(c => c.expected === null)).toHaveLength(6);
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
      name: f.name!, sets: f.sets!, reps: f.reps ?? 0, load: f.load ?? null,
      unit: (f.unit as StrengthEntry['unit']) ?? 'kg',
      restSec: f.restSec ?? null, tempo: f.tempo ?? null,
      ...(f.loadNote != null ? { loadNote: f.loadNote } : {}),
      ...(f.pctOfMax != null ? { pctOfMax: f.pctOfMax } : {}),
      ...(f.complex != null ? { complex: f.complex } : {}),
    };
    expect(serializeStrength(entry)).toBe(c.line);
  });
});
