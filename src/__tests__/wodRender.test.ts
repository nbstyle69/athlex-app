/**
 * Moteur M4 (#528) — affichage dans la langue de l'app du résultat d'une génération.
 *
 * Pour chacun des six chemins qui aboutissent à l'écran de résultat ou à une séance de box (WOD express,
 * Après ma classe, Musculation, Musculation après ma classe, séance Functional, séance Hybrid), sur
 * 50 entrées déterministes (les premières de l'instantané du moteur, M0) :
 *   - français : l'affichage est le texte enregistré, octet pour octet ;
 *   - anglais : aucun mot français (même méthode que le moteur M2 : accents, scanner de l'app) ;
 *   - JSON non v2 / absent / saisie libre : le texte enregistré, tel quel ;
 *   - les écritures (generated_wods, box_wods) ne changent pas, quelle que soit la langue de l'app ;
 *   - la langue n'entre jamais dans le tirage.
 */
import fs from 'node:fs';
import path from 'node:path';

jest.mock('../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => (globalThis as any).__from(...a) } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve({}) }));

import i18n from '../i18n';
import {
  afterClassMusclesEn, displayLangue, displayStimulusNote, displayTarget, displayWod, exerciseNote, loadLine, schemeLine,
  shareText,
} from '../services/wodRender';
import { addToWhiteboard, saveGeneratedWod, whiteboardRows } from '../services/wodGenerator';
import { CHEMINS, stockes } from '../../packages/wod-engine/__tests__/instantane/chemins';
import {
  CATALOG_SNAPSHOT, FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES, generateBlocC, generateMuscu, loadText, renderFromWodJson,
  sideLabel, BANK_V1,
} from '../../packages/wod-engine/src';
import type { GeneratedWod, Langue, MuscuWod } from '../../packages/wod-engine/src';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isFrench, strictAllowed } = require('../../scripts/i18n/scanner') as {
  isFrench: (s: string) => boolean; strictAllowed: (s: string) => boolean;
};

const CHEMINS_M4 = ['wod-express', 'apres-ma-classe', 'musculation', 'musculation-apres-ma-classe', 'seance-functional', 'seance-hybrid'];
const N = 50;

const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const NOMS = [...new Set(CATALOG_SNAPSHOT.movements.map((m) => m.name))].sort((a, b) => b.length - a.length);
const sansNoms = (l: string) => NOMS.reduce((x, n) => x.split(n).join(' '), l);
/** Identiques en anglais, mais reconnus par le scanner (« minute » est dans sa liste de mots français). */
const MEMES_EN_ANGLAIS = [/^minute \d+$/];

/** Lignes françaises restantes d'un texte affiché en anglais (méthode du moteur M2). */
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

type Objet = { chemin: string; k: number; json: unknown; saved: { title: string; description: string; notes: string | null } };
const objets: Objet[] = [];
beforeAll(async () => {
  for (const nom of CHEMINS_M4) {
    const c = CHEMINS.find((x) => x.nom === nom)!;
    for (let k = 0; k < N; k++) {
      const { sortie } = await c.produire(k, 'fr');
      for (const s of stockes(nom, sortie)) objets.push({ chemin: nom, k, json: s.json, saved: { title: s.title, description: s.description, notes: s.notes } });
    }
  }
}, 300_000);

afterAll(() => i18n.changeLanguage('fr'));

