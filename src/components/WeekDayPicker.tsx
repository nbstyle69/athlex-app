import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppTheme } from '../context/ThemeContext';
import i18n from '../i18n';
import { AxDayItem } from './ax';

const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

/** Lundi → dimanche de la semaine affichée ; le Whiteboard s'en sert aussi pour ses onglets. */
export function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  weekOffset: number;
  setWeekOffset: (fn: (prev: number) => number) => void;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  theme: AppTheme;
  /** Optional ISO date (YYYY-MM-DD): hide/disable days strictly after this date. */
  maxDate?: string;
  /** « ax » : jours en `AxDayItem` (nouveau design, Ma Box). Par défaut : rendu historique. */
  variant?: 'legacy' | 'ax';
}

export default function WeekDayPicker({ weekOffset, setWeekOffset, selectedDate, onSelectDate, theme, maxDate, variant = 'legacy' }: Props) {
  const weekDates = getWeekDates(weekOffset);
  const todayISO = toISO(new Date());
  // Disable forward arrow when the next week is fully beyond maxDate
  const nextWeekFirstISO = (() => {
    const d = new Date(weekDates[0]);
    d.setDate(d.getDate() + 7);
    return toISO(d);
  })();
  const forwardDisabled = !!maxDate && nextWeekFirstISO > maxDate;

  if (variant === 'ax') {
    const muted = theme.ax.textMuted;
    return (
      <View style={axStyles.row} testID="week-day-picker">
        <Pressable
          onPress={() => setWeekOffset(w => w - 1)}
          style={axStyles.arrow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common.back')}
          testID="week-prev"
        >
          <ChevronLeft color={muted} size={18} />
        </Pressable>
        {weekDates.map((d, i) => {
          const iso = toISO(d);
          const isOverHorizon = !!maxDate && iso > maxDate;
          return (
            <View key={iso} style={isOverHorizon ? { opacity: 0.25 } : null}>
              <AxDayItem
                dayLabel={DAY_LABELS[i]}
                dayNumber={d.getDate()}
                selected={iso === selectedDate}
                onPress={() => { if (!isOverHorizon) onSelectDate(iso); }}
                testID={`week-day-${iso}`}
              />
            </View>
          );
        })}
        <Pressable
          onPress={() => { if (!forwardDisabled) setWeekOffset(w => w + 1); }}
          disabled={forwardDisabled}
          style={[axStyles.arrow, forwardDisabled && { opacity: 0.25 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common.next')}
          testID="week-next"
        >
          <ChevronRight color={muted} size={18} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)} style={styles.arrow} activeOpacity={0.6}>
          <ChevronLeft color={theme.textMuted} size={18} />
        </TouchableOpacity>

        {weekDates.map((d, i) => {
          const iso = toISO(d);
          const isSelected = iso === selectedDate;
          const isToday = iso === todayISO;
          const isOverHorizon = !!maxDate && iso > maxDate;

          return (
            <TouchableOpacity
              key={iso}
              style={[
                styles.dayCell,
                isSelected && [styles.dayCellSelected, { borderColor: theme.text }],
                isOverHorizon && { opacity: 0.25 },
              ]}
              onPress={() => { if (!isOverHorizon) onSelectDate(iso); }}
              disabled={isOverHorizon}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayLabel,
                { color: isSelected ? theme.text : theme.textMuted },
                isToday && !isSelected && { color: theme.accent },
              ]}>
                {DAY_LABELS[i]}
              </Text>
              <Text style={[
                styles.dayNumber,
                { color: isSelected ? theme.text : theme.textMuted },
                isToday && !isSelected && { color: theme.accent },
              ]}>
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={() => { if (!forwardDisabled) setWeekOffset(w => w + 1); }}
          disabled={forwardDisabled}
          style={[styles.arrow, forwardDisabled && { opacity: 0.25 }]}
          activeOpacity={0.6}
        >
          <ChevronRight color={theme.textMuted} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 7 × 44 + 2 × 28 = 364 : tient dans 390 − 2 × 8 sans rogner les jours.
const axStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginVertical: 4 },
  arrow: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayCellSelected: {
    borderWidth: 2,
    borderRadius: 12,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
});
