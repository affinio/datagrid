# DataGrid Stable API Ergonomics Audit

Date: 2026-05-24

Scope: external-engineer API ergonomics for these packages only:

- `@affino/datagrid-core`
- `@affino/datagrid-vue`
- `@affino/datagrid-vue-app`

Docs read before this audit:

- `docs/datagrid-grid-api.md`
- `docs/datagrid-public-api-inventory.md`
- `docs/datagrid-vue-stable-entrypoint.md`
- `docs/datagrid-feature-catalog.md`
- `docs/datagrid-migration-guide.md`

Goal: identify stable API complexity that harms adoption without reducing architecture quality.

## Executive Summary

Affino DataGrid has a strong tiered API architecture, but the stable API story currently feels heavier than the beginner path requires. The main adoption risk is not that the APIs are poorly designed. The risk is that too many concepts are introduced before an external engineer knows whether they need the app component, the Vue runtime, or core APIs.

The recommended simplification is documentation and additive ergonomics first:

- keep the stable/advanced/internal tiers intact
- make `@affino/datagrid-vue-app` the obvious beginner path
- present `@affino/datagrid-vue` as headless/runtime control
- present `@affino/datagrid-core` as platform/integration API
- move enterprise-heavy namespaces and guarantees out of first-use docs
- add small “recipes” and “when to use” guidance instead of renaming or removing public APIs

No broad API rewrite is recommended.

## 1. Top Confusing Concepts

| Rank | Concept | Why it confuses external engineers | Smallest simplification |
| ---: | --- | --- | --- |
| 1 | Three package layers: core, Vue, Vue app | Users do not know whether to import `DataGrid`, `useDataGridRuntime`, or `createDataGridApi`. | Add a first-use decision table: app component, headless runtime, core platform API. |
| 2 | Stable root of `@affino/datagrid-vue` includes many integration primitives | The stable entrypoint doc lists runtime, overlays, context, selectors, a11y, pivot utilities, and settings before explaining who needs them. | Split stable docs into “common app path” and “stable integration primitives”. |
| 3 | `DataGridApi` namespace count | `lifecycle/rows/data/columns/view/pivot/selection/transaction/compute/diagnostics/meta/policy/plugins/state/events` feels enterprise-heavy for first use. | Add a “beginner subset” table: rows, columns, view, selection, state, events. |
| 4 | `rows` vs `data` namespaces | The distinction is architecturally useful but not intuitive from the namespace list. | Document a one-line rule: `rows` is row model operations; `data` is datasource/backpressure transport. |
| 5 | Selection vs row selection | Docs mention `selection`, `rowSelection`, `row-selection:changed`, `rowSelectionState`, and selection summaries. | Add a stable selection terminology table: cell/range selection, row-selection checkbox state, selection events. |
| 6 | `patch`, `applyEdits`, `transaction.apply`, `view.reapply` | Multiple mutation routes appear early, each with different semantics. | Add “which mutation API should I call?” recipe. |
| 7 | `capabilities` guard model | Runtime capability guards are good, but they look like low-level infrastructure to beginners. | Move to advanced/platform section; app docs should expose capability-driven behavior through props/recipes. |
| 8 | State restore terms | `state.get/set`, migration hooks, viewport opt-in, restore order, row anchors, scroll fallback appear together. | Provide one simple saved-view recipe before full restore semantics. |
| 9 | `main-thread`, `worker-owned`, `server-side` modes | Mode language appears before an app user understands normal usage. | Start with `DataGrid` local rows, then “promote when needed” decision table. |
| 10 | `advanced` means several things | `advanced-filter` is an app feature, while `/advanced` is a power-user entrypoint. | Clarify terminology: “advanced filter is stable app UX; `/advanced` import path is power-user API.” |

## 2. API Surfaces That Feel Too Enterprise-Heavy For Beginners

These APIs are useful, but should not be presented in first-use docs as primary concepts.

