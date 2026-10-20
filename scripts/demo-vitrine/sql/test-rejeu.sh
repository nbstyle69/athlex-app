#!/usr/bin/env bash
# Test local des scripts SQL de la box vitrine, sur le rejeu sans Docker (PG17
# natif, port 54339, base `rejeu` déjà rejouée : voir supabase/README.md et le
# script replay-local.sh). Chaque cas part d'une copie neuve du décor.
#   scripts/demo-vitrine/sql/test-rejeu.sh
# Cas nominaux, idempotence, chaque ROLLBACK provoqué (décor ou mutation du
# script) avec preuve que rien n'a été écrit.
set -uo pipefail
cd "$(dirname "$0")"
export PGCLIENTENCODING=UTF8
PORT="${REJEU_PORT:-54339}"
P="psql -p $PORT -U supabase_admin -X -q -v ON_ERROR_STOP=1"
AF=d3d0b0a0-0000-4000-a000-000000000001
J=00000000-0000-4000-b523-00000000000a
K=00000000-0000-4000-b523-00000000000b
IDS='{00000000-0000-4000-d523-000000000001,00000000-0000-4000-d523-000000000002}'
TMP=$(mktemp -d)
cp proteges.sql "$TMP/"   # les copies mutées incluent proteges.sql par inclusion relative
echoue=0

$P -d postgres -c "DROP DATABASE IF EXISTS vitrine_fix WITH (FORCE)" -c "CREATE DATABASE vitrine_fix TEMPLATE rejeu" || exit 2
$P -d vitrine_fix -f test-fixture.sql || exit 2

neuve() { $P -d postgres -c "DROP DATABASE IF EXISTS vitrine_cas WITH (FORCE)" -c "CREATE DATABASE vitrine_cas TEMPLATE vitrine_fix" >/dev/null || exit 2; }
val() { $P -d vitrine_cas -A -t -c "$1" | tr -d '\r'; }
ok() { echo "ok    $1"; }
ko() { echo "ECHEC $1"; echoue=1; }
# attendre <libellé> <valeur obtenue> <valeur attendue>
attendre() { [ "$2" = "$3" ] && ok "$1" || ko "$1 (obtenu « $2 », attendu « $3 »)"; }
# jouer <fichier> [args psql…] → code de sortie, journal dans $TMP/log
jouer() { local f="$1"; shift; $P -d vitrine_cas "$@" -f "$f" >"$TMP/log" 2>&1; }
# Empreinte de ce que les scripts peuvent toucher.
EMPREINTE="SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
  SELECT 'd'||user_id FROM internal.demo_accounts
  UNION ALL SELECT 'm'||id||coalesce(plan_id::text,'-')||coalesce(subscription_status,'-')||coalesce(payment_method_type,'-') FROM public.box_members
  UNION ALL SELECT 'a'||id||coalesce(resolved_at::text,'-') FROM public.box_member_alerts
  UNION ALL SELECT 'n'||id FROM public.box_manager_notifications
  UNION ALL SELECT 't'||id FROM public.tournaments
  UNION ALL SELECT 'b'||id FROM public.tournament_bracket_matches
  UNION ALL SELECT 'h'||id FROM public.tournament_match_elo_history
  UNION ALL SELECT 'e'||id FROM public.tournament_elo_history
  UNION ALL SELECT 's'||id FROM public.tournament_scores) q(x)"
DECL="SELECT string_agg(tgname||':'||tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('trg_tournaments_resultats_conserves','trg_bracket_matches_termine_conserve')"
# rollback <libellé> <motif d'erreur attendu> <fichier> [args…] : échec attendu, rien d'écrit, déclencheurs intacts.
rollback() {
  local lib="$1" motif="$2"; shift 2
  local avant; avant=$(val "$EMPREINTE")
  if jouer "$@"; then ko "$lib : le script a réussi"; return; fi
  grep -q "$motif" "$TMP/log" && ok "$lib : refus $motif" || { ko "$lib : motif $motif absent"; tail -3 "$TMP/log"; }
  attendre "$lib : rien d'écrit" "$(val "$EMPREINTE")" "$avant"
  attendre "$lib : déclencheurs actifs" "$(val "$DECL")" "trg_bracket_matches_termine_conserve:O,trg_tournaments_resultats_conserves:O"
}
# muter <source> <cible> <perl -pe…> : la mutation doit s'appliquer.
muter() { perl -0pe "$3" "$1" > "$2"; cmp -s "$1" "$2" && { echo "point de mutation introuvable : $3"; exit 2; }; }

