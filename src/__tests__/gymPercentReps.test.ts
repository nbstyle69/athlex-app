/**
 * G1 (gymnastique) — un % sur un mouvement de gymnastique est un % du record
 * (max unbroken) : reps = max(1, gymRepsAt(record, P)). Sans record, rien n'est
 * calculé. Un mouvement chargé et une ligne en kg ne changent pas.
 */
import { annotateGymReps, gymPrLabel, gymRepsForPct, GymPrMovement } from '../screens/home/gymZones';
import {
  annotateGymRepsInText, annotateStrengthLoads, formatStrengthPrescription, parseStrengthLine, serializeStrength,
} from '../utils/strengthBlock';
import { applyGymRecordsToGrid, buildStrengthGrid } from '../services/strengthSets';
import { gymRecordForMovement } from '../hooks/useMyOneRepMax';
import { oneRepMaxForMovement, parsePersonalRecords } from '../utils/wod/movementLoadability';

const records: Partial<Record<GymPrMovement, number>> = {
  'Ring Muscle-up': 20,
  'Toes To Bar': 15,
  'Pull-ups': 30,
  'Chest To Bar': 2,
};
const recordFor = (m: string) => records[m as GymPrMovement] ?? null;

describe('rapprochement des noms de gymnastique', () => {
  it('ignore casse, tirets, espaces et pluriel', () => {
    expect(gymPrLabel('Ring Muscle-ups')).toBe('Ring Muscle-up');
    expect(gymPrLabel('ring muscle up')).toBe('Ring Muscle-up');
    expect(gymPrLabel('Toes to Bar')).toBe('Toes To Bar');
    expect(gymPrLabel('Toes-to-bar')).toBe('Toes To Bar');
    expect(gymPrLabel('PULLUPS')).toBe('Pull-ups');
    expect(gymPrLabel('Handstand Push-ups')).toBe('Hand Stand Push Up');
    expect(gymPrLabel('Strict Dips')).toBe('Strict Dips');
    expect(gymPrLabel('Pull Overs')).toBe('Pull Over');
  });

  it('rapproche les abréviations qui ne désignent qu’un libellé', () => {
    expect(gymPrLabel('T2B')).toBe('Toes To Bar');
    expect(gymPrLabel('C2B')).toBe('Chest To Bar');
    expect(gymPrLabel('RMU')).toBe('Ring Muscle-up');
    expect(gymPrLabel('BMU')).toBe('Bar Muscle-up');
    expect(gymPrLabel('Strict HSPU')).toBe('Strict Hand Stand Push Up');
  });

  it('ne rapproche ni une abréviation ambiguë ni un autre mouvement', () => {
    expect(gymPrLabel('HSPU')).toBeNull();
    expect(gymPrLabel('MU')).toBeNull();
    expect(gymPrLabel('Strict Pull-Ups')).toBeNull();
    expect(gymPrLabel('Bench Dips')).toBeNull();
    expect(gymPrLabel('Back Squat')).toBeNull();
  });

  it('lit le record de gymnastique du profil sous son libellé', () => {
    expect(gymRecordForMovement('Ring Muscle-ups', { 'gymnastics_Ring Muscle-up': '20' })).toBe(20);
    expect(gymRecordForMovement('T2B', { 'gymnastics_Toes To Bar': '0' })).toBeNull();
    expect(gymRecordForMovement('Back Squat', { 'gymnastics_Back Squat': '20' })).toBeNull();
  });
});

describe('reps d’un % du record', () => {
  it('arrondit, avec un minimum d’une rep', () => {
    expect(gymRepsForPct(20, 15)).toBe(3);
    expect(gymRepsForPct(15, 60)).toBe(9);
    expect(gymRepsForPct(2, 10)).toBe(1);
  });

  it('ne calcule rien sans record', () => {
    expect(gymRepsForPct(null, 60)).toBeNull();
    expect(gymRepsForPct(0, 60)).toBeNull();
  });
});

