/**
 * Noms anglais du catalogue, par id (PR « Données » D1, #530).
 *
 *   1. complétude : une entrée par id ACTIF du snapshot (mouvements et exercices de Musculation,
 *      qui sont des lignes du même catalogue), plus les 14 inactifs encore cités par la banque
 *      des séances et la Musculation, et aucune entrée pour un id inconnu ; un id actif
 *      ajouté sans traduction fait échouer la CI, pour qu'on la traduise avant de relancer ;
 *   2. entrées propres : aucun accent, aucun mot français (scanner des écrans), ni CrossFit, ni
 *      Hyrox, ni Musculation, ni marque d'équipement ; un nom anglais par id (jamais deux ids
 *      distincts sous le même nom) ;
 *   3. lecture : le français ne lit jamais le dictionnaire, un id inconnu garde son nom français ;
 *   4. rendu : `renderFromWodJson(…, 'en')` affiche les noms anglais (mouvements, substituts,
 *      variantes, exercices, montée en charge, blocs de séance), le français reste le texte
 *      enregistré, et la génération n'écrit que des noms français (sortie inchangée).
 * L'instantané anglais (`instantane-en.test.ts`) vérifie en plus les 4 200 entrées sans nom mis de côté.
 */
import {
  BANK_V1, CATALOG_SNAPSHOT, FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES, exerciseLine, generateBlocC, generateMuscu, generateSession,
  mouvements, nomExercice, nomMouvement, render, renderFromWodJson, renderMuscu, rendreBlocSeance, substitutionAffichee, substitutionFor,
  varianteAffichee, movementById,
} from '../src';
import type { Category, GeneratedWod, MuscuEquipment, MuscuTarget, RenduBlocSeance } from '../src';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isFrench, strictAllowed } = require('../../../scripts/i18n/scanner') as {
  isFrench: (s: string) => boolean; strictAllowed: (s: string) => boolean;
};

const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const INTERDITS = /crossfit|hyrox|musculation|skierg|echo bike|abmat|concept ?2|assault|rogue/i;
/**
 * Noms anglais que le scanner prend pour du français parce qu'un de leurs mots existe aussi en
 * français (« Dips », « Pistols »…). Liste fermée, chaque entrée relue : ce sont les noms d'usage
 * courant en anglais. Vide aujourd'hui ; toute nouvelle exception se motive ici.
 */
const MEMES_MOTS: readonly string[] = [];

const actifs = CATALOG_SNAPSHOT.movements.filter((m) => m.active);
const exercices = actifs.filter((m) => m.muscu);

