# DataGrid Virtualization Enterprise Audit

## Executive Summary

The current DataGrid virtualization design has strong foundations and does not need a parallel replacement architecture. The core package already separates viewport math, scroll IO, model bridging, row/column virtualization, and horizontal layout metadata. The Vue app layer also has practical stage-level virtualization for rows, columns, retained windows, variable row-height metrics, and touch-aware overscan.

The main enterprise gaps are not basic virtualization primitives. They are validation coverage, ownership clarity between the core controller and the Vue app viewport path, server-backed blank/loading behavior under latency, interaction continuity across virtual unmount/remount, accessibility mapping for virtualized DOM, and CI gates that prove large and wide data behavior.

Current enterprise readiness is **7/10**. A realistic target is **9/10** after hardening the existing architecture with invariant tests, blank-viewport and placeholder telemetry, server-side row model gates, interaction continuity tests, and browser/device performance gates.

## Current Architecture Summary

Virtualization is split across these layers:

- `datagrid-core` owns reusable viewport and virtualization primitives: axis range math, vertical and horizontal virtualizers, scroll IO, viewport controller services, row model bridging, and server/data-source backed row models.
- `datagrid-vue` owns app-level viewport behavior used by the stage renderer: visible row/column windows, retained windows, adaptive overscan, row-height metrics, active-cell visibility, and interaction integration.
- `datagrid-vue-app` owns the rendered stage: center and pinned panes, body scroll handling, row/cell DOM, editors, fill handles, keyboard/mouse/touch event wiring, and placeholder display integration.
- `datagrid-orchestration` owns cross-cutting interaction helpers such as visibility scrolling and scroll performance telemetry.
- Sandbox/demo integrations exercise base grids, server datasource demos, placeholder rows, and scroll-to-row behavior.

The documented intent in `docs/datagrid-architecture.md`, `docs/datagrid-viewport-controller-decomposition.md`, and `docs/datagrid-viewport-math-engine.md` is sound: keep math deterministic, isolate DOM reads/writes, use one transform owner, preserve pin contracts, and avoid duplicating virtualization math in the adapter. The implementation mostly follows that direction in `datagrid-core`, while the Vue app stage currently contains a second substantial virtualization path that needs an explicit contract or shared primitives before the system can be considered enterprise-grade.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/datagrid-viewport-controller-decomposition.md`
- `docs/datagrid-viewport-math-engine.md`
- `docs/datagrid-viewport-rowmodel-boundary.md`
- `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
- `docs/perf/datagrid-performance-gates.md`
- `docs/datagrid-headless-a11y-contract.md`

Core viewport and virtualization:

- `packages/datagrid-core/src/virtualization/axisVirtualizer.ts`
- `packages/datagrid-core/src/virtualization/verticalVirtualizer.ts`
- `packages/datagrid-core/src/virtualization/horizontalVirtualizer.ts`
- `packages/datagrid-core/src/virtualization/dynamicOverscan.ts`
- `packages/datagrid-core/src/virtualization/scrollLimits.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportCoreService.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportHorizontalMeta.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportHorizontalUpdate.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportModelBridgeService.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportRowHeightCache.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`

Core row models and server/cache integration:

- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts`
- `packages/datagrid-core/src/models/server/rangeCache.ts`
- `packages/datagrid-core/src/selection/virtualSelection.ts`

Vue and app stage:

- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
- `packages/datagrid-vue/src/app/dataGridRowHeightMetrics.ts`
- `packages/datagrid-vue/src/app/useDataGridAppActiveCellViewport.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
- `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
- `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts`
- `packages/datagrid-vue-app/src/config/dataGridVirtualization.ts`
- `packages/datagrid-vue-app/src/dataGridVirtualization.ts`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`

Orchestration, sandbox, tests, and benchmarks:

