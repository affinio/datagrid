# @affino/datagrid-orchestration

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

- 2c21940: ## Summary

  Stabilized DataGrid runtime behavior and release-readiness updates in orchestration-adjacent flows, including managed wheel scroll handling refinements and quality gate alignment for release.

  ## User impact

  Consumers of `@affino/datagrid-orchestration` get a patch-level update with improved runtime consistency and no intended breaking API changes.

  ## Migration
  - No migration required.

  ## Validation
  - quality gates: `pnpm run quality:max` passed
  - benchmark/performance gates: `pnpm run bench:regression` passed (including tree-workload gate)

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

- Updated dependencies
- Updated dependencies [b278a99]
  - @affino/datagrid-core@0.2.0
