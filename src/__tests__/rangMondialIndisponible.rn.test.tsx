/**
 * #565 — rang mondial : si la RPC global_elo_rank échoue, aucun rang n'est
 * inventé. fetchEloRank rend null (jamais 1, le plus flatteur) et la carte
 * Classement de l'écran Compétitions n'affiche aucun rang, en français comme en
 * anglais. L'Accueil est couvert dans homeR3b.rn.test.tsx.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { lightTheme } from '../theme/palette';
import i18n from '../i18n';
import { fetchEloRank } from '../services/eloRank';
import CompetitionRankingCard from '../screens/competition/CompetitionRankingCard';

let mockRpc: { data: unknown; error: unknown } = { data: null, error: null };

jest.mock('../lib/supabase', () => ({ supabase: { rpc: async () => mockRpc } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
const mockTheme = lightTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));

describe('fetchEloRank', () => {
  it('rend le rang servi par la RPC', async () => {
    mockRpc = { data: 7, error: null };
    await expect(fetchEloRank(1400)).resolves.toBe(7);
  });

  it('rend null si la RPC échoue, jamais un rang par défaut', async () => {
    mockRpc = { data: null, error: { message: 'boom', code: 'PGRST000' } };
    await expect(fetchEloRank(1400)).resolves.toBeNull();
  });
});

describe.each([['fr', 'ELO 1423 · RX+'], ['en', 'ELO 1423 · RX+']])('carte Classement (%s)', (lang, sansRang) => {
  afterAll(async () => { await i18n.changeLanguage('fr'); });

  async function resume(rank: number | null) {
    await i18n.changeLanguage(lang);
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<CompetitionRankingCard rank={rank} elo={1423} level="rx+" onOpen={() => {}} />);
    });
    const node = r.root.findAll((n) => n.props.testID === 'competition-ranking-summary' && typeof n.type === 'string')[0];
    const texte = [node.props.children].flat().join('');
    await act(async () => r.unmount());
    return texte;
  }

  it('avec un rang : #12', async () => {
    expect(await resume(12)).toBe('#12 · ELO 1423 · RX+');
  });

  it('sans rang : ni « # », ni chiffre de rang, ni tiret en guise de rang', async () => {
    expect(await resume(null)).toBe(sansRang);
  });
});
