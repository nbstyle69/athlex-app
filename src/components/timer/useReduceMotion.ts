import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** « Réduire les animations » du système ; `null` tant que la réponse n'est pas connue (on n'anime pas). */
export function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduceMotion(v); }).catch(() => { if (alive) setReduceMotion(false); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduceMotion;
}
