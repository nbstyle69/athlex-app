/**
 * B5 (lot B) — mode Split du minuteur : chrono global, « Série terminée »
 * enregistre un split et lance le repos de l'exercice courant, exercice
 * suivant quand ses séries sont faites, liste des splits en fin de séance.
 * Défaut d'une séance Musculation ; un metcon se splitte par round.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildFullSeqBlockFromWOD, buildMuscuSplitBlock, buildSplitBlock, formatBlockPreconfig, roundSplitExercises, splitTotalSets, TIMER_BLOCK_TYPES,
} from '../utils/wodToTimer';

const timer = fs.readFileSync(path.join(__dirname, '..', 'screens/timer/TimerRunScreen.tsx'), 'utf8');
const modal = fs.readFileSync(path.join(__dirname, '..', 'components/wod/TimerLaunchModal.tsx'), 'utf8');
const resultat = fs.readFileSync(path.join(__dirname, '..', 'screens/wod/WodResultScreen.tsx'), 'utf8');

describe('bloc Split', () => {
  it("se construit depuis une séance Musculation : un exercice par ligne, ses séries, son repos", () => {
    const b = buildMuscuSplitBlock({ blocks: [{ exercises: [
      { name: 'Développé couché', sets: 4, rest_s: 90 }, { name: 'Écartés', sets: 3, rest_s: 60.4 }, { name: 'Gainage', sets: 0, rest_s: 30 },
    ] }] });
    expect(b.type).toBe('split');
    expect(b.splitExercises).toEqual([{ name: 'Développé couché', sets: 4, restSec: 90 }, { name: 'Écartés', sets: 3, restSec: 60 }]);
    expect(splitTotalSets(b)).toBe(7);
    expect(formatBlockPreconfig(b)).toBe('Split · 2 exercices · 7 séries');
  });

  it('un metcon se splitte par round, sans repos imposé', () => {
    const b = buildFullSeqBlockFromWOD({ wod_type: 'for-time', time_cap_seconds: 900, rounds: 5 } as any);
    expect(b.splitExercises).toEqual([{ name: 'Round', sets: 5, restSec: 0 }]);
    expect(formatBlockPreconfig({ ...b, type: 'split' })).toBe('Split · 5 rounds');
    expect(roundSplitExercises(undefined)).toEqual([{ name: 'Round', sets: 1, restSec: 0 }]);
    expect(formatBlockPreconfig(buildSplitBlock(roundSplitExercises(undefined)))).toBe('Split · 1 round');
  });

  it('le mode est proposé dans le lanceur, avec ses exercices et son explication', () => {
    expect(TIMER_BLOCK_TYPES.map((t) => t.key)).toContain('split');
    expect(modal).toContain("blk.type === 'split' && (");
    expect(modal).toContain('« Série terminée » enregistre un split et lance le repos');
    expect(modal).toContain("patch.type === 'split' && !b.splitExercises?.length ? { splitExercises: roundSplitExercises(b.emomRounds) } : {}");
  });

  it("c'est le mode par défaut d'une séance Musculation sur la page résultat", () => {
    expect(resultat).toContain('isMuscuWod(wod) ? buildMuscuSplitBlock(wod) : buildFullSeqBlockFromWOD(editorFieldsOf(wod))');
  });
});

describe('minuteur', () => {
  it('le chrono global tourne, seul le repos compte à rebours', () => {
    expect(timer).toMatch(/case 'split':\s+\/\/ chrono global toujours en marche[\s\S]*?timerValRef\.current \+= deltaSecs;[\s\S]*?if \(innerPhaseRef\.current === 'rest'\)/);
  });

  it('« Série terminée » : split enregistré au temps global, repos de l\'exercice courant, exercice suivant, fin du bloc après la dernière série', () => {
    expect(timer).toContain('function splitSetDone()');
    expect(timer).toContain("setSplitLog((l) => [...l, { label: list.length > 1 ? `${cur.name} · série ${set}/${cur.sets}` : `${cur.name} ${set}/${cur.sets}`, duration, at }]);");
    expect(timer).toContain('const next = set < cur.sets ? { ex, set: set + 1 } : { ex: ex + 1, set: 1 };');
    expect(timer).toContain('if (!list[next.ex]) { Vibration.vibrate([0, 350, 120, 350]); seqBlockDone(); return; }');
    expect(timer).toContain("if (cur.restSec > 0) { innerPhaseRef.current = 'rest'; setInnerPhase('rest'); roundTimeLeftRef.current = cur.restSec; setRoundTimeLeft(cur.restSec); }");
  });

  it('le bouton existe dans les trois dispositions et la liste des splits est affichée en fin de séance', () => {
    expect((timer.match(/\{showSplitBtn && \(/g) ?? []).length).toBe(3);
    expect(timer).toContain("const splitBtnLabel = innerPhase === 'rest' ? 'PASSER LE REPOS' : (curBlk?.splitExercises?.length ?? 0) > 1 ? 'SÉRIE TERMINÉE' : 'ROUND TERMINÉ';");
    expect(timer).toContain('{splitLog.length > 0 && (');
    expect(timer).toContain("case 'split': break; // dynamique");
  });
});