echo "== 01-activer.sql"
neuve
NOTIF0=$(val "SELECT count(*) FROM box_manager_notifications")
jouer 01-activer.sql -v box=$AF && ok "A1 activation AthleX Fitness" || { ko "A1"; cat "$TMP/log"; }
grep -o 'VITRINE_ACTIVER.*' "$TMP/log"
attendre "A1 demo_accounts" "$(val "SELECT count(*) FROM internal.demo_accounts")" 51
attendre "A1 formule (Accès démo, active, cash)" "$(val "SELECT count(*) FROM box_members WHERE box_id='$AF' AND plan_id='00000000-0000-4000-c523-0000000000a1' AND subscription_status='active' AND payment_method_type='cash'")" 50
attendre "A1 coach sans formule" "$(val "SELECT coalesce(plan_id::text,'-') FROM box_members WHERE box_id='$AF' AND role='coach'")" "-"
attendre "A1 gérant, réel et motif voisin (+51) intacts" "$(val "SELECT count(*) FROM box_members bm JOIN auth.users u ON u.id=bm.member_id WHERE bm.box_id='$AF' AND (u.email LIKE 'reel-%' OR u.email='demo.vitrine+51@athlexapp.eu') AND (bm.plan_id IS NULL OR bm.plan_id <> '00000000-0000-4000-c523-0000000000a1') AND NOT EXISTS (SELECT 1 FROM internal.demo_accounts d WHERE d.user_id=bm.member_id)")" 3
attendre "A1 box J intacte" "$(val "SELECT count(*) FROM box_members WHERE box_id='$J' AND plan_id IS NOT NULL")" 0
attendre "A1 alerte résolue" "$(val "SELECT count(*) FROM box_member_alerts WHERE resolved_at IS NULL")" 0
attendre "A1 notifications inchangées" "$(val "SELECT count(*) FROM box_manager_notifications")" "$NOTIF0"
attendre "A1 classement global sans fictifs" "$(val "SELECT count(*) FROM global_leaderboard(500,0) g WHERE g.username LIKE 'v523_%' AND g.id IN (SELECT id FROM auth.users WHERE email LIKE 'demo.vitrine+%' AND email <> 'demo.vitrine+51@athlexapp.eu')")" 0
E1=$(val "$EMPREINTE")
jouer 01-activer.sql -v box=$AF && grep -q 'demo_accounts_ajouts=0 formule_ecrites=0 alertes_resolues=0' "$TMP/log" && ok "A2 rejeu : rien d'écrit" || { ko "A2"; cat "$TMP/log"; }
attendre "A2 empreinte inchangée" "$(val "$EMPREINTE")" "$E1"

neuve; jouer 01-activer.sql -v box=$J -v n_membres=4 && ok "A3 box jetable J, 4 membres" || { ko "A3"; cat "$TMP/log"; }
attendre "A3 formule de J" "$(val "SELECT count(*) FROM box_members WHERE box_id='$J' AND plan_id='00000000-0000-4000-c523-0000000000b1' AND subscription_status='active'")" 4
attendre "A3 AthleX Fitness intacte" "$(val "SELECT count(*) FROM box_members WHERE box_id='$AF' AND plan_id='00000000-0000-4000-c523-0000000000a1'")" 0

neuve; rollback "R1 box jetable avec un membre réel" VITRINE_BOX 01-activer.sql -v box=$K -v n_membres=4
neuve; val "DELETE FROM box_members WHERE member_id='00000000-0000-4000-a523-000000000033' AND box_id='$AF'" >/dev/null
rollback "R2 49 membres au lieu de 50" VITRINE_COMPTES 01-activer.sql -v box=$AF
neuve; val "DELETE FROM box_members WHERE member_id='00000000-0000-4000-a523-000000000051' AND box_id='$AF'" >/dev/null
rollback "R3 coach absent (50 comptes au lieu de 51)" VITRINE_COMPTES 01-activer.sql -v box=$AF
neuve; muter 01-activer.sql "$TMP/m-formule.sql" 's/WHERE bm\.id = c\.box_member_id AND c\.est_membre/WHERE bm.id = c.box_member_id AND c.est_membre AND c.member_id <> (SELECT member_id FROM vitrine_cible WHERE est_membre ORDER BY member_id LIMIT 1)/'
rollback "R4 mutation : un membre sans formule (49)" VITRINE_CONTROLE "$TMP/m-formule.sql" -v box=$AF
neuve; muter 01-activer.sql "$TMP/m-demo.sql" 's/SELECT member_id FROM vitrine_cible\n  ON CONFLICT/SELECT member_id FROM vitrine_cible WHERE est_membre\n  ON CONFLICT/'
rollback "R5 mutation : coach absent de demo_accounts (50)" VITRINE_CONTROLE "$TMP/m-demo.sql" -v box=$AF
neuve; muter 01-activer.sql "$TMP/m-notif.sql" 's/(  -- Contrôles de fin\.)/  INSERT INTO public.box_manager_notifications (box_id, type, event_ref, member_id) SELECT v_box, '\''invitation_accepted'\'', '\''mutation'\'', member_id FROM vitrine_cible LIMIT 1;\n$1/'
rollback "R6 mutation : une notification gérant filée" VITRINE_NOTIFICATIONS "$TMP/m-notif.sql" -v box=$AF
neuve; muter 01-activer.sql "$TMP/m-alerte.sql" 's/SET resolved_at = now\(\), resolved_by = auth\.uid\(\)\n   WHERE a\.box_id = v_box/SET resolved_at = now(), resolved_by = auth.uid()\n   WHERE false AND a.box_id = v_box/'
rollback "R7 mutation : alerte non résolue" VITRINE_ALERTES "$TMP/m-alerte.sql" -v box=$AF
neuve; val "UPDATE membership_plans SET name=name||' (ancien)' WHERE id='00000000-0000-4000-c523-0000000000a1'" >/dev/null
rollback "R8 formule « Accès démo » absente" VITRINE_FORMULE 01-activer.sql -v box=$AF

