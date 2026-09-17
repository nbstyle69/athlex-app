/**
 * test-box-archivage.mjs — une box archivée disparaît-elle VRAIMENT, sous de
 * vraies identités, et revient-elle intacte ?
 *
 * La question n'est pas rhétorique : `boxes` porte sept policies PERMISSIVE,
 * dont deux `USING (true)`. Un filtre ajouté à l'une d'elles n'aurait rien
 * refusé. C'est la policy RESTRICTIVE `boxes_hide_archived` qui porte le
 * masquage, et la MUTATION INVERSE ci-dessous est ce qui le prouve : policy
 * retirée → le membre revoit la box (rouge nommé) → migration rejouée → il ne
 * la voit plus.
 *
 * Ce que la suite exige :
 *   1. avant archivage : membre, gérant et anon voient la box ;
 *   2. après archivage : aucun des trois ne la voit, ni directement, ni par
 *      `get_user_box_ids()`, ni par `get_my_admin_boxes()` (les deux fonctions
 *      sont SECURITY DEFINER, donc hors policy : elles filtrent dans leur corps) ;
 *   3. le gérant ne peut plus ÉCRIRE sur sa box archivée ;
 *   4. `service_role` continue de la voir — sans quoi on ne pourrait pas la
 *      rouvrir depuis le back-office ;
 *   5. rien n'est perdu : réactivation → tout revient à l'identique ;
 *   6. MUTATION INVERSE de la policy.
 *
 * Usage : ./scripts/test-stack.sh up && node scripts/test-box-archivage.mjs
 * Cible fournie par TEST_SUPABASE_* + TEST_ADMIN_DB_URL (jamais la prod).
 */
import { execFileSync } from 'node:child_process';
import {
  requireTestTarget, serviceClient, anonClient, signInAs, createUser,
  createOwnedBox, dropBoxAndOwner, onCleanup, runCleanup, installCleanupTraps,
} from './lib/test-env.mjs';

requireTestTarget();
installCleanupTraps();

const DB_URL = process.env.TEST_ADMIN_DB_URL;
if (!DB_URL) { console.error('TEST_ADMIN_DB_URL manquant'); process.exit(1); }
if (DB_URL.includes('supabase.co')) { console.error('TEST_ADMIN_DB_URL pointe la production — refus.'); process.exit(1); }

const MIGRATION = 'supabase/migrations/20261224000000_boxes_archivage.sql';

const db = serviceClient();
// Suffixe court et aléatoire : `createOwnedBox` tronque l'invite_code à 10
// caractères, et un horodatage complet y devient un préfixe commun qui
// entre en collision d'un essai à l'autre.
const stamp = Math.random().toString(36).slice(2, 8);
const PWD = `zzArchivage!${stamp}`;

let passed = 0;
let failed = 0;
let ATTENDU = null;

