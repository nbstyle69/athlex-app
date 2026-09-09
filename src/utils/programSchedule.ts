/**
 * Position relative d'une séance de programme athlète.
 *
 * Un `box_wods` est soit posé sur le calendrier (`scheduled_date`, Whiteboard
 * de la box), soit posé sur la grille d'un programme (`program_week` ×
 * `program_day`, migration 20261207) — jamais les deux (CHECK
 * `box_wods_ancrage_check`). L'athlète lit la grille à travers SA date de
 * début (`program_members.start_date`) : semaine 1 = la semaine ISO qui
 * contient sa date de début, jour = jour ISO de la date consultée.
 */

export interface RelativeAnchored {
  scheduled_date: string | null;
  program_week: number | null;
  program_day: number | null;
}

/** Jour ISO d'une date `AAAA-MM-JJ` : 1 = lundi … 7 = dimanche. */
export function isoDayOf(dateIso: string): number {
  const d = new Date(dateIso + 'T00:00:00');
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Lundi (`AAAA-MM-JJ`) de la semaine ISO contenant `dateIso`. */
export function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  d.setDate(d.getDate() - (isoDayOf(dateIso) - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Semaine relative du programme à la date consultée, 1-based ; 0 si la date
 * précède le début ou si le début est inconnu (même règle que le lecteur
 * Whiteboard existant : sans date de début, pas de semaine).
 */
export function programWeekAt(startDate: string | null | undefined, dateIso: string): number {
  if (!startDate) return 0;
  const debut = new Date(mondayOf(startDate) + 'T00:00:00');
  const jour = new Date(dateIso + 'T00:00:00');
  const jours = Math.floor((jour.getTime() - debut.getTime()) / 86400000);
  return jours >= 0 ? Math.floor(jours / 7) + 1 : 0;
}

export function isProgramSession(w: RelativeAnchored): boolean {
  return w.scheduled_date == null && w.program_week != null && w.program_day != null;
}

/**
 * Séances d'un programme à afficher pour un athlète à une date donnée :
 * les séances relatives dont (semaine, jour) tombe sur cette date depuis son
 * début, plus — compatibilité lot 5-C — les WOD datés rattachés au programme
 * ce jour-là. Une séance relative sans date de début connue n'est jamais
 * rendue : on ne devine pas où en est l'athlète.
 */
export function programSessionsOn<T extends RelativeAnchored>(
  wods: T[],
  startDate: string | null | undefined,
  dateIso: string,
): T[] {
  const week = programWeekAt(startDate, dateIso);
  const day = isoDayOf(dateIso);
  return wods.filter(w => {
    if (isProgramSession(w)) return week > 0 && w.program_week === week && w.program_day === day;
    return w.scheduled_date === dateIso;
  });
}

export interface ProgramWeekGroup<T> {
  /** `S3` pour une semaine relative, `2026-04-13` (lundi) pour une semaine datée. */
  key: string;
  week: number | null;
  monday: string | null;
  wods: T[];
}

/**
 * Regroupe le contenu d'un programme par semaine, relatives d'abord
 * (S1, S2…) puis datées (du lundi le plus ancien au plus récent).
 */
export function groupProgramWeeks<T extends RelativeAnchored>(wods: T[]): ProgramWeekGroup<T>[] {
  const relatives = new Map<number, T[]>();
  const dated = new Map<string, T[]>();
  for (const w of wods) {
    if (isProgramSession(w)) {
      const liste = relatives.get(w.program_week as number);
      if (liste) liste.push(w); else relatives.set(w.program_week as number, [w]);
    } else if (w.scheduled_date) {
      const lundi = mondayOf(w.scheduled_date);
      const liste = dated.get(lundi);
      if (liste) liste.push(w); else dated.set(lundi, [w]);
    }
  }
  return [
    ...[...relatives.entries()].sort((a, b) => a[0] - b[0])
      .map(([week, liste]) => ({ key: `S${week}`, week, monday: null, wods: liste })),
    ...[...dated.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monday, liste]) => ({ key: monday, week: null, monday, wods: liste })),
  ];
}

/** Séances d'un groupe-semaine pour un jour (1 = lundi … 7 = dimanche). */
export function weekGroupSessionsOn<T extends RelativeAnchored>(group: ProgramWeekGroup<T>, day: number): T[] {
  if (group.week != null) return group.wods.filter(w => w.program_day === day);
  if (!group.monday) return [];
  const d = new Date(group.monday + 'T00:00:00');
  d.setDate(d.getDate() + day - 1);
  const iso = d.toISOString().slice(0, 10);
  return group.wods.filter(w => w.scheduled_date === iso);
}

/**
 * Non-fusion, côté lecture : ce qu'un Whiteboard de box affiche pour une date
 * (`scheduled_date = date`) ne contient jamais une séance relative, et ce
 * qu'un programme affiche en relatif ne contient jamais un WOD daté.
 */
export function whiteboardWodsOn<T extends RelativeAnchored>(wods: T[], dateIso: string): T[] {
  return wods.filter(w => w.scheduled_date === dateIso);
}
