import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export const REC_DOT = { size: 12, color: '#EF4444', minOpacity: 0.25, halfPeriodMs: 900 } as const;

/** Point rouge d'enregistrement : clignotement doux, immobile quand « réduire les animations » est activé. */
export function RecBlinkDot({ testID = 'timer-rec-blink' }: { testID?: string }) {
  const { t } = useTranslation();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduceMotion(v); }).catch(() => { if (alive) setReduceMotion(false); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion !== false) {
      opacity.setValue(1);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: REC_DOT.minOpacity, duration: REC_DOT.halfPeriodMs, easing: ease, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: REC_DOT.halfPeriodMs, easing: ease, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); opacity.setValue(1); };
  }, [reduceMotion, opacity]);

  return (
    <Animated.View
      testID={testID}
      accessibilityLabel={t('timer.run.recording')}
      style={[styles.dot, { opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: REC_DOT.size, height: REC_DOT.size, borderRadius: REC_DOT.size / 2, backgroundColor: REC_DOT.color },
});
