# @affino/datagrid-vue-app

## 0.1.14

### Patch Changes

- ## Summary

  Added a public `toolbarModules` extension point on `DataGrid` so app teams can append custom toolbar buttons and popovers without replacing the built-in renderer.

  ## User impact

  Consumers can keep the built-in app toolbar modules such as column layout and advanced filter, while adding their own typed toolbar actions through `DataGridAppToolbarModule`. The app facade also keeps built-in toolbar and filter UI synchronized from unified state, queues imperative restores until columns are ready, and exposes a dedicated controlled `rowSelectionState` snapshot contract.

  ## Migration
  - No migration required.
  - Optional adoption: pass `toolbar-modules` / `toolbarModules` to `DataGrid` instead of replacing the whole renderer when you only need additive toolbar customization.
  - Optional adoption: use `row-selection-state` / `rowSelectionState` with `update:rowSelectionState` when a host page wants a stable controlled selected-row snapshot without diffing `row-select` and unified-state emissions.

  ## Validation
  - public facade contract updated for `toolbarModules`
  - built-in app renderer now derives effective sort/filter/group/pivot UI state from unified state and imperative saved-view restores
  - imperative state and saved-view restores queue until runtime columns are ready
  - saved views sanitize transient transaction snapshots before persistence
  - controlled `rowSelectionState` contract covered by facade contract tests
  - package README and shared docs updated
  - sandbox demo + focused spec added