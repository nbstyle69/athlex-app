// PR 1a du chantier anglais : minuteur, générateur, Musculation, partage.
import i18n from '../i18n';
import { FORMATS, INTENTIONS, VESTS, patternLabel, familyLabel } from '../screens/wod/wodGeneratorOptions';
import {
  MUSCU_EQUIPMENTS, MUSCU_OBJECTIVES, muscuDisplayedFor, oneRepMaxLine, targetLabel, targetOrderFor, targetOrderHint,
} from '../screens/wod/muscuOptions';
import {
  TIMER_BLOCK_TYPES, buildFullSeqBlockFromWOD, buildMuscuSplitBlock, formatBlockPreconfig, formatWODPreconfig,
} from '../utils/wodToTimer';

const enLangue = async <T>(lang: 'fr' | 'en', fn: () => T): Promise<T> => { await i18n.changeLanguage(lang); return fn(); };
afterAll(() => i18n.changeLanguage('fr'));

describe('options : la valeur envoyée ne dépend pas de la langue, seul le libellé est traduit', () => {
  const valeurs = () => ({
    formats: FORMATS.map((f) => f.key), intentions: { f: INTENTIONS.functional.map((i) => i.key), h: INTENTIONS.hybrid.map((i) => i.key) },
    vests: VESTS.map((v) => v.key), objectifs: MUSCU_OBJECTIVES.map((o) => o.key), materiel: MUSCU_EQUIPMENTS.map((e) => e.key),
    cibles: targetOrderFor('female'), minuteur: TIMER_BLOCK_TYPES.map((b) => b.key),
  });
  it('valeurs identiques en fr et en en', async () => {
    expect(await enLangue('en', valeurs)).toEqual(await enLangue('fr', valeurs));
  });

  it('libellés français mot pour mot', async () => {
    await i18n.changeLanguage('fr');
    expect(FORMATS.map((f) => i18n.t(f.labelKey))).toEqual(['Surprends-moi', 'AMRAP', 'For time', 'EMOM', 'Chipper', 'Stations', 'Intervalles']);
    expect(VESTS.map((v) => i18n.t(v.labelKey))).toEqual(['Sans', 'Avec', 'Optionnel']);
    expect(MUSCU_OBJECTIVES.map((o) => i18n.t(o.labelKey))).toEqual(['Prise de muscle', 'Force', 'Tonification']);
    expect(targetLabel('fessiers_ischios')).toBe('Fessiers + ischios');
    expect(targetLabel('epaules')).toBe('Épaules');
    expect([patternLabel('push_v'), familyLabel('bodyweight')]).toEqual(['poussée verticale', 'poids du corps']);
    expect(muscuDisplayedFor('inter').text).toBe("Affiché pour : Intermédiaire · d'après ton profil");
    expect(oneRepMaxLine({ back_squat: 120 }).text).toBe("Charges d'après tes 1RM : Squat 120");
    expect(targetOrderHint(null).text).toBe('Renseigne ton profil pour un ordre adapté');
  });

  it('en anglais : libellés traduits, l’objectif « Force » devient « Max Strength »', async () => {
    await i18n.changeLanguage('en');
    expect(MUSCU_OBJECTIVES.map((o) => i18n.t(o.labelKey))).toEqual(['Muscle gain', 'Max Strength', 'Toning']);
    expect(INTENTIONS.functional.map((i) => i18n.t(i.labelKey))).toEqual(['Mixed', 'Cardio', 'Heavy', 'Gym']); // « Heavy » validé par Nab (PR Gérant)
    expect(i18n.t('training.disciplines.musculation')).toBe('Strength');
    expect(targetLabel('fessiers_ischios')).toBe('Glutes + hamstrings');
    expect(muscuDisplayedFor(null).text).toBe('Shown for: Beginner · level not set');
    expect(oneRepMaxLine({}).link).toBe('calculator');
  });
});

describe('wodToTimer : mêmes phases dans les deux langues, résumé traduit', () => {
  const WODS = [
    { wod_type: 'amrap', time_cap_seconds: 720, rounds: 0 },
    { wod_type: 'for-time', time_cap_seconds: 750, rounds: 5 },
    { wod_type: 'emom', time_cap_seconds: 600, rounds: 0, emom_interval_minutes: 2 },
    { wod_type: 'tabata', time_cap_seconds: 0, rounds: 8, tabata_work_seconds: 20, tabata_rest_seconds: 10 },
    { wod_type: 'strength', time_cap_seconds: 0 },
  ];
  const MUSCU = { blocks: [{ exercises: [{ name: 'Back Squat', sets: 5, rest_s: 150 }, { name: 'Fentes bulgares', sets: 3, rest_s: 90 }] }] };
  const sansId = ({ id: _id, ...b }: { id: string }) => b;
  const phases = () => ({ blocs: WODS.map((w) => sansId(buildFullSeqBlockFromWOD(w as never))), muscu: sansId(buildMuscuSplitBlock(MUSCU)) });

  it('les blocs construits sont identiques en fr et en en', async () => {
    expect(await enLangue('en', phases)).toEqual(await enLangue('fr', phases));
  });

  it('le résumé suit la langue (français inchangé)', async () => {
    const resume = () => [
      ...WODS.map((w) => formatWODPreconfig(w as never)),
      formatBlockPreconfig(buildMuscuSplitBlock(MUSCU)),
      formatBlockPreconfig({ ...buildMuscuSplitBlock({ blocks: [{ exercises: [{ name: 'Round', sets: 1, rest_s: 0 }] }] }) }),
    ];
    expect(await enLangue('fr', resume)).toEqual([
      'AMRAP · 12 min', 'For Time · Cap 12:30', 'E2MOM · 5 rounds', 'Tabata · 8 × 20/10s', 'Strength · Chrono libre',
      'Split · 2 exercices · 8 séries', 'Split · 1 round',
    ]);
    expect(await enLangue('en', resume)).toEqual([
      'AMRAP · 12 min', 'For Time · Cap 12:30', 'E2MOM · 5 rounds', 'Tabata · 8 × 20/10s', 'Strength · Free timer',
      'Split · 2 exercises · 8 sets', 'Split · 1 round',
    ]);
  });
});
