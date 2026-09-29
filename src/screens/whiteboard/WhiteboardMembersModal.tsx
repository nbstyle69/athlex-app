import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ActivityIndicator } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import UserAvatar from '../../components/UserAvatar';

export interface WhiteboardMember {
  id: string;
  username: string;
  level: string;
  elo: number;
  avatar_url?: string | null;
}

interface Props {
  visible: boolean;
  boxName: string;
  loading: boolean;
  members: WhiteboardMember[];
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

/** Fenêtre « Membres » de Ma Box. */
export default function WhiteboardMembersModal({ visible, boxName, loading, members, onClose, onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const S = createStyles(theme);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={S.membersContainer}>
        <View style={S.membersHeader}>
          <Text style={S.membersTitle}>{t('whiteboard.membersTitle', { name: boxName })}</Text>
          <TouchableOpacity onPress={onClose} style={S.membersClose}>
            <X color={theme.textSecondary} size={22} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={m => m.id}
            contentContainerStyle={S.membersList}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={S.memberRow}
                onPress={() => { onClose(); onOpenProfile(item.id); }}
                activeOpacity={0.75}
              >
                <Text style={S.memberRank}>{index + 1}</Text>
                <UserAvatar uri={item.avatar_url} name={item.username} size={40} backgroundColor={theme.accentShadow} />
                <View style={{ flex: 1 }}>
                  <Text style={S.memberName}>{item.username}</Text>
                  <Text style={S.memberLevel}>{item.level?.toUpperCase()}</Text>
                </View>
                <Text style={S.memberElo}>{item.elo} ELO</Text>
                <ChevronRight color={theme.textMuted} size={14} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={S.emptyText}>{t('whiteboard.noMembers')}</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    membersContainer: { flex: 1, backgroundColor: theme.background },
    membersHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card,
    },
    membersTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    membersClose: { padding: 4 },
    membersList: { padding: 16, gap: 10 },
    memberRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: theme.card, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.border,
    },
    memberRank: { width: 22, fontSize: 13, color: theme.textMuted, fontWeight: '700', textAlign: 'center' },
    memberName: { fontSize: 14, fontWeight: '700', color: theme.text },
    memberLevel: { fontSize: 10, color: theme.textMuted, fontWeight: '600', marginTop: 1 },
    memberElo: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
    emptyText: { fontSize: 15, color: theme.textMuted, textAlign: 'center' },
  });
}
