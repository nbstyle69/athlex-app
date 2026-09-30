import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxButton, AxCard, AxChip } from '../../components/ax';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native';
import { ChevronRight, UserPlus, Check, X, Search, UserCheck, Users, Inbox } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { captureError } from '../../lib/sentry';
import { sendFriendRequestNotification, sendFriendAcceptedNotification } from '../../services/notifications';
import { incrementCounter } from '../../services/gamification';
import { HomeStackParamList } from '../../navigation';
import UserAvatar from '../../components/UserAvatar';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { LevelColors } from '../../theme/designTokens';
import { readableInk } from './homeLevelColor';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  requester?: { id: string; username: string; level: string; elo: number };
  addressee?: { id: string; username: string; level: string; elo: number };
}

interface Friend {
  id: string;
  username: string;
  level: string;
  elo: number;
}


export default function FriendsScreen() {
  const tabSpace = useTabBarScrollSpace();
  const { user, currentBox } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const S = createStyles(theme);
  const levelInk = (level?: string) => readableInk(LevelColors[level ?? ''] ?? '#6B7280', theme.ax);

  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
    const { data: received } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(id, username, level, elo, avatar_url)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingReceived((received ?? []) as FriendRequest[]);

    const { data: sent } = await supabase
      .from('friendships')
      .select('*, addressee:profiles!friendships_addressee_id_fkey(id, username, level, elo, avatar_url)')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingSent((sent ?? []) as FriendRequest[]);

    const { data: accepted } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, username, level, elo, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, username, level, elo, avatar_url)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendList: Friend[] = (accepted ?? []).map((r: any) => {
      const other = r.requester_id === user.id ? r.addressee : r.requester;
      return other as Friend;
    }).filter(Boolean);
    setFriends(friendList);

    } catch (e) { captureError(e, { screen: 'Friends', action: 'load' }); }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Mark friends as seen → resets badge on HomeScreen
  useEffect(() => {
    if (user) AsyncStorage.setItem(`lastSeenFriends_${user.id}`, new Date().toISOString());
  }, [user]);

  async function handleSearch() {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, level, elo, avatar_url')
      .ilike('username', `%${searchQuery.trim()}%`)
      .neq('id', user.id)
      .limit(10);
    setSearchResults((data ?? []) as Friend[]);
    setSearching(false);
  }

  async function sendFriendRequest(targetId: string) {
    if (!user) return;
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: targetId,
      status: 'pending',
    });
    if (error) {
      if (error.code === '23505') Alert.alert('Invitation déjà envoyée');
      else Alert.alert('Erreur', error.message);
      return;
    }
    sendFriendRequestNotification(targetId, user.username).catch(e => captureError(e, { action: 'sendFriendRequest' }));
    Alert.alert('✅', 'Invitation envoyée !');
    load();
  }

  async function handleAccept(requestId: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
    // Notify the requester
    const req = pendingReceived.find(r => r.id === requestId);
    if (req && user) {
      sendFriendAcceptedNotification(req.requester_id, user.username).catch(e => captureError(e, { action: 'sendFriendAccepted' }));
      incrementCounter(user.id, 'total_friends', 1, currentBox?.id).catch(e => captureError(e, { action: 'incrementFriends' }));
      incrementCounter(req.requester_id, 'total_friends', 1, currentBox?.id).catch(e => captureError(e, { action: 'incrementFriendsRequester' }));
    }
    load();
  }

  async function handleDecline(requestId: string) {
    await supabase.from('friendships').update({ status: 'declined' }).eq('id', requestId);
    load();
  }

  async function handleCancelRequest(requestId: string) {
    await supabase.from('friendships').delete().eq('id', requestId);
    load();
  }

  function isAlreadyFriend(targetId: string): boolean {
    return friends.some(f => f.id === targetId);
  }

  function hasPendingRequest(targetId: string): boolean {
    return pendingSent.some(r => (r.addressee as any)?.id === targetId);
  }

  const pendingCount = pendingReceived.length;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title="Amis">
          <Text style={S.headerSub}>{friends.length} ami{friends.length > 1 ? 's' : ''}</Text>
      </AxScreenHeader>

      <View style={S.tabRow} testID="friends-tabs">
        {([
          { key: 'friends',  label: 'Mes amis' },
          { key: 'requests', label: `Invitations${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'search',   label: 'Rechercher' },
        ] as const).map(({ key, label }) => (
          <AxChip
            key={key}
            label={label}
            selected={tab === key}
            onPress={() => setTab(key)}
            testID={`friends-tab-${key}`}
          />
        ))}
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={theme.ax.accentText} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {tab === 'friends' && (
            <>
              {friends.length === 0 ? (
                <AxCard style={S.emptyCard} testID="friends-empty">
                  <Users color={theme.ax.textMuted} size={40} />
                  <Text style={S.emptyTitle}>Pas encore d'amis</Text>
                  <Text style={S.emptySub}>Recherche des athlètes et envoie des invitations !</Text>
                  <AxButton label="Rechercher" icon={Search} onPress={() => setTab('search')} testID="friends-empty-search" />
                </AxCard>
              ) : (
                friends.map(friend => (
                  <AxCard
                    key={friend.id}
                    style={S.friendRow}
                    onPress={() => navigation.navigate('PublicProfile', { userId: friend.id })}
                    accessibilityLabel={friend.username}
                    testID={`friend-${friend.id}`}
                  >
                    <UserAvatar uri={(friend as any).avatar_url} name={friend.username} size={44} backgroundColor={theme.ax.field} textColor={theme.ax.text} />
                    <View style={S.friendInfo}>
                      <Text style={S.friendName} numberOfLines={1}>{friend.username}</Text>
                      <View style={S.levelPill}>
                        <View style={[S.levelDot, { backgroundColor: levelInk(friend.level) }]} />
                        <Text style={[S.levelText, { color: levelInk(friend.level) }]}>
                          {friend.level?.toUpperCase()}
                        </Text>
                        <Text style={S.eloText}>· {friend.elo} ELO</Text>
                      </View>
                    </View>
                    <ChevronRight color={theme.ax.textMuted} size={16} />
                  </AxCard>
                ))
              )}
            </>
          )}

          {tab === 'requests' && (
            <>
              {pendingReceived.length > 0 && (
                <>
                  <Text style={S.subTitle}>Reçues</Text>
                  {pendingReceived.map(req => {
                    const sender = req.requester as any;
                    return (
                      <AxCard key={req.id} style={S.requestRow} testID={`request-${req.id}`}>
                        <TouchableOpacity
                          style={S.requestInfoTouchable}
                          activeOpacity={0.7}
                          onPress={() => sender?.id && navigation.navigate('PublicProfile', { userId: sender.id })}
                        >
                          <UserAvatar uri={sender?.avatar_url} name={sender?.username ?? '?'} size={44} backgroundColor={theme.ax.field} textColor={theme.ax.text} />
                          <View style={S.friendInfo}>
                            <Text style={S.friendName} numberOfLines={1}>{sender?.username ?? 'Athlète'}</Text>
                            <View style={S.levelPill}>
                              <View style={[S.levelDot, { backgroundColor: levelInk(sender?.level) }]} />
                              <Text style={[S.levelText, { color: levelInk(sender?.level) }]}>
                                {sender?.level?.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        <View style={S.actionBtns}>
                          <TouchableOpacity style={S.acceptBtn} onPress={() => handleAccept(req.id)} accessibilityRole="button" accessibilityLabel="Accepter" testID={`accept-${req.id}`}>
                            <Check color={theme.ax.onAccent} size={16} />
                          </TouchableOpacity>
                          <TouchableOpacity style={S.declineBtn} onPress={() => handleDecline(req.id)} accessibilityRole="button" accessibilityLabel="Refuser" testID={`decline-${req.id}`}>
                            <X color={theme.ax.danger} size={16} />
                          </TouchableOpacity>
                        </View>
                      </AxCard>
                    );
                  })}
                </>
              )}
              {pendingSent.length > 0 && (
                <>
                  <Text style={[S.subTitle, { marginTop: 20 }]}>Envoyées</Text>
                  {pendingSent.map(req => {
                    const receiver = req.addressee as any;
                    return (
                      <AxCard key={req.id} style={S.requestRow} testID={`request-${req.id}`}>
                        <TouchableOpacity
                          style={S.requestInfoTouchable}
                          activeOpacity={0.7}
                          onPress={() => receiver?.id && navigation.navigate('PublicProfile', { userId: receiver.id })}
                        >
                          <UserAvatar uri={receiver?.avatar_url} name={receiver?.username ?? '?'} size={44} backgroundColor={theme.ax.field} textColor={theme.ax.text} />
                          <View style={S.friendInfo}>
                            <Text style={S.friendName} numberOfLines={1}>{receiver?.username ?? 'Athlète'}</Text>
                            <Text style={S.pendingLabel}>En attente…</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={S.cancelBtn} onPress={() => handleCancelRequest(req.id)} testID={`cancel-${req.id}`}>
                          <Text style={S.cancelBtnText}>Annuler</Text>
                        </TouchableOpacity>
                      </AxCard>
                    );
                  })}
                </>
              )}
              {pendingReceived.length === 0 && pendingSent.length === 0 && (
                <AxCard style={S.emptyCard} testID="requests-empty">
                  <Inbox color={theme.ax.textMuted} size={40} />
                  <Text style={S.emptyTitle}>Aucune invitation</Text>
                  <Text style={S.emptySub}>Quand quelqu'un t'enverra une invitation, elle apparaîtra ici.</Text>
                </AxCard>
              )}
            </>
          )}

          {tab === 'search' && (
            <>
              <View style={S.searchRow}>
                <TextInput
                  style={S.searchInput}
                  placeholder="Rechercher un athlète…"
                  placeholderTextColor={theme.ax.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={S.searchBtn} onPress={handleSearch} disabled={searching} accessibilityRole="button" accessibilityLabel="Rechercher" testID="friends-search-submit">
                  {searching ? <ActivityIndicator color={theme.ax.onAccent} size="small" /> : <Search color={theme.ax.onAccent} size={18} />}
                </TouchableOpacity>
              </View>
              {searchResults.map(result => {
                const alreadyFriend = isAlreadyFriend(result.id);
                const pending = hasPendingRequest(result.id);
                return (
                  <AxCard
                    key={result.id}
                    style={S.friendRow}
                    onPress={() => navigation.navigate('PublicProfile', { userId: result.id })}
                    accessibilityLabel={result.username}
                    testID={`result-${result.id}`}
                  >
                    <UserAvatar uri={(result as any).avatar_url} name={result.username} size={44} backgroundColor={theme.ax.field} textColor={theme.ax.text} />
                    <View style={S.friendInfo}>
                      <Text style={S.friendName} numberOfLines={1}>{result.username}</Text>
                      <View style={S.levelPill}>
                        <View style={[S.levelDot, { backgroundColor: levelInk(result.level) }]} />
                        <Text style={[S.levelText, { color: levelInk(result.level) }]}>
                          {result.level?.toUpperCase()}
                        </Text>
                        <Text style={S.eloText}>· {result.elo} ELO</Text>
                      </View>
                    </View>
                    {alreadyFriend ? (
                      <View style={S.alreadyFriendTag}>
                        <UserCheck size={14} color={theme.ax.accentText} />
                        <Text style={[S.alreadyFriendText, { color: theme.ax.accentText }]}>Ami</Text>
                      </View>
                    ) : pending ? (
                      <View style={S.alreadyFriendTag}>
                        <Text style={[S.alreadyFriendText, { color: theme.ax.textMuted }]}>En attente</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={S.addBtn}
                        onPress={(e) => { e.stopPropagation(); sendFriendRequest(result.id); }}
                        activeOpacity={0.8}
                        testID={`add-${result.id}`}
                      >
                        <UserPlus size={15} color={theme.ax.onAccent} />
                        <Text style={S.addBtnText}>Ajouter</Text>
                      </TouchableOpacity>
                    )}
                  </AxCard>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm,
      paddingHorizontal: axSpacing.lg, paddingVertical: axSpacing.md,
    },
    content: { padding: axSpacing.lg, gap: 10, paddingBottom: 140 },
    subTitle: { ...axTypography.overline, color: c.textMuted, marginBottom: 4 },
    emptyCard: { alignItems: 'center', gap: 10, marginTop: 20, padding: 32 },
    emptyTitle: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    emptySub: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    requestInfoTouchable: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
    requestRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    friendInfo: { flex: 1, minWidth: 0 },
    friendName: { ...axTypography.label, color: c.text },
    levelPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
    levelDot: { width: 6, height: 6, borderRadius: 3 },
    levelText: { ...axTypography.labelSmall, letterSpacing: 0.5 },
    eloText: { ...axTypography.bodySmall, color: c.textMuted },
    pendingLabel: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2, fontStyle: 'italic' },
    actionBtns: { flexDirection: 'row', gap: 8 },
    acceptBtn: {
      width: 36, height: 36, borderRadius: axRadius.control,
      backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
    },
    declineBtn: {
      width: 36, height: 36, borderRadius: axRadius.control,
      borderWidth: 1, borderColor: c.danger, justifyContent: 'center', alignItems: 'center',
    },
    cancelBtn: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: axRadius.control,
      borderWidth: 1, borderColor: c.border,
    },
    cancelBtnText: { ...axTypography.labelSmall, color: c.text },
    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    searchInput: {
      flex: 1, backgroundColor: c.field, borderRadius: axRadius.control,
      borderWidth: 1, borderColor: c.fieldBorder,
      paddingHorizontal: 14, paddingVertical: 12,
      ...axTypography.body, color: c.text,
    },
    searchBtn: {
      width: 48, height: 48, borderRadius: axRadius.control,
      backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center',
    },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: c.accent, borderRadius: axRadius.control,
      paddingHorizontal: 12, paddingVertical: 7,
    },
    addBtnText: { ...axTypography.labelSmall, color: c.onAccent },
    alreadyFriendTag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: axRadius.badge, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 10, paddingVertical: 6,
    },
    alreadyFriendText: { ...axTypography.labelSmall },
  });
}
