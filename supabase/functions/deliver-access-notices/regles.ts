// Règles de deliver-access-notices, sans Deno ni réseau : testées par Jest
// (src/__tests__/deliverAccessNoticesRegles.test.ts), importées par index.ts qui
// leur fournit les accès à la base (clé serveur), à Expo et à Resend.
// File remplie par la migration 20270152 (box_member_access_notices) ; spec
// Figma « 🧪 Spec · Paiements au comptoir (P1) », §6.

export const KINDS = ['j7', 'j1', 'fin'] as const;
export type Kind = typeof KINDS[number];
export type Langue = 'fr' | 'en';

/** Une ligne de `box_member_access_notices` à envoyer. */
export type Ligne = {
  id: string;
  box_id: string;
  member_id: string;
  box_member_id: string;
  kind: Kind;
  /** Fin d'accès (AAAA-MM-JJ) à laquelle le message se rapporte. */
  access_until: string;
  created_at: string;
};
/** La ligne `box_members` relue au moment de l'envoi. */
export type EtatMembre = {
  role: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
  cash_access_until: string | null;
  subscription_status: string | null;
};
export type Box = { name: string; stripe_account_id: string | null; stripe_onboarding_complete: boolean | null };
export type Formule = { is_active: boolean | null; stripe_price_id: string | null };
export type Preferences = { notifications_enabled: boolean | null; box_announcements: boolean | null };
export type Jeton = { token: string | null; language?: string | null; updated_at?: string | null; created_at?: string | null };
export type MessageExpo = {
  to: string; sound: 'default'; title: string; body: string;
  data: { type: 'membership_access_ending'; kind: Kind; box_id: string };
};
export type ResultatExpo = { ok: true; reponse: unknown } | { ok: false; erreur: string };
export type Email = { to: string; subject: string; html: string };
export type ResultatEmail = { ok: true } | { ok: false; erreur: string };
export type Resultat = { push_count: number; email_sent: boolean; error: string | null };

/**
 * Échec attendu, dont le message est un code court SANS donnée personnelle.
 * Toute autre erreur devient `erreur_interne` (son message pourrait contenir
 * une adresse ou un pseudo).
 */
export class Echec extends Error {}

/** Ce que la fonction lit et écrit, fourni par index.ts (clé serveur). */
export interface Acces {
  maintenant(): Date;
  /** Lignes non envoyées et non réservées, les plus anciennes d'abord. */
  aEnvoyer(limite: number): Promise<Ligne[]>;
  /**
   * Réservation conditionnelle : `UPDATE … SET reserved_at = now() WHERE id = …
   * AND reserved_at IS NULL AND sent_at IS NULL`, avec retour de ligne. Faux :
   * une autre exécution l'a prise.
   */
  reserver(id: string): Promise<boolean>;
  membre(boxMemberId: string): Promise<EtatMembre | null>;
  box(boxId: string): Promise<Box | null>;
  formules(boxId: string): Promise<Formule[]>;
  preferences(userId: string): Promise<Preferences | null>;
  jetons(userId: string): Promise<Jeton[]>;
  email(userId: string): Promise<string | null>;
  /** Un lot de 100 messages au plus. Ne lève jamais : l'échec est rendu en code. */
  envoyerExpo(messages: MessageExpo[]): Promise<ResultatExpo>;
  /** Ne lève jamais : l'échec est rendu en code. */
  envoyerEmail(email: Email): Promise<ResultatEmail>;
  /** Pose `sent_at` et le résultat : la ligne ne repartira plus. */
  terminer(id: string, resultat: Resultat): Promise<void>;
  /** Journal sans donnée personnelle : un code et l'erreur réduite à son code. */
  journaliser(code: string, erreur: unknown): void;
}

