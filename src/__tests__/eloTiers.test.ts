import { lightTheme, darkTheme } from '../theme/palette';
import { contrast } from '../theme/contrast';
import { LevelColors } from '../theme/designTokens';
import {
  ELO_TIERS, tierOf, tierProgress, passageIndex, bestIndex, tierBands, thresholdsIn,
  tierInk, tierBand, tierInkOnBand, composite,
} from '../utils/eloTiers';

describe('paliers ELO', () => {
  it('six paliers du plus bas au plus haut, seuils de eloLevels', () => {
    expect(ELO_TIERS.map((t) => [t.name, t.min])).toEqual([
      ['Scaled', 0], ['Inter', 800], ['RX', 1200], ['RX+', 1400], ['Elite', 1600], ['Pro', 1800],
    ]);
  });

  it.each([
    [-20, 'Scaled'], [0, 'Scaled'], [799, 'Scaled'], [800, 'Inter'], [1199, 'Inter'], [1200, 'RX'],
    [1399, 'RX'], [1400, 'RX+'], [1599, 'RX+'], [1600, 'Elite'], [1799, 'Elite'], [1800, 'Pro'], [2400, 'Pro'],
  ])('ELO %i → %s', (elo, name) => {
    expect(tierOf(elo).name).toBe(name);
  });

  it.each([
    [799, 'Inter', 1, 799 / 800],
    [800, 'RX', 400, 0],
    [1000, 'RX', 200, 0.5],
    [1599, 'Elite', 1, 199 / 200],
    [1600, 'Pro', 200, 0],
    [1700, 'Pro', 100, 0.5],
  ])('ELO %i : palier suivant %s, %i pts restants, avancée %f', (elo, next, remaining, ratio) => {
    const p = tierProgress(elo);
    expect(p.next?.name).toBe(next);
    expect(p.remaining).toBe(remaining);
    expect(p.ratio).toBeCloseTo(ratio, 10);
  });

  it('Pro : aucun palier suivant, barre pleine', () => {
    expect(tierProgress(1800)).toEqual({ current: ELO_TIERS[5], next: null, remaining: null, ratio: 1 });
  });

  it('avancée bornée à 0 sous le seuil 0', () => {
    expect(tierProgress(-50).ratio).toBe(0);
  });
});

describe('repères de la courbe', () => {
  const CURVE = [1150, 1180, 1210, 1390, 1410, 1450, 1432];
  it('Passage : premier point entré dans le palier depuis un palier inférieur', () => {
    expect(passageIndex(CURVE, 'rx+')).toBe(4);
    expect(passageIndex(CURVE, 'rx')).toBe(2);
    expect(passageIndex([1390, 1410, 1380, 1420], 'rx+')).toBe(1);
  });
  it('Passage : aucun si la période commence déjà dans le palier ou y descend', () => {
    expect(passageIndex([1410, 1450, 1432], 'rx+')).toBeNull();
    expect(passageIndex([1650, 1500], 'rx+')).toBeNull();
    expect(passageIndex([1400], 'rx+')).toBeNull();
  });
  it('Passage au seuil exact', () => {
    expect(passageIndex([1399, 1400], 'rx+')).toBe(1);
  });
  it('Meilleur : plus haut point, le premier en cas d’égalité', () => {
    expect(bestIndex(CURVE)).toBe(5);
    expect(bestIndex([1200, 1300, 1300])).toBe(1);
    expect(bestIndex([])).toBeNull();
  });
});

describe('bandes et seuils', () => {
  it('bandes des paliers de la plage, bornées à la plage', () => {
    expect(tierBands(1150, 1480).map((b) => [b.tier.level, b.from, b.to])).toEqual([
      ['inter', 1150, 1200], ['rx', 1200, 1400], ['rx+', 1400, 1480],
    ]);
    expect(tierBands(1700, 2100).map((b) => [b.tier.level, b.from, b.to])).toEqual([['elite', 1700, 1800], ['pro', 1800, 2100]]);
  });
  it('seuils strictement dans la plage', () => {
    expect(thresholdsIn(1150, 1480).map((t) => t.min)).toEqual([1200, 1400]);
    expect(thresholdsIn(1200, 1400)).toEqual([]);
  });
  it('composite pose une couleur translucide sur son fond', () => {
    expect(composite('rgba(0,0,0,0.5)', '#FFFFFF')).toBe('#808080');
    expect(composite('#123456', '#FFFFFF')).toBe('#123456');
  });
});

describe.each([['clair', lightTheme.ax], ['sombre', darkTheme.ax]])('contraste des paliers, thème %s', (_n, c) => {
  it.each(ELO_TIERS.map((t) => [t.name, t.level] as const))('%s : AA sur la carte et sur sa bande', (_name, level) => {
    expect(contrast(tierInk(level, c), c.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tierInkOnBand(level, c), tierBand(level, c))).toBeGreaterThanOrEqual(4.5);
    expect(tierBand(level, c)).not.toBe(c.surface.toUpperCase());
  });
  it('les couleurs sous l’AA sont rapprochées de l’encre juste assez, sans devenir l’encre du thème', () => {
    const low = ELO_TIERS.filter((t) => contrast(LevelColors[t.level], c.surface) < 4.5);
    expect(low.length).toBeGreaterThan(0);
    for (const t of low) {
      const ink = tierInk(t.level, c);
      expect(ink).not.toBe(LevelColors[t.level].toUpperCase());
      expect(contrast(ink, c.surface)).toBeLessThan(contrast(c.text, c.surface));
    }
  });
  it('les couleurs gardent leur teinte quand elles tiennent déjà l’AA', () => {
    const ok = ELO_TIERS.filter((t) => contrast(LevelColors[t.level], c.surface) >= 4.5);
    for (const t of ok) expect(tierInk(t.level, c)).toBe(LevelColors[t.level].toUpperCase());
  });
});
