import type { ThemeMode } from './palette';
import type { AxColors } from './axTokens';
import { hue } from './hues';

/** Mêmes clés que src/utils/wodTypeLabel.ts : la couleur suit le libellé. */
const WOD_TYPE_HUES: Record<string, 'yellow' | 'blue' | 'violet' | 'positive'> = {
  'for-time': 'yellow',
  for_time: 'yellow',
  fortime: 'yellow',
  amrap: 'blue',
  emom: 'violet',
  tabata: 'positive',
};

/** Couleur de l'étiquette d'un type de séance (texte et filet) ; type inconnu ou personnalisé en atténué. */
export function wodTypeColor(type: string | null | undefined, mode: ThemeMode, ax: AxColors): string {
  const key = type?.trim().toLowerCase() ?? '';
  if (key === 'strength') return ax.accentText;
  const name = WOD_TYPE_HUES[key];
  return name ? hue(mode, name) : ax.textMuted;
}
