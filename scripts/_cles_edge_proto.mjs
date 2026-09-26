// Protocole « les huit fonctions edge marchent avec la nouvelle clé secrète
// comme avec l'ancienne, et refusent toujours un appel sans authentification »
// — pile LOCALE jetable, VRAIES fonctions servies par `supabase functions serve`.
//
//   bash scripts/test-stack.sh up && node scripts/_cles_edge_proto.mjs
//
// Trois passages, fonctions redémarrées à chaque fois :
//   * nouvelle  — la plateforme injecte SUPABASE_SECRET_KEYS (état après la
//                 création des clés sb_secret_ en prod) ;
//   * ancienne  — SUPABASE_SECRET_KEYS retirée au démarrage (état de la prod
//                 AVANT la création des nouvelles clés) : repli sur
//                 SUPABASE_SERVICE_ROLE_KEY ;
//   * invalide  — contre-exemple : SUPABASE_SECRET_KEYS.default est une fausse
//                 clé. Tout ce qui réussit dans les deux premiers passages doit
//                 y échouer, sinon les réussites ne prouvaient rien.
// Le mode est forcé dans une COPIE temporaire du dossier des fonctions (la seule
// lecture de SUPABASE_SECRET_KEYS y est remplacée), jamais dans le dépôt, et une
// sonde servie avec elles dit quelle forme de clé `cleSecrete()` a rendue.
//
// Côté appelant, les deux types de clé publique sont joués (apikey
// sb_publishable_ et JWT anon), et les appels sans authentification ou avec une
// clé à la place d'un jeton d'utilisateur doivent être refusés par la fonction
// elle-même (`verify_jwt = false`, versionné dans supabase/config.toml).
//
// Aucune clé n'est jamais écrite : seulement des formes (sb_secret_, JWT…).
import { createClient } from '@supabase/supabase-js';
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const RACINE = path.resolve(import.meta.dirname, '..');
const sh = (args) => execFileSync('npx', args.map((a) => `"${a}"`), { cwd: RACINE, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const statut = Object.fromEntries(sh(['supabase', 'status', '-o', 'env']).split('\n')
  .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const URL = statut.API_URL;
const CLES = { anon: statut.ANON_KEY, service: statut.SERVICE_ROLE_KEY, publishable: statut.PUBLISHABLE_KEY, secret: statut.SECRET_KEY };
if (!URL || !/^http:\/\/127\.0\.0\.1:/.test(URL)) { console.error('❌ la cible n\'est pas la pile locale — refusé'); process.exit(1); }
const forme = (v) => (!v ? 'absente' : v.startsWith('sb_secret_') ? 'sb_secret_' : v.startsWith('sb_publishable_') ? 'sb_publishable_' : v.startsWith('eyJ') ? 'JWT' : 'autre');
for (const [nom, attendu] of [['anon', 'JWT'], ['service', 'JWT'], ['publishable', 'sb_publishable_'], ['secret', 'sb_secret_']]) {
  if (forme(CLES[nom]) !== attendu) { console.error(`❌ clé locale ${nom} : ${forme(CLES[nom])}, attendu ${attendu}`); process.exit(1); }
}

let ok = 0, ko = 0;
const check = (nom, pass, detail = '') => {
  console.log(`${pass ? '✅' : '❌'} ${nom}${detail ? ' — ' + detail : ''}`);
  pass ? ok++ : ko++;
};

// ── Copie de travail des fonctions ─────────────────────────────────────────
const CRON_SECRET = `zz-cles-${Date.now()}`;
// Ce que rend la lecture de SUPABASE_SECRET_KEYS dans chaque mode. L'edge
// runtime ignore un `Deno.env.set/delete` fait par une fonction : on remplace
// donc cette seule expression, dans la copie.
const LECTURE = "Deno.env.get('SUPABASE_SECRET_KEYS')";
const MODES = {
  nouvelle: LECTURE,
  ancienne: 'undefined',
  invalide: `JSON.stringify({ default: 'sb_secret_' + 'x'.repeat(31) })`,
};
// La sonde rend aussi le passage en cours : une réponse de l'ancien runtime ne
// peut pas être prise pour celle du nouveau.
const SONDE = `import { cleSecrete } from '../_shared/cle-secrete.ts';
const forme = (v) => (!v ? 'absente' : v.startsWith('sb_secret_') ? 'sb_secret_' : v.startsWith('eyJ') ? 'JWT' : 'autre');
Deno.serve(() => {
  const passage = Deno.env.get('ZZ_PASSAGE');
  try { return Response.json({ passage, cle: forme(cleSecrete()) }); } catch (e) { return Response.json({ passage, cle: String(e) }); }
});
`;

function copieDeTravail(mode) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'athlex-cles-'));
  fs.mkdirSync(path.join(w, 'supabase'));
  fs.cpSync(path.join(RACINE, 'supabase/functions'), path.join(w, 'supabase/functions'), { recursive: true });
  fs.writeFileSync(path.join(w, 'supabase/config.toml'),
    fs.readFileSync(path.join(RACINE, 'supabase/config.toml'), 'utf8') + '\n[functions.zz-sonde]\nverify_jwt = false\n');
  // Même allègement que scripts/deploy-edge.mjs : la CLI échoue en EISDIR sur
  // les lignes type-only qui visent le moteur.
  const gbw = path.join(w, 'supabase/functions/generate-box-week/index.ts');
  fs.writeFileSync(gbw, fs.readFileSync(gbw, 'utf8')
    .replace(/^\/\/ @deno-types="\.\.\/\.\.\/\.\.\/[^"]+"\n/gm, '')
    .replace(/^import type \{[\s\S]*?\} from '\.\.\/\.\.\/\.\.\/[^']+';\n/gm, ''));
  const partage = path.join(w, 'supabase/functions/_shared/cle-secrete.ts');
  const source = fs.readFileSync(partage, 'utf8');
  if (source.split(LECTURE).length !== 2) throw new Error('cle-secrete.ts : la lecture de SUPABASE_SECRET_KEYS n\'est plus unique');
  fs.writeFileSync(partage, source.replace(LECTURE, MODES[mode]));
  fs.mkdirSync(path.join(w, 'supabase/functions/zz-sonde'));
  fs.writeFileSync(path.join(w, 'supabase/functions/zz-sonde/index.ts'), SONDE);
  fs.writeFileSync(path.join(w, 'functions.env'), `CRON_SECRET=${CRON_SECRET}\nANTHROPIC_API_KEY=local-factice\nZZ_PASSAGE=${mode}\n`);
  return w;
}

const RUNTIME = 'supabase_edge_runtime_battlewod';
const arreterRuntime = async () => {
  try { execFileSync('docker', ['rm', '-f', RUNTIME], { stdio: 'ignore' }); } catch { /* déjà arrêté */ }
  for (let i = 0; i < 40; i++) {
    if (!execFileSync('docker', ['ps', '-aq', '--filter', `name=${RUNTIME}`], { encoding: 'utf8' }).trim()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
};
// Sous Windows, `proc.kill()` n'arrête que le shell : le `supabase functions serve`
// survivrait au passage et se battrait avec le suivant. On arrête tout l'arbre.
const arreterServe = (proc) => {
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' }); } catch { /* déjà arrêté */ }
  } else proc.kill();
};

let enCours = null;
async function servir(w, mode) {
  await arreterRuntime();
  const proc = spawn('npx', ['supabase', 'functions', 'serve', '--workdir', `"${w}"`, '--env-file', `"${path.join(w, 'functions.env')}"`],
    { cwd: w, shell: true, stdio: 'ignore' });
  enCours = proc;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${URL}/functions/v1/zz-sonde`);
      const j = await r.json().catch(() => null);
      if (j?.passage === mode && j?.cle) return { proc, cle: j.cle };
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('fonctions injoignables');
}

const appel = async (fn, headers = {}, body = {}) => {
  const r = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

// ── Décor ──────────────────────────────────────────────────────────────────
const svc = createClient(URL, CLES.secret, { auth: { persistSession: false } });
const cree = { users: [], boxes: [] };
const heure = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

async function decor(tag) {
  const stamp = `${tag}_${Date.now()}`;
  const utilisateur = async (s) => {
    const email = `zz_cles_${s}_${stamp}@test.athlex.io`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: 'Test1234!', email_confirm: true });
    if (error) throw error;
    const { error: pErr } = await svc.from('profiles').upsert({ id: data.user.id, email, username: `zz_cles_${s}_${stamp}`, level: 'inter', role: 'member' });
    if (pErr) throw pErr;
    await svc.from('push_tokens').insert({ user_id: data.user.id, token: `ExponentPushToken[zz-cles-${s}-${stamp}]`, platform: 'android' });
    cree.users.push(data.user.id);
    return { id: data.user.id, email };
  };
  const gerant = await utilisateur('own');
  const membre = await utilisateur('mbr');
  const { data: box, error: bErr } = await svc.from('boxes').insert({
    owner_id: gerant.id, name: `ZZ CLES ${stamp}`, slug: `zz-cles-${stamp}`.replace(/_/g, '-'),
    invite_code: `ZC${String(Date.now()).slice(-5)}${tag[0].toUpperCase()}`, is_active: true, city: 'Lyon',
  }).select('id').single();
  if (bErr) throw bErr;
  cree.boxes.push(box.id);
  const { error: mErr } = await svc.from('box_members').insert({ box_id: box.id, member_id: membre.id, role: 'member', status: 'active' });
  if (mErr) throw mErr;
  const { data: notif, error: nErr } = await svc.from('box_notifications').insert({ box_id: box.id, title: 'ZZ', body: 'ZZ', target: 'all' }).select('id').single();
  if (nErr) throw nErr;
  const { data: tournoi, error: tErr } = await svc.from('tournaments').insert({
    name: `ZZ Cles ${stamp}`, box_id: box.id, created_by: gerant.id, status: 'active', level: 'rx', format: 'simple', start_date: iso(Date.now() - 2 * heure),
  }).select('id').single();
  if (tErr) throw tErr;
  await svc.from('tournament_participants').insert({ tournament_id: tournoi.id, athlete_id: membre.id });
  const { data: wod, error: wErr } = await svc.from('tournament_wods').insert({
    tournament_id: tournoi.id, order_index: 0, title: 'ZZ WOD', type: 'AMRAP', duration_minutes: 12, scoring: 'reps',
    deadline_hours: 24, status: 'active', opens_at: iso(Date.now() - heure), closes_at: iso(Date.now() + 20 * heure),
  }).select('id').single();
  if (wErr) throw wErr;
  const { data: score, error: sErr } = await svc.from('tournament_scores').insert({
    tournament_id: tournoi.id, tournament_wod_id: wod.id, athlete_id: membre.id, score_value: '100',
  }).select('id').single();
  if (sErr) throw sErr;
  // Jeton d'utilisateur du gérant, obtenu comme l'app : avec la clé publique.
  const pub = createClient(URL, CLES.publishable, { auth: { persistSession: false } });
  const { data: session, error: aErr } = await pub.auth.signInWithPassword({ email: gerant.email, password: 'Test1234!' });
  if (aErr) throw aErr;
  return { gerant, membre, box, notif, tournoi, score, jeton: session.session.access_token };
}

async function nettoyer() {
  for (const id of cree.boxes) {
    await svc.from('tournaments').delete().eq('box_id', id);
    await svc.from('boxes').delete().eq('id', id);
  }
  for (const id of cree.users) {
    await svc.from('push_tokens').delete().eq('user_id', id);
    await svc.auth.admin.deleteUser(id).catch(() => {});
  }
}

// ── Un passage ─────────────────────────────────────────────────────────────
const CRONS = ['generate-box-week', 'session-followup-cron', 'tournament-notifications-cron', 'weekly-owner-digest'];
const UTILISATEUR = ['analyze-tournament-score', 'parse-wod-pdf', 'send-box-notification', 'send-push'];
const PDF = Buffer.from('%PDF-1.4\n%zz\n').toString('base64');

async function passage(mode) {
  console.log(`\n══ passage « ${mode} » ══`);
  const w = copieDeTravail(mode);
  const { proc, cle } = await servir(w, mode);
  const attendue = { nouvelle: 'sb_secret_', ancienne: 'JWT', invalide: 'sb_secret_' }[mode];
  check(`${mode} · cleSecrete() rend une clé de forme ${attendue}`, cle === attendue, cle);
  const d = await decor(mode);
  const reussite = []; // [nom, vrai si la fonction a fait son travail]

  // 1. Refus sans authentification, par la fonction elle-même (verify_jwt = false).
  console.log('── appels sans authentification ──');
  for (const fn of [...CRONS, ...UTILISATEUR]) {
    const r = await appel(fn, { apikey: CLES.publishable }, { score_id: d.score.id, notification_id: d.notif.id, box_id: d.box.id, pdf_base64: PDF, recipients: [] });
    // La passerelle répond `{ msg }`, les fonctions `{ error }` : le corps dit qui a refusé.
    const parLaFonction = r.json && typeof r.json.error === 'string';
    check(`${mode} · ${fn} sans authentification → 401 rendu par la fonction`, r.status === 401 && parLaFonction, `${r.status} ${JSON.stringify(r.json)}`);
  }

  // 2. Une clé n'est jamais un jeton d'utilisateur, ni un x-cron-secret.
  console.log('── une clé à la place d\'un jeton ──');
  for (const [nom, cleEnJeton] of Object.entries(CLES)) {
    for (const fn of ['analyze-tournament-score', 'send-box-notification', 'send-push']) {
      const r = await appel(fn, { apikey: CLES.publishable, Authorization: `Bearer ${cleEnJeton}` },
        { score_id: d.score.id, notification_id: d.notif.id, category: 'box_announcements', recipients: [{ user_id: d.membre.id, title: 'ZZ', body: 'ZZ' }] });
      check(`${mode} · ${fn}, Bearer = clé ${nom} → refusé`, r.status === 401, `${r.status}`);
    }
    const r = await appel('weekly-owner-digest', { apikey: cleEnJeton, Authorization: `Bearer ${cleEnJeton}`, 'x-cron-secret': 'faux' });
    check(`${mode} · weekly-owner-digest, clé ${nom} + mauvais x-cron-secret → 401`, r.status === 401, `${r.status}`);
  }

  // 3. Appels légitimes : crons sans clé (forme de la PR C) et avec l'ancien JWT anon (forme actuelle).
  console.log('── appels légitimes ──');
  // session-followup-cron répond 200 même quand une lecture échoue : il journalise
  // l'échec dans `incidents` et continue. Son succès, c'est 200 ET aucun incident.
  const fait = (r) => r.status === 200 && (!Array.isArray(r.json?.incidents) || r.json.incidents.length === 0);
  for (const fn of ['generate-box-week', 'session-followup-cron', 'weekly-owner-digest']) {
    const sansCle = await appel(fn, { 'x-cron-secret': CRON_SECRET });
    reussite.push([`${fn}, x-cron-secret seul (forme PR C) → 200 sans incident`, fait(sansCle), `${sansCle.status} ${JSON.stringify(sansCle.json).slice(0, 160)}`]);
    const formeActuelle = await appel(fn, { 'x-cron-secret': CRON_SECRET, Authorization: `Bearer ${CLES.anon}` });
    reussite.push([`${fn}, x-cron-secret + Bearer JWT anon (forme actuelle) → 200 sans incident`, fait(formeActuelle), `${formeActuelle.status} ${JSON.stringify(formeActuelle.json).slice(0, 160)}`]);
  }
  // tournament-notifications-cron appelle send-push avec `apikey` seul : un refus
  // de send-push remonterait dans `failures`.
  const tnc = await appel('tournament-notifications-cron', { 'x-cron-secret': CRON_SECRET });
  reussite.push(['tournament-notifications-cron → 200, notifications réservées, send-push atteint sans échec',
    tnc.status === 200 && (tnc.json?.claimed ?? 0) >= 1 && !tnc.json?.failures, `${tnc.status} ${JSON.stringify(tnc.json)}`]);

  for (const [nomApikey, apikey] of [['sb_publishable_', CLES.publishable], ['JWT anon', CLES.anon]]) {
    const h = { apikey, Authorization: `Bearer ${d.jeton}` };
    const sbn = await appel('send-box-notification', h, { notification_id: d.notif.id });
    reussite.push([`send-box-notification (apikey ${nomApikey}) → 200, destinataires lus`, sbn.status === 200 && (sbn.json?.recipients ?? 0) >= 1, `${sbn.status} ${JSON.stringify(sbn.json)}`]);
    // Catégorie ouverte aux utilisateurs : « annonces de la box » est réservée au serveur.
    const sp = await appel('send-push', h, { category: 'group_messages', recipients: [{ user_id: d.membre.id, title: 'ZZ', body: 'ZZ' }] });
    reussite.push([`send-push, chemin utilisateur (apikey ${nomApikey}) → 200, destinataire autorisé`, sp.status === 200 && (sp.json?.authorized ?? 0) >= 1, `${sp.status} ${JSON.stringify(sp.json)}`]);
    // Clé Anthropic factice : atteindre l'appel à l'IA prouve l'authentification,
    // les lectures en base et la limite d'usage passées.
    const ats = await appel('analyze-tournament-score', h, { score_id: d.score.id });
    reussite.push([`analyze-tournament-score (apikey ${nomApikey}) → jusqu'à l'appel IA (502)`, ats.status === 502, `${ats.status} ${JSON.stringify(ats.json)}`]);
    const pwp = await appel('parse-wod-pdf', h, { box_id: d.box.id, pdf_base64: PDF });
    reussite.push([`parse-wod-pdf (apikey ${nomApikey}) → jusqu'à l'appel IA`, pwp.status === 500 && pwp.json?.error === 'AI service unavailable', `${pwp.status} ${JSON.stringify(pwp.json)}`]);
  }

  for (const [nom, fait, detail] of reussite) {
    if (mode === 'invalide') check(`${mode} · ÉCHOUE bien : ${nom}`, !fait, detail.slice(0, 160));
    else check(`${mode} · ${nom}`, fait, detail.slice(0, 200));
  }

  arreterServe(proc);
  enCours = null;
  await arreterRuntime();
  fs.rmSync(w, { recursive: true, force: true });
}

try {
  for (const mode of Object.keys(MODES)) await passage(mode);
} catch (e) {
  console.error('❌ protocole interrompu :', e?.message ?? e);
  ko++;
} finally {
  if (enCours) arreterServe(enCours);
  await arreterRuntime();
  await nettoyer();
}
console.log(`\n${ok} vrai(s), ${ko} faux`);
process.exit(ko ? 1 : 0);