describe('displayWod — 50 entrées par chemin', () => {
  for (const nom of CHEMINS_M4) {
    const ofChemin = () => objets.filter((o) => o.chemin === nom);

    it(`${nom} : ${N} entrées produites, toutes réaffichables (v2)`, () => {
      const os = ofChemin();
      expect(new Set(os.map((o) => o.k)).size).toBeGreaterThanOrEqual(N - 5);
      for (const o of os) expect((o.json as { v?: number }).v ?? 2).toBe(2);
    });

    it(`${nom} : français = texte enregistré, octet pour octet`, () => {
      for (const o of ofChemin()) {
        expect(displayWod(o.json, o.saved, 'fr')).toEqual(o.saved);
        // et le rendu du moteur en français redonne ce même texte (l'instantané de M0)
        expect(renderFromWodJson(o.json, 'fr')).toEqual(o.saved);
      }
    });

    it(`${nom} : anglais = rendu du moteur, sans un mot français`, () => {
      const vus: string[] = [];
      for (const o of ofChemin()) {
        const en = displayWod(o.json, o.saved, 'en');
        expect(en).toEqual(renderFromWodJson(o.json, 'en'));
        const restes = restesFrancais(lignes(en), lignes(o.saved));
        if (restes.length && vus.length < 10) vus.push(`${nom} #${o.k} : « ${restes[0]} »`);
      }
      expect(vus).toEqual([]);
    });

    it(`${nom} : l'affichage ne modifie ni le WOD ni le texte enregistré`, () => {
      for (const o of ofChemin()) {
        const avant = JSON.stringify([o.json, o.saved]);
        displayWod(o.json, o.saved, 'en');
        displayWod(o.json, o.saved, 'fr');
        expect(JSON.stringify([o.json, o.saved])).toBe(avant);
      }
    });

    it(`${nom} : JSON non v2, absent ou saisie libre → texte enregistré tel quel, même en anglais`, () => {
      for (const o of ofChemin().slice(0, 10)) {
        const autres: unknown[] = [
          null, undefined, 'texte libre', 42, {}, { version: 1, source: 'manager' },
          { ...(o.json as object), v: undefined }, { ...(o.json as object), v: 1 },
          { ...(o.json as object), source: 'manager' }, { ...(o.json as object), source: 'manual' },
        ];
        for (const j of autres) expect(displayWod(j, o.saved, 'en')).toEqual(o.saved);
      }
    });
  }

  it('une notes absente du texte enregistré reste nulle', () => {
    expect(displayWod(null, { title: 'T', description: 'D' }, 'en')).toEqual({ title: 'T', description: 'D', notes: null });
  });
});

describe('morceaux affichés à part — 50 entrées par chemin', () => {
  const wods = (chemin: string) => objets.filter((o) => o.chemin === chemin).map((o) => o.json);

  for (const nom of ['wod-express', 'apres-ma-classe']) {
    it(`${nom} : cible estimée et note du stimulus, français inchangé, anglais sans français`, () => {
      const vus: string[] = [];
      for (const w of wods(nom) as GeneratedWod[]) {
        const cats = w.discipline === 'hybrid' ? HYBRID_CATEGORIES : FUNCTIONAL_CATEGORIES;
        for (const c of cats) {
          const fr = w.estimate.by_category[c]?.target ?? null;
          expect(displayTarget(w, c, 'fr')).toBe(fr);
          const en = displayTarget(w, c, 'en');
          if (fr != null) {
            expect(en).not.toBeNull();
            const inchange = en === fr && isFrench(sansNoms(en!)) && !strictAllowed(sansNoms(en!)) && !MEMES_EN_ANGLAIS.some((re) => re.test(en!));
            if ((ACCENT.test(en!) || inchange) && vus.length < 10) vus.push(`cible ${c} : « ${en} »`);
          }
        }
        expect(displayStimulusNote(w, 'fr')).toBe(w.stimulus.note);
        const note = displayStimulusNote(w, 'en');
        const inchangeNote = note === w.stimulus.note && isFrench(sansNoms(note)) && !strictAllowed(sansNoms(note));
        if ((ACCENT.test(sansNoms(note)) || inchangeNote) && vus.length < 10) vus.push(`stimulus : « ${note} »`);
      }
      expect(vus).toEqual([]);
    });
  }

  for (const nom of ['musculation', 'musculation-apres-ma-classe']) {
    it(`${nom} : lignes d'exercice, notes, stimulus et muscles — français inchangé, anglais sans français`, () => {
      const vus: string[] = [];
      for (const w of wods(nom) as MuscuWod[]) {
        expect(displayStimulusNote(w, 'fr')).toBe(w.stimulus.note);
        const note = displayStimulusNote(w, 'en');
        if (ACCENT.test(sansNoms(note)) && vus.length < 10) vus.push(`stimulus : « ${note} »`);
        for (const e of w.blocks[0].exercises) {
          // français : exactement l'ancien code de la carte
          let ancien = `${e.sets} × ${e.reps}`;
          if (e.reps_unit !== 'reps') ancien += ` ${e.reps_unit}`;
          if (e.per_side) ancien += ` / ${sideLabel(e)}`;
          expect(schemeLine(e, 'fr')).toBe(ancien);
          expect(loadLine(e, 'fr')).toBe(loadText(e));
          expect(exerciseNote(e, 'fr')).toBe(e.notes);
          const ligne = [schemeLine(e, 'en'), loadLine(e, 'en'), exerciseNote(e, 'en')];
          for (const l of ligne) if (ACCENT.test(sansNoms(l)) && vus.length < 10) vus.push(`exercice ${e.id} : « ${l} »`);
          expect(`${schemeLine(e, 'en')} ${loadLine(e, 'en')}`).not.toMatch(/\b(jambe|bras|côté|charge|repos|poids du corps)\b/i);
        }
        const muscles = w.after_class?.excluded_muscles ?? [];
        expect(afterClassMusclesEn(muscles, 'fr')).toBeNull();
        if (muscles.length) {
          const en = afterClassMusclesEn(muscles, 'en')!;
          expect(en).toMatch(/^After my class: muscles avoided /);
          expect(ACCENT.test(en)).toBe(false);
        }
      }
      expect(vus).toEqual([]);
    });
  }

  it('un WOD sans rendu (ligne ancienne) garde ses textes enregistrés en anglais', () => {
    const w = (wods('musculation') as MuscuWod[])[0];
    const ancien = { ...w, v: undefined } as unknown as MuscuWod;
    expect(displayStimulusNote(ancien, 'en')).toBe(w.stimulus.note);
    const e = { ...w.blocks[0].exercises[0], rendu: undefined };
    expect(exerciseNote(e, 'en')).toBe(e.notes);
    const f = (wods('wod-express') as GeneratedWod[])[0];
    const cat = FUNCTIONAL_CATEGORIES.find((c) => f.estimate.by_category[c]) ?? FUNCTIONAL_CATEGORIES[0];
    expect(displayTarget({ ...f, v: undefined } as GeneratedWod, cat, 'en')).toBe(f.estimate.by_category[cat]?.target ?? null);
  });
});