echo "== 90-purger-tournois.sql"
grep -v '^ *--' 90-purger-tournois.sql | grep -Eiq 'SET +(LOCAL +)?session_replication_role|session_replication_role *(=|TO)|DISABLE TRIGGER (ALL|USER)' && ko "P0 motif interdit présent" || ok "P0 ni session_replication_role, ni DISABLE TRIGGER ALL"
attendre "P0 exactement deux DISABLE nommés" "$(grep -c 'DISABLE TRIGGER trg_' 90-purger-tournois.sql)" 2
neuve
attendre "P1 décor : suppression directe refusée" "$($P -d vitrine_cas -c "DELETE FROM tournaments WHERE id='00000000-0000-4000-d523-000000000001'" 2>&1 | grep -c TOURNOI_AVEC_RESULTATS)" 1
jouer 90-purger-tournois.sql -v box=$AF -v ids="$IDS" && ok "P1 purge TV1 (bracket terminé) + TV2 (ligue en cours)" || { ko "P1"; cat "$TMP/log"; }
grep -o 'VITRINE_PURGE_[A-Z]*.*' "$TMP/log"
attendre "P1 tournois listés supprimés" "$(val "SELECT count(*) FROM tournaments WHERE id = ANY('$IDS'::uuid[])")" 0
attendre "P1 historiques ELO supprimés" "$(val "SELECT (SELECT count(*) FROM tournament_match_elo_history WHERE tournament_id = ANY('$IDS'::uuid[])) + (SELECT count(*) FROM tournament_elo_history WHERE tournament_id IS NULL OR tournament_id = ANY('$IDS'::uuid[]))")" 0
attendre "P1 membres de division supprimés" "$(val "SELECT count(*) FROM tournament_division_members WHERE division_id='00000000-0000-4000-f523-000000000001'")" 0
attendre "P1 TX non listé conservé (matchs et ELO)" "$(val "SELECT (SELECT count(*) FROM tournaments WHERE name='TX') || '/' || (SELECT count(*) FROM tournament_match_elo_history WHERE tournament_id='00000000-0000-4000-d523-000000000003')")" "1/2"
attendre "P1 déclencheurs réactivés" "$(val "$DECL")" "trg_bracket_matches_termine_conserve:O,trg_tournaments_resultats_conserves:O"
attendre "P1 garde toujours effective sur TX" "$($P -d vitrine_cas -c "DELETE FROM tournaments WHERE name='TX'" 2>&1 | grep -c TOURNOI_AVEC_RESULTATS)" 1
E2=$(val "$EMPREINTE")
jouer 90-purger-tournois.sql -v box=$AF -v ids="$IDS" && grep -q 'trouves=0' "$TMP/log" && ok "P2 rejeu : rien à supprimer" || { ko "P2"; cat "$TMP/log"; }
attendre "P2 empreinte inchangée" "$(val "$EMPREINTE")" "$E2"

neuve; muter 90-purger-tournois.sql "$TMP/m-enable1.sql" 's/ALTER TABLE public\.tournaments ENABLE TRIGGER trg_tournaments_resultats_conserves;\n//'
rollback "R9 mutation : garde des tournois laissée désactivée" VITRINE_DECLENCHEURS "$TMP/m-enable1.sql" -v box=$AF -v ids="$IDS"
neuve; muter 90-purger-tournois.sql "$TMP/m-enable2.sql" 's/ALTER TABLE public\.tournament_bracket_matches ENABLE TRIGGER trg_bracket_matches_termine_conserve;\n//'
rollback "R10 mutation : garde des matchs laissée désactivée" VITRINE_DECLENCHEURS "$TMP/m-enable2.sql" -v box=$AF -v ids="$IDS"
neuve; muter 90-purger-tournois.sql "$TMP/m-reste.sql" 's/DELETE FROM public\.tournament_elo_history       WHERE/DELETE FROM public.tournament_elo_history WHERE false AND/'
rollback "R11 mutation : historique de clôture oublié" VITRINE_RESTE "$TMP/m-reste.sql" -v box=$AF -v ids="$IDS"
neuve; rollback "R12 tournoi listé d'une autre box" VITRINE_BOX 90-purger-tournois.sql -v box=$AF -v ids='{00000000-0000-4000-d523-000000000001,00000000-0000-4000-d523-000000000004}'
neuve; rollback "R13 session_replication_role ≠ origin" VITRINE_REPLICATION 90-purger-tournois.sql -v box=$AF -v ids="$IDS" -c "SET session_replication_role = replica"

