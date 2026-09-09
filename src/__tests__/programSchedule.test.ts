// Le fuseau Europe/Paris est imposé par jest.globalSetup.js : minuit local est
// la veille en UTC, c'est là que `toISOString()` faisait glisser un lundi au dimanche.
import {
  groupProgramWeeks,
  isoDayOf,
  isProgramSession,
  mondayOf,
  toLocalIso,
  programSessionsOn,
  programWeekAt,
  weekGroupSessionsOn,
  whiteboardWodsOn,
  isMonday,
  upcomingMondays,
  leaderboardAvailable,
  isRestDay,
} from '../utils/programSchedule';
import { semaineSuivante } from '../services/programContent';

type W = {
  id: string;
  scheduled_date: string | null;
  program_week: number | null;
  program_day: number | null;
};

const relative = (id: string, week: number, day: number): W =>
  ({ id, scheduled_date: null, program_week: week, program_day: day });
const dated = (id: string, date: string): W =>
  ({ id, scheduled_date: date, program_week: null, program_day: null });

describe('calendrier relatif', () => {
  it('isoDayOf : lundi = 1, dimanche = 7', () => {
    expect(isoDayOf('2026-04-13')).toBe(1);
    expect(isoDayOf('2026-04-19')).toBe(7);
  });

  it('Europe/Paris : un lundi reste un lundi (pas de glissement UTC)', () => {
    expect(new Date('2026-04-13T00:00:00').getTimezoneOffset()).toBe(-120);
    expect(mondayOf('2026-04-13')).toBe('2026-04-13');
    expect(mondayOf('2026-01-05')).toBe('2026-01-05');
    expect(toLocalIso(new Date('2026-04-13T00:00:00'))).toBe('2026-04-13');
    expect(new Date('2026-04-13T00:00:00').toISOString().slice(0, 10)).toBe('2026-04-12');
  });

  it('mondayOf ramène au lundi de la semaine', () => {
    expect(mondayOf('2026-04-15')).toBe('2026-04-13');
    expect(mondayOf('2026-04-19')).toBe('2026-04-13');
    expect(mondayOf('2026-04-13')).toBe('2026-04-13');
  });

  it('programWeekAt : semaine 1 = semaine du début, même si le début est un jeudi', () => {
    expect(programWeekAt('2026-04-16', '2026-04-13')).toBe(1);
    expect(programWeekAt('2026-04-16', '2026-04-19')).toBe(1);
    expect(programWeekAt('2026-04-16', '2026-04-20')).toBe(2);
    expect(programWeekAt('2026-04-16', '2026-05-04')).toBe(4);
  });

  it('programWeekAt : avant le début ou sans date de début → 0 (rien à afficher)', () => {
    expect(programWeekAt('2026-04-16', '2026-04-05')).toBe(0);
    expect(programWeekAt(null, '2026-04-16')).toBe(0);
    expect(programWeekAt(undefined, '2026-04-16')).toBe(0);
  });
});

describe('non-fusion programme ↔ Whiteboard', () => {
  const programme = [
    relative('s1-lun', 1, 1),
    relative('s1-mer', 1, 3),
    relative('s2-lun', 2, 1),
    dated('date-13', '2026-04-13'),
  ];

  it('une séance relative est une séance de programme, un WOD daté ne l’est pas', () => {
    expect(isProgramSession(relative('x', 1, 1))).toBe(true);
    expect(isProgramSession(dated('x', '2026-04-13'))).toBe(false);
  });

  it('le Whiteboard (lecture datée) ne voit jamais une séance relative', () => {
    expect(whiteboardWodsOn(programme, '2026-04-13').map(w => w.id)).toEqual(['date-13']);
    expect(whiteboardWodsOn(programme, '2026-04-15')).toEqual([]);
  });

  it('l’abonné démarré le 13/04 reçoit S1 lundi le 13/04, S1 mercredi le 15/04, S2 lundi le 20/04', () => {
    const debut = '2026-04-13';
    expect(programSessionsOn(programme, debut, '2026-04-13').map(w => w.id)).toEqual(['s1-lun', 'date-13']);
    expect(programSessionsOn(programme, debut, '2026-04-15').map(w => w.id)).toEqual(['s1-mer']);
    expect(programSessionsOn(programme, debut, '2026-04-20').map(w => w.id)).toEqual(['s2-lun']);
    expect(programSessionsOn(programme, debut, '2026-04-14')).toEqual([]);
  });

  it('un autre abonné démarré une semaine plus tard reçoit S1 le 20/04 : le contenu suit la date de début', () => {
    expect(programSessionsOn(programme, '2026-04-20', '2026-04-20').map(w => w.id)).toEqual(['s1-lun']);
    expect(programSessionsOn(programme, '2026-04-20', '2026-04-13').map(w => w.id)).toEqual(['date-13']);
  });

  it('sans date de début, seul le contenu daté (WOD Whiteboard restreint) sort', () => {
    expect(programSessionsOn(programme, null, '2026-04-13').map(w => w.id)).toEqual(['date-13']);
  });

  it('un WOD daté du Whiteboard n’est jamais requalifié en séance relative', () => {
    const w = dated('wb', '2026-04-13');
    expect(programSessionsOn([w], '2026-04-13', '2026-04-20')).toEqual([]);
    expect(groupProgramWeeks([w])[0]).toMatchObject({ week: null, monday: '2026-04-13' });
  });
});

