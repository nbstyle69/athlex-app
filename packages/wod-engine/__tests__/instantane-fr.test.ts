/**
 * Instantané du texte français du moteur (i18n, étape « Moteur », PR M0).
 *
 * Pour chaque chemin de `instantane/chemins.ts` et chaque entrée, trois
 * empreintes sont comparées à celles relevées sur master avant toute
 * modification du moteur :
 *   - texte : le texte affiché ou enregistré ;
 *   - sortie : la sortie complète (`wod_json`, lignes `box_wods`), clés triées comme en jsonb ;
 *   - tirages : le journal des appels au RNG (nombre et ordre, valeurs brutes).
 * Empreinte = 16 premiers caractères hexadécimaux du sha256 (64 bits).
 * `instantane-fr-lisible.txt` garde le texte complet des premières entrées de
 * chaque chemin (50 ; 15 semaines ; 8 programmations) : un écart y montre la ligne fautive.
 *
 * Régénérer (seulement quand un changement du texte est voulu et relu) :
 *   WOD_ENGINE_INSTANTANE=ecrire npx jest packages/wod-engine/__tests__/instantane-fr.test.ts
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { CHEMINS, avecJournal } from './instantane/chemins';

const FIXTURE = path.join(__dirname, 'fixtures', 'instantane-fr.json');
const LISIBLE = path.join(__dirname, 'fixtures', 'instantane-fr-lisible.txt');
const ECRIRE = process.env.WOD_ENGINE_INSTANTANE === 'ecrire';

interface Fixture { chemins: Record<string, { n: number; empreintes: string[] }> }

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
/** JSON aux clés triées : l'ordre des clés ne compte pas dans une colonne jsonb. */
const canon = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
  : x));

interface Mesure { empreinte: string; texte: string[] }

async function mesurer(nom: string, k: number): Promise<Mesure> {
  const chemin = CHEMINS.find((c) => c.nom === nom)!;
  const { s, tirages } = await avecJournal(() => chemin.produire(k));
  return {
    empreinte: `${sha(s.texte.join('\n'))} ${sha(canon(s.sortie))} ${sha(tirages.join(','))} ${tirages.filter((t) => /^\d/.test(t)).length}`,
    texte: s.texte,
  };
}

const enTete = (nom: string, k: number) => `##### ${nom} #${k} · ${CHEMINS.find((c) => c.nom === nom)!.entree(k)}`;

function lireLisible(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!existsSync(LISIBLE)) return out;
  let cle: string | null = null;
  for (const l of readFileSync(LISIBLE, 'utf8').split('\n')) {
    const m = /^##### (\S+) #(\d+) · /.exec(l);
    if (m) { cle = `${m[1]}#${m[2]}`; out.set(cle, []); continue; }
    if (cle) out.get(cle)!.push(l);
  }
  for (const v of out.values()) while (v.length && v[v.length - 1] === '') v.pop();
  return out;
}

const fixture: Fixture = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : { chemins: {} };
const lisible = lireLisible();
const nouveau: Fixture = { chemins: {} };
const nouveauLisible: string[] = [];

/** Écart lisible : graine, empreintes, première ligne qui diffère quand le texte complet est gardé. */
function ecart(nom: string, k: number, attendu: string, obtenu: Mesure): string {
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
}

describe('instantané du texte français du moteur (M0)', () => {
  it('le fichier d’instantané existe et couvre tous les chemins', () => {
    if (ECRIRE) return;
    expect(Object.keys(fixture.chemins).sort()).toEqual(CHEMINS.map((c) => c.nom).sort());
    for (const c of CHEMINS) {
      expect(c.n).toBeGreaterThanOrEqual(500);
      expect(fixture.chemins[c.nom].n).toBe(c.n);
    }
  });

  for (const c of CHEMINS) {
    it(`${c.nom} : ${c.n} entrées identiques à l’instantané (texte, sortie, tirages)`, async () => {
      const empreintes: string[] = [];
      const ecarts: string[] = [];
      const attendues = fixture.chemins[c.nom]?.empreintes ?? [];
      for (let k = 0; k < c.n; k++) {
        const m = await mesurer(c.nom, k);
        empreintes.push(m.empreinte);
        if (k < c.lisible) nouveauLisible.push(enTete(c.nom, k), ...m.texte, '');
        if (!ECRIRE && m.empreinte !== attendues[k] && ecarts.length < 10) ecarts.push(ecart(c.nom, k, attendues[k] ?? '- - - -', m));
      }
      nouveau.chemins[c.nom] = { n: c.n, empreintes };
      expect(ecarts).toEqual([]);
    }, 300_000);
  }

  afterAll(() => {
    if (!ECRIRE) return;
    writeFileSync(FIXTURE, `${JSON.stringify(nouveau, null, 1)}\n`);
    writeFileSync(LISIBLE, nouveauLisible.join('\n'));
  });
});
