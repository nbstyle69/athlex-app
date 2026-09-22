/**
 * Le fichier canonique des règles `mv_*` dit-il exactement ce que dit le client ?
 *
 * `supabase/seed/badge_rules.json` est inséré tel quel dans `badge_rules`, et
 * c'est cette table que `badge_condition_met` interroge. Si le fichier et le
 * TypeScript divergent, le serveur et le client n'accordent plus les mêmes
 * badges — sans que rien ne casse, et sans que personne ne le voie. D'où ce
 * test, qui redérive les règles depuis le TypeScript au lieu de relire le
 * générateur : deux chemins vers la même réponse, sinon on ne teste que sa
 * propre copie.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

jest.mock('../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../lib/haptics', () => ({ hapticHeavy: jest.fn() }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import { MOVEMENT_BADGE_PREFIX, CARDIO_BADGE_PREFIX, badgePrefixFor, MovementUnit } from '../utils/movementBadgeKeys';
import { MOVEMENT_BADGE_ROLLUP } from '../services/gamification';
import { MOVEMENT_KEYS } from '../utils/tournamentUtils';

const RACINE = path.resolve(__dirname, '../..');
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

interface Regle {
  badge_key: string;
  rule_kind: 'movement' | 'total' | 'polyvalent';
  unit: MovementUnit;
  threshold: number;
  movement_keys: string[];
  per_movement_threshold: number | null;
}

const REGLES: Regle[] = JSON.parse(lire('supabase/seed/badge_rules.json')).regles;
const parCle = new Map(REGLES.map(r => [r.badge_key, r]));

/** préfixe → (mouvement, unité), redérivé des deux tables exportées. */
const prefixes = new Map<string, { movement: string; unit: MovementUnit }>();
for (const [mv, p] of Object.entries(MOVEMENT_BADGE_PREFIX)) prefixes.set(p, { movement: mv, unit: 'reps' });
for (const [mv, byUnit] of Object.entries(CARDIO_BADGE_PREFIX)) {
  for (const [unit, p] of Object.entries(byUnit)) {
    if (p) prefixes.set(p, { movement: mv, unit: unit as MovementUnit });
  }
}

const prefixeDe = (cle: string) => cle.slice(0, cle.lastIndexOf('_'));

describe('badge_rules.json ≡ règles du client', () => {
  it('couvre 187 badges, dont les six méta-badges', () => {
    expect(REGLES).toHaveLength(187);
    expect(REGLES.filter(r => r.rule_kind === 'total').map(r => r.badge_key).sort())
      .toEqual(['mv_total_100k', 'mv_total_10k', 'mv_total_50k']);
    expect(REGLES.filter(r => r.rule_kind === 'polyvalent').map(r => r.badge_key).sort())
      .toEqual(['mv_polyvalent_10', 'mv_polyvalent_20', 'mv_polyvalent_5']);
  });

  it('chaque règle de mouvement porte le mouvement, l’unité et le seuil du client', () => {
    for (const r of REGLES.filter(x => x.rule_kind === 'movement')) {
      const prefixe = prefixeDe(r.badge_key);
      const def = prefixes.get(prefixe);
      if (!def) continue; // traité par le test de l'exception nominative
      const attendu = [def.movement, ...(MOVEMENT_BADGE_ROLLUP[prefixe] ?? [])].sort();

      expect({ cle: r.badge_key, unit: r.unit, keys: r.movement_keys, seuil: r.threshold })
        .toEqual({
          cle: r.badge_key,
          unit: def.unit,
          keys: attendu,
          seuil: parseInt(r.badge_key.slice(prefixe.length + 1), 10),
        });
      expect(badgePrefixFor(def.movement, def.unit)).toBe(prefixe);
      expect(r.per_movement_threshold).toBeNull();
    }
  });

  it('aucun préfixe du client n’est absent du fichier', () => {
    const couverts = new Set(REGLES.map(r => prefixeDe(r.badge_key)));
    expect([...prefixes.keys()].filter(p => !couverts.has(p))).toEqual([]);
  });

  it('les méta-badges reprennent les seuils écrits en dur dans le client', () => {
    // logMovementReps : polyvalence = mouvements à 100 reps ou plus, seuils
    // 5/10/20 ; total = somme des reps, seuils 10k/50k/100k. Les clés comptées
    // sont l'espace canonique entier (isKnownMovementKey), en reps.
    const canoniques = [...MOVEMENT_KEYS].sort();
    for (const [cle, seuil] of [['mv_polyvalent_5', 5], ['mv_polyvalent_10', 10], ['mv_polyvalent_20', 20]] as const) {
      expect(parCle.get(cle)).toEqual({
        badge_key: cle, rule_kind: 'polyvalent', unit: 'reps',
        threshold: seuil, movement_keys: canoniques, per_movement_threshold: 100,
      });
    }
    for (const [cle, seuil] of [['mv_total_10k', 10000], ['mv_total_50k', 50000], ['mv_total_100k', 100000]] as const) {
      expect(parCle.get(cle)).toEqual({
        badge_key: cle, rule_kind: 'total', unit: 'reps',
        threshold: seuil, movement_keys: canoniques, per_movement_threshold: null,
      });
    }
  });

  it('mv_db_lunge : exception nominative, et elle est encore nécessaire', () => {
    // Arbitrage de Nab (22/09/2026) : la règle serveur dit le vrai mouvement,
    // c'est le repliement « db lunge » → `lunge` du client qui sera corrigé.
    // Le jour où il le sera, `badgePrefixFor` répondra et cette exception
    // deviendra caduque : ce test le dira au lieu de la laisser dormir.
    expect(badgePrefixFor('db_lunge')).toBeUndefined();
    expect(parCle.get('mv_db_lunge_100')).toEqual({
      badge_key: 'mv_db_lunge_100', rule_kind: 'movement', unit: 'reps',
      threshold: 100, movement_keys: ['db_lunge'], per_movement_threshold: null,
    });
  });

  it('la migration insère exactement ces règles', () => {
    const sql = lire('supabase/migrations/20261231000000_badges_mouvement_serveur.sql');
    const bloc = sql.slice(sql.indexOf('INSERT INTO public.badge_rules'));
    const dansSql = new Map<string, string>();
    for (const [, cle, kind, unit, seuil, keys, pmt] of bloc.matchAll(
      /\('(mv_[a-z0-9_]+)', '(\w+)', '(\w+)', (\d+), ARRAY\[([^\]]*)\], (NULL|\d+)\)/g,
    )) {
      dansSql.set(cle, [kind, unit, seuil, keys.replace(/'/g, '').replace(/, /g, ','), pmt].join('|'));
    }
    expect(dansSql.size).toBe(REGLES.length);
    for (const r of REGLES) {
      expect(dansSql.get(r.badge_key)).toBe(
        [r.rule_kind, r.unit, r.threshold, r.movement_keys.join(','),
         r.per_movement_threshold ?? 'NULL'].join('|'),
      );
    }
  });

  it('les fichiers générés sont à jour vis-à-vis de leurs sources', () => {
    // Couvre aussi `badge_rules_cases.sql`, le transport des cas vers psql :
    // un fichier de cas modifié sans regénération ferait juger le serveur sur
    // d'autres cas que le client.
    execFileSync('node', ['scripts/generate-badge-rules.mjs', '--check'], { cwd: RACINE });
  });
});
