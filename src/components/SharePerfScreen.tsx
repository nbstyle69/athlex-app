import React, { useState, type ComponentProps, type RefObject } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { axTypography } from '../theme/axTokens';
import { AxButton, AxIconButton } from './ax';
import ShareScoreCard from './ShareScoreCard';

type CardData = Omit<ComponentProps<typeof ShareScoreCard>, 'width' | 'height' | 'topInset' | 'bottomReserve'>;

const IMAGE_W = 1080;
const IMAGE_H = 1920;
/** Barre d'actions de la maquette : 16 en haut, bouton 46, 10, « Fermer » 20, 30 en bas (+ zone sûre). */
const BAR_H = 16 + 46 + 10 + 20 + 30;
/** Le contenu finit au moins à cette distance au-dessus de la barre. */
const BAR_GAP = 20;

interface Props {
  visible: boolean;
  card: CardData | null;
  viewShotRef: RefObject<ViewShot | null>;
  sharing: boolean;
  onShare: () => void;
  onClose: () => void;
}

/** « Partager ma perf » en plein écran : la carte est l'écran, l'image 1080 × 1920 est capturée en dessous. */
export default function SharePerfScreen({ visible, card, viewShotRef, sharing, onShare, onClose }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.ax;
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [size, setSize] = useState({ width: win.width, height: win.height });
  const [barH, setBarH] = useState(BAR_H + insets.bottom);
  const u = size.width / 390;
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View testID="share-screen" style={{ flex: 1, backgroundColor: c.background, overflow: 'hidden' }}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {card && (
          <>
            {/* Image partagée : composée à 1080 × 1920 sous l'écran (couverte), capturée telle quelle. */}
            <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
              style={{ position: 'absolute', left: 0, top: 0, width: IMAGE_W, height: IMAGE_H,
                transform: [{ scale: size.width / IMAGE_W }], transformOrigin: 'top left' }}>
              <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
                <ShareScoreCard {...card} width={IMAGE_W} height={IMAGE_H} />
              </ViewShot>
            </View>
            {/* `key` : une nouvelle taille d'écran repart du score de base avant de le réduire. */}
            <View style={{ position: 'absolute', left: 0, top: 0 }}>
              <ShareScoreCard key={`${size.width}x${size.height}x${barH}`} {...card} width={size.width} height={size.height}
                topInset={insets.top + 8} bottomReserve={barH + BAR_GAP} />
            </View>
          </>
        )}

        <View style={{ position: 'absolute', top: insets.top + 8, right: 20 * u }}>
          <AxIconButton icon={X} onPress={onClose} accessibilityLabel={t('common.close')} testID="share-close" />
        </View>

        <View testID="share-actions" onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 10,
            paddingTop: 16, paddingHorizontal: 20, paddingBottom: 30 + insets.bottom, backgroundColor: c.background }}>
          {card && (
            <AxButton label={t('sharePerf.share')} icon={Share2} onPress={onShare} loading={sharing} fullWidth testID="share-submit" />
          )}
          <Pressable testID="share-dismiss" onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={[axTypography.label, { color: c.textMuted }]}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
