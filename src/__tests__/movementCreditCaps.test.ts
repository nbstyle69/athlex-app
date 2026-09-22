/**
 * Les usages normaux mesurés sont-ils toujours ce que le client envoie ?
 *
 * `supabase/seed/movement_credit_caps_cases.json` décrit, pour des WOD de coach
 * classiques (Murph, Cindy, 5 × 100 DU…), les appels que le client fait à
 * `increment_movement_stats`. `supabase/tests/movement_credit_caps.sql` rejoue
 * ces appels contre les plafonds de la base et exige qu'ils passent.
 *
 * Ce test-ci garde la première moitié honnête : il recalcule chaque appel avec
 * le VRAI code du client (`computeCompletedMovements`, puis la clé de
 * `normalizeMovement`, comme `logMovementReps`). Si le calcul du client change —
 * et le lot client le changera, pour ne créditer que ce que le score prouve —,
 * le fichier de cas ne peut plus mentir sur ce qu'on protège.
 */
import fs from 'fs';
import path from 'path';
import { computeCompletedMovements } from '../utils/movementParser';
import { normalizeMovement } from '../utils/tournamentUtils';

interface Credit { movement: string; unit: string; quantite: number }
interface Cas {
  nom: string;
  lignes: string[];
  type: string;
  score: number;
  type_score: string;
  credits: Credit[];
}

const RACINE = path.resolve(__dirname, '..', '..');
const CAS: Cas[] = JSON.parse(
  fs.readFileSync(path.join(RACINE, 'supabase/seed/movement_credit_caps_cases.json'), 'utf8'),
).cas;

describe('usages normaux mesurés = ce que le client envoie à increment_movement_stats', () => {
  it('le fichier de cas couvre les trois unités (contre-exemple)', () => {
    const unites = new Set(CAS.flatMap(c => c.credits.map(x => x.unit)));
    expect([...unites].sort()).toEqual(['cal', 'm', 'reps']);
  });

  for (const cas of CAS) {
    it(cas.nom, () => {
      const envoye = computeCompletedMovements(cas.lignes, cas.type, cas.score, cas.type_score)
        .map(e => ({ movement: normalizeMovement(e.name).key, unit: e.unit ?? 'reps', quantite: e.reps }));
      expect(envoye).toEqual(cas.credits);
    });
  }
});
