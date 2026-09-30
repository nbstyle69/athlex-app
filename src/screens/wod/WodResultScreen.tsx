/**
 * AthleX — Résultat du générateur (brief §8, page résultat)
 * Reprend les composants du Whiteboard : carte WOD (badge GÉNÉRÉ, titre, sous-titre,
 * « Voir détails & score », bouton minuteur), liste de mouvements dépliables (charges /
 * substitutions de toutes les catégories), durée estimée compacte + stimulus, et une barre
 * d'actions fixe au-dessus de la tab bar : Re-tirer, Enregistrer, Favori, Minuteur,
 * Ajouter au Whiteboard, Saisir mon score, menu ⋯ (Copier / Partager).
 */

import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Alert, Share,
  KeyboardAvoidingView, Platform, Pressable, AppState,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, ChevronDown, ChevronUp, RefreshCw, Bookmark, Heart, Check, Copy, Trophy, X, Timer as TimerIcon, Clock, MoreHorizontal, Share2, ClipboardList } from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton, AxCard, AxChip, AxGlass, AxTag, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import TimerLaunchModal, { TimerRunParams } from '../../components/wod/TimerLaunchModal';
import DateField from '../../components/DateField';
import i18n from '../../i18n';
import { captureError } from '../../lib/sentry';
import { hapticSuccess } from '../../lib/haptics';
import { maskTimeInput, timeStringToSeconds } from '../../utils/tournamentUtils';
import { buildFullSeqBlockFromWOD, buildMuscuSplitBlock } from '../../utils/wodToTimer';
import { clearWodDraft, saveWodDraft } from '../../services/wodDraft';
import {
  CATEGORY_LABEL, FUNCTIONAL_CATEGORIES, HYBRID_CATEGORIES,
  TIME_BOUNDED,
} from '../../../packages/wod-engine/src';
import type { Category, GeneratedBlock, GeneratedMovement, GeneratedWod, MuscuWod } from '../../../packages/wod-engine/src';
import type { SkeletonFormat } from '../../../packages/wod-engine/src';
import { FORMATS, INTENTIONS } from './wodGeneratorOptions';
import {
  GenerateResult, PerformedExercise, ScoreInputType, ScoreSubmission, ScreenParams, addToWhiteboard, editorFieldsOf,
  isMuscuWod, redraw, saveGeneratedWod, scoreInputTypeFor, setFavorite, submitGeneratedScore,
  totalTonnage,
} from '../../services/wodGenerator';
import {
  ServerStrengthSession, StrengthSourceKey, fetchStrengthSession, gridFromServer, isNetworkError, loadStrengthGrid,
  saveStrengthDraft, validationErrorCode,
} from '../../services/strengthSets';
import { draftsToPerformed, performedToDrafts, validateMuscuSession } from '../../services/muscuSession';
import type { StrengthSaveState } from '../../components/wod/StrengthSetGrid';
import { muscuDisplayedFor } from './muscuOptions';
import MuscuSessionCard, { initialPerformed } from './MuscuSessionCard';
import { useConfirmDialog } from '../../components/ConfirmDialog';

export type WodResultParams = {
  screen: ScreenParams;
  result: GenerateResult;
  /** B6 : reprise du brouillon local — charges saisies et score déjà posé. */
  draft?: { performed?: PerformedExercise[]; submittedScore?: ScoreSubmission | null };
  /** Séance Musculation reprise depuis le serveur : WOD déjà enregistré (`generated_wods.id`). */
  savedId?: string;
};

/** Brouillon de la séance Musculation enregistré ~0,8 s après la dernière frappe. */
export const MUSCU_DRAFT_SAVE_DELAY_MS = 800;
const OFFLINE_RETRY_MS = 15000;
type Route = RouteProp<{ WodResult: WodResultParams }, 'WodResult'>;

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

