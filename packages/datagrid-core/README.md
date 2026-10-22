# @affino/datagrid-core

Framework-agnostic data grid core.

## Documentation

- [Core documentation index](./docs/README.md)
- [Unified Grid API](./docs/grid-api.md)
- [API method reference](./docs/reference/grid-api-methods.md)
- [Framework-independent example](./docs/examples/local-data/README.md)

## Canonical Feature Catalog

Single source of truth for platform capabilities:

- [DataGrid Feature Catalog](https://github.com/affinio/datagrid/blob/main/docs/datagrid-feature-catalog.md)

## Formula engine boundary

Base formula APIs now have a dedicated package boundary:

- community: [@affino/datagrid-formula-engine](https://github.com/affinio/datagrid/tree/main/packages/datagrid-formula-engine#readme)
- boundary doc: [datagrid-formula-engine-package-ownership.md](https://github.com/affinio/datagrid/blob/main/docs/datagrid-formula-engine-package-ownership.md)

Keep row-model orchestration and formula integration inside `@affino/datagrid-core`.
Use `@affino/datagrid-formula-engine` for formula parsing/compile/graph APIs.

## Modular client rows

`@affino/datagrid-core/client-row-store` exposes a formula-free source-row store for consumers that need canonical row identity, mutation, and subscriptions without client projection or formula execution. Import it directly to keep the heavier row-model runtime out of that consumer bundle:

```ts
import { createClientRowStore } from "@affino/datagrid-core/client-row-store"
```

The stable core root no longer exports the full client model. Tree, grouping, pivot, and formula workloads use `@affino/datagrid-core/advanced-client-row-model`:

```ts
import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"
```

For simple flat rows, use `@affino/datagrid-core/client-row-projection/model`; source-only consumers can use `client-row-store`.

Consumers that need projection scheduling can import `@affino/datagrid-core/client-row-projection`. It provides the projection stage engine, orchestrator, stage graph, and cache policy without constructing a full client row model. The stage handlers are supplied by the consumer, so computed/formula execution can remain outside the projection layer.

For direct composition, stage executors have separate subpaths: `@affino/datagrid-core/client-row-projection/filter`, `/sort`, `/pagination`, `/visible`, `/group`, `/pivot`, and `/aggregate`. The `/sort` entry includes both the tree-aware `runSortProjectionStage` and the flat-only `runFlatSortProjectionStage`; the latter avoids tree filter resolution. Likewise, `/visible` exports `runFlatVisibleProjectionStage` without pivot identity handling. The `/basic` entry remains a convenience barrel for filter, sort, pagination, and visible stages. Import individual subpaths when the consumer cannot tree-shake unused named exports; runtimes such as tree projection, pivot, and aggregation are supplied explicitly.

Consumers that need only sort-value cache sizing can import `createDataGridSortValueCachePolicy` from `@affino/datagrid-core/client-row-projection/sort-cache`. It shares the standard performance-mode limits without constructing the projection dependency graph.

Custom comparator support is opt-in for the flat model: build a registry with `createDataGridComparatorRegistry` from `@affino/datagrid-core/client-row-projection/comparator-registry` and pass that registry as `comparatorRegistry`. The model does not bundle registry construction when custom comparators are unused.

For a ready flat client model, `@affino/datagrid-core/client-row-projection/model` composes `client-row-store` with filtering, sorting, pagination, and display indexes. It intentionally does not provide grouping, pivoting, aggregation, or formulas. Row payloads are retained by reference; call `refresh()` after in-place payload changes so filters and sort values are recomputed.

## Pivot boundary

Base pivot APIs now also have a dedicated package boundary:

- community: [@affino/datagrid-pivot](https://github.com/affinio/datagrid/tree/main/packages/datagrid-pivot#readme)
- boundary doc: [datagrid-pivot-package-ownership.md](https://github.com/affinio/datagrid/blob/main/docs/datagrid-pivot-package-ownership.md)

Keep row-model orchestration and pivot runtime integration inside `@affino/datagrid-core`.
Use `@affino/datagrid-pivot` for pivot contracts and pure pivot helper APIs.

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
  createAdvancedClientRowModel,
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

`createAdvancedClientRowModel()` supports two update modes:

- `setRows(rows)`:
  - full source replacement.
  - keeps legacy behavior: increments row revision and recomputes filter/sort/group projection.
- `patchRows(updates, options?)`:
  - partial updates by `rowId` (cell-level/streaming updates).
  - defaults are Excel-like (`recomputeSort/filter/group = false`) to keep current view stable during edits.
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

- `filter -> sort -> group -> pivot -> aggregate -> paginate -> visible`

Quick filter is part of the filter model, not a separate global service. Use `filterModel.quickFilter` for grid-wide text filtering; it runs inside the filter stage and therefore invalidates sort/group/pivot/aggregate/pagination/visible results through the normal projection dependency chain. See [DataGrid Quick Filter](https://github.com/affinio/datagrid/blob/main/docs/datagrid-quick-filter.md).

Stage dirty state is propagated through dependencies, and snapshot includes `projection` diagnostics (`version`, `staleStages`) for devtools/integration debugging.
`patchRows` uses field-aware invalidation internally: only stages whose dependency fields intersect patched fields are invalidated.
Projection recompute is dirty-stage driven (not full-pass): blocked stages (`recompute* = false`) run in non-recompute mode for data continuity and remain marked stale until an explicit recompute is allowed.
Projection diagnostics expose cycle vs actual recompute semantics: `version`/`cycleVersion` increase every projection cycle, while `recomputeVersion` increases only when at least one stage actually recomputed.
For `treeData`, set `dependencyFields` to avoid unnecessary regroup/tree projection on unrelated cell patches.

## Effective Filter And Selection Values

When displayed values differ from the raw row payload, keep filters, histogram entries, and selection aggregates aligned with the effective value the user sees.

`createAdvancedClientRowModel(...)` accepts `readFilterCell(rowNode, columnKey)` for value-set filters, advanced-filter predicates, and `getColumnHistogram(...)`:

```ts
const rowModel = createAdvancedClientRowModel({
  rows,
  readFilterCell(rowNode, columnKey) {
    if (columnKey !== "status") {
      return undefined
    }
    return rowNode.data.statusCode === "a" ? "Active" : "Blocked"
  },
})

rowModel.getColumnHistogram("status", { ignoreSelfFilter: true })
```

The same pattern is available for selection aggregates through `readSelectionCell`:

- `api.selection.summarize({ readSelectionCell })`
- `createDataGridSelectionSummary({ ..., readSelectionCell })`

Use this when formula-backed or display-formatted columns should contribute their effective values to `sum`, `min`, `max`, `avg`, and distinct counts instead of the stored raw field.

## Pivot Model (Engine Primitive)

Client row model supports declarative pivot projection via:

- `setPivotModel(pivotSpec | null)`
- `getPivotModel()`

Minimal V1 pivot spec:

```ts
{
  rows: ["team"],
  columns: ["year"],
  values: [{ field: "revenue", agg: "sum" }],
  rowSubtotals: true, // optional
  grandTotal: true,   // optional
}
```

Pivot is executed as a pure projection stage and exposes deterministic runtime pivot columns in snapshot:

- `snapshot.pivotModel`
- `snapshot.pivotColumns`

Current V1 scope/limitations:

- Pivot is flat (projected rows are leaf-like; no pivot expand/collapse yet).
- Optional totals are available: `rowSubtotals` (for multi-level row axis) and `grandTotal`.
- Pivot values are taken from `pivotModel.values` and aggregated inside pivot stage.
  `aggregationModel` group-aggregate stage is bypassed while pivot is active.
- Pivot aggregation uses an incremental state path for `sum/count/countNonNull/avg`
  and falls back to leaf-bucket recompute for other ops (`min/max/first/last/custom`).
- Pivot invalidation is field-aware, but recompute is full-stage (no incremental pivot recompute yet).

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
[datagrid-ag-architecture-acceptance-checklist.md](https://github.com/affinio/datagrid/blob/main/docs/internal/checklists/datagrid-ag-architecture-acceptance-checklist.md).
