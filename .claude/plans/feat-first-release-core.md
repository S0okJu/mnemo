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
- [x] Svelte frontend (editor, workspace list, calendar view) — PR: branch `feat/frontend-mvp` (not pushed/opened yet)

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
- 2026-08-30 — Sub-task 4 done on `feat/frontend-mvp`: Vite + Svelte 5 (runes) + TypeScript app —
  `lib/api.ts` (typed REST client), `WorkspaceList.svelte` (list/create/delete documents),
  `Editor.svelte` (edit title/body, Save), `Calendar.svelte` (list tasks, toggle done/delete, and
  a "new task" form whose document `<select>` is a required field populated from existing
  documents — enforces the doc-link requirement at the UI level, matching the backend's
  `ErrDocumentNotFound` rejection). Deviated from the plan's "wire CORS on the backend" with a
  Vite dev-server proxy (`/api` → `localhost:8080`) instead — same local-dev outcome, zero
  backend changes; CORS headers would only matter if frontend/backend end up served from
  different origins in production, which is out of scope for now. `npm run check` (svelte-check +
  tsc) and `npm run build` both clean. Verified at the network level: ran the Go backend and the
  Vite dev server together and confirmed `GET /api/profiles` round-trips correctly through the
  dev proxy. **Not verified in an actual browser** — no headless browser was available in this
  environment; the user should click through the golden path (create a doc, edit and save it,
  create a task linked to it, toggle it done) before considering this sub-task fully done.

## Issues & Resolutions

- **Issue:** No headless browser (Chromium/Playwright) available in the sandbox to visually
  verify the frontend UI.
  **Resolution:** Verified at the network/build level instead (type-check, production build,
  live network round-trip through the Vite proxy to the real backend). Visual verification is
  listed under Needs Human Attention.

## Needs Human Attention

- The frontend (branch `feat/frontend-mvp`) has not been clicked through in an actual browser.
  Run `MNEMO_ADDR=:8080 go run ./cmd/mnemo` (from `backend/`) and `npm run dev` (from
  `frontend/`), open http://localhost:5173, and confirm: create a document, edit + save it,
  create a calendar task linked to it (the document picker is required), toggle it done, delete
  both. Report back anything that looks or feels wrong.
- None of the four sub-task branches have been pushed to `origin` or opened as GitHub PRs yet —
  holding for explicit confirmation before pushing to the shared remote, per the user's own
  push/PR safety preference.
