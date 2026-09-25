#!/usr/bin/env node
/**
 * AthleX — Clôture ELO : une seule fonction serveur (`finalize_tournament_elo`)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pour chaque format (simple, bracket, swiss, league_div), sur pile jetable :
 *   · le gérant clôture via la RPC ; pour chaque participant
 *     `profiles.elo = dernier elo_after` (tournament_elo_history) ;
 *   · une seconde clôture est refusée (TOURNOI_DEJA_CLOTURE), rien ne bouge ;
 *   · coach et athlète sont refusés ; `anon` n'a pas le droit d'exécution ;
 *   · le piège de la RLS est documenté : un gérant qui PATCH `profiles` d'un
 *     autre athlète via PostgREST reçoit 204 et ZÉRO ligne.
 *
 * Mutation inverse (scripts/test-finalize-elo-mutation.sh) : sans l'UPDATE du
 * profil dans la fonction, cette suite doit échouer.
 *
 * USAGE
 *   ./scripts/test-stack.sh up && node scripts/test-finalize-elo.mjs [--keep-data]
 */

import {
  requireTestTarget, serviceClient, anonClient, signInAs, createUser, createOwnedBox, dropBoxAndOwner,
  onCleanup, runCleanup, installCleanupTraps, SUPABASE_URL, ANON_KEY,
} from './lib/test-env.mjs';

requireTestTarget();
installCleanupTraps();

const db  = serviceClient();
const TS  = Date.now();
const TAG = `felo_${TS}`;
const PW  = `AthleX_Felo_${TS}!`;
const res = { passed: 0, failed: 0 };

const ok   = m => { console.log(`  ✅ ${m}`); res.passed++; };
const fail = (m, e) => { console.log(`  ❌ ${m}`); if (e?.message) console.log(`     → ${e.message}`); res.failed++; };
const info = m => console.log(`  ℹ️  ${m}`);
const assert = (cond, msg, err = null) => { cond ? ok(msg) : fail(msg, err); return cond; };

// ── Décor : box, gérant, coach, 8 athlètes ───────────────────────────────────
let BOX_ID, OWNER_ID, COACH_ID, asOwner, asCoach, asAthlete, ownerToken;
const AGENTS = Array.from({ length: 8 }, (_, i) => ({
  username: `Felo${i + 1}_${TS}`, email: `felo${i + 1}.${TAG}@test.athlex.io`, id: null, elo: 1000 + i * 25,
}));

async function setup() {
  console.log('\n── Décor ───────────────────────────────────────────────────────────────────');
  OWNER_ID = await createUser(db, { email: `owner.${TAG}@test.athlex.io`, password: PW, username: `FeloOwner_${TS}`, role: 'box_owner' });
  BOX_ID = await createOwnedBox(db, { tag: TAG, ownerId: OWNER_ID });
  onCleanup(() => dropBoxAndOwner(db, BOX_ID, OWNER_ID));

  COACH_ID = await createUser(db, { email: `coach.${TAG}@test.athlex.io`, password: PW, username: `FeloCoach_${TS}` });
  onCleanup(() => db.auth.admin.deleteUser(COACH_ID));
  await db.from('box_members').upsert({ box_id: BOX_ID, member_id: COACH_ID, role: 'coach', status: 'active' }, { onConflict: 'box_id,member_id' });

  for (const a of AGENTS) {
    a.id = await createUser(db, { email: a.email, password: PW, username: a.username, elo: a.elo });
    await db.from('box_members').upsert({ box_id: BOX_ID, member_id: a.id, role: 'member', status: 'active' }, { onConflict: 'box_id,member_id' });
  }
  onCleanup(async () => { for (const a of AGENTS) if (a.id) await db.auth.admin.deleteUser(a.id); });

  ({ client: asOwner, accessToken: ownerToken } = await signInAs(`owner.${TAG}@test.athlex.io`, PW));
  ({ client: asCoach } = await signInAs(`coach.${TAG}@test.athlex.io`, PW));
  ({ client: asAthlete } = await signInAs(AGENTS[0].email, PW));
  info(`Box ${BOX_ID.slice(0, 8)}…, gérant, coach, 8 athlètes (ELO 1000…1175)`);
}

