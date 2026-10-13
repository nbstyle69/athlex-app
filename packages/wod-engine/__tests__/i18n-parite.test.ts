/**
 * Dictionnaires du moteur (étude i18n « Moteur », M2) : `fr.ts` et `en.ts` ont les mêmes
 * clés et, pour chaque gabarit, le même nombre de paramètres ; l'anglais n'écrit jamais
 * « (s) » (les pluriels sont des fonctions), ni « CrossFit », « Hyrox » ou « Musculation » ;
 * chaque texte de la banque a sa traduction, sans ambiguïté ; les mots déjà traduits dans
 * l'app (`src/i18n/locales/en.json`) sont repris à l'identique ; les refus de la
 * Musculation portent un code stable et gardent leur texte français.
 */
import { readFileSync } from 'fs';
import path from 'path';
import {
  fr, en, correspondancesBanque, banqueVers, generateMuscu, InvalidMuscuParams, CATALOG_SNAPSHOT, BANK_V1,
} from '../src';
import type { MuscuParams } from '../src';
import enApp from '../../../src/i18n/locales/en.json';

type Arbre = Record<string, unknown>;

/** Feuilles d'un dictionnaire : chemin → `texte`, `fonction/<arité>`, `tableau/<longueur>`. */
function feuilles(o: unknown, chemin = '', out = new Map<string, string>()): Map<string, string> {
  if (typeof o === 'function') out.set(chemin, `fonction/${o.length}`);
  else if (typeof o === 'string') out.set(chemin, 'texte');
  else if (Array.isArray(o)) { out.set(chemin, `tableau/${o.length}`); o.forEach((v, i) => feuilles(v, `${chemin}[${i}]`, out)); }
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) feuilles(v, chemin ? `${chemin}.${k}` : k, out);
  else out.set(chemin, typeof o);
  return out;
}

/** Tous les textes que peut produire un dictionnaire : chaînes, et gabarits appelés avec des paramètres témoins. */
function textesProduits(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (typeof o === 'function') {
    const temoins = Array.from({ length: o.length }, (_, i) => (i % 2 ? 2 : 1));
    try { out.push(String((o as (...a: unknown[]) => unknown)(...temoins))); } catch { /* gabarit à tableau */ }
    try { out.push(String((o as (...a: unknown[]) => unknown)(['quadriceps', 'dos']))); } catch { /* idem */ }
  } else if (o && typeof o === 'object') for (const v of Object.values(o)) textesProduits(v, out);
  return out;
}

const SOURCE_EN = readFileSync(path.join(__dirname, '../src/i18n/en.ts'), 'utf8');

describe('dictionnaires du moteur : parité fr.ts ↔ en.ts', () => {
  it('mêmes clés dans les deux sens, même nature et même nombre de paramètres par clé', () => {
    const a = feuilles(fr);
    const b = feuilles(en);
    const manquantes = [...a.keys()].filter((k) => !b.has(k));
    const enTrop = [...b.keys()].filter((k) => !a.has(k));
    const differentes = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k)).map((k) => `${k} : ${a.get(k)} ≠ ${b.get(k)}`);
    expect({ manquantes, enTrop, differentes }).toEqual({ manquantes: [], enTrop: [], differentes: [] });
    expect(a.size).toBeGreaterThan(300);
  });

  it('pluriels par fonctions : aucun « (s) » dans en.ts', () => {
    expect(SOURCE_EN).not.toMatch(/\(s\)/);
    expect(en.rendu.roundsForTime(1, '')).toBe('1 round for time');
    expect(en.rendu.roundsForTime(4, '')).toBe('4 rounds for time');
    expect(en.estimation.rounds(1)).toBe('≈ 1 round');
  });

  it('marques et Musculation : ni « CrossFit », ni « Hyrox », ni « Musculation » dans les textes anglais', () => {
    const tous = textesProduits(en);
    expect(tous.length).toBeGreaterThan(300);
    expect(tous.filter((t) => /crossfit|hyrox|musculation/i.test(t))).toEqual([]);
    expect(SOURCE_EN.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')).not.toMatch(/crossfit|hyrox/i);
  });

  it('banque : chaque texte français a une traduction, et une seule', () => {
    const { table, conflits } = correspondancesBanque('en');
    expect(conflits).toEqual([]);
    expect(table.size).toBeGreaterThan(100);
    // les textes de la banque embarquée (= seeds SQL) se traduisent tous
    const tb = banqueVers('en');
    const notes = BANK_V1.skeletons.map((s) => s.stimulus.note);
    expect(notes.filter((n) => tb(n) === n)).toEqual([]);
    expect(banqueVers('fr')(notes[0])).toBe(notes[0]);
  });
});