export function mmss(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function minutesText(min: number): string {
  return mmss(Math.round(min * 60));
}

export function qtyText(m: GeneratedMovement, block: GeneratedBlock): string {
  if (block.format === 'tabata') {
    const work = block.rest?.work_s ?? 20;
    return m.unit === 's' ? `Tenue ${work} s ·` : `Max ${m.unit} en ${work} s ·`;
  }
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

/** Minuteur libre pour une séance de séries (pas de Split en M2) : durée estimée en compte à rebours. */
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
  const dialog = useConfirmDialog();

  const [result, setResult] = useState<GenerateResult>(route.params.result);
  const { wod, category } = result;
  const screen = route.params.screen;
  const muscu: MuscuWod | null = isMuscuWod(wod) ? wod : null;
  const metcon: GeneratedWod | null = isMuscuWod(wod) ? null : wod;
  // G3 : un EMOM, un AMRAP, une séance de séries sont bornés par leur durée —
  // afficher « Cap » dessus est faux. « Cap » ne vaut que pour les formats
  // scorés au temps (For time, chipper…), où c'est un plafond à ne pas franchir.
  const borneParDuree = metcon ? TIME_BOUNDED.has(metcon.format) && !(metcon.format === 'ladder' && !metcon.blocks[0].ladder) : true;

  const FORMAT_OBTENU: Record<SkeletonFormat, string> = {
    amrap: 'AMRAP', for_time: 'For time', rounds_for_time: 'Rounds for time', chipper: 'Chipper', ladder: 'Ladder',
    emom: 'EMOM', death_by: 'Death by', tabata: 'Tabata', interval: 'Intervalles', stations: 'Stations', continuous: 'Continu',
  };
  const formatRelache = (() => {
    if (!metcon || screen.discipline === 'musculation') return null;
    const rel = metcon.generator.relaxations;
    const parts: string[] = [];
    const demande = screen.format;
    if (demande && demande !== 'surprise' && rel.includes('format')) {
      const fmt = FORMATS.find((f) => f.key === demande)?.label ?? demande;
      const intention = INTENTIONS[metcon.discipline].find((i) => i.key === metcon.intention)?.label ?? metcon.intention;
      parts.push(`Aucun ${fmt} disponible en ${intention} — voici un ${FORMAT_OBTENU[metcon.format]}.`);
    }
    return parts.length ? parts.join(' ') : null;
  })();
  const c = theme.ax;
  const accent = c.accentText;
  const categories: readonly Category[] = wod.discipline === 'hybrid' ? HYBRID_CATEGORIES : FUNCTIONAL_CATEGORIES;

  const [redrawing, setRedrawing] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(route.params.savedId ?? null);
  const [saving, setSaving] = useState(false);
  const [favorite, setFav] = useState(false);
  const [openRows, setOpenRows] = useState<ReadonlySet<number>>(() => new Set());
  const toggleRow = (i: number) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  const [allCategories, setAllCategories] = useState(false);
  const [menu, setMenu] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [boxWodId, setBoxWodId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // B7 : date libre (passé et futur), jour même par défaut
  const [wbModal, setWbModal] = useState(false);
  const [wbDate, setWbDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [scoreModal, setScoreModal] = useState(false);
  const [scoreType, setScoreType] = useState<ScoreInputType>(metcon ? scoreInputTypeFor(metcon) : 'weight');
  const [scoreInput, setScoreInput] = useState('');
  const [scoreCategory, setScoreCategory] = useState<Category>(category);
  const [scoreNotes, setScoreNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedScore, setSubmittedScore] = useState<ScoreSubmission | null>(route.params.draft?.submittedScore ?? null);
  const [performed, setPerformed] = useState<PerformedExercise[]>(() => route.params.draft?.performed ?? (muscu ? initialPerformed(muscu) : []));

  // Séance Musculation côté serveur (source `generated`, clé = WOD enregistré).
  const [strengthServer, setStrengthServer] = useState<ServerStrengthSession | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<StrengthSaveState>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftDirtyTick, setDraftDirtyTick] = useState(0);
  const strengthValidated = strengthServer?.session?.status === 'validated';
  const performedRef = useRef(performed);
  performedRef.current = performed;
  const savedIdRef = useRef(savedId);
  savedIdRef.current = savedId;
  const editedAtRef = useRef<string | null>(null);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<string>>(Promise.resolve('saved'));
  const strengthKeyFor = useCallback(
    (sourceId: string): StrengthSourceKey | null => (user ? { userId: user.id, sourceType: 'generated', sourceId } : null),
    [user],
  );

  const applyServerSession = useCallback((m: MuscuWod, server: ServerStrengthSession) => {
    setStrengthServer(server);
    baseUpdatedAtRef.current = server.session?.updatedAt ?? null;
    setDraftSavedAt(server.session?.updatedAt ?? null);
    const base = initialPerformed(m);
    setPerformed(draftsToPerformed(base, gridFromServer(performedToDrafts(m, base), server.sets)));
  }, []);

  /**
   * Envoie le brouillon (jamais deux envois en parallèle). Le WOD est enregistré
   * au premier envoi : son id est la clé de la séance, retrouvée sur un autre appareil.
   */
  const saveDraftNow = useCallback((): Promise<string> => {
    const run = async (): Promise<string> => {
      const editedAt = editedAtRef.current;
      if (!user || !muscu || !editedAt) return 'saved';
      setDraftSaveState('saving');
      let id = savedIdRef.current;
      if (!id) {
        try {
          id = await saveGeneratedWod(user.id, muscu, category);
        } catch (e) {
          captureError(e, { screen: 'WodResult', action: 'saveForDraft' });
          const status = isNetworkError(e) ? 'offline' : 'refused';
          setDraftSaveState(status);
          return status;
        }
        savedIdRef.current = id;
        setSavedId(id);
        clearWodDraft(user.id);
      }
      const res = await saveStrengthDraft({
        userId: user.id,
        sourceType: 'generated',
        sourceId: id,
        sourceTitle: muscu.title,
        drafts: performedToDrafts(muscu, performedRef.current),
        editedAt,
        baseUpdatedAt: baseUpdatedAtRef.current,
      });
      if (res.status === 'saved') {
        if (editedAtRef.current === editedAt) editedAtRef.current = null;
        baseUpdatedAtRef.current = res.updatedAt;
        setDraftSavedAt(res.updatedAt);
        setDraftSaveState('idle');
      } else if (res.status === 'server_newer') {
        editedAtRef.current = null;
        applyServerSession(muscu, res.server);
        setDraftSaveState('serverNewer');
      } else {
        // Coupure réseau (nouvel essai automatique) ou refus du serveur (aucune
        // boucle) : la saisie reste, la version serveur de référence est celle
        // que cet envoi a pu écrire.
        baseUpdatedAtRef.current = res.baseUpdatedAt;
        setDraftSaveState(res.status);
      }
      return res.status;
    };
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }, [user, muscu, category, applyServerSession]);

  // Reprise : séance et séries du serveur ; une copie locale restée hors
  // connexion repart si le serveur n'a pas plus récent.
  const resumedFor = useRef<string | null>(null);
  useEffect(() => {
    const id = route.params.savedId;
    const key = id ? strengthKeyFor(id) : null;
    if (!muscu || !key || resumedFor.current === key.sourceId) return;
    resumedFor.current = key.sourceId;
    const base = initialPerformed(muscu);
    loadStrengthGrid(key, performedToDrafts(muscu, base)).then((res) => {
      if (res.server) {
        setStrengthServer(res.server);
        baseUpdatedAtRef.current = res.server.session?.updatedAt ?? null;
        setDraftSavedAt(res.server.session?.updatedAt ?? null);
      }
      if (res.origin !== 'prescription') setPerformed(draftsToPerformed(base, res.drafts));
      if (res.server?.session?.status === 'validated') {
        const value = totalTonnage(draftsToPerformed(base, res.drafts));
        setSubmittedScore((prev) => prev ?? { wodId: key.sourceId, scoreType: 'weight', value, category: 'rx', notes: '' });
      }
      if (res.pending) {
        editedAtRef.current = res.pending.editedAt;
        baseUpdatedAtRef.current = res.pending.baseUpdatedAt;
        if (res.offline) setDraftSaveState('offline');
        else if (res.refused) setDraftSaveState('refused');
        else saveDraftNow();
      }
    }).catch((e) => captureError(e, { screen: 'WodResult', action: 'loadStrengthGrid' }));
  }, [muscu, route.params.savedId, strengthKeyFor, saveDraftNow]);

  useEffect(() => {
    if (!muscu || strengthValidated || !editedAtRef.current) return undefined;
    const id = setTimeout(() => { saveDraftNow(); }, MUSCU_DRAFT_SAVE_DELAY_MS);
    return function cancelDraftSave() { clearTimeout(id); };
  }, [draftDirtyTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hors connexion : nouvel essai au retour au premier plan et à intervalle.
  useEffect(() => {
    if (draftSaveState !== 'offline') return undefined;
    const id = setInterval(() => { saveDraftNow(); }, OFFLINE_RETRY_MS);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') saveDraftNow(); });
    return function stopOfflineRetry() { clearInterval(id); sub.remove(); };
  }, [draftSaveState, saveDraftNow]);

  // Une saisie pas encore partie part quand on quitte l'écran.
  const saveDraftNowRef = useRef(saveDraftNow);
  saveDraftNowRef.current = saveDraftNow;
  useEffect(() => () => { if (editedAtRef.current) saveDraftNowRef.current(); }, []);

  function onPerformedChange(next: PerformedExercise[]) {
    performedRef.current = next;
    setPerformed(next);
    if (muscu && !strengthValidated) {
      editedAtRef.current = new Date().toISOString();
      setDraftDirtyTick((t) => t + 1);
    }
  }

  async function onSaveMuscuLater() {
    if (!editedAtRef.current) editedAtRef.current = new Date().toISOString();
    const status = await saveDraftNow();
    if (status === 'offline') Alert.alert(i18n.t('strengthSession.offlineSavedTitle'), i18n.t('strengthSession.offline'));
    else if (status === 'refused') Alert.alert(i18n.t('strengthSession.refusedTitle'), i18n.t('strengthSession.refused'));
  }

  // B6 : brouillon local tant que la séance n'est pas enregistrée — écrit à
  // chaque changement (tirage, charges saisies, score), effacé à l'enregistrement.
  useEffect(() => {
    if (!user || savedId) return;
    saveWodDraft(user.id, { screen, result, performed, submittedScore });
  }, [user, savedId, screen, result, performed, submittedScore]);

  const headerLine = useMemo(() => wod.description.split('\n')[0] ?? '', [wod.description]);
  const estimate = metcon ? metcon.estimate.by_category[category] : null;
  const displayedFor = muscu ? muscuDisplayedFor(user?.level ?? null) : displayedForText(category, !!user?.level);
  const timerBlock = useMemo(
    // B5 : une séance Musculation part en mode Split (séries, repos de chaque exercice)
    () => (isMuscuWod(wod) ? buildMuscuSplitBlock(wod) : buildFullSeqBlockFromWOD(editorFieldsOf(wod))),
    [wod],
  );

  function resetFor(next: GenerateResult) {
    setResult(next);
    setSavedId(null);
    setFav(false);
    setOpenRows(new Set());
    setAllCategories(false);
    setBoxWodId(null);
    setSubmittedScore(null);
    setScoreType(isMuscuWod(next.wod) ? 'weight' : scoreInputTypeFor(next.wod));
    setScoreCategory(next.category);
    setPerformed(isMuscuWod(next.wod) ? initialPerformed(next.wod) : []);
    editedAtRef.current = null;
    baseUpdatedAtRef.current = null;
    setStrengthServer(null);
    setDraftSaveState('idle');
    setDraftSavedAt(null);
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
      clearWodDraft(user.id);
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

  function onAddToWhiteboard() {
    if (!user) return;
    if (boxWodId) {
      navigation.navigate('Whiteboard', { screen: 'WhiteboardMain' });
      return;
    }
    setWbDate(new Date().toISOString().slice(0, 10));
    setWbModal(true);
  }

  const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

  async function onConfirmWhiteboard() {
    if (!user || !DATE_ISO.test(wbDate)) return;
    setWbModal(false);
    const id = await onSave();
    if (!id) return;
    setAdding(true);
    try {
      const created = await addToWhiteboard(user.id, wod, id, submittedScore, wbDate);
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
    if (muscu) { await onSubmitMuscuScore(muscu); return; }
    if (!metcon) return;
    const value = scoreType === 'time' ? timeStringToSeconds(scoreInput) : parseFloat(scoreInput);
    if (isNaN(value) || value <= 0) { Alert.alert('Score invalide'); return; }
    const id = await onSave();
    if (!id) return;
    setSubmitting(true);
    try {
      const submission: ScoreSubmission = { wodId: id, scoreType, value, category: scoreCategory, notes: scoreNotes };
      await submitGeneratedScore(user, currentBox?.id, metcon, submission);
      setSubmittedScore(submission);
      hapticSuccess();
      setScoreModal(false);
      dialog.afterModalClose();
      setScoreInput('');
      setScoreNotes('');
      dialog.show(
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

  /**
   * Musculation : séance validée par validate_strength_session, score = tonnage
   * des séries saisies ; compteur et crédit movement_logs à la première validation seulement.
   */
  async function onSubmitMuscuScore(m: MuscuWod) {
    if (!user) return;
    const tonnage = totalTonnage(performed);
    if (tonnage <= 0) { Alert.alert('Aucune série chargée', 'Renseigne les reps et la charge de tes séries dans la carte Séance.'); return; }
    const id = await onSave();
    if (!id) return;
    const key = strengthKeyFor(id);
    setSubmitting(true);
    try {
      await saveChainRef.current;
      await validateMuscuSession(user, currentBox?.id, m, { wodId: id, performed, notes: scoreNotes }, strengthServer?.sets ?? []);
      editedAtRef.current = null;
      setDraftSaveState('idle');
      setStrengthServer((prev) => ({
        session: {
          plannedSets: null, maxLoadKg: null, firstValidatedAt: null, updatedAt: new Date().toISOString(),
          ...prev?.session, status: 'validated',
        },
        sets: prev?.sets ?? [],
      }));
      if (key) fetchStrengthSession(key).then(setStrengthServer).catch((e) => captureError(e, { screen: 'WodResult', action: 'refreshStrength' }));
      setSubmittedScore({ wodId: id, scoreType: 'weight', value: tonnage, category: 'rx', notes: scoreNotes });
      hapticSuccess();
      setScoreModal(false);
      dialog.afterModalClose();
      setScoreInput('');
      setScoreNotes('');
      dialog.show(
        i18n.t('wodGenerator.scoreSavedTitle'),
        i18n.t('wodGenerator.scoreSavedBody'),
        [
          { text: i18n.t('common.ok'), style: 'cancel' },
          { text: i18n.t('wodGenerator.seeMyHistory'), onPress: () => navigation.navigate('WodHistory') },
        ],
      );
    } catch (e) {
      const code = validationErrorCode(e);
      if (!code) {
        captureError(e, { screen: 'WodResult', action: 'submitScore' });
        if (!strengthValidated) {
          if (!editedAtRef.current) editedAtRef.current = new Date().toISOString();
          saveDraftNow();
        }
        Alert.alert(i18n.t('strengthSession.errorTitle'), i18n.t(isNetworkError(e) ? 'strengthSession.errorOffline' : 'strengthSession.refused'));
      } else if (code === 'SEANCE_VIDE') {
        Alert.alert(i18n.t('strengthSession.errorTitle'), i18n.t('strengthSession.errorEmpty'));
      } else if (code === 'SERIES_EN_DOUBLE') {
        Alert.alert(i18n.t('strengthSession.errorTitle'), i18n.t('strengthSession.errorDuplicate'));
      } else if (code.startsWith('RECORD_')) {
        Alert.alert(i18n.t('strengthSession.errorTitle'), i18n.t('strengthSession.errorRecord'));
      } else {
        captureError(e, { screen: 'WodResult', action: 'submitScore' });
        Alert.alert(i18n.t('strengthSession.errorTitle'), i18n.t('strengthSession.refused'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const bottomBarPadding = tabBarHeight > 0 ? tabBarHeight : insets.bottom;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title="Ton WOD" />

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: bottomBarPadding + 150 }]} showsVerticalScrollIndicator={false}>
        {formatRelache && (
          <AxCard style={S.relache} testID="wodresult-format-relache">
            <Text style={[axTypography.bodySmall, { color: c.text }]}>{formatRelache}</Text>
          </AxCard>
        )}
        {/* Carte WOD (Whiteboard) */}
        <AxCard variant="featured" style={S.wodCard} testID="wodresult-card">
          <View style={S.wodCardInner}>
          <View style={S.wodCardTop}>
            <AxTag label="Généré" tone="accent" testID="wodresult-generated-tag" />
            {wod.time_cap_seconds != null && (
              <View style={S.timeCap}>
                <Clock color={c.textMuted} size={12} />
                <Text style={S.timeCapText}>{borneParDuree ? 'Durée' : 'Cap'} {mmss(wod.time_cap_seconds)}</Text>
              </View>
            )}
            {metcon?.vest && metcon.vest.mode !== 'none' && (
              <Text style={S.timeCapText}>
                Gilet {metcon.vest.mode === 'optional' ? 'optionnel ' : ''}{metcon.vest.load_kg_by_category[category] ?? ''} kg
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
              style={S.timerBtn}
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
        </AxCard>

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

        {muscu && (
          <>
            <MuscuSessionCard
              wod={muscu}
              accent={accent}
              performed={performed}
              onPerformedChange={onPerformedChange}
              draft={{ saveState: draftSaveState, savedAt: draftSavedAt, validated: strengthValidated, onSaveLater: onSaveMuscuLater }}
            />
            <AxCard style={S.card}>
              <View style={S.cardInner}>
              <View style={S.estRow}>
                <Text style={S.estBig} testID="wodresult-estimate">{minutesText(muscu.estimate.minutes)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.estLabel}>Durée estimée</Text>
                  <Text style={S.estTarget}>{muscu.blocks[0].exercises.length} exercices · repos compris</Text>
                </View>
              </View>
              <Text style={S.stimulus}>Stimulus · RPE {fmtNum(muscu.stimulus.rpe)} — {muscu.stimulus.note}</Text>
              {muscu.after_class && muscu.after_class.excluded_muscles.length > 0 && (
                <Text style={S.afterClass}>Après ma classe : muscles évités {muscu.after_class.excluded_muscles.join(', ')}.</Text>
              )}
              </View>
            </AxCard>
          </>
        )}

        {/* Mouvements */}
        {metcon && (<>
        <AxCard style={S.card} testID="wodresult-movements">
          <View style={S.cardInner}>
          {metcon.blocks[0].movements.map((m, i) => {
            const open = openRows.has(i);
            const line = categoryLine(m, category, true);
            return (
              <View
                key={`${m.id}-${i}`}
                style={[S.moveRow, i === 0 && S.moveRowFirst, i === metcon.blocks[0].movements.length - 1 && S.moveRowLast, i > 0 && S.moveRowBorder]}
              >
                <TouchableOpacity style={S.moveHead} onPress={() => toggleRow(i)} activeOpacity={0.8} testID={`wodresult-move-${i}`}>
                  <View style={S.bullet} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.moveText}>
                      {m.round != null ? <Text style={S.moveRound}>R{m.round} · </Text> : null}
                      <Text style={[S.moveQty, { color: accent }]}>{qtyText(m, metcon.blocks[0])}</Text> {m.name}
                    </Text>
                    <Text style={S.moveSub}>{line ?? 'Toutes catégories'}</Text>
                  </View>
                  {open
                    ? <ChevronUp color={c.textMuted} size={18} />
                    : <ChevronDown color={c.textMuted} size={18} />}
                </TouchableOpacity>
                {open && (
                  <View style={S.catTable}>
                    {categories.map((c) => (
                      <View key={c} style={S.catRow}>
                        <Text style={[S.catName, c === category && S.catCurrent]}>{CATEGORY_LABEL[c]}</Text>
                        <Text style={S.catVal}>{categoryLine(m, c, false) ?? '—'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          </View>
        </AxCard>

        {/* Durée estimée */}
        <AxCard style={S.card} testID="wodresult-estimate-card">
          <View style={S.cardInner}>
          <View style={S.estRow}>
            <Text style={S.estBig} testID="wodresult-estimate">
              {estimate ? minutesText(estimate.minutes) : minutesText(metcon.estimate.reference_minutes)}
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
                const e = metcon.estimate.by_category[c];
                return e ? (
                  <View key={c} style={S.catRow}>
                    <Text style={[S.catName, c === category && S.catCurrent]}>{CATEGORY_LABEL[c]}</Text>
                    <Text style={S.catVal}>{minutesText(e.minutes)} · {e.target}</Text>
                  </View>
                ) : null;
              })}
            </View>
          )}
          <Text style={S.stimulus}>Stimulus · RPE {fmtNum(wod.stimulus.rpe)} — {wod.stimulus.note}</Text>
          {metcon.after_class && (metcon.after_class.excluded_patterns.length > 0 || metcon.after_class.excluded_families.length > 0) && (
            <Text style={S.afterClass}>Complément : évite {[...metcon.after_class.excluded_patterns, ...metcon.after_class.excluded_families].join(', ')}.</Text>
          )}
          </View>
        </AxCard>
        </>)}
      </ScrollView>

      {/* Barre d'actions fixe au-dessus de la tab bar */}
      <View style={S.bottomBar} testID="wodresult-actions">
        <AxGlass color={c.background} opacity={0.8} radius={0} />
        <View style={[S.bottomBarInner, { paddingBottom: bottomBarPadding + ROW_PAD }]}>
        <View style={S.iconRow}>
          <TouchableOpacity style={S.iconBtn} onPress={onRedraw} disabled={redrawing} activeOpacity={0.8} testID="wodresult-redraw">
            {redrawing ? <ActivityIndicator color={accent} size="small" /> : <RefreshCw size={18} color={accent} />}
            <Text style={S.iconText}>Re-tirer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={onSave} disabled={saving || !!savedId} activeOpacity={0.8} testID="wodresult-save">
            {saving ? <ActivityIndicator color={c.text} size="small" /> : savedId ? <Check size={18} color={accent} /> : <Bookmark size={18} color={c.text} />}
            <Text style={S.iconText}>{savedId ? 'Enregistré' : 'Enregistrer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={onFavorite} activeOpacity={0.8} testID="wodresult-favorite">
            <Heart size={18} color={c.danger} fill={favorite ? c.danger : 'transparent'} />
            <Text style={S.iconText}>Favori</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => setTimerOpen(true)} activeOpacity={0.8} testID="wodresult-timer-bar">
            <TimerIcon size={18} color={c.text} />
            <Text style={S.iconText}>Minuteur</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.iconBtn} onPress={() => setMenu(true)} activeOpacity={0.8} testID="wodresult-more">
            <MoreHorizontal size={18} color={c.text} />
            <Text style={S.iconText}>Plus</Text>
          </TouchableOpacity>
        </View>
        <View style={S.ctaRow}>
          <View style={S.ctaCell}>
            <AxButton
              variant="outline"
              icon={boxWodId ? Check : ClipboardList}
              label={boxWodId ? 'Sur le Whiteboard' : 'Ajouter au Whiteboard'}
              onPress={onAddToWhiteboard}
              loading={adding}
              fullWidth
              testID="wodresult-whiteboard"
            />
          </View>
          <View style={S.ctaCell}>
            <AxButton
              variant="accent"
              icon={Trophy}
              label={submittedScore ? 'Modifier mon score' : 'Saisir mon score'}
              onPress={() => setScoreModal(true)}
              fullWidth
              testID="wodresult-score"
            />
          </View>
        </View>
        </View>
      </View>

      {/* B7 : date d'ajout au Whiteboard */}
      <Modal visible={wbModal} transparent animationType="fade" onRequestClose={() => setWbModal(false)}>
        <TouchableOpacity style={S.modalBg} activeOpacity={1} onPress={() => setWbModal(false)}>
          <TouchableOpacity activeOpacity={1} style={S.modalSheet} onPress={() => {}}>
            <Text style={S.modalTitle}>Ajouter au Whiteboard</Text>
            <Text style={S.modalText}>
              {muscu ? 'Un bloc par exercice, à valider et scorer un par un.' : 'Le WOD rejoint « Mes WODs perso » à la date choisie.'}
            </Text>
            <DateField style={S.input} value={wbDate} onChangeText={setWbDate} theme={theme} />
            <View style={S.dayRow}>
              {([[-1, 'Hier'], [0, "Aujourd'hui"], [1, 'Demain']] as const).map(([d, label]) => (
                <AxChip
                  key={label}
                  label={label}
                  onPress={() => { const x = new Date(); x.setDate(x.getDate() + d); setWbDate(x.toISOString().slice(0, 10)); }}
                  testID={`wodresult-wb-day-${d}`}
                />
              ))}
            </View>
            <View style={S.modalCta}>
              <AxButton label="Ajouter" onPress={onConfirmWhiteboard} disabled={!DATE_ISO.test(wbDate)} fullWidth testID="wodresult-wb-confirm" />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
              <Copy size={18} color={c.text} />
              <Text style={S.menuItemText}>Copier le WOD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.menuItem} onPress={onShare} activeOpacity={0.7} testID="wodresult-share">
              <Share2 size={18} color={c.text} />
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
              <TouchableOpacity onPress={() => setScoreModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={20} color={c.textMuted} /></TouchableOpacity>
            </View>
            {muscu ? (
              <>
                <Text style={S.modalLabel}>Tonnage des séries saisies</Text>
                <Text style={S.estBig} testID="wodresult-muscu-tonnage">{fmtNum(totalTonnage(performed))} kg</Text>
                <Text style={S.estTarget}>charge × reps, d'après la carte Séance — les badges comptent les reps réellement faites.</Text>
              </>
            ) : (<>
            <Text style={S.modalLabel}>Catégorie réalisée</Text>
            <View style={S.chipRow}>
              {categories.map((cat) => (
                <AxChip key={cat} label={CATEGORY_LABEL[cat]} selected={scoreCategory === cat} onPress={() => setScoreCategory(cat)} testID={`wodresult-score-cat-${cat}`} />
              ))}
            </View>
            <Text style={S.modalLabel}>Type de score</Text>
            <View style={S.chipRow}>
              {SCORE_TYPES.map((s) => (
                <AxChip key={s.key} label={s.label} selected={scoreType === s.key} onPress={() => { setScoreType(s.key); setScoreInput(''); }} testID={`wodresult-score-type-${s.key}`} />
              ))}
            </View>
            <View style={S.field}>
              <AxTextField
                placeholder={scoreType === 'time' ? 'mm:ss' : scoreType === 'rounds' ? 'Rounds (ex. 7)' : scoreType === 'weight' ? 'kg' : 'Reps totales'}
                keyboardType="numeric"
                value={scoreInput}
                onChangeText={(v) => setScoreInput(scoreType === 'time' ? maskTimeInput(v) : v)}
                testID="wodresult-score-input"
              />
            </View>
            </>)}
            <View style={S.field}>
              <AxTextField
                placeholder="Notes (optionnel)"
                value={scoreNotes}
                onChangeText={setScoreNotes}
                testID="wodresult-score-notes"
              />
            </View>
            <View style={S.modalCta}>
              <AxButton
                label="Enregistrer mon score"
                onPress={onSubmitScore}
                loading={submitting}
                disabled={submitting}
                icon={Trophy}
                fullWidth
                testID="wodresult-score-submit"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {dialog.element}
    </View>
  );
}

/** Padding intérieur des cartes et de la barre d'actions (tuiles Outils de l'Accueil). */
const CARD_PAD = 20;
/** Espace vertical entre deux lignes de mouvement. */
const ROW_PAD = 14;

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.lg },
    relache: { marginBottom: axSpacing.md, padding: axSpacing.md },

    wodCard: { marginBottom: 0, padding: 0 },
    wodCardInner: { padding: CARD_PAD, gap: 10 },
    wodCardTop: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
    timeCap: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    timeCapText: { ...axTypography.caption, color: c.textMuted },
    wodTitle: { ...axTypography.titleL, color: c.text },
    wodDesc: { ...axTypography.bodySmall, color: c.textMuted },
    wodCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    wodCardAction: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, flexShrink: 1 },
    wodCardActionText: { ...axTypography.labelSmall },
    timerBtn: {
      width: 44, height: 44, borderRadius: axRadius.control,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.border, backgroundColor: c.field,
    },

    displayedFor: { paddingHorizontal: CARD_PAD, paddingVertical: 14 },
    displayedForText: { ...axTypography.bodySmall, color: c.textMuted },
    displayedForLink: { ...axTypography.labelSmall, textDecorationLine: 'underline' },

    card: { marginBottom: 14, padding: 0 },
    cardInner: { padding: CARD_PAD },

    moveRow: { paddingVertical: ROW_PAD },
    moveRowFirst: { paddingTop: 0 },
    moveRowLast: { paddingBottom: 0 },
    moveRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    moveHead: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
    moveText: { ...axTypography.label, color: c.text },
    moveRound: { ...axTypography.caption, color: c.textMuted },
    moveQty: { ...axTypography.label },
    moveSub: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },
    catTable: { marginTop: axSpacing.sm, gap: axSpacing.xs },
    catRow: { flexDirection: 'row', justifyContent: 'space-between', gap: axSpacing.sm, paddingVertical: 2 },
    catName: { ...axTypography.caption, color: c.textMuted, width: 84 },
    catCurrent: { ...axTypography.labelSmall, color: c.accentText },
    catVal: { ...axTypography.caption, color: c.textMuted, flex: 1, textAlign: 'right' },

    estRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    estBig: { ...axTypography.numberM, color: c.text },
    estLabel: { ...axTypography.label, color: c.text },
    estTarget: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },
    estLink: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, marginTop: axSpacing.sm, alignSelf: 'flex-start' },
    estLinkText: { ...axTypography.labelSmall },
    stimulus: { ...axTypography.bodySmall, color: c.text, marginTop: ROW_PAD },
    afterClass: { ...axTypography.caption, color: c.textMuted, marginTop: axSpacing.xs },

    bottomBar: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, overflow: 'hidden',
    },
    bottomBarInner: { paddingHorizontal: CARD_PAD, paddingTop: ROW_PAD, gap: axSpacing.md },
    iconRow: { flexDirection: 'row', justifyContent: 'space-between' },
    iconBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: axSpacing.xs, minHeight: 44 },
    iconText: { ...axTypography.tab, color: c.textMuted },
    ctaRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
    ctaCell: { flex: 1, minWidth: 0 },

    modalBg: { flex: 1, backgroundColor: theme.modalBackdrop, justifyContent: 'flex-end' },
    menuSheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: axSpacing.lg },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingVertical: 14, paddingHorizontal: axSpacing.sm },
    menuItemText: { ...axTypography.label, color: c.text },
    modalSheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: axSpacing['2xl'], paddingBottom: 40 },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: axSpacing.md },
    modalTitle: { ...axTypography.titleM, color: c.text },
    modalText: { ...axTypography.bodySmall, color: c.textMuted, marginTop: axSpacing.xs, marginBottom: axSpacing.md },
    modalLabel: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.md, marginBottom: axSpacing.sm },
    modalCta: { marginTop: axSpacing.lg },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },
    dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, marginTop: axSpacing.sm },
    field: { marginTop: axSpacing.md },
    input: {
      borderWidth: 1, borderColor: c.fieldBorder, backgroundColor: c.field,
      borderRadius: axRadius.control, paddingHorizontal: 14, paddingVertical: axSpacing.md, color: c.text, ...axTypography.body, marginTop: axSpacing.md,
    },
  });
}
