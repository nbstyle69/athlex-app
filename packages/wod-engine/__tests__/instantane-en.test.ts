/**
 * Anglais du moteur (étude i18n « Moteur », M2), sur les 4 200 entrées de l'instantané :
 *   1. instantané anglais (`fixtures/instantane-en*.{json,txt}`, même format que M0) : toute
 *      modification future de l'anglais est visible ;
 *   2. la langue n'a aucun effet sur le tirage : sortie sans ses champs de texte et séquence
 *      des appels au RNG identiques en français et en anglais ;
 *   3. aucun texte français dans la sortie anglaise, avec la méthode des écrans : aucun accent,
 *      et aucune ligne restée identique au français que le scanner (`isFrench`) reconnaît comme
 *      française. Les noms du catalogue sont traduits par id depuis la PR « Données » D1 (#530) :
 *      ils sont vérifiés comme le reste. Les noms de groupe de la box sont un contenu de box
 *      (jamais traduit) : ils sont mis de côté ;
 *   4. ni « CrossFit », ni « Hyrox », ni « Musculation » dans la sortie anglaise.
 */
import { CATALOG_SNAPSHOT, mouvements } from '../src';
import { CHEMINS } from './instantane/chemins';
import { decrireInstantane, mesurer, enTete, ECRIRE } from './instantane/instantane';
import type { Mesure } from './instantane/instantane';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isFrench, strictAllowed } = require('../../../scripts/i18n/scanner') as {
  isFrench: (s: string) => boolean; strictAllowed: (s: string) => boolean;
};

const anglais = decrireInstantane('en', 'instantané du texte anglais du moteur (M2)');

const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const MARQUES = /crossfit|hyrox|musculation/i;
/** Noms du catalogue sans entrée anglaise (repli sur le nom français) : aucun depuis D1, `mouvements-en.test.ts` l'exige. */
const NOMS = [...new Set(CATALOG_SNAPSHOT.movements.filter((m) => !(m.id in mouvements)).map((m) => m.name))].sort((a, b) => b.length - a.length);
const sansNoms = (l: string) => NOMS.reduce((x, n) => x.split(n).join(' '), l);
/** Identiques en anglais, mais reconnus par le scanner (« minute » est dans sa liste de mots français) : comme `SAME_IN_EN` des écrans. */
const MEMES_EN_ANGLAIS = [/^minute \d+$/];

/** Texte affiché d'une ligne de l'instantané, sans son étiquette ; `null` pour une ligne de structure ou un contenu de box. */
function contenu(l: string): string | null {
  if (/^groupe : |^-- bloc /.test(l)) return null;
  if (/^== /.test(l)) { const m = /^== jour \d+ · (.*)$/.exec(l); return m ? m[1] : null; }
  return l.replace(/^(C )?(titre|description|notes|stimulus|ligne|cible \w+|exercice|charge|note|erreur) : /, '');
}

describe('anglais du moteur : langue sans effet sur le tirage, aucun texte français, aucune marque (M2)', () => {
  for (const c of CHEMINS) {
    const francais: Mesure[] = [];

    it(`${c.nom} : structure et tirages identiques en français et en anglais`, async () => {
      if (ECRIRE) return;
      const en = anglais.get(c.nom)!;
      expect(en).toHaveLength(c.n);
      const ecarts: string[] = [];
      for (let k = 0; k < c.n; k++) {
        const f = await mesurer(c.nom, k, 'fr');
        francais.push(f);
        const quoi = [f.structure !== en[k].structure && 'structure', f.tirages !== en[k].tirages && `tirages (${f.tirages} ≠ ${en[k].tirages})`].filter(Boolean);
        if (quoi.length && ecarts.length < 10) ecarts.push(`${enTete(c.nom, k)}\n  diffère : ${quoi.join(', ')}`);
      }
      expect(ecarts).toEqual([]);
    }, 300_000);

    it(`${c.nom} : aucun texte français dans la sortie anglaise`, () => {
      if (ECRIRE) return;
      const en = anglais.get(c.nom)!;
      expect(francais).toHaveLength(c.n);
      const restes: string[] = [];
      en.forEach((m, k) => {
        const lignesFr = new Set(francais[k].texte.map(contenu));
        for (const l of m.texte) {
          const x = contenu(l);
          if (x === null) continue;
          const s = sansNoms(x);
          const inchange = lignesFr.has(x) && isFrench(s) && !strictAllowed(s) && !MEMES_EN_ANGLAIS.some((re) => re.test(x));
          if ((ACCENT.test(s) || inchange) && restes.length < 20) restes.push(`${enTete(c.nom, k)}\n  « ${x} »`);
        }
      });
      expect(restes).toEqual([]);
    });

    it(`${c.nom} : ni CrossFit, ni Hyrox, ni Musculation dans la sortie anglaise`, () => {
      if (ECRIRE) return;
      const en = anglais.get(c.nom)!;
      const vus = en.flatMap((m, k) => m.texte.filter((l) => contenu(l) !== null && MARQUES.test(l)).map((l) => `${enTete(c.nom, k)}\n  « ${l} »`));
      expect(vus.slice(0, 10)).toEqual([]);
    });
  }
});
