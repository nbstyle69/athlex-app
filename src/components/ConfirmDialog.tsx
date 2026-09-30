import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { AxButton, type AxButtonVariant } from './ax/AxButton';
import { AxCard } from './ax/AxCard';
import { axSpacing, axTypography, axVeil } from '../theme/axTokens';

/** Bouton de fenêtre, même forme qu'un bouton d'Alert.alert. */
export interface ConfirmDialogButton {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (value?: string) => unknown;
}

interface Request {
  title: string;
  message?: string;
  buttons?: ConfirmDialogButton[];
  icon?: LucideIcon;
}

/** Durée de fermeture d'une fenêtre native iOS : une autre fenêtre ne peut pas s'ouvrir avant. */
export const MODAL_DISMISS_MS = 400;

const VARIANT: Record<NonNullable<ConfirmDialogButton['style']>, AxButtonVariant> = {
  default: 'accent',
  cancel: 'outline',
  destructive: 'stop',
};

/** Variante AxButton d'un bouton de fenêtre : destructif en stop, annuler en outline, le reste en accent. */
export function dialogButtonVariant(style: ConfirmDialogButton['style']): AxButtonVariant {
  return VARIANT[style ?? 'default'];
}

/**
 * Fenêtre du nouveau design : AxCard centrée sur voile sombre.
 * `show` prend les mêmes arguments qu'Alert.alert ; sans bouton, un seul « OK ».
 */
export function useConfirmDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const readyAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((title: string, message?: string, buttons?: ConfirmDialogButton[], options?: { icon?: LucideIcon }) => {
    const open = () => setRequest({ title, message, buttons, icon: options?.icon });
    const wait = readyAt.current - Date.now();
    if (wait > 0) timer.current = setTimeout(open, wait);
    else open();
  }, []);

  /** À appeler quand une autre fenêtre de l'écran se ferme juste avant `show`. */
  const afterModalClose = useCallback(() => {
    if (Platform.OS === 'ios') readyAt.current = Date.now() + MODAL_DISMISS_MS;
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const element = <ConfirmDialog request={request} onClose={() => setRequest(null)} />;
  return { show, afterModalClose, element };
}

function ConfirmDialog({ request, onClose }: { request: Request | null; onClose: () => void }) {
  const { theme } = useTheme();
  const c = theme.ax;
  const { t } = useTranslation();
  const buttons = request?.buttons?.length ? request.buttons : [{ text: t('common.ok') }];
  const Icon = request?.icon;

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => {}}>
      <View testID="confirm-dialog-veil" style={[styles.veil, { backgroundColor: axVeil.background }]}>
        {request && (
          <AxCard testID="confirm-dialog" style={styles.card}>
            {Icon && <Icon testID="confirm-dialog-icon" size={28} color={c.accentText} strokeWidth={1.75} />}
            <Text style={[axTypography.titleM, styles.center, { color: c.text }]}>{request.title}</Text>
            {!!request.message && (
              <Text style={[axTypography.bodySmall, styles.center, { color: c.textMuted }]}>{request.message}</Text>
            )}
            <View style={styles.actions}>
              {buttons.map((b, i) => (
                <AxButton
                  key={`${b.text}-${i}`}
                  testID={`confirm-dialog-button-${i}`}
                  label={b.text ?? t('common.ok')}
                  variant={dialogButtonVariant(b.style)}
                  fullWidth
                  onPress={() => { onClose(); b.onPress?.(); }}
                />
              ))}
            </View>
          </AxCard>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: axSpacing.xl },
  card: { width: '100%', maxWidth: 360, alignItems: 'center', gap: axSpacing.md },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: axSpacing.sm, marginTop: axSpacing.xs },
});
