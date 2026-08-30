# Obsidian-style UI redesign (clean white)

- **Branch:** `feat/obsidian-style-ui`
- **Status:** in-progress
- **Created:** 2026-08-30

## Goal

Redesign the Svelte frontend layout to an Obsidian-like three-pane shell: a
narrow nav rail (Tasks / Calendar), a file-tree pane showing workspace
documents, and a main content area. The Tasks view shows the task list with
a small month calendar on the right; a dedicated Calendar view shows a full
month calendar plus all tasks. Visual style: clean, minimal, white
background throughout, no color-heavy accents.

## Sub-tasks (1 PR each)

- [x] Layout + components (NavRail, FileTree, MonthCalendar, TaskList, TasksView, CalendarView, App shell rewrite, clean-white theme) — PR: (not opened yet)

## Progress Log

- 2026-08-30 — Started. Branching off `main` (first-release MVP already merged). Implementing as
  a single sub-task since it's one cohesive layout change, not independently reviewable slices.
- 2026-08-30 — Done. New Obsidian-style shell: `NavRail.svelte` (Tasks/Calendar toggle),
  `FileTree.svelte` (workspace folder + document list, replaces `WorkspaceList.svelte`),
  `MonthCalendar.svelte` (reusable month grid, marks days with tasks due, `size="small"|"large"`),
  `TaskList.svelte` (replaces `Calendar.svelte`, added an optional due-date input so the calendar
  has something to mark), `TasksView.svelte` (task list + small calendar on the right, per the
  user's spec), `CalendarView.svelte` (large calendar + full task list), `App.svelte` rewritten
  around a 3-column grid shell (nav rail / file tree / main content), `app.css` now defines a
  clean white theme via CSS variables (`--bg`, `--border`, `--muted`, `--hover-bg`, `--accent`,
  etc.) used throughout. `npm run check` and `npm run build` both clean.
- 2026-08-30 — Visually verified with headless Chrome (found `/Applications/Google Chrome.app`
  in this environment, so the earlier "no headless browser" limitation didn't apply here): ran
  the real backend seeded with sample docs/tasks plus the Vite dev server, and captured
  screenshots of all three states (Tasks, Calendar, Editor) with
  `Google Chrome --headless --screenshot=... http://localhost:5173/`. All three render correctly
  and match the requested layout. Sent to the user for review.

## Issues & Resolutions

- **Issue:** Needed to see the Calendar and Editor views (not just the default Tasks view) to
  screenshot them, but there's no scripted way to click through the UI headlessly without adding
  a test framework.
  **Resolution:** Temporarily changed `App.svelte`'s initial `activeView`/`selectedName` state
  defaults, took the screenshot, reverted immediately after. No test-only code was left in the
  committed version.

## Needs Human Attention

_(none — visually verified via headless Chrome screenshots this time.)_
