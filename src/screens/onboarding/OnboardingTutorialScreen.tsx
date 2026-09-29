import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity,
  Animated, ViewToken, Image, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Dumbbell, Clock, Trophy, Building2, Camera, Hash, ArrowRight, Zap, Rocket } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { AxButton } from '../../components/ax/AxButton';
import { AxTextField } from '../../components/ax/AxTextField';
import { withAlpha } from '../../components/ax/color';
import { axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { useAuth } from '../../context/AuthContext';
import { awardLevelBadge } from '../../services/gamification';
import { trackOnboardingStep, trackOnboardingComplete, trackOnboardingBoxJoin, trackOnboardingSkipBox } from '../../lib/analytics';
import { captureError } from '../../lib/sentry';
import { markOnboardingCompleted } from '../../lib/onboardingStatus';
import GlassBackground from '../../components/glass/GlassBackground';

const { width, height } = Dimensions.get('window');

export { ONBOARDING_KEY } from '../../lib/onboardingStatus';

interface Slide {
  id: string;
  key: 'welcome' | 'wodTimer' | 'compElo' | 'box' | 'badge';
  icon: 'logo' | 'wod' | 'comp' | 'box' | 'badge';
  color: string;
}

const SLIDES: Slide[] = [
  { id: '1', key: 'welcome',  icon: 'logo',  color: '#059669' },
  { id: '2', key: 'wodTimer', icon: 'wod',   color: '#3B82F6' },
  { id: '3', key: 'compElo',  icon: 'comp',  color: '#F59E0B' },
  { id: '4', key: 'box',      icon: 'box',   color: '#8B5CF6' },
  { id: '5', key: 'badge',    icon: 'badge', color: '#10b981' },
];

// ── Confetti Particle ──────────────────────────────────────

const CONFETTI_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#fff'];
const PARTICLE_COUNT = 40;

function ConfettiOverlay({ active }: { active: boolean }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 120,
    })),
  ).current;

  useEffect(() => {
    if (!active) return;
    const anims = particles.map((p, i) => {
      p.x.setValue(Math.random() * width);
      p.y.setValue(-20 - Math.random() * 100);
      p.opacity.setValue(1);
      p.rotate.setValue(0);
      const duration = 1800 + Math.random() * 1200;
      const delay = i * 40;
      return Animated.parallel([
        Animated.timing(p.y, { toValue: height + 40, duration, delay, useNativeDriver: true }),
        Animated.timing(p.x, { toValue: (Math.random() * width) + p.drift, duration, delay, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 360 * (Math.random() > 0.5 ? 1 : -1), duration, delay, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.6, delay: delay + duration * 0.4, useNativeDriver: true }),
      ]);
    });
    Animated.stagger(20, anims).start();
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.size * 0.6,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: spin },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

// ── Slide Icons ────────────────────────────────────────────

function SlideIcon({ type, color, badgeScale }: { type: Slide['icon']; color: string; badgeScale?: Animated.Value }) {
  const size = 64;
  switch (type) {
    case 'logo':
      return (
        <Image
          source={require('../../../assets/logo.png')}
          style={{ width: 120, height: 120, resizeMode: 'contain' }}
        />
      );
    case 'wod':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Dumbbell size={size} color={color} />
          <Clock size={48} color={color} />
          <Camera size={48} color={color} />
        </View>
      );
    case 'comp': {
      return (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Trophy size={80} color={color} />
          <EloCounter />
        </View>
      );
    }
    case 'box':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Building2 size={size} color={color} />
          <Hash size={48} color={color} />
        </View>
      );
    case 'badge':
      return (
        <Animated.View style={badgeScale ? { transform: [{ scale: badgeScale }] } : undefined}>
          <View style={{ alignItems: 'center' }}>
            <Rocket testID="tutorial-badge-icon" size={80} color={color} strokeWidth={1.5} />
          </View>
        </Animated.View>
      );
  }
}

// ── ELO animated counter ──────────────────────────────────

