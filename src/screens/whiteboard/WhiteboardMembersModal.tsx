import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Modal, ActivityIndicator, Pressable } from 'react-native';
import { ChevronRight, Search, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import UserAvatar from '../../components/UserAvatar';
import { AxCard, AxIconButton, AxTag, AxTextField } from '../../components/ax';
import type { AxTagTone } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { levelInk } from '../home/homeLevelColor';

export interface WhiteboardMember {
  id: string;
  username: string;
  level: string;
  elo: number;
  avatar_url?: string | null;
  full_name?: string | null;
  /** `box_members.role` de la ligne. */
  role?: string | null;
}

export interface MemberRoleTag {
  key: 'whiteboard.roleOwner' | 'whiteboard.roleCoOwner' | 'whiteboard.roleCoach';
  tone: AxTagTone;
}

/** Étiquette du staff : gérant principal (`boxes.owner_id`), co-gérant (`role = 'owner'`), coach ; rien pour un membre. */
export function memberRoleTag(member: Pick<WhiteboardMember, 'id' | 'role'>, ownerId: string | null | undefined): MemberRoleTag | null {
  if (ownerId && member.id === ownerId) return { key: 'whiteboard.roleOwner', tone: 'accent' };
  if (member.role === 'owner') return { key: 'whiteboard.roleCoOwner', tone: 'accent' };
  if (member.role === 'coach') return { key: 'whiteboard.roleCoach', tone: 'muted' };
  return null;
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Filtre local sur le pseudo et le nom, sans casse ni accents ; requête vide = tout le monde. */
export function filterMembers<T extends Pick<WhiteboardMember, 'username' | 'full_name'>>(members: T[], query: string): T[] {
  const q = fold(query);
  if (!q) return members;
  return members.filter((m) => fold(m.username ?? '').includes(q) || fold(m.full_name ?? '').includes(q));
}

interface Props {
  visible: boolean;
  boxName: string;
  /** `boxes.owner_id` : gérant principal. */
  ownerId?: string | null;
  loading: boolean;
  members: WhiteboardMember[];
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

/** Fenêtre « Membres » de Ma Box. */
export default function WhiteboardMembersModal({ visible, boxName, ownerId, loading, members, onClose, onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const S = createStyles(theme);
  const c = theme.ax;
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterMembers(members, query), [members, query]);
  const rankOf = useMemo(() => new Map(members.map((m, i) => [m.id, i + 1])), [members]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={S.membersContainer}>
        <View style={S.membersHeader}>
          <Text testID="members-title" style={S.membersTitle} numberOfLines={2}>{t('whiteboard.membersTitle', { name: boxName })}</Text>
          <AxIconButton icon={X} onPress={onClose} accessibilityLabel={t('common.close')} testID="members-close" />
        </View>
        {!loading && members.length > 0 && (
          <View style={S.search}>
            <AxTextField
              testID="members-search"
              value={query}
              onChangeText={setQuery}
              placeholder={t('whiteboard.memberSearch')}
              icon={query ? undefined : Search}
              trailing={query.length > 0 ? (
                <Pressable
                  testID="members-search-clear"
                  onPress={() => setQuery('')}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={t('whiteboard.memberSearchClear')}
                >
                  <X size={18} color={c.textMuted} strokeWidth={2} />
                </Pressable>
              ) : undefined}
              autoCapitalize="none"
            />
          </View>
        )}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={c.accentText} />
          </View>
        ) : (
          <FlatList
            data={shown}
            keyboardShouldPersistTaps="handled"
            keyExtractor={m => m.id}
            contentContainerStyle={S.membersList}
            renderItem={({ item }) => {
              const tag = memberRoleTag(item, ownerId);
              return (
              <AxCard
                testID={`member-${item.id}`}
                style={S.memberRow}
                onPress={() => { onClose(); onOpenProfile(item.id); }}
                accessibilityLabel={item.username}
              >
                <Text testID={`member-rank-${item.id}`} style={S.memberRank}>{rankOf.get(item.id)}</Text>
                <UserAvatar uri={item.avatar_url} name={item.username} size={40} borderRadius={axRadius.card} backgroundColor={c.background} textColor={c.text} />
                <View style={S.memberInfo}>
                  <View style={S.nameRow}>
                    <Text testID={`member-name-${item.id}`} style={S.memberName} numberOfLines={1}>{item.username}</Text>
                    {tag && <AxTag testID={`member-role-${item.id}`} label={t(tag.key)} tone={tag.tone} />}
                  </View>
                  <Text testID={`member-level-${item.id}`} style={[S.memberLevel, { color: levelInk(item.level, c) }]} numberOfLines={1}>{item.level?.toUpperCase()}</Text>
                </View>
                <Text testID={`member-elo-${item.id}`} style={S.memberElo}>
                  {item.elo}<Text style={S.memberEloUnit}> ELO</Text>
                </Text>
                <ChevronRight color={c.textMuted} size={14} />
              </AxCard>
              );
            }}
            ListEmptyComponent={
              <Text testID="members-empty" style={S.emptyText}>
                {members.length === 0 ? t('whiteboard.noMembers') : t('whiteboard.memberSearchEmpty')}
              </Text>
            }
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
    search: { paddingHorizontal: axSpacing.lg, paddingTop: axSpacing.lg },
    membersList: { padding: axSpacing.lg, gap: axSpacing.sm },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, padding: axSpacing.md },
    memberRank: { ...axTypography.labelSmall, width: 22, color: c.textMuted, textAlign: 'center' },
    memberInfo: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    memberName: { ...axTypography.label, color: c.text, flexShrink: 1 },
    memberLevel: { ...axTypography.overlineSmall },
    memberElo: { ...axTypography.numberM, color: c.text },
    memberEloUnit: { ...axTypography.caption, color: c.textMuted },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  });
}
