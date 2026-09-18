/**
 * Faisabilité des combinaisons (G1 / G4). La table est générée depuis la banque
 * par tirage réel ; ce test refuse une table périmée, et vérifie que l'écran
 * peut s'y fier pour ne jamais proposer ce que le moteur ne sait pas servir.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  FEASIBILITY, formatsOfferedFor, feasibleFormats, feasibleDurations, combinationFeasible, BANK_V1,
} from '../src';

const root = path.resolve(__dirname, '../../..');
const script = path.join(root, 'packages/wod-engine/scripts/feasibility.mjs');

describe('table de faisabilité', () => {
  it('src/bank/feasibility.ts est à jour avec la banque (rejeu réel, 25 seeds par combinaison)', () => {
    const out = execFileSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('à jour');
  }, 600_000);

  it('couvre chaque combinaison déclarée par un squelette, une fois', () => {
    const declared = BANK_V1.skeletons.flatMap((s) => s.durations.flatMap((d) => s.intentions.map((i) => `${s.id}|${d}|${i}`)));
    const rows = FEASIBILITY.map((r) => `${r.id}|${r.budget_min}|${r.intention}`);
    expect(new Set(rows).size).toBe(rows.length);
    expect(rows.sort()).toEqual(declared.sort());
  });

  it('une déclaration n\'est pas une garantie : des combinaisons déclarées sont infaisables, et on le sait', () => {
    expect(FEASIBILITY.some((r) => !r.feasible)).toBe(true);
  });
});

describe('ce que l\'écran peut proposer', () => {
  it('Hybrid ne propose ni EMOM ni Chipper : la banque n\'en a pas', () => {
    const offered = formatsOfferedFor('hybrid');
    expect(offered).not.toContain('emom');
    expect(offered).not.toContain('chipper');
    expect(offered).toContain('surprise');
  });

  it('Functional propose tous les formats de l\'écran', () => {
    expect(formatsOfferedFor('functional').sort()).toEqual(['amrap', 'chipper', 'emom', 'for_time', 'interval', 'stations', 'surprise'].sort());
  });

  it("le cas rapporté : en Force sur 8 min, RIEN n'est faisable en Functional — la durée sera grisée", () => {
    // Le seul squelette qui déclare Force à 8 min est couplet_for_time_21_15_9, et il
    // n'aboutit jamais. L'EMOM 8 reçu en test réel venait d'un relâchement de DURÉE
    // (emom_alternating à 12 min, ±5), invisible à l'écran : c'est ce que le grisage empêche.
    expect(combinationFeasible('functional', 8, 'force', 'for_time')).toBe(false);
    expect(feasibleFormats('functional', 8, 'force').size).toBe(0);
    expect(feasibleDurations('functional', 'force').has(8)).toBe(false);
    // À 20 min, le For time tient (triplet_rounds_for_time).
    expect(combinationFeasible('functional', 20, 'force', 'for_time')).toBe(true);
  });

  it('les durées grisées suivent le format choisi', () => {
    const forTime = feasibleDurations('functional', 'force', 'for_time');
    expect(forTime.has(8)).toBe(false);
    expect(forTime.has(12)).toBe(true);   // triplet_rounds_for_time
    expect(forTime.has(20)).toBe(true);
    // Intervalles en Force n'a rien sous 15 min (interval_work_rest : 15, 20) :
    // 12 min existe pour l'intention, mais se grise dès que ce format est choisi.
    expect(feasibleDurations('functional', 'force').has(12)).toBe(true);
    expect(feasibleDurations('functional', 'force', 'interval').has(12)).toBe(false);
    expect(feasibleDurations('functional', 'force', 'interval').has(15)).toBe(true);
  });

  it("« Surprends-moi » n'est proposé que s'il reste au moins une combinaison", () => {
    expect(feasibleFormats('functional', 12, 'force').has('surprise')).toBe(true);
    expect(feasibleFormats('functional', 8, 'force').has('surprise')).toBe(false);
    expect(feasibleFormats('functional', 999, 'force').size).toBe(0);
  });
});
