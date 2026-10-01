import React, { useEffect, useMemo, useState } from 'react';
import { useFocusQuery } from '../../hooks/useFocusQuery';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Share, Linking, RefreshControl,
} from 'react-native';
import {
  Trophy, Zap, TrendingUp, Award, LogOut, Star, Flame, ChevronRight, Hash, Building2, Edit3, Check, X, Camera, Copy,
  Share2, Bell, BookOpen, Search, ExternalLink, Lock, CreditCard, Dumbbell, PersonStanding, Timer, Moon, Sun, Users, Medal,
  type LucideIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { readRows } from '../../lib/db';
import { getMyBoxInviteCode } from '../../lib/boxInviteCode';
import { WEB_URL } from '../../lib/urls';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import i18n, { setLanguage } from '../../i18n';
import { LevelColors } from '../../theme/designTokens';
import { spacing, borderRadius, typography, shadows } from '../../theme/designTokens';
import { getBadgesCatalog, getEarnedBadges, getStreak, isBadgeUnobtainable, BadgeDef, EarnedBadge, StreakInfo } from '../../services/gamification';
import { fetchMyProfile, fetchMyPersonalRecords } from '../../services/myProfile';
import { HomeStackParamList } from '../../navigation';
import { Program, Gender, AthleteLevel } from '../../types';
import { Json } from '../../types/supabase';
import UserAvatar from '../../components/UserAvatar';
import GlassBackground from '../../components/glass/GlassBackground';
import { prKey, normalizePrRecords, PrCategorySlug, WEIGHTLIFTING_PR_MOVEMENTS, BODYWEIGHT_KEY, readBodyweightKg } from './prStorage';
import { formatTimeValue, isTimeUnit, parseTimeInput } from './timeValue';
import StrengthHistory from '../../components/profile/StrengthHistory';
import { fetchMyStrengthSets, groupStrengthSessions } from '../../services/strengthSets';
import { programWeekAt, toLocalIso } from '../../utils/programSchedule';
import { getMyMemberships, membershipState, membershipStateText, MembershipState, needsPlan, planActivationUrl } from '../../services/membership';
import { usePlanStatuses } from '../../hooks/usePlanStatuses';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { AxButton, AxCard, AxChip, AxSwitch, AxTextField } from '../../components/ax';
import { axAccentSafeLineHeight, axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Profile'>;

const TAB_KEYS = ['account', 'pr', 'stats', 'badges'] as const;

const PR_CATEGORIES = [
  {
    label: 'Haltérophilie',
    titleKey: 'weightlifting',
    icon: Dumbbell,
    // Une seule liste de libellés : c'est elle qui compose les clés en base et
    // que l'alimentation automatique des 1RM (services/strengthPR) vise.
    items: WEIGHTLIFTING_PR_MOVEMENTS.map(movement => ({ movement, value: '', unit: 'kg', date: '' })),
  },
  {
    label: 'Gymnastics',
    titleKey: 'gymnastics',
    icon: PersonStanding,
    items: [
      { movement: 'Toes To Bar', value: '', unit: 'reps', date: '' },
      { movement: 'Pull-ups', value: '', unit: 'reps', date: '' },
      { movement: 'Chest To Bar', value: '', unit: 'reps', date: '' },
      { movement: 'Hand Stand Push Up', value: '', unit: 'reps', date: '' },
      { movement: 'Strict Hand Stand Push Up', value: '', unit: 'reps', date: '' },
      { movement: 'Wall Facing Hand Stand Push Up', value: '', unit: 'reps', date: '' },
      { movement: 'Ring Muscle-up', value: '', unit: 'reps', date: '' },
      { movement: 'Bar Muscle-up', value: '', unit: 'reps', date: '' },
      { movement: 'Dips', value: '', unit: 'reps', date: '' },
      { movement: 'Strict Dips', value: '', unit: 'reps', date: '' },
      { movement: 'Pull Over', value: '', unit: 'reps', date: '' },
    ],
  },
  {
    label: 'Benchmarks CrossFit',
    titleKey: 'benchmarks',
    icon: Trophy,
    items: [
      { movement: 'Fran', value: '', unit: 'min', date: '' },
      { movement: 'Grace', value: '', unit: 'min', date: '' },
      { movement: 'Helen', value: '', unit: 'min', date: '' },
      { movement: 'Cindy', value: '', unit: 'rounds', date: '' },
      { movement: 'Diane', value: '', unit: 'min', date: '' },
      { movement: 'DT', value: '', unit: 'min', date: '' },
      { movement: 'Murph', value: '', unit: 'min', date: '' },
    ],
  },
  {
    label: 'Cardio & Endurance',
    titleKey: 'cardio',
    icon: Timer,
    items: [
      { movement: '500m Row', value: '', unit: 'min', date: '' },
      { movement: '2km Row', value: '', unit: 'min', date: '' },
      { movement: '1km Course', value: '', unit: 'min', date: '' },
      { movement: '5km Course', value: '', unit: 'min', date: '' },
      { movement: 'Assault Bike 1min', value: '', unit: 'cal', date: '' },
      { movement: 'Echo Bike 1min', value: '', unit: 'cal', date: '' },
      { movement: '5km Bike Erg', value: '', unit: 'min', date: '' },
    ],
  },
];

const BADGE_CATEGORY_MAP: Record<string, string> = {
  activity: 'Régularité',
  tournament: 'Compétition',
  social: 'Communauté',
  wod: 'Entraînement',
  elo: 'Classement ELO',
  Classement: 'Classement',
};
const CATEGORY_ORDER = ['activity', 'tournament', 'wod', 'elo', 'Classement', 'social'];

const ATHLETE_LEVELS: readonly AthleteLevel[] = ['scaled', 'inter', 'rx', 'rx+', 'elite', 'pro'];

export default function ProfileScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { t } = useTranslation();
  const { user, signOut, deleteAccount, currentBox, joinBox, leaveBox, updateUser, myBoxes, switchBox, boxRole, boxSubscription, daysLeftTrial } = useAuth();
  const { theme, mode, toggleTheme } = useTheme();

  // Abonnement AthleX du gérant (1.0.52 I5). Solo/Multi vient de
  // owner_subscriptions (RLS : sa propre ligne), l'état de la box de
  // boxSubscription. Le coach et l'athlète ne voient pas ce bloc ; tout
  // gérant le voit, box ou pas, abonnement ou pas.
  const isOwnerAdmin = boxRole === 'owner' || user?.role === 'box_owner';
  const { data: ownerSub } = useFocusQuery(
    ['owner-subscription', user?.id],
    async () => {
      if (!user) return null;
      return readRows(
        supabase.from('owner_subscriptions').select('status, box_quota').eq('owner_id', user.id).maybeSingle(),
        { screen: 'Profile', action: 'ownerSubscription' },
      );
    },
    { enabled: !!user && isOwnerAdmin },
  );
  const isMulti = !!ownerSub && ['active', 'trialing', 'past_due'].includes(ownerSub.status);
  const hasAthlexSub = !!boxSubscription || isMulti;
  const athlexPlanLabel = isMulti
    ? t('profile.athlexSub.multi', { n: ownerSub?.box_quota ?? myBoxes.length })
    : t('profile.athlexSub.solo');
  const athlexStatus = (() => {
    const s = boxSubscription?.status;
    if (s === 'active') return { text: t('bo.subscription.statusActive'), color: theme.success };
    if (s === 'past_due') return { text: t('bo.subscription.statusPastDue'), color: theme.error };
    if (s === 'trialing' && daysLeftTrial > 0) return { text: t('bo.subscription.statusTrial', { n: daysLeftTrial }), color: theme.accentText };
    if (s === 'trialing' || s === 'expired' || s === 'canceled') return { text: t('bo.subscription.statusExpired'), color: theme.error };
    return { text: t('bo.subscription.statusNone'), color: theme.textMuted };
  })();
  const navigation = useNavigation<Nav>();
  const S = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab]   = useState(0);
  const [expandedPR, setExpandedPR] = useState<string | null>('weightlifting');
  const [prSearch, setPrSearch]     = useState('');
  // Whether profiles.featured_badges (dedicated column) exists yet. Until the
  // migration is applied we transparently fall back to the legacy JSON slot.
  const [featuredColumn, setFeaturedColumn] = useState(false);

  // ── Referral code
  const [referralCode, setReferralCode] = useState<string>('');
  // ── WOD count
  const [wodCount, setWodCount] = useState<number>(0);
  // ── Badges & streaks
  const [badgesCatalog, setBadgesCatalog] = useState<BadgeDef[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [streak, setStreak] = useState<StreakInfo>({ current_streak: 0, longest_streak: 0, week_session_count: 0, week_start: '', max_sessions_per_week: null });
  // ── Friends
  const [friends, setFriends] = useState<Array<{ id: string; username: string; level: string; avatar_url?: string }>>([]);
  // ── PR editing
  const [editingPR, setEditingPR] = useState<string | null>(null);
  const [prValues, setPrValues] = useState<Record<string, string>>({});
  const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);

  // ── Box join modal
  const [joinModal, setJoinModal]   = useState(false);
  const [boxInviteCode, setBoxInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode]     = useState('');
  const [joining, setJoining]       = useState(false);

  // ── Program join modal
  const [progModal, setProgModal]   = useState(false);
  const [progCode, setProgCode]     = useState('');
  const [joiningProg, setJoiningProg] = useState(false);
  const [myPrograms, setMyPrograms] = useState<(Program & { start_date: string | null; status: string })[]>([]);

  // ── Edit profile
  const [editing, setEditing]       = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username ?? '');
  const [firstName, setFirstName]   = useState(() => user?.full_name?.split(' ')[0] ?? '');
  const [lastName, setLastName]     = useState(() => user?.full_name?.split(' ').slice(1).join(' ') ?? '');
  const [editEmail, setEditEmail]   = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl]   = useState(user?.avatar_url ?? '');
  const [editBio, setEditBio]       = useState(user?.bio ?? '');
  const [editGender, setEditGender] = useState<Gender | null>(user?.gender ?? null);
  const [editLevel, setEditLevel]   = useState<AthleteLevel | null>(user?.level ?? null);
  const [editBodyweight, setEditBodyweight] = useState('');
  const [saving, setSaving]         = useState(false);

  // Ouverture directe du formulaire (lien « modifier » de la page résultat du générateur)
  const route = useRoute<RouteProp<{ Profile: { editLevel?: boolean } | undefined }, 'Profile'>>();
  useEffect(() => {
    if (route.params?.editLevel) setEditing(true);
  }, [route.params?.editLevel]);

  // ── Changement de mot de passe (3E)
  const [pwdModal, setPwdModal]     = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  // État de mes abonnements (fin programmée, arrêt, impayé, suspension)
  const [membershipStates, setMembershipStates] = useState<{ boxId: string; name: string | null; state: MembershipState }[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const rows = await getMyMemberships();
      const withState = rows.flatMap(r => {
        const state = membershipState(r);
        return state ? [{ boxId: r.box_id, state }] : [];
      });
      const names = new Map(myBoxes.map(e => [e.box.id, e.box.name]));
      const missing = withState.map(m => m.boxId).filter(id => !names.has(id));
      if (missing.length) {
        const { data } = await supabase.from('boxes').select('id, name').in('id', missing);
        (data ?? []).forEach(b => names.set(b.id, b.name));
      }
      if (!cancelled) setMembershipStates(withState.map(m => ({ ...m, name: names.get(m.boxId) ?? null })));
    })().catch(e => captureError(e, { screen: 'Profile', action: 'membershipStates' }));
    return () => { cancelled = true; };
  }, [user, myBoxes]);

  // Formule à activer, box par box (maquette 68:1971)
  const planStatuses = usePlanStatuses(myBoxes.map(e => e.box.id));

  // Load my programs
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('program_members')
        .select('start_date, status, programs:program_id(id, title, type, duration_weeks, days_per_week, invite_code, price_cents, box_id, is_active, created_at, updated_at, owner_id)')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const mapped = (data ?? []).map((r: any) => ({ ...r.programs, start_date: r.start_date, status: r.status })).filter(Boolean);
      setMyPrograms(mapped);
    })();
  }, [user]);

  async function handleJoinProgram() {
    if (!progCode.trim() || !user) return;
    setJoiningProg(true);
    try {
      const { data: prog } = await supabase
        .from('programs')
        .select('*')
        .eq('invite_code', progCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();
      if (!prog) { Alert.alert(t('common.error'), t('profile.alerts.invalidProgramCode')); setJoiningProg(false); return; }
      // Programmes payants : l'achat se fait hors de l'app.
      // iOS reste neutre (règles App Store) ; Android peut ouvrir la page box.
      if (prog.price_cents > 0) {
        if (Platform.OS === 'ios') {
          Alert.alert(
            t('profile.alerts.programTitle'),
            t('profile.alerts.programIosMsg'),
            [{ text: t('common.ok'), style: 'cancel' }],
          );
        } else {
          Alert.alert(
            t('profile.alerts.programTitle'),
            t('profile.alerts.programAndroidMsg'),
            [
              { text: t('common.close'), style: 'cancel' },
              { text: t('profile.alerts.openBoxPage'), onPress: () => Linking.openURL(WEB_URL) },
            ],
          );
        }
        setJoiningProg(false);
        return;
      }
      // Check not already member
      const { data: existing } = await supabase
        .from('program_members')
        .select('id')
        .eq('program_id', prog.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) { Alert.alert(t('profile.alerts.alreadyMemberTitle'), t('profile.alerts.alreadyMemberMsg')); setJoiningProg(false); return; }
      // Programme gratuit : l'app ne s'inscrit plus elle-même. program_members
      // n'accepte que deux portes, toutes deux vérifiées côté serveur — un
      // paiement Stripe, ou une inscription par le staff de la box. Un client
      // qui écrirait la ligne lui-même rendrait « a payé » et « assigné »
      // indistinguables, et gonflerait le chiffre d'affaires du gérant.
      Alert.alert(
        t('profile.alerts.programTitle'),
        t('profile.alerts.programStaffOnlyMsg'),
        [{ text: t('common.ok'), style: 'cancel' }],
      );
      setProgModal(false); setProgCode('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    }
    setJoiningProg(false);
  }

  const { data: profileData, refetch, isFetching } = useFocusQuery(
    ['profile', user?.id],
    async () => {
      if (!user) return null;
      const [wodCountRes, prRes, badgesRes, earnedRes, streakRes, friendsRes, featuredRes, strengthRes] = await Promise.all([
        supabase.from('wod_scores').select('id', { count: 'exact', head: true }).eq('member_id', user.id), // 4.1 : la colonne est member_id, pas user_id (compteur bloque a 0)
        fetchMyPersonalRecords(),
        getBadgesCatalog(),
        getEarnedBadges(user.id),
        getStreak(user.id, currentBox?.id),
        supabase.from('friendships').select('requester_id, addressee_id, requester:profiles!requester_id(id, username, level, avatar_url), addressee:profiles!addressee_id(id, username, level, avatar_url)').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted'),
        // Dedicated column; errors (data null) if the migration hasn't run yet.
        supabase.from('profiles').select('featured_badges').eq('id', user.id).maybeSingle(),
        // Journal des séries réalisées : ce qui a produit les 1RM affichés.
        fetchMyStrengthSets(),
      ]);
      return {
        wodCount: wodCountRes.count ?? 0,
        prValues: prRes,
        strengthSessions: groupStrengthSessions(strengthRes),
        badgesCatalog: badgesRes,
        earnedBadges: earnedRes,
        streak: streakRes,
        friends: friendsRes.data,
        featuredColumnAvailable: !featuredRes.error,
        featuredBadgesCol: (featuredRes.data?.featured_badges as string[] | null) ?? null,
      };
    },
    { enabled: !!user },
  );

  useEffect(() => {
    if (!profileData) return;
    setWodCount(profileData.wodCount);
    if (profileData.prValues && typeof profileData.prValues === 'object') {
      const prs = profileData.prValues as Record<string, unknown>;
      setPrValues(prev => ({ ...prev, ...normalizePrRecords(prs) }));
      const bw = readBodyweightKg(prs);
      setEditBodyweight(bw != null ? String(bw) : '');
      const legacyFeatured = Array.isArray(prs._featured_badges) ? (prs._featured_badges as string[]) : null;
      setFeaturedColumn(profileData.featuredColumnAvailable);
      if (profileData.featuredColumnAvailable) {
        // Prefer the dedicated column; fall back to legacy JSON right after migration.
        if (profileData.featuredBadgesCol && profileData.featuredBadgesCol.length) setFeaturedBadges(profileData.featuredBadgesCol);
        else if (legacyFeatured) setFeaturedBadges(legacyFeatured);
      } else if (legacyFeatured) {
        setFeaturedBadges(legacyFeatured);
      }
    }
    setBadgesCatalog(profileData.badgesCatalog);
    setEarnedBadges(profileData.earnedBadges);
    setStreak(profileData.streak);
    // Map friends
    const mapped = (profileData.friends ?? []).map((f: any) => {
      const friend = f.requester_id === user?.id
        ? (Array.isArray(f.addressee) ? f.addressee[0] : f.addressee)
        : (Array.isArray(f.requester) ? f.requester[0] : f.requester);
      return friend;
    }).filter(Boolean);
    setFriends(mapped);
  }, [profileData]);

  useEffect(() => {
    loadReferralCode();
  }, [user?.id]);

  async function savePRs(updated: Record<string, string>, changedKeys: string[]) {
    if (!user) return;
    // 4.6b : relire la colonne et ne fusionner QUE les clés modifiées. Écrire
    // l'état local complet écrasait les PR enregistrés ailleurs (web, autre
    // appareil) depuis le chargement de l'écran.
    const profile = await fetchMyProfile();
    if (!profile) {
      captureError(new Error('get_my_profile a rendu null'), { screen: 'Profile', action: 'savePRs.read' });
      return;
    }

    const remote = (profile.personal_records ?? {}) as Record<string, Json>;
    const merged: Record<string, Json> = { ...remote };
    for (const key of changedKeys) {
      if (updated[key] === '' || updated[key] == null) delete merged[key];
      else merged[key] = updated[key];
    }
    // Post-migration: PRs and featured badges live in separate storage. Pre-migration:
    // keep persisting the featured badges alongside the PRs so we don't drop them.
    if (!featuredColumn) merged._featured_badges = featuredBadges;

    const { error: upErr } = await supabase
      .from('profiles').update({ personal_records: merged }).eq('id', user.id);
    if (upErr) captureError(upErr, { screen: 'Profile', action: 'savePRs.write' });
  }

  async function toggleFeaturedBadge(badgeKey: string) {
    if (!user) return;
    let next: string[];
    if (featuredBadges.includes(badgeKey)) {
      next = featuredBadges.filter(k => k !== badgeKey);
    } else {
      if (featuredBadges.length >= 3) return;
      next = [...featuredBadges, badgeKey];
    }
    setFeaturedBadges(next);
    if (featuredColumn) {
      await supabase.from('profiles').update({ featured_badges: next }).eq('id', user.id);
    } else {
      await supabase.from('profiles').update({ personal_records: { ...prValues, _featured_badges: next } }).eq('id', user.id);
    }
  }

  async function loadReferralCode() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();
    if (data?.referral_code) setReferralCode(data.referral_code);
  }

  async function handlePickPhoto() {
    setPickingPhoto(true);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPickingPhoto(false);
      Alert.alert(t('profile.alerts.permissionDenied'), t('profile.alerts.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    setPickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setAvatarUrl(result.assets[0].uri);
    }
  }

  async function handleTakePhoto() {
    setPickingPhoto(true);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPickingPhoto(false);
      Alert.alert(t('profile.alerts.permissionDenied'), t('profile.alerts.cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    setPickingPhoto(false);
    if (!result.canceled && result.assets[0]) {
      setAvatarUrl(result.assets[0].uri);
    }
  }

  async function handleCopyReferral() {
    await Share.share({ message: referralCode, title: t('profile.referral.shareTitle') });
  }

  async function handleShareReferral() {
    await Share.share({
      message: t('profile.referral.shareMessage', { code: referralCode }),
    });
  }

  async function handleJoinBox() {
    if (!joinCode.trim()) return;
    setJoining(true);
    const { error } = await joinBox(joinCode.trim());
    setJoining(false);
    if (error) { Alert.alert(t('common.error'), error); return; }
    setJoinModal(false);
    setJoinCode('');
  }

  async function handleLeaveBox() {
    Alert.alert(t('profile.account.leaveBoxTitle'), t('profile.alerts.leaveCurrentBoxMsg', { name: currentBox?.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.account.leave'), style: 'destructive', onPress: async () => {
        const { error } = await leaveBox();
        if (error) Alert.alert(t('common.error'), error);
      }},
    ]);
  }

  async function uploadAvatarIfLocal(localUri: string): Promise<string | null> {
    if (!user) return null;
    // If already a remote http(s) URL (already uploaded), nothing to do
    if (/^https?:\/\//i.test(localUri)) return localUri;
    try {
      const ext = (localUri.split('.').pop()?.toLowerCase().split('?')[0]) || 'jpg';
      const safeExt = ext === 'png' ? 'png' : 'jpg';
      const fileName = `${user.id}/avatar-${Date.now()}.${safeExt}`;
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, bytes, {
          contentType: `image/${safeExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        });
      if (upErr) { captureError(upErr, { screen: 'Profile', action: 'uploadAvatar' }); return null; }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return `${urlData.publicUrl}?t=${Date.now()}`;
    } catch (e) {
      captureError(e, { screen: 'Profile', action: 'uploadAvatar' });
      return null;
    }
  }

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const updates: Record<string, string | null> = {
        full_name: fullName,
        username: editUsername.trim(),
        gender: editGender,
      };
      if (editLevel) updates.level = editLevel;

      // Upload avatar to Supabase Storage if it's a local file URI
      let finalAvatarUrl = avatarUrl.trim();
      if (finalAvatarUrl && !/^https?:\/\//i.test(finalAvatarUrl)) {
        const uploaded = await uploadAvatarIfLocal(finalAvatarUrl);
        if (!uploaded) {
          setSaving(false);
          Alert.alert(t('common.error'), t('profile.alerts.avatarUploadFailed'));
          return;
        }
        finalAvatarUrl = uploaded;
      }
      if (finalAvatarUrl) updates.avatar_url = finalAvatarUrl;
      updates.bio = editBio.trim();

      // Handle email change via Supabase Auth
      const newEmail = editEmail.trim().toLowerCase();
      const emailChanged = newEmail && newEmail !== (user.email ?? '').toLowerCase();
      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({ email: newEmail });
        if (authErr) {
          setSaving(false);
          Alert.alert(t('profile.alerts.emailError'), authErr.message);
          return;
        }
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) { setSaving(false); Alert.alert(t('common.error'), error.message); return; }
      const bwText = editBodyweight.trim().replace(',', '.');
      const bwParsed = bwText ? parseFloat(bwText) : NaN;
      const bwStored = readBodyweightKg(prValues);
      if (!bwText && bwStored != null) {
        await savePRs({ [BODYWEIGHT_KEY]: '' }, [BODYWEIGHT_KEY]);
        setPrValues(prev => { const next = { ...prev }; delete next[BODYWEIGHT_KEY]; return next; });
      } else if (Number.isFinite(bwParsed) && bwParsed !== bwStored) {
        await savePRs({ [BODYWEIGHT_KEY]: String(bwParsed) }, [BODYWEIGHT_KEY]);
        setPrValues(prev => ({ ...prev, [BODYWEIGHT_KEY]: String(bwParsed) }));
      }
      setSaving(false);
      updateUser({
        full_name: fullName,
        avatar_url: avatarUrl.trim() || user.avatar_url,
        username: editUsername.trim(),
        gender: editGender ?? undefined,
        level: editLevel ?? user.level,
      });
      setEditing(false);

      if (emailChanged) {
        Alert.alert(
          t('profile.alerts.confirmationRequired'),
          t('profile.alerts.emailConfirmationSent'),
        );
      }
    } catch (e: any) {
      setSaving(false);
      Alert.alert(t('common.error'), e.message ?? t('profile.alerts.genericError'));
    }
  }

  const winRate = user?.total_matches
    ? Math.round((user.wins / user.total_matches) * 100)
    : 0;
  const currentElo = user?.elo ?? 1000;
  const ELO_STEPS: { min: number; label: string }[] = [
    { min: 0,    label: 'Scaled' },
    { min: 800,  label: 'Inter' },
    { min: 1200, label: 'RX' },
    { min: 1400, label: 'RX+' },
    { min: 1600, label: 'Elite' },
    { min: 1800, label: 'Pro' },
  ];
  const currentStep = [...ELO_STEPS].reverse().find(s => currentElo >= s.min) ?? ELO_STEPS[0];
  const nextStep = ELO_STEPS[ELO_STEPS.indexOf(currentStep) + 1] ?? null;
  const eloProgress = nextStep
    ? Math.round(Math.max(0, Math.min(100, ((currentElo - currentStep.min) / (nextStep.min - currentStep.min)) * 100)))
    : 100;

  async function handleChangePassword() {
    if (!user?.email) return;
    if (newPwd.length < 6) { Alert.alert(t('common.error'), t('auth.passwordTooShort')); return; }
    // Vérifié AVANT tout appel réseau.
    if (newPwd !== confirmPwd) { Alert.alert(t('common.error'), t('profile.password.mismatch')); return; }

    setChangingPwd(true);
    // Ré-authentification : la session rendue porte le MÊME user, donc le
    // onAuthStateChange qui suit relance un fetchProfile identique.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPwd,
    });
    if (reauthErr) {
      setChangingPwd(false);
      Alert.alert(t('common.error'), t('profile.password.wrongCurrent'));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setChangingPwd(false);
    if (error) {
      // Jamais le mot de passe, ni en log ni dans Sentry.
      captureError(new Error(`changePassword: ${error.message}`), { screen: 'Profile', action: 'changePassword' });
      Alert.alert(t('common.error'), error.message);
      return;
    }
    setPwdModal(false);
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    Alert.alert(t('common.success'), t('profile.password.changed'));
  }

  async function handleSignOut() {
    Alert.alert(t('profile.alerts.signOutTitle'), t('profile.alerts.signOutMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.alerts.signOutTitle'), style: 'destructive', onPress: signOut },
    ]);
  }

  const [deleting, setDeleting] = useState(false);

  function handleDeleteAccount() {
    Alert.alert(
      `⚠️ ${t('profile.alerts.deleteTitle')}`,
      t('profile.alerts.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.alerts.deleteConfirm'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('profile.alerts.deleteLastTitle'),
              t('profile.alerts.deleteLastMsg'),
              [
                { text: t('profile.alerts.deleteNo'), style: 'cancel' },
                {
                  text: t('profile.alerts.deleteYes'),
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    const { error } = await deleteAccount();
                    setDeleting(false);
                    if (error) Alert.alert(t('common.error'), error);
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  const levelColor = LevelColors[user?.level ?? 'scaled'];
  const levelText = levelInk(user?.level ?? 'scaled', theme.ax);

  const roleLabel = user?.role === 'box_owner'  ? t('profile.roles.boxOwner')
                  : user?.role === 'admin'       ? t('profile.roles.admin')
                  : user?.role === 'super_admin' ? t('profile.roles.superAdmin')
                  : t('profile.roles.athlete');

  async function handleShareBoxCode() {
    if (!currentBox) return;
    // Code demandé à la RPC au moment du partage : il n'est plus chargé avec la box.
    const code = boxInviteCode ?? await getMyBoxInviteCode(currentBox.id);
    if (!code) return;
    setBoxInviteCode(code);
    await Share.share({
      message: t('profile.referral.shareBox', { name: currentBox.name, code }),
    });
  }

  // Séries qui ont établi un record : lues dans les clés de provenance
  // `<catégorie>_<mouvement>_src`, jamais déduites d'une date approchante.
  const prSourceIds = new Set(
    Object.entries(prValues)
      .filter(([k]) => k.endsWith('_src'))
      .map(([, v]) => v),
  );

  const earnedKeys = new Set(earnedBadges.map(b => b.badge_key));
  const earnedCount = earnedBadges.length;
  // Un badge sans source d'attribution n'est montré qu'à un porteur historique :
  // afficher une carte grise pour une condition que rien ne peut satisfaire
  // promettrait une complétion qui n'existe pas.
  const visibleCatalog = badgesCatalog.filter(
    b => !isBadgeUnobtainable(b.badge_key) || earnedKeys.has(b.badge_key),
  );
  const totalBadges = visibleCatalog.length;

  // Group badges by category — show ALL categories from DB (CATEGORY_ORDER first, unknowns appended)
  const badgesByCategory = (() => {
    const allCats = [...new Set(visibleCatalog.map(b => b.category))];
    const ordered = CATEGORY_ORDER.filter(c => allCats.includes(c));
    const extras  = allCats.filter(c => !CATEGORY_ORDER.includes(c));
    return [...ordered, ...extras].map(cat => ({
      key: cat,
      label: t(`profile.badges.categories.${cat}`, { defaultValue: BADGE_CATEGORY_MAP[cat] ?? cat }),
      badges: visibleCatalog.filter(b => b.category === cat),
    }));
  })();

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={S.header}>
        <View style={S.headerTop}>
          <UserAvatar
            uri={user?.avatar_url}
            name={user?.username ?? 'A'}
            size={72}
            borderRadius={24}
            borderWidth={3}
            borderColor={levelColor}
            backgroundColor={theme.surface}
            textColor={theme.text}
            fontSize={28}
          />
          <View style={S.userInfo}>
            <Text style={S.username} numberOfLines={2} testID="profile-username">{user?.username ?? 'Athlète'}</Text>
            <Text style={S.email} numberOfLines={1}>{user?.email}</Text>
            <View style={[S.levelBadge, { borderColor: levelText }]} testID="profile-level">
              <View style={[S.levelDot, { backgroundColor: levelText }]} />
              <Text style={[S.levelText, { color: levelText }]}>
                {(user?.level ?? 'scaled').toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={S.logoutBtn} accessibilityRole="button" accessibilityLabel={t('profile.alerts.signOutTitle')} testID="profile-sign-out">
            <LogOut color={theme.ax.textMuted} size={20} />
          </TouchableOpacity>
        </View>

        <View style={S.statsRow}>
          <TouchableOpacity onPress={() => navigation.navigate('EloHistory' as never)}
            style={[S.statPill, S.statPillBorder]} activeOpacity={0.6} testID="profile-elo">
            <Text style={S.statPillValue} testID="profile-elo-value">{user?.elo ?? 1000}</Text>
            <Text style={S.statPillLabel}>ELO ›</Text>
          </TouchableOpacity>
          {[
            { label: t('profile.stats.wins'), value: user?.wins ?? 0 },
            { label: t('profile.stats.matches'), value: user?.total_matches ?? 0 },
            { label: t('profile.stats.winRate'), value: `${winRate}%` },
          ].map((s, i) => (
            <View key={s.label} style={[S.statPill, i < 2 && S.statPillBorder]}>
              <Text style={S.statPillValue}>{s.value}</Text>
              <Text style={S.statPillLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={S.progressSection}>
          <View style={S.progressHeader}>
            <View style={S.progressLabelRow}>
              {!nextStep && <Trophy color={theme.ax.textMuted} size={12} />}
              <Text style={S.progressLabel}>
                {nextStep ? t('profile.elo.toward', { level: nextStep.label }) : t('profile.elo.maxLevel')}
              </Text>
            </View>
            <Text style={S.progressPct}>{eloProgress}%</Text>
          </View>
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${eloProgress}%` as any, backgroundColor: levelText }]} />
          </View>
          <Text style={S.progressNote}>
            {nextStep
              ? `${currentElo} / ${nextStep.min} ELO · ${t('profile.elo.currentLevel', { level: currentStep.label })}`
              : `${currentElo} ELO · Pro Legend`}
          </Text>
        </View>
      </View>

      <View style={S.tabs} testID="profile-tabs">
        {TAB_KEYS.map((tab, i) => (
          <AxChip
            key={tab}
            label={t(`profile.tabs.${tab}`)}
            selected={activeTab === i}
            onPress={() => setActiveTab(i)}
            testID={`profile-tab-${tab}`}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {TAB_KEYS[activeTab] === 'stats' && (
          <>
            {(user?.total_matches ?? 0) === 0 && (
              <AxCard style={S.emptyBanner} testID="profile-stats-empty">
                <Trophy color={theme.ax.textMuted} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={S.emptyBannerTitle}>{t('profile.stats.emptyTitle')}</Text>
                  <Text style={S.emptyBannerSub}>{t('profile.stats.emptySub')}</Text>
                </View>
              </AxCard>
            )}
            <View style={S.gridRow}>
              {[
                { label: t('profile.stats.totalMatches'), value: user?.total_matches ?? 0, icon: Zap },
                { label: t('profile.stats.wins'), value: user?.wins ?? 0, icon: Trophy },
                { label: t('profile.stats.losses'), value: (user?.total_matches ?? 0) - (user?.wins ?? 0), icon: TrendingUp },
                { label: t('profile.stats.winRate'), value: `${winRate}%`, icon: Star },
                { label: t('profile.stats.currentStreak'), value: streak.current_streak, icon: Flame },
                { label: t('profile.stats.badgesEarned'), value: `${earnedCount}/${totalBadges}`, icon: Award },
                ...(currentBox ? [{ label: t('profile.stats.wodsDone'), value: wodCount, icon: Zap }] : []),
              ].map((s, i) => (
                <AxCard key={s.label} style={S.gridCard} testID={`profile-stat-${i}`}>
                  <s.icon color={s.icon === Flame ? theme.ax.orange : theme.ax.textMuted} size={18} />
                  <Text style={S.gridValue} testID={`profile-stat-${i}-value`}>{s.value}</Text>
                  <Text style={S.gridLabel} numberOfLines={2}>{s.label}</Text>
                </AxCard>
              ))}
            </View>
          </>
        )}

        {TAB_KEYS[activeTab] === 'pr' && (() => {
          const q = prSearch.trim().toLowerCase();
          const searching = q.length > 0;
          const filtered = PR_CATEGORIES
            .map(cat => ({ cat, items: searching ? cat.items.filter(pr => pr.movement.toLowerCase().includes(q)) : cat.items }))
            .filter(({ items }) => !searching || items.length > 0);
          return (
          <>
            <View style={S.prSearchRow}>
              <Search color={theme.textMuted} size={16} />
              <TextInput
                style={S.prSearchInput}
                value={prSearch}
                onChangeText={setPrSearch}
                placeholder={t('profile.pr.searchPlaceholder')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {prSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPrSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X color={theme.textMuted} size={16} />
                </TouchableOpacity>
              )}
            </View>
            {searching && filtered.length === 0 && (
              <Text style={S.prNoResults}>{t('profile.pr.noResults', { query: prSearch.trim() })}</Text>
            )}
            {filtered.map(({ cat, items }) => {
              const isOpen = searching || expandedPR === cat.titleKey;
              return (  
                <AxCard key={cat.titleKey} style={S.prCategory} testID={`profile-pr-${cat.titleKey}`}>
                  <TouchableOpacity
                    style={S.prCategoryHeader}
                    onPress={() => !searching && setExpandedPR(isOpen ? null : cat.titleKey)}
                    activeOpacity={searching ? 1 : 0.7}
                  >
                    <cat.icon color={theme.ax.accentText} size={18} />
                    <Text style={S.prCategoryLabel} numberOfLines={1}>{t(`profile.pr.categories.${cat.titleKey}`)}</Text>
                    <Text style={S.prCategoryCount}>{t('profile.pr.recordsCount', { count: items.length })}</Text>
                    <ChevronRight
                      color={theme.ax.textMuted} size={16}
                      style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>
                  {isOpen && items.map((pr, i) => {
                    const key = prKey(cat.titleKey as PrCategorySlug, pr.movement);
                    const isEditingThis = editingPR === key;
                    return (
                      <View key={i} style={[S.prRow, i === items.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={S.prMovement} numberOfLines={2}>{pr.movement}</Text>
                          <Text style={S.prDate}>
                            {prValues[`${key}_date`] ?? (prValues[key] ? '' : pr.date)}
                          </Text>
                        </View>
                        {isEditingThis ? (
                          <View style={S.prEditRow}>
                            <TextInput
                              style={S.prEditInput}
                              value={prValues[key] ?? ''}
                              onChangeText={v => setPrValues(prev => ({ ...prev, [key]: v }))}
                              keyboardType={isTimeUnit(pr.unit) ? 'numbers-and-punctuation' : 'numeric'}
                              placeholder={isTimeUnit(pr.unit) ? 'mm:ss' : undefined}
                              placeholderTextColor={theme.textMuted}
                              autoFocus
                              selectTextOnFocus
                            />
                            <Text style={S.prUnit}>{isTimeUnit(pr.unit) ? 'min:s' : pr.unit}</Text>
                            <TouchableOpacity
                              onPress={() => {
                                // B11 : un temps se saisit en minutes et secondes, se stocke en minutes décimales
                                let value = prValues[key] ?? '';
                                if (isTimeUnit(pr.unit)) {
                                  const parsed = parseTimeInput(value);
                                  if (parsed === null) { Alert.alert('Temps invalide', 'Saisis un temps au format mm:ss, par exemple 1:42.'); return; }
                                  value = parsed;
                                }
                                const today = new Date().toISOString().split('T')[0];
                                const updated = { ...prValues, [key]: value, [`${key}_date`]: today };
                                setPrValues(updated);
                                setEditingPR(null);
                                savePRs(updated, [key, `${key}_date`]);
                              }}
                              style={S.prEditConfirm}
                            >
                              <Check color={theme.text} size={16} />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => setEditingPR(key)} style={S.prValueBtn} testID={`profile-pr-value-${key}`}>
                            <Text style={[S.prValue, !prValues[key] && { color: theme.ax.textMuted }]}>
                              {prValues[key] ? (isTimeUnit(pr.unit) ? formatTimeValue(prValues[key]) : prValues[key]) : '—'}{' '}
                              <Text style={S.prUnit}>{prValues[key] ? (isTimeUnit(pr.unit) ? 'min' : pr.unit) : ''}</Text>
                            </Text>
                            <Edit3 color={theme.ax.textMuted} size={12} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </AxCard>
              );
            })}
            {!searching && (
              <StrengthHistory
                sessions={profileData?.strengthSessions ?? []}
                prSourceIds={prSourceIds}
              />
            )}
          </>
          );
        })()}

        {TAB_KEYS[activeTab] === 'badges' && (
          <>
            <View style={S.badgeSummary}>
              <Text style={S.badgeSummaryText}>
                <Text style={{ fontWeight: '900', color: theme.text }}>{earnedCount}</Text>
                {' '}{t('profile.badges.earnedOf')}{' '}
                <Text style={{ fontWeight: '900' }}>{totalBadges}</Text>
              </Text>
              <View style={S.pinnedRow}>
                <Star color={theme.ax.accentText} size={12} />
                <Text style={S.pinnedText}>{t('profile.badges.pinnedCount', { count: featuredBadges.length })}</Text>
              </View>
            </View>
            {/* Streak widget */}
            <AxCard style={S.streakWidget} testID="profile-streak">
              <Flame color={theme.ax.orange} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={S.streakTitle}>{t('profile.badges.week', { count: streak.current_streak })}</Text>
                <Text style={S.streakSub}>{t('profile.badges.sessionsThisWeek', { done: streak.week_session_count, total: streak.max_sessions_per_week ?? '∞' })}</Text>
                <View style={S.streakBar}>
                  <View style={[S.streakBarFill, { width: `${Math.min(100, (streak.week_session_count / (streak.max_sessions_per_week ?? 3)) * 100)}%` }]} />
                </View>
              </View>
            </AxCard>

            <Text style={S.pinHint}>
              {t('profile.badges.pinHint')}
            </Text>

            {badgesByCategory.map((cat) => (
              <View key={cat.key} style={S.badgeCategoryBlock}>
                <Text style={S.badgeCategoryTitle}>{cat.label}</Text>
                <View style={S.badgesGrid}>
                  {cat.badges.map((badge) => {
                    const earned = earnedKeys.has(badge.badge_key);
                    const isFeatured = featuredBadges.includes(badge.badge_key);
                    const canFeature = earned && (isFeatured || featuredBadges.length < 3);
                    return (
                      <View key={badge.badge_key} style={S.badgeCell}>
                        <AxCard
                          style={[S.badgeCard, !earned && S.badgeCardLocked, isFeatured && S.badgeCardFeatured]}
                          onPress={() => canFeature && toggleFeaturedBadge(badge.badge_key)}
                          accessibilityLabel={badge.title}
                          testID={`profile-badge-${badge.badge_key}`}
                        >
                          {isFeatured && (
                            <View style={S.badgePin} testID={`profile-badge-${badge.badge_key}-pin`}>
                              <Star color={theme.ax.accentText} size={12} />
                            </View>
                          )}
                          <BadgeIcon category={badge.category} earned={earned} color={earned ? theme.ax.accentText : theme.ax.textMuted} />
                          <Text style={[S.badgeName, !earned && { color: theme.ax.textMuted }]} numberOfLines={3}>
                            {badge.title}
                          </Text>
                          <Text style={S.badgeDesc} numberOfLines={3}>{badge.description}</Text>
                          {earned && <View style={S.earnedBar} />}
                        </AxCard>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}
        {TAB_KEYS[activeTab] === 'account' && (
          <View style={S.compteSection}>

            {/* ── Mes Boxes ─────────────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-boxes">
              <Text style={S.compteCardTitle}>{t('profile.account.myBoxes')}</Text>
              {myBoxes.length > 0 ? (
                <>
                  {myBoxes.map(entry => {
                    const isActive = entry.box.id === currentBox?.id;
                    return (
                      <View key={entry.box.id} style={[S.boxRow, { marginBottom: 8 }]}>
                        <Building2 color={isActive ? theme.ax.accentText : theme.ax.text} size={20} />
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => switchBox(entry.box.id)} activeOpacity={0.7}>
                          <Text style={[S.boxName, isActive && { color: theme.ax.accentText }]} numberOfLines={2}>{entry.box.name}</Text>
                          <Text style={S.rowValue}>
                            {entry.role === 'owner' ? t('profile.account.roleOwner') : entry.role === 'coach' ? t('profile.account.roleCoach') : t('profile.account.roleMember')}
                          </Text>
                        </TouchableOpacity>
                        {isActive && <View style={S.activeTag}><Text style={S.activeTagText}>{t('profile.account.active')}</Text></View>}
                        {entry.role !== 'owner' && (
                          <TouchableOpacity
                            onPress={() => {
                              if (isActive) handleLeaveBox();
                              else {
                                Alert.alert(t('profile.account.leaveBoxTitle'), t('profile.account.leaveBoxMsg', { name: entry.box.name }), [
                                  { text: t('common.cancel'), style: 'cancel' },
                                  { text: t('profile.account.leave'), style: 'destructive', onPress: async () => {
                                    await switchBox(entry.box.id);
                                    const { error } = await leaveBox();
                                    if (error) Alert.alert(t('common.error'), error);
                                  }},
                                ]);
                              }
                            }}
                            style={{ padding: 6 }}
                            activeOpacity={0.7}
                          >
                            <Text style={S.leaveText}>{t('profile.account.leave')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={S.noBoxText}>{t('profile.account.noBox')}</Text>
              )}
              <AxButton testID="profile-join-box" variant="outline" icon={Hash} label={t('profile.account.joinBox')} onPress={() => setJoinModal(true)} fullWidth />
              {membershipStates.map(m => (
                <View key={m.boxId} style={S.subStateRow}>
                  {m.name ? <Text style={S.subStateBox}>{m.name}</Text> : null}
                  <Text style={[S.subStateText, (m.state.key === 'suspended' || m.state.key === 'pastDue') && { color: theme.ax.danger }]}>
                    {membershipStateText(m.state)}
                  </Text>
                </View>
              ))}
              {myBoxes.filter(e => needsPlan(planStatuses[e.box.id])).map(e => {
                const url = planActivationUrl(planStatuses[e.box.id], e.box.slug);
                return (
                  <View key={`plan-${e.box.id}`} style={S.planRow} testID={`profile-plan-${e.box.id}`}>
                    <View style={S.planHead}>
                      <Text style={S.planBox}>{e.box.name}</Text>
                      <Text style={S.planState}>{t('profile.account.subscription.toActivate')}</Text>
                    </View>
                    {url && (
                      <AxButton
                        testID={`profile-plan-${e.box.id}-cta`}
                        icon={ExternalLink}
                        label={t('plan.activateCta')}
                        onPress={() => Linking.openURL(url)}
                        fullWidth
                      />
                    )}
                    <Text style={S.planHint}>{url ? t('profile.account.subscription.toActivateHint') : t('plan.counterHint')}</Text>
                  </View>
                );
              })}
              {myBoxes.some(e => e.role === 'member') && (
                <>
                  <TouchableOpacity
                    style={[S.manageSubBtn, { marginTop: 10 }]}
                    onPress={() => Linking.openURL(`${WEB_URL}/compte`)}
                    activeOpacity={0.8}
                  >
                    <ExternalLink color={theme.ax.accentText} size={16} />
                    <Text style={S.manageSubBtnText}>{t('profile.account.manageSubscription')}</Text>
                  </TouchableOpacity>
                  <Text style={S.manageSubHint}>{t('profile.account.manageSubscriptionSub')}</Text>
                </>
              )}
            </AxCard>

            {/* ── Mes Programmes ─────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-programs">
              <Text style={S.compteCardTitle}>{t('profile.account.myPrograms')}</Text>
              {myPrograms.length > 0 ? (
                <>
                  {myPrograms.map(prog => {
                    const currentWeek = programWeekAt(prog.start_date, toLocalIso(new Date()));
                    return (
                      <TouchableOpacity
                        key={prog.id}
                        style={[S.boxRow, { marginBottom: 8 }]}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('ProgramDetail', {
                          programId: prog.id,
                          programTitle: prog.title,
                          startDate: prog.start_date,
                          progType: prog.type,
                          durationWeeks: prog.duration_weeks,
                          daysPerWeek: prog.days_per_week,
                        })}
                      >
                        <BookOpen color={theme.ax.accentText} size={20} />
                        <View style={{ flex: 1 }}>
                          <Text style={S.rowLabel} numberOfLines={2}>{prog.title}</Text>
                          <Text style={S.rowValue}>
                            {!prog.start_date
                              ? t('profile.account.progChooseStart')
                              : prog.type === 'fixed'
                              ? t('profile.account.progFixed', { week: currentWeek, total: prog.duration_weeks, days: prog.days_per_week })
                              : t('profile.account.progOngoing', { days: prog.days_per_week })}
                          </Text>
                        </View>
                        <View style={S.activeTag}>
                          <Text style={S.activeTagText}>{t('profile.account.active')}</Text>
                        </View>
                        <ChevronRight color={theme.ax.textMuted} size={16} />
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <Text style={S.noBoxText}>{t('profile.account.noProgram')}</Text>
              )}
              <TouchableOpacity style={S.joinBtn} onPress={() => setProgModal(true)} activeOpacity={0.8}>
                <BookOpen color={theme.ax.text} size={16} />
                <Text style={S.joinBtnText}>{t('profile.account.joinProgram')}</Text>
              </TouchableOpacity>
            </AxCard>

            {/* ── Edit profile ─────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-info">
              <View style={S.compteCardHeader}>
                <Text style={S.compteCardTitle}>{t('profile.account.myInfo')}</Text>
                {!editing ? (
                  <TouchableOpacity onPress={() => setEditing(true)} style={S.editIconBtn}>
                    <Edit3 color={theme.ax.accentText} size={16} />
                    <Text style={S.editIconText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditing(false)} style={S.editIconBtn}>
                    <X color={theme.ax.textMuted} size={16} />
                    <Text style={[S.editIconText, { color: theme.ax.textMuted }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!editing ? (
                <View style={S.infoRows}>
                  <InfoRow label={t('profile.account.usernameLabel')} value={user?.username ?? ''} S={S} />
                  <InfoRow label={t('profile.account.nameLabel')} value={user?.full_name || '—'} S={S} />
                  <InfoRow label={t('profile.account.emailLabel')} value={user?.email ?? ''} S={S} />
                  <InfoRow label={t('profile.account.levelLabel')} value={user?.level ? user.level.toUpperCase() : '—'} S={S} />
                  <InfoRow label={t('profile.account.bioLabel')} value={user?.bio || t('profile.account.bioEmpty')} S={S} />
                  <InfoRow label={t('profile.account.photoLabel')} value={user?.avatar_url ? t('profile.account.photoSet') : t('profile.account.photoUnset')} S={S} />
                  {/* Rôle */}
                  <View style={S.infoRow}>
                    <Text style={S.infoRowLabel}>{t('profile.account.roleLabel')}</Text>
                    <View style={S.roleBadge}>
                      <Text style={S.roleBadgeText}>{roleLabel}</Text>
                    </View>
                  </View>
                  {/* Box invite code (owner only) */}
                  {user?.role === 'box_owner' && currentBox && (
                    <View style={S.infoRow}>
                      <Text style={S.infoRowLabel}>{t('profile.account.boxCode')}</Text>
                      <TouchableOpacity style={S.inviteCodeRow} onPress={handleShareBoxCode} activeOpacity={0.7}>
                        <Text style={S.inviteCodeText}>{boxInviteCode ?? '••••••'}</Text>
                        <Share2 size={14} color={theme.text} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={S.editForm}>
                  {/* Photo */}
                  <View style={S.photoPickerRow}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={S.photoPreview} />
                    ) : (
                      <View style={S.photoPlaceholder}>
                        <Text style={S.photoPlaceholderText}>{user?.username?.[0]?.toUpperCase() ?? 'A'}</Text>
                      </View>
                    )}
                    <View style={S.photoPickerBtns}>
                      <TouchableOpacity style={S.photoBtn} onPress={handlePickPhoto} disabled={pickingPhoto} activeOpacity={0.8}>
                        {pickingPhoto ? <ActivityIndicator color={theme.text} size="small" /> : <><Camera color={theme.textSecondary} size={14} /><Text style={S.photoBtnText}>{t('profile.account.gallery')}</Text></>}
                      </TouchableOpacity>
                      <TouchableOpacity style={S.photoBtn} onPress={handleTakePhoto} disabled={pickingPhoto} activeOpacity={0.8}>
                        <Camera color={theme.textMuted} size={14} />
                        <Text style={[S.photoBtnText, { color: theme.textMuted }]}>{t('profile.account.camera')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={S.editLabel}>{t('profile.account.usernameLabel')}</Text>
                  <TextInput style={S.editInput} value={editUsername} onChangeText={setEditUsername} autoCapitalize="none" placeholder={t('profile.account.usernameLabel')} placeholderTextColor={theme.textMuted} />

                  <View style={S.editRow}>
                    <View style={S.editField}>
                      <Text style={S.editLabel}>{t('profile.account.firstName')}</Text>
                      <TextInput style={S.editInput} value={firstName} onChangeText={setFirstName} placeholder={t('profile.account.firstName')} placeholderTextColor={theme.textMuted} />
                    </View>
                    <View style={S.editField}>
                      <Text style={S.editLabel}>{t('profile.account.lastName')}</Text>
                      <TextInput style={S.editInput} value={lastName} onChangeText={setLastName} placeholder={t('profile.account.lastName')} placeholderTextColor={theme.textMuted} />
                    </View>
                  </View>

                  <Text style={S.editLabel}>{t('auth.gender')}</Text>
                  <View style={S.genderRow}>
                    {(['male', 'female'] as const).map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[S.genderCard, editGender === g && S.genderCardActive]}
                        onPress={() => setEditGender(editGender === g ? null : g)}
                        activeOpacity={0.8}
                      >
                        <Text style={[S.genderLabel, editGender === g && S.genderLabelActive]}>
                          {t(g === 'male' ? 'auth.male' : 'auth.female')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={S.editLabel}>{t('profile.account.levelLabel')}</Text>
                  <View style={S.levelRow} testID="profile-level-selector">
                    {ATHLETE_LEVELS.map(l => {
                      const c = LevelColors[l];
                      const active = editLevel === l;
                      return (
                        <TouchableOpacity
                          key={l}
                          style={[S.levelChip, active && { borderColor: c, backgroundColor: `${c}18` }]}
                          onPress={() => setEditLevel(l)}
                          activeOpacity={0.8}
                          testID={`profile-level-${l}`}
                        >
                          <Text style={[S.levelChipText, active && { color: c }]}>{l.toUpperCase()}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={S.levelHint}>{t('profile.account.levelHint')}</Text>

                  <Text style={S.editLabel}>{t('profile.account.bodyweightLabel')}</Text>
                  <TextInput
                    style={S.editInput}
                    value={editBodyweight}
                    onChangeText={setEditBodyweight}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor={theme.textMuted}
                    testID="profile-bodyweight"
                  />
                  <Text style={S.levelHint}>{t('profile.account.bodyweightHint')}</Text>

                  <Text style={S.editLabel}>{t('profile.account.emailLabel')}</Text>
                  <TextInput style={S.editInput} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" placeholder={t('profile.account.emailLabel')} placeholderTextColor={theme.textMuted} />

                  <Text style={S.editLabel}>{t('profile.account.bioHashtags')}</Text>
                  <TextInput
                    style={[S.editInput, S.bioInput]}
                    value={editBio}
                    onChangeText={setEditBio}
                    multiline
                    numberOfLines={3}
                    placeholder={t('profile.account.bioPlaceholder')}
                    placeholderTextColor={theme.textMuted}
                  />

                  <TouchableOpacity style={S.saveBtn} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
                    {saving ? <ActivityIndicator color={theme.onAccent} size="small" /> : <><Check color={theme.onAccent} size={16} /><Text style={S.saveBtnText}>{t('common.save')}</Text></>}
                  </TouchableOpacity>

                  <TouchableOpacity style={S.pwdBtn} onPress={() => setPwdModal(true)} activeOpacity={0.85}>
                    <Lock color={theme.text} size={14} />
                    <Text style={S.pwdBtnText}>{t('profile.password.title')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </AxCard>
            {/* ── Mes amis ─────────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-friends">
              <Text style={S.compteCardTitle}>{t('profile.account.myFriends', { count: friends.length })}</Text>
              {friends.length === 0 ? (
                <Text style={S.friendsEmpty}>{t('profile.account.noFriends')}</Text>
              ) : (
                <View style={S.friendsList}>
                  {friends.map(f => {
                    const fc = LevelColors[f.level as keyof typeof LevelColors] ?? theme.accent;
                    const fInk = f.level ? levelInk(f.level, theme.ax) : theme.ax.accentText;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={S.friendRow}
                        onPress={() => navigation.navigate('PublicProfile', { userId: f.id })}
                        activeOpacity={0.8}
                        testID={`profile-friend-${f.id}`}
                      >
                        <UserAvatar
                          uri={f.avatar_url}
                          name={f.username ?? '?'}
                          size={36}
                          borderRadius={12}
                          borderWidth={2}
                          borderColor={fc}
                          backgroundColor={`${fc}20`}
                          textColor={fInk}
                          fontSize={14}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={S.friendName} numberOfLines={1}>{f.username}</Text>
                          <Text style={[S.friendLevel, { color: fInk }]}>{f.level?.toUpperCase()}</Text>
                        </View>
                        <ChevronRight color={theme.ax.textMuted} size={16} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </AxCard>

            {/* ── Abonnement AthleX (gérant) ─────────── */}
            {isOwnerAdmin && (
              <AxCard
                style={S.compteCard}
                onPress={() => navigation.getParent()?.navigate('BODashboard', { screen: 'BOSubscription' })}
                accessibilityLabel={hasAthlexSub ? t('profile.athlexSub.manage') : t('profile.athlexSub.subscribe')}
                testID={hasAthlexSub ? 'profile-athlex-sub' : 'profile-athlex-sub-empty'}
              >
                <Text style={S.compteCardTitle}>{t('profile.athlexSub.title')}</Text>
                <View style={S.themeRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <CreditCard color={theme.ax.accentText} size={18} />
                    <View style={{ flex: 1 }}>
                      {hasAthlexSub ? (
                        <>
                          <Text style={S.themeLabel}>{athlexPlanLabel}</Text>
                          <Text style={[S.athlexSubStatus, { color: athlexStatus.color }]}>{athlexStatus.text}</Text>
                        </>
                      ) : (
                        <Text style={S.themeLabel}>{t('profile.athlexSub.none')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={S.athlexSubBtn}>
                    <Text style={S.athlexSubBtnText}>{hasAthlexSub ? t('profile.athlexSub.manage') : t('profile.athlexSub.subscribe')}</Text>
                    <ChevronRight color={theme.ax.accentText} size={16} />
                  </View>
                </View>
              </AxCard>
            )}

            {/* ── Mes entraînements ───────────────────── */}
            <AxCard
              style={S.compteCard}
              onPress={() => navigation.navigate('WodHistory' as never)}
              accessibilityLabel={t('profile.myTrainings')}
              testID="profile-my-trainings"
            >
              <View style={S.themeRow}>
                <Text style={S.compteCardTitle}>{t('profile.myTrainings')}</Text>
                <ChevronRight color={theme.ax.textMuted} size={16} />
              </View>
            </AxCard>

            {/* ── CGU + Confidentialité ──────────────── */}
            <AxCard
              style={S.compteCard}
              onPress={() => navigation.navigate('Legal' as never)}
              accessibilityLabel={t('profile.legal')}
              testID="profile-legal"
            >
              <View style={S.themeRow}>
                <Text style={S.compteCardTitle}>{t('profile.legal')}</Text>
                <ChevronRight color={theme.ax.textMuted} size={16} />
              </View>
            </AxCard>

            {/* ── Apparence ───────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-appearance">
              <Text style={S.compteCardTitle}>{t('profile.appearance')}</Text>
              <View style={S.themeRow}>
                <View style={S.rowStart}>
                  {mode === 'dark' ? <Moon color={theme.ax.text} size={18} /> : <Sun color={theme.ax.text} size={18} />}
                  <Text style={S.themeLabel}>{mode === 'dark' ? t('profile.darkMode') : t('profile.lightMode')}</Text>
                </View>
                <AxSwitch
                  value={mode === 'dark'}
                  onValueChange={toggleTheme}
                  accessibilityLabel={mode === 'dark' ? t('profile.darkMode') : t('profile.lightMode')}
                  testID="profile-theme-switch"
                />
              </View>
            </AxCard>

            {/* ── Langue ──────────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-language">
              <Text style={S.compteCardTitle}>{t('profile.language')}</Text>
              <View style={S.langRow}>
                {(['fr', 'en'] as const).map(lng => (
                  <AxChip
                    key={lng}
                    label={lng === 'fr' ? 'Français' : 'English'}
                    selected={i18n.language === lng}
                    onPress={() => setLanguage(lng)}
                    testID={`profile-lang-${lng}`}
                  />
                ))}
              </View>
            </AxCard>

            {/* ── Utilisateurs bloqués ──────────────────── */}
            <AxCard
              style={S.compteCard}
              onPress={() => navigation.navigate('BlockedUsers' as never)}
              accessibilityLabel={t('profile.blockedUsers')}
              testID="profile-blocked"
            >
              <View style={S.themeRow}>
                <Text style={S.compteCardTitle}>{t('profile.blockedUsers')}</Text>
                <ChevronRight color={theme.ax.textMuted} size={16} />
              </View>
            </AxCard>

            {/* ── Notifications ─────────────────────────── */}
            <AxCard
              style={S.compteCard}
              onPress={() => navigation.navigate('NotificationSettings')}
              accessibilityLabel={t('profile.notifications')}
              testID="profile-notifications"
            >
              <View style={S.themeRow}>
                <View style={S.rowStart}>
                  <Bell color={theme.ax.text} size={18} />
                  <Text style={S.themeLabel}>{t('profile.notifications')}</Text>
                </View>
                <ChevronRight color={theme.ax.textMuted} size={16} />
              </View>
            </AxCard>

            {/* ── Referral code ────────────────────────── */}
            <AxCard style={S.compteCard} testID="profile-card-referral">
              <Text style={S.compteCardTitle}>{t('profile.referralCode')}</Text>
              <Text style={S.referralDesc}>
                {t('profile.referralDesc')}
              </Text>
              {referralCode ? (
                <View style={S.referralBox}>
                  <Text style={S.referralCode}>{referralCode}</Text>
                </View>
              ) : (
                <ActivityIndicator color={theme.text} size="small" style={{ marginVertical: 8 }} />
              )}
              <View style={S.referralBtns}>
                <TouchableOpacity style={S.referralBtn} onPress={handleCopyReferral} disabled={!referralCode} activeOpacity={0.8}>
                  <Copy color={theme.ax.text} size={15} />
                  <Text style={S.referralBtnText}>{t('profile.referral.copy')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.referralBtn, S.referralBtnShare]} onPress={handleShareReferral} disabled={!referralCode} activeOpacity={0.8}>
                  <Share2 color={theme.ax.onAccent} size={15} />
                  <Text style={[S.referralBtnText, { color: theme.ax.onAccent }]}>{t('profile.referral.share')}</Text>
                </TouchableOpacity>
              </View>
            </AxCard>

            {/* ── Supprimer le compte ───────────────────── */}
            <AxCard style={[S.compteCard, S.dangerCard]} testID="profile-card-danger">
              <Text style={[S.compteCardTitle, S.dangerTitle]}>{t('profile.account.dangerZone')}</Text>
              <Text style={S.dangerText}>
                {t('profile.account.deleteWarning')}
              </Text>
              <AxButton
                variant="stop"
                label={t('profile.deleteAccount')}
                onPress={handleDeleteAccount}
                disabled={deleting}
                loading={deleting}
                fullWidth
                testID="profile-delete-account"
              />
            </AxCard>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Join box modal ────────────────────────────────────── */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>{t('profile.account.joinBox')}</Text>
            <Text style={S.modalSub}>{t('profile.account.joinBoxSub')}</Text>
            <AxTextField
              testID="profile-join-code"
              inputStyle={S.codeInput}
              value={joinCode}
              onChangeText={v => setJoinCode(v.toUpperCase())}
              placeholder="Ex : ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[S.joinBtn, (!joinCode.trim() || joining) && { opacity: 0.5 }]}
              onPress={handleJoinBox}
              disabled={!joinCode.trim() || joining}
              activeOpacity={0.85}
            >
              {joining ? <ActivityIndicator color={theme.text} size="small" /> : <><Hash color={theme.text} size={16} /><Text style={S.joinBtnText}>{t('profile.account.join')}</Text></>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setJoinModal(false)} style={S.modalCancel}>
              <Text style={S.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Changement de mot de passe ──────────────────────────── */}
      <Modal visible={pwdModal} transparent animationType="slide" onRequestClose={() => setPwdModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>{t('profile.password.title')}</Text>
            <TextInput
              style={S.editInput}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              placeholder={t('profile.password.current')}
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={S.editInput}
              value={newPwd}
              onChangeText={setNewPwd}
              placeholder={t('profile.password.new')}
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={S.editInput}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              placeholder={t('profile.password.confirm')}
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[S.joinBtn, (!currentPwd || !newPwd || !confirmPwd || changingPwd) && { opacity: 0.5 }]}
              onPress={handleChangePassword}
              disabled={!currentPwd || !newPwd || !confirmPwd || changingPwd}
              activeOpacity={0.85}
            >
              {changingPwd ? <ActivityIndicator color={theme.text} size="small" /> : <><Lock color={theme.text} size={16} /><Text style={S.joinBtnText}>{t('common.save')}</Text></>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPwdModal(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }} style={S.modalCancel}>
              <Text style={S.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Join program modal ──────────────────────────────────── */}
      <Modal visible={progModal} transparent animationType="slide" onRequestClose={() => setProgModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>{t('profile.account.joinProgram')}</Text>
            <Text style={S.modalSub}>{t('profile.account.joinProgramSub')}</Text>
            <TextInput
              style={S.codeInput}
              value={progCode}
              onChangeText={v => setProgCode(v.toUpperCase())}
              placeholder="Ex : FORCE6"
              placeholderTextColor={theme.textMuted}
              maxLength={6}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={[S.joinBtn, (!progCode.trim() || joiningProg) && { opacity: 0.5 }]}
              onPress={handleJoinProgram}
              disabled={!progCode.trim() || joiningProg}
              activeOpacity={0.85}
            >
              {joiningProg ? <ActivityIndicator color={theme.text} size="small" /> : <><BookOpen color={theme.text} size={16} /><Text style={S.joinBtnText}>{t('profile.account.join')}</Text></>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProgModal(false)} style={S.modalCancel}>
              <Text style={S.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, S }: { label: string; value: string; S: ReturnType<typeof createStyles> }) {
  return (
    <View style={S.infoRow}>
      <Text style={S.infoRowLabel}>{label}</Text>
      <Text style={S.infoRowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const BADGE_ICONS: Record<string, LucideIcon> = {
  activity: Flame,
  tournament: Trophy,
  social: Users,
  wod: Dumbbell,
  elo: TrendingUp,
  Classement: Medal,
};

function BadgeIcon({ category, earned, color }: { category: string; earned: boolean; color: string }) {
  const Icon = earned ? (BADGE_ICONS[category] ?? Award) : Lock;
  return <Icon color={color} size={26} />;
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingTop: 58, paddingHorizontal: axSpacing.xl, paddingBottom: axSpacing.xl,
    backgroundColor: c.surface,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: axSpacing.xl },
  userInfo: { flex: 1, minWidth: 0, gap: 2 },
  username: { ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text },
  email: { ...axTypography.bodySmall, color: c.textMuted, marginBottom: 6 },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: axRadius.badge, paddingHorizontal: axSpacing.sm, paddingVertical: 3,
    alignSelf: 'flex-start', borderWidth: 1,
  },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { ...axTypography.labelSmall, letterSpacing: 0.5 },
  logoutBtn: { padding: 8 },
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statPill: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statPillBorder: { borderRightWidth: 1, borderRightColor: c.border },
  statPillValue: { ...axTypography.numberM, color: c.text },
  statPillLabel: { ...axTypography.overlineSmall, color: c.textMuted, marginTop: 2, textAlign: 'center' },
  progressSection: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: axSpacing.sm, marginBottom: 6 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  progressLabel: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
  progressPct: { ...axTypography.caption, fontFamily: axTypography.label.fontFamily, color: c.accentText },
  progressTrack: { height: 4, backgroundColor: c.field, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressNote: { ...axTypography.caption, color: c.textMuted },
  tabs: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: axSpacing.sm,
    paddingHorizontal: axSpacing.xl, paddingVertical: axSpacing.md,
  },
  content: { padding: axSpacing.xl, paddingBottom: 120 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '47%', flexGrow: 1, alignItems: 'center', gap: 6 },
  gridValue: { ...axTypography.numberM, color: c.text },
  gridLabel: { ...axTypography.caption, color: c.textMuted, textAlign: 'center' },
  emptyBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  emptyBannerTitle: { ...axTypography.label, color: c.text },
  emptyBannerSub: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },
  prSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.field, borderRadius: axRadius.control,
    paddingHorizontal: 12, marginBottom: 12,
    borderWidth: 1, borderColor: c.fieldBorder,
  },
  prSearchInput: { flex: 1, paddingVertical: 10, ...axTypography.body, color: c.text },
  prNoResults: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingVertical: 24 },
  prCategory: { padding: 0, gap: 0, marginBottom: 10 },
  prCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  prCategoryLabel: { flex: 1, ...axTypography.label, color: c.text },
  prCategoryCount: { ...axTypography.bodySmall, color: c.textMuted },
  prRow: {
    flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  prMovement: { ...axTypography.label, color: c.text },
  prDate: { ...axTypography.caption, color: c.textMuted },
  prValue: { ...axTypography.numberM, color: c.text },
  prUnit: { ...axTypography.bodySmall, color: c.textMuted },
  streakWidget: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  streakTitle: { ...axTypography.titleM, color: c.text },
  streakSub: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2, marginBottom: 6 },
  streakBar: { height: 6, backgroundColor: c.field, borderRadius: 3, overflow: 'hidden' as const },
  streakBarFill: { height: 6, backgroundColor: c.accent, borderRadius: 3 },
  badgeSummary: { marginBottom: 16, gap: 4 },
  badgeSummaryText: { ...axTypography.bodySmall, color: c.textMuted },
  pinnedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinnedText: { ...axTypography.labelSmall, color: c.accentText },
  pinHint: { ...axTypography.caption, color: c.textMuted, marginBottom: 8, marginTop: -4 },
  badgeCategoryBlock: { marginBottom: 24 },
  badgeCategoryTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: 10 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCell: { width: '47%', flexGrow: 1 },
  badgeCard: { alignItems: 'center', gap: 4, flex: 1 },
  badgeCardLocked: { borderStyle: 'dashed' },
  badgeCardFeatured: { borderColor: c.accentText, borderWidth: 2 },
  badgePin: { position: 'absolute', top: 8, right: 8 },
  badgeName: { ...axTypography.label, color: c.text, textAlign: 'center' },
  badgeDesc: { ...axTypography.caption, color: c.textMuted, textAlign: 'center' },
  earnedBar: { height: 2, width: 24, backgroundColor: c.accent, borderRadius: 1, marginTop: 4 },

  compteSection: { gap: 16, paddingBottom: 8 },
  compteCard: { gap: 14 },
  compteCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compteCardTitle: { ...axTypography.overline, color: c.textMuted, flexShrink: 1 },
  editIconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editIconText: { ...axTypography.labelSmall, color: c.accentText },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.sm },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  themeLabel: { ...axTypography.label, color: c.text, flexShrink: 1 },
  rowLabel: { ...axTypography.label, color: c.text },
  rowValue: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 1 },
  athlexSubStatus:  { ...axTypography.bodySmall, marginTop: 2 },
  athlexSubBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  athlexSubBtnText: { ...axTypography.labelSmall, color: c.accentText },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm },

  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxName: { ...axTypography.label, color: c.text },
  activeTag: {
    borderRadius: axRadius.badge, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: c.accentText,
  },
  activeTagText: { ...axTypography.labelSmall, color: c.accentText },
  leaveText: { ...axTypography.labelSmall, color: c.danger },
  noBoxText: { ...axTypography.bodySmall, color: c.textMuted },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: c.field, borderRadius: axRadius.control, padding: 14,
    borderWidth: 1, borderColor: c.border,
  },
  joinBtnText: { ...axTypography.label, color: c.text },
  manageSubBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: 'transparent', borderRadius: axRadius.control, padding: 13,
    borderWidth: 1, borderColor: c.accentText,
  },
  manageSubBtnText: { ...axTypography.label, color: c.accentText },
  manageSubHint: { ...axTypography.caption, color: c.textMuted, marginTop: 6, textAlign: 'center' },
  subStateRow: { marginTop: 10, gap: 2 },
  planRow: { marginTop: 10, gap: 10 },
  planHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: axSpacing.sm },
  planBox: { ...axTypography.bodySmall, color: c.textMuted },
  planState: { ...axTypography.labelSmall, color: c.warning },
  planHint: { ...axTypography.bodySmall, color: c.textMuted },
  subStateBox: { ...axTypography.labelSmall, color: c.text },
  subStateText: { ...axTypography.bodySmall, color: c.textMuted },

  infoRows: { gap: 0 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  infoRowLabel: { ...axTypography.label, color: c.text },
  infoRowValue: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1, maxWidth: '60%', textAlign: 'right' },

  editForm: { gap: 12 },
  editRow: { flexDirection: 'row', gap: 10 },
  editField: { flex: 1, gap: 4 },
  editLabel: { ...axTypography.overlineSmall, color: c.textMuted },
  editInput: {
    backgroundColor: c.field, borderRadius: axRadius.control, borderWidth: 1,
    borderColor: c.fieldBorder, paddingHorizontal: 12, paddingVertical: 10,
    ...axTypography.body, color: c.text,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: c.accent, borderRadius: axRadius.control, padding: 14, marginTop: 4,
  },
  saveBtnText: { ...axTypography.label, color: c.onAccent },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderCard: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
    borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.field,
  },
  genderCardActive: { borderColor: c.accentText },
  genderLabel: { ...axTypography.labelSmall, color: c.textMuted },
  genderLabelActive: { color: c.text },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.field,
  },
  levelChipText: { ...axTypography.labelSmall, color: c.textMuted, letterSpacing: 0.4 },
  levelHint: { ...axTypography.caption, color: c.textMuted, marginTop: 6 },

  pwdBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, padding: 12,
  },
  pwdBtnText: { ...axTypography.label, color: c.text },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.modalBackdrop },
  modalSheet: {
    backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14, paddingBottom: 40,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
  modalSub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  codeInput: { ...axTypography.numberM, textAlign: 'center', letterSpacing: 6 },
  modalCancel: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { ...axTypography.label, color: c.textMuted },

  photoPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoPreview: { width: 64, height: 64, borderRadius: 20, borderWidth: 2, borderColor: c.border },
  photoPlaceholder: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: c.field, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: c.border,
  },
  photoPlaceholderText: { ...axTypography.titleL, color: c.textMuted },
  photoPickerBtns: { flex: 1, gap: 8 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.field, borderRadius: axRadius.control, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: c.border,
  },
  photoBtnText: { ...axTypography.labelSmall, color: c.text },

  bioInput: { minHeight: 70, textAlignVertical: 'top' },

  friendsEmpty: { ...axTypography.bodySmall, color: c.textMuted },
  friendsList: { gap: 8 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.field, borderRadius: axRadius.control,
    padding: 10, borderWidth: 1, borderColor: c.border,
  },
  friendName: { ...axTypography.label, color: c.text },
  friendLevel: { ...axTypography.labelSmall, letterSpacing: 0.5, marginTop: 1 },

  prValueBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  prEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prEditInput: {
    backgroundColor: c.field, borderRadius: 8, borderWidth: 1,
    borderColor: c.accentText, paddingHorizontal: 8, paddingVertical: 4,
    ...axTypography.label, color: c.text, width: 70, textAlign: 'right',
  },
  prEditConfirm: {
    width: 28, height: 28, borderRadius: 10,
    backgroundColor: c.field, justifyContent: 'center', alignItems: 'center',
  },

  referralDesc: { ...axTypography.bodySmall, color: c.textMuted },
  referralBox: {
    backgroundColor: c.field, borderRadius: axRadius.control, borderWidth: 1,
    borderColor: c.border, paddingVertical: 14, alignItems: 'center',
    borderStyle: 'dashed',
  },
  referralCode: { ...axTypography.numberM, color: c.text, letterSpacing: 6 },
  referralBtns: { flexDirection: 'row', gap: 10 },
  referralBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: axRadius.control, paddingVertical: 11,
    backgroundColor: c.field, borderWidth: 1, borderColor: c.border,
  },
  referralBtnShare: { backgroundColor: c.accent, borderColor: c.accent },
  referralBtnText: { ...axTypography.label, color: c.text },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: axRadius.badge, borderWidth: 1, borderColor: c.border },
  roleBadgeText: { ...axTypography.bodySmall, color: c.textMuted },
  inviteCodeRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  inviteCodeText: { ...axTypography.label, letterSpacing: 2, color: c.text },
  dangerCard: { borderColor: c.danger },
  dangerTitle: { color: c.danger },
  dangerText: { ...axTypography.bodySmall, color: c.textMuted },
}); }
