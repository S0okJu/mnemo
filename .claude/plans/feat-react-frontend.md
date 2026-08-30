# Migrate frontend from Svelte to React

- **Branch:** `feat/react-frontend`
- **Status:** in-progress
- **Created:** 2026-08-30

## Goal

Replace the Svelte frontend with an equivalent React + TypeScript app, same
Vite tooling, same Obsidian-style layout (nav rail, file tree, task list +
mini calendar, calendar view, editor), same REST API contract against the Go
backend. Reason: user is more familiar with React and its ecosystem has more
available resources than Svelte for them.

## Sub-tasks (1 PR each)

- [x] Port the Svelte app to React (scaffold, API client, all 7 components, App shell) — PR: (not opened yet)
- [x] Update stack docs (CLAUDE.md, DESIGN.md, plan.md) to say React instead of Svelte — PR: (not opened yet)

## Progress Log

- 2026-08-30 — Started. Replacing `frontend/` (Svelte) with a fresh Vite + React + TS scaffold at
  the same path — same backend, same REST contract, same visual design already validated via
  screenshots in the Svelte version, just re-implemented in React.
- 2026-08-30 — Done. `frontend/` is now Vite + React 19 + TypeScript: `lib/api.ts` (same REST
  client, unchanged shape — plain TS, no framework-specific code), and 7 components under
  `components/` mirroring the Svelte ones 1:1 (`NavRail`, `FileTree`, `MonthCalendar`, `TaskList`,
  `TasksView`, `CalendarView`, `Editor`) plus the `App.tsx` shell. Styling ported to CSS Modules
  (`*.module.css` per component) instead of Svelte's scoped `<style>` blocks — same `--bg`/
  `--border`/`--accent` etc. theme variables carried over via `index.css`. `Editor` no longer uses
  an effect to reset its draft on document switch; instead `App.tsx` renders it with
  `key={selectedDoc.name}` so React remounts it — the idiomatic fix and it removed an
  exhaustive-deps lint warning. Same `/api` → `:8080` Vite dev proxy as before. `tsc -b && vite
  build` and `oxlint` both clean (one expected `set-state-in-effect` warning on the
  fetch-on-mount effect, a standard/unavoidable pattern for this case).
- 2026-08-30 — Visually verified with headless Chrome, same seeded backend approach as the
  Svelte version: screenshots of Tasks/Calendar/Editor are pixel-equivalent to the Svelte
  version's. Sent to the user for review.
- 2026-08-30 — Updated `CLAUDE.md`, `DESIGN.md`, and `plan.md` to say "TypeScript + React"
  instead of "TypeScript + Svelte" (tech stack lines, system diagram box in DESIGN.md).

## Issues & Resolutions

- **Issue:** `tsc -b` failed with `TS1294: This syntax is not allowed when 'erasableSyntaxOnly'
  is enabled` on `ApiError`'s constructor parameter property (`constructor(public status:
  number, ...)`), a TS-only shorthand this template's tsconfig forbids.
  **Resolution:** Declared `status` as a regular class field and assigned it in the constructor
  body instead of using the parameter-property shorthand.
- **Issue:** oxlint flagged `Editor`'s reset-on-doc-change `useEffect` for missing
  `doc.title`/`doc.body` dependencies — but including them would reset the draft on every
  keystroke while editing, which is wrong.
  **Resolution:** Removed the effect entirely; `App.tsx` now mounts `Editor` with
  `key={selectedDoc.name}`, which is the standard React pattern for "reset local state when this
  prop identity changes" and needs no effect or lint suppression.

## Needs Human Attention

_(none — visually verified via headless Chrome screenshots.)_
