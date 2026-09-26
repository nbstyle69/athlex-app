// Edge Function: send-push
// ------------------------------------------------------------------
// Generic fan-out for cross-user push notifications. Runs with the
// service role because push_tokens AND notification_preferences are
// RLS-locked to each user (auth.uid() = user_id), so a client can
// neither read another member's tokens nor check their prefs. Every
// cross-user notification in src/services/notifications.ts routes here.
//
// Auth: any valid authenticated JWT (app-triggered notifications).
//
// SÉCURITÉ (Lot 1C-a) — avant, la fonction faisait CONFIANCE au client :
// n'importe quel JWT valide pouvait pousser un titre/corps ARBITRAIRES à
// N'IMPORTE QUELS user_id → phishing de masse signé AthleX. Désormais, on
// n'envoie qu'aux destinataires avec lesquels l'appelant a un LIEN légitime
// (soi-même · co-membre de box · ami accepté/en attente · groupe de messages
// partagé · même tournoi · même compétition inter-box), + bypass pour les
// admins plateforme, + un plafond de destinataires par appel. Les destinataires
// non liés sont silencieusement écartés (un attaquant ne peut plus viser un
// inconnu ni toute la base). Les 15 types de notifs de l'app restent couverts.
//
// PRÉFÉRENCES (2026-08-16) — la responsabilité est INVERSÉE : le mapping
// « type de notification → clé de préférence » vit ICI (regles.ts), pas chez l'appelant.
// Avant, le filtrage dépendait d'un `pref_key` que le client fournissait ou
// non : 7 des 13 familles n'en passaient aucune et partaient donc malgré les
// réglages, et le défaut était dans le sens dangereux (envoyer). Désormais la
// catégorie est OBLIGATOIRE et doit être connue — un appel sans catégorie
// résoluble est refusé (fail-closed, comme CRON_SECRET sur les crons).
//
// La catégorie est résolue dans cet ordre : `category` explicite, `pref_key`
// (compat historique), puis le `data.type` que TOUS les appels transportent
// déjà. Cette dernière source est ce qui ferme les trous SANS attendre
// l'adoption d'une mise à jour de l'app : un téléphone jamais mis à jour voit
// ses préférences respectées dès le déploiement de cette fonction.
//
// APPELANT MACHINE (2026-08-16) — un cron n'a pas de JWT utilisateur, donc pas
// de « relation » avec ses destinataires. L'en-tête `x-cron-secret` (même secret
// que les crons, fail-closed) identifie un appelant serveur de confiance : il
// saute l'autorisation par relation, mais PAS la catégorie obligatoire ni le
// filtrage par préférence. Sans cette voie, les notifications de tournoi
// devraient refaire leur propre fan-out Expo — c'est-à-dire re-créer un chemin
// d'envoi qui ne consulte aucune préférence.
//
// TYPES RÉSERVÉS AU SERVEUR (2026-09-26) — `membership_stopped` (arrêt d'un
// abonnement par le gérant), `box_notification` (annonce de la box) et
// `elo_change` (variation d'ELO) ne sont acceptés que par le chemin serveur ;
// envoyés par un utilisateur connecté, l'appel est refusé en 403
// `SERVER_ONLY_TYPE`. De même, la catégorie « annonces de la box »
// (`box_announcements`), demandée par category ou pref_key, avec ou sans type :
// 403 `SERVER_ONLY_CATEGORY`. « Nouveau WOD » (`new_wod`) n'est accepté d'un
// utilisateur que s'il gère une box qui contient tous les destinataires :
// 403 `STAFF_ONLY_CATEGORY` sinon. Listes dans regles.ts.
//
// LANGUE (2026-09-26) — chaque jeton porte la langue du téléphone
// (push_tokens.language, fr ou en). Un destinataire peut fournir `en` en plus
// de `title` / `body` (alors la version française) : chaque jeton reçoit sa
// langue, un jeton sans langue le français. Sans `en`, la version unique part
// à tous les jetons, comme avant.
//
// Body: {
//   recipients: Array<{ user_id: string; title: string; body: string;
//                       en?: { title: string; body: string }; data?: object }>,
//   category?: string,   // ou pref_key (déprécié), ou data.type des recipients
// }
// Returns: { sent, recipients, authorized, dropped, category, pref_disabled }
// ------------------------------------------------------------------
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { cleSecrete } from '../_shared/cle-secrete.ts';
import {
  boxCoveringAll, buildMessages, resolvePrefKey, SERVER_ONLY_CATEGORIES, serverOnlyType, STAFF_ONLY_CATEGORIES,
  type Recipient,
} from './regles.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Plafond dur : un fan-out légitime (grande box, groupe) reste sous cette borne ;
// au-delà = abus. Ne coupe aucun envoi réel connu.
const MAX_RECIPIENTS = 1000;

// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Sous-ensemble des `candidates` que `caller` a le DROIT de notifier.
 * Union des relations légitimes ; un admin plateforme passe partout.
 */
async function authorizeRecipients(
  admin: Admin, caller: string, candidates: string[],
): Promise<Set<string>> {
  const allowed = new Set<string>();
  const cand = new Set(candidates);

  // 0. Soi-même.
  if (cand.has(caller)) allowed.add(caller);

  // 0bis. Admin plateforme → peut notifier tout le monde (annonces, gestion inter-box).
  const { data: prof } = await admin.from('profiles').select('role').eq('id', caller).maybeSingle();
  if (prof?.role === 'super_admin' || prof?.role === 'admin') {
    return cand; // bypass total
  }

  // 1. Co-membres de box : box_members actifs des box où je suis membre OU que je possède
  //    (owner sans ligne box_members inclus — cas « primary owner »).
  const [{ data: myMemberships }, { data: myOwned }] = await Promise.all([
    admin.from('box_members').select('box_id').eq('member_id', caller).eq('status', 'active'),
    admin.from('boxes').select('id').eq('owner_id', caller),
  ]);
  const ownedBoxIds = (myOwned ?? []).map((r: any) => r.id).filter(Boolean);
  const myBoxIds = [
    ...(myMemberships ?? []).map((r: any) => r.box_id),
    ...ownedBoxIds,
  ].filter(Boolean);
  if (myBoxIds.length) {
    const { data: mates } = await admin
      .from('box_members').select('member_id')
      .in('box_id', myBoxIds).in('member_id', candidates).eq('status', 'active');
    for (const m of mates ?? []) allowed.add(m.member_id);
  }

  // 1bis. Box que l'appelant GÈRE (possédée OU role owner/coach actif) — réplique
  //       manages_box() ici, car is_box_admin() (auth.uid()) n'est pas appelable
  //       en service-role. Sert aux branches organisateur ci-dessous (#6/#7).
  const { data: myStaff } = await admin
    .from('box_members').select('box_id')
    .eq('member_id', caller).in('role', ['owner', 'coach']).eq('status', 'active');
  const managedBoxIds = [
    ...ownedBoxIds,
    ...(myStaff ?? []).map((r: any) => r.box_id),
  ].filter(Boolean);

  // 2. Amis (acceptés OU en attente, dans les deux sens) → demande d'ami + acceptation.
  const { data: friends } = await admin
    .from('friendships').select('requester_id, addressee_id')
    .in('status', ['pending', 'accepted'])
    .or(
      `and(requester_id.eq.${caller},addressee_id.in.(${candidates.join(',')})),` +
      `and(addressee_id.eq.${caller},requester_id.in.(${candidates.join(',')}))`,
    );
  for (const f of friends ?? []) {
    allowed.add(f.requester_id === caller ? f.addressee_id : f.requester_id);
  }

  // 3. Groupes de messages partagés.
  const { data: groups } = await admin
    .from('message_groups').select('members').contains('members', [caller]);
  for (const g of groups ?? []) {
    for (const uid of (g.members ?? []) as string[]) if (cand.has(uid)) allowed.add(uid);
  }

  // 4. Même tournoi (participants).
  const { data: myTourns } = await admin
    .from('tournament_participants').select('tournament_id').eq('athlete_id', caller);
  const tIds = (myTourns ?? []).map((r: any) => r.tournament_id).filter(Boolean);
  if (tIds.length) {
    const { data: co } = await admin
      .from('tournament_participants').select('athlete_id')
      .in('tournament_id', tIds).in('athlete_id', candidates);
    for (const c of co ?? []) allowed.add(c.athlete_id);
  }

  // 5. Même compétition inter-box (inscrits) — participant → co-inscrits.
  const { data: myComps } = await admin
    .from('inter_registrations').select('competition_id').eq('athlete_id', caller);
  const cIds = (myComps ?? []).map((r: any) => r.competition_id).filter(Boolean);
  if (cIds.length) {
    const { data: co } = await admin
      .from('inter_registrations').select('athlete_id')
      .in('competition_id', cIds).in('athlete_id', candidates);
    for (const c of co ?? []) allowed.add(c.athlete_id);
  }

  // 6. ORGANISATEUR de tournoi → participants de CE tournoi (#4 tournament_closed).
  //    Un owner clôture un tournoi ouvert/inter : ses participants ne sont pas tous
  //    membres de sa box → on l'autorise via la propriété du tournoi (box gérée).
  if (managedBoxIds.length) {
    const { data: myTournsOrg } = await admin
      .from('tournaments').select('id').in('box_id', managedBoxIds);
    const orgTIds = (myTournsOrg ?? []).map((r: any) => r.id).filter(Boolean);
    if (orgTIds.length) {
      const { data: parts } = await admin
        .from('tournament_participants').select('athlete_id')
        .in('tournament_id', orgTIds).in('athlete_id', candidates);
      for (const p of parts ?? []) allowed.add(p.athlete_id);
    }
  }

  // 7. ORGANISATEUR de compétition inter-box → tous ses inscrits (#9/#10/#11/#12/#13).
  //    L'organisateur (created_by) n'est pas inscrit comme athlète → non couvert par #5.
  const { data: myOrgComps } = await admin
    .from('inter_competitions').select('id').eq('created_by', caller);
  const orgCIds = (myOrgComps ?? []).map((r: any) => r.id).filter(Boolean);
  if (orgCIds.length) {
    const { data: regs } = await admin
      .from('inter_registrations').select('athlete_id')
      .in('competition_id', orgCIds).in('athlete_id', candidates);
    for (const r of regs ?? []) allowed.add(r.athlete_id);
  }

  return allowed;
}

