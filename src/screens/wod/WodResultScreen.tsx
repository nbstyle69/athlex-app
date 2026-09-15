/**
 * AthleX — Résultat du générateur (brief §8, page résultat)
 * Reprend les composants du Whiteboard : carte WOD (badge GÉNÉRÉ, titre, sous-titre,
 * « Voir détails & score », bouton minuteur), liste de mouvements dépliables (charges /
 * substitutions de toutes les catégories), durée estimée compacte + stimulus, et une barre
 * d'actions fixe au-dessus de la tab bar : Re-tirer, Enregistrer, Favori, Minuteur,
 * Ajouter au Whiteboard, Saisir mon score, menu ⋯ (Copier / Partager).
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Share,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw, Bookmark, Heart, Check, Copy, Trophy, X,
  Timer as TimerIcon, Clock, MoreHorizontal, Share2, ClipboardList,
} from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import EmeraldCTAButton from '../../components/glass/EmeraldCTAButton';
import WodTypeBadge from '../../components/wod/WodTypeBadge';
import TimerLaunchModal, { TimerRunParams } from '../../components/wod/TimerLaunchModal';
import i18n from '../../i18n';
import { captureError } from '../../lib/sentry';
import { hapticSuccess } from '../../lib/haptics';
import { spacing, typography } from '../../theme/designTokens';
import { maskTimeInput, timeStringToSeconds } from '../../utils/tournamentUtils';
import { buildFullSeqBlockFromWOD } from '../../utils/wodToTimer';
import {
  CATEGORY_LABEL, FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES,
} from '../../../packages/wod-engine/src';
import type { Category, GeneratedMovement, GeneratedWod } from '../../../packages/wod-engine/src';
import {
  GenerateResult, ScoreInputType, ScoreSubmission, ScreenParams, addToWhiteboard, editorFieldsOf, redraw,
  saveGeneratedWod, scoreInputTypeFor, setFavorite, submitGeneratedScore,
} from '../../services/wodGenerator';
import { HYBRID_ORANGE } from './wodGeneratorOptions';

export type WodResultParams = { screen: ScreenParams; result: GenerateResult };
type Route = RouteProp<{ WodResult: WodResultParams }, 'WodResult'>;

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function minutesText(min: number): string {
  return mmss(Math.round(min * 60));
}

export function qtyText(m: GeneratedMovement): string {
  const q = m.scheme ? m.scheme.join('-') : String(m.qty);
  const per = m.per_minute ? ' (+1 / min)' : '';
  return m.unit === 'reps' ? `${q}${per}` : `${q} ${m.unit}${per}`;
}

export function loadFor(m: GeneratedMovement, c: Category): string | null {
  const v = m.loads_by_category[c];
  if (!m.load_unit || !v || v.some((x) => x == null)) return null;
  return `${v.map(fmtNum).join('/')} ${m.load_unit}`;
}

/** Ligne secondaire d'un mouvement pour une catégorie : charge · → substitution · (variante). */
export function categoryLine(m: GeneratedMovement, c: Category, withLabel: boolean): string | null {
  const load = loadFor(m, c);
  const sub = m.substitutions_by_category[c];
  const variant = m.variant_by_category[c];
  const parts = [load && (withLabel ? `${CATEGORY_LABEL[c]} ${load}` : load), sub && `→ ${sub}`, variant && `(${variant})`]
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** « Affiché pour : Inter · d'après ton profil » / « RX · niveau non renseigné ». */
export function displayedForText(category: Category, hasLevel: boolean): { text: string; link: string } {
  return hasLevel
    ? { text: `Affiché pour : ${CATEGORY_LABEL[category]} · d'après ton profil`, link: 'modifier' }
    : { text: `Affiché pour : ${CATEGORY_LABEL[category]} · niveau non renseigné`, link: 'choisir' };
}

const SCORE_TYPES: { key: ScoreInputType; label: string }[] = [
  { key: 'time', label: 'Temps' }, { key: 'rounds', label: 'Rounds' }, { key: 'reps', label: 'Reps' }, { key: 'weight', label: 'Charge' },
];

function useTabBarHeight(): number {
  try { return useBottomTabBarHeight(); } catch { return 0; }
}

export default function WodResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);

  const [result, setResult] = useState<GenerateResult>(route.params.result);
  const { wod, category } = result;
  const screen = route.params.screen;
  const accent = wod.discipline === 'hybrid' ? HYBRID_ORANGE : theme.accent;
  const categories: readonly Category[] = wod.discipline === 'hybrid' ? HYBRID_CATEGORIES : FUNCTIONAL_CATEGORIES;

  const [redrawing, setRedrawing] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [favorite, setFav] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [allCategories, setAllCategories] = useState(false);
  const [menu, setMenu] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [boxWodId, setBoxWodId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [scoreModal, setScoreModal] = useState(false);
  const [scoreType, setScoreType] = useState<ScoreInputType>(scoreInputTypeFor(wod));
  const [scoreInput, setScoreInput] = useState('');
  const [scoreCategory, setScoreCategory] = useState<Category>(category);
  const [scoreNotes, setScoreNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<ScoreSubmission | null>(null);

  const block = wod.blocks[0];
  const headerLine = useMemo(() => wod.description.split('\n')[0] ?? '', [wod.description]);
  const estimate = wod.estimate.by_category[category];
  const displayedFor = displayedForText(category, !!user?.level);
  const timerBlock = useMemo(() => buildFullSeqBlockFromWOD(editorFieldsOf(wod)), [wod]);

  function resetFor(next: GenerateResult) {
    setResult(next);
    setSavedId(null);
    setFav(false);
    setDetail(null);
    setAllCategories(false);
    setBoxWodId(null);
    setSubmittedScore(null);
    setScoreType(scoreInputTypeFor(next.wod));
    setScoreCategory(next.category);
  }

  async function onRedraw() {
    if (!user) return;
    setRedrawing(true);
    try {
      resetFor(await redraw(user, currentBox?.id, screen));
    } catch (e) {
      Alert.alert('Aucun WOD valide', 'Réessaie ou change les paramètres.');
    } finally {
      setRedrawing(false);
    }
  }

  async function onSave(): Promise<string | null> {
    if (!user) return null;
    if (savedId) return savedId;
    setSaving(true);
    try {
      const id = await saveGeneratedWod(user.id, wod, category);
      setSavedId(id);
      return id;
    } catch (e) {
      captureError(e, { screen: 'WodResult', action: 'save' });
      Alert.alert('Erreur', "Impossible d'enregistrer ce WOD.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function onFavorite() {
    const id = await onSave();
    if (!id) return;
    const next = !favorite;
    setFav(next);
    try { await setFavorite(id, next); } catch (e) { setFav(!next); captureError(e, { screen: 'WodResult', action: 'favorite' }); }
  }

  function onCopy() {
    setMenu(false);
    try {
      const { Clipboard: RNClipboard } = require('react-native');
      RNClipboard?.setString?.(wod.description);
    } catch (_) { /* presse-papier indisponible : la feuille de partage suffit */ }
    Share.share({ message: `${wod.title}\n${wod.description}` }).catch(() => {});
  }

  function onShare() {
    setMenu(false);
    Share.share({ message: `${wod.title}\n${wod.description}` }).catch(() => {});
  }

  function onTimerLaunch(params: TimerRunParams) {
    setTimerOpen(false);
    navigation.navigate('TimerRun', params);
  }

  async function onAddToWhiteboard() {
    if (!user) return;
    if (boxWodId) {
      navigation.navigate('Whiteboard', { screen: 'WhiteboardMain' });
      return;
    }
    const id = await onSave();
    if (!id) return;
    setAdding(true);
    try {
      const created = await addToWhiteboard(user.id, wod, id, submittedScore);
      setBoxWodId(created);
      hapticSuccess();
      Alert.alert(
        'Ajouté au Whiteboard',
        submittedScore ? 'Le WOD et ton score sont dans « Mes WODs perso ».' : 'Le WOD est dans « Mes WODs perso » pour aujourd\'hui.',
        [
          { text: i18n.t('common.ok'), style: 'cancel' },
          { text: 'Voir le Whiteboard', onPress: () => navigation.navigate('Whiteboard', { screen: 'WhiteboardMain' }) },
        ],
      );
    } catch (e) {
      captureError(e, { screen: 'WodResult', action: 'addToWhiteboard' });
      Alert.alert('Erreur', "Impossible d'ajouter ce WOD au Whiteboard.");
    } finally {
      setAdding(false);
    }
  }

  async function onSubmitScore() {
    if (!user) return;
    const value = scoreType === 'time' ? timeStringToSeconds(scoreInput) : parseFloat(scoreInput);
    if (isNaN(value) || value <= 0) { Alert.alert('Score invalide'); return; }
    const id = await onSave();
    if (!id) return;
    setSubmitting(true);
    try {
      const submission: ScoreSubmission = { wodId: id, scoreType, value, category: scoreCategory, notes: scoreNotes };
      await submitGeneratedScore(user, currentBox?.id, wod, submission);
      setSubmittedScore(submission);
      hapticSuccess();
      setScoreModal(false);
      setScoreInput('');
      setScoreNotes('');
      Alert.alert(
        i18n.t('wodGenerator.scoreSavedTitle'),
        i18n.t('wodGenerator.scoreSavedBody'),
        [
          { text: i18n.t('common.ok'), style: 'cancel' },
          { text: i18n.t('wodGenerator.seeMyHistory'), onPress: () => navigation.navigate('WodHistory') },
        ],
      );
    } catch (e) {
      captureError(e, { screen: 'WodResult', action: 'submitScore' });
      Alert.alert('Erreur', "Impossible d'enregistrer le score.");
    } finally {
      setSubmitting(false);
    }
  }

  const bottomBarPadding = tabBarHeight > 0 ? tabBarHeight : insets.bottom;

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ChevronLeft color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={S.headerLabel}>Ton WOD</Text>
      </View>

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: bottomBarPadding + 150 }]} showsVerticalScrollIndicator={false}>
        {/* Carte WOD (Whiteboard) */}
        <View style={S.wodCard} testID="wodresult-card">
          <View style={S.wodCardTop}>
            <WodTypeBadge type="generated" label="Généré" color={accent} />
            {wod.time_cap_seconds != null && (
              <View style={S.timeCap}>
                <Clock color={theme.textMuted} size={12} />
                <Text style={S.timeCapText}>Cap {mmss(wod.time_cap_seconds)}</Text>
              </View>
            )}
            {wod.vest && wod.vest.mode !== 'none' && (
              <Text style={S.timeCapText}>
                Gilet {wod.vest.mode === 'optional' ? 'optionnel ' : ''}{wod.vest.load_kg_by_category[category] ?? ''} kg
              </Text>
            )}
          </View>
          <Text style={S.wodTitle} testID="wodresult-title">{wod.title.toUpperCase()}</Text>
          <Text style={S.wodDesc}>{headerLine}</Text>
          <View style={S.wodCardFooter}>
            <TouchableOpacity
              style={S.wodCardAction}
              onPress={() => setScoreModal(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="wodresult-see-details"
            >
              <Text style={[S.wodCardActionText, { color: accent }]}>{i18n.t('whiteboard.seeDetails')}</Text>
              <ChevronRight color={accent} size={14} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimerOpen(true)}
              style={[S.timerBtn, { backgroundColor: `${accent}18`, borderColor: `${accent}35` }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('whiteboard.launchTimer')}
              testID="wodresult-timer"
            >
              <TimerIcon color={accent} size={16} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Catégorie affichée */}
        <View style={S.displayedFor}>
          <Text style={S.displayedForText} testID="wodresult-displayed-for">
            {displayedFor.text}
            {' — '}
            <Text
              style={[S.displayedForLink, { color: accent }]}
              onPress={() => navigation.navigate('Profile', { editLevel: true })}
              testID="wodresult-edit-level"
            >
              {displayedFor.link}
            </Text>
          </Text>
        </View>

        {/* Mouvements */}
        <GlassCard radius={16} style={S.card}>
          <View style={S.cardInner}>
          {block.movements.map((m, i) => {
            const open = detail === i;
            const line = categoryLine(m, category, true);
            return (
              <View
                key={`${m.id}-${i}`}
                style={[S.moveRow, i === 0 && S.moveRowFirst, i === block.movements.length - 1 && S.moveRowLast, i > 0 && S.moveRowBorder]}
              >
                <TouchableOpacity style={S.moveHead} onPress={() => setDetail(open ? null : i)} activeOpacity={0.8} testID={`wodresult-move-${i}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.moveText}>
                      {m.round != null ? <Text style={S.moveRound}>R{m.round} · </Text> : null}
                      <Text style={[S.moveQty, { color: accent }]}>{qtyText(m)}</Text> {m.name}
                    </Text>
                    <Text style={S.moveSub}>{line ?? 'Toutes catégories'}</Text>
                  </View>
                  {open
                    ? <ChevronUp color={theme.textSecondary} size={18} />
                    : <ChevronDown color={theme.textSecondary} size={18} />}
                </TouchableOpacity>
                {open && (
                  <View style={S.catTable}>
                    {categories.map((c) => (
                      <View key={c} style={S.catRow}>
                        <Text style={[S.catName, c === category && { color: accent, fontWeight: '800' }]}>{CATEGORY_LABEL[c]}</Text>
                        <Text style={S.catVal}>{categoryLine(m, c, false) ?? '—'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          </View>
        </GlassCard>

        {/* Durée estimée */}
        <GlassCard radius={16} style={S.card}>
          <View style={S.cardInner}>
          <View style={S.estRow}>
            <Text style={S.estBig} testID="wodresult-estimate">
              {estimate ? minutesText(estimate.minutes) : minutesText(wod.estimate.reference_minutes)}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={S.estLabel}>Durée estimée · {CATEGORY_LABEL[category]}</Text>
              <Text style={S.estTarget}>cible {estimate?.target ?? '—'}</Text>
            </View>
          </View>
          <TouchableOpacity style={S.estLink} onPress={() => setAllCategories((v) => !v)} activeOpacity={0.7} testID="wodresult-all-categories">
            <Text style={[S.estLinkText, { color: accent }]}>{allCategories ? 'Masquer les catégories' : 'Voir toutes les catégories'}</Text>
            {allCategories ? <ChevronUp color={accent} size={14} /> : <ChevronDown color={accent} size={14} />}
          </TouchableOpacity>
          {allCategories && (
            <View style={S.catTable}>
              {categories.map((c) => {
                const e = wod.estimate.by_category[c];
                return e ? (
                  <View key={c} style={S.catRow}>
                    <Text style={[S.catName, c === category && { color: accent, fontWeight: '800' }]}>{CATEGORY_LABEL[c]}</Text>
                    <Text style={S.catVal}>{minutesText(e.minutes)} · {e.target}</Text>
                  </View>
                ) : null;
              })}
            </View>
          )}
          <Text style={S.stimulus}>Stimulus · RPE {fmtNum(wod.stimulus.rpe)} — {wod.stimulus.note}</Text>
          {wod.after_class && (wod.after_class.excluded_patterns.length > 0 || wod.after_class.excluded_families.length > 0) && (
            <Text style={S.afterClass}>Complément : évite {[...wod.after_class.excluded_patterns, ...wod.after_class.excluded_families].join(', ')}.</Text>
          )}
          </View>
        </GlassCard>
      </ScrollView>

      {/* Barre d'actions fixe au-dessus de la tab bar */}
      <View style={[S.bottomBar, { paddingBottom: bottomBarPadding + ROW_PAD }]} testID="wodresult-actions">
        <View style={S.iconRow}>
          <TouchableOpacity style={S.iconBtn} onPress={onRedraw} disabled={redrawing} activeOpacity={0.8} testID="wodresult-redraw">
            {redrawing ? <ActivityIndicator color={accent} size="small" /> : <RefreshCw size={18} color={accent} />}
            <Text style={S.iconText}>Re-tirer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={onSave} disabled={saving || !!savedId} activeOpacity={0.8} testID="wodresult-save">
            {saving ? <ActivityIndicator color={theme.text} size="small" /> : savedId ? <Check size={18} color={accent} /> : <Bookmark size={18} color={theme.text} />}
            <Text style={S.iconText}>{savedId ? 'Enregistré' : 'Enregistrer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={onFavorite} activeOpacity={0.8} testID="wodresult-favorite">
            <Heart size={18} color={theme.error} fill={favorite ? theme.error : 'transparent'} />
            <Text style={S.iconText}>Favori</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => setTimerOpen(true)} activeOpacity={0.8} testID="wodresult-timer-bar">
            <TimerIcon size={18} color={theme.text} />
            <Text style={S.iconText}>Minuteur</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => setMenu(true)} activeOpacity={0.8} testID="wodresult-more">
            <MoreHorizontal size={18} color={theme.text} />
            <Text style={S.iconText}>Plus</Text>
          </TouchableOpacity>
        </View>
        <View style={S.ctaRow}>
          <EmeraldCTAButton
            size="md"
            style={{ flex: 1 }}
            icon={boxWodId ? <Check size={16} color={theme.ctaSolidText} /> : <ClipboardList size={16} color={theme.ctaSolidText} />}
            onPress={onAddToWhiteboard}
            loading={adding}
          >
            {boxWodId ? 'Sur le Whiteboard' : 'Ajouter au Whiteboard'}
          </EmeraldCTAButton>
          <EmeraldCTAButton
            size="md"
            style={{ flex: 1 }}
            icon={<Trophy size={16} color={theme.ctaSolidText} />}
            onPress={() => setScoreModal(true)}
          >
            {submittedScore ? 'Modifier mon score' : 'Saisir mon score'}
          </EmeraldCTAButton>
        </View>
      </View>

      <TimerLaunchModal
        visible={timerOpen}
        title={wod.title}
        initialBlock={timerBlock}
        onClose={() => setTimerOpen(false)}
        onLaunch={onTimerLaunch}
      />

      {/* Menu ⋯ */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={S.modalBg} onPress={() => setMenu(false)}>
          <Pressable style={[S.menuSheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <TouchableOpacity style={S.menuItem} onPress={onCopy} activeOpacity={0.7} testID="wodresult-copy">
              <Copy size={18} color={theme.text} />
              <Text style={S.menuItemText}>Copier le WOD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.menuItem} onPress={onShare} activeOpacity={0.7} testID="wodresult-share">
              <Share2 size={18} color={theme.text} />
              <Text style={S.menuItemText}>Partager</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Saisie du score : catégorie demandée */}
      <Modal visible={scoreModal} transparent animationType="slide" onRequestClose={() => setScoreModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={S.modalBg}>
          <View style={S.modalSheet}>
            <View style={S.modalHead}>
              <Text style={S.modalTitle}>Mon score</Text>
              <TouchableOpacity onPress={() => setScoreModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={20} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={S.modalLabel}>Catégorie réalisée</Text>
            <View style={S.chipRow}>
              {categories.map((c) => (
                <TouchableOpacity key={c} style={[S.chip, scoreCategory === c && { borderColor: accent, backgroundColor: `${accent}20` }]} onPress={() => setScoreCategory(c)} activeOpacity={0.8} testID={`wodresult-score-cat-${c}`}>
                  <Text style={S.chipText}>{CATEGORY_LABEL[c]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={S.modalLabel}>Type de score</Text>
            <View style={S.chipRow}>
              {SCORE_TYPES.map((s) => (
                <TouchableOpacity key={s.key} style={[S.chip, scoreType === s.key && { borderColor: accent, backgroundColor: `${accent}20` }]} onPress={() => { setScoreType(s.key); setScoreInput(''); }} activeOpacity={0.8}>
                  <Text style={S.chipText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={S.input}
              placeholder={scoreType === 'time' ? 'mm:ss' : scoreType === 'rounds' ? 'Rounds (ex. 7)' : scoreType === 'weight' ? 'kg' : 'Reps totales'}
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={scoreInput}
              onChangeText={(v) => setScoreInput(scoreType === 'time' ? maskTimeInput(v) : v)}
              testID="wodresult-score-input"
            />
            <TextInput
              style={S.input}
              placeholder="Notes (optionnel)"
              placeholderTextColor={theme.textMuted}
              value={scoreNotes}
              onChangeText={setScoreNotes}
            />
            <EmeraldCTAButton
              onPress={onSubmitScore}
              loading={submitting}
              disabled={submitting}
              icon={<Trophy size={18} color={theme.ctaSolidText} />}
              style={{ marginTop: 16 }}
            >
              Enregistrer mon score
            </EmeraldCTAButton>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** Padding intérieur des cartes et de la barre d'actions (tuiles Outils de l'Accueil). */
const CARD_PAD = 20;
/** Espace vertical entre deux lignes de mouvement. */
const ROW_PAD = 14;

function createStyles(theme: AppTheme) {
  const isDark = theme.mode === 'dark';
  const cardShadow = isDark ? {} : {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerLabel: { fontSize: 17, fontWeight: '800', color: theme.text },
    content: { padding: 16 },

    wodCard: {
      backgroundColor: theme.card, borderRadius: 16, padding: CARD_PAD,
      borderWidth: 1, borderColor: theme.border, gap: 10,
      ...cardShadow,
    },
    wodCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    timeCap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timeCapText: { fontSize: 11, color: theme.textMuted },
    wodTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
    wodDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
    wodCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    wodCardAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    wodCardActionText: { fontSize: 12, fontWeight: '700' },
    timerBtn: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1,
    },

    displayedFor: { paddingHorizontal: CARD_PAD, paddingVertical: 14 },
    displayedForText: { ...typography.bodySmall, color: theme.textSecondary },
    displayedForLink: { fontWeight: '700', textDecorationLine: 'underline' },

    card: { marginBottom: 14 },
    cardInner: { padding: CARD_PAD },

    moveRow: { paddingVertical: ROW_PAD },
    moveRowFirst: { paddingTop: 0 },
    moveRowLast: { paddingBottom: 0 },
    moveRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    moveHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    moveText: { fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 21 },
    moveRound: { fontSize: 12, color: theme.textSecondary, fontWeight: '700' },
    moveQty: { fontWeight: '900' },
    moveSub: { ...typography.bodySmall, color: theme.textSecondary, marginTop: spacing.xxs },
    catTable: { marginTop: spacing.sm, gap: spacing.xs },
    catRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xxs },
    catName: { ...typography.bodySmall, fontWeight: '600', color: theme.textSecondary, width: 84 },
    catVal: { ...typography.bodySmall, color: theme.textSecondary, flex: 1, textAlign: 'right' },

    estRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    estBig: { fontSize: 30, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
    estLabel: { ...typography.bodySmall, fontWeight: '600', color: theme.text },
    estTarget: { ...typography.bodySmall, color: theme.textSecondary, marginTop: spacing.xxs },
    estLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, alignSelf: 'flex-start' },
    estLinkText: { fontSize: 12, fontWeight: '700' },
    stimulus: { ...typography.bodySmall, color: theme.text, marginTop: ROW_PAD },
    afterClass: { ...typography.caption, color: theme.textSecondary, marginTop: spacing.xs },

    bottomBar: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingHorizontal: CARD_PAD, paddingTop: ROW_PAD, gap: 12,
      backgroundColor: theme.background,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
    },
    iconRow: { flexDirection: 'row', justifyContent: 'space-between' },
    iconBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
    iconText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },
    ctaRow: { flexDirection: 'row', gap: 10 },

    modalBg: { flex: 1, backgroundColor: theme.modalBackdrop, justifyContent: 'flex-end' },
    menuSheet: { backgroundColor: theme.modalCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
    menuItemText: { fontSize: 15, fontWeight: '600', color: theme.text },
    modalSheet: { backgroundColor: theme.modalCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
    modalLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textSecondary, marginTop: 12, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card },
    chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
    input: {
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, fontSize: 14, marginTop: 12,
    },
  });
}
