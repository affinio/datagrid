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
```