function assert(label, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  ✅ ${label}`); }
  else { failed += 1; console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function sql(query) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', query], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const msg = (r) => r?.error?.message ?? '';

async function main() {
  // ── Jeu d'essai : un gérant, sa box, un membre actif ──────────────────────
  const ownerEmail = `zz_arch_owner_${stamp}@test.local`;
  const memberEmail = `zz_arch_member_${stamp}@test.local`;
  const ownerId = await createUser(db, {
    email: ownerEmail, password: PWD, username: `zz_arch_owner_${stamp}`, role: 'box_owner',
  });
  const memberId = await createUser(db, {
    email: memberEmail, password: PWD, username: `zz_arch_member_${stamp}`,
  });
  const boxId = await createOwnedBox(db, { tag: `arch${stamp}`, ownerId });
  onCleanup(() => dropBoxAndOwner(db, boxId, ownerId));
  onCleanup(() => db.auth.admin.deleteUser(memberId));

  await db.from('boxes').update({ is_listed: true, is_active: true, city: 'Lyon' }).eq('id', boxId);
  await db.from('box_members').insert({ box_id: boxId, member_id: memberId, role: 'member', status: 'active' });

  const { client: asOwner } = await signInAs(ownerEmail, PWD);
  const { client: asMember } = await signInAs(memberEmail, PWD);
  const anon = anonClient();

  const voitBox = (client) => client.from('boxes').select('id').eq('id', boxId);

  // ── 1. Avant archivage ────────────────────────────────────────────────────
  const avantMembre = await voitBox(asMember);
  const avantAnon = await voitBox(anon);
  const avantAdmin = await asOwner.rpc('get_my_admin_boxes');
  const avantIds = await asMember.rpc('get_user_box_ids');

  // ── 2. Archivage (comme la route admin : service_role) ────────────────────
  await db.from('boxes')
    .update({ archived_at: new Date().toISOString(), archived_by: ownerId })
    .eq('id', boxId);

  const apresMembre = await voitBox(asMember);
  const apresAnon = await voitBox(anon);
  const apresOwner = await voitBox(asOwner);
  const apresAdmin = await asOwner.rpc('get_my_admin_boxes');
  const apresIds = await asMember.rpc('get_user_box_ids');

  // ── 3. Écriture par le gérant sur une box archivée ────────────────────────
  const ecriture = await asOwner.from('boxes').update({ city: 'Piratée' }).eq('id', boxId).select('id');
  const villeApresTentative = sql(`select coalesce(city,'(null)') from public.boxes where id='${boxId}'`);

  // ── 4. service_role ───────────────────────────────────────────────────────
  const serviceVoit = await db.from('boxes').select('id, name, city').eq('id', boxId);

  // ── 5. Réactivation ───────────────────────────────────────────────────────
  await db.from('boxes').update({ archived_at: null, archived_by: null }).eq('id', boxId);
  const reMembre = await voitBox(asMember);
  const reIds = await asMember.rpc('get_user_box_ids');
  const reAdmin = await asOwner.rpc('get_my_admin_boxes');

  // ── 6. Mutation inverse : sans la policy, le masquage tombe ───────────────
  await db.from('boxes').update({ archived_at: new Date().toISOString() }).eq('id', boxId);
  sql('DROP POLICY IF EXISTS boxes_hide_archived ON public.boxes;');
  const sansPolicy = await voitBox(asMember);
  execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', MIGRATION], { stdio: 'ignore' });
  const policyRejouee = await voitBox(asMember);
  await db.from('boxes').update({ archived_at: null }).eq('id', boxId);

  const n = (r) => (r.data ?? []).length;
  const ASSERTIONS = [
    ['avant archivage : le membre voit la box', n(avantMembre) === 1, msg(avantMembre)],
    ['avant archivage : anon voit la box listée', n(avantAnon) === 1, msg(avantAnon)],
    ['avant archivage : le gérant l’a dans get_my_admin_boxes', n(avantAdmin) === 1, msg(avantAdmin)],
    ['avant archivage : get_user_box_ids la rend au membre', n(avantIds) === 1, msg(avantIds)],

    ['archivée : le membre ne la voit plus', n(apresMembre) === 0, `rows=${n(apresMembre)}`],
    ['archivée : anon ne la voit plus', n(apresAnon) === 0, `rows=${n(apresAnon)}`],
    ['archivée : le gérant ne la voit plus non plus', n(apresOwner) === 0, `rows=${n(apresOwner)}`],
    ['archivée : absente de get_my_admin_boxes (SECURITY DEFINER filtré)', n(apresAdmin) === 0, `rows=${n(apresAdmin)}`],
    ['archivée : absente de get_user_box_ids (SECURITY DEFINER filtré)', n(apresIds) === 0, `rows=${n(apresIds)}`],

    ['archivée : le gérant ne peut plus l’écrire', n(ecriture) === 0, `rows=${n(ecriture)}`],
    ['archivée : la donnée n’a pas bougé', villeApresTentative === 'Lyon', villeApresTentative],

    ['archivée : service_role la voit toujours', n(serviceVoit) === 1, msg(serviceVoit)],
    ['archivée : ses données sont intactes', serviceVoit.data?.[0]?.city === 'Lyon', String(serviceVoit.data?.[0]?.city)],

    ['réactivée : le membre la revoit', n(reMembre) === 1, msg(reMembre)],
    ['réactivée : get_user_box_ids la rend de nouveau', n(reIds) === 1, msg(reIds)],
    ['réactivée : le gérant la retrouve', n(reAdmin) === 1, msg(reAdmin)],

    ['mutation inverse : sans la policy, le membre revoit la box archivée', n(sansPolicy) === 1, `rows=${n(sansPolicy)}`],
    ['mutation inverse : migration rejouée, il ne la voit plus', n(policyRejouee) === 0, `rows=${n(policyRejouee)}`],
  ];

  ATTENDU = ASSERTIONS.length;
  console.log('\n── Archivage de box ──');
  for (const [label, ok, detail] of ASSERTIONS) assert(label, ok, detail);
}

process.on('exit', () => {
  const total = passed + failed;
  console.log(`\n=== ${passed} ✅ · ${failed} ❌ ===`);
  console.log(`BOX_ARCHIVAGE_ASSERTIONS=${total}/${ATTENDU ?? '?'}`);
  if (ATTENDU === null || total !== ATTENDU) { console.log(`  ❌ suite incomplète — ${total}/${ATTENDU ?? '?'}`); process.exitCode = 1; }
  else if (failed > 0) process.exitCode = 1;
});

main()
  .catch((err) => { console.error('\n💥', err.message); process.exitCode = 1; })
  .finally(runCleanup);
