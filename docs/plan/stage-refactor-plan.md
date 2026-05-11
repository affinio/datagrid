# DataGridTableStage refactor plan

## [x] Slice 1 — Extract perf tracing

Goal: вынести perf/debug store из `DataGridTableStage.vue`.

Move out:
- perf constants
- `DataGridPerfSample`
- `DataGridPerfStore`
- `resolveDataGridPerfTraceEnabled`
- `recordDataGridPerfSample`
- related helpers
- perf watchers if удобно

Target:
- `src/perf/dataGridPerfTrace.ts`
- optional `useDataGridPerfTrace.ts`

Rules:
- no runtime behavior changes
- no public API changes
- keep query param/localStorage/global store behavior

Validation:
- typecheck
- perf trace still works with `?dgPerfTrace=1`

---

## [x] Slice 2 — Extract runtime diagnostics

Goal: убрать demo-specific/runtime diagnostics из stage.

Move out:
- `emitRuntimeBodyDiagnostics`
- watcher that inspects `region`
- hardcoded sample row `srv-000025`

Target:
- sandbox/demo diagnostics layer
- or optional injected diagnostic callback/composable

Rules:
- production `DataGridTableStage.vue` must not know about `region`
- preserve existing sandbox diagnostics output

Validation:
- typecheck
- server datasource diagnostics panel still shows same fields

---

## [] Slice 3 — Extract chrome canvas renderer

Goal: вынести canvas chrome lifecycle/rendering из stage.

Move out:
- canvas prepare/draw helpers
- DPR helpers
- CSS variable resolvers
- chrome redraw scheduling
- resize observer logic
- `drawGridChromeCanvas`
- `scheduleGridChromeRedraw`
- `flushGridChromeRedraw`

Target:
- `useDataGridStageChromeCanvas.ts`

Rules:
- preserve full redraw vs center-scroll redraw behavior
- preserve pinned left/right/bottom rendering
- preserve pivot header behavior
- do not change visual output

Validation:
- typecheck
- scroll horizontally/vertically
- pinned left/right
- pinned bottom
- pivot header groups
- dark/light theme

---

## [] Slice 4 — Extract chrome model inputs

Goal: отделить вычисление chrome render model inputs от Vue stage body.

Move out:
- row metrics
- pinned bottom row metrics
- row bands
- column width signatures
- `buildEstimatedVisibleRowMetrics`
- `resolveVisibleRowMetricsFromDom`
- `resolveChromeRowBandKind`

Target:
- `useDataGridStageChromeModel.ts`

Rules:
- keep DOM row metrics fallback behavior for auto row height
- no behavior changes
- keep revision/signature watchers working

Validation:
- typecheck
- base mode
- auto row height
- striped rows
- group/tree/pivot rows
- pinned bottom rows

---

## [x] Slice 5 — Extract overlay geometry builder

Goal: вынести generic overlay segment math.

Move out:
- `buildOverlaySegment`
- `buildPaneOverlaySegments`
- `buildPinnedPaneSeamOverlaySegment`
- `buildPinnedPaneSeamOverlaySegments`
- list variants of those helpers
- overlay metric helpers where possible

Target:
- `dataGridStageOverlayGeometry.ts`

Rules:
- pure functions where possible
- no Vue refs inside pure geometry module
- preserve selection/fill/move/custom overlay appearance

Validation:
- typecheck
- single cell selection
- multi-cell selection
- multi-range selection
- fill preview
- move preview
- pinned seam overlays

---

## [x] Slice 6 — Extract overlay composable

Goal: вынести computed overlay lanes from stage.

Move out:
- selection overlay metrics
- fill preview overlay metrics
- move preview overlay metrics
- custom overlay lanes
- pinned bottom overlay lanes

Target:
- `useDataGridStageOverlays.ts`

Rules:
- use geometry helpers from Slice 5
- keep `DataGridTableStage.vue` consuming final segment arrays only
- no visual behavior changes

Validation:
- typecheck
- all overlay scenarios from Slice 5
- custom overlays still render

---

## [] Slice 7 — Extract cell editor/rendering runtime

Goal: вынести cell rendering/editor resolving from stage.

Move out:
- `resolveCellEditorMode`
- select/date/text editor checks
- async select option cache
- `resolveSelectEditorOptions`
- `resolveSelectEditorOptionsLoader`
- `handleSelectEditorOptionsResolved`
- `readResolvedDisplayCell`
- `renderResolvedCellContent`
- row surface context helpers

Target:
- `useDataGridStageCellRendering.ts`

Rules:
- preserve renderer contract
- preserve async select cache behavior
- preserve group row rendering
- preserve interactive cell context

Validation:
- typecheck
- text edit
- select edit
- async select options
- date/datetime edit
- group row renderer
- custom cell renderer
- interactive checkbox/clickable cells

---

## [] Slice 8 — Extract cell state/accessibility helpers

Goal: вынести cell classes and aria helpers.

Move out:
- `builtInCellClasses`
- `cellStateClasses`
- `cellAriaRole`
- `cellAriaChecked`
- `cellAriaPressed`
- `cellAriaLabel`
- `cellAriaDisabled`
- checkbox helpers
- interaction resolver helpers

Target:
- `useDataGridStageCellState.ts`

