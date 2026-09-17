/**
 * Onglets de piste du Whiteboard (lot « pistes / onglets », migration 20261223).
 *
 * Depuis 20261222 une box peut avoir trois pistes actives et la génération les
 * pose toutes le même jour : jusqu'à huit cartes empilées. Les trois
 * programmations restent visibles de tous — on ne cible personne — et l'athlète
 * bascule de l'une à l'autre par onglets.
 *
 * Logique pure, sans React Native : c'est elle que testent les cas du brief
 * (§1.4), pas le rendu.
 */
import { hue, HueName } from '../theme/hues';
import type { AppTheme } from '../theme/palette';

export type WhiteboardTrack = 'functional' | 'hybrid' | 'musculation';
export type TrackTab = WhiteboardTrack | 'box' | 'all';

export const WHITEBOARD_TRACKS: WhiteboardTrack[] = ['functional', 'hybrid', 'musculation'];

/**
 * Teinte de l'onglet actif : celle de la discipline dans le générateur de WOD.
 * On passe par `HUES` et non par les constantes de l'écran générateur
 * (`HYBRID_ORANGE`, `MUSCU_BLUE`) parce que celles-ci sont les valeurs du thème
 * sombre : `#F97316` tombe sous le seuil de lecture sur une carte claire.
 * En sombre, `hue()` rend exactement ces teintes-là.
 */
const TRACK_HUE: Record<WhiteboardTrack, HueName> = {
  functional: 'emerald',
  hybrid: 'orange',
  musculation: 'blue',
};

/** « Box » et « Tout » ne portent pas de piste : ils prennent l'encre neutre. */
export function tabAccent(theme: AppTheme, tab: TrackTab): string {
  return tab === 'box' || tab === 'all' ? theme.text : hue(theme.mode, TRACK_HUE[tab]);
}

/** Clé locale du dernier onglet choisi, par box (purgée à la déconnexion). */
export function whiteboardTrackKey(boxId: string): string {
  return `@athlex:whiteboardTrack:${boxId}`;
}

/**
 * Onglets à rendre pour la semaine affichée, dans l'ordre du brief.
 *
 * Seules les pistes qui ont une carte cette semaine apparaissent ; « Box »
 * n'apparaît que s'il existe une carte de coach. Aucune piste sur la semaine
 * (box sans programmation auto, ou colonne `track` pas encore en base) → aucun
 * onglet : la barre disparaît et l'écran se comporte comme avant.
 */
export function visibleTabs(tracks: (string | null | undefined)[]): TrackTab[] {
  const present = new Set(tracks.map((t) => t ?? null));
  const pistes = WHITEBOARD_TRACKS.filter((t) => present.has(t));
  if (pistes.length === 0) return [];
  const tabs: TrackTab[] = [...pistes];
  if (present.has(null)) tabs.push('box');
  tabs.push('all');
  return tabs;
}

/**
 * Cartes d'un onglet. « Box » = les cartes sans piste, c'est-à-dire saisies par
 * un coach — `track` absent (colonne pas encore en base) compte comme sans
 * piste, jamais comme une piste inconnue.
 */
export function filterByTab<T extends { track?: string | null }>(wods: T[], tab: TrackTab): T[] {
  if (tab === 'all') return wods;
  if (tab === 'box') return wods.filter((w) => !w.track);
  return wods.filter((w) => w.track === tab);
}

/**
 * Onglet effectif : le choix mémorisé de l'athlète s'il a du contenu cette
 * semaine, sinon Functional, sinon « Tout ». `null` quand il n'y a pas de barre.
 */
export function resolveTab(stored: string | null | undefined, tabs: TrackTab[]): TrackTab | null {
  if (tabs.length === 0) return null;
  if (stored && (tabs as string[]).includes(stored)) return stored as TrackTab;
  if (tabs.includes('functional')) return 'functional';
  return 'all';
}
