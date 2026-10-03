import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as fs from 'fs';
import * as path from 'path';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import i18n from '../i18n';
import { lightTheme, darkTheme } from '../theme/palette';
import { AxTextField } from '../components/ax';
import WhiteboardMembersModal, { WhiteboardMember } from '../screens/whiteboard/WhiteboardMembersModal';
import { wodTypeLabel } from '../utils/wodTypeLabel';
import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';

let mockTheme = lightTheme;
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

const SRC = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const flat = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const byId = (root: ReactTestInstance, id: string) => root.find((n) => typeof n.type === 'string' && n.props.testID === id);
const hostParent = (n: ReactTestInstance) => {
  let p = n.parent;
  while (p && typeof p.type !== 'string') p = p.parent;
  return p!;
};
const THEMES = [['clair', lightTheme], ['sombre', darkTheme]] as const;

describe('R14c 1 : logo AthleX sur les écrans d’entrée', () => {
  const ENTRY = [['screens', 'auth', 'LoginScreen.tsx'], ['screens', 'auth', 'RegisterScreen.tsx'], ['navigation', 'index.tsx']];
  it.each(ENTRY)('%s/%s/%s affiche assets/athex-logo.png, jamais assets/logo.png', (...p) => {
    const s = read(...p);
    expect(s).toMatch(/require\('(\.\.\/)+assets\/athex-logo\.png'\)/);
    expect(s).not.toMatch(/assets\/logo\.png/);
  });
  it.each([['LoginScreen.tsx'], ['RegisterScreen.tsx']])('%s : plus de titre texte « AthleX » sous le logo, logo 120 px', (f) => {
    const s = read('screens', 'auth', f);
    expect(s).not.toMatch(/>\s*AthleX\s*</i);
    expect(s).not.toMatch(/appName/);
    expect(s).toMatch(/logo: \{ width: 120, height: 120, resizeMode: 'contain' \}/);
  });
  it('le slogan reste sur Connexion', () => {
    expect(read('screens', 'auth', 'LoginScreen.tsx')).toMatch(/t\('auth\.tagline'\)/);
  });
});

const get = (d: unknown, k: string): string | undefined => {
  let cur: unknown = d;
  for (const p of k.split('.')) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
  return typeof cur === 'string' ? cur : undefined;
};
const allCaps = (v: string) => {
  const letters = v.replace(/\{\{.*?\}\}/g, '').replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length > 4 && letters === letters.toUpperCase();
};
const ATHLETE_DIRS = ['auth', 'community', 'competition', 'explorer', 'home', 'leaderboard', 'messages', 'onboarding', 'profile',
  'programs', 'reservation', 'settings', 'timer', 'tournament', 'training', 'whiteboard', 'wod'];
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []));

describe('R14c 2 : boutons athlète en écriture normale', () => {
  it('aucun libellé d’AxButton athlète entièrement en capitales, en FR et en EN (texte ou toUpperCase)', () => {
    const offenders: string[] = [];
    let labels = 0;
    for (const d of ATHLETE_DIRS) {
      for (const f of walk(path.join(SRC, 'screens', d))) {
        const s = fs.readFileSync(f, 'utf8');
        for (const m of s.matchAll(/<AxButton\b([\s\S]*?)\/>/g)) {
          const lm = m[1].match(/label=("[^"]*"|\{((?:[^{}]|\{[^{}]*\})*)\})/);
          if (!lm) continue;
          labels++;
          const expr = lm[1];
          const where = `${path.relative(SRC, f)} ${expr}`;
          if (/toUpperCase/.test(expr)) offenders.push(where);
          const vals = expr.startsWith('"') ? [expr.slice(1, -1)] : [];
          for (const k of expr.matchAll(/t\('([\w.]+)'/g)) for (const dict of [fr, en]) vals.push(get(dict, k[1]) ?? '');
          for (const v of vals) if (allCaps(v)) offenders.push(`${where} => ${v}`);
        }
      }
    }
    expect(labels).toBeGreaterThan(40);
    expect(offenders).toEqual([]);
  });
  it.each([
    ['auth.login', 'Se connecter', 'Sign in'], ['auth.joinBattle', 'Rejoindre la bataille', 'Join the battle'],
    ['forgot.getCode', 'Recevoir un code', 'Get a code'], ['whiteboard.enterScore', 'Entrer mon score', 'Enter my score'],
    ['competition.join', 'Rejoindre', 'Join'], ['tourWod.submitScoreCta', 'Soumettre mon score', 'Submit my score'],
  ])('%s : « %s » / « %s »', (k, f, e) => {
    expect(get(fr, k)).toBe(f);
    expect(get(en, k)).toBe(e);
  });
  it('les titres et surtitres restent en capitales (overline, Oswald)', () => {
    expect(get(fr, 'tourWod.finalScore')).toBe('TON SCORE FINAL');
    expect(get(fr, 'tournament.howItWorks')).toBe('COMMENT ÇA MARCHE');
  });
});

describe('R14c 3 : types de séance traduits', () => {
  afterAll(async () => { await i18n.changeLanguage('fr'); });
  it.each([
    ['fr', 'strength', 'Musculation'], ['fr', 'custom', 'Personnalisé'], ['fr', 'for-time', 'For Time'], ['fr', 'amrap', 'AMRAP'],
    ['fr', 'emom', 'EMOM'], ['fr', 'tabata', 'Tabata'],
    ['en', 'strength', 'Strength'], ['en', 'custom', 'Custom'], ['en', 'for-time', 'For Time'], ['en', 'amrap', 'AMRAP'],
    ['en', 'emom', 'EMOM'], ['en', 'tabata', 'Tabata'],
  ])('%s : %s → %s', async (lang, type, label) => {
    await i18n.changeLanguage(lang);
    expect(wodTypeLabel(type)).toBe(label);
  });
  it('type absent → WOD, type inconnu affiché tel quel', () => {
    expect(wodTypeLabel(null)).toBe('WOD');
    expect(wodTypeLabel('ywyr')).toBe('ywyr');
  });
  it.each([
    ['screens/whiteboard/WhiteboardScreen.tsx'], ['screens/whiteboard/WODDetailScreen.tsx'],
    ['screens/wod/WodHistoryScreen.tsx'], ['screens/programs/ProgramDetailScreen.tsx'],
  ])('%s passe par wodTypeLabel, plus de wod_type brut en capitales', (f) => {
    const s = read(f);
    expect(s).toMatch(/wodTypeLabel\(/);
    expect(s).not.toMatch(/wod_type \?\? '[^']*'\)\.toUpperCase\(\)/);
    expect(s).not.toMatch(/wodType\.toUpperCase\(\)/);
  });
  it('vocabulaire : ni « CrossFit » ni « Hyrox » dans les libellés de type', () => {
    expect(JSON.stringify([fr.wodTypes, en.wodTypes])).not.toMatch(/crossfit|hyrox/i);
  });
});

describe('R14c 4 : membres, nom sur toute la largeur', () => {
  const LONG_NAME = 'Anna-Maria Fontaine-Beaumarchais';
  const MEMBERS: WhiteboardMember[] = [
    { id: 'u1', username: LONG_NAME, level: 'rx', elo: 1420, avatar_url: null, role: 'owner' },
    { id: 'u2', username: 'Karim', level: 'elite', elo: 980, avatar_url: null, role: 'coach' },
  ];
  it.each(THEMES)('thème %s : rôle sous le nom, à côté du palier ; nom seul sur sa ligne', async (_n, theme) => {
    mockTheme = theme;
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <WhiteboardMembersModal visible boxName="Box" ownerId="u1" loading={false} members={MEMBERS} onClose={jest.fn()} onOpenProfile={jest.fn()} />,
      );
    });
    for (const u of ['u1', 'u2']) {
      const name = byId(r.root, `member-name-${u}`);
      expect(name.props.numberOfLines).toBe(1);
      expect(flat(name).flexShrink).toBeUndefined();
      const info = hostParent(name);
      expect(flat(info).flexDirection ?? 'column').toBe('column');
      expect(flat(info).flex).toBe(1);
      expect(flat(info).minWidth).toBe(0);
      expect(info.findAll((x) => x.props.testID === `member-role-${u}`).length).toBeGreaterThan(0);
      const meta = byId(r.root, `member-meta-${u}`);
      expect(flat(meta).flexDirection).toBe('row');
      expect(meta.findAll((x) => x.props.testID === `member-role-${u}`).length).toBeGreaterThan(0);
      expect(meta.findAll((x) => x.props.testID === `member-level-${u}`).length).toBeGreaterThan(0);
      expect(name.findAll((x) => x.props.testID === `member-role-${u}`)).toHaveLength(0);
    }
    r.unmount();
  });
});

