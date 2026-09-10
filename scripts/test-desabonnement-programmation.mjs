/**
 * test-desabonnement-programmation.mjs — migration 20261210 : se désabonner
 * d'une programmation Marketplace.
 *
 * Décor : une box éditrice avec une offre gratuite de 2 semaines, une box
 * abonnée dont le Whiteboard porte des cartes reçues sur trois semaines (une
 * passée, la courante, une future) plus une carte maison. Tout est joué à la
 * frontière RLS réelle : la RPC gardée est appelée avec le JWT du gérant abonné,
 * puis avec celui d'une autre box. Le service_role ne sert qu'au décor, à la
 * relecture et au rôle « webhook » (backend).
 *
 * Usage : ./scripts/test-stack.sh up && node scripts/test-desabonnement-programmation.mjs
 */
import {
  requireTestTarget, serviceClient, signInAs, createUser,
  createOwnedBox, dropBoxAndOwner, onCleanup, runCleanup, installCleanupTraps,
} from './lib/test-env.mjs';

requireTestTarget();
installCleanupTraps();

const db = serviceClient();
const stamp = Date.now();
const PASSWORD = 'TestUnsub1234!';

let passed = 0;
let failed = 0;
let attendu = null;

process.on('exit', () => {
  if (attendu !== null) console.log(`DESABONNEMENT_PROGRAMMATION_ASSERTIONS=${passed + failed}/${attendu}`);
});

function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, detail) {
  console.log(`  ❌ ${label}`);
  if (detail) console.log(`     → ${detail}`);
  failed++;
}
function assert(label, condition, detail = '') {
  if (condition) ok(label); else fail(label, detail);
}
function refus(error, motif) {
  return !!error && new RegExp(motif, 'i').test(error.message ?? '');
}
const motifDe = e => (e ? (e.message ?? String(e)) : 'aucune erreur — accordé');

function parisToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function plusDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOfWeek(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return plusDays(iso, -((d.getUTCDay() + 6) % 7));
}
const THIS_MONDAY = mondayOfWeek(parisToday());
const LAST_MONDAY = plusDays(THIS_MONDAY, -7);
const NEXT_MONDAY = plusDays(THIS_MONDAY, 7);
const FAR_MONDAY = plusDays(THIS_MONDAY, 7 * 30);

const DESC_OK = 'Bloc hybride de deux semaines, force et moteur, quatre séances hebdomadaires.';

async function insertOne(table, row) {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`décor ${table} : ${error.message}`);
  return data.id;
}
async function subRow(id) {
  const { data } = await db.from('box_programming_subscriptions')
    .select('status, color, week_anchor, cancel_requested_at, remove_future_on_cancel, stripe_subscription_id').eq('id', id).single();
  return data;
}
async function exists(table, id) {
  const { data } = await db.from(table).select('id').eq('id', id);
  return (data ?? []).length > 0;
}

/** Une carte reçue de `offer` posée dans le Whiteboard de `boxId` à `date`. */
async function receivedCard(boxId, ownerId, offer, offerWod, date, title) {
  return insertOne('box_wods', {
    box_id: boxId, created_by: ownerId, title: `zz ${title} ${stamp}`, scheduled_date: date,
    is_published: true, sort_order: 0, audience: 'all',
    source_programming_id: offer, source_programming_wod_id: offerWod,
  });
}

