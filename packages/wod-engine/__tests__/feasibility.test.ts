/**
 * Faisabilité des combinaisons (G1 / G4). La table est générée depuis la banque
 * par tirage réel ; ce test refuse une table périmée, et vérifie que l'écran
 * peut s'y fier pour ne jamais proposer ce que le moteur ne sait pas servir.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  FEASIBILITY, formatsOfferedFor, feasibleFormats, combinationFeasible, BANK_V1, FORMAT_CHOICE_COVERS,
} from '../src';

const root = path.resolve(__dirname, '../../..');
const script = path.join(root, 'packages/wod-engine/scripts/feasibility.mjs');

describe('table de faisabilité', () => {
  it('src/bank/feasibility.ts est à jour avec la banque (rejeu réel, 25 seeds par combinaison)', () => {
    const out = execFileSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('à jour');
  }, 600_000);

  it('couvre chaque combinaison déclarée par un squelette, une fois', () => {
    const declared = BANK_V1.skeletons.flatMap((s) => s.intentions.map((i) => `${s.id}|${i}`));
    const rows = FEASIBILITY.map((r) => `${r.id}|${r.intention}`);
    expect(new Set(rows).size).toBe(rows.length);
    expect(rows.sort()).toEqual(declared.sort());
  });

  it('les lignes ne dépendent plus d\'une durée demandée', () => {
    for (const row of FEASIBILITY) expect(row).not.toHaveProperty('budget_min');
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

  it('For time · Force est servable avec une durée choisie par le moteur', () => {
    expect(combinationFeasible('functional', 'force', 'for_time')).toBe(true);
  });

  it('chaque format proposé possède une ligne faisable pour cette intention', () => {
    for (const row of FEASIBILITY) {
      for (const format of feasibleFormats(row.discipline, row.intention)) {
        if (format === 'surprise') continue;
        expect(FEASIBILITY.some((r) => r.discipline === row.discipline && r.intention === row.intention
          && r.feasible && FORMAT_CHOICE_COVERS[format].includes(r.format))).toBe(true);
      }
    }
  });

  it("« Surprends-moi » n'est proposé que s'il reste au moins une combinaison", () => {
    expect(feasibleFormats('functional', 'force').has('surprise')).toBe(true);
    expect(feasibleFormats('functional', 'run').size).toBe(0);
  });
});
