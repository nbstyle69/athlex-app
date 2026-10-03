// Edge Function: send-box-notification
// ------------------------------------------------------------------
// Delivers a box_notifications row as a real Expo push. Runs with the
// service role because push_tokens is RLS-locked to each owner, so a
// box owner cannot read their members' tokens from the client.
//
// Auth: caller must be the owner or a co-owner of the box the notification
// belongs to (same rule as `public.is_box_owner_admin`, see regles.ts).
// Body: { notification_id: string }
// Returns: { sent: number, recipients: number, pref_disabled: number }
//   `sent` = devices Expo accepted (tickets "ok"), also written to
//   box_notifications.delivered_count (0 included) with the service role.
// The rules live in regles.ts (tested by Jest without Deno).
// ------------------------------------------------------------------
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { cleSecrete } from '../_shared/cle-secrete.ts';
import { type Acces, traiterEnvoi } from './regles.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => null);
    const notificationId = body?.notification_id;
    if (!notificationId || typeof notificationId !== 'string') return json({ error: 'notification_id required' }, 400);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = cleSecrete();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'Empty token' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'Invalid token' }, 401);

    const acces: Acces = {
      async notification(id) {
        const { data, error } = await admin
          .from('box_notifications').select('id, box_id, title, body, target').eq('id', id).maybeSingle();
        return error ? null : data;
      },
      async roleAppelant(boxId, userId) {
        const [{ data: box }, { data: ligne }, { data: profil }] = await Promise.all([
          admin.from('boxes').select('owner_id').eq('id', boxId).maybeSingle(),
          admin.from('box_members').select('role, status').eq('box_id', boxId).eq('member_id', userId).maybeSingle(),
          admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
        ]);
        return { ownerId: box?.owner_id ?? null, ligne: ligne ?? null, roleProfil: profil?.role ?? null };
      },
      async membresActifs(boxId) {
        const { data } = await admin
          .from('box_members').select('member_id').eq('box_id', boxId).eq('status', 'active');
        return (data ?? []).map((m: { member_id: string }) => m.member_id);
      },
      async estMembreActif(boxId, userId) {
        const { data } = await admin
          .from('box_members').select('member_id')
          .eq('box_id', boxId).eq('member_id', userId).eq('status', 'active').maybeSingle();
        return !!data;
      },
      async preferences(userIds) {
        return await admin
          .from('notification_preferences')
          .select('user_id, notifications_enabled, box_announcements')
          .in('user_id', userIds);
      },
      async jetons(userIds) {
        const { data } = await admin.from('push_tokens').select('token').in('user_id', userIds);
        return (data ?? []).map((t: { token: string }) => t.token);
      },
      async envoyerExpo(messages) {
        try {
          const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
          });
          if (!res.ok) {
            console.error('send-box-notification: Expo a répondu', res.status);
            return null;
          }
          return await res.json();
        } catch (e) {
          console.error('send-box-notification: Expo injoignable', e);
          return null;
        }
      },
      async poserResultat(notificationId, delivered) {
        const { error } = await admin
          .from('box_notifications').update({ delivered_count: delivered }).eq('id', notificationId);
        if (error) throw error;
      },
      journaliser(message, erreur) {
        console.error(message, erreur);
      },
    };

    const r = await traiterEnvoi(acces, userData.user.id, notificationId);
    return json(r.body, r.status);
  } catch (e: any) {
    console.error('send-box-notification error', e);
    return json({ error: e?.message ?? 'Internal error' }, 500);
  }
});
