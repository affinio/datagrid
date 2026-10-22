# @affino/datagrid-vue

## Unreleased

### Added

- Moved built-in diagnostics, formula packs/runtime controls, and workload presets into the standard DataGrid app API; these options no longer require a separate package or license key.

### Removed

- Removed the separate enterprise Vue app, diagnostics, and formula extension packages after migrating their supported functionality to the ordinary Vue and formula-engine packages.

## 0.12.0

### Added

- Exposed cell activation through the runtime adapter, including projection-aware resolution, viewport reveal, cancellation, and optional focus or selection behavior.

## 0.11.0

### Added

- Integrated row-selection drag sessions with pointer arbitration, preview updates, autoscroll, cancellation, and commit lifecycle callbacks for the app stage.

## 0.10.5

### Changed

- Updated the optional theme dependency compatibility for `@affino/datagrid-theme@0.4.0`.

## 0.10.4

### Fixed

- Preserved grouped row presentation and viewport updates through the Vue adapter.

## 0.10.3

### Fixed

- Applied viewport updates during row-height changes so the grid responds continuously while rows are resized instead of repositioning only after pointer release.

### Validation

- Vue adapter type-check and the enterprise app package test suite passed.

## 0.10.2

### Fixed

- Released the group-boundary resize initialization fix from `@affino/datagrid-orchestration@0.7.1` through the Vue adapter dependency chain.

### Validation

- Vue public build, type checks, and adapter contracts passed.

## 0.10.1

### Fixed

- Excluded trailing visual placeholder rows from Ctrl+A selections.

## 0.10.0

### Changed

- Released the Vue adapter against `@affino/datagrid-orchestration@0.7.0` and the aligned worker package, so npm consumers receive the updated orchestration without overrides.
- Ctrl+A now excludes trailing visual placeholder rows while preserving their normal keyboard navigation and editing behavior.

### Validation

- Public build, type checks, and strict adapter contracts passed.

## 0.9.0

### Added

- Re-exported the exact `rows:edited` delta event and source option through the Vue runtime API.
- Re-exported the server selection-summary datasource contracts.
- Aligned the orchestration and worker dependencies with DataGrid core 0.9.0.

### Validation

- Vue type check and public build passed.


## 0.7.0

### Minor Changes

- Exposed the completed DataGrid core mutation and state contracts through the
  Vue runtime API, including row-ID lookup, deletion, formula lifecycle,
  mutation batching, and atomic local state restoration.

### Validation

- Public Vue build, typecheck, adapter contracts, and package packing passed.

## 0.6.0

### Minor Changes

- Added bounded zero-width and wide-grid column virtualization contracts.
- Added logical viewport restore support for sparse million-row datasets.
- Preserved DOM-compatible worker transport targets and aligned worker/pivot package contracts.

### Validation

- Public Vue build and type-check passed.
- Focused viewport contracts passed.
- Browser acceptance remains CI Chromium dependent.


## 0.5.1

### Patch Changes

- Fixed published ESM runtime specifiers and aligned the release with `@affino/datagrid-pivot@0.1.3`.
## 0.5.0

### Minor Changes

- ## Summary

  Improved DataGrid Vue runtime performance around scroll/render synchronization, projection refreshes, selection overlays, and server-backed operation paths.

  ## User impact

  Vue DataGrid consumers should see smoother large-grid interaction and more stable behavior under high-frequency scrolling, filtering, and server datasource churn.

  ## Migration
  - No migration required.

  ## Validation
  - datasource churn, tree workload, benchmark report, and perf-contract gates passed

### Patch Changes

- ## Summary

  Routed unloaded server-backed clear and range-move operations through datasource `executeOperation(...)`, while keeping materialized and client-grid paths local.

  ## User impact

  Server-backed grids can clear and move ranges that include unloaded rows when the backend exposes the delegated operation contract. Stale, grouped, and unsupported ranges remain blocked.

  ## Migration
  - No migration required.
  - Optional adoption: provide `executeOperation(...)` on server-backed row models for unloaded clear/range-move support.

  ## Validation
  - focused interaction controller contracts and package type-check passed

