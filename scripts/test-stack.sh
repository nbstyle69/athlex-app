#!/usr/bin/env bash
# Monte une pile Supabase LOCALE (Postgres + PostgREST + GoTrue) et y rejoue
# baseline + migrations, puis exporte les variables attendues par les suites
# `scripts/test-*.mjs`.
#
#   ./scripts/test-stack.sh up      # démarre + applique le schéma + écrit /tmp/athlex-test-stack.env
#   ./scripts/test-stack.sh down    # arrête la pile
#
# Les suites d'intégration écrivent (comptes, box, tournois, scores) : elles ne
# doivent jamais viser la production. C'est cette pile jetable leur cible.
#
# Les migrations sont appliquées ici, en `supabase_admin`, et non par la CLI :
# le baseline contient des ALTER sur `storage.objects`, dont le rôle `postgres`
# du stack local n'est pas propriétaire ([db.migrations] est donc désactivé).
#
# Version de la CLI figée (#607) : sans version, `npx supabase` prend la
# dernière, et la 3.0.0 du 2/11 a refusé la configuration (section [inbucket]
# retirée) ; l'échec était avalé et les suites tombaient sans message. Le
# passage en 3.x est un chantier à part : on monte la version ici, une fois.
set -euo pipefail

SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.122.1}"
sb() { npx --yes "supabase@${SUPABASE_CLI_VERSION}" "$@"; }

# Sortie de la CLI réduite à ses lignes d'erreur. Celles qui parlent de clé,
# secret, jwt ou token sont écartées : la sortie de `start` contient les clés.
show_errors() {
  grep -iE 'error|failed|invalid|unsupported|no longer' "$1"     | grep -viE 'key|secret|jwt|token' >&2 || true
}

ENV_FILE="${TEST_STACK_ENV_FILE:-/tmp/athlex-test-stack.env}"
ADMIN_URL="postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres"

stack_down() {
  sb stop --no-backup >/dev/null 2>&1 || true
  rm -f "$ENV_FILE"
}

case "${1:-up}" in
  down)
    stack_down
    echo "==> Pile arrêtée"
    exit 0
    ;;
  up) ;;
  *) echo "usage: $0 [up|down]" >&2; exit 2 ;;
esac

# Un `up` qui échoue en cours de route ne laisse ni conteneurs ni fichier de
# variables derrière lui ; le trap est levé une fois la pile prête.
trap stack_down EXIT INT TERM

echo "==> CLI Supabase ${SUPABASE_CLI_VERSION}"
echo "==> Démarrage de la pile Supabase locale"
CLI_LOG="$(mktemp)"
if ! sb start >"$CLI_LOG" 2>&1; then
  echo "Échec de 'supabase start' :" >&2
  show_errors "$CLI_LOG"
  exit 1
fi
# Base repartie de zéro : le rejeu ci-dessous doit s'appliquer sur du vierge,
# sinon une pile déjà montée fait échouer le baseline (objets en double).
if ! { sb db reset --no-seed >"$CLI_LOG" 2>&1 || sb db reset >"$CLI_LOG" 2>&1; }; then
  echo "Échec de 'supabase db reset' :" >&2
  show_errors "$CLI_LOG"
  exit 1
fi
START_JSON="$(sb status -o env)"

echo "==> Rejeu de supabase/migrations (supabase_admin)"
MIGRATE_LOG="$(mktemp)"
for f in supabase/migrations/*.sql; do
  printf '    %-64s' "$(basename "$f")"
  if psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -f "$f" >"$MIGRATE_LOG" 2>&1; then
    echo "ok"
  else
    echo "ECHEC"
    tail -30 "$MIGRATE_LOG"
    exit 1
  fi
done

# PostgREST garde son cache de schéma : sans rechargement, les tables créées
# à l'instant renvoient 404.
psql "$ADMIN_URL" -q -c "NOTIFY pgrst, 'reload schema';"

ANON_KEY="$(printf '%s\n' "$START_JSON"  | sed -n 's/^ANON_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
SERVICE_KEY="$(printf '%s\n' "$START_JSON" | sed -n 's/^SERVICE_ROLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
API_URL="$(printf '%s\n' "$START_JSON"   | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ] || [ -z "$API_URL" ]; then
  # Pas de dump de `supabase status` : il contient les clés.
  echo "Impossible de lire les clés de la pile locale (voir 'npx supabase@${SUPABASE_CLI_VERSION} status')" >&2
  exit 1
fi

umask 077
cat > "$ENV_FILE" <<EOF
TEST_SUPABASE_URL=$API_URL
TEST_SUPABASE_ANON_KEY=$ANON_KEY
TEST_SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
TEST_ADMIN_DB_URL=$ADMIN_URL
EOF

trap - EXIT INT TERM
echo "==> Pile prête : $API_URL (variables dans $ENV_FILE)"
