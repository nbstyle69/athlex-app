import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { hitSlopFor } from './color';

const BOX = 24;

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Libellé cliquable avec la case. */
  label?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function AxCheckbox({ checked, onChange, label, disabled = false, accessibilityLabel, testID = 'ax-checkbox' }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : () => onChange(!checked)}
      disabled={disabled}
      hitSlop={hitSlopFor(label ? 44 : BOX, BOX)}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      style={[styles.row, disabled ? styles.disabled : null]}
    >
      <View
        testID={`${testID}-box`}
        style={[
          styles.box,
          checked
            ? { backgroundColor: c.accent, borderColor: c.accent }
            : { backgroundColor: 'transparent', borderColor: c.fieldBorder },
        ]}
      >
        {checked && <Check testID={`${testID}-check`} size={16} color={c.onAccent} strokeWidth={2.5} />}
      </View>
      {!!label && <Text style={[axTypography.bodySmall, styles.label, { color: c.text }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, alignSelf: 'flex-start' },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: axRadius.control,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flexShrink: 1 },
  disabled: { opacity: 0.5 },
});