- ## Summary

  Extended the shared app-selection and clipboard composables to support committed multi-range selection, additive Ctrl/Cmd selection flows, and aggregate recomputation from effective selection values after row-model changes. The unreleased clipboard surface now also accepts explicit paste modes so downstream facades can route `Paste special` variants through the same shared pipeline.

  ## User impact

  Consumers composing custom renderers on top of `@affino/datagrid-vue` can now keep multiple committed cell ranges visible/queryable, preserve copied-range visuals across all committed ranges, and recompute selection summaries after in-range edits without forcing a full grid remount. Ctrl/Cmd is now reserved for additive selection instead of conflicting with range-move intent. Clipboard integrations can also distinguish ordinary paste from values-only paste without forking the base copy/paste implementation.

  ## Migration
  - No migration required.
  - Optional adoption:
    - read all committed ranges through `resolveSelectionRanges()` when custom overlays or clipboard UI should mirror multi-range state,
    - pass `readSelectionCell` into `useDataGridAppSelection(...)` when aggregate labels should use effective values,
    - treat `Alt` as the range-move modifier if you previously overloaded Ctrl/Cmd in custom pointer flows,
    - pass an explicit paste mode into `pasteSelectedCells(...)` when custom menus or shortcuts need values-only paste semantics.

  ## Validation
  - focused contracts passed for `useDataGridAppCellSelection`, `useDataGridAppClipboard`, `useDataGridAppSelection`, and the context-menu action router proxy
  - pointer-down and pointer-modifier regressions passed in the shared composable suite
  - downstream stage and workbook regressions passed

## 0.3.16

### Patch Changes

- ## Summary

  Added placeholder-aware app runtime hooks across clipboard, inline editing, and interaction control so downstream facades can lazily materialize editable rows during edit, paste, toggle, and range-move flows without breaking focus restoration or history capture.

  ## User impact

  Consumers building on the Vue app/runtime composables can now support Excel-like visual placeholder tails with stable edit and clipboard semantics. Paste and drag-move flows can materialize target rows on demand, and the runtime now records whole-mutation snapshots for these mixed materialized/visual interactions instead of relying on precomputed row-id subsets.

  ## Migration
  - No migration required.
  - Optional adoption:
    - pass `ensureEditableRowAtIndex(...)` when composing `useDataGridAppClipboard(...)`, `useDataGridAppInlineEditing(...)`, or `useDataGridAppInteractionController(...)` around lazily materialized rows.

  ## Validation
  - downstream app facade and stage regressions updated for placeholder-row materialization paths
  - targeted placeholder viewport synchronization regression passed
  - targeted drag-move into placeholder-tail regression passed

## 0.3.8

### Patch Changes

- ## Summary

  Added the typed row-selection event path to the Vue package surface and aligned package-level exports with the canonical core selection event payload types.

  ## User impact

  Vue consumers can use the typed `row-selection-change` event flow and import the related selection event payload types from the stable Vue package surface.

  ## Migration
  - No migration required.
  - Optional adoption:
    - prefer `row-selection-change` for row checkbox/header selection flows,
    - keep `selection-change` for general cell/range selection flows.

  ## Validation
  - `pnpm --filter @affino/datagrid-vue build`
  - Vue bridge/app contract coverage updated

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

# Historical releases of the former @affino/datagrid-vue-app package

## 0.19.0

### Added

- Added external filter indicators and explicit saved-view capture and restore options with validation and interaction conflict handling.
- Added separate record selection and row-header cell-selection behaviors, including whole-row fill feedback for selected records.

## 0.18.0

### Added

- Added configurable row-header actions, selectable-row policy, modifier-aware record selection, Shift+keyboard ranges, and drag range selection in the table stage.

### Fixed

- Made the table stage own its border directly so panes cannot paint over the rounded frame; removed the duplicate rounded clipping shell from the row-selection example.

## 0.17.0

### Added

- Added opt-in root-only sticky group rows with push-off behavior across pinned and center panes.
- Added an opt-in hierarchy column that renders group labels and counts with leaf values from a configured source column.
- Added theme-backed toolbar styling and hierarchy indentation.

### Validation

- Vue app type-check, focused unit/contract tests, and sandbox E2E checks passed.

## 0.16.1

### Changed

- Improved grouped-row rendering, placeholder surfaces, and viewport handling in the grid stage.

## 0.16.0

### Removed

- Removed deprecated `DataGridColumnMenuLabels.valuesWindowSummary`; the value filter no longer renders the visible-window scroll hint.

### Added

- Added async state persistence adapters (`load`/`save`), persistence status events, and `resetPersistedState()` for local, session, or application-managed storage.
- Added flexible column sizing so visible columns can use available host width as ordering, pinning, and visibility change.
- Added keyboard column resizing and header auto-scroll near the viewport edge.

