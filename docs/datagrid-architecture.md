# DataGrid Architecture and Package Boundaries

Status: maintained public documentation.
Scope: `@affino/datagrid-core`, `@affino/datagrid-orchestration`, `@affino/datagrid-vue`, `@affino/datagrid-vue-app`

## Goals

- Keep core runtime framework-agnostic and deterministic under heavy scroll/select workloads.
- Keep Vue package as a thin adapter layer, not a second runtime.
- Keep public API narrow and semver-protected while internals continue to evolve.

## Package Boundaries

| Package | Owns | Must not own |
| --- | --- | --- |
| `@affino/datagrid-core` | types, settings adapter contract, runtime signals, viewport controllers, virtualization math, selection geometry/contracts | Vue refs/watchers, SFC rendering concerns, Pinia store details |
| `@affino/datagrid-orchestration` | reusable pointer, fill, range move, header resize, keyboard, context menu, viewport blur, scroll, and telemetry lifecycles | row-model mutation policy, SFC rendering, app-specific history/server fill decisions |
| `@affino/datagrid-vue` | Vue composables, app-controller wiring, adapter lifecycle (`init/sync/teardown/diagnostics`), Pinia settings bridge, app-level interaction diagnostics, adapter materialization from canonical runtime windows | canonical virtualization math, duplicate coordinate conversion logic, core business invariants |
| `@affino/datagrid-vue-app` | mounted table stage, DOM event binding, native body viewport, viewport materialization, header/pinned pane wiring, overlays, focus surfaces, editors, sandbox-shaped UX composition | core viewport range/clamp math, model mutation primitives, stable public core API ownership |

## Dependency Direction

- `datagrid-core` has no dependency on Vue.
- `datagrid-orchestration` is framework-light shared interaction infrastructure.
- `datagrid-vue` depends on `datagrid-core` and consumes core contracts.
- `datagrid-vue-app` composes `datagrid-vue` app hooks and orchestration-backed behavior into the mounted stage.
- Adapter boundary normalizes host input before runtime; core row-node and column contracts stay canonical.

## Stable Public API

- Core stable surface: `packages/datagrid-core/src/public.ts`
- Vue stable surface: `packages/datagrid-vue/src/public.ts`
- Orchestration root: advanced adapter-internal surface documented in `docs/internal/reference/datagrid-orchestration-public-contract.md`; it is not an app-facing stable API.
- Rule: stable app consumers import only stable package roots. Advanced adapter consumers may use documented advanced entrypoints, including the orchestration root, when they accept that tier's compatibility contract.
- Formula-free source-row consumers may import `@affino/datagrid-core/client-row-store`; it owns row identity, source mutations, and subscriptions only. Projection and formula execution remain separate opt-in layers.
- Projection composition may import `@affino/datagrid-core/client-row-projection`; it owns stage scheduling and cache policy, while consumers provide stage handlers.
- Projection executors are available independently from `@affino/datagrid-core/client-row-projection/filter`, `/sort`, `/pagination`, `/visible`, `/group`, `/pivot`, and `/aggregate`. The sort entry exposes a tree-aware executor and a flat-only executor; the latter avoids tree filter resolution. The visible entry similarly exposes a flat path without pivot identity handling. The `/basic` convenience barrel groups the flat stages; consumers that cannot tree-shake should use individual entries.
- Sort cache sizing is available from `@affino/datagrid-core/client-row-projection/sort-cache` without constructing dependency tracking.
- Flat projection custom comparator registry construction is optional at `@affino/datagrid-core/client-row-projection/comparator-registry`.
- `@affino/datagrid-core/client-row-projection/model` composes the row store with flat filter/sort/pagination projection. It is a smaller alternative for consumers that do not need group, pivot, aggregate, or formula behavior.
- The stable core root no longer exports the deprecated `createClientRowModel` name. Full-featured consumers use `@affino/datagrid-core/advanced-client-row-model`; flat and source-only consumers can choose smaller model and store subpaths.
- Advanced filters use `DataGridFilterSnapshot.advancedExpression` as the only contract. Settings snapshots alias the same row-model filter type, so persistence, adapters, and projection share one shape.

## Runtime Pipeline (Canonical)

1. Input events enter adapter/composables.
2. Adapter converts input into core-safe contracts.
3. Core owns canonical viewport state (virtualization range, overscan, clamp).
4. Core emits deterministic geometry for selection/overlay.
5. Vue layer materializes and renders view state, without re-owning canonical virtualization/clamp rules.

Adapter materialization note:

