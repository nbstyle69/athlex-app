#!/usr/bin/env bash
# Test local des scripts SQL de la démo historique, sur le rejeu sans Docker
# (PG17 natif, port 54339, base `rejeu` déjà rejouée : voir supabase/README.md
# et replay-local.sh). Chaque cas part d'une copie neuve du décor
# (test-fixture.sql). Chaque contrôle est prouvé par une mutation du script qui
# fait échouer son cas (mutation « tuée »).
#   scripts/demo-historique/sql/test-rejeu.sh
set -uo pipefail
cd "$(dirname "$0")"
export PGCLIENTENCODING=UTF8
PORT="${REJEU_PORT:-54339}"
P="psql -p $PORT -U supabase_admin -X -q -v ON_ERROR_STOP=1"
AF=d3d0b0a0-0000-4000-a000-000000000001
u() { printf '00000000-0000-4000-a599-%012d' "$1"; }
REV=$(u 905); TESTAPPLE=$(u 906); REEL=$(u 901); NBS2=00000000-0000-4000-b599-00000000000b
TD1=00000000-0000-4000-d599-000000000001; TD2=00000000-0000-4000-d599-000000000002
TMP=$(mktemp -d); W="$(cygpath -m "$TMP" 2>/dev/null || echo "$TMP")"
# copie <nom> : dossier avec une copie des scripts (les mutations y sont faites ;
# les scripts s'incluent entre eux par chemin relatif).
copie() { mkdir -p "$TMP/$1"; cp comptes.sql 20-empreinte-elo.sql 30-empreinte-box.sql 80-releve-purge.sql 90-tournois.sql   91-supprimer-lignes-fictifs.sql 92-supprimer-comptes.sql 99-controle-purge.sql "$TMP/$1/"; echo "$TMP/$1"; }
echoue=0

$P -d postgres -c "DROP DATABASE IF EXISTS histo_fix WITH (FORCE)" -c "CREATE DATABASE histo_fix TEMPLATE rejeu" >/dev/null || exit 2
$P -d histo_fix -f test-fixture.sql >/dev/null || exit 2

neuve() { $P -d postgres -c "DROP DATABASE IF EXISTS histo_cas WITH (FORCE)" -c "CREATE DATABASE histo_cas TEMPLATE histo_fix" >/dev/null || exit 2; }
val() { $P -d histo_cas -A -t -c "$1" | tr -d '\r'; }
ok() { echo "ok    $1"; }
ko() { echo "ECHEC $1"; echoue=1; }
attendre() { [ "$2" = "$3" ] && ok "$1" || ko "$1 (obtenu « $2 », attendu « $3 »)"; }
jouer() { local f="$1"; shift; $P -d histo_cas "$@" -f "$f" >"$TMP/log" 2>&1; }
muter() { perl -0pe "$3" "$1" > "$2"; cmp -s "$1" "$2" && { echo "point de mutation introuvable : $3"; exit 2; }; }
# muter_dans <dossier> <fichier> <perl -pe…> : mutation en place dans une copie.
muter_dans() { muter "$1/$2" "$1/$2.m" "$3"; mv "$1/$2.m" "$1/$2"; }
# Empreinte de tout ce que la purge peut toucher (comptes, adhésions, tournois, amitiés, demo_accounts).
EMPREINTE="SELECT md5(string_agg(x, '|' ORDER BY x)) FROM (
  SELECT 'u'||id FROM auth.users UNION ALL SELECT 'd'||user_id FROM internal.demo_accounts
  UNION ALL SELECT 'm'||id FROM public.box_members UNION ALL SELECT 't'||id||coalesce(archived_at::text,'-') FROM public.tournaments
  UNION ALL SELECT 'b'||id FROM public.tournament_bracket_matches UNION ALL SELECT 'f'||id FROM public.friendships
  UNION ALL SELECT 'w'||id||coalesce(created_by::text,'-') FROM public.box_wods) q(x)"

