import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Crown, AlertTriangle, Clock, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, AppTheme } from '../context/ThemeContext';
import { SubscriptionStatus } from '../types';

interface Props {
  daysLeft: number;
  status: SubscriptionStatus;
  isEarlyAdopter?: boolean;
  onUpgrade: () => void;
}

export default function TrialBanner({ daysLeft, status, isEarlyAdopter, onUpgrade }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (status === 'active') {
    return (
      <View style={[styles.container, { backgroundColor: `${theme.success}12`, borderColor: `${theme.success}30` }]}>
        <Crown color={theme.success} size={18} />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: theme.success }]}>{t('bo.subscription.statusActive')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('bo.trialBanner.activeSub')}</Text>
        </View>
      </View>
    );
  }

  if (status === 'past_due') {
    return (
      <TouchableOpacity
        style={[styles.container, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}
        onPress={onUpgrade}
        activeOpacity={0.8}
      >
        <AlertTriangle color={theme.error} size={18} />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: theme.error }]}>{t('bo.trialBanner.pastDueTitle')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('bo.trialBanner.pastDueSub')}</Text>
        </View>
        <Text style={[styles.cta, { color: theme.error }]}>{t('bo.trialBanner.manageCta')}</Text>
      </TouchableOpacity>
    );
  }

  if (status === 'canceled' || status === 'expired' || daysLeft <= 0) {
    return (
      <TouchableOpacity
        style={[styles.container, { backgroundColor: `${theme.error}12`, borderColor: `${theme.error}30` }]}
        onPress={onUpgrade}
        activeOpacity={0.8}
      >
        <AlertTriangle color={theme.error} size={18} />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: theme.error }]}>{t('bo.subscription.statusExpired')}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('bo.trialBanner.expiredSub')}</Text>
        </View>
        <Text style={[styles.cta, { color: theme.error }]}>{t('bo.trialBanner.subscribeCta')}</Text>
      </TouchableOpacity>
    );
  }

  // Trial active
  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7;
  const color = isUrgent ? theme.error : isWarning ? '#f59e0b' : theme.accent;
  const bgColor = isUrgent ? `${theme.error}12` : isWarning ? '#f59e0b12' : `${theme.accent}08`;
  const borderColor = isUrgent ? `${theme.error}30` : isWarning ? '#f59e0b30' : `${theme.accent}20`;
  const Icon = isUrgent ? AlertTriangle : isWarning ? Clock : Zap;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: bgColor, borderColor }]}
      onPress={onUpgrade}
      activeOpacity={0.8}
    >
      <Icon color={color} size={18} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color }]}>
          {isEarlyAdopter ? `🏅 ${t('bo.trialBanner.founder')} · ` : ''}{t('bo.trialBanner.trialTitle', { days: daysLeft })}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isUrgent ? t('bo.trialBanner.urgentSub') : t('bo.trialBanner.daysLeft', { count: daysLeft })}
        </Text>
      </View>
      <Text style={[styles.cta, { color }]}>{t('bo.trialBanner.seeCta')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '800' },
  subtitle: { fontSize: 11, lineHeight: 15 },
  cta: { fontSize: 12, fontWeight: '800' },
});
