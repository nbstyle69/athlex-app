/**
 * Build 1.0.67 (#523) : l'app est iPhone uniquement (sinon Apple exige des
 * captures iPad 13") et embarque la nouvelle icône sur fond sombre.
 * L'icône iOS doit faire 1024 × 1024 sans canal alpha (refusée par Apple sinon) :
 * on lit l'en-tête IHDR du PNG.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;

const ihdr = (rel: string) => {
  const b = fs.readFileSync(path.join(ROOT, rel));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect(b.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
};

describe('build 1.0.67 : iPhone uniquement + nouvelle icône', () => {
  it('ne déclare pas l’iPad', () => {
    expect(app.ios.supportsTablet).toBe(false);
  });

  it('les chemins d’icône pointent vers des fichiers existants', () => {
    const { foregroundImage, backgroundImage, monochromeImage } = app.android.adaptiveIcon;
    expect(app.icon).toBe('./assets/icon-ios.png');
    expect(app.ios.icon).toBe('./assets/icon-ios.png');
    for (const p of [app.ios.icon, foregroundImage, backgroundImage, monochromeImage]) {
      expect(fs.existsSync(path.join(ROOT, p))).toBe(true);
    }
  });

  it('l’icône iOS fait 1024 × 1024, RGB sans alpha (color type 2)', () => {
    expect(ihdr(app.ios.icon)).toEqual({ width: 1024, height: 1024, colorType: 2 });
  });
});
