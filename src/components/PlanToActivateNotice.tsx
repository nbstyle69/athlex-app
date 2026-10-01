import React from 'react';
import { Linking } from 'react-native';
import { Clock, CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AxNotice } from './ax';
import { needsPlan, planActivationUrl, type MyPlanStatus } from '../services/membership';

interface Props {
  status: MyPlanStatus | null | undefined;
  box: { name: string; slug?: string | null };
  testID: string;
}

/**
 * Bandeau « Formule à activer » (maquettes 68:671 et 68:1321) : rien si la base
 * accepterait une réservation ou si l'adhésion est suspendue. Sans formule
 * vendue en ligne, pas de bouton : seul « Tu paies au comptoir ? » reste.
 */
export default function PlanToActivateNotice({ status, box, testID }: Props) {
  const { t } = useTranslation();
  if (!needsPlan(status)) return null;
  const url = planActivationUrl(status, box.slug);
  return (
    <AxNotice
      testID={testID}
      icon={Clock}
      title={t('plan.bannerTitle')}
      body={t('plan.bannerBody', { box: box.name })}
      action={url ? { label: t('plan.activateCta'), icon: CreditCard, onPress: () => Linking.openURL(url), testID: `${testID}-cta` } : undefined}
      footer={t('plan.counterHint')}
    />
  );
}