EXCLUS="{$REV}"; ATTENDU=6; ACC="{$REV,$TESTAPPLE}"; SUP="{$TD1,$TD2}"; ARC='{}'
C() { echo "-v box=$AF -v exclus=$EXCLUS -v attendu=$ATTENDU -v acceptes=$ACC"; }
REL="$W/releve.sql"
# chaine [dossier] : 20 et 30 (prise), 80, 90, 91, 92, 99, 20 et 30 (comparaison).
chaine() {
  local D="${1:-.}"
  jouer $D/20-empreinte-elo.sql $(C) -v tournois="$SUP" -v sortie="$W/e20.sql" || { echo "20"; return 1; }
  jouer $D/30-empreinte-box.sql $(C) -v tournois="{$(echo "$SUP,$ARC" | tr -d '{}' | sed 's/^,//; s/,$//')}" -v sortie="$W/e30.sql" || { echo "30"; return 1; }
  jouer $D/80-releve-purge.sql $(C) -v supprimer="$SUP" -v archiver="$ARC" -v releve="$REL" || { echo "80"; return 1; }
  cp "$TMP/log" "$TMP/log80"
  jouer $D/90-tournois.sql -v box=$AF -v ids="$SUP" -v archiver="$ARC" || { echo "90"; return 1; }
  jouer $D/91-supprimer-lignes-fictifs.sql -v releve="$REL" || { echo "91"; return 1; }
  jouer $D/92-supprimer-comptes.sql -v releve="$REL" || { echo "92"; return 1; }
  jouer $D/99-controle-purge.sql -v tournois="$SUP" -v archiver="$ARC" -v releve="$REL" || { echo "99"; return 1; }
  jouer $D/20-empreinte-elo.sql -v reference="$W/e20.sql" || { echo "20c"; return 1; }
  jouer $D/30-empreinte-box.sql -v reference="$W/e30.sql" || { echo "30c"; return 1; }
}
releve_seul() { jouer "${1:-80-releve-purge.sql}" $(C) -v supprimer="$SUP" -v archiver="$ARC" -v releve="$REL"; }
reviewer_reste="SELECT (SELECT count(*) FROM auth.users WHERE id='$REV') || '/' || (SELECT count(*) FROM internal.demo_accounts WHERE user_id='$REV')"

echo "== N : purge nominale"
neuve
etape=$(chaine) && ok "N1 purge complète (tournois supprimés) : 80, 90, 91, 92, 99, empreintes identiques" || { ko "N1 (échec en $etape)"; tail -5 "$TMP/log"; }
grep -o 'HISTO_CONTROLE_PURGE.*' "$TMP/log" 2>/dev/null; grep -o 'HISTO_CHIFFRAGE.*' "$TMP/log80" | sed 's/^/      /'
attendre "N1 les 6 comptes de démo listés supprimés" "$(val "SELECT count(*) FROM auth.users WHERE id::text ~ '^00000000-0000-4000-a599-00000000000[1-6]$'")" 0
attendre "N1 reviewer : compte et entrée demo_accounts restent" "$(val "$reviewer_reste")" "1/1"
attendre "N1 testapple, réel, gérants, compte démo hors liste restent" "$(val "SELECT count(*) FROM auth.users WHERE id IN ('$TESTAPPLE','$REEL','$(u 900)','$(u 903)','$(u 904)','$(u 907)')")" 6
attendre "N1 tournoi réel TX intact (match et ELO)" "$(val "SELECT (SELECT count(*) FROM tournaments WHERE name='TX') || '/' || (SELECT count(*) FROM tournament_match_elo_history WHERE tournament_id='00000000-0000-4000-d599-000000000003')")" "1/2"
attendre "N1 WOD créé par un compte de démo gardé, created_by à NULL" "$(val "SELECT count(*) FROM box_wods WHERE id='00000000-0000-4000-e599-0000000000f1' AND created_by IS NULL")" 1
attendre "N1 box NBS2 intacte" "$(val "SELECT count(*) FROM box_members WHERE box_id='$NBS2'")" 2
E1=$(val "$EMPREINTE")
if etape=$(chaine); then ko "N2 rejeu après purge : passé"
elif [ "$etape" = 20 ] && grep -q 'HISTO_NOMBRE: 0 compte(s) à purger, 6 attendu(s)' "$TMP/log"; then ok "N2 rejeu après purge : STOP (HISTO_NOMBRE 0 sur 6)"
else ko "N2 (échec en $etape)"; tail -3 "$TMP/log"; fi
jouer 92-supprimer-comptes.sql -v releve="$REL" && grep -q 'supprimes=0' "$TMP/log" && ok "N2 92 rejoué : 0 compte supprimé" || { ko "N2 92"; tail -3 "$TMP/log"; }
jouer 99-controle-purge.sql -v tournois="$SUP" -v archiver="$ARC" -v releve="$REL" && ok "N2 99 rejoué : toujours à 0" || { ko "N2 99"; tail -3 "$TMP/log"; }
attendre "N2 empreinte inchangée" "$(val "$EMPREINTE")" "$E1"

