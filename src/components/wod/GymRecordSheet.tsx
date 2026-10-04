/**
 * Fenêtre « Nouveau record ? » (G4, Figma 501:812 / 501:899) : après une
 * validation, une série a dépassé un record de gymnastique. Le record ne change
 * que si l'athlète confirme ; chaque ligne part par confirm_gym_record avec l'id
 * de la série relue du serveur. Une erreur reste sur sa ligne, les autres lignes
 * et la séance validée ne bougent pas. « Pas maintenant » ferme sans rien écrire.
 */

import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { GymRecordCandidate, confirmGymRecord } from '../../services/strengthSets';
import { AxButton } from '../ax';
import { axSpacing, axTypography, axVeil } from '../../theme/axTokens';
import { repsText } from './StrengthSetGrid';
import i18n from '../../i18n';

interface Props {
  /** Lignes proposées ; vide ou null : fenêtre fermée. */
  candidates: GymRecordCandidate[] | null;
  /** Fermeture (« Pas maintenant », ou tout confirmé). */
  onClose: () => void;
  /** Au moins un record écrit : relire les records. */
  onSaved: () => void;
}

/** État d'une ligne : à confirmer, enregistrée, ou code d'erreur. */
type LineState = 'pending' | 'saved' | string;

export default function GymRecordSheet({ candidates, onClose, onSaved }: Props) {
  const { theme } = useTheme();
  const c = theme.ax;
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<Record<string, LineState>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { setState({}); setBusy(false); }, [candidates]);

  const lines = candidates ?? [];
  const pending = lines.filter(l => state[l.label] !== 'saved');

  async function confirm() {
    if (busy || pending.length === 0) return;
    setBusy(true);
    const results = await Promise.all(pending.map(l => confirmGymRecord(l.setLogId, l.label)));
    const next = { ...state };
    pending.forEach((l, i) => { const r = results[i]; next[l.label] = r.ok ? 'saved' : r.code; });
    setState(next);
    setBusy(false);
    if (results.some(r => r.ok)) onSaved();
    if (lines.every(l => next[l.label] === 'saved')) onClose();
  }

  const primary = pending.length === 1
    ? i18n.t('strengthSession.gymRecordSaveOne', { reps: repsText(pending[0].reps) })
    : i18n.t('strengthSession.gymRecordSaveMany');

  return (
    <Modal visible={lines.length > 0} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.veil, { backgroundColor: axVeil.background }]} testID="gym-record-veil">
        <View
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border, paddingBottom: Math.max(insets.bottom, axSpacing.xl) }]}
          testID="gym-record-sheet"
        >
          <Text style={[axTypography.overline, { color: c.textMuted }]}>{i18n.t('strengthSession.gymRecordTitle')}</Text>
          <Text style={[axTypography.caption, { color: c.textMuted }]}>{i18n.t('strengthSession.gymRecordBody')}</Text>
          {/* Plusieurs mouvements : la liste défile, les boutons restent visibles. */}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} testID="gym-record-list">
            {lines.map(l => {
              const st = state[l.label] ?? 'pending';
              return (
                <View key={l.label} testID={`gym-record-line-${l.label}`}>
                  <View style={styles.line}>
                    <Text style={[axTypography.label, styles.movement, { color: c.text }]} numberOfLines={2}>{l.movement}</Text>
                    <Text style={[axTypography.label, { color: c.text }]} testID={`gym-record-value-${l.label}`}>
                      {i18n.t('strengthSession.gymRecordLine', { reps: repsText(l.reps), record: l.record })}
                    </Text>
                  </View>
                  {st === 'saved' ? (
                    <Text style={[axTypography.caption, { color: c.accentText }]} testID={`gym-record-saved-${l.label}`}>
                      {i18n.t('strengthSession.gymRecordSaved')}
                    </Text>
                  ) : st !== 'pending' ? (
                    <Text style={[axTypography.caption, { color: c.danger }]} testID={`gym-record-error-${l.label}`}>
                      {i18n.t(`strengthSession.gymRecordError_${st}`, { defaultValue: i18n.t('strengthSession.gymRecordError_REFUS') })}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
          {pending.length > 0 && (
            <AxButton variant="accent" label={primary} onPress={confirm} loading={busy} fullWidth testID="gym-record-confirm" />
          )}
          <AxButton
            variant="outline"
            label={i18n.t('strengthSession.gymRecordLater')}
            onPress={onClose}
            disabled={busy}
            fullWidth
            testID="gym-record-later"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, justifyContent: 'flex-end' },
  // Figma 501:888 : feuille en bas, coins 8, 22 / 20 de marge, 14 entre les blocs.
  sheet: {
    borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0,
    paddingTop: 22, paddingHorizontal: 20, gap: 14,
  },
  list: { maxHeight: 240, flexGrow: 0 },
  listContent: { gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  movement: { flex: 1, minWidth: 0 },
});
