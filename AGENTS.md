<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# mnemo

Extensible dashboard for CNCF cloud native tools (Kubernetes, Kube-OVN,
Kyverno, storage, …).

| Part | Location | Guide |
| --- | --- | --- |
| Frontend — Next.js 16, React 19, Tailwind v4, TanStack Query | repo root (`app/`, `features/`, `lib/`, …) | [`agents/frontend.md`](agents/frontend.md) |
| Backend — Go 1.25 API, PostgreSQL, client-go | `server/` | [`agents/backend.md`](agents/backend.md) |
| Deployment — Helm charts and scripts | `deploy/` | `docs/test-deployment.md` |

Read the guide for the part you are changing before writing code. For changes
that cross the API boundary, read both: the frontend's `lib/api/types.ts` and
mocks must match the JSON the server returns.

Each guide lists the agent skills to use for that part, the ones to ignore,
and how to ask the user to install a missing one. Guides win over skills.

Repo-wide rules:

- Use `pnpm` for the frontend and the Go toolchain inside `server/`.
- Never commit credentials: the repo-root `config` kubeconfig, keys,
  certificates, database URLs or registry tokens.