export const LOT_FILE = 50;
const LOT_EXPO = 100;
export const PERIME_APRES_MS = 48 * 3600 * 1000;
export const EXPEDITEUR = 'AthleX <noreply@athlexapp.eu>';
export const URL_COMPTE = 'https://athlexapp.eu/compte';
export const DOMAINE_DEMO = '@demo.athlexapp.eu';
const STATUTS_EN_COURS = ['active', 'trialing', 'past_due'];

/** Appel autorisé : CRON_SECRET posé et x-cron-secret égal (fail-closed). */
export function autorise(cronSecret: string | undefined | null, fourni: string | null): boolean {
  return !!cronSecret && fourni === cronSecret;
}

/** Heure de Paris (0 à 23) et jour de Paris (AAAA-MM-JJ) d'un instant. */
export function heureParis(instant: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(instant));
}
export function jourParis(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Envoi seulement de 9:00 à 20:00, heure de Paris. */
export function dansLesHeures(instant: Date): boolean {
  const h = heureParis(instant);
  return h >= 9 && h < 20;
}

export function perimee(ligne: Ligne, instant: Date): boolean {
  return instant.getTime() - new Date(ligne.created_at).getTime() > PERIME_APRES_MS;
}

/**
 * La situation du membre est-elle encore celle du message ? Un réencaissement
 * (autre fin d'accès), un passage en ligne (abonnement Stripe) ou une sortie de
 * la box entre la mise en file et l'envoi rendent le message obsolète.
 */
export function encoreValable(ligne: Ligne, m: EtatMembre | null): boolean {
  if (!m || m.stripe_subscription_id || m.cash_access_until !== ligne.access_until) return false;
  if (ligne.kind === 'fin') return m.subscription_status === 'expired';
  return m.role === 'member' && m.status === 'active' && STATUTS_EN_COURS.includes(m.subscription_status ?? '');
}

/**
 * « La box vend en ligne » : la règle de internal.box_vend_en_ligne (migration
 * 20270151), recopiée ici parce que la fonction interne est fermée à
 * service_role : compte Stripe renseigné, onboarding terminé, au moins une
 * formule active avec un prix Stripe.
 */
export function boxVendEnLigne(box: Box, formules: Formule[]): boolean {
  return !!box.stripe_account_id && box.stripe_onboarding_complete === true
    && formules.some((f) => f.is_active === true && !!f.stripe_price_id);
}

/** Langue du jeton le plus récent, sinon le français. */
export function langueRetenue(jetons: Jeton[]): Langue {
  const recent = [...jetons].sort((a, b) =>
    (b.updated_at ?? b.created_at ?? '').localeCompare(a.updated_at ?? a.created_at ?? ''))[0];
  return recent?.language === 'en' ? 'en' : 'fr';
}

/** « 12 novembre » / « November 12 », au jour de la date (déjà un jour de Paris). */
export function dateLisible(jour: string, langue: Langue): string {
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(`${jour}T12:00:00Z`));
}

/** Jours restants entre aujourd'hui (Paris) et la fin d'accès. */
export function joursRestants(jour: string, instant: Date): number {
  return Math.round((Date.parse(`${jour}T00:00:00Z`) - Date.parse(`${jourParis(instant)}T00:00:00Z`)) / 86_400_000);
}

export type Texte = { title: string; body: string; bouton: string | null };

