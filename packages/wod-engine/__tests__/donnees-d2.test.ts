/**
 * PR « Données » D2 (#530) : muscles, squelettes et options, par id.
 *
 * L'inventaire de D2 (corps de la PR) ne trouve plus aucun de ces libellés en français dans
 * l'anglais, après D1 et M5. Ce fichier garde cet état : un id ajouté sans anglais fait échouer
 * la CI, pour qu'on le traduise avant de relancer.
 *   1. squelettes : pour chaque squelette de la banque (Functional, Hybrid, Musculation, séance),
 *      chaque texte affiché a sa traduction (correspondance avec `fr.banque`) ; seul `role`
 *      (commentaire de slot, jamais affiché) en est dispensé ; un texte inconnu (squelette
 *      retouché en base) reste en français, sans erreur ;
 *   2. muscles : chaque id de muscle affichable (muscle principal du catalogue, cibles) a son
 *      libellé anglais ;
 *   3. options : cibles, objectifs, matériel et niveaux de la Musculation : une entrée anglaise
 *      par id, sans accent ni mot interdit ;
 *   4. le français ne passe jamais par ces correspondances (identité).
 */
import {
  BANK_V1, CATALOG_SNAPSHOT, MUSCU_OBJECTIVES, MUSCU_TARGETS, TARGET_MUSCLES, banqueVers, correspondancesBanque, en, fr,
} from '../src';

const ACCENT = /[àâäçéèêëîïôöùûüÿœæ«»]/i;
const INTERDITS = /crossfit|hyrox|musculation/i;
/** Clés dont la valeur n'est jamais affichée : ids, familles, motifs, commentaires de slot. */
const NON_AFFICHES = new Set(['role']);

/** Textes affichables d'un squelette : chaînes avec des mots (un id n'a pas d'espace ni d'accent). */
function textes(v: unknown, cle = '', out: string[] = []): string[] {
  if (typeof v === 'string') {
    if (!NON_AFFICHES.has(cle) && /[A-Za-zÀ-ÿ]{2,}\s|[À-ÿ]/.test(v)) out.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => textes(x, cle, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) textes(x, k, out);
  return out;
}

const SQUELETTES = [...BANK_V1.skeletons, ...BANK_V1.muscu_skeletons, ...BANK_V1.session_skeletons] as Array<{ id: string }>;

describe('D2 — squelettes : chaque texte affiché a son anglais, par id de squelette', () => {
  const { table } = correspondancesBanque('en');

  it('couverture : tous les squelettes de la banque', () => {
    const manquants = SQUELETTES.flatMap((s) => textes(s).filter((t) => !table.has(t)).map((t) => `${s.id} : « ${t} »`));
    const couverts = SQUELETTES.filter((s) => textes(s).every((t) => table.has(t))).length;
    expect({ rapport: `${couverts} / ${SQUELETTES.length} squelettes couverts`, manquants })
      .toEqual({ rapport: `${SQUELETTES.length} / ${SQUELETTES.length} squelettes couverts`, manquants: [] });
    expect(SQUELETTES.length).toBeGreaterThanOrEqual(82);
  });

  it('traductions propres : aucun accent, ni CrossFit, ni Hyrox, ni Musculation', () => {
    const vus = SQUELETTES.flatMap((s) => textes(s).map((t) => banqueVers('en')(t)));
    expect(vus.filter((t) => ACCENT.test(t) || INTERDITS.test(t))).toEqual([]);
  });

  it('français : identité ; texte inconnu (squelette retouché en base) : repli sur le français', () => {
    for (const s of SQUELETTES) for (const t of textes(s)) expect(banqueVers('fr')(t)).toBe(t);
    expect(banqueVers('en')('Texte écrit au Manager')).toBe('Texte écrit au Manager');
  });
});

describe('D2 — muscles : un libellé anglais par id', () => {
  const ids = new Set<string>([
    ...Object.values(TARGET_MUSCLES).flat() as string[],
    // muscles affichables : muscle principal et muscles des motifs (« muscles évités ») ; les muscles
    // secondaires (hip_flexors, lats…) ne sont jamais affichés, ils ne servent qu'au tirage
    ...CATALOG_SNAPSHOT.movements.flatMap((m) => (m.muscu ? [m.muscu.muscle_primary] : [])),
  ]);

  it('chaque muscle du catalogue et des cibles est traduit (jamais l\'id brut)', () => {
    const libelle = (id: string) => en.musculation.musclesEvites([id]).split('avoided ')[1];
    const bruts = [...ids].filter((id) => libelle(id) === id || ACCENT.test(libelle(id)) || INTERDITS.test(libelle(id)));
    expect({ rapport: `${ids.size - bruts.length} / ${ids.size} muscles traduits`, bruts }).toEqual({ rapport: `${ids.size} / ${ids.size} muscles traduits`, bruts: [] });
  });

  it('français : le texte enregistré garde les ids (ils ne se traduisent qu\'à l\'affichage)', () => {
    expect(fr.musculation.musclesEvites(['quadriceps', 'dos'])).toContain('quadriceps, dos');
  });
});

describe('D2 — options : une entrée anglaise par id', () => {
  const cas: Array<[string, readonly string[], Record<string, string>]> = [
    ['cibles', MUSCU_TARGETS, en.musculation.cible],
    ['objectifs', MUSCU_OBJECTIVES, en.musculation.objectif],
    ['matériel', ['none', 'box', 'gym'], en.musculation.materiel],
    ['niveaux', ['debutant', 'inter', 'avance'], en.musculation.niveau],
  ];

  it.each(cas)('%s', (_nom, ids, dico) => {
    const manquants = ids.filter((id) => !dico[id] || ACCENT.test(dico[id]) || INTERDITS.test(dico[id]));
    expect(manquants).toEqual([]);
  });
});
