import { supabase } from '../lib/supabase';
import { isMonday, RestDay, toLocalIso } from '../utils/programSchedule';

/**
 * Le contenu d'un programme n'a plus de table à lui : c'est un WOD de box
 * (`box_wods`) rattaché au programme par `wod_program_access`. Une seule source
 * canonique, donc un seul chemin d'accès — c'est ce lien qui décide qui voit
 * quoi (policies `member_see_published` et `program_member_see_wods`), et non
 * plus un filtre d'écran.
 *
 * Deux ancrages, exclusifs (CHECK `box_wods_ancrage_check`, migration
 * 20261207) :
 * - daté (`scheduled_date`) : un WOD du Whiteboard de la box restreint à un
 *   programme ; il reste sur le Whiteboard ;
 * - relatif (`program_week` × `program_day`, `scheduled_date` null) : une
 *   séance écrite depuis la page « Séances » du programme. Elle n'entre dans
 *   aucune lecture datée, donc jamais sur un Whiteboard ; l'athlète la reçoit
 *   à la date que donne SA date de début (`utils/programSchedule`).
 */

export type ProgramWod = {
  id: string;
  title: string;
  description: string | null;
  wod_type: string | null;
  time_cap_seconds: number | null;
  notes: string | null;
  scheduled_date: string | null;
  program_week: number | null;
  program_day: number | null;
  sort_order: number;
  is_published: boolean | null;
};

const COLONNES =
  'id, title, description, wod_type, time_cap_seconds, notes, scheduled_date, program_week, program_day, sort_order, is_published';

export type ProgramWodInput = {
  title: string;
  description: string;
  wod_type: string;
  time_cap_seconds: number | null;
  notes: string | null;
  sort_order?: number;
} & (
  | { scheduled_date: string; program_week?: null; program_day?: null }
  | { scheduled_date: null; program_week: number; program_day: number }
);

function ancrage(input: ProgramWodInput) {
  return input.scheduled_date
    ? { scheduled_date: input.scheduled_date, program_week: null, program_day: null }
    : { scheduled_date: null, program_week: input.program_week, program_day: input.program_day };
}

/**
 * Les jours marqués « Repos » par le coach (`program_rest_days`). Un jour sans
 * séance et sans cette marque est un jour vide, pas un repos.
 */
export async function listProgramRestDays(programId: string): Promise<RestDay[]> {
  const { data, error } = await supabase
    .from('program_rest_days')
    .select('program_week, program_day')
    .eq('program_id', programId);
  if (error) throw error;
  return (data ?? []) as RestDay[];
}

/** Idem pour plusieurs programmes, indexés par programme. */
export async function listProgramRestDaysByProgram(
  programIds: string[],
): Promise<Record<string, RestDay[]>> {
  if (programIds.length === 0) return {};
  const { data, error } = await supabase
    .from('program_rest_days')
    .select('program_id, program_week, program_day')
    .in('program_id', programIds);
  if (error) throw error;
  const out: Record<string, RestDay[]> = {};
  for (const r of data ?? []) {
    (out[r.program_id] ??= []).push({ program_week: r.program_week, program_day: r.program_day });
  }
  return out;
}

/**
 * L'athlète choisit (ou change) son lundi de début. Le serveur exige un lundi
 * et refuse dès qu'une séance du programme a été scorée : ce garde-fou vit en
 * base (`set_program_start_date`), l'écran ne fait que le refléter.
 */
export async function setProgramStartDate(programId: string, mondayIso: string): Promise<string> {
  if (!isMonday(mondayIso)) throw new Error('La date de début doit être un lundi');
  const { data, error } = await supabase.rpc('set_program_start_date', {
    p_program_id: programId,
    p_start_date: mondayIso,
  });
  if (error) throw error;
  return data as string;
}

