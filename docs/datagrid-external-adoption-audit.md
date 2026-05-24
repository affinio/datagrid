# DataGrid External Adoption Audit

Date: 2026-05-24

Perspective: first-time external adoption.

Scope read before this audit:

- `README.md`
- `docs/datagrid-product-report.ru.md`
- `docs/datagrid-feature-catalog.md`
- `docs/datagrid-vue-stable-entrypoint.md`
- `docs/server-datasource/quick-start.md`
- `docs/server-datasource/integration-docs-map.md`

## Executive Summary

Affino DataGrid looks technically mature, but first-time adoption is harder than it needs to be. The main friction is not missing capability. It is entrypoint ambiguity, fragmented first-run guidance, and too much internal/platform language before a user has rendered one grid.

Highest ROI: create a single external "Start here" path, fix package naming inconsistencies, add a copy-paste Vue quick start, and make server datasource onboarding explicitly second-step unless the user already knows they need backend-owned data.

This audit intentionally preserves:

- existing architecture boundaries
- stable, advanced, and internal tier model
- deterministic core philosophy
- enterprise capability surface

The recommended fixes are minimal additive slices, not rewrites.

## Ranked Issues

| Rank | Severity | Category | Adoption friction | Why it hurts adoption | External engineer impact | Smallest slice-based fix |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Critical | Docs-only | Root `README.md` has no copy-paste app quick start. | The first external page is repo/process oriented, not product adoption oriented. | Users cannot render a grid in 5 minutes without hunting. | Add "5-minute Vue quick start" with install, minimal component, expected result, and next links. |
| 2 | Critical | Packaging | Package entry map references `@affino/datagrid`, but no matching package appears in `packages/`. | Creates immediate uncertainty about the canonical install/import. | Users may install the wrong package or assume docs are stale. | Either add/verify package publication or change docs to `@affino/datagrid-vue-app` as primary app entry. |
| 3 | Critical | Docs-only | Recommended first path differs across docs. | Product report says start with `@affino/datagrid-vue-app`; feature catalog lists `@affino/datagrid`; root lists core packages but omits app/server packages. | New users cannot form a mental model of "which package do I use?" | Add one canonical package decision table and link it from root, feature catalog, Vue stable entrypoint, and server docs. |
| 4 | High | Docs-only | First 5-minute path is split across root README, Vue stable doc, package README, and server quick start. | Users must synthesize setup from multiple docs before seeing output. | Raises cognitive load before trust is established. | Create `docs/quick-start.md` or promote `packages/datagrid-vue-app/README.md` quick start as the canonical app quick start. |
| 5 | High | API ergonomics | Stable/advanced/internal model is correct but exposed too early. | Stable entrypoint doc lists many primitives before the user understands when they need them. | New users perceive the package as low-level even when a declarative component exists. | Add "Use this unless..." guidance: `DataGrid` first, `useDataGridRuntime` only for custom host/runtime, `/advanced` only for renderer/control ownership. |
| 6 | High | Demo/sandbox | No obvious runnable external demo path from root. | Product claims are hard to verify quickly. | Users cannot inspect UX, scrolling, selection, filtering, or editing before integration. | Add a minimal Vite example command/path or link to a hosted demo/storybook/sandbox-equivalent. |
| 7 | High | Docs-only | Server datasource "Start Here" is too broad. | README lists many docs without telling users which are mandatory. | Backend adopters may read protocol/internal material too soon. | Split into "Read-only in 10 minutes", "Editable/history", and "Advanced protocol" tracks. |
| 8 | High | Docs-only | Server quick start mixes minimal read-only setup with histogram/history/editing details. | Optional capabilities interrupt the minimal path. | Users overestimate backend scope needed for first success. | Move optional endpoints below a clear "After the first grid renders" section. |
| 9 | Medium-High | API ergonomics | Row identity examples use both `id` and `rowId`. | Core identity contract is not obvious. | Users may build unstable row keys or normalize incorrectly. | Add a "Row identity contract" note to app and server quick starts with accepted shapes and recommendation. |
| 10 | Medium-High | Packaging | Install guidance varies between `npm install @affino/datagrid-vue-app` and multi-package installs including core/vue/server adapters. | Users do not know what is required vs transitive vs advanced. | Increases package install churn and incorrect dependencies. | Add install matrix: local rows, server rows, headless runtime, optional feature modules. |
| 11 | Medium | Docs-only | Product overview is RU-only. | Useful external positioning is inaccessible to many engineers. | Non-Russian evaluators miss the best adoption-oriented explanation. | Add English equivalent or concise English executive overview. |
| 12 | Medium | Docs-only | Feature catalog is comprehensive but too dense for first evaluation. | It reads like an inventory, not an adoption guide. | Users struggle to distinguish stable user-facing capabilities from lower-level contracts. | Add "Top capabilities by adoption scenario" before the full matrix. |
| 13 | Medium | Packaging | Publication/version compatibility is unclear. | Badges exist in package README, but root does not show current package version matrix or peer dependency baseline. | Users cannot quickly verify npm/Python package readiness. | Add package status table: npm package, Python package, peer deps, stable entrypoint, advanced entrypoint. |
| 14 | Medium | Demo/sandbox | Sandbox/demo relationship is unclear because root says demo apps are out of scope. | Users may not know where production-shaped examples live. | Reduces confidence in real-world integration. | Add external examples section linking server demo files and any runnable host app commands. |
| 15 | Medium | Docs-only | Validation commands are repo-maintainer focused, not adopter focused. | Root starts with full monorepo checks and benchmarks. | Users lack a quick "my install works" validation path. | Add adopter validation: `pnpm type-check`, run Vite app, optional package-level contract checks only for contributors. |

