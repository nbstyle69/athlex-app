/**
 * analyze-tournament-score désactivée (#594) : l'appelant reste authentifié,
 * puis 410 FEATURE_DISABLED, sans aucun appel vers Anthropic. index.ts (Deno)
 * ne tourne pas sous Jest : on rejoue sa règle (regles.ts) et on vérifie dans
 * son source que le point d'entrée ne peut pas atteindre l'analyse.
 */
import fs from 'fs';
import path from 'path';
import { type Acces, traiterAppel } from '../../supabase/functions/analyze-tournament-score/regles';

const RACINE = path.join(__dirname, '..', '..');
const DOSSIER = 'supabase/functions/analyze-tournament-score';
const lire = (p: string) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const acces = (valide: boolean): Acces => ({
  utilisateur: jest.fn(async () => (valide ? '00000000-0000-4000-a000-000000000001' : null)),
});

describe('analyze-tournament-score — désactivée (#594)', () => {
  const fetchOriginal = global.fetch;
  let fetchSimule: jest.Mock;
  beforeEach(() => {
    fetchSimule = jest.fn();
    global.fetch = fetchSimule as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('appelant authentifié : 410 FEATURE_DISABLED, fetch jamais appelé', async () => {
    const a = acces(true);
    expect(await traiterAppel('Bearer jeton', a)).toEqual({ status: 410, body: { error: 'FEATURE_DISABLED' } });
    expect(a.utilisateur).toHaveBeenCalledWith('jeton');
    expect(fetchSimule).not.toHaveBeenCalled();
  });

  it.each([
    ['sans en-tête', null, true],
    ['jeton vide', 'Bearer   ', true],
    ['jeton invalide', 'Bearer faux', false],
  ])('%s : 401, fetch jamais appelé', async (_cas, auth, valide) => {
    const r = await traiterAppel(auth, acces(valide));
    expect(r.status).toBe(401);
    expect(fetchSimule).not.toHaveBeenCalled();
  });

  it('regles.ts ne parle à aucun service externe', () => {
    const src = lire(`${DOSSIER}/regles.ts`);
    expect(src).not.toMatch(/\bfetch\s*\(|anthropic\.com|^\s*import\s/im);
  });

  it("le point d'entrée passe par traiterAppel et n'atteint jamais l'analyse", () => {
    const src = lire(`${DOSSIER}/index.ts`);
    const entree = src.slice(src.lastIndexOf('serve('));
    expect(src.match(/\bserve\(/g)).toHaveLength(1);
    expect(entree).toMatch(/traiterAppel\(/);
    expect(entree).not.toMatch(/\bfetch\s*\(|analyserScore|anthropic|buildPrompt/i);
    // `analyserScore` n'existe que par sa définition : aucun appel nulle part.
    expect(src.match(/\banalyserScore\s*\(/g)).toHaveLength(1);
    // L'appel à Anthropic reste confiné dans `analyserScore`.
    const avantEntree = src.slice(0, src.lastIndexOf('serve('));
    const debutAnalyse = src.indexOf('async function analyserScore');
    expect(src.indexOf('api.anthropic.com')).toBeGreaterThan(debutAnalyse);
    expect(avantEntree).toContain('api.anthropic.com');
  });
});
