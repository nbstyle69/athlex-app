import type { TFunction } from 'i18next';

// WOD des tournois à tableau (athlex-app #386). La base pose le WOD de chaque
// match à sa création (`wod_id`) ; l'étape d'un WOD se lit avec son tableau
// (`bracket_board`). Même règles que le Manager (lib/tournaments/bracketRounds.ts).

export type WodEtape = { bracket_board: string | null; bracket_stage: number | null };
type MatchWod = { wod_id: string | null; winner_id: string | null; status: string };
type MatchTour1 = { round: number; side: string; participant1_id: string | null; participant2_id: string | null };

/**
 * Nombre de tours du tableau des gagnants, d'après les participants du tour 1
 * (⌈log₂ n⌉, comme la base et le Manager) ; à défaut, le dernier tour créé.
 */
export function toursGagnants(matchs: MatchTour1[]): number {
  const tour1 = matchs.filter(m => m.side === 'winner' && m.round === 1);
  const n = tour1.reduce((acc, m) => acc + (m.participant1_id ? 1 : 0) + (m.participant2_id ? 1 : 0), 0);
  if (n < 2) return Math.max(1, ...matchs.filter(m => m.side === 'winner').map(m => m.round));
  return Math.max(1, Math.ceil(Math.log2(n)));
}

/**
 * Ancien calcul, secours des matchs créés sans WOD (avant #386) : le WOD prévu
 * pour l'étape des gagnants de ce tour. Jamais un WOD des perdants, dont les
 * étapes (1, 2…) se confondraient avec les distances à la finale.
 */
export function wodEtapeGagnants<W extends WodEtape>(wods: W[], tours: number, round: number): W | undefined {
  return wods.find(w => w.bracket_board === 'winner' && w.bracket_stage === tours - round);
}

/**
 * WOD d'une colonne : celui posé sur ses matchs pas encore joués, sinon sur un
 * match joué, sinon le secours (colonnes des gagnants seulement). Une
 * exemption ne compte pas.
 */
export function wodColonne<W extends { id: string }>(matchs: MatchWod[], wods: W[], secours?: W): W | undefined {
  const reels = matchs.filter(m => m.status !== 'bye');
  const id = reels.find(m => !m.winner_id && m.wod_id)?.wod_id ?? reels.find(m => m.wod_id)?.wod_id;
  return id ? wods.find(w => w.id === id) : secours;
}

/**
 * Étape d'un WOD, libellés de `tournament_bracket_stages` (tenus égaux par
 * bracketWods.test.ts). L'élimination simple garde ses libellés d'avant.
 */
export function libelleEtape(wod: WodEtape, doubleElimination: boolean, t: TFunction): string | null {
  const stage = wod.bracket_stage;
  const board = wod.bracket_board ?? (stage != null ? 'winner' : null);
  switch (board) {
    case 'winner': {
      if (stage == null) return null;
      const libelles = t(doubleElimination ? 'tournament.winnersStages' : 'tournament.bracketStages', { returnObjects: true }) as string[];
      return libelles[stage] ?? t(doubleElimination ? 'tournament.winnersStageN' : 'tournament.stageN', { n: stage });
    }
    case 'loser':
      return stage == null ? null : t('tournament.losersRound', { n: stage });
    case 'grand_final':
      return t('tournament.stageGrandFinal');
    case 'grand_final_reset':
      return t('tournament.stageGrandFinalReset');
    case 'third_place':
      return t('tournament.stageThirdPlace');
    default:
      return null;
  }
}