async function createTournament(format, participants = AGENTS) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await db.from('tournaments').insert({
    box_id: BOX_ID, created_by: OWNER_ID, name: `[TEST] ${format} ${TAG}`,
    description: 'Auto test — safe to delete', status: 'open', level: 'rx', format,
    start_date: today, end_date: today, max_participants: 8,
  }).select('id').single();
  if (error) throw new Error(`tournoi ${format} : ${error.message}`);
  for (const a of participants) await db.from('tournament_participants').insert({ tournament_id: data.id, athlete_id: a.id, score: 0 });
  return data.id;
}

async function snapshotProfiles() {
  const { data } = await db.from('profiles').select('id, elo, total_matches, wins').in('id', AGENTS.map(a => a.id));
  return Object.fromEntries((data ?? []).map(p => [p.id, p]));
}

// ── Assertions communes à tous les formats ───────────────────────────────────
async function closeAndCheck(format, tournId, { expectDistribution, participants = AGENTS }) {
  const before = await snapshotProfiles();
  const N = participants.length;

  // Coach et athlète : refusés, et rien n'a bougé.
  const { error: coachErr } = await asCoach.rpc('finalize_tournament_elo', { p_tournament_id: tournId });
  assert(coachErr && /gérant ou co-gérant/i.test(coachErr.message), `${format} : le coach est refusé (message nommé)`, coachErr ?? { message: 'aucune erreur' });
  const { error: athErr } = await asAthlete.rpc('finalize_tournament_elo', { p_tournament_id: tournId });
  assert(athErr && /gérant ou co-gérant/i.test(athErr.message), `${format} : l'athlète est refusé`, athErr ?? { message: 'aucune erreur' });
  const { count: h0 } = await db.from('tournament_elo_history').select('*', { count: 'exact', head: true }).eq('tournament_id', tournId);
  assert(h0 === 0, `${format} : aucun historique écrit par les refus`);

  // Gérant : clôture.
  const { data: rows, error } = await asOwner.rpc('finalize_tournament_elo', { p_tournament_id: tournId });
  if (!assert(!error && Array.isArray(rows), `${format} : clôture par le gérant`, error)) return;
  assert(rows.length === N, `${format} : ${rows.length}/${N} lignes rendues (rang, before, after, change)`);
  assert(rows.every(r => r.elo_after === r.elo_before + r.elo_change), `${format} : elo_after = elo_before + elo_change sur chaque ligne`);
  assert(rows.some(r => r.final_rank === 1), `${format} : un rang 1 existe`);

  // Invariant : profil = dernier elo_after, pour chaque participant.
  const { data: hist } = await db.from('tournament_elo_history').select('athlete_id, elo_after, calculated_at').eq('tournament_id', tournId);
  const after = await snapshotProfiles();
  const mismatches = (hist ?? []).filter(h => after[h.athlete_id]?.elo !== h.elo_after);
  assert(hist?.length === N && mismatches.length === 0,
    `${format} : profiles.elo = dernier elo_after pour les ${N} participants`,
    mismatches.length ? { message: mismatches.map(m => `${m.athlete_id.slice(0, 8)} profil=${after[m.athlete_id]?.elo} elo_after=${m.elo_after}`).join(' ; ') } : null);

  // Dernier elo_after toutes tables confondues (la ligne récap doit être la plus récente).
  const { data: latest, error: latestErr } = await db.rpc('_felo_latest_elo_after', { p_athletes: participants.map(a => a.id) });
  if (latest && !latestErr) {
    const bad = latest.filter(l => after[l.athlete_id]?.elo !== l.elo_after);
    assert(bad.length === 0, `${format} : profil = dernier elo_after toutes tables d'historique confondues`);
  }

  const { data: t } = await db.from('tournaments').select('status').eq('id', tournId).single();
  assert(t?.status === 'completed', `${format} : statut completed`);

  if (expectDistribution) {
    const moved = AGENTS.filter(a => before[a.id].elo !== after[a.id].elo).length;
    assert(moved > 0, `${format} : l'ELO a été distribué (${moved} profils ont bougé)`);
    assert(AGENTS.every(a => after[a.id].total_matches === before[a.id].total_matches + 1), `${format} : total_matches +1 pour chacun`);
    const winners = rows.filter(r => r.final_rank === 1).map(r => r.athlete_id);
    assert(winners.every(w => after[w].wins === before[w].wins + 1), `${format} : wins +1 pour le rang 1`);
  } else {
    assert(AGENTS.every(a => before[a.id].elo === after[a.id].elo),
      `${format} : aucune seconde couche de points (ELO déjà distribué match/WOD par match/WOD, profils inchangés)`);
  }

  // Idempotence : refus prononcé, rien ne bouge.
  const { data: again, error: againErr } = await asOwner.rpc('finalize_tournament_elo', { p_tournament_id: tournId });
  assert(againErr && /TOURNOI_DEJA_CLOTURE/.test(againErr.message), `${format} : seconde clôture refusée (TOURNOI_DEJA_CLOTURE)`, againErr ?? { message: `réponse ${JSON.stringify(again)?.slice(0, 60)}` });
  const after2 = await snapshotProfiles();
  const { count: h2 } = await db.from('tournament_elo_history').select('*', { count: 'exact', head: true }).eq('tournament_id', tournId);
  assert(h2 === N && AGENTS.every(a => after2[a.id].elo === after[a.id].elo && after2[a.id].total_matches === after[a.id].total_matches),
    `${format} : la seconde clôture n'a rien redistribué (historique ${h2}, profils identiques)`);
  return rows;
}

