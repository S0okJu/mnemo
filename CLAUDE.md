# Mnemo

An agentic remote markdown web editor. AI agents (e.g. hermes) and the user each own a profile with
its own workspace and calendar; the user can remotely review and track documents/tasks the agents
create.

- Background, core concepts (profile/workspace/calendar/task), first release scope: [plan.md](./plan.md)
- Architecture (backend composition, communication, file system layout): [DESIGN.md](./DESIGN.md)

## Tech stack

- Backend: Go
- Frontend: TypeScript + Svelte
- Storage: local file system (DB support planned later)

## Go development

Before any Go coding, review, debugging, troubleshooting, or setup task, load the `samber/cc-skills-golang@golang-how-to` skill first — it routes to whichever other Go skills the task needs.

## Required Go skills

The following Go skills from `samber/cc-skills-golang` MUST always be applied when working on this project. Load them at the start of every Go-related task, regardless of whether the user explicitly mentions them.

- `samber/cc-skills-golang@golang-code-style`
- `samber/cc-skills-golang@golang-data-structures`
- `samber/cc-skills-golang@golang-design-patterns`
- `samber/cc-skills-golang@golang-documentation`
- `samber/cc-skills-golang@golang-error-handling`
- `samber/cc-skills-golang@golang-modernize`
- `samber/cc-skills-golang@golang-naming`
- `samber/cc-skills-golang@golang-safety`
- `samber/cc-skills-golang@golang-security`
- `samber/cc-skills-golang@golang-testing`
- `samber/cc-skills-golang@golang-troubleshooting`
