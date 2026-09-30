import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Medal, Trophy } from 'lucide-react-native';
import { AxCard } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WhiteboardStackParamList } from '../../navigation';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { LevelColors } from '../../theme/designTokens';
import { AthleteLevel } from '../../types';
import { supabase } from '../../lib/supabase';
import { readRows } from '../../lib/db';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useFocusQuery } from '../../hooks/useFocusQuery';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

type Nav = NativeStackNavigationProp<WhiteboardStackParamList, 'BoxRanking'>;

interface Row {
  id: string;
  username: string;
  avatar_url: string | null;
  level: AthleteLevel | null;
  elo: number;
  matches: number;
  wins: number;
  rank: number;
  isMe: boolean;
}

const MEDALS = ['#C9A227', '#9AA4AC', '#B87333'];

function RankBadge({ rank }: { rank: number }) {
  const { theme } = useTheme();
  const S = createStyles(theme);
  if (rank <= 3) {
    return (
      <View testID={`rank-medal-${rank}`} accessible accessibilityLabel={`Rang ${rank}`}>
        <Medal size={22} color={MEDALS[rank - 1]} strokeWidth={2} />
      </View>
    );
  }
  return <Text style={S.rankNum}>#{rank}</Text>;
}

export default function BoxRankingScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { user, currentBox } = useAuth();
  const S = createStyles(theme);

  const { data, isLoading } = useFocusQuery(
    ['box-ranking', currentBox?.id],
    async (): Promise<Row[]> => {
      if (!currentBox) return [];

      const members = await readRows(
        supabase
          .from('box_members')
          .select('member_id, profiles(id, username, avatar_url, level)')
          .eq('box_id', currentBox.id)
          .eq('status', 'active'),
        { screen: 'BoxRanking', action: 'loadMembers' },
      );

      const eloRows = await readRows(
        supabase
          .from('box_elo')
          .select('member_id, elo, matches, wins')
          .eq('box_id', currentBox.id),
        { screen: 'BoxRanking', action: 'loadBoxElo' },
      );

      const eloMap: Record<string, { elo: number; matches: number; wins: number }> = {};
      (eloRows ?? []).forEach((r: any) => {
        eloMap[r.member_id] = { elo: r.elo, matches: r.matches, wins: r.wins };
      });

      const rows = (members ?? [])
        .map((m: any) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const e = eloMap[m.member_id] ?? { elo: 1000, matches: 0, wins: 0 };
          return {
            id: m.member_id,
            username: p?.username ?? 'Athlète',
            avatar_url: p?.avatar_url ?? null,
            level: (p?.level as AthleteLevel) ?? null,
            elo: e.elo,
            matches: e.matches,
            wins: e.wins,
            isMe: m.member_id === user?.id,
          };
        })
        .sort((a, b) => b.elo - a.elo)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      return rows;
    },
    { enabled: !!currentBox },
  );

  const rows = data ?? [];

  const c = theme.ax;
  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title="Classement de la box">
        <Text testID="ranking-sub" style={S.headerSub}>ELO propre à {currentBox?.name ?? 'la box'} — WODs de la box uniquement</Text>
      </AxScreenHeader>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accentText} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Trophy size={40} color={c.textMuted} />
              <Text style={S.emptyText}>Aucun membre pour l'instant</Text>
            </View>
          }
          renderItem={({ item }) => (
            <AxCard
              testID={`ranking-row-${item.id}`}
              variant={item.isMe ? 'featured' : 'standard'}
              style={S.row}
              onPress={() => !item.isMe && navigation.navigate('PublicProfile', { userId: item.id })}
              accessibilityLabel={item.username}
            >
              <View style={S.rankCell}><RankBadge rank={item.rank} /></View>
              <UserAvatar
                uri={item.avatar_url}
                name={item.username}
                size={40}
                borderRadius={axRadius.card}
                borderWidth={2}
                borderColor={LevelColors[item.level as AthleteLevel] ?? c.border}
                backgroundColor={c.background}
                textColor={c.text}
              />
              <View style={S.info}>
                <Text testID={`ranking-name-${item.id}`} style={[S.name, item.isMe && { color: c.accentText }]} numberOfLines={1}>
                  {item.username}
                </Text>
                <Text testID={`ranking-wins-${item.id}`} style={S.winsText} numberOfLines={1}>{item.wins}V · {item.matches} WOD{item.matches > 1 ? 's' : ''}</Text>
              </View>
              <View style={S.eloCell}>
                <Text testID={`ranking-elo-${item.id}`} style={S.eloValue}>{item.elo}</Text>
                <Text style={S.eloLabel}>ELO box</Text>
              </View>
            </AxCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    list: { padding: axSpacing.lg, gap: axSpacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, padding: axSpacing.md },
    rankCell: { width: 36, alignItems: 'center' },
    rankNum: { ...axTypography.labelSmall, color: c.textMuted },
    info: { flex: 1, minWidth: 0 },
    name: { ...axTypography.label, color: c.text },
    winsText: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
    eloCell: { alignItems: 'flex-end' },
    eloValue: { ...axTypography.numberM, color: c.accentText },
    eloLabel: { ...axTypography.overlineSmall, color: c.textMuted },
    emptyText: { ...axTypography.label, color: c.textMuted, marginTop: axSpacing.md },
  });
}
