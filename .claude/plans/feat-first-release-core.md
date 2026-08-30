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
- [ ] Document REST API (`/api/profiles/user/documents*`) — PR: (not opened yet)
- [ ] Calendar REST API (`/api/profiles/user/calendar*`, doc-link validation) — PR: (not opened yet)
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

## Issues & Resolutions

_(none yet)_

## Needs Human Attention

_(none yet)_
