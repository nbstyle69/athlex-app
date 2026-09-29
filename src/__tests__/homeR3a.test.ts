/**
 * R3a — Accueil : carte « Actu de ta box », section Outils retirée, accès au
 * Classement depuis l'Accueil et Compétitions.
 */
import fs from 'node:fs';
import path from 'node:path';

const mockFrom = jest.fn();
let mockRows: unknown[] = [];
const mockCalls: [string, ...unknown[]][] = [];
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      mockFrom(...a);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'order']) chain[m] = (...args: unknown[]) => { mockCalls.push([m, ...args]); return chain; };
      chain.limit = async (...args: unknown[]) => { mockCalls.push(['limit', ...args]); return { data: mockRows, error: null }; };
      return chain;
    },
  },
}));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));

import { fetchHomeNews, isFreshNews, isRecentNews, newsAge } from '../services/homeNews';

const SRC = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const NOW = new Date('2026-09-29T12:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const row = (created_at: string) => ({
  id: 'a1', title: 'Portes ouvertes', body: 'Samedi', image_url: null, created_at,
  box_article_likes: [{ count: 7 }], box_article_comments: [{ count: 3 }],
});

beforeEach(() => { mockFrom.mockClear(); mockCalls.length = 0; mockRows = []; });

describe('fetchHomeNews', () => {
  it('aucune requête sans box active', async () => {
    expect(await fetchHomeNews(undefined, NOW)).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('une seule requête : dernier article de la box sous 14 jours, avec ses compteurs', async () => {
    mockRows = [row(ago(24))];
    expect(await fetchHomeNews('box-1', NOW)).toEqual({
      id: 'a1', title: 'Portes ouvertes', body: 'Samedi', image_url: null, created_at: ago(24), likes: 7, comments: 3,
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('box_articles');
    expect(mockCalls).toEqual([
      ['select', 'id, title, body, image_url, created_at, box_article_likes(count), box_article_comments(count)'],
      ['eq', 'box_id', 'box-1'],
      ['gte', 'created_at', ago(14 * 24)],
      ['order', 'created_at', { ascending: false }],
      ['limit', 1],
    ]);
  });

  it('aucun article : null', async () => {
    expect(await fetchHomeNews('box-1', NOW)).toBeNull();
  });

  it('article de plus de 14 jours : null', async () => {
    mockRows = [row(ago(14 * 24 + 1))];
    expect(await fetchHomeNews('box-1', NOW)).toBeNull();
  });
});

describe('seuils et date relative', () => {
  it('récent sous 14 jours, « Nouveau » sous 48 h', () => {
    expect(isRecentNews(ago(14 * 24 - 1), NOW)).toBe(true);
    expect(isRecentNews(ago(14 * 24), NOW)).toBe(false);
    expect(isFreshNews(ago(47), NOW)).toBe(true);
    expect(isFreshNews(ago(48), NOW)).toBe(false);
  });

  it('date relative en minutes, heures puis jours', () => {
    expect(newsAge(NOW.toISOString(), NOW)).toEqual({ key: 'home.news.ago.now', count: 0 });
    expect(newsAge(ago(0.5), NOW)).toEqual({ key: 'home.news.ago.minutes', count: 30 });
    expect(newsAge(ago(5), NOW)).toEqual({ key: 'home.news.ago.hours', count: 5 });
    expect(newsAge(ago(72), NOW)).toEqual({ key: 'home.news.ago.days', count: 3 });
  });
});

describe('Accueil', () => {
  const home = read('screens', 'home', 'HomeScreen.tsx');

  it('la carte Actu est juste sous les boutons Amis / Profil, avant « Cette semaine »', () => {
    const profile = home.indexOf("label={t('tabs.profile')}");
    const card = home.indexOf('<HomeNewsCard');
    expect(profile).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(profile);
    expect(home.indexOf("t('home.thisWeek")).toBeGreaterThan(card);
  });

  it('sans box, la carte ne reçoit rien ; son appui ouvre Articles dans l’onglet Ma Box', () => {
    expect(home).toContain('news={currentBox ? news : null}');
    expect(home).toContain("navigate('Whiteboard', { screen: 'Articles' })");
    expect(home).toContain('fetchHomeNews(currentBox?.id)');
  });

  it('plus de section Outils ni de homeTools', () => {
    expect(home).not.toMatch(/home\.tools|homeTools|TOOLS/);
    expect(fs.existsSync(path.join(SRC, 'screens', 'home', 'homeTools.ts'))).toBe(false);
    for (const l of ['fr', 'en']) expect(JSON.parse(read('i18n', 'locales', `${l}.json`)).home.tools).toBeUndefined();
  });

  it('le Rang est un bouton qui ouvre le Classement', () => {
    const i = home.indexOf('testID="home-rank"');
    const block = home.slice(home.lastIndexOf('<TouchableOpacity', i), i);
    expect(block).toContain("navigation.navigate('Leaderboard')");
    expect(block).toContain('accessibilityRole="button"');
    expect(block).toContain("t('home.rankOpen', { rank })");
  });
});

describe('tutoriel interactif', () => {
  const tour = read('components', 'InteractiveTour.tsx');
  const homeIcons = tour.match(/const HOME_ICONS: IconCmp\[\] = \[([^\]]*)\]/)![1].split(',').map((s) => s.trim());
  const navIcons = tour.match(/const NAV_ICONS: IconCmp\[\] = \[([^\]]*)\]/)![1].split(',').map((s) => s.trim());

  it('aucune étape ne vise les outils retirés de l’Accueil', () => {
    expect(homeIcons).toEqual(['TrendingUp', 'Users', 'Trophy', 'Newspaper']);
    for (const l of ['fr', 'en']) {
      const steps: { label: string; description: string }[] = JSON.parse(read('i18n', 'locales', `${l}.json`)).tour.steps;
      expect(steps).toHaveLength(homeIcons.length + navIcons.length);
      const homeSteps = steps.slice(0, homeIcons.length).map((s) => `${s.label} ${s.description}`).join(' ');
      expect(homeSteps).not.toMatch(/minuteur|timer|générateur|generator|1rm|outils|tools/i);
    }
  });
});

describe('Compétitions', () => {
  const nav = read('navigation', 'index.tsx');
  const comp = read('screens', 'competition', 'CompetitionScreen.tsx');

  it('la pile Compétition déclare Leaderboard (et PublicProfile, ouvert depuis le Classement)', () => {
    const start = nav.indexOf('function CompetitionNavigator() {');
    const body = nav.slice(start, nav.indexOf('\n}\n', start));
    expect(body).toContain('<CompStack.Screen name="Leaderboard" component={LeaderboardScreen} />');
    expect(body).toContain('<CompStack.Screen name="PublicProfile" component={PublicProfileScreen} />');
  });

  it('la carte Classement est sous le WOD du jour et ouvre Leaderboard', () => {
    const wod = comp.indexOf("t('competition.wodOfDay')");
    const card = comp.indexOf('<CompetitionRankingCard');
    expect(card).toBeGreaterThan(wod);
    expect(comp.indexOf("t('competition.miniInfo')")).toBeGreaterThan(card);
    expect(comp.slice(card, comp.indexOf('/>', card))).toContain("onOpen={() => navigation.navigate('Leaderboard')}");
  });
});

describe('vocabulaire des nouveaux éléments', () => {
  const files = ['screens/home/HomeNewsCard.tsx', 'screens/competition/CompetitionRankingCard.tsx', 'services/homeNews.ts'];
  it('aucun « CrossFit » / « Hyrox », aucun emoji ; icônes lucide uniquement', () => {
    const texts = [...files.map((f) => read(f))];
    for (const l of ['fr', 'en']) {
      const d = JSON.parse(read('i18n', 'locales', `${l}.json`));
      texts.push(JSON.stringify([d.home.news, d.home.rankOpen, d.competition.ranking, d.tour.steps]));
    }
    for (const s of texts) {
      expect(s).not.toMatch(/crossfit|hyrox/i);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      const icons = [...s.matchAll(/from '([^']*icon[^']*)'/gi)].map((m) => m[1]);
      for (const i of icons) expect(i).toBe('lucide-react-native');
    }
  });
});