describe('noms anglais du catalogue : complétude (D1)', () => {
  it('une entrée par id actif du snapshot (mouvements, puis exercices de Musculation)', () => {
    const manquants = actifs.filter((m) => !Object.prototype.hasOwnProperty.call(mouvements, m.id)).map((m) => `${m.id} (${m.name})`);
    const exosManquants = exercices.filter((m) => !Object.prototype.hasOwnProperty.call(mouvements, m.id)).map((m) => m.id);
    const rapport = `mouvements : ${actifs.length - manquants.length} / ${actifs.length} ids actifs couverts ; `
      + `exercices de Musculation : ${exercices.length - exosManquants.length} / ${exercices.length}`;
    expect({ rapport, manquants }).toEqual({ rapport: `mouvements : ${actifs.length} / ${actifs.length} ids actifs couverts ; exercices de Musculation : ${exercices.length} / ${exercices.length}`, manquants: [] });
    expect(actifs.length).toBeGreaterThanOrEqual(310);
    expect(exercices.length).toBeGreaterThanOrEqual(233);
  });

  it('ids inactifs encore cités (banque des séances, Musculation) : une entrée aussi', () => {
    expect(CATALOG_SNAPSHOT.movements.filter((m) => !m.active && !Object.prototype.hasOwnProperty.call(mouvements, m.id)).map((m) => m.id)).toEqual([]);
  });

  it('aucune entrée pour un id absent du catalogue', () => {
    const ids = new Set(CATALOG_SNAPSHOT.movements.map((m) => m.id));
    expect(Object.keys(mouvements).filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe('noms anglais du catalogue : entrées propres (D1)', () => {
  const entrees = Object.entries(mouvements);

  it('aucun accent, aucun mot français (scanner des écrans, exceptions motivées)', () => {
    expect(entrees.filter(([, v]) => ACCENT.test(v))).toEqual([]);
    expect(entrees.filter(([, v]) => isFrench(v) && !strictAllowed(v) && !MEMES_MOTS.includes(v))).toEqual([]);
  });

  it('ni CrossFit, ni Hyrox, ni Musculation, ni marque d\'équipement', () => {
    expect(entrees.filter(([, v]) => INTERDITS.test(v))).toEqual([]);
  });

  it('un nom par id : jamais deux ids distincts sous le même nom anglais', () => {
    const vus = new Map<string, string>();
    const doublons: string[] = [];
    for (const [id, v] of entrees) {
      const k = v.toLowerCase();
      if (vus.has(k)) doublons.push(`${vus.get(k)} / ${id} : ${v}`);
      vus.set(k, id);
    }
    expect(doublons).toEqual([]);
  });

  it('pas d\'espace en trop, une majuscule en tête', () => {
    expect(entrees.filter(([, v]) => v !== v.trim() || /\s{2}/.test(v) || !/^[A-Z]/.test(v))).toEqual([]);
  });
});

describe('noms anglais du catalogue : lecture (D1)', () => {
  it('le français rend le nom donné, sans lire le dictionnaire', () => {
    expect(nomMouvement('thruster', 'Nom en base', 'fr')).toBe('Nom en base');
    expect(nomMouvement('hindu_push_up', 'Pompes Hindu')).toBe('Pompes Hindu');
    expect(nomExercice('hindu_push_up', 'Pompes Hindu', 'fr')).toBe('Pompes Hindu');
  });

  it('anglais : l\'entrée de l\'id, quel que soit le nom enregistré', () => {
    expect(nomMouvement('hindu_push_up', 'Pompes Hindu', 'en')).toBe('Hindu Push-Ups');
    expect(nomMouvement('hindu_push_up', 'Nom renommé au Manager', 'en')).toBe('Hindu Push-Ups');
    expect(nomExercice('band_row', 'Rowing à l\'élastique', 'en')).toBe('Banded Row');
  });

  it('repli : un id sans entrée garde son nom français, sans erreur', () => {
    expect(nomMouvement('ajoute_au_manager', 'Tirage nouveau', 'en')).toBe('Tirage nouveau');
    expect(nomMouvement('constructor', 'Nom', 'en')).toBe('Nom');
    expect(nomMouvement('__proto__', 'Nom', 'en')).toBe('Nom');
  });
});

/** Un WOD Functional / Hybrid par graine, jusqu'à en trouver un qui vérifie `ok`. */
function wodOu(ok: (w: GeneratedWod) => boolean, discipline: 'functional' | 'hybrid' = 'functional'): GeneratedWod {
  for (let seed = 1; seed < 3000; seed++) {
    const w = generateBlocC({ entry: 'express', discipline, intention: 'mixed', budget_min: 20 }, CATALOG_SNAPSHOT, BANK_V1, seed);
    if (ok(w)) return w;
  }
  throw new Error('aucun WOD ne convient');
}

describe('rendu anglais des noms (D1)', () => {
  it('WOD express : noms anglais dans le titre et la description, français = texte enregistré', () => {
    const w = wodOu((x) => x.blocks[0].movements.some((m) => mouvements[m.id] !== m.name));
    const m = w.blocks[0].movements.find((x) => mouvements[x.id] !== x.name)!;
    const en = renderFromWodJson(w, 'en')!;
    const tout = `${en.title}\n${en.description}`;
    expect(tout).toContain(mouvements[m.id]);
    expect(tout).not.toContain(m.name);
    const fr = renderFromWodJson(w, 'fr')!;
    expect({ title: fr.title, description: fr.description }).toEqual({ title: w.title, description: w.description });
  });

  it('substituts et variantes : traduits par l\'id retrouvé dans le catalogue, français tel quel', () => {
    let vus = 0;
    for (const discipline of ['functional', 'hybrid'] as const) {
      for (let seed = 1; seed <= 150; seed++) {
        const w = generateBlocC({ entry: 'express', discipline, intention: 'mixed', budget_min: 20 }, CATALOG_SNAPSHOT, BANK_V1, seed);
        const cats: readonly Category[] = discipline === 'functional' ? FUNCTIONAL_CATEGORIES : HYBRID_CATEGORIES;
        for (const m of w.blocks[0].movements) for (const c of cats) {
          const sub = m.substitutions_by_category[c];
          if (sub) {
            const id = substitutionFor(movementById(CATALOG_SNAPSHOT, m.id)!, c)!;
            expect(substitutionAffichee(m, c, 'fr')).toBe(sub);
            expect(substitutionAffichee(m, c, 'en')).toBe(mouvements[id]);
            vus++;
          }
          const v = m.variant_by_category[c];
          if (v) {
            expect(varianteAffichee(m, c, 'fr')).toBe(v);
            expect(varianteAffichee(m, c, 'en')).toBe(mouvements[movementById(CATALOG_SNAPSHOT, m.id)!.variant_up!]);
            vus++;
          }
        }
      }
    }
    expect(vus).toBeGreaterThan(50);
  });

  it('substitut dont le nom ne correspond plus au catalogue : nom enregistré, tel quel', () => {
    const w = wodOu((x) => x.blocks[0].movements.some((m) => Object.values(m.substitutions_by_category).some(Boolean)));
    const m = w.blocks[0].movements.find((x) => Object.values(x.substitutions_by_category).some(Boolean))!;
    const c = (Object.keys(m.substitutions_by_category) as Category[]).find((k) => m.substitutions_by_category[k])!;
    const renomme = { ...m, substitutions_by_category: { ...m.substitutions_by_category, [c]: 'Nom renommé' } };
    expect(substitutionAffichee(renomme, c, 'en')).toBe('Nom renommé');
  });

  it('repli au rendu : un mouvement d\'id inconnu garde son nom, sans erreur', () => {
    const w = wodOu(() => true);
    const m0 = w.blocks[0].movements[0];
    const inconnu: GeneratedWod = { ...w, blocks: [{ ...w.blocks[0], movements: [{ ...m0, id: 'ajoute_au_manager', name: 'Mouvement nouveau' }, ...w.blocks[0].movements.slice(1)] }] };
    const en = renderFromWodJson(inconnu, 'en')!;
    expect(en.description).toContain('Mouvement nouveau');
    expect(render(inconnu, 'fr').description).toContain('Mouvement nouveau');
  });

  it('Musculation : lignes d\'exercice et montée en charge en anglais, français = texte enregistré', () => {
    const cas: Array<[MuscuTarget, MuscuEquipment, 'force' | 'hypertrophie']> = [
      ['push', 'none', 'hypertrophie'], ['pull', 'none', 'hypertrophie'], ['jambes', 'none', 'hypertrophie'], ['push', 'gym', 'force'], ['dos', 'box', 'force'],
    ];
    let francais = 0;
    let montees = 0;
    for (const [target, equipment, objective] of cas) {
      const w = generateMuscu({ entry: 'express', target, objective, budget_min: 45, equipment, level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, 11);
      const en = renderFromWodJson(w, 'en')!;
      for (const e of w.blocks[0].exercises) {
        expect(exerciseLine(e, 'en').startsWith(`${mouvements[e.id]} — `)).toBe(true);
        expect(exerciseLine(e, 'fr').startsWith(`${e.name} — `)).toBe(true);
        expect(en.description).toContain(mouvements[e.id]);
        if (mouvements[e.id] !== e.name) francais++;
      }
      if (w.rendu?.stimulus.montee) {
        const main = w.blocks[0].exercises.find((e) => e.role === 'main_compound')!;
        expect(en.notes).toContain(mouvements[main.id]);
        montees++;
      }
      expect(renderFromWodJson(w, 'fr')!.description).toBe(w.description);
      expect(renderMuscu(w, 'fr')).toBe(w.description);
    }
    expect(francais).toBeGreaterThan(0);
    expect(montees).toBeGreaterThan(0);
  });

  it('séance de box : noms des blocs par id, repli sur le nom du bloc puis sur l\'id', () => {
    const s = generateSession({ day: 1, iso_year: 2027, iso_week: 3 }, CATALOG_SNAPSHOT, BANK_V1, 5);
    const blocs = s.blocks.map((b) => (b.wod_json as { rendu?: RenduBlocSeance }).rendu).filter((r): r is RenduBlocSeance => !!r && 'noms' in r);
    expect(blocs.length).toBeGreaterThan(0);
    for (const p of blocs) {
      const noms = (p as { noms: Record<string, string> }).noms;
      const en = rendreBlocSeance(p, 'en');
      for (const [id, nom] of Object.entries(noms)) if (mouvements[id] !== nom && en.description.includes(nom)) {
        throw new Error(`nom français resté en anglais : ${id} « ${nom} »`);
      }
      const inconnu = { ...p, noms: { ...noms, zz_inconnu: 'Nom FR' } } as RenduBlocSeance;
      expect(() => rendreBlocSeance(inconnu, 'en')).not.toThrow();
    }
  });
});

describe('écriture inchangée (D1) : la génération en anglais ne stocke que des noms français', () => {
  it('WOD, exercices et noms de séance : noms du catalogue', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = generateBlocC({ entry: 'express', discipline: 'functional', intention: 'mixed', budget_min: 20 }, CATALOG_SNAPSHOT, BANK_V1, seed, 'en');
      for (const m of w.blocks[0].movements) expect(m.name).toBe(movementById(CATALOG_SNAPSHOT, m.id)!.name);
    }
    const mu = generateMuscu({ entry: 'express', target: 'push', objective: 'force', budget_min: 45, equipment: 'box', level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, 3, 'en');
    for (const e of mu.blocks[0].exercises) expect(e.name).toBe(movementById(CATALOG_SNAPSHOT, e.id)!.name);
    if (mu.rendu?.stimulus.montee) expect(CATALOG_SNAPSHOT.movements.some((m) => m.name === mu.rendu!.stimulus.montee)).toBe(true);
  });
});