- `packages/datagrid-orchestration/src/cells/useDataGridCellVisibilityScroller.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
- `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
- `packages/datagrid-sandbox/src/components/VueGridCard.vue`
- `packages/datagrid-sandbox/src/components/VueShellGridCard.vue`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/*`
- `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/verticalOverscan.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/rowHeightAuto.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualWindowMath.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/perfHotPath.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/modelBridge.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/scrollResizeDeterminism.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/integrationSnapshot.contract.spec.ts`
- `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- `packages/datagrid-core/src/models/__tests__/serverBackedRowModel.spec.ts`
- `packages/datagrid-core/src/models/__tests__/rangeCache.spec.ts`
- `packages/datagrid-core/src/models/__tests__/velocityOverscan.spec.ts`
- `e2e/sandbox-grid.spec.ts`
- `e2e/sandbox-interactions.spec.ts`
- `scripts/bench-datagrid-browser-frames.mjs`
- `scripts/bench-datagrid-enterprise-browser-frames.mjs`
- `scripts/bench-datagrid-datasource-churn.mjs`
- `scripts/bench-datagrid-rowmodels.mjs`
- `scripts/bench-datagrid-interactions.mjs`
- `scripts/bench-datagrid-harness.mjs`

## Strengths

- Core virtualization primitives are explicit and testable. `axisVirtualizer.ts`, `verticalVirtualizer.ts`, and `horizontalVirtualizer.ts` separate range math from rendering and clamp visible windows.
- Scroll IO is isolated from viewport math. `dataGridViewportScrollIo.ts` samples scroll state, schedules rAF sync, clamps drift, and keeps programmatic scroll writes out of the main range math.
- The core viewport controller has a two-phase prepare/apply pattern for vertical and horizontal updates, reducing the risk of mixed stale range state.
- `dataGridViewportModelBridgeService.ts` treats viewport-only changes as non-invalidating and uses a row-entry cache, which is the right shape for hot-path scrolling.
- Horizontal virtualization is not an afterthought. `dataGridViewportHorizontalMeta.ts`, `dataGridViewportHorizontalUpdate.ts`, and `horizontalVirtualizer.ts` account for pinned widths, effective viewport width, native scroll limits, and range caching.
- The Vue app path has practical production behavior: retained row/column windows, adaptive overscan, touch-aware minimum overscan, header scroll sync in rAF, and viewport position snapshot/restore.
- Variable row-height support exists in the Vue app path through `dataGridRowHeightMetrics.ts`, including offset lookup and index-at-offset math.
- Server datasource support in `dataSourceBackedRowModel.ts` includes placeholders, range cache integration, critical/background lanes, prefetch, velocity-aware source ranges, and stale retained viewport rows during cache replacement.
- Existing tests cover important slices: horizontal stress, adaptive vertical overscan, auto row height, horizontal virtual window math, viewport/model bridge behavior, scroll/resize determinism, datasource placeholders, server row model cache behavior, and velocity overscan.
- Existing benchmark infrastructure already covers browser frames, enterprise browser frame extraction, row models, interactions, and datasource churn. This is a useful base for enterprise gates.

## Findings By Severity

### Blocker

1. **No automated enterprise blank-viewport gate.**
   Existing e2e coverage in `e2e/sandbox-grid.spec.ts` verifies that rendered rows exist after a long scroll, but it does not prove that fast scroll, touch momentum, server latency, cache replacement, zoom, resize, or wide horizontal scroll never expose blank gaps. This is the top blocker for enterprise readiness because the primary user expectation is stable visual continuity.

2. **No CI budget for placeholder exposure under server latency.**
   `dataSourceBackedRowModel.ts` has placeholder rows and prefetching, but there is no enforced budget for how long placeholders remain visible during fast scroll or cache refresh. `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md` also identifies server-backed blank/loading measurement as remaining work.

3. **Virtualization ownership is split between core and Vue app without a final contract.**
   Core docs say viewport math should live in core and the adapter should not duplicate it. In practice, `dataGridViewportController.ts` and `useDataGridAppViewport.ts` both compute visible ranges, overscan, retained windows, and scroll-driven updates. This is not currently proven broken, but it blocks enterprise confidence until the boundary is documented and covered by contract tests or shared primitives.

### High

1. **Dynamic row heights are partial across layers.**
   The Vue app path has explicit variable-height metrics in `dataGridRowHeightMetrics.ts`. The core vertical path uses fixed or estimated row-height behavior plus an average auto-height cache in `dataGridViewportRowHeightCache.ts`. Exact per-row variable-height virtualization is therefore supported in the app path but not uniformly established as a core invariant.

2. **The simple `serverBackedRowModel` path can underfill virtual windows.**
   `serverBackedRowModel.ts` returns available rows from cache and skips missing rows in `getRowsInRange`. Unlike `dataSourceBackedRowModel.ts`, it does not expose placeholder rows for every missing visual index. This is a risk for rendered-window continuity if this path remains supported for enterprise server-backed grids.

3. **Interaction continuity across unloaded ranges is not fully proven.**
   Active-cell visibility and scroll-to-cell behavior have dedicated logic in `useDataGridAppActiveCellViewport.ts`, `useDataGridCellVisibilityScroller.ts`, and `dataGridViewportCoreService.ts`. Selection/fill/copy paths also know about placeholders. However, large virtual selection coverage in `virtualSelection.ts` is still bounded by loaded-row scanning and has an explicit TODO for loaded intervals before huge virtual ranges.

4. **Pinned top-row rendering needs verification.**
   The app runtime partitions pinned top and bottom rows, and the stage clearly renders pinned bottom shell behavior. A dedicated pinned-top render path was not clearly verified in the reviewed stage files. Treat this as a verification gap, not a confirmed bug.

5. **Wide dataset validation is below enterprise target.**
   Core stress coverage includes hundreds of columns, and the app path supports horizontal virtualization. There is no reviewed test proving behavior for 1k to 10k columns with resize, reorder, hide/show, pinned columns, and high-DPI fractional scroll positions.

### Medium

1. **Scroll-to-row by row id can be expensive for very large server-backed datasets.**
   `dataGridViewportCoreService.ts` resolves row ids through row model access/scanning patterns. For 1M server rows, enterprise behavior needs a rowId-to-index contract or server resolver rather than relying on local traversal.

2. **Accessibility mapping for virtualized app-stage DOM is a verification gap.**
   `docs/datagrid-headless-a11y-contract.md` and `a11yAttributesAdapter.ts` include virtualized row/column count and index attributes. The reviewed stage template in `DataGridTableStageCenterPane.vue` exposes roles and focus attributes, but the full row/column index mapping was not clearly visible there.

3. **Mount/unmount churn is not a first-class budget.**
   The app path retains windows and uses stable row and cell keys, but CI does not enforce a churn budget for row/cell mount and unmount counts during fast scroll.

4. **Browser zoom, fractional pixels, and high DPI need e2e coverage.**
   Core virtualizers include clamping and zoom-aware behavior, but enterprise confidence requires browser tests at non-100 percent zoom or device scale factors with row/column resize and horizontal scrolling.

5. **Custom renderer cost is not isolated during scroll.**
   Current docs and audits mention lightweight rendering while scrolling as remaining work. Without a renderer budget or scroll-time degradation mode, custom renderers can consume the rAF frame budget even when virtualization range math is efficient.

### Low

1. **Some architecture docs have stale quality/reference links.**
   `docs/datagrid-architecture.md` points to historical quality references. This audit did not change those links because the requested deliverable is virtualization-specific and code changes were out of scope.

2. **Column virtualization defaults are conservative.**
   `dataGridVirtualization.ts` defaults row virtualization on and column virtualization off unless full virtualization is enabled. This is safe for compatibility but should be called out for wide-grid enterprise configurations.

3. **Grouped/tree expansion behavior needs explicit documentation.**
   Row model and selection paths can operate over row nodes, but grouped/tree expansion and collapse invalidation around virtual ranges was not documented as an enterprise invariant in the reviewed virtualization docs.

## Correctness Risks

- Off-by-one and duplicate/missing row risks are currently mitigated in core by range clamping and stress tests, but need app-stage e2e coverage across fast scroll, resize, sort/filter/group/pivot/cache replacement, and pinned rows.
- Viewport coverage during fast scroll is not guaranteed by current e2e tests. This is a validation gap rather than a proven implementation defect.
- Stable row identity is mostly good: app rows are keyed by `row.rowId`, and datasource placeholders have stable synthetic identity. Cell identity is also keyed by row id and column key in the stage template.
- Variable row heights are supported in the Vue app path, but exact variable-height virtualization is partial across core and app. Enterprise docs should state the supported path clearly.
- Pinned columns are well represented in horizontal metadata and stage panes. Pinned top rows need explicit verification in the stage render contract.
- Cache replacement behavior in `dataSourceBackedRowModel.ts` preserves current viewport rows as stale rows, which is good. It still needs visual continuity tests around refresh and eviction.
- Sort/filter/group/pivot/cache replacement invalidation is not covered by a single virtualization invariant suite. Current tests cover slices, not the full lifecycle.
- Container resize is covered by core determinism tests, but app-stage browser coverage should include resize while scrolling and while server rows are loading.
- Column resize/reorder/hide/show must be tested with horizontal virtualization enabled, pinned columns present, and fractional scroll positions.

## Performance Risks

- Scroll handler hot-path design is mostly sound: rAF scheduling, cached layout, retained windows, and model bridge non-invalidation are already present. The remaining risk is enforcing budgets rather than redesigning the path.
- Reactive writes during scroll exist in the app path for visible rows, columns, and scroll-state refs. They appear intentionally batched, but should be measured under custom renderers and wide grids.
- DOM churn is bounded by virtualization and retained windows, but mount/unmount counts are not tracked as a gate.
- Layout reads are mostly guarded by cached snapshots and rAF, but `useDataGridAppViewport.ts` can still fall back to DOM dimensions when cache data is missing. This should stay measured.
- Memory retention and cache growth are controlled in server range caches and row entry caches, but large retained windows plus custom cells need heap benchmarks.
- Overscan tradeoffs are currently adaptive and touch-aware. Enterprise hardening should record the chosen overscan reason and resulting row/column counts per frame.
- 10k and 100k row behavior has partial coverage. 1M rows need explicit browser and row-model benchmarks, especially with server-backed data.
- 100-column behavior is covered better than 1k/10k-column behavior. Horizontal virtualization needs wide-grid gates with pinned columns and column resizing.
- Server latency can shift cost from rendering to placeholder exposure and cache churn. This needs latency-profile benchmarks, not just local fake-server success paths.
- rAF frame budget and long tasks are already partially benchmarked by browser frame scripts, but the results should become required gates for enterprise scenarios.

## Server-Backed Virtualization Risks

- `dataSourceBackedRowModel.ts` is the stronger enterprise path because it exposes placeholders, prefetches, tracks viewport range, and retains stale viewport rows during cache replacement.
- `serverBackedRowModel.ts` is simpler and can return fewer rows than requested when cache data is missing. If it remains public, document it as a non-enterprise/simple path or add placeholder parity.
- Placeholder rows prevent blank DOM only if the renderer reserves the correct visual space and e2e tests prove it during latency and cache refresh.
- Cache eviction and replacement should be tested while the user is scrolling, editing, selecting, and using keyboard navigation.
- Source latency behavior should include cold scroll, warm scroll, direction reversal, jump-to-index, slow source, failed source, and retry.
- The server-side row model contract should define whether row count, row id, row index, row height, group state, and placeholder identity are stable during refresh.
- Scroll-to-row/cell for unloaded rows needs a server-side resolve strategy or documented limitation.

## Touch/Mobile Virtualization Risks

- `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md` already identifies the current state: desktop scroll foundations are strong, Phase 1 touch quick wins are implemented, and remaining gaps include long-press selection, lightweight rendering while scrolling, server-backed blank/loading measurement, and Playwright/device gates.
- Touch momentum can move the viewport faster than ordinary wheel tests. Overscan and prefetch must be validated against actual device or browser-emulated momentum.
- Touch selection, long press, fill handles, and editing must be tested while rows unmount/remount.
- Header/body/pinned pane sync should be verified during momentum scroll and horizontal pan.
- Placeholder exposure should be measured separately on mobile because lower CPU budgets can make otherwise acceptable server latency visible.

## Accessibility Risks

- The headless a11y contract already defines the right direction: roving focus, active descendant behavior, and virtual row/column count/index attributes.
- The Vue adapter has an a11y attributes adapter, but the app-stage rendered DOM needs verification that `aria-rowcount`, `aria-colcount`, `aria-rowindex`, and `aria-colindex` are applied consistently for virtualized rows and cells.
- Virtualized DOM must preserve focus semantics when the active cell scrolls out, remounts, or is represented by a placeholder.
- Screen reader behavior should be tested for server placeholders, pinned rows/columns, grouped/tree rows, and large row counts.
- If grouped/tree rows are unsupported in virtualized a11y mode, document that as unsupported rather than leaving behavior implicit.

## Enterprise Readiness Score

- Current score: **7/10**
- Target score: **9/10**

What blocks the target:

- No required blank-viewport detection gate.
- No placeholder exposure budget for server-backed grids.
- Core/app virtualization ownership is not finalized as a documented contract.
- Interaction continuity across unloaded or remounted ranges is not fully covered.
- Virtualized a11y mapping is not proven in the app-stage DOM.
- 1M-row and 1k/10k-column behavior is not covered by enterprise browser gates.
- Touch momentum and mobile server-backed loading behavior are not gated.

## Phased Roadmap

### Phase 1: Correctness And Invariant Audit

- Status: started. Core row/column range invariants are covered by `packages/datagrid-core/src/viewport/__tests__/virtualizationRangeInvariants.contract.spec.ts`; remaining Phase 1 work is controller/app-stage, lifecycle, and fractional/browser coverage.
- Define the canonical virtualization contract for core and Vue app paths.
- Add invariant tests for visible range math: no off-by-one gaps, no duplicates, no missing rows, stable start/end semantics, and deterministic range output.
- Cover sort, filter, group, pivot, cache replacement, container resize, column resize, reorder, hide/show, pinned columns, pinned top rows, and pinned bottom rows.
- Add zoom/fractional-pixel/high-DPI test cases for vertical and horizontal ranges.
- Decide whether app-stage virtualization should share core primitives directly or be documented as a separate renderer contract using the same invariants.

### Phase 2: Scroll And Overscan Hardening

- Add blank-viewport detection in browser tests and optional runtime telemetry.
- Record overscan decisions: base overscan, adaptive overscan, velocity, direction, touch mode, rendered row count, and rendered column count.
- Add mount/unmount churn telemetry for rows and cells.
- Validate fast wheel, scrollbar drag, programmatic scroll, scroll-to-row, scroll-to-column, and touch momentum.
- Introduce or document lightweight rendering while scrolling for expensive custom renderers.

### Phase 3: Server-Backed Virtualization Hardening

- Add placeholder exposure timing and CI budgets for cold scroll, warm scroll, jump scroll, direction reversal, and cache replacement.
- Test `dataSourceBackedRowModel.ts` under delayed, failed, retried, and partial responses.
- Decide the enterprise status of `serverBackedRowModel.ts`: add placeholder parity or document it as a simple/non-enterprise path.
- Add server-side rowId-to-index or scroll-target resolution for unloaded rows.
- Add loaded interval metadata for large virtual selection/fill/copy operations.

### Phase 4: Interaction Continuity Across Virtualization

- Add tests for focus, active cell, edit lifecycle, selection, copy, paste, fill, keyboard navigation, and drag handles across virtual unmount/remount.
- Include placeholder rows and unloaded rows in keyboard and clipboard tests.
- Verify editor commit/cancel behavior when the edited row leaves and re-enters the rendered range.
- Verify pinned panes remain synchronized with center pane focus and selection state.
- Complete touch long-press and mobile interaction coverage called out in `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`.

### Phase 5: Enterprise Validation And Perf Gates

- Promote browser frame scripts and datasource churn scripts into required or scheduled gates for enterprise scenarios.
- Add large dataset gates for 10k, 100k, and 1M rows.
- Add wide dataset gates for 100, 1k, and 10k columns with horizontal virtualization enabled.
- Add server latency profiles with placeholder exposure budgets.
- Add long-task, rAF frame budget, heap growth, mount churn, and blank-viewport budgets.
- Add device or emulated-device Playwright coverage for touch momentum.

## Recommended Tests

### Unit Tests

- Core axis virtualizer range invariants for zero rows, one row, exact viewport fit, start/end edges, reverse direction, oversized overscan, disabled virtualization, and horizontal pinned-width max-scroll math are covered in `packages/datagrid-core/src/viewport/__tests__/virtualizationRangeInvariants.contract.spec.ts`.
- Axis virtualizer range boundaries for zero rows, one row, exact viewport fit, partial fit, overscan over edges, reverse direction, and huge counts.
- Vertical virtualizer with fixed heights, estimated heights, zoom adjustments, native scroll limit clamp, and virtual max clamp.
- Horizontal virtualizer with pinned widths, fractional column widths, hidden columns, reordered columns, and scroll positions near max.
- Dynamic overscan with wheel, touch, direction reversal, programmatic jumps, and disabled adaptive overscan.
- Row-height metrics with sparse overrides, chunk boundaries, average estimate changes, and index-at-offset boundaries.
- Server range cache eviction, stale retained rows, failed chunks, retry, and partial source responses.

### Component Tests

- App-stage row and column windows with stable row/cell keys.
- Pinned left/right/top/bottom panes with center viewport scroll.
- Placeholder rows in the rendered range with correct height and stable identity.
- Active cell, editor, selection, fill handle, and clipboard behavior across virtual remount.
- Column resize/reorder/hide/show while horizontal virtualization is active.
- Group/tree expansion and collapse while the viewport intersects the changed range.
- A11y attributes for virtualized rows and cells.

### Playwright/E2E Tests

- Fast vertical scroll with blank-viewport detector.
- Fast horizontal scroll with pinned columns and wide datasets.
- Scrollbar drag, wheel, trackpad-like scroll, programmatic scroll-to-row, and scroll-to-cell.
- Browser zoom or device scale factor coverage with fractional pixels.
- Container resize during scroll.
- Server-backed cold scroll, warm scroll, cache replacement, failed source, and retry.
- Touch momentum and long-press interaction on mobile profiles.
- Edit, focus, keyboard navigation, copy/paste, and fill across unloaded rows.

### Performance/Benchmark Tests

- Visible range calculation p50/p95/p99.
- rAF frame budget and dropped-frame percentage.
- Long tasks during scroll.
- Row/cell mount and unmount churn per second.
- Heap growth and retained row/cell object counts.
- Placeholder exposure time under source latency profiles.
- Custom renderer scroll cost with and without lightweight scroll rendering.
- 10k, 100k, and 1M row benchmarks.
- 100, 1k, and 10k column benchmarks.

## Recommended Telemetry

- Visible range calculation time.
- Rendered row count and rendered column count.
- Row and cell mount/unmount churn.
- Blank viewport detection.
- Placeholder exposure time.
- Scroll frame budget and frame delta distribution.
- Long tasks during scroll.
- Overscan decisions: reason, direction, velocity, touch mode, leading/trailing overscan, and resulting range size.
- Cache hit/miss and stale retained row counts for server-backed grids.
- Time from viewport range request to data availability.
- Scroll-to-row/cell resolution time for loaded and unloaded targets.
- Editor/focus remount continuity events.

## Prioritized Implementation Slices

1. Add blank-viewport detection and Playwright coverage for fast vertical and horizontal scroll.
2. Add placeholder exposure telemetry and datasource latency tests for `dataSourceBackedRowModel.ts`.
3. Write the core/app virtualization ownership contract and add shared invariant tests for both paths.
4. Add mounted row/cell churn metrics and browser frame budgets to performance gates.
5. Add interaction continuity tests for active cell, edit lifecycle, keyboard navigation, selection, copy/paste, and fill across virtual remount.
6. Add wide-grid horizontal virtualization gates for 1k and 10k columns.
7. Verify pinned top-row rendering and add tests or document unsupported behavior.
8. Verify app-stage virtualized a11y attributes and add tests for row/column index mapping.
9. Decide the enterprise status of `serverBackedRowModel.ts` and either add placeholder parity or document it as a simple path.
10. Add rowId-to-index or server scroll-target resolution for unloaded rows.

## Risks And Migration Notes

- Do not replace the existing virtualization architecture without evidence. The current design is strong enough to harden incrementally.
- Keep desktop scroll behavior stable while adding touch and server-backed gates.
- Avoid changing public APIs during Phase 1 and Phase 2. Start with tests, telemetry, and docs.
- If app-stage virtualization is aligned with core primitives, migrate in small slices behind existing behavior and compare range outputs before changing rendering.
- If `serverBackedRowModel.ts` is downgraded to a simple path, document the limitation clearly and route enterprise examples to `dataSourceBackedRowModel.ts`.
- If exact variable-height virtualization is only guaranteed in the Vue app path, document that support boundary before advertising it as a core feature.
- Grouped/tree virtualization, pivoted rows, and massive virtual selection should be documented as unsupported or partial until covered by tests.
- Any new performance gates should start as warning-only if current baselines are unknown, then become required after stable measurements are recorded.
