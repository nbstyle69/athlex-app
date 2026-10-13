/**
 * En-têtes de format et reps d'une ligne de WOD : score et crédit séparés.
 *
 * `supabase/seed/wod_header_cases.json` est partagé à l'identique avec le
 * Manager : l'empreinte figée ci-dessous est la même dans son test de parité.
 * Changer un cas = changer l'empreinte des deux côtés.
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
  isFormatHeaderLine, repsPerRoundFromMovements, parseMovementLine, computeCompletedMovements,
} from '../utils/movementParser';
import { normalizeMovement, isKnownMovementKey } from '../utils/tournamentUtils';

interface CasLigne { ligne: string; header: boolean; reps_score: number; reps_credit: number }
interface CasWod { nom: string; lignes: string[]; reps_par_tour: number }

const RACINE = path.resolve(__dirname, '..', '..');
const BRUT = fs.readFileSync(path.join(RACINE, 'supabase/seed/wod_header_cases.json'), 'utf8');
const CAS: { lignes: CasLigne[]; wods: CasWod[] } = JSON.parse(BRUT);

/** Quantité créditée pour une ligne : celle du parseur, 0 hors catalogue (filtre du back-office et de gamification). */
function credit(ligne: string): number {
  const e = parseMovementLine(ligne);
  return e && isKnownMovementKey(normalizeMovement(e.name).key) ? e.reps : 0;
}

describe('wod_header_cases.json', () => {
  it('empreinte du JSON normalisé (parité avec le Manager)', () => {
    const empreinte = createHash('sha256').update(JSON.stringify(JSON.parse(BRUT))).digest('hex');
    expect(empreinte).toBe('05b42fe7d41db1405f8070b347316522dda0e56725b2185ac9baea158df20630');
  });

  it.each(CAS.lignes.map(c => [c.ligne, c] as const))('ligne « %s »', (_l, c) => {
    expect({
      header: isFormatHeaderLine(c.ligne),
      reps_score: repsPerRoundFromMovements([c.ligne]),
      reps_credit: credit(c.ligne),
    }).toEqual({ header: c.header, reps_score: c.reps_score, reps_credit: c.reps_credit });
  });

  it.each(CAS.wods.map(w => [w.nom, w] as const))('WOD « %s »', (_n, w) => {
    expect(repsPerRoundFromMovements(w.lignes)).toBe(w.reps_par_tour);
  });

  it('un en-tête ne passe jamais par le parseur de mouvements', () => {
    for (const c of CAS.lignes.filter(x => x.header)) expect([c.ligne, parseMovementLine(c.ligne)]).toEqual([c.ligne, null]);
  });
});

describe('en-tête « N rounds » sans suite : multiplicateur d\'un For Time', () => {
  it('« 5 rounds » puis « 10 Thrusters » crédite 50 thrusters, sans clé « rounds »', () => {
    const out = computeCompletedMovements(['5 rounds', '10 Thrusters'], 'For Time', 600, 'time');
    expect(out.map(m => [m.name, m.reps])).toEqual([['Thrusters', 50]]);
  });

  it('« 5 rds » aussi', () => {
    const out = computeCompletedMovements(['5 rds', '10 Thrusters'], 'For Time', 600, 'time');
    expect(out.map(m => [m.name, m.reps])).toEqual([['Thrusters', 50]]);
  });
});

describe('AMRAP au score « 12 min AMRAP » : plus de clé fantôme « min AMRAP »', () => {
  it('le crédit ne contient que les mouvements, répartis sur 37 reps par tour', () => {
    const out = computeCompletedMovements(['12 min AMRAP', '10 Thrusters', '12 Pull-ups', '15 Box jump'], 'AMRAP', 74, 'reps');
    expect(out.map(m => [m.name, m.reps])).toEqual([['Thrusters', 20], ['Pull-ups', 24], ['Box jump', 30]]);
  });
});
