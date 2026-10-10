import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../../navigation';
import GlassBackground from '../../components/glass/GlassBackground';
import { AxButton } from '../../components/ax/AxButton';
import { AxCard } from '../../components/ax/AxCard';
import { AxTextField } from '../../components/ax/AxTextField';
import { withAlpha } from '../../components/ax/color';
import { axAccentSafeLineHeight, axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { versionDisplay } from '../../lib/buildIdentity';
import { translateAuthError } from '../../lib/authErrorMessage';
import { isEmailNotConfirmed, resendConfirmationMail } from '../../lib/loginConfirmation';
import { supabase } from '../../lib/supabase';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signIn, profileError } = useAuth();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [showBuildIdentity, setShowBuildIdentity] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert(t('common.error'), t('auth.fillAllFields')); return; }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    setResendFeedback(null);
    if (!error) return;
    if (isEmailNotConfirmed(error)) {
      setUnconfirmedEmail(email.trim());
      return;
    }
    setUnconfirmedEmail(null);
    Alert.alert(t('auth.loginFailed'), translateAuthError(t, error));
  }

  async function handleResend() {
    if (!unconfirmedEmail || resending) return;
    setResending(true);
    const result = await resendConfirmationMail(supabase.auth, unconfirmedEmail);
    setResending(false);
    setResendFeedback(result.ok
      ? { ok: true, text: t('auth.resendSent', { email: result.email }) }
      : { ok: false, text: t(result.key, { seconds: result.seconds }) });
  }

  return (
    <View style={S.gradient}>
      <GlassBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.flex}>
        <ScrollView contentContainerStyle={S.container} keyboardShouldPersistTaps="handled">
          <View style={S.logoContainer}>
            <Image
              source={require('../../../assets/athex-logo.png')}
              style={S.logo}
              testID="entry-logo"
              accessibilityLabel="AthleX"
            />
            <Text style={S.tagline}>{t('auth.tagline')}</Text>
          </View>

          <AxCard style={S.form}>
            <Text style={S.title}>{t('auth.loginTitle')}</Text>

            {/* Session ouverte, profil illisible : sans ce bandeau, l'écran de
                connexion réapparaît comme si le mot de passe était faux. */}
            {profileError && (
              <View style={S.profileErrorBox}>
                <Text style={S.profileErrorText}>{t('auth.profileLoadFailed')}</Text>
                <Text style={S.profileErrorDetail}>{profileError}</Text>
              </View>
            )}

            {unconfirmedEmail && (
              <View style={S.confirmBox} accessibilityLabel={t('auth.confirmEmailFirst')}>
                <Text style={S.confirmTitle}>{t('auth.confirmEmailFirst')}</Text>
                <Text style={S.confirmHint}>{t('auth.confirmEmailHint', { email: unconfirmedEmail })}</Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resending}
                  style={S.resendButton}
                  accessibilityLabel={t('auth.resendMail')}
                  accessibilityRole="button"
                >
                  {resending
                    ? <ActivityIndicator color={c.text} size="small" />
                    : <Text style={S.resendText}>{t('auth.resendMail')}</Text>}
                </TouchableOpacity>
                {resendFeedback && (
                  <Text style={[S.confirmHint, resendFeedback.ok ? S.resendOk : S.resendKo]}>
                    {resendFeedback.text}
                  </Text>
                )}
              </View>
            )}

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('auth.email')}</Text>
              <AxTextField
                testID="login-email"
                icon={Mail}
                placeholder={t('auth.emailPlaceholder')}
                accessibilityLabel={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('auth.password')}</Text>
              <AxTextField
                testID="login-password"
                icon={Lock}
                placeholder="••••••••"
                accessibilityLabel={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                trailing={(
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword
                      ? <EyeOff color={c.textMuted} size={20} />
                      : <Eye color={c.textMuted} size={20} />}
                  </TouchableOpacity>
                )}
              />
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={S.forgotLink} accessibilityLabel={t('forgot.title')}>
              <Text style={S.forgotText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            <AxButton testID="login-submit" label={t('auth.login')} accessibilityLabel={t('auth.login')} onPress={handleLogin} loading={loading} fullWidth />

            <TouchableOpacity onPress={() => navigation.navigate('Register')} style={S.registerLink} accessibilityLabel={t('auth.registerTitle')} accessibilityRole="button">
              <Text style={S.registerText}>
                {t('auth.noAccount')} <Text style={S.registerHighlight}>{t('auth.registerTitle')}</Text>
              </Text>
            </TouchableOpacity>
          </AxCard>

          <Text
            style={S.buildIdentity}
            testID="login-version"
            accessibilityRole="button"
            accessibilityLabel={t('auth.versionA11y', { version: versionDisplay(showBuildIdentity) })}
            onPress={() => setShowBuildIdentity(v => !v)}
          >
            {versionDisplay(showBuildIdentity)}
          </Text>
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
    logoContainer: { alignItems: 'center', marginBottom: axSpacing['2xl'] },
    logo: { width: 120, height: 120, resizeMode: 'contain' },
    tagline: { ...axTypography.overline, color: c.textMuted, marginTop: axSpacing.xs, textAlign: 'center' },
    form: { gap: axSpacing.md },
    title: { ...axTypography.titleM, color: c.text },
    inputContainer: { gap: axSpacing.xs },
    label: { ...axTypography.labelSmall, color: c.textMuted },
    forgotLink: { alignSelf: 'flex-end', paddingVertical: axSpacing.xs },
    forgotText: { ...axTypography.labelSmall, color: c.accentText },
    registerLink: { alignItems: 'center', paddingVertical: axSpacing.sm },
    registerText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    registerHighlight: { ...axTypography.labelSmall, color: c.accentText },
    profileErrorBox: {
      backgroundColor: withAlpha(c.danger, 0.1),
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: axRadius.control,
      padding: axSpacing.md,
    },
    profileErrorText: { ...axTypography.bodySmall, color: c.text },
    profileErrorDetail: { ...axTypography.caption, color: c.textMuted, marginTop: axSpacing.xs },
    confirmBox: {
      backgroundColor: withAlpha(c.warning, 0.12),
      borderWidth: 1,
      borderColor: c.warning,
      borderRadius: axRadius.control,
      padding: axSpacing.md,
    },
    confirmTitle: { ...axTypography.label, color: c.text },
    confirmHint: { ...axTypography.caption, color: c.textMuted, marginTop: axSpacing.xs },
    resendButton: {
      alignSelf: 'flex-start',
      marginTop: axSpacing.sm,
      paddingVertical: axSpacing.xs,
      paddingHorizontal: axSpacing.md,
      borderRadius: axRadius.control,
      borderWidth: 1,
      borderColor: c.text,
    },
    resendText: { ...axTypography.labelSmall, color: c.text },
    resendOk: { color: c.text },
    resendKo: { color: c.danger },
    buildIdentity: { ...axTypography.caption, color: c.textMuted, textAlign: 'center', marginTop: axSpacing.lg },
  });
}