neuve; SUP="{$TD1}"; ARC="{$TD2}"
etape=$(chaine) && ok "N3 TD1 supprimé, TD2 archivé : purge complète" || { ko "N3 (échec en $etape)"; tail -5 "$TMP/log"; }
attendre "N3 TD2 conservé et archivé" "$(val "SELECT count(*) FROM tournaments WHERE id='$TD2' AND archived_at IS NOT NULL")" 1
neuve; SUP='{}'; ARC="{$TD1,$TD2}"
etape=$(chaine) && ok "N4 deux tournois archivés : matchs de TD1 gardés, participants à NULL (classe archive)" || { ko "N4 (échec en $etape)"; tail -5 "$TMP/log"; }
grep -q 'HISTO_RELEVE tournament_bracket_matches.winner_id archive = 3' "$TMP/log80" && ok "N4 relevé : 3 matchs archivés" || ko "N4 relevé archive"
attendre "N4 matchs de TD1 conservés" "$(val "SELECT count(*) FROM tournament_bracket_matches WHERE tournament_id='$TD1' AND participant1_id IS NULL")" 3
SUP="{$TD1,$TD2}"; ARC='{}'

echo "== Cas exigés : contact réel, reviewer, autre box"
# K1 : amitié entre un compte de démo et un compte réel → STOP au relevé, rien d'écrit.
contact() { val "INSERT INTO friendships (requester_id, addressee_id, status) VALUES ('$(u 3)', '$1', 'accepted')" >/dev/null; }
neuve; contact "$REEL"; E=$(val "$EMPREINTE")
if etape=$(chaine); then ko "K1 contact avec un compte réel : purge passée"
elif [ "$etape" = 80 ] && grep -q 'HISTO_BLOQUANT: .*friendships.-=1 (contact)' "$TMP/log"; then ok "K1 amitié démo ↔ compte réel : STOP au relevé"
else ko "K1 (échec en $etape)"; tail -3 "$TMP/log"; fi
attendre "K1 rien d'écrit" "$(val "$EMPREINTE")" "$E"
D=$(copie m-contact); muter_dans $D 80-releve-purge.sql "s/IF r\.classe IN \('contact', /IF r.classe IN (/"
neuve; contact "$REEL"
if etape=$(chaine $D); then
  attendre "K1m mutation (contact retiré des arrêts) : purge passée, l'amitié du réel a disparu — K1 la tue" "$(val "SELECT count(*) FROM friendships WHERE addressee_id='$REEL'")" 0
else ko "K1m mutation non tuée (échec en $etape)"; tail -3 "$TMP/log"; fi
neuve; contact "$TESTAPPLE"
etape=$(chaine) && ok "K2 amitié démo ↔ testapple (accepté par uuid) : purge passée" || { ko "K2 (échec en $etape)"; tail -3 "$TMP/log"; }
grep -q 'friendships.- accepte = 1' "$TMP/log80" && ok "K2 relevé : contact accepté affiché" || ko "K2 affichage"
D=$(copie m-accepte); muter_dans $D 80-releve-purge.sql "s/WHEN %s THEN ''contact'' WHEN %s THEN ''accepte'' END/WHEN %s OR %s THEN ''contact'' END/"
neuve; contact "$TESTAPPLE"
if etape=$(chaine $D); then ko "K2m mutation (exception acceptes retirée) non tuée"
else ok "K2m mutation (exception acceptes retirée) : STOP à tort en $etape — K2 la tue"; fi
# Reviewer : il reste, son entrée demo_accounts aussi (N1). Deux gardes
# indépendantes : l'exclusion (comptes.sql) et le domaine (comptes.sql, 92).
D=$(copie m-rev1); muter_dans $D comptes.sql "s/
   WHERE NOT d\.user_id = ANY \(current_setting\('histo\.exclus'\)::uuid\[\]\)//"
