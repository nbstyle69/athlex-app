/**
 * Moteur M5 (#529) — Whiteboard, détail de WOD, programme et historique dans la langue de l'app.
 *
 * `displayRow` affiche une ligne enregistrée (`box_wods`, `generated_wods`) : en français le texte
 * enregistré lui-même ; en anglais le rendu du moteur, seulement quand le rendu français du même
 * `wod_json` redonne ce texte au caractère près. Sur les 50 premières entrées de l'instantané M0 de
 * chaque chemin, pour chaque forme de ligne que l'app lit :
 *   - `generated_wods` (historique) : titre, mouvements, conseil du coach ;
 *   - `box_wods` posées par « Ajouter au Whiteboard » (une ligne par exercice en Musculation) ;
 *   - `box_wods` posées par la programmation (blocs de séance, semaine complète) ;
 * français = texte enregistré octet pour octet, anglais = rendu du moteur sans un mot français.
 * Repli : JSON non v2, absent, du Manager, ou ligne retouchée à la main → texte enregistré tel quel.
 */
import i18n from '../i18n';
import { annotateShown, displayRow, displayStimulusNote, displayWod, exerciseName } from '../services/wodRender';
import type { LigneEnregistree } from '../services/wodRender';
import { whiteboardRows } from '../services/wodGenerator';
import { annotateGymRepsInText, annotateStrengthLoads } from '../utils/strengthBlock';
import { annotateCardioLines } from '../utils/cardioBlock';
import { CHEMINS, stockes } from '../../packages/wod-engine/__tests__/instantane/chemins';
import { CATALOG_SNAPSHOT, exerciseLine, renderFromWodJson } from '../../packages/wod-engine/src';
import type { GeneratedWod, MuscuWod } from '../../packages/wod-engine/src';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isFrench, strictAllowed } = require('../../scripts/i18n/scanner') as {
  isFrench: (s: string) => boolean; strictAllowed: (s: string) => boolean;
};

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve({}) }));

const N = 50;
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const NOMS = [...new Set(CATALOG_SNAPSHOT.movements.map((m) => m.name))].sort((a, b) => b.length - a.length);
const sansNoms = (l: string) => NOMS.reduce((x, n) => x.split(n).join(' '), l);
const MEMES_EN_ANGLAIS = [/^minute \d+$/];
/** Lignes françaises restantes d'un texte affiché en anglais (méthode du moteur M2, reprise de M4). */
function restesFrancais(en: string[], fr: string[]): string[] {
  const lignesFr = new Set(fr);
  return en.filter((l) => {
    if (!l.trim()) return false;
    const s = sansNoms(l);
    const inchange = lignesFr.has(l) && isFrench(s) && !strictAllowed(s) && !MEMES_EN_ANGLAIS.some((re) => re.test(l));
    return ACCENT.test(s) || inchange;
  });
}
const lignes = (t: { title: string; description: string; notes: string | null }) =>
  [t.title, ...t.description.split('\n'), ...(t.notes ?? '').split('\n')];
const texteDe = (r: LigneEnregistree) => ({ title: r.title, description: r.description ?? '', notes: r.notes ?? null });

type Ligne = { forme: string; k: number; row: LigneEnregistree & { block_name?: string } };
const FORMES = ['generated_wods', 'ajouter-au-whiteboard', 'seance-de-box', 'programmation'] as const;
const parForme: Record<string, Ligne[]> = Object.fromEntries(FORMES.map((f) => [f, []]));

beforeAll(async () => {
  for (const nom of ['wod-express', 'apres-ma-classe', 'musculation', 'musculation-apres-ma-classe']) {
    const c = CHEMINS.find((x) => x.nom === nom)!;
    for (let k = 0; k < N; k++) {
      const { sortie } = await c.produire(k, 'fr');
      for (const s of stockes(nom, sortie)) {
        const wod = s.json as GeneratedWod | MuscuWod;
        // ce que `saveGeneratedWod` écrit : wod_name, movements, coach_tip
        parForme.generated_wods.push({ forme: nom, k, row: { wod_json: wod, title: wod.title, description: wod.description, notes: wod.stimulus.note } });
        for (const r of whiteboardRows(wod)) parForme['ajouter-au-whiteboard'].push({ forme: nom, k, row: r as Ligne['row'] });
      }
    }
  }
  for (const nom of ['seance-functional', 'seance-hybrid']) {
    const c = CHEMINS.find((x) => x.nom === nom)!;
    for (let k = 0; k < N; k++) {
      const { sortie } = await c.produire(k, 'fr');
      for (const s of stockes(nom, sortie)) parForme['seance-de-box'].push({ forme: nom, k, row: { wod_json: s.json, title: s.title, description: s.description, notes: s.notes } });
    }
  }
  const prog = CHEMINS.find((x) => x.nom === 'programmation')!;
  for (let k = 0; k < N; k++) {
    const { sortie } = await prog.produire(k, 'fr');
    for (const s of stockes('programmation', sortie)) parForme.programmation.push({ forme: 'programmation', k, row: { wod_json: s.json, title: s.title, description: s.description, notes: s.notes } });
  }
}, 300_000);

