import React, { useEffect, useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, CreditCard, Mail, Store } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AxButton, AxCard } from '../../components/ax';
import GlassBackground from '../../components/glass/GlassBackground';
import { navigate } from '../../navigation/navigationRef';
import { getMyPlanStatus, needsPlan, planActivationUrl } from '../../services/membership';
import { axAccentSafeLineHeight, axSpacing, axTypography } from '../../theme/axTokens';

interface Props {
  boxName: string;
  /** Page de la box sur le site ; null : la box ne vend rien en ligne, pas de bouton. */
  activationUrl: string | null;
  /** Fin de l'écran, vers Ma Box (après le site ou « Je paie au comptoir »). */
  onDone: () => void;
}

/** « Bienvenue chez ta box » (maquette 73:2095), juste après avoir rejoint une box sans formule. */
export function BoxWelcomeScreen({ boxName, activationUrl, onDone }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container} testID="box-welcome">
      <GlassBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + axSpacing['2xl'] }]}>
        <View style={[styles.badge, { borderColor: c.accentText }]}>
          <Check size={32} color={c.accentText} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>{t('welcome.title', { box: boxName })}</Text>
        <Text style={[axTypography.bodySmall, styles.center, { color: c.textMuted }]}>{t('welcome.body')}</Text>
        <View style={styles.actions}>
          {activationUrl && (
            <AxButton
              testID="box-welcome-activate"
              icon={CreditCard}
              label={t('plan.activateCta')}
              onPress={() => { Linking.openURL(activationUrl); onDone(); }}
              fullWidth
            />
          )}
          <AxButton
            testID="box-welcome-counter"
            variant="outline"
            icon={Store}
            label={t('plan.counterCta')}
            onPress={onDone}
            fullWidth
          />
        </View>
        <AxCard style={styles.invite} testID="box-welcome-invite">
          <View style={styles.inviteHead}>
            <Mail size={18} color={c.accentText} strokeWidth={2} />
            <Text style={[axTypography.label, styles.shrink, { color: c.text }]}>{t('welcome.inviteTitle')}</Text>
          </View>
          <Text style={[axTypography.caption, { color: c.textMuted }]}>{t('welcome.inviteBody')}</Text>
        </AxCard>
      </ScrollView>
    </View>
  );
}

/**
 * Monté à la racine : après un `joinBox` réussi, lit l'état de la formule et
 * n'ouvre l'écran que pour « Formule à activer ». Appel échoué, staff ou
 * formule déjà active : rien, l'app continue sur Ma Box.
 */
export default function BoxWelcomeGate() {
  const { joinedBox, clearJoinedBox } = useAuth();
  const [shown, setShown] = useState<{ name: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!joinedBox) { setShown(null); return; }
    let vivant = true;
    getMyPlanStatus(joinedBox.id).then(status => {
      if (!vivant) return;
      if (needsPlan(status)) setShown({ name: joinedBox.name, url: planActivationUrl(status, joinedBox.slug) });
      else clearJoinedBox();
    });
    return () => { vivant = false; };
  }, [joinedBox]);

  if (!shown) return null;
  const done = () => {
    clearJoinedBox();
    navigate('Whiteboard');
  };
  return (
    <Modal visible animationType="fade" onRequestClose={done}>
      <BoxWelcomeScreen boxName={shown.name} activationUrl={shown.url} onDone={done} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: axSpacing.xl, alignItems: 'center', gap: axSpacing.lg },
  badge: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { ...axTypography.titleL, lineHeight: axAccentSafeLineHeight.titleL, textAlign: 'center' },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: axSpacing.sm, marginTop: axSpacing.sm },
  invite: { alignSelf: 'stretch' },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.sm },
  shrink: { flexShrink: 1 },
});
