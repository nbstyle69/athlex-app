/**
 * PR « Données » D1 (#530) — un nom anglais n'est qu'affiché : la séance Musculation (journal
 * `strength_set_logs`, crédit `movement_logs` des badges) part du nom ENREGISTRÉ du catalogue,
 * même quand l'app est en anglais. Seul l'affichage (`exerciseName`) suit la langue.
 */
import i18n from '../i18n';
import { BANK_V1, CATALOG_SNAPSHOT, generateMuscu, mouvements } from '../../packages/wod-engine/src';
import { initialPerformed } from '../services/muscuSession';
import { performedMovementEntries } from '../services/wodGenerator';
import { exerciseName } from '../services/wodRender';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));

describe('noms anglais : affichage seul, jamais écrits ni relus (D1)', () => {
  afterAll(() => i18n.changeLanguage('fr'));

  it('app en anglais : séance et crédit de badges gardent le nom enregistré', async () => {
    await i18n.changeLanguage('en');
    const wod = generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'none', level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, 11);
    const exos = wod.blocks[0].exercises;
    expect(exos.some((e) => mouvements[e.id] !== e.name)).toBe(true); // un nom français au moins : le test a du sens
    const performed = initialPerformed(wod);
    expect(performed.map((p) => p.name)).toEqual(exos.map((e) => e.name));
    const credit = performedMovementEntries(performed.map((p) => ({ ...p, sets: p.sets.map((s) => ({ ...s, reps: 5 })) })));
    expect(credit.map((c) => c.name)).toEqual(exos.map((e) => e.name));
    // l'affichage, lui, est en anglais
    expect(exos.map((e) => exerciseName(e))).toEqual(exos.map((e) => mouvements[e.id]));
  });
});