- Core owns canonical viewport virtualization, range math, overscan, and clamp contracts.
- Vue/app code may sample DOM scroll/size, schedule rAF commits, retain visible rows, derive render spacers, and materialize rows/columns for the mounted table stage.
- That adapter work is render-window materialization from canonical runtime/model state; it must not become a second authoritative virtualization runtime.

Terminology:

- Projection = logical dataset transformation (`filter`, `sort`, `group`, `pivot`, `tree`, `aggregation`).
- Materialization = render-oriented realization of projected/runtime state into rows, columns, overlays, spacers, and mounted DOM.
- Runtime state = canonical state owned by core services. View materialization may cache or derive from runtime state, but must not fork runtime authority.

## Interaction Ownership

The mounted stage has one owner per active gesture. `packages/datagrid-vue/src/app/dataGridInteractionOwner.ts` is the current internal diagnostic contract for active owner snapshots. It is used to keep drag selection, fill, range move, column resize, and row resize mutually exclusive in the app path.

| Area | Owner |
| --- | --- |
| Native body scroll | `@affino/datagrid-vue-app` stage viewport runtime, backed by `@affino/datagrid-vue` app viewport sync |
| Canonical viewport math, virtualization range, overscan, clamp | `@affino/datagrid-core` viewport services |
| DOM scroll sampling, rAF viewport commits, render-window materialization | `@affino/datagrid-vue` app viewport sync and `@affino/datagrid-vue-app` table stage |
| Drag selection, fill, range move app state | `@affino/datagrid-vue` app interaction controller |
| Shared interaction lifecycle helpers | `@affino/datagrid-orchestration` |
| Column resize lifecycle | `@affino/datagrid-orchestration` with `@affino/datagrid-vue` app wrapper |
| Row resize lifecycle | `@affino/datagrid-vue` app row sizing |
| DOM binding, panes, overlays, editor/focus surfaces | `@affino/datagrid-vue-app` table stage |
| Keyboard command routing | `@affino/datagrid-orchestration` command router, wired by `@affino/datagrid-vue` |
| Context menu routing | `@affino/datagrid-orchestration` router and `@affino/datagrid-vue-app` stage handlers |

Boundary rules:

- Do not make header, pinned panes, or overlays independent scroll owners; they route through the body viewport.
- Do not add a second app-level interaction manager when an orchestration utility already owns the lifecycle shape.
- Only core may own canonical runtime state. Vue/app layers may cache, project, or materialize state, but must not become a second runtime authority.
- Keep touch body-cell gestures scroll-first; touch selection, fill, range move, and resize must start from explicit touch affordances or documented mode transitions.
- Keep active-owner diagnostics internal unless a public diagnostics API is separately approved.

## Selection Ownership

Selection has separate logical state machines for committed row selection, cell ranges, row-selection interaction state, and grid focus. Core owns framework-independent state and transition rules; orchestration owns active gesture lifecycle; Vue packages translate host events and materialize presentation.

| Selection area | Owner |
| --- | --- |
| Normalized cell ranges, active range index, active cell shape | `@affino/datagrid-core` selection helpers and snapshot contracts |
| App selection snapshot, anchor, virtual-selection metadata, aggregate labels | `@affino/datagrid-vue` app selection composables |
| Committed selected row ids and versioned immutable snapshots | `@affino/datagrid-core` row-selection model |
| Row-selection anchor, extent, modifier rules, and preview/commit transitions | `@affino/datagrid-core` row-selection interaction model |
| Active pointer drag-session lifecycle and exclusive gesture lease | `@affino/datagrid-orchestration` |
| DOM event normalization and lifecycle subscriptions | `@affino/datagrid-vue` adapters |
| Row-header policy, checkbox controls, focus surfaces, and selection materialization | `@affino/datagrid-vue-app` table stage |
| Business policy and actions over selected records | Consumer application |
| Pointer gesture arbitration, row-selection preview routing, fill, range-move, edit handoff | `@affino/datagrid-vue` app interaction controller with orchestration lifecycle helpers |
| DOM focus restore, selected cell classes, overlays, handles, editor mount points | `@affino/datagrid-vue-app` table stage |
| Clipboard source ranges and local mutation planning | `@affino/datagrid-vue` app clipboard wiring with orchestration clipboard helpers |

The app integration keeps existing cell-range row-header behavior as the
default. Consumers opt into record selection with `rowHeader.action:
"select-records"`; `"none"` disables row-header selection. The adapter resolves
drag targets and ranges against the logical projection, publishes preview to
the existing row selection visuals, and writes one committed result through
`api.rowSelection`. See the [row-selection model reference](reference/datagrid-row-selection-model.md)
for the supported gestures and configuration.