/**
 * Une box que `caller` gère (propriétaire, ou owner / coach actif) et qui
 * contient tous les destinataires (membres actifs ou propriétaire), ou null.
 * Une lecture en échec donne null : l'envoi est alors refusé.
 */
async function staffBoxFor(admin: Admin, caller: string, userIds: string[]): Promise<string | null> {
  const [{ data: owned }, { data: staff }] = await Promise.all([
    admin.from('boxes').select('id').eq('owner_id', caller),
    admin.from('box_members').select('box_id')
      .eq('member_id', caller).in('role', ['owner', 'coach']).eq('status', 'active'),
  ]);
  const managed = [...(owned ?? []).map((b: any) => b.id), ...(staff ?? []).map((r: any) => r.box_id)].filter(Boolean);
  if (managed.length === 0) return null;
  const [{ data: members }, { data: owners }] = await Promise.all([
    admin.from('box_members').select('box_id, member_id')
      .in('box_id', managed).in('member_id', userIds).eq('status', 'active'),
    admin.from('boxes').select('id, owner_id').in('id', managed).in('owner_id', userIds),
  ]);
  const pairs = [
    ...(members ?? []),
    ...(owners ?? []).map((b: any) => ({ box_id: b.id, member_id: b.owner_id })),
  ];
  return boxCoveringAll(managed, pairs, userIds);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = cleSecrete();

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Appelant machine : secret présent, configuré et exact. Un secret non
    // configuré côté fonction ne vaut jamais autorisation (fail-closed).
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    const isMachine = !!cronSecret && !!providedSecret && providedSecret === cronSecret;

    let caller: string | null = null;
    if (!isMachine) {
      const authHeader = req.headers.get('Authorization');
      const jwt = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!jwt) return json({ error: 'Missing token' }, 401);
      const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
      if (userErr || !userData?.user) return json({ error: 'Invalid token' }, 401);
      caller = userData.user.id;
    }

    const body = await req.json().catch(() => null);
    const recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];

    // De-dupe (garde le premier message par user id).
    // SÉCURITÉ (Lot 6B) : chaque user_id doit être un UUID STRICT. Les valeurs
    // sont ensuite interpolées dans un filtre PostgREST .or() (authorizeRecipients) ;
    // un id non-UUID permettait d'injecter une branche de filtre et de contourner
    // l'autorisation par relation (retour du phishing de masse du Lot 1C-a).
    // On rejette tout id non conforme À LA SOURCE, avant tout usage.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const byUser = new Map<string, Recipient>();
    for (const r of recipients) {
      if (r && typeof r.user_id === 'string' && UUID_RE.test(r.user_id) && !byUser.has(r.user_id)) {
        byUser.set(r.user_id, r);
      }
    }
    let userIds = [...byUser.keys()];
    const requested = userIds.length;
    if (requested === 0) return json({ sent: 0, recipients: 0, authorized: 0, dropped: 0 });
    if (requested > MAX_RECIPIENTS) return json({ error: 'Too many recipients' }, 400);

    // ── CATÉGORIE OBLIGATOIRE (fail-closed) ─────────────────────────────────
    const types = [...byUser.values()]
      .map((r) => (typeof r.data?.type === 'string' ? r.data.type as string : ''))
      .filter(Boolean);
    const prefKey = resolvePrefKey(body?.category, body?.pref_key, types);
    if (!prefKey) {
      return json({ error: 'Unknown or missing notification category', sent: 0 }, 400);
    }

    // ── TYPES RÉSERVÉS AU SERVEUR : jamais depuis un utilisateur connecté ────
    const reserve = isMachine ? null : serverOnlyType(body?.category, body?.pref_key, types);
    if (reserve) {
      return json({ error: 'SERVER_ONLY_TYPE', type: reserve, sent: 0 }, 403);
    }
    // La catégorie résolue, quelle que soit sa source (category, pref_key, type).
    if (!isMachine && SERVER_ONLY_CATEGORIES.has(prefKey)) {
      return json({ error: 'SERVER_ONLY_CATEGORY', category: prefKey, sent: 0 }, 403);
    }
    // Catégorie du staff : l'appelant gère une box qui contient tous les destinataires.
    if (!isMachine && STAFF_ONLY_CATEGORIES.has(prefKey) && !(await staffBoxFor(admin, caller!, userIds))) {
      return json({ error: 'STAFF_ONLY_CATEGORY', category: prefKey, sent: 0 }, 403);
    }

    // ── AUTORISATION : ne garder que les destinataires réellement liés à l'appelant.
    const allowed = caller
      ? await authorizeRecipients(admin, caller, userIds)
      : new Set(userIds); // appelant machine : le contenu ne vient pas d'un client
    const droppedUnauthorized = userIds.length - allowed.size;
    userIds = userIds.filter((id) => allowed.has(id));
    if (userIds.length === 0) return json({ sent: 0, recipients: 0, authorized: 0, dropped: droppedUnauthorized });

    // ── PRÉFÉRENCE par destinataire (ligne absente = tout activé) ───────────
    // `notifications_enabled` est l'interrupteur maître : coupé, il l'emporte
    // sur la clé de famille, quelle qu'elle soit.
    const { data: prefs, error: prefsErr } = await admin
      .from('notification_preferences')
      .select(`user_id, notifications_enabled, ${prefKey}`).in('user_id', userIds);
    // Une lecture de préférences en échec ne doit pas se traduire par un envoi :
    // c'est le défaut dans le sens dangereux qui a produit le bug.
    if (prefsErr) return json({ error: 'Preferences unavailable', sent: 0 }, 503);
    const disabled = new Set(
      (prefs ?? [])
        .filter((p: any) => p.notifications_enabled === false || p[prefKey] === false)
        .map((p: any) => p.user_id),
    );
    userIds = userIds.filter((id) => !disabled.has(id));
    if (userIds.length === 0) {
      return json({
        sent: 0, recipients: 0, authorized: allowed.size,
        dropped: droppedUnauthorized, category: prefKey, pref_disabled: disabled.size,
      });
    }

    const { data: tokens } = await admin
      .from('push_tokens').select('token, user_id, language').in('user_id', userIds);
    if (!tokens || tokens.length === 0) {
      return json({
        sent: 0, recipients: userIds.length, authorized: allowed.size,
        dropped: droppedUnauthorized, category: prefKey, pref_disabled: disabled.size,
      });
    }

    const messages = buildMessages(tokens, byUser);
    if (messages.length === 0) {
      return json({
        sent: 0, recipients: userIds.length, authorized: allowed.size,
        dropped: droppedUnauthorized, category: prefKey, pref_disabled: disabled.size,
      });
    }

    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
    }

    return json({
      sent, recipients: userIds.length, authorized: allowed.size,
      dropped: droppedUnauthorized, category: prefKey, pref_disabled: disabled.size,
    });
  } catch (e: any) {
    console.error('send-push error', e);
    return json({ error: e?.message ?? 'Internal error' }, 500);
  }
});
