/**
 * Complexes de musculation en % du 1RM d'un mouvement de référence
 * (nbstyle69/AthleX-Manager#454, PR A) : lecture, affichage, grille, aucun 1RM
 * ni record de gymnastique, aucune rep de badge.
 */
import avant from './fixtures/strength-lines-avant-454.json';
import i18n from '../i18n';
import {
  annotateStrengthLoads as annoter, formatStrengthPrescription as formater, parseStrengthLine, splitStrengthLines,
} from '../utils/strengthBlock';
import {
  addStrengthSet, buildStrengthGrid, gridFromServer, gymRecordCandidates, strengthRecordsFor, type ServerSet,
} from '../services/strengthSets';
import { weightliftingPrLabel } from '../screens/profile/prStorage';
import { movementCredit } from '../utils/wodCredit';
import { readFreeText } from '../utils/freeTextWod';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

// Espaces insécables du français (« 75 % ») lus comme des espaces.
const ns = (t: string) => t.replace(/[  ]/g, ' ');
const annotateStrengthLoads = (...a: Parameters<typeof annoter>) => ns(annoter(...a));
const formatStrengthPrescription = (...a: Parameters<typeof formater>) => ns(formater(...a));

const LIGNE = 'Complexe — 1 Deadlift + 1 Hang Power Clean + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean — repos 2:00';
// 1RM fictifs : Power Clean 95 kg (75 % → 71,25 → 72,5 au pas de 2,5), Deadlift 180 kg.
const RM: Record<string, number> = { 'Power Clean': 95, Deadlift: 180 };
const oneRepMaxFor = (n: string) => RM[n] ?? null;

beforeEach(async () => { await i18n.changeLanguage('fr'); });

describe('non-régression : les lignes existantes donnent le même résultat qu’avant', () => {
  it.each(avant.cases.map(c => [c.line, c] as const))('« %s »', (_l, c) => {
    expect(JSON.parse(JSON.stringify(parseStrengthLine(c.line)))).toEqual(c.expected);
  });
  it('le corpus est conséquent', () => {
    expect(avant.cases.length).toBeGreaterThanOrEqual(60);
    expect(avant.cases.filter(c => c.expected).length).toBeGreaterThanOrEqual(50);
  });
});

describe('détail du WOD (Figma 740:502)', () => {
  it('deux lignes : mouvements, puis séries @ % du 1RM de référence (≈ kg) — repos', () => {
    expect(annotateStrengthLoads(LIGNE, oneRepMaxFor)).toBe(
      'Complexe : 1 Deadlift + 1 Hang Power Clean + 1 Power Clean\n5 × 1 @ 75 % de ton 1RM Power Clean (≈ 72.5 kg) — repos 2:00',
    );
  });
  it('la charge se calcule sur le 1RM du mouvement de référence, pas sur un autre du complexe', () => {
    const l = 'Complexe — 1 Power Clean + 1 Deadlift — 3 × 1 @ 50 %1RM Power Clean';
    expect(annotateStrengthLoads(l, oneRepMaxFor)).toContain('(≈ 47.5 kg)');
    expect(annotateStrengthLoads(l, oneRepMaxFor)).not.toContain('90 kg');
  });
  it('sans 1RM de référence : le pourcentage reste nu', () => {
    expect(annotateStrengthLoads(LIGNE, () => null).split('\n')[1]).toBe('5 × 1 @ 75 % de ton 1RM Power Clean — repos 2:00');
  });
  it('charge en kg, charge libre, repos et tempo', () => {
    expect(annotateStrengthLoads('Complexe — 2 Power Clean + 1 Push Jerk — 4 × 2 @ 80 kg', oneRepMaxFor).split('\n')[1]).toBe('4 × 2 @ 80 kg');
    expect(annotateStrengthLoads('Complexe — 1 Snatch Pull + 1 Hang Snatch — 3 × 1 — charge RPE 8 — repos 1:30 — tempo 21X1', oneRepMaxFor).split('\n')[1])
      .toBe('3 × 1 — charge RPE 8 — repos 1:30 — tempo 21X1');
  });
  it('en anglais : « Complex », noms de mouvements non traduits', async () => {
    await i18n.changeLanguage('en');
    expect(annotateStrengthLoads(LIGNE, oneRepMaxFor)).toBe(
      'Complex: 1 Deadlift + 1 Hang Power Clean + 1 Power Clean\n5 × 1 @ 75% of your Power Clean 1RM (≈ 72.5 kg) — rest 2:00',
    );
  });
  it('les autres lignes du WOD restent intactes', () => {
    expect(annotateStrengthLoads(`${LIGNE}\nNotes libres\n21 Thrusters (43 kg)`, oneRepMaxFor).split('\n').slice(2))
      .toEqual(['Notes libres', '21 Thrusters (43 kg)']);
  });
  it('liste du back-office : une ligne', () => {
    expect(formatStrengthPrescription(parseStrengthLine(LIGNE)!, 95)).toBe(
      'Complexe : 1 Deadlift + 1 Hang Power Clean + 1 Power Clean · 5 × 1 @ 75 % de ton 1RM Power Clean (≈ 72.5 kg) — repos 2:00',
    );
  });
  it('un complexe est un bloc de force (éditeur du back-office)', () => {
    expect(splitStrengthLines([LIGNE, '21 Thrusters'])).toEqual({ wod: ['21 Thrusters'], strength: [LIGNE] });
  });
});

