import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton } from '../../components/ax/AxButton';
import { AxCard } from '../../components/ax/AxCard';
import { AxTextField } from '../../components/ax/AxTextField';
import { translateAuthError } from '../../lib/authErrorMessage';
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
  const [error,   setError]   = useState<string | undefined>();

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleReset() {
    const trimmed = email.trim();
    if (!trimmed) { setError(t('forgot.enterEmail')); return; }
    if (!EMAIL_REGEX.test(trimmed)) { setError(t('forgot.invalidEmail')); return; }
    setError(undefined);
    setLoading(true);
    const { error: sendError } = await resetPassword(trimmed);
    setLoading(false);
    // Rien ne dit si le compte existe : sans erreur d'envoi, l'écran du code
    // s'ouvre toujours. Une erreur (réseau, trop d'envois) reste sous le champ.
    if (sendError) setError(translateAuthError(t, sendError));
    else navigation.navigate('ResetPasswordCode', { email: trimmed });
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
                placeholder={t('auth.emailPlaceholder')}
                accessibilityLabel={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                error={error}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus
              />
            </View>

            <AxButton testID="forgot-submit" label={t('forgot.getCode')} onPress={handleReset} loading={loading} fullWidth />
          </AxCard>

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
    inputContainer: { gap: axSpacing.xs },
    label: { ...axTypography.labelSmall, color: c.textMuted },
  });
}
