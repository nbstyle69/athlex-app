import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarCheck, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AxButton, AxCard, AxScreenHeader, AxTag } from '../../components/ax';
import GlassBackground from '../../components/glass/GlassBackground';
import { useTheme } from '../../context/ThemeContext';
import type { HomeStackParamList } from '../../navigation';
import { useTabBarScrollSpace } from '../../navigation/tabBarLayout';
import { changeMembershipPlan, monthlyPrice } from '../../services/membership';
import { axRadius, axSpacing, axTypography } from '../../theme/axTokens';
import { longDate, shortDate, styles as base } from './MyMembershipScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'ChangeMembershipPlan'>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Choix d'une formule : date d'effet en ligne, demande à la box au comptoir. */
export default function ChangeMembershipPlanScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.ax;
  const tabSpace = useTabBarScrollSpace();
  const o = route.params.overview;
  const counter = o.mode === 'counter';
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = o.available_plans.find(p => p.id === selected) ?? null;

  async function submit() {
    if (!plan) return;
    setSending(true);
    setError(null);
    const r = await changeMembershipPlan(plan.id);
    setSending(false);
    if (r.ok) navigation.goBack();
    else setError(r.message);
  }

  let recap: { title: string; body: string } | null = null;
  if (plan && counter) {
    recap = { title: t('membership.choose.counterTitle'), body: t('membership.choose.counterBody') };
  } else if (plan && o.next_billing_at) {
    const at = o.next_billing_at;
    recap = {
      title: t('membership.choose.fromDate', { date: longDate(at) }),
      // « 31 oct. » finit une phrase : un seul point.
      body: t('membership.choose.onlineBody', {
        current: o.plan?.name ?? '',
        until: shortDate(new Date(at).getTime() - DAY_MS),
        plan: plan.name,
        price: monthlyPrice(plan.price_cents),
        date: shortDate(at),
      }).replace(/\.\./g, '.'),
    };
  } else if (plan) {
    recap = { title: t('membership.choose.nextBillingTitle'), body: t('membership.choose.nextBillingBody', { plan: plan.name, price: monthlyPrice(plan.price_cents) }) };
  }

  const option = (id: string, name: string, cents: number | null, current: boolean) => {
    const on = selected === id;
    return (
      <AxCard
        key={id}
        testID={`plan-option-${id}`}
        onPress={current ? undefined : () => { setSelected(id); setError(null); }}
        accessibilityLabel={name}
        style={[styles.option, on && { borderWidth: 2, borderColor: c.accent, padding: axSpacing.lg - 1 }]}
      >
        <View style={[styles.radio, { borderColor: on ? c.accent : c.textMuted }]}>
          {on && <View testID={`plan-option-${id}-on`} style={[styles.radioDot, { backgroundColor: c.accent }]} />}
        </View>
        <View style={styles.optionText}>
          <Text style={[axTypography.label, { color: c.text }]}>{name}</Text>
          {current && <AxTag tone="muted" label={t('membership.choose.currentTag')} testID="plan-option-current" />}
        </View>
        {cents != null && (
          <Text style={[axTypography.label, { color: on ? c.accentText : c.text }]}>{monthlyPrice(cents)}</Text>
        )}
      </AxCard>
    );
  };

  return (
    <View style={[base.screen, { backgroundColor: c.background }]}>
      <GlassBackground />
      <AxScreenHeader title={t('membership.choose.title')} testID="change-plan-header" />
      <ScrollView contentContainerStyle={[base.content, { paddingBottom: tabSpace }]} testID="change-plan-scroll">
        {!!o.box.name && (
          <Text testID="change-plan-subtitle" style={[axTypography.caption, base.centered, { color: c.textMuted }]}>
            {t('membership.choose.subtitle', { box: o.box.name })}
          </Text>
        )}
        {o.plan && option(o.plan.id, o.plan.name, o.price_cents, true)}
        {o.available_plans.length === 0 ? (
          <Text testID="change-plan-empty" style={[axTypography.bodySmall, base.centered, { color: c.textMuted }]}>{t('membership.noOtherPlan')}</Text>
        ) : o.available_plans.map(p => option(p.id, p.name, p.price_cents, false))}
        {recap && (
          <View testID="change-plan-recap" style={[styles.recap, { backgroundColor: c.background, borderColor: c.border }]}>
            <View style={base.encartHead}>
              <CalendarCheck size={16} color={c.accentText} strokeWidth={2} />
              <Text style={[axTypography.label, { color: c.text }]}>{recap.title}</Text>
            </View>
            <Text style={[axTypography.bodySmall, { color: c.textMuted }]}>{recap.body}</Text>
          </View>
        )}
        {o.available_plans.length > 0 && (
          <AxButton
            testID="change-plan-submit"
            icon={counter ? Send : undefined}
            label={t(counter ? 'membership.choose.send' : 'membership.choose.confirm')}
            onPress={submit}
            disabled={!plan}
            loading={sending}
            fullWidth
          />
        )}
        {error && <Text testID="change-plan-error" style={[axTypography.caption, { color: c.danger }]}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: axSpacing.md, padding: axSpacing.lg },
  optionText: { flex: 1, gap: axSpacing.xs },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  recap: { borderWidth: 1, borderRadius: axRadius.card, padding: axSpacing.lg, gap: 6 },
});
