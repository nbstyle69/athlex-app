#!/usr/bin/env bash
# Séances de programme relatives (migrations 20261207 + 20261208) : gardes serveur.
#
#   1. box_wods_ancrage_check : une séance relative (scheduled_date NULL) porte
#      program_week/program_day et leaderboard_enabled = false — jamais true.
#   2. elo_history / box_elo_history refusent toute ligne pointant une séance
#      relative (trigger), et compute_wod_elo / compute_box_elo n'en écrivent
#      aucune (garde leaderboard_enabled).
#   3. program_members.start_date : NULL accepté (choisi après l'achat), lundi
#      exigé, _upsert_program_member ne pose plus current_date,
#      set_program_start_date refuse un mardi et verrouille après un score.
#   4. program_rest_days : clé (program_id, program_week, program_day).
#
# Puis mutation inverse : trigger désactivé → l'insertion passe (l'assertion
# peut donc rougir) ; l'état d'origine est restauré par ROLLBACK.
#
# USAGE : ./scripts/test-stack.sh up && ./scripts/test-programme-relatif.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ATHLEX_TEST_ENV:-/tmp/athlex-test-stack.env}"
if [ -z "${TEST_ADMIN_DB_URL:-}" ]; then
  [ -f "$ENV_FILE" ] || { echo "❌ $ENV_FILE absent — lance ./scripts/test-stack.sh up" >&2; exit 2; }
  set -a; . "$ENV_FILE"; set +a
fi
: "${TEST_ADMIN_DB_URL:?TEST_ADMIN_DB_URL manquant}"

OUT=$(mktemp); trap 'rm -f "$OUT"' EXIT

# Tout se joue dans UNE transaction annulée : le décor ne survit pas, la garde
# désactivée pour la mutation inverse non plus.
psql "$TEST_ADMIN_DB_URL" -X -q -v ON_ERROR_STOP=0 -At >"$OUT" 2>&1 <<'SQL'
BEGIN;
INSERT INTO auth.users (id, email) VALUES ('22222222-2222-2222-2222-222222222222','relatif@test.local');
INSERT INTO public.profiles (id, username, email) VALUES ('22222222-2222-2222-2222-222222222222','relatif','relatif@test.local');
INSERT INTO public.boxes (id, name, owner_id, invite_code) VALUES ('11111111-1111-1111-1111-111111111111','Box relatif','22222222-2222-2222-2222-222222222222','RELATIF1');
INSERT INTO public.box_members (box_id, member_id, role, status) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','owner','active');
INSERT INTO public.programs (id, box_id, owner_id, title, type, price_cents, invite_code) VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','P','ongoing',1000,'PRELATIF');

\echo T1_relative_leaderboard_true
SAVEPOINT s; INSERT INTO public.box_wods (box_id, title, wod_type, scheduled_date, program_week, program_day, leaderboard_enabled)
VALUES ('11111111-1111-1111-1111-111111111111','x','amrap',NULL,1,3,true); ROLLBACK TO s;
\echo T2_relative_leaderboard_false
INSERT INTO public.box_wods (id, box_id, title, wod_type, scheduled_date, program_week, program_day, leaderboard_enabled)
VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','x','amrap',NULL,1,3,false);
SELECT 'T2_ok=' || count(*) FROM public.box_wods WHERE id='33333333-3333-3333-3333-333333333333' AND scheduled_date IS NULL;
\echo T3_elo_history_relative
SAVEPOINT s; INSERT INTO public.elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank)
VALUES ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',1000,1010,10,1); ROLLBACK TO s;
\echo T4_box_elo_history_relative
SAVEPOINT s; INSERT INTO public.box_elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank)
VALUES ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',1000,1010,10,1); ROLLBACK TO s;
\echo T5_start_date_mardi
SAVEPOINT s; INSERT INTO public.program_members (program_id, user_id, start_date, provenance)
VALUES ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','2026-04-14','staff'); ROLLBACK TO s;
\echo T6_upsert_sans_date
SELECT 'T6_cree=' || (public._upsert_program_member('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222',NULL,'staff') IS NOT NULL);
SELECT 'T6_start_null=' || (start_date IS NULL) FROM public.program_members WHERE program_id='44444444-4444-4444-4444-444444444444';
\echo T7_repos_doublon
INSERT INTO public.program_rest_days (program_id, program_week, program_day) VALUES ('44444444-4444-4444-4444-444444444444',1,3);
SAVEPOINT s; INSERT INTO public.program_rest_days (program_id, program_week, program_day) VALUES ('44444444-4444-4444-4444-444444444444',1,3); ROLLBACK TO s;
\echo T8_set_program_start_date
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
SAVEPOINT s; SELECT public.set_program_start_date('44444444-4444-4444-4444-444444444444','2026-04-14'); ROLLBACK TO s;
SELECT 'T8_lundi=' || public.set_program_start_date('44444444-4444-4444-4444-444444444444','2026-04-13');
INSERT INTO public.wod_program_access (wod_id, program_id) VALUES ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
INSERT INTO public.wod_scores (wod_id, member_id, score_type, score_value) VALUES ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','reps',100);
SAVEPOINT s; SELECT public.set_program_start_date('44444444-4444-4444-4444-444444444444','2026-04-20'); ROLLBACK TO s;
\echo T9_compute_elo
SELECT 'T9_wod_rendu=' || count(*) FROM public.compute_wod_elo('33333333-3333-3333-3333-333333333333');
SELECT 'T9_box_rendu=' || count(*) FROM public.compute_box_elo('33333333-3333-3333-3333-333333333333');
SELECT 'T9_elo_rows=' || (SELECT count(*) FROM public.elo_history WHERE wod_id='33333333-3333-3333-3333-333333333333')
    || '/' || (SELECT count(*) FROM public.box_elo_history WHERE wod_id='33333333-3333-3333-3333-333333333333');