afterAll(() => i18n.changeLanguage('fr'));

describe('displayRow — lignes enregistrées, 50 entrées par chemin', () => {
  for (const forme of FORMES) {
    it(`${forme} : des lignes, toutes v2 du moteur`, () => {
      expect(parForme[forme].length).toBeGreaterThanOrEqual(N);
      for (const l of parForme[forme]) expect((l.row.wod_json as { v?: number }).v).toBe(2);
    });

    it(`${forme} : français = texte enregistré, octet pour octet`, () => {
      for (const l of parForme[forme]) expect(displayRow(l.row, 'fr')).toEqual(texteDe(l.row));
    });

    it(`${forme} : anglais = rendu du moteur (pas le repli), sans un mot français`, () => {
      for (const l of parForme[forme]) {
        const en = displayRow(l.row, 'en');
        const w = l.row.wod_json as MuscuWod;
        const ligneExercice = w.discipline === 'musculation' && w.blocks[0].exercises.length === 1;
        // l'app enregistre la note du stimulus (coach_tip, notes) ; la programmation, les notes du rendu
        const noteStimulus = l.row.notes != null && l.row.notes === w.stimulus?.note;
        const rendu = renderFromWodJson(l.row.wod_json, 'en')!;
        const attendu = ligneExercice
          ? { title: exerciseName(w.blocks[0].exercises[0]), description: exerciseLine(w.blocks[0].exercises[0], 'en'), notes: l.row.notes == null ? null : displayStimulusNote(w, 'en') }
          : { ...rendu, notes: noteStimulus ? displayStimulusNote(w, 'en') : rendu.notes };
        expect(en).toEqual(attendu);
        if (!ligneExercice) expect({ ...en, notes: null }).toEqual({ ...displayWod(l.row.wod_json, texteDe(l.row), 'en'), notes: null });
        expect(en.description).not.toBe(l.row.description);
        expect(restesFrancais(lignes(en), lignes(texteDe(l.row)))).toEqual([]);
      }
    });

    it(`${forme} : l'affichage ne modifie ni la ligne ni son wod_json`, () => {
      for (const l of parForme[forme].slice(0, 20)) {
        const avant = JSON.stringify(l.row);
        displayRow(l.row, 'en');
        displayRow(l.row, 'fr');
        expect(JSON.stringify(l.row)).toBe(avant);
      }
    });
  }

  it('Musculation « Ajouter au Whiteboard » : la note du stimulus seulement sur la première ligne, en anglais', () => {
    const lignesMuscu = parForme['ajouter-au-whiteboard'].filter((l) => (l.row.wod_json as MuscuWod).discipline === 'musculation');
    expect(lignesMuscu.length).toBeGreaterThan(0);
    for (const l of lignesMuscu) {
      const en = displayRow(l.row, 'en');
      if (l.row.notes == null) expect(en.notes).toBeNull();
      else expect(en.notes).not.toBe(l.row.notes);
    }
  });
});

