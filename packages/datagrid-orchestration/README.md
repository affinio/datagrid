# @affino/datagrid-orchestration

Framework-agnostic orchestration primitives shared by DataGrid adapters.

This package contains pure TypeScript logic (state commands, interaction policies, transformation helpers) that should be reused by Vue/Laravel/React adapters.

## Layer role

- `@affino/datagrid-core`: data/row/column runtime and deterministic model contracts.
- `@affino/datagrid-orchestration`: adapter-agnostic interaction policies and UI orchestration primitives.
- `@affino/datagrid-vue`: Vue bindings, refs, templates and framework lifecycle wiring.

## New orchestration primitives

- `useDataGridLinkedPaneScrollSync`: high-velocity linked-pane sync with a single scroll source-of-truth.
	- modes: `direct-transform` and `css-var`.
- `useDataGridResizeClickGuard`: resize interaction guard that blocks accidental header-sort click after resize.
- `useDataGridInitialViewportRecovery`: post-mount/resize recovery loop for virtual viewport stabilization.
- `useDataGridRowSelectionModel`: anchor + shift-range row selection model with reconcile helpers for filtering/virtualization flows.
- `useDataGridScrollIdleGate`: lightweight scroll-activity gate for deferring non-critical sync work until scroll idle.
- `useDataGridScrollPerfTelemetry`: runtime frame telemetry for active scroll sessions (`fps`, dropped frames, long-task frames) with a minimal quality classification (`good`/`degraded`).

## Scroll ownership contract

`useDataGridManagedWheelScroll` supports explicit ownership release for nested containers:

- `resolveWheelPropagationMode()` supports policy modes:
	- `retain`
	- `release-at-boundary-when-unconsumed`
	- `release-when-unconsumed`
- `resolveShouldPropagateWheelEvent(result)` remains available as a callback override for custom contracts.
- Propagation decisions are ownership-based (`handled`) to preserve managed-wheel stability under pending/clamped deltas.
- Optional hard-stop behavior: `resolveStopImmediatePropagation()` enables `stopImmediatePropagation()` for handled events when required by nested listener topology.
- `resolvePreventDefaultWhenHandled()` keeps managed behavior deterministic for handled wheel input.

This enables controlled wheel chaining in layouts like `grid -> modal -> page` without losing managed wheel behavior inside the grid.

`useDataGridManagedTouchScroll` extends the same ownership model to touch/pan input (mobile-first):

- single-finger pan is translated into managed viewport deltas via `setHandledScrollTop` / `setHandledScrollLeft`
- supports the same axis-lock semantics (`off`, `dominant`, `vertical-preferred`, `horizontal-preferred`)
- keeps clamp/boundary behavior aligned with managed wheel contract
- respects linked pane synchronization hooks (`syncLinkedScroll`, `scheduleLinkedScrollSyncLoop`)
- only calls `preventDefault()` when the grid actually handles the gesture
- ignores multi-touch gestures and editable targets (`input`, `textarea`, `select`, `contenteditable`)

## Quick example

```ts
import {
	useDataGridLinkedPaneScrollSync,
	useDataGridResizeClickGuard,
	useDataGridInitialViewportRecovery,
	useDataGridRowSelectionModel,
} from "@affino/datagrid-orchestration"

const linkedSync = useDataGridLinkedPaneScrollSync({
	resolveSourceScrollTop: () => bodyViewport.scrollTop,
	mode: "css-var",
	resolveCssVarHost: () => gridRoot,
})

const resizeGuard = useDataGridResizeClickGuard()

const viewportRecovery = useDataGridInitialViewportRecovery({
	resolveShouldRecover: () => totalRows > 1 && renderedRows <= 1,
	runRecoveryStep: () => syncViewportMetrics(),
})

const rowSelection = useDataGridRowSelectionModel({
	resolveFilteredRows: () => filteredRows,
	resolveRowId: row => String(row.rowId),
	resolveAllRows: () => allRows,
})

const scrollIdleGate = useDataGridScrollIdleGate({
	resolveIdleDelayMs: () => 80,
})

scrollIdleGate.markScrollActivity()
scrollIdleGate.runWhenScrollIdle(() => {
	// defer heavy non-critical sync while user is actively scrolling
	recomputeSelectionSummary()
})
```

