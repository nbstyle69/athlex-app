/**
 * Lot B — Whiteboard et PR (B7, B8, B10, B11), côté app.
 */
import fs from 'node:fs';
import path from 'node:path';

jest.mock('../lib/supabase', () => ({ supabase: { from: () => ({}) } }));
jest.mock('../lib/sentry', () => ({ captureError: jest.fn() }));
jest.mock('../services/gamification', () => ({ incrementCounter: jest.fn(), logMovementReps: jest.fn() }));
jest.mock('../services/notifications', () => ({ cancelTodayScoreReminder: jest.fn() }));
jest.mock('../services/myProfile', () => ({ fetchMyPersonalRecords: () => Promise.resolve({}) }));

import { whiteboardRows } from '../services/wodGenerator';
import { gymRecordsFrom, GYM_PR_TO_MOVEMENT } from '../screens/wod/gymRecords';
import { formatTimeValue, isTimeUnit, parseTimeInput } from '../screens/profile/timeValue';
import { GYM_ZONES, gymRepsAt } from '../screens/home/gymZones';
import { generateBlocC, generateMuscu, CATALOG_SNAPSHOT, BANK_V1, movementById } from '../../packages/wod-engine/src';

const resultat = fs.readFileSync(path.join(__dirname, '..', 'screens/wod/WodResultScreen.tsx'), 'utf8');
const profil = fs.readFileSync(path.join(__dirname, '..', 'screens/profile/ProfileScreen.tsx'), 'utf8');
const service = fs.readFileSync(path.join(__dirname, '..', 'services/wodGenerator.ts'), 'utf8');

describe('B7 — une ligne box_wods par exercice ou par bloc, date libre', () => {
  it('une séance Musculation donne une ligne par exercice, ordonnée, avec son JSON restreint et sa description rendue', () => {
    const wod = generateMuscu({ entry: 'express', target: 'push', objective: 'hypertrophie', budget_min: 45, equipment: 'box', level: 'inter' }, CATALOG_SNAPSHOT, BANK_V1, 7);
    const rows = whiteboardRows({ ...wod, description: '' } as any);
    expect(rows.length).toBe(wod.blocks[0].exercises.length);
    rows.forEach((r, i) => {
      const e = wod.blocks[0].exercises[i];
      expect(r.title).toBe(e.name);
      expect(r.sort_order).toBe(i);
      expect(r.block_name).toBe('strength');
      expect(r.wod_type).toBe('strength');
      expect(r.description).toContain(`${e.sets} × ${e.reps}`);
      expect((r.wod_json as any).blocks[0].exercises).toEqual([e]);
    });
  });

  it('un WOD Functional garde une ligne par bloc, avec le JSON complet', () => {
    const wod = generateBlocC({ entry: 'express', discipline: 'functional', budget_min: 12, intention: 'mixed', profile_category: 'rx' }, CATALOG_SNAPSHOT, BANK_V1, 11);
    const rows = whiteboardRows(wod);
    expect(rows.length).toBe(wod.blocks.length);
    expect(rows[0].block_name).toBe('wod');
    expect(rows[0].title).toBe(wod.title);
    expect(rows[0].wod_json).toBe(wod);
  });

  it("la date est un paramètre (jour même par défaut) et l'écran la demande, passé et futur autorisés", () => {
    expect(service).toContain('scheduledDate: string = todayISO(),');
    expect(service).toContain("scheduled_date: scheduledDate,");
    expect(resultat).toContain('addToWhiteboard(user.id, wod, id, submittedScore, wbDate)');
    expect(resultat).toContain('<DateField style={S.input} value={wbDate} onChangeText={setWbDate} theme={theme} />');
    expect(resultat).not.toMatch(/minimumDate|maximumDate/);
  });
});

describe('B8 — table gymnique', () => {
  it('paliers de 10 % en 10 %, de 10 à 150 %, reps arrondies', () => {
    expect(GYM_ZONES.map((z) => z.pct)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
    expect(gymRepsAt(50, 50)).toBe(25);
    expect(gymRepsAt(50, 100)).toBe(50);
    expect(gymRepsAt(50, 150)).toBe(75);
    expect(gymRepsAt(12, 60)).toBe(7);
    expect(gymRepsAt(7, 10)).toBe(1);
  });
});

describe('B10 — records gym du profil → moteur', () => {
  it('aucun record gym : undefined, le moteur garde la catégorie', () => {
    expect(gymRecordsFrom({})).toBeUndefined();
    expect(gymRecordsFrom({ weightlifting_Back_Squat: '120' })).toBeUndefined();
    expect(gymRecordsFrom({ 'gymnastics_Pull-ups': '0' })).toBeUndefined();
  });

  it('12 tractions et rien d\'autre : chaque mouvement suivi est présent, à 0 quand le record manque', () => {
    const r = gymRecordsFrom({ 'gymnastics_Pull-ups': '12' });
    expect(r).toEqual({ pull_up: 12, chest_to_bar: 0, toes_to_bar: 0, bar_muscle_up: 0, ring_muscle_up: 0, handstand_push_up: 0, strict_handstand_push_up: 0, ring_dip: 0 });
    expect(gymRecordsFrom({ 'Gymnastics_Ring Muscle-up': '3,5' })?.ring_muscle_up).toBe(3);
  });

  it('chaque libellé suivi correspond à un mouvement gymnique du catalogue', () => {
    for (const id of Object.values(GYM_PR_TO_MOVEMENT)) expect(movementById(CATALOG_SNAPSHOT, id)?.family).toBe('gym');
  });
});

describe('B11 — temps en minutes et secondes', () => {
  it('saisie mm:ss → minutes décimales ; les décimales existantes restent acceptées', () => {
    expect(parseTimeInput('1:42')).toBe('1.7');
    expect(parseTimeInput('12:05')).toBe('12.083');
    expect(parseTimeInput('1.7')).toBe('1.7');
    expect(parseTimeInput('4,5')).toBe('4.5');
    expect(parseTimeInput('')).toBe('');
    expect(parseTimeInput('1:75')).toBeNull();
    expect(parseTimeInput('abc')).toBeNull();
  });

  it('affichage : un record stocké en minutes décimales se lit en mm:ss', () => {
    expect(formatTimeValue('1.7')).toBe('1:42');
    expect(formatTimeValue('4.5')).toBe('4:30');
    expect(formatTimeValue('12')).toBe('12:00');
    expect(formatTimeValue('4:30')).toBe('4:30');
    expect(formatTimeValue(undefined)).toBe('');
    expect(isTimeUnit('min')).toBe(true);
    expect(isTimeUnit('reps')).toBe(false);
  });

  it("l'écran Profil convertit à la validation et affiche en mm:ss", () => {
    expect(profil).toContain("keyboardType={isTimeUnit(pr.unit) ? 'numbers-and-punctuation' : 'numeric'}");
    expect(profil).toContain('const parsed = parseTimeInput(value);');
    expect(profil).toContain("isTimeUnit(pr.unit) ? formatTimeValue(prValues[key]) : prValues[key]");
  });
});
