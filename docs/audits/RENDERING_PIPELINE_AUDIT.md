# DataGrid Rendering Pipeline Enterprise Audit

## Executive Summary

The DataGrid rendering architecture has a strong production foundation. The current design keeps viewport math, row/column windowing, stage rendering, chrome drawing, and overlay geometry in separate modules, and the main scroll path already uses passive scroll input plus rAF batching for viewport commits, pinned-pane transforms, pinned-bottom scroll sync, and canvas chrome redraw.

The system does not need a parallel rendering architecture. The enterprise gaps are narrower: custom renderer isolation, scroll-time lightweight rendering, render churn telemetry, expensive diagnostics and signature work in hot paths, duplicated center/pinned cell templates, and browser/performance gates that prove large and wide tables stay within frame budget.

Current enterprise readiness is **7/10**. A realistic target is **9/10** after hardening renderer contracts, adding blank/churn/frame telemetry, proving custom-renderer behavior under scroll, and adding focused browser gates for pinned panes, overlays, auto-height rows, and wide horizontal virtualization.

## Current Architecture Summary

- `datagrid-core` owns viewport render synchronization and model-boundary services. `dataGridViewportRenderSyncService.ts` applies explicit sync targets and transform state, while `dataGridViewportModelBridgeService.ts` separates row/column model invalidation from viewport-only access.
- `datagrid-vue` owns app-level viewport windows used by the stage. `useDataGridAppViewport.ts` computes `displayRows`, rendered columns, row and column spacers, retained row/column windows, adaptive/touch overscan, viewport position snapshots, and rAF viewport commits.
- `datagrid-vue-app` owns the DOM and canvas stage. `DataGridTableStage.vue` composes center body, pinned panes, pinned bottom panes, chrome canvases, overlays, editors, and interaction wiring.
- Center and pinned pane body cells are DOM-rendered in `DataGridTableStageCenterPane.vue` and `DataGridTableStagePinnedPane.vue`. Row keys use `row.rowId`; cell keys combine `row.rowId` and `column.key`.
- `useDataGridStageCellRendering.ts` resolves display values, editor mode, async select options, placeholder surface context, group render context, and public `cellRenderer`/`groupCellRenderer` invocation.
- `useDataGridStageChromeModel.ts` builds canvas render models for body, header, and pinned bottom chrome. `useDataGridStageChromeCanvas.ts` draws row bands and grid lines on canvas, with device-pixel alignment.
- `useDataGridStageOverlays.ts` builds DOM overlay segments for selection, fill preview, move preview, pinned seams, pinned bottom rows, and custom overlays.
- Existing docs support this architecture: `docs/datagrid-architecture.md` assigns core viewport/geometry ownership to core, Vue rendering ownership to the wrapper/app layer, and discourages duplicated virtualization math; `docs/MOBILE_TOUCH_SCROLL_AUDIT.md` identifies lightweight cell rendering while scrolling as remaining work.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/MOBILE_TOUCH_SCROLL_AUDIT.md`
- `docs/perf/datagrid-performance-gates.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- `docs/datagrid-model-contracts.md`
- `docs/datagrid-cell-refresh-api.md`

Core viewport and render sync:

- `packages/datagrid-core/src/viewport/dataGridViewportRenderSyncService.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportModelBridgeService.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportEnvironment.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportConfig.ts`
- `packages/datagrid-core/src/viewport/__tests__/renderSync.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/perfHotPath.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/scrollSync.raf.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/scrollResizeDeterminism.contract.spec.ts`

Vue app viewport and rendering:

- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppViewport.contract.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppViewport.bench.ts`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridCellContentRenderer.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRenderApis.grouped.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRowState.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePanes.grouped.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeModel.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageOverlays.ts`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageOverlayLayer.vue`
- `packages/datagrid-vue-app/src/stage/dataGridStageOverlayGeometry.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageCellRendering.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageChromeModel.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageViewportRuntime.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageOverlays.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/dataGridChromeCanvasMath.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/dataGridStageOverlayGeometry.spec.ts`

## Strengths

- Render ownership is mostly explicit. `DataGridTableStage.vue` composes the stage, `useDataGridAppViewport.ts` owns the app-level rendered window, and the pane components own DOM row/cell output.
- The scroll input path is intentionally light. `DataGridTableStageCenterPane.vue` uses a passive body scroll handler, while `useDataGridAppViewport.ts` caches viewport dimensions and defers viewport commits into `requestAnimationFrame`.
- rAF batching exists at both viewport and stage levels. `useDataGridAppViewport.ts` batches row/column window commits; `useDataGridStageViewportRuntime.ts` batches scroll refs, pinned pane transforms, pinned-bottom scroll sync, and chrome redraw.
- Row and cell identity are stable for ordinary body rendering. Center cells key by `row.rowId` plus `column.key`; pinned cells include pane side as well.
- Horizontal rendering scales better than a full-table DOM. `useDataGridAppViewport.ts` uses prefix widths, binary search, spacer widths, active horizontal overscan, and idle precise sync for rendered columns.
- Chrome rendering is separated from cells. `useDataGridStageChromeCanvas.ts` draws row bands and grid lines to canvas instead of adding per-cell divider DOM.
- Canvas drawing is device-pixel-aware. `dataGridChromeCanvasMath` is used by `useDataGridStageChromeCanvas.ts`, and tests cover line alignment.
- Overlay rendering is separated from cell content. `useDataGridStageOverlays.ts` builds lane/segment models, and `DataGridTableStageOverlayLayer.vue` renders overlays independently of cells.
- Auto-height row metrics are handled deliberately. `useDataGridStageChromeModel.ts` can derive visible row metrics from DOM only in base auto-height mode, with fallback estimated metrics.
- Placeholder rows are visible to renderers. `useDataGridStageCellRendering.ts` passes a `surface.kind` of `placeholder` or `real` to public renderers.
- Existing tests cover key slices: stage cell rendering, chrome model, overlay geometry, viewport runtime rAF behavior, viewport window math, scroll dimension read discipline, core render sync, and hot-path viewport contracts.

## Findings By Severity

### Blocker

1. **No explicit enterprise render-frame gate for custom renderers.**
   `useDataGridStageCellRendering.ts` invokes public `cellRenderer` and `groupCellRenderer` synchronously during Vue render, and `DataGridCellContentRenderer.ts` is a direct VNode passthrough. Existing tests verify renderer output, not scroll-frame budget, slow renderer detection, error isolation, or mount churn. This blocks an enterprise performance claim for custom-renderer-heavy grids.

2. **No explicit enterprise render-frame gate for lightweight custom-renderer scroll.**
   `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md` now records touch scroll lightweight rendering as implemented: while the stage is in touch mode and the body viewport is actively scrolling, custom cell/group renderers are bypassed in favor of resolved display values. Remaining risk is budget enforcement for custom-renderer-heavy scroll scenarios, especially pinned panes, auto-height rows, and wide windows.

### High

1. **Custom renderer isolation is partially hardened.**
   `useDataGridStageCellRendering.ts` passes row, row node, surface, interaction handlers, display value, and group controls directly into user renderers. Public renderer expectations now document pure output, no grid-state mutation during render, synchronous layout-read avoidance, stable child VNode keys, bounded per-cell work, placeholder-aware `surface.kind`, and scroll-time cost expectations. Runtime error fallback is in place for `cellRenderer` and `groupCellRenderer`, so authored renderer exceptions fall back to the resolved display value without breaking the grid render tree. Remaining gaps are slow-render sampling and browser-frame budgets.

2. **Center pane diagnostics are guarded when disabled.**
   `DataGridTableStageCenterPane.vue` now skips diagnostic dependency sampling and body/value debug construction unless `reportCenterPaneDiagnostics` is provided. Regression coverage verifies disabled diagnostics do not add custom renderer calls. Remaining render-pipeline cost work is custom renderer isolation, render churn telemetry, and browser gates.

3. **Mount/unmount churn is measured in the virtualization browser gate.**
   Virtualization limits DOM size, but center/pinned cells remount as `displayRows` and rendered columns change. `dgPerfTrace=1` now reports render-window composition and custom renderer invocation samples, and the enterprise browser-frame benchmark extracts those aggregates. The same browser-frame diagnostics now expose `churnTelemetry` with row/cell mount and unmount counts plus per-scroll-write rates, and `bench:datagrid:enterprise:virtualization:assert` wires hard budgets for row/cell churn.

4. **Center and pinned pane cell templates duplicate rendering logic.**
   `DataGridTableStageCenterPane.vue` and `DataGridTableStagePinnedPane.vue` both render row state classes, cell state classes, editors, checkbox cells, and `DataGridCellContentRenderer`. This is not broken, but it raises drift risk and makes renderer lifecycle changes harder to apply consistently.

5. **Selection/fill/move overlay recomputation is broad for large visible windows.**
   `useDataGridStageOverlays.ts` scans visible rows and visible columns through `resolveVisibleBounds(...)` for selection/fill predicates, then computes many pane-specific overlay segment sets. The work is bounded by the rendered window, but it is not currently budgeted or sampled during drag/scroll.

### Medium

1. **Per-cell render helpers allocate many short-lived objects and closures.**
   `useDataGridStageRenderApis.grouped.ts`, `useDataGridStageCellState.ts`, `useDataGridStageRowState.ts`, and `useDataGridStageCellRendering.ts` return class/style objects, ARIA values, render contexts, and interactive closures from template-called functions. This is typical Vue code, but it needs telemetry under wide rendered windows and custom renderers.

2. **Canvas chrome redraw is well separated and now sampled.**
   `useDataGridStageViewportRuntime.ts` flushes chrome redraw in the scroll frame, and `useDataGridStageChromeCanvas.ts` may redraw center/header/bottom canvases. The code supports `center-scroll` redraw mode, and `dgPerfTrace=1` now emits `chromeDraw` samples with redraw mode, draw duration, drawn pane count, line counts, and band counts. Enterprise readiness still needs hard budgets and long-task correlation from browser gates.

3. **Auto-height rendering uses layout reads by design.**
   `useDataGridStageChromeModel.ts` calls `getBoundingClientRect()` for visible rows in base auto-height mode. That is supported behavior, not a defect. The risk is layout thrash if auto-height measurement combines with custom renderers, resize, or fast scroll without a measured budget.

4. **Async select renderer/editor cache has no visible eviction policy.**
   `useDataGridStageCellRendering.ts` stores async select options in a `Map` keyed by row/column. This protects repeated option resolution, but high-churn virtual rows can grow cache memory unless lifecycle or cap semantics are documented.

5. **Pinned panes multiply DOM and overlay cost by design.**
   `DataGridTableStagePinnedPane.vue` renders separate DOM rows/cells for pinned columns and pinned bottom panes. This is the correct architecture for frozen panes. `stageRenderWindow`, `chromeDraw`, and `overlayCompute` samples now make pinned-left plus pinned-right plus center DOM, chrome, and overlay work visible in browser-frame artifacts.

6. **Style/signature strings are computed from visible rows/columns.**
   `useDataGridStageChromeModel.ts` computes row metrics signatures, row band signatures, and column signatures. These are useful invalidation boundaries, but they should stay out of raw scroll handling and be sampled in perf traces for large windows.

### Low

1. **`DataGridCellContentRenderer.ts` adds a tiny component boundary.**
   It is intentionally simple and returns `props.content`. The overhead is likely small, but it should be included in render-count profiling before adding more wrapper components.

2. **Column reorder/hide/show remount behavior is not documented.**
   Stable cell keys use `rowId-columnKey`, so reorder should preserve identity by column key where Vue can. Hide/show still mounts/unmounts cells by design. This needs explicit tests rather than architectural change.

3. **Canvas CSS variable reads happen during draw.**
   `useDataGridStageChromeCanvas.ts` resolves CSS variables before drawing. This is reasonable for theme correctness, but redraw telemetry should detect whether repeated computed-style reads become visible under scroll.

## Correctness Risks

- Duplicate/missing row DOM risk is mitigated by `displayRows` windowing, stable row keys, and viewport tests, but browser tests should assert no duplicate `rowId` and no visible gaps during fast scroll.
- Stable cell identity is mostly good through `rowId-columnKey` keys. Pinned cells add pane side to avoid collisions.
- Placeholder correctness is partially represented through `surface.kind` in renderer context. Tests should verify placeholder cells reserve space and are replaced without remounting unrelated rows.
- Auto-height correctness depends on DOM measurement and fallback estimates. Tests should cover custom renderer height changes, row expansion, zoom, and resize in auto-height mode.
- Overlay correctness depends on `rowMetrics`, column geometry, and pane-specific segment generation. Existing unit tests cover representative geometry, but wide/pinned/multi-range browser tests are still needed.
- Theoretical risk: custom renderers that mutate grid state during render can cause re-entrant invalidation. There is no reviewed guard or documented renderer purity contract.

## Performance Risks

- The primary hot-path risk is not viewport math; it is per-cell render work multiplied by rendered rows, center columns, pinned columns, overlays, editors, and custom renderers.
- Reactive writes during scroll are intentionally batched in `useDataGridAppViewport.ts` and `useDataGridStageViewportRuntime.ts`, but custom renderer cost can still occur after `displayRows` or rendered columns change.
- DOM mount/unmount churn is bounded by virtualization, yet unmeasured. Wide tables and pinned panes increase the churn surface.
- Layout reads are mostly outside raw scroll handling, but auto-height row metrics, trigger-hit testing in `useDataGridStageRowState.ts`, chrome metric sync, and resize observers use DOM reads that need budget coverage.
- Canvas chrome is a good optimization for grid lines and row bands, but draw cost can still compete with DOM rendering in the same rAF frame.
- Overlay segment generation is bounded by the visible window, not total rows, but large visible windows and additive/custom overlays need performance gates.

## Enterprise Readiness

Current score: **7/10**.

Target score: **9/10**.

What blocks the target:

- Missing custom renderer budget and slow-render frame gates.
- Missing real-device validation and hard budgets for the lightweight touch-scroll renderer degradation policy.
- Missing render churn telemetry and DOM node budget gates.
- Missing browser gates for custom renderers, auto-height rows, pinned panes, overlays, and wide horizontal virtualization.
- Avoidable center-pane diagnostics work in normal rendering.

## Recommended Implementation Roadmap

### Phase 1: Render Invariants And Diagnostics Discipline

- Guard center-pane diagnostics so no row/value sampling occurs unless diagnostics are enabled. Status: completed for center-pane diagnostics.
- Add unit/component tests that assert row/cell keys remain stable across scroll, column reorder, and pinned pane rendering.
- Add render invariant tests for duplicate row ids, missing rows, and placeholder replacement.

### Phase 2: Renderer Contract And Isolation

- Document public renderer expectations: no synchronous layout reads, no grid-state mutation during render, stable keys for returned VNodes, and bounded work per cell. Status: completed in `packages/datagrid-vue-app/README.md`.
- Add renderer error handling or a safe fallback boundary. Status: completed for `cellRenderer` and `groupCellRenderer`; throwing renderers fall back to the resolved display value and perf traces mark failed samples.
- Add optional slow-render sampling in development/perf mode.

### Phase 3: Lightweight Scroll Rendering

- Introduce a scroll-active rendering policy for expensive cells, aligned with `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`. Status: completed for touch-mode active body scroll.
- Preserve text/selection/focus readability while replacing expensive renderer output during active scroll. Status: resolved display values, cell shell state, and overlay/focus ownership are preserved.
- Ensure editors, active cell, and accessibility labels do not degrade incorrectly. Status: focused unit/component coverage protects editor predicates, placeholder display fallback, and cell ARIA shell behavior.

### Phase 4: Overlay And Chrome Frame Budgets

- Add telemetry for chrome draw duration, overlay segment count, overlay compute duration, and canvas redraw mode.
- Add tests for selection/fill/move overlays across pinned panes, pinned bottom rows, auto-height rows, and horizontal virtualization.

### Phase 5: Enterprise Browser Gates

- Add Playwright or browser-frame scenarios for:
  - 100k rows with plain cells.
  - 100k rows with slow custom renderers.
  - 1k to 10k columns with horizontal virtualization.
  - pinned left/right plus pinned bottom panes.
  - auto-height rows with variable custom renderer heights.
  - server placeholders during cache refresh.

## Recommended Tests

Unit tests:

- `useDataGridStageCellRendering`: renderer fallback/error path and placeholder surface context are covered; renderer purity warning hook remains optional future work.
- `useDataGridStageRenderApis.grouped`: stable style/object behavior where practical, spacer and pane row styles.
- `useDataGridStageChromeModel`: row metrics and signatures for auto-height, pinned bottom, hover, group/tree/pivot bands.
- `useDataGridStageOverlays`: segment counts for large visible windows, pinned seams, custom overlays, and multi-range selection.

Component tests:

- Center and pinned panes render identical editor/checkbox/content behavior for the same row/column contract.
- Row/cell keys remain stable across scroll window shifts and column reorder.
- Diagnostics watcher does no sampling when diagnostics are disabled.
- Placeholder rows render and replace without blanking adjacent rows.

Playwright/e2e tests:

- Fast vertical scroll with no blank viewport and bounded DOM rows.
- Horizontal scroll across 1k+ columns with pinned panes and no header/body drift.
- Custom renderer scroll scenario with frame budget and no long blanking.
- Auto-height rows while scrolling and resizing.
- Selection/fill overlays while scrolling with pinned panes and pinned bottom rows.

Performance/benchmark tests:

- Cell renderer invocation count per frame.
- Row/cell mount and unmount count per scroll write. Status: extracted under browser-frame `churnTelemetry` and gated in the virtualization assert profile.
- Chrome canvas draw duration by redraw mode.
- Overlay compute duration and segment count.
- DOM node count for center plus pinned panes.
- Long tasks during scroll with custom renderers.

## Recommended Telemetry

- `renderedRowCount`
- `renderedCenterColumnCount`
- `renderedPinnedLeftColumnCount`
- `renderedPinnedRightColumnCount`
- `cellRenderInvocationCount`. Status: custom `cellRenderer` and `groupCellRenderer` invocation samples are recorded under `dgPerfTrace=1`.
- `customRendererDurationMs`. Status: custom renderer duration samples are recorded under `dgPerfTrace=1`.
- `rowMountCount` and `rowUnmountCount`. Status: extracted under `churnTelemetry`.
- `cellMountCount` and `cellUnmountCount`. Status: extracted under `churnTelemetry`.
- `chromeDrawDurationMs`. Status: recorded as `chromeDraw.totalMs` under `dgPerfTrace=1` and extracted under `chromeTelemetry`.
- `chromeRedrawMode`. Status: recorded as `chromeDraw.redrawMode` under `dgPerfTrace=1`.
- `overlayComputeDurationMs`. Status: recorded as `overlayCompute.totalMs` under `dgPerfTrace=1` and extracted under `overlayTelemetry`.
- `overlaySegmentCount`. Status: recorded as `overlayCompute.segmentCount` under `dgPerfTrace=1`.
- `blankViewportDetected`
- `domNodeCount`
- `layoutReadCount` in perf/dev mode
- `scrollFrameTotalMs`
- `longTaskDuringScroll`

## Prioritized Implementation Slices

1. Guard center-pane diagnostics and add a regression test. Status: completed in `docs/plans/RENDERING_PIPELINE_PLAN.md` Slice 1.
2. Add render telemetry counters behind existing perf tracing. Status: render-window composition and custom renderer invocation/duration samples are in place; browser-frame churn telemetry is in place.
3. Add custom renderer contract docs and tests for placeholder/interactive context stability. Status: renderer contract docs and runtime error fallback are in place.
4. Add renderer error fallback or development-only error reporting. Status: runtime error fallback is in place; development-only reporting remains optional.
5. Add lightweight scroll rendering policy for expensive custom renderers. Status: completed for touch-mode active body scroll; browser-frame budgets remain planned.
6. Add mount/unmount churn benchmark for vertical and horizontal virtual scroll. Status: completed in `docs/plans/RENDERING_PIPELINE_PLAN.md` Slice 6.
7. Add chrome/overlay duration telemetry and gates. Status: chrome/overlay telemetry is complete in `docs/plans/RENDERING_PIPELINE_PLAN.md` Slice 7; hard budgets remain planned.
8. Add browser-frame scenarios for pinned panes, auto-height rows, custom renderers, and wide columns.

## Risks And Migration Notes

- Renderer isolation changes can affect existing user renderers that rely on side effects. Introduce warnings and documentation before enforcing strict behavior.
- Lightweight scroll rendering must not hide active editors, active-cell focus, selection affordances, row placeholders, or accessibility labels.
- Diagnostics cleanup is low risk if the public diagnostic callback behavior is preserved when enabled.
- Telemetry should be opt-in or perf-mode scoped to avoid adding production overhead.
- Template deduplication between center and pinned panes should be delayed until renderer behavior is covered by tests; otherwise it risks mixing layout concerns with performance work.
