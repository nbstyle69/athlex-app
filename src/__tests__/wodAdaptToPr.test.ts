type Settings = Record<string, unknown>;
const settings: Record<string, Settings> = {};
let settingsError: Error | null = null;
const records: Record<string, unknown> = {};
const fetchRecords = jest.fn(async () => records);

jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => fetchRecords() }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let userId = '';
      let write: { user_id: string; last_params: Settings } | undefined;
      const builder = {
        select: () => builder,
        eq: (key: string, value: string) => { if (key === 'user_id') userId = value; return builder; },
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => builder,
        upsert: (row: { user_id: string; last_params: Settings }) => { write = row; return builder; },
        then: (resolve: (result: unknown) => unknown) => {
          if (write && !settingsError) settings[write.user_id] = write.last_params;
          return Promise.resolve({
            data: table === 'user_generation_settings' ? { last_params: settings[userId] ?? null } : null,
            error: table === 'user_generation_settings' ? settingsError : null,
          }).then(resolve);
        },
      };
      return builder;
    },
  },
}));

import { generateForUser, loadAdaptToPr, saveAdaptToPr, saveExcludes, saveMuscuEquipment } from '../services/wodGenerator';
import type { MetconScreenParams } from '../services/wodGenerator';
import { gymRecordsFrom } from '../screens/wod/gymRecords';

const user = { id: 'u1', level: 'rx' as const, gender: 'male' as const };
const screen: MetconScreenParams = {
  entry: 'express', discipline: 'functional', budget_min: 15, intention: 'gym', format: 'surprise', exclude: [],
};

beforeEach(() => {
  for (const id of Object.keys(settings)) delete settings[id];
  for (const key of Object.keys(records)) delete records[key];
  settingsError = null;
  fetchRecords.mockClear();
});

describe('C4 — préférence du profil', () => {
  it.each([undefined, null, true, 'false', 0])('activée par défaut pour %s', async (value) => {
    settings.u1 = { adapt_to_pr: value };
    expect(await loadAdaptToPr('u1')).toBe(true);
  });

  it('mémorise false puis true, isolé par utilisateur, en conservant les autres réglages', async () => {
    settings.u1 = { exclude: ['jump_rope'], muscu_equipment: 'gym' };
    await saveAdaptToPr('u1', false);
    expect(await loadAdaptToPr('u1')).toBe(false);
    expect(await loadAdaptToPr('u2')).toBe(true);
    expect(settings.u1).toEqual({ exclude: ['jump_rope'], muscu_equipment: 'gym', adapt_to_pr: false });
    await saveAdaptToPr('u1', true);
    expect(await loadAdaptToPr('u1')).toBe(true);
  });

  it('préserve le dernier choix et les exclusions/matériel lors de changements rapides', async () => {
    await Promise.all([
      saveAdaptToPr('u1', true),
      saveExcludes('u1', ['rower']),
      saveMuscuEquipment('u1', 'none'),
      saveAdaptToPr('u1', false),
    ]);
    expect(settings.u1).toEqual({ adapt_to_pr: false, exclude: ['rower'], muscu_equipment: 'none' });
  });

  it('une lecture en erreur garde le défaut actif', async () => {
    settingsError = new Error('offline');
    expect(await loadAdaptToPr('u1')).toBe(true);
  });
});

describe('C4 — génération avec le vrai moteur', () => {
  it('anciens paramètres et option active transmettent les records et donnent le même résultat', async () => {
    records['gymnastics_Pull-ups'] = '12';
    const legacy = await generateForUser(user, null, screen, 7);
    const adapted = await generateForUser(user, null, { ...screen, adapt_to_pr: true }, 7);
    expect(adapted.params.gym_records).toEqual(gymRecordsFrom(records));
    expect(adapted.wod).toEqual(legacy.wod);
  });

  it('active : substitutions et plafond de 50 % ; challenge : catégorie seule sans lecture des PR', async () => {
    records['gymnastics_Pull-ups'] = '12';
    let pullUps = 0;
    let challengeGym = 0;
    for (let seed = 4000; seed < 4020; seed++) {
      const adapted = await generateForUser(user, null, { ...screen, adapt_to_pr: true }, seed);
      for (const movement of adapted.wod.blocks.flatMap((block) => block.movements)) {
        expect(['bar_muscle_up', 'ring_muscle_up', 'chest_to_bar', 'toes_to_bar', 'handstand_push_up', 'strict_handstand_push_up', 'ring_dip']).not.toContain(movement.id);
        if (movement.id === 'pull_up') {
          pullUps++;
          expect(Math.max(...(movement.scheme ?? [movement.qty]))).toBeLessThanOrEqual(6);
        }
      }
      fetchRecords.mockClear();
      const challenge = await generateForUser(user, null, { ...screen, adapt_to_pr: false }, seed);
      expect(fetchRecords).not.toHaveBeenCalled();
      expect(challenge.params.gym_records).toBeUndefined();
      expect(challenge.category).toBe('rx');
      challengeGym += challenge.wod.blocks.flatMap((block) => block.movements)
        .filter((movement) => movement.id === 'chest_to_bar' || movement.id === 'bar_muscle_up').length;
    }
    expect(pullUps).toBeGreaterThan(0);
    expect(challengeGym).toBeGreaterThan(0);
  });
});