neuve; ATTENDU=7
if etape=$(chaine $D); then ko "R1m mutation (exclusion retirée) : purge passée"
else attendre "R1m mutation (exclusion retirée) : STOP en $etape (HISTO_DOMAINE), reviewer intact" "$(grep -c HISTO_DOMAINE "$TMP/log")/$(val "$reviewer_reste")" "1/1/1"; fi
D=$(copie m-rev2); muter_dans $D comptes.sql "s/
   WHERE NOT d\.user_id = ANY \(current_setting\('histo\.exclus'\)::uuid\[\]\)//; s/IF n > 0 THEN RAISE EXCEPTION 'HISTO_DOMAINE/IF false THEN RAISE EXCEPTION 'HISTO_DOMAINE/"
muter_dans $D 92-supprimer-comptes.sql "s/IF n > 0 THEN RAISE EXCEPTION 'HISTO_COMPTE/IF false THEN RAISE EXCEPTION 'HISTO_COMPTE/"
neuve; EXCLUS='{}'; chaine $D >/dev/null
attendre "R1m2 mutation (exclusion et deux gardes de domaine retirées) : reviewer supprimé — N1 la tue" "$(val "$reviewer_reste")" "0/0"
EXCLUS="{$REV}"; ATTENDU=6
neuve; val "DELETE FROM internal.demo_accounts WHERE user_id='$REV'" >/dev/null
releve_seul && ko "R2 reviewer absent de demo_accounts : relevé passé" || { grep -q HISTO_EXCLUS "$TMP/log" && ok "R2 reviewer absent de demo_accounts : STOP (HISTO_EXCLUS)" || { ko "R2"; tail -2 "$TMP/log"; }; }
neuve; val "UPDATE auth.users SET email='autre@exemple.invalid' WHERE id='$(u 2)'" >/dev/null
releve_seul && ko "R3 compte à purger hors domaine : relevé passé" || { grep -q HISTO_DOMAINE "$TMP/log" && ok "R3 compte de demo_accounts hors @demo.athlexapp.eu : STOP" || { ko "R3"; tail -2 "$TMP/log"; }; }
# Autre box : un compte de démo rattaché à NBS2 → STOP, NBS2 intacte.
autre_box() { val "INSERT INTO box_members (box_id, member_id, role, status) VALUES ('$NBS2', '$(u 2)', 'member', 'active')" >/dev/null; }
neuve; autre_box; E=$(val "$EMPREINTE")
if etape=$(chaine); then ko "B1 compte de démo dans une autre box : purge passée"
elif [ "$etape" = 20 ] && grep -q 'HISTO_AUTRE_BOX: 1' "$TMP/log"; then ok "B1 compte de démo rattaché à une autre box : STOP avant toute écriture"
else ko "B1 (échec en $etape)"; tail -3 "$TMP/log"; fi
attendre "B1 rien d'écrit" "$(val "$EMPREINTE")" "$E"
D=$(copie m-box); muter_dans $D comptes.sql "s/IF n > 0 THEN RAISE EXCEPTION 'HISTO_AUTRE_BOX/IF false THEN RAISE EXCEPTION 'HISTO_AUTRE_BOX/"
neuve; autre_box
if etape=$(chaine $D); then
  attendre "B1m mutation (garde autre box retirée) : purge passée, adhésion à NBS2 supprimée — B1 la tue" "$(val "SELECT count(*) FROM box_members WHERE box_id='$NBS2'")" 2
else ko "B1m mutation non tuée (échec en $etape)"; tail -3 "$TMP/log"; fi

