# mnemo — frontend guide

mnemo is an extensible dashboard for CNCF cloud native tools (Kubernetes core
resources, Kube-OVN, Kyverno, storage, …). The repository root is the Next.js
frontend; `server/` is a separate Go backend with its own guide in
`agents/backend.md`. Paths below are relative to the repository root.

The frontend never talks to the Kubernetes API directly. It consumes a
normalized dashboard API (`/api/v1`) that is served either by the Go backend or
by MSW mocks in the browser.

## Stack

- Next.js 16 (App Router, Turbopack, `output: "standalone"`), React 19, TypeScript (strict)
- Tailwind CSS v4 (CSS-first config in `app/globals.css`, no `tailwind.config`)
- shadcn/ui, style `base-nova`, built on `@base-ui/react` (not Radix)
- TanStack Query v5 for server state, TanStack Table v8 for resource tables
- lucide-react icons, date-fns, js-yaml, framer-motion
- MSW v3 for mock mode, Playwright for tests
- Node 20 (`.nvmrc`), pnpm 12 — always use `pnpm`, never npm/yarn

## Commands

```bash
pnpm dev                     # dev server on :3000
pnpm build                   # production build (standalone)
pnpm lint                    # eslint (next core-web-vitals + typescript + prettier)
pnpm exec tsc --noEmit       # type check (no script for it)
pnpm exec prettier --write . # format
pnpm test:e2e                # Playwright against pnpm dev (reuses a running server)
```

Before finishing a change, run `pnpm lint` and `pnpm exec tsc --noEmit`. For UI
or routing changes, also run the relevant spec in `tests/e2e/`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` starts the MSW worker in the browser and skips the session/SSE calls. Anything else (Docker uses `server`) hits the real API. |
| `NEXT_PUBLIC_API_BASE_URL` | API prefix, default `/api/v1`. |
| `MNEMO_NEXT_DIST_DIR` | Overrides `distDir` (used by live test setups). |

Set local values in `.env.local`. Never commit real kubeconfigs, certificates
or tokens; the live Playwright configs deliberately disable traces and
screenshots so kubeconfig text never lands in test artifacts.

## Directory layout

```
app/                    Routes only. Thin pages that compose feature components.
  layout.tsx            Root layout: fonts + <AppProviders>
  (dashboard)/          Sidebar shell (layout reads sidebar cookies server-side)
    kubernetes/<subsystem>/page.tsx                    Subsystem overview + list (SubsystemPage)
    kubernetes/<subsystem>/<kind>/page.tsx             Redirects legacy list URLs (legacyListUrl)
    kubernetes/<subsystem>/<kind>/[namespace]/[name]/  Detail page (ResourceDetailPage)
    cni/kube-ovn/ ...   Plugin routes
components/ui/          shadcn primitives (generated — edit sparingly)
features/<feature>/     Feature code: components/, hooks/, lib/, registry/, types.ts
  resource-explorer/    Shared list/detail/related-panel UI used by every kind
  plugins/              Plugin definitions (Kube-OVN) and plugin views
  integrations/         Integration toggles (dashboard visibility only)
  nav/                  AppSidebar
  categories/           Top-level sidebar categories
  settings/             Cluster connection / kubeconfig / session
