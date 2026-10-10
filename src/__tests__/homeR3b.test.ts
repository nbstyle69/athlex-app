/** R3b — code de l'Accueil : ordre des blocs figé, aucune couleur en dur ni emoji littéral. */
import fs from 'fs';
import path from 'path';

const HOME = path.join(__dirname, '..', 'screens', 'home');
const read = (f: string) => fs.readFileSync(path.join(HOME, f), 'utf8');
const FILES = ['HomeScreen.tsx', 'HomeNewsCard.tsx', 'HomeExplorerBlock.tsx', 'homeLevelColor.ts'];

describe('Accueil R3b', () => {
  it('ordre des blocs dans le code identique à celui d’avant R3b', () => {
    const home = read('HomeScreen.tsx');
    // Instantané de l'ordre des blocs relevé sur master avant R3b.
    const markers = [
      "{user?.username ?? t('onboarding.athleteFallback')}",
      "navigation.navigate('EloHistory' as never)",
      "navigation.navigate('Friends')",
      "navigation.navigate('Profile')",
      '<HomeNewsCard',
      "t('home.thisWeek')",
      "t('home.explorer.title')",
      '<HomeExplorerBlock',
      '<Modal visible={boxPickerVisible}',
      '{badgePopup && (',
      "t('home.competitions')",
      "t('home.tournaments')",
      "t('home.recentResults')",
      '<InteractiveTour />',
    ];
    const at = markers.map((m) => home.indexOf(m));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it.each(FILES)('%s : aucune couleur en dur, aucun emoji littéral, plus de composants glass', (f) => {
    const src = read(f);
    expect(src).not.toMatch(/['"]#[0-9a-fA-F]{3,8}['"]|rgba?\(/);
    expect(src).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(src).not.toMatch(/components\/glass|\b(spacing|borderRadius|typography|shadows)\./);
  });
});
