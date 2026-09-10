/**
 * test-marketplace-whiteboard.mjs — migration 20261209 : une box abonnée reçoit
 * ses WOD, avec une visibilité explicite et un contenu verrouillé.
 *
 * Décor : une box éditrice (RAW) avec une offre de 3 semaines, une box abonnée
 * (NBS2) avec un groupe « K+ Perf », deux membres (dans / hors groupe), un
 * programme athlète avec deux inscrits actifs. Tout est joué à la frontière
 * RLS réelle : les RPC gardées sont appelées avec le JWT du gérant, les
 * lectures avec celui des membres. Le service_role ne sert qu'au décor et au
 * cron (`materialize_box_programming`, réservé à service_role).
 *
 * Usage : ./scripts/test-stack.sh up && node scripts/test-marketplace-whiteboard.mjs
 */
import {
  requireTestTarget, serviceClient, signInAs, createUser,
  createOwnedBox, dropBoxAndOwner, onCleanup, runCleanup, installCleanupTraps,
} from './lib/test-env.mjs';

requireTestTarget();
installCleanupTraps();

const db = serviceClient();
const stamp = Date.now();
const PASSWORD = 'TestMktWb1234!';

let passed = 0;
let failed = 0;
let attendu = null;

process.on('exit', () => {
  if (attendu !== null) console.log(`MARKETPLACE_WHITEBOARD_ASSERTIONS=${passed + failed}/${attendu}`);
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
/** Un refus se constate par son message, jamais par « une erreur quelconque ». */
function refus(error, motif) {
  return !!error && new RegExp(motif, 'i').test(error.message ?? '');
}
const motifDe = e => (e ? (e.message ?? String(e)) : 'aucune erreur — accordé');

// ── Dates (Europe/Paris) ─────────────────────────────────────────────────────
function parisNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
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
const PARIS = parisNow();
const T0 = new Date().toISOString();
const THIS_MONDAY = mondayOfWeek(PARIS.date);
const NEXT_MONDAY = plusDays(THIS_MONDAY, 7);
/** Semaines cibles loin dans le futur : aucune collision avec le décor courant. */
const M1 = plusDays(THIS_MONDAY, 7 * 20);

const DESC_OK = 'Bloc de construction hybride : force, gymnastique et moteur sur six semaines, cinq séances hebdomadaires progressives.';

async function insertOne(table, row) {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`décor ${table} : ${error.message}`);
  return data.id;
}
async function wodsOf(boxId, from, to) {
  const { data, error } = await db.from('box_wods')
    .select('id, title, scheduled_date, audience, source_programming_wod_id, sort_order')
    .eq('box_id', boxId).gte('scheduled_date', from).lt('scheduled_date', to)
    .order('scheduled_date').order('sort_order');
  if (error) throw new Error(`lecture box_wods : ${error.message}`);
  return data;
}
async function groupsOf(wodId) {
  const { data } = await db.from('wod_group_access').select('group_id').eq('wod_id', wodId);
  return (data ?? []).map(r => r.group_id);
}
async function audienceOf(wodId) {
  const { data } = await db.from('box_wods').select('audience').eq('id', wodId).single();
  return data?.audience;
}
async function sub(id) {
  const { data } = await db.from('box_programming_subscriptions')
    .select('week_anchor, default_audience, default_group_ids, color, auto_apply_weekly').eq('id', id).single();
  return data;
}
async function runsOf(subscriptionId) {
  const { data } = await db.from('box_programming_runs').select('*').eq('subscription_id', subscriptionId).order('id');
  return data ?? [];
}
async function sees(client, table, id) {
  const { data } = await client.from(table).select('id').eq('id', id);
  return (data ?? []).length > 0;
}

async function main() {
  const mk = s => `zz_mw_${s}_${stamp}@test.athlex.local`;

  // ── Décor ──────────────────────────────────────────────────────────────────
  const pubOwner = await createUser(db, { email: mk('pub'), password: PASSWORD, username: `zz_mw_pub_${stamp}`, role: 'box_owner' });
  const subOwner = await createUser(db, { email: mk('sub'), password: PASSWORD, username: `zz_mw_sub_${stamp}`, role: 'box_owner' });
  const inGroup = await createUser(db, { email: mk('in'), password: PASSWORD, username: `zz_mw_in_${stamp}` });
  const outGroup = await createUser(db, { email: mk('out'), password: PASSWORD, username: `zz_mw_out_${stamp}` });
  const progA = await createUser(db, { email: mk('pa'), password: PASSWORD, username: `zz_mw_pa_${stamp}` });
  const progB = await createUser(db, { email: mk('pb'), password: PASSWORD, username: `zz_mw_pb_${stamp}` });

  const boxPub = await createOwnedBox(db, { tag: `mwp${stamp}`, ownerId: pubOwner, name: `zz_mw_raw_${stamp}` });
  const boxSub = await createOwnedBox(db, { tag: `mws${stamp}`, ownerId: subOwner, name: `zz_mw_nbs2_${stamp}` });
  onCleanup(() => dropBoxAndOwner(db, boxPub, pubOwner));
  onCleanup(() => dropBoxAndOwner(db, boxSub, subOwner));
  for (const id of [inGroup, outGroup, progA, progB]) onCleanup(() => db.auth.admin.deleteUser(id));

  for (const m of [inGroup, outGroup, progA, progB]) {
    const { error } = await db.from('box_members').upsert(
      { box_id: boxSub, member_id: m, role: 'member', status: 'active' }, { onConflict: 'box_id,member_id' },
    );
    if (error) throw new Error(`décor box_members : ${error.message}`);
  }

  const kPerf = await insertOne('message_groups', {
    box_id: boxSub, name: `zz K+ Perf ${stamp}`, created_by: subOwner, members: [subOwner, inGroup],
  });

  // Offre RAW : 3 semaines, incomplète au départ (semaine 3 vide, pas d'objectif).
  const offer = await insertOne('box_programming', {
    publisher_box_id: boxPub, title: `zz ATHX BLOC ${stamp}`, weeks_count: 3,
    billing: 'free', price_cents: 0, is_published: false, description: DESC_OK,
    created_by: pubOwner,
  });
  const offerRows = {};
  for (const [key, week, day, title] of [
    ['w1d1', 1, 1, 'S1 Lundi — Back squat'], ['w1d3', 1, 3, 'S1 Mercredi — Metcon'],
    ['w2d2', 2, 2, 'S2 Mardi — Intervalles'],
  ]) {
    offerRows[key] = await insertOne('box_programming_wods', {
      programming_id: offer, week_number: week, day_of_week: day, title: `zz ${title}`,
      description: '5 x 5', wod_type: 'For Time', sort_order: 0,
    });
  }

  // Offre VIDE publiée directement (ce que la prod contient aujourd'hui).
  const emptyOffer = await insertOne('box_programming', {
    publisher_box_id: boxPub, title: `zz Offre vide ${stamp}`, weeks_count: 2,
    billing: 'free', price_cents: 0, is_published: true, description: DESC_OK, created_by: pubOwner,
  });

  // Programme athlète de NBS2, deux inscrits actifs (progA lit, progB produit).
  const program = await insertOne('programs', {
    box_id: boxSub, owner_id: subOwner, title: `zz_mw_prog_${stamp}`,
    price_cents: 4000, type: 'ongoing', invite_code: `zzmw${stamp}`.slice(-12),
  });
  for (const u of [progA, progB]) {
    const { error } = await db.from('program_members').insert({
      program_id: program, user_id: u, status: 'active', provenance: 'stripe',
      start_date: THIS_MONDAY, stripe_checkout_session_id: `cs_test_zzmw_${stamp}_${u.slice(0, 8)}`,
    });
    if (error) throw new Error(`décor program_members : ${error.message}`);
  }

  const PUB = await signInAs(mk('pub'), PASSWORD);
  const SUB = await signInAs(mk('sub'), PASSWORD);
  const IN = await signInAs(mk('in'), PASSWORD);
  const OUT = await signInAs(mk('out'), PASSWORD);
  const PA = await signInAs(mk('pa'), PASSWORD);

  attendu = 71;

  // ── 1. Legacy : insertion sans `audience`, lignes de groupe → 'groups' ─────
  console.log('\n── 1. Défaut all, groupes → groups, dernier groupe retiré → all ──');
  const legacyAll = await insertOne('box_wods', {
    box_id: boxSub, created_by: subOwner, title: `zz legacy all ${stamp}`, scheduled_date: THIS_MONDAY, is_published: true, sort_order: 10,
  });
  const legacyGroups = await insertOne('box_wods', {
    box_id: boxSub, created_by: subOwner, title: `zz legacy groups ${stamp}`, scheduled_date: THIS_MONDAY, is_published: true, sort_order: 11,
  });
  await insertOne('wod_group_access', { wod_id: legacyGroups, group_id: kPerf });
  assert('WOD inséré sans audience → all', (await audienceOf(legacyAll)) === 'all');
  assert('WOD avec une ligne wod_group_access → groups (trigger)', (await audienceOf(legacyGroups)) === 'groups');
  assert('membre hors groupe voit le WOD all', await sees(OUT.client, 'box_wods', legacyAll));
  assert('membre hors groupe ne voit PAS le WOD groups', !(await sees(OUT.client, 'box_wods', legacyGroups)));
  assert('membre du groupe voit le WOD groups', await sees(IN.client, 'box_wods', legacyGroups));
  await db.from('wod_group_access').delete().eq('wod_id', legacyGroups);
  assert('dernier groupe retiré → le WOD repasse en all', (await audienceOf(legacyGroups)) === 'all');
  assert('… et redevient visible hors groupe', await sees(OUT.client, 'box_wods', legacyGroups));

  // ── 2. none : personne sauf le staff ───────────────────────────────────────
  console.log('\n── 2. audience = none ─────────────────────────────────────────────');
  const noneWod = await insertOne('box_wods', {
    box_id: boxSub, created_by: subOwner, title: `zz none ${stamp}`, scheduled_date: THIS_MONDAY, is_published: true, sort_order: 12, audience: 'none',
  });
  assert('membre du groupe ne voit pas un WOD none', !(await sees(IN.client, 'box_wods', noneWod)));
  assert('membre hors groupe ne voit pas un WOD none', !(await sees(OUT.client, 'box_wods', noneWod)));
  assert('le gérant voit le WOD none', await sees(SUB.client, 'box_wods', noneWod));

  // ── 10. Publication : jamais vide ──────────────────────────────────────────
  console.log('\n── 10. publish_programming ────────────────────────────────────────');
  {
    const { error } = await PUB.client.rpc('publish_programming', { p_id: offer, p_publish: true });
    assert('offre incomplète refusée en nommant la semaine vide', refus(error, 'Semaines vides : 3'), motifDe(error));
    assert('… et l\'objectif / public manquants', refus(error, 'objectif manquant') && refus(error, 'public visé manquant'), motifDe(error));
  }
  await db.from('box_programming').update({ goal: 'Construire la base', target_audience: 'Intermédiaires', equipment: 'Barre, box, rameur' }).eq('id', offer);
  {
    const { error } = await PUB.client.rpc('publish_programming', { p_id: offer, p_publish: true });
    assert('métadonnées posées, semaine 3 vide → toujours refusée', refus(error, 'Semaines vides : 3') && !refus(error, 'objectif'), motifDe(error));
  }

  // ── 9a. Remplir l'offre depuis le Whiteboard de RAW ────────────────────────
  console.log('\n── 9a. sync_wod_to_offer / copy_week_to_offer ─────────────────────');
  const houseWeek = plusDays(THIS_MONDAY, 7 * 30);
  const house1 = await insertOne('box_wods', {
    box_id: boxPub, created_by: pubOwner, title: `zz maison jeudi ${stamp}`, description: 'v1', scheduled_date: plusDays(houseWeek, 3), is_published: true, sort_order: 0, audience: 'all',
  });
  // Une seconde semaine maison pour la copie de semaine entière : un WOD maison
  // n'a qu'une copie par offre (index unique), la copier ailleurs la déplacerait.
  const houseWeek2 = plusDays(houseWeek, 7);
  const house2 = await insertOne('box_wods', {
    box_id: boxPub, created_by: pubOwner, title: `zz maison vendredi ${stamp}`, description: 'v1', scheduled_date: plusDays(houseWeek2, 4), is_published: true, sort_order: 0, audience: 'all',
  });
  const house3 = await insertOne('box_wods', {
    box_id: boxPub, created_by: pubOwner, title: `zz maison samedi ${stamp}`, description: 'v1', scheduled_date: plusDays(houseWeek2, 5), is_published: true, sort_order: 0, audience: 'all',
  });
  const { data: syncedId, error: syncErr } = await PUB.client.rpc('sync_wod_to_offer', { p_box_wod_id: house1, p_programming_id: offer, p_week: 2 });
  assert('le gérant éditeur synchronise un WOD maison dans la semaine 2', !syncErr && !!syncedId, motifDe(syncErr));
  {
    const { data } = await db.from('box_programming_wods').select('day_of_week, title, origin_box_wod_id').eq('id', syncedId).single();
    assert('la copie porte le jour déduit de la date (jeudi = 4) et son origine', data?.day_of_week === 4 && data?.origin_box_wod_id === house1, JSON.stringify(data));
  }
  {
    const { data: again } = await PUB.client.rpc('sync_wod_to_offer', { p_box_wod_id: house1, p_programming_id: offer, p_week: 2 });
    assert('re-synchroniser met à jour la même ligne (upsert)', again === syncedId);
  }
  {
    const { error } = await PUB.client.rpc('sync_wod_to_offer', { p_box_wod_id: house1, p_programming_id: offer, p_week: 4 });
    assert('semaine hors de l\'offre refusée', refus(error, 'hors de l\'offre'), motifDe(error));
  }
  {
    const { data, error } = await PUB.client.rpc('copy_week_to_offer', {
      p_source_kind: 'whiteboard', p_box_id: boxPub, p_source_monday: houseWeek2, p_template_id: null,
      p_programming_id: offer, p_week: 3, p_replace: true,
    });
    assert('copie d\'une semaine Whiteboard vers la semaine 3 : 2 copiés', !error && data?.copied === 2 && data?.replaced === 0, motifDe(error) + ' ' + JSON.stringify(data));
  }
  {
    const { data, error } = await PUB.client.rpc('copy_week_to_offer', {
      p_source_kind: 'whiteboard', p_box_id: boxPub, p_source_monday: houseWeek2, p_template_id: null,
      p_programming_id: offer, p_week: 3, p_replace: true,
    });
    assert('re-copie avec remplacement : 2 remplacés, 2 copiés', !error && data?.copied === 2 && data?.replaced === 2, motifDe(error) + ' ' + JSON.stringify(data));
  }

  {
    const { data, error } = await PUB.client.rpc('publish_programming', { p_id: offer, p_publish: true });
    assert('offre complète publiée', !error && data?.is_published === true, motifDe(error));
  }

  // ── 11. Autorisation : une autre box ne touche pas à l'offre ───────────────
  console.log('\n── 11. Non-éditeur ────────────────────────────────────────────────');
  {
    const { error } = await SUB.client.rpc('publish_programming', { p_id: offer, p_publish: false });
    assert('le gérant d\'une autre box ne dépublie pas', refus(error, 'Accès refusé'), motifDe(error));
  }
  {
    const { error } = await SUB.client.rpc('sync_wod_to_offer', { p_box_wod_id: legacyAll, p_programming_id: offer, p_week: 1 });
    assert('… ni ne synchronise dedans', refus(error, 'Accès refusé'), motifDe(error));
  }
  {
    const { error } = await SUB.client.rpc('copy_week_to_offer', {
      p_source_kind: 'whiteboard', p_box_id: boxSub, p_source_monday: THIS_MONDAY, p_template_id: null,
      p_programming_id: offer, p_week: 1, p_replace: false,
    });
    assert('… ni ne copie une semaine dedans', refus(error, 'Accès refusé'), motifDe(error));
  }
  {
    const { data: stillPublished } = await db.from('box_programming').select('is_published').eq('id', offer).single();
    assert('l\'offre est restée publiée (mutation inverse : rien n\'a bougé)', stillPublished?.is_published === true);
  }

  // ── 12. Abonnement gratuit : ancrage au lundi suivant ──────────────────────
  console.log('\n── 12. subscribe_free_programming ─────────────────────────────────');
  const { data: subRes, error: subErr } = await SUB.client.rpc('subscribe_free_programming', { p_programming_id: offer, p_subscriber_box_id: boxSub });
  if (subErr) throw new Error(`abonnement : ${subErr.message}`);
  const subId = subRes.subscription_id;
  assert(`ancrage = lundi suivant (${NEXT_MONDAY}), jamais le lundi courant`, (await sub(subId)).week_anchor === NEXT_MONDAY, (await sub(subId)).week_anchor);
  {
    const { data: emptySubRes, error } = await SUB.client.rpc('subscribe_free_programming', { p_programming_id: emptyOffer, p_subscriber_box_id: boxSub });
    if (error) throw new Error(`abonnement offre vide : ${error.message}`);
    var emptySubId = emptySubRes.subscription_id;
    await db.from('box_programming_subscriptions').update({ auto_apply_weekly: true }).eq('id', emptySubId);
  }
  await db.from('box_programming_subscriptions').update({ auto_apply_weekly: true, color: 'violet' }).eq('id', subId);
  {
    const { error } = await db.from('box_programming_subscriptions').update({ color: 'rouge' }).eq('id', subId);
    assert('couleur hors palette refusée', refus(error, 'box_prog_subs_color_check'), motifDe(error));
  }
  {
    const { data, error } = await SUB.client.rpc('list_applicable_programmings', { p_box_id: boxSub });
    const row = (data ?? []).find(r => r.subscription_id === subId);
    assert('list_applicable_programmings expose couleur, ancrage, WOD par semaine',
      !error && row?.color === 'violet' && row?.week_anchor === NEXT_MONDAY && JSON.stringify(row?.wod_counts) === '[2,2,2]',
      motifDe(error) + ' ' + JSON.stringify(row));
  }
  {
    const { data, error } = await SUB.client.rpc('list_programming_catalog', { p_box_id: boxSub });
    const row = (data ?? []).find(r => r.programming_id === offer);
    const own = (data ?? []).find(r => r.publisher_box_id === boxSub);
    assert('le catalogue montre l\'offre avec objectif, matériel, total et aperçu S1',
      !error && row?.goal === 'Construire la base' && row?.wods_total === 6 && row?.subscribed === true && Array.isArray(row?.preview_week1) && row.preview_week1.length === 2,
      motifDe(error) + ' ' + JSON.stringify(row));
    assert('… sans les offres de la box elle-même', !own);
  }

  // ── 3. Application manuelle S1, « ces groupes » K+ Perf ────────────────────
  console.log('\n── 3. apply_program_week semaine 1, groups ────────────────────────');
  {
    const { error } = await SUB.client.rpc('apply_program_week', {
      p_source_kind: 'subscription', p_source_id: subId, p_week: 1, p_target_monday: M1,
      p_audience: 'groups', p_group_ids: [], p_replace: false,
    });
    assert('groups sans groupe : refusé', refus(error, 'au moins un groupe'), motifDe(error));
  }
  {
    const { error } = await SUB.client.rpc('apply_program_week', {
      p_source_kind: 'subscription', p_source_id: subId, p_week: 1, p_target_monday: M1,
      p_audience: 'partout', p_group_ids: null, p_replace: false,
    });
    assert('audience inconnue : refusée', refus(error, 'Visibilité requise'), motifDe(error));
  }
  const { data: applied, error: applyErr } = await SUB.client.rpc('apply_program_week', {
    p_source_kind: 'subscription', p_source_id: subId, p_week: 1, p_target_monday: M1,
    p_audience: 'groups', p_group_ids: [kPerf], p_replace: false,
  });
  assert('semaine 1 posée : 2 cartes', !applyErr && applied?.inserted === 2, motifDe(applyErr));
  const week1 = await wodsOf(boxSub, M1, plusDays(M1, 7));
  assert('les cartes reçues portent audience = groups', week1.length === 2 && week1.every(w => w.audience === 'groups'), JSON.stringify(week1));
  assert('et la ligne wod_group_access K+ Perf', (await Promise.all(week1.map(w => groupsOf(w.id)))).every(g => g.length === 1 && g[0] === kPerf));
  {
    const s = await sub(subId);
    assert('l\'abonnement mémorise ancrage = M1, default_audience = groups, groupes = [K+]',
      s.week_anchor === M1 && s.default_audience === 'groups' && JSON.stringify(s.default_group_ids) === JSON.stringify([kPerf]), JSON.stringify(s));
  }
  assert('membre K+ voit la carte reçue', await sees(IN.client, 'box_wods', week1[0].id));
  assert('membre hors K+ ne la voit pas', !(await sees(OUT.client, 'box_wods', week1[0].id)));

  // ── 4. Semaine 3 sur M1+14 : l'ancrage ne bouge pas ────────────────────────
  console.log('\n── 4. apply_program_week semaine 3 sur M1+14 ───────────────────────');
  {
    const { data, error } = await SUB.client.rpc('apply_program_week', {
      p_source_kind: 'subscription', p_source_id: subId, p_week: 3, p_target_monday: plusDays(M1, 14),
      p_audience: 'all', p_group_ids: null, p_replace: false,
    });
    assert('semaine 3 posée en « toute la box »', !error && data?.inserted === 2, motifDe(error));
    const s = await sub(subId);
    assert('ancrage inchangé = M1 (M1+14 − 7·2), défaut désormais all sans groupe',
      s.week_anchor === M1 && s.default_audience === 'all' && s.default_group_ids.length === 0, JSON.stringify(s));
    const w3 = await wodsOf(boxSub, plusDays(M1, 14), plusDays(M1, 21));
    assert('cartes S3 en all, sans ligne de groupe', w3.every(w => w.audience === 'all') && (await groupsOf(w3[0].id)).length === 0);
    assert('membre hors K+ voit une carte S3', await sees(OUT.client, 'box_wods', w3[0].id));
  }
  // Retour au défaut « groups K+ » pour la pose auto (ce que fera le gérant NBS2).
  await db.from('box_programming_subscriptions').update({ default_audience: 'groups', default_group_ids: [kPerf] }).eq('id', subId);

  // ── 5. Pose automatique S2 (M1+7) ──────────────────────────────────────────
  console.log('\n── 5. materialize_box_programming(M1+7) ────────────────────────────');
  const M2 = plusDays(M1, 7);
  {
    const { error } = await SUB.client.rpc('materialize_box_programming', { p_target_monday: M2 });
    assert('un gérant (authenticated) ne lance pas le cron', refus(error, 'permission denied'), motifDe(error));
  }
  const { data: run1, error: run1Err } = await db.rpc('materialize_box_programming', { p_target_monday: M2 });
  assert('le cron pose la semaine 2 : 2 cartes (dont la copie synchronisée)', !run1Err && run1 === 2, motifDe(run1Err) + ' ' + run1);
  const week2 = await wodsOf(boxSub, M2, plusDays(M2, 7));
  const snapshot = week2.find(w => w.source_programming_wod_id === syncedId);
  assert('les cartes auto reprennent groups + K+ Perf', week2.length === 2 && week2.every(w => w.audience === 'groups') && (await groupsOf(week2[0].id))[0] === kPerf, JSON.stringify(week2));
  assert('la carte issue du WOD maison synchronisé est posée', !!snapshot);
  {
    const runs = await runsOf(subId);
    const r = runs.find(x => x.target_monday === M2 && x.note === 'inserted');
    assert('journal : ligne inserted=2, semaine 2', r?.inserted === 2 && r?.week_number === 2 && r?.skipped === 0, JSON.stringify(runs));
    const { data: mine } = await SUB.client.from('box_programming_runs').select('id').eq('subscription_id', subId);
    const { data: other } = await PUB.client.from('box_programming_runs').select('id').eq('subscription_id', subId);
    assert('le gérant abonné lit son journal, l\'éditeur non', (mine ?? []).length >= 1 && (other ?? []).length === 0);
  }
  {
    const { data: run2 } = await db.rpc('materialize_box_programming', { p_target_monday: M2 });
    const runs = await runsOf(subId);
    const again = runs.filter(x => x.target_monday === M2).at(-1);
    assert('rejeu : 0 insertion, 2 skipped, aucune carte en double',
      run2 === 0 && again?.note === 'skipped' && again?.skipped === 2 && (await wodsOf(boxSub, M2, plusDays(M2, 7))).length === 2, JSON.stringify(again));
  }
  {
    const { data: summary } = await db.from('box_programming_runs').select('*').is('subscription_id', null).eq('note', 'run').eq('target_monday', M2).gte('ran_at', T0);
    assert('ligne de synthèse par run (subscription_id NULL, note = run)', (summary ?? []).length === 2, JSON.stringify(summary));
  }

  // ── 6. Sans paramètre hors 18h Paris : rien ────────────────────────────────
  console.log('\n── 6. materialize_box_programming() hors 18h Paris ─────────────────');
  if (PARIS.hour === 18) {
    ok('(18h Paris : la garde horaire ne se teste pas à cette heure — cas non exécutable, compté neutre)');
    ok('(idem)');
  } else {
    const before = (await db.from('box_wods').select('id', { count: 'exact', head: true }).eq('box_id', boxSub)).count;
    const { data: noop, error } = await db.rpc('materialize_box_programming');
    const after = (await db.from('box_wods').select('id', { count: 'exact', head: true }).eq('box_id', boxSub)).count;
    assert('retour 0', !error && noop === 0, motifDe(error) + ' ' + noop);
    assert('aucune carte posée', before === after);
  }

  // ── 7. Offre vide : journal empty_week ─────────────────────────────────────
  console.log('\n── 7. Offre publiée sans contenu ──────────────────────────────────');
  {
    const runs = await runsOf(emptySubId);
    const r = runs.find(x => x.target_monday === M2);
    assert('journal empty_week pour l\'abonnement à l\'offre vide, 0 carte', r?.note === 'empty_week' && r?.inserted === 0, JSON.stringify(runs));
    const { data } = await db.from('box_wods').select('id').eq('box_id', boxSub).eq('source_programming_id', emptyOffer);
    assert('aucune carte issue de l\'offre vide', (data ?? []).length === 0);
  }

  // ── 9b. Le WOD maison change → la copie d'offre suit, le snapshot non ──────
  console.log('\n── 9b. Propagation maison → offre, snapshots intacts ────────────────');
  {
    const { error } = await PUB.client.from('box_wods').update({ title: `zz maison jeudi v2 ${stamp}`, description: 'v2' }).eq('id', house1);
    assert('le gérant éditeur modifie son WOD maison', !error, motifDe(error));
    const { data: copy } = await db.from('box_programming_wods').select('title, description').eq('id', syncedId).single();
    assert('la copie d\'offre est mise à jour', copy?.title === `zz maison jeudi v2 ${stamp}` && copy?.description === 'v2', JSON.stringify(copy));
    const { data: snap } = await db.from('box_wods').select('title, description').eq('id', snapshot.id).single();
    assert('la carte déjà posée chez l\'abonné reste un snapshot (v1)', snap?.title === `zz maison jeudi ${stamp}` && snap?.description === 'v1', JSON.stringify(snap));
    const { error: mvErr } = await PUB.client.from('box_wods').update({ scheduled_date: plusDays(houseWeek, 1) }).eq('id', house1);
    const { data: moved } = await db.from('box_programming_wods').select('day_of_week').eq('id', syncedId).single();
    assert('déplacer le WOD maison au mardi → day_of_week = 2 dans l\'offre', !mvErr && moved?.day_of_week === 2, motifDe(mvErr) + ' ' + JSON.stringify(moved));
    const { data: unsynced, error: unErr } = await PUB.client.rpc('unsync_wod_from_offer', { p_box_wod_id: house2, p_programming_id: offer });
    assert('unsync retire la copie du WOD vendredi de la semaine 3', !unErr && unsynced === 1, motifDe(unErr));
  }

  // ── 8. Verrou du contenu reçu ──────────────────────────────────────────────
  console.log('\n── 8. Cartes reçues : contenu verrouillé, date/ordre/audience libres ─');
  const card = week1[0];
  {
    const { error } = await SUB.client.from('box_wods').update({ title: 'zz piraté' }).eq('id', card.id);
    assert('modifier le titre d\'une carte reçue : refusé', refus(error, 'non modifiable'), motifDe(error));
    const { error: e2 } = await SUB.client.from('box_wods').update({ description: 'zz piraté' }).eq('id', card.id);
    assert('modifier la description : refusé', refus(e2, 'non modifiable'), motifDe(e2));
    const { data: intact } = await db.from('box_wods').select('title').eq('id', card.id).single();
    assert('le titre est intact', intact?.title === card.title);
  }
  {
    const { error } = await SUB.client.from('box_wods')
      .update({ scheduled_date: plusDays(card.scheduled_date, 1), sort_order: 5, audience: 'all', is_published: false })
      .eq('id', card.id);
    assert('déplacer, réordonner, changer l\'audience et la publication : accordé', !error, motifDe(error));
    await SUB.client.from('wod_group_access').delete().eq('wod_id', card.id);
    assert('le Manager qui pose all purge les groupes : plus aucune ligne', (await groupsOf(card.id)).length === 0);
  }
  {
    const { error } = await SUB.client.from('box_wods').delete().eq('id', card.id);
    assert('supprimer une carte reçue : accordé', !error && !(await sees(db, 'box_wods', card.id)), motifDe(error));
  }
  {
    // Une copie de semaine type (source = programmation de la box) reste du
    // contenu maison, modifiable.
    const { data: tpl, error: tplErr } = await SUB.client.rpc('save_week_as_template', {
      p_box_id: boxSub, p_source_monday: THIS_MONDAY, p_title: `zz tpl ${stamp}`,
    });
    if (tplErr) throw new Error(`semaine type : ${tplErr.message}`);
    const tplMonday = plusDays(M1, 7 * 10);
    const { error: aErr } = await SUB.client.rpc('apply_program_week', {
      p_source_kind: 'template', p_source_id: tpl.template_id, p_week: 1, p_target_monday: tplMonday,
      p_audience: 'none', p_group_ids: null, p_replace: false,
    });
    if (aErr) throw new Error(`application semaine type : ${aErr.message}`);
    const fromTpl = (await wodsOf(boxSub, tplMonday, plusDays(tplMonday, 7)))[0];
    const { error } = await SUB.client.from('box_wods').update({ title: 'zz retouché' }).eq('id', fromTpl.id);
    assert('une copie de semaine type reste modifiable (pas une carte Marketplace)', !error && fromTpl.audience === 'none', motifDe(error));
  }

  // ── 13. Programme athlète : none + rattachement → inscrits actifs ──────────
  console.log('\n── 13. Séance none rattachée à un programme : scores/classement ─────');
  const progWod = await insertOne('box_wods', {
    box_id: boxSub, created_by: subOwner, title: `zz prog seance ${stamp}`, scheduled_date: THIS_MONDAY, is_published: true, sort_order: 20, audience: 'none',
  });
  await insertOne('wod_program_access', { wod_id: progWod, program_id: program });
  const scoreB = await insertOne('wod_scores', { wod_id: progWod, member_id: progB, box_id: boxSub, score_type: 'reps', score_value: 120 });
  await insertOne('wod_completions', { wod_id: progWod, member_id: progB, box_id: boxSub });
  {
    const { data: lb } = await PA.client.from('wod_scores').select('id, member_id').eq('wod_id', progWod);
    assert('l\'inscrit actif voit la séance none rattachée', await sees(PA.client, 'box_wods', progWod));
    assert('… et le classement (score d\'un autre inscrit)', (lb ?? []).some(r => r.id === scoreB), JSON.stringify(lb));
    const { data: lbOut } = await OUT.client.from('wod_scores').select('id').eq('wod_id', progWod);
    assert('un membre de la box non inscrit ne voit ni la séance…', !(await sees(OUT.client, 'box_wods', progWod)));
    assert('… ni son classement', (lbOut ?? []).length === 0, JSON.stringify(lbOut));
  }
  {
    // Rattacher un WOD encore 'all' à un programme le ferme au reste de la box
    // (sémantique d'avant ce lot, conservée pour les écrivains legacy).
    const legacyProg = await insertOne('box_wods', {
      box_id: boxSub, created_by: subOwner, title: `zz legacy prog ${stamp}`, scheduled_date: THIS_MONDAY, is_published: true, sort_order: 21,
    });
    await insertOne('wod_program_access', { wod_id: legacyProg, program_id: program });
    assert('WOD all + rattachement programme (sans audience posée) → none', (await audienceOf(legacyProg)) === 'none');
    const relative = await insertOne('box_wods', {
      box_id: boxSub, created_by: subOwner, title: `zz relative ${stamp}`, scheduled_date: null, program_week: 1, program_day: 1, leaderboard_enabled: false, is_published: true, sort_order: 0, audience: 'all',
    });
    assert('une séance relative (sans date) est toujours none', (await audienceOf(relative)) === 'none');
  }

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