| Surface | Current issue | Recommendation |
| --- | --- | --- |
| `api.lifecycle.*` | `runExclusive`, `whenIdle`, and lifecycle transitions feel like platform internals. | Keep stable, but position under “platform/runtime coordination”. |
| `api.compute.*` | Compute mode switching is relevant to worker/runtime integration, not basic app usage. | Move to runtime/advanced recipes. |
| `api.diagnostics.*` | Diagnostics are valuable, but beginner users do not need them to render or edit a grid. | Keep in observability docs and enterprise/tooling messaging. |
| `api.meta.*` | API/protocol versions matter in multi-runtime integrations. | Move below basic API recipes. |
| `api.policy.*` | Policy is not explained in beginner terms. | Document only in platform API reference unless app-level policy props exist. |
| `api.plugins.*` | Plugin lifecycle is powerful but raises complexity early. | Keep out of first 5-minute path; add plugin guide separately. |
| `api.capabilities` | Important guard layer, but reads like framework plumbing. | Introduce after users reach runtime APIs. |
| `@affino/datagrid-vue` selectors/context/a11y exports | Stable but adapter-oriented, not app-oriented. | Group as “testing, integration, and custom renderer helpers”. |
| `DataGridModuleHost` | Useful for external toolbar ownership, but sounds like a plugin platform. | Document as toolbar rendering helper, not a module framework. |
| `render-mode` | Already described as advanced/internal-oriented in app README. | Keep out of stable beginner docs. |

## 3. Naming Inconsistencies

| Area | Inconsistency | Impact | Proposed action |
| --- | --- | --- | --- |
| App package recommendation | Feature catalog lists `@affino/datagrid`; repo/package docs point to `@affino/datagrid-vue-app`. | Users may install or search for the wrong package. | Remove or mark `@affino/datagrid` as planned if not published. |
| Row identity | Examples use `id` in some places and `rowId` in others. | Users may not know canonical row identity shape. | Recommend `rowId` in beginner app docs; document accepted server raw-row shape separately. |
| Selection terminology | `selection`, `rowSelection`, `row-selection`, `rowSelectionState`, `selectedRows`. | Selection concepts blur together. | Add glossary and event/prop mapping. |
| Runtime APIs | `useDataGridRuntime`, `createDataGridVueRuntime`, `createGrid`, `useAffinoGrid`. | Too many equivalent-looking runtime entrypoints. | Add “preferred first runtime API” guidance; list others as compatibility/integration primitives. |
| Editing APIs | `patch`, `patchRows`, `applyEdits`, `transaction.apply`, `reapply`, `refresh`. | Users cannot infer correct operation by name alone. | Add mutation decision table. |
| Advanced wording | App feature `advancedFilter` conflicts semantically with `/advanced` entrypoint. | “Advanced” can mean stable UX or unstable power-user API. | Rename docs language to “power-user entrypoints” when discussing `/advanced`. |
| Server row models | `dataSourceBackedRowModel` vs `serverBackedRowModel`. | Users may choose compatibility path for enterprise server usage. | Make `createDataSourceBackedRowModel` the recommended server path everywhere. |
| Column input/state | `DataGridColumnDef`, `DataGridColumnInput`, `DataGridColumnState`, `initialState`. | Correct but abstract for beginners. | Beginner examples should show `key`, `label`, `initialState.width`; full type split in reference. |

## 4. Areas Where Too Many Concepts Appear Too Early

### `docs/datagrid-vue-stable-entrypoint.md`

The stable surface list comes before the reader has a clear job-based map. It includes low-level stable primitives that are valid public APIs but not beginner APIs.

Recommended order:

1. If you want a ready grid, use `DataGrid` from `@affino/datagrid-vue-app`.
2. If you need runtime ownership, use `useDataGridRuntime` from `@affino/datagrid-vue`.
3. If you need custom renderer plumbing, then read stable selectors/context/overlay APIs.
4. If you need interaction internals, use `/advanced` docs.

### `docs/datagrid-grid-api.md`

