/**
 * Musculation de box en plusieurs cartes (#620, #635) : lignes `box_wods` des cartes dans le
 * Whiteboard, le détail de WOD, le programme et l'historique (`displayRow`).
 *   - français : le texte enregistré, octet pour octet ;
 *   - anglais : le rendu du moteur — carte d'un exercice (#635) « Main block · <exercice> »,
 *     « Accessories · … », « Core · … » ; carte #620 « … · Main block » / « … · Accessories », inchangée ;
 *   - ligne « Ajouter au Whiteboard » de l'athlète (un exercice, sans `rendu.partie`) : rendu de M5 inchangé ;
 *   - variante de bloc inconnue (moteur plus récent que l'app) : `displayWod` et `displayRow` (chemin
 *     `renderFromWodJson(…, 'fr') ?? …` de `rendreLigne`) retombent sur le texte enregistré.
 */
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve({}) }));

import { displayRow, displayWod } from '../services/wodRender';
import type { LigneEnregistree } from '../services/wodRender';
import {
  CATALOG_SNAPSHOT, BANK_V1, cartesJourMuscu, exerciseLine, generateMuscu, generateMuscuWeek, nomExercice, partiesMuscu,
  renderFromWodJson, weekSeed, ROLES_PRINCIPAL,
} from '../../packages/wod-engine/src';
import { whiteboardRows } from '../services/wodGenerator';
import type { MuscuWod } from '../../packages/wod-engine/src';

const C = CATALOG_SNAPSHOT;
const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const semaine = (w: number) => generateMuscuWeek({ iso_year: 2027, iso_week: w }, C, BANK_V1, weekSeed('box-0', 'musculation', 2027, w, 0));
const ligne = (c: { wod_json: unknown; title: string; description: string; notes: string | null }): LigneEnregistree =>
  ({ wod_json: c.wod_json, title: c.title, description: c.description, notes: c.notes });

describe('cartes de la journée Musculation dans displayRow', () => {
  const jours = [1, 3, 5].flatMap((w) => semaine(w).days);

  it('français = texte enregistré ; anglais = rendu du moteur, sans accent', () => {
    for (const d of jours) for (const c of cartesJourMuscu(d, C)) {
      expect(displayRow(ligne(c), 'fr')).toEqual({ title: c.title, description: c.description, notes: c.notes });
      const en = displayRow(ligne(c), 'en');
      expect(en).toEqual(renderFromWodJson(c.wod_json, 'en'));
      expect(en.title).not.toBe(c.title);
      expect([en.title, en.description].filter((t) => ACCENT.test(t))).toEqual([]);
    }
  });

  it('carte d\'un exercice (#635) : « <partie> · <exercice> », pas une ligne « une ligne par exercice »', () => {
    const vus = new Set<string>();
    for (const d of jours) for (const p of partiesMuscu(d.wod, C)) {
      const e = p.blocks[0].exercises[0];
      const row = ligne({ wod_json: p, title: p.title, description: p.description, notes: p.notes });
      expect(displayRow(row, 'fr')).toEqual({ title: p.title, description: p.description, notes: p.notes });
      const en = displayRow(row, 'en');
      expect(en).toEqual(renderFromWodJson(p, 'en'));
      const [libelle, nom] = en.title.split(' · ');
      expect(nom).toBe(nomExercice(e.id, e.name, 'en'));
      expect(en.description).not.toBe(exerciseLine(e, 'en'));
      vus.add(libelle);
    }
    expect([...vus].sort()).toEqual(['Accessories', 'Core', 'Main block']);
  });

  it('carte #620 déjà écrite (plusieurs exercices, ou un seul sans `premiere`) : rendu inchangé', () => {
    for (const d of jours.filter((x) => x.target !== 'tronc')) {
      const exs = d.wod.blocks[0].exercises;
      for (const [partie, exercises, libelle] of [
        ['principal', exs.filter((e) => ROLES_PRINCIPAL.includes(e.role)), 'Main block'],
        ['accessoires', exs.filter((e) => !ROLES_PRINCIPAL.includes(e.role)), 'Accessories'],
        ['accessoires', exs.filter((e) => !ROLES_PRINCIPAL.includes(e.role)).slice(0, 1), 'Accessories'],
      ] as const) {
        const w: MuscuWod = { ...d.wod, blocks: [{ kind: 'strength_session', exercises: [...exercises] }], rendu: { ...d.wod.rendu!, partie } };
        const t = renderFromWodJson(w, 'fr')!;
        expect(t.title).toBe(`${d.wod.title} · ${partie === 'principal' ? 'Bloc principal' : 'Accessoires'}`);
        const row = ligne({ wod_json: w, ...t });
        expect(displayRow(row, 'fr')).toEqual(t);
        expect(displayRow(row, 'en').title).toBe(`${renderFromWodJson(d.wod, 'en')!.title} · ${libelle}`);
      }
    }
  });

  it('ligne « Ajouter au Whiteboard » (un exercice, sans rendu.partie) : rendu de M5 inchangé', () => {
    const wod = generateMuscu({ entry: 'express', target: 'jambes', objective: 'hypertrophie', budget_min: 45, equipment: 'box', level: 'inter' }, C, BANK_V1, 7);
    const rows = whiteboardRows(wod);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((r, i) => {
      const e = (r.wod_json as MuscuWod).blocks[0].exercises[0];
      expect((r.wod_json as MuscuWod).rendu?.partie).toBeUndefined();
      expect(displayRow(r, 'fr')).toEqual({ title: r.title, description: r.description, notes: r.notes });
      const en = displayRow(r, 'en');
      expect(en.title).toBe(nomExercice(e.id, e.name, 'en'));
      expect(en.description).toBe(exerciseLine(e, 'en'));
      expect(en.notes === null).toBe(i !== 0);
    });
  });
});

describe('repli : variante inconnue → texte enregistré', () => {
  const saved = { title: 'Étirements', description: 'Texte enregistré\nligne 2', notes: null };
  const inconnu = { source: 'generator', discipline: 'session', v: 2, kind: 'mobility', rendu: { bloc: 'mobilite_v9', lignes: ['x'] } };

  it('displayWod (anglais) retombe sur le texte enregistré', () => {
    expect(displayWod(inconnu, saved, 'en')).toEqual(saved);
    expect(displayWod(inconnu, saved, 'fr')).toEqual(saved);
  });

  it('displayRow (rendreLigne, renderFromWodJson en français) retombe sur le texte enregistré', () => {
    expect(displayRow({ wod_json: inconnu, ...saved }, 'en')).toEqual(saved);
    expect(displayRow({ wod_json: inconnu, ...saved }, 'fr')).toEqual(saved);
    expect(displayRow({ wod_json: { ...inconnu, rendu: 'x' }, ...saved }, 'en')).toEqual(saved);
  });
});