describe('repli : le texte enregistré, tel quel, même en anglais', () => {
  const saved = { title: 'Fran', description: '21-15-9\nThrusters 43 kg\nPull-ups', notes: 'Note du coach' };
  const v2 = () => parForme['seance-de-box'][0].row;

  it('JSON absent, null, du Manager (v1), saisie libre, forme inconnue', () => {
    const formes: unknown[] = [undefined, null, '', 'texte', 42, [], {}, { version: 1, source: 'manager', movements: [] },
      { v: 2, source: 'manager' }, { v: 1, source: 'generator' }, { v: '2', source: 'generator' }, { source: 'generator' }];
    for (const wod_json of formes) {
      expect(displayRow({ ...saved, wod_json }, 'en')).toEqual(saved);
      expect(displayRow({ ...saved, wod_json }, 'fr')).toEqual(saved);
    }
  });

  it('v2 du moteur dont une discipline est inconnue : rien à rendre → texte enregistré', () => {
    const j = { ...(v2().wod_json as object), discipline: 'yoga' };
    expect(displayRow({ ...saved, wod_json: j }, 'en')).toEqual(saved);
  });

  it('description et notes absentes : chaîne vide et null, jamais undefined', () => {
    expect(displayRow({ title: 'Murph', wod_json: null }, 'en')).toEqual({ title: 'Murph', description: '', notes: null });
  });

  it('ligne du moteur retouchée à la main (titre, description ou notes) : tout le texte enregistré, titre compris', () => {
    for (const forme of FORMES) {
      for (const l of parForme[forme].slice(0, 10)) {
        const r = l.row;
        const retouches: LigneEnregistree[] = [
          { ...r, title: `${r.title} — version du coach` },
          { ...r, description: `${r.description ?? ''}\nFinir par 400 m de course` },
          { ...r, notes: 'Échauffement libre' },
        ];
        for (const x of retouches) expect(displayRow(x, 'en')).toEqual(texteDe(x));
      }
    }
  });

  it('displayLangue : app en anglais → rendu anglais, sinon texte enregistré', async () => {
    const r = parForme['seance-de-box'][0].row;
    await i18n.changeLanguage('en');
    expect(displayRow(r)).toEqual(renderFromWodJson(r.wod_json, 'en'));
    await i18n.changeLanguage('fr');
    expect(displayRow(r)).toEqual(texteDe(r));
  });
});

describe('annotateShown — annotations calculées sur le texte enregistré, reportées sur le texte affiché', () => {
  const kg = (txt: string) => annotateStrengthLoads(txt, () => 100);
  const tout = (txt: string) => annotateCardioLines(annotateGymRepsInText(kg(txt), () => 30));
  const box = () => [...parForme['seance-de-box'], ...parForme.programmation];

  it('même texte (français, repli) : exactement l’annotation d’avant', () => {
    for (const l of box().slice(0, 200)) {
      const d = l.row.description ?? '';
      expect(annotateShown(d, d, tout)).toBe(tout(d));
    }
  });

  it('≈ kg d’une ligne %1RM : même suffixe, en fin de la ligne anglaise ; le français n’est pas réécrit', () => {
    let vues = 0;
    for (const l of box()) {
      const fr = l.row.description ?? '';
      const en = displayRow(l.row, 'en').description;
      const out = annotateShown(fr, en, tout).split('\n');
      en.split('\n').forEach((ligne, i) => {
        const f = fr.split('\n')[i];
        const a = tout(f);
        if (a === f) { expect(out[i]).toBe(ligne); return; }
        vues++;
        const suffixe = a.slice(f.trimEnd().length);
        expect(suffixe).toMatch(/^ \(≈ [\d.]+ kg\)$/);
        expect(out[i]).toBe(ligne.trimEnd() + suffixe);
        expect(out[i]).not.toBe(a);
      });
    }
    expect(vues).toBeGreaterThan(100);
  });

  it('en cas de doute, rien : insertion au milieu, ligne réécrite, nombre de lignes différent', () => {
    const reps = (txt: string) => annotateGymRepsInText(txt, (n) => (n === 'Pull-ups' ? 20 : null));
    const fr = 'Pull-ups à 50 % du max, repos 1 min';
    expect(reps(fr)).toBe('Pull-ups à 50 % du max (≈ 10 reps), repos 1 min');
    expect(annotateShown(fr, 'Pull-ups at 50% of max, rest 1 min', reps)).toBe('Pull-ups at 50% of max, rest 1 min');
    const cardio = 'Rameur — 2 × 500 m — repos 2:00';
    if (annotateCardioLines(cardio) !== cardio) {
      expect(annotateShown(cardio, 'Row — 2 × 500 m — rest 2:00', annotateCardioLines)).toBe('Row — 2 × 500 m — rest 2:00');
    }
    expect(annotateShown('A\nB', 'A', kg)).toBe('A');
  });
});
