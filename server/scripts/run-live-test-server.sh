#!/bin/sh
set -eu
# Test-only runner. Private fixture files are generated outside the repository.
fixture_dir="${MNEMO_LIVE_TEST_DIR:-/tmp/mnemo-server-test}"
export MNEMO_DATABASE_URL="$(cat "$fixture_dir/live-database-url")"
export MNEMO_ENCRYPTION_KEY="$(cat "$fixture_dir/encryption-key")"
export MNEMO_BOOTSTRAP_KUBECONFIG="$fixture_dir/cluster.json"
export MNEMO_TLS_CERT_FILE="$fixture_dir/server.crt"
export MNEMO_TLS_KEY_FILE="$fixture_dir/server.key"
export MNEMO_CLIENT_CA_FILE="$fixture_dir/ca.crt"
export MNEMO_LISTEN="${MNEMO_LIVE_LISTEN:-127.0.0.1:3443}"
export MNEMO_FRONTEND_URL="${MNEMO_LIVE_FRONTEND_URL:-http://127.0.0.1:3100}"
export MNEMO_REQUIRE_TLS_VERIFY=true
cd "$(dirname "$0")/.."
exec go run ./cmd/mnemo
