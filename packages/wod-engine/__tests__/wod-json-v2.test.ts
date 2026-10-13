/**
 * wod_json v2 (étude i18n « Moteur », M3), sur les 4 200 entrées de l'instantané :
 *   1. ajout seulement : la sortie (wod_json, lignes box_wods) privée des clés ajoutées par
 *      M3 (`v`, `rendu`) est identique, au caractère près, à celle d'avant M3
 *      (`fixtures/instantane-sortie-v1.json`, relevée sur master 089db64), en français et en
 *      anglais : aucune clé ni valeur existante ne change ;
 *   2. aller-retour : chaque objet que le moteur fait enregistrer (WOD, séance Musculation,
 *      bloc de séance, jour de semaine Musculation, ligne box_wods de la programmation) porte
 *      `v: 2`, et `renderFromWodJson(wod_json, 'fr')` redonne son titre, sa description et ses
 *      notes enregistrés ; `renderFromWodJson(wod_json, 'en')` redonne le texte anglais de M2 ;
 *   3. les lignes plus anciennes (sans `v`) et le JSON du Manager (`version: 1`) ne se
 *      réaffichent pas : l'app retombe sur le texte enregistré.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { renderFromWodJson, generateBlocC, CATALOG_SNAPSHOT, BANK_V1 } from '../src';
import { CHEMINS, stockes } from './instantane/chemins';
import { canon, enTete, sha } from './instantane/instantane';

const AVANT = JSON.parse(readFileSync(path.join(__dirname, 'fixtures', 'instantane-sortie-v1.json'), 'utf8')) as {
  langues: Record<'fr' | 'en', Record<string, string[]>>;
};

/** Clés ajoutées par M3 : retirées, la sortie doit redevenir celle d'avant. */
const AJOUTS = new Set(['v', 'rendu']);
function sansAjouts(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sansAjouts);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !AJOUTS.has(k)).map(([k, x]) => [k, sansAjouts(x)]));
  return v;
}

const texte = (s: { title: string; description: string; notes: string | null }) => ({ title: s.title, description: s.description, notes: s.notes });

describe('wod_json v2 du moteur (M3)', () => {
  for (const c of CHEMINS) {
    it(`${c.nom} : ajout seulement, aller-retour français et anglais sur chaque objet enregistré`, async () => {
      const ecarts: string[] = [];
      const note = (k: number, m: string) => { if (ecarts.length < 10) ecarts.push(`${enTete(c.nom, k)}\n  ${m}`); };
      let objets = 0;
      for (let k = 0; k < c.n; k++) {
        const fr = await c.produire(k, 'fr');
        const en = await c.produire(k, 'en');
        if (sha(canon(sansAjouts(fr.sortie))) !== AVANT.langues.fr[c.nom][k]) note(k, 'ajout seulement (fr) : une clé ou une valeur existante a changé');
        if (sha(canon(sansAjouts(en.sortie))) !== AVANT.langues.en[c.nom][k]) note(k, 'ajout seulement (en) : une clé ou une valeur existante a changé');
        const sf = stockes(c.nom, fr.sortie);
        const se = stockes(c.nom, en.sortie);
        if (sf.length !== se.length) { note(k, `objets fr ${sf.length} ≠ en ${se.length}`); continue; }
        if (!sf.length && !('erreur' in (fr.sortie as object))) note(k, 'aucun objet enregistré');
        sf.forEach((s, i) => {
          objets++;
          if ((s.json as { v?: unknown } | null)?.v !== 2) { note(k, `objet ${i} sans v: 2`); return; }
          const rFr = renderFromWodJson(s.json, 'fr');
          const rEn = renderFromWodJson(s.json, 'en');
          if (JSON.stringify(rFr) !== JSON.stringify(texte(s))) note(k, `objet ${i} : fr ${JSON.stringify(rFr).slice(0, 300)}\n  ≠ ${JSON.stringify(texte(s)).slice(0, 300)}`);
          if (JSON.stringify(rEn) !== JSON.stringify(texte(se[i]))) note(k, `objet ${i} : en ${JSON.stringify(rEn).slice(0, 300)}\n  ≠ ${JSON.stringify(texte(se[i])).slice(0, 300)}`);
        });
      }
      expect(ecarts).toEqual([]);
      expect(objets).toBeGreaterThan(0);
    }, 300_000);
  }

  it('lignes plus anciennes et JSON du Manager : pas de réaffichage, retour au texte enregistré', () => {
    const w = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 12, intention: 'mixed', format: 'surprise' }, CATALOG_SNAPSHOT, BANK_V1, 7);
    expect(renderFromWodJson(w, 'fr')).not.toBeNull();
    const { v: _v, ...ancien } = w;
    expect(renderFromWodJson(ancien, 'fr')).toBeNull();
    expect(renderFromWodJson({ version: 1, source: 'manager', movements: [], free_text: [] }, 'en')).toBeNull();
    expect(renderFromWodJson(null, 'en')).toBeNull();
    expect(renderFromWodJson('texte', 'en')).toBeNull();
  });
});
