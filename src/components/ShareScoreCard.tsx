import React, { forwardRef, useState } from 'react';
import { View, Text, Image, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Medal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { splitScoreForDisplay } from '../utils/scoreFormat';
import { useTheme } from '../context/ThemeContext';
import { axFonts } from '../theme/axTokens';
import { AxTag } from './ax';
import UserAvatar from './UserAvatar';

/** Largeur de la maquette : toute la composition est donnée pour 390 et suit la largeur réelle. */
const MAQUETTE_W = 390;
/** Score géant : 170 pour 390, puis réduit pour tenir en largeur (une ligne) et en hauteur. */
const SCORE_SIZE = 170;
const SCORE_MIN = 48;
/** Espace sous l'en-tête (maquette), réductible jusqu'au minimum sur les écrans courts. */
const HEADER_GAP = 68;
const HEADER_GAP_MIN = 24;
/**
 * Le score garde une ligne pleine (un interligne plus court coupe le bas des chiffres sur Android) ;
 * des marges négatives le rapprochent de la date et de l'unité comme dans la maquette (leading 0,9).
 */
const SCORE_PULL_TOP = 0.1;
const SCORE_PULL_BOTTOM = 0.03;
const SCORE_BOX = 1 - SCORE_PULL_TOP - SCORE_PULL_BOTTOM;

interface ShareScoreCardProps {
  wodTitle: string;
  wodType: string | null;
  score: number;
  scoreType: string;
  capped?: boolean | null;
  rx: boolean;
  rank: number | null;
  totalParticipants: number;
  username: string;
  avatarUrl?: string | null;
  boxName: string;
  date: string;
  /** Taille de la composition : 1080 × 1920 pour l'image partagée, l'écran pour la fenêtre. */
  width?: number;
  height?: number;
  /** Haut du contenu (zone sûre sur l'écran). */
  topInset?: number;
  /** Hauteur réservée en bas (barre d'actions + 20 sur l'écran) : le contenu finit au-dessus. */
  bottomReserve?: number;
}

/** Carte « Partager ma perf » : l'image 1080 × 1920 et le fond de l'écran plein ont la même composition. */
const ShareScoreCard = forwardRef<View, ShareScoreCardProps>(
  ({ wodTitle, wodType, score, scoreType, capped, rx, rank, totalParticipants, username, avatarUrl, boxName, date,
    width = 1080, height = 1920, topInset, bottomReserve }, ref) => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const c = theme.ax;
    const u = width / MAQUETTE_W;
    const top = topInset ?? 40 * u;
    const limit = height - (bottomReserve ?? 52 * u);
    // Hauteur retirée pour finir au-dessus de la réserve basse : d'abord l'espace sous l'en-tête, puis le score.
    const [cut, setCut] = useState(0);
    const headerCut = Math.min(cut, (HEADER_GAP - HEADER_GAP_MIN) * u);
    const scoreSize = Math.max(SCORE_MIN * u, SCORE_SIZE * u - (cut - headerCut) / SCORE_BOX);
    const { value, unit } = splitScoreForDisplay(score, scoreType, capped);
    const typeLabel = t(`sharePerf.types.${wodType ?? 'custom'}`, { defaultValue: 'WOD' });
    const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const oswald = (size: number, line: number, spacing = -0.3) =>
      ({ fontFamily: axFonts.oswaldMedium, fontSize: size * u, lineHeight: line * u, letterSpacing: spacing * u });
    const inter = (family: string, size: number, line: number) => ({ fontFamily: family, fontSize: size * u, lineHeight: line * u });

    // 1 px de plus que le dépassement : l'arrondi aux pixels de l'écran ne doit pas faire passer sous la limite.
    function fit(e: LayoutChangeEvent) {
      const { y, height: h } = e.nativeEvent.layout;
      const over = y + h - limit;
      if (over > 0) setCut((c) => c + over + 1);
    }

    const halo = 690 * u;
    return (
      <View ref={ref} collapsable={false}
        style={{ width, height, overflow: 'hidden', backgroundColor: c.background }}>
        <Svg width={halo} height={halo} style={{ position: 'absolute', left: 195 * u - halo / 2, top: 483 * u - halo / 2 }}>
          <Defs>
            <RadialGradient id="shareHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.accent} stopOpacity={0.13} />
              <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#shareHalo)" />
        </Svg>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 * u, backgroundColor: c.accent }} />

        <View onLayout={fit} testID="share-card-content"
          style={{ position: 'absolute', top, left: 24 * u, right: 24 * u }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * u, height: 44 * u }}>
            <View style={{ width: 28 * u, height: 28 * u, borderRadius: 7 * u, borderWidth: u, borderColor: c.border,
              backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Image source={require('../../assets/logo.png')} resizeMode="contain" style={{ width: 22 * u, height: 22 * u }} />
            </View>
            <Text style={[oswald(18, 24, 3.96), { color: c.text }]}>ATHLEX</Text>
          </View>

          <View style={{ marginTop: HEADER_GAP * u - headerCut, gap: 10 * u, alignItems: 'flex-start' }}>
            <AxTag label={typeLabel} scale={u} testID="share-type" />
            <Text testID="share-title" numberOfLines={2} ellipsizeMode="tail"
              style={[oswald(34, 38, -1), { color: c.text, textTransform: 'uppercase', alignSelf: 'stretch' }]}>
              {wodTitle}
            </Text>
            <Text style={[inter(axFonts.interRegular, 13, 18), { color: c.textMuted, textTransform: 'capitalize' }]}>
              {formattedDate}
            </Text>
          </View>

          <View style={{ marginTop: 16 * u, marginLeft: -4 * u }}>
            <Text testID="share-score" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.2}
              style={{ fontFamily: axFonts.oswaldMedium, fontSize: scoreSize, lineHeight: scoreSize,
                marginTop: -SCORE_PULL_TOP * scoreSize, marginBottom: -SCORE_PULL_BOTTOM * scoreSize,
                letterSpacing: -u, color: c.accentText, includeFontPadding: false }}>
              {value}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * u, marginLeft: 4 * u }}>
              {unit ? (
                <Text testID="share-unit" style={[oswald(40, 44, -1), { color: c.text, textTransform: 'uppercase' }]}>{unit}</Text>
              ) : null}
              <AxTag label={rx ? 'RX' : 'SCALED'} scale={u} testID="share-level" />
            </View>
          </View>

          {rank != null && (
            <View testID="share-rank" style={{ marginTop: 32 * u, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
              gap: 12 * u, paddingHorizontal: 16 * u, paddingVertical: 12 * u, borderRadius: 8 * u,
              borderWidth: u, borderColor: c.border, backgroundColor: c.surface }}>
              {rank <= 3 && <Medal testID="share-medal" size={26 * u} color={c.warning} strokeWidth={2} />}
              <View style={{ gap: 2 * u }}>
                <Text style={[inter(axFonts.interMedium, 11, 16), { color: c.textMuted, letterSpacing: 1.98 * u, textTransform: 'uppercase' }]}>
                  {t('sharePerf.ranking')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 * u }}>
                  <Text testID="share-rank-value" style={[oswald(30, 38, -1), { color: c.text }]}>#{rank}</Text>
                  <Text style={[oswald(18, 24), { color: c.textMuted }]}>/ {totalParticipants}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ marginTop: 20 * u, flexDirection: 'row', alignItems: 'center', gap: 12 * u }}>
            <UserAvatar uri={avatarUrl} name={username} size={44 * u} borderWidth={1.5 * u} borderColor={c.accent}
              backgroundColor={c.surface} textColor={c.accentText} fontSize={18 * u} />
            <View style={{ flex: 1, gap: 2 * u }}>
              <Text numberOfLines={1} style={[oswald(18, 24), { color: c.text, textTransform: 'uppercase' }]}>{username}</Text>
              <Text numberOfLines={1} style={[inter(axFonts.interRegular, 12, 16), { color: c.textMuted }]}>
                {boxName} · athlexapp.eu
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

ShareScoreCard.displayName = 'ShareScoreCard';

export default ShareScoreCard;
