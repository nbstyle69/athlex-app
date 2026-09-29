import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { hitSlopFor } from './color';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 20;
const INSET = 3;
const TRAVEL = TRACK_WIDTH - THUMB - INSET * 2;
export const AX_SWITCH_DURATION_MS = 150;

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
}

export function AxSwitch({ value, onValueChange, disabled = false, accessibilityLabel, testID = 'ax-switch' }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const x = useRef(new Animated.Value(value ? TRAVEL : 0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: value ? TRAVEL : 0, duration: AX_SWITCH_DURATION_MS, useNativeDriver: true }).start();
  }, [value, x]);

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : () => onValueChange(!value)}
      disabled={disabled}
      hitSlop={hitSlopFor(TRACK_WIDTH, TRACK_HEIGHT)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[styles.track, { backgroundColor: value ? c.accent : c.text }, disabled ? styles.disabled : null]}
    >
      <Animated.View
        testID={`${testID}-thumb`}
        style={[styles.thumb, { backgroundColor: value ? c.onAccent : c.textMuted, transform: [{ translateX: x }] }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2 },
  thumb: { position: 'absolute', top: INSET, left: INSET, width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
  disabled: { opacity: 0.5 },
});
