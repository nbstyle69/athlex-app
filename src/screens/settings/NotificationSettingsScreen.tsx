import { AxScreenHeader } from '../../components/ax/AxScreenHeader';
import { AxButton, AxCard, AxChip, AxSwitch } from '../../components/ax';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  ActivityIndicator, Linking,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Clock, Users, Trophy, Zap, MessageCircle, Heart, Dumbbell, CalendarClock, TrendingUp, Megaphone, Award } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppTheme } from '../../context/ThemeContext';
import { HueName, hue } from '../../theme/hues';
import {
  NotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  saveNotificationPrefs,
  registerForPushNotifications,
  savePushToken,
} from '../../services/notifications';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { axSpacing, axTypography } from '../../theme/axTokens';
import { readableInk } from '../home/homeLevelColor';
import { captureError } from '../../lib/sentry';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type BoolKey = Exclude<keyof NotificationPrefs, 'reminder_hour' | 'notifications_enabled'>;

interface Toggle {
  /** Libellé et sous-titre : `notifSettings.toggles.<key>`. */
  key: BoolKey;
  Icon: typeof Bell;
  /** Couleur de catégorie — teinte de domaine, résolue selon le thème. */
  hue: HueName;
}

// Chaque clé de la table `notification_preferences` est exposée ici : une clé
// gouvernée côté serveur mais absente de cet écran serait un réglage que
// l'utilisateur subit sans pouvoir le changer. Titre : `notifSettings.groups.<id>`.
const GROUPS: { id: string; toggles: Toggle[] }[] = [
  {
    id: 'reminders',
    toggles: [
      { key: 'score_reminder', Icon: Clock, hue: 'amber' },
      { key: 'class_reminders', Icon: CalendarClock, hue: 'cyan' },
    ],
  },
  {
    id: 'social',
    toggles: [
      { key: 'friend_requests', Icon: Users, hue: 'violet' },
      { key: 'group_messages', Icon: MessageCircle, hue: 'blue' },
      { key: 'score_comments', Icon: MessageCircle, hue: 'blue' },
      { key: 'score_reactions', Icon: Heart, hue: 'pink' },
    ],
  },
  {
    id: 'training',
    toggles: [
      { key: 'new_wod', Icon: Dumbbell, hue: 'emerald' },
      { key: 'badge_unlocks', Icon: Award, hue: 'orange' },
    ],
  },
  {
    id: 'competition',
    toggles: [
      { key: 'tournament_updates', Icon: Trophy, hue: 'yellow' },
      { key: 'score_updates', Icon: Zap, hue: 'red' },
      { key: 'elo_updates', Icon: TrendingUp, hue: 'indigo' },
    ],
  },
  {
    id: 'box',
    toggles: [
      { key: 'box_announcements', Icon: Megaphone, hue: 'teal' },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const tabSpace = useTabBarScrollSpace();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const S = createStyles(theme);

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);
  // Résultat du bouton de test, affiché sous le bouton.
  const [test, setTest] = useState<'idle' | 'busy' | 'ready' | 'denied'>('idle');

  useEffect(() => {
    if (!user) return;
    getNotificationPrefs(user.id).then(p => {
      setPrefs(p);
      setLoaded(true);
    });
  }, [user]);

  // L'affichage ne bouge qu'après l'écriture : pendant l'appel les réglages sont
  // inertes et la ligne en cours porte un indicateur. Un affichage optimiste
  // montrerait un réglage absent de la base tant que la requête n'a pas répondu
  // — sur un échec lent, pendant toute sa durée.
  async function update(key: keyof NotificationPrefs, value: boolean | number) {
    if (!user || saving) return;
    setSaving(key);
    try {
      // saveNotificationPrefs annule aussi les rappels déjà programmés sur
      // l'appareil : l'écran n'a pas à connaître cette mécanique.
      await saveNotificationPrefs(user.id, { [key]: value });
      setPrefs(p => ({ ...p, [key]: value }));
    } catch {
      Alert.alert(t('notifSettings.saveFailedTitle'), t('notifSettings.saveFailedMsg'));
    } finally {
      setSaving(null);
    }
  }

  // Enregistre le jeton, puis programme une notification locale : l'utilisateur
  // voit arriver une vraie notification, sans aucune requête d'envoi.
  async function testPush() {
    if (test === 'busy') return;
    setTest('busy');
    try {
      const token = await registerForPushNotifications();
      if (!token) { setTest('denied'); return; }
      if (user) await savePushToken(user.id, token);
      await Notifications.scheduleNotificationAsync({
        content: { title: t('notifSettings.testTitle'), body: t('notifSettings.testBody'), sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
      });
      setTest('ready');
    } catch (e) {
      captureError(e, { screen: 'NotificationSettings', action: 'testPush' });
      setTest('idle');
    }
  }

  if (!loaded) return null;

  const master = prefs.notifications_enabled;

  function renderToggle(tg: Toggle) {
    const value = prefs[tg.key] && master;
    const tint = readableInk(hue(theme.mode, tg.hue), theme.ax);
    const label = t(`notifSettings.toggles.${tg.key}.label`);
    return (
      <View style={S.row} key={tg.key}>
        <View style={S.rowLeft}>
          <tg.Icon color={master ? tint : theme.ax.textMuted} size={18} />
          <View style={{ flex: 1 }}>
            <Text style={[S.rowLabel, !master && S.rowLabelOff]}>{label}</Text>
            <Text style={S.rowSub}>{t(`notifSettings.toggles.${tg.key}.sub`)}</Text>
          </View>
        </View>
        {saving === tg.key ? (
          <ActivityIndicator size="small" color={tint} style={S.pending} />
        ) : (
          <AxSwitch
            value={value}
            disabled={!master || saving !== null}
            onValueChange={v => update(tg.key, v)}
            accessibilityLabel={label}
            testID={`notif-switch-${tg.key}`}
          />
        )}
      </View>
    );
  }

  return (
    <View style={S.screen}>
      <GlassBackground />
      <AxScreenHeader title="Notifications" />

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: tabSpace }]}>
        {/* Interrupteur maître */}
        <AxCard style={S.section} testID="notif-section-master">
          <View style={S.row}>
            <View style={S.rowLeft}>
              {master ? <Bell color={theme.ax.accentText} size={18} /> : <BellOff color={theme.ax.textMuted} size={18} />}
              <View style={{ flex: 1 }}>
                <Text style={S.rowLabel}>{t('notifSettings.allLabel')}</Text>
                <Text style={S.rowSub}>
                  {master ? t('notifSettings.allOnSub') : t('notifSettings.allOffSub')}
                </Text>
              </View>
            </View>
            {saving === 'notifications_enabled' ? (
              <ActivityIndicator size="small" color={theme.ax.accentText} style={S.pending} />
            ) : (
              <AxSwitch
                value={master}
                disabled={saving !== null}
                onValueChange={v => update('notifications_enabled', v)}
                accessibilityLabel={t('notifSettings.allLabel')}
                testID="notif-switch-notifications_enabled"
              />
            )}
          </View>
        </AxCard>

        {/* Rappel quotidien + son heure */}
        <AxCard style={S.section} testID="notif-section-reminder">
          <Text style={S.sectionTitle}>{t('notifSettings.dailyTitle')}</Text>
          <View style={S.row}>
            <View style={S.rowLeft}>
              <Bell color={master ? theme.ax.accentText : theme.ax.textMuted} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={[S.rowLabel, !master && S.rowLabelOff]}>{t('notifSettings.dailyLabel')}</Text>
                <Text style={S.rowSub}>{t('notifSettings.dailySub')}</Text>
              </View>
            </View>
            {saving === 'daily_reminder' ? (
              <ActivityIndicator size="small" color={theme.ax.accentText} style={S.pending} />
            ) : (
              <AxSwitch
                value={prefs.daily_reminder && master}
                disabled={!master || saving !== null}
                onValueChange={v => update('daily_reminder', v)}
                accessibilityLabel={t('notifSettings.dailyLabel')}
                testID="notif-switch-daily_reminder"
              />
            )}
          </View>

          {prefs.daily_reminder && master && (
            <View style={S.hourSection}>
              <View style={S.rowLeft}>
                <Clock color={theme.ax.textMuted} size={16} />
                <Text style={S.rowLabel}>{t('notifSettings.hourLabel')}</Text>
                {saving === 'reminder_hour' && (
                  <ActivityIndicator size="small" color={theme.ax.accentText} />
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.hourScroll} contentContainerStyle={S.hourRow}>
                {HOURS.map(h => (
                  <AxChip
                    key={h}
                    label={`${String(h).padStart(2, '0')}:00`}
                    selected={prefs.reminder_hour === h}
                    onPress={() => update('reminder_hour', h)}
                    disabled={saving !== null}
                    testID={`notif-hour-${h}`}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </AxCard>

        {GROUPS.map(g => (
          <AxCard style={S.section} key={g.id} testID={`notif-group-${g.id}`}>
            <Text style={S.sectionTitle}>{t(`notifSettings.groups.${g.id}`)}</Text>
            {g.toggles.map(renderToggle)}
          </AxCard>
        ))}

        {/* Bouton de test et son résultat */}
        <View style={S.testBlock}>
          <AxButton label={t('notifSettings.testButton')} icon={Bell} onPress={testPush} disabled={test === 'busy'} fullWidth testID="notif-test-push" />
          {test === 'ready' && (
            <Text style={[S.testMsg, { color: theme.ax.success }]} testID="notif-test-ready">
              {t('notifSettings.testReady')}
            </Text>
          )}
          {test === 'denied' && (
            <View testID="notif-test-denied">
              <Text style={[S.testMsg, { color: theme.ax.warning }]}>{t('notifSettings.testDenied')}</Text>
              <Text
                style={S.testLink}
                onPress={() => Linking.openSettings()}
                accessibilityRole="link"
                testID="notif-test-open-settings"
              >
                {t('notifSettings.openSettings')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(t: AppTheme) {
  const c = t.ax;
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: axSpacing.lg, gap: axSpacing.xl, paddingBottom: 140 },
  section: { gap: 14 },
  sectionTitle: { ...axTypography.overline, color: c.textMuted },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: axSpacing.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  rowLabel: { ...axTypography.label, color: c.text, flexShrink: 1 },
  rowLabelOff: { color: c.textMuted },
  rowSub: { ...axTypography.bodySmall, color: c.textMuted, marginTop: 1 },
  hourSection: { gap: 8 },
  hourScroll: { flexGrow: 0, flexShrink: 0, marginTop: 4 },
  hourRow: { gap: 6, paddingVertical: 2 },
  pending: { width: 44, alignItems: 'flex-end' },
  testBlock: { gap: axSpacing.sm },
  testMsg: { ...axTypography.bodySmall, textAlign: 'center' },
  testLink: { ...axTypography.label, color: c.accentText, textAlign: 'center', paddingVertical: axSpacing.sm },
}); }
