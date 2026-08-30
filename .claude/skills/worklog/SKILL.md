---
name: worklog
description: Create and maintain a per-branch work-plan log under .claude/plans/ for this repo. Check it proactively at the start of ANY work on an existing branch — before touching code, look for .claude/plans/<branch>.md and read it so prior goal, sub-task status, past issues, and open blockers carry over. Also use this when starting a new feature/task/branch, when a sub-task finishes or its PR opens/merges, right after hitting and resolving a problem or bug during implementation, when making a non-obvious design decision, or when something blocks progress that only a human can unblock (missing credentials, external access, an ambiguous product decision, permissions). Treat the plan doc as a living log updated throughout the work, not a one-time artifact written only at the start.
---

# Work Plan & Logging

One unit of work = one git branch = one markdown plan doc in `.claude/plans/`. Each sub-task inside
that unit of work = one PR. The doc is the running memory of that branch: its goal, its sub-task
status, what happened, what went wrong and how it got fixed, and — critically — what could not be
resolved by AI and needs a human.

## Why this matters

Sessions end and context resets, but the branch keeps existing until it's merged. Without a durable
log, every new session has to reconstruct "what is this branch for, what's left, what already went
wrong" from scratch by re-reading diffs and guessing. The plan doc removes that guesswork: read one
file, know exactly where things stand. The "Needs Human Attention" section exists so a human never
has to comb through a transcript to find the one thing they're actually needed for — it's always in
the same place, at the top of that section.

## File location and naming

- Path: `.claude/plans/<branch-name>.md`, with `/` in the branch name replaced by `-`
  (e.g. branch `feat/calendar-sync` → `.claude/plans/feat-calendar-sync.md`).
- Create `.claude/plans/` if it doesn't exist yet.
- Exactly one plan doc per branch. If a plan doc already exists for the current branch, update it —
  don't create a second one.

## Resuming existing work

Before making any change on a branch that isn't brand new, check whether `.claude/plans/<branch-name>.md`
already exists and read it in full first. It carries the context a fresh session doesn't have on its
own: what this branch is actually for, which sub-tasks are already done, which problems already came
up and how they were handled, and whether something is sitting in "Needs Human Attention" waiting on
the user. Skipping this step means silently re-deriving context that's already written down, or worse,
re-attempting something already known to be blocked.

## Starting a new unit of work

1. Confirm the goal and the branch name with the user if either is unclear (propose a kebab-case
   branch name derived from the goal if they haven't given one).
2. Create/checkout the branch.
3. Copy `assets/plan-template.md` to `.claude/plans/<branch-name>.md` and fill in the title, branch,
   date, and goal.
4. Break the goal into sub-tasks up front, best-effort — each sub-task will become its own PR. It's
   fine for this list to change as work reveals more detail; keep it in sync when it does.

## Keeping the log current

Update the doc at natural checkpoints, not after every small edit — finishing a sub-task, opening or
merging its PR, hitting a problem, making a design decision, or getting blocked:

- **Progress Log** — append a short, timestamped entry. Optimize for someone resuming cold: what
  happened and why, not a diff summary.
- **Sub-tasks** — check off completed ones and fill in the PR link/number once it exists.
- **Issues & Resolutions** — every time something breaks or doesn't work as expected, record it here:
  what went wrong, and how it got resolved. If you haven't resolved it yet, write "Unresolved" rather
  than skipping the entry — a problem that gets fixed later without a record here is a problem the
  next session will hit again from zero.
- **Needs Human Attention** — anything AI cannot finish on its own: missing credentials or access,
  an external system only a human can reach, a product decision that needs a real answer instead of
  an assumption. State plainly what's blocked and exactly what the human needs to do or decide to
  unblock it. Never silently work around this by guessing — log it here and keep going on whatever
  else doesn't depend on it.

## Style

- Write the plan doc in English regardless of what language the conversation is in — it's meant to
  be equally readable by any AI session or teammate picking up the branch later.
- Favor headings and checklists over prose; this doc is read by an AI resuming work, so scannability
  beats narrative.
- Keep entries terse. Link to commits/PRs/files instead of pasting large diffs or logs inline.