echo "== purge enchaînée : 80-releve-purge, 90, 91, suppression des comptes, 99-controle-purge"
COMPTES="{$(val "SELECT string_agg(id::text, ',') FROM auth.users WHERE email ~ '^demo\.vitrine\+((0[1-9]|[1-4][0-9]|50)|coach)@athlexapp\.eu$'")}"
RELEVE="$(cygpath -m "$TMP")/releve.sql"
supprimer_comptes() { $P -d vitrine_cas -c "DELETE FROM auth.users WHERE id = ANY('$COMPTES'::uuid[])" >"$TMP/del" 2>&1; }
# chaine [fichier 80] [sans91] : enchaîne jusqu'au contrôle ; affiche l'étape en échec (journal dans $TMP/log).
chaine() {
  jouer "${1:-80-releve-purge.sql}" -v box=$AF -v comptes="$COMPTES" -v tournois="$IDS" -v releve="$RELEVE" || { echo "80"; return 1; }
  cp "$TMP/log" "$TMP/log80"
  jouer 90-purger-tournois.sql -v box=$AF -v ids="$IDS" || { echo "90"; return 1; }
  if [ "${2:-}" != "sans91" ]; then jouer 91-supprimer-lignes-fictifs.sql -v comptes="$COMPTES" -v releve="$RELEVE" || { echo "91"; return 1; }; fi
  supprimer_comptes || { cp "$TMP/del" "$TMP/log"; echo "comptes"; return 1; }
  jouer 99-controle-purge.sql -v comptes="$COMPTES" -v tournois="$IDS" -v releve="$RELEVE" || { echo "99"; return 1; }
}
releve_seul() { jouer 80-releve-purge.sql -v box=$AF -v comptes="$COMPTES" -v tournois="$IDS" -v releve="$RELEVE"; }

neuve; jouer 01-activer.sql -v box=$AF >/dev/null || ko "C0 activation"
etape=$(chaine) && ok "C1 purge complète : contrôle à 0" || { ko "C1 (échec en $etape)"; tail -5 "$TMP/log"; }
grep -o 'VITRINE_RELEVE .*' "$TMP/log80" | sed 's/^/      /'
grep -o 'VITRINE_FICTIFS.*\|VITRINE_CONTROLE_PURGE.*' "$TMP/log"
attendre "C1 relevé : WOD créé par le coach (mise à NULL, ligne du fictif)" "$(grep -c 'VITRINE_RELEVE box_wods.created_by fictif = 1' "$TMP/log80")" 1
attendre "C1 relevé : alerte ouverte par le coach (part en cascade avec +07)" "$(grep -c 'VITRINE_RELEVE box_member_alerts.created_by cascade = 1' "$TMP/log80")" 1
attendre "C1 relevé : tournoi créé et scores validés par le coach" "$(grep -c 'VITRINE_RELEVE tournaments.created_by tournoi = 1' "$TMP/log80")/$(grep -c 'VITRINE_RELEVE tournament_scores.validated_by tournoi = 4' "$TMP/log80")" "1/1"
attendre "C1 WOD du coach supprimé (règle : ligne du fictif)" "$(val "SELECT count(*) FROM box_wods WHERE id='00000000-0000-4000-e523-0000000000f1'")" 0
attendre "C1 demo_accounts vidé par cascade" "$(val "SELECT count(*) FROM internal.demo_accounts")" 0
attendre "C1 gérant, réel et +51 conservés" "$(val "SELECT count(*) FROM auth.users WHERE email IN ('reel-900@test.invalid','reel-901@test.invalid','demo.vitrine+51@athlexapp.eu')")" 3
attendre "C1 tournois non listés conservés, matchs et ELO des réels compris" "$(val "SELECT (SELECT count(*) FROM tournaments WHERE name IN ('TX','TK')) || '/' || (SELECT count(*) FROM tournament_match_elo_history WHERE tournament_id='00000000-0000-4000-d523-000000000003')")" "2/2"

neuve; jouer 01-activer.sql -v box=$AF >/dev/null
if etape=$(chaine 80-releve-purge.sql sans91); then ko "C2 mutation SET NULL : 91 omis, contrôle passé"
elif [ "$etape" = 99 ] && grep -q 'VITRINE_RESTE_RELEVE box_wods.id = 00000000-0000-4000-e523-0000000000f1' "$TMP/log"; then
  ok "C2 mutation SET NULL (91 omis) : WOD du fictif orphelin à NULL, contrôle en échec"
else ko "C2 (échec en $etape)"; tail -3 "$TMP/log"; fi

neuve; val "CREATE TABLE public.v523_sans_action (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membre uuid REFERENCES public.profiles (id)); INSERT INTO public.v523_sans_action (membre) VALUES ('00000000-0000-4000-a523-000000000002')" >/dev/null
E3=$(val "$EMPREINTE")
if releve_seul; then ko "C3 NO ACTION : relevé passé"
elif grep -q 'VITRINE_BLOQUANT: v523_sans_action.membre=1 (bloquant)' "$TMP/log"; then ok "C3 NO ACTION hors tournoi : STOP avant toute écriture (v523_sans_action.membre=1)"
else ko "C3"; tail -3 "$TMP/log"; fi
attendre "C3 rien d'écrit" "$(val "$EMPREINTE")" "$E3"
muter 80-releve-purge.sql "$TMP/m-bloquant.sql" "s/IF r\.classe IN \('bloquant', 'reel', 'tournoi_autre'\)/IF r.classe IN ('reel', 'tournoi_autre')/"
jouer 01-activer.sql -v box=$AF >/dev/null
if etape=$(chaine "$TMP/m-bloquant.sql"); then ko "C3m mutation : purge passée malgré NO ACTION"
elif [ "$etape" = comptes ] && grep -q 'v523_sans_action' "$TMP/log"; then
  ok "C3m mutation (contrôle NO ACTION retiré) : la suppression des comptes casse en pleine purge, tournois déjà supprimés"