// ── Format simple : la règle de classement (barème de l'app, calculé en base) ─
async function suiteSimple() {
  console.log('\n══ Simple (classique) ═══════════════════════════════════════════════════════');
  const tournId = await createTournament('simple');
  const wods = [];
  for (const [i, type] of [['For Time'], ['AMRAP']].entries()) {
    const { data: w } = await db.from('tournament_wods').insert({
      tournament_id: tournId, order_index: i + 1, title: `[TEST] WOD ${i + 1}`, type: type[0],
      duration_minutes: 12, movements: '[]', scoring: type[0] === 'For Time' ? 'Temps' : 'Reps', status: 'active',
    }).select('id').single();
    wods.push(w.id);
  }
  // WOD 1 For Time : finishers (temps croissant), un cappé, un DNF hérité, un score
  // non parsable. WOD 2 AMRAP : reps décroissantes, deux ex-aequo.
  const ft = ['300', '300', '420', '250', '1000049', 'abc', '500', '380'];
  const ftCapped = [false, false, false, false, false, false, true, false];
  const amrap = ['150', '150', '120', '200', '90', '180', '60', '110'];
  for (let i = 0; i < 8; i++) {
    await db.from('tournament_scores').insert({ tournament_id: tournId, tournament_wod_id: wods[0], athlete_id: AGENTS[i].id, score_value: ft[i], capped: ftCapped[i], status: 'validated' });
    await db.from('tournament_scores').insert({ tournament_id: tournId, tournament_wod_id: wods[1], athlete_id: AGENTS[i].id, score_value: amrap[i], status: 'validated' });
  }

  // Un score en attente bloque la clôture (refus nommé), puis on le valide.
  await db.from('tournament_scores').update({ status: 'pending' }).eq('tournament_wod_id', wods[1]).eq('athlete_id', AGENTS[7].id);
  const { error: pendErr } = await asOwner.rpc('finalize_tournament_elo', { p_tournament_id: tournId });
  assert(pendErr && /SCORES_EN_ATTENTE/.test(pendErr.message), 'simple : un score pending bloque la clôture (SCORES_EN_ATTENTE)', pendErr ?? { message: 'aucune erreur' });
  await db.from('tournament_scores').update({ status: 'validated' }).eq('tournament_wod_id', wods[1]).eq('athlete_id', AGENTS[7].id);

  // Classement serveur attendu, calculé à la main d'après le barème de l'app
  // (table CF Games 100, 97, 95, 93, 91, 89, 87, 85…), la base seule le calcule
  // (migration 20270116). Égalité sur un WOD : tie-break d'abord, puis rang
  // partagé et mêmes points, le rang suivant sauté ; un score illisible est ignoré.
  // WOD1 : A4(250) 1er 100 ; A1 et A2 (300, sans tie-break) 2es ex-aequo 97 ;
  //   A8(380) 4e 93 ; A3(420) 5e 91 ; puis les cappés : A7 (500 reps) 89,
  //   A5 (DNF hérité 999999+50 → cappé, 50 reps) 87 ; A6 (« abc ») : ignoré, 0.
  // WOD2 : A4(200) 100 ; A6(180) 97 ; A1 et A2 (150) 3es ex-aequo 95 ; A3(120) 91 ;
  //   A8(110) 89 ; A5(90) 87 ; A7(60) 85.
  // Cumul : A4 200, A1 192, A2 192, A3 182, A8 182, A5 174, A7 174, A6 97.
  const expected = { 1: 192, 2: 192, 3: 182, 4: 200, 5: 174, 6: 97, 7: 174, 8: 182 };
  const { data: standings, error: sErr } = await db.rpc('tournament_classique_standings', { p_tournament_id: tournId });
  assert(!sErr && standings?.length === 8, 'simple : tournament_classique_standings rend 8 lignes', sErr);
  const byId = Object.fromEntries((standings ?? []).map(s => [s.athlete_id, s]));
  const pointsOk = AGENTS.every((a, i) => byId[a.id]?.points === expected[i + 1]);
  assert(pointsOk, "simple : points SQL = barème de l'app (table CF Games, finishers < cappés, DNF hérité, illisible ignoré, ex-aequo à mêmes points)",
    pointsOk ? null : { message: AGENTS.map((a, i) => `A${i + 1}=${byId[a.id]?.points}/${expected[i + 1]}`).join(' ') });
  const rankOf = i => byId[AGENTS[i - 1].id]?.final_rank;
  assert(rankOf(4) === 1 && rankOf(1) === 2 && rankOf(2) === 2 && rankOf(3) === 4 && rankOf(8) === 4 && rankOf(7) === 6 && rankOf(5) === 6 && rankOf(6) === 8,
    'simple : rangs 1,2,2,4,4,6,6,8 (ex-aequo partagés au cumul)');

  const rows = await closeAndCheck('simple', tournId, { expectDistribution: true });
  if (rows) {
    const w = rows.find(r => r.final_rank === 1);
    assert(w?.athlete_id === AGENTS[3].id && w.elo_change > 0, `simple : le vainqueur (A4) gagne des points (+${w?.elo_change})`);
    const last = rows.find(r => r.athlete_id === AGENTS[5].id);
    assert(last?.final_rank === 8 && last.elo_change < 0, `simple : le dernier (A6) en perd (${last?.elo_change})`);
  }
}

