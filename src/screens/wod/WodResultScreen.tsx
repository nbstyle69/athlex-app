/**
 * AthleX — Résultat du générateur (brief §8, page résultat)
 * Affiche un `GeneratedWod` structuré : titre, format, cap, mouvements avec
 * charges / substitutions / variantes pour toutes les catégories, durée estimée
 * et cible pour la catégorie du profil, stimulus. Actions : Re-tirer (nouvelle
 * graine, mêmes paramètres), Enregistrer, Favori, Saisir mon score (catégorie
 * demandée), Copier (seul accès au rendu texte).
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RefreshCw, Bookmark, Heart, Check, Copy, Trophy, X } from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import GlassBackground from '../../components/glass/GlassBackground';
import GlassCard from '../../components/glass/GlassCard';
import i18n from '../../i18n';
import { captureError } from '../../lib/sentry';
import { hapticSuccess } from '../../lib/haptics';
import { maskTimeInput, timeStringToSeconds } from '../../utils/tournamentUtils';
import {
  CATEGORY_LABEL, FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES,
} from '../../../packages/wod-engine/src';
import type { Category, GeneratedMovement, GeneratedWod } from '../../../packages/wod-engine/src';
import {
  GenerateResult, ScoreInputType, ScreenParams, redraw, saveGeneratedWod, scoreInputTypeFor, setFavorite,
  submitGeneratedScore,
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

const SCORE_TYPES: { key: ScoreInputType; label: string }[] = [
  { key: 'time', label: 'Temps' }, { key: 'rounds', label: 'Rounds' }, { key: 'reps', label: 'Reps' }, { key: 'weight', label: 'Charge' },
];

export default function WodResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
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

  const [scoreModal, setScoreModal] = useState(false);
  const [scoreType, setScoreType] = useState<ScoreInputType>(scoreInputTypeFor(wod));
  const [scoreInput, setScoreInput] = useState('');
  const [scoreCategory, setScoreCategory] = useState<Category>(category);
  const [scoreNotes, setScoreNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const block = wod.blocks[0];
  const headerLine = useMemo(() => wod.description.split('\n')[0] ?? '', [wod.description]);
  const estimate = wod.estimate.by_category[category];

  async function onRedraw() {
    if (!user) return;
    setRedrawing(true);
    try {
      const next = await redraw(user, currentBox?.id, screen);
      setResult(next);
      setSavedId(null);
      setFav(false);
      setDetail(null);
      setScoreType(scoreInputTypeFor(next.wod));
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
    try {
      const { Clipboard: RNClipboard } = require('react-native');
      RNClipboard?.setString?.(wod.description);
    } catch (_) { /* presse-papier indisponible : la feuille de partage suffit */ }
    Share.share({ message: `${wod.title}\n${wod.description}` }).catch(() => {});
  }

  async function onSubmitScore() {
    if (!user) return;
    const value = scoreType === 'time' ? timeStringToSeconds(scoreInput) : parseFloat(scoreInput);
    if (isNaN(value) || value <= 0) { Alert.alert('Score invalide'); return; }
    const id = await onSave();
    if (!id) return;
    setSubmitting(true);
    try {
      await submitGeneratedScore(user, currentBox?.id, wod, { wodId: id, scoreType, value, category: scoreCategory, notes: scoreNotes });
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

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={[S.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ChevronLeft color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={S.headerTitle} testID="wodresult-title">{wod.title}</Text>
        <Text style={[S.headerFormat, { color: accent }]}>{headerLine}</Text>
        <View style={S.metaRow}>
          {block.timecap != null && <Meta S={S} label="Cap" value={mmss(block.timecap)} />}
          <Meta S={S} label="Budget" value={`${wod.budget_min} min`} />
          {block.rounds != null && block.rounds > 1 && <Meta S={S} label="Rounds" value={String(block.rounds)} />}
          {wod.vest && wod.vest.mode !== 'none' && (
            <Meta S={S} label="Gilet" value={`${wod.vest.mode === 'optional' ? 'optionnel · ' : ''}${wod.vest.load_kg_by_category[category] ?? ''} kg`} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {/* Mouvements */}
        <GlassCard radius={16} style={S.card}>
          {block.movements.map((m, i) => {
            const open = detail === i;
            const load = loadFor(m, category);
            const sub = m.substitutions_by_category[category];
            const variant = m.variant_by_category[category];
            return (
              <View key={`${m.id}-${i}`} style={[S.moveRow, i > 0 && S.moveRowBorder]}>
                <TouchableOpacity style={S.moveHead} onPress={() => setDetail(open ? null : i)} activeOpacity={0.8} testID={`wodresult-move-${i}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.moveText}>
                      {m.round != null ? <Text style={S.moveRound}>R{m.round} · </Text> : null}
                      <Text style={[S.moveQty, { color: accent }]}>{qtyText(m)}</Text> {m.name}
                    </Text>
                    <Text style={S.moveSub}>
                      {[load && `${CATEGORY_LABEL[category]} ${load}`, sub && `→ ${sub}`, variant && `(${variant})`].filter(Boolean).join(' · ') || 'Toutes catégories'}
                    </Text>
                  </View>
                  <Text style={S.moveMore}>{open ? '−' : '+'}</Text>
                </TouchableOpacity>
                {open && (
                  <View style={S.catTable}>
                    {categories.map((c) => {
                      const l = loadFor(m, c);
                      const s = m.substitutions_by_category[c];
                      const v = m.variant_by_category[c];
                      return (
                        <View key={c} style={S.catRow}>
                          <Text style={[S.catName, c === category && { color: accent, fontWeight: '900' }]}>{CATEGORY_LABEL[c]}</Text>
                          <Text style={S.catVal}>{[l, s ? `→ ${s}` : null, v ? `(${v})` : null].filter(Boolean).join(' · ') || '—'}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </GlassCard>

        {/* Estimation */}
        <GlassCard radius={16} style={S.card}>
          <Text style={S.blockTitle}>Durée estimée</Text>
          <View style={S.estRow}>
            <Text style={S.estBig}>{estimate ? minutesText(estimate.minutes) : minutesText(wod.estimate.reference_minutes)}</Text>
            <Text style={S.estCat}>{CATEGORY_LABEL[category]} · cible {estimate?.target ?? '—'}</Text>
          </View>
          <View style={S.catTable}>
            {categories.filter((c) => c !== category).map((c) => {
              const e = wod.estimate.by_category[c];
              return e ? (
                <View key={c} style={S.catRow}>
                  <Text style={S.catName}>{CATEGORY_LABEL[c]}</Text>
                  <Text style={S.catVal}>{minutesText(e.minutes)} · {e.target}</Text>
                </View>
              ) : null;
            })}
          </View>
          <Text style={S.stimulus}>Stimulus · RPE {fmtNum(wod.stimulus.rpe)} — {wod.stimulus.note}</Text>
          {wod.after_class && (wod.after_class.excluded_patterns.length > 0 || wod.after_class.excluded_families.length > 0) && (
            <Text style={S.afterClass}>Complément : évite {[...wod.after_class.excluded_patterns, ...wod.after_class.excluded_families].join(', ')}.</Text>
          )}
        </GlassCard>

        {/* Actions */}
        <View style={S.actions}>
          <TouchableOpacity style={[S.actionBtn, { borderColor: accent }]} onPress={onRedraw} disabled={redrawing} activeOpacity={0.8} testID="wodresult-redraw">
            {redrawing ? <ActivityIndicator color={accent} /> : <RefreshCw size={16} color={accent} />}
            <Text style={S.actionText}>Re-tirer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.actionBtn, savedId && { backgroundColor: `${accent}18` }]} onPress={onSave} disabled={saving || !!savedId} activeOpacity={0.8} testID="wodresult-save">
            {saving ? <ActivityIndicator color={theme.text} /> : savedId ? <Check size={16} color={accent} /> : <Bookmark size={16} color={theme.text} />}
            <Text style={S.actionText}>{savedId ? 'Enregistré' : 'Enregistrer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={onFavorite} activeOpacity={0.8} testID="wodresult-favorite">
            <Heart size={16} color={theme.error} fill={favorite ? theme.error : 'transparent'} />
            <Text style={S.actionText}>Favori</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.actionBtn} onPress={onCopy} activeOpacity={0.8} testID="wodresult-copy">
            <Copy size={16} color={theme.text} />
            <Text style={S.actionText}>Copier</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[S.scoreBtn, { backgroundColor: accent }]} onPress={() => setScoreModal(true)} activeOpacity={0.9} testID="wodresult-score">
          <Trophy size={18} color={theme.background} />
          <Text style={[S.scoreBtnText, { color: theme.background }]}>Saisir mon score</Text>
        </TouchableOpacity>
      </ScrollView>

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
            <TouchableOpacity style={[S.scoreBtn, { backgroundColor: accent, opacity: submitting ? 0.6 : 1 }]} onPress={onSubmitScore} disabled={submitting} activeOpacity={0.9} testID="wodresult-score-submit">
              {submitting ? <ActivityIndicator color={theme.background} /> : <Text style={[S.scoreBtnText, { color: theme.background }]}>Enregistrer mon score</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Meta({ S, label, value }: { S: ReturnType<typeof createStyles>; label: string; value: string }) {
  return (
    <View style={S.meta}>
      <Text style={S.metaLabel}>{label}</Text>
      <Text style={S.metaValue}>{value}</Text>
    </View>
  );
}

function createStyles(theme: AppTheme) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: theme.text, marginTop: 12 },
  headerFormat: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  meta: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  metaLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textMuted },
  metaValue: { fontSize: 13, fontWeight: '800', color: theme.text },
  content: { padding: 16 },
  card: { padding: 14, marginBottom: 14 },
  blockTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textSecondary, marginBottom: 8 },

  moveRow: { paddingVertical: 10 },
  moveRowBorder: { borderTopWidth: 1, borderTopColor: theme.border },
  moveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moveText: { fontSize: 15, fontWeight: '700', color: theme.text },
  moveRound: { fontSize: 12, color: theme.textMuted, fontWeight: '700' },
  moveQty: { fontWeight: '900' },
  moveSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  moveMore: { fontSize: 18, fontWeight: '800', color: theme.textSecondary, width: 20, textAlign: 'center' },
  catTable: { marginTop: 8, borderRadius: 10, backgroundColor: theme.surface, padding: 8, gap: 4 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  catName: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, width: 84 },
  catVal: { fontSize: 12, color: theme.text, flex: 1, textAlign: 'right' },

  estRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  estBig: { fontSize: 28, fontWeight: '900', color: theme.text },
  estCat: { fontSize: 12, color: theme.textSecondary, flex: 1 },
  stimulus: { fontSize: 13, color: theme.text, marginTop: 10, lineHeight: 18 },
  afterClass: { fontSize: 12, color: theme.textMuted, marginTop: 6 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card,
  },
  actionText: { fontSize: 11, fontWeight: '800', color: theme.text },
  scoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, padding: 16, borderRadius: 16,
  },
  scoreBtnText: { fontSize: 15, fontWeight: '900' },

  modalBg: { flex: 1, backgroundColor: theme.modalBackdrop, justifyContent: 'flex-end' },
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
}); }
