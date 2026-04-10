# @affino/datagrid-vue-app

## 0.1.24

### Patch Changes

- ## Summary

  Added the public declarative `history` facade, declarative column/header menu customization, and a new `placeholderRows` surface for Excel-like visual tail rows that materialize only on first write. This patch also closes the placeholder-tail runtime regressions around viewport synchronization and drag-move into empty target rows.

  ## User impact

  `DataGrid` consumers can now enable built-in history with stable controller access, customize or disable the standard header/column menu declaratively, and render empty tail rows without persisting placeholder records up front. Placeholder rows now behave correctly across inline edit, paste, checkbox toggles, row-index insert/copy/cut/paste/delete flows, undo back to placeholder state, viewport entry into the visual tail, and drag-moving cells into empty tail rows. Authored cell renderers also receive `surface.kind` so custom UI can distinguish real rows from placeholder surface rows.

  ## Migration
  - No migration required.
  - Optional adoption:
    - pass `history` to enable built-in undo/redo controls and stable `canUndo` / `canRedo` / `runHistoryAction(...)` access from the component ref,
    - pass `columnMenu` object-form configuration to tune built-in menu trigger, standard items, disabled states, and custom items,
    - pass `placeholderRows` to add a fixed visual tail with lazy row materialization via `createRowAt(...)`.

  ## Validation
  - public facade contract coverage updated for `history`, `columnMenu`, `placeholderRows`, renderer `surface.kind`, and placeholder row-index flows
  - stage placeholder virtual-window regression passed
  - targeted drag-move into placeholder-tail contract regression passed
  - package README, shared docs, and sandbox demos updated

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