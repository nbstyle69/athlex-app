import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Layers } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AxCard, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';

type Division = {
  id: string;
  name: string;
  level: number;
  max_members: number;
  promote_count: number;
  relegate_count: number;
};

type Member = {
  id: string;
  division_id: string;
  athlete_id: string;
  points: number;
  rank: number | null;
};

type Profile = { id: string; username: string; level?: string; elo?: number };

interface Props {
  tournamentId: string;
  currentUserId?: string;
}

export default function TournamentDivisionsView({ tournamentId, currentUserId }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const S = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: divs } = await supabase
        .from('tournament_divisions').select('*')
        .eq('tournament_id', tournamentId).order('level');
      if (cancelled) return;
      const dList = (divs ?? []) as Division[];
      setDivisions(dList);

      const divIds = dList.map(d => d.id);
      if (divIds.length === 0) { setMembers([]); setLoading(false); return; }

      const { data: mems } = await supabase
        .from('tournament_division_members').select('*')
        .in('division_id', divIds);
      if (cancelled) return;
      const mList = (mems ?? []) as Member[];
      setMembers(mList);

      const ids = Array.from(new Set(mList.map(m => m.athlete_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, username, level, elo').in('id', ids);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p; });
        if (!cancelled) setProfiles(map);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tournamentId]);

  if (loading) {
    return <View style={S.center}><ActivityIndicator color={theme.ax.accentText} /></View>;
  }
  if (divisions.length === 0) {
    return (
      <View style={S.center}>
        <Layers color={theme.ax.textMuted} size={32} />
        <Text style={S.empty}>{t('divisions.noDivision')}</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {divisions.map((d, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === divisions.length - 1;
        const rows = members
          .filter(m => m.division_id === d.id)
          .sort((a, b) => b.points - a.points || (a.rank ?? 999) - (b.rank ?? 999));

        return (
          <AxCard key={d.id} testID={`division-${d.id}`} style={S.divCard}>
            <View style={S.divHeader}>
              <View style={S.divBadge}><Text style={S.divBadgeTxt}>{d.level}</Text></View>
              <View style={S.flex}>
                <Text style={S.divName}>{d.name}</Text>
                <Text style={S.divMeta}>
                  {t('divisions.athleteCount', { count: rows.length, max: d.max_members })}
                  {!isFirst && d.promote_count > 0 ? t('divisions.promoted', { n: d.promote_count }) : ''}
                  {!isLast && d.relegate_count > 0 ? t('divisions.relegated', { n: d.relegate_count }) : ''}
                </Text>
              </View>
            </View>

            {rows.length === 0 ? (
              <Text style={S.divEmpty}>{t('divisions.noAthlete')}</Text>
            ) : rows.map((m, rIdx) => {
              const p = profiles[m.athlete_id];
              const isMe = currentUserId && m.athlete_id === currentUserId;
              const willPromote = !isFirst && rIdx < d.promote_count;
              const willRelegate = !isLast && rIdx >= rows.length - d.relegate_count;
              return (
                <View key={m.id} testID={`division-row-${m.id}`} style={[S.row, isMe && S.rowMe]}>
                  <Text style={S.rank}>{rIdx + 1}</Text>
                  <View style={S.nameCell}>
                    <Text style={[S.username, isMe && S.usernameMe]} numberOfLines={1}>
                      {p?.username ?? '—'}
                    </Text>
                    {willPromote && <AxTag label={t('divisions.promoTag')} tone="success" testID={`division-promote-${m.id}`} />}
                    {willRelegate && <AxTag label={t('divisions.relegTag')} tone="danger" testID={`division-relegate-${m.id}`} />}
                  </View>
                  <Text style={S.points} numberOfLines={1}>{t('divisions.points', { n: m.points })}</Text>
                </View>
              );
            })}
          </AxCard>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => {
  const c = theme.ax;
  return StyleSheet.create({
  center: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: axSpacing.md },
  empty: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: axSpacing.xl },
  flex: { flex: 1, minWidth: 0 },
  divCard: { marginBottom: axSpacing.md },
  divHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingBottom: axSpacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  divBadge: { width: 32, height: 32, borderRadius: axRadius.control, borderWidth: 1, borderColor: c.accentText, alignItems: 'center', justifyContent: 'center' },
  divBadgeTxt: { ...axTypography.label, color: c.accentText },
  divName: { ...axTypography.titleM, color: c.text },
  divMeta: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  divEmpty: { ...axTypography.bodySmall, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: axSpacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, paddingVertical: axSpacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  rowMe: { borderRadius: axRadius.control, borderWidth: 1, borderColor: c.accentText, paddingHorizontal: axSpacing.sm },
  rank: { ...axTypography.label, color: c.textMuted, width: 22 },
  nameCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, flexWrap: 'wrap' },
  username: { ...axTypography.bodySmall, color: c.text, flexShrink: 1 },
  usernameMe: { ...axTypography.label, color: c.accentText },
  points: { ...axTypography.numberM, color: c.text },
  });
};
