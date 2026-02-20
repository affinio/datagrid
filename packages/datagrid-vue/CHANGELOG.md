# @affino/datagrid-vue

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

- d57cfba: ## Summary

  Added reusable DataGrid orchestration primitives for linked-pane scroll sync, resize click guard, initial viewport recovery, and row-selection model (anchor/shift/reconcile).

  ## User impact

  Consumers get a patch update with new advanced APIs for moving complex grid interaction behavior from component-local code into package-level composables.

  ## Migration
  - No migration required.
  - Optional adoption: replace local component logic with new APIs:
    - `useDataGridLinkedPaneScrollSync`
    - `useDataGridResizeClickGuard`
    - `useDataGridInitialViewportRecovery`
    - `useDataGridRowSelectionModel`

  ## Validation
  - `pnpm --filter @affino/datagrid-orchestration type-check:public`
  - `pnpm --filter @affino/datagrid-vue type-check:public`

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

- 2c21940: ## Summary

  Bump `@affino/datagrid-vue` patch version to publish latest advanced DataGrid wheel-scroll integration updates.

  ## User impact

  Consumers can install the updated Vue adapter package version with no intended breaking API changes.

  ## Migration
  - No migration required.

  ## Validation
  - `@affino/datagrid-orchestration` dependency was published and Vue package is prepared for follow-up publish.

- Updated dependencies
- Updated dependencies [2c21940]
- Updated dependencies [d57cfba]
- Updated dependencies [b278a99]
  - @affino/datagrid-core@0.2.0
  - @affino/datagrid-orchestration@0.2.0
