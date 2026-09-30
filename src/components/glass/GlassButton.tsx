import React from 'react';
import { TouchableOpacity, View, Text, ViewStyle, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  onPress?: () => void;
  children?: React.ReactNode;
  label?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'emerald';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  radius?: number;
  paddingV?: number;
}

/** Bouton à fond uni `ax.surface` ; la variante « emerald » porte l'accent en texte. */
export default function GlassButton({
  onPress, children, label, icon, variant = 'default', style, textStyle, disabled,
  radius = 18, paddingV = 13,
}: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const tinted = variant === 'emerald';
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          borderRadius: radius,
          backgroundColor: c.surface,
          borderColor: tinted ? c.accentText : c.border,
          borderWidth: 1,
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.content, { paddingVertical: paddingV }]}>
        {icon}
        {label && <Text style={[styles.label, { color: tinted ? c.accentText : c.text }, textStyle]}>{label}</Text>}
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 16,
  },
  label: { fontSize: 14, fontWeight: '700' },
});
