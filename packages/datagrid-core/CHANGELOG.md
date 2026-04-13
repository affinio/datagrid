# @affino/datagrid-core

## Unreleased

### Patch Changes

- ## Summary

  Added effective-value hooks for client filtering, histograms, and selection summary so package consumers can resolve workbook/formula/display values without mutating raw row payloads. The public core surface now also exports the reusable selection-cell resolver and the stable bivariant callback helper used by higher-level typed facades.

  The spreadsheet helpers now also expose reusable formula-reference bounds and decoration builders so workbook-style adapters can derive overlay lanes from parsed formula references without duplicating sheet/column range resolution in UI components.

  ## User impact

  Integrators can keep value-set filters, advanced filter predicates, column histograms, and selection aggregates aligned with what the user actually sees in the grid. This is especially useful for formula-backed columns, derived display labels, and workbook adapters that should filter or summarize effective values instead of stored source fields.

  Spreadsheet shells can now build formula reference overlays from a shared core helper instead of reimplementing reference-to-range resolution per frontend package.

  ## Migration
  - No migration required.
  - Optional adoption:
    - pass `readFilterCell` to `createClientRowModel(...)` when filters and histograms must read effective values,
    - pass `readSelectionCell` to `api.selection.summarize(...)` or `createDataGridSelectionSummary(...)` when aggregates should use display/formula results.
    - replace local formula-reference range builders with `resolveDataGridSpreadsheetFormulaReferenceBounds(...)` / `createDataGridSpreadsheetFormulaReferenceDecorations(...)` when building spreadsheet overlays.

  ## Validation
  - targeted `clientRowModel` regression for `readFilterCell` passed
  - targeted `selectionSummary` regression for `readSelectionCell` precedence/fallback passed
  - targeted spreadsheet formula reference decoration unit coverage passed
  - downstream facade and workbook regressions updated against the new effective-value path

## 0.3.5

### Patch Changes

- ## Summary

  Promoted typed selection event payloads through the stable core public surface so downstream packages can import `DataGridApiSelectionChangedEvent` and `DataGridApiRowSelectionChangedEvent` without deep/internal coupling.

  ## User impact

  Package consumers and adapter layers can now depend on canonical exported selection event typings from `@affino/datagrid-core`.

  ## Migration
  - No migration required.
  - Optional adoption: replace local/deep-imported selection event payload types with the public core exports.

  ## Validation
  - `pnpm --filter @affino/datagrid-core build`
  - downstream `@affino/datagrid-vue` public build/type-check unblocked

## 0.2.0

### Minor Changes

- ## Summary

  Added true cell-level refresh pipeline across DataGrid packages. `@affino/datagrid-core` now exposes `refreshCellsByRowKeys`, `refreshCellsByRanges`, and `onCellsRefresh` with deterministic batching and viewport-aware emission. `@affino/datagrid-orchestration` adds `useDataGridCellRefreshBatcher` (including batching policy knobs and telemetry hook). `@affino/datagrid-vue` wires adapter-side handling for targeted visible-cell updates and refresh event propagation.

  ## User impact

  Integrators can refresh only impacted cells without forcing full `rowModel.refresh()` paths, with better control in high-churn scenarios and improved hooks for diagnostics/telemetry.

  ## Migration
  - No migration required.
  - Existing `refresh()` flows remain supported.
  - Optional adoption:
    - call `api.refreshCellsByRowKeys(...)` / `api.refreshCellsByRanges(...)` in place of broad refreshes,
    - optionally use `useDataGridCellRefreshBatcher(...)` to coalesce high-frequency updates.

  ## Validation
  - datagrid strict contracts: passed
  - datagrid unit/integration: passed
  - e2e: passed
  - visual: passed
  - benchmark regression gate: passed
  - full `quality:max`: passed

### Patch Changes

- b278a99: ## Summary

  Describe what changed in one short paragraph.

  ## User impact

  State the visible impact for integrators/end users.

  ## Migration
  - `No migration required`, or
  - exact migration steps with before/after API examples.

  ## Validation

  List evidence:
  - tests run (unit/integration/critical e2e)
  - quality gates result
  - benchmark/performance gate result (if relevant)
