/**
 * Grille de saisie des séries de musculation — une ligne par série (lot 4).
 *
 * Avant : une charge unique par mouvement, et le 1RM calculé avec les reps
 * PRESCRITES. Un 5 × 3 réellement fait 5, 5, 3 produisait un 1RM estimé sur
 * 3 reps alors que l'athlète en avait poussé 5 : un chiffre faux, plausible, et
 * invérifiable.
 *
 * La grille est pré-remplie par la prescription (reps, et charge résolue depuis
 * le %1RM) : l'athlète qui a fait exactement ce qui était prescrit valide sans
 * rien toucher, et ne corrige que les lignes qui diffèrent. Aucun repli
 * « toutes identiques » : un repli qui cache des lignes fabrique précisément la
 * donnée supposée qu'on élimine ici.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import {
  StrengthCardSummary, StrengthSetDraft, blockRepsTotal, computedTotalReps, isRepsOnly, normalizeDecimalInput,
  normalizeRepsInput, savedAgo, setRanks, strengthSetDeviation, strengthTonnage, validStrengthSets,
} from '../../services/strengthSets';
import { AxCard, AxStatusDot, AxTextField } from '../ax';
import { axSpacing, axTypography } from '../../theme/axTokens';
import i18n from '../../i18n';

interface Props {
  drafts: StrengthSetDraft[];
  onChange: (index: number, patch: Partial<Pick<StrengthSetDraft, 'reps' | 'loadKg'>>) => void;
  /** Record de gymnastique (reps) d'un mouvement, pour la ligne « P % de ton max ». */
  gymRecordFor?: (name: string) => number | null;
  /** Lien « Renseigner mon record » quand le mouvement n'en a pas. */
  onSetGymRecord?: () => void;
  /** « Ajouter une série » sous un mouvement en reps seules (bloc `entryIndex`). */
  onAddSet?: (entryIndex: number) => void;
  /** Corbeille d'une série ajoutée (index dans `drafts`). */
  onRemoveSet?: (index: number) => void;
}

/** « 9 reps », « 1 rep ». */
export const repsText = (n: number) => i18n.t('strengthSession.repsCount', { count: n });

