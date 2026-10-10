import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxButton, AxCard } from '../../components/ax';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { UserX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { getMyBlockedUsers, unblockUser } from '../../services/moderation';
import UserAvatar from '../../components/UserAvatar';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { axSpacing, axTypography } from '../../theme/axTokens';

export default function BlockedUsersScreen({ navigation }: any) {
  const tabSpace = useTabBarScrollSpace();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const S = createStyles(theme);
  const [users, setUsers] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await getMyBlockedUsers();
    setUsers(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUnblock(id: string, username: string) {
    Alert.alert(
      t('blockedUsers.unblockTitle'),
      t('blockedUsers.unblockMsg', { username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('blockedUsers.unblock'), onPress: async () => {
            const ok = await unblockUser(id);
            if (ok) load();
            else Alert.alert(t('common.error'), t('blockedUsers.unblockFailed'));
          },
        },
      ],
    );
  }

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader title={t('profile.blockedUsers')} />

      {loading ? (
        <View style={S.center}><ActivityIndicator color={theme.ax.accentText} /></View>
      ) : users.length === 0 ? (
        <View style={S.center}>
          <UserX size={48} color={theme.ax.textMuted} />
          <Text style={S.emptyTitle}>{t('blockedUsers.emptyTitle')}</Text>
          <Text style={S.emptyText}>{t('blockedUsers.emptyText')}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: tabSpace }}
          renderItem={({ item }) => (
            <AxCard style={S.row} testID={`blocked-${item.id}`}>
              <UserAvatar size={42} name={item.username} uri={item.avatar_url ?? undefined} backgroundColor={theme.ax.field} textColor={theme.ax.text} />
              <Text style={S.username} numberOfLines={1}>{item.username}</Text>
              <AxButton
                variant="outline"
                label={t('blockedUsers.unblock')}
                onPress={() => handleUnblock(item.id, item.username)}
                testID={`unblock-${item.id}`}
              />
            </AxCard>
          )}
        />
      )}
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { ...axTypography.titleM, color: c.text, marginTop: 8, textAlign: 'center' },
  emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  username: { flex: 1, minWidth: 0, ...axTypography.label, color: c.text },
}); }
