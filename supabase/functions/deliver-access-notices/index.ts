// Edge Function: deliver-access-notices
// ------------------------------------------------------------------
// Envoie aux membres payés au comptoir les messages de fin d'accès mis en file
// dans `box_member_access_notices` (migration 20270152) : J−7, J−1 et fin. Push
// (Expo, dans la langue de chaque jeton, selon les préférences) et e-mail
// (Resend, information de service, même push coupés).
//
// Auth : appelée seulement par pg_cron, à la 46e minute de chaque heure, avec
// `x-cron-secret` (comparé à CRON_SECRET, refus si l'un manque — fail-closed,
// comme les autres tâches). `verify_jwt = false` est versionné dans
// supabase/config.toml.
// Returns: { hors_heures, lues, envoyees, perimees, obsoletes, prises_ailleurs }
// Les règles vivent dans regles.ts (testées par Jest sans Deno).
// ------------------------------------------------------------------
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { cleSecrete } from '../_shared/cle-secrete.ts';
import { type Acces, autorise, Echec, EXPEDITEUR, traiterFile } from './regles.ts';

serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    if (!autorise(Deno.env.get('CRON_SECRET'), req.headers.get('x-cron-secret'))) {
      return json({ error: 'unauthorized' }, 401);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, cleSecrete());
    const lire = <T>(code: string, r: { data: T | null; error: unknown }): T => {
      if (r.error) throw new Echec(code);
      return r.data as T;
    };
    const resendKey = Deno.env.get('RESEND_API_KEY');

    const acces: Acces = {
      maintenant: () => new Date(),
      async aEnvoyer(limite) {
        return lire('lecture_file', await admin
          .from('box_member_access_notices')
          .select('id, box_id, member_id, box_member_id, kind, access_until, created_at')
          .is('sent_at', null).is('reserved_at', null)
          .order('created_at', { ascending: true }).limit(limite)) ?? [];
      },
      async reserver(id) {
        // Conditionnelle : deux exécutions simultanées ne prennent pas la même ligne.
        const data = lire('reservation', await admin
          .from('box_member_access_notices')
          .update({ reserved_at: new Date().toISOString() })
          .eq('id', id).is('reserved_at', null).is('sent_at', null)
          .select('id'));
        return (data ?? []).length === 1;
      },
      async membre(boxMemberId) {
        return lire('lecture_membre', await admin
          .from('box_members')
          .select('role, status, stripe_subscription_id, cash_access_until, subscription_status')
          .eq('id', boxMemberId).maybeSingle());
      },
      async box(boxId) {
        return lire('lecture_box', await admin
          .from('boxes').select('name, stripe_account_id, stripe_onboarding_complete').eq('id', boxId).maybeSingle());
      },
      async formules(boxId) {
        return lire('lecture_formules', await admin
          .from('membership_plans').select('is_active, stripe_price_id').eq('box_id', boxId)) ?? [];
      },
      async preferences(userId) {
        return lire('lecture_preferences', await admin
          .from('notification_preferences').select('notifications_enabled, box_announcements')
          .eq('user_id', userId).maybeSingle());
      },
      async jetons(userId) {
        return lire('lecture_jetons', await admin
          .from('push_tokens').select('token, language, updated_at, created_at').eq('user_id', userId)) ?? [];
      },
      async email(userId) {
        const p = lire<{ email: string | null } | null>('lecture_email', await admin
          .from('profiles').select('email').eq('id', userId).maybeSingle());
        return p?.email ?? null;
      },
      async envoyerExpo(messages) {
        try {
          const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
          });
          if (!res.ok) return { ok: false, erreur: `expo_http_${res.status}` };
          return { ok: true, reponse: await res.json() };
        } catch {
          return { ok: false, erreur: 'expo_injoignable' };
        }
      },
      async envoyerEmail(email) {
        if (!resendKey) return { ok: false, erreur: 'resend_sans_cle' };
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: EXPEDITEUR, to: email.to, subject: email.subject, html: email.html }),
          });
          // Le corps de la réponse n'est pas journalisé : il peut citer l'adresse.
          return res.ok ? { ok: true } : { ok: false, erreur: `resend_http_${res.status}` };
        } catch {
          return { ok: false, erreur: 'resend_injoignable' };
        }
      },
      async terminer(id, r) {
        lire('ecriture_resultat', await admin
          .from('box_member_access_notices')
          .update({ sent_at: new Date().toISOString(), push_count: r.push_count, email_sent: r.email_sent, error: r.error })
          .eq('id', id));
      },
      journaliser(code, erreur) {
        console.error(code, erreur instanceof Echec ? erreur.message : 'erreur_interne');
      },
    };

    return json(await traiterFile(acces));
  } catch (e) {
    console.error('deliver-access-notices error', e instanceof Echec ? e.message : 'erreur_interne');
    return json({ error: e instanceof Echec ? e.message : 'Internal error' }, 500);
  }
});
