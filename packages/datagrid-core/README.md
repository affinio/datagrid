# @affino/datagrid-core

Framework-agnostic data grid core.

## Layer boundaries (Core vs Orchestration vs Adapter)

- Keep in `@affino/datagrid-core`:
  - row/column/filter/sort/group runtime state and deterministic model contracts.
  - snapshot APIs consumed by adapters.
- Keep in `@affino/datagrid-orchestration`:
  - interaction policies (scroll linking, resize guards, recovery loops, selection gestures).
  - reusable orchestration logic that is UI-framework agnostic.
- Keep in adapters (`@affino/datagrid-vue` etc):
  - framework lifecycle, refs/DOM reads-writes, template wiring and presentation concerns.

## API Tiers

### Tier 1: Stable (`@affino/datagrid-core`)

Semver-safe surface for application integrations.

```ts
import {
  createDataGridApi,
  createDataGridCore,
  createClientRowModel,
  createServerBackedRowModel,
} from "@affino/datagrid-core"
```

### Tier 2: Advanced (`@affino/datagrid-core/advanced`)

Power-user APIs (supported, but can evolve faster):

```ts
import {
  createDataGridViewportController,
  createDataGridA11yStateMachine,
  createDataGridTransactionService,
  createDataGridAdapterRuntime,
} from "@affino/datagrid-core/advanced"
```

### Tier 3: Internal (`@affino/datagrid-core/internal`)

Unsafe, no semver guarantees. Use only for local tooling and migrations.

## Naming

Core naming is fully canonicalized to `DataGrid*` across stable, advanced, and internal entrypoints.

## Row Updates: `setRows` vs `patchRows`

`createClientRowModel()` now supports two update modes:

- `setRows(rows)`:
  - full source replacement.
  - keeps legacy behavior: increments row revision and recomputes filter/sort/group projection.
- `patchRows(updates, options?)`:
  - partial updates by `rowId` (cell-level/streaming updates).
  - defaults are backward-compatible (`recomputeSort/filter/group = true`).
  - can disable projection phases for UX stability:
    - `recomputeSort: false`
    - `recomputeFilter: false`
    - `recomputeGroup: false`

```ts
rowModel.patchRows(
  [{ rowId: "r-42", data: { tested_at: "2026-02-21T10:15:00Z" } }],
  { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
)
```

When all recompute flags are disabled, cell values update and snapshot revision changes, but visible row order/filter/group projection may be temporarily stale by design.

Client projection is internally modeled as a stage graph:

- `filter -> sort -> group -> paginate -> visible`

Stage dirty state is propagated through dependencies, and snapshot includes `projection` diagnostics (`version`, `staleStages`) for devtools/integration debugging.
`patchRows` uses field-aware invalidation internally: only stages whose dependency fields intersect patched fields are invalidated.
Projection recompute is dirty-stage driven (not full-pass): blocked stages (`recompute* = false`) run in non-recompute mode for data continuity and remain marked stale until an explicit recompute is allowed.
Projection diagnostics expose cycle vs actual recompute semantics: `version`/`cycleVersion` increase every projection cycle, while `recomputeVersion` increases only when at least one stage actually recomputed.
For `treeData`, set `dependencyFields` to avoid unnecessary regroup/tree projection on unrelated cell patches.

## Deterministic Integration Snapshot

Viewport integration should read deterministic state from controller snapshot API instead of peeking into internal signals or DOM transforms:

```ts
import { createDataGridViewportController } from "@affino/datagrid-core/advanced"

const viewport = createDataGridViewportController({ resolvePinMode })
const snapshot = viewport.getIntegrationSnapshot()

// stable integration fields:
snapshot.virtualWindow
snapshot.visibleRowRange
snapshot.visibleColumnRange
snapshot.pinnedWidth
snapshot.overlaySync
```

`visibleRowRange` / `visibleColumnRange` are legacy mirrors of `virtualWindow` for compatibility.

For imperative adapters, `DataGridViewportImperativeCallbacks` also exposes `onWindow(payload)` with the same `virtualWindow` snapshot.

`getViewportSyncState()` is also available when only sync transform state is needed.

## Pinning Contract (Canonical)

Runtime now treats only one pin state as canonical:
- `column.pin = "left" | "right" | "none"`
- `column.isSystem = true` is always resolved as left-pinned.

Legacy pin fields are not part of the supported contract.

### Migration Guide

Replace legacy fields in column definitions:
- `sticky: "left"` -> `pin: "left"`
- `sticky: "right"` -> `pin: "right"`
- `stickyLeft: true|number` -> `pin: "left"`
- `stickyRight: true|number` -> `pin: "right"`
- `pinned: true|"left"` -> `pin: "left"`
- `pinned: "right"` -> `pin: "right"`
- `lock: "left"|"right"` / `locked: true` -> `pin: "left"|"right"`

## Selection Geometry Spaces

Selection runtime uses one coordinate contract:
- `table/world` space: content coordinates before scroll transform.
- `viewport` space: visible coordinates after applying scroll.
- `client` space: DOM client coordinates (requires viewport origin for conversion).

Core helpers in `src/selection/coordinateSpace.ts` are the canonical conversion path used by overlay/fill/selection adapters.

## Horizontal Virtualization Contract

Horizontal virtualization now uses a deterministic clamp/update path:
- clamp calculation is centralized in `src/viewport/dataGridViewportHorizontalClamp.ts`
- prepare phase is pure (no mutation of input meta)
- stress coverage includes `100k` rows and `500+` columns with pinned left/right mix

## Build/Type Check

- `npm run build` - compile public contract to `dist`
- `npm run type-check` - check only public contract surface

## Roadmap

Execution and quality hardening are tracked in:
`/Users/anton/Projects/affinio/docs/datagrid-ag-architecture-9.5-pipeline-checklist.md`.
