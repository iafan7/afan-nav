#!/usr/bin/env bash
# Permanent fix: router IPv6 DNS returns 127.0.0.1 for github.com.
# Forces systemd-resolved to use trusted DNS only.
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/scripts/fix-dns-github.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF_DIR=/etc/systemd/resolved.conf.d
CONF="${CONF_DIR}/99-github-dns-fix.conf"

mkdir -p "$CONF_DIR"
install -m 644 "${ROOT}/ops/systemd/99-github-dns-fix.conf" "$CONF"

systemctl restart systemd-resolved
resolvectl flush-caches

echo "=== github.com ==="
resolvectl query github.com || true
echo "=== HTTPS ==="
curl -sI --max-time 10 https://github.com | head -3 || true

echo "DNS fix applied: ${CONF}"