describe('R14c 5 : Profil › Compte, « Rejoindre une box » en outline', () => {
  it('AxButton outline qui ouvre la fenêtre de code', () => {
    const s = read('screens', 'profile', 'ProfileScreen.tsx');
    const btn = s.match(/<AxButton testID="profile-join-box"[\s\S]*?\/>/)?.[0] ?? '';
    expect(btn).toMatch(/variant="outline"/);
    expect(btn).toMatch(/label=\{t\('profile\.account\.joinBox'\)\}/);
    expect(btn).toMatch(/onPress=\{\(\) => setJoinModal\(true\)\}/);
    expect(s).not.toMatch(/<TouchableOpacity style=\{S\.joinBtn\} onPress=\{\(\) => setJoinModal\(true\)\}/);
  });
  it('le code de box passe par AxTextField (même bordure de focus)', () => {
    const s = read('screens', 'profile', 'ProfileScreen.tsx');
    expect(s).toMatch(/<AxTextField\s+testID="profile-join-code"/);
    expect(s).toMatch(/codeInput: \{ \.\.\.axTypography\.numberM, textAlign: 'center', letterSpacing: 6 \}/);
  });
});

describe('R14c 6 : champ actif, une seule bordure', () => {
  const OS = Platform.OS;
  afterEach(() => { Platform.OS = OS; });
  it.each(THEMES)('thème %s : focus → bordure accentText sur la boîte seule ; aucun contour navigateur en web', async (_n, theme) => {
    mockTheme = theme;
    Platform.OS = 'web';
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => { r = TestRenderer.create(<AxTextField testID="f" value="" onChangeText={jest.fn()} inputStyle={{ letterSpacing: 6 }} />); });
    const input = () => byId(r.root, 'f');
    const box = () => byId(r.root, 'f-box');
    expect(flat(box()).borderColor).toBe(theme.ax.fieldBorder);
    await act(async () => { input().props.onFocus(); });
    expect(flat(box()).borderColor).toBe(theme.ax.accentText);
    expect(flat(box()).borderWidth).toBe(1);
    const st = flat(input());
    expect(st.outlineWidth).toBe(0);
    expect(st.borderWidth ?? 0).toBe(0);
    expect(st.letterSpacing).toBe(6);
    await act(async () => { input().props.onBlur(); });
    expect(flat(box()).borderColor).toBe(theme.ax.fieldBorder);
    r.unmount();
  });
  it('hors web, aucun style de contour ajouté (rétrocompatible)', async () => {
    Platform.OS = 'ios';
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => { r = TestRenderer.create(<AxTextField testID="f" value="" onChangeText={jest.fn()} />); });
    expect(flat(byId(r.root, 'f')).outlineWidth).toBeUndefined();
    r.unmount();
  });
});
