import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing } from '../../theme/axTokens';
import { AxGlass } from './AxGlass';

export type AxCardVariant = 'standard' | 'featured' | 'glass';

interface Props {
  variant?: AxCardVariant;
  children?: React.ReactNode;
  /** Rend la carte entière cliquable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Ajustements de mise en page (padding, écart, taille), posés après ceux de la variante. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FEATURED_RULE_HEIGHT = 3;

const PADDING: Record<AxCardVariant, ViewStyle> = {
  standard: { padding: axSpacing.lg, gap: 10 },
  featured: { paddingTop: 18, paddingRight: 18, paddingBottom: axSpacing.lg, paddingLeft: 18 },
  glass: { padding: axSpacing.lg },
};

export function AxCard({ variant = 'standard', children, onPress, accessibilityLabel, style: override, testID }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const style = [
    styles.base,
    { borderColor: c.border },
    variant === 'glass' ? null : { backgroundColor: c.surface },
    PADDING[variant],
    override,
  ];
  const content = (
    <>
      {variant === 'glass' && <AxGlass color={c.surface} opacity={0.8} radius={axRadius.card} />}
      {children}
      {variant === 'featured' && (
        <View testID="ax-card-rule" pointerEvents="none" style={[styles.rule, { backgroundColor: c.accent }]} />
      )}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={style}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: axRadius.card,
    borderWidth: 1,
    // Le filet de la vedette suit les coins du bas.
    overflow: 'hidden',
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FEATURED_RULE_HEIGHT,
  },
});