// ── Bracket (simple élimination) ─────────────────────────────────────────────
async function playBracket(tournId, format) {
  const e = id => AGENTS.find(a => a.id === id)?.elo ?? 0;
  const resolve = async m => {
    // Le mieux classé (ELO) gagne : déterministe.
    const winner = e(m.participant1_id) >= e(m.participant2_id) ? m.participant1_id : m.participant2_id;
    const loser = winner === m.participant1_id ? m.participant2_id : m.participant1_id;
    await db.from('tournament_bracket_matches').update({ winner_id: winner, loser_id: loser ?? null, status: 'completed', completed_at: new Date().toISOString() }).eq('id', m.id);
  };
  // Tour par tour, comme le gérant : on tranche les matchs en attente du tour,
  // on avance (en swiss, un tour porte les deux tableaux), et on recommence.
  for (let guard = 0; guard < 20; guard++) {
    const { data: pending } = await db.from('tournament_bracket_matches')
      .select('id, round, participant1_id, participant2_id, side')
      .eq('tournament_id', tournId).eq('status', 'pending').order('round');
    if (!pending?.length) break;
    const round = pending[0].round;
    const ofRound = pending.filter(m => m.round === round);
    for (const m of ofRound) await resolve(m);
    // En swiss, crée aussi la grande finale, puis le match décisif s'il est dû.
    // Rend 0 une fois la dernière finale jouée.
    const { error } = await asOwner.rpc('advance_bracket_round', { p_tournament_id: tournId, p_completed_round: round });
    if (error) fail(`advance round ${round}`, error);
  }
}

