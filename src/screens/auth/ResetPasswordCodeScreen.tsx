import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { ChevronLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPasswordCode'>;

/** Délai avant de pouvoir redemander un code, en secondes. */
export const RESEND_DELAY = 60;

export default function ResetPasswordCodeScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { resetPassword, resetPasswordWithCode } = useAuth();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  const { email } = route.params;

  const [code,     setCode]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [left,     setLeft]     = useState(RESEND_DELAY);
  const [codeError,     setCodeError]     = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError,  setConfirmError]  = useState<string | undefined>();
  const [error,         setError]         = useState<string | undefined>();

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function handleSubmit() {
    const codeErr = code.length !== 6 ? t('forgot.codeIncomplete') : undefined;
    const passwordErr = password.length < 6 ? t('forgot.passwordTooShort') : undefined;
    const confirmErr = !passwordErr && confirm !== password ? t('forgot.passwordMismatch') : undefined;
    setCodeError(codeErr); setPasswordError(passwordErr); setConfirmError(confirmErr); setError(undefined);
    if (codeErr || passwordErr || confirmErr) return;
    setLoading(true);
    const result = await resetPasswordWithCode(email, code, password);
    // Succès : la session s'ouvre et la navigation quitte d'elle-même la pile d'authentification.
    if (!result.error) return;
    setLoading(false);
    if (result.network) setError(translateAuthError(t, result.error));
    else if (result.step === 'code') { setCodeError(t('forgot.codeInvalid')); setLeft(0); }
    else setPasswordError(translateAuthError(t, result.error));
  }

  async function handleResend() {
    setError(undefined);
    const { error: sendError } = await resetPassword(email);
    if (sendError) { setError(translateAuthError(t, sendError)); return; }
    setCodeError(undefined);
    setLeft(RESEND_DELAY);
  }

  const eye = (shown: boolean, toggle: () => void) => (
    <TouchableOpacity
      onPress={toggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
    >
      {shown ? <EyeOff color={c.textMuted} size={20} /> : <Eye color={c.textMuted} size={20} />}
    </TouchableOpacity>
  );

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
              <ShieldCheck color={c.accentText} size={36} strokeWidth={1.5} />
            </View>
            <Text style={S.title}>{t('forgot.codeTitle')}</Text>
            <Text style={S.subtitle}>{t('forgot.codeSent')}</Text>
            <Text style={S.email}>{email}</Text>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('forgot.codeLabel')}</Text>
              <AxTextField
                testID="reset-code"
                placeholder="000000"
                accessibilityLabel={t('forgot.codeLabel')}
                value={code}
                // Collage accepté : « 482 913 » ou un texte autour du code ne garde que les chiffres.
                onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
                error={codeError}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                autoFocus
                inputStyle={S.code}
              />
            </View>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('forgot.newPassword')}</Text>
              <AxTextField
                testID="reset-password"
                placeholder="••••••••"
                accessibilityLabel={t('forgot.newPassword')}
                value={password}
                onChangeText={setPassword}
                error={passwordError}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                trailing={eye(showPassword, () => setShowPassword(!showPassword))}
              />
            </View>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('forgot.confirmPassword')}</Text>
              <AxTextField
                testID="reset-confirm"
                placeholder="••••••••"
                accessibilityLabel={t('forgot.confirmPassword')}
                value={confirm}
                onChangeText={setConfirm}
                error={confirmError}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                trailing={eye(showConfirm, () => setShowConfirm(!showConfirm))}
              />
            </View>

            <Text style={S.hint}>{t('forgot.passwordHint')}</Text>
            {!!error && <Text testID="reset-error" style={S.error}>{error}</Text>}

            <AxButton testID="reset-submit" label={t('forgot.changePassword')} onPress={handleSubmit} loading={loading} fullWidth />

            <TouchableOpacity
              testID="reset-resend"
              onPress={handleResend}
              disabled={left > 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: left > 0 }}
              style={S.resendRow}
            >
              <Text style={[S.resend, left > 0 && S.resendWaiting]}>
                {left > 0 ? t('forgot.resendIn', { s: left }) : t('forgot.resend')}
              </Text>
            </TouchableOpacity>
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
    // Calé en haut comme la maquette : le clavier ne fait pas sauter la carte.
    container: { flexGrow: 1, padding: axSpacing.xl, paddingTop: 48 },
    back: { flexDirection: 'row', alignItems: 'center', marginBottom: axSpacing.xl },
    backText: { ...axTypography.labelSmall, color: c.textMuted },
    form: { gap: axSpacing.md },
    iconRow: { alignItems: 'center' },
    title: { ...axTypography.titleM, color: c.text, textAlign: 'center' },
    subtitle: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    email: { ...axTypography.labelSmall, color: c.accentText, textAlign: 'center' },
    inputContainer: { gap: axSpacing.xs },
    label: { ...axTypography.labelSmall, color: c.textMuted },
    code: { letterSpacing: 4 },
    hint: { ...axTypography.caption, color: c.textMuted },
    error: { ...axTypography.caption, color: c.danger },
    resendRow: { alignItems: 'center' },
    resend: { ...axTypography.labelSmall, color: c.accentText },
    resendWaiting: { color: c.textMuted },
  });
}