describe('grille (Figma 740:658 / 740:741)', () => {
  const grille = (rm: (n: string) => number | null = oneRepMaxFor) => buildStrengthGrid([parseStrengthLine(LIGNE)!], rm);

  it('séries × complexe préremplies, charge du 1RM de référence, champ kg', () => {
    const g = grille();
    expect(g).toHaveLength(5);
    expect(g[0]).toMatchObject({
      name: '1 Deadlift + 1 Hang Power Clean + 1 Power Clean', reps: '1', loadKg: '72.5', prescribedReps: 1,
      prescribedLoadKg: 72.5, prescribedPct1Rm: 75, loadRequired: true, complex: { ref: 'Power Clean' },
    });
    expect(g.map(d => d.setIndex)).toEqual([1, 2, 3, 4, 5]);
  });
  it('sans 1RM de référence : charge vide, pourcentage gardé', () => {
    expect(grille(() => null)[0]).toMatchObject({ loadKg: '', prescribedLoadKg: null, prescribedPct1Rm: 75 });
  });
  it('« Ajouter une série » et relecture du serveur gardent le complexe', () => {
    const g = addStrengthSet(grille(), 0);
    expect(g[5]).toMatchObject({ isAdded: true, loadRequired: true, complex: { ref: 'Power Clean' } });
    const extra = {
      id: 's6', movement: g[0].name, set_index: 6, reps: 1, load_kg: 80,
      prescribed_reps: null, prescribed_load_kg: null, is_added: true,
    } as unknown as ServerSet;
    expect(gridFromServer(grille(), [extra])[5]).toMatchObject({ isAdded: true, complex: { ref: 'Power Clean' } });
  });
});

describe('un complexe ne prouve jamais un 1RM ni un record de gymnastique', () => {
  it('le nom envoyé ne désigne aucun 1RM (movement_label null)', () => {
    for (const d of buildStrengthGrid([parseStrengthLine(LIGNE)!], oneRepMaxFor)) expect(weightliftingPrLabel(d.name)).toBeNull();
  });
  it('aucun 1RM transmis, même avec une charge très lourde', () => {
    const g = buildStrengthGrid([parseStrengthLine(LIGNE)!], oneRepMaxFor).map(d => ({ ...d, loadKg: '140' }));
    expect(strengthRecordsFor(g)).toEqual([]);
    // Témoin : la même charge sur une ligne Power Clean simple en donne un.
    const simple = buildStrengthGrid([parseStrengthLine('Power Clean — 1 × 1 @ 140 kg')!], oneRepMaxFor);
    expect(strengthRecordsFor(simple).map(r => r.label)).toEqual(['Power Clean']);
  });
  it('complexe de gymnastique fait sans charge : aucun record proposé', () => {
    const g = buildStrengthGrid([parseStrengthLine('Complexe — 1 Ring Muscle-up + 3 Dips — 3 × 1')!], () => null);
    const sets = g.map((d, i) => ({
      id: `s${i}`, movement: d.name, set_index: d.setIndex, reps: 30, load_kg: null, prescribed_reps: 1, prescribed_load_kg: null,
    })) as unknown as ServerSet[];
    expect(gymRecordCandidates(sets, () => 5, g)).toEqual([]);
    expect(g[0].loadRequired).toBe(true);
  });
});

describe('crédit : aucune rep de badge pour un complexe', () => {
  const wod = (description: string, text_mode: 'free' | 'lines' = 'lines') =>
    ({ description, wod_type: 'for-time', text_mode, score_type: null }) as unknown as Parameters<typeof movementCredit>[0];

  it('en lignes : le metcon garde ses règles, le complexe n’ajoute rien', () => {
    const metcon = '21 Thrusters (43 kg)\n15 Pull-ups';
    for (const type of ['time', 'weight'] as const) {
      expect(movementCredit(wod(`${LIGNE}\n${metcon}`), 300, type, false)).toEqual(movementCredit(wod(metcon), 300, type, false));
    }
    expect(movementCredit(wod(LIGNE), 300, 'time', false)).toEqual([]);
  });
  it('texte libre : en tête, lu comme un bloc et jamais crédité ; plus loin, reste du texte', () => {
    const bloc = 'Complexe — 1 Deadlift + 1 Hang Power Clean + 1 Power Clean — 5 × 1 @ 75 %1RM Power Clean';
    const tete = `${bloc}\n21 Thrusters @43/29`;
    expect(readFreeText(tete).blocks).toEqual([bloc]);
    expect(movementCredit(wod(tete, 'free'), 300, 'time', false).map(m => m.name)).toEqual(['Thruster']);
    const loin = '21 Thrusters @43/29\nComplexe — 1 Deadlift + 1 Hang Power Clean — 5 × 1';
    expect(readFreeText(loin).blocks).toEqual([]);
    expect(readFreeText(loin).rest).toContain('Complexe — 1 Deadlift');
  });
});