The row-header record-selection path is integrated across these layers. Core
provides versioned committed snapshots, immutable set transitions, separate
anchor/extent state, modifier-aware click/range transitions, and
preview/commit/cancel session primitives. Its projection resolver skips
synthetic group rows and blocks incomplete unloaded segments. Orchestration
owns the framework-independent drag-session controller and exclusive pointer
lease. The Vue adapter arbitrates pointer gestures and coordinates autoscroll;
the app stage resolves logical projection rows, publishes selection previews,
and commits the resulting row IDs. Projection or selection revision conflicts
cancel an active session. `rowHeader.action` keeps cell-range row-header
behavior as its default, with opt-in record selection and an explicit disabled
mode.

Selection transition rules:

- The committed selection snapshot is the logical source of truth; rendered overlays and classes are derived materialization.
- DOM focus may follow the active cell, but it must not become the source of truth for selected ranges or active cell identity.
- Editing, fill, and range move are temporary owners that must either commit/cancel before selection changes or explicitly hand control back to selection.
- Row selection and cell-range selection are separate state machines. Shared gestures must choose one target before mutating state.
- Projection and cache changes must use an explicit invalidation policy for active cell, ranges, row selection, virtual metadata, clipboard ranges, fill preview, and range-move preview.
- Unloaded rows, placeholders, and stale projection identity are operation states, not rendering accidents; local materialized operations must block or delegate instead of guessing.

## Hard Invariants

- One owner for scroll transform synchronization.
- One active interaction owner for pointer-driven drag, fill, range move, resize, and touch pan flows.
- One committed selection snapshot as the source of truth for cell ranges and active cell identity.
- One explicit invalidation policy for projection/cache changes that affect selection-related state.
- One canonical pin contract in runtime: `pin = left | right | none`.
- One coordinate conversion contract for `world`, `viewport`, and `client` spaces.
- Horizontal virtualization clamp and update path stays pure and deterministic.

## Core Modules to Keep Stable

- Runtime: `packages/datagrid-core/src/runtime/dataGridRuntime.ts`
- Viewport: `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
- Horizontal clamp: `packages/datagrid-core/src/viewport/dataGridViewportHorizontalClamp.ts`
- Coordinate conversion: `packages/datagrid-core/src/selection/coordinateSpace.ts`

## Vue Adapter Modules to Keep Thin

- Lifecycle boundary: `packages/datagrid-vue/src/adapters/adapterLifecycle.ts`
- Headless adapter: `packages/datagrid-vue/src/adapters/selectionHeadlessAdapter.ts`
- Vue bridge: `packages/datagrid-vue/src/adapters/selectionControllerAdapter.ts`
- Pin normalization: `packages/datagrid-vue/src/adapters/columnPinNormalization.ts`

## Quality and Operations References

- Pipeline and closure log: `docs/archive/datagrid/checklists/datagrid-engine-9.5-pipeline-checklist.md`
- Quality gates: `docs/datagrid-quality-gates.md`

                          ┌──────────────────────────┐
                          │        UI Layer          │
                          │  Vue / React Adapter     │
                          │                          │
                          │  DataGrid Component      │
                          │  DOM Rendering           │
                          │  Viewport Materialization│
                          │  Cell Rendering          │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │      Runtime State       │
                          │                          │
                          │  Selection               │
                          │  Editing                 │
                          │  Expansion               │
                          │  Pagination              │
                          │  Viewport                │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │      Materialization     │
                          │                          │
                          │  Computed Overlay        │
                          │  Row Assembly            │
                          │  Snapshot Restore        │
                          │  Undo / Redo             │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │      Projection Engine   │
                          │                          │
                          │  Filter                  │
                          │  Sort                    │
                          │  Group                   │
                          │  Pivot                   │
                          │  Tree                    │
                          │  Aggregation             │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │       Compute Engine     │
                          │                          │
                          │  Compute Runtime         │
                          │  Compute Modules         │
                          │                          │
                          │   • Formula Module       │
                          │   • Aggregation Module   │
                          │   • Pivot Module         │
                          │   • Custom Modules       │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │     Dependency Graph     │
                          │                          │
                          │  Field Dependencies      │
                          │  Computed Dependencies   │
                          │  Meta Dependencies       │
                          │                          │
                          │  DAG Execution Order     │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │      Formula Engine      │
                          │                          │
                          │  Parser                  │
                          │  AST                     │
                          │  Compiler                │
                          │  JIT / AST Evaluator     │
                          │  Columnar Kernels        │
                          │  Diagnostics / Explain   │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │        Row Source        │
                          │                          │
                          │  Client Rows             │
                          │  Server DataSource       │
                          │  Streaming Updates       │
                          │                          │
                          └──────────────────────────┘
