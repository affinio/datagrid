# @affino/datagrid-vue-app

## 0.1.27

### Patch Changes

- ## Summary

  Slimmed the root app entry so heavy optional surfaces no longer have to ride the default runtime path, and aligned modified-arrow keyboard selection with Excel-style expansion semantics.

  ## User impact

  The base `DataGrid` entry now keeps gantt-specific runtime code behind a lazy boundary instead of pulling `@affino/datagrid-gantt` into ordinary table usage. Optional heavy UI surfaces are now easier to consume as explicit package entrypoints, including the new `@affino/datagrid-vue-app/aggregations` subpath alongside the existing `gantt`, `advanced-filter`, and `find-replace` entries. In grid interaction, `Shift+Ctrl/Cmd+Arrow` now extends the current range in the requested direction until the first blank gap, matching the expected Excel-like keyboard workflow for contiguous data blocks.

  ## Migration
  - No migration required.
  - Optional adoption:
    - import feature-specific surfaces from subpaths when you want stricter bundle boundaries around gantt, aggregations, advanced filter, or find/replace UI,
    - keep consumer-side chunk tuning only as an optimization layer; the package root no longer requires it as a workaround for gantt coupling,
    - rely on `Shift+Ctrl/Cmd+Arrow` for contiguous range expansion in spreadsheet-like keyboard flows.

  ## Validation
  - `@affino/datagrid-vue-app` type-check passed
  - `@affino/datagrid-vue-app` build passed and the base `dist/index.js` no longer statically imports `@affino/datagrid-gantt`
  - focused `@affino/datagrid-vue` keyboard-navigation contracts passed for modified-arrow range extension

## 0.1.26

### Patch Changes

- ## Summary

  Added package-level chrome layout controls, external toolbar hosting support, declarative row reorder, drag-and-drop column ordering inside the built-in Columns panel, and sequential visual row-index labels. This patch also cleans up package-rendered native input fields so built-in overlays and editors no longer rely on unnamed browser controls.

  ## User impact

  `DataGrid` consumers can now tune app-shell chrome declaratively through `chrome`, including `stacked` / `integrated` / `hidden` toolbar placement, compact density, and explicit toolbar/workspace gaps. Hosts can render built-in toolbar modules outside the grid through `toolbar-modules-change` plus exported `DataGridModuleHost`. Row drag-and-drop is now an opt-in public feature through `rowReorder`, column order can be changed by dragging items inside the built-in `Columns` panel, and row index labels stay visually stable as `1..N` regardless of numeric source ids or reordered row data. Sandbox demos now expose row reorder in the main sugar table scenario.

  ## Migration
  - No migration required.
  - Optional adoption:
    - pass `chrome` when you need package-level control over toolbar placement, density, or shell gaps,
    - subscribe to `toolbar-modules-change` and render `DataGridModuleHost` when toolbar UI must live in an external host shell,
    - pass `rowReorder` to opt into drag-and-drop row reordering from the row index,
    - use the built-in `Columns` panel drag-and-drop instead of custom move-up / move-down wrappers when manual column ordering is sufficient.

  ## Validation
  - public facade contract coverage updated for `chrome`, external toolbar module publication, row drag reorder, row-reorder opt-in gating, and column-layout drag reorder
  - package README and sandbox demos updated for the new public facade options
  - package type-check passed

## 0.1.25

### Patch Changes

- ## Summary

  Moved built-in toolbar popover drag and detached-position restore behavior into the package overlay layer, added recursive declarative custom submenu support for the standard column menu, and made row-index multi-row selection render as one contiguous visual selection block instead of fragmented per-row cells.

  ## User impact

  `DataGrid` consumers now get draggable built-in `Column layout`, `Advanced filter`, and `Find / replace` panels without app-shell glue code, and those panels reopen at their last detached position for the current grid instance during the active page session. Header column menus can now declare nested custom submenu trees through `columnMenu.customItems` / per-column `customItems` with stable typed leaf and submenu contracts. Multi-row selection through the row index now reads visually as one continuous selection surface.

  ## Migration
  - No migration required.
  - Optional adoption:
    - replace flat custom header-menu item lists with nested `kind: "submenu"` entries when you need custom submenu trees,
    - consume the exported `DataGridColumnMenuCustomLeafItem` / `DataGridColumnMenuCustomSubmenuItem` types if your app authors typed menu configs explicitly.

  ## Validation
  - public facade contract coverage updated for draggable built-in overlay panels, nested declarative column-menu submenus, and contiguous row-index selection classes
  - focused contract regressions passed for advanced filter, find/replace, and column layout drag persistence
  - package README updated for draggable built-in overlay panels and nested custom column-menu submenu config
  - package type-check passed

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