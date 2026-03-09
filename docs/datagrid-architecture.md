# DataGrid Architecture and Package Boundaries

Baseline date: `2026-02-07`
Scope: `@affino/datagrid-core`, `@affino/datagrid-vue`

## Goals

- Keep core runtime framework-agnostic and deterministic under heavy scroll/select workloads.
- Keep Vue package as a thin adapter layer, not a second runtime.
- Keep public API narrow and semver-protected while internals continue to evolve.

## Package Boundaries

| Package | Owns | Must not own |
| --- | --- | --- |
| `@affino/datagrid-core` | types, settings adapter contract, runtime signals, viewport controllers, virtualization math, selection geometry/contracts | Vue refs/watchers, SFC rendering concerns, Pinia store details |
| `@affino/datagrid-vue` | Vue composables, SFC composition, adapter lifecycle (`init/sync/teardown/diagnostics`), Pinia settings bridge | duplicate virtualization math, duplicate coordinate conversion logic, core business invariants |

## Dependency Direction

- `datagrid-core` has no dependency on Vue.
- `datagrid-vue` depends on `datagrid-core` and consumes core contracts.
- Adapter boundary normalizes legacy input before runtime (example: pinning legacy fields to canonical `pin`).

## Stable Public API

- Core stable surface: `packages/datagrid-core/src/public.ts`
- Vue stable surface: `packages/datagrid-vue/src/public.ts`
- Rule: external consumers import only from package root.

## Runtime Pipeline (Canonical)

1. Input events enter adapter/composables.
2. Adapter converts input into core-safe contracts.
3. Core computes viewport state (scroll, virtualization windows, clamp).
4. Core emits deterministic geometry for selection/overlay.
5. Vue layer renders view state, without re-owning geometry/scroll rules.

## Hard Invariants

- One owner for scroll transform synchronization.
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
                          │  Viewport Virtualization │
                          │  Cell Rendering          │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │        View State         │
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
                          │  Computed Overlay       │
                          │  Row Assembly           │
                          │  Snapshot Restore       │
                          │  Undo / Redo            │
                          └────────────┬─────────────┘
                                       │
                                       │
                          ┌────────────▼─────────────┐
                          │      Projection Engine    │
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
                          │       Compute Engine      │
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
                          │     Dependency Graph      │
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
                          │      Formula Engine       │
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
                          │        Row Source         │
                          │                          │
                          │  Client Rows             │
                          │  Server DataSource       │
                          │  Streaming Updates       │
                          │                          │
                          └──────────────────────────┘
