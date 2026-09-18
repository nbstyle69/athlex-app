/**
 * B6 (lot B) — brouillon local de la séance générée : écrit à la génération,
 * enrichi des charges et du score, effacé à l'enregistrement, purgé au signOut.
 */
import fs from 'node:fs';
import path from 'node:path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearWodDraft, loadWodDraft, saveWodDraft } from '../services/wodDraft';
import { isPurgedAtSignOut } from '../lib/storageKeys';

jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

const generateur = fs.readFileSync(path.join(__dirname, '..', 'screens/wod/WodGeneratorScreen.tsx'), 'utf8');
const resultat = fs.readFileSync(path.join(__dirname, '..', 'screens/wod/WodResultScreen.tsx'), 'utf8');

const screen = { discipline: 'musculation', entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 30, equipment: 'box', exclude: [] } as any;
const result = { wod: { title: 'Push · 30 min', discipline: 'musculation' }, params: {}, category: 'rx' } as any;

describe('service wodDraft', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('écrit, relit, remplace et efface le brouillon, par utilisateur', async () => {
    expect(await loadWodDraft('u1')).toBeNull();
    await saveWodDraft('u1', { screen, result });
    const d = await loadWodDraft('u1');
    expect(d?.result.wod.title).toBe('Push · 30 min');
    expect(d?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await loadWodDraft('u2')).toBeNull();

    await saveWodDraft('u1', { screen, result: { ...result, wod: { ...result.wod, title: 'Autre' } }, performed: [{ id: 'x' } as any], submittedScore: null });
    const d2 = await loadWodDraft('u1');
    expect(d2?.result.wod.title).toBe('Autre');
    expect(d2?.performed).toEqual([{ id: 'x' }]);

    await clearWodDraft('u1');
    expect(await loadWodDraft('u1')).toBeNull();
  });

  it('une clé corrompue ou incomplète rend null plutôt que de casser l\'écran', async () => {
    await AsyncStorage.setItem('@athlex:wodDraft:u1', '{pas du json');
    expect(await loadWodDraft('u1')).toBeNull();
    await AsyncStorage.setItem('@athlex:wodDraft:u1', JSON.stringify({ screen }));
    expect(await loadWodDraft('u1')).toBeNull();
  });

  it('la clé appartient à la session : purgée à la déconnexion', () => {
    expect(isPurgedAtSignOut('@athlex:wodDraft:u1')).toBe(true);
  });
});

describe('écrans', () => {
  it('le générateur écrit le brouillon dès la génération et propose de reprendre la dernière séance', () => {
    expect(generateur).toContain('await saveWodDraft(user.id, { screen, result });');
    expect(generateur).toContain('testID="wodgen-draft-resume"');
    expect(generateur).toMatch(/navigation\.navigate\('WodResult', \{ screen: draft\.screen, result: draft\.result, draft: \{ performed: draft\.performed, submittedScore: draft\.submittedScore \} \}\)/);
    expect(generateur).toContain('useFocusEffect(');
  });

  it("la page résultat repart du brouillon, le tient à jour tant que rien n'est enregistré, et l'efface à l'enregistrement", () => {
    expect(resultat).toContain('useState<ScoreSubmission | null>(route.params.draft?.submittedScore ?? null)');
    expect(resultat).toContain('route.params.draft?.performed ?? (muscu ? initialPerformed(muscu) : [])');
    expect(resultat).toMatch(/if \(!user \|\| savedId\) return;\s+saveWodDraft\(user\.id, \{ screen, result, performed, submittedScore \}\);/);
    expect(resultat).toMatch(/setSavedId\(id\);\s+clearWodDraft\(user\.id\);/);
  });
});
