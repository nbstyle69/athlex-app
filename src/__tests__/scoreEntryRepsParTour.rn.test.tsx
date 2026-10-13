/**
 * Saisie d'un score AMRAP / Max Reps (ScoreEntryFields) montée avec le vrai
 * react-native : `reps_per_round` renseigné à 0 = score saisi en total seul ;
 * vide (null / undefined) = points calculés depuis les lignes ; positif = tel quel.
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { lightTheme as mockTheme } from '../theme/palette';
import i18n from '../i18n';
import ScoreEntryFields from '../components/score/ScoreEntryFields';

jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));

const LIGNES = ['12 min AMRAP', '10 Thrusters', '12 Pull-ups', '15 Box jump']; // 37 par tour

async function monter(repsPerRound: number | null | undefined) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <ScoreEntryFields kind="reps" movements={LIGNES} repsPerRound={repsPerRound} onChange={() => {}} />,
    );
  });
  const textes = r.root.findAllByType(Text).map(n => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  });
  return { textes, champs: r.root.findAllByType(TextInput).length };
}

beforeAll(async () => { await i18n.changeLanguage('fr'); });

it('0 : total seul — pas de choix « Tours + reps », un seul champ, récapitulatif sans tours', async () => {
  const { textes, champs } = await monter(0);
  expect(textes).not.toContain(i18n.t('scoreEntry.modeRounds'));
  expect(textes).toContain(i18n.t('scoreEntry.totalRepsField'));
  expect(champs).toBe(1);
  expect(textes.some(t => t.startsWith('1 tour ='))).toBe(false);
  expect(textes).toContain(i18n.t('scoreEntry.scoreRecap', { total: 0 }));
});

it.each([null, undefined])('%s : tours + reps, avec les points calculés depuis les lignes (37)', async v => {
  const { textes, champs } = await monter(v);
  expect(textes).toContain(i18n.t('scoreEntry.modeRounds'));
  expect(champs).toBe(2);
  expect(textes.some(t => t.startsWith(i18n.t('scoreEntry.perRoundInfo', { reps: 37 })))).toBe(true);
});

it('valeur positive : utilisée telle quelle (20, pas 37)', async () => {
  const { textes } = await monter(20);
  expect(textes).toContain(i18n.t('scoreEntry.modeRounds'));
  expect(textes.some(t => t.startsWith(i18n.t('scoreEntry.perRoundInfo', { reps: 20 })))).toBe(true);
  expect(textes.some(t => t.startsWith(i18n.t('scoreEntry.perRoundInfo', { reps: 37 })))).toBe(false);
});
