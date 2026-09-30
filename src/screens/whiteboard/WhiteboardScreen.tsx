import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusQuery } from '../../hooks/useFocusQuery';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Clock, ChevronRight, ChevronUp, ChevronDown, Hash, Users, MessageCircle, FileText, Trophy, Sparkles, Newspaper, Play, BookOpen, Check, Timer as TimerIcon, Pencil, ClipboardList } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { wodTypeLabel } from '../../utils/wodTypeLabel';
import { supabase } from '../../lib/supabase';
import { countUnreadMessages } from '../../lib/unreadMessages';
import { captureError } from '../../lib/sentry';
import { hapticSuccess } from '../../lib/haptics';
import { recordActivity, logMovementReps } from '../../services/gamification';
import { computeCompletedMovements } from '../../utils/movementParser';
import { formatCap } from '../../utils/scoreFormat';
import { listProgramWodsByProgram, listProgramRestDaysByProgram } from '../../services/programContent';
import { programSessionsOn, programWeekAt, isRestDay, isoDayOf } from '../../utils/programSchedule';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { BoxWOD } from '../../types';
import { WhiteboardStackParamList } from '../../navigation';
import { buildFullSeqBlockFromWOD } from '../../utils/wodToTimer';
import TimerLaunchModal, { TimerRunParams } from '../../components/wod/TimerLaunchModal';
import WeekDayPicker, { getWeekDates } from '../../components/WeekDayPicker';
import WhiteboardTrackTabs from '../../components/WhiteboardTrackTabs';
import { TrackTab, filterByTab, resolveTab, visibleTabs, whiteboardTrackKey } from '../../utils/whiteboardTracks';
import GlassBackground from '../../components/glass/GlassBackground';
import EmeraldCTAButton from '../../components/glass/EmeraldCTAButton';
import { StrengthWodCardStatus, strengthCardLinkKey } from '../../components/wod/StrengthSetGrid';
import { fetchStrengthSummaries } from '../../services/strengthSets';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { AxButton, AxCard, AxCounterBadge, AxIconButton, AxTag } from '../../components/ax';
import { axAccentSafeLineHeight, axSpacing, axTypography } from '../../theme/axTokens';
import WhiteboardMembersModal, { WhiteboardMember } from './WhiteboardMembersModal';

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Nav = NativeStackNavigationProp<WhiteboardStackParamList>;

type BoxMember = WhiteboardMember;

interface WeekWodRow { id: string; track: string | null; wod_type: string | null }

