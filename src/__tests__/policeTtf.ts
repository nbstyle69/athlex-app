/**
 * Lecture des mesures natives d'une police TrueType (tables head, hhea, OS/2, cmap, hmtx,
 * loca, glyf) : ce que iOS et Android utilisent pour placer le texte. Sert de vérité
 * indépendante du code dans les tests du chrono (R3b).
 */
import fs from 'fs';
import path from 'path';

export const FICHIER_OSWALD_BOLD = path.join(process.cwd(), 'node_modules', '@expo-google-fonts', 'oswald', '700Bold', 'Oswald_700Bold.ttf');

export type Police = {
  unitsPerEm: number;
  hhea: { ascender: number; descender: number; lineGap: number };
  typo: { ascender: number; descender: number; lineGap: number; utilisees: boolean };
  win: { ascent: number; descent: number };
  /** Chasse et boîte verticale d'un caractère. */
  glyphe: (c: string) => { chasse: number; yMin: number; yMax: number };
};

export function lirePolice(fichier: string): Police {
  const b = fs.readFileSync(fichier);
  const tables: Record<string, number> = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + 16 * i;
    tables[b.toString('ascii', o, o + 4)] = b.readUInt32BE(o + 8);
  }
  const { head, hhea, hmtx, loca, glyf, cmap } = tables;
  const os2 = tables['OS/2'];
  const indexToLoc = b.readInt16BE(head + 50);
  const nbMetriques = b.readUInt16BE(hhea + 34);

  // cmap : sous-table Unicode BMP au format 4.
  let f4 = -1;
  for (let i = 0; i < b.readUInt16BE(cmap + 2); i++) {
    const r = cmap + 4 + 8 * i;
    const plateforme = b.readUInt16BE(r), codage = b.readUInt16BE(r + 2);
    const o = cmap + b.readUInt32BE(r + 4);
    if (((plateforme === 3 && codage === 1) || plateforme === 0) && b.readUInt16BE(o) === 4) { f4 = o; break; }
  }
  if (f4 < 0) throw new Error('cmap format 4 introuvable');
  const seg2 = b.readUInt16BE(f4 + 6);
  const fin = f4 + 14, debut = fin + seg2 + 2, delta = debut + seg2, decalage = delta + seg2;
  const idGlyphe = (code: number) => {
    for (let i = 0; i < seg2 / 2; i++) {
      if (b.readUInt16BE(fin + 2 * i) < code) continue;
      const d = b.readUInt16BE(debut + 2 * i);
      if (d > code) return 0;
      const dl = b.readInt16BE(delta + 2 * i), ro = b.readUInt16BE(decalage + 2 * i);
      if (ro === 0) return (code + dl) & 0xffff;
      const g = b.readUInt16BE(decalage + 2 * i + ro + 2 * (code - d));
      return g === 0 ? 0 : (g + dl) & 0xffff;
    }
    return 0;
  };
  const debutGlyphe = (g: number) => (indexToLoc === 0 ? 2 * b.readUInt16BE(loca + 2 * g) : b.readUInt32BE(loca + 4 * g));

  return {
    unitsPerEm: b.readUInt16BE(head + 18),
    hhea: { ascender: b.readInt16BE(hhea + 4), descender: b.readInt16BE(hhea + 6), lineGap: b.readInt16BE(hhea + 8) },
    typo: { ascender: b.readInt16BE(os2 + 68), descender: b.readInt16BE(os2 + 70), lineGap: b.readInt16BE(os2 + 72),
      utilisees: (b.readUInt16BE(os2 + 62) & (1 << 7)) !== 0 },
    win: { ascent: b.readUInt16BE(os2 + 74), descent: b.readUInt16BE(os2 + 76) },
    glyphe: (c: string) => {
      const g = idGlyphe(c.codePointAt(0)!);
      const o = glyf + debutGlyphe(g);
      return { chasse: b.readUInt16BE(hmtx + 4 * Math.min(g, nbMetriques - 1)), yMin: b.readInt16BE(o + 4), yMax: b.readInt16BE(o + 8) };
    },
  };
}
