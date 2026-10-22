# Cell and range selection

This reference describes Core's rectangular cell-selection state. It complements [row selection](./row-selection.md), which selects records by ID. It does not define pointer or keyboard gestures; those belong to a UI adapter.

## Model

`DataGridSelectionSnapshot` stores zero or more rectangular ranges, the active range index, and an optional active cell. Each range contains inclusive row/column index bounds, anchor and focus points, and endpoint row IDs when known. Indexes address the current logical row and column order; they are not persistent identity. Use row IDs and column keys at application boundaries, then resolve them against the current projection before creating or applying a snapshot.

```ts
import type { DataGridSelectionSnapshot } from "@affino/datagrid-core"

const selection: DataGridSelectionSnapshot = {
  ranges: [{
    startRow: 2,
    endRow: 4,
    startCol: 1,
    endCol: 2,
    startRowId: "order-103",
    endRowId: "order-105",
    anchor: { rowIndex: 2, colIndex: 1, rowId: "order-103" },
    focus: { rowIndex: 4, colIndex: 2, rowId: "order-105" },
  }],
  activeRangeIndex: 0,
  activeCell: { rowIndex: 4, colIndex: 2, rowId: "order-105" },
}

api.selection.setSnapshot(selection, { origin: "order-inspector" })
```

`api.selection` is optional at runtime. Check `api.selection.hasSupport()` before exposing selection controls. `getSnapshot()` returns `null` when selection is empty or unsupported; `clear()` removes the current ranges. The full method contract is in the [API method reference](./grid-api-methods.md#selection).

Multiple disjoint rectangles can be represented by `ranges`; `activeRangeIndex` identifies the range that keyboard or renderer behavior treats as active. The Core API stores and applies this state, but it does not decide how a click, drag, Shift key, or keyboard command changes the ranges.

## Range geometry helpers

The stable `DataGridApi` accepts and returns snapshots. Pure helpers for clamping points and constructing normalized rectangular ranges are exposed from the advanced entrypoint:

```ts
import {
  createGridSelectionContextFromFlattenedRows,
  createGridSelectionRange,
} from "@affino/datagrid-core/advanced"

const context = createGridSelectionContextFromFlattenedRows({
  rows: projectedRows.map(row => ({ rowId: row.rowId, isGroup: row.kind === "group" })),
  colCount: visibleColumns.length,
})

const range = createGridSelectionRange(
  { rowIndex: 2, colIndex: 1 },
  { rowIndex: 4, colIndex: 2 },
  context,
)
```

These helpers clamp coordinates to the supplied grid dimensions and resolve row IDs through the supplied flattened row context. They provide geometry only: they do not maintain committed selection, interpret modifiers, choose interaction ownership, or manage a drag session. Advanced entrypoints can evolve faster than the stable root; see the [API stability policy](../../../../docs/api-stability.md).

## Summaries and virtual ranges

`api.selection.summarize()` computes aggregates over selected cells in the loaded/current model scope. Its result identifies whether the summary covers `selected-loaded` or `selected-visible` data and whether it is partial. Cell values can be resolved through configured column accessors or a supplied `readSelectionCell` callback. See the method reference for options and the [selection summary contract](./grid-api-methods.md#selection).

For a range that crosses unloaded rows, Core exposes virtual-selection metadata and coverage helpers from the stable root. They report loaded row IDs, missing intervals, projection identity, and staleness so an adapter or operation layer can avoid treating a partial cache as a complete range. Whether copy, paste, clear, fill, or another operation can proceed over unloaded rows depends on backend capabilities; see the [server selection operations contract](../../../../docs/server-datasource/reference/selection-operations.md).

## Column selection

Core has no separate `columnSelection` namespace or durable selection-by-column-key model. A set of cells in one column can be represented as a rectangular range with equal `startCol` and `endCol`. Selecting a whole column therefore means constructing a range across the current row scope; its row bounds change when the projection changes. It should not be treated as a persistent semantic “selected column” state.

If an application needs column-level selection that survives row projection changes, the application or adapter should keep selected column keys as its own state and translate that state to cell ranges only for rendering or cell operations. Column visibility/order remains owned by `api.columns`, independently of cell selection.

## Ownership boundary

Core owns the selection snapshot, range geometry contracts, and summary/coverage calculations. The adapter owns DOM hit testing, pointer and keyboard gesture lifecycle, focus rendering, and preview visuals. The application owns product policy and actions over the resulting selected cells. For record selection by row ID, use the separate [row-selection model](./row-selection.md).
