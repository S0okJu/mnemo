# Mnemo First Release Core (Profile/Workspace/Calendar MVP)

- **Branch:** `feat/first-release-core`
- **Status:** in-progress
- **Created:** 2026-08-30

## Goal

Implement the three first-release features from `plan.md`: (1) the `user`
profile can edit markdown documents in its workspace, (2) only `user` is a
human-owned profile (agent profiles reserved for later), (3) registering a
calendar task requires linking an existing document. Full design in
`/Users/damekz/.claude/plans/piped-beaming-meteor.md` (approved plan).

## Sub-tasks (1 PR each)

- [x] Backend scaffolding + data layer (Profile Manager, Workspace Manager, frontmatter, tests) — PR: branch `feat/backend-scaffolding` (not pushed/opened yet)
- [x] Document REST API (`/api/profiles/user/documents*`) — PR: branch `feat/document-rest-api` (not pushed/opened yet)
- [x] Calendar REST API (`/api/profiles/user/calendar*`, doc-link validation) — PR: branch `feat/calendar-rest-api` (not pushed/opened yet)
- [ ] Svelte frontend (editor, workspace list, calendar view) — PR: (not opened yet)

## Progress Log

- 2026-08-30 — Plan approved (see `/Users/damekz/.claude/plans/piped-beaming-meteor.md`). Branch created, plan doc initialized. Starting sub-task 1.
- 2026-08-30 — Sub-task 1 done on `feat/backend-scaffolding` (off this branch): `backend/go.mod`
  (module `github.com/S0okJu/mnemo/backend`), `internal/fsutil` (atomic file writes),
  `internal/profile` (fixed `user` profile bootstrap + lookup), `internal/workspace`
  (frontmatter-backed markdown CRUD with filename sanitization against path traversal),
  `cmd/mnemo` (bootstraps the data dir, no HTTP yet). `go build`, `go vet`, `gofmt -l`, and
  `go test ./...` all clean; binary smoke-tested to confirm it creates
  `profiles/user/workspace/` on first run. Not yet pushed/PR'd — holding for user confirmation
  before pushing to the remote.
- 2026-08-30 — Sub-task 2 done on `feat/document-rest-api`: `internal/httpapi` (stdlib
  `net/http.ServeMux` with Go 1.22+ method+pattern routing, no external router dep) exposing
  `GET /api/profiles` and full CRUD on `/api/profiles/user/documents*`; error mapping from
  workspace sentinel errors to 404/409/400/500. `httptest`-based integration tests cover
  create/get/update/delete/list, duplicate name (409), invalid name (400), invalid JSON body
  (400), and missing document (404). `cmd/mnemo` now runs an actual HTTP server
  (`MNEMO_ADDR`, default `:8080`). Manually curl-tested end to end. Not yet pushed/PR'd.
- 2026-08-30 — Sub-task 3 done on `feat/calendar-rest-api`: `internal/calendar` (Task/Status,
  JSON-file-backed Service behind a `DocumentChecker` interface satisfied by `workspace.Manager`
  — Create rejects a `document_name` that doesn't exist via `ErrDocumentNotFound`) plus
  `/api/profiles/user/calendar*` REST routes (list/create/patch/delete). Unit tests for the
  service and `httptest` integration tests for the routes, including the reject-missing-document
  case. `cmd/mnemo` now wires the calendar service to `calendars/user.json`. Curl-tested end to
  end: POSTing a task with a bogus `document_name` returns 400, a real one returns 201. Not yet
  pushed/PR'd.

## Issues & Resolutions

_(none yet)_

## Needs Human Attention

_(none yet)_
