import React from 'react';
import { Keyboard, Platform } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Barre d'onglets flottante de l'athlète (composant Figma « Barre d'onglets »). */
export const TAB_BAR = {
  height: 64,
  radius: 24,
  sideMargin: 20,
  bottomGap: 12,
  paddingVertical: 10,
  paddingHorizontal: 14,
  iconSize: 20,
  dotSize: 4,
  itemGap: 4,
  minTouch: 44,
  glassOpacity: 0.8,
} as const;

/** Espace laissé sous le dernier élément défilant, au-dessus de la barre. */
export const TAB_BAR_SCROLL_GAP = 16;

/** Hauteur occupée en bas de l'écran par la barre flottante : la barre, son décalage et l'inset. */
export function tabBarFootprint(insetBottom: number): number {
  return TAB_BAR.height + TAB_BAR.bottomGap + insetBottom;
}

/** Marge basse du contenu défilant d'un écran, selon la hauteur de barre publiée par le navigateur. */
export function tabBarScrollSpace(barHeight: number | undefined, insetBottom: number): number {
  return (barHeight ?? insetBottom) + TAB_BAR_SCROLL_GAP;
}

/** Marge basse à donner au contenu défilant pour qu'aucun élément ne passe sous la barre d'onglets. */
export function useTabBarScrollSpace(): number {
  const insets = useSafeAreaInsets();
  const barHeight = React.useContext(BottomTabBarHeightContext);
  return tabBarScrollSpace(barHeight, insets.bottom);
}

/** Vrai tant que le clavier est ouvert. */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, () => setShown(true)),
      Keyboard.addListener(hide, () => setShown(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return shown;
}

/** Décalage d'un élément fixé en bas d'écran pour rester au-dessus de la barre (0 hors onglets ou clavier ouvert). */
export function useTabBarFootprint(): number {
  const barHeight = React.useContext(BottomTabBarHeightContext);
  const keyboardShown = useKeyboardShown();
  return keyboardShown ? 0 : barHeight ?? 0;
}