async function suiteBracket(format) {
  console.log(`\n══ ${format} ${format === 'swiss' ? '(double élimination)' : '(simple élimination)'} ═══════════════════════════════`);
  const participants = AGENTS;
  const tournId = await createTournament(format, participants);
  const { error: r1Err } = await asOwner.rpc('generate_bracket_round_1', { p_tournament_id: tournId });
  if (!assert(!r1Err, `${format} : round 1 généré`, r1Err)) return;

  // Tableau non terminé : refus nommé.
  const { error: earlyErr } = await asOwner.rpc('finalize_tournament_elo', { p_tournament_id: tournId });
  assert(earlyErr && /TABLEAU_NON_TERMINE/.test(earlyErr.message), `${format} : clôture refusée tant qu'il reste des matchs (TABLEAU_NON_TERMINE)`, earlyErr ?? { message: 'aucune erreur' });

  await playBracket(tournId, format);
  const { count: mh } = await db.from('tournament_match_elo_history').select('*', { count: 'exact', head: true }).eq('tournament_id', tournId);
  assert(mh > 0, `${format} : ELO distribué match par match par le trigger (${mh} lignes tournament_match_elo_history)`);

  const rows = await closeAndCheck(format, tournId, { expectDistribution: false, participants });
  if (rows) {
    const champ = rows.find(r => r.final_rank === 1);
    assert(champ?.athlete_id === AGENTS[7].id, `${format} : le champion est le mieux classé (A8)`);
    // La ligne récap agrège les matchs : elo_change = somme des deltas de l'athlète.
    const { data: m } = await db.from('tournament_match_elo_history').select('athlete_id, elo_delta').eq('tournament_id', tournId);
    const sum = {}; for (const x of m ?? []) sum[x.athlete_id] = (sum[x.athlete_id] ?? 0) + x.elo_delta;
    assert(rows.every(r => r.elo_change === (sum[r.athlete_id] ?? 0)), `${format} : elo_change récap = Σ deltas des matchs`);
  }
  return tournId;
}

// ── Suppression d'un tournoi finalisé : refusée, il s'archive ────────────────
// Règle produit du 25/09/2026 (migration 20270124, qui remplace la PR 4) : un
// résultat validé ne disparaît jamais. Supprimer un tournoi qui en a est
// refusé, même par la clé serveur ; on l'archive, et ni l'ELO, ni les
// compteurs, ni les historiques ne bougent. Les sept clés d'historique restent
// en ON DELETE SET NULL ; un WOD de box supprimé garde sa trace (ci-dessous).
const HISTORY_FKS = [
  'elo_history_wod_id_fkey', 'box_elo_history_wod_id_fkey',
  'tournament_elo_history_tournament_id_fkey', 'tournament_match_elo_history_match_id_fkey',
  'tournament_wod_elo_history_tournament_wod_id_fkey',
  'daily_tournament_elo_history_tournament_id_fkey', 'inter_elo_history_competition_id_fkey',
];