The namespace list and key semantics are accurate but dense. It introduces capability guards, transactions, compute, diagnostics, meta, policy, plugins, event ordering, reentrancy, and service binding in one page.

Recommended order:

1. What `DataGridApi` is for.
2. Beginner stable subset.
3. Common recipes.
4. Full namespace reference.
5. Runtime guarantees and advanced/platform concerns.

### `docs/datagrid-feature-catalog.md`

The feature matrix starts at API/event/state internals before app UX. For external adoption, the first rows should be scenario-oriented.

Recommended order:

1. “Choose by scenario.”
2. “Start with these packages.”
3. App-facing capabilities.
4. Runtime/headless capabilities.
5. Backend/server capabilities.
6. Full matrix.

### `docs/datagrid-migration-guide.md`

It is useful for migration but not a first-use doc. It should not be linked as a primary external adoption path unless the user is migrating from legacy code.

## 5. Stable Vs Advanced Separation Gaps

| Gap | Why it matters | Proposed clarification |
| --- | --- | --- |
| `@affino/datagrid-vue` root is stable but includes integration primitives | External users may treat every stable export as beginner-recommended. | Stable does not mean beginner. Add “stable integration API” vs “starter API”. |
| `@affino/datagrid-vue/app` and `./app/worker` are classified advanced integration surfaces | Their names sound app-level and possibly user-facing. | Document as adapter/app assembly entrypoints, not the public app component path. |
| `@affino/datagrid-vue-app` feature subpaths are stable | Feature subpaths such as `advanced-filter` include “advanced” in the name. | Say these are stable optional app modules; “advanced” describes feature complexity, not tier. |
| `@affino/datagrid-core/advanced` contains viewport controller and transaction service | Some advanced APIs are needed by adapter authors and custom renderers. | Define audience: app users should avoid; adapter/custom-renderer authors may use. |
| `DataGridModuleHost` public status | App README exposes it, while boundary doc says not to expose it as generic plugin platform. | Document as stable toolbar-host helper with narrow purpose. |
| `api.plugins.*` stable facade | Plugin API stable status may imply plugin platform is beginner-ready. | Position as stable extension API for platform users, not first-use app API. |

## 6. Proposed Simplifications Without Reducing Architecture Quality

### Additive docs and examples first

Do not rename or remove stable APIs as the first move. The architecture is coherent; the adoption issue is ordering and framing.

Recommended additive simplifications:

1. Add `docs/datagrid-api-start-here.md`.
2. Add beginner subset tables to `datagrid-grid-api.md`.
3. Add runtime-entrypoint decision table to `datagrid-vue-stable-entrypoint.md`.
4. Add mutation recipe table.
5. Add selection terminology table.
6. Add package map cleanup.
7. Move enterprise/platform-heavy concepts below common recipes.

### Beginner API subset for docs

Suggested first stable API subset:

| Need | API |
| --- | --- |
| Render app grid | `DataGrid` from `@affino/datagrid-vue-app` |
| Define columns | `columns` prop with `key`, `label`, `initialState` |
| Provide local rows | `rows` prop using stable `rowId` |
| Persist view | `v-model:state`, `getSavedView`, `applySavedView` |
| Enable row selection | `rowSelection` / `rowSelectionState` |
| Use runtime | `useDataGridRuntime` |
| Read API | `useGridApi` or component ref, depending on app path |
| Server data | `createDataSourceBackedRowModel` + `createAffinoDatasource` |

### `DataGridApi` common recipe table

Suggested recipes:

| Task | Preferred API |
| --- | --- |
| Get row count | `api.rows.getCount()` |
| Read projected rows | `api.rows.getProjectedRows()` |
| Patch values | `api.rows.patch(...)` |
| Apply user edits | `api.rows.applyEdits(...)` |
| Recompute view after edit | `api.view.reapply()` |
| Save state | `api.state.get()` |
| Restore state | `api.state.set(...)` |
| Listen to events | `api.events.on(...)` |
| Summarize selection | `api.selection.summarize(...)` |
| Scroll to a cell | `api.view.scrollToCell(...)` |

