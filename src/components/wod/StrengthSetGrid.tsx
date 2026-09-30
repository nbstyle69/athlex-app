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
import { View, Text, StyleSheet } from 'react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import {
  StrengthCardSummary, StrengthSetDraft, normalizeDecimalInput, normalizeRepsInput, savedAgo, setRanks,
  strengthSetDeviation, strengthTonnage, validStrengthSets,
} from '../../services/strengthSets';
import { AxCard, AxStatusDot, AxTextField } from '../ax';
import { axSpacing, axTypography } from '../../theme/axTokens';
import i18n from '../../i18n';

interface Props {
  drafts: StrengthSetDraft[];
  onChange: (index: number, patch: Partial<Pick<StrengthSetDraft, 'reps' | 'loadKg'>>) => void;
}

export default function StrengthSetGrid({ drafts, onChange }: Props) {
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
        const deviates =
          d.reps.trim() !== String(d.prescribedReps) ||
          (d.prescribedLoadKg != null && d.loadKg.trim() !== String(d.prescribedLoadKg));
        return (
          <View key={`${d.entryIndex}-${d.setIndex}`}>
            {first && <Text style={S.movement}>{d.name}</Text>}
            <View style={S.row}>
              <Text style={S.setLabel}>Série {ranks[i]}</Text>
              <View style={S.input}>
                <AxTextField
                  compact
                  placeholder="reps"
                  value={d.reps}
                  onChangeText={txt => onChange(i, { reps: normalizeRepsInput(txt) })}
                  testID={`strength-reps-${i}`}
                  keyboardType="number-pad"
                />
              </View>
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
                  : `prévu ${d.prescribedReps} reps`}
              </Text>
            </View>
          </View>
        );
      })}
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
 * « Mes charges » d'une séance validée : les séries enregistrées (pas la
 * prescription), l'écart à la prescription, tonnage et charge max.
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
  return (
    <AxCard testID="strength-my-loads">
      <Text style={[axTypography.overline, { color: c.textMuted }]}>{i18n.t('strengthSession.myLoadsTitle')}</Text>
      {sets.map((d, i) => {
        const first = i === 0 || sets[i - 1].entryIndex !== d.entryIndex;
        const dev = strengthSetDeviation(d);
        const gaps = [
          dev.reps && i18n.t('strengthSession.deviationReps', { done: dev.reps.done, planned: dev.reps.planned }),
          dev.loadKg && i18n.t('strengthSession.deviationLoad', { done: fmtKg(dev.loadKg.done), planned: fmtKg(dev.loadKg.planned) }),
        ].filter(Boolean).join(' · ');
        return (
          <View key={`${d.entryIndex}-${d.setIndex}`} testID={`strength-my-loads-set-${i}`}>
            {first && <Text style={[axTypography.label, { color: c.text }]}>{d.name}</Text>}
            <View style={axStyles.setLine}>
              <Text style={[axTypography.bodySmall, { color: c.text }]}>
                {i18n.t('strengthSession.setLine', { index: ranks[drafts.indexOf(d)], reps: d.reps, kg: d.loadKg })}
              </Text>
              {gaps ? (
                <Text style={[axTypography.labelSmall, { color: c.accentText }]} testID={`strength-my-loads-gap-${i}`}>{gaps}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
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
    </AxCard>
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
});

function createStyles(theme: AppTheme) {
  const c = theme.ax;
  return StyleSheet.create({
    label: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.lg, marginBottom: axSpacing.xs },
    hint: { ...axTypography.caption, color: c.textMuted, marginBottom: axSpacing.sm },
    movement: { ...axTypography.label, color: c.text, marginTop: 10, marginBottom: axSpacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    setLabel: { ...axTypography.caption, color: c.textMuted, width: 62 },
    input: { flex: 1, minWidth: 52 },
    times: { ...axTypography.caption, color: c.textMuted },
    prescribed: { ...axTypography.caption, color: c.textMuted, width: 80, textAlign: 'right' },
    prescribedDeviates: { ...axTypography.labelSmall, color: c.accentText },
  });
}