/** Textes validés (spec §6). Le nom de la box n'est jamais traduit. */
export function rediger(kind: Kind, langue: Langue, v: { box: string; date: string; restants: number; enLigne: boolean }): Texte {
  const ceSoir = v.restants <= 0;
  if (langue === 'en') {
    const renouveler = 'Talk to your box to renew.';
    switch (kind) {
      case 'j7': return {
        title: 'Your access ends soon',
        body: `Your access to ${v.box} ends on ${v.date}. ${v.enLigne ? "Switch to online payment to keep booking — you won't pay twice." : renouveler}`,
        bouton: v.enLigne ? 'Switch to online payment' : null,
      };
      case 'j1': return {
        title: ceSoir ? 'Your access ends tonight' : 'Your access ends tomorrow',
        body: `Your access to ${v.box} ends ${ceSoir ? 'tonight' : 'tomorrow'}. ${v.enLigne ? 'Switch to online payment to keep booking.' : renouveler}`,
        bouton: v.enLigne ? 'Switch to online payment' : null,
      };
      case 'fin': return {
        title: 'Your access has ended',
        body: `Your access to ${v.box} has ended. ${v.enLigne ? 'Start your online membership to book again.' : renouveler}`,
        bouton: v.enLigne ? 'Start my online membership' : null,
      };
    }
  }
  const renouveler = 'Rapproche-toi de ta box pour renouveler.';
  switch (kind) {
    case 'j7': return {
      title: 'Ton accès se termine bientôt',
      body: `Ton accès à ${v.box} se termine le ${v.date}. ${v.enLigne ? 'Passe au paiement en ligne pour continuer à réserver, sans payer deux fois.' : renouveler}`,
      bouton: v.enLigne ? 'Passer au paiement en ligne' : null,
    };
    case 'j1': return {
      title: ceSoir ? 'Ton accès se termine ce soir' : 'Ton accès se termine demain',
      body: `Ton accès à ${v.box} se termine ${ceSoir ? 'ce soir' : 'demain'}. ${v.enLigne ? 'Passe au paiement en ligne pour continuer à réserver.' : renouveler}`,
      bouton: v.enLigne ? 'Passer au paiement en ligne' : null,
    };
    case 'fin': return {
      title: 'Ton accès est terminé',
      body: `Ton accès à ${v.box} est terminé. ${v.enLigne ? 'Active ton abonnement en ligne pour réserver à nouveau.' : renouveler}`,
      bouton: v.enLigne ? 'Activer mon abonnement en ligne' : null,
    };
  }
}

export function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** E-mail sobre, au modèle de l'e-mail d'impayé du Manager. Tout le contenu dynamique est échappé. */
export function htmlEmail(t: Texte, langue: Langue, box: string): string {
  const pied = langue === 'en' ? `Message sent by ${echapper(box)} via AthleX.` : `Message envoyé par ${echapper(box)} via AthleX.`;
  const bouton = t.bouton
    ? `<p style="margin:0 0 24px"><a href="${URL_COMPTE}" style="display:inline-block;background:#fff;color:#000;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:8px">${echapper(t.bouton)}</a></p>`
    : '';
  return `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 24px">
    <tr><td>
      <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">${echapper(t.title)}</h1>
      <p style="font-size:15px;line-height:1.5;color:#cfcfcf;margin:0 0 24px">${echapper(t.body)}</p>
      ${bouton}
      <p style="font-size:12px;color:#777;margin:28px 0 0">${pied}</p>
    </td></tr>
  </table>
</body></html>`;
}

/** Push permis : interrupteur général et « Annonces de la box » (box_announcements), vrais par défaut. */
export function pushPermis(p: Preferences | null): boolean {
  return p?.notifications_enabled !== false && p?.box_announcements !== false;
}

/** Appareils acceptés = tickets « ok » d'Expo (règle de deliver-manager-notifications). */
export function compterAcceptes(reponse: unknown): number {
  const tickets = (reponse as { data?: unknown } | null)?.data;
  if (!Array.isArray(tickets)) return 0;
  return tickets.filter((t) => (t as { status?: unknown } | null)?.status === 'ok').length;
}

export type Bilan = {
  hors_heures: boolean; lues: number; envoyees: number; perimees: number; obsoletes: number; prises_ailleurs: number;
};

/**
 * Traite un lot de la file. Hors des heures d'envoi, rien n'est lu. Chaque
 * ligne est réservée avant tout appel externe, puis terminée (`sent_at`) quoi
 * qu'il arrive : un oubli vaut mieux qu'un double envoi. Une ligne réservée
 * dont le résultat n'a pas pu être écrit n'est jamais reprise.
 */
