/**
 * Classement de la compétition classique : calculé par la base seule
 * (`tournament_classique_standings`, `tournament_classique_wod_ranks`,
 * migration 20270116 — barème CF Games, tie-break puis rang partagé). L'app ne
 * classe plus rien et n'écrit plus `tournament_participants.score` : elle ordonne
 * et affiche ce que la base rend. Un score rejeté, en attente ou illisible n'a
 * pas de rang : il n'apparaît pas.
 */
import { supabase } from '../lib/supabase';

export interface LigneClassement { athlete_id: string; points: number; final_rank: number }
export interface RangWod { athlete_id: string; tournament_wod_id: string; wod_rank: number; points: number }

export async function chargerClassement(tournamentId: string): Promise<{ lignes: LigneClassement[]; rangs: RangWod[] }> {
  const [{ data: lignes, error: e1 }, { data: rangs, error: e2 }] = await Promise.all([
    supabase.rpc('tournament_classique_standings', { p_tournament_id: tournamentId }),
    supabase.rpc('tournament_classique_wod_ranks', { p_tournament_id: tournamentId }),
  ]);
  if (e1 || e2) throw e1 ?? e2;
  return { lignes: (lignes ?? []) as LigneClassement[], rangs: (rangs ?? []) as RangWod[] };
}

/** Classement général : rang final et points de la base ; un inscrit absent du calcul a 0 point. */
export function classementGeneral<P extends { athlete_id: string }>(participants: P[], lignes: LigneClassement[]) {
  const parAthlete = new Map(lignes.map(l => [l.athlete_id, l]));
  // À 0 point, la base donne le rang qui suit tous ceux qui ont marqué.
  const rangAZero = lignes.filter(l => l.points > 0).length + 1;
  return participants
    .map(p => {
      const l = parAthlete.get(p.athlete_id);
      return { ...p, points: l?.points ?? 0, rang: l?.final_rank ?? rangAZero };
    })
    .sort((a, b) => a.rang - b.rang || a.athlete_id.localeCompare(b.athlete_id));
}

/** Classement d'un WOD : seuls les scores classés par la base, dans l'ordre de leur rang. */
export function classementWod<S extends { athlete_id: string; tournament_wod_id: string }>(
  scores: S[], rangs: RangWod[], wodId: string,
) {
  const parAthlete = new Map(rangs.filter(r => r.tournament_wod_id === wodId).map(r => [r.athlete_id, r]));
  return scores
    .filter(s => s.tournament_wod_id === wodId && parAthlete.has(s.athlete_id))
    .map(s => ({ ...s, rang: parAthlete.get(s.athlete_id)!.wod_rank, points: parAthlete.get(s.athlete_id)!.points }))
    .sort((a, b) => a.rang - b.rang || a.athlete_id.localeCompare(b.athlete_id));
}
