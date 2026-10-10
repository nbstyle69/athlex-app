import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { ChevronLeft, Hash, LogIn } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AxButton } from '../../components/ax/AxButton';
import { AxTextField } from '../../components/ax/AxTextField';
import { withAlpha } from '../../components/ax/color';
import { axAccentSafeLineHeight, axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import GlassBackground from '../../components/glass/GlassBackground';

export default function JoinBoxScreen({ navigation }: any) {
  const { joinBox, user } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (code.trim().length !== 6) {
      Alert.alert(t('onboarding.invalidCode'), t('onboarding.invalidCodeMsg'));
      return;
    }
    setLoading(true);
    const { error } = await joinBox(code.trim().toUpperCase());
    setLoading(false);
    if (error) Alert.alert(t('common.error'), error);
    // Navigation handled by AppNavigator reacting to currentBox change
  }

  return (
    <View style={S.container}>
    <GlassBackground />
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={S.back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
        <ChevronLeft color={c.textMuted} size={22} />
      </TouchableOpacity>

      <View style={S.inner}>
        <View style={S.iconWrap}>
          <Hash color={c.accentText} size={32} />
        </View>
        <Text style={S.title}>{t('onboarding.join.title')}</Text>
        <Text style={S.subtitle}>
          {t('onboarding.join.subtitle')}
        </Text>

        <AxTextField
          testID="join-code"
          placeholder={t('onboarding.codePlaceholder')}
          value={code}
          onChangeText={v => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
        />

        <AxButton
          testID="join-submit"
          label={t('onboarding.join.button')}
          icon={LogIn}
          onPress={handleJoin}
          loading={loading}
          disabled={code.length !== 6}
          fullWidth
        />

        <Text style={S.hint}>
          {t('onboarding.join.hint', { username: user?.username ?? '' })}
        </Text>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(c: AxColors) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  back: { paddingTop: 56, paddingLeft: axSpacing.xl, paddingBottom: axSpacing.sm, alignSelf: 'flex-start' },
  inner: { flex: 1, paddingHorizontal: axSpacing['2xl'], justifyContent: 'center', gap: axSpacing.lg, marginTop: -60 },
  iconWrap: {
    width: 64, height: 64, borderRadius: axRadius.control,
    backgroundColor: withAlpha(c.accent, 0.12),
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center',
  },
  title: { ...axTypography.titleXL, lineHeight: axAccentSafeLineHeight.titleXL, color: c.text, textAlign: 'center' },
  subtitle: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
  hint: { ...axTypography.caption, color: c.textMuted, textAlign: 'center' },
}); }
