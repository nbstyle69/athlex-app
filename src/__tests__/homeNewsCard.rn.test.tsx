/**
 * R3a — carte « Actu de ta box » et carte « Classement » montées avec le vrai
 * react-native.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { lightTheme as mockTheme } from '../theme/palette';
import i18n from '../i18n';
import HomeNewsCard from '../screens/home/HomeNewsCard';
import CompetitionRankingCard from '../screens/competition/CompetitionRankingCard';
import type { HomeNews } from '../services/homeNews';

jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

const NOW = new Date('2026-09-29T12:00:00Z');
const news = (hoursAgo: number, image_url: string | null = 'https://x/y.jpg'): HomeNews => ({
  id: 'a1', title: 'Portes ouvertes samedi', body: 'Viens avec tes amis', image_url,
  created_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(), likes: 7, comments: 1,
});

function mount(el: React.ReactElement) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(el); });
  return r;
}
const texts = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const byId = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll((n) => n.props.testID === id && typeof n.type === 'string');

beforeAll(async () => { await i18n.changeLanguage('fr'); });

describe('HomeNewsCard', () => {
  it('affiche titre de section, image, titre, deux lignes du texte, date relative et compteurs', () => {
    const r = mount(<HomeNewsCard news={news(5)} onOpen={() => {}} now={NOW} />);
    const t = texts(r);
    expect(t).toEqual(expect.arrayContaining(['Actu de ta box', 'Portes ouvertes samedi', 'Viens avec tes amis', 'Il y a 5 h', '7', '1']));
    expect(byId(r, 'home-news-image')).toHaveLength(1);
    expect(byId(r, 'home-news-body')[0].props.numberOfLines).toBe(2);
  });

  it('« Nouveau » seulement sous 48 h', () => {
    expect(texts(mount(<HomeNewsCard news={news(47)} onOpen={() => {}} now={NOW} />))).toContain('Nouveau');
    expect(texts(mount(<HomeNewsCard news={news(49)} onOpen={() => {}} now={NOW} />))).not.toContain('Nouveau');
  });

  it('sans image : pas d’image', () => {
    expect(byId(mount(<HomeNewsCard news={news(5, null)} onOpen={() => {}} now={NOW} />), 'home-news-image')).toHaveLength(0);
  });

  it('sans article : rien du tout', () => {
    expect(mount(<HomeNewsCard news={null} onOpen={() => {}} now={NOW} />).toJSON()).toBeNull();
  });

  it('un appui ouvre les actualités', () => {
    const onOpen = jest.fn();
    const r = mount(<HomeNewsCard news={news(5)} onOpen={onOpen} now={NOW} />);
    const card = byId(r, 'home-news-card')[0];
    expect(card.props.accessibilityRole).toBe('button');
    act(() => r.root.findByProps({ testID: 'home-news-card', accessibilityRole: 'button' }).props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('CompetitionRankingCard', () => {
  it('affiche CLASSEMENT, #rang · ELO · palier et Voir ; un appui ouvre le Classement', () => {
    const onOpen = jest.fn();
    const r = mount(<CompetitionRankingCard rank={122} elo={1340} level="rx" onOpen={onOpen} />);
    expect(texts(r)).toEqual(expect.arrayContaining(['Classement', '#122 · ELO 1340 · RX', 'Voir']));
    act(() => r.root.findByProps({ testID: 'competition-ranking', accessibilityRole: 'button' }).props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
