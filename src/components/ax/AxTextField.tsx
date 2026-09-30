import React, { useState } from 'react';
import { KeyboardTypeOptions, StyleSheet, TextInputProps, Text, TextInput, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  /** Message d'erreur affiché sous le champ ; sa présence passe la bordure en danger. */
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  accessibilityLabel?: string;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  onBlur?: () => void;
  /** Champ compact centré (grilles de séries). */
  compact?: boolean;
  maxLength?: number;
  /** Hauteur minimale de la zone de saisie (champ multiligne). */
  minInputHeight?: number;
  /** Hauteur maximale de la zone de saisie : au-delà, le texte défile dans le champ. */
  maxInputHeight?: number;
  autoFocus?: boolean;
  /** Accès au champ natif (passer le focus au champ suivant). */
  inputRef?: React.Ref<TextInput>;
  testID?: string;
}

export function AxTextField({
  value, onChangeText, placeholder, icon: Icon, error, keyboardType, secureTextEntry, multiline,
  accessibilityLabel, autoCapitalize, onBlur, compact = false, maxLength, minInputHeight, maxInputHeight, autoFocus, inputRef, testID = 'ax-text-field',
}: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.danger : focused ? c.accentText : c.fieldBorder;

  return (
    <View style={styles.wrapper}>
      <View testID={`${testID}-box`} style={[styles.box, compact ? styles.compact : null, { backgroundColor: c.field, borderColor }]}>
        <TextInput
          ref={inputRef}
          testID={testID}
          autoFocus={autoFocus}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          accessibilityHint={error}
          style={[axTypography.body, styles.input, { color: c.text }, multiline ? styles.multiline : null, compact ? styles.compactInput : null,
            minInputHeight != null || maxInputHeight != null ? { minHeight: minInputHeight, maxHeight: maxInputHeight } : null]}
        />
        {Icon && <Icon size={18} color={c.textMuted} strokeWidth={2} />}
      </View>
      {!!error && (
        <Text testID={`${testID}-error`} style={[axTypography.caption, { color: c.danger }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: axSpacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: axSpacing.sm,
    padding: 14,
    borderWidth: 1,
    borderRadius: axRadius.control,
  },
  input: { flex: 1, padding: 0 },
  multiline: { textAlignVertical: 'top' },
  compact: { paddingVertical: axSpacing.sm, paddingHorizontal: axSpacing.sm },
  compactInput: { textAlign: 'center' },
});