async function main() {
  const mk = s => `zz_un_${s}_${stamp}@test.athlex.local`;

  // ── Décor ──────────────────────────────────────────────────────────────────
  const pubOwner = await createUser(db, { email: mk('pub'), password: PASSWORD, username: `zz_un_pub_${stamp}`, role: 'box_owner' });
  const subOwner = await createUser(db, { email: mk('sub'), password: PASSWORD, username: `zz_un_sub_${stamp}`, role: 'box_owner' });
  const otherOwner = await createUser(db, { email: mk('oth'), password: PASSWORD, username: `zz_un_oth_${stamp}`, role: 'box_owner' });
  const athlete = await createUser(db, { email: mk('ath'), password: PASSWORD, username: `zz_un_ath_${stamp}` });

  const boxPub = await createOwnedBox(db, { tag: `unp${stamp}`, ownerId: pubOwner, name: `zz_un_raw_${stamp}` });
  const boxSub = await createOwnedBox(db, { tag: `uns${stamp}`, ownerId: subOwner, name: `zz_un_nbs2_${stamp}` });
  const boxOther = await createOwnedBox(db, { tag: `uno${stamp}`, ownerId: otherOwner, name: `zz_un_other_${stamp}` });
  onCleanup(() => dropBoxAndOwner(db, boxPub, pubOwner));
  onCleanup(() => dropBoxAndOwner(db, boxSub, subOwner));
  onCleanup(() => dropBoxAndOwner(db, boxOther, otherOwner));
  onCleanup(() => db.auth.admin.deleteUser(athlete));
  {
    const { error } = await db.from('box_members').upsert(
      { box_id: boxSub, member_id: athlete, role: 'member', status: 'active' }, { onConflict: 'box_id,member_id' },
    );
    if (error) throw new Error(`décor box_members : ${error.message}`);
  }

  const offer = await insertOne('box_programming', {
    publisher_box_id: boxPub, title: `zz Offre ${stamp}`, weeks_count: 2, billing: 'free', price_cents: 0,
    is_published: true, description: DESC_OK, goal: 'Construire', target_audience: 'Intermédiaires', created_by: pubOwner,
  });
  const offerWod = await insertOne('box_programming_wods', {
    programming_id: offer, week_number: 1, day_of_week: 1, title: `zz S1 Lundi ${stamp}`, description: '5 x 5', wod_type: 'For Time', sort_order: 0,
  });
  // Seconde offre gratuite, pour le contrôle croisé « autre box ».
  const offer2 = await insertOne('box_programming', {
    publisher_box_id: boxPub, title: `zz Offre bis ${stamp}`, weeks_count: 1, billing: 'free', price_cents: 0,
    is_published: true, description: DESC_OK, goal: 'Construire', target_audience: 'Intermédiaires', created_by: pubOwner,
  });
  // Offre payante mensuelle : la résiliation passe par Stripe.
  const paidOffer = await insertOne('box_programming', {
    publisher_box_id: boxPub, title: `zz Offre payante ${stamp}`, weeks_count: 1, billing: 'monthly', price_cents: 2900,
    is_published: true, description: DESC_OK, goal: 'Construire', target_audience: 'Intermédiaires', created_by: pubOwner,
  });

  const PUB = await signInAs(mk('pub'), PASSWORD);
  const SUB = await signInAs(mk('sub'), PASSWORD);
  const OTH = await signInAs(mk('oth'), PASSWORD);

  attendu = 31;

  // ── 1. Abonnement gratuit + cartes reçues sur trois semaines ───────────────
  console.log('\n── 1. Décor : abonnement, couleur, cartes passée / courante / future ──');
  const { data: subRes, error: subErr } = await SUB.client.rpc('subscribe_free_programming', { p_programming_id: offer, p_subscriber_box_id: boxSub });
  if (subErr) throw new Error(`abonnement : ${subErr.message}`);
  const subId = subRes.subscription_id;
  {
    const { error } = await SUB.client.from('box_programming_subscriptions').update({ color: 'violet' }).eq('id', subId);
    assert('le gérant pose la couleur violet', !error, motifDe(error));
  }
  const pastCard = await receivedCard(boxSub, subOwner, offer, offerWod, plusDays(LAST_MONDAY, 2), 'reçue passée');
  const currentCard = await receivedCard(boxSub, subOwner, offer, offerWod, plusDays(THIS_MONDAY, 3), 'reçue courante');
  const sundayCard = await receivedCard(boxSub, subOwner, offer, offerWod, plusDays(THIS_MONDAY, 6), 'reçue dimanche');
  const nextCard = await receivedCard(boxSub, subOwner, offer, offerWod, NEXT_MONDAY, 'reçue lundi prochain');
  const farCard = await receivedCard(boxSub, subOwner, offer, offerWod, FAR_MONDAY, 'reçue lointaine');
  const houseCard = await insertOne('box_wods', {
    box_id: boxSub, created_by: subOwner, title: `zz maison future ${stamp}`, scheduled_date: plusDays(NEXT_MONDAY, 1),
    is_published: true, sort_order: 0, audience: 'all',
  });
  // Un score sur la carte passée : c'est lui que la garde protège.
  const score = await insertOne('wod_scores', { wod_id: pastCard, member_id: athlete, box_id: boxSub, score_type: 'time', score_value: 754, rx: true });
  assert('décor : 5 cartes reçues + 1 maison + 1 score', await exists('wod_scores', score));

  // ── 2. Une autre box ne se désabonne pas à ma place ────────────────────────
  console.log('\n── 2. Garde : gérant d\'une autre box, éditeur, anonyme ─────────────');
  {
    const { error } = await OTH.client.rpc('unsubscribe_programming', { p_subscription_id: subId, p_remove_future: true });
    assert('le gérant d\'une autre box est refusé (message nommé)', refus(error, 'Accès refusé : gérant ou co-gérant de la box abonnée'), motifDe(error));
  }
  {
    const { error } = await PUB.client.rpc('unsubscribe_programming', { p_subscription_id: subId, p_remove_future: true });
    assert('la box éditrice ne désabonne pas ses abonnées', refus(error, 'Accès refusé'), motifDe(error));
  }
  {
    const { error } = await OTH.client.rpc('unsubscribe_programming', { p_subscription_id: '00000000-0000-0000-0000-000000000000', p_remove_future: false });
    assert('abonnement inconnu : introuvable', refus(error, 'Abonnement introuvable'), motifDe(error));
  }
  assert('mutation inverse : l\'abonnement est toujours actif', (await subRow(subId)).status === 'active');
  assert('… et aucune carte n\'a bougé', await exists('box_wods', nextCard) && await exists('box_wods', farCard));

  // ── 3. Désabonnement sans retrait des cartes ──────────────────────────────
  console.log('\n── 3. Gratuit, case décochée : statut seul ─────────────────────────');
  {
    const { data, error } = await SUB.client.rpc('unsubscribe_programming', { p_subscription_id: subId, p_remove_future: false });
    assert('le gérant abonné se désabonne', !error && data?.status === 'canceled' && data?.pending_stripe === false, motifDe(error) + ' ' + JSON.stringify(data));
    assert('0 carte retirée', data?.removed === 0, JSON.stringify(data));
  }
  {
    const row = await subRow(subId);
    assert('statut canceled, couleur violet conservée', row.status === 'canceled' && row.color === 'violet', JSON.stringify(row));
  }
  assert('toutes les cartes reçues sont encore là', await exists('box_wods', nextCard) && await exists('box_wods', farCard) && await exists('box_wods', pastCard));
  {
    const { data } = await db.rpc('materialize_box_programming', { p_target_monday: FAR_MONDAY });
    const { data: runs } = await db.from('box_programming_runs').select('id').eq('subscription_id', subId);
    assert('le cron ignore un abonnement canceled (aucun run journalisé)', (runs ?? []).length === 0, JSON.stringify({ data, runs }));
  }

  // ── 4. Réabonnement, puis désabonnement avec retrait des futures ──────────
  console.log('\n── 4. Réabonnement puis case cochée : futures parties, passé gardé ──');
  {
    const { data, error } = await SUB.client.rpc('subscribe_free_programming', { p_programming_id: offer, p_subscriber_box_id: boxSub });
    assert('réabonnement : même ligne, active', !error && data?.subscription_id === subId && data?.status === 'active', motifDe(error));
    const row = await subRow(subId);
    assert('la couleur violet est revenue avec l\'abonnement, demande de résiliation effacée', row.color === 'violet' && row.cancel_requested_at === null && row.remove_future_on_cancel === false, JSON.stringify(row));
  }
  {
    const { data, error } = await SUB.client.rpc('unsubscribe_programming', { p_subscription_id: subId, p_remove_future: true });
    assert(`désabonnement avec retrait à partir du ${NEXT_MONDAY}`, !error && data?.status === 'canceled' && data?.from_monday === NEXT_MONDAY, motifDe(error) + ' ' + JSON.stringify(data));
    assert('2 cartes retirées (lundi prochain + lointaine)', data?.removed === 2, JSON.stringify(data));
  }
  assert('la carte de la semaine passée reste', await exists('box_wods', pastCard));
  assert('… et son score', await exists('wod_scores', score));
  assert('les cartes de la semaine en cours restent (jeudi, dimanche)', await exists('box_wods', currentCard) && await exists('box_wods', sundayCard));
  assert('la carte de lundi prochain est partie', !(await exists('box_wods', nextCard)));
  assert('la carte lointaine est partie', !(await exists('box_wods', farCard)));
  assert('la carte maison future n\'est pas touchée', await exists('box_wods', houseCard));
  assert('statut canceled, couleur conservée', (await subRow(subId)).status === 'canceled' && (await subRow(subId)).color === 'violet');

  // ── 5. Autre box abonnée à la même offre : ses cartes ne bougent pas ──────
  console.log('\n── 5. Isolation : l\'autre box abonnée garde ses cartes ─────────────');
  const { data: othSub, error: othErr } = await OTH.client.rpc('subscribe_free_programming', { p_programming_id: offer2, p_subscriber_box_id: boxOther });
  if (othErr) throw new Error(`abonnement autre box : ${othErr.message}`);
  const othCard = await receivedCard(boxOther, otherOwner, offer2, null, FAR_MONDAY, 'autre box future');
  {
    const { error } = await SUB.client.rpc('unsubscribe_programming', { p_subscription_id: othSub.subscription_id, p_remove_future: true });
    assert('NBS2 ne désabonne pas l\'autre box', refus(error, 'Accès refusé'), motifDe(error));
  }
  assert('la carte de l\'autre box est intacte', await exists('box_wods', othCard));

  // ── 6. Offre payante Stripe : la RPC mémorise, le webhook conclut ─────────
  console.log('\n── 6. Payant : demande mémorisée, résiliation conclue en backend ────');
  const paidSubId = await insertOne('box_programming_subscriptions', {
    programming_id: paidOffer, subscriber_box_id: boxSub, status: 'active', week_anchor: NEXT_MONDAY,
    stripe_subscription_id: `sub_zz_${stamp}`, stripe_customer_id: `cus_zz_${stamp}`, created_by: subOwner,
  });
  const paidFuture = await receivedCard(boxSub, subOwner, paidOffer, null, FAR_MONDAY, 'payante future');
  const paidCurrent = await receivedCard(boxSub, subOwner, paidOffer, null, plusDays(THIS_MONDAY, 1), 'payante courante');
  {
    const { data, error } = await SUB.client.rpc('unsubscribe_programming', { p_subscription_id: paidSubId, p_remove_future: true });
    assert('le gérant demande : pending_stripe, statut inchangé', !error && data?.pending_stripe === true && data?.status === 'active', motifDe(error) + ' ' + JSON.stringify(data));
    const row = await subRow(paidSubId);
    assert('la demande est mémorisée (cancel_requested_at, remove_future_on_cancel)', row.status === 'active' && row.cancel_requested_at !== null && row.remove_future_on_cancel === true, JSON.stringify(row));
    assert('aucune carte retirée avant la fin de période', await exists('box_wods', paidFuture));
  }
  {
    // Le webhook (service_role) conclut sans repréciser la case : celle mémorisée l'emporte.
    const { data, error } = await db.rpc('unsubscribe_programming', { p_subscription_id: paidSubId, p_remove_future: null });
    assert('le backend conclut : canceled, 1 carte future retirée', !error && data?.status === 'canceled' && data?.removed === 1, motifDe(error) + ' ' + JSON.stringify(data));
  }
  assert('la carte payante de la semaine en cours reste', await exists('box_wods', paidCurrent));
  assert('la carte payante future est partie', !(await exists('box_wods', paidFuture)));

  if (passed + failed !== attendu) fail(`audit incomplet — ${passed + failed}/${attendu} assertions exécutées`);
}

main()
  .then(async () => {
    await runCleanup();
    console.log(`\n${passed} ✅ · ${failed} ❌`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(async e => {
    console.error('\n💥', e.message);
    await runCleanup();
    process.exit(1);
  });
