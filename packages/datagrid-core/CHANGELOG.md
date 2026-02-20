# @affino/datagrid-core

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