async function suiteDeletion(tournId) {
  console.log('\n══ Suppression d\'un tournoi finalisé : refusée, il s\'archive, son ELO reste ════════════════════');
  if (!tournId) { fail('suppression : aucun tournoi bracket finalisé disponible'); return; }

  const adminUrl = process.env.TEST_ADMIN_DB_URL;
  if (adminUrl) {
    const { execSync } = await import('node:child_process');
    const out = execSync(`psql "${adminUrl}" -At -c "SELECT conname || '=' || confdeltype::text FROM pg_constraint WHERE conname = ANY('{${HISTORY_FKS.join(',')}}') ORDER BY 1"`).toString().trim().split(/\r?\n/);
    const notSetNull = out.filter(l => !l.endsWith('=n'));
    assert(out.length === HISTORY_FKS.length && notSetNull.length === 0,
      'catalogue : les 7 clés d\'historique sont en ON DELETE SET NULL',
      { message: `${out.length}/7 trouvées ; pas en SET NULL : ${notSetNull.join(', ') || 'aucune'}` });
  }

  const before = await snapshotProfiles();
  const { data: h0 } = await db.from('tournament_elo_history').select('id, athlete_id, elo_before, elo_after, tournament_id').eq('tournament_id', tournId);
  const { data: m0 } = await db.from('tournament_match_elo_history').select('id, athlete_id, result, elo_delta').eq('tournament_id', tournId);
  const ids = (h0 ?? []).map(h => h.id);
  const matchIds = (m0 ?? []).map(m => m.id);
  if (!assert(ids.length > 0 && matchIds.length > 0, `précondition : ${ids.length} lignes récap + ${matchIds.length} lignes match référencent le tournoi`)) return;

  // Un tournoi qui a des résultats validés ne se supprime pas, même par la clé
  // serveur ; on l'archive, et rien ne bouge.
  const { error: delErr } = await db.from('tournaments').delete().eq('id', tournId);
  assert(delErr?.code === '23001' && /TOURNOI_AVEC_RESULTATS/.test(delErr?.message ?? ''),
    'la suppression du tournoi finalisé est refusée (TOURNOI_AVEC_RESULTATS)', delErr ?? { message: 'aucune erreur' });
  const { count: tLeft } = await db.from('tournaments').select('*', { count: 'exact', head: true }).eq('id', tournId);
  assert(tLeft === 1, 'le tournoi existe toujours');

  const { count: h1 } = await db.from('tournament_elo_history').select('*', { count: 'exact', head: true }).in('id', ids);
  assert(h1 === ids.length, `tournament_elo_history : récapitulatif conservé (${h1}/${ids.length})`);
  const { count: m1 } = await db.from('tournament_match_elo_history').select('*', { count: 'exact', head: true }).in('id', matchIds);
  assert(m1 === matchIds.length, `tournament_match_elo_history : historique des matchs conservé (${m1}/${matchIds.length})`);

  const { data: archivedAt, error: archErr } = await db.rpc('archive_tournament', { p_tournament_id: tournId });
  assert(!archErr && archivedAt, "le tournoi finalisé s'archive (service_role)", archErr);

  // Chaque profil garde exactement ce que les matchs du tournoi lui avaient apporté.
  const apport = {};
  for (const m of m0 ?? []) {
    const a = (apport[m.athlete_id] ??= { elo: 0, n: 0, w: 0 });
    a.elo += m.elo_delta; a.n += 1; a.w += m.result === 'win' ? 1 : 0;
  }
  const after = await snapshotProfiles();
  const ecarts = AGENTS.filter(a => after[a.id].elo !== before[a.id].elo
    || after[a.id].total_matches !== before[a.id].total_matches
    || after[a.id].wins !== before[a.id].wins);
  assert(ecarts.length === 0, `profils : refus et archivage ne retirent aucun ELO (${ecarts.length} écart(s))`);
  // Contre-exemple : le tournoi avait bien apporté quelque chose, sinon l'assertion ne prouvait rien.
  assert(Object.values(apport).some(x => x.elo !== 0), 'contre-exemple : le tournoi avait bien fait bouger au moins un ELO');

  // WOD de box : même règle sur elo_history.wod_id.
  const { data: wod, error: wErr } = await db.from('box_wods').insert({
    box_id: BOX_ID, created_by: OWNER_ID, title: `[TEST] wod ${TAG}`, scheduled_date: new Date().toISOString().split('T')[0], is_published: true,
  }).select('id').single();
  if (!assert(!wErr && wod, 'décor : un WOD de box', wErr)) return;
  const { data: eh, error: ehErr } = await db.from('elo_history').insert({
    box_id: BOX_ID, wod_id: wod.id, member_id: AGENTS[0].id, elo_before: 1000, elo_after: 1012, elo_delta: 12, rank: 1,
  }).select('id').single();
  if (!assert(!ehErr && eh, 'décor : une ligne elo_history sur ce WOD', ehErr)) return;
  onCleanup(() => db.from('elo_history').delete().eq('id', eh.id));
  const { error: wDelErr } = await db.from('box_wods').delete().eq('id', wod.id);
  assert(!wDelErr, 'le WOD est supprimé', wDelErr);
  const { data: eh1 } = await db.from('elo_history').select('id, wod_id, elo_after').eq('id', eh.id).maybeSingle();
  assert(eh1 && eh1.wod_id === null && eh1.elo_after === 1012, 'elo_history : ligne conservée, wod_id = NULL (« WOD supprimé »), elo_after intact');
}