describe('formes reconnues par la grille (WOD strength)', () => {
  it('« Mvt — S × P % du max » et « Mvt — S × P % » sur un mouvement de gymnastique', () => {
    expect(parseStrengthLine('Ring Muscle-up — 3 × 15 % du max — repos 1:30')).toMatchObject({
      name: 'Ring Muscle-up', sets: 3, reps: 0, pctOfMax: 15, load: null, restSec: 90,
    });
    expect(parseStrengthLine('Toes to Bar — 2 × 60 %')).toMatchObject({ sets: 2, pctOfMax: 60, load: null });
  });

  it('laisse un mouvement chargé non reconnu sous cette forme (comportement actuel)', () => {
    expect(parseStrengthLine('Back Squat — 5 × 80 %')).toBeNull();
    expect(parseStrengthLine('Strict Pull-Ups — 3 × 50 %')).toBeNull();
  });

  it('« Mvt — S × R @ P % » : les reps écrites gagnent', () => {
    const e = parseStrengthLine('Pull-ups — 4 × 5 @ 60 %')!;
    expect(e).toMatchObject({ sets: 4, reps: 5, load: 60, unit: '%1RM' });
    expect(e.pctOfMax).toBeUndefined();
  });

  it('fait l’aller-retour et s’affiche côté coach', () => {
    const e = parseStrengthLine('Ring Muscle-up — 3 × 15 % du max — repos 1:30')!;
    expect(serializeStrength(e)).toBe('Ring Muscle-up — 3 × 15 % du max — repos 1:30');
    expect(formatStrengthPrescription(e)).toBe('3 × 15 % du max');
  });

  it('pré-remplit les reps depuis le record, et les laisse vides sans record', () => {
    const entries = [
      parseStrengthLine('Ring Muscle-up — 3 × 15 % du max')!,
      parseStrengthLine('Toes to Bar — 2 × 60 % du max')!,
    ];
    const grid = buildStrengthGrid(entries, () => null, name => (name === 'Ring Muscle-up' ? 20 : null));
    expect(grid.map(d => [d.name, d.reps, d.prescribedReps, d.prescribedPctOfMax])).toEqual([
      ['Ring Muscle-up', '3', 3, 15],
      ['Ring Muscle-up', '3', 3, 15],
      ['Ring Muscle-up', '3', 3, 15],
      ['Toes to Bar', '', 0, 60],
      ['Toes to Bar', '', 0, 60],
    ]);
  });

  it('ne change ni une ligne en kg ni une ligne « S × R @ P % »', () => {
    const entries = [
      parseStrengthLine('Back Squat — 5 × 3 @ 100 kg')!,
      parseStrengthLine('Pull-ups — 4 × 5 @ 60 %')!,
    ];
    const grid = buildStrengthGrid(entries, () => null, () => 30);
    expect(grid[0]).toMatchObject({ reps: '3', loadKg: '100', prescribedReps: 3, prescribedLoadKg: 100 });
    expect(grid[0].prescribedPctOfMax).toBeUndefined();
    expect(grid[5]).toMatchObject({ name: 'Pull-ups', reps: '5', loadKg: '', prescribedReps: 5 });
  });

  it('n’annonce pas de charge pour un % de gymnastique', () => {
    const oneRepMaxFor = (n: string) => oneRepMaxForMovement(n, parsePersonalRecords({ 'weightlifting_Back Squat': '100', 'gymnastics_Pull-ups': '30' }));
    expect(annotateStrengthLoads('Pull-ups — 4 × 5 @ 60 %', oneRepMaxFor)).toBe('Pull-ups — 4 × 5 @ 60 %');
    expect(annotateStrengthLoads('Back Squat — 5 × 3 @ 80 %', oneRepMaxFor)).toBe('Back Squat — 5 × 3 @ 80 % (≈ 80 kg)');
  });
});

