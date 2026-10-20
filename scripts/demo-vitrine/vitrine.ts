/**
 * Box vitrine (#523) — 50 membres fictifs, un coach fictif et 6 tournois sur
 * AthleX Fitness pendant la revue des stores. Protocole : README.md voisin.
 *
 *   npx tsx scripts/demo-vitrine/vitrine.ts <commande> --box <uuid> [--apply] [options]
 *
 *   seed                         crée les comptes (API admin d'Auth), les rattache
 *                                à la box (join_box_by_invite), prénom affiché
 *   refresh                      scores du jour et de la veille, musculation et 1RM,
 *                                réservations sur 14 jours, ELO des WODs clos
 *   tournaments create|register|play|finalize
 *   purge [--yes] [--include-legacy-demo]
 *   cles                         vérifie les préfixes des clés et, si un compte
 *                                vitrine existe, generateLink + verifyOtp
 *
 * --dry-run par défaut : rien n'est écrit sans --apply (la purge exige en plus --yes).
 * --n <1..50> : nombre de membres (4 pour l'essai), --essai : mini-tournoi à 4.
 *
 * Règle : chaque écriture métier est faite CONNECTÉ comme le compte fictif
 * (membre ou coach), par les mêmes tables et RPC que l'app et le Manager. La clé
 * serveur ne sert qu'à l'API admin d'Auth (création, lien de connexion,
 * suppression) et à des lectures. Les mots de passe sont tirés au hasard,
 * gardés en mémoire le temps de la création, jamais affichés ni écrits.
 * Variables : SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL) ; clé secrète `sb_secret_…`
 * dans SUPABASE_SECRET_KEY puis SUPABASE_SERVICE_ROLE_KEY ; clé publishable
 * `sb_publishable_…` dans EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY puis
 * EXPO_PUBLIC_SUPABASE_ANON_KEY (#521 : les anciennes clés seront désactivées) ;
 * PROD_DB_URL pour psql. Aucune valeur n'est jamais affichée.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { existsSync } from 'fs';
import {
  BOX_ATHLEX, EMAIL_COACH, PSEUDO_COACH, MOTIF_MEMBRE, FORMULE_DEMO, MEMBRES, TOURNOIS, Membre, SpecTournoi, RefTournoi,
  FENETRE_RESERVATION_JOURS, adapterPseudo, scoreLe, scorePour, seriesPour, enRx, repartirInscrits, scoreTournoi,
  quotaReservation, reservantsPour, comptesAPurger, tournoisAPurger, lireCle, TOURNOI_ESSAI, wodsSansContact, bilanReviewer, CompteLu, WodBox,
} from './logique';

type Db = SupabaseClient<any, 'public', any>;
const ICI = __dirname;
const FICHIER_IDS = join(ICI, 'vitrine.ids.json');

// ── Arguments ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const opt = (nom: string) => { const i = argv.indexOf(nom); return i >= 0 ? argv[i + 1] : undefined; };
const drapeau = (nom: string) => argv.includes(nom);
const [commande, sous] = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.match(/^--(box|n)$/));
const BOX = opt('--box');
const APPLY = drapeau('--apply');
const N = Number(opt('--n') ?? 50);
const ESSAI = drapeau('--essai');
const membres = MEMBRES.slice(0, N);

function stop(msg: string): never {
  console.log(`STOP — ${msg}`);
  process.exit(2);
}
function dit(msg: string) { console.log(`${APPLY ? '' : '[dry-run] '}${msg}`); }

// ── Clients ──────────────────────────────────────────────────────────────────

function env(...noms: string[]): string {
  for (const n of noms) if (process.env[n]) return process.env[n]!;
  return stop(`variable manquante : ${noms.join(' ou ')}`);
}
const URL_SB = () => env('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
let adminClient: Db | null = null;
function cle(noms: string[], prefixe: string): string {
  const r = lireCle(process.env, noms, prefixe);
  return 'erreur' in r ? stop(r.erreur) : r.valeur;
}
const CLE_SECRETE = () => cle(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], 'sb_secret_');
const CLE_PUBLIQUE = () => cle(['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'], 'sb_publishable_');
const admin = (): Db => (adminClient ??= createClient(URL_SB(), CLE_SECRETE(), {
  auth: { persistSession: false, autoRefreshToken: false },
}));

const sessions = new Map<string, Db>();
/** Session du compte fictif, par un lien magique généré (aucun e-mail envoyé). */
async function connecte(email: string): Promise<Db> {
  const deja = sessions.get(email);
  if (deja) return deja;
  if (!MOTIF_MEMBRE.test(email) && email !== EMAIL_COACH) stop(`connexion refusée hors comptes vitrine`);
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) stop(`lien de connexion impossible (${error?.message})`);
  const c = createClient(URL_SB(), CLE_PUBLIQUE(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: e2 } = await c.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  if (e2) stop(`connexion impossible (${e2.message})`);
  sessions.set(email, c);
  return c;
}