else ko "C3m (échec en $etape)"; tail -3 "$TMP/log"; fi

neuve; val "UPDATE public.box_member_alerts SET member_id = '00000000-0000-4000-a523-000000000901'" >/dev/null
E4=$(val "$EMPREINTE")
if releve_seul; then ko "C4 ligne d'un vrai compte : relevé passé"
elif grep -q 'box_member_alerts.created_by=1 (reel)' "$TMP/log"; then ok "C4 ligne d'un vrai compte qui cite un fictif : STOP"
else ko "C4"; tail -3 "$TMP/log"; fi
attendre "C4 rien d'écrit" "$(val "$EMPREINTE")" "$E4"
muter 80-releve-purge.sql "$TMP/m-reel.sql" "s/IF r\.classe IN \('bloquant', 'reel', 'tournoi_autre'\)/IF r.classe IN ('bloquant', 'tournoi_autre')/"
jouer 01-activer.sql -v box=$AF >/dev/null
if etape=$(chaine "$TMP/m-reel.sql"); then ko "C4m mutation : contrôle passé"
elif [ "$etape" = 99 ] && grep -q 'VITRINE_RESTE_RELEVE box_member_alerts' "$TMP/log"; then
  ok "C4m mutation (contrôle « réel » retiré) : l'alerte du vrai compte reste avec created_by à NULL, contrôle en échec"
else ko "C4m (échec en $etape)"; tail -3 "$TMP/log"; fi

neuve; val "UPDATE public.tournament_bracket_matches SET participant2_id = '00000000-0000-4000-a523-000000000009' WHERE tournament_id = '00000000-0000-4000-d523-000000000003'" >/dev/null
if releve_seul; then ko "C5 fictif dans un tournoi non listé : relevé passé"
elif grep -q 'tournament_bracket_matches.participant2_id=1 (tournoi_autre)' "$TMP/log"; then ok "C5 fictif dans un tournoi non listé : STOP"
else ko "C5"; tail -3 "$TMP/log"; fi

neuve; val "INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity) VALUES ('00000000-0000-4000-e523-0000000000c1', '$AF', 'WOD', current_date + 2, '18:00', '19:00', 1); INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status) VALUES ('00000000-0000-4000-e523-0000000000c1', '00000000-0000-4000-a523-000000000001', '$AF', 'confirmed'), ('00000000-0000-4000-e523-0000000000c1', '00000000-0000-4000-a523-000000000901', '$AF', 'waiting')" >/dev/null
attendre "C6 décor : un réel en liste d'attente derrière un fictif" "$(val "SELECT string_agg(status, ',' ORDER BY status) FROM class_reservations WHERE schedule_id='00000000-0000-4000-e523-0000000000c1'")" "confirmed,waiting"
if releve_seul; then ko "C6 liste d'attente : relevé passé"
elif grep -q 'class_reservations.waiting=1' "$TMP/log"; then ok "C6 réel en liste d'attente sur un créneau d'un fictif : STOP"
else ko "C6"; tail -3 "$TMP/log"; fi

echo "== ELO des comptes réels protégés : 10-contact-elo, 80 (contact), 20-empreinte-elo"
REF="$(cygpath -m "$TMP")/empreinte-ref.sql"
WF=00000000-0000-4000-e523-0000000000e1; WR=00000000-0000-4000-e523-0000000000e2; WK=00000000-0000-4000-e523-0000000000e3
F1=00000000-0000-4000-a523-000000000001; F2=00000000-0000-4000-a523-000000000002; REEL=00000000-0000-4000-a523-000000000901
deux_wods() { val "INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date, is_published, leaderboard_enabled) VALUES ('$WF', '$AF', 'WOD des fictifs', 'amrap', current_date - 3, true, true), ('$WR', '$AF', 'WOD du reel', 'amrap', current_date - 2, true, true)" >/dev/null; }
# scorer <wod> <membre> <valeur>
scorer() { val "INSERT INTO public.wod_scores (wod_id, member_id, box_id, score_type, score_value, rx, scaled) VALUES ('$1', '$2', '$AF', 'reps', $3, true, false)" >/dev/null; }
# elo <wod> : calcul comme l'app, connecté comme le compte réel (membre actif).
elo() { val "SET request.jwt.claims = '{\"sub\":\"$REEL\",\"role\":\"authenticated\"}'; SELECT count(*) FROM public.compute_wod_elo('$1'); SELECT count(*) FROM public.compute_box_elo('$1');" >/dev/null; }
# historique <box> <wod> : une ligne elo_history du compte réel, écrite telle quelle (décor).
historique() { val "INSERT INTO public.elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank) VALUES ('$1', '$2', '$REEL', 1000, 1012, 12, 1)" >/dev/null; }
prise() { jouer "${1:-20-empreinte-elo.sql}" -v box=$AF -v sortie="$REF"; }
comparer() { jouer "${1:-20-empreinte-elo.sql}" -v box=$AF -v reference="$REF"; }
# vitrine_jouee : décor commun — une ligne figée du réel (WOD sans fictif), empreinte, activation, fictifs entre eux avec ELO.
vitrine_jouee() {
  neuve; deux_wods; scorer $WR $REEL 120; historique $AF $WR
  prise "${1:-20-empreinte-elo.sql}" || { ko "décor : prise"; tail -3 "$TMP/log"; }
  jouer 01-activer.sql -v box=$AF >/dev/null
  scorer $WF $F1 200; scorer $WF $F2 150; elo $WF
}

