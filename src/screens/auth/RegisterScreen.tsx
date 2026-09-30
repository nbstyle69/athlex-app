import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Linking,
} from 'react-native';
import { ChevronLeft, Eye, EyeOff, Mail, Lock, AtSign, User, UserRound } from 'lucide-react-native';
import GlassBackground from '../../components/glass/GlassBackground';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { AuthStackParamList } from '../../navigation';
import { Gender } from '../../types';
import { AxButton } from '../../components/ax/AxButton';
import { AxCard } from '../../components/ax/AxCard';
import { AxCheckbox } from '../../components/ax/AxCheckbox';
import { AxTextField } from '../../components/ax/AxTextField';
import { withAlpha } from '../../components/ax/color';
import { axRadius, axSpacing, axTypography, type AxColors } from '../../theme/axTokens';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { OWNER_ONBOARDING_URL } from '../../lib/urls';
import { translateAuthError } from '../../lib/authErrorMessage';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const { theme } = useTheme();
  const c = theme.ax;
  const S = createStyles(c);
  const dialog = useConfirmDialog();
  const [email,       setEmail]       = useState('');
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [gender,      setGender]      = useState<Gender>('male');
  const [loading,     setLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedCGU, setAcceptedCGU] = useState(false);

  async function handleRegister() {
    if (!email || !password || !username) { Alert.alert(t('common.error'), t('auth.fillAllFields')); return; }
    if (password.length < 6) { Alert.alert(t('common.error'), t('auth.passwordTooShort')); return; }
    if (!acceptedCGU) { Alert.alert(t('auth.cguRequiredTitle'), t('auth.cguRequiredBody')); return; }
    setLoading(true);
    const requestedUsername = username.trim();
    const { error, finalUsername } = await signUp(email.trim(), password, requestedUsername, 'inter', gender);
    setLoading(false);

    // Inform the user if their pseudo was auto-suffixed because the requested one was taken
    const pseudoChanged = !!finalUsername && finalUsername !== requestedUsername;
    const pseudoNotice = pseudoChanged
      ? `\n\nLe pseudo « ${requestedUsername} » était déjà pris, le tien est devenu « ${finalUsername} ». Tu peux le changer plus tard dans ton profil.`
      : '';

    if (error === 'CONFIRM_EMAIL') {
      dialog.show(
        'Confirme ton email',
        `Un lien de confirmation a été envoyé à ${email.trim()}.\n\nClique sur le lien dans l'email pour activer ton compte, puis connecte-toi.${pseudoNotice}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
        { icon: Mail },
      );
    } else if (error) {
      Alert.alert(t('auth.registerFailed'), translateAuthError(t, error));
    } else if (pseudoChanged) {
      Alert.alert('Pseudo modifié', `Le pseudo « ${requestedUsername} » était déjà pris, le tien est devenu « ${finalUsername} ». Tu peux le changer plus tard dans ton profil.`);
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

          <View style={S.logoContainer}>
            <Image
              source={require('../../../assets/athex-logo.png')}
              style={S.logo}
              testID="entry-logo"
              accessibilityLabel="AthleX"
            />
          </View>

          <AxCard style={S.form}>
            <Text style={S.title}>{t('auth.registerTitle')}</Text>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('auth.username')}</Text>
              <AxTextField
                testID="register-username"
                icon={AtSign}
                placeholder="TonPseudo"
                accessibilityLabel={t('auth.username')}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
              />
            </View>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('auth.email')}</Text>
              <AxTextField
                testID="register-email"
                icon={Mail}
                placeholder="ton@email.com"
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
                testID="register-password"
                icon={Lock}
                placeholder="••••••••"
                accessibilityLabel={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                trailing={(
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword
                      ? <EyeOff color={c.textMuted} size={20} />
                      : <Eye color={c.textMuted} size={20} />}
                  </TouchableOpacity>
                )}
              />
            </View>

            <View style={S.inputContainer}>
              <Text style={S.label}>{t('auth.gender')}</Text>
              <View style={S.roleRow}>
                <TouchableOpacity
                  testID="register-gender-male"
                  style={[S.roleCard, gender === 'male' && S.roleCardActive]}
                  onPress={() => setGender('male')}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === 'male' }}
                >
                  <User color={gender === 'male' ? c.accentText : c.textMuted} size={22} strokeWidth={2} />
                  <Text style={[S.roleLabel, gender === 'male' && S.roleLabelActive]}>{t('auth.male')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="register-gender-female"
                  style={[S.roleCard, gender === 'female' && S.roleCardActive]}
                  onPress={() => setGender('female')}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === 'female' }}
                >
                  <UserRound color={gender === 'female' ? c.accentText : c.textMuted} size={22} strokeWidth={2} />
                  <Text style={[S.roleLabel, gender === 'female' && S.roleLabelActive]}>{t('auth.female')}</Text>
                </TouchableOpacity>
              </View>
            </View>


            <View style={S.cguRow}>
              <AxCheckbox
                testID="register-cgu"
                checked={acceptedCGU}
                onChange={() => setAcceptedCGU(!acceptedCGU)}
                accessibilityLabel={acceptedCGU ? 'Décocher les CGU' : 'Accepter les CGU'}
              />
              <Text style={S.cguText}>
                {t('auth.acceptPrefix')}{' '}
                <Text style={S.cguLink} onPress={() => navigation.navigate('Legal' as never)}>{t('auth.cguLink')}</Text>
              </Text>
            </View>

            <AxButton
              testID="register-submit"
              label={t('auth.joinBattle')}
              accessibilityLabel="Créer un compte"
              onPress={handleRegister}
              loading={loading}
              disabled={!acceptedCGU}
              fullWidth
            />

            <TouchableOpacity
              style={S.ownerRow}
              onPress={() => Linking.openURL(OWNER_ONBOARDING_URL)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Créer un compte gérant de box sur athlexapp.eu"
            >
              <Text style={S.ownerText}>
                {t('auth.ownerPrompt')}{' '}
                <Text style={S.ownerLink}>{t('auth.ownerLink')}</Text>
              </Text>
            </TouchableOpacity>
          </AxCard>
        </ScrollView>
      </KeyboardAvoidingView>
      {dialog.element}
    </View>
  );
}

function createStyles(c: AxColors) {
  return StyleSheet.create({
    gradient: { flex: 1, backgroundColor: 'transparent' },
    flex: { flex: 1 },
    container: { flexGrow: 1, padding: axSpacing.xl, paddingTop: 48 },
    back: { flexDirection: 'row', alignItems: 'center', marginBottom: axSpacing.lg },
    backText: { ...axTypography.labelSmall, color: c.textMuted },
    logoContainer: { alignItems: 'center', marginBottom: axSpacing.xl },
    logo: { width: 120, height: 120, resizeMode: 'contain' },
    form: { gap: axSpacing.md },
    title: { ...axTypography.titleM, color: c.text },
    inputContainer: { gap: axSpacing.xs },
    label: { ...axTypography.labelSmall, color: c.textMuted },
    roleRow: { flexDirection: 'row', gap: axSpacing.sm },
    roleCard: {
      flex: 1,
      padding: axSpacing.md,
      borderRadius: axRadius.control,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      backgroundColor: c.field,
      alignItems: 'center',
      gap: axSpacing.xs,
    },
    roleCardActive: { borderColor: c.accentText, backgroundColor: withAlpha(c.accent, 0.12) },
    roleLabel: { ...axTypography.labelSmall, color: c.textMuted, textAlign: 'center' },
    roleLabelActive: { color: c.accentText },
    ownerRow: { alignItems: 'center' },
    ownerText: { ...axTypography.bodySmall, color: c.textMuted, textAlign: 'center' },
    ownerLink: { ...axTypography.labelSmall, color: c.accentText, textDecorationLine: 'underline' },
    cguRow: { flexDirection: 'row', alignItems: 'flex-start', gap: axSpacing.sm },
    cguText: { flex: 1, ...axTypography.bodySmall, color: c.textMuted },
    cguLink: { ...axTypography.labelSmall, color: c.accentText, textDecorationLine: 'underline' },
  });
}
