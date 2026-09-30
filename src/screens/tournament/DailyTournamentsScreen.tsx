import i18n from '../../i18n';
import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxIconButton } from '../../components/ax/AxIconButton';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { Plus, Users, Zap, Trophy, ChevronRight } from 'lucide-react-native';
import { AxButton, AxCard, AxChip, AxStatusDot, AxTag, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { LevelColors } from '../../theme/designTokens';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { GenderTarget } from '../../types';
import { trackDailyTournamentJoin, trackDailyTournamentCreate } from '../../lib/analytics';
import GlassBackground from '../../components/glass/GlassBackground';
import { fetchMyProfile } from '../../services/myProfile';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<any>;

interface DailyTournament {
  id: string;
  creator_id: string;
  wod_name: string;
  wod_type: string;
  duration: number;
  level: string;
  movements: string;
  scoring: string | null;
  score_mode: string;
  max_players: number;
  status: string;
  elo_reward: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  participant_count: number;
  has_joined: boolean;
  has_scored: boolean;
  creator_name: string;
}

const WOD_TYPES = ['For Time', 'AMRAP', 'EMOM'] as const;
const SCORE_MODES: { key: string; label: string }[] = [
  { key: 'time', label: 'Temps' },
  { key: 'reps', label: 'Reps' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'weight', label: 'Poids (kg)' },
];

export default function DailyTournamentsScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);
  const c = theme.ax;

  const [tournaments, setTournaments] = useState<DailyTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModal, setCreateModal] = useState(false);

  // Create form
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<string>('For Time');
  const [formDuration, setFormDuration] = useState('12');
  const [formLevel, setFormLevel] = useState('rx');
  const [formMovements, setFormMovements] = useState('');
  const [formScoreMode, setFormScoreMode] = useState('time');
  const [formGender, setFormGender] = useState<GenderTarget>('mix');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('daily_tournaments')
      .select(`
        *,
        participants:daily_tournament_participants(user_id),
        scores:daily_tournament_scores(user_id),
        creator:profiles!creator_id(username)
      `)
      .eq('is_official', false)
      .in('status', ['open', 'active'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) { captureError(error, { screen: 'DailyTournaments', action: 'loadTournaments' }); }

    const mapped: DailyTournament[] = (data ?? []).map((t: any) => ({
      ...t,
      participant_count: t.participants?.length ?? 0,
      has_joined: (t.participants ?? []).some((p: any) => p.user_id === user.id),
      has_scored: (t.scores ?? []).some((s: any) => s.user_id === user.id),
      creator_name: (Array.isArray(t.creator) ? t.creator[0] : t.creator)?.username ?? '—',
    }));

    setTournaments(mapped);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleJoin(tournamentId: string) {
    if (!user) return;
    // Gender check
    const t = tournaments.find(x => x.id === tournamentId);
    const gt = (t as any)?.gender_target;
    if (gt && gt !== 'mix') {
      const profile = await fetchMyProfile();
      if (profile?.gender && profile.gender !== gt) {
        const label = gt === 'male' ? 'hommes' : 'femmes';
        Alert.alert('Accès restreint', `Ce tournoi est réservé aux ${label}.`);
        return;
      }
      if (!profile?.gender) {
        Alert.alert('Genre non renseigné', 'Renseigne ton genre dans ton profil pour rejoindre ce tournoi.');
        return;
      }
    }
    const { error } = await supabase.from('daily_tournament_participants').upsert({
      tournament_id: tournamentId,
      user_id: user.id,
    }, { onConflict: 'tournament_id,user_id', ignoreDuplicates: true });
    if (error) { Alert.alert('Erreur', error.message); return; }
    trackDailyTournamentJoin(tournamentId);
    load();
  }

  async function handleCreate() {
    if (!user || !formName.trim() || !formMovements.trim()) return;
    setCreating(true);

    const { data, error } = await supabase.from('daily_tournaments').insert({
      creator_id: user.id,
      wod_name: formName.trim(),
      wod_type: formType,
      duration: parseInt(formDuration) || 12,
      level: formLevel,
      movements: formMovements.trim(),
      score_mode: formScoreMode,
      gender_target: formGender,
      status: 'open',
      ends_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    setCreating(false);
    if (error) { Alert.alert('Erreur', error.message); return; }

    // Auto-join
    if (data) {
      await supabase.from('daily_tournament_participants').upsert({
        tournament_id: data.id,
        user_id: user.id,
      }, { onConflict: 'tournament_id,user_id', ignoreDuplicates: true });
    }

    trackDailyTournamentCreate();
    setCreateModal(false);
    resetForm();
    load();
  }

  function resetForm() {
    setFormName('');
    setFormType('For Time');
    setFormDuration('12');
    setFormLevel('rx');
    setFormMovements('');
    setFormScoreMode('time');
    setFormGender('mix');
  }

  function timeLeft(endsAt: string): string {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Terminé';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  function renderTournament({ item }: { item: DailyTournament }) {
    const isFull = item.participant_count >= item.max_players;
    const remaining = timeLeft(item.ends_at);

    return (
      <AxCard
        testID={`mini-card-${item.id}`}
        onPress={() => navigation.navigate('DailyTournamentDetail', { tournamentId: item.id })}
        accessibilityLabel={item.wod_name}
      >
        <View style={S.cardTop}>
          <View style={S.badges}>
            <AxTag label={item.wod_type} testID={`mini-type-${item.id}`} />
            <AxTag label={item.level.toUpperCase()} color={levelInk(item.level, c)} testID={`mini-level-${item.id}`} />
            {item.duration > 0 && <AxTag label={`${item.duration}m`} tone="muted" />}
          </View>
          <AxStatusDot label={remaining} tone={remaining === 'Terminé' ? 'danger' : 'active'} testID={`mini-status-${item.id}`} />
        </View>

        <View style={S.cardHead}>
          <Text style={S.cardName} numberOfLines={2}>{item.wod_name}</Text>
          <Text style={S.caption} numberOfLines={1}>par {item.creator_name}</Text>
        </View>

        <Text style={S.cardMovements} numberOfLines={2}>{item.movements}</Text>

        <View style={S.cardFooter}>
          <View style={S.metaRow}>
            <Users color={c.textMuted} size={14} />
            <Text testID={`mini-players-${item.id}`} style={[S.caption, isFull && { color: c.danger }]}>
              {item.participant_count}/{item.max_players}
            </Text>
          </View>
          <View style={S.metaRow}>
            <Trophy color={c.textMuted} size={14} />
            <Text style={S.caption}>+{item.elo_reward} ELO</Text>
          </View>
          <View style={S.footerEnd}>
            {!item.has_joined && !isFull && (
              <AxButton label="Rejoindre" variant="outline" onPress={() => handleJoin(item.id)} testID={`mini-join-${item.id}`} />
            )}
            {item.has_joined && !item.has_scored && <AxTag label="Inscrit" dot />}
            {item.has_scored && <AxTag label="Score" tone="muted" dot />}
            <ChevronRight color={c.textMuted} size={16} />
          </View>
        </View>
      </AxCard>
    );
  }

  return (
    <View style={S.screen}>
      <GlassBackground />
      {/* Header */}
      <AxScreenHeader
        title="Mini-Tournois"
        right={<AxIconButton icon={Plus} onPress={() => setCreateModal(true)} accessibilityLabel={i18n.t('common.create')} testID="header-create" />}
      />

      {/* Stats */}
      <View style={S.statsRow}>
        <View style={S.statBox}>
          <Text style={S.statNum} testID="mini-stat-active">{tournaments.length}</Text>
          <Text style={S.statLabel}>Actifs</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statNum}>{tournaments.filter(t => t.has_joined).length}</Text>
          <Text style={S.statLabel}>Mes inscrits</Text>
        </View>
        <View style={S.statBox}>
          <Text style={S.statNum}>{tournaments.filter(t => t.has_scored).length}</Text>
          <Text style={S.statLabel}>Scorés</Text>
        </View>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={t => t.id}
          renderItem={renderTournament}
          contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={S.empty}>
              <Zap color={c.textMuted} size={40} />
              <Text style={S.emptyTitle}>Aucun mini-tournoi en cours</Text>
              <Text style={S.emptySub}>Crée le premier et défie la communauté !</Text>
              <AxButton label="Créer un mini-tournoi" icon={Plus} onPress={() => setCreateModal(true)} testID="mini-empty-create" />
            </View>
          }
        />
      )}

      {/* Create modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.modalOverlay}>
          <View style={S.modalSheet} testID="mini-create-sheet">
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>Nouveau mini-tournoi</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }} contentContainerStyle={S.form}>
              <Text style={S.label}>Nom du WOD</Text>
              <AxTextField value={formName} onChangeText={setFormName} placeholder="Ex: Flash Burner" accessibilityLabel="Nom du WOD" testID="mini-form-name" />

              <Text style={S.label}>Type</Text>
              <View style={S.chipRow}>
                {WOD_TYPES.map(t => (
                  <AxChip key={t} label={t} selected={formType === t} onPress={() => setFormType(t)} testID={`mini-form-type-${t}`} />
                ))}
              </View>

              <Text style={S.label}>Durée (min)</Text>
              <AxTextField value={formDuration} onChangeText={setFormDuration} keyboardType="numeric" placeholder="12" accessibilityLabel="Durée (min)" testID="mini-form-duration" />

              <Text style={S.label}>Niveau</Text>
              <View style={S.chipRow}>
                {Object.keys(LevelColors).map(l => (
                  <AxChip key={l} label={l.toUpperCase()} selected={formLevel === l} onPress={() => setFormLevel(l)} testID={`mini-form-level-${l}`} />
                ))}
              </View>

              <Text style={S.label}>Mode de score</Text>
              <View style={S.chipRow}>
                {SCORE_MODES.map(m => (
                  <AxChip key={m.key} label={m.label} selected={formScoreMode === m.key} onPress={() => setFormScoreMode(m.key)} testID={`mini-form-mode-${m.key}`} />
                ))}
              </View>

              <Text style={S.label}>Genre cible</Text>
              <View style={S.chipRow}>
                {([['mix', 'Mix'], ['male', 'Homme'], ['female', 'Femme']] as [GenderTarget, string][]).map(([val, lbl]) => (
                  <AxChip key={val} label={lbl} selected={formGender === val} onPress={() => setFormGender(val)} testID={`mini-form-gender-${val}`} />
                ))}
              </View>

              <Text style={S.label}>Mouvements</Text>
              <AxTextField
                value={formMovements}
                onChangeText={setFormMovements}
                multiline
                placeholder="21-15-9&#10;Thrusters (43/30 kg)&#10;Pull-ups"
                accessibilityLabel="Mouvements"
                testID="mini-form-movements"
              />
            </ScrollView>

            <AxButton
              label="Lancer le mini-tournoi"
              icon={Zap}
              onPress={handleCreate}
              disabled={!formName.trim() || !formMovements.trim()}
              loading={creating}
              fullWidth
              testID="mini-form-create"
            />
            <AxButton label="Annuler" variant="outline" onPress={() => setCreateModal(false)} fullWidth testID="mini-form-cancel" />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    statsRow: {
      flexDirection: 'row', justifyContent: 'space-around', paddingVertical: axSpacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    statBox: { alignItems: 'center', flex: 1 },
    statNum: { ...axTypography.numberM, color: c.text },
    statLabel: { ...axTypography.overlineSmall, color: c.textMuted, marginTop: 2 },
    list: { padding: axSpacing.lg, gap: axSpacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: axSpacing['2xl'], gap: axSpacing.md },
    emptyTitle: { ...axTypography.label, color: c.text, textAlign: 'center' },
    emptySub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
    badges: { flexDirection: 'row', gap: axSpacing.xs, flexWrap: 'wrap', flex: 1, minWidth: 0 },
    cardHead: { gap: 2 },
    cardName: { ...axTypography.titleM, color: c.text },
    caption: { ...axTypography.caption, color: c.textMuted, flexShrink: 1 },
    cardMovements: { ...axTypography.bodySmall, color: c.textMuted },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, flexWrap: 'wrap' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    footerEnd: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.modalBackdrop },
    modalSheet: {
      backgroundColor: c.background, borderTopLeftRadius: axRadius.card, borderTopRightRadius: axRadius.card,
      borderWidth: 1, borderColor: c.border,
      padding: axSpacing.xl, paddingBottom: 40, gap: axSpacing.md,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center' },
    modalTitle: { ...axTypography.titleM, color: c.text },
    form: { gap: axSpacing.sm, paddingBottom: axSpacing.sm },
    label: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.sm },
    chipRow: { flexDirection: 'row', gap: axSpacing.sm, flexWrap: 'wrap' },
  });
}