// ── Ligue avec divisions ─────────────────────────────────────────────────────
async function suiteLeague() {
  console.log('\n══ league_div ═══════════════════════════════════════════════════════════════');
  const tournId = await createTournament('league_div');
  const divs = {};
  for (const level of [1, 2]) {
    const { data: d } = await db.from('tournament_divisions').insert({ tournament_id: tournId, name: `Division ${level}`, level, max_members: 4, promote_count: level === 2 ? 1 : 0, relegate_count: level === 1 ? 1 : 0 }).select('id').single();
    divs[level] = d.id;
  }
  await db.from('tournament_division_members').delete().in('division_id', Object.values(divs));
  for (let i = 0; i < 8; i++) await db.from('tournament_division_members').insert({ division_id: divs[i < 4 ? 1 : 2], athlete_id: AGENTS[i].id, points: 0 });

  const { data: wod } = await db.from('tournament_wods').insert({ tournament_id: tournId, order_index: 1, title: '[TEST] S1 WOD', type: 'AMRAP', duration_minutes: 10, movements: '[]', scoring: 'Reps', status: 'active', season_number: 1 }).select('id').single();
  for (let i = 0; i < 8; i++) await db.from('tournament_scores').insert({ tournament_id: tournId, tournament_wod_id: wod.id, athlete_id: AGENTS[i].id, score_value: String(100 + i * 7), status: 'validated' });
  const { error: lwErr } = await asOwner.rpc('compute_league_wod_elo', { p_tournament_wod_id: wod.id });
  assert(!lwErr, 'league_div : ELO du WOD distribué par compute_league_wod_elo', lwErr);

  const rows = await closeAndCheck('league_div', tournId, { expectDistribution: false });
  if (rows) {
    const d1 = rows.filter(r => AGENTS.slice(0, 4).some(a => a.id === r.athlete_id)).map(r => r.final_rank);
    const d2 = rows.filter(r => AGENTS.slice(4).some(a => a.id === r.athlete_id)).map(r => r.final_rank);
    assert(Math.max(...d1) < Math.min(...d2), 'league_div : la division 1 est classée devant la division 2');
  }
}

// ── Grants : anon sans droit d'exécution ─────────────────────────────────────
async function suiteGrants() {
  console.log('\n══ Grants ═══════════════════════════════════════════════════════════════════');
  const { error } = await anonClient().rpc('finalize_tournament_elo', { p_tournament_id: '00000000-0000-0000-0000-000000000000' });
  assert(error && (error.code === '42501' || /permission denied/i.test(error.message)), 'anon : permission denied sur finalize_tournament_elo (TO authenticated seulement)', error ?? { message: 'aucune erreur' });
  const { error: e2 } = await anonClient().rpc('compute_tournament_elo', { p_tournament_id: '00000000-0000-0000-0000-000000000000' });
  assert(e2 && (e2.code === '42501' || /permission denied/i.test(e2.message)), 'anon : permission denied sur compute_tournament_elo (alias)', e2 ?? { message: 'aucune erreur' });
}

