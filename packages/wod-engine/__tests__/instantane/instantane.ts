/**
 * Suite d'instantané d'une langue (M0 pour le français, M2 pour l'anglais).
 *
 * Pour chaque chemin de `chemins.ts` et chaque entrée, trois empreintes sont comparées
 * au fichier `fixtures/instantane-<langue>.json` :
 *   - texte : le texte affiché ou enregistré ;
 *   - sortie : la sortie complète (`wod_json`, lignes `box_wods`), clés triées comme en jsonb ;
 *   - tirages : le journal des appels au RNG (nombre et ordre, valeurs brutes).
 * Empreinte = 16 premiers caractères hexadécimaux du sha256 (64 bits).
 * `fixtures/instantane-<langue>-lisible.txt` garde le texte complet des premières entrées
 * de chaque chemin (50 ; 15 semaines ; 8 programmations) : un écart y montre la ligne fautive.
 *
 * Régénérer (seulement quand un changement du texte est voulu et relu) :
 *   WOD_ENGINE_INSTANTANE=ecrire npx jest packages/wod-engine/__tests__/instantane-<langue>.test.ts
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { CHEMINS, avecJournal } from './chemins';
import type { Langue } from '../../src';

export const ECRIRE = process.env.WOD_ENGINE_INSTANTANE === 'ecrire';

interface Fixture { chemins: Record<string, { n: number; empreintes: string[] }> }

export const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
/** JSON aux clés triées : l'ordre des clés ne compte pas dans une colonne jsonb. */
export const canon = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
  : x));

/**
 * Champs de texte d'une sortie : la langue ne change que ceux-là. Titre, description et
 * notes (WOD, blocs de séance, lignes `box_wods`), libellé de séance, note du stimulus et
 * des exercices, cibles d'estimation, messages d'erreur. Tout le reste est la structure.
 */
const CHAMPS_TEXTE = new Set(['title', 'description', 'notes', 'label', 'message', 'error']);
export function structure(v: unknown, cle = '', parent = ''): unknown {
  if (Array.isArray(v)) return v.map((x) => structure(x, '', cle));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => {
      const texte = typeof x === 'string' && (CHAMPS_TEXTE.has(k) || (k === 'note' && cle === 'stimulus') || (k === 'target' && parent === 'by_category'));
      return [k, texte ? '·' : structure(x, k, cle)];
    }));
  }
  return v;
}

export interface Mesure {
  empreinte: string;
  texte: string[];
  /** empreinte de la sortie sans ses champs de texte */
  structure: string;
  tirages: string;
}

export async function mesurer(nom: string, k: number, langue: Langue = 'fr'): Promise<Mesure> {
  const chemin = CHEMINS.find((c) => c.nom === nom)!;
  const { s, tirages } = await avecJournal(() => chemin.produire(k, langue));
  const t = `${sha(tirages.join(','))} ${tirages.filter((x) => /^\d/.test(x)).length}`;
  return {
    empreinte: `${sha(s.texte.join('\n'))} ${sha(canon(s.sortie))} ${t}`,
    texte: s.texte,
    structure: sha(canon(structure(s.sortie))),
    tirages: t,
  };
}

export const enTete = (nom: string, k: number) => `##### ${nom} #${k} · ${CHEMINS.find((c) => c.nom === nom)!.entree(k)}`;

function lireLisible(fichier: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!existsSync(fichier)) return out;
  let cle: string | null = null;
  for (const l of readFileSync(fichier, 'utf8').split('\n')) {
    const m = /^##### (\S+) #(\d+) · /.exec(l);
    if (m) { cle = `${m[1]}#${m[2]}`; out.set(cle, []); continue; }
    if (cle) out.get(cle)!.push(l);
  }
  for (const v of out.values()) while (v.length && v[v.length - 1] === '') v.pop();
  return out;
}