### Changed

- Simplified host-height behavior and keep the grid viewport and row-height layout synchronized during resize interactions.
- Compactened column filter menus, clarified the “Filter by value” action, and simplified quick-filter presentation.
- Empty states no longer draw body grid lines through the message.

### Validation

- Enterprise app type-check and unit suite passed; focused grid contracts and sandbox regressions were added for the updated behavior.

## 0.15.0

### Added

- Keyboard navigation can enter leaf headers from the first body row, select full columns, extend ranges across headers with Shift+Left/Right, and return to cell selection with ArrowDown. The system select-all header supports Enter/Space and ArrowDown moves to the first row checkbox.

### Validation

- Vue app type-check, stage keyboard contracts, and browser regressions for header/body navigation, checkbox focus, cell ranges, and multi-column header selection pass.

## 0.14.4

### Fixed

- Reactive document and `theme` prop changes now invalidate the cached canvas palette and coalesce into a full chrome redraw, updating pinned headers, body panes, and pinned-bottom canvases without resetting grid state. Equal effective tokens do not schedule a redraw.

### Validation

- Vue app type-check, focused theme/canvas contracts, sandbox type-check, and browser pixel regressions for document attributes, class-based dark mode, reactive and fixed theme props, multiple grids, scrolled selection, and pinned-bottom panes pass.

## 0.14.3

### Performance

- Shared vertical scrolling captures offsets and viewport dimensions before updating pane styles, avoiding duplicate scroll reads and a possible synchronous layout flush in the scroll handler.

### Fixed

- Checkbox indicators in virtualized rows no longer animate between recycled row values while the body is scrolling, preventing flicker in pinned panes. Their normal state transition resumes when scrolling becomes idle.

### Validation

- Vue app style contracts and the grouped-header-grid browser regression pass. Sandbox production build completed for the browser check.

## 0.14.2

### Fixed

- Group header bands now keep stable identities across horizontal virtualization windows and retain measured label widths, preventing grouped text from unmounting or flashing during fast scroll.
- Columns without a title at the trailing group levels (including the row index and ungrouped columns) span those empty levels so the header content remains vertically centered without blank horizontal dividers.
- System checkbox headers use the same header surface as neighboring columns, and canvas-backed grouped headers draw one vertical divider per boundary with the shared header divider color.
- Newly visible grouped-header labels render immediately with a bounded first-frame width while their precise text width is measured.
- Untitled leaf headers such as Extra columns now paint above empty group bands, keeping their vertically centered labels visible.
- The center horizontal scroll owner and grid stage suppress horizontal boundary overscroll to prevent a left-edge trackpad gesture from triggering browser back navigation.

### Validation

- Vue app type-check, package build, focused scroll/header contracts, and grouped-header browser regressions passed.

## 0.14.1

### Fixed

- Grouped header labels now update their clipped position from the same center-scroll event, removing the extra animation-frame delay that made labels appear to flicker during fast horizontal scrolling.

### Validation

- Rapid grouped-header scroll browser regression and stage contract tests passed.

## 0.14.0

### Changed

- Grouped header labels stay within the visible portion of their own group as horizontal scrolling clips its child columns, and use ellipsis when the visible fragment is narrow.
- Added a small default inset before group label text and accessible group-boundary resize handles that resize the group's last visible leaf column through the existing resize and persistence path.
- Header and body horizontal scrollports now remain aligned across rerenders, viewport resizing, pinned panes, and classic vertical scrollbars. Header width follows the measured body scrollport width.
- Group-boundary resize now starts at the current leaf width to avoid a jump on initial pointer movement.

### Validation

- Group geometry and mounted stage contracts pass, including pinned panes and choosing the final leaf column for group resize.
- Vue app type checks, build, unit/contract suite, and focused browser synchronization checks pass.
- Release uses `@affino/datagrid-orchestration@0.7.1` and `@affino/datagrid-vue@0.10.2`.

## 0.13.1

### Fixed

- Ctrl+A followed by Ctrl+C now copies data rows without visual placeholders.

## 0.13.0

### Changed

- Aligned the app package with `@affino/datagrid-vue@0.10.0`, which depends on the updated DataGrid orchestration release.
- The stage fallback for Ctrl+A now uses data-row bounds and excludes appended visual placeholder rows from clipboard selections.

### Validation

- Vue app build, type checks, and packed consumer type checks passed.

## 0.12.0

