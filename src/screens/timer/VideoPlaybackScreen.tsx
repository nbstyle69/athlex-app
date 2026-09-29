import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Platform, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../navigation';
import { X, Play, Pause, Share2 } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { AxIconButton } from '../../components/ax';
import { axFonts, axSpacing, axTypography, axVeil } from '../../theme/axTokens';

type Route = RouteProp<HomeStackParamList, 'VideoPlayback'>;
type Nav   = NativeStackNavigationProp<HomeStackParamList, 'VideoPlayback'>;

function formatChronoTime(totalMs: number): string {
  const totalSec = Math.floor(totalMs / 1000);
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatRecordedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function VideoPlaybackScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { videoURL, title, recordedAt, timerStartOffset = 0, timerStopOffset = 0, countdownDuration = 0, overlaysBurned = false } = route.params;
  const { theme } = useTheme();

  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarWidth = Dimensions.get('window').width - 32;

  const player = useVideoPlayer(videoURL, p => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
      });
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player) {
        const ms = player.currentTime * 1000;
        setCurrentMs(ms);
        setIsPlaying(player.playing);
        if (player.duration > 0 && durationMs === 0) setDurationMs(player.duration * 1000);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player, durationMs]);

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  };

  const togglePlayPause = () => {
    if (player.playing) { player.pause(); setIsPlaying(false); }
    else                { player.play();  setIsPlaying(true);  }
    showControls();
  };

  // ── Countdown sync ───────────────────────────────────────────────────────
  const countdownStart   = timerStartOffset - (countdownDuration * 1000);
  const countdownVisible = countdownDuration > 0 && currentMs >= countdownStart && currentMs < timerStartOffset;
  const countdownValue   = countdownVisible ? Math.ceil((timerStartOffset - currentMs) / 1000) : 0;

  // ── Chrono sync ────────────────────────────────────────────────────────────
  // Si timerStartOffset=0 (non capturé) → on affiche depuis le début comme fallback
  const effectiveStart = timerStartOffset > 0 ? timerStartOffset : 0;
  const chronoVisible  = currentMs > 0;
  const isFrozen       = timerStopOffset > 0 && currentMs >= timerStopOffset;
  const elapsedMs      = isFrozen
    ? timerStopOffset - effectiveStart
    : Math.max(0, currentMs - effectiveStart);
  const chronoDisplay = formatChronoTime(elapsedMs);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* LAYER 1 — Video */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={togglePlayPause} activeOpacity={1}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
        />
      </TouchableOpacity>

      {/* LAYER 2 — Gradients */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient colors={['rgba(0,0,0,0.72)', 'transparent']} style={styles.topGradient} />
        <View style={{ flex: 1 }} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.bottomGradient} />
      </View>

      {/* LAYER 3 — Overlays */}
      <View style={[StyleSheet.absoluteFill, styles.overlayLayer]} pointerEvents="box-none">

        {/* TOP — titre + timestamp + bouton fermer */}
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.topLeft} pointerEvents="none">
            {!overlaysBurned && title ? <Text style={[axTypography.titleM, styles.titleText]} numberOfLines={2}>{title}</Text> : null}
            {!overlaysBurned && recordedAt ? <Text style={[axTypography.caption, styles.timestampText]}>{formatRecordedAt(recordedAt)}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: axSpacing.md }}>
            <AxIconButton testID="playback-share" icon={Share2} veil accessibilityLabel="Partager"
              onPress={async () => { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(videoURL); }} />
            <AxIconButton testID="playback-close" icon={X} veil accessibilityLabel="Fermer" onPress={() => navigation.goBack()} />
          </View>
        </View>

        {/* DÉCOMPTE — centré, visible avant le chrono */}
        {!overlaysBurned && countdownVisible && (
          <View style={styles.countdownOverlay} pointerEvents="none">
            <Text style={styles.countdownBigText}>{countdownValue}</Text>
          </View>
        )}

        {/* MILIEU — play/pause */}
        <View style={{ flex: 1 }} pointerEvents="none">
          {controlsVisible && (
            <View style={styles.playPauseWrap} pointerEvents="box-none">
              <AxIconButton testID="playback-toggle" icon={isPlaying ? Pause : Play} veil
                accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'} onPress={togglePlayPause} />
            </View>
          )}
        </View>

        {/* BAS — seek bar + chrono */}
        <View style={styles.bottomRow}>
          {!overlaysBurned && chronoVisible && <Text testID="playback-chrono" style={styles.chronoText}>{chronoDisplay}</Text>}

          {/* Seek bar */}
          {durationMs > 0 && (
            <View style={styles.seekSection}>
              <Text testID="playback-current" style={[axTypography.caption, styles.seekTime]}>{formatChronoTime(currentMs)}</Text>
              <TouchableOpacity
                style={[styles.seekBarTrack, { width: seekBarWidth - 120 }]}
                activeOpacity={1}
                onPress={(e) => {
                  const x = e.nativeEvent.locationX;
                  const barW = seekBarWidth - 120;
                  const ratio = Math.max(0, Math.min(1, x / barW));
                  const seekTo = (durationMs / 1000) * ratio;
                  player.currentTime = seekTo;
                  setCurrentMs(seekTo * 1000);
                  showControls();
                }}
              >
                <View style={styles.seekBarBg} />
                <View testID="playback-fill" style={[styles.seekBarFill, { backgroundColor: theme.ax.accent, width: `${durationMs > 0 ? (currentMs / durationMs) * 100 : 0}%` }]} />
                <View style={[
                  styles.seekBarThumb, { backgroundColor: theme.ax.accent },
                  { left: `${durationMs > 0 ? (currentMs / durationMs) * 100 : 0}%` },
                ]} />
              </TouchableOpacity>
              <Text testID="playback-duration" style={[axTypography.caption, styles.seekTime]}>{formatChronoTime(durationMs)}</Text>
            </View>
          )}
        </View>

        {/* LOGO — coin bas-droite, toujours visible */}
        {!overlaysBurned && (
          <View style={styles.logoWrap} pointerEvents="none">
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topGradient:    { height: 120 },
  bottomGradient: { height: 120 },
  overlayLayer: { flexDirection: 'column' },
  topRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 52, paddingHorizontal: 16,
  },
  topLeft: { flex: 1, paddingRight: 12 },
  titleText: {
    color: axVeil.ink,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4, marginBottom: 4,
  },
  timestampText: {
    color: axVeil.ink,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  playPauseWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  countdownOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  countdownBigText: {
    fontSize: 120, fontFamily: axFonts.oswaldMedium, color: axVeil.ink,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  bottomRow: { alignItems: 'center', paddingBottom: 40 },
  chronoText: {
    fontSize: 42, fontFamily: axFonts.oswaldMedium, color: axVeil.ink,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
    fontVariant: ['tabular-nums'],
  },
  logoWrap: {
    position: 'absolute', bottom: 52, right: 16,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, padding: 6,
  },
  logoImg: { width: 48, height: 48, opacity: 0.9 },
  seekSection: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginTop: 8, width: '100%',
  },
  seekBarTrack: {
    height: 20, justifyContent: 'center', position: 'relative',
    backgroundColor: 'transparent',
  },
  seekBarBg: {
    position: 'absolute', left: 0, right: 0, top: 8, height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2,
  },
  seekBarFill: {
    position: 'absolute', left: 0, top: 8, height: 4,
    borderRadius: 2,
  },
  seekBarThumb: {
    position: 'absolute', top: 4, width: 12, height: 12,
    borderRadius: 6,
    marginLeft: -6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5, shadowRadius: 3, elevation: 4,
  },
  seekTime: {
    color: axVeil.ink,
    fontVariant: ['tabular-nums'], width: 52, textAlign: 'center',
  },
});
