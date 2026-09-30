import React from 'react';
import { View, Text, StyleSheet, FlatList, Modal, ActivityIndicator } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import UserAvatar from '../../components/UserAvatar';
import { AxCard, AxIconButton } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';

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
  const c = theme.ax;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={S.membersContainer}>
        <View style={S.membersHeader}>
          <Text testID="members-title" style={S.membersTitle} numberOfLines={2}>{t('whiteboard.membersTitle', { name: boxName })}</Text>
          <AxIconButton icon={X} onPress={onClose} accessibilityLabel={t('common.close')} testID="members-close" />
        </View>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={c.accentText} />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={m => m.id}
            contentContainerStyle={S.membersList}
            renderItem={({ item, index }) => (
              <AxCard
                testID={`member-${item.id}`}
                style={S.memberRow}
                onPress={() => { onClose(); onOpenProfile(item.id); }}
                accessibilityLabel={item.username}
              >
                <Text testID={`member-rank-${item.id}`} style={S.memberRank}>{index + 1}</Text>
                <UserAvatar uri={item.avatar_url} name={item.username} size={40} borderRadius={axRadius.card} backgroundColor={c.background} textColor={c.text} />
                <View style={S.memberInfo}>
                  <Text testID={`member-name-${item.id}`} style={S.memberName} numberOfLines={1}>{item.username}</Text>
                  <Text testID={`member-level-${item.id}`} style={[S.memberLevel, { color: levelInk(item.level, c) }]} numberOfLines={1}>{item.level?.toUpperCase()}</Text>
                </View>
                <Text testID={`member-elo-${item.id}`} style={S.memberElo}>
                  {item.elo}<Text style={S.memberEloUnit}> ELO</Text>
                </Text>
                <ChevronRight color={c.textMuted} size={14} />
              </AxCard>
            )}
            ListEmptyComponent={<Text style={S.emptyText}>{t('whiteboard.noMembers')}</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    membersContainer: { flex: 1, backgroundColor: c.background },
    membersHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.md,
      paddingTop: axSpacing.xl, paddingHorizontal: axSpacing.xl, paddingBottom: axSpacing.lg,
      borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface,
    },
    membersTitle: { ...axTypography.titleM, color: c.text, flex: 1, minWidth: 0 },
    membersList: { padding: axSpacing.lg, gap: axSpacing.sm },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, padding: axSpacing.md },
    memberRank: { ...axTypography.labelSmall, width: 22, color: c.textMuted, textAlign: 'center' },
    memberInfo: { flex: 1, minWidth: 0 },
    memberName: { ...axTypography.label, color: c.text },
    memberLevel: { ...axTypography.overlineSmall },
    memberElo: { ...axTypography.numberM, color: c.text },
    memberEloUnit: { ...axTypography.caption, color: c.textMuted },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  });
}