## Slice Roadmap

| Order | Slice | Type | ROI | Measurable improvement |
| ---: | --- | --- | --- | --- |
| 1 | Add canonical external quick start to root README. | Docs-only | Very high | User can install and render `<DataGrid />` from one page. |
| 2 | Normalize package recommendations around `@affino/datagrid-vue-app` for app usage. | Packaging/docs | Very high | No conflicting primary package names across core docs. |
| 3 | Add package decision matrix. | Docs-only | High | User can choose app, adapter, core, server adapter, or advanced entrypoint in under 1 minute. |
| 4 | Add row identity contract note to quick starts. | API ergonomics/docs | High | Fewer unstable key/import-shape mistakes. |
| 5 | Split server datasource onboarding into read-only first, optional capabilities second. | Docs-only | High | Backend users can implement only `POST /api/{tableId}/pull` first. |
| 6 | Add runnable minimal Vue example or hosted demo link. | Demo/sandbox | High | User can visually verify grid behavior before integration. |
| 7 | Add package publication/version matrix. | Packaging | Medium-High | Users can verify installability and peer deps quickly. |
| 8 | Add English product overview. | Docs-only | Medium | Broader external evaluation clarity. |
| 9 | Reframe stable/advanced/internal docs with "when to use" gates. | API ergonomics/docs | Medium | Stable tier remains intact while reducing perceived complexity. |
| 10 | Add adopter validation checklist. | Docs-only | Medium | Users know the smallest useful validation command. |

## Docs-Only Fixes

- Root README external quick start.
- English product overview.
- First-use package decision matrix.
- Server datasource read-only-first path.
- Feature catalog scenario summary.
- Adopter validation checklist.
- Clear links from root README to Vue app, server datasource, feature catalog, and stable entrypoint docs.

## API Ergonomics Fixes

- Document one recommended row identity shape for app users.
- Clarify `DataGrid` vs `useDataGridRuntime` vs `/advanced`.
- Add "stable first, advanced only when owning renderer/interactions" guidance.
- Keep stable/advanced/internal tier model unchanged.

## Packaging Fixes

- Resolve or remove `@affino/datagrid` as a recommended package unless it is actually published.
- Add install matrix by scenario:
  - local rows
  - server rows
  - headless runtime
  - custom advanced renderer
- Add package/version/peer dependency table.
- Clarify which packages are direct dependencies versus transitive implementation packages.

## Demo/Sandbox Fixes

- Add one minimal runnable Vite example or command.
- Add link to a hosted demo if available.
- Link production-shaped server demo files from the quick start.
- Clarify that sandbox is for internal validation, while examples are for external adoption.

## Validation Plan Per Slice

| Slice | Validation |
| --- | --- |
| Root quick start | Fresh Vue app can install packages, compile, and render a grid within 5 minutes. |
| Package recommendation cleanup | `rg '@affino/datagrid' docs README.md packages/*/README.md` shows no misleading primary package reference. |
| Package decision matrix | Review against actual `packages/*/package.json` names. |
| Row identity contract | Verify examples consistently use recommended identity shape. |
| Server read-only-first docs | Confirm minimal path only requires `POST /api/{tableId}/pull`. |
| Runnable demo/example | Run install, type-check, and local dev server; visually verify table renders. |
| Version/package matrix | Cross-check npm package names, peer deps, and Python package name. |
| Stable/advanced reframing | Confirm advanced APIs remain documented but are not part of beginner path. |
| Adopter validation checklist | Run the listed commands from a clean checkout or example app. |
