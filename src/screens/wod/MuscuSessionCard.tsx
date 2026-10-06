/**
 * AthleX — Séance Musculation sur la page résultat (M2, sans mode Split).
 * Une ligne par exercice (séries × reps, charge, repos), chevron vers les notes
 * (variante débutant, tempo) et la saisie des séries réellement faites (reps, kg).
 * Le minuteur de repos de l'exercice courant démarre au bouton « Série suivante » ;
 * l'exercice suivant devient courant quand toutes ses séries sont faites.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, Check, Plus, Timer as TimerIcon, Trash2 } from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import { loadText, sideLabel } from '../../../packages/wod-engine/src';
import type { MuscuExercise, MuscuWod } from '../../../packages/wod-engine/src';
import { PerformedExercise, PerformedSet, setTonnage, totalTonnage } from '../../services/wodGenerator';
import { initialPerformed, muscuRepsOnly, performedToDrafts } from '../../services/muscuSession';
import {
  MAX_SETS_PER_MOVEMENT, normalizeDecimalInput, normalizeRepsInput, parseDecimal, strengthProgress,
} from '../../services/strengthSets';
import { StrengthSaveState, StrengthSessionStatus, repsText } from '../../components/wod/StrengthSetGrid';
import { AxButton, AxCard, AxTextField } from '../../components/ax';
import { axSpacing, axTypography } from '../../theme/axTokens';
import i18n from '../../i18n';

export { initialPerformed };

/** « 4 × 8 / jambe », « 3 × 30 s » */
export function schemeText(e: MuscuExercise): string {
  let out = `${e.sets} × ${e.reps}`;
  if (e.reps_unit !== 'reps') out += ` ${e.reps_unit}`;
  if (e.per_side) out += ` / ${sideLabel(e)}`;
  return out;
}

export function restText(rest_s: number): string {
  if (rest_s <= 0) return '';
  if (rest_s < 60) return i18n.t('muscu.restSec', { s: rest_s });
  const m = Math.floor(rest_s / 60);
  const s = rest_s % 60;
  return s ? i18n.t('muscu.restMinSec', { m, s: s.toString().padStart(2, '0') }) : i18n.t('muscu.restMin', { m });
}

const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
const parseNum = (s: string) => {
  const n = parseDecimal(s);
  return n != null && n >= 0 ? n : 0;
};

export interface Cursor {
  exercise: number;
  set: number;
}

/** Curseur après une série faite : série suivante, ou premier set de l'exercice suivant. */
export function advance(cursor: Cursor, exercises: readonly MuscuExercise[]): Cursor | null {
  const e = exercises[cursor.exercise];
  if (!e) return null;
  if (cursor.set + 1 < e.sets) return { exercise: cursor.exercise, set: cursor.set + 1 };
  return cursor.exercise + 1 < exercises.length ? { exercise: cursor.exercise + 1, set: 0 } : null;
}

interface Props {
  wod: MuscuWod;
  accent: string;
  performed: PerformedExercise[];
  onPerformedChange: (next: PerformedExercise[]) => void;
  /** Brouillon serveur : état de l'enregistrement (absent tant que la séance n'est pas suivie). */
  draft?: {
    saveState: StrengthSaveState;
    savedAt: string | null;
    validated: boolean;
    onSaveLater: () => void;
  };
}