### Added

- Added the typed `data-change` event for committed edits across inline editing, clipboard, fill, find/replace, checkbox, Gantt, and history replay paths.
- Documented explicit ID-based insert, remove, and edit calls through `getApi()`.
- Aligned the optional Gantt peer to 0.2.0, which depends on DataGrid core 0.9.0.

### Validation

- Vue app type checks, package build, consumer type checks, mounted component contracts, and core row-delta contracts passed.


## 0.11.2

### Added

- Added `emptyStateAlignment="viewport"` to center empty-state content within the visible center table viewport during horizontal scrolling. The default `content` alignment remains backwards compatible.

### Validation

- Added public contract coverage for wide, filtered, pinned-column, fill, and auto-height layouts.

## 0.11.1

### Fixes

- Forwarded the public `emptyState` renderer explicitly through the runtime host so datasource-backed empty states render inside the grid body at runtime.

### Validation

- Added a public `DataGrid` DOM contract covering datasource empty results and renderer invocation.

## 0.11.0

### Added

- Added the typed `emptyState` renderer for empty client-side and server-backed
  grids, including distinct no-rows and filtered-empty states.
- Added accessible empty-state styling hooks through public CSS custom
  properties.

## 0.10.1

### Fixes

- Rebuilt the published package with the public getServerSelectionSummary() API.

### Added

- Added DataGridExposed.getServerSelectionSummary() for datasource-backed aggregates over selected ranges without requiring unloaded rows.


## 0.9.2

### Fixes

- Added the public `serverHistory` prop. Set it to `false` for datasource-backed read-only grids to skip server history status requests, subscriptions, and undo/redo calls while keeping local `history` independent.

### Validation

- DataGrid server-history lifecycle contract tests passed.

## 0.9.1

### Fixes

- Removed the remaining root declaration path that loaded Gantt types through
  saved-view types when the optional Gantt peer was not installed.

### Validation

- Packed base and Gantt consumers type-check successfully without and with the
  optional peer respectively.

## 0.9.0

### Fixes

- Kept the optional Gantt peer out of the root TypeScript declaration graph;
  Gantt types remain available through `@affino/datagrid-vue-app/gantt`.

### Validation

- Package build, type-check, entrypoint contracts, and isolated base/Gantt
  consumer type checks passed.

## 0.8.0

### Minor Changes

- Aligned the application package release with the completed DataGrid public
  API contract exposed by the core and Vue runtime packages.
- Guarded pointer-interaction scope cleanup so headless composable tests and
  non-component consumers do not emit Vue scope warnings.

### Validation

- Root application build, typecheck, shell contract tests, and package packing passed.

## 0.7.0

### Breaking Changes

- The root entry no longer loads the Gantt runtime. Gantt consumers should import `DataGrid` from `@affino/datagrid-vue-app/gantt`.

### Changes

- Moved Gantt stage registration behind the optional `/gantt` subpath.
- Made `@affino/datagrid-gantt` an optional peer dependency for the package root.
- Added root and Gantt entrypoint isolation checks to prevent optional runtime leakage and circular initialization regressions.

### Validation

- Root and Gantt ESM builds pass.
- Package type-check and 42 test files / 467 tests pass.
- Ordinary-table production Vite build passes without Gantt runtime.

## 0.6.0

### Minor Changes

- Added opt-in worker columnar numeric payloads for the production-shaped worker grid route.
- Added bounded wide-grid bootstrap behavior and authored renderer defer contracts.
- Added app input patch mode coverage for immutable same-shape updates.

### Validation

- Production build and declaration generation passed.
- Perf contract gate passed: 61/61 checks.
- Browser frame and heap measurements remain CI Chromium dependent.


## 0.5.1

### Patch Changes

- Fixed packed runtime resolution and bundled required menu/popover implementation for the public app entry.
## 0.5.0

### Minor Changes

- ## Summary

  Improved app-stage DataGrid performance for large viewport scrolling, pinned-pane synchronization, overlay/chrome rendering, quick-filter/data-source flows, and benchmark telemetry.

  ## User impact

  App-level DataGrid integrations get smoother large-grid UX and more predictable server-backed workflows without migration work.

  ## Migration
  - No migration required.

  ## Validation
  - datasource churn, tree workload, benchmark report, and perf-contract gates passed

### Patch Changes