vitrine_jouee
printf "SELECT set_config('vitrine.box', '%s', false) AS b \\\\gset x_\n\\\\i %s/proteges.sql\nSELECT cardinality(current_setting('vitrine.proteges')::uuid[]);\n" "$AF" "$(cygpath -m "$PWD")" > "$TMP/p0.sql"
attendre "P0 protégés du décor : gérant, réel, motif voisin (+51)" "$($P -d vitrine_cas -A -t -f "$TMP/p0.sql" | tr -d '\r' | tail -1)" 3
grep -q "$REEL" "$REF" && ! grep -q '@' "$REF" && ok "P0 fichier d'empreinte : uuid et md5 seulement" || ko "P0 contenu du fichier"
grep -o 'VITRINE_EMPREINTE prise.*' "$TMP/log" | sed 's/^/      /'

# E1 : contact par un score réel posé après les fictifs → le signalement arrête tout.
neuve; deux_wods; jouer 01-activer.sql -v box=$AF >/dev/null
scorer $WF $F1 200; scorer $WF $F2 150; scorer $WF $REEL 180
E5=$(val "$EMPREINTE")
if jouer 10-contact-elo.sql -v box=$AF; then ko "E1 contact réel/fictif : signalement passé"
elif grep -q "VITRINE_CONTACT: .*\[WOD $WF, [0-9-]*, 1 compte(s)\]" "$TMP/log"; then ok "E1 un réel score après des fictifs sur le même WOD : STOP (WOD, date, 1 compte)"
else ko "E1"; tail -3 "$TMP/log"; fi
grep -q "$REEL\|reel-901" "$TMP/log" && ko "E1 un identifiant de personne apparaît" || ok "E1 aucun identifiant de personne dans le signalement"
attendre "E1 rien d'écrit" "$(val "$EMPREINTE")" "$E5"
muter 10-contact-elo.sql "$TMP/m-contact.sql" "s/IF v_liste <> '' THEN/IF false THEN/"
jouer "$TMP/m-contact.sql" -v box=$AF && ok "E1m mutation (signalement retiré) : le contact passe inaperçu, le cas E1 la détecte" || { ko "E1m"; tail -3 "$TMP/log"; }

# E2 : jamais en contact → lignes figées intactes après la purge.
vitrine_jouee
jouer 10-contact-elo.sql -v box=$AF && ok "E2 aucun contact signalé" || { ko "E2 contact"; tail -3 "$TMP/log"; }
etape=$(chaine) && ok "E2 purge complète" || { ko "E2 purge (échec en $etape)"; tail -5 "$TMP/log"; }
comparer && grep -q "VITRINE_EMPREINTE lignes figées intactes : 2" "$TMP/log" && ok "E2 réel jamais en contact : lignes figées intactes après la purge (2 : historique de WOD + match du tournoi non listé)" || { ko "E2 comparaison"; tail -3 "$TMP/log"; }

# Ea : ligne d'historique légitime nouvelle, dans une autre box, et ELO courant changé → pas de STOP.
vitrine_jouee
val "INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date, is_published, leaderboard_enabled) VALUES ('$WK', '$K', 'WOD autre box', 'amrap', current_date - 1, true, true); UPDATE public.profiles SET elo = elo + 12, total_matches = total_matches + 1 WHERE id = '$REEL'" >/dev/null
historique $K $WK
etape=$(chaine) || { ko "Ea purge (échec en $etape)"; tail -5 "$TMP/log"; }
if comparer; then ok "Ea ligne nouvelle légitime (autre box) et ELO courant changé : pas de STOP"; grep -o 'VITRINE_ELO_COURANT.*' "$TMP/log" | sed 's/^/      /'
else ko "Ea STOP à tort"; tail -3 "$TMP/log"; fi
grep -q 'VITRINE_ELO_COURANT (information) : 2 compte(s) inchangé(s), 1 changé(s)' "$TMP/log" && ok "Ea ELO courant : affiché en nombre (2 inchangés, 1 changé), sans identifiant" || ko "Ea information ELO courant"
muter 20-empreinte-elo.sql "$TMP/m-courant.sql" "s/RAISE NOTICE 'VITRINE_ELO_COURANT/RAISE EXCEPTION 'VITRINE_ELO_COURANT/"
if comparer "$TMP/m-courant.sql"; then ko "Eam mutation (ELO courant bloquant) : pas d'arrêt"
else ok "Eam mutation (ELO courant traité comme bloquant) : arrêt à tort, le cas Ea la détecte"; fi