function EloCounter() {
  const { theme } = useTheme();
  const ink = theme.ax.warning;
  const [display, setDisplay] = useState(1000);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listener = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1250, duration: 2000, useNativeDriver: false }),
        Animated.delay(1000),
        Animated.timing(anim, { toValue: 1000, duration: 1500, useNativeDriver: false }),
        Animated.delay(500),
      ]),
    ).start();
    return () => anim.removeListener(listener);
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Zap size={16} color={ink} />
      <Text style={[axTypography.titleM, { color: ink, fontVariant: ['tabular-nums'] }]}>
        ELO {display}
      </Text>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────

interface Props {
  onDone: () => void;
}

export default function OnboardingTutorialScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, joinBox, skipBox, currentBox } = useAuth();
  const isLoggedIn = !!user;
  const c = theme.ax;
  const S = createStyles(c);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Box join state (slide 4)
  const [boxCode, setBoxCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [boxJoined, setBoxJoined] = useState(false);

  // Badge animation (slide 5)
  const badgeScale = useRef(new Animated.Value(0)).current;
  const [confettiActive, setConfettiActive] = useState(false);
  const [badgeAwarded, setBadgeAwarded] = useState(false);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      const idx = viewableItems[0].index;
      setCurrentIndex(idx);
      trackOnboardingStep(idx + 1, SLIDES[idx]?.key ?? '');

      // Trigger badge animation on slide 5
      if (idx === 4 && !badgeAwarded) {
        setBadgeAwarded(true);
        awardFirstStepBadge();
        badgeScale.setValue(0);
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }).start();
        setTimeout(() => setConfettiActive(true), 200);
      }
    }
  }, [badgeAwarded]);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  // Chaque slide fait la largeur de l'écran : la position est connue sans mesure,
  // `scrollToIndex` n'a jamais à attendre le layout d'une cellule.
  const getItemLayout = useCallback(
    (_: ArrayLike<Slide> | null | undefined, index: number) => ({ length: width, offset: width * index, index }),
    [],
  );

  async function awardFirstStepBadge() {
    if (!user?.id) return;
    try {
      await awardLevelBadge(user.id, 'first_step');
    } catch (e) {
      captureError(e, { action: 'awardFirstStepBadge' });
    }
  }

  async function handleDone() {
    if (user?.id) await markOnboardingCompleted(user.id);
    trackOnboardingComplete();
    // Auto-skip box if user is logged in but didn't join a box during onboarding
    if (isLoggedIn && !currentBox && !boxJoined) {
      await skipBox();
    }
    onDone();
  }

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleDone();
    }
  }

  async function handleJoinBox() {
    if (boxCode.trim().length !== 6) {
      Alert.alert(t('onboarding.invalidCode'), t('onboarding.invalidCodeMsg'));
      return;
    }
    setJoining(true);
    const { error } = await joinBox(boxCode.trim().toUpperCase());
    setJoining(false);
    if (error) {
      Alert.alert(t('common.error'), error);
      return;
    }
    setBoxJoined(true);
    trackOnboardingBoxJoin();
  }

  function handleSkipBox() {
    trackOnboardingSkipBox();
    handleNext();
  }

  const isLast = currentIndex === SLIDES.length - 1;
  const isBoxSlide = currentIndex === 3;

  return (
    <View style={S.container}>
      <GlassBackground />
      <ConfettiOverlay active={confettiActive} />

      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity testID="tutorial-skip" style={S.skipBtn} onPress={handleDone} activeOpacity={0.7} accessibilityRole="button">
          <Text style={S.skipText}>{t('onboarding.tutorial.skip')}</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <Animated.FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEnabled={!isBoxSlide || boxJoined || !isLoggedIn}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={({ index }) => flatListRef.current?.scrollToOffset({ offset: width * index, animated: true })}
          renderItem={({ item, index }) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
            const translateY = scrollX.interpolate({ inputRange, outputRange: [40, 0, 40], extrapolate: 'clamp' });
            // Parallax: icon moves slower
            const iconTranslateX = scrollX.interpolate({
              inputRange,
              outputRange: [width * 0.3, 0, -width * 0.3],
              extrapolate: 'clamp',
            });

            return (
              <View style={S.slide}>
                <Animated.View style={[S.slideContent, { opacity, transform: [{ translateY }] }]}>
                  {/* Icon with parallax */}
                  <Animated.View style={[S.iconCircle, { transform: [{ translateX: iconTranslateX }] }]}>
                    <SlideIcon type={item.icon} color={c.accentText} badgeScale={item.icon === 'badge' ? badgeScale : undefined} />
                  </Animated.View>
                  <Text style={S.title}>{t(`onboarding.slides.${item.key}.title`)}</Text>
                  <Text style={S.description}>{t(`onboarding.slides.${item.key}.description`)}</Text>

                  {/* Box join inline (slide 4) — only show input when logged in */}
                  {item.icon === 'box' && isLoggedIn && (
                    <View style={S.boxSection}>
                      {boxJoined ? (
                        <View style={S.boxJoinedRow}>
                          <Text style={S.boxJoinedText}>{t('onboarding.tutorial.boxJoined')}</Text>
                        </View>
                      ) : (
                        <>
                          <View style={S.boxInputRow}>
                            <View style={S.boxCodeField}>
                              <AxTextField
                                testID="tutorial-box-code"
                                placeholder="ABC123"
                                value={boxCode}
                                onChangeText={v => setBoxCode(v.toUpperCase())}
                                autoCapitalize="characters"
                                maxLength={6}
                              />
                            </View>
                            <AxButton
                              testID="tutorial-box-join"
                              label={t('onboarding.tutorial.join')}
                              onPress={handleJoinBox}
                              loading={joining}
                              disabled={boxCode.length !== 6}
                            />
                          </View>
                          <TouchableOpacity testID="tutorial-skip-box" onPress={handleSkipBox} style={S.skipBoxBtn} activeOpacity={0.7}>
                            <Text style={S.skipBoxText}>{t('onboarding.tutorial.continueWithoutBox')}</Text>
                            <ArrowRight size={14} color={c.accentText} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </Animated.View>
              </View>
            );
          }}
        />
      </KeyboardAvoidingView>

      {/* Bottom: dots + button */}
      <View style={S.bottomContainer}>
        {/* Dots */}
        <View style={S.dotsRow}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[S.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: c.accentText }]}
              />
            );
          })}
        </View>

        {/* CTA Button — hidden on box slide when logged in (buttons are inline) */}
        {(!isBoxSlide || !isLoggedIn) && (
          <View style={S.cta}>
            <AxButton
              testID="tutorial-next"
              label={isLast ? t('onboarding.tutorial.discoverApp') : currentIndex === 0 ? t('onboarding.tutorial.letsGo') : t('onboarding.tutorial.next')}
              onPress={handleNext}
              fullWidth
            />
          </View>
        )}

        {/* Box slide: show "Suivant" only if box was joined */}
        {isBoxSlide && boxJoined && (
          <View style={S.cta}>
            <AxButton testID="tutorial-next-box" label={t('onboarding.tutorial.next')} onPress={handleNext} fullWidth />
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingHorizontal: axSpacing.lg,
    paddingVertical: axSpacing.sm,
  },
  skipText: { ...axTypography.labelSmall, color: c.accentText },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  slideContent: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: withAlpha(c.accent, 0.12),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: { ...axTypography.titleXL, color: c.text, textAlign: 'center', marginBottom: 14 },
  description: { ...axTypography.body, color: c.textMuted, textAlign: 'center', maxWidth: 320 },
  bottomContainer: {
    paddingBottom: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: axSpacing['2xl'],
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: axSpacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: { alignSelf: 'stretch' },

  // Box slide
  boxSection: {
    width: '100%',
    marginTop: axSpacing['2xl'],
    gap: axSpacing.md,
  },
  boxInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  boxCodeField: { flex: 1 },
  skipBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  skipBoxText: { ...axTypography.labelSmall, color: c.accentText, flexShrink: 1, textAlign: 'center' },
  boxJoinedRow: {
    alignItems: 'center',
    paddingVertical: axSpacing.lg,
  },
  boxJoinedText: { ...axTypography.titleM, color: c.success, textAlign: 'center' },
}); }
