import { BarChart2, Sparkles, Target, Timer } from 'lucide-react-native';
import type { TFunction } from 'i18next';

export type HomeTool = {
  icon: typeof Sparkles;
  label: string;
  desc: string;
  screen: 'Leaderboard' | 'Timer' | 'WodGenerator' | 'OneRMCalculator';
};

/** Cartes de la section « Outils » de l'accueil, dans l'ordre d'affichage. */
export function homeTools(t: TFunction): HomeTool[] {
  return [
    { icon: BarChart2, label: t('home.tools.leaderboard'),  desc: t('home.tools.leaderboardDesc'), screen: 'Leaderboard'     },
    { icon: Timer,     label: t('home.tools.timer'),        desc: 'For Time · AMRAP · EMOM…',      screen: 'Timer'           },
    { icon: Sparkles,  label: t('home.tools.wodGenerator'), desc: 'Functional · Hybrid · hors ligne', screen: 'WodGenerator' },
    { icon: Target,    label: t('home.tools.oneRM'),        desc: t('home.tools.oneRMDesc'),       screen: 'OneRMCalculator' },
  ];
}