describe('mêmes mots que l’app (src/i18n/locales/en.json)', () => {
  const app = enApp as unknown as Arbre;
  const cle = (p: string) => p.split('.').reduce<unknown>((o, k) => (o as Arbre | undefined)?.[k], app);

  it('cibles, objectifs, matériel et niveaux de la Musculation (points 10 et 11)', () => {
    expect(en.musculation.cible).toEqual(cle('muscu.target'));
    expect(en.musculation.objectif).toEqual(cle('muscu.objective'));
    expect(en.musculation.materiel).toEqual(cle('muscu.equipment'));
    expect(en.musculation.niveau).toEqual(cle('muscu.level'));
  });

  it('côté d’un exercice unilatéral (point 13)', () => {
    expect(en.musculation.cote).toEqual(cle('strengthSession.side'));
  });

  it('types de score et muscles évités après la classe (point 14)', () => {
    expect(en.rendu.notes('N', 'time')).toBe(`N Score: ${cle('wod.scoreType.time')}.`);
    expect(en.rendu.notes('N', 'reps_total')).toBe(`N Score: ${cle('wod.scoreType.reps')}.`);
    expect(en.rendu.notes('N', 'rounds_reps')).toBe(`N Score: ${cle('bo.interComp.scoring.rounds_reps')}.`);
    const prefixe = String(cle('wodResult.afterClassMuscles')).split('{{')[0];
    expect(en.musculation.musclesEvites(['quadriceps'])).toBe(`${prefixe}Quads`);
    // le texte enregistré garde les ids : la traduction n'a lieu qu'à l'affichage
    expect(fr.musculation.musclesEvites(['quadriceps', 'dos'])).toBe('Après ma classe : muscles évités quadriceps, dos');
  });
});

describe('refus de la Musculation : code stable, texte français inchangé (point 15)', () => {
  const base: MuscuParams = { entry: 'express', target: 'push', objective: 'force', budget_min: 45, equipment: 'gym', level: 'inter' };
  const cas: Array<[string, Omit<MuscuParams, 'budget_min'> & { budget_min?: number }, InvalidMuscuParams['code'], string]> = [
    ['après la classe', { ...base, entry: 'after_class' }, 'force_after_class', 'Après ma classe : la Force n\'est pas proposée (hypertrophie ou endurance)'],
    ['sans matériel', { ...base, equipment: 'none' }, 'force_without_equipment', 'Sans matériel : la Force est indisponible'],
    ['tronc', { ...base, target: 'tronc' }, 'force_tronc', 'Tronc : la Force n\'est pas proposée (Prise de muscle ou Tonification)'],
  ];
  it.each(cas)('%s', (_, p, code, texteFr) => {
    const refus = (langue: 'fr' | 'en') => {
      try { generateMuscu(p, CATALOG_SNAPSHOT, BANK_V1, 1, langue); } catch (e) { return e as InvalidMuscuParams; }
      throw new Error('aucun refus');
    };
    expect(refus('fr')).toBeInstanceOf(InvalidMuscuParams);
    expect([refus('fr').code, refus('fr').message]).toEqual([code, texteFr]);
    expect(refus('en').code).toBe(code);
    expect(refus('en').message).not.toBe(texteFr);
  });
});
