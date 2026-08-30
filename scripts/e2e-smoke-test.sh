#!/usr/bin/env bash
# End-to-end smoke test for the mnemo REST API.
#
# Builds and runs the real backend binary against a throwaway data dir,
# then drives it over HTTP to check the golden path plus the error cases
# that matter most: rejecting a calendar task whose document doesn't
# exist, path-traversal-safe document names, duplicate/missing-document
# errors. This only exercises the backend; it does not click through the
# Svelte frontend (no headless browser in CI/sandbox environments).
#
# Usage: scripts/e2e-smoke-test.sh

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=8199
BASE_URL="http://localhost:${PORT}"
DATA_DIR="$(mktemp -d)"
BIN="$(mktemp)"

PASS=0
FAIL=0

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1
    wait "${SERVER_PID}" 2>/dev/null
  fi
  rm -rf "${DATA_DIR}" "${BIN}"
}
trap cleanup EXIT

check() {
  local description="$1"
  local expected="$2"
  local actual="$3"
  if [[ "${expected}" == "${actual}" ]]; then
    echo "  ok   - ${description}"
    PASS=$((PASS + 1))
  else
    echo "  FAIL - ${description} (expected ${expected}, got ${actual})"
    FAIL=$((FAIL + 1))
  fi
}

check_contains() {
  local description="$1"
  local haystack="$2"
  local needle="$3"
  if [[ "${haystack}" == *"${needle}"* ]]; then
    echo "  ok   - ${description}"
    PASS=$((PASS + 1))
  else
    echo "  FAIL - ${description} (expected to find '${needle}' in: ${haystack})"
    FAIL=$((FAIL + 1))
  fi
}

status_of() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "==> Building backend"
if ! (cd "${REPO_ROOT}/backend" && go build -o "${BIN}" ./cmd/mnemo); then
  echo "build failed"
  exit 1
fi

echo "==> Starting backend on ${BASE_URL} (data dir ${DATA_DIR})"
MNEMO_DATA_DIR="${DATA_DIR}" MNEMO_ADDR=":${PORT}" "${BIN}" &
SERVER_PID=$!

for _ in $(seq 1 20); do
  if [[ "$(status_of "${BASE_URL}/api/profiles")" == "200" ]]; then
    break
  fi
  sleep 0.2
done

echo "==> Profiles"
body="$(curl -s "${BASE_URL}/api/profiles")"
check_contains "GET /api/profiles lists the fixed user profile" "${body}" '"name":"user"'

echo "==> Documents (workspace)"
check "POST creates a document" 201 \
  "$(status_of -X POST "${BASE_URL}/api/profiles/user/documents" -d '{"name":"notes","title":"My Notes","body":"# Hello"}')"

check "POST with a duplicate name is rejected" 409 \
  "$(status_of -X POST "${BASE_URL}/api/profiles/user/documents" -d '{"name":"notes","title":"Again","body":"x"}')"

check "POST with a path-traversal name is rejected" 400 \
  "$(status_of -X POST "${BASE_URL}/api/profiles/user/documents" -d '{"name":"../escape","title":"x","body":"x"}')"

check "GET returns the created document" 200 \
  "$(status_of "${BASE_URL}/api/profiles/user/documents/notes")"

check "GET a missing document is a 404" 404 \
  "$(status_of "${BASE_URL}/api/profiles/user/documents/missing")"

check "PUT updates the document" 200 \
  "$(status_of -X PUT "${BASE_URL}/api/profiles/user/documents/notes" -d '{"title":"Updated","body":"new body"}')"

body="$(curl -s "${BASE_URL}/api/profiles/user/documents/notes")"
check_contains "updated document reflects the new title" "${body}" '"title":"Updated"'

echo "==> Calendar (task-document link is required)"
check "POST a task linked to a non-existent document is rejected" 400 \
  "$(status_of -X POST "${BASE_URL}/api/profiles/user/calendar" -d '{"title":"Ship it","document_name":"bogus"}')"

create_body="$(curl -s -X POST "${BASE_URL}/api/profiles/user/calendar" -d '{"title":"Ship it","document_name":"notes"}')"
check_contains "POST a task linked to a real document succeeds" "${create_body}" '"status":"pending"'

task_id="$(echo "${create_body}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
if [[ -z "${task_id}" ]]; then
  echo "  FAIL - could not extract task id from: ${create_body}"
  FAIL=$((FAIL + 1))
else
  check "PATCH marks the task done" 200 \
    "$(status_of -X PATCH "${BASE_URL}/api/profiles/user/calendar/${task_id}" -d '{"status":"done"}')"

  check "DELETE removes the task" 204 \
    "$(status_of -X DELETE "${BASE_URL}/api/profiles/user/calendar/${task_id}")"

  check "PATCH on a deleted task is a 404" 404 \
    "$(status_of -X PATCH "${BASE_URL}/api/profiles/user/calendar/${task_id}" -d '{"status":"done"}')"
fi

check "DELETE removes the document" 204 \
  "$(status_of -X DELETE "${BASE_URL}/api/profiles/user/documents/notes")"

echo
echo "==> ${PASS} passed, ${FAIL} failed"
[[ "${FAIL}" -eq 0 ]]
