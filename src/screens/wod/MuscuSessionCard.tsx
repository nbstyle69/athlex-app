/**
 * AthleX — Séance Musculation sur la page résultat (M2, sans mode Split).
 * Une ligne par exercice (séries × reps, charge, repos), chevron vers les notes
 * (variante débutant, tempo) et la saisie des séries réellement faites (reps, kg).
 * Le minuteur de repos de l'exercice courant démarre au bouton « Série suivante » ;
 * l'exercice suivant devient courant quand toutes ses séries sont faites.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { ChevronDown, ChevronUp, Check, Timer as TimerIcon } from 'lucide-react-native';

import { useTheme, AppTheme } from '../../context/ThemeContext';
import GlassCard from '../../components/glass/GlassCard';
import { spacing, typography } from '../../theme/designTokens';
import { loadText, sideLabel } from '../../../packages/wod-engine/src';
import type { MuscuExercise, MuscuWod } from '../../../packages/wod-engine/src';
import { PerformedExercise, PerformedSet, plannedSets, setTonnage, totalTonnage } from '../../services/wodGenerator';

export function initialPerformed(wod: MuscuWod): PerformedExercise[] {
  return wod.blocks[0].exercises.map((e) => ({ exercise_id: e.id, name: e.name, sets: plannedSets(e) }));
}

/** « 4 × 8 / jambe », « 3 × 30 s » */
export function schemeText(e: MuscuExercise): string {
  let out = `${e.sets} × ${e.reps}`;
  if (e.reps_unit !== 'reps') out += ` ${e.reps_unit}`;
  if (e.per_side) out += ` / ${sideLabel(e)}`;
  return out;
}

export function restText(rest_s: number): string {
  if (rest_s <= 0) return '';
  if (rest_s < 60) return `repos ${rest_s} s`;
  const m = Math.floor(rest_s / 60);
  const s = rest_s % 60;
  return s ? `repos ${m} min ${s.toString().padStart(2, '0')}` : `repos ${m} min`;
}

const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
const parseNum = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
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
}