echo "== Autres arrêts du relevé"
stop80() { # <libellé> <motif> <SQL du décor>
  neuve; val "$3" >/dev/null; local e; e=$(val "$EMPREINTE")
  if releve_seul; then ko "$1 : relevé passé"; elif grep -q "$2" "$TMP/log"; then ok "$1 : STOP"; else ko "$1"; tail -2 "$TMP/log"; fi
  attendre "$1 : rien d'écrit" "$(val "$EMPREINTE")" "$e"
}
stop80 "S1 réel inscrit à un tournoi listé" "tournament_participants.-=1 (contact)" "INSERT INTO tournament_participants (tournament_id, athlete_id) VALUES ('$TD1', '$REEL')"
stop80 "S2 réel dans un match d'un tournoi listé" "(contact)" "UPDATE tournament_bracket_matches SET participant2_id='$REEL', loser_id='$REEL' WHERE tournament_id='$TD1' AND round=1 AND match_number=1"
stop80 "S3 compte de démo dans un tournoi non listé (TY)" "tournament_bracket_matches.participant1_id=1 (tournoi_autre)" "INSERT INTO tournaments (id, name, level, status, format, box_id, max_participants) VALUES ('00000000-0000-4000-d599-000000000009', 'TY', 'rx', 'open', 'bracket', '$AF', 2); INSERT INTO tournament_bracket_matches (tournament_id, round, match_number, side, participant1_id, participant2_id, status) VALUES ('00000000-0000-4000-d599-000000000009', 1, 1, 'winner', '$(u 4)', '$(u 5)', 'pending')"
stop80 "S4 ELO de WOD d'un réel sur un WOD scoré par des démos" "ELO de WOD d'un compte réel" "INSERT INTO elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank) VALUES ('$AF', '00000000-0000-4000-e599-0000000000f1', '$REEL', 1000, 990, -10, 4)"
stop80 "S5 réel qui score un WOD créé par un compte de démo" "wod_de_demo_score_par_un_reel=1" "INSERT INTO wod_scores (wod_id, member_id, box_id, score_type, score_value, rx, scaled) VALUES ('00000000-0000-4000-e599-0000000000f1', '$REEL', '$AF', 'reps', 90, true, false)"
stop80 "S6 réaction d'un compte de démo sur un score réel" "reaction_ou_commentaire_sur_contenu_reel=1" "INSERT INTO score_reactions (score_id, user_id, emoji) SELECT id, '$(u 2)', '🔥' FROM wod_scores WHERE member_id='$REEL'"
stop80 "S7 achat de programme par un compte de démo" "achat_ou_suivi_de_programme=1" "INSERT INTO programs (id, box_id, owner_id, title, price_cents, type, invite_code) VALUES ('00000000-0000-4000-e599-0000000000a1', '$AF', '$(u 900)', 'Prog', 0, 'fixed', 'H599P1'); INSERT INTO program_members (program_id, user_id, provenance) VALUES ('00000000-0000-4000-e599-0000000000a1', '$(u 2)', 'staff')"
stop80 "S8 ligne Stripe d'un compte de démo" "(stripe)" "UPDATE box_members SET stripe_subscription_id='sub_test_h599' WHERE member_id='$(u 2)'"
stop80 "S9 tournoi listé d'une autre box" "HISTO_TOURNOI_BOX" "UPDATE tournaments SET box_id='$NBS2' WHERE id='$TD2'"
D=$(copie m-stripe); muter_dans $D 80-releve-purge.sql "s/'tournoi_autre', 'stripe'\)/'tournoi_autre')/"
neuve; val "UPDATE box_members SET stripe_subscription_id='sub_test_h599' WHERE member_id='$(u 2)'" >/dev/null
releve_seul $D/80-releve-purge.sql && ok "S8m mutation (Stripe retiré des arrêts) : relevé passé — S8 la tue" || { ko "S8m non tuée"; tail -2 "$TMP/log"; }
D=$(copie m-elo); muter_dans $D 80-releve-purge.sql "s/IF r\.n > 0 THEN v_stop := v_stop \|\| format\(' %s=%s \(ELO de WOD/IF false THEN v_stop := v_stop || format(' %s=%s (ELO de WOD/"
neuve; val "INSERT INTO elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank) VALUES ('$AF', '00000000-0000-4000-e599-0000000000f1', '$REEL', 1000, 990, -10, 4)" >/dev/null
releve_seul $D/80-releve-purge.sql && ok "S4m mutation (contact ELO retiré) : relevé passé — S4 la tue" || { ko "S4m non tuée"; tail -2 "$TMP/log"; }