describe('Copier / Partager — le texte affiché, dans la langue affichée', () => {
  it('français : texte enregistré ; anglais : rendu anglais ; JSON non v2 : texte enregistré', () => {
    for (const o of objets.filter((x) => x.chemin === 'wod-express' || x.chemin === 'musculation').slice(0, 40)) {
      const fr = shareText(o.json, o.saved, 'fr');
      expect(fr).toEqual({ copy: o.saved.description, share: `${o.saved.title}\n${o.saved.description}` });
      const en = shareText(o.json, o.saved, 'en');
      const d = renderFromWodJson(o.json, 'en')!;
      expect(en).toEqual({ copy: d.description, share: `${d.title}\n${d.description}` });
      expect(en.copy).not.toBe(fr.copy);
      expect(shareText({ version: 1, source: 'manager' }, o.saved, 'en')).toEqual(fr);
    }
  });
});

describe('la langue ne touche jamais le tirage ni le texte enregistré', () => {
  it('displayLangue suit i18n.language (anglais, sinon français)', async () => {
    await i18n.changeLanguage('en');
    expect(displayLangue()).toBe('en');
    await i18n.changeLanguage('fr');
    expect(displayLangue()).toBe('fr');
  });

  it('même graine, même WOD, que l’app soit en français ou en anglais', async () => {
    const tirer = () => [
      generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 15, intention: 'mixed', profile_category: 'rx' }, CATALOG_SNAPSHOT, BANK_V1, 42),
      generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'box', level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, 7),
    ];
    await i18n.changeLanguage('fr');
    const fr = JSON.stringify(tirer());
    await i18n.changeLanguage('en');
    const en = JSON.stringify(tirer());
    await i18n.changeLanguage('fr');
    expect(en).toBe(fr);
  });

  it('le service de génération et le moteur ne reçoivent aucune langue avant le rendu', () => {
    const service = fs.readFileSync(path.join(__dirname, '..', 'services/wodGenerator.ts'), 'utf8');
    const data = fs.readFileSync(path.join(__dirname, '..', 'services/wodEngineData.ts'), 'utf8');
    for (const src of [service, data]) {
      expect(src).not.toMatch(/displayLangue|i18n\.language|wodRender|\blangue\b/);
    }
  });

  describe('écritures inchangées : texte et wod_json enregistrés en français, app en anglaise', () => {
    let inserts: Array<{ table: string; payload: any }>;
    let updates: Array<{ table: string; payload: any }>;
    beforeEach(async () => {
      inserts = []; updates = [];
      (globalThis as any).__from = (table: string) => ({
        insert: (payload: unknown) => {
          inserts.push({ table, payload });
          const res = { data: Array.isArray(payload) ? payload.map((_, i) => ({ id: `id${i}` })) : { id: 'id0' }, error: null };
          return { select: () => ({ single: async () => res, then: (f: (r: unknown) => unknown) => Promise.resolve(res).then(f) }) };
        },
        update: (payload: unknown) => { updates.push({ table, payload }); return { eq: async () => ({ error: null }) }; },
        upsert: async () => ({ error: null }),
      });
      await i18n.changeLanguage('en');
    });
    afterEach(() => i18n.changeLanguage('fr'));

    // Les séances de box (programmation) sont écrites par l'Edge Function, jamais par l'app : voir le test suivant.
    const chemins = ['wod-express', 'apres-ma-classe', 'musculation', 'musculation-apres-ma-classe'];
    for (const nom of chemins) {
      it(`${nom} : saveGeneratedWod écrit le texte et le JSON français, à l'identique`, async () => {
        const os = objets.filter((o) => o.chemin === nom && (o.json as any).discipline !== 'session').slice(0, 10);
        expect(os.length).toBeGreaterThan(0);
        for (const o of os) {
          const wod = o.json as GeneratedWod | MuscuWod;
          const avant = JSON.stringify(wod);
          inserts.length = 0;
          await saveGeneratedWod('u1', wod, 'rx');
          const row = inserts[0].payload;
          expect(inserts[0].table).toBe('generated_wods');
          expect(row.wod_name).toBe(o.saved.title);
          expect(row.movements).toBe(o.saved.description);
          expect(row.coach_tip).toBe(wod.stimulus.note);
          expect(JSON.stringify(row.wod_json)).toBe(avant);
          expect(JSON.stringify(wod)).toBe(avant);
        }
      });

      it(`${nom} : « Ajouter au Whiteboard » écrit les lignes françaises, à l'identique`, async () => {
        const os = objets.filter((o) => o.chemin === nom && (o.json as any).discipline !== 'session').slice(0, 10);
        for (const o of os) {
          const wod = o.json as GeneratedWod | MuscuWod;
          const attendu = JSON.stringify(whiteboardRows(wod));
          inserts.length = 0;
          await addToWhiteboard('u1', wod, 'gen1', null, '2026-10-16');
          const rows = inserts[0].payload as Array<Record<string, unknown>>;
          expect(inserts[0].table).toBe('box_wods');
          const sansMeta = rows.map(({ box_id, created_by, scheduled_date, is_published, leaderboard_enabled, ...r }) => r);
          expect(JSON.stringify(sansMeta)).toBe(attendu);
          // rien d'anglais n'a été écrit : chaque description est celle du moteur en français
          for (const r of rows) {
            const fr = o.saved.description;
            if ((wod as { discipline: string }).discipline !== 'musculation') expect(r.description).toBe(fr);
            else expect(String(r.description)).toMatch(/ — \d+ × /);
          }
        }
      });
    }

    it('séance de box : le texte et le JSON d’un bloc de la programmation ne sont pas touchés par l’affichage', () => {
      for (const o of objets.filter((x) => x.chemin === 'seance-hybrid').slice(0, 30)) {
        const avant = JSON.stringify([o.json, o.saved]);
        displayWod(o.json, o.saved, 'en');
        expect(JSON.stringify([o.json, o.saved])).toBe(avant);
      }
    });
  });
});

describe('cohérence : les deux langues décrivent le même WOD', () => {
  it('autant de lignes de description en français et en anglais', () => {
    for (const o of objets.filter((x) => x.chemin !== 'seance-functional' && x.chemin !== 'seance-hybrid').slice(0, 200)) {
      const fr = displayWod(o.json, o.saved, 'fr');
      const en = displayWod(o.json, o.saved, 'en');
      expect(en.description.split('\n').length).toBe(fr.description.split('\n').length);
    }
  });
});

export type { Langue };
