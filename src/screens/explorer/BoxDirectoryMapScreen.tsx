import i18n from '../../i18n';
import { AxCard, AxIconButton, withAlpha } from '../../components/ax';
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, Dimensions, Platform,
} from 'react-native';
import { ChevronLeft, MapPin, Users, Navigation } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { HomeStackParamList } from '../../navigation';
import { Box } from '../../types';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type Route = RouteProp<HomeStackParamList, 'BoxDirectoryMap'>;

let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
} catch (_) {}

const { width } = Dimensions.get('window');

export default function BoxDirectoryMapScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const c = theme.ax;
  const s = createStyles(theme, c);
  const tabSpace = useTabBarScrollSpace();

  const boxes: Box[] = (route.params?.boxes ?? []) as Box[];
  const [selected, setSelected] = useState<Box | null>(null);
  const mapRef = useRef<any>(null);

  const initialRegion = boxes.length > 0
    ? {
        latitude: boxes.reduce((a, b) => a + (b.latitude ?? 0), 0) / boxes.length,
        longitude: boxes.reduce((a, b) => a + (b.longitude ?? 0), 0) / boxes.length,
        latitudeDelta: 2,
        longitudeDelta: 2,
      }
    : { latitude: 46.6, longitude: 2.2, latitudeDelta: 8, longitudeDelta: 8 };

  if (!MapView) {
    return (
      <View style={[s.container, s.center]}>
        <GlassBackground />
        <View style={s.headerAbs}>
          <AxIconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel={i18n.t('common.back')} testID="map-back" />
          <Text style={s.headerTitle}>Carte des Boxs</Text>
        </View>
        <Text style={s.emptyText}>
          react-native-maps non installé.{'\n'}Installez-le pour afficher la carte.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GlassBackground />
      {/* Header floating */}
      <View style={s.headerAbs}>
        <AxIconButton icon={ChevronLeft} onPress={() => navigation.goBack()} accessibilityLabel={i18n.t('common.back')} testID="map-back" />
        <Text style={s.headerTitle} numberOfLines={1}>Carte des Boxs</Text>
        <Text style={s.headerSub} numberOfLines={1}>{boxes.length} box{boxes.length > 1 ? 's' : ''}</Text>
      </View>

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={theme.mode === 'dark' ? darkMapStyle : []}
      >
        {boxes.map(box => (
          <Marker
            key={box.id}
            coordinate={{ latitude: box.latitude!, longitude: box.longitude! }}
            onPress={() => setSelected(box)}
          >
            <View style={s.markerWrap}>
              {box.logo_url ? (
                <Image source={{ uri: box.logo_url }} style={s.markerLogo} />
              ) : (
                <View style={[s.markerLogo, s.markerPlaceholder]}>
                  <Text style={s.markerLetter}>{box.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={s.markerArrow} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Bottom sheet when selected */}
      {selected && (
        <View style={[s.sheet, { paddingBottom: tabSpace }]}>
          <AxCard
            variant="featured"
            style={s.sheetCard}
            onPress={() => {
              setSelected(null);
              navigation.navigate('BoxDirectoryDetail', { boxId: selected.id });
            }}
            accessibilityLabel={selected.name}
            testID="map-sheet-card"
          >
            {selected.logo_url ? (
              <Image source={{ uri: selected.logo_url }} style={s.sheetLogo} />
            ) : (
              <View style={[s.sheetLogo, s.sheetLogoPlaceholder]}>
                <Text style={s.sheetLogoLetter}>{selected.name.charAt(0)}</Text>
              </View>
            )}
            <View style={s.sheetContent}>
              <Text style={s.sheetName} numberOfLines={2}>{selected.name}</Text>
              {selected.city ? (
                <View style={s.metaRow}>
                  <MapPin size={12} color={c.textMuted} />
                  <Text style={s.metaText} numberOfLines={1}>{selected.city}</Text>
                </View>
              ) : null}
              <View style={s.metaRow}>
                <Users size={12} color={c.textMuted} />
                <Text style={s.metaText} numberOfLines={1}>{selected.member_count ?? 0} membres</Text>
              </View>
            </View>
            <Navigation size={18} color={c.accentText} />
          </AxCard>
          <Pressable
            style={s.sheetClose}
            onPress={() => setSelected(null)}
            accessibilityRole="button"
            testID="map-sheet-close"
          >
            <Text style={s.sheetCloseText}>Fermer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e8e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
];

function createStyles(t: AppTheme, c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { alignItems: 'center', justifyContent: 'center' },
    headerAbs: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      paddingTop: 56, paddingHorizontal: axSpacing.lg, paddingBottom: axSpacing.md,
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.md,
      backgroundColor: withAlpha(c.background, 0.92),
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { ...axTypography.titleM, color: c.text, flexShrink: 1 },
    headerSub: { ...axTypography.bodySmall, color: c.textMuted },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: axSpacing['2xl'] },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: axSpacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    sheetCard: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    sheetLogo: { width: 48, height: 48, borderRadius: axRadius.card },
    sheetLogoPlaceholder: {
      backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    sheetLogoLetter: { ...axTypography.titleM, color: c.accentText },
    sheetContent: { flex: 1, minWidth: 0, gap: axSpacing.xs },
    sheetName: { ...axTypography.titleM, color: c.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    metaText: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
    sheetClose: {
      alignSelf: 'center', minHeight: 44, justifyContent: 'center',
      paddingHorizontal: axSpacing.lg, marginTop: axSpacing.xs,
      borderRadius: axRadius.control, backgroundColor: withAlpha(c.background, 0.92),
    },
    sheetCloseText: { ...axTypography.labelSmall, color: c.textMuted },
    markerWrap: { alignItems: 'center' },
    markerLogo: {
      width: 40, height: 40, borderRadius: 10,
      borderWidth: 2, borderColor: t.accent,
    },
    markerPlaceholder: {
      backgroundColor: t.card, alignItems: 'center', justifyContent: 'center',
    },
    markerLetter: { fontSize: 16, fontWeight: '900', color: t.accent },
    markerArrow: {
      width: 0, height: 0, marginTop: -1,
      borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
      borderLeftColor: 'transparent', borderRightColor: 'transparent',
      borderTopColor: t.accent,
    },
  });
}
