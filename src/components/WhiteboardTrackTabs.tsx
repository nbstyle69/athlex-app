import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppTheme } from '../theme/palette';
import { TrackTab } from '../utils/whiteboardTracks';
import { AxChip } from './ax';
import { axSpacing } from '../theme/axTokens';

interface Props {
  /** Onglets à rendre (`visibleTabs`) ; vide = pas de barre. */
  tabs: TrackTab[];
  value: TrackTab | null;
  onChange: (tab: TrackTab) => void;
  /** Conservé pour les appelants : les pastilles lisent le thème elles-mêmes. */
  theme?: AppTheme;
}

/**
 * Barre d'onglets de piste du Whiteboard — filtre global de la partie basse de
 * l'écran, posé au-dessus du sélecteur de jours : on choisit sa piste avant son
 * jour, comme on choisit sa semaine.
 *
 * R9a : chaque onglet est une `AxChip` (choisi = aplat d'accent). Le libellé
 * garde la même graisse choisi ou non : l'onglet ne change pas de taille.
 * `flexShrink: 0` garde la barre à sa hauteur de contenu (texte rogné sur
 * iPhone en 1.0.57 quand la colonne de l'écran la comprimait). Le défilement
 * horizontal sert les petits écrans : cinq onglets ne tiennent pas sous 360 px.
 */
export default function WhiteboardTrackTabs({ tabs, value, onChange }: Props) {
  const { t } = useTranslation();
  if (tabs.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.outer}
      contentContainerStyle={styles.content}
      testID="whiteboard-track-tabs"
    >
      {tabs.map((tab) => (
        <AxChip
          key={tab}
          label={t(`whiteboard.track.${tab}`)}
          selected={tab === value}
          onPress={() => onChange(tab)}
          accessibilityRole="tab"
          testID={`whiteboard-track-${tab}`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexShrink: 0 — sans lui, le style de base du ScrollView (flexShrink: 1) laisse
  // la colonne écraser la barre, et le texte est rogné par le bas.
  outer: { flexGrow: 0, flexShrink: 0, marginVertical: axSpacing.md },
  // Marge verticale : la zone tactile des pastilles (hitSlop) déborde de 2 en haut et en bas.
  content: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, paddingHorizontal: axSpacing.lg, paddingVertical: 2 },
});
