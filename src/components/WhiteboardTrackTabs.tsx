import React from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
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
 *
 * Deux défauts corrigés (1.0.57, iPhone) :
 *   * texte rogné en bas, d'autant plus que la piste choisie montre de contenu.
 *     Un `ScrollView` porte `flexShrink: 1` dans son style de base ; posée dans
 *     la colonne à hauteur fixe de l'écran, la barre était comprimée dès que le
 *     corps débordait — et « Tout » déborde le plus. `flexShrink: 0` la garde à
 *     sa hauteur de contenu, qui suit la taille de texte du téléphone ;
 *   * l'onglet choisi s'élargissait (graisse 800 contre 600) et poussait les
 *     autres. Chaque onglet réserve la largeur de son libellé en gras par une
 *     copie invisible, sur laquelle le libellé visible est posé : même largeur,
 *     même hauteur, choisi ou non.
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
            accessibilityLabel={t(`whiteboard.track.${tab}`)}
            accessibilityState={{ selected }}
            testID={`whiteboard-track-${tab}`}
          >
            <View>
              {/* Réserve la largeur du libellé en gras : l'onglet ne change pas de taille quand on le choisit. */}
              <Text
                style={[S.chipText, S.chipTextSelected, S.reserve]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                testID={`whiteboard-track-${tab}-reserve`}
              >
                {t(`whiteboard.track.${tab}`)}
              </Text>
              <Text style={[S.chipText, selected && S.chipTextSelected, S.label]}>{t(`whiteboard.track.${tab}`)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    // flexShrink: 0 — sans lui, le style de base du ScrollView (flexShrink: 1) laisse
    // la colonne de l'écran écraser la barre, et le texte est rogné par le bas.
    outer: { flexGrow: 0, flexShrink: 0, marginVertical: 12 },
    content: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    chip: {
      minHeight: 44, justifyContent: 'center',
      paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
    },
    chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    chipTextSelected: { fontWeight: '800' },
    reserve: { opacity: 0 },
    // Posé sur la réserve, même boîte : centré en largeur, même ligne en hauteur.
    label: { position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center' },
  });
}