# Eb : ligne figée modifiée → STOP.
vitrine_jouee
etape=$(chaine) || { ko "Eb purge (échec en $etape)"; tail -5 "$TMP/log"; }
val "UPDATE public.elo_history SET elo_after = elo_after + 1 WHERE member_id = '$REEL' AND wod_id = '$WR'" >/dev/null
if comparer; then ko "Eb ligne figée modifiée : pas de STOP"
elif grep -q 'VITRINE_EMPREINTE: elo_history : 1 ligne(s) figée(s) modifiée(s) ou supprimée(s) sur 1' "$TMP/log"; then ok "Eb ligne figée modifiée : STOP (elo_history : 1 sur 1)"
else ko "Eb"; tail -3 "$TMP/log"; fi
muter 20-empreinte-elo.sql "$TMP/m-md5.sql" "s/string_agg\(concat_ws\(',', t, id, m\)/string_agg(concat_ws(',', t, id)/"
vitrine_jouee "$TMP/m-md5.sql"
etape=$(chaine) || { ko "Ebm purge (échec en $etape)"; tail -5 "$TMP/log"; }
val "UPDATE public.elo_history SET elo_after = elo_after + 1 WHERE member_id = '$REEL' AND wod_id = '$WR'" >/dev/null
comparer "$TMP/m-md5.sql" && ok "Ebm mutation (md5 des lignes retiré) : la modification passe inaperçue, le cas Eb la détecte" || { ko "Ebm"; tail -3 "$TMP/log"; }

# Ez : prise sous TimeZone = 'Europe/Paris', comparaison sous UTC → identique (réglages fixés dans le script).
vitrine_jouee_tz() { # <fichier 20>
  neuve; deux_wods; scorer $WR $REEL 120; historique $AF $WR
  jouer "$1" -c "SET TimeZone = 'Europe/Paris'" -v box=$AF -v sortie="$REF" || { ko "Ez prise"; tail -3 "$TMP/log"; }
  jouer 01-activer.sql -v box=$AF >/dev/null
  scorer $WF $F1 200; scorer $WF $F2 150; elo $WF
  chaine >/dev/null || ko "Ez purge"
  jouer "$1" -c "SET TimeZone = 'UTC'" -v box=$AF -v reference="$REF"
}
if vitrine_jouee_tz 20-empreinte-elo.sql; then ok "Ez prise sous Europe/Paris, comparaison sous UTC : identique"
else ko "Ez fuseaux différents : écart"; tail -3 "$TMP/log"; fi
muter 20-empreinte-elo.sql "$TMP/m-tz.sql" "s/SET TimeZone = 'UTC';\n//"
if vitrine_jouee_tz "$TMP/m-tz.sql"; then ko "Ezm mutation (TimeZone non fixé) : écart non vu"
elif grep -q 'VITRINE_EMPREINTE: elo_history' "$TMP/log"; then ok "Ezm mutation (TimeZone non fixé) : la même ligne lue sous deux fuseaux change de md5, STOP à tort — le cas Ez la détecte"
else ko "Ezm"; tail -3 "$TMP/log"; fi

# Ec : ligne nouvelle d'un compte protégé sur un WOD scoré par un fictif, glissée sans score (le signalement ne la voit pas) → STOP à 80.
vitrine_jouee
historique $AF $WF
jouer 10-contact-elo.sql -v box=$AF && ok "Ec décor : le signalement (scores) ne la voit pas" || { ko "Ec décor"; tail -3 "$TMP/log"; }
E6=$(val "$EMPREINTE")
if etape=$(chaine); then ko "Ec ligne au contact : purge passée"
elif [ "$etape" = 80 ] && grep -q "elo_history=1 (ELO d'un compte protégé au contact des fictifs)" "$TMP/log"; then ok "Ec ligne ELO d'un protégé sur un WOD des fictifs : STOP au relevé, avant toute suppression"
else ko "Ec (échec en $etape)"; tail -3 "$TMP/log"; fi
attendre "Ec rien d'écrit" "$(val "$EMPREINTE")" "$E6"
muter 80-releve-purge.sql "$TMP/m-contact80.sql" "s/    IF r\.n > 0 THEN/    IF false THEN/"
vitrine_jouee; historique $AF $WF
if etape=$(chaine "$TMP/m-contact80.sql") && comparer; then ok "Ecm mutation (contrôle de contact retiré de 80) : purge et empreinte passent, la contamination reste — le cas Ec la détecte"
else ko "Ecm (échec en $etape)"; tail -3 "$TMP/log"; fi

