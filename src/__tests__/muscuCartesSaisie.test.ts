/**
 * Musculation de box en plusieurs cartes (#620, #635) : chaque carte d'exercice se saisit comme une
 * ligne « Ajouter au Whiteboard » (une `strength_session` d'un exercice dans son `wod_json`). Le détail
 * du WOD lit la grille dans la description enregistrée (`parseStrengthLine`), la carte Séance dans le
 * `wod_json` (`isMuscuWod`, `plannedSets`) : les cartes d'une journée redonnent, ensemble, exactement la
 * séance entière ; l'échauffement et le retour au calme n'ouvrent aucune grille.
 */
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve({}) }));

import { parseStrengthLine } from '../utils/strengthBlock';
import { isMuscuWod, plannedSets } from '../services/wodGenerator';
import {
  BANK_V1, CATALOG_SNAPSHOT, generateMuscuWeek, muscuWeekRows, renderMuscu, weekSeed,
} from '../../packages/wod-engine/src';
import type { MuscuWod } from '../../packages/wod-engine/src';

const grille = (description: string) => description.split('\n').map(parseStrengthLine).filter((e) => e !== null);

describe.each([1, 3, 5])('semaine %i : saisie des cartes', (iso_week) => {
  const week = generateMuscuWeek({ iso_year: 2027, iso_week }, CATALOG_SNAPSHOT, BANK_V1, weekSeed('box-0', 'musculation', 2027, iso_week, 0));
  const rows = muscuWeekRows(week, { box_id: 'b', created_by: null, run_id: 'r', iso_year: 2027, iso_week }, CATALOG_SNAPSHOT);

  it('une grille d\'une ligne par carte d\'exercice ; ensemble, la séance ; aucune pour échauffement et retour au calme', () => {
    for (const d of week.days) {
      const date = rows.find((r) => r.wod_json === d.wod || (r.wod_json as MuscuWod).signature === d.wod.signature)!.scheduled_date;
      const cartes = rows.filter((r) => r.scheduled_date === date);
      const entiere = grille(renderMuscu(d.wod));
      const parCarte = cartes.filter((r) => r.wod_type === 'strength').map((r) => {
        const w = r.wod_json as MuscuWod;
        expect(isMuscuWod(w)).toBe(true);
        const g = grille(r.description);
        expect(g).toHaveLength(1);
        expect(w.blocks[0].exercises).toHaveLength(1);
        // une ligne de grille par exercice du wod_json, mêmes séries prévues
        expect(g.map((e) => e!.name)).toEqual(w.blocks[0].exercises.map((e) => e.name));
        expect(w.blocks[0].exercises.map((e) => plannedSets(e).length)).toEqual(w.blocks[0].exercises.map((e) => e.sets));
        return g;
      });
      // ensemble : exactement la séance entière, dans son ordre
      expect(parCarte.flat()).toEqual(entiere);
      for (const r of cartes.filter((x) => x.wod_type !== 'strength')) expect(grille(r.description)).toEqual([]);
    }
  });
});
