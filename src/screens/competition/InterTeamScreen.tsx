import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxContentTitle } from '../../components/ax/AxContentTitle';
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Modal, FlatList, SafeAreaView,
} from 'react-native';
import {
  Users, UserPlus, Trash2, Crown,
  CheckCircle2, XCircle, Search, Shield, X,
} from 'lucide-react-native';
import { AxButton, AxCard, AxIconButton, AxStatusDot, AxTag, AxTextField } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { CompetitionStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTranslation } from 'react-i18next';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav   = NativeStackNavigationProp<CompetitionStackParamList, 'InterTeam'>;
type Route = RouteProp<CompetitionStackParamList, 'InterTeam'>;

interface Member {
  id: string;
  user_id: string;
  username: string;
  level: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
}

/** Libellé traduit sans son pictogramme de tête. */
function stripGlyph(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]+/u, '');
}

export default function InterTeamScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { competitionId, teamSize } = route.params;
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const S = createStyles(theme);
  const ax = theme.ax;

  const [team,        setTeam]        = useState<any>(null);
  const [members,     setMembers]     = useState<Member[]>([]);
  const [myInvite,    setMyInvite]    = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [teamName,    setTeamName]    = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [inviting,    setInviting]    = useState<string | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [allBoxMembers,    setAllBoxMembers]    = useState<any[]>([]);
  const [loadingMembers,   setLoadingMembers]   = useState(false);
  const [memberSearch,     setMemberSearch]     = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
    const { data: existingTeam } = await supabase
      .from('inter_teams')
      .select('*')
      .eq('competition_id', competitionId)
      .or(`captain_id.eq.${user.id}`)
      .maybeSingle();

    if (existingTeam) {
      setTeam(existingTeam);
      const { data: m } = await supabase
        .from('inter_team_members')
        .select('*, profile:profiles!user_id(username, level, avatar_url)')
        .eq('team_id', existingTeam.id);
      setMembers((m ?? []).map((x: any) => ({
        id: x.id,
        user_id: x.user_id,
        username: (Array.isArray(x.profile) ? x.profile[0] : x.profile)?.username ?? '—',
        level:    (Array.isArray(x.profile) ? x.profile[0] : x.profile)?.level ?? '',
        status: x.status,
        invited_at: x.invited_at,
      })));
    } else {
      const { data: inv } = await supabase
        .from('inter_team_members')
        .select('*, team:inter_teams(id, name, captain_id, competition_id)')
        .eq('user_id', user.id)
        .in('status', ['pending', 'accepted'])
        .filter('team.competition_id', 'eq', competitionId)
        .maybeSingle();
      if (inv) {
        const teamData = Array.isArray(inv.team) ? inv.team[0] : inv.team;
        if (teamData?.competition_id === competitionId) {
          setMyInvite({ ...inv, team: teamData });
          if (inv.status === 'accepted') setTeam(teamData);
        }
      }
    }
    } catch (e) { captureError(e, { screen: 'InterTeam', action: 'load' }); }
    setLoading(false);
  }, [user, competitionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleCreateTeam() {
    if (!user) return;
    if (!teamName.trim()) { Alert.alert(t('interTeam.nameRequired'), t('interTeam.nameRequiredMsg')); return; }
    setSaving(true);
    const { data: newTeam, error } = await supabase.from('inter_teams').insert({
      competition_id: competitionId,
      name: teamName.trim(),
      captain_id: user.id,
      box_id: currentBox?.id ?? null,
    }).select('*').single();
    if (error) { Alert.alert(t('common.error'), error.message); setSaving(false); return; }

    await supabase.from('inter_registrations').upsert({
      competition_id: competitionId,
      team_id: newTeam.id,
      athlete_id: null,
      box_id: currentBox?.id ?? null,
    });
    await load();
    setSaving(false);
  }

  async function openMembersModal() {
    setShowMembersModal(true);
    setLoadingMembers(true);
    setMemberSearch('');
    const alreadyInvited = new Set([user?.id, ...members.map(m => m.user_id)]);
    if (currentBox) {
      const { data: bm } = await supabase
        .from('box_members')
        .select('member_id')
        .eq('box_id', currentBox.id)
        .neq('member_id', user?.id ?? '');
      const userIds = (bm ?? []).map((x: any) => x.member_id).filter((id: string) => !alreadyInvited.has(id));
      if (userIds.length === 0) { setAllBoxMembers([]); setLoadingMembers(false); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, level, elo, avatar_url')
        .in('id', userIds);
      setAllBoxMembers((profiles ?? []).map((p: any) => ({ id: p.id, username: p.username, level: p.level, elo: p.elo })));
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, level, elo, avatar_url')
        .neq('id', user?.id ?? '')
        .limit(50);
      const list = (data ?? []).filter((p: any) => !alreadyInvited.has(p.id));
      setAllBoxMembers(list);
    }
    setLoadingMembers(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    let results: { id: string; username: string; level: string }[] = [];
    if (currentBox) {
      const { data } = await supabase
        .from('box_members')
        .select('user_id, profile:profiles!user_id(id, username, level, avatar_url)')
        .eq('box_id', currentBox.id)
        .neq('user_id', user?.id ?? '');
      results = (data ?? []).map((x: any) => ({
        id: Array.isArray(x.profile) ? x.profile[0]?.id : x.profile?.id,
        username: Array.isArray(x.profile) ? x.profile[0]?.username : x.profile?.username,
        level: Array.isArray(x.profile) ? x.profile[0]?.level : x.profile?.level,
      })).filter(p => p.username?.toLowerCase().includes(searchQuery.toLowerCase()));
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, level, avatar_url')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(20);
      results = (data ?? []).map((p: any) => ({ id: p.id, username: p.username, level: p.level }));
    }
    const alreadyInvited = new Set(members.map(m => m.user_id));
    setSearchResults(results.filter(p => p.id && !alreadyInvited.has(p.id)));
    setSearching(false);
  }

  async function handleInvite(targetUserId: string) {
    if (!team) return;
    const accepted = members.filter(m => m.status === 'accepted').length + 1; // +1 for captain
    if (accepted >= teamSize) {
      Alert.alert(t('interTeam.teamFull'), t('interTeam.teamFullMsg', { n: teamSize }));
      return;
    }
    setInviting(targetUserId);
    const { error } = await supabase.from('inter_team_members').insert({
      team_id: team.id,
      user_id: targetUserId,
      status: 'pending',
    });
    if (error) Alert.alert(t('common.error'), error.code === '23505' ? t('interTeam.alreadyInvited') : error.message);
    else { await load(); setSearchResults([]); setSearchQuery(''); }
    setInviting(null);
  }

  async function handleRemoveMember(memberId: string) {
    Alert.alert(t('interTeam.remove'), t('interTeam.removeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('interTeam.remove'), style: 'destructive',
        onPress: async () => {
          await supabase.from('inter_team_members').delete().eq('id', memberId);
          await load();
        },
      },
    ]);
  }

  async function handleAnswerInvite(status: 'accepted' | 'declined') {
    if (!myInvite) return;
    setSaving(true);
    await supabase.from('inter_team_members').update({ status, answered_at: new Date().toISOString() }).eq('id', myInvite.id);
    if (status === 'accepted') {
      await supabase.from('inter_registrations').upsert({
        competition_id: competitionId,
        team_id: myInvite.team.id,
        athlete_id: user?.id,
        box_id: currentBox?.id ?? null,
      });
    }
    await load();
    setSaving(false);
  }

  const isCaptain = team && team.captain_id === user?.id;
  const acceptedCount = members.filter(m => m.status === 'accepted').length + (isCaptain ? 1 : 0);

  if (loading) return (
    <View style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <GlassBackground />
      <ActivityIndicator color={ax.accent} size="large" />
    </View>
  );

  const statusTone = (s: string) => (s === 'accepted' ? 'active' : s === 'declined' ? 'danger' : 'warning');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={S.container}>
      <GlassBackground />
        <AxScreenHeader title={t('interTeam.myTeam')}>
            {team ? <AxContentTitle title={team.name} testID="team-name-title" /> : null}
            <Text style={S.headerSub}>
              {team ? t('interTeam.membersCount', { count: acceptedCount, max: teamSize }) : t('interTeam.teamOf', { n: teamSize })}
            </Text>
        </AxScreenHeader>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[S.content, { paddingBottom: tabSpace }]} keyboardShouldPersistTaps="handled">

          {/* ── No team: invitation pending ── */}
          {!team && myInvite && myInvite.status === 'pending' && (
            <AxCard variant="featured" testID="team-invite-card">
              <View style={S.inviteHeader}>
                <Users size={22} color={ax.accentText} />
                <Text style={S.inviteTitle}>{t('interTeam.inviteReceived')}</Text>
              </View>
              <Text style={S.inviteTeamName}>« {myInvite.team?.name ?? '—'} »</Text>
              <Text style={S.inviteSub}>{t('interTeam.inviteSub')}</Text>
              <View style={S.inviteActions}>
                <View style={S.flex1}>
                  <AxButton label={t('interTeam.accept')} icon={CheckCircle2} fullWidth onPress={() => handleAnswerInvite('accepted')} disabled={saving} testID="team-accept" />
                </View>
                <View style={S.flex1}>
                  <AxButton label={t('interTeam.decline')} icon={XCircle} variant="stop" fullWidth onPress={() => handleAnswerInvite('declined')} disabled={saving} testID="team-decline" />
                </View>
              </View>
            </AxCard>
          )}

          {/* ── No team: create form ── */}
          {!team && (!myInvite || myInvite.status === 'declined') && (
            <AxCard testID="team-create-card">
              <Text style={S.sectionLabel}>{t('interTeam.createTeam')}</Text>
              <Text style={S.sectionHint}>{t('interTeam.createHint')}</Text>
              <AxTextField
                icon={Shield}
                value={teamName}
                onChangeText={setTeamName}
                placeholder={t('interTeam.teamNamePlaceholder')}
                accessibilityLabel={t('interTeam.teamNamePlaceholder')}
                testID="team-name"
              />
              <AxButton label={t('interTeam.create')} fullWidth onPress={handleCreateTeam} disabled={saving} loading={saving} testID="team-create" />
            </AxCard>
          )}

          {/* ── Team exists ── */}
          {team && (
            <>
              {/* Roster */}
              <View style={S.section}>
                <View style={S.sectionRow}>
                  <Text style={S.sectionLabel}>{t('interTeam.membersTitle', { count: acceptedCount, max: teamSize })}</Text>
                  {acceptedCount < teamSize && (
                    <AxTag label={t('interTeam.freeSlots', { count: teamSize - acceptedCount })} testID="team-free-slots" />
                  )}
                </View>

                {/* Captain row */}
                <AxCard style={S.memberRow} testID="team-member-captain">
                  <UserAvatar uri={user?.avatar_url} name={user?.username ?? '?'} size={34} borderRadius={axRadius.control} backgroundColor={ax.field} textColor={ax.accentText} fontSize={13} />
                  <View style={S.memberInfo}>
                    <Text style={S.memberName} numberOfLines={2}>{user?.username ?? '—'} {isCaptain ? t('interTeam.me') : ''}</Text>
                    <Text style={S.memberLevel}>{user?.level ?? ''}</Text>
                  </View>
                  <View style={S.captainTag}>
                    <Crown size={12} color={ax.accentText} />
                    <AxTag label={t('interTeam.captain')} />
                  </View>
                </AxCard>

                {/* Members */}
                {members.map(m => (
                  <AxCard key={m.id} style={[S.memberRow, m.status === 'declined' && S.declined]} testID={`team-member-${m.id}`}>
                    <UserAvatar uri={(m as any).avatar_url} name={m.username ?? '?'} size={34} borderRadius={axRadius.control} backgroundColor={ax.field} textColor={ax.accentText} fontSize={13} />
                    <View style={S.memberInfo}>
                      <Text style={S.memberName} numberOfLines={2}>{m.username}</Text>
                      <Text style={S.memberLevel}>{m.level}</Text>
                    </View>
                    <View style={S.memberRight}>
                      <AxStatusDot
                        label={stripGlyph(m.status === 'accepted' ? t('interTeam.accepted') : m.status === 'declined' ? t('interTeam.declined') : t('interTeam.pending'))}
                        tone={statusTone(m.status)}
                        testID={`team-member-status-${m.id}`}
                      />
                      {isCaptain && (
                        <AxIconButton icon={Trash2} onPress={() => handleRemoveMember(m.id)} accessibilityLabel={t('common.delete')} testID={`team-remove-${m.id}`} />
                      )}
                    </View>
                  </AxCard>
                ))}
              </View>

              {/* Invite */}
              {isCaptain && acceptedCount < teamSize && (
                <AxCard testID="team-invite-section">
                  <Text style={S.sectionLabel}>{t('interTeam.inviteAthlete')}</Text>
                  <Text style={S.sectionHint}>{t('interTeam.inviteAthleteHint')}</Text>
                  <AxButton label={t('interTeam.seeBoxMembers')} icon={Users} fullWidth onPress={openMembersModal} testID="team-open-members" />
                </AxCard>
              )}

              {/* Members picker modal */}
              <Modal visible={showMembersModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMembersModal(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: ax.background }}>
                  <View style={S.modalHeader}>
                    <View style={S.memberInfo}>
                      <Text style={S.modalTitle}>{t('interTeam.membersModalTitle', { name: currentBox?.name ?? t('interTeam.athletes') })}</Text>
                    </View>
                    <AxIconButton icon={X} onPress={() => setShowMembersModal(false)} accessibilityLabel={t('common.close')} testID="team-modal-close" />
                  </View>

                  <View style={S.modalSearchBar}>
                    <Search size={15} color={ax.textMuted} />
                    <TextInput
                      style={S.input}
                      value={memberSearch}
                      onChangeText={setMemberSearch}
                      placeholder={t('interTeam.searchByUsername')}
                      placeholderTextColor={ax.textMuted}
                      autoFocus
                    />
                  </View>

                  {loadingMembers ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color={ax.accent} />
                  ) : (
                    <FlatList
                      data={allBoxMembers.filter(p =>
                        !memberSearch.trim() || p.username?.toLowerCase().includes(memberSearch.toLowerCase())
                      )}
                      keyExtractor={item => item.id}
                      contentContainerStyle={S.modalList}
                      ListEmptyComponent={
                        <View style={S.modalEmpty}>
                          <Users size={40} color={ax.textMuted} />
                          <Text style={S.modalEmptyText}>{t('interTeam.noMemberFound')}</Text>
                        </View>
                      }
                      renderItem={({ item, index }) => (
                        <AxCard style={S.memberRow} testID={`team-candidate-${item.id}`}>
                          <View style={S.modalRank}>
                            <Text style={S.modalRankText}>{index + 1}</Text>
                          </View>
                          <UserAvatar uri={(item as any).avatar_url} name={item.username ?? '?'} size={34} borderRadius={axRadius.control} backgroundColor={ax.field} textColor={ax.accentText} fontSize={13} />
                          <View style={S.memberInfo}>
                            <Text style={S.memberName} numberOfLines={2}>{item.username}</Text>
                            <Text style={S.memberLevel}>{item.level?.toUpperCase() ?? ''}</Text>
                          </View>
                          <Text style={S.modalElo}>{t('interTeam.eloValue', { elo: item.elo ?? 1000 })}</Text>
                          <AxButton
                            label={t('interTeam.invite')}
                            icon={UserPlus}
                            variant="outline"
                            loading={inviting === item.id}
                            disabled={!!inviting}
                            testID={`team-invite-${item.id}`}
                            onPress={async () => {
                              await handleInvite(item.id);
                              setAllBoxMembers(prev => prev.filter(p => p.id !== item.id));
                            }}
                          />
                        </AxCard>
                      )}
                    />
                  )}
                </SafeAreaView>
              </Modal>

              {/* Team complete */}
              {acceptedCount >= teamSize && (
                <AxCard style={S.infoBox} testID="team-complete">
                  <CheckCircle2 size={18} color={ax.success} />
                  <Text style={S.infoText}>
                    {t('interTeam.teamComplete')}
                  </Text>
                </AxCard>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    content: { padding: axSpacing.lg, gap: axSpacing.lg },
    flex1: { flex: 1 },
    section: { gap: axSpacing.sm },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
    sectionLabel: { ...axTypography.overline, color: c.textMuted, flexShrink: 1 },
    sectionHint: { ...axTypography.caption, color: c.textMuted },
    input: { ...axTypography.body, flex: 1, color: c.text, padding: 0 },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, padding: axSpacing.md },
    declined: { opacity: 0.5 },
    memberInfo: { flex: 1, minWidth: 0 },
    memberName: { ...axTypography.label, color: c.text },
    memberLevel: { ...axTypography.caption, color: c.textMuted, textTransform: 'uppercase' },
    memberRight: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    captainTag: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm,
      paddingHorizontal: axSpacing.lg, paddingTop: axSpacing.lg, paddingBottom: axSpacing.md,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    modalTitle: { ...axTypography.titleM, color: c.text },
    modalSearchBar: {
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm,
      marginHorizontal: axSpacing.lg, marginVertical: axSpacing.md,
      backgroundColor: c.field, borderRadius: axRadius.control,
      borderWidth: 1, borderColor: c.fieldBorder,
      paddingHorizontal: axSpacing.md, paddingVertical: axSpacing.md,
    },
    modalList: { paddingHorizontal: axSpacing.lg, paddingTop: axSpacing.sm, gap: axSpacing.sm },
    modalEmpty: { alignItems: 'center', marginTop: 60, gap: axSpacing.md },
    modalEmptyText: { ...axTypography.bodySmall, color: c.textMuted },
    modalRank: { width: 22, alignItems: 'center' },
    modalRankText: { ...axTypography.label, color: c.textMuted },
    modalElo: { ...axTypography.caption, color: c.textMuted },
    inviteHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    inviteTitle: { ...axTypography.label, color: c.text, flex: 1 },
    inviteTeamName: { ...axTypography.titleM, color: c.accentText },
    inviteSub: { ...axTypography.bodySmall, color: c.textMuted },
    inviteActions: { flexDirection: 'row', gap: axSpacing.sm },
    infoBox: { flexDirection: 'row', gap: axSpacing.md, alignItems: 'flex-start' },
    infoText: { ...axTypography.bodySmall, flex: 1, color: c.text },
  });
}
