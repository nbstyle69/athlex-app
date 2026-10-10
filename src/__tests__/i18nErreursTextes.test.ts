// Chantier anglais, PR erreurs et corrections : plus aucune erreur brute affichée hors
// errorMessage(), types de cours (valeur enregistrée inchangée, libellé traduit),
// corrections françaises validées par Nab, pluriels anglais et prix de la programmation.
import fs from 'fs';
import path from 'path';
import i18n from '../i18n';
import { CLASS_TYPES, classTitleLabel } from '../lib/classTypes';
import { programmingPrice } from '../utils/programmingPrice';

const SRC = path.join(__dirname, '..');
// Fichiers volontairement laissés en français (scripts/i18n/fichiers-exclus.json).
const EXCLUS: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SRC, '..', 'scripts/i18n/fichiers-exclus.json'), 'utf8'));
const walk = (d: string, out: string[] = []): string[] => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== '__tests__') walk(p, out); } else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
};

afterAll(async () => { await i18n.changeLanguage('fr'); });

describe('erreurs affichées : toujours par errorMessage()', () => {
  it('aucun Alert.alert ne montre un .message brut (hors fichiers exclus)', () => {
    const bruts: string[] = [];
    for (const f of walk(SRC)) {
      const rel = path.relative(path.join(SRC, '..'), f).replace(/\\/g, '/');
      if (EXCLUS[rel]) continue;
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // Admis : « x.message ? await errorMessage(x) : … » et les fonctions de refus (…Refusal(x.message)) qui traduisent.
        const rest = line.replace(/\w+\??\.message\s*\?\s*await errorMessage\(/g, '').replace(/\w+Refusal\([^)]*\)/g, '');
        if (/Alert\.alert\(/.test(line) && /\b\w+\??\.message\b/.test(rest)) {
          bruts.push(`${rel}:${i + 1}`);
        }
      });
    }
    expect(bruts).toEqual([]);
  });
});

describe('types de cours : valeur enregistrée inchangée, libellé traduit', () => {
  it('valeurs enregistrées identiques à celles de master', () => {
    expect(CLASS_TYPES).toEqual(['WOD', 'Haltérophilie', 'Cardio', 'Open Gym', 'Strength', 'Mobility', 'Kids', 'Teens', 'Autre']);
  });
  it('français', async () => {
    await i18n.changeLanguage('fr');
    expect(CLASS_TYPES.map(classTitleLabel)).toEqual(['WOD', 'Haltérophilie', 'Cardio', 'Open Gym', 'Musculation', 'Mobilité', 'Enfants', 'Ados', 'Autre']);
    expect(classTitleLabel('Sunrise Run')).toBe('Sunrise Run');
  });
  it('anglais', async () => {
    await i18n.changeLanguage('en');
    expect(CLASS_TYPES.map(classTitleLabel)).toEqual(['WOD', 'Weightlifting', 'Cardio', 'Open Gym', 'Strength', 'Mobility', 'Kids', 'Teens', 'Other']);
    expect(classTitleLabel('Sunrise Run')).toBe('Sunrise Run');
  });
});

describe('corrections françaises validées', () => {
  beforeAll(async () => { await i18n.changeLanguage('fr'); });
  it.each([
    ['bo.wods.labelBlock', undefined, 'BLOC'],
    ['bo.wods.labelRounds', undefined, 'ROUNDS'],
    ['programDetail.ongoingSchedule', { days: 3 }, 'En continu · 3j/sem'],
    ['bo.interComp.entrants', { count: 1 }, '1 inscrit'],
    ['bo.interComp.entrants', { count: 12 }, '12 inscrits'],
    // Le français de la limite de réservation garde sa forme de master (faute signalée).
    ['reservation.limitReachedBody', { count: 2, max: 2, used: 2 }, 'Tu as utilisé tes 2 séance(s) cette semaine (2/2). Contacte ton coach pour changer de contrat.'],
  ] as const)('%s %j', (key, opts, expected) => {
    expect(i18n.t(key, opts)).toBe(expected);
  });
  it('prix de la programmation inchangé en français', () => {
    expect(programmingPrice({ price_cents: 2900, currency: 'eur', billing: 'monthly' })).toBe('29€/mois');
    expect(programmingPrice({ price_cents: 150000, currency: 'eur', billing: 'once' })).toBe('1500€');
  });
});

describe('corrections anglaises', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });
  it('limite de réservation : « session » / « sessions » (1 et 12)', () => {
    expect(i18n.t('reservation.limitReachedBody', { count: 1, max: 1, used: 1 }))
      .toBe("You've used your 1 session this week (1/1). Contact your coach to change your plan.");
    expect(i18n.t('reservation.limitReachedBody', { count: 12, max: 12, used: 12 }))
      .toBe("You've used your 12 sessions this week (12/12). Contact your coach to change your plan.");
  });
  it('« Program », jamais « Programme », en anglais', () => {
    const flat = (o: Record<string, unknown>): string[] => Object.values(o).flatMap((v) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>) : [String(v)]));
    const en = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/locales/en.json'), 'utf8'));
    expect(flat(en).filter((v) => /\bprogrammes?\b/i.test(v))).toEqual([]);
    expect(i18n.t('bo.wods.labelMovements')).toBe('PROGRAM / MOVEMENTS');
  });
  it('clé inutilisée bo.notifications.sentMsg supprimée', () => {
    for (const lng of ['fr', 'en']) {
      const j = JSON.parse(fs.readFileSync(path.join(SRC, `i18n/locales/${lng}.json`), 'utf8'));
      expect(Object.keys(j.bo.notifications).filter((k) => k.startsWith('sentMsg'))).toEqual([]);
    }
  });
  it('prix de la programmation : « €29/month »', () => {
    expect(programmingPrice({ price_cents: 2900, currency: 'eur', billing: 'monthly' })).toBe('€29/month');
    expect(programmingPrice({ price_cents: 0, currency: 'eur', billing: 'once' })).toBe('€0');
  });
});
