# mnemo — backend guide

`server/` is the Go API for the mnemo dashboard. It stores one encrypted
kubeconfig, collects a read-only, normalized projection of the cluster into
PostgreSQL, and serves it to the Next.js frontend under `/api/v1`. The
frontend (repo root, see `agents/frontend.md`) never talks to
Kubernetes directly.

Code paths (`cmd/`, `internal/`, `migrations/`, …) are relative to `server/`;
`docs/`, `deploy/` and `agents/` paths are relative to the repository root.

Read before changing behavior:

- `docs/server-goal.md` — the API contract and security principles (source of truth).
- `docs/server-implementation.md` — current state, verification log, local setup.
- `docs/test-deployment.md` — the deployed test environment.

## Stack

- Go 1.25 (module `mnemo/server`), standard `net/http` + chi v5 router
- PostgreSQL 17 via pgx v5 (`pgxpool`), migrations with Goose v3 (embedded SQL)
- client-go / apimachinery v0.34 (dynamic client + informers, `unstructured`)
- Distroless static image (`Dockerfile`), binaries `mnemo` and `migrate`

## Commands

Run from `server/`:

```bash
gofmt -l . && go vet ./...
go test ./...                       # DB tests skip without MNEMO_TEST_DATABASE_URL
MNEMO_TEST_DATABASE_URL=... go test ./...   # full suite incl. PostgreSQL integration tests
go run ./cmd/migrate                # apply migrations (needs MNEMO_DATABASE_URL)
go run ./cmd/mnemo                  # run the API (see env below)
scripts/run-live-test-server.sh     # live test runner using fixtures in $MNEMO_LIVE_TEST_DIR
```

Local PostgreSQL: `docker compose up -d --wait postgres` from the repo root,
with `MNEMO_POSTGRES_PASSWORD_FILE` pointing at a password file outside the repo.

Before finishing a change: `gofmt`, `go vet ./...`, and `go test ./...` with a
test database when the change touches SQL, collection, or HTTP handlers.

## Layout

```
cmd/mnemo/        Entry point: env parsing, DB pool, TLS/mTLS, identity mode,
                  collector/initializer goroutines, frontend reverse proxy, probes
cmd/migrate/      Goose runner holding a PostgreSQL advisory lock
internal/
  connection/     Kubeconfig validation, policy, AES-256-GCM vault, exec auth, Store
  collection/     Kind registry, collectors/reconcile, Normalize, health,
                  references/relations, retention, metrics, Secret-safe client
  httpapi/        API handler (chi), resources/subresources/relations, SSE Events,
                  identity (mTLS / basic / no-auth), CSRF, session
  testdb/         Isolated-schema PostgreSQL helper for tests
migrations/       Goose SQL files embedded via migrations.FS
scripts/          Test-only helpers
```

Deployment lives outside `server/`: `deploy/helm/` (charts `mnemo`,
`mnemo-postgresql`, …) and `deploy/scripts/`.

## Request flow

1. `cmd/mnemo` mounts `api.Handler()` at `/api/v1/`, plus `GET /api/v1/session`,
   `/livez`, `/readyz`, and (if `MNEMO_FRONTEND_URL`) a proxy for everything else.
2. `API.Handler` applies, in order: 15s timeout (except SSE), authentication via
   `Identify`, then for non-GET requests admin role → HTTPS (unless
   `AllowHTTP`) → CSRF, then the per-user rate limit on validate/PUT.
3. Explicit routes handle connection, metrics, relations, sync, capabilities and
   `/events`. Everything else falls through to `a.resources`, which matches the
   path against `collection.Kinds` and reads projections from PostgreSQL.

Resource reads are always scoped to `connection_id=1` and the **current
connection generation**. Keep that predicate in every new query so data from a
replaced or disconnected connection is never served.

