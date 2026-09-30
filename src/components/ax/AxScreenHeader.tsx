import React, { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axAccentSafeLineHeight, axSpacing, axTypography } from '../../theme/axTokens';

export const AX_SCREEN_HEADER = {
  height: 44,
  sideMargin: axSpacing.xl,
  chevron: 16,
  minTouch: 44,
} as const;

interface Props {
  title: string;
  /** Action de retour propre à l'écran ; par défaut navigation.goBack(). */
  onBack?: () => void;
  /** Action existante de l'écran, à droite (AxIconButton…). */
  right?: ReactNode;
  /** Contenu existant de l'en-tête, posé sous la rangée (sous-titre…). */
  children?: ReactNode;
  /** false quand l'écran est déjà dans une SafeAreaView. */
  safeArea?: boolean;
  testID?: string;
}

/** En-tête des écrans secondaires : « ‹ Retour », titre centré, action optionnelle. */
export function AxScreenHeader({ title, onBack, right, children, safeArea = true, testID = 'ax-screen-header' }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Les deux côtés prennent la largeur du CONTENU le plus large (Retour ou
  // action) pour que le titre soit centré sur l'écran ; la colonne elle-même
  // n'est pas mesurée, sa largeur étirée réserverait la place du titre.
  const [side, setSide] = useState(0);
  const measure = useCallback((e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    setSide((prev) => (w > prev ? w : prev));
  }, []);
  const back = onBack ?? (() => navigation.goBack());
  const label = t('common.back');

  return (
    <View testID={testID} style={[styles.wrap, { paddingTop: safeArea ? insets.top : 0 }, children ? styles.withChildren : null]}>
      <View style={styles.row}>
        <View testID={`${testID}-left`} style={[styles.side, styles.left, { minWidth: side }]}>
          <View testID={`${testID}-left-content`} onLayout={measure}>
            <Pressable
              testID={`${testID}-back`}
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={axSpacing.sm}
              style={styles.back}
            >
              <ChevronLeft size={AX_SCREEN_HEADER.chevron} color={c.textMuted} strokeWidth={2} />
              <Text style={[axTypography.label, { color: c.textMuted }]}>{label}</Text>
            </Pressable>
          </View>
        </View>
        <View testID={`${testID}-title-box`} style={styles.titleBox}>
          <Text
            testID={`${testID}-title`}
            accessibilityRole="header"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[axTypography.titleM, styles.title, { lineHeight: axAccentSafeLineHeight.titleM, color: c.text }]}
          >
            {title}
          </Text>
        </View>
        <View testID={`${testID}-right`} style={[styles.side, styles.right, { minWidth: side }]}>
          {right ? (
            <View testID={`${testID}-right-content`} style={styles.rightContent} onLayout={measure}>
              {right}
            </View>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: AX_SCREEN_HEADER.sideMargin },
  withChildren: { paddingBottom: axSpacing.md, gap: axSpacing.xs },
  row: { height: AX_SCREEN_HEADER.height, flexDirection: 'row', alignItems: 'center' },
  // Les côtés gardent la largeur de leur contenu : le titre ne peut ni les
  // recouvrir ni leur prendre de place, il occupe tout l'espace restant.
  side: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', flexDirection: 'row', alignItems: 'center' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end', gap: axSpacing.xs },
  rightContent: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
  back: {
    minWidth: AX_SCREEN_HEADER.minTouch,
    minHeight: AX_SCREEN_HEADER.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: axSpacing.xs,
  },
  titleBox: { flex: 1, minWidth: 0, marginHorizontal: axSpacing.sm, overflow: 'hidden' },
  // Largeur fixée par la boîte, pas par la mesure du texte : un titre court
  // n'est jamais coupé tant qu'il tient entre les deux côtés.
  title: { textAlign: 'center' },
});