// ── Le piège : PATCH profiles d'un autre athlète → 204 et 0 ligne ────────────
async function suiteRlsTrap() {
  console.log('\n══ Piège RLS : PATCH profiles par le gérant ═════════════════════════════════');
  const victim = AGENTS[1];
  const { data: before } = await db.from('profiles').select('elo').eq('id', victim.id).single();
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${victim.id}`;
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };

  // Requête telle que l'ancien CloseTournamentButton l'émettait (sans Prefer).
  const r1 = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ elo: before.elo + 500 }) });
  assert(r1.status === 204, `PATCH profiles (autre athlète, sans Prefer) → HTTP ${r1.status} : « succès » apparent`);
  const { data: mid } = await db.from('profiles').select('elo').eq('id', victim.id).single();
  assert(mid.elo === before.elo, `…et pourtant 0 ligne modifiée (elo relu = ${mid.elo}, inchangé) : le 204 ne prouve rien`);

  // Avec Prefer: return=representation, la réponse dit la vérité : tableau vide.
  // (`select=` explicite : la lecture de profiles est limitée colonne par colonne,
  // une représentation `*` renverrait 403 pour la colonne email.)
  const r2 = await fetch(`${url}&select=id,elo`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ elo: before.elo + 500 }) });
  const body = await r2.json().catch(() => null);
  assert(r2.status === 200 && Array.isArray(body) && body.length === 0, `PATCH avec Prefer: return=representation → HTTP ${r2.status}, ${Array.isArray(body) ? body.length : '?'} ligne(s) : c'est la vérification à faire`);

  // Le gérant peut, lui, modifier SA ligne (la policy « own profile » fonctionne).
  const { data: own } = await db.from('profiles').select('bio').eq('id', OWNER_ID).single();
  const r3 = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${OWNER_ID}&select=id,bio`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ bio: own?.bio ?? null }) });
  const b3 = await r3.json().catch(() => null);
  assert(r3.status === 200 && Array.isArray(b3) && b3.length === 1, 'Contrôle : le même PATCH sur sa propre ligne renvoie 1 ligne');
}

// ── Helper SQL éphémère : dernier elo_after toutes tables confondues ─────────
// Installé via psql (TEST_ADMIN_DB_URL, fourni par test-stack.sh) et retiré à la
// fin : ce n'est pas un objet du schéma. Sans psql, l'assertion est sautée.
async function withLatestHelper(fn) {
  const adminUrl = process.env.TEST_ADMIN_DB_URL;
  if (!adminUrl) { info('TEST_ADMIN_DB_URL absent : vérification « toutes tables » sautée'); return fn(); }
  const { execSync } = await import('node:child_process');
  const sql = `
    CREATE OR REPLACE FUNCTION public._felo_latest_elo_after(p_athletes uuid[])
    RETURNS TABLE (athlete_id uuid, elo_after integer) LANGUAGE sql SECURITY DEFINER AS $$
      SELECT DISTINCT ON (athlete_id) athlete_id, elo_after FROM (
        SELECT member_id AS athlete_id, elo_after, created_at AS at FROM elo_history WHERE member_id = ANY(p_athletes)
        UNION ALL SELECT member_id, elo_after, created_at FROM box_elo_history WHERE member_id = ANY(p_athletes)
        UNION ALL SELECT athlete_id, elo_after, calculated_at FROM tournament_elo_history WHERE athlete_id = ANY(p_athletes)
        UNION ALL SELECT athlete_id, elo_after, created_at FROM tournament_match_elo_history WHERE athlete_id = ANY(p_athletes)
        UNION ALL SELECT athlete_id, elo_after, created_at FROM tournament_wod_elo_history WHERE athlete_id = ANY(p_athletes)
      ) u ORDER BY athlete_id, at DESC;
    $$;
    GRANT EXECUTE ON FUNCTION public._felo_latest_elo_after(uuid[]) TO service_role;
    NOTIFY pgrst, 'reload schema';`;
  execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -q`, { input: sql });
  onCleanup(() => execSync(`psql "${adminUrl}" -q -c "DROP FUNCTION IF EXISTS public._felo_latest_elo_after(uuid[])"`));
  await new Promise(r => setTimeout(r, 1500));
  await fn();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Clôture ELO — finalize_tournament_elo : tous formats, invariant, RLS   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  try {
    await setup();
    await withLatestHelper(async () => {
      await suiteGrants();
      await suiteRlsTrap();
      await suiteSimple();
      const bracketId = await suiteBracket('bracket');
      await suiteBracket('swiss');
      await suiteLeague();
      await suiteDeletion(bracketId);
    });
  } catch (e) {
    fail(`Exception : ${e?.message ?? e}`);
  } finally {
    await runCleanup();
  }
  console.log(`\n${res.failed === 0 ? '✅' : '❌'}  ${res.passed} réussi(s), ${res.failed} échec(s)`);
  process.exit(res.failed === 0 ? 0 : 1);
}
main();