export default function MuscuSessionCard({ wod, accent, performed, onPerformedChange }: Props) {
  const { theme } = useTheme();
  const S = useMemo(() => styles(theme), [theme]);
  const exercises = wod.blocks[0].exercises;

  const [open, setOpen] = useState<Set<number>>(new Set());
  const [cursor, setCursor] = useState<Cursor | null>(exercises.length ? { exercise: 0, set: 0 } : null);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const restEndRef = useRef<number>(0);

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
    <GlassCard style={S.card}>
      <Text style={S.section}>Séance</Text>
      {exercises.map((e, i) => {
        const isOpen = open.has(i);
        const isCurrent = cursor?.exercise === i;
        const done = doneSets(i);
        const p = performed[i];
        return (
          <View key={`${e.id}-${i}`} style={[S.row, i > 0 && S.rowBorder]} testID={`muscu-exercise-${i}`}>
            <TouchableOpacity style={S.rowHead} onPress={() => toggle(i)} activeOpacity={0.7}>
              <View style={[S.dot, { backgroundColor: done >= e.sets ? theme.success : isCurrent ? accent : theme.border }]} />
              <View style={{ flex: 1 }}>
                <Text style={[S.name, isCurrent && { color: accent }]}>
                  {e.name}
                  {e.optional ? <Text style={S.optional}> · optionnel</Text> : null}
                </Text>
                <Text style={S.scheme}>{schemeText(e)} · {loadText(e)}</Text>
                <Text style={S.meta}>
                  {[restText(e.rest_s), `${Math.min(done, e.sets)}/${e.sets} séries`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {isOpen ? <ChevronUp size={18} color={theme.textMuted} /> : <ChevronDown size={18} color={theme.textMuted} />}
            </TouchableOpacity>
            {isOpen && (
              <View style={S.detail}>
                {e.notes ? <Text style={S.notes}>{e.notes}</Text> : null}
                {p?.sets.map((s, si) => (
                  <View key={si} style={S.setRow}>
                    <Text style={[S.setLabel, cursor?.exercise === i && cursor.set === si && { color: accent }]}>
                      Série {si + 1}
                    </Text>
                    <TextInput
                      style={S.input}
                      value={s.reps ? String(s.reps) : ''}
                      onChangeText={(v) => updateSet(i, si, { reps: Math.floor(parseNum(v)) })}
                      keyboardType="number-pad"
                      placeholder={e.reps_unit === 'reps' ? 'reps' : e.reps_unit}
                      placeholderTextColor={theme.textMuted}
                      testID={`muscu-reps-${i}-${si}`}
                    />
                    <Text style={S.unit}>×</Text>
                    <TextInput
                      style={S.input}
                      value={s.load_kg ? fmtKg(s.load_kg) : ''}
                      onChangeText={(v) => updateSet(i, si, { load_kg: parseNum(v) })}
                      keyboardType="decimal-pad"
                      placeholder="kg"
                      placeholderTextColor={theme.textMuted}
                      testID={`muscu-kg-${i}-${si}`}
                    />
                    <Text style={S.tonnage}>{setTonnage(s) ? `${fmtKg(setTonnage(s))} kg` : '—'}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={S.footer}>
        <View style={{ flex: 1 }}>
          <Text style={S.footerLabel}>Tonnage</Text>
          <Text style={S.footerValue} testID="muscu-tonnage">{fmtKg(tonnage)} kg</Text>
        </View>
        {restLeft != null && (
          <View style={S.rest} testID="muscu-rest">
            <TimerIcon size={16} color={restLeft > 0 ? accent : theme.success} />
            <Text style={[S.restText, { color: restLeft > 0 ? accent : theme.success }]}>
              {restLeft > 0 ? `Repos ${Math.floor(restLeft / 60)}:${(restLeft % 60).toString().padStart(2, '0')}` : 'Go !'}
            </Text>
          </View>
        )}
        {current ? (
          <TouchableOpacity style={[S.nextBtn, { backgroundColor: accent }]} onPress={nextSet} activeOpacity={0.85} testID="muscu-next-set">
            <Check size={16} color="#fff" />
            <Text style={S.nextText}>Série suivante</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[S.restText, { color: theme.success }]}>Séance terminée</Text>
        )}
      </View>
    </GlassCard>
  );
}

const styles = (t: AppTheme) => StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginTop: spacing.md, padding: 20 },
  section: { ...typography.caption, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  row: { paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { ...typography.body, color: t.text, fontWeight: '600' },
  optional: { ...typography.caption, color: t.textMuted, fontWeight: '400' },
  scheme: { ...typography.bodySmall, color: t.textSecondary, marginTop: 2 },
  meta: { ...typography.caption, color: t.textMuted, marginTop: 2 },
  detail: { marginTop: 10, marginLeft: 22, gap: 8 },
  notes: { ...typography.bodySmall, color: t.textSecondary, fontStyle: 'italic' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setLabel: { ...typography.bodySmall, color: t.textMuted, width: 64 },
  input: {
    width: 64, height: 36, borderRadius: 8, borderWidth: 1, borderColor: t.border, color: t.text,
    paddingHorizontal: 8, textAlign: 'center', ...typography.body,
  },
  unit: { ...typography.bodySmall, color: t.textMuted },
  tonnage: { ...typography.bodySmall, color: t.textSecondary, marginLeft: 'auto' },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
  },
  footerLabel: { ...typography.caption, color: t.textMuted },
  footerValue: { ...typography.body, color: t.text, fontWeight: '700' },
  rest: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restText: { ...typography.bodySmall, fontWeight: '600', fontVariant: ['tabular-nums'] },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 12 },
  nextText: { ...typography.bodySmall, color: '#fff', fontWeight: '700' },
});
