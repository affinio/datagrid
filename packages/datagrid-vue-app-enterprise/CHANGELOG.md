# @affino/datagrid-vue-app-enterprise

## 0.1.1

### Fixed

- The enterprise facade now provides the Gantt stage, so `viewMode="gantt"` renders correctly while preserving the facade ref methods.

### Validation

- Enterprise package type-check and all unit tests passed.

### Patch Changes

- ## Summary

  Re-exported the typed community facade helpers and related types from the enterprise entrypoint so enterprise consumers can keep the same row-typed authoring model when switching import paths.

  ## User impact

  Teams using the enterprise app facade no longer need mixed community and enterprise imports just to keep typed columns, typed refs, or typed filter/selection readers. The enterprise package now preserves parity for `defineDataGridComponent`, `defineDataGridColumns`, `useDataGridRef`, and the typed reader helpers.

  ## Migration
  - No migration required.
  - Optional adoption: import typed facade helpers directly from `@affino/datagrid-vue-app-enterprise` once your app is fully on the enterprise entrypoint.

  ## Validation
  - package type-check passed against the updated enterprise exports
  - sandbox typed-facade demo continues to compile against the shared app surface
