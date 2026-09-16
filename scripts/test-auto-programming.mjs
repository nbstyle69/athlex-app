/**
 * test-auto-programming.mjs — J1 : le socle serveur de la programmation
 * automatique tient-il dans la BASE, sous de vraies identités ?
 *
 * Ce que la suite exige (chaque refus par son MESSAGE, jamais « error != null ») :
 *   1. les flags `boxes.auto_programming*` : le gérant, qui peut modifier sa
 *      box, est refusé s'il touche aux flags (message nommé, 42501) ; il
 *      modifie encore son nom (contrôle positif) ; un profil admin et le
 *      service_role passent ;
 *   2. MUTATION INVERSE : trigger retiré → le gérant passe (rouge nommé) →
 *      rejeu de la migration → refus de nouveau ;
 *   3. `box_auto_programming_runs` : le gérant lit sa run, pas celle d'autrui ;
 *      anon et authenticated sont refusés à l'écriture PAR LE GRANT
 *      (`permission denied for table`) ; la clé unique porte l'idempotence ;
 *   4. `box_wods` : `source` contraint ; une ligne auto modifiée par le gérant
 *      reçoit `edited_at`, la même ligne modifiée par le backend non ;
 *   5. `publish_at` : un membre ne voit pas un jour auto avant la révélation
 *      (dimanche 18:00), le voit après ; l'anon jamais.
 *
 * Usage : ./scripts/test-stack.sh up && node scripts/test-auto-programming.mjs
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

const MIGRATION = 'supabase/migrations/20261216000000_box_auto_programming.sql';
const REFUS_FLAGS = 'Accès refusé : programmation automatique réservée à un administrateur';

const db = serviceClient();
const stamp = Date.now();
const PASSWORD = 'TestAutoProg1234!';

let passed = 0; let failed = 0; let ATTENDU = null;
function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); if (detail) console.log(`     → ${detail}`); failed++; }
}
function psql(sql) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-tA', '-q', '-c', sql], { encoding: 'utf8' }).trim();
}
function psqlFile(file) {
  execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  psql("NOTIFY pgrst, 'reload schema';");
}
const msg = (r) => r.error ? r.error.message : 'aucune erreur';

async function main() {
  const mk = (s) => `zz_ap_${s}_${stamp}@test.athlex.local`;
  const ownerA = await createUser(db, { email: mk('owa'), password: PASSWORD, username: `zz_ap_owa_${stamp}`, role: 'box_owner' });
  const ownerB = await createUser(db, { email: mk('owb'), password: PASSWORD, username: `zz_ap_owb_${stamp}`, role: 'box_owner' });
  const boxA = await createOwnedBox(db, { tag: `ap-a-${stamp}`, ownerId: ownerA });
  const boxB = await createOwnedBox(db, { tag: `ap-b-${stamp}`, ownerId: ownerB });
  onCleanup(() => dropBoxAndOwner(db, boxA, ownerA));
  onCleanup(() => dropBoxAndOwner(db, boxB, ownerB));
  // Profil admin de test, sur la pile jetable seulement (jamais en prod).
  const admin = await createUser(db, { email: mk('adm'), password: PASSWORD, username: `zz_ap_adm_${stamp}`, role: 'admin' });
  const boxC = await createOwnedBox(db, { tag: `ap-c-${stamp}`, ownerId: admin });
  onCleanup(() => dropBoxAndOwner(db, boxC, admin));
  const member = await createUser(db, { email: mk('mb'), password: PASSWORD, username: `zz_ap_mb_${stamp}` });
  onCleanup(() => db.auth.admin.deleteUser(member));
  const { error: memErr } = await db.from('box_members').insert({ box_id: boxA, member_id: member, role: 'member', status: 'active' });
  if (memErr) throw new Error(`box_members : ${memErr.message}`);

  const { client: gerant } = await signInAs(mk('owa'), PASSWORD);
  const { client: gerantB } = await signInAs(mk('owb'), PASSWORD);
  const { client: adm } = await signInAs(mk('adm'), PASSWORD);
  const { client: membre } = await signInAs(mk('mb'), PASSWORD);
  const anon = anonClient();

  console.log('\n=== J1 — programmation automatique : flags, journal, box_wods auto, publish_at ===\n');

  // ── 1. Flags de box ────────────────────────────────────────────────────────
  const flagsAvant = psql(`select auto_programming::text || '|' || array_to_string(auto_programming_tracks, ',') from boxes where id='${boxA}'`);
  const gerantFlag = await gerant.from('boxes').update({ auto_programming: true }).eq('id', boxA).select('id');
  const gerantTracks = await gerant.from('boxes').update({ auto_programming_tracks: ['crossfit'] }).eq('id', boxA).select('id');
  const flagsApres = psql(`select auto_programming::text || '|' || array_to_string(auto_programming_tracks, ',') from boxes where id='${boxA}'`);
  const gerantNom = await gerant.from('boxes').update({ name: `[TEST] Box ap-a-${stamp} renommée` }).eq('id', boxA).select('name').single();
  const admFlag = await adm.from('boxes').update({ auto_programming: true, auto_programming_tracks: ['crossfit', 'musculation'] }).eq('id', boxA).select('auto_programming, auto_programming_tracks');
  const flagsAdmin = psql(`select auto_programming::text || '|' || array_to_string(auto_programming_tracks, ',') from boxes where id='${boxA}'`);
  const admOwnFlag = await adm.from('boxes').update({ auto_programming: true, auto_programming_tracks: ['crossfit', 'musculation'] }).eq('id', boxC).select('auto_programming');
  const flagsAdminOwn = psql(`select auto_programming::text || '|' || array_to_string(auto_programming_tracks, ',') from boxes where id='${boxC}'`);
  const svcFlag = await db.from('boxes').update({ auto_programming: true, auto_programming_tracks: ['musculation'] }).eq('id', boxB).select('auto_programming').single();
  const badTrack = await db.from('boxes').update({ auto_programming_tracks: ['yoga'] }).eq('id', boxB).select('id');

  // ── 2. Mutation inverse : trigger retiré, le gérant passe ; migration rejouée, refus ──
  psql('DROP TRIGGER IF EXISTS boxes_auto_programming_guard ON public.boxes;');
  const sabote = await gerantB.from('boxes').update({ auto_programming: false }).eq('id', boxB).select('auto_programming').single();
  psqlFile(MIGRATION);
  const restaure = await gerantB.from('boxes').update({ auto_programming: true }).eq('id', boxB).select('id');
  const flagsB = psql(`select auto_programming::text from boxes where id='${boxB}'`);

  // ── 3. Journal des runs ────────────────────────────────────────────────────
  const runIns = await db.from('box_auto_programming_runs').insert({
    box_id: boxA, track: 'crossfit', iso_year: 2027, iso_week: 11, generator_version: '1.0.0', seed: 42, status: 'done',
  }).select('id').single();
  if (runIns.error) throw new Error(`run : ${runIns.error.message}`);
  const runId = runIns.data.id;
  const runDup = await db.from('box_auto_programming_runs').insert({
    box_id: boxA, track: 'crossfit', iso_year: 2027, iso_week: 11, generator_version: '1.0.0', seed: 43,
  }).select('id');
  const runUpsert = await db.from('box_auto_programming_runs').upsert({
    box_id: boxA, track: 'crossfit', iso_year: 2027, iso_week: 11, generator_version: '1.0.0', seed: 99, regen_counter: 1, status: 'running',
  }, { onConflict: 'box_id,track,iso_year,iso_week' }).select('id, seed, regen_counter').single();
  const runVuGerant = await gerant.from('box_auto_programming_runs').select('id').eq('box_id', boxA);
  const runVuAutre = await gerantB.from('box_auto_programming_runs').select('id').eq('box_id', boxA);
  const runVuMembre = await membre.from('box_auto_programming_runs').select('id').eq('box_id', boxA);
  const runAnon = await anon.from('box_auto_programming_runs').select('id').eq('box_id', boxA);
  const runInsGerant = await gerant.from('box_auto_programming_runs').insert({
    box_id: boxA, track: 'musculation', iso_year: 2027, iso_week: 11, generator_version: '1.0.0', seed: 1,
  }).select('id');
  const runUpdGerant = await gerant.from('box_auto_programming_runs').update({ status: 'skipped' }).eq('id', runId).select('id');
  const runsCount = psql(`select count(*) from box_auto_programming_runs where box_id='${boxA}'`);
  const runStatus = psql(`select status from box_auto_programming_runs where id='${runId}'`);

  // ── 4. box_wods auto ───────────────────────────────────────────────────────
  const future = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const passe = new Date(Date.now() - 3600 * 1000).toISOString();
  const wodBase = {
    box_id: boxA, created_by: ownerA, wod_type: 'amrap', scheduled_date: '2027-03-16', block_name: 'wod',
    is_published: true, audience: 'all', source: 'auto', auto_run_id: runId, leaderboard_enabled: true,
  };
  const wodFutur = await db.from('box_wods').insert({ ...wodBase, title: 'J1 AUTO FUTUR', description: '10 min AMRAP\n10 Burpees', publish_at: future }).select('id').single();
  const wodPasse = await db.from('box_wods').insert({ ...wodBase, title: 'J1 AUTO PASSÉ', description: '10 min AMRAP\n10 Burpees', publish_at: passe }).select('id').single();
  if (wodFutur.error || wodPasse.error) throw new Error(`box_wods : ${wodFutur.error?.message ?? wodPasse.error?.message}`);
  const badSource = await db.from('box_wods').insert({ ...wodBase, title: 'J1 BAD', description: 'x', publish_at: passe, source: 'robot' }).select('id');
  const svcEdit = await db.from('box_wods').update({ description: '10 min AMRAP\n12 Burpees' }).eq('id', wodPasse.data.id).select('edited_at').single();
  const gerantEdit = await gerant.from('box_wods').update({ description: '10 min AMRAP\n15 Burpees' }).eq('id', wodPasse.data.id).select('edited_at').single();
  const editedAt = psql(`select coalesce(edited_at::text, 'null') from box_wods where id='${wodPasse.data.id}'`);
  const editedFutur = psql(`select coalesce(edited_at::text, 'null') from box_wods where id='${wodFutur.data.id}'`);

  // ── 5. publish_at ──────────────────────────────────────────────────────────
  const membreVoit = await membre.from('box_wods').select('id, title').eq('box_id', boxA).in('id', [wodFutur.data.id, wodPasse.data.id]);
  const anonVoit = await anon.from('box_wods').select('id').eq('box_id', boxA);
  const gerantVoit = await gerant.from('box_wods').select('id').eq('box_id', boxA).in('id', [wodFutur.data.id, wodPasse.data.id]);
  const membreIds = (membreVoit.data ?? []).map((r) => r.id);

  const ASSERTIONS = [
    ['gérant : refusé sur auto_programming, message nommé', () => !!gerantFlag.error && gerantFlag.error.message.includes(REFUS_FLAGS), () => msg(gerantFlag)],
    ['gérant : refusé sur auto_programming_tracks, message nommé', () => !!gerantTracks.error && gerantTracks.error.message.includes(REFUS_FLAGS), () => msg(gerantTracks)],
    ['gérant : les flags n’ont pas bougé (invariant avant/après)', () => flagsAvant === flagsApres && flagsAvant === 'false|', () => `${flagsAvant} → ${flagsApres}`],
    ['gérant : renomme encore sa box (contrôle positif, le trigger ne bloque que les flags)', () => !gerantNom.error && /renommée/.test(gerantNom.data?.name ?? ''), () => msg(gerantNom)],
    ['profil admin sur une box qu’il ne possède pas : 0 ligne (RLS boxes = propriétaire), flags intacts', () => !admFlag.error && (admFlag.data ?? []).length === 0 && flagsAdmin === 'false|', () => `${msg(admFlag)} · ${(admFlag.data ?? []).length} ligne(s) · base=${flagsAdmin}`],
    ['profil admin sur sa propre box : le trigger le laisse poser les deux flags', () => !admOwnFlag.error && flagsAdminOwn === 'true|crossfit,musculation', () => `${msg(admOwnFlag)} · base=${flagsAdminOwn}`],
    ['service_role (fonction edge / backend) : passe', () => !svcFlag.error && svcFlag.data?.auto_programming === true, () => msg(svcFlag)],
    ['CHECK tracks : « yoga » refusé', () => !!badTrack.error && /boxes_auto_programming_tracks_check/.test(badTrack.error.message), () => msg(badTrack)],
    ['MUTATION INVERSE : trigger retiré → le gérant passe (rouge nommé)', () => !sabote.error && sabote.data?.auto_programming === false, () => msg(sabote)],
    ['migration rejouée → le gérant est refusé de nouveau, message nommé', () => !!restaure.error && restaure.error.message.includes(REFUS_FLAGS), () => msg(restaure)],
    ['après restauration : la valeur sabotée (false) est restée, la tentative n’a rien écrit', () => flagsB === 'false', () => flagsB],
    ['journal : clé unique box × piste × année × semaine (doublon refusé)', () => !!runDup.error && /duplicate key|box_auto_programming_runs_box_id_track_iso_year_iso_week_key/.test(runDup.error.message), () => msg(runDup)],
    ['journal : upsert ON CONFLICT conserve l’id de la run (auto_run_id des jours gardés reste valide)', () => !runUpsert.error && runUpsert.data?.id === runId && runUpsert.data?.regen_counter === 1, () => `${msg(runUpsert)} id=${runUpsert.data?.id}`],
    ['journal : le gérant lit la run de sa box', () => !runVuGerant.error && runVuGerant.data?.length === 1, () => `${msg(runVuGerant)} rows=${runVuGerant.data?.length}`],
    ['journal : le gérant d’une autre box ne voit rien', () => !runVuAutre.error && runVuAutre.data?.length === 0, () => `${msg(runVuAutre)} rows=${runVuAutre.data?.length}`],
    ['journal : un membre simple ne voit rien', () => !runVuMembre.error && runVuMembre.data?.length === 0, () => `${msg(runVuMembre)} rows=${runVuMembre.data?.length}`],
    ['journal : anon refusé par le grant (permission denied for table)', () => !!runAnon.error && /permission denied for table/i.test(runAnon.error.message), () => msg(runAnon)],
    ['journal : INSERT du gérant refusé par le grant', () => !!runInsGerant.error && /permission denied for table/i.test(runInsGerant.error.message), () => msg(runInsGerant)],
    ['journal : UPDATE du gérant refusé par le grant', () => !!runUpdGerant.error && /permission denied for table/i.test(runUpdGerant.error.message), () => msg(runUpdGerant)],
    ['journal : une seule run, statut intact (invariant après)', () => runsCount === '1' && runStatus === 'running', () => `count=${runsCount} status=${runStatus}`],
    ['box_wods.source : « robot » refusé par le CHECK', () => !!badSource.error && /box_wods_source_check/.test(badSource.error.message), () => msg(badSource)],
    ['ligne auto modifiée par le backend : edited_at reste null', () => !svcEdit.error && svcEdit.data?.edited_at === null, () => `${msg(svcEdit)} edited_at=${svcEdit.data?.edited_at}`],
    ['ligne auto modifiée par le gérant : edited_at posé par le trigger', () => !gerantEdit.error && editedAt !== 'null', () => `${msg(gerantEdit)} edited_at=${editedAt}`],
    ['ligne auto non touchée : edited_at null', () => editedFutur === 'null', () => editedFutur],
    ['publish_at : le membre voit le jour révélé, pas celui à venir', () => !membreVoit.error && membreIds.length === 1 && membreIds[0] === wodPasse.data.id, () => `${msg(membreVoit)} ids=${membreIds.join(',')}`],
    ['publish_at : le gérant voit les deux (il programme)', () => !gerantVoit.error && gerantVoit.data?.length === 2, () => `${msg(gerantVoit)} rows=${gerantVoit.data?.length}`],
    ['anon : aucun box_wods', () => (anonVoit.data ?? []).length === 0, () => `${msg(anonVoit)} rows=${anonVoit.data?.length}`],
  ];
  ATTENDU = ASSERTIONS.length;
  for (const [label, test, detail] of ASSERTIONS) assert(label, test(), detail ? detail() : '');
}

process.on('exit', () => {
  const total = passed + failed;
  console.log(`\n=== ${passed} ✅ · ${failed} ❌ ===`);
  console.log(`AUTO_PROGRAMMING_ASSERTIONS=${total}/${ATTENDU ?? '?'}`);
  if (ATTENDU === null || total !== ATTENDU) { console.log(`  ❌ suite incomplète — ${total}/${ATTENDU ?? '?'}`); process.exitCode = 1; }
  else if (failed > 0) process.exitCode = 1;
});

main()
  .catch((err) => { console.error('\n💥', err.message); process.exitCode = 1; })
  .finally(runCleanup);
