import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { ChevronLeft, ChevronRight, Check, Clock, StickyNote, CalendarDays, Lock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/sentry';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AxButton, AxCard, AxTag } from '../../components/ax';
import { wodTypeLabel } from '../../utils/wodTypeLabel';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { WODScore } from '../../types';
import { formatCap, formatScoreValue } from '../../utils/scoreFormat';
import { annotateStrengthLoads } from '../../utils/strengthBlock';
import { annotateCardioLines } from '../../utils/cardioBlock';
import { useMyOneRepMax } from '../../hooks/useMyOneRepMax';
import {
  listProgramWods, listProgramRestDays, setProgramStartDate, ProgramWod,
} from '../../services/programContent';
import {
  groupProgramWeeks, programWeekAt, weekGroupSessionsOn, toLocalIso, mondayOf,
  upcomingMondays, isRestDay, RestDay,
} from '../../utils/programSchedule';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function libelleDate(iso: string): string {
  return iso.split('-').reverse().join('/');
}

function libelleSemaine(lundi: string): string {
  const d = new Date(lundi + 'T00:00:00');
  const fin = new Date(d);
  fin.setDate(fin.getDate() + 6);
  const fmt = (x: Date) => `${x.getDate()}/${x.getMonth() + 1}`;
  return `${fmt(d)} – ${fmt(fin)}`;
}

export default function ProgramDetailScreen({ navigation, route }: any) {
  const tabSpace = useTabBarScrollSpace();
  const { programId, programTitle, progType, durationWeeks, daysPerWeek } = route.params;
  const { user } = useAuth();
  // La date de début est celle de l'athlète, choisie après l'achat : elle
  // arrive par la navigation puis vit ici, puisqu'on peut la (re)choisir.
  const [startDate, setStartDate] = useState<string | null>(route.params.startDate ?? null);
  const [choixDate, setChoixDate] = useState(false);
  const [dateEnCours, setDateEnCours] = useState<string | null>(null);
  const [erreurDate, setErreurDate] = useState<string | null>(null);
  const [restDays, setRestDays] = useState<RestDay[]>([]);
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  const oneRepMaxFor = useMyOneRepMax();

  const dpw = daysPerWeek ?? 5;

  const [wods, setWods] = useState<ProgramWod[]>([]);
  const [scores, setScores] = useState<Record<string, WODScore>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Une lecture refusée ou en panne ne doit pas ressembler à « pas de séance » :
  // c'est exactement ce qui a laissé l'athlète devant une page vide sans signal.
  const [erreur, setErreur] = useState<string | null>(null);

  const [selected, setSelected] = useState<ProgramWod | null>(null);

  const load = useCallback(async () => {
    setErreur(null);
    try {
      const [list, repos] = await Promise.all([
        listProgramWods(programId),
        listProgramRestDays(programId),
      ]);
      setWods(list);
      setRestDays(repos);

      if (user && list.length > 0) {
        const { data: scoreData, error } = await supabase
          .from('wod_scores')
          .select('id, wod_id, member_id, score_type, score_value, rx, capped, notes, submitted_at')
          .eq('member_id', user.id)
          .in('wod_id', list.map(w => w.id));
        if (error) throw error;
        const map: Record<string, WODScore> = {};
        for (const s of scoreData ?? []) {
          if (s.wod_id) map[s.wod_id] = s as WODScore;
        }
        setScores(map);
      } else {
        setScores({});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      captureError(e, { screen: 'ProgramDetail', action: 'load' });
      setErreur(message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [programId, user]);

  useEffect(() => { load(); }, [load]);

  // Les semaines existantes viennent du contenu réellement publié, pas d'un
  // compteur théorique : une semaine sans séance ne s'invente pas. Semaines
  // relatives (S1, S2…) d'abord, semaines datées ensuite.
  const semaines = useMemo(() => groupProgramWeeks(wods), [wods]);

  const [weekIdx, setWeekIdx] = useState(0);

  const aujourdhui = toLocalIso(new Date());
  const lundiAujourdhui = mondayOf(aujourdhui);
  const semaineCourante = programWeekAt(startDate, aujourdhui);
  // Tant qu'aucune séance n'est scorée, la semaine 1 n'a pas encore eu lieu
  // pour l'athlète : il peut déplacer son départ. Le serveur pose le même verrou.
  const dateVerrouillee = Object.keys(scores).length > 0;
  const lundisProposes = useMemo(() => upcomingMondays(aujourdhui), [aujourdhui]);

  const validerDate = async () => {
    if (!dateEnCours) return;
    setErreurDate(null);
    try {
      const d = await setProgramStartDate(programId, dateEnCours);
      setStartDate(d);
      setChoixDate(false);
    } catch (e) {
      captureError(e, { screen: 'ProgramDetail', action: 'setStartDate' });
      setErreurDate(e instanceof Error ? e.message : String(e));
    }
  };
  const estSemaineEnCours = (s: (typeof semaines)[number]) =>
    s.week != null ? s.week === semaineCourante : s.monday === lundiAujourdhui;

  // On ouvre sur la semaine en cours si le programme en a une, sinon sur la
  // première publiée — un athlète qui achète après le début tombe sur du
  // contenu, jamais sur du vide.
  useEffect(() => {
    if (semaines.length === 0) return;
    const idx = semaines.findIndex(s =>
      s.week != null ? s.week >= semaineCourante : (s.monday ?? '') >= lundiAujourdhui);
    setWeekIdx(idx >= 0 ? idx : semaines.length - 1);
  }, [semaines, semaineCourante, lundiAujourdhui]);

  const semaine = semaines[weekIdx];

  const wodsDuJour = (offset: number) => (semaine ? weekGroupSessionsOn(semaine, offset + 1) : []);

  const doneCount = Object.keys(scores).length;

  return (
    <View style={S.container}>
      <GlassBackground />
      <AxScreenHeader
        title={programTitle}
        right={(
          <>
        {startDate && !loading && (
          <TouchableOpacity
            style={S.dateBtn}
            disabled={dateVerrouillee}
            onPress={() => { setDateEnCours(startDate); setChoixDate(true); }}
            accessibilityRole="button"
            accessibilityLabel={dateVerrouillee ? 'Date de début verrouillée' : 'Modifier ma date de début'}
            testID="program-date-edit"
          >
            {dateVerrouillee
              ? <Lock color={c.textMuted} size={16} />
              : <CalendarDays color={c.accentText} size={18} />}
          </TouchableOpacity>
        )}
          </>
        )}
      >
          <Text style={S.headerSub} numberOfLines={2}>
            {progType === 'fixed' ? `${durationWeeks ?? semaines.length} semaines · ${dpw}j/sem` : `Ongoing · ${dpw}j/sem`}
            {startDate ? ` · depuis le ${libelleDate(startDate)}` : ''}
            {doneCount > 0 ? ` · ${doneCount} WOD${doneCount > 1 ? 's' : ''} fait${doneCount > 1 ? 's' : ''}` : ''}
          </Text>
      </AxScreenHeader>

      {startDate && semaines.length > 0 && (
        <View style={S.weekNav}>
          <TouchableOpacity
            onPress={() => setWeekIdx(w => Math.max(0, w - 1))}
            style={S.weekArrow}
            disabled={weekIdx === 0}
            accessibilityRole="button"
            accessibilityLabel="Semaine précédente"
            testID="program-week-prev"
          >
            <ChevronLeft color={weekIdx === 0 ? c.textMuted : c.text} size={20} />
          </TouchableOpacity>
          <View style={S.weekCenter}>
            <Text style={S.weekLabel} numberOfLines={1}>
              {semaine.week != null
                ? `Semaine ${semaine.week}${durationWeeks ? ` / ${durationWeeks}` : ''}`
                : `Semaine ${weekIdx + 1} / ${semaines.length} · ${libelleSemaine(semaine.monday ?? lundiAujourdhui)}`}
            </Text>
            {estSemaineEnCours(semaine) && <Text style={S.weekNow}>Semaine en cours</Text>}
          </View>
          <TouchableOpacity
            onPress={() => setWeekIdx(w => Math.min(semaines.length - 1, w + 1))}
            style={S.weekArrow}
            disabled={weekIdx >= semaines.length - 1}
            accessibilityRole="button"
            accessibilityLabel="Semaine suivante"
            testID="program-week-next"
          >
            <ChevronRight color={weekIdx >= semaines.length - 1 ? c.textMuted : c.text} size={20} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={S.loader} size="large" color={c.accentText} />
      ) : erreur ? (
        <View style={S.emptyBlock}>
          <Text style={S.emptyTitle}>Programmation indisponible</Text>
          <Text style={S.emptyText}>{erreur}</Text>
          <AxButton variant="outline" label="Réessayer" onPress={() => { setLoading(true); load(); }} testID="program-retry" />
        </View>
      ) : !startDate ? (
        <View style={S.emptyBlock}>
          <CalendarDays color={c.accentText} size={32} />
          <Text style={S.emptyTitle}>Choisir ma date de début</Text>
          <Text style={S.emptyText}>
            Ton programme démarre un lundi : la semaine 1 fait sept jours pleins. Choisis le lundi
            qui te convient, tu pourras le changer tant que tu n'as pas enregistré de résultat.
          </Text>
          <AxButton
            label="Choisir ma date de début"
            onPress={() => { setDateEnCours(lundisProposes[0] ?? null); setChoixDate(true); }}
            fullWidth
            testID="program-date-choose"
          />
        </View>
      ) : semaines.length === 0 ? (
        <View style={S.emptyBlock}>
          <Text style={S.emptyTitle}>Aucune séance publiée</Text>
          <Text style={S.emptyText}>
            Ton coach n'a pas encore publié de séance sur ce programme. Elles apparaîtront ici dès
            qu'il les mettra en ligne.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.list, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {DAY_LABELS.map((label, i) => {
            const dayWods = wodsDuJour(i);
            // Le repos est une décision du coach (`program_rest_days`), pas la
            // simple absence de séance : un jour vide reste un jour vide.
            const isRest = semaine.week != null && isRestDay(restDays, semaine.week, i + 1);
            return (
              <View key={label} style={[S.dayBlock, i > 0 && S.daySep]} testID={`program-day-${i + 1}`}>
                <View style={S.dayHeader}>
                  <Text style={S.dayLabel}>{label}</Text>
                  {isRest && <Text style={S.restBadge}>Repos</Text>}
                </View>
                {dayWods.map(w => {
                  const score = scores[w.id];
                  return (
                    <AxCard key={w.id} style={S.wodRow} onPress={() => setSelected(w)} testID={`program-wod-${w.id}`}>
                      <View style={S.wodLine}>
                        <View style={S.wodContent}>
                          <Text style={S.wodType}>{wodTypeLabel(w.wod_type).toUpperCase()}</Text>
                          <Text style={S.wodTitle} numberOfLines={2}>{w.title}</Text>
                          <Text style={S.wodDesc} numberOfLines={2}>{w.description}</Text>
                        </View>
                        {score ? (
                          <View style={S.doneChip} testID={`program-done-${w.id}`}>
                            <Check color={c.success} size={12} />
                            <Text style={S.doneText}>
                              {formatScoreValue(score.score_value, score.score_type, score.capped)}
                            </Text>
                          </View>
                        ) : (
                          <ChevronRight color={c.textMuted} size={16} />
                        )}
                      </View>
                    </AxCard>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={choixDate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChoixDate(false)}>
        <View style={S.modalContainer}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Ma date de début</Text>
            <TouchableOpacity onPress={() => setChoixDate(false)} hitSlop={12} accessibilityRole="button">
              <Text style={S.modalCancel}>Fermer</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={S.modalBody}>
            <Text style={S.emptyText}>Un lundi, pour que la semaine 1 fasse sept jours pleins.</Text>
            <View style={S.lundiList}>
              {lundisProposes.map(lundi => {
                const actif = lundi === dateEnCours;
                return (
                  <TouchableOpacity
                    key={lundi}
                    style={[S.lundiRow, actif && S.lundiRowActif]}
                    onPress={() => setDateEnCours(lundi)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: actif }}
                    testID={`program-monday-${lundi}`}
                  >
                    <Text style={[S.lundiTxt, actif && { color: c.accentText }]}>
                      Lundi {libelleDate(lundi)}{lundi === lundiAujourdhui ? ' · cette semaine' : ''}
                    </Text>
                    {actif && <Check color={c.accentText} size={16} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {erreurDate && <Text style={S.erreurTxt}>{erreurDate}</Text>}
            <AxButton label="Valider" onPress={validerDate} disabled={!dateEnCours} fullWidth testID="program-date-validate" />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <View style={S.modalContainer}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle} numberOfLines={1}>{selected?.title}</Text>
            <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12} accessibilityRole="button">
              <Text style={S.modalCancel}>Fermer</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={S.modalBody}>
            <View style={S.detailBadges}>
              <AxTag testID="program-detail-type" label={wodTypeLabel(selected?.wod_type)} tone="accent" />
              {!!selected?.time_cap_seconds && (
                <View style={S.metaBadge}>
                  <Clock color={c.textMuted} size={13} />
                  <Text style={S.metaBadgeText}>Cap {formatCap(selected.time_cap_seconds)}</Text>
                </View>
              )}
            </View>

            <Text style={S.sectionLabel}>SÉANCE</Text>
            <Text style={S.detailDesc}>
              {annotateCardioLines(annotateStrengthLoads(selected?.description ?? '', oneRepMaxFor))}
            </Text>

            {!!selected?.notes && (
              <AxCard style={S.notesCard} testID="program-notes">
                <View style={S.noteHeader}>
                  <StickyNote color={c.accentText} size={14} />
                  <Text style={S.notesLabel}>NOTES COACH</Text>
                </View>
                <Text style={S.detailNotes}>{selected.notes}</Text>
              </AxCard>
            )}

            {selected && scores[selected.id] && (
              <AxCard style={S.myScoreCard} testID="program-my-score">
                <Text style={S.myScoreLabel}>TON RÉSULTAT</Text>
                <Text style={S.myScoreValue}>
                  {formatScoreValue(
                    scores[selected.id].score_value,
                    scores[selected.id].score_type,
                    scores[selected.id].capped,
                  )}{scores[selected.id].rx ? ' · RX' : ''}
                </Text>
              </AxCard>
            )}

            {/* La saisie de score, la grille de force, les 1RM et le classement
                vivent dans l'écran de WOD : un seul chemin de score, celui du
                contenu canonique. Dupliquer ici ferait diverger les deux. */}
            <AxButton
              label={selected && scores[selected.id] ? 'Voir / modifier mon résultat' : 'Ouvrir la séance'}
              fullWidth
              testID="program-open-session"
              onPress={() => {
                const wodId = selected?.id;
                setSelected(null);
                if (wodId) navigation.navigate('WODDetail', { wodId });
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(c: AxColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    headerSub: { ...axTypography.caption, color: c.textMuted, textAlign: 'center', paddingHorizontal: axSpacing.xl },
    dateBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

    weekNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginHorizontal: axSpacing.xl, marginTop: axSpacing.sm, paddingVertical: axSpacing.xs,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    weekArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    weekCenter: { alignItems: 'center', flex: 1, minWidth: 0 },
    weekLabel: { ...axTypography.label, color: c.text },
    weekNow: { ...axTypography.labelSmall, color: c.accentText },

    loader: { marginTop: 40 },
    emptyBlock: { alignItems: 'center', padding: 32, gap: axSpacing.md },
    emptyTitle: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    emptyText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },

    list: { paddingHorizontal: axSpacing.xl, paddingTop: axSpacing.sm },
    dayBlock: { paddingVertical: axSpacing.md, gap: axSpacing.sm },
    daySep: { borderTopWidth: 1, borderTopColor: c.border },
    dayHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    dayLabel: { ...axTypography.overline, color: c.textMuted },
    restBadge: { ...axTypography.bodySmall, color: c.textMuted },
    wodRow: { paddingVertical: axSpacing.md },
    wodLine: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
    wodContent: { flex: 1, minWidth: 0, gap: 2 },
    wodType: { ...axTypography.labelSmall, color: c.accentText, letterSpacing: 1 },
    wodTitle: { ...axTypography.label, color: c.text },
    wodDesc: { ...axTypography.caption, color: c.textMuted },
    doneChip: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, maxWidth: 110 },
    doneText: { ...axTypography.labelSmall, color: c.success },

    modalContainer: { flex: 1, backgroundColor: c.background },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md,
      paddingHorizontal: axSpacing.xl, paddingVertical: axSpacing.lg, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    modalTitle: { ...axTypography.titleM, color: c.text, flex: 1, minWidth: 0 },
    modalCancel: { ...axTypography.label, color: c.accentText },
    modalBody: { padding: axSpacing.xl, gap: axSpacing.md, paddingBottom: 60 },

    lundiList: { gap: axSpacing.sm },
    lundiRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44,
      paddingHorizontal: axSpacing.lg, paddingVertical: axSpacing.md,
      borderRadius: axRadius.control, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
    },
    lundiRowActif: { borderColor: c.accentText },
    lundiTxt: { ...axTypography.label, color: c.text },
    erreurTxt: { ...axTypography.bodySmall, color: c.danger },

    detailBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: axSpacing.sm, alignItems: 'center' },
    metaBadge: {
      flexDirection: 'row', alignItems: 'center', gap: axSpacing.xs, paddingHorizontal: axSpacing.sm, paddingVertical: axSpacing.xs,
      borderRadius: axRadius.badge, borderWidth: 1, borderColor: c.border,
    },
    metaBadgeText: { ...axTypography.labelSmall, color: c.textMuted },
    sectionLabel: { ...axTypography.overline, color: c.textMuted },
    detailDesc: { ...axTypography.body, color: c.text },
    notesCard: { gap: axSpacing.sm },
    noteHeader: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
    notesLabel: { ...axTypography.overline, color: c.accentText },
    detailNotes: { ...axTypography.bodySmall, color: c.text },
    myScoreCard: { gap: axSpacing.xs },
    myScoreLabel: { ...axTypography.overline, color: c.success },
    myScoreValue: { ...axTypography.numberM, color: c.text },
  });
}
