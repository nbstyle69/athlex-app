/**
 * B4 (lot B) — appui sur un onglet de la barre principale.
 *
 * Avant : chaque onglet portait un `tabPress` qui naviguait vers sa racine,
 * ce qui effaçait la pile à chaque changement d'onglet (Accueil → Calculateur
 * 1RM, puis Ma Box, puis retour : le Calculateur avait disparu). La barre
 * d'onglets conserve nativement la pile de chaque onglet quand on la laisse
 * faire ; la seule règle ajoutée est le double appui sur l'onglet actif, qui
 * ramène à sa racine. Fonction pure : le dernier appui est passé et rendu, pour
 * être testée sans navigateur.
 */
export const DOUBLE_TAP_MS = 350;

export const TAB_ROOTS = {
  Home: 'HomeList',
  Competitions: 'CompetitionList',
  Explorer: 'ExplorerMain',
  Whiteboard: 'WhiteboardMain',
  Reservation: 'ReservationMain',
} as const;

export type TabName = keyof typeof TAB_ROOTS;
export type LastTap = { name: string; at: number } | null;
export type TabPressAction = 'switch' | 'none' | 'root';

export function tabPressAction(last: LastTap, name: string, focused: boolean, now: number): { action: TabPressAction; last: LastTap } {
  if (!focused) return { action: 'switch', last: { name, at: now } };
  if (last && last.name === name && now - last.at <= DOUBLE_TAP_MS) return { action: 'root', last: null };
  return { action: 'none', last: { name, at: now } };
}