lib/
  api/                  apiFetch/apiSend, endpoints, shared API types
  query/                QueryClient factory and query key factories
  resource-registry/    One adapter per Kubernetes kind (kinds/*.tsx) + registry
  mocks/                MSW handlers and fixtures
  utils.ts, utils/      cn() and formatters (formatAge, …)
providers/              AppProviders, MSW bootstrap, SSE invalidation (CollectionEvents)
hooks/                  shadcn-generated hooks (use-mobile.ts is vendor, lint-ignored)
tests/e2e/              Playwright specs (UI flows and pure-function unit-style specs)
docs/                   Design/plan docs — read before UI or plugin work
```

Import with the `@/` alias (maps to the repo root). Do not use deep relative
imports across top-level folders.

## Core concepts

### Resource registry

Every resource kind is a `ResourceTypeDefinition` in
`lib/resource-registry/kinds/<kind>.tsx`: label, icon, TanStack `columns`,
`fetchList`, `fetchDetail`, optional `fetchSubContent`, `DetailRenderer`, and
`headerFacts`. The registry (`registry.ts`) wires up `fetchEvents` automatically
from `resource-paths.ts`.

To add a kind, touch all of these:

1. `lib/resource-registry/kinds/<kind>.tsx` — the adapter (copy a similar kind).
2. `lib/resource-registry/registry.ts` — register it.
3. `lib/resource-registry/resource-paths.ts` — API path segment.
4. `features/resource-explorer/registry/navigation.ts` — local menu entry.
5. `app/(dashboard)/.../<kind>/page.tsx` (redirect) and `[namespace]/[name]/page.tsx` (detail).
6. The subsystem `page.tsx` `kinds` list.
7. `lib/mocks/fixtures/<kind>.ts` + `lib/mocks/handlers/*` + `handlers/index.ts`.

Plugin kinds (Kube-OVN) are declared through `features/plugins/types.ts` and
`features/plugins/registry/plugins.ts`; see `docs/plugins.md`.

### Detail renderers

Build detail views from the shared primitives in
`features/resource-explorer/components/` — `DetailSection`, `PropertyList`,
`KeyList`, `TagList`, `StatusBadge`, `RelatedPanel`/`relatedSubState`,
`ResourceLink`, `Meters` — instead of hand-written `<dl>` grids or bordered
cards. Avoid cards inside cards. Follow `docs/ui-ux-refinement-plan.md` for
naming (e.g. related section titles), spacing, and typography.

### URLs and routing

- URLs are the source of truth for list state (view, type, filters, sort,
  page). Use `useUrlState` and `features/resource-explorer/lib/list-state.ts`;
  do not mirror this state in `useState`.
- Cluster-scoped resources use the literal `_` namespace segment
  (`endpoints.detail`, detail pages map `_` back to `undefined`).
  Always `decodeURIComponent` route params.
- Pages that read search params on the client wrap their content in
  `<Suspense>`.
- In Next 16, `params` and `searchParams` are Promises — `await` them.

### Data fetching

- All requests go through `apiFetch` / `apiSend` in `lib/api/client.ts`. They
  add credentials and the CSRF header for mutations. No raw `fetch` in features.
- Query keys come from `lib/query/queryKeys.ts` (`resourceKeys.*`). Keep the
  first key segment in `["resources", "plugins", "cluster"]` for data that
  should refresh on server-sent `refresh` events (`CollectionEvents`).
- Defaults: `staleTime` 5s, no refetch on focus, `retry: 1`. Per-kind polling
  uses `pollingIntervalMs` on the definition.

### Mock mode

Any new endpoint must have an MSW handler and fixture so the dashboard works
with `NEXT_PUBLIC_API_MODE=mock`. `AppProviders` blocks rendering until the
worker is ready, so do not render API-dependent UI outside it.

## Server vs. client components

- Default to server components in `app/`. Pages stay thin and pass props
  (kind, breadcrumb, params) to feature components.
- Add `"use client"` only to components that need hooks, browser APIs, or
  interactivity. Most of `features/` is client code because it uses TanStack
  Query and URL state.
- Server-only APIs (`cookies()`, `redirect()` in pages) stay in `app/`.

## Styling

- Tailwind utility classes only; combine with `cn()` from `@/lib/utils`.
  Prettier sorts classes (`prettier-plugin-tailwindcss`).
- Use design tokens from `app/globals.css` (`bg-background`,
  `text-muted-foreground`, `text-status-healthy`, …). Never hard-code colors.
  New tokens go in `:root` **and** `.dark`, and are exposed in `@theme`.
- Status colors: `healthy`, `progressing`, `warning`, `error`, `unknown` —
  render status with `StatusBadge`, not ad-hoc colored text.
- Use shadcn components from `@/components/ui`. Add new ones with
  `pnpm dlx shadcn@latest add <name>`; they are built on Base UI, so check the
  generated API instead of assuming Radix props (`asChild`, etc.).
- Icons: `lucide-react` only.

## Accessibility and testing

- Interactive elements must be real `<button>`/`<a>` (or Base UI primitives),
  keyboard reachable, with accessible names. Sections use `aria-label`;
  navigation uses `aria-current="page"`.
- Playwright specs select by role and accessible name
  (`getByRole("navigation", { name: "Component features" })`). Keep those
  names stable or update the specs in the same change.
- Pure helpers (e.g. `list-state.ts`) are tested directly in Playwright specs
  without a page; prefer extracting logic into such helpers.
- `playwright.live.config.ts` / `playwright.http.config.ts` target a real
  cluster deployment — do not run them unless asked.

## Code style

- Prettier: double quotes, semicolons, trailing commas; 2-space indent, LF
  (`.editorconfig`).
- Components: PascalCase files and named exports (`export function Foo`).
  Hooks: `useXxx.ts`. Default exports only for Next route files.
- Type API data with `lib/api/types.ts` (`K8sResource<Spec, Status>`). Avoid
  `any`; the few existing `eslint-disable` lines for registry generics are the
  exception, not the pattern.
- Keep comments sparse and explain *why*, matching the existing code.

## Skills

Frontend work uses a curated subset of
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills). Use
only the skills below; ignore other installed skills (Go, …) unless the task
explicitly asks for them.

| Skill (install name) | Use when |
| --- | --- |
| `vercel-react-best-practices` | Writing or reviewing components, pages, data fetching, bundle size, re-renders |
| `vercel-composition-patterns` | Designing or refactoring shared components (props growth, compound components) |
| `web-design-guidelines` | UI/accessibility/UX reviews — review only, not for every edit |

Optional, only when the task is about that topic:
`vercel-react-view-transitions` (route or enter/exit animations; the project
currently uses framer-motion).

Do not use: `vercel-optimize`, `deploy-to-vercel`, `vercel-cli-with-tokens`
(mnemo is self-hosted with Helm, not on Vercel), `react-native-skills`
(web only), `writing-guidelines` (not for code).

### If a skill is missing

When a task matches a skill above and that skill is not available in the
session, do not guess its content and do not install it yourself. Tell the user
which skill is missing and why it applies, give the install command, and
continue with this guide's rules in the meantime:

```bash
# one skill (run from the repository root)
npx skills add vercel-labs/agent-skills --skill <install-name> -a claude-code

# the whole required set
npx skills add vercel-labs/agent-skills -a claude-code \
  --skill vercel-react-best-practices --skill vercel-composition-patterns \
  --skill web-design-guidelines
```

### Precedence

This guide > `node_modules/next/dist/docs/` > skill advice. Skills are general
React/Next.js guidance and may describe older Next.js APIs; when they conflict
with this project, follow the project:

- Data fetching stays client-side through TanStack Query and `apiFetch`, so MSW
  mock mode keeps working. Do not move resource fetching into server
  components or route handlers.
- Reuse `components/ui` and the shared `features/resource-explorer`
  primitives before creating new components.
- Styling stays Tailwind tokens from `app/globals.css`; no new CSS-in-JS or
  animation libraries.
- Verify any Next.js API a skill suggests against the bundled Next docs before
  using it.
