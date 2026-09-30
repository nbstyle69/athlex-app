import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Crown, GitBranch, Trophy } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AxCard, AxTag } from '../../components/ax';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { toursGagnants, wodColonne, wodEtapeGagnants } from '../../utils/bracketWods';

type Match = {
  id: string;
  round: number;
  match_number: number;
  side: 'winner' | 'loser' | 'grand_final' | 'third_place';
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  status: 'pending' | 'active' | 'completed' | 'bye' | 'forfeit';
  wod_id: string | null;
};

type Profile = { id: string; username: string; level?: string };
type WodLite = { id: string; title: string; bracket_board: string | null; bracket_stage: number | null };

interface Props {
  tournamentId: string;
  format: 'bracket' | 'swiss';
  currentUserId?: string;
}

export default function TournamentBracketView({ tournamentId, format, currentUserId }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const S = createStyles(theme);
  const c = theme.ax;
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [wods, setWods] = useState<WodLite[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase
        .from('tournament_bracket_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('side')
        .order('match_number');
      if (cancelled) return;
      const list = (m ?? []) as Match[];
      setMatches(list);

      const { data: w } = await supabase
        .from('tournament_wods')
        .select('id, title, bracket_board, bracket_stage')
        .eq('tournament_id', tournamentId);
      if (!cancelled) setWods((w ?? []) as WodLite[]);

      const ids = Array.from(new Set(
        list.flatMap(x => [x.participant1_id, x.participant2_id, x.winner_id, x.loser_id])
            .filter((x): x is string => !!x)
      ));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, username, level').in('id', ids);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p; });
        if (!cancelled) setProfiles(map);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tournamentId]);

  const grouped = useMemo(() => {
    const wb: Record<number, Match[]> = {};
    const lb: Record<number, Match[]> = {};
    const gf: Match[] = [];
    const tp: Match[] = [];
    matches.forEach(m => {
      if (m.side === 'grand_final') gf.push(m);
      else if (m.side === 'third_place') tp.push(m);
      else if (m.side === 'winner') (wb[m.round] ??= []).push(m);
      else (lb[m.round] ??= []).push(m);
    });
    Object.values(wb).forEach(a => a.sort((x, y) => x.match_number - y.match_number));
    Object.values(lb).forEach(a => a.sort((x, y) => x.match_number - y.match_number));
    gf.sort((x, y) => x.round - y.round);
    return { wb, lb, gf, tp };
  }, [matches]);

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator color={c.accentText} />
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={S.center}>
        <GitBranch color={theme.ax.textMuted} size={32} />
        <Text style={S.empty}>{t('bracket.notGenerated')}</Text>
      </View>
    );
  }

  const wbRounds = Object.keys(grouped.wb).map(Number).sort((a, b) => a - b);
  const lbRounds = Object.keys(grouped.lb).map(Number).sort((a, b) => a - b);

  // WOD d'une colonne : celui que la base a posé sur ses matchs (#386). Les
  // anciens matchs des gagnants sans WOD gardent l'ancien calcul par étape,
  // compté sur les participants du tour 1 comme le Manager.
  const tours = toursGagnants(matches);
  function WodPill({ col, secours }: { col: Match[]; secours?: WodLite }) {
    const nom = wodColonne(col, wods, secours)?.title;
    return nom ? <View style={S.wodPill}><AxTag label={nom} tone="muted" wrap testID="bracket-wod" /></View> : null;
  }

  function name(id: string | null) {
    if (!id) return '—';
    return profiles[id]?.username ?? id.slice(0, 6);
  }

  function MatchBox({ m }: { m: Match }) {
    const involvesMe = currentUserId && (m.participant1_id === currentUserId || m.participant2_id === currentUserId);
    const won = currentUserId && m.winner_id === currentUserId;
    const lost = currentUserId && m.loser_id === currentUserId;
    return (
      <AxCard testID={`bracket-match-${m.id}`} style={[S.match, involvesMe && S.matchMine, won && S.matchWon, lost && S.matchLost]}>
        <Text style={S.matchNum}>#{m.match_number}{m.status === 'bye' ? ' · BYE' : m.status === 'forfeit' ? ` · ${t('bracket.forfeit')}` : ''}</Text>
        <PlayerRow id={m.participant1_id} winner={m.winner_id === m.participant1_id} loser={m.loser_id === m.participant1_id} name={name} S={S} />
        <PlayerRow id={m.participant2_id} winner={m.winner_id === m.participant2_id} loser={m.loser_id === m.participant2_id} name={name} S={S} />
      </AxCard>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={S.sectionRow}><Crown color={c.accentText} size={14} /><Text style={S.sectionTitle}>{format === 'swiss' ? t('bracket.winnerBracket') : t('bracket.bracket')}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.hScroll}>
        <View style={S.columns}>
          {wbRounds.map(r => (
            <View key={`wb-${r}`} style={S.column}>
              <Text style={S.colTitle}>{t('bracket.round', { n: r })}</Text>
              <WodPill col={grouped.wb[r]} secours={wodEtapeGagnants(wods, tours, r)} />
              {grouped.wb[r].map(m => <MatchBox key={m.id} m={m} />)}
            </View>
          ))}
        </View>
      </ScrollView>

      {format === 'swiss' && lbRounds.length > 0 && (
        <>
          <View style={S.sectionRow}><Text style={S.sectionTitle}>{t('bracket.loserBracket')}</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.hScroll}>
            <View style={S.columns}>
              {/* Le tableau des perdants commence au tour 2 du serveur : ses colonnes se numérotent depuis 1. */}
              {lbRounds.map((r, i) => (
                <View key={`lb-${r}`} style={S.column}>
                  <Text style={S.colTitle}>{t('bracket.lbRound', { n: i + 1 })}</Text>
                  <WodPill col={grouped.lb[r]} />
                  {grouped.lb[r].map(m => <MatchBox key={m.id} m={m} />)}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {/* Petite finale (élimination simple, option du tournoi). */}
      {grouped.tp.map(m => (
        <React.Fragment key={m.id}>
          <View style={S.sectionRow}><Text style={S.sectionTitle}>{t('bracket.thirdPlace')}</Text></View>
          <View style={[S.column, S.columnFinal]}>
            <WodPill col={[m]} />
            <MatchBox m={m} />
          </View>
        </React.Fragment>
      ))}

      {/* Grande finale, puis le match décisif si le vainqueur du tableau des perdants l'a gagnée. */}
      {format === 'swiss' && grouped.gf.map((m, i) => (
        <React.Fragment key={m.id}>
          <View style={S.sectionRow}><Trophy color={c.accentText} size={14} /><Text style={[S.sectionTitle, S.sectionTitleFinal]}>{t(i === 0 ? 'bracket.grandFinal' : 'bracket.grandFinalReset')}</Text></View>
          <View style={[S.column, S.columnFinal]}>
            <WodPill col={[m]} />
            <MatchBox m={m} />
          </View>
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

function PlayerRow({ id, winner, loser, name, S }: { id: string | null; winner: boolean; loser: boolean; name: (id: string | null) => string; S: any }) {
  return (
    <View style={[S.player, winner && S.playerWinner, loser && S.playerLoser]}>
      <Text style={[S.playerName, winner && S.playerNameWinner, loser && S.playerNameLoser]} numberOfLines={1}>
        {name(id)}
      </Text>
      {winner && <Crown testID="bracket-winner" color={S.playerNameWinner.color} size={12} />}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const c = theme.ax;
  return StyleSheet.create({
  center: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: axSpacing.md },
  empty: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center', paddingHorizontal: axSpacing.xl },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm, marginTop: axSpacing.sm, marginBottom: axSpacing.md },
  sectionTitle: { ...axTypography.overline, color: c.text, flexShrink: 1 },
  sectionTitleFinal: { color: c.accentText },
  hScroll: { marginBottom: axSpacing.lg },
  columns: { flexDirection: 'row', gap: axSpacing.md },
  column: { width: 200, gap: axSpacing.sm },
  columnFinal: { width: 220 },
  colTitle: { ...axTypography.overlineSmall, color: c.textMuted },
  wodPill: { alignSelf: 'flex-start', maxWidth: '100%' },
  match: { padding: axSpacing.sm, gap: axSpacing.xs },
  matchMine: { borderColor: c.accentText },
  matchWon: { borderColor: c.success },
  matchLost: { opacity: 0.55 },
  matchNum: { ...axTypography.caption, color: c.textMuted },
  player: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.xs, paddingHorizontal: axSpacing.sm, paddingVertical: 6, borderRadius: axRadius.control, backgroundColor: c.background },
  playerWinner: { borderWidth: 1, borderColor: c.accentText },
  playerLoser: { opacity: 0.8 },
  playerName: { ...axTypography.bodySmall, color: c.text, flex: 1 },
  playerNameWinner: { ...axTypography.label, color: c.accentText },
  playerNameLoser: { color: c.textMuted, textDecorationLine: 'line-through' },
  });
};