### Mutation decision table

| Use case | API | Notes |
| --- | --- | --- |
| Backend/app has new row values | `api.rows.patch(...)` | Low-level row patch with explicit policy flags. |
| User edit flow | `api.rows.applyEdits(...)` | Uses edit-oriented semantics and optional reapply. |
| Multiple row operations as one event cycle | `api.rows.batch(...)` | Coalesces facade event cycle. |
| Undo/redo or structured mutation | `api.transaction.apply(...)` | Advanced/transactional path. |
| Recompute sort/filter/group without data mutation | `api.view.reapply()` | Projection only. |

### Selection terminology table

| Term | Meaning | Where used |
| --- | --- | --- |
| Cell/range selection | Active cell or rectangular ranges. | `api.selection`, fill, clipboard. |
| Row selection | Checkbox/full-row selection model. | `rowSelection`, `rowSelectionState`, row-selection events. |
| Selection summary | Aggregates over selected cells/rows. | `api.selection.summarize(...)`. |
| Selected row data | Projected selected row payloads. | row-selection APIs/events. |

### Tier wording simplification

Use this wording consistently:

- Stable: semver-safe public API.
- Starter: recommended first-use subset of stable API.
- Power-user: advanced entrypoints for custom renderers/adapters/runtime ownership.
- Internal: package implementation details, not for apps.

This avoids implying that all stable exports are equally beginner-facing.

## Smallest Possible Slice Roadmap

| Priority | Slice | Change | Migration risk | Semver safety |
| ---: | --- | --- | --- | --- |
| 1 | API start-here doc | Add `docs/datagrid-api-start-here.md` with package decision table and starter API subset. | None; docs-only. | Safe. |
| 2 | Vue stable entrypoint reframe | Add “which import should I use?” before stable export inventory. | None; docs-only. | Safe. |
| 3 | Grid API recipe layer | Add beginner subset and common recipes before full namespace list. | None; docs-only. | Safe. |
| 4 | Package map cleanup | Remove/mark `@affino/datagrid` if unpublished; clarify `vue-app` as default. | Low if docs only; medium if package is planned but not ready. | Safe if no export/package changes. |
| 5 | Selection terminology cleanup | Add glossary and align event/prop docs. | None; docs-only. | Safe. |
| 6 | Mutation API decision table | Add `patch` vs `applyEdits` vs `transaction` vs `reapply` guidance. | None; docs-only. | Safe. |
| 7 | Stable vs power-user wording | Replace confusing “advanced” prose where it means entrypoint tier, without renaming feature APIs. | None; docs-only. | Safe. |
| 8 | App README public-vs-advanced table | Clarify stable app props/ref helpers, feature subpaths, `DataGridModuleHost`, `render-mode`, and internal hooks. | None; docs-only. | Safe. |
| 9 | Optional additive convenience aliases | Only if repeated confusion persists, add alias helpers or wrapper recipes without removing existing APIs. | Low-medium; can increase surface area. | Minor release if new exports; requires API report update. |
| 10 | Deprecation cleanup proposal | If a stable name is genuinely harmful, propose deprecation window before removal. | Medium-high. | Requires semver-major for removal; deprecation can be minor if non-breaking. |

## Migration Risk

### Low-risk changes

- Reordering documentation.
- Adding “starter subset” docs.
- Adding recipes.
- Adding terminology tables.
- Clarifying that some stable APIs are integration APIs, not beginner APIs.
- Clarifying `@affino/datagrid-vue-app` as the default app entry.

### Medium-risk changes

- Changing package maps if `@affino/datagrid` is planned but not yet published.
- Adding new public convenience exports, because they become part of the stable API report.
- Reclassifying an entrypoint tier, because existing consumers may rely on the current documented tier.

### High-risk changes

- Renaming stable exports.
- Removing stable exports.
- Moving root exports into `/advanced`.
- Changing `DataGridApi` namespace semantics.
- Changing row identity behavior.
- Changing edit/reapply defaults.

