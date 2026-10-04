import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, User, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { AxTextField } from './ax';
import { axAccentSafeLineHeight, axSpacing, axTypography } from '../theme/axTokens';
import {
  LETTRES_AZ, filtrerMembres, grouperParLettre, sectionPourLettre, type MembreAZ,
} from '../lib/membresAZ';

interface Props {
  visible: boolean;
  membres: MembreAZ[];
  onChoisir: (membre: MembreAZ) => void;
  onFermer: () => void;
}

/** Hauteur de la feuille de la maquette (Figma 479:1161 : 700 sur 909). */
const HAUTEUR_FEUILLE = 700;

/**
 * Feuille « CHOISIR UN MEMBRE » (D4b, maquettes 479:1161 et 479:1366) : membres actifs
 * de A à Z sous leur lettre, index A–Z qui fait défiler à la lettre, recherche qui filtre
 * la même liste dès la première lettre. Toucher un membre le choisit et ferme la feuille.
 * La feuille se réduit quand le clavier monte : la liste reste visible au-dessus.
 */
export function ChoisirMembreFeuille({ visible, membres, onChoisir, onFermer }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [saisie, setSaisie] = useState('');
  const liste = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});

  const recherche = saisie.trim().length > 0;
  const sections = useMemo(() => grouperParLettre(membres), [membres]);
  const resultats = useMemo(() => (recherche ? filtrerMembres(membres, saisie) : []), [membres, saisie, recherche]);

  const fermer = () => { setSaisie(''); onFermer(); };
  const choisir = (m: MembreAZ) => { setSaisie(''); onChoisir(m); };
  const allerA = (lettre: string) => {
    const cible = sectionPourLettre(sections, lettre);
    if (cible === null) return;
    liste.current?.scrollTo({ y: positions.current[cible] ?? 0, animated: true });
  };

  const ligne = (m: MembreAZ) => (
    <Pressable key={m.user_id} testID={`choisir-membre-${m.user_id}`} onPress={() => choisir(m)}
      accessibilityRole="button" accessibilityLabel={m.username}
      style={[S.ligne, { borderBottomColor: c.border, paddingRight: recherche ? 0 : 28 }]}>
      <User color={c.textMuted} size={18} strokeWidth={2} />
      <Text style={[axTypography.label, { color: c.text, flexShrink: 1 }]} numberOfLines={1}>{m.username}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fermer} statusBarTranslucent>
      <Pressable testID="choisir-membre-voile" style={S.voile} onPress={fermer} accessibilityLabel={t('common.close')} />
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[S.cadre, { paddingTop: insets.top + axSpacing.xl }]}>
        <View testID="choisir-membre-feuille" style={[S.feuille, {
          height: Math.min(HAUTEUR_FEUILLE, winH - insets.top - axSpacing.xl),
          backgroundColor: c.surface, borderColor: c.border, paddingBottom: insets.bottom + 24,
        }]}>
          <View style={S.poigneeRang}><View style={[S.poignee, { backgroundColor: c.fieldBorder }]} /></View>
          <View style={S.entete}>
            <Text accessibilityRole="header" style={[axTypography.titleM, { lineHeight: axAccentSafeLineHeight.titleM, color: c.text, flex: 1 }]}>
              {t('bo.notifications.chooseTitle')}
            </Text>
            <Pressable testID="choisir-membre-fermer" onPress={fermer} hitSlop={11} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <X color={c.text} size={22} strokeWidth={2} />
            </Pressable>
          </View>
          <AxTextField testID="choisir-membre-recherche" value={saisie} onChangeText={setSaisie} icon={Search}
            placeholder={t('bo.notifications.searchPlaceholder')} accessibilityLabel={t('bo.notifications.searchPlaceholder')}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            trailing={recherche ? (
              <Pressable testID="choisir-membre-effacer" onPress={() => setSaisie('')} hitSlop={11}
                accessibilityRole="button" accessibilityLabel={t('bo.notifications.clearSearch')}>
                <X color={c.text} size={18} strokeWidth={2} />
              </Pressable>
            ) : undefined} />
          <Text testID="choisir-membre-compteur" style={[axTypography.caption, { color: c.textMuted }]}>
            {recherche
              ? t('bo.notifications.results', { count: resultats.length })
              : t('bo.notifications.activeMembersAZ', { count: membres.length })}
          </Text>
          <View style={S.zoneListe}>
            <ScrollView ref={liste} testID="choisir-membre-liste" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {recherche ? resultats.map(ligne) : sections.map((s) => (
                <View key={s.lettre} testID={`choisir-membre-section-${s.lettre}`}
                  onLayout={(e) => { positions.current[s.lettre] = e.nativeEvent.layout.y; }}>
                  <Text style={[axTypography.overlineSmall, S.lettre, { color: c.accentText }]}>{s.lettre}</Text>
                  {s.membres.map(ligne)}
                </View>
              ))}
            </ScrollView>
            {!recherche && sections.length > 0 && (
              <View testID="choisir-membre-index" style={S.index}>
                {LETTRES_AZ.map((l) => (
                  <Pressable key={l} testID={`choisir-membre-index-${l}`} onPress={() => allerA(l)} hitSlop={{ left: 8, right: 8 }}
                    accessibilityRole="button" accessibilityLabel={l}>
                    <Text style={[axTypography.caption, { color: c.accentText, textAlign: 'center' }]}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const S = StyleSheet.create({
  voile: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  cadre: { flex: 1, justifyContent: 'flex-end' },
  // Feuille de la maquette : surface, coins de 12 en haut, marges de 20, 12 entre les blocs.
  feuille: {
    flexShrink: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 10, paddingHorizontal: axSpacing.xl, gap: axSpacing.md,
  },
  poigneeRang: { alignItems: 'center' },
  poignee: { width: 40, height: 4, borderRadius: 2 },
  entete: { flexDirection: 'row', alignItems: 'center' },
  zoneListe: { flex: 1, minHeight: 0 },
  lettre: { paddingTop: 12, paddingBottom: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  index: { position: 'absolute', right: -8, top: 0, bottom: 0, justifyContent: 'center', gap: 1 },
});