Response conventions (match the frontend's expectations):

- Use `write(w, status, body)` — JSON, `Cache-Control: no-store`.
- Errors are `{ "message": "..." }`, plus `"reason"` for machine-readable cases
  (`not-configured` → 409, `forbidden` → 403).
- 503 when the DB is down or a kind is not yet initialized; `X-Mnemo-Stale: true`
  when the last successful sync is older than 60s.
- Lists support `namespace`, `search`, limit/offset with stable
  namespace/name/UID ordering and filtered totals.

## Adding a resource kind

1. `internal/collection/registry.go` — add a `kind(path, Name, group, version, resource)`
   entry. `path` must equal the frontend's `resourceApiPaths` value
   (`lib/resource-registry/resource-paths.ts`); use `UIKind` if the UI name differs.
2. `internal/collection/normalize*.go` — add an allowlisted `spec`/`status`
   projection and a `status.level` (`health.go`).
3. `internal/collection/references.go` — owner/selector/binding relations, if any.
4. `internal/httpapi/subresources.go` — detail sub-content (related, events, …).
5. Helm RBAC in `deploy/helm/mnemo` — grant `get/list/watch` for the new GVR.
6. Tests for normalization and any new handler behavior.

The frontend kind, fixtures and MSW handler must match the same JSON shape.

## Security rules (do not weaken)

- **Never return or log credentials.** Responses describe connections by
  metadata only. No tokens, keys, cert data, passwords or the kubeconfig text in
  responses, logs, errors, audit records, test output or fixtures.
- **Normalize by allowlist.** Never project raw objects, annotation values,
  Secret data, ConfigMap values or container env. Secrets are listed through the
  metadata-safe client (`secrets.go`).
- **Collection is read-only.** Do not add write calls to the Kubernetes API.
- **Identity comes only from `Identify`** (verified client cert CN/OU, or the
  configured basic/no-auth modes). Never trust identity headers from the browser.
  The frontend proxy strips `Authorization` and `X-CSRF-Token`.
- **Mutations** require admin, CSRF, and HTTPS unless `MNEMO_ALLOW_HTTP=true`.
  New write routes go through `API.Handler` — never register them on the outer mux.
- Kubeconfigs with file references are rejected; exec auth only with
  `MNEMO_ALLOW_EXEC_AUTH=true` + allowlist; keep TLS verification on.
- Bodies: `http.MaxBytesReader` 1 MiB, `DisallowUnknownFields`, single JSON value.
- Keep error messages generic where they could leak DB/cluster details
  (see `cmd/migrate`'s redacted failure log).

## Database

- Schema changes go in a **new** `migrations/NNNNN_<name>.sql` with
  `-- +goose Up` / `-- +goose Down`. Never edit an applied migration.
- `/readyz` checks the latest applied Goose version; update the expected
  version there when adding a migration, and `testdb.Pool`, which currently
  applies only `00001_foundation.sql`.
- Replace/disconnect and snapshot writes are transactional and fenced by
  `generation`. Partial, missing or unauthorized snapshots must never delete
  existing projections.
- Retention is bounded-batch (`retention.go`); keep new cleanup jobs bounded.

## Environment

Required: `MNEMO_DATABASE_URL`, `MNEMO_ENCRYPTION_KEY` (base64 of 32 bytes),
`MNEMO_TLS_CERT_FILE`, `MNEMO_TLS_KEY_FILE`, `MNEMO_CLIENT_CA_FILE`.

Common optional: `MNEMO_LISTEN` (`:8443`), `MNEMO_FRONTEND_URL`,
`MNEMO_BOOTSTRAP_KUBECONFIG` (defaults to `./config` or `../config`),
`MNEMO_ALLOW_HTTP` / `MNEMO_HTTP_LISTEN` / `MNEMO_HTTP_NO_AUTH` /
`MNEMO_HTTP_ADMIN_PASSWORD` / `MNEMO_HTTP_VIEWER_PASSWORD`,
`MNEMO_REQUIRE_TLS_VERIFY`, `MNEMO_ALLOW_EXEC_AUTH`, `MNEMO_EXEC_ALLOWLIST`,
`MNEMO_EXEC_ENV_ALLOWLIST`, `MNEMO_ALLOW_KUBECONFIG_OVERRIDE`,
`MNEMO_DB_MAX_CONNECTIONS`, `MNEMO_COLLECTION_*`, `MNEMO_SSE_*`,
`MNEMO_MIGRATION_TIMEOUT`. Numeric settings are range-checked with
`positiveEnv`; follow that pattern for new ones and fail fast on bad values.

Never commit `config` (the repo-root kubeconfig), keys, certificates, DB URLs
or registry tokens. Live fixtures live outside the repo (`/tmp/mnemo-server-test`).

## Testing

- Tests sit next to code (`*_test.go`) and use `net/http/httptest` against
  `api.Handler()` with a stub `Identify`.
- DB-backed tests call `testdb.Pool(t)`, which creates and drops its own schema
  and skips when `MNEMO_TEST_DATABASE_URL` is unset. Never truncate or reuse a
  shared database.
- Cover security behavior with tests: auth/role/CSRF rejections, credential
  exclusion from responses, generation fencing, and permission loss.

## Code style

- `gofmt`; standard library first, then third-party, then `mnemo/server/...`.
- Small packages under `internal/`; no new top-level packages without need.
- Return errors up to `run()`; log once there. Use `context` from the request or
  the signal context — no `context.Background()` in request paths.
- Comments are sparse and explain *why* (invariants, security reasons).

## Skills

Backend work uses a curated subset of
[samber/cc-skills-golang](https://github.com/samber/cc-skills-golang). Use only
the skills below; ignore other installed skills (React, Vercel, …) unless the
task explicitly asks for them.

| Skill | Use when |
| --- | --- |
| `golang-security` | Auth, identity, CSRF, TLS, kubeconfig/exec handling, anything that returns or logs data |
| `golang-database` | SQL, transactions, migrations, pgx pool, generation fencing |
| `golang-context` | Request handlers, timeouts, shutdown, background work |
| `golang-concurrency` | Collectors, informers, SSE `Events`, goroutine lifecycles |
| `golang-error-handling` | Error wrapping, HTTP error responses, redacted logging |
| `golang-safety` | Nil handling, integer conversions, `defer`, slices/maps aliasing |
| `golang-testing` | Writing or changing `*_test.go` |
| `golang-code-style` | Writing or reviewing Go code |

Optional, only when the task is about that topic: `golang-observability`
(metrics), `golang-performance`, `golang-modernize`, `golang-lint`
(golangci-lint adoption).

Do not use: `golang-samber-*`, `golang-uber-*`, `golang-google-wire`,
`golang-spf13-*`, `golang-grpc`, `golang-graphql`, `golang-swagger`,
`golang-stretchr-testify` — they push libraries this project does not use.

### If a skill is missing

When a task matches a skill above and that skill is not available in the
session, do not guess its content and do not install it yourself. Tell the user
which skill is missing and why it applies, give the install command, and
continue with this guide's rules in the meantime:

```bash
# one skill (run from the repository root)
npx skills add https://github.com/samber/cc-skills-golang --skill <skill-name> -a claude-code

# the whole required set
npx skills add https://github.com/samber/cc-skills-golang -a claude-code \
  --skill golang-security --skill golang-database --skill golang-context \
  --skill golang-concurrency --skill golang-error-handling --skill golang-safety \
  --skill golang-testing --skill golang-code-style
```

### Precedence

This guide > `docs/server-goal.md` > skill advice. Skills are general Go
guidance; when they conflict with this project, follow the project:

- Tests use the standard `testing` package, `httptest` and `testdb.Pool` —
  not testify, mocks frameworks or shared databases.
- Logging stays `log` with generic, redacted messages. Do not add slog,
  OpenTelemetry or new logging libraries unless asked.
- Configuration stays env vars parsed in `cmd/mnemo` (`positiveEnv`) — no
  viper/cobra, no DI frameworks.
- Security rules in this guide are never relaxed because a skill suggests a
  simpler pattern.