- ## Summary

  Wired server-backed clipboard operations to datasource `executeOperation(...)` for unloaded copy/cut/paste ranges in the app stage runtime.

  ## User impact

  App-level server grids can delegate clipboard work over unloaded rows to the backend when the active row model is server-backed. Client grids and materialized ranges continue using the existing local paths.

  ## Migration
  - No migration required.
  - Optional adoption: expose `executeOperation(...)` on the server datasource to enable unloaded clipboard operations.

  ## Validation
  - package type-check passed

- ## Summary

  Added native quick-filter apply timing controls to the app shell. `quick-filter` now supports `applyMode: "input" | "debounce" | "manual"` plus `debounceMs`; manual mode shows built-in Apply/Clear controls while still committing only to `filterModel.quickFilter`.

  ## User impact

  Data-source-backed row models can avoid one `filter-change` pull per keystroke by using debounced or manual quick-filter commits.

  ## Migration
  - No migration required. The default `applyMode` remains `"input"`.

  ## Validation
  - targeted quick-filter contracts passed for input, debounce, manual, controlled, and external data-source row model behavior

- ## Summary

  Fixed the declarative advanced-filter toolbar path when `DataGrid` uses an external data-source row model. Applying the panel now forwards the freshly built `advancedExpression` snapshot directly through `rowModel.setSortAndFilterModel(...)`.

  ## User impact

  Apps using `:row-model="createDataSourceBackedRowModel(...)"` with `advanced-filter` now trigger server pulls with the real `filterModel.advancedExpression` instead of a stale `null` expression.

  ## Migration
  - No migration required.

  ## Validation
  - targeted advanced-filter contract coverage passed for external data-source row model request propagation

- ## Summary

  Fixed the declarative quick-filter toolbar path when `DataGrid` uses an external data-source row model. Quick filter input now applies the freshly built `filterModel.quickFilter` snapshot directly to `rowModel.setSortAndFilterModel(...)`, so data-source-backed row models see a `filter-change` pull instead of a stale `null` filter model.

  ## User impact

  Apps using `:row-model="createDataSourceBackedRowModel(...)"` with `:quick-filter="{ columns, mode }"` now trigger server pulls on quick-filter input and clear actions without requiring a controlled `filter-model` or `state` prop.

  ## Migration
  - No migration required.

  ## Validation
  - targeted quick-filter contracts passed for external data-source row model request propagation and existing controlled/uncontrolled quick-filter behavior

- ## Summary

  Added the declarative `quick-filter` shell control and `@affino/datagrid-vue-app/quick-filter` entrypoint. The toolbar input writes to the existing `filterModel.quickFilter` snapshot and can sit next to `advanced-filter` without introducing a separate quick-filter state channel.

  ## User impact

  Vue app consumers can enable grid-wide text filtering with `quick-filter` or configure it with `:quick-filter="{ placeholder, columns, mode }"`. Controlled consumers can continue to manage `filterModel.quickFilter` directly.

  ## Migration
  - No migration required.
  - Optional adoption: replace custom toolbar quick-filter inputs with the declarative `quick-filter` prop.

  ## Validation
  - DataGrid app facade contract coverage passed for boolean and object quick-filter props, typing behavior, clear behavior, controlled filter-model compatibility, and default searchable column resolution
  - sandbox client and server data-source demos were migrated to the declarative shell prop

- ## Summary

  Documented and wired the app-facing quick filter path through the existing controlled `filterModel` contract. The default renderer now preserves `quickFilter` when built-in filter controls update column or advanced filters, and the sandbox demos expose quick filter controls for client and server data-source scenarios.

  ## User impact

  Vue app consumers can control grid-wide text filtering by passing `filterModel.quickFilter`; the declarative `quick-filter` shell control added later remains a convenience wrapper over that same snapshot. The app facade keeps quick filter aligned with the core row-model projection pipeline and with server/data-source serialization.

  ## Migration
  - No migration required.
  - Optional adoption: control quick filtering with `filter-model.quickFilter` and keep any debounce in UI code, not in core.

  ## Validation
  - DataGrid app facade contract coverage passed for controlled quick filter, clear behavior, and preserving quick filter while built-in filter controls update the model
  - sandbox type-check passed
  - known existing sandbox component-test failures remain unrelated to quick filter docs/UI