async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, quoi: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${quoi} : ${error.message}`);
  return data;
}

// ── Garde de box ─────────────────────────────────────────────────────────────

interface Etat { comptes: Map<string, { id: string; email: string; username: string }>; roles: Map<string, { role: string; status: string; formule: string | null; abo: string | null }> }

async function lireEtat(): Promise<Etat> {
  const profils = await ok(admin().from('profiles').select('id, email, username').ilike('email', 'demo.vitrine+%@athlexapp.eu'), 'profils');
  const comptes = new Map((profils as any[]).filter(p => MOTIF_MEMBRE.test(p.email) || p.email === EMAIL_COACH).map(p => [p.email, p]));
  const lignes = await ok(admin().from('box_members').select('member_id, role, status, subscription_status, plan:membership_plans!box_members_plan_id_fkey(name)').eq('box_id', BOX!), 'adhésions');
  const roles = new Map<string, any>();
  for (const l of lignes as any[]) roles.set(l.member_id, { role: l.role, status: l.status, formule: l.plan?.name ?? null, abo: l.subscription_status });
  return { comptes, roles };
}

/** AthleX Fitness, ou une box jetable : personne d'autre que le gérant et les comptes vitrine. */
async function garderBox(): Promise<{ invite: string; formats: string[]; owner: string }> {
  if (!BOX || !/^[0-9a-f-]{36}$/.test(BOX)) stop('--box <uuid> obligatoire');
  if (!(N >= 1 && N <= 50)) stop('--n entre 1 et 50');
  const box = await ok(admin().from('boxes').select('id, name, owner_id, invite_code, allowed_tournament_formats, archived_at').eq('id', BOX).maybeSingle(), 'box') as any;
  if (!box) stop(`box ${BOX} introuvable`);
  if (box.archived_at) stop('box archivée');
  if (BOX !== BOX_ATHLEX) {
    const lignes = await ok(admin().from('box_members').select('member_id, profile:profiles(email)').eq('box_id', BOX), 'membres') as any[];
    const autres = lignes.filter(l => l.member_id !== box.owner_id && !(MOTIF_MEMBRE.test(l.profile?.email ?? '') || l.profile?.email === EMAIL_COACH));
    if (autres.length > 0) stop(`la box ${BOX} n'est ni AthleX Fitness ni une box jetable (${autres.length} membre(s) réel(s))`);
  }
  return { invite: box.invite_code, formats: box.allowed_tournament_formats ?? [], owner: box.owner_id };
}

// ── seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const { invite } = await garderBox();
  // Empreinte de contrôle de l'ELO des comptes réels protégés, juste avant le
  // premier seed (une par groupe : essai, vitrine), hors dépôt, lecture seule.
  if (!existsSync(FICHIER_EMPREINTE())) {
    dit(`prendre l'empreinte ELO des comptes réels protégés → ${FICHIER_EMPREINTE()}`);
    if (APPLY) psql('20-empreinte-elo.sql', { box: BOX!, sortie: FICHIER_EMPREINTE() });
  }
  const etat = await lireEtat();
  const cibles = [...membres.map(m => ({ email: m.email, pseudo: m.pseudo, prenom: m.prenom as string | null, genre: m.genre as string | null, niveau: m.niveau as string })),
    { email: EMAIL_COACH, pseudo: PSEUDO_COACH, prenom: null, genre: null, niveau: 'rx' }];
  let crees = 0, adaptes = 0, rattaches = 0;
  for (const c of cibles) {
    let compte = etat.comptes.get(c.email);
    if (!compte) {
      const escape = c.pseudo.replace(/[\\%_]/g, m => `\\${m}`);
      const pris = new Set(((await ok(admin().from('profiles').select('username').ilike('username', `${escape}%`), 'pseudos')) as any[]).map(p => p.username.toLowerCase()));
      const a = adapterPseudo(c.pseudo, pris);
      if (a.caractere || a.chiffre) adaptes++;
      dit(`créer le compte #${cibles.indexOf(c) + 1}${a.pseudo !== c.pseudo ? ' (pseudo adapté)' : ''}`);
      if (!APPLY) continue;
      const { data, error } = await admin().auth.admin.createUser({
        email: c.email,
        password: randomBytes(24).toString('base64url'),
        email_confirm: true,
        user_metadata: { username: a.pseudo, level: c.niveau, ...(c.genre ? { gender: c.genre } : {}) },
      });
      if (error || !data.user) throw new Error(`création du compte #${cibles.indexOf(c) + 1} : ${error?.message}`);
      const p = await ok(admin().from('profiles').select('id, email, username').eq('id', data.user.id).single(), 'profil créé') as any;
      if (p.username !== a.pseudo) adaptes++; // dédoublonnage du trigger d'inscription
      compte = p;
      crees++;
    }
    if (!compte) continue;
    const r = etat.roles.get(compte.id);
    if (r?.status === 'active') continue;
    dit(`rattacher le compte #${cibles.indexOf(c) + 1} à la box`);
    if (!APPLY) continue;
    const db = await connecte(c.email);
    await ok(db.rpc('join_box_by_invite', { p_invite_code: invite }), 'join_box_by_invite');
    if (c.prenom) await ok(db.from('profiles').update({ full_name: c.prenom }).eq('id', compte.id), 'prénom');
    await ok(db.rpc('mark_onboarding_completed'), 'mark_onboarding_completed');
    rattaches++;
  }
  console.log(`seed : ${crees} compte(s) créé(s), ${rattaches} rattaché(s), ${adaptes} pseudo(s) adapté(s).`);
  const apres = await lireEtat();
  const coach = apres.comptes.get(EMAIL_COACH);
  const sansFormule = membres.filter(m => { const c = apres.comptes.get(m.email); const r = c && apres.roles.get(c.id); return !r || r.formule !== FORMULE_DEMO || r.abo !== 'active'; }).length;
  if (sansFormule > 0) console.log(`→ ${sansFormule} membre(s) sans « ${FORMULE_DEMO} » active : jouer sql/01-activer.sql (feu vert de Nab).`);
  if (!coach || apres.roles.get(coach.id)?.role !== 'coach') stop('donner le rôle coach à CoachAthleX dans le Manager, puis relancer.');
}