/** Les WOD d'un programme, du plus ancien au plus récent. */
export async function listProgramWods(programId: string): Promise<ProgramWod[]> {
  const { data: liens, error: erreurLiens } = await supabase
    .from('wod_program_access')
    .select('wod_id')
    .eq('program_id', programId);
  if (erreurLiens) throw erreurLiens;

  const ids = (liens ?? []).map(l => l.wod_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('box_wods')
    .select(COLONNES)
    .in('id', ids)
    .order('program_week', { ascending: true, nullsFirst: false })
    .order('program_day', { ascending: true, nullsFirst: false })
    .order('scheduled_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProgramWod[];
}

/** Les WOD de plusieurs programmes d'un coup, indexés par programme. */
export async function listProgramWodsByProgram(
  programIds: string[],
): Promise<Record<string, ProgramWod[]>> {
  if (programIds.length === 0) return {};

  const { data: liens, error: erreurLiens } = await supabase
    .from('wod_program_access')
    .select('wod_id, program_id')
    .in('program_id', programIds);
  if (erreurLiens) throw erreurLiens;

  const ids = [...new Set((liens ?? []).map(l => l.wod_id))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('box_wods')
    .select(COLONNES)
    .in('id', ids)
    .order('program_week', { ascending: true, nullsFirst: false })
    .order('program_day', { ascending: true, nullsFirst: false })
    .order('scheduled_date', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const parId = new Map((data ?? []).map(w => [w.id, w as ProgramWod]));
  const resultat: Record<string, ProgramWod[]> = {};
  for (const lien of liens ?? []) {
    const wod = parId.get(lien.wod_id);
    // Un lien dont le WOD n'est pas revenu = refus de lecture, pas une erreur :
    // c'est exactement le cas d'un rattachement visible sans le contenu.
    if (!wod) continue;
    (resultat[lien.program_id] ??= []).push(wod);
  }
  return resultat;
}

/**
 * Crée le WOD ET son rattachement. Si le rattachement échoue, le WOD est
 * retiré : un WOD de box publié sans lien de programme serait visible de toute
 * la box, donc du contenu payant offert par accident.
 */
export async function createProgramWod(
  programId: string,
  boxId: string,
  input: ProgramWodInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('box_wods')
    .insert({
      box_id: boxId,
      title: input.title,
      description: input.description,
      wod_type: input.wod_type,
      time_cap_seconds: input.time_cap_seconds,
      notes: input.notes,
      ...ancrage(input),
      sort_order: input.sort_order ?? 0,
      is_published: true,
    })
    .select('id')
    .single();
  if (error) throw error;

  const wodId = data.id;
  const { error: erreurLien } = await supabase
    .from('wod_program_access')
    .insert({ wod_id: wodId, program_id: programId });
  if (erreurLien) {
    await supabase.from('box_wods').delete().eq('id', wodId);
    throw erreurLien;
  }
  return wodId;
}

export async function updateProgramWod(
  wodId: string,
  input: ProgramWodInput,
): Promise<void> {
  const { error } = await supabase
    .from('box_wods')
    .update({
      title: input.title,
      description: input.description,
      wod_type: input.wod_type,
      time_cap_seconds: input.time_cap_seconds,
      notes: input.notes,
      ...ancrage(input),
      ...(input.sort_order != null ? { sort_order: input.sort_order } : {}),
    })
    .eq('id', wodId);
  if (error) throw error;
}

/** Le rattachement part avec le WOD (FK ON DELETE CASCADE). */
export async function deleteProgramWod(wodId: string): Promise<void> {
  const { error } = await supabase.from('box_wods').delete().eq('id', wodId);
  if (error) throw error;
}

/** Recopie une semaine de contenu sur la semaine suivante. */
export async function duplicateProgramWeek(
  programId: string,
  boxId: string,
  wods: ProgramWod[],
): Promise<number> {
  let copies = 0;
  for (const w of wods) {
    const cible = semaineSuivante(w);
    if (!cible) continue;
    await createProgramWod(programId, boxId, {
      title: w.title,
      description: w.description ?? '',
      wod_type: w.wod_type ?? 'custom',
      time_cap_seconds: w.time_cap_seconds,
      notes: w.notes,
      sort_order: w.sort_order,
      ...cible,
    });
    copies += 1;
  }
  return copies;
}

/** L'ancrage de la copie : +7 jours pour un WOD daté, semaine +1 pour une séance relative. */
export function semaineSuivante(
  w: Pick<ProgramWod, 'scheduled_date' | 'program_week' | 'program_day'>,
):
  | { scheduled_date: string; program_week: null; program_day: null }
  | { scheduled_date: null; program_week: number; program_day: number }
  | null {
  if (w.scheduled_date) {
    const cible = new Date(w.scheduled_date + 'T00:00:00');
    cible.setDate(cible.getDate() + 7);
    return { scheduled_date: toLocalIso(cible), program_week: null, program_day: null };
  }
  if (w.program_week != null && w.program_day != null) {
    return { scheduled_date: null, program_week: w.program_week + 1, program_day: w.program_day };
  }
  return null;
}
