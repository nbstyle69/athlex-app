/**
 * Musculation de box en plusieurs cartes (#620), PR 1 « affichage » : lignes `box_wods` des nouvelles
 * cartes dans le Whiteboard, le détail de WOD, le programme et l'historique (`displayRow`).
 *   - français : le texte enregistré, octet pour octet ;
 *   - anglais : le rendu du moteur (titre « · Main block » / « · Accessories »), même pour une carte
 *     partielle à un seul exercice (qui n'est pas une ligne « une ligne par exercice ») ;
 *   - variante de bloc inconnue (moteur plus récent que l'app) : `displayWod` et `displayRow` (chemin
 *     `renderFromWodJson(…, 'fr') ?? …` de `rendreLigne`) retombent sur le texte enregistré.
 */
import { displayRow, displayWod } from '../services/wodRender';
import type { LigneEnregistree } from '../services/wodRender';
import {
  CATALOG_SNAPSHOT, BANK_V1, cartesJourMuscu, generateMuscuWeek, partiesMuscu, renderFromWodJson, weekSeed,
} from '../../packages/wod-engine/src';
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

  it('carte partielle à un seul exercice : rendue comme une carte, pas comme « une ligne par exercice »', () => {
    const d = jours.find((x) => x.target !== 'tronc')!;
    const [p] = partiesMuscu(d.wod, C);
    const seul: MuscuWod = { ...p, blocks: [{ kind: 'strength_session', exercises: [p.blocks[0].exercises[0]] }] };
    const t = renderFromWodJson(seul, 'fr')!;
    const row = { wod_json: seul, ...t };
    expect(displayRow(row, 'fr')).toEqual(t);
    expect(displayRow(row, 'en')).toEqual(renderFromWodJson(seul, 'en'));
    expect(displayRow(row, 'en').title).toMatch(/ · Main block$/);
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