\echo M1_mutation_inverse
ALTER TABLE public.elo_history DISABLE TRIGGER trg_elo_history_seance_relative;
INSERT INTO public.elo_history (box_id, wod_id, member_id, elo_before, elo_after, elo_delta, rank)
VALUES ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',1000,1010,10,1);
SELECT 'M1_sans_garde=' || count(*) FROM public.elo_history WHERE wod_id='33333333-3333-3333-3333-333333333333';
ROLLBACK;
SQL

ok=0; ko=0
attendu() { # $1 libellé, $2 motif (regex) attendu dans la sortie
  if grep -Eq -- "$2" "$OUT"; then echo "✅ $1"; ok=$((ok+1)); else echo "❌ $1 — motif absent : $2" >&2; ko=$((ko+1)); fi
}
absent() { # aucune erreur inattendue
  if grep -q "current transaction is aborted" "$OUT"; then
    echo "❌ transaction avortée : une étape a échoué hors savepoint" >&2; sed -n 1,40p "$OUT" >&2; ko=$((ko+1))
  else echo "✅ aucune étape hors garde n'a échoué"; ok=$((ok+1)); fi
}

absent
attendu "T1 relative + leaderboard_enabled=true refusée (CHECK)" 'violates check constraint "box_wods_ancrage_check"'
attendu "T2 relative + leaderboard_enabled=false acceptée" '^T2_ok=1$'
attendu "T3 elo_history refuse une séance relative" "Pas d'ELO sur une séance de programme"
attendu "T4 box_elo_history refuse une séance relative" "Pas d'ELO sur une séance de programme.*"
attendu "T5 start_date un mardi refusée (CHECK lundi)" 'violates check constraint "program_members_start_date_lundi"'
attendu "T6 _upsert_program_member sans date → start_date NULL" '^T6_start_null=true$'
attendu "T7 program_rest_days : doublon refusé" 'program_rest_days_pkey'
attendu "T8 set_program_start_date : mardi refusé" 'La date de début doit être un lundi'
attendu "T8 set_program_start_date : lundi accepté" '^T8_lundi=2026-04-13$'
attendu "T8 set_program_start_date : verrouillée après un score" 'Date de début verrouillée'
attendu "T9 compute_wod_elo / compute_box_elo : 0 ligne dans les historiques" '^T9_elo_rows=0/0$'
attendu "M1 mutation inverse : trigger désactivé → la ligne passe (l'assertion T3 peut rougir)" '^M1_sans_garde=1$'
[ "$(grep -c "Pas d'ELO sur une séance de programme" "$OUT")" = 2 ] && { echo "✅ T3/T4 : exactement deux refus nommés"; ok=$((ok+1)); } || { echo "❌ nombre de refus ELO inattendu" >&2; ko=$((ko+1)); }

echo "PROGRAMME_RELATIF_ASSERTIONS=$ok/$((ok+ko))"
[ "$ko" = 0 ]
