// PR 1b du chantier anglais : Résultat du WOD, programmes, 1RM et utilitaires partagés.
import fs from 'fs';
import path from 'path';

import i18n from '../i18n';
import { prKey } from '../screens/profile/prStorage';
import { GYM_PR_MOVEMENTS, GYM_ZONES } from '../screens/home/gymZones';
import { EQUIPMENT_LABEL_KEYS, equipmentLabel } from '../utils/wod/equipmentLabels';
import {
  parseStrengthLine, serializeStrength, formatStrengthPrescription, splitStrengthLines, type StrengthEntry,
} from '../utils/strengthBlock';
import { parseCardioLine, formatCardioPrescription, annotateCardioLines } from '../utils/cardioBlock';
import { formatAmrapScore, formatScoreDisplay } from '../utils/tournamentUtils';
import { setProgramStartDate, START_NOT_MONDAY } from '../services/programContent';

const locale = (lang: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', 'locales', `${lang}.json`), 'utf8'));
const FR = locale('fr');
const EN = locale('en');
const at = (o: any, key: string) => key.split('.').reduce((x, k) => x?.[k], o);
const enLangue = async <T>(lang: 'fr' | 'en', fn: () => T): Promise<T> => { await i18n.changeLanguage(lang); return fn(); };

afterAll(() => i18n.changeLanguage('fr'));

describe('records de gymnastique : la clé enregistrée ne dépend pas de la langue', () => {
  // Clés lues et écrites dans profiles.personal_records avant la PR (gymnastics_<Libellé>).
  const AVANT = [
    'gymnastics_Toes To Bar', 'gymnastics_Pull-ups', 'gymnastics_Chest To Bar', 'gymnastics_Hand Stand Push Up',
    'gymnastics_Strict Hand Stand Push Up', 'gymnastics_Wall Facing Hand Stand Push Up', 'gymnastics_Ring Muscle-up',
    'gymnastics_Bar Muscle-up', 'gymnastics_Dips', 'gymnastics_Strict Dips', 'gymnastics_Pull Over',
  ];

  it.each(['fr', 'en'] as const)('%s : mêmes clés qu’avant pour chaque mouvement', async (lang) => {
    const cles = await enLangue(lang, () => GYM_PR_MOVEMENTS.map((m) => prKey('gymnastics', m)));
    expect(cles).toEqual(AVANT);
  });

  it('le tableau des zones porte des clés, traduites dans les deux langues, texte français inchangé', () => {
    const avant = ['Volume facile', 'Volume facile', 'Volume facile', 'Volume facile', 'Volume de travail', 'Volume de travail',
      'Volume de travail', 'Série limite', 'Série limite', 'Record', 'Au-delà du record', 'Au-delà du record',
      'Au-delà du record', 'Au-delà du record', 'Au-delà du record'];
    expect(GYM_ZONES.map((z) => at(FR, `gymZones.zone.${z.zone}`))).toEqual(avant);
    for (const z of GYM_ZONES) {
      expect(at(EN, `gymZones.zone.${z.zone}`)).toEqual(expect.any(String));
      expect(at(EN, `gymZones.usage.${z.usage}`)).toEqual(expect.any(String));
    }
  });
});

describe('matériel : identifiant → clé equipment.<id>', () => {
  const ids = Object.keys(EQUIPMENT_LABEL_KEYS);

  it('53 identifiants, chacun avec sa clé en français et en anglais', () => {
    expect(ids).toHaveLength(53);
    for (const id of ids) {
      expect(EQUIPMENT_LABEL_KEYS[id]).toBe(`equipment.${id}`);
      expect(typeof FR.equipment[id]).toBe('string');
      expect(typeof EN.equipment[id]).toBe('string');
    }
  });

  it('libellé selon la langue, repli sur l’identifiant brut', async () => {
    expect(await enLangue('fr', () => [equipmentLabel('band'), equipmentLabel('rower'), equipmentLabel('inconnu')]))
      .toEqual(['Élastique', 'Rameur', 'inconnu']);
    expect(await enLangue('en', () => [equipmentLabel('band'), equipmentLabel('rower'), equipmentLabel('inconnu')]))
      .toEqual(['Resistance band', 'Rower', 'inconnu']);
  });
});

describe('blocs de force et cardio : l’analyse ne dépend pas de la langue de l’app', () => {
  const WOD = [
    'Back Squat — 5 × 3 @ 80 %1RM — repos 2:00 — tempo 30X1',
    'Bulgarian Split Squat — 3 × 8 / jambe @ 16 kg — repos 1:30',
    'Front Squat — 4 × 5 — charge RPE 8',
    'Ring Muscle-up — 3 × 15 % du max',
    'Row ~ 2 × 500 m ~ 250 W ~ repos 2:00',
    'SkiErg ~ 4 × 20 cal ~ RPE 6',
    '21 Thruster (43 kg)',
  ];
  const analyse = () => ({
    force: WOD.map(parseStrengthLine),
    cardio: WOD.map(parseCardioLine),
    split: splitStrengthLines(WOD),
    reecrit: WOD.map(parseStrengthLine).filter((e): e is StrengthEntry => e != null).map(serializeStrength),
  });

  it('même résultat en anglais qu’en français, texte réécrit inchangé', async () => {
    const fr = await enLangue('fr', analyse);
    const en = await enLangue('en', analyse);
    expect(en).toEqual(fr);
    expect(fr.reecrit).toEqual([WOD[0], WOD[1], WOD[2], WOD[3]]);
  });

  it('l’affichage, lui, est traduit', async () => {
    const unilat = parseStrengthLine(WOD[1])!;
    const note = parseStrengthLine(WOD[2])!;
    const cardio = parseCardioLine(WOD[4])!;
    expect(await enLangue('fr', () => [formatStrengthPrescription(unilat), formatStrengthPrescription(note), formatCardioPrescription(cardio)]))
      .toEqual(['3 × 8 / jambe @ 16 kg', '4 × 5 · charge RPE 8', '2 × 500 m @ 250 W · repos 2:00']);
    expect(await enLangue('en', () => [formatStrengthPrescription(unilat), formatStrengthPrescription(note), formatCardioPrescription(cardio)]))
      .toEqual(['3 × 8 / leg @ 16 kg', '4 × 5 · load RPE 8', '2 × 500 m @ 250 W · rest 2:00']);
    expect(await enLangue('en', () => annotateCardioLines(WOD[4]))).toBe('Row · 2 × 500 m @ 250 W · rest 2:00');
  });
});

describe('tournamentUtils : libellé des tours fourni par l’écran', () => {
  it('en français, le libellé traduit donne le texte de master', async () => {
    const label = (n: number) => i18n.t('score.amrapRounds', { count: n });
    expect(await enLangue('fr', () => [formatAmrapScore(123, 37, label), formatAmrapScore(37, 37, label)]))
      .toEqual(['123 reps (3 tours + 12)', '37 reps (1 tour)']);
  });

  it('avec t(), le pluriel suit la langue', async () => {
    const label = (n: number) => i18n.t('score.amrapRounds', { count: n });
    expect(await enLangue('fr', () => formatScoreDisplay('123', 'amrap', 37, false, label))).toBe('123 reps (3 tours + 12)');
    expect(await enLangue('en', () => [formatAmrapScore(123, 37, label), formatAmrapScore(37, 37, label)]))
      .toEqual(['123 reps (3 rounds + 12)', '37 reps (1 round)']);
  });
});

describe('programme : refus « pas un lundi »', () => {
  it('le contrôle local lève le texte exact de la base, que l’écran reconnaît', async () => {
    await expect(setProgramStartDate('p1', '2026-10-07')).rejects.toThrow(START_NOT_MONDAY);
    expect(START_NOT_MONDAY).toBe('La date de début doit être un lundi');
    expect(FR.programDetail.startMustBeMonday).toBe(START_NOT_MONDAY);
    expect(EN.programDetail.startMustBeMonday).toBe('The start date must be a Monday');
  });

  it('pluriels de l’en-tête', async () => {
    expect(await enLangue('fr', () => [1, 2].map((count) => i18n.t('programDetail.wodsDone', { count }))))
      .toEqual([' · 1 WOD fait', ' · 2 WODs faits']);
    expect(await enLangue('en', () => [1, 8].map((count) => i18n.t('programDetail.fixedSchedule', { count, days: 5 }))))
      .toEqual(['1 week · 5 days/wk', '8 weeks · 5 days/wk']);
  });
});