describe('vue programme (ProgramDetailScreen)', () => {
  const wods = [
    relative('s2-mar', 2, 2),
    relative('s1-lun', 1, 1),
    dated('d', '2026-04-15'),
  ];

  it('groupe les semaines relatives d’abord, puis les semaines datées', () => {
    const groupes = groupProgramWeeks(wods);
    expect(groupes.map(g => g.key)).toEqual(['S1', 'S2', '2026-04-13']);
  });

  it('retrouve les séances d’un jour dans chaque type de groupe', () => {
    const [s1, s2, datee] = groupProgramWeeks(wods);
    expect(weekGroupSessionsOn(s1, 1).map(w => w.id)).toEqual(['s1-lun']);
    expect(weekGroupSessionsOn(s2, 2).map(w => w.id)).toEqual(['s2-mar']);
    expect(weekGroupSessionsOn(s2, 1)).toEqual([]);
    expect(weekGroupSessionsOn(datee, 3).map(w => w.id)).toEqual(['d']);
  });
});

describe('duplication de semaine', () => {
  it('relatif → semaine + 1, même jour ; daté → + 7 jours', () => {
    expect(semaineSuivante(relative('x', 3, 5))).toEqual({ scheduled_date: null, program_week: 4, program_day: 5 });
    expect(semaineSuivante(dated('x', '2026-04-13'))).toEqual({ scheduled_date: '2026-04-20', program_week: null, program_day: null });
    expect(semaineSuivante({ scheduled_date: null, program_week: null, program_day: null })).toBeNull();
  });
});

describe('date de début choisie par l’athlète (lundi, après achat)', () => {
  it('start_date NULL : pas de semaine courante, jamais de séance du jour', () => {
    expect(programWeekAt(null, '2026-04-15')).toBe(0);
    expect(programSessionsOn([relative('a', 1, 3)], null, '2026-04-15')).toEqual([]);
  });

  it('seuls les lundis sont acceptés', () => {
    expect(isMonday('2026-04-13')).toBe(true);
    expect(isMonday('2026-04-14')).toBe(false);
    expect(isMonday('2026-04-19')).toBe(false);
  });

  it('propose les lundis à venir, lundi courant inclus (Europe/Paris)', () => {
    expect(upcomingMondays('2026-04-13', 3)).toEqual(['2026-04-13', '2026-04-20', '2026-04-27']);
    expect(upcomingMondays('2026-04-15', 2)).toEqual(['2026-04-13', '2026-04-20']);
    expect(upcomingMondays('2026-04-19', 2)).toEqual(['2026-04-13', '2026-04-20']);
    expect(upcomingMondays('2026-03-28', 2)).toEqual(['2026-03-23', '2026-03-30']);
  });
});

describe('leaderboard / ELO fermés sur une séance relative', () => {
  it('une séance relative n’a jamais de leaderboard, même flag oublié', () => {
    expect(leaderboardAvailable({ scheduled_date: null, leaderboard_enabled: true })).toBe(false);
    expect(leaderboardAvailable({ scheduled_date: null, leaderboard_enabled: null })).toBe(false);
  });
  it('un WOD Whiteboard daté garde son leaderboard sauf s’il est désactivé', () => {
    expect(leaderboardAvailable({ scheduled_date: '2026-04-13', leaderboard_enabled: true })).toBe(true);
    expect(leaderboardAvailable({ scheduled_date: '2026-04-13', leaderboard_enabled: null })).toBe(true);
    expect(leaderboardAvailable({ scheduled_date: '2026-04-13', leaderboard_enabled: false })).toBe(false);
  });
});

describe('jours de repos explicites (program_rest_days)', () => {
  const repos = [{ program_week: 1, program_day: 3 }, { program_week: 2, program_day: 7 }];
  it('un repos est une marque du coach par semaine × jour, pas l’absence de séance', () => {
    expect(isRestDay(repos, 1, 3)).toBe(true);
    expect(isRestDay(repos, 2, 3)).toBe(false);
    expect(isRestDay(repos, 1, 7)).toBe(false);
    expect(isRestDay([], 1, 6)).toBe(false);
  });
});
