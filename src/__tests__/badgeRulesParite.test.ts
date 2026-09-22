/**
 * Parité des décisions : le client et le serveur, sur les mêmes cas.
 *
 * Le fichier de cas `supabase/seed/badge_rules_cases.json` est lu ici et, mot
 * pour mot, par `supabase/tests/badge_rules_mv.sql`. Deux jeux de cas
 * divergeraient, et le plus indulgent deviendrait la vérité.
 *
 * Ce test ne réimplémente pas la règle du client : il fait tourner
 * `logMovementReps`, le vrai chemin de décision, avec des cumuls simulés. Une
 * réimplémentation ne prouverait que sa propre cohérence.
 */
import fs from 'fs';
import path from 'path';

// ── Supabase chainable mock ──────────────────────────────────────────────────
const makeChain = (overrides: Record<string, any> = {}) => {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.insert = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.single = jest.fn().mockResolvedValue({
    data: { title: 'Badge Test', icon: '🏅', description: 'Test' },
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null });
  Object.assign(chain, overrides);
  return chain;
};

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => makeChain()),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      // Session d'un tiers : `awardBadge` prend le chemin gestionnaire et pose
      // le badge en direct, ce qui rend la décision observable sans simuler la
      // RPC serveur — c'est bien la DÉCISION du client qu'on compare ici.
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'staff-1' } } } }),
    },
  },
}));
jest.mock('../lib/haptics', () => ({ hapticHeavy: jest.fn() }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import { logMovementReps } from '../services/gamification';

const RACINE = path.resolve(__dirname, '../..');
const CAS = JSON.parse(fs.readFileSync(path.join(RACINE, 'supabase/seed/badge_rules_cases.json'), 'utf8'));
const REGLES = JSON.parse(fs.readFileSync(path.join(RACINE, 'supabase/seed/badge_rules.json'), 'utf8')).regles;
/** Le catalogue tel que le client le lit : les 187 clés, catégorie `movement`. */
const CATALOGUE = REGLES.map((r: { badge_key: string }) => ({
  badge_key: r.badge_key, title: r.badge_key, icon: '🏅',
}));

interface Cumul { movement: string; unit: string; total_reps: number }
interface Cas { nom: string; cumuls: Cumul[]; attendus: string[]; refuses: string[] }

const { supabase } = require('../lib/supabase');

/** Rejoue un cas et rend les badges que le client accorde. */
async function decisionDuClient(cumuls: Cumul[]): Promise<string[]> {
  const poses: string[] = [];
  supabase.rpc.mockResolvedValue({ data: null, error: null });
  supabase.from.mockImplementation((table: string) => {
    if (table === 'user_movement_stats') {
      return makeChain({ eq: jest.fn().mockResolvedValue({ data: cumuls, error: null }) });
    }
    if (table === 'badges_catalog') {
      return makeChain({ eq: jest.fn().mockResolvedValue({ data: CATALOGUE, error: null }) });
    }
    if (table === 'athlete_badges') {
      return makeChain({
        insert: jest.fn(async (row: any) => { poses.push(row.badge_key); return { data: null, error: null }; }),
      });
    }
    return makeChain();
  });

  // Le mouvement passé en argument ne sert qu'à déclencher le calcul : la
  // décision porte sur les cumuls simulés ci-dessus, pas sur cette ligne.
  await logMovementReps('athlete-1', [{ name: 'Pull Up', reps: 1 }]);
  return poses.sort();
}

describe('parité des décisions client ↔ serveur (cas partagés)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('couvre les trois unités, un regroupement et les deux méta-badges', () => {
    const unites = new Set(CAS.cas.flatMap((c: Cas) => c.cumuls.map(x => x.unit)));
    expect([...unites].sort()).toEqual(['cal', 'm', 'reps']);
    const attendus = CAS.cas.flatMap((c: Cas) => c.attendus);
    expect(attendus).toContain('mv_burpee_100');      // regroupement
    expect(attendus).toContain('mv_total_10k');       // méta total
    expect(attendus).toContain('mv_polyvalent_5');    // méta polyvalence
    expect(CAS.cas.length).toBeGreaterThanOrEqual(5);
  });

  for (const cas of CAS.cas as Cas[]) {
    it(cas.nom, async () => {
      const obtenus = await decisionDuClient(cas.cumuls);
      // Comparaison exhaustive : un badge accordé en trop est une divergence
      // autant qu'un badge manquant.
      expect(obtenus).toEqual([...cas.attendus].sort());
      for (const refuse of cas.refuses) expect(obtenus).not.toContain(refuse);
    });
  }
});