- ## Summary

  Added typed facade helpers to the public app package surface, promoted explicit `readFilterCell` / `readSelectionCell` hooks into the declarative `DataGrid` facade, and tightened stage rendering so multi-range selection, copied-range visuals, effective-value filter menus, and committed selection overlays stay aligned across pinned panes and workbook-style flows. This unreleased patch also expands the native `cellMenu` surface with declarative custom items, nested submenus, and a built-in `Paste special` section.

  ## User impact

  Application teams can now author typed `DataGrid` wrappers with `defineDataGridComponent`, `defineDataGridColumns`, typed cell readers, and `useDataGridRef` directly from the package root. Declarative column menus and selection summaries can reflect formula/display values rather than raw source fields, while multi-range selection and copy visuals remain stable in spreadsheet-style scenarios. Cell context menus now follow the same native configuration direction as header menus, including per-column custom items, nested submenu trees, and standard `Paste special -> Values only` behavior.

  ## Migration
  - No migration required.
  - Optional adoption:
    - use `defineDataGridComponent<TRow>()`, `defineDataGridColumns<TRow>()`, and `useDataGridRef<TRow>()` for row-typed wrappers or render-function usage,
    - pass `readFilterCell` when column-menu value filters should use effective values,
    - pass `readSelectionCell` when aggregate labels and `getSelectionSummary()` should use displayed/formula values,
    - migrate cell context-menu extension code to declarative `cellMenu.customItems` / `cellMenu.actions` when native menu composition is sufficient,
    - enable the built-in `pasteSpecial` section when spreadsheet-like values-only paste should stay inside the standard context-menu pipeline.

  ## Validation
  - public facade contract coverage updated for typed facade helpers, effective-value readers, declarative cell-menu submenu composition, and native paste-special actions
  - focused stage contracts passed for multi-range overlay segments and selection classes
  - spreadsheet workbook regressions passed for aggregate overlay, Cmd-click additive selection, and full-column header selection

## 0.1.28

### Patch Changes

- ## Summary

  Slimmed the root app entry so heavy optional surfaces no longer have to ride the default runtime path, aligned modified-arrow keyboard selection with Excel-style expansion semantics, and promoted header drag reorder into the package-level grid surface with selection/focus continuity.

  ## User impact

  The base `DataGrid` entry now keeps gantt-specific runtime code behind a lazy boundary instead of pulling `@affino/datagrid-gantt` into ordinary table usage. Optional heavy UI surfaces are now easier to consume as explicit package entrypoints, including the new `@affino/datagrid-vue-app/aggregations` subpath alongside the existing `gantt`, `advanced-filter`, and `find-replace` entries. In grid interaction, `Shift+Ctrl/Cmd+Arrow` now extends the current range in the requested direction until the first blank gap, matching the expected Excel-like keyboard workflow for contiguous data blocks. Header drag reorder is now also available declaratively through `columnReorder`, including cross-pin moves between left, center, and right lanes; after reorder, the active cell and keyboard focus stay attached to the moved logical column instead of drifting with the old visual column index.

  ## Migration
  - No migration required.
  - Optional adoption:
    - import feature-specific surfaces from subpaths when you want stricter bundle boundaries around gantt, aggregations, advanced filter, or find/replace UI,
    - keep consumer-side chunk tuning only as an optimization layer; the package root no longer requires it as a workaround for gantt coupling,
    - rely on `Shift+Ctrl/Cmd+Arrow` for contiguous range expansion in spreadsheet-like keyboard flows,
    - enable `columnReorder` when header drag-and-drop should be available from the package surface, including cross-pin moves.

  ## Validation
  - `@affino/datagrid-vue-app` type-check passed
  - `@affino/datagrid-vue-app` build passed and the base `dist/index.js` no longer statically imports `@affino/datagrid-gantt`
  - focused `@affino/datagrid-vue` keyboard-navigation contracts passed for modified-arrow range extension
  - focused `@affino/datagrid-vue-app` facade contracts passed for package-level header drag reorder, continuity after reorder, and cross-pin moves

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
  - Optional adoption: use `row-selection-state` / `rowSelectionState` with `update:rowSelectionState` when a host page wants a stable controlled selected-row snapshot without diffing `row-selection-change` and unified-state emissions.

  ## Validation
  - public facade contract updated for `toolbarModules`
  - built-in app renderer now derives effective sort/filter/group/pivot UI state from unified state and imperative saved-view restores
  - imperative state and saved-view restores queue until runtime columns are ready
  - saved views sanitize transient transaction snapshots before persistence
  - controlled `rowSelectionState` contract covered by facade contract tests
  - package README and shared docs updated
  - sandbox demo + focused spec added
