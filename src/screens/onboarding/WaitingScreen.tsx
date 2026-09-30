import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Hash, Building2, LogOut, ArrowRight, Dumbbell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AxButton } from '../../components/ax/AxButton';
import { axAccentSafeLineHeight, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import GlassBackground from '../../components/glass/GlassBackground';
import { OWNER_ONBOARDING_URL } from '../../lib/urls';

export default function WaitingScreen({ navigation }: any) {
  const { user, signOut, skipBox } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);

  return (
    <View style={S.container}>
      <GlassBackground />
      <View style={S.inner}>
        <Dumbbell testID="waiting-icon" color={c.accentText} size={48} strokeWidth={1.5} />
        <Text style={S.title}>{t('onboarding.waiting.title')}</Text>
        <Text style={S.subtitle}>
          {t('onboarding.waiting.subtitle', { username: user?.username ?? t('onboarding.athleteFallback') })}
        </Text>

        <View style={S.actions}>
          <AxButton
            testID="waiting-have-code"
            label={t('onboarding.waiting.haveCode')}
            icon={Hash}
            onPress={() => navigation.navigate('JoinBox')}
            fullWidth
          />

          <AxButton
            testID="waiting-owner"
            variant="outline"
            label={t('onboarding.waiting.ownerCta')}
            icon={Building2}
            onPress={() => Linking.openURL(OWNER_ONBOARDING_URL)}
            fullWidth
          />

          <TouchableOpacity
            testID="waiting-no-code"
            style={S.skipBtn}
            onPress={skipBox}
            activeOpacity={0.7}
          >
            <Text style={S.skipBtnText}>{t('onboarding.waiting.noCode')}</Text>
            <ArrowRight color={c.accentText} size={14} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity testID="waiting-sign-out" style={S.signOutBtn} onPress={signOut} activeOpacity={0.7}>
        <LogOut color={c.textMuted} size={16} />
        <Text style={S.signOutText}>{t('onboarding.waiting.signOut')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  inner: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: axSpacing['2xl'], gap: axSpacing.lg,
  },
  title: { ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text, textAlign: 'center' },
  subtitle: { ...axTypography.body, color: c.textMuted, textAlign: 'center' },
  actions: { width: '100%', gap: axSpacing.md, marginTop: axSpacing.sm },
  skipBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  skipBtnText: { ...axTypography.labelSmall, color: c.accentText, flexShrink: 1, textAlign: 'center' },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', paddingBottom: 48,
  },
  signOutText: { ...axTypography.labelSmall, color: c.textMuted, flexShrink: 1 },
}); }
