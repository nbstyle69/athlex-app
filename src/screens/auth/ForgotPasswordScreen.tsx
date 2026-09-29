import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { ChevronLeft, Mail, CheckCircle } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton } from '../../components/ax/AxButton';
import { AxCard } from '../../components/ax/AxCard';
import { AxTextField } from '../../components/ax/AxTextField';
import { axSpacing, axTypography, type AxColors } from '../../theme/axTokens';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'> };

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);

  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleReset() {
    const trimmed = email.trim();
    if (!trimmed) { Alert.alert(t('common.error'), t('forgot.enterEmail')); return; }
    if (!EMAIL_REGEX.test(trimmed)) { Alert.alert(t('common.error'), t('forgot.invalidEmail')); return; }
    setLoading(true);
    const { error } = await resetPassword(trimmed);
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), error);
    } else {
      setSent(true);
    }
  }

  return (
    <View style={S.gradient}>
      <GlassBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.flex}>
        <ScrollView contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">

          <TouchableOpacity onPress={() => navigation.goBack()} style={S.back}>
            <ChevronLeft color={c.textMuted} size={24} />
            <Text style={S.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          {sent ? (
            <AxCard style={S.form}>
              <View style={S.iconRow}>
                <CheckCircle color={c.accentText} size={52} strokeWidth={1.5} />
              </View>
              <Text style={S.title}>{t('forgot.sentTitle')}</Text>
              <Text style={S.subtitle}>
                {t('forgot.sentSubtitle')}{'\n'}
                <Text style={S.emailHighlight}>{email.trim()}</Text>
              </Text>
              <Text style={S.hint}>
                {t('forgot.sentHint')}
              </Text>
              <AxButton testID="forgot-back-to-login" label={t('forgot.backToLogin')} onPress={() => navigation.navigate('Login')} fullWidth />
            </AxCard>
          ) : (
            <AxCard style={S.form}>
              <View style={S.iconRow}>
                <Mail color={c.accentText} size={36} strokeWidth={1.5} />
              </View>
              <Text style={S.title}>{t('forgot.title')}</Text>
              <Text style={S.subtitle}>
                {t('forgot.subtitle')}
              </Text>

              <View style={S.inputContainer}>
                <Text style={S.label}>{t('auth.email')}</Text>
                <AxTextField
                  testID="forgot-email"
                  icon={Mail}
                  placeholder="ton@email.com"
                  accessibilityLabel={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  autoFocus
                />
              </View>

              <AxButton testID="forgot-submit" label={t('forgot.sendLink')} onPress={handleReset} loading={loading} fullWidth />
            </AxCard>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(c: AxColors) {
  return StyleSheet.create({
    gradient: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1 },
    container: { flexGrow: 1, justifyContent: 'center', padding: axSpacing.xl },
    back: { flexDirection: 'row', alignItems: 'center', marginBottom: axSpacing.xl },
    backText: { ...axTypography.labelSmall, color: c.textMuted },
    form: { gap: axSpacing.md },
    iconRow: { alignItems: 'center' },
    title: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    subtitle: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    emailHighlight: { ...axTypography.labelSmall, color: c.accentText },
    hint: { ...axTypography.caption, color: c.textMuted, textAlign: 'center' },
    inputContainer: { gap: axSpacing.xs },
    label: { ...axTypography.labelSmall, color: c.textMuted },
  });
}
