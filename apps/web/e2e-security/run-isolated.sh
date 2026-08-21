#!/usr/bin/env bash
# Isolated admin password-change E2E (does not touch ./data used by root docker compose).
# Usage (from repo root):
#   apps/web/e2e-security/run-isolated.sh
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_PROJECT="linknest-e2e-security"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
HOST_PORT=3101
E2E_USER="e2e-admin"
E2E_PASS="e2epass1"
E2E_PASS_CHANGED="TempPw-E2E-9x"
SESSION_SECRET="e2e-security-session-secret-at-least-32-chars"

DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/linknest-e2e-security.XXXXXX")"
ENV_FILE="$(mktemp "${TMPDIR:-/tmp}/linknest-e2e-security-env.XXXXXX")"
PROD_HASH_BEFORE=""
PROD_HASH_AFTER=""
CLEANED=0

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then
    return
  fi
  CLEANED=1
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
  rm -f "$ENV_FILE"
}
trap cleanup EXIT

snapshot_deployed_hash() {
  if ! docker ps --format '{{.Names}}' | grep -qx 'linknest'; then
    echo ""
    return
  fi
  docker exec linknest node -e '
const Database = require("better-sqlite3");
const db = new Database("/data/linknest.db");
const row = db.prepare("SELECT password_hash FROM admin_credentials WHERE id = 1").get();
if (!row) { console.error("missing admin"); process.exit(1); }
process.stdout.write(row.password_hash);
' 2>/dev/null || true
}

write_env() {
  local admin_password="$1"
  cat >"$ENV_FILE" <<EOF
ADMIN_USERNAME=${E2E_USER}
ADMIN_PASSWORD=${admin_password}
SESSION_SECRET=${SESSION_SECRET}
PORT=3000
COOKIE_SECURE=false
DATABASE_PATH=/data/linknest.db
EOF
}

wait_healthy() {
  local i
  for i in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${HOST_PORT}/api/public/site" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "error: e2e-security container failed health check on :${HOST_PORT}" >&2
  docker logs linknest-e2e-security --tail 80 >&2 || true
  exit 1
}

api_login() {
  local password="$1"
  local jar="$2"
  curl -sf -c "$jar" -X POST "http://127.0.0.1:${HOST_PORT}/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"username\":\"${E2E_USER}\",\"password\":\"${password}\"}"
}

echo "==> Snapshot deployed admin hash (before), if linknest is running"
PROD_HASH_BEFORE="$(snapshot_deployed_hash || true)"
if [[ -n "$PROD_HASH_BEFORE" ]]; then
  echo "deployed hash prefix: ${PROD_HASH_BEFORE:0:4}… (len=${#PROD_HASH_BEFORE})"
fi

write_env "$E2E_PASS"
chmod 700 "$DATA_DIR"
chmod 777 "$DATA_DIR"

echo "==> Start isolated stack (project=${COMPOSE_PROJECT}, port=${HOST_PORT})"
export E2E_DATA_DIR="$DATA_DIR"
export E2E_ENV_FILE="$ENV_FILE"
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up -d --build

wait_healthy

echo "==> Playwright password-change suite (isolated)"
docker run --rm --network host \
  -v "$WEB_ROOT:/work" -w /work \
  -e PLAYWRIGHT_BASE_URL="http://127.0.0.1:${HOST_PORT}" \
  -e ADMIN_USERNAME="$E2E_USER" \
  -e ADMIN_PASSWORD="$E2E_PASS" \
  -e E2E_SECURITY_ISOLATED=1 \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  npx --yes playwright@1.61.1 test \
    --config=playwright.security.config.ts \
    --reporter=line

echo "==> Verify password change persisted (API)"
JAR="$(mktemp)"
api_login "$E2E_PASS_CHANGED" "$JAR" >/dev/null
curl -sf -o /dev/null -w "session:%{http_code}\n" -b "$JAR" "http://127.0.0.1:${HOST_PORT}/admin/links"
if curl -sf -X POST "http://127.0.0.1:${HOST_PORT}/api/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"${E2E_USER}\",\"password\":\"${E2E_PASS}\"}" >/dev/null; then
  echo "error: old password still accepted after change" >&2
  exit 1
fi
echo "old password rejected: ok"

echo "==> Restart container — new password must still work"
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
wait_healthy
JAR2="$(mktemp)"
api_login "$E2E_PASS_CHANGED" "$JAR2" >/dev/null
echo "login after restart: ok"

echo "==> Recreate with different ADMIN_PASSWORD env — must NOT overwrite DB hash"
write_env "env-should-lose"
export E2E_DATA_DIR="$DATA_DIR"
export E2E_ENV_FILE="$ENV_FILE"
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up -d --force-recreate
wait_healthy
JAR3="$(mktemp)"
api_login "$E2E_PASS_CHANGED" "$JAR3" >/dev/null
echo "login with DB password after env change: ok"
if curl -sf -X POST "http://127.0.0.1:${HOST_PORT}/api/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"${E2E_USER}\",\"password\":\"env-should-lose\"}" >/dev/null; then
  echo "error: env password overwrote database credentials" >&2
  exit 1
fi
echo "env overwrite refused: ok"

echo "==> Snapshot deployed admin hash (after)"
PROD_HASH_AFTER="$(snapshot_deployed_hash || true)"
if [[ -n "$PROD_HASH_BEFORE" || -n "$PROD_HASH_AFTER" ]]; then
  if [[ "$PROD_HASH_BEFORE" != "$PROD_HASH_AFTER" ]]; then
    echo "error: deployed admin password_hash changed during isolated E2E" >&2
    exit 1
  fi
  echo "deployed hash unchanged: ok"
else
  echo "deployed hash compare skipped (linknest not running)"
fi

echo "==> Isolated password E2E passed; cleaning up"
cleanup