export default function StrengthSetGrid({ drafts, onChange, gymRecordFor, onSetGymRecord, onAddSet, onRemoveSet }: Props) {
  const { theme } = useTheme();
  const S = createStyles(theme);
  if (drafts.length === 0) return null;
  // « Série n » = rang dans le bloc ; le numéro de stockage continue d'un bloc à l'autre.
  const ranks = setRanks(drafts);

  return (
    <View>
      <Text style={S.label}>SÉRIES RÉALISÉES (MUSCULATION)</Text>
      <Text style={S.hint}>
        Pré-rempli avec ce qui était prescrit. Corrige seulement les séries où tu as fait autre
        chose — ce sont ces valeurs qui mettent à jour ton 1RM.
      </Text>
      {drafts.map((d, i) => {
        const first = i === 0 || drafts[i - 1].entryIndex !== d.entryIndex;
        // Reps prévues inconnues (% du max sans record) : pas d'écart à signaler.
        const deviates =
          (d.prescribedReps >= 1 && d.reps.trim() !== String(d.prescribedReps)) ||
          (d.prescribedLoadKg != null && d.loadKg.trim() !== String(d.prescribedLoadKg));
        const pct = d.prescribedPctOfMax ?? null;
        const record = pct != null ? gymRecordFor?.(d.name) ?? null : null;
        const repsOnly = isRepsOnly(d);
        const lastOfBlock = i === drafts.length - 1 || drafts[i + 1].entryIndex !== d.entryIndex;
        const dev = strengthSetDeviation(d);
        return (
          <View key={`${d.entryIndex}-${d.setIndex}`}>
            {first && <Text style={[S.movement, pct != null && S.movementWithPct]}>{d.name}</Text>}
            {first && pct != null && (
              <View style={S.pctBlock}>
                <Text style={S.pctLine} testID={`strength-gym-pct-${d.entryIndex}`}>
                  {record != null && d.prescribedReps >= 1
                    ? i18n.t('strengthSession.gymPctLine', { pct, record, reps: d.prescribedReps })
                    : i18n.t('strengthSession.gymPctNoRecord', { pct })}
                </Text>
                {(record == null || d.prescribedReps < 1) && onSetGymRecord && (
                  <TouchableOpacity
                    onPress={onSetGymRecord}
                    accessibilityRole="link"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`strength-gym-set-record-${d.entryIndex}`}
                  >
                    <Text style={S.pctLink}>{i18n.t('strengthSession.gymSetRecord')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={S.row}>
              <Text style={S.setLabel}>{i18n.t('strengthSession.repsSetLine', { index: ranks[i] })}</Text>
              <View style={repsOnly ? S.repsInput : S.input}>
                <AxTextField
                  compact
                  placeholder="reps"
                  value={d.reps}
                  onChangeText={txt => onChange(i, { reps: normalizeRepsInput(txt) })}
                  testID={`strength-reps-${i}`}
                  keyboardType="number-pad"
                />
              </View>
              {repsOnly ? (
                <>
                  {/* Figma 501:514 : pas de champ kg, « reps » à côté du champ. */}
                  <Text style={S.repsUnit}>{i18n.t('strengthSession.repsUnit')}</Text>
                  <View style={S.spacer} />
                  {d.isAdded ? (
                    <>
                      <Text style={S.added} testID={`strength-added-${i}`}>{i18n.t('strengthSession.addedSet')}</Text>
                      {onRemoveSet && (
                        <TouchableOpacity
                          onPress={() => onRemoveSet(i)}
                          accessibilityRole="button"
                          accessibilityLabel={i18n.t('strengthSession.removeSetA11y', { index: ranks[i] })}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          testID={`strength-remove-${i}`}
                        >
                          <Trash2 size={16} color={theme.ax.textMuted} />
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <Text style={[S.repsPrescribed, dev.reps && S.prescribedDeviates]} numberOfLines={1}>
                      {dev.reps
                        ? i18n.t('strengthSession.deviationReps', dev.reps)
                        : d.prescribedReps >= 1
                          ? i18n.t('strengthSession.plannedReps', { count: d.prescribedReps })
                          : pct != null ? i18n.t('strengthSession.plannedPctOfMax', { pct }) : ''}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={S.times}>×</Text>
                  <View style={S.input}>
                    <AxTextField
                      compact
                      placeholder="kg"
                      value={d.loadKg}
                      onChangeText={txt => onChange(i, { loadKg: normalizeDecimalInput(txt) })}
                      testID={`strength-kg-${i}`}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={[S.prescribed, deviates && S.prescribedDeviates]}>
                    {d.prescribedLoadKg != null
                      ? `prévu ${d.prescribedReps} × ${d.prescribedLoadKg}`
                      : pct != null && d.prescribedReps < 1
                        ? i18n.t('strengthSession.plannedPctOfMax', { pct })
                        : `prévu ${d.prescribedReps} reps`}
                  </Text>
                </>
              )}
            </View>
            {lastOfBlock && repsOnly && (
              <>
                {onAddSet && (
                  <TouchableOpacity
                    style={S.addSet}
                    onPress={() => onAddSet(d.entryIndex)}
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`strength-add-set-${d.entryIndex}`}
                  >
                    <Plus size={14} color={theme.ax.accentText} />
                    <Text style={S.addSetText}>{i18n.t('strengthSession.addSet')}</Text>
                  </TouchableOpacity>
                )}
                <View style={S.totalRow} testID={`strength-block-total-${d.entryIndex}`}>
                  <Text style={S.totalLabel}>{i18n.t('strengthSession.blockTotal', { movement: d.name })}</Text>
                  <Text style={S.totalValue}>{repsText(blockRepsTotal(drafts, d.entryIndex))}</Text>
                </View>
              </>
            )}
          </View>
        );
      })}
      {drafts.some(isRepsOnly) && (
        <>
          <View style={S.separator} />
          <View style={S.scoreRow} testID="strength-total-reps">
            <Text style={S.scoreLabel}>{i18n.t('strengthSession.totalRepsScore')}</Text>
            <Text style={S.scoreValue} testID="strength-total-reps-value">
              {i18n.t('strengthSession.totalRepsComputed', { reps: repsText(computedTotalReps(drafts) ?? 0) })}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const fmtKg = (n: number) => String(Math.round(n * 100) / 100);

const SAVED_AGO_KEYS = {
  justNow: 'strengthSession.savedJustNow',
  minutes: 'strengthSession.savedMinutes',
  hours: 'strengthSession.savedHours',
  days: 'strengthSession.savedDays',
} as const;

export type StrengthSaveState = 'idle' | 'saving' | 'offline' | 'refused' | 'serverNewer';

interface StatusProps {
  done: number;
  total: number;
  savedAt: string | null;
  saveState: StrengthSaveState;
  now: number;
}

/** « En cours · n / N séries » et état de l'enregistrement du brouillon. */
export function StrengthSessionStatus({ done, total, savedAt, saveState, now }: StatusProps) {
  const { theme } = useTheme();
  let saved: string;
  if (saveState === 'saving') saved = i18n.t('strengthSession.saving');
  else if (saveState === 'offline') saved = i18n.t('strengthSession.offline');
  else if (saveState === 'refused') saved = i18n.t('strengthSession.refused');
  else if (saveState === 'serverNewer') saved = i18n.t('strengthSession.serverNewer');
  else if (!savedAt) saved = i18n.t('strengthSession.notSavedYet');
  else {
    const ago = savedAgo(savedAt, now);
    saved = i18n.t(SAVED_AGO_KEYS[ago.key], { count: ago.count });
  }
  return (
    <View
      style={axStyles.status}
      accessible
      accessibilityLabel={`${i18n.t('strengthSession.statusA11y', { done, total })}. ${saved}`}
      testID="strength-status"
    >
      <AxStatusDot tone="warning" label={i18n.t('strengthSession.inProgress', { done, total })} testID="strength-progress" />
      <Text style={[axTypography.caption, { color: theme.ax.textMuted }]} testID="strength-saved">{saved}</Text>
    </View>
  );
}

/** Charge max (score) calculée depuis les séries valides, à la place du champ POIDS. */
export function StrengthMaxLoadRow({ maxLoadKg }: { maxLoadKg: number | null }) {
  const { theme } = useTheme();
  const value = maxLoadKg == null ? i18n.t('strengthSession.maxLoadEmpty') : `${fmtKg(maxLoadKg)} kg`;
  return (
    <View
      style={axStyles.maxLoad}
      accessible
      accessibilityLabel={`${i18n.t('strengthSession.maxLoadLabel')} : ${value}`}
      testID="strength-max-load"
    >
      <Text style={[axTypography.overline, { color: theme.ax.textMuted }]}>{i18n.t('strengthSession.maxLoadLabel')}</Text>
      <Text
        style={[maxLoadKg == null ? axTypography.bodySmall : axTypography.numberM, { color: theme.ax.text }]}
        testID="strength-max-load-value"
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * « Mes charges » / « Mes séries » d'une séance validée : les séries
 * enregistrées (pas la prescription), l'écart à la prescription, tonnage et
 * charge max des séries chargées ; pour les lignes en reps seules (Figma
 * 501:604 / 501:738), les reps, « ajoutée », un total par mouvement, puis
 * « Reps totales » après un séparateur.
 */
export function StrengthMyLoadsCard({ drafts, maxLoadKg }: {
  drafts: StrengthSetDraft[];
  maxLoadKg: number | null;
}) {
  const { theme } = useTheme();
  const c = theme.ax;
  const ranks = setRanks(drafts);
  const sets = validStrengthSets(drafts);
  if (sets.length === 0) return null;
  const loaded = sets.filter(d => !isRepsOnly(d));
  const totalReps = computedTotalReps(sets);
  return (
    <AxCard testID="strength-my-loads">
      <Text style={[axTypography.overline, { color: c.textMuted }]}>
        {i18n.t(totalReps != null ? 'strengthSession.mySetsTitle' : 'strengthSession.myLoadsTitle')}
      </Text>
      {sets.map((d, i) => {
        const first = i === 0 || sets[i - 1].entryIndex !== d.entryIndex;
        const last = i === sets.length - 1 || sets[i + 1].entryIndex !== d.entryIndex;
        const dev = strengthSetDeviation(d);
        const rank = ranks[drafts.indexOf(d)];
        if (isRepsOnly(d)) {
          const pct = d.prescribedPctOfMax ?? null;
          return (
            <View key={`${d.entryIndex}-${d.setIndex}`} style={axStyles.repsBlock} testID={`strength-my-loads-set-${i}`}>
              {first && <Text style={[axTypography.label, { color: c.text }]}>{d.name}</Text>}
              <View style={axStyles.repsLine}>
                <Text style={[axStyles.repsLabel, { color: c.textMuted }]}>{i18n.t('strengthSession.repsSetLine', { index: rank })}</Text>
                <Text style={[axStyles.repsValue, { color: c.text }]}>{repsText(Number(d.reps))}</Text>
                <View style={axStyles.spacer} />
                <Text
                  style={[axTypography.caption, { color: dev.reps ? c.accentText : c.textMuted }]}
                  numberOfLines={1}
                  testID={`strength-my-loads-note-${i}`}
                >
                  {d.isAdded
                    ? i18n.t('strengthSession.addedSet')
                    : dev.reps
                      ? i18n.t('strengthSession.deviationReps', dev.reps)
                      : d.prescribedReps >= 1
                        ? i18n.t('strengthSession.plannedShort', { count: d.prescribedReps })
                        : pct != null ? i18n.t('strengthSession.plannedPctOfMax', { pct }) : ''}
                </Text>
              </View>
              {last && (
                <View style={axStyles.totalLine} testID={`strength-my-loads-total-${d.entryIndex}`}>
                  <Text style={[axTypography.bodySmall, { color: c.textMuted, flexShrink: 1 }]}>
                    {i18n.t('strengthSession.blockTotal', { movement: d.name })}
                  </Text>
                  <Text style={[axTypography.label, { color: c.text }]}>{repsText(blockRepsTotal(sets, d.entryIndex))}</Text>
                </View>
              )}
            </View>
          );
        }
        const gaps = [
          dev.reps && i18n.t('strengthSession.deviationReps', { done: dev.reps.done, planned: dev.reps.planned }),
          dev.loadKg && i18n.t('strengthSession.deviationLoad', { done: fmtKg(dev.loadKg.done), planned: fmtKg(dev.loadKg.planned) }),
        ].filter(Boolean).join(' · ');
        return (
          <View key={`${d.entryIndex}-${d.setIndex}`} testID={`strength-my-loads-set-${i}`}>
            {first && <Text style={[axTypography.label, { color: c.text }]}>{d.name}</Text>}
            <View style={axStyles.setLine}>
              <Text style={[axTypography.bodySmall, { color: c.text }]}>
                {i18n.t('strengthSession.setLine', { index: rank, reps: d.reps, kg: d.loadKg })}
              </Text>
              {gaps ? (
                <Text style={[axTypography.labelSmall, { color: c.accentText }]} testID={`strength-my-loads-gap-${i}`}>{gaps}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
      {loaded.length > 0 && (
        <View style={axStyles.totals}>
          <View>
            <Text style={[axTypography.overlineSmall, { color: c.textMuted }]}>{i18n.t('strengthSession.tonnageLabel')}</Text>
            <Text style={[axTypography.numberM, { color: c.text }]} testID="strength-my-loads-tonnage">{`${fmtKg(strengthTonnage(sets))} kg`}</Text>
          </View>
          <View>
            <Text style={[axTypography.overlineSmall, { color: c.textMuted }]}>{i18n.t('strengthSession.maxLoadShort')}</Text>
            <Text style={[axTypography.numberM, { color: c.text }]} testID="strength-my-loads-max">
              {maxLoadKg == null ? '—' : `${fmtKg(maxLoadKg)} kg`}
            </Text>
          </View>
        </View>
      )}
      {totalReps != null && (
        <>
          <View style={[axStyles.separator, { backgroundColor: c.border }]} />
          <View style={axStyles.totalLine} testID="strength-my-loads-total-reps">
            <Text style={[axTypography.bodySmall, { color: c.text }]}>{i18n.t('strengthSession.totalRepsLabel')}</Text>
            <Text style={[axTypography.label, { color: c.text }]} testID="strength-my-loads-total-reps-value">{repsText(totalReps)}</Text>
          </View>
        </>
      )}
    </AxCard>
  );
}

/**
 * Séance validée sans charge (Figma 501:609) : pastille « Validée le … » et
 * « Score N reps » (reps totales, informatif ; aucun score de classement).
 */
export function StrengthRepsScoreStatus({ validatedAt, totalReps }: { validatedAt: string | null; totalReps: number }) {
  const { theme } = useTheme();
  const date = validatedAt
    ? new Date(validatedAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
    : null;
  return (
    <View style={axStyles.scoreStatus} testID="strength-reps-score">
      <AxStatusDot
        tone="active"
        label={date ? i18n.t('strengthSession.validatedOn', { date }) : i18n.t('strengthSession.cardValidated')}
      />
      <Text style={[axTypography.caption, { color: theme.ax.textMuted }]} testID="strength-reps-score-value">
        {i18n.t('strengthSession.scoreReps', { reps: repsText(totalReps) })}
      </Text>
    </View>
  );
}

/** Mention d'une carte de WOD de musculation : « En cours · n / N séries » ou « Validée ». */
export function StrengthWodCardStatus({ summary }: { summary: StrengthCardSummary | null | undefined }) {
  if (!summary) return null;
  return summary.status === 'validated'
    ? <AxStatusDot tone="active" label={i18n.t('strengthSession.cardValidated')} testID="strength-card-status" />
    : (
      <AxStatusDot
        tone="warning"
        label={i18n.t('strengthSession.inProgress', { done: summary.done, total: summary.total })}
        testID="strength-card-status"
      />
    );
}

/** Libellé du lien d'une carte : « Reprendre ma saisie » quand un brouillon attend. */
export function strengthCardLinkKey(summary: StrengthCardSummary | null | undefined): string {
  return summary?.status === 'draft' ? 'strengthSession.resumeEntry' : 'whiteboard.seeDetails';
}

const axStyles = StyleSheet.create({
  status: { gap: axSpacing.xs, marginTop: axSpacing.lg },
  maxLoad: { gap: axSpacing.xs, marginTop: axSpacing.lg },
  setLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: axSpacing.sm },
  totals: { flexDirection: 'row', gap: axSpacing['2xl'] },
  // Figma 501:613 : 10 px entre chaque ligne (nom, séries, total).
  repsBlock: { gap: 10 },
  repsLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repsLabel: { fontFamily: axTypography.caption.fontFamily, fontSize: 13, width: 58 },
  repsValue: { fontFamily: axTypography.label.fontFamily, fontSize: 15 },
  spacer: { flex: 1, minWidth: 4 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
  separator: { height: 1, alignSelf: 'stretch' },
  scoreStatus: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: axSpacing.sm },
});

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    label: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.lg, marginBottom: axSpacing.xs },
    hint: { ...axTypography.caption, color: c.textMuted, marginBottom: axSpacing.sm },
    movement: { ...axTypography.label, color: c.text, marginTop: 10, marginBottom: axSpacing.xs },
    movementWithPct: { marginBottom: 0 },
    // Figma 501:808 / 501:809 : 4 px sous le nom, style des « prévu … », lien couleur des écarts.
    pctBlock: { gap: 4, marginTop: 4, marginBottom: axSpacing.sm },
    pctLine: { ...axTypography.caption, color: c.textMuted },
    pctLink: { ...axTypography.caption, color: c.accentText },
    // Figma 501:514 / 501:648 : reps seules, ajout, totaux.
    repsInput: { width: 74 },
    repsUnit: { fontFamily: axTypography.caption.fontFamily, fontSize: 14, color: c.textMuted },
    spacer: { flex: 1, minWidth: 4 },
    repsPrescribed: { ...axTypography.caption, color: c.textMuted, flexShrink: 1, textAlign: 'right' },
    added: { ...axTypography.caption, color: c.textMuted },
    addSet: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: axSpacing.sm },
    addSetText: { ...axTypography.caption, color: c.accentText },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm, marginBottom: axSpacing.xs },
    totalLabel: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
    totalValue: { ...axTypography.label, color: c.text },
    separator: { height: 1, backgroundColor: c.border, marginVertical: axSpacing.md },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
    scoreLabel: { ...axTypography.bodySmall, color: c.text, flexShrink: 1 },
    scoreValue: { ...axTypography.label, color: c.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    setLabel: { ...axTypography.caption, color: c.textMuted, width: 62 },
    input: { flex: 1, minWidth: 52 },
    times: { ...axTypography.caption, color: c.textMuted },
    prescribed: { ...axTypography.caption, color: c.textMuted, width: 80, textAlign: 'right' },
    prescribedDeviates: { ...axTypography.labelSmall, color: c.accentText },
  });
}