describe('« (≈ N reps) » dans le texte des WOD', () => {
  const annotate = (line: string) => annotateGymRepsInText(line, recordFor);

  it('annote les formes observées quand l’athlète a un record', () => {
    expect(annotate('60 % du max de Toes to Bar')).toBe('60 % du max (≈ 9 reps) de Toes to Bar');
    expect(annotate('70% Pull-ups')).toBe('70% (≈ 21 reps) Pull-ups');
    expect(annotate('Pull-ups 50%')).toBe('Pull-ups 50% (≈ 15 reps)');
    expect(annotate('60% T2B unbroken')).toBe('60% (≈ 9 reps) T2B unbroken');
    expect(annotate('Ring Muscle-up — 3 × 15 % du max — repos 1:30'))
      .toBe('Ring Muscle-up — 3 × 15 % du max (≈ 3 reps) — repos 1:30');
  });

  it('garde au moins une rep', () => {
    expect(annotate('10% C2B')).toBe('10% (≈ 1 rep) C2B');
  });

  it('les reps écrites gagnent', () => {
    expect(annotate('5 Pull-ups @ 60 %')).toBe('5 Pull-ups @ 60 %');
    expect(annotate('Pull-ups — 4 × 5 @ 60 %')).toBe('Pull-ups — 4 × 5 @ 60 %');
    expect(annotate('Toes to Bar : 5 @ 60 %')).toBe('Toes to Bar : 5 @ 60 %');
  });

  it('en cas de doute, rien', () => {
    expect(annotate('60% Pull-ups + 60% T2B')).toBe('60% Pull-ups + 60% T2B');   // deux % et deux mouvements
    expect(annotate('Pull-ups 60% puis 70%')).toBe('Pull-ups 60% puis 70%');     // deux %
    expect(annotate('Back Squat 60%, Pull-ups')).toBe('Back Squat 60%, Pull-ups'); // % peut-être du squat
    expect(annotate('60% Pull-ups / T2B')).toBe('60% Pull-ups / T2B');           // deux mouvements
    expect(annotate('60% HSPU')).toBe('60% HSPU');                               // abréviation ambiguë
    expect(annotate('60% MU')).toBe('60% MU');
    expect(annotate('50% Strict Pull-ups')).toBe('50% Strict Pull-ups');         // autre mouvement
    expect(annotate('60% Pull-ups lestés 10 kg')).toBe('60% Pull-ups lestés 10 kg');
    expect(annotate('60% Back Squat puis Pull-ups')).toBe('60% Back Squat puis Pull-ups');
    expect(annotate('60% Bar Muscle-up')).toBe('60% Bar Muscle-up');             // sans record
    expect(annotate('Pull-ups au max')).toBe('Pull-ups au max');                 // aucun %
  });

  it('n’annote que les lignes concernées', () => {
    expect(annotateGymReps('5 rounds\n70% Pull-ups\n10 Burpees', recordFor))
      .toBe('5 rounds\n70% (≈ 21 reps) Pull-ups\n10 Burpees');
  });
});

describe('record arrivé après l’ouverture de la grille', () => {
  const entries = [parseStrengthLine('Toes to Bar — 3 × 60 % du max')!];
  const sans = buildStrengthGrid(entries, () => null, () => null);
  const avec = buildStrengthGrid(entries, () => null, () => 15);

  it('recalcule les reps prévues et ne remplit que les champs vides', () => {
    const saisie = sans.map((d, i) => (i === 0 ? { ...d, reps: '12' } : d));
    const out = applyGymRecordsToGrid(saisie, avec);
    expect(out.map(d => [d.reps, d.prescribedReps])).toEqual([['12', 9], ['9', 9], ['9', 9]]);
  });

  it('ne touche pas une ligne dont les reps prévues n’ont pas changé (champ vidé exprès)', () => {
    const vide = avec.map((d, i) => (i === 1 ? { ...d, reps: '' } : d));
    expect(applyGymRecordsToGrid(vide, avec)).toBe(vide);
  });

  it('sans record, rien n’est inventé', () => {
    expect(applyGymRecordsToGrid(sans, sans)).toBe(sans);
  });
});

describe('G3 : prescription « % du max » traduite', () => {
  it('FR « 3 × 15 % du max », EN « 3 × 15% of max » ; le texte du WOD reste en français', async () => {
    const i18n = (await import('../i18n')).default;
    const e = parseStrengthLine('Ring Muscle-up — 3 × 15 % du max')!;
    expect(formatStrengthPrescription(e)).toBe('3 × 15 % du max');
    await i18n.changeLanguage('en');
    try {
      expect(formatStrengthPrescription(e)).toBe('3 × 15% of max');
      expect(serializeStrength(e)).toBe('Ring Muscle-up — 3 × 15 % du max');
    } finally {
      await i18n.changeLanguage('fr');
    }
  });
});