export default function MuscuSessionCard({ wod, accent, performed, onPerformedChange, draft }: Props) {
  const { theme } = useTheme();
  const S = useMemo(() => styles(theme), [theme]);
  const c = theme.ax;
  const exercises = wod.blocks[0].exercises;

  const [open, setOpen] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState<Cursor | null>(exercises.length ? { exercise: 0, set: 0 } : null);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const restEndRef = useRef<number>(0);
  // Texte des charges en cours de frappe (« 102, » avant « 102,5 ») : la valeur numérique seule le perdrait.
  const [kgText, setKgText] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!draft) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [!!draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (restLeft == null) return undefined;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((restEndRef.current - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [restLeft != null]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (i: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const updateSet = (ei: number, si: number, patch: Partial<PerformedSet>) => {
    onPerformedChange(performed.map((ex, i) => (i !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)),
    })));
  };

  /** « Ajouter une série » (exercice en reps seules) : série vide, retirable. */
  const addSet = (ei: number) => {
    const ex = performed[ei];
    if (!ex || ex.sets.length >= MAX_SETS_PER_MOVEMENT) return;
    onPerformedChange(performed.map((x, i) => (i !== ei ? x : { ...x, sets: [...x.sets, { reps: 0, load_kg: 0, added: true }] })));
    setOpen((prev) => new Set(prev).add(ei));
  };
  /** Corbeille d'une série ajoutée (seules les séries ajoutées en portent une). */
  const removeSet = (ei: number, si: number) => {
    onPerformedChange(performed.map((x, i) => (i !== ei ? x : { ...x, sets: x.sets.filter((_, j) => j !== si) })));
  };
  const repsOf = (ei: number) => (performed[ei]?.sets ?? []).reduce((sum, st) => sum + (st.reps > 0 ? st.reps : 0), 0);
  const repsOnlyIdx = exercises.map((e, i) => (muscuRepsOnly(e) ? i : -1)).filter((i) => i >= 0);
  const totalReps = repsOnlyIdx.reduce((sum, i) => sum + repsOf(i), 0);

  const nextSet = () => {
    if (!cursor) return;
    const e = exercises[cursor.exercise];
    const next = advance(cursor, exercises);
    setCursor(next);
    if (next && e.rest_s > 0) {
      restEndRef.current = Date.now() + e.rest_s * 1000;
      setRestLeft(e.rest_s);
    } else {
      setRestLeft(null);
    }
    if (next && next.exercise !== cursor.exercise) {
      setOpen((prev) => new Set(prev).add(next.exercise));
    }
  };

  const doneSets = (ei: number) => {
    if (!cursor) return exercises[ei].sets;
    if (ei < cursor.exercise) return exercises[ei].sets;
    if (ei > cursor.exercise) return 0;
    return cursor.set;
  };

  const tonnage = totalTonnage(performed);
  const current = cursor ? exercises[cursor.exercise] : null;

  return (
    <AxCard style={S.card} testID="muscu-session-card">
      <View style={S.cardInner}>
      <Text style={S.section}>{i18n.t('muscu.session')}</Text>
      {exercises.map((e, i) => {
        const isOpen = open.has(i);
        const isCurrent = cursor?.exercise === i;
        const done = doneSets(i);
        const p = performed[i];
        return (
          <View key={`${e.id}-${i}`} style={[S.row, i > 0 && S.rowBorder]} testID={`muscu-exercise-${i}`}>
            <TouchableOpacity style={S.rowHead} onPress={() => toggle(i)} activeOpacity={0.7}>
              <View style={[S.dot, { backgroundColor: done >= e.sets ? c.success : isCurrent ? accent : c.border }]} />
              <View style={{ flex: 1 }}>
                <Text style={[S.name, isCurrent && { color: accent }]}>
                  {e.name}
                  {e.optional ? <Text style={S.optional}>{i18n.t('muscu.optional')}</Text> : null}
                </Text>
                <Text style={S.scheme}>{schemeText(e)} · {loadText(e)}</Text>
                <Text style={S.meta}>
                  {[restText(e.rest_s), i18n.t('muscu.setsProgress', { done: Math.min(done, e.sets), total: e.sets })].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {isOpen ? <ChevronUp size={18} color={c.textMuted} /> : <ChevronDown size={18} color={c.textMuted} />}
            </TouchableOpacity>
            {isOpen && (
              <View style={S.detail}>
                {e.notes ? <Text style={S.notes}>{e.notes}</Text> : null}
                {p?.sets.map((s, si) => (
                  <View key={si} style={S.setRow} testID={`muscu-set-${i}-${si}`}>
                    <Text style={[S.setLabel, cursor?.exercise === i && cursor.set === si && { color: accent }]}>
                      {i18n.t('strengthSession.repsSetLine', { index: si + 1 })}
                    </Text>
                    <View style={S.input}>
                      <AxTextField
                        compact
                        value={s.reps ? String(s.reps) : ''}
                        onChangeText={(v) => updateSet(i, si, { reps: Math.floor(parseNum(normalizeRepsInput(v))) })}
                        keyboardType="number-pad"
                        placeholder={e.reps_unit === 'reps' ? 'reps' : e.reps_unit}
                        testID={`muscu-reps-${i}-${si}`}
                      />
                    </View>
                    {muscuRepsOnly(e) ? (
                      <>
                        <Text style={S.unit}>{i18n.t('strengthSession.repsUnit')}</Text>
                        <View style={{ flex: 1 }} />
                        {s.added ? (
                          <>
                            <Text style={S.tonnage}>{i18n.t('strengthSession.addedSet')}</Text>
                            <TouchableOpacity
                              onPress={() => removeSet(i, si)}
                              accessibilityRole="button"
                              accessibilityLabel={i18n.t('strengthSession.removeSetA11y', { index: si + 1 })}
                              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                              testID={`muscu-remove-${i}-${si}`}
                            >
                              <Trash2 size={16} color={c.textMuted} />
                            </TouchableOpacity>
                          </>
                        ) : null}
                      </>
                    ) : (
                    <>
                    <Text style={S.unit}>×</Text>
                    <View style={S.input}>
                    <AxTextField
                      compact
                      value={kgText[`${i}-${si}`] ?? (s.load_kg ? fmtKg(s.load_kg) : '')}
                      onChangeText={(v) => {
                        const text = normalizeDecimalInput(v);
                        setKgText((prev) => ({ ...prev, [`${i}-${si}`]: text }));
                        updateSet(i, si, { load_kg: parseNum(text) });
                      }}
                      onBlur={() => setKgText((prev) => {
                        const next = { ...prev };
                        delete next[`${i}-${si}`];
                        return next;
                      })}
                      keyboardType="decimal-pad"
                      placeholder="kg"
                      testID={`muscu-kg-${i}-${si}`}
                    />
                    </View>
                    <Text style={S.tonnage}>{setTonnage(s) ? `${fmtKg(setTonnage(s))} kg` : '—'}</Text>
                    </>
                    )}
                  </View>
                ))}
                {muscuRepsOnly(e) && (
                  <>
                    <TouchableOpacity
                      style={S.addSet}
                      onPress={() => addSet(i)}
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      testID={`muscu-add-set-${i}`}
                    >
                      <Plus size={14} color={c.accentText} />
                      <Text style={S.addSetText}>{i18n.t('strengthSession.addSet')}</Text>
                    </TouchableOpacity>
                    <View style={S.totalRow} testID={`muscu-block-total-${i}`}>
                      <Text style={S.totalLabel}>{i18n.t('strengthSession.blockTotal', { movement: e.name })}</Text>
                      <Text style={S.totalValue}>{repsText(repsOf(i))}</Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      <View style={S.footer}>
        <View style={{ flex: 1 }}>
          <Text style={S.footerLabel}>{i18n.t('strengthSession.tonnageLabel')}</Text>
          <Text style={S.footerValue} testID="muscu-tonnage">{fmtKg(tonnage)} kg</Text>
        </View>
        {repsOnlyIdx.length > 0 && (
          <View style={{ flex: 1 }} testID="muscu-total-reps">
            <Text style={S.footerLabel}>{i18n.t('strengthSession.totalRepsLabel')}</Text>
            <Text style={S.footerValue} testID="muscu-total-reps-value">{repsText(totalReps)}</Text>
          </View>
        )}
        {restLeft != null && (
          <View style={S.rest} testID="muscu-rest">
            <TimerIcon size={16} color={restLeft > 0 ? accent : c.success} />
            <Text style={[S.restText, { color: restLeft > 0 ? accent : c.success }]}>
              {restLeft > 0 ? i18n.t('muscu.restCountdown', { time: `${Math.floor(restLeft / 60)}:${(restLeft % 60).toString().padStart(2, '0')}` }) : i18n.t('muscu.go')}
            </Text>
          </View>
        )}
        {current ? (
          <AxButton variant="outline" icon={Check} label={i18n.t('muscu.nextSet')} onPress={nextSet} testID="muscu-next-set" />
        ) : (
          <Text style={[S.restText, { color: c.success }]}>{i18n.t('muscu.sessionDone')}</Text>
        )}
      </View>
      {draft && !draft.validated && (
        <View style={axStyles.draft} testID="muscu-draft">
          <StrengthSessionStatus
            {...strengthProgress(performedToDrafts(wod, performed))}
            savedAt={draft.savedAt}
            saveState={draft.saveState}
            now={now}
          />
          <AxButton
            variant="outline"
            label={i18n.t('strengthSession.saveLater')}
            onPress={draft.onSaveLater}
            loading={draft.saveState === 'saving'}
            fullWidth
            testID="muscu-save-later"
          />
        </View>
      )}
      </View>
    </AxCard>
  );
}

const axStyles = StyleSheet.create({
  draft: { marginTop: axSpacing.lg, gap: axSpacing.md },
});

/** Padding intérieur des cartes et espace entre deux lignes : mêmes valeurs que WodResultScreen (vue metcon). */
const CARD_PAD = 20;
const ROW_PAD = 14;

const styles = (t: AppTheme) => {
  const c = t.ax;
  return StyleSheet.create({
  card: { marginBottom: ROW_PAD, padding: 0 },
  cardInner: { padding: CARD_PAD },
  section: { ...axTypography.overline, color: c.textMuted, marginBottom: 10 },
  row: { paddingVertical: ROW_PAD },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { ...axTypography.label, color: c.text },
  optional: { ...axTypography.caption, color: c.textMuted },
  scheme: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 2 },
  meta: { ...axTypography.caption, color: c.textMuted, marginTop: 2 },
  detail: { marginTop: 10, marginLeft: 22, gap: axSpacing.sm },
  notes: { ...axTypography.bodySmall, color: c.textMuted, fontStyle: 'italic' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  setLabel: { ...axTypography.caption, color: c.textMuted, width: 56 },
  input: { width: 64 },
  unit: { ...axTypography.caption, color: c.textMuted },
  tonnage: { ...axTypography.caption, color: c.textMuted, marginLeft: 'auto', flexShrink: 1, textAlign: 'right' },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  addSetText: { ...axTypography.caption, color: c.accentText },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: axSpacing.sm },
  totalLabel: { ...axTypography.bodySmall, color: c.textMuted, flexShrink: 1 },
  totalValue: { ...axTypography.label, color: c.text },
  footer: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: axSpacing.md, marginTop: ROW_PAD, paddingTop: ROW_PAD,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
  },
  footerLabel: { ...axTypography.caption, color: c.textMuted },
  footerValue: { ...axTypography.numberM, color: c.text },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restText: { ...axTypography.labelSmall, fontVariant: ['tabular-nums'] },
  });
};
