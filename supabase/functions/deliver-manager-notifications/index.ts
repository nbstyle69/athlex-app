// Edge Function: deliver-manager-notifications
// ------------------------------------------------------------------
// Envoie au gérant et aux co-gérants les notifications push mises en file
// dans `box_manager_notifications` (migration 20270143) : nouvel abonnement,
// paiement échoué, inscription sans formule, invitation acceptée.
//
// Auth : appelée seulement par pg_cron, chaque minute, avec `x-cron-secret`
// (comparé à CRON_SECRET, refus si l'un manque — fail-closed, comme les autres
// tâches). `verify_jwt = false` est versionné dans supabase/config.toml.
// Returns: { lues, envoyees, echecs, prises_ailleurs }
// Les règles vivent dans regles.ts (testées par Jest sans Deno) ; conception
// dans docs/NOTIFS_GERANT.md.
// ------------------------------------------------------------------
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { cleSecrete } from '../_shared/cle-secrete.ts';
import { type Acces, Echec, MAX_TENTATIVES, traiterFile } from './regles.ts';

serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const provided = req.headers.get('x-cron-secret') ?? '';
    if (!cronSecret || provided !== cronSecret) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, cleSecrete());
    const lire = <T>(code: string, r: { data: T | null; error: unknown }): T => {
      if (r.error) throw new Echec(code);
      return r.data as T;
    };

    const acces: Acces = {
      async aEnvoyer(limite) {
        const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        return lire('lecture_file', await admin
          .from('box_manager_notifications')
          .select('id, box_id, type, member_id, plan_id, class_starts_at, actor_id, attempts')
          .is('sent_at', null).is('claimed_at', null).lt('attempts', MAX_TENTATIVES)
          .gte('created_at', depuis)
          .order('created_at', { ascending: true }).limit(limite)) ?? [];
      },
      async reserver(ligne) {
        // Conditionnelle : deux exécutions simultanées ne prennent pas la même ligne.
        const data = lire('reservation', await admin
          .from('box_manager_notifications')
          .update({ claimed_at: new Date().toISOString(), attempts: ligne.attempts + 1 })
          .eq('id', ligne.id).is('sent_at', null).is('claimed_at', null).eq('attempts', ligne.attempts)
          .select('id'));
        return (data ?? []).length === 1;
      },
      async box(boxId) {
        return lire('lecture_box', await admin
          .from('boxes').select('name, owner_id, archived_at').eq('id', boxId).maybeSingle());
      },
      async cogerants(boxId) {
        return lire('lecture_cogerants', await admin
          .from('box_members').select('member_id, role, status').eq('box_id', boxId).eq('role', 'owner')) ?? [];
      },
      async pseudo(userId) {
        const p = lire<{ username: string } | null>('lecture_pseudo', await admin
          .from('profiles').select('username').eq('id', userId).maybeSingle());
        return p?.username ?? null;
      },
      async formule(planId) {
        const f = lire<{ name: string } | null>('lecture_formule', await admin
          .from('membership_plans').select('name').eq('id', planId).maybeSingle());
        return f?.name ?? null;
      },
      async coupes(userIds) {
        const prefs = lire<{ user_id: string }[]>('lecture_preferences', await admin
          .from('notification_preferences').select('user_id')
          .in('user_id', userIds).eq('notifications_enabled', false)) ?? [];
        return prefs.map((p) => p.user_id);
      },
      async jetons(userIds) {
        return lire('lecture_jetons', await admin
          .from('push_tokens').select('token, user_id, language').in('user_id', userIds)) ?? [];
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
      async terminer(id, delivered, erreur) {
        lire('ecriture_resultat', await admin
          .from('box_manager_notifications')
          .update({ sent_at: new Date().toISOString(), delivered_count: delivered, last_error: erreur })
          .eq('id', id));
      },
      async liberer(id, erreur) {
        lire('ecriture_echec', await admin
          .from('box_manager_notifications').update({ claimed_at: null, last_error: erreur }).eq('id', id));
      },
      journaliser(message, erreur) {
        console.error(message, erreur instanceof Echec ? erreur.message : erreur);
      },
    };

    return json(await traiterFile(acces));
  } catch (e) {
    console.error('deliver-manager-notifications error', e);
    return json({ error: e instanceof Echec ? e.message : 'Internal error' }, 500);
  }
});
