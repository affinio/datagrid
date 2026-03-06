# DataGrid Sheets Baseline: User Interactions + Integrator API

Updated: `2026-02-09`
Scope: `/datagrid` demo baseline and `@affino/datagrid-core` integration contract.

## 1) End-User Interactions (Behavior Contract)

### Selection and navigation

- Click cell: sets active cell and single-cell selection.
- `Shift + click` / `Shift + arrows`: extends range from fixed anchor.
- Drag on cells: expands range continuously; auto-scroll on viewport edges (X/Y).
- `Tab` / `Shift+Tab`: horizontal navigation over navigable columns.
- `Home` / `End` and `Ctrl/Cmd + Home/End`: row/dataset edge jumps.
- `PageUp` / `PageDown`: viewport-sized vertical steps.
- `Escape`: clears active range selection.

### Edit, fill, move

- Double-click editable cell: inline edit mode.
- Enum-like cells: open value picker from in-cell trigger.
- `Enter`: commit edit; `Escape`: cancel; `Tab`: commit and move.
- Fill handle: drag from range-end handle to repeat source pattern (editable columns only; non-editable cells are skipped).
- Move range: drag selection border to move values (editable columns only; non-editable cells are blocked).

### Clipboard and context menu

- `Ctrl/Cmd + C`: copy selected range.
- `Ctrl/Cmd + V`: paste at active target (matrix-aware).
- `Ctrl/Cmd + X`: cut (copy + clear editable cells).
- Context menu (`Shift+F10` or mouse right click): copy/paste/cut/clear and header actions (sort/filter/auto-size).

### History (Undo/Redo)

- `Ctrl/Cmd + Z`: undo last committed intent transaction.
- `Ctrl/Cmd + Shift + Z` (and `Ctrl + Y`): redo.
- Toolbar controls `Undo` / `Redo` map to the same transaction history.
- History entries are intent-level (`edit`, `paste`, `cut`, `clear`, `fill`, `move`) with affected range metadata.

## 2) Integrator API Usage (Core)

Use stable core API from package root and advanced transaction service from advanced entrypoint.

```ts
import {
  createClientRowModel,
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
} from "@affino/datagrid-core"
import { createDataGridTransactionService } from "@affino/datagrid-core/advanced"

const rowModel = createClientRowModel({ rows })
const columnModel = createDataGridColumnModel({ columns })

const transaction = createDataGridTransactionService({
  maxHistoryDepth: 120,
  execute(command, context) {
    // apply = no-op for already-applied state snapshots in UI-driven flow
    // undo/redo/rollback = restore rollback payload snapshot
  },
})

const core = createDataGridCore({
  services: {
    rowModel: { name: "rowModel", model: rowModel },
    columnModel: { name: "columnModel", model: columnModel },
    transaction: {
      name: "transaction",
      getTransactionSnapshot: transaction.getSnapshot,
      beginTransactionBatch: transaction.beginBatch,
      commitTransactionBatch: transaction.commitBatch,
      rollbackTransactionBatch: transaction.rollbackBatch,
      applyTransaction: transaction.applyTransaction,
      canUndoTransaction: transaction.canUndo,
      canRedoTransaction: transaction.canRedo,
      undoTransaction: transaction.undo,
      redoTransaction: transaction.redo,
      dispose() {
        transaction.dispose()
      },
    },
  },
})

const api = createDataGridApi({ core })
await api.start()
```

### Required integration rules

- Required services: `rowModel`, `columnModel`.
- Optional capability services: `transaction`, `selection`, `viewport`.
- Keep row identity stable (`rowId`/`rowKey`), never index-based fallback.
- Keep GroupBy in row-model pipeline (`filter -> sort -> groupBy -> flatten -> visible`).
- Treat transaction history as model-level capability, not UI-only state.
- Prefer declarative `advancedExpression` in filter snapshot for complex conditions (`and`/`or`/`not`).

### Common API operations

- Data projection:
  - `api.rows.setSortModel(...)`
  - `api.rows.setFilterModel(...)`
  - `api.rows.setGroupBy(...)`
  - `api.rows.toggleGroup(groupKey)`
- Column state:
  - `api.columns.setWidth(key, width)`
  - `api.columns.setPin(key, "left" | "right" | "none")`
  - `api.columns.setVisibility(key, visible)`
- History:
  - `api.transaction.apply(tx)`
  - `api.transaction.undo()`
  - `api.transaction.redo()`
- Selection summary:
  - `api.selection.summarize({ columns, defaultAggregations })`

## 3) Related References

- `docs/datagrid-grid-api.md`
- `docs/datagrid-model-contracts.md`
- `docs/datagrid-groupby-rowmodel-projection.md`
- `docs/datagrid-vue-demo-canonical-behavior-contract.md`
- `tests/e2e/datagrid.regression.spec.ts`