No high-risk API change is recommended for the current slice.

## Semver Safety Concerns

- Any new root export in `@affino/datagrid-core`, `@affino/datagrid-vue`, or `@affino/datagrid-vue-app` must update API inventory and declaration reports.
- Moving a public export from stable root to `/advanced` is a breaking change unless a compatibility export remains.
- Renaming `advancedFilter` for terminology clarity would be breaking and is not worth it; solve with docs wording.
- Removing `createGrid` or `useAffinoGrid` from stable docs without removing exports is safe, but marking them deprecated needs migration notes.
- Any change to `DataGridApi` namespace names is semver-major.
- Adding beginner convenience wrappers is semver-minor but increases long-term API maintenance burden.
- Changing row identity recommendations in docs is safe; changing accepted row identity shape is semver-major and should not be done.
- Changing edit defaults such as Excel-like reapply behavior is behaviorally breaking.
- Changing `@affino/datagrid-vue-app` feature subpath status requires migration guide updates.

## Recommended Non-Breaking Wording Changes

### Package Decision

Use this wording in beginner docs:

> Start with `DataGrid` from `@affino/datagrid-vue-app` for normal Vue apps. Use `@affino/datagrid-vue` when you need runtime ownership. Use `@affino/datagrid-core` when you are building platform integrations or custom runtime behavior.

### Stable vs Beginner

> Stable means semver-safe. It does not mean every stable export is part of the beginner path.

### Advanced Entrypoints

> `/advanced` entrypoints are for power users building custom renderers, adapters, or interaction plumbing. App teams should prefer `@affino/datagrid-vue-app` unless they explicitly need runtime ownership.

### Selection

> Cell/range selection and row selection are related but separate models. Use `api.selection` for cell/range workflows and `rowSelection` / `rowSelectionState` for checkbox/full-row selection.

### Mutation APIs

> Use `applyEdits` for user edit flows, `patch` for external row updates, `batch` for coalesced row changes, `transaction.apply` for structured undo/redo-style mutations, and `view.reapply` when data did not change but projection should recompute.

## Minimal Documentation Slices

### Slice A: `docs/datagrid-api-start-here.md`

Contents:

- package decision table
- starter API subset
- stable vs starter vs power-user terms
- links to full API refs

### Slice B: `docs/datagrid-grid-api.md`

Add near top:

- “Common tasks” table
- mutation decision table
- beginner namespace subset

Move lower:

- capability contract
- concurrency model
- plugin safety model
- service binding notes

### Slice C: `docs/datagrid-vue-stable-entrypoint.md`

Add near top:

- “Which import should I use?” table
- “Stable does not mean beginner” note
- “Power-user entrypoints” wording

Move lower:

- full stable surface inventory
- removed legacy aliases
- contract guard details

### Slice D: `docs/datagrid-feature-catalog.md`

Add before the matrix:

- scenario-based API/package map
- app-facing vs runtime-facing capability grouping

### Slice E: `packages/datagrid-vue-app/README.md`

Add:

- public-vs-advanced table for props/ref helpers/feature subpaths
- `DataGridModuleHost` narrow-purpose note
- `render-mode` advanced warning near first mention

## Validation Checklist

- A new app engineer can identify `@affino/datagrid-vue-app` as the first import within 30 seconds.
- A runtime integrator can identify `useDataGridRuntime` as the first `@affino/datagrid-vue` API.
- A platform engineer can identify `DataGridApi` as core/platform API, not required for app component usage.
- Docs clearly distinguish stable, starter, power-user, and internal.
- Docs explain `advancedFilter` is stable app UX while `/advanced` is a power-user import path.
- Mutation recipes distinguish `patch`, `applyEdits`, `batch`, `transaction.apply`, and `view.reapply`.
- Selection terminology distinguishes cell/range selection from row selection.
- Package maps do not recommend unpublished packages as primary entrypoints.
- No public API export changes are made in docs-only slices.
- If new exports are added later, API inventory and declaration reports are refreshed with migration notes.
