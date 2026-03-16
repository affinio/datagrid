# @affino/datagrid-vue

Vue adapter and headless foundation for `@affino/datagrid-core`.

`@affino/datagrid-vue` is the adapter layer between Vue and the grid engine.
`@affino/datagrid-core` and `@affino/datagrid-orchestration` remain internal dependencies of this package.

If you want a declarative app-facing component, use
[`@affino/datagrid-vue-app`](/Users/anton/Projects/affinio/datagrid/packages/datagrid-vue-app/README.md).

## Canonical Feature Catalog

Single source of truth for platform capabilities:

- [DataGrid Feature Catalog](https://github.com/affinio/affinio/blob/main/docs/datagrid-feature-catalog.md)

## Formula engine boundary

If a Vue app needs direct formula-engine APIs, import them from:

- [@affino/datagrid-formula-engine](/Users/anton/Projects/affinio/datagrid/packages/datagrid-formula-engine/README.md)

Do not import formula compile/graph helpers from `@affino/datagrid-core` directly in new integrations.

## Pivot boundary

If a Vue app needs direct pivot contracts, import them from:

- [@affino/datagrid-pivot](/Users/anton/Projects/affinio/datagrid/packages/datagrid-pivot/README.md)

Do not import pivot contracts from `@affino/datagrid-core` directly in new integrations.

## Runtime mode decision (Main thread vs Worker vs Server-side)

| Scenario | Recommended mode | Why |
| --- | --- | --- |
| Up to ~10k rows, simple table, low patch rate | `main-thread` | Lowest setup complexity, good baseline latency |
| 20k+ rows, interactive editing, heavy sort/group/filter under user actions | `worker-owned` | Keeps UI thread responsive, significantly lower synchronous dispatch cost |
| Very large datasets, remote paging/aggregation, backend-owned querying | `server-side row model` | Moves data shaping and heavy compute to backend, minimizes client memory pressure |

Practical default:

- Start with `main-thread`.
- Switch to `worker-owned` when UI responsiveness under patch pressure becomes the bottleneck.
- Move to `server-side` when dataset size and query shape are primarily backend concerns.

## Feature overview (adapter surface)

Out of the box (through this package):

- Client row model: sorting, filtering, grouping, pagination, viewport range.
- Pivot: row/column/value axes, generated pivot columns, subtotals and grand totals, layout export/import, drilldown.
- Selection/range engine: anchor/focus/range, fill handle, drag-fill, double-click fill-down, drag-move, clipboard workflows.
- Editing flow: patch-based updates, Excel-like freeze/reapply control (`applyEdits`, `reapplyView`, `autoReapply`).
- Context menu and keyboard orchestration primitives.
- Runtime snapshots/revisions for deterministic integration and tests.
- Worker-owned row model support for off-main-thread compute path.
- Server/data-source row model contracts for backend pull/push flows.

## Performance snapshot (how to read it)

Representative pressure benchmark trend from `artifacts/performance/worker-pressure-matrix-scaled`:

- At `20k` rows: worker path reduced end-to-end pressure time by roughly `~5.4x` vs main-thread.
- At `100k` rows: worker path remained ahead at roughly `~1.6x`.
- At `200k` rows (with heavier patch size): worker path remained ahead at roughly `~1.34x`.

Interpretation for integrators:

- Worker mode gives the strongest value when synchronous UI-thread patch dispatch becomes expensive.
- Main-thread can be enough for smaller tables and simpler interaction profiles.
- Server-side model is the next step when data volume/query cost dominates client constraints.

## Stable API (`@affino/datagrid-vue`)

- `createDataGridVueRuntime`
- `useDataGridRuntime`
- `useDataGridSettingsStore`
- `createDataGridSettingsAdapter`
- `buildDataGridOverlayTransform`
- `buildDataGridOverlayTransformFromSnapshot`
- `mapDataGridA11yGridAttributes`
- `mapDataGridA11yCellAttributes`
- `useDataGridContextMenu`
- `DATA_GRID_SELECTORS`
- `DATA_GRID_DATA_ATTRS`
- `dataGridCellSelector`
- `dataGridHeaderCellSelector`
- `dataGridResizeHandleSelector`

Stable selector contract (for parity tests/integration-safe querying):

```ts
import {
  DATA_GRID_SELECTORS,
  dataGridCellSelector,
} from "@affino/datagrid-vue"

const viewportSelector = DATA_GRID_SELECTORS.viewport
const ownerCellSelector = dataGridCellSelector("owner")
```

## App layer (`@affino/datagrid-vue-app`)

Component-facing surface lives in the app package:

- `DataGrid`

`DataGrid` is also the supported out-of-the-box fill-handle integration:

- drag-fill from the selection corner
- double-click fill-down to the last row in the current projection
- post-fill `Series` / `Copy` reapply menu pinned to the visible viewport area

No legacy sugar wrapper is required for this path.

## Spreadsheet Fill Integration For Custom Renderers

If you are building your own renderer instead of using `DataGrid`, use the current app-layer hooks exported from `@affino/datagrid-vue`.

Recommended composition:

- `useDataGridAppSelection` for selection ownership
- `useDataGridAppClipboard` for copy/cut/paste state and fill source matrices
- `useDataGridAppFill` for applying fill ranges with `copy` / `series` behavior
- `useDataGridAppInteractionController` for the integrated pointer/keyboard flow, including fill-handle drag, double-click fill-down, and reapplying the last fill behavior

```ts
import {
  useDataGridAppClipboard,
  useDataGridAppFill,
  useDataGridAppInteractionController,
  useDataGridAppSelection,
} from "@affino/datagrid-vue"
```

Use this path instead of the removed `useAffinoDataGrid*` wrappers.

## Advanced API (`@affino/datagrid-vue/advanced`)

Advanced entrypoint. For new integrations prefer domain entrypoints:

- `@affino/datagrid-vue/advanced/layout`
- `@affino/datagrid-vue/advanced/pointer`
- `@affino/datagrid-vue/advanced/selection`
- `@affino/datagrid-vue/advanced/editing`
- `@affino/datagrid-vue/advanced/clipboard`
- `@affino/datagrid-vue/advanced/filtering`
- `@affino/datagrid-vue/advanced/history`

Example:

```ts
import {
  useDataGridManagedWheelScroll,
  useDataGridColumnLayoutOrchestration,
} from "@affino/datagrid-vue/advanced/layout"
```

- `createDataGridViewportController`
- `useDataGridCellPointerDownRouter`
- `useDataGridCellPointerHoverRouter`
- `useDataGridDragSelectionLifecycle`
- `useDataGridDragPointerSelection`
- `useDataGridFillSelectionLifecycle`
- `useDataGridFillHandleStart`
- `useDataGridRangeMoveLifecycle`
- `useDataGridRangeMoveStart`
- `useDataGridSelectionMoveHandle`
- `useDataGridTabTargetResolver`
- `useDataGridCellNavigation`
- `useDataGridClipboardValuePolicy`
- `useDataGridCellDatasetResolver`
- `useDataGridCellRangeHelpers`
- `useDataGridNavigationPrimitives`
- `useDataGridMutationSnapshot`
- `useDataGridCellVisualStatePredicates`
- `useDataGridRangeMutationEngine`
- `useDataGridA11yCellIds`
- `useDataGridColumnUiPolicy`
- `useDataGridEditableValuePolicy`
- `useDataGridMoveMutationPolicy`
- `useDataGridInlineEditorSchema`
- `useDataGridInlineEditOrchestration`
- `useDataGridInlineEditorTargetNavigation`
- `useDataGridInlineEditorKeyRouter`
- `useDataGridHeaderContextActions`
- `useDataGridHeaderLayerOrchestration`
- `useDataGridCopyRangeHelpers`
- `useDataGridHeaderSortOrchestration`
- `useDataGridHeaderResizeOrchestration`
- `useDataGridHeaderInteractionRouter`
- `useDataGridColumnFilterOrchestration`
- `useDataGridEnumTrigger`
- `useDataGridGroupValueLabelResolver`
- `useDataGridGroupMetaOrchestration`
- `useDataGridGroupBadge`
- `useDataGridGroupingSortOrchestration`
- `useDataGridViewportMeasureScheduler`
- `useDataGridVisibleRowsSyncScheduler`
- `useDataGridColumnLayoutOrchestration`
- `useDataGridSelectionOverlayOrchestration`
- `useDataGridRowsProjection`
- `useDataGridRowSelectionOrchestration`
- `useDataGridRowSelectionInputHandlers`
- `useDataGridVirtualRangeMetrics`
- `useDataGridContextMenuAnchor`
- `useDataGridContextMenuActionRouter`
- `useDataGridViewportContextMenuRouter`
- `useDataGridViewportBlurHandler`
- `useDataGridViewportScrollLifecycle`
- `useDataGridLinkedPaneScrollSync`
- `useDataGridResizeClickGuard`
- `useDataGridInitialViewportRecovery`
- `useDataGridManagedWheelScroll`
- `useDataGridManagedTouchScroll`
- `useDataGridScrollIdleGate`
- `useDataGridScrollPerfTelemetry`
- `useDataGridClearSelectionLifecycle`
- `useDataGridGlobalPointerLifecycle`
- `useDataGridPointerAutoScroll`
- `useDataGridPointerPreviewRouter`
- `useDataGridPointerCellCoordResolver`
- `useDataGridAxisAutoScrollDelta`
- `useDataGridCellVisibilityScroller`
- `useDataGridGlobalMouseDownContextMenuCloser`
- `useDataGridKeyboardCommandRouter`
- `useDataGridQuickFilterActions`
- `useDataGridCellCoordNormalizer`
- `useDataGridSelectionComparators`
- `useDataGridRowSelectionModel`
- `useDataGridPointerModifierPolicy`
- `useDataGridHistoryActionRunner`
- `useDataGridInlineEditorFocus`
- `useDataGridClipboardBridge`
- `useDataGridClipboardMutations`
- `useDataGridIntentHistory`

## Quick start

```ts
import { ref } from "vue"
import { useDataGridRuntime } from "@affino/datagrid-vue"

const rows = ref([])
const columns = ref([
  { key: "service", label: "Service", initialState: { width: 220 } },
])

const { api, columnSnapshot } = useDataGridRuntime({
  rows,
  columns,
})
```

`useDataGridRuntime` also exposes `patchRows(updates, options?)` for partial row updates without mandatory sort/filter/group recompute on every cell change:

```ts
const runtime = useDataGridRuntime({ rows, columns })
runtime.patchRows(
  [{ rowId: "r-42", data: { tested_at: "2026-02-21T10:15:00Z" } }],
  { recomputeSort: false, recomputeFilter: false, recomputeGroup: false },
)
```

Use `setRows` for full data replacement; use `patchRows` for interactive/streaming cell updates when you want to avoid immediate projection jumps.
In no-recompute mode (`recomputeSort/filter/group = false`), row order/filter/group visibility can remain temporarily stale by design until a recompute pass is requested.

For app-level editing flows, prefer the higher-level `applyEdits()` + `reapplyView()` API:

```ts
const runtime = useDataGridRuntime({ rows, columns })

// default Excel-style behavior: update values, keep current view stable
runtime.applyEdits([{ rowId: "r-42", data: { tested_at: "2026-02-21T10:15:00Z" } }])

// explicit reapply when the user clicks "Reapply" or leaves edit mode
runtime.reapplyView()

// optional live-reapply mode
runtime.autoReapply.value = true
```

Pivot can be controlled directly from runtime API (without direct core/orchestration imports):

```ts
runtime.setPivotModel({
  rows: ["team"],
  columns: ["year"],
  values: [{ field: "revenue", agg: "sum" }],
  rowSubtotals: true,
  grandTotal: true,
})

const activePivot = runtime.getPivotModel()
runtime.setPivotModel(null)
```

When pivot is active, runtime automatically reconciles `snapshot.pivotColumns` into the column model
so adapters render pivot columns without manual `setColumns` wiring. Base columns remain the source of truth.

## Managed wheel scroll (advanced)

Use `useDataGridManagedWheelScroll` when you want deterministic wheel ownership (axis lock, preventDefault policy, and consistent header/body horizontal sync).

```ts
import { useDataGridManagedWheelScroll } from "@affino/datagrid-vue/advanced"

const managedWheelScroll = useDataGridManagedWheelScroll({
  resolveWheelMode: () => "managed", // "managed" | "native"
  resolveWheelAxisLockMode: () => "dominant",
  resolvePreventDefaultWhenHandled: () => true,
  resolveBodyViewport: () => viewportRef.value,
  resolveMainViewport: () => viewportRef.value
    ? {
        scrollLeft: viewportRef.value.scrollLeft,
        scrollWidth: viewportRef.value.scrollWidth,
        clientWidth: viewportRef.value.clientWidth,
      }
    : null,
  setHandledScrollTop: (nextTop) => {
    if (viewportRef.value) {
      viewportRef.value.scrollTop = nextTop
    }
  },
  setHandledScrollLeft: (nextLeft) => {
    if (viewportRef.value) {
      viewportRef.value.scrollLeft = nextLeft
    }
  },
})

function onViewportWheel(event: WheelEvent) {
  managedWheelScroll.onBodyViewportWheel(event)
}
```

```vue
<div ref="viewportRef" @wheel="onViewportWheel" @scroll="onViewportScroll" />
```

- Call `managedWheelScroll.reset()` on unmount.
- Keep DOM reads/writes in adapter/demo/UI layer; do not move wheel DOM handling into core.

## Orchestration-heavy viewport integration

Use orchestration primitives from `@affino/datagrid-vue/advanced` to keep component code thin while preserving high-fidelity interaction behavior.

```ts
import {
  useDataGridLinkedPaneScrollSync,
  useDataGridResizeClickGuard,
  useDataGridInitialViewportRecovery,
  useDataGridRowSelectionModel,
} from "@affino/datagrid-vue/advanced"

const linkedPaneSync = useDataGridLinkedPaneScrollSync({
  resolveSourceScrollTop: () => viewportRef.value?.scrollTop ?? 0,
  mode: "css-var",
  resolveCssVarHost: () => gridRootRef.value,
})

const resizeGuard = useDataGridResizeClickGuard()

const viewportRecovery = useDataGridInitialViewportRecovery({
  resolveShouldRecover: () => totalRows.value > 1 && renderedRowsCount.value <= 1,
  runRecoveryStep: () => syncViewportMetrics(),
})

const rowSelectionModel = useDataGridRowSelectionModel({
  resolveFilteredRows: () => filteredRows.value,
  resolveRowId: row => String(row.rowId),
  resolveAllRows: () => allRows.value,
})
```

Recommended ownership:
- `@affino/datagrid-core`: deterministic data/runtime contracts.
- `@affino/datagrid-orchestration`: interaction policies and state orchestration.
- `@affino/datagrid-vue`: refs/template wiring and DOM lifecycle integration.

## 60-second integration (junior-friendly)

```ts
import { ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = ref([
  { rowId: "1", service: "edge-gateway", owner: "NOC" },
  { rowId: "2", service: "billing-api", owner: "Payments" },
])

const columns = [
  { key: "service", label: "Service", initialState: { width: 220 } },
  { key: "owner", label: "Owner", initialState: { width: 180 } },
]

const columnState = ref(null)
const gridState = ref(null)
```

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :features="['selection', 'sorting', 'filterDsl', 'filterBuilderUI', 'columnMenu', 'cellEditors']"
  v-model:column-state="columnState"
  v-model:state="gridState"
/>
```

- Uses the built-in app component with declarative feature wiring.
- Supports state ownership with `v-model:column-state` and `v-model:state`.
- Best fit when you want one canonical high-level component instead of separate "simple" and "advanced" component tiers.

## Legacy sugar removal

The legacy `useAffinoDataGrid`, `useAffinoDataGridUi`, and `useAffinoDataGridMinimal` wrappers were removed.

For new integrations:

- Use `DataGrid` from `@affino/datagrid-vue-app` for the canonical component path.
- Use `useDataGridRuntime` from `@affino/datagrid-vue` when you need a headless runtime.
- Use `@affino/datagrid-vue/advanced/*` and app-layer hooks for custom interaction flows.

For end-to-end UI behavior and spreadsheet interaction contracts, use:

- `/workspace/docs/datagrid-vue-stable-entrypoint.md`
- `/workspace/docs/datagrid-sheets-user-interactions-and-integrator-api.md`
