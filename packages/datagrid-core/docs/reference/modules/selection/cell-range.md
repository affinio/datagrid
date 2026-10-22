# Cell and range selection

This reference describes Core's rectangular cell-selection state. It complements [row selection](row-selection.md), which selects records by ID. It does not define pointer or keyboard gestures; those belong to a UI adapter.

## Model

`DataGridSelectionSnapshot` stores zero or more rectangular ranges, the active range index, an optional active cell, and the `projectionRevision` and `columnRevision` used to interpret positional coordinates. The projection revision tracks materialized projection recomputes; viewport-window movement alone does not make a range stale. Each range contains inclusive row/column index bounds, anchor and focus points, and endpoint row IDs when known. Indexes address the current logical row and visible column order; they are not persistent identity. Use row IDs and column keys at application boundaries, then resolve them against the current projection before creating or applying a snapshot.

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

`api.selection` is optional at runtime. Check `api.selection.hasSupport()` before exposing selection controls. `setSnapshot()` stamps the current row projection and visible-column order revisions. A later row projection or visible-column order change makes the positional snapshot stale: `getSnapshotStatus()` reports `stale`, `getSnapshot()` returns `null`, and summaries/range-row reads return no result. Width-only changes do not invalidate coordinates. Legacy snapshots installed outside the API are reported as `untracked` until rewritten through `setSnapshot()`. `clear()` removes the current ranges. The full method contract is in the [API method reference](../../api/grid-api-methods.md#selection).

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

These helpers clamp coordinates to the supplied grid dimensions and resolve row IDs through the supplied flattened row context. They provide geometry only: they do not maintain committed selection, interpret modifiers, choose interaction ownership, or manage a drag session. Advanced entrypoints can evolve faster than the stable root; see the [API stability policy](../../../../../../docs/api-stability.md).

## Summaries and virtual ranges

`api.selection.summarize()` computes aggregates over selected cells in the loaded/current model scope. Its result identifies whether the summary covers `selected-loaded` or `selected-visible` data and whether it is partial. Cell values can be resolved through configured column accessors or a supplied `readSelectionCell` callback. See the method reference for options and the [selection summary contract](../../api/grid-api-methods.md#selection).

For a range that crosses unloaded rows, Core exposes virtual-selection metadata and coverage helpers from the stable root. They report loaded row IDs, missing intervals, projection identity, and staleness so an adapter or operation layer can avoid treating a partial cache as a complete range. Whether copy, paste, clear, fill, or another operation can proceed over unloaded rows depends on backend capabilities; see the [server selection operations contract](../../../../../../docs/server-datasource/reference/selection-operations.md).

## Column selection

Persistent selection of whole columns is separate from cell ranges. Use the [`api.columnSelection` contract](column-selection.md) to select columns by stable key; it survives row projection changes and remains independent of cell selection and column visibility/order.

## Ownership boundary

Core owns the cell/range snapshot, range geometry contracts, and summary/coverage calculations. The adapter owns DOM hit testing, pointer and keyboard gesture lifecycle, focus rendering, and preview visuals. The application owns product policy and actions over the resulting selected cells. For record selection by row ID, use the separate [row-selection model](row-selection.md).
