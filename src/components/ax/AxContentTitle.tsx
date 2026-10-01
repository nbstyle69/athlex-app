import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axAccentSafeLineHeight, axTypography } from '../../theme/axTokens';

interface Props {
  title: string;
  testID?: string;
}

/** Nom long et variable (WOD, programme, tournoi, box…) posé en tête du contenu, en entier : il passe à la ligne au besoin. */
export function AxContentTitle({ title, testID = 'ax-content-title' }: Props) {
  const { theme } = useTheme();
  return (
    <Text
      testID={testID}
      style={[axTypography.titleM, styles.title, { lineHeight: axAccentSafeLineHeight.titleM, color: theme.ax.text }]}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { flexShrink: 1 },
});