export default function WhiteboardScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user, currentBox, boxRole, joinBox } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const S = createStyles(theme);
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'fr-FR';

  const [dayWODs,       setDayWODs]       = useState<BoxWOD[]>([]);
  const [completedIds,  setCompletedIds]  = useState<Set<string>>(new Set());
  const [scoredIds,     setScoredIds]     = useState<Set<string>>(new Set());
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [weekOffset,    setWeekOffset]    = useState(0);
  const [selectedDate,  setSelectedDate]  = useState(toISO(new Date()));
  const [membersModal,  setMembersModal]  = useState(false);
  const [members,       setMembers]       = useState<BoxMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Onglets de piste : filtre global de la partie basse de l'écran. `null` tant
  // que la semaine n'a pas répondu, ou quand aucune piste n'y a de contenu.
  const [track, setTrack] = useState<TrackTab | null>(null);
  // `undefined` = clé locale pas encore lue ; on ne résout pas l'onglet avant,
  // sinon l'athlète voit Functional clignoter puis basculer sur son choix.
  const [storedTrack, setStoredTrack] = useState<string | null | undefined>(undefined);

  // Program WODs
  interface ProgWodEntry { programTitle: string; weekNumber: number; dayLabel: string; wod: { id: string; title: string; description: string; wod_type: string; time_cap_seconds?: number } }
  const [programWods, setProgramWods] = useState<ProgWodEntry[]>([]);
  // Un programme acheté sans date de début n'a pas de « jour courant » : on le
  // dit à l'athlète, jamais du vide silencieux. Et un jour marqué Repos par le
  // coach s'affiche comme tel, même sans séance.
  type ProgAvis = { programId: string; programTitle: string; progType: string; durationWeeks?: number; daysPerWeek?: number; kind: 'sans_date' | 'repos'; weekNumber: number };
  const [programAvis, setProgramAvis] = useState<ProgAvis[]>([]);

  // Join box state
  const [joinModal, setJoinModal] = useState(false);
  const [joinCode,  setJoinCode]  = useState('');
  const [joining,   setJoining]   = useState(false);

  // Unread badges
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadArticles, setUnreadArticles] = useState(0);

  // Timer-launch modal (preconfigured from a WOD card, mode editable)
  const [timerModalWod, setTimerModalWod] = useState<BoxWOD | null>(null);
  const timerBlock = useMemo(() => (timerModalWod ? buildFullSeqBlockFromWOD(timerModalWod) : null), [timerModalWod]);

  // Personal WODs (when user has no box)
  const [personalWODs, setPersonalWODs] = useState<BoxWOD[]>([]);

  function openTimerModal(wod: BoxWOD) {
    setTimerModalWod(wod);
  }

  function launchTimer(params: TimerRunParams) {
    setTimerModalWod(null);
    navigation.navigate('TimerRun', params);
  }

  const timerModal = (
    <TimerLaunchModal
      visible={!!timerModalWod}
      title={timerModalWod?.title ?? ''}
      initialBlock={timerBlock}
      onClose={() => setTimerModalWod(null)}
      onLaunch={launchTimer}
    />
  );


  useFocusEffect(useCallback(() => {
    if (!user || !currentBox) return;
    (async () => {
      try {
        const [unread, lastArt] = await Promise.all([
          countUnreadMessages(user.id, currentBox.id),
          AsyncStorage.getItem(`lastSeenArticles_${user.id}_${currentBox.id}`),
        ]);
        setUnreadMessages(unread);

        // Unread articles (after last seen)
        let artQuery = supabase
          .from('box_articles')
          .select('id', { count: 'exact', head: true })
          .eq('box_id', currentBox.id);
        if (lastArt) artQuery = artQuery.gt('created_at', lastArt);
        const { count: artCount } = await artQuery;
        setUnreadArticles(artCount ?? 0);
      } catch (_) {}
    })();
  }, [user, currentBox]));

  const loadMembers = useCallback(async () => {
    if (!currentBox) return;
    setMembersLoading(true);
    const { data } = await supabase
      .from('box_members')
      .select('member_id, role, profiles:member_id(id, username, level, elo, avatar_url)')
      .eq('box_id', currentBox.id)
      .eq('status', 'active');
    const profiles = (data ?? [])
      .filter((row: any) => row.profiles)
      .map((row: any) => ({ ...row.profiles, role: row.role }))
      .sort((a: any, b: any) => (b.elo ?? 0) - (a.elo ?? 0));
    setMembers(profiles as BoxMember[]);
    setMembersLoading(false);
  }, [currentBox]);

  useEffect(() => {
    if (!currentBox) { setStoredTrack(null); return; }
    let vivant = true;
    setStoredTrack(undefined);
    AsyncStorage.getItem(whiteboardTrackKey(currentBox.id))
      .then((v) => { if (vivant) setStoredTrack(v); })
      .catch(() => { if (vivant) setStoredTrack(null); });
    return () => { vivant = false; };
  }, [currentBox?.id]);

  const weekBounds = useMemo(() => {
    const dates = getWeekDates(weekOffset);
    return { from: toISO(dates[0]), to: toISO(dates[6]) };
  }, [weekOffset]);

  // Quelles pistes ont du contenu sur la semaine affichée ? Requête légère,
  // deux colonnes, sept jours : le chargement des cartes reste au jour.
  // Si la colonne `track` n'existe pas encore en base (42703), la requête
  // échoue et on rend zéro piste : pas de barre, écran d'avant les onglets.
  const { data: weekTracks } = useFocusQuery(
    ['whiteboard-tracks', currentBox?.id, weekBounds.from, boxRole],
    async () => {
      if (!currentBox) return [];
      const isStaff = boxRole === 'owner' || boxRole === 'coach' || user?.id === currentBox.owner_id;
      let q = supabase.from('box_wods').select('id, track, wod_type')
        .eq('box_id', currentBox.id)
        .gte('scheduled_date', weekBounds.from)
        .lte('scheduled_date', weekBounds.to);
      if (!isStaff) q = q.eq('is_published', true);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as unknown as WeekWodRow[];
    },
    { enabled: !!currentBox },
  );

  const trackTabs = useMemo(() => visibleTabs((weekTracks ?? []).map(r => r.track)), [weekTracks]);

  // États des séances de musculation de l'athlète pour toute la semaine affichée.
  const weekStrengthIds = useMemo(
    () => (weekTracks ?? []).filter(r => r.wod_type === 'strength').map(r => r.id).sort(),
    [weekTracks],
  );
  const { data: strengthByWod } = useFocusQuery(
    ['whiteboard-strength', user?.id, weekStrengthIds.join(',')],
    () => fetchStrengthSummaries(user!.id, 'whiteboard', weekStrengthIds),
    { enabled: !!user && weekStrengthIds.length > 0 },
  );

  // Le choix courant tient s'il a encore du contenu ; sinon Functional, sinon
  // « Tout ». Même règle pour l'athlète neuf, dont le choix mémorisé est vide.
  useEffect(() => {
    if (storedTrack === undefined) return;
    setTrack((prev) => resolveTab(prev ?? storedTrack, trackTabs));
  }, [trackTabs, storedTrack]);

  const choisirPiste = useCallback((tab: TrackTab) => {
    setTrack(tab);
    if (currentBox) AsyncStorage.setItem(whiteboardTrackKey(currentBox.id), tab).catch(() => {});
  }, [currentBox?.id]);

  const { data: wodData, isLoading: wodQueryLoading, refetch: refetchWods } = useFocusQuery(
    ['whiteboard', currentBox?.id, selectedDate, boxRole],
    async () => {
    if (!currentBox) return [];

    // 1. Fetch user's group memberships (via members uuid[] array on message_groups)
    const { data: myGroupRows } = user
      ? await supabase.from('message_groups').select('id, wod_visibility_mode').eq('box_id', currentBox.id).contains('members', [user.id])
      : { data: [] };
    const myGroupIds = new Set((myGroupRows ?? []).map((r: any) => r.id));

    // Build visibility mode map from the same query (already fetched wod_visibility_mode)
    const groupVisibility: Record<string, string> = {};
    for (const g of (myGroupRows ?? []) as any[]) {
      groupVisibility[g.id] = g.wod_visibility_mode ?? 'weekly';
    }

    const todayISO = toISO(new Date());
    const isFutureDate = selectedDate > todayISO;

    // Fetch user's active program memberships for this box
    let myProgramIds = new Set<string>();
    if (user) {
      const { data: progMem } = await supabase
        .from('program_members')
        .select('program_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      for (const r of (progMem ?? []) as any[]) myProgramIds.add(r.program_id);
    }

    const isStaff = boxRole === 'owner' || boxRole === 'coach' || user?.id === currentBox.owner_id;
    let query = supabase
      .from('box_wods')
      .select('*')
      .eq('box_id', currentBox.id)
      .eq('scheduled_date', selectedDate)
      .order('sort_order');
    if (!isStaff) query = query.eq('is_published', true);
    const { data: dayData } = await query;

    const allWodIds = (dayData ?? []).map((w: any) => w.id);

    // 2. Fetch group access restrictions
    let accessMap: Record<string, string[]> = {};
    let programAccessMap: Record<string, string[]> = {};
    if (allWodIds.length > 0) {
      const { data: accessRows } = await supabase
        .from('wod_group_access')
        .select('wod_id, group_id')
        .in('wod_id', allWodIds);
      for (const r of (accessRows ?? []) as any[]) {
        if (!accessMap[r.wod_id]) accessMap[r.wod_id] = [];
        accessMap[r.wod_id].push(r.group_id);
      }
      // Fetch program access
      const { data: progAccessRows } = await supabase
        .from('wod_program_access')
        .select('wod_id, program_id')
        .in('wod_id', allWodIds);
      for (const r of (progAccessRows ?? []) as any[]) {
        if (!programAccessMap[r.wod_id]) programAccessMap[r.wod_id] = [];
        programAccessMap[r.wod_id].push(r.program_id);
      }
    }

    // 3. Filter by group access + program access + visibility mode
    //
    // Défense en profondeur assumée, pas autorisation. Depuis la migration
    // 20261113 (lot 5-A), c'est la policy de `box_wods` qui décide : un WOD
    // restreint à un programme ou à un groupe n'arrive plus ici si l'appelant
    // n'y a pas droit. Ce filtre est conservé parce qu'il porte en plus le
    // raffinement `wod_visibility_mode` (semaine à venir), strictement PLUS
    // strict que le serveur — il ne peut donc pas rendre visible ce que la base
    // refuse. Ne jamais s'y fier comme unique barrière : c'était le défaut.
    function canSee(wod: any): boolean {
      if (isStaff) return true;
      const restrictedGroups = accessMap[wod.id];
      const restrictedPrograms = programAccessMap[wod.id];
      const hasGroupRestriction = restrictedGroups && restrictedGroups.length > 0;
      const hasProgramRestriction = restrictedPrograms && restrictedPrograms.length > 0;

      // No restriction at all → visible to all
      if (!hasGroupRestriction && !hasProgramRestriction) return true;

      // Check program access: if user is member of any assigned program → visible
      if (hasProgramRestriction) {
        const matchesProgram = restrictedPrograms!.some(pid => myProgramIds.has(pid));
        if (matchesProgram) return true;
      }

      // Check group access
      if (hasGroupRestriction) {
        const myMatchingGroups = restrictedGroups!.filter(gid => myGroupIds.has(gid));
        if (myMatchingGroups.length > 0) {
          if (isFutureDate) {
            const hasWeekly = myMatchingGroups.some(gid => groupVisibility[gid] === 'weekly');
            if (hasWeekly) return true;
          } else {
            return true;
          }
        }
      }

      return false;
    }

    return (dayData ?? []).filter(canSee) as BoxWOD[];
  },
    { enabled: !!currentBox },
  );

  // Fetch program WODs for selected date
  useEffect(() => {
    if (!user) { setProgramWods([]); return; }
    (async () => {
      try {
        const { data: memberships } = await supabase
          .from('program_members')
          .select('program_id, start_date, programs:program_id(id, title, type, duration_weeks, days_per_week)')
          .eq('user_id', user.id)
          .eq('status', 'active');
        if (!memberships || memberships.length === 0) { setProgramWods([]); setProgramAvis([]); return; }

        const entries: ProgWodEntry[] = [];
        const avis: ProgAvis[] = [];
        // Le contenu vendu vit dans `box_wods`, rattaché par `wod_program_access`.
        // Une séance relative (semaine × jour) tombe sur la date que donne la
        // date de début de l'athlète ; un WOD daté rattaché au programme tombe
        // sur sa date. Aucune des deux ne passe par la requête Whiteboard
        // ci-dessus autrement que par sa propre date.
        const idsProgrammes = (memberships as any[]).map(m => m.program_id);
        const [parProgramme, reposParProgramme] = await Promise.all([
          listProgramWodsByProgram(idsProgrammes),
          listProgramRestDaysByProgram(idsProgrammes),
        ]);

        for (const m of memberships as any[]) {
          const prog = m.programs;
          if (!prog) continue;
          const fiche = { programId: prog.id, programTitle: prog.title, progType: prog.type, durationWeeks: prog.duration_weeks ?? undefined, daysPerWeek: prog.days_per_week ?? undefined };
          if (!m.start_date) {
            avis.push({ ...fiche, kind: 'sans_date', weekNumber: 0 });
            continue;
          }
          const weekNumber = programWeekAt(m.start_date, selectedDate);
          if (weekNumber > 0 && isRestDay(reposParProgramme[prog.id] ?? [], weekNumber, isoDayOf(selectedDate))) {
            avis.push({ ...fiche, kind: 'repos', weekNumber });
            continue;
          }
          const duJour = programSessionsOn(parProgramme[prog.id] ?? [], m.start_date, selectedDate);
          if (duJour.length === 0) continue;

          for (const w of duJour) {
            entries.push({
              programTitle: prog.title,
              weekNumber,
              dayLabel: weekNumber > 0 ? `S${weekNumber}` : '',
              wod: {
                id: w.id,
                title: w.title,
                description: w.description ?? '',
                wod_type: w.wod_type ?? 'custom',
                time_cap_seconds: w.time_cap_seconds ?? undefined,
              },
            });
          }
        }
        setProgramWods(entries);
        setProgramAvis(avis);
      } catch (e) {
        captureError(e, { screen: 'Whiteboard', action: 'fetchProgramWods' });
        setProgramWods([]);
        setProgramAvis([]);
      }
    })();
  }, [user, selectedDate]);

  useEffect(() => {
    if (wodData) { setDayWODs(wodData); setLoading(false); setRefreshing(false); }
    else if (wodQueryLoading) setLoading(true);
  }, [wodData, wodQueryLoading]);

  const shownWODs = useMemo(
    () => (track ? filterByTab(dayWODs, track) : dayWODs),
    [dayWODs, track],
  );

  // Le WOD d'un programme EST un WOD de box : pour un acheteur qui est aussi
  // membre de la box vendeuse, il arrive par les deux listes. On ne l'affiche
  // qu'une fois, dans la liste du jour qui porte score et complétion.
  const programWodsHorsBox = useMemo(() => {
    const idsBox = new Set(dayWODs.map(w => w.id));
    return programWods.filter(e => !idsBox.has(e.wod.id));
  }, [programWods, dayWODs]);

  // Fetch user's completions + submitted scores for the visible WODs
  useEffect(() => {
    if (!user || dayWODs.length === 0) {
      setCompletedIds(new Set());
      setScoredIds(new Set());
      return;
    }
    const ids = dayWODs.map(w => w.id);
    (async () => {
      try {
        const [{ data: comps }, { data: scores }] = await Promise.all([
          supabase.from('wod_completions').select('wod_id').eq('member_id', user.id).in('wod_id', ids),
          supabase.from('wod_scores').select('wod_id').eq('member_id', user.id).in('wod_id', ids),
        ]);
        setCompletedIds(new Set((comps ?? []).map((c: any) => c.wod_id)));
        setScoredIds(new Set((scores ?? []).map((s: any) => s.wod_id)));
      } catch (e) { captureError(e, { screen: 'Whiteboard', action: 'fetchCompletions' }); }
    })();
  }, [user, dayWODs]);

  const toggleCompletion = useCallback(async (wodId: string) => {
    if (!user || !currentBox) return;
    const isDone = completedIds.has(wodId) || scoredIds.has(wodId);
    // If already scored, don't allow toggling (score is authoritative)
    if (scoredIds.has(wodId)) return;
    // Optimistic update
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (isDone) next.delete(wodId); else next.add(wodId);
      return next;
    });
    try {
      if (isDone) {
        await supabase.from('wod_completions').delete().eq('wod_id', wodId).eq('member_id', user.id);
      } else {
        hapticSuccess();
        const { error } = await supabase.from('wod_completions').insert({
          wod_id: wodId, member_id: user.id, box_id: currentBox.id,
        });
        if (error && error.code !== '23505') throw error;
        // Count as activity for streak (only once per wod thanks to unique constraint)
        try { await recordActivity(user.id, currentBox.id); } catch (_) {}
        // Credit movement/exercise badges for the prescribed work.
        // No score here → AMRAP is skipped (unknown rounds = 0 rep, product decision);
        // For Time / EMOM / Tabata / Chipper credit the prescribed reps.
        const doneWod = dayWODs.find(w => w.id === wodId);
        if (doneWod?.description && doneWod.wod_type !== 'amrap') {
          const lines = doneWod.description.split('\n').filter(Boolean);
          const wodFormat = doneWod.wod_type === 'for-time' ? 'For Time'
            : doneWod.wod_type === 'emom' ? 'EMOM'
            : doneWod.wod_type === 'tabata' ? 'Tabata'
            : 'For Time';
          const completed = computeCompletedMovements(lines, wodFormat, 0, 'reps', { gender: user.gender });
          logMovementReps(user.id, completed, 'whiteboard', wodId)
            .catch(e => captureError(e, { screen: 'Whiteboard', action: 'logMovementReps' }));
        }
      }
    } catch (e) {
      // Revert on error
      setCompletedIds(prev => {
        const next = new Set(prev);
        if (isDone) next.add(wodId); else next.delete(wodId);
        return next;
      });
      captureError(e, { screen: 'Whiteboard', action: 'toggleCompletion', wodId });
      Alert.alert(t('common.error'), t('whiteboard.updateFailed'));
    }
  }, [user, currentBox, completedIds, scoredIds, dayWODs]);

  const isStaff = boxRole === 'owner' || boxRole === 'coach' || user?.id === currentBox?.owner_id;

  // `visible` est la liste affichée, filtrée par l'onglet : sur une piste, la
  // carte du dessus est celle que le coach voit, pas une carte d'une autre
  // piste masquée. Les `sort_order` restent écrits sur le jour entier.
  async function moveWod(visible: BoxWOD[], index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= visible.length) return;
    const a = dayWODs.indexOf(visible[index]);
    const b = dayWODs.indexOf(visible[target]);
    if (a < 0 || b < 0) return;
    const updated = [...dayWODs];
    [updated[a], updated[b]] = [updated[b], updated[a]];
    setDayWODs(updated);
    // Persist new sort_order for both swapped WODs
    const promises = updated.map((w, i) =>
      supabase.from('box_wods').update({ sort_order: i }).eq('id', w.id)
    );
    await Promise.all(promises);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoining(true);
    const { error } = await joinBox(joinCode.trim());
    setJoining(false);
    if (error) { Alert.alert(t('common.error'), error); return; }
    setJoinModal(false);
    setJoinCode('');
  }


  // Fetch personal WODs (box_id IS NULL, created_by = user) when no current box
  const loadPersonalWODs = useCallback(async () => {
    if (!user) { setPersonalWODs([]); return; }
    const { data } = await supabase
      .from('box_wods')
      .select('*')
      .is('box_id', null)
      .eq('created_by', user.id)
      .eq('scheduled_date', selectedDate)
      .order('sort_order');
    setPersonalWODs((data ?? []) as BoxWOD[]);
  }, [user, selectedDate]);

  useFocusEffect(useCallback(() => { loadPersonalWODs(); }, [loadPersonalWODs]));

  const c = theme.ax;
  const refreshPersonal = () => { setRefreshing(true); loadPersonalWODs().finally(() => setRefreshing(false)); };
  const dayTitle = (todayISO: string) => (selectedDate === todayISO
    ? t('whiteboard.sessionOfDay')
    : new Date(selectedDate + 'T00:00:00').toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }));
  const capOf = (secs: number | null | undefined) => secs != null && (
    <View style={S.timeCap}>
      <Clock color={c.textMuted} size={12} />
      <Text style={S.timeCapText}>{t('whiteboard.cap', { cap: formatCap(secs) })}</Text>
    </View>
  );
  const typeTag = (wod: { id: string; wod_type?: string | null }) => (
    <AxTag label={wodTypeLabel(wod.wod_type ?? 'custom')} tone="accent" testID={`wod-tag-${wod.id}`} />
  );
  const personalCard = (wod: BoxWOD, lines: number) => (
    <AxCard key={wod.id} onPress={() => navigation.navigate('WODDetail', { wodId: wod.id })} style={S.wodCard} testID={`wod-card-${wod.id}`}>
      <View style={S.wodCardTop}>
        {typeTag(wod)}
        {capOf(wod.time_cap_seconds)}
      </View>
      <Text style={S.wodTitle}>{wod.title}</Text>
      {wod.description ? <Text style={S.wodDesc} numberOfLines={lines}>{wod.description}</Text> : null}
      <View style={S.wodCardFooter}>
        <View style={S.wodCardAction}>
          <Text style={S.wodCardActionText}>{t('whiteboard.seeDetails')}</Text>
          <ChevronRight color={c.accentText} size={14} />
        </View>
        <View style={S.wodCardBtns}>
          <AxIconButton
            icon={Pencil}
            onPress={() => navigation.navigate('PersonalWODForm', { wodId: wod.id, date: selectedDate })}
            accessibilityLabel={t('whiteboard.edit')}
            testID={`wod-edit-${wod.id}`}
          />
          <AxIconButton
            icon={TimerIcon}
            onPress={() => openTimerModal(wod)}
            accessibilityLabel={t('whiteboard.launchTimer')}
            testID={`wod-timer-${wod.id}`}
          />
        </View>
      </View>
    </AxCard>
  );
  const addWodButton = (
    <AxButton
      variant="dashed"
      icon={Sparkles}
      label={t('whiteboard.addWod')}
      onPress={() => navigation.navigate('PersonalWODForm', { date: selectedDate })}
      fullWidth
      testID="whiteboard-add-wod"
    />
  );

  if (!currentBox) {
    const todayISO = toISO(new Date());
    return (
      <View style={S.container}>
        <GlassBackground />
        <ScrollView
          testID="whiteboard-scroll"
          contentContainerStyle={{ paddingBottom: tabSpace }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPersonal} />}
        >
          <View style={S.header} testID="whiteboard-header">
            <Text style={S.headerTitle}>{t('whiteboard.title')}</Text>
          </View>

          <View style={S.topCtaRow}>
            <AxButton icon={Hash} label={t('whiteboard.joinBox')} onPress={() => setJoinModal(true)} fullWidth testID="whiteboard-join-box" />
          </View>

          <WeekDayPicker
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            theme={theme}
            variant="ax"
          />

          <View style={S.section}>
            <Text style={S.sectionTitle}>{dayTitle(todayISO)}</Text>

            {personalWODs.length > 0 ? (
              <View style={S.dayGroup}>
                {personalWODs.map(wod => personalCard(wod, 3))}
                {addWodButton}
              </View>
            ) : (
              <View style={S.noWodCard}>
                <ClipboardList color={c.textMuted} size={36} strokeWidth={1.5} />
                <Text style={S.noWodText}>{t('whiteboard.noWod')}</Text>
                <EmeraldCTAButton
                  icon={<Sparkles size={16} color={theme.ctaText} />}
                  size="md"
                  onPress={() => navigation.navigate('PersonalWODForm', { date: selectedDate })}
                  style={{ marginTop: 14 }}
                >
                  {t('whiteboard.createWod')}
                </EmeraldCTAButton>
              </View>
            )}
          </View>
        </ScrollView>

        {timerModal}

        <Modal visible={joinModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setJoinModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
            <View style={S.joinSheet}>
              <View style={S.joinHandle} />
              <Text style={S.joinSheetTitle}>{t('whiteboard.joinBox')}</Text>
              <Text style={S.joinSheetSub}>{t('whiteboard.joinCodeHint')}</Text>
              <TextInput
                style={S.codeInput}
                value={joinCode}
                onChangeText={text => setJoinCode(text.toUpperCase().slice(0, 6))}
                placeholder={t('whiteboard.codePlaceholder')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                autoFocus
              />
              <TouchableOpacity
                style={[S.joinBtn, (!joinCode.trim() || joining) && { opacity: 0.5 }]}
                onPress={handleJoin}
                disabled={!joinCode.trim() || joining}
                activeOpacity={0.85}
              >
                {joining
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Hash color="#fff" size={16} /><Text style={S.joinBtnText}>{t('whiteboard.join')}</Text></>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const mainWod =
    shownWODs.find(w => w.block_name === 'wod') ??
    shownWODs.find(w => (w as any).leaderboard_enabled === true) ??
    shownWODs.find(w => w.wod_type === 'for-time' || w.wod_type === 'amrap') ??
    shownWODs[0];

  return (
    <View style={S.container}>
      <GlassBackground />
      <ScrollView
        testID="whiteboard-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refetchWods(); }} />}
      >
        <View style={S.header} testID="whiteboard-header">
          <Text style={S.headerTitle}>{t('whiteboard.title')}</Text>
          <Text style={S.headerSub} numberOfLines={1}>{currentBox.name}</Text>
          <View style={S.headerBtns}>
            <View style={S.headerBtn}>
              <AxButton
                variant="outline"
                icon={Users}
                label={t('whiteboard.members')}
                onPress={() => { setMembersModal(true); loadMembers(); }}
                fullWidth
                testID="whiteboard-members"
              />
            </View>
            <View style={S.headerBtn}>
              {unreadMessages > 0 && (
                <View style={S.badge} pointerEvents="none">
                  <AxCounterBadge count={unreadMessages} readableInk testID="whiteboard-messages-badge" />
                </View>
              )}
              <AxButton
                variant="outline"
                icon={MessageCircle}
                label={t('whiteboard.messages')}
                onPress={() => navigation.navigate('Messages')}
                fullWidth
                testID="whiteboard-messages"
              />
            </View>
          </View>
          <View style={S.headerBtns}>
            <View style={S.headerBtn}>
              {unreadArticles > 0 && (
                <View style={S.badge} pointerEvents="none">
                  <AxCounterBadge count={unreadArticles} readableInk testID="whiteboard-news-badge" />
                </View>
              )}
              <AxButton
                variant="outline"
                icon={Newspaper}
                label={t('whiteboard.news')}
                onPress={() => navigation.navigate('Articles')}
                fullWidth
                testID="whiteboard-news"
              />
            </View>
          </View>
          <View style={S.headerBtns}>
            <View style={S.headerBtn}>
              <AxButton
                variant="outline"
                icon={Trophy}
                label={t('whiteboard.boxRanking')}
                onPress={() => navigation.navigate('BoxRanking')}
                fullWidth
                testID="whiteboard-box-ranking"
              />
            </View>
          </View>
        </View>

        <WhiteboardTrackTabs tabs={trackTabs} value={track} onChange={choisirPiste} />

        <WeekDayPicker
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          theme={theme}
          variant="ax"
        />

        {mainWod && (
          <View style={S.quickActions} testID="whiteboard-quick-actions">
            <AxButton
              icon={Sparkles}
              label={t('whiteboard.enterScore')}
              onPress={() => navigation.navigate('WODDetail', { wodId: mainWod.id })}
              fullWidth
              testID="whiteboard-enter-score"
            />
            <AxButton
              variant="outline"
              icon={Trophy}
              label={t('whiteboard.ranking')}
              onPress={() => navigation.navigate('WODDetail', { wodId: mainWod.id, scrollToLeaderboard: true })}
              fullWidth
              testID="whiteboard-ranking"
            />
          </View>
        )}

        <View style={S.section}>
          <Text style={S.sectionTitle}>{dayTitle(toISO(new Date()))}</Text>
          {shownWODs.length > 0 ? (
            <View style={S.dayGroup}>
              {shownWODs.map((wod, idx) => {
                const hasScore = scoredIds.has(wod.id);
                const isDone = hasScore || completedIds.has(wod.id);
                return (
                  <View key={wod.id} style={S.wodRow}>
                    {isStaff && shownWODs.length > 1 && (
                      <View style={S.reorderCol}>
                        <TouchableOpacity
                          onPress={() => moveWod(shownWODs, idx, 'up')}
                          disabled={idx === 0}
                          style={[S.reorderBtn, idx === 0 && { opacity: 0.25 }]}
                          hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="↑"
                        >
                          <ChevronUp color={c.textMuted} size={16} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => moveWod(shownWODs, idx, 'down')}
                          disabled={idx === shownWODs.length - 1}
                          style={[S.reorderBtn, idx === shownWODs.length - 1 && { opacity: 0.25 }]}
                          hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="↓"
                        >
                          <ChevronDown color={c.textMuted} size={16} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <AxCard style={[S.wodCard, S.wodCardFill]} testID={`wod-card-${wod.id}`}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('WODDetail', { wodId: wod.id })}
                        activeOpacity={0.8}
                        style={S.wodCardBody}
                        testID={`wod-open-${wod.id}`}
                      >
                        <View style={S.wodCardTop}>
                          {typeTag(wod)}
                          <StrengthWodCardStatus summary={strengthByWod?.[wod.id]} />
                          {wod.video_url && <AxTag label={t('whiteboard.video')} tone="danger" />}
                          {capOf(wod.time_cap_seconds)}
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); toggleCompletion(wod.id); }}
                            disabled={hasScore}
                            style={S.checkboxRow}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isDone, disabled: hasScore }}
                            accessibilityLabel={isDone ? t('whiteboard.done') : t('whiteboard.markDone')}
                            testID={`wod-done-${wod.id}`}
                          >
                            {isDone && (
                              <Text style={S.checkboxLabel}>{hasScore ? t('whiteboard.scored') : t('whiteboard.done')}</Text>
                            )}
                            <View style={[S.checkbox, isDone && S.checkboxChecked]}>
                              {isDone && <Check color={c.onAccent} size={14} strokeWidth={3} />}
                            </View>
                          </TouchableOpacity>
                        </View>
                        <Text style={S.wodTitle}>{wod.title}</Text>
                        {wod.description && (
                          <Text style={S.wodDesc} numberOfLines={2}>{wod.description}</Text>
                        )}
                      </TouchableOpacity>
                      <View style={S.wodCardFooter}>
                        <TouchableOpacity
                          style={S.wodCardAction}
                          onPress={() => navigation.navigate('WODDetail', { wodId: wod.id })}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          testID={`wod-details-${wod.id}`}
                        >
                          <Text style={S.wodCardActionText}>{t(strengthCardLinkKey(strengthByWod?.[wod.id]))}</Text>
                          <ChevronRight color={c.accentText} size={14} />
                        </TouchableOpacity>
                        <AxIconButton
                          icon={TimerIcon}
                          onPress={() => openTimerModal(wod)}
                          accessibilityLabel={t('whiteboard.launchTimer')}
                          testID={`wod-timer-${wod.id}`}
                        />
                      </View>
                    </AxCard>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={S.noWodCard}>
              <ClipboardList color={c.textMuted} size={36} strokeWidth={1.5} />
              <Text style={S.noWodText}>{t('whiteboard.noWod')}</Text>
            </View>
          )}

          {/* ── Mes WODs perso (générateur) ─────────────────── */}
          <View style={S.group}>
            <View style={S.groupHead}>
              <Sparkles color={c.accentText} size={16} />
              <Text style={[S.sectionTitle, { marginBottom: 0 }]}>{t('whiteboard.myPersonalSessions')}</Text>
            </View>
            <View style={S.dayGroup}>
              {personalWODs.map(wod => personalCard(wod, 2))}
              {addWodButton}
            </View>
          </View>

          {/* ── Programmes : date de début à choisir / jour de repos ── */}
          {programAvis.map(a => (
            <AxCard
              key={`${a.kind}-${a.programId}`}
              style={S.programAvis}
              onPress={a.kind === 'repos' ? undefined : () => navigation.navigate('ProgramDetail', {
                programId: a.programId, programTitle: a.programTitle, startDate: null,
                progType: a.progType, durationWeeks: a.durationWeeks, daysPerWeek: a.daysPerWeek,
              })}
              testID={`program-avis-${a.programId}`}
            >
              <BookOpen color={c.accentText} size={16} />
              <View style={{ flex: 1 }}>
                <Text style={S.wodTitle}>{a.programTitle}</Text>
                <Text style={S.wodDesc}>
                  {a.kind === 'sans_date' ? t('whiteboard.programChooseStart') : t('whiteboard.programRest', { week: a.weekNumber })}
                </Text>
              </View>
              {a.kind === 'sans_date' && <ChevronRight color={c.textMuted} size={16} />}
            </AxCard>
          ))}

          {/* ── Programme WODs ─────────────────────── */}
          {programWodsHorsBox.length > 0 && programWodsHorsBox.reduce<{ title: string; wods: ProgWodEntry[] }[]>((acc, entry) => {
            const existing = acc.find(g => g.title === entry.programTitle);
            if (existing) existing.wods.push(entry);
            else acc.push({ title: entry.programTitle, wods: [entry] });
            return acc;
          }, []).map(group => (
            <View key={group.title} style={S.group}>
              <View style={S.groupHead}>
                <BookOpen color={c.accentText} size={16} />
                <Text style={[S.sectionTitle, { marginBottom: 0, flexShrink: 1 }]}>{group.title}</Text>
                {group.wods[0] && <Text style={S.groupDay}>{group.wods[0].dayLabel}</Text>}
              </View>
              <View style={S.dayGroup}>
                {group.wods.map(entry => (
                  <AxCard key={entry.wod.id} style={S.wodCard} testID={`program-wod-${entry.wod.id}`}>
                    <View style={S.wodCardTop}>
                      {typeTag(entry.wod)}
                      {capOf(entry.wod.time_cap_seconds)}
                    </View>
                    <Text style={S.wodTitle}>{entry.wod.title}</Text>
                    {entry.wod.description ? <Text style={S.wodDesc} numberOfLines={3}>{entry.wod.description}</Text> : null}
                  </AxCard>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {timerModal}

      <WhiteboardMembersModal
        visible={membersModal}
        boxName={currentBox.name}
        ownerId={currentBox.owner_id}
        loading={membersLoading}
        members={members}
        onClose={() => setMembersModal(false)}
        onOpenProfile={(userId) => navigation.navigate('PublicProfile', { userId })}
      />
    </View>
  );
}


function createStyles(theme: AppTheme) {
  const isDark = theme.mode === 'dark';
  const c = theme.ax;
  const cardShadow = isDark ? {} : {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  };
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 4 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: axSpacing.sm },
  headerBtn: { flex: 1, minWidth: 0 },
  headerTitle: { ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text },
  headerSub: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2, marginBottom: axSpacing.xs },
  badge: { position: 'absolute', top: -6, right: -4, zIndex: 2, elevation: 2 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: 12 },
  group: { marginTop: 20 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupDay: { ...axTypography.labelSmall, color: c.textMuted },
  dayGroup: { gap: 10 },
  wodRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reorderCol: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  reorderBtn: { padding: 4, borderRadius: 5, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  wodCard: { gap: 10 },
  wodCardFill: { flex: 1, minWidth: 0 },
  wodCardBody: { gap: 8 },
  programAvis: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wodCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeCap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeCapText: { ...axTypography.caption, color: c.textMuted },
  wodTitle: { ...axTypography.titleM, color: c.text },
  wodDesc: { ...axTypography.bodySmall, color: c.textMuted },
  wodCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wodCardAction: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  wodCardActionText: { ...axTypography.labelSmall, color: c.accentText, flexShrink: 1 },
  wodCardBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxRow: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 2, paddingHorizontal: 2,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 1.5, borderColor: c.fieldBorder,
    backgroundColor: 'transparent',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  checkboxLabel: { ...axTypography.labelSmall, color: c.accentText },
  noWodCard: {
    backgroundColor: isDark ? theme.card : theme.card, borderRadius: 16, padding: 32,
    borderWidth: 1, borderColor: theme.border, alignItems: 'center', gap: 10,
    ...cardShadow,
  },
  noWodText:  { fontSize: 14, color: theme.textMuted, textAlign: 'center' },
  historyGroup: { marginBottom: 16 },
  historyGroupDate: {
    fontSize: 13, fontWeight: '700', color: theme.textSecondary,
    marginBottom: 8, textTransform: 'capitalize',
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: isDark ? theme.card : theme.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: theme.border, marginBottom: 6, gap: 8,
    ...cardShadow,
  },
  historyTop:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  historyBlock: { fontSize: 10, fontWeight: '700', color: theme.accent },
  historyTitle: { fontSize: 14, fontWeight: '700', color: theme.text },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: theme.textMuted, textAlign: 'center' },
  topCtaRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  createWodPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 14, backgroundColor: theme.accent,
    marginTop: 14,
  },
  createWodPrimaryText: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  noBoxCard: {
    width: '100%', backgroundColor: isDark ? theme.card : theme.card, borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: theme.border, gap: 12,
    ...cardShadow,
  },
  noBoxTitle: { fontSize: 13, fontWeight: '700', color: theme.textMuted, letterSpacing: 1 },
  noBoxSub: { fontSize: 15, color: theme.textSecondary },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: theme.accent, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20, marginTop: 4,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.modalBackdrop },
  joinSheet: {
    backgroundColor: theme.modalCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 14,
  },
  joinHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginBottom: 8,
  },
  joinSheetTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
  joinSheetSub: { fontSize: 13, color: theme.textMuted },
  codeInput: {
    backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1,
    borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 22, fontWeight: '700', color: theme.text,
    letterSpacing: 6, textAlign: 'center',
  },
  quickActions: { paddingHorizontal: 16, gap: 10, marginTop: 12 },
}); }