export async function traiterFile(acces: Acces): Promise<Bilan> {
  const instant = acces.maintenant();
  const bilan: Bilan = { hors_heures: false, lues: 0, envoyees: 0, perimees: 0, obsoletes: 0, prises_ailleurs: 0 };
  if (!dansLesHeures(instant)) {
    bilan.hors_heures = true;
    return bilan;
  }
  const lignes = await acces.aEnvoyer(LOT_FILE);
  bilan.lues = lignes.length;

  for (const ligne of lignes) {
    if (!(await acces.reserver(ligne.id))) {
      bilan.prises_ailleurs++;
      continue;
    }
    let resultat: Resultat;
    try {
      if (perimee(ligne, instant)) {
        bilan.perimees++;
        resultat = { push_count: 0, email_sent: false, error: 'perime' };
      } else if (!encoreValable(ligne, await acces.membre(ligne.box_member_id))) {
        bilan.obsoletes++;
        resultat = { push_count: 0, email_sent: false, error: 'obsolete' };
      } else {
        resultat = await envoyer(acces, ligne, instant);
        bilan.envoyees++;
      }
    } catch (e) {
      acces.journaliser('deliver-access-notices : envoi en échec', e);
      resultat = { push_count: 0, email_sent: false, error: e instanceof Echec ? e.message : 'erreur_interne' };
    }
    try {
      await acces.terminer(ligne.id, resultat);
    } catch (e) {
      // La ligne reste réservée : jamais reprise, donc jamais envoyée deux fois.
      acces.journaliser('deliver-access-notices : résultat non écrit', e);
    }
  }
  return bilan;
}

async function envoyer(acces: Acces, ligne: Ligne, instant: Date): Promise<Resultat> {
  const box = await acces.box(ligne.box_id);
  if (!box) return { push_count: 0, email_sent: false, error: 'box_absente' };
  const enLigne = boxVendEnLigne(box, await acces.formules(ligne.box_id));
  const jetons = (await acces.jetons(ligne.member_id)).filter((j) => j.token);
  const restants = joursRestants(ligne.access_until, instant);
  const texte = (langue: Langue) => rediger(ligne.kind, langue, {
    box: box.name, date: dateLisible(ligne.access_until, langue), restants, enLigne,
  });
  const erreurs: string[] = [];

  // Push, dans la langue de chaque jeton, si les préférences le permettent.
  let push_count = 0;
  if (jetons.length > 0 && pushPermis(await acces.preferences(ligne.member_id))) {
    const messages: MessageExpo[] = jetons.map((j) => {
      const t = texte(j.language === 'en' ? 'en' : 'fr');
      return {
        to: j.token as string, sound: 'default', title: t.title, body: t.body,
        data: { type: 'membership_access_ending', kind: ligne.kind, box_id: ligne.box_id },
      };
    });
    for (let i = 0; i < messages.length; i += LOT_EXPO) {
      const r = await acces.envoyerExpo(messages.slice(i, i + LOT_EXPO));
      if (!r.ok) {
        acces.journaliser('deliver-access-notices : Expo', new Echec(r.erreur));
        erreurs.push(r.erreur);
        break;
      }
      push_count += compterAcceptes(r.reponse);
    }
  }

  // E-mail, information de service : part même si les push sont coupés.
  let email_sent = false;
  const adresse = await acces.email(ligne.member_id);
  if (!adresse) {
    erreurs.push('sans_email');
  } else if (adresse.toLowerCase().endsWith(DOMAINE_DEMO)) {
    erreurs.push('demo');
  } else {
    const langue = langueRetenue(jetons);
    const t = texte(langue);
    const r = await acces.envoyerEmail({ to: adresse, subject: t.title, html: htmlEmail(t, langue, box.name) });
    if (r.ok) email_sent = true;
    else {
      acces.journaliser('deliver-access-notices : Resend', new Echec(r.erreur));
      erreurs.push(r.erreur);
    }
  }
  return { push_count, email_sent, error: erreurs.length ? erreurs.join(',') : null };
}
