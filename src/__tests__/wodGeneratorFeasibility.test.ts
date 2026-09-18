/**
 * G1 / G3 / G4 — l'écran ne ment pas sur ce qu'il propose ni sur ce qu'il affiche.
 *
 * Le générateur ne propose que les formats que la banque sait servir pour la
 * discipline, grise les combinaisons qu'aucun squelette n'aboutit, et le résultat
 * dit quand le format demandé a été relâché. Un EMOM affiche une durée, pas un cap.
 * Les écrans ne s'importent pas ici (React Native) : on lit leur source, et on
 * interroge le moteur pour ce qui est calculé.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatsOfferedFor, combinationFeasible, TIME_BOUNDED } from '../../packages/wod-engine/src';

const lire = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const generateur = lire('screens/wod/WodGeneratorScreen.tsx');
const resultat = lire('screens/wod/WodResultScreen.tsx');

describe('G4 — formats proposés par discipline, depuis la banque', () => {
  it('l\'écran filtre les puces de format par ce que la discipline sait servir', () => {
    expect(generateur).toContain('FORMATS.filter((f) => formatsOffered.includes(f.key))');
    expect(generateur).toContain('formatsOfferedFor(discipline)');
  });

  it('Hybrid perd EMOM et Chipper, Functional garde tout', () => {
    expect(formatsOfferedFor('hybrid')).not.toContain('emom');
    expect(formatsOfferedFor('hybrid')).not.toContain('chipper');
    expect(formatsOfferedFor('functional')).toHaveLength(7);
  });

  it('un format devenu indisponible en changeant de discipline retombe sur « Surprends-moi »', () => {
    expect(generateur).toMatch(/if \(!isMuscu && !formatsOffered\.includes\(format\)\) setFormat\('surprise'\)/);
  });
});

describe('G1 — combinaisons grisées avant le tirage, relâchement affiché après', () => {
  it('les puces de format et de durée portent `disabled` selon la faisabilité', () => {
    expect(generateur).toMatch(/disabled=\{!formatsFaisables\.has\(f\.key\)\}/);
    expect(generateur).toMatch(/disabled=\{!dureesFaisables\.has\(d\)\}/);
  });

  it('le cas rapporté serait grisé : For time · Force · 8 min', () => {
    expect(combinationFeasible('functional', 8, 'force', 'for_time')).toBe(false);
  });

  it("E2 — le relâchement de durée (±5 min) est annoncé comme celui du format, avec l'estimation réelle", () => {
    expect(resultat).toContain("rel.includes('duration±5')");
    expect(resultat).toMatch(/Demandé \$\{metcon\.budget_min\} min, généré \$\{genere\} min\./);
    expect(resultat).toContain('metcon.estimate.reference_minutes');
  });

  it('le résultat annonce le relâchement avec le message convenu', () => {
    expect(resultat).toContain("rel.includes('format')");
    expect(resultat).toMatch(/Aucun \$\{fmt\} ne tient en \$\{intention\} sur \$\{metcon\.budget_min\} min — voici un/);
    expect(resultat).toContain('testID="wodresult-format-relache"');
  });
});

describe('G3 — « Durée » sur les formats bornés, « Cap » sur les autres', () => {
  it('l\'écran choisit le libellé d\'après TIME_BOUNDED du moteur', () => {
    expect(resultat).toContain('TIME_BOUNDED.has(metcon.format)');
    expect(resultat).toMatch(/\{borneParDuree \? 'Durée' : 'Cap'\}/);
  });

  it('un EMOM est borné par sa durée, un For time ne l\'est pas', () => {
    expect(TIME_BOUNDED.has('emom')).toBe(true);
    expect(TIME_BOUNDED.has('amrap')).toBe(true);
    expect(TIME_BOUNDED.has('for_time')).toBe(false);
    expect(TIME_BOUNDED.has('rounds_for_time')).toBe(false);
  });
});
