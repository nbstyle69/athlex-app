import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AxDayItem } from '../../components/ax';
import { hitSlopFor } from '../../components/ax/color';
import { axSpacing } from '../../theme/axTokens';

const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export interface WeekDay { iso: string; dayNumber: number }

interface Props {
  days: WeekDay[];
  selectedDate: string;
  todayISO: string;
  /** Jours strictement après cette date ISO : grisés, non appuyables. */
  maxDate: string;
  forwardDisabled: boolean;
  onSelectDate: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

/** Semaine de la Réservation : flèches et 7 jours en AxDayItem. */
export default function ReservationWeekPicker({
  days, selectedDate, todayISO, maxDate, forwardDisabled, onSelectDate, onPrev, onNext,
}: Props) {
  const c = useTheme().theme.ax;
  return (
    <View style={styles.row} testID="r10-week">
      <Pressable
        testID="r10-week-prev"
        onPress={onPrev}
        accessibilityRole="button"
        accessibilityLabel="‹"
        hitSlop={hitSlopFor(22, 58)}
        style={styles.arrow}
      >
        <ChevronLeft color={c.textMuted} size={18} />
      </Pressable>
      {days.map((d, i) => (
        <AxDayItem
          key={d.iso}
          testID={`r10-day-${d.iso}`}
          dayLabel={DAY_LABELS[i]}
          dayNumber={d.dayNumber}
          selected={d.iso === selectedDate}
          today={d.iso === todayISO}
          disabled={d.iso > maxDate}
          onPress={() => onSelectDate(d.iso)}
        />
      ))}
      <Pressable
        testID="r10-week-next"
        onPress={() => { if (!forwardDisabled) onNext(); }}
        disabled={forwardDisabled}
        accessibilityRole="button"
        accessibilityLabel="›"
        accessibilityState={{ disabled: forwardDisabled }}
        hitSlop={hitSlopFor(22, 58)}
        style={[styles.arrow, forwardDisabled && styles.arrowOff]}
      >
        <ChevronRight color={c.textMuted} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: axSpacing.lg, paddingVertical: axSpacing.sm },
  arrow: { width: 22, height: 58, alignItems: 'center', justifyContent: 'center' },
  arrowOff: { opacity: 0.35 },
});