// ── refresh ──────────────────────────────────────────────────────────────────

const PARIS = 'Europe/Paris';
function jourParis(decalage = 0, base = new Date()): string {
  const d = new Date(base.getTime() + decalage * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
/** Instant UTC de « jour hh:mm » à Paris. */
function instantParis(jour: string, hhmm = '00:00'): Date {
  const naif = new Date(`${jour}T${hhmm}:00Z`);
  const vu = new Date(naif.toLocaleString('en-US', { timeZone: PARIS }));
  const ecart = vu.getTime() - new Date(naif.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(naif.getTime() - ecart);
}

async function membresActifs(): Promise<{ m: Membre; id: string }[]> {
  const etat = await lireEtat();
  const out: { m: Membre; id: string }[] = [];
  for (const m of membres) {
    const c = etat.comptes.get(m.email);
    const r = c && etat.roles.get(c.id);
    if (!c || r?.status !== 'active' || r.formule !== FORMULE_DEMO || r.abo !== 'active') stop(`membre #${m.nn} absent ou sans « ${FORMULE_DEMO} » active : seed puis 01-activer.sql d'abord`);
    out.push({ m, id: c.id });
  }
  return out;
}

async function refresh() {
  await garderBox();
  signalerContact();
  const actifs = await membresActifs();
  const auj = jourParis(0), hier = jourParis(-1);

  // Scores : le jour et la veille, ce que l'app laisse encore saisir.
  const wods = await ok(admin().from('box_wods')
    .select('id, title, wod_type, description, time_cap_seconds, rounds, leaderboard_enabled, publish_at, audience')
    .eq('box_id', BOX!).eq('is_published', true).in('scheduled_date', [hier, auj]), 'WODs') as any[];
  const ouverts = wods.filter(w => (w.audience ?? 'all') === 'all' && (!w.publish_at || new Date(w.publish_at) <= new Date()));
  // Règle de contact : un WOD déjà scoré par un compte réel protégé est sauté.
  const { gardes: visibles, sautes } = wodsSansContact(ouverts, wodsAvecScoreProtege(ouverts.map(w => w.id)));
  dit(`WODs sautés (déjà scorés par un compte réel protégé) : ${sautes}`);
  const deja = new Set(((await ok(admin().from('wod_scores').select('wod_id, member_id').in('wod_id', visibles.map(w => w.id)), 'scores')) as any[]).map(s => `${s.wod_id}|${s.member_id}`));
  const parType: Record<string, number> = {};
  let records = 0;
  for (const w of visibles) {
    for (const { m, id } of actifs) {
      if (!scoreLe(w.id, m) || deja.has(`${w.id}|${id}`)) continue;
      if (w.wod_type === 'strength') {
        const { sets, records: recs } = seriesPour(w.description ?? '', m);
        if (sets.length === 0) continue;
        parType.musculation = (parType.musculation ?? 0) + 1;
        if (!APPLY) continue;
        const db = await connecte(m.email);
        const r = await ok(db.rpc('validate_strength_session', {
          p_source_type: 'whiteboard', p_source_id: w.id, p_source_title: w.title,
          p_planned_sets: Math.min(500, Math.max(1, sets.length)), p_rx: enRx(m, w.id), p_sets: sets, p_records: recs,
        }), 'validate_strength_session') as any;
        records += (r?.records ?? []).filter((x: any) => x.kg != null).length;
        continue;
      }
      const s = scorePour(w as WodBox, m);
      if (!s) continue;
      parType[w.wod_type] = (parType[w.wod_type] ?? 0) + 1;
      if (!APPLY) continue;
      const db = await connecte(m.email);
      await ok(db.from('wod_scores').upsert({
        wod_id: w.id, member_id: id, box_id: BOX, score_type: s.score_type, score_value: s.score_value,
        capped: s.capped, rx: s.rx, scaled: !s.rx, notes: null,
      }, { onConflict: 'wod_id,member_id' }), 'wod_scores');
    }
  }
  dit(`scores : ${JSON.stringify(parType)} ; 1RM écrits : ${records}`);

  // ELO des WODs clos (comme l'app à la première ouverture d'un WOD expiré).
  const clos = await ok(admin().from('box_wods').select('id').eq('box_id', BOX!).eq('leaderboard_enabled', true)
    .gte('scheduled_date', jourParis(-7)).lte('scheduled_date', jourParis(-2)), 'WODs clos') as any[];
  let elo = 0;
  for (const w of clos) {
    const n = (await ok(admin().from('wod_scores').select('member_id', { count: 'exact', head: false }).eq('wod_id', w.id), 'scores') as any[]).length;
    if (n < 2) continue;
    elo++;
    if (!APPLY) continue;
    const db = await connecte(actifs[0].m.email);
    await ok(db.rpc('compute_wod_elo', { p_wod_id: w.id }), 'compute_wod_elo');
    await ok(db.rpc('compute_box_elo', { p_wod_id: w.id }), 'compute_box_elo');
  }
  dit(`ELO demandé pour ${elo} WOD(s) clos (sans effet s'il est déjà calculé)`);

  // Réservations : 14 jours, ≤ 60 % de la capacité, 3 places libres au moins.
  const creneaux = await ok(admin().from('class_schedules').select('id, scheduled_date, start_time, max_capacity')
    .eq('box_id', BOX!).gte('scheduled_date', auj).lte('scheduled_date', jourParis(FENETRE_RESERVATION_JOURS)).order('scheduled_date'), 'créneaux') as any[];
  const aVenir = creneaux.filter(c => instantParis(c.scheduled_date, String(c.start_time).slice(0, 5)).getTime() > Date.now() + 15 * 60000);
  const resas = await ok(admin().from('class_reservations').select('schedule_id, member_id, status').in('schedule_id', aVenir.map(c => c.id)), 'réservations') as any[];
  const idDe = new Map(actifs.map(a => [a.id, a.m.nn]));
  let posees = 0, libresMin = Infinity;
  for (const c of aVenir) {
    const confirmes = resas.filter(r => r.schedule_id === c.id && r.status === 'confirmed').length;
    const surCreneau = new Set(resas.filter(r => r.schedule_id === c.id).map(r => idDe.get(r.member_id)).filter(Boolean) as number[]);
    const ceJour = new Set(resas.filter(r => aVenir.find(x => x.id === r.schedule_id)?.scheduled_date === c.scheduled_date).map(r => idDe.get(r.member_id)).filter(Boolean) as number[]);
    const choix = reservantsPour(c.id, actifs.map(a => a.m).filter(m => !surCreneau.has(m.nn)), ceJour, quotaReservation(c.max_capacity, confirmes));
    let pris = confirmes;
    for (const m of choix) {
      const id = actifs.find(a => a.m.nn === m.nn)!.id;
      if (APPLY) {
        const db = await connecte(m.email);
        const r = await ok(db.from('class_reservations').insert({ schedule_id: c.id, member_id: id, box_id: BOX, status: 'confirmed' }).select('status').single(), 'réservation') as any;
        if (r.status !== 'confirmed') { // créneau rempli entre-temps : on rend la place
          await ok(db.from('class_reservations').delete().eq('schedule_id', c.id).eq('member_id', id), 'annulation');
          break;
        }
      }
      // Aussi en dry-run : sinon le plan compterait plusieurs créneaux par membre et par jour.
      resas.push({ schedule_id: c.id, member_id: id, status: 'confirmed' });
      pris++; posees++;
    }
    libresMin = Math.min(libresMin, c.max_capacity - pris);
  }
  dit(`réservations : ${posees} posée(s) sur ${aVenir.length} créneau(x) ; places libres minimales : ${aVenir.length ? libresMin : '-'}`);
}

// ── Tournois ─────────────────────────────────────────────────────────────────

/** { "vitrine": { T1…T6 }, "essai": { E1 } } : identifiants techniques seulement. */
type Ids = Partial<Record<'vitrine' | 'essai', Partial<Record<string, string>>>>;
const GROUPE: 'vitrine' | 'essai' = ESSAI ? 'essai' : 'vitrine';
const lireIds = (): Ids => { try { return JSON.parse(readFileSync(FICHIER_IDS, 'utf8')); } catch { return {}; } };
function ecrireIds(ids: Ids) { writeFileSync(FICHIER_IDS, `${JSON.stringify(ids, null, 2)}\n`); }

const SPECS: SpecTournoi[] = ESSAI ? [TOURNOI_ESSAI] : TOURNOIS;
/** Tours joués au plus par `play` (spec `toursJoues`) : T1 à T4 restent en cours après le premier. */
const TOUR_MAX: Partial<Record<RefTournoi, number>> = Object.fromEntries(SPECS.filter(s => s.toursJoues !== undefined).map(s => [s.ref, s.toursJoues!]));

/** WODs de chaque tournoi : une épreuve, une étape de tableau ou une journée. */
function wodsDe(t: SpecTournoi, ouverture: string | null) {
  const base = { opens_at: ouverture, deadline_hours: 24, status: 'pending' };
  const ft = (titre: string, extra = {}) => ({ ...base, title: titre, type: 'For Time', duration_minutes: 15, time_cap_seconds: 900, description: '21-15-9\nThruster (43/30 kg)\nPull-Ups', ...extra });
  const am = (titre: string, extra = {}) => ({ ...base, title: titre, type: 'AMRAP', duration_minutes: 12, time_cap_seconds: 720, description: 'AMRAP 12\n10 Kettlebell Swings (24/16 kg)\n10 Burpees\n10 Box Jumps', ...extra });
  // Classique : deux épreuves ; seule la première est jouée, la seconde reste en attente (tournoi en cours).
  if (t.format === 'simple') return [ft(`${t.nom} — épreuve 1`, { order_index: 1 }), am(`${t.nom} — épreuve 2`, { order_index: 2, opens_at: null })];
  if (t.format === 'league_div') return [am('Journée 1', { order_index: 1 }), am('Journée 2', { order_index: 2, opens_at: null })];
  const tours = Math.ceil(Math.log2(t.places));
  const out = [] as any[];
  for (let r = 1; r <= tours; r++) out.push((r % 2 ? am : ft)(r === tours ? 'Finale' : `Tour ${r}`, { order_index: r, bracket_board: 'winner', bracket_stage: tours - r }));
  if (t.format === 'swiss') out.push(am('Tableau des perdants — tour 1', { order_index: tours + 1, bracket_board: 'loser', bracket_stage: 1 }));
  return out;
}

async function coach(): Promise<{ db: Db; id: string }> {
  const etat = await lireEtat();
  const c = etat.comptes.get(EMAIL_COACH);
  if (!c || etat.roles.get(c.id)?.role !== 'coach') stop('CoachAthleX n’est pas coach de la box : rôle à donner dans le Manager.');
  return { db: await connecte(EMAIL_COACH), id: c.id };
}

async function tournaments() {
  const { formats } = await garderBox();
  // Les scores de tournoi ne passent pas par compute_wod_elo / compute_box_elo :
  // pas de précaution ici, seulement le signalement.
  signalerContact();
  const ids = lireIds();
  ids[GROUPE] ??= {};
  const mesIds = ids[GROUPE]!;
  const inscrits = repartirInscrits(membres, SPECS);
  const actifs = await membresActifs();
  const idDe = new Map(actifs.map(a => [a.m.nn, a.id]));
  const lus = await ok(admin().from('tournaments').select('id, status, format, box_id, max_participants').in('id', Object.values(mesIds).filter(Boolean) as string[]), 'tournois') as any[];
  const tournoi = (ref: RefTournoi) => lus.find(x => x.id === mesIds[ref] && x.box_id === BOX);

  if (sous === 'create') {
    const demain = instantParis(jourParis(1)).toISOString();
    const { db } = await coach();
    for (const t of SPECS) {
      if (tournoi(t.ref)) { dit(`${t.ref} existe déjà`); continue; }
      if (!formats.includes(t.format)) stop(`format ${t.format} (${t.ref}) non permis sur la box : à ouvrir dans l’admin du Manager`);
      dit(`créer ${t.ref} (${t.format}, ${t.places} places, ${t.demarre ? 'démarre J+1 00:00' : 'à venir'})`);
      if (!APPLY) continue;
      const cree = await ok(db.from('tournaments').insert({
        name: t.nom, level: t.niveau, format: t.format, max_participants: t.places, gender_target: 'mix',
        box_id: BOX, status: 'open', start_date: t.demarre ? demain : null, end_date: null,
        third_place_match: t.format === 'bracket' && !!t.petiteFinale, registrations_open_during_tournament: !!t.inscriptionsOuvertes,
      }).select('id').single(), `création ${t.ref}`) as any;
      mesIds[t.ref] = cree.id;
      ecrireIds(ids);
      if (t.format === 'league_div') {
        await ok(db.from('tournament_divisions').insert([1, 2, 3].map(l => ({
          tournament_id: cree.id, name: `D${l}`, level: l, max_members: 8, promote_count: 2, relegate_count: 2,
        }))), 'divisions');
      }
      await ok(db.from('tournament_wods').insert(wodsDe(t, t.demarre ? demain : null).map(w => ({ ...w, tournament_id: cree.id }))), 'WODs de tournoi');
    }
    return;
  }

  if (sous === 'register') {
    for (const t of SPECS) {
      const tt = tournoi(t.ref);
      if (!tt) stop(`${t.ref} absent de vitrine.ids.json : tournaments create d’abord`);
      const deja = new Set(((await ok(admin().from('tournament_participants').select('athlete_id').eq('tournament_id', tt.id), 'inscrits')) as any[]).map(p => p.athlete_id));
      const manquants = inscrits[t.ref].filter(nn => !deja.has(idDe.get(nn)));
      if (manquants.length && tt.status !== 'open') stop(`${t.ref} n’est plus ouvert aux inscriptions (${tt.status})`);
      dit(`${t.ref} : ${manquants.length} inscription(s) à faire, ${deja.size} déjà inscrit(s)`);
      if (!APPLY) continue;
      for (const nn of manquants) {
        const db = await connecte(membres[nn - 1].email);
        await ok(db.from('tournament_participants').insert({ tournament_id: tt.id, athlete_id: idDe.get(nn) }), `inscription ${t.ref}`);
      }
    }
    return;
  }

  if (sous === 'play') {
    const { db: dbCoach } = await coach();
    for (const t of SPECS.filter(s => s.demarre)) {
      const tt = tournoi(t.ref);
      if (!tt) stop(`${t.ref} absent : tournaments create d’abord`);
      if (tt.status === 'completed') { dit(`${t.ref} terminé`); continue; }
      if (tt.status !== 'active') { dit(`${t.ref} pas encore démarré (démarrage automatique à 00:00 Paris)`); continue; }
      if (t.format === 'simple' || t.format === 'league_div') await jouerEpreuve(t, tt.id, dbCoach, idDe);
      else await jouerTour(t, tt.id, dbCoach, idDe);
    }
    return;
  }

  if (sous === 'finalize') {
    // La clôture (finalize_tournament_elo) est réservée au gérant : Nab clique
    // « Clôturer & ELO » dans le Manager. Les badges de tournoi sont posés par
    // l'app du gérant (upsert direct athlete_badges), pas par un appel qu'un
    // membre peut faire lui-même : on n'en fabrique pas (décision du 20/10).
    for (const t of SPECS.filter(s => s.ref === 'T1' || s.ref === 'T2' || s.ref === 'E1')) {
      const tt = tournoi(t.ref);
      if (!tt) continue;
      if (tt.status !== 'completed') { console.log(`STOP — ${t.ref} pas encore clôturé : Nab clique « Clôturer & ELO » dans le Manager.`); continue; }
      const n = (await ok(admin().from('tournament_elo_history').select('id').eq('tournament_id', tt.id), 'ELO') as any[]).length;
      console.log(`${t.ref} clôturé : ${n} ligne(s) d’ELO de clôture.`);
    }
    return;
  }
  stop('tournaments create|register|play|finalize');
}

const membreDe = (idDe: Map<number, string>, id: string) => membres.find(m => idDe.get(m.nn) === id)!;

/** Ouvre le WOD, chaque inscrit (ou chaque joueur du match) score, le coach valide. */
async function scorerEtValider(tournoiId: string, wod: any, joueurs: string[], dbCoach: Db, idDe: Map<number, string>) {
  if (wod.status === 'pending') {
    dit(`ouvrir le WOD « ${wod.title} »`);
    if (APPLY) await ok(dbCoach.from('tournament_wods').update({ status: 'active' }).eq('id', wod.id), 'ouverture du WOD');
  }
  const scores = await ok(admin().from('tournament_scores').select('id, athlete_id, status').eq('tournament_wod_id', wod.id), 'scores') as any[];
  const ont = new Set(scores.map(s => s.athlete_id));
  const manquants = joueurs.filter(j => !ont.has(j));
  dit(`« ${wod.title} » : ${manquants.length} score(s) à saisir`);
  if (!APPLY) return;
  for (const j of manquants) {
    const m = membreDe(idDe, j);
    const db = await connecte(m.email);
    await ok(db.from('tournament_scores').insert({
      tournament_id: tournoiId, tournament_wod_id: wod.id, athlete_id: j, score_value: scoreTournoi(wod.type, wod.id, m),
      capped: false, tiebreak_value: null, video_url: null, notes: null,
      submitted_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 24 * 3600000).toISOString(), status: 'pending',
    }), 'score de tournoi');
  }
  const aValider = await ok(admin().from('tournament_scores').select('id').eq('tournament_wod_id', wod.id).eq('status', 'pending'), 'en attente') as any[];
  for (const s of aValider) await ok(dbCoach.from('tournament_scores').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', s.id).eq('tournament_id', tournoiId).select('id'), 'validation');
  dit(`« ${wod.title} » : ${aValider.length} score(s) validé(s) par le coach`);
}

async function jouerEpreuve(t: SpecTournoi, id: string, dbCoach: Db, idDe: Map<number, string>) {
  const wods = await ok(admin().from('tournament_wods').select('id, title, type, status, order_index').eq('tournament_id', id).order('order_index'), 'WODs') as any[];
  const joueurs = ((await ok(admin().from('tournament_participants').select('athlete_id').eq('tournament_id', id), 'inscrits')) as any[]).map(p => p.athlete_id);
  const max = TOUR_MAX[t.ref] ?? wods.length;
  for (const w of wods.slice(0, max)) await scorerEtValider(id, w, joueurs, dbCoach, idDe);
  if (t.format === 'league_div' && APPLY) {
    for (const w of wods.slice(0, max)) await ok(dbCoach.rpc('compute_league_wod_elo', { p_tournament_wod_id: w.id }), 'compute_league_wod_elo');
  }
  dit(`${t.ref} : ${Math.min(max, wods.length)} épreuve(s) jouée(s), la suite reste en attente`);
}

/** Un tour de tableau par passage : tirage, scores, validation, décision, avancée. */
async function jouerTour(t: SpecTournoi, id: string, dbCoach: Db, idDe: Map<number, string>) {
  const matchs = async () => await ok(admin().from('tournament_bracket_matches').select('id, round, side, status, participant1_id, participant2_id, winner_id, wod_id').eq('tournament_id', id).order('round'), 'matchs') as any[];
  let ms = await matchs();
  if (ms.length === 0) {
    dit(`${t.ref} : tirage du premier tour`);
    if (!APPLY) return;
    await ok(dbCoach.rpc('generate_bracket_round_1', { p_tournament_id: id }), 'generate_bracket_round_1');
    ms = await matchs();
  }
  const fini = (s: string) => ['completed', 'bye', 'forfeit'].includes(s);
  const ouverts = ms.filter(m => !fini(m.status));
  const tourMax = Math.max(...ms.map(m => m.round));
  // Élimination simple : le dernier tour (finale et petite finale) clôt le tableau.
  const dernier = t.format === 'bracket' && tourMax >= Math.ceil(Math.log2(t.places));
  if (ouverts.length === 0) {
    if (dernier) { console.log(`STOP — ${t.ref} : tableau terminé, Nab clique « Clôturer & ELO » dans le Manager.`); return; }
    if (tourMax >= (TOUR_MAX[t.ref] ?? Infinity)) { dit(`${t.ref} : tour ${tourMax} joué, la suite reste en attente`); return; }
    dit(`${t.ref} : avancer après le tour ${tourMax}`);
    if (APPLY) await ok(dbCoach.rpc('advance_bracket_round', { p_tournament_id: id, p_completed_round: tourMax }), 'advance_bracket_round');
    return;
  }
  const r = Math.min(...ouverts.map(m => m.round));
  if (r > (TOUR_MAX[t.ref] ?? Infinity)) { dit(`${t.ref} : tour ${r} laissé en attente`); return; }
  const wods = await ok(admin().from('tournament_wods').select('id, title, type, status').eq('tournament_id', id), 'WODs') as any[];
  for (const wodId of new Set(ouverts.filter(m => m.round === r).map(m => m.wod_id))) {
    const wod = wods.find(w => w.id === wodId);
    if (!wod) stop(`${t.ref} : match du tour ${r} sans WOD prévu`);
    const joueurs = ouverts.filter(m => m.round === r && m.wod_id === wodId).flatMap(m => [m.participant1_id, m.participant2_id]).filter(Boolean);
    await scorerEtValider(id, wod, joueurs, dbCoach, idDe);
  }
  if (!APPLY) return;
  await ok(dbCoach.rpc('decide_bracket_round', { p_tournament_id: id, p_round: r }), 'decide_bracket_round');
  // Égalité parfaite (rare) : le coach tranche à la main comme dans le Manager, au plus fort du jour.
  for (const m of (await matchs()).filter(x => x.round === r && !fini(x.status) && x.participant1_id && x.participant2_id)) {
    const [a, b] = [membreDe(idDe, m.participant1_id), membreDe(idDe, m.participant2_id)];
    const g = a.force >= b.force ? m.participant1_id : m.participant2_id;
    await ok(dbCoach.from('tournament_bracket_matches').update({ winner_id: g, loser_id: g === m.participant1_id ? m.participant2_id : m.participant1_id, status: 'completed', completed_at: new Date().toISOString() }).eq('id', m.id), 'vainqueur');
  }
  const encore = (await matchs()).filter(x => !fini(x.status));
  const finale = t.format === 'bracket' && r >= Math.ceil(Math.log2(t.places));
  // Le tour suivant est créé tout de suite (affichage « en cours ») ; il ne sera
  // joué qu'au passage suivant, et jamais au-delà de TOUR_MAX.
  if (encore.length === 0 && !finale) {
    await ok(dbCoach.rpc('advance_bracket_round', { p_tournament_id: id, p_completed_round: r }), 'advance_bracket_round');
  }
  dit(`${t.ref} : tour ${r} joué et décidé`);
  if (finale && encore.length === 0) console.log(`STOP — ${t.ref} : tableau terminé, Nab clique « Clôturer & ELO » dans le Manager.`);
}

// ── purge ────────────────────────────────────────────────────────────────────

/** Dossier des empreintes, hors dépôt (VITRINE_DOSSIER, sinon ~/Desktop/athlex-captures/box-vitrine). */
const DOSSIER = () => (process.env.VITRINE_DOSSIER ?? join(homedir(), 'Desktop', 'athlex-captures', 'box-vitrine')).split('\\').join('/');
const FICHIER_EMPREINTE = () => `${DOSSIER()}/empreinte-elo-${GROUPE}.sql`;

/**
 * Règle de contact, en lecture seule (10-contact-elo.sql) : STOP avant toute
 * écriture si un compte réel protégé a un score sur un WOD où un fictif a scoré.
 */
function signalerContact() {
  try { psql('10-contact-elo.sql', { box: BOX! }); }
  catch { stop('contact entre un compte réel protégé et des fictifs (voir VITRINE_CONTACT ci-dessus) : rien n’a été écrit. Décision de Nab.'); }
}

/** WODs, parmi `wodIds`, où un compte réel protégé (proteges.sql) a déjà un score. */
function wodsAvecScoreProtege(wodIds: string[]): Set<string> {
  if (wodIds.length === 0) return new Set();
  const sortie = execFileSync('psql', [env('PROD_DB_URL'), '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
    '-c', 'SET default_transaction_read_only = on',
    '-c', `SELECT set_config('vitrine.box', '${BOX}', false)`,
    '-f', join(ICI, 'sql', 'proteges.sql'),
    '-c', `SELECT coalesce(json_agg(DISTINCT wod_id), '[]')::jsonb::text FROM public.wod_scores
            WHERE wod_id = ANY ('{${wodIds.join(',')}}'::uuid[]) AND member_id = ANY (current_setting('vitrine.proteges')::uuid[])`],
    { encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8' }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Set(JSON.parse(sortie.trim().split('\n').pop() || '[]'));
}

function psql(fichier: string | null, vars: Record<string, string>, sql?: string): string {
  const args = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`])];
  if (sql) args.push('-c', 'SET default_transaction_read_only = on', '-c', sql);
  if (fichier) args.push('-f', join(ICI, 'sql', fichier));
  const sortie = execFileSync('psql', [env('PROD_DB_URL'), ...args], { encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8' }, stdio: ['ignore', 'pipe', 'inherit'] });
  if (fichier) process.stdout.write(sortie);
  return sortie;
}

async function purge() {
  await garderBox();
  signalerContact();
  if (!existsSync(FICHIER_EMPREINTE())) stop(`empreinte ELO de référence absente (${FICHIER_EMPREINTE()}) : elle est prise avant le premier seed.`);
  const legacy = drapeau('--include-legacy-demo');
  const json = (sql: string) => JSON.parse(psql(null, {}, sql).trim().split('\n').pop() || '[]');
  // Lecture en postgres : internal.demo_accounts n'est lisible par aucun rôle client.
  const lus = json(`SELECT coalesce(json_agg(x), '[]')::jsonb::text FROM (
    SELECT u.id, lower(u.email) AS email, bm.box_id, bm.role, mp.name AS formule,
           EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id = u.id) AS demo_account
      FROM auth.users u JOIN public.box_members bm ON bm.member_id = u.id AND bm.box_id = '${BOX}'
      LEFT JOIN public.membership_plans mp ON mp.id = bm.plan_id) x`) as CompteLu[];
  // Reviewer : le seul compte de internal.demo_accounts hors @demo.athlexapp.eu (et hors vitrine).
  const revs = json(`SELECT coalesce(json_agg(d.user_id), '[]')::jsonb::text FROM internal.demo_accounts d JOIN auth.users u ON u.id = d.user_id
     WHERE lower(u.email) NOT LIKE '%@demo.athlexapp.eu' AND lower(u.email) NOT LIKE 'demo.vitrine+%'`) as string[];
  if (legacy && revs.length !== 1) stop(`reviewer non identifié sans ambiguïté (${revs.length})`);
  const comptes = comptesAPurger(lus, BOX!, { legacy, reviewerId: revs[0] });
  const ids = lireIds()[GROUPE] ?? {};
  const lusT = await ok(admin().from('tournaments').select('id, box_id').in('id', Object.values(ids).filter(Boolean) as string[]), 'tournois') as any[];
  const tournois = tournoisAPurger(ids, lusT, BOX!);
  const arr = (a: string[]) => `{${a.join(',')}}`;
  dit(`purge (${GROUPE}) : ${tournois.length} tournoi(s), ${comptes.length} compte(s)${legacy ? ' (dont démo historiques)' : ''}`);
  if (legacy) stop('--include-legacy-demo reste bloquée tant que Nab n’a pas tranché le sort des 6 anciens tournois de ces comptes.');

  // 1. Résultats du reviewer dans ces tournois : comptés, supprimés avec eux (effet ELO accepté).
  if (revs[0]) {
    const n = Number(psql(null, {}, `SELECT (SELECT count(*) FROM tournament_elo_history WHERE athlete_id='${revs[0]}' AND tournament_id = ANY('${arr(tournois)}'::uuid[]))
      + (SELECT count(*) FROM tournament_match_elo_history WHERE athlete_id='${revs[0]}' AND tournament_id = ANY('${arr(tournois)}'::uuid[]))
      + (SELECT count(*) FROM tournament_wod_elo_history WHERE athlete_id='${revs[0]}' AND tournament_id = ANY('${arr(tournois)}'::uuid[]))
      + (SELECT count(*) FROM tournament_scores WHERE athlete_id='${revs[0]}' AND tournament_id = ANY('${arr(tournois)}'::uuid[]))`).trim().split('\n').pop());
    console.log(bilanReviewer(n));
  }
  // 2. Relevé au catalogue, en lecture seule, AVANT toute suppression : clés sans
  //    action ou en restriction, lignes de vrais comptes, tournois non listés, liste
  //    d'attente, ligne ELO d'un compte protégé au contact des fictifs → STOP ;
  //    clés en mise à NULL relevées dans un fichier hors dépôt
  //    (identifiants techniques seulement).
  const releve = join(tmpdir(), `athlex-vitrine-releve-${GROUPE}.sql`).split('\\').join('/');
  const vars = { box: BOX!, comptes: arr(comptes), tournois: arr(tournois), releve };
  try { psql('80-releve-purge.sql', vars); } catch { stop('relevé avant purge en échec (voir VITRINE_BLOQUANT ci-dessus) : rien n’a été supprimé.'); }

  if (!APPLY || !drapeau('--yes')) { console.log('[dry-run] relevé conforme ; rien n’est supprimé sans --apply --yes.'); return; }
  // 3. Tournois, 4. lignes des fictifs en mise à NULL, 5. comptes (cascade), 6. contrôle à 0.
  if (tournois.length) psql('90-purger-tournois.sql', { box: BOX!, ids: arr(tournois) });
  psql('91-supprimer-lignes-fictifs.sql', { comptes: arr(comptes), releve });
  for (const id of comptes) {
    const { error } = await admin().auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) throw new Error(`suppression d’un compte : ${error.message}`);
  }
  psql('99-controle-purge.sql', vars);
  const ids2 = lireIds();
  delete ids2[GROUPE];
  ecrireIds(ids2);
  console.log(`purge terminée : ${tournois.length} tournoi(s), ${comptes.length} compte(s), contrôle à 0.`);
  // Contrôle de l'ELO des comptes réels protégés : rien n'est corrigé, Nab décide.
  try { psql('20-empreinte-elo.sql', { box: BOX!, reference: FICHIER_EMPREINTE() }); }
  catch { stop('ligne(s) d’historique ELO figée(s) avant le seed modifiée(s) ou supprimée(s) (voir VITRINE_EMPREINTE) : rien n’est corrigé, décision de Nab.'); }
}

// ── cles ─────────────────────────────────────────────────────────────────────

/** Dry-run des clés : préfixes, lecture admin, et session d'un compte vitrine s'il en existe un. */
async function cles() {
  CLE_SECRETE(); CLE_PUBLIQUE();
  console.log('préfixes conformes');
  const { error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) stop(`lecture admin refusée (${error.message})`);
  const comptes = (await ok(admin().from('profiles').select('email').ilike('email', 'demo.vitrine+%@athlexapp.eu').limit(1), 'comptes vitrine')) as any[];
  const email = comptes.map(c => c.email).find(e => MOTIF_MEMBRE.test(e) || e === EMAIL_COACH);
  // generateLink sur une adresse inconnue créerait le compte : on ne le tente que sur un compte existant.
  if (!email) { console.log('aucun compte vitrine encore : generateLink + verifyOtp vérifiés sur le premier compte du seed'); return; }
  const db = await connecte(email);
  const { data } = await db.auth.getUser();
  console.log(data.user ? 'generateLink + verifyOtp : session ouverte' : 'STOP — session non ouverte');
}

// ── main ─────────────────────────────────────────────────────────────────────

const commandes: Record<string, () => Promise<void>> = { seed, refresh, tournaments, purge, cles };
if (!commandes[commande]) stop('commande : seed | refresh | tournaments <create|register|play|finalize> | purge | cles');
commandes[commande]().catch(e => { console.error(`ERREUR — ${e.message}`); process.exit(1); });