/** Déclare la suite d'instantané de `langue` ; renvoie les mesures, remplies au fil des tests. */
export function decrireInstantane(langue: Langue, titre: string): Map<string, Mesure[]> {
  const FIXTURE = path.join(__dirname, '..', 'fixtures', `instantane-${langue}.json`);
  const LISIBLE = path.join(__dirname, '..', 'fixtures', `instantane-${langue}-lisible.txt`);
  const fixture: Fixture = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : { chemins: {} };
  const lisible = lireLisible(LISIBLE);
  const nouveau: Fixture = { chemins: {} };
  const nouveauLisible: string[] = [];
  const toutes = new Map<string, Mesure[]>();

  /** Écart lisible : graine, empreintes, première ligne qui diffère quand le texte complet est gardé. */
  const ecart = (nom: string, k: number, attendu: string, obtenu: Mesure): string => {
    const [ta, ja, da, na] = attendu.split(' ');
    const [tb, jb, db, nb] = obtenu.empreinte.split(' ');
    const quoi = [ta !== tb && 'texte', ja !== jb && 'sortie', (da !== db || na !== nb) && `tirages (${na} → ${nb})`].filter(Boolean).join(', ');
    let out = `${enTete(nom, k)}\n  diffère : ${quoi}`;
    const avant = lisible.get(`${nom}#${k}`);
    if (avant && ta !== tb) {
      const i = avant.findIndex((l, j) => l !== obtenu.texte[j]);
      const j = i < 0 ? avant.length : i;
      out += `\n  ligne ${j + 1} attendue « ${avant[j] ?? '(fin)'} »\n  ligne ${j + 1} obtenue  « ${obtenu.texte[j] ?? '(fin)'} »`;
    } else if (ta !== tb) {
      out += `\n  texte obtenu (début) : ${obtenu.texte.slice(0, 6).join(' ⏎ ')}`;
    }
    return out;
  };

  describe(titre, () => {
    it('le fichier d’instantané existe et couvre tous les chemins', () => {
      if (ECRIRE) return;
      expect(Object.keys(fixture.chemins).sort()).toEqual(CHEMINS.map((c) => c.nom).sort());
      for (const c of CHEMINS) {
        expect(c.n).toBeGreaterThanOrEqual(500);
        expect(fixture.chemins[c.nom].n).toBe(c.n);
      }
    });

    // Deux contrôles par chemin sur les mêmes mesures : le texte et la sortie d'un côté,
    // la séquence des tirages (nombre et ordre des appels au RNG) de l'autre (M1).
    for (const c of CHEMINS) {
      const mesures: Mesure[] = [];
      toutes.set(c.nom, mesures);
      const attendues = () => fixture.chemins[c.nom]?.empreintes ?? [];
      const ecarts = (garde: (a: string[], b: string[]) => boolean) => {
        const out: string[] = [];
        mesures.forEach((m, k) => {
          const a = (attendues()[k] ?? '- - - -').split(' ');
          if (garde(a, m.empreinte.split(' ')) && out.length < 10) out.push(ecart(c.nom, k, attendues()[k] ?? '- - - -', m));
        });
        return out;
      };

      it(`${c.nom} : ${c.n} entrées identiques à l’instantané (texte, sortie)`, async () => {
        for (let k = 0; k < c.n; k++) {
          const m = await mesurer(c.nom, k, langue);
          mesures.push(m);
          if (k < c.lisible) nouveauLisible.push(enTete(c.nom, k), ...m.texte, '');
        }
        nouveau.chemins[c.nom] = { n: c.n, empreintes: mesures.map((m) => m.empreinte) };
        if (!ECRIRE) expect(ecarts((a, b) => a[0] !== b[0] || a[1] !== b[1])).toEqual([]);
      }, 300_000);

      it(`${c.nom} : séquence des tirages identique (nombre et ordre des appels au RNG)`, () => {
        expect(mesures).toHaveLength(c.n);
        if (!ECRIRE) expect(ecarts((a, b) => a[2] !== b[2] || a[3] !== b[3])).toEqual([]);
      });
    }

    afterAll(() => {
      if (!ECRIRE) return;
      writeFileSync(FIXTURE, `${JSON.stringify(nouveau, null, 1)}\n`);
      writeFileSync(LISIBLE, nouveauLisible.join('\n'));
    });
  });
  return toutes;
}
