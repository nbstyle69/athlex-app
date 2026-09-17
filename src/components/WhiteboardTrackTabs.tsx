import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppTheme } from '../theme/palette';
import { TrackTab, tabAccent } from '../utils/whiteboardTracks';

interface Props {
  /** Onglets à rendre (`visibleTabs`) ; vide = pas de barre. */
  tabs: TrackTab[];
  value: TrackTab | null;
  onChange: (tab: TrackTab) => void;
  theme: AppTheme;
}

/**
 * Barre d'onglets de piste du Whiteboard — filtre global de la partie basse de
 * l'écran, posé au-dessus du sélecteur de jours : on choisit sa piste avant son
 * jour, comme on choisit sa semaine.
 *
 * La puce est celle du générateur de WOD (même rayon, même encre, même fond
 * d'accent à 25) : seule la teinte d'accent change, et elle vient de la piste.
 * La hauteur de touche est alignée sur les cellules de `WeekDayPicker`, que la
 * barre surmonte. Le défilement horizontal sert les petits écrans : cinq
 * onglets ne tiennent pas sous 360 px.
 */
export default function WhiteboardTrackTabs({ tabs, value, onChange, theme }: Props) {
  const { t } = useTranslation();
  if (tabs.length === 0) return null;
  const S = createStyles(theme);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={S.outer}
      contentContainerStyle={S.content}
      testID="whiteboard-track-tabs"
    >
      {tabs.map((tab) => {
        const selected = tab === value;
        const accent = tabAccent(theme, tab);
        return (
          <TouchableOpacity
            key={tab}
            style={[S.chip, selected && { backgroundColor: `${accent}25`, borderColor: accent }]}
            onPress={() => onChange(tab)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`whiteboard-track-${tab}`}
          >
            <Text style={[S.chipText, selected && S.chipTextSelected]}>{t(`whiteboard.track.${tab}`)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    outer: { flexGrow: 0, marginVertical: 12 },
    content: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    chip: {
      minHeight: 44, justifyContent: 'center',
      paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
    },
    chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    chipTextSelected: { fontWeight: '800' },
  });
}