echo "== 30-empreinte-box : box et lignes à ne pas toucher"
REFB="$(cygpath -m "$TMP")/empreinte-box.sql"
CRENEAU="INSERT INTO public.class_schedules (id, box_id, title, scheduled_date, start_time, end_time, max_capacity) VALUES ('00000000-0000-4000-e523-0000000000c2', '$AF', 'WOD', current_date + 3, '07:00', '08:00', 12)"
# essai_box [fichier 30] : décor (créneau, score réel), prise, activité des fictifs, purge complète.
essai_box() {
  neuve; deux_wods; val "$CRENEAU" >/dev/null; scorer $WR $REEL 120
  # Le décor contient déjà ce que l'essai créera (tournois de vitrine, WOD du
  # coach, comptes rattachés) : on le retire avant la prise et on remet les
  # comptes après, comme le seed (compteur de membres de la box compris).
  jouer 90-purger-tournois.sql -v box=$AF -v ids="$IDS" >/dev/null
  val "DELETE FROM public.box_wods WHERE id = '00000000-0000-4000-e523-0000000000f1'" >/dev/null
  val "CREATE TABLE public.v523_bm AS SELECT * FROM public.box_members WHERE box_id = '$AF' AND member_id = ANY ('$COMPTES'::uuid[]); DELETE FROM public.box_members WHERE id IN (SELECT id FROM public.v523_bm)" >/dev/null
  jouer "${1:-30-empreinte-box.sql}" -v box=$AF -v sortie="$REFB" || { ko "B prise"; tail -3 "$TMP/log"; }
  cp "$TMP/log" "$TMP/logprise"
  val "INSERT INTO public.box_members SELECT * FROM public.v523_bm; DROP TABLE public.v523_bm" >/dev/null
  jouer 01-activer.sql -v box=$AF >/dev/null
  scorer $WF $F1 200; scorer $WF $F2 150; elo $WF
  val "INSERT INTO public.class_reservations (schedule_id, member_id, box_id, status) VALUES ('00000000-0000-4000-e523-0000000000c2', '$F1', '$AF', 'confirmed')" >/dev/null
  chaine >/dev/null || { ko "B purge"; tail -3 "$TMP/log"; }
}
essai_box
grep -o 'VITRINE_EMPREINTE_BOX prise.*' "$TMP/logprise" | sed 's/^/      /'
grep -q "$REEL" "$REFB" && ! grep -q '@' "$REFB" && ok "B0 fichier : uuid et md5 seulement" || ko "B0 contenu du fichier"
val "INSERT INTO public.class_schedules (box_id, title, scheduled_date, start_time, end_time, max_capacity) VALUES ('$AF', 'WOD cron', current_date + 30, '07:00', '08:00', 12)" >/dev/null   # comme extend-class-schedules
if jouer 30-empreinte-box.sql -v box=$AF -v reference="$REFB"; then ok "B1 après la purge : identique (créneau créé entre-temps compté pour information)"
else ko "B1 écart"; tail -4 "$TMP/log"; fi
grep -q 'b.class_schedules : 1 ligne(s) figée(s), 0 modifiée(s) ou supprimée(s) ; 1 nouvelle(s)' "$TMP/log" && ok "B1 nouveau créneau : information, sans arrêt" || { ko "B1 information"; grep VITRINE_BOX "$TMP/log" | tail -3; }
grep -q "b.boxes : lignes 1 → 1 identique" "$TMP/log" && ok "B1 ligne de la box identique (compteur de membres revenu)" || ko "B1 box"
val "UPDATE public.wod_scores SET score_value = score_value + 1 WHERE member_id = '$REEL' AND wod_id = '$WR'" >/dev/null
if jouer 30-empreinte-box.sql -v box=$AF -v reference="$REFB"; then ko "B2 score d'un compte A modifié : pas de STOP"
elif grep -q 'VITRINE_EMPREINTE_BOX: a.wod_scores' "$TMP/log"; then ok "B2 score d'un compte à ne pas toucher modifié : STOP (a.wod_scores)"
else ko "B2"; tail -3 "$TMP/log"; fi
muter 30-empreinte-box.sql "$TMP/m-box-scores.sql" "s/    UNION ALL SELECT 'a\.wod_scores'.*?\n.*?\n//"
essai_box "$TMP/m-box-scores.sql"
val "UPDATE public.wod_scores SET score_value = score_value + 1 WHERE member_id = '$REEL' AND wod_id = '$WR'" >/dev/null
jouer "$TMP/m-box-scores.sql" -v box=$AF -v reference="$REFB" && ok "B2m mutation (scores retirés de l'empreinte) : la modification passe inaperçue, B2 la détecte" || { ko "B2m"; tail -3 "$TMP/log"; }
essai_box
val "UPDATE public.class_schedules SET max_capacity = 13 WHERE id = '00000000-0000-4000-e523-0000000000c2'" >/dev/null
if jouer 30-empreinte-box.sql -v box=$AF -v reference="$REFB"; then ko "B3 créneau figé modifié : pas de STOP"
elif grep -q 'VITRINE_EMPREINTE_BOX: b.class_schedules : 1 ligne(s) figée(s) modifiée(s)' "$TMP/log"; then ok "B3 créneau existant modifié : STOP"
else ko "B3"; tail -3 "$TMP/log"; fi

$P -d postgres -c "DROP DATABASE IF EXISTS vitrine_cas WITH (FORCE)" -c "DROP DATABASE IF EXISTS vitrine_fix WITH (FORCE)" >/dev/null
rm -rf "$TMP"
[ $echoue -eq 0 ] && echo "TOUT OK" || { echo "DES ECHECS"; exit 1; }