Rules:
- keep keyboard/accessibility behavior unchanged
- avoid duplicating logic already moved in Slice 7

Validation:
- typecheck
- checkbox cells
- row selection column
- interactive cells
- keyboard navigation
- screen-reader relevant attributes still present

---

## [] Slice 9 — Extract row index runtime

Goal: вынести row index click/keyboard/drag/drop logic.

Move out:
- row index classes
- row index style
- row index tab index
- row index drag state
- row index drag handlers
- row index selection helpers

Target:
- `useDataGridStageRowIndex.ts`

Rules:
- preserve row reorder behavior
- preserve full-row selection visuals
- preserve focus behavior

Validation:
- typecheck
- row index click
- shift row selection
- row reorder drag/drop
- pinned left with row index
- row index hidden mode

---

## [] Slice 10 — Extract fill action UI positioning

Goal: вынести floating fill action menu positioning and behavior.

Move out:
- fill action anchor resolution
- floating fill action left/top
- menu open/close watchers
- focus fill action anchor
- fill action trigger constants

Target:
- `useDataGridStageFillAction.ts`

Rules:
- preserve positioning across center/pinned columns
- preserve viewport clamping
- preserve Escape/outside-click behavior
- preserve focus restoration

Validation:
- typecheck
- normal fill action
- scrolled center viewport
- pinned left/right
- selection partially outside viewport
- non-editable target cell

---

## [] Slice 11 — Extract fill/range move pointer runtime

Goal: вынести fill handle and range move hover logic.

Move out:
- global fill drag cursor logic
- range move hover state
- `isNearRangeMoveSelectionEdge`
- `handleCellMouseMove`
- fill handle mouse down/double click handlers

Target:
- `useDataGridStagePointerInteractions.ts`

Rules:
- preserve cursor behavior
- preserve hover edge detection
- preserve focus-before-drag behavior
- cleanup global cursor on unmount

Validation:
- typecheck
- fill drag
- fill double click
- range move hover
- range move drag
- unmount during fill drag

---

## [] Slice 12 — Extract viewport/scroll sync runtime

Goal: вынести viewport refs, scroll metrics, pinned bottom scroll sync, wheel sync.

Move out:
- body/bottom viewport refs
- viewport metric sync
- header shell/viewport resolving if practical
- linked pane scroll sync setup
- managed wheel scroll setup
- center viewport scroll handler
- pinned bottom scroll handler
- resize listener lifecycle

Target:
- `useDataGridStageViewportRuntime.ts`

Rules:
- preserve direct-transform linked pane sync
- preserve pinned bottom horizontal sync
- preserve wheel behavior
- preserve body viewport ref forwarding

Validation:
- typecheck
- vertical scroll
- horizontal scroll
- mouse wheel
- trackpad
- pinned bottom
- header/body horizontal alignment

---

## [] Slice 13 — Extract pane model builders

Goal: уменьшить `DataGridTableStage.vue` до сборки stage.

Move out:
- `leftPinnedPane`
- `rightPinnedPane`
- `leftPinnedBottomPane`
- `rightPinnedBottomPane`
- `paneLayoutStyle`
- `leftPaneStyle`
- `rightPaneStyle`
- track styles
- center canvas styles if not moved earlier

Target:
- `useDataGridStagePanes.ts`

Rules:
- consume already prepared render APIs and overlay arrays
- no behavior changes
- keep component template props stable

Validation:
- typecheck
- pinned left/right
- hidden row index
- pinned bottom
- layout fill/auto-height

---

## [] Slice 14 — Replace heavy string signatures with revisions

Goal: убрать риск тяжёлых computed signatures.

Targets:
- row metrics signature
- row bands signature
- displayRows diagnostic signature
- any `.map(...).join("|")` watcher over rows/columns where revision exists or can be added

Preferred approach:
- use existing `runtimeRevision`
- use `displayRowsRevision`
- add internal `chromeRevision` / `overlayRevision` only if needed

Rules:
- do not break reactivity
- avoid deep watching row arrays
- do not change public API unless absolutely necessary

Validation:
- typecheck
- scrolling still redraws chrome
- row updates redraw overlays/chrome
- selection updates overlays
- column resize/reorder redraws chrome
- benchmark before/after if harness exists

---

## [] Slice 15 — Final stage cleanup

Goal: сделать `DataGridTableStage.vue` orchestration-only.

Expected result:
- template mostly unchanged
- script contains:
  - props/context setup
  - composable wiring
  - render API assembly
  - lifecycle cleanup orchestration only if needed

Rules:
- no feature changes
- no public API changes
- no visual changes
- keep file readable and stable

Validation:
- typecheck
- unit tests if available
- relevant interaction tests
- sandbox manual pass:
  - scroll
  - edit
  - select
  - fill handle
  - range move
  - row index selection
  - row reorder
  - pinned left/right
  - pinned bottom
  - custom overlays
  - group/tree/pivot
  - server datasource demo

---

# Suggested order

1. Slice 1
2. Slice 2
3. Slice 5
4. Slice 6
5. Slice 3
6. Slice 4
7. Slice 7
8. Slice 8
9. Slice 9
10. Slice 10
11. Slice 11
12. Slice 12
13. Slice 13
14. Slice 14
15. Slice 15