echo "== 90, 92, empreintes"
DECL="SELECT string_agg(tgname||':'||tgenabled::text, ',' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('trg_tournaments_resultats_conserves','trg_bracket_matches_termine_conserve')"
neuve; muter 90-tournois.sql "$TMP/m-enable.sql" 's/ALTER TABLE public\.tournaments ENABLE TRIGGER trg_tournaments_resultats_conserves;\n//'
E=$(val "$EMPREINTE")
jouer "$TMP/m-enable.sql" -v box=$AF -v ids="$SUP" -v archiver='{}' && ko "T1m garde laissée désactivée : COMMIT" || { grep -q HISTO_DECLENCHEURS "$TMP/log" && ok "T1m mutation (garde laissée désactivée) : ROLLBACK" || ko "T1m motif"; }
attendre "T1m rien d'écrit, déclencheurs actifs" "$(val "$EMPREINTE")/$(val "$DECL")" "$E/trg_bracket_matches_termine_conserve:O,trg_tournaments_resultats_conserves:O"
neuve; muter 90-tournois.sql "$TMP/m-archive.sql" "s/UPDATE public\.tournaments SET archived_at = now\(\)/UPDATE public.tournaments SET archived_at = NULL/"
jouer "$TMP/m-archive.sql" -v box=$AF -v ids="{$TD1}" -v archiver="{$TD2}" && ko "T2m archivage oublié : COMMIT" || { grep -q HISTO_ARCHIVE "$TMP/log" && ok "T2m mutation (archivage oublié) : ROLLBACK" || ko "T2m motif"; }
neuve; jouer 80-releve-purge.sql $(C) -v supprimer="$SUP" -v archiver='{}' -v releve="$REL" >/dev/null
val "UPDATE auth.users SET email='x@exemple.invalid' WHERE id='$(u 3)'" >/dev/null; E=$(val "$EMPREINTE")
jouer 92-supprimer-comptes.sql -v releve="$REL" && ko "T3 compte du relevé devenu hors domaine : supprimé" || { grep -q HISTO_COMPTE "$TMP/log" && ok "T3 92 revérifie chaque compte : ROLLBACK" || ko "T3 motif"; }
attendre "T3 rien d'écrit" "$(val "$EMPREINTE")" "$E"
neuve; jouer 30-empreinte-box.sql $(C) -v tournois="$SUP" -v sortie="$W/e30.sql" >/dev/null
val "UPDATE box_members SET status='inactive' WHERE member_id='$(u 904)'" >/dev/null
jouer 30-empreinte-box.sql -v reference="$W/e30.sql" && ko "E1 ligne de NBS2 modifiée : identique" || { grep -q 'HISTO_EMPREINTE_BOX: autres box / box_members : 1' "$TMP/log" && ok "E1 ligne de NBS2 modifiée : STOP (autres box / box_members : 1)" || { ko "E1"; tail -2 "$TMP/log"; }; }
neuve; jouer 20-empreinte-elo.sql $(C) -v tournois="$SUP" -v sortie="$W/e20.sql" >/dev/null
val "UPDATE elo_history SET elo_after = elo_after + 1 WHERE member_id='$REEL'" >/dev/null
jouer 20-empreinte-elo.sql -v reference="$W/e20.sql" && ko "E2 ELO d'un réel modifié : identique" || { grep -q 'HISTO_EMPREINTE_ELO: elo_history : 1' "$TMP/log" && ok "E2 ligne d'ELO d'un réel modifiée : STOP" || { ko "E2"; tail -2 "$TMP/log"; }; }
grep -q '@' "$W/e20.sql" "$W/e30.sql" "$REL" && ko "F fichiers hors dépôt : une adresse apparaît" || ok "F fichiers d'empreinte et relevé : uuid et md5 seulement"

$P -d postgres -c "DROP DATABASE IF EXISTS histo_cas WITH (FORCE)" -c "DROP DATABASE IF EXISTS histo_fix WITH (FORCE)" >/dev/null
rm -rf "$TMP"
[ $echoue -eq 0 ] && echo "TOUT OK" || { echo "DES ECHECS"; exit 1; }
