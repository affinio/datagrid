# Pinned Native Scroll Architecture Audit

Date: 2026-05-16

## Executive Summary

Moving pinned body zones into the same native vertical scroll surface as the center body viewport is technically desirable, but it is not a small CSS change. The current table stage has one native vertical scroll owner: the center `.grid-body-viewport` rendered by `DataGridTableStageCenterPane.vue`. Pinned left and right panes are sibling panes outside that scroll owner. Their body content is vertically synchronized with `translate3d(0, -scrollTop, 0)` through `useDataGridLinkedPaneScrollSync`.

That architecture gives native inertia when touch starts in the center body viewport. Touch that starts on pinned panes is routed by `installDataGridTouchPanGuard()` into the center body viewport by setting `scrollTop` and `scrollLeft` from touch deltas. That routing is useful as a compatibility fallback, but it is not browser-native inertial scrolling and cannot meet the target behavior by itself.

The target design is feasible only by making a shared body scroll viewport the vertical owner for pinned-left, center, and pinned-right body layers. Horizontal scroll should remain center-owned through a separate horizontal center viewport or equivalent scroll-left owner. This crosses table-stage DOM shape, viewport runtime refs, header sync, pinned bottom sync, chrome canvas sizing, overlay coordinate systems, auto row-height measurement, and existing tests that query `.grid-body-viewport` as the body scroll owner.

Migration difficulty: **high**.

Recommendation: do not ship the full migration immediately as a direct refactor. First run a feature-flagged prototype that introduces a shared vertical scroll shell while preserving the existing center horizontal scroll owner. Keep the current touch-pan routing as fallback for the existing layout until the prototype proves native pinned touch inertia, exact row synchronization, overlay alignment, and desktop wheel/trackpad behavior on real devices.

## Current Architecture Summary

The table stage is split into separate header, main body, and pinned-bottom shells.

The main body shell is a CSS grid with three columns:

- left pinned body pane
- center body viewport
- right pinned body pane

The center body viewport is the only native vertical scrolling element for the main body. It owns `scrollTop`, `scrollLeft`, row virtualization commits, horizontal column virtualization, header scroll-left synchronization, and runtime viewport position updates.

Pinned panes are not scroll containers. They are `overflow: hidden` sibling panes. Their `.grid-pane-content` elements render the same visible row window as the center pane and are shifted vertically by transform to match the center viewport's `scrollTop`.

Pinned bottom rows are rendered in a separate `.grid-body-shell--pinned-bottom`. Its center viewport is horizontal-only (`overflow-y: hidden`) and is synchronized to the main body horizontal scroll.

## Exact Files Reviewed

- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
- `docs/datagrid-viewport-controller-decomposition.md`
- `docs/datagrid-viewport-math-engine.md`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageScrollSync.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePanes.grouped.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeModel.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts`
- `packages/datagrid-vue-app/src/stage/dataGridStageOverlayGeometry.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRenderApis.grouped.ts`
- `packages/datagrid-vue-app/src/gestures/dataGridTouchPanGuard.ts`
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridLinkedPaneScrollSync.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedWheelScroll.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedTouchScroll.ts`
- `packages/datagrid-orchestration/src/scrolling/dataGridManagedScrollPipeline.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/dataGridTouchPanGuard.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/ensureDataGridAppStyles.contract.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageViewportRuntime.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageChromeModel.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/dataGridStageOverlayGeometry.spec.ts`
- `packages/datagrid-orchestration/src/__tests__/useDataGridManagedTouchScroll.contract.spec.ts`
- `e2e/sandbox-grid.spec.ts`
- `e2e/sandbox-interactions.spec.ts`

## Current DOM/Scroll Ownership Diagram

```html
<section class="grid-stage">
  <DataGridTableStageHeader>
    <div class="grid-header-shell">
      <div class="grid-header-pane grid-header-pane--left">...</div>
      <div class="grid-header-viewport">...</div>
      <div class="grid-header-pane grid-header-pane--right">...</div>
    </div>
  </DataGridTableStageHeader>

  <div class="grid-body-shell">
    <DataGridTableStagePinnedPane side="left">
      <div class="grid-body-pane grid-body-pane--left">
        <div class="grid-pane-content" style="transform: translate3d(0, -scrollTop, 0)">
          pinned-left visible rows
        </div>
      </div>
    </DataGridTableStagePinnedPane>

    <DataGridTableStageCenterPane>
      <div class="grid-body-viewport table-wrap">
        <div class="grid-body-content">
          center visible rows and horizontal spacers
        </div>
      </div>
    </DataGridTableStageCenterPane>

    <DataGridTableStagePinnedPane side="right">
      <div class="grid-body-pane grid-body-pane--right">
        <div class="grid-pane-content" style="transform: translate3d(0, -scrollTop, 0)">
          pinned-right visible rows
        </div>
      </div>
    </DataGridTableStagePinnedPane>
  </div>

  <div class="grid-body-shell grid-body-shell--pinned-bottom">
    pinned-bottom left pane
    <div class="grid-body-viewport grid-body-viewport--pinned-bottom">
      pinned-bottom center rows, horizontal-only scroll
    </div>
    pinned-bottom right pane
  </div>
</section>
```

Current ownership:

- Native vertical scroll owner: `.grid-body-viewport.table-wrap` in the center pane.
- Native horizontal scroll owner: the same center `.grid-body-viewport.table-wrap`.
- Pinned left/right body panes: outside the native scroll owner.
- Pinned left/right vertical sync: `useDataGridLinkedPaneScrollSync`, direct transform mode.
- Header horizontal sync: center body scroll-left to `.grid-header-viewport`.
- Pinned bottom horizontal sync: main body center scroll-left to pinned-bottom center viewport.

## Target DOM/Scroll Ownership Diagram

```html
<section class="grid-stage">
  <DataGridTableStageHeader>...</DataGridTableStageHeader>

  <div class="grid-body-scroll-viewport">
    <div class="grid-vertical-content">
      <div class="grid-pinned-left-layer">
        pinned-left visible rows
      </div>

      <div class="grid-center-horizontal-viewport">
        <div class="grid-center-layer">
          center visible rows and horizontal spacers
        </div>
      </div>

      <div class="grid-pinned-right-layer">
        pinned-right visible rows
      </div>
    </div>
  </div>

  <div class="grid-body-shell grid-body-shell--pinned-bottom">
    pinned-bottom layers, horizontally synchronized to the center horizontal owner
  </div>
</section>
```

Target ownership:

- Native vertical scroll owner: `.grid-body-scroll-viewport`, covering pinned-left, center, and pinned-right hit areas.
- Native horizontal scroll owner: center-only viewport or equivalent center scroll-left owner.
- Pinned layers: horizontally fixed through grid placement, sticky positioning, or absolute layer placement inside the shared vertical scrollport.
- Row window: one `displayRows` and one row-height/row-offset source for all layers.
- Vertical sync transforms: removed for pinned body panes in the migrated path.

## Audit Questions

1. **What is the current DOM/layout structure for center and pinned body panes?**

   The main body is a three-column `.grid-body-shell`. Pinned panes and the center pane are siblings. The center pane renders `.grid-body-viewport`; pinned panes render `.grid-body-pane` with `.grid-pane-content`.

2. **Which element is the true native vertical scroll owner today?**

   The center pane root, `.grid-body-viewport.table-wrap`, is the true native vertical scroll owner for main body rows.

3. **Are pinned panes outside that scroll owner?**

   Yes. Pinned panes are sibling elements outside `.grid-body-viewport`.

4. **When touching pinned zones, how is scroll handled today?**

   Center touches scroll natively. Pinned touches are not browser-native scroll because the pinned pane is not a scroll container. `shouldRouteTableTouchPan()` excludes targets inside the body viewport and routes targets on `.grid-body-pane` or `.grid-header-shell` to `installDataGridTouchPanGuard()`. The guard manually updates the center body viewport's `scrollTop` and `scrollLeft` from touch deltas and calls `preventDefault()` after axis lock. Wheel events on pinned/header linked surfaces are similarly routed through managed wheel scroll. If a pinned touch target is not accepted by the guard, the pinned pane itself has no native vertical scrolling to perform.

5. **What would need to change to make pinned zones part of the same native vertical scroll surface?**

   The body stage needs a new shared vertical scroll viewport that wraps the pinned-left, center, and pinned-right body layers. `bodyViewportEl` and app viewport refs would need to point to that shared vertical owner for `scrollTop`, `clientHeight`, row range computation, runtime viewport position, and performance sampling. Horizontal scroll-left would need a separate center-owned ref used by header sync, horizontal virtualization, center spacers, `scrollToColumn`, pinned-bottom sync, and chrome redraw.

6. **Would this require a broad stage layout refactor or can it be done incrementally?**

   The full target requires a broad stage layout refactor. It can be phased, but the phase that changes the native vertical owner touches several coupled systems at once: DOM layout, viewport runtime refs, CSS overflow rules, header sync, pinned bottom, chrome canvas, overlay geometry, and tests. A feature-flagged incremental prototype is realistic; a narrow one-file change is not.

7. **What are the biggest risks?**

   The highest risks are pinned pane positioning, horizontal scroll ownership, virtualization commits, overlay/chrome alignment, auto-height row measurement, pinned bottom behavior, keyboard/focus ownership, touch gesture ownership, accessibility, and desktop wheel/trackpad regressions.

8. **What existing tests would break?**

   Tests that assume `.grid-body-viewport` is the center pane, body scroll owner, focus target, row query root, overlay host, or pinned-bottom counterpart would need updates. The most exposed areas are `DataGridTableStage.contract.spec.ts`, `DataGrid.contract.spec.ts`, `useDataGridStageViewportRuntime.spec.ts`, `useDataGridStageChromeModel.spec.ts`, `dataGridStageOverlayGeometry.spec.ts`, `dataGridTouchPanGuard.spec.ts`, `ensureDataGridAppStyles.contract.spec.ts`, and the sandbox e2e scroll/interaction specs.

9. **What new tests are needed?**

   Add tests for native touch panning starting on pinned-left and pinned-right cells; exact row-window parity between pinned and center layers during scroll; horizontal center scroll with pinned layers fixed; header and pinned-bottom horizontal sync; auto-height rows in shared vertical scroll; selection, fill, range move, and seam overlay alignment; keyboard focus and `scrollToCell`; wheel/trackpad over pinned cells; and real-device or mobile-emulated momentum behavior without JS touchmove scroll emulation.

10. **Is there a smaller intermediate design that improves pinned touch inertia without full layout migration?**

    A second native vertical scroll container per pinned pane could improve local inertia, but it introduces duplicated vertical scroll owners and violates the target criteria. It also increases drift risk during virtualization and auto-height changes. The smallest compatible intermediate is a feature-flagged shared vertical scroll shell prototype: move only vertical ownership to a wrapper that covers all body panes, keep center horizontal ownership separate, and preserve current pane renderers as much as possible. Until that proves out, keep the existing touch guard as fallback and do not add fake momentum physics.

## Gap Analysis

| Area | Current state | Target requirement | Gap |
| --- | --- | --- | --- |
| Vertical scroll owner | Center `.grid-body-viewport` only | One owner covering pinned and center body zones | Requires DOM ownership change |
| Pinned body scrolling | Transform sync from center scrollTop | Native vertical scroll participation | Remove vertical transform path for migrated body panes |
| Touch on pinned cells | JS touch delta forwarding | Browser-native inertia | Current guard cannot provide inertia |
| Horizontal scroll | Center viewport owns scrollLeft and scrollTop | Center owns horizontal only | Split vertical and horizontal refs |
| Virtual row window | Computed from center viewport scrollTop/clientHeight | Computed from shared vertical viewport | Ref and snapshot changes |
| Header sync | Body center scrollLeft drives header viewport | Center horizontal owner drives header viewport | Move header sync to horizontal owner |
| Pinned bottom | Separate shell, center horizontal-only viewport | Keep pinned bottom fixed while syncing horizontal owner | Rewire scroll-left source |
| Chrome canvas | Sized from center body viewport and pane widths | Align to shared vertical viewport plus center horizontal owner | Coordinate model changes |
| Overlays | Pane-local segments using body viewport height and pane widths | Stable coordinates in shared scroll surface | Host and clipping rules must be revalidated |
| Auto row heights | Measured from center `.grid-body-content > .grid-row` | One source of row metrics for all layers | Measurement root must be explicit |
| Focus/keyboard | Center body viewport is focusable | Shared vertical owner likely focusable | Keyboard event target and ARIA updates |

## Migration Difficulty Estimate

**High.**

The target conflicts with the current layout in one central place: pinned panes are not children of the native body scroll owner. Because viewport math, horizontal virtualization, header sync, pinned-bottom sync, overlay geometry, and chrome canvas sizing all currently treat the center `.grid-body-viewport` as both the vertical and horizontal owner, the migration must split those responsibilities cleanly.

## Required Implementation Phases

1. **Prototype behind a feature flag**

   Add a shared vertical scroll shell in the stage DOM while retaining the existing layout as default. Establish separate refs for `verticalBodyViewportEl` and `centerHorizontalViewportEl`.

2. **Split viewport runtime ownership**

   Route `scrollTop`, `clientHeight`, row range commits, runtime viewport position top, and scroll perf telemetry through the shared vertical owner. Route `scrollLeft`, horizontal column range, header sync, pinned-bottom sync, and `scrollToColumn` through the center horizontal owner.

3. **Move pinned body layers into the shared vertical scrollport**

   Render pinned-left and pinned-right body layers inside the shared vertical scroll surface. Remove vertical transform sync for the flagged path while preserving pinned horizontal placement and pane clipping.

4. **Reconcile chrome and overlays**

   Update chrome canvas sizing, pane-local overlay hosts, seam overlays, fill/range move previews, and selection segments against the new coordinate roots.

5. **Validate row metrics**

   Keep row height and row offset metrics from one source of truth. Make the measurement root explicit so auto-height rows are not accidentally measured from duplicated pinned DOM.

6. **Pinned bottom and header**

   Rewire pinned bottom and header horizontal synchronization to the center horizontal owner. Keep pinned bottom vertically fixed outside the main vertical scroll owner.

7. **Interaction and accessibility hardening**

   Recheck focus target, keyboard handlers, long press, touch selection handles, range move, fill drag, resize handles, context menu routing, ARIA relationships, and tab order.

8. **Remove fallback path only after proof**

   Keep `installDataGridTouchPanGuard()` for the old layout and possibly for header linked surfaces until native behavior is proven. Do not replace it with fake inertial scrolling.

## Risks And Mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Pinned layer positioning | Pinned columns must stay fixed horizontally while inside the shared vertical scrollport | Use explicit grid tracks or sticky/absolute layers; test left and right pinned widths and seams |
| Horizontal scroll regression | Current center viewport owns both axes | Split refs and keep horizontal scroll code center-owned |
| Virtualization drift | All panes must render the same visible rows | Keep one row range source and assert row ids across panes |
| Overlay misalignment | Selection/fill/range overlays are pane-specific today | Add visual and unit coverage for center-to-pinned crossings |
| Chrome canvas mismatch | Canvas dimensions are based on current body viewport and pane metrics | Recompute canvas coordinate roots for shared vertical plus center horizontal owners |
| Auto-height rows | Current measurement reads center body DOM rows | Keep measurement single-root and avoid measuring pinned duplicates |
| Pinned bottom | Pinned bottom uses a separate horizontal-only center viewport | Keep it outside vertical owner and sync from center horizontal owner |
| Keyboard/focus | `.grid-body-viewport` is currently focusable and handles keydown | Move focus/keydown to the shared vertical owner or a stable focus proxy |
| Touch gesture conflicts | Native scroll must win for one-finger pan, while drag handles still own explicit gestures | Preserve one-interaction-one-owner; test touch selection, fill, range move, and resize handles |
| Accessibility | Layered duplicated row/cell DOM can confuse semantics | Keep one accessible grid relationship and mark purely visual duplicates if needed |
| Desktop wheel/trackpad | Existing linked wheel routing may double-apply scroll if left enabled | Disable linked vertical wheel routing for panes inside the native owner |

## Recommended Tests

- Unit/contract test that the shared vertical owner is the only element receiving vertical body scroll events in the migrated path.
- Contract test that touch pan on a pinned-left and pinned-right cell changes the shared vertical owner `scrollTop` without invoking manual touchmove scroll forwarding.
- Contract test that center, pinned-left, and pinned-right render the same row ids before, during, and after vertical scroll.
- Contract test that horizontal scroll changes only the center horizontal owner and keeps pinned panes fixed.
- Contract test that header scroll-left follows the center horizontal owner.
- Contract test that pinned-bottom center scroll-left follows the center horizontal owner and does not participate in main vertical scroll.
- Overlay geometry tests for selection, fill preview, range move preview, and seam overlays crossing center and pinned zones.
- Chrome canvas tests for body/pinned/pinned-bottom dimensions after vertical and horizontal scroll.
- Auto-height row test that row metrics are measured once and applied to all panes.
- Keyboard/focus tests for arrow navigation and `scrollToCell` with pinned and center targets.
- Playwright mobile test for native momentum when touch starts on pinned cells.
- Playwright desktop wheel/trackpad test over pinned cells and center cells.
- Performance smoke test with `dgPerfTrace=1` for scroll-frame latest, p95, max, and dropped-frame regressions.

## Recommended Telemetry

- Scroll start target zone: `center`, `pinned-left`, `pinned-right`, `header`, `pinned-bottom`.
- Scroll input type: touch, wheel, trackpad, keyboard, programmatic.
- Native vs managed scroll path.
- Scroll frame latest, p95, max, dropped-frame count, and long-task count.
- Row range churn per scroll frame.
- Horizontal and vertical scroll owner ids in debug traces.
- Linked sync fallback usage count.
- Overlay/chrome redraw duration per scroll frame.
- Auto-height measurement duration and measured row count.
- Momentum continuation samples after touchend on pinned zones in Playwright or real-device traces.

## Is The Migration Worth Doing Now?

Not as an immediate production refactor. The UX goal is valid: native touch inertia over pinned cells is better than manual touch delta forwarding. But the current architecture deliberately separates the native center scroll owner from pinned transform-synced panes, and many stage systems depend on that split. Shipping the migration without a guarded prototype would create high regression risk in desktop scrolling, horizontal virtualization, pinned bottom rows, overlays, auto-height rows, and focus behavior.

The migration is worth pursuing only as a staged, feature-flagged architecture prototype with explicit mobile and desktop validation gates.

## Implementation Progress

- 2026-05-26: Slice 1 started the guarded prototype path. `@affino/datagrid-vue-app` now has an internal `dgPinnedNativeScroll` / `affino:datagrid:pinned-native-scroll` feature flag and marks the table stage with `grid-stage--pinned-native-scroll-prototype` plus `data-datagrid-pinned-native-scroll="prototype"` when enabled. The default layout and scroll ownership are unchanged; this only creates the safe branch point for later DOM/ref migration slices.
- 2026-05-26: Slice 2 introduced internal owner aliases in `useDataGridStageViewportRuntime`: the current body viewport is exposed as both `verticalBodyViewportEl` and `centerHorizontalViewportEl`. They intentionally point to the same element today, preserving current behavior while making the future vertical/horizontal split explicit and test-covered.
- 2026-05-26: Slice 3 added the first flagged DOM anchor for the future shared vertical scroll shell: `.grid-body-shared-vertical-scroll-shell[data-datagrid-scroll-owner="shared-vertical-prototype"]`. It is inert (`position: absolute`, `pointer-events: none`) and does not wrap or reparent the existing body viewport yet, so current scroll ownership remains unchanged while the prototype DOM path is now contract-tested.
- 2026-05-26: Slice 4 started axis ownership separation inside `useDataGridStageViewportRuntime`: vertical reads/writes now go through the vertical owner alias and horizontal reads/writes go through the center-horizontal owner alias. Both aliases still resolve to the current body viewport, so behavior remains unchanged while the hot-path code no longer assumes one named owner for both axes.
- 2026-05-26: Slice 5 moved the main pinned-left, center, and pinned-right body layer components under the flagged shared vertical shell. The shell spans the existing body grid and receives the same pane layout tracks; default DOM remains unchanged and actual scroll ownership still stays on the current body viewport until later slices.
- 2026-05-26: Slice 6 made the flagged shared shell the prototype vertical scroll owner while keeping horizontal ownership on the center body viewport. Runtime owner refs, scroll handling, touch guard containers, and chrome metric reads now use separate vertical/horizontal owners under the flag; the default path still resolves both owners to the body viewport.
- 2026-05-26: Slice 7 hardened touch gesture ownership for the prototype: touch starts inside the shared vertical body shell, including pinned-left and pinned-right cells, are no longer claimed by the manual touch pan guard, so the browser can own native vertical panning. Header touch panning remains routed as a compatibility fallback into the active vertical owner.
- 2026-05-26: Slice 8 added prototype wheel/trackpad owner coverage: linked pinned-pane wheel deltas now have contract tests proving vertical deltas write only to the shared vertical owner and horizontal deltas write only to the center horizontal owner. This keeps desktop linked-wheel fallback aligned with the split-owner architecture while preserving the default path.
- 2026-05-26: Prototype direction correction: the center pane now has an outer layer in the shared vertical shell and an inner center-only horizontal scrollport under the flag. The prototype no longer writes `scrollTop` into the center horizontal owner; vertical position is read from the shared shell while the visible center content participates in the same vertical transform sync path as pinned body content.
- 2026-05-26: Slice 9 restored horizontal column virtualization inside the split-owner prototype. App viewport rAF commits now preserve composite scroll targets that read `scrollTop` from the shared vertical owner and `scrollLeft` from the center horizontal owner, so body cells, header cells, chrome canvas, and selection overlays all materialize from the same virtualized center window instead of a temporary full center-track renderer.
- 2026-05-26: Slice 10 removed shared vertical shell participation from horizontal mirroring. The shared vertical owner now stays at horizontal offset zero while header and pinned-bottom sync continue to follow the center horizontal owner, reducing hidden cross-axis coupling in the prototype path.
- 2026-05-26: Slice 11 hardened header/scroll event routing for the split-owner prototype. Programmatic header sync now marks the next header scroll event as handled, header fallback scroll routes to the center horizontal owner instead of the shared vertical owner, and the shared vertical handler ignores bubbled center scroll events.
- 2026-05-26: Slice 12 removed linked vertical transform synchronization from the split-owner prototype body layers. The shared vertical path now renders body panes from a zero visual row origin, normalizes chrome/overlay row metrics for the current virtual row window, and keeps the shared scroll spacer as the only vertical scroll-height source.
- 2026-05-26: Slice 13 routed active-cell programmatic horizontal reveal through the center horizontal owner when the body ref is the shared vertical prototype owner. Vertical reveal still writes the shared vertical owner; center-column DOM and estimated horizontal reveal now dispatch scroll on the center horizontal scrollport without writing `scrollLeft` into the shared vertical shell.
- 2026-05-26: Slice 14 routed runtime viewport-position restoration through the split-owner model. State import and viewport snapshot restore now write vertical offsets to the shared vertical owner and horizontal offsets to the center horizontal owner, while committing a composite viewport snapshot for virtualization/header sync.
- 2026-05-26: Slice 15 routed pointer coordinate resolution and drag auto-scroll through the split-owner interaction viewport. In the prototype path, vertical drag auto-scroll writes the shared vertical owner, horizontal drag auto-scroll writes the center horizontal owner, and both native scroll owners emit scroll events without falling back to the legacy single-owner sync path.
- 2026-05-26: Slice 16 restored native vertical wheel ownership in the split-owner prototype. Vertical-dominant wheel/trackpad gestures over body and linked panes are no longer consumed by the managed wheel path; they bubble to the shared vertical scroll owner, while horizontal-dominant wheel gestures still route to the center horizontal owner.
- 2026-05-26: Slice 17 restored live vertical visual movement for the split-owner prototype. Shared vertical scroll now updates a scroll-offset CSS variable on the native scroll event, and sticky center/pinned content layers translate by `topSpacerHeight - scrollTop`, so trackpad wheel movement visibly moves rows between virtual window commits instead of jumping only when the row window changes.
- 2026-05-26: Slice 18 realigned body chrome canvas row metrics with native vertical positioning. The prototype chrome model now keeps absolute virtual row tops and subtracts the real shared `scrollTop`, matching the body content formula `rowTop - scrollTop` instead of the earlier zero-origin transition model.
- 2026-05-26: Slice 19 split body overlay metrics from seam overlay metrics for the native vertical prototype. Body selection/fill/move/custom overlays now use content-local row tops (`absoluteTop - rowOrigin`) because they live inside the transformed content layer, while pinned-pane seam overlays stay viewport-local (`absoluteTop - scrollTop`) because they live outside that layer.
- 2026-05-26: Slice 20 hardened auto-height row metrics for the split-owner prototype. DOM-measured row heights now add the shared vertical `scrollTop` when the body DOM root is the center horizontal scrollport, preserving absolute row tops for chrome/overlay math instead of double-subtracting vertical scroll.
- 2026-05-26: Slice 21 moved fallback viewport keyboard ownership to the shared vertical shell in the split-owner prototype. The shared vertical owner now carries the body `tabindex` and viewport keydown handler, while the center horizontal scrollport is removed from the tab order, preserving one fallback tab stop without making the horizontal owner a competing focus surface.
- 2026-05-26: Slice 22 consolidated prototype horizontal peer synchronization under the stage viewport runtime. The center horizontal scrollport now only emits its scroll event; header and pinned-bottom `scrollLeft` mirroring are owned by the runtime, reducing duplicate DOM querying and keeping one horizontal sync path for the split-owner prototype.
- 2026-05-26: Slice 23 aligned prototype accessibility ownership with scroll ownership. The shared vertical body owner now carries the grid role/count metadata and fallback tabindex, while the center horizontal scrollport is no longer exposed as a nested grid, keeping one accessible body grid surface in the split-owner path.
- 2026-05-26: Slice 24 split header touch-pan fallback by locked axis for the native-scroll prototype. Routed header gestures now select the shared vertical owner for vertical pans and the center horizontal owner for horizontal pans, so the compatibility fallback follows the same split-owner model as wheel and programmatic scroll.

## Recommended Fallback/Intermediate Approach

Keep the current center-native layout as the default. Keep `installDataGridTouchPanGuard()` limited to linked non-scroll surfaces and do not add fake inertial physics.

For an intermediate improvement, build a flagged shared vertical scroll shell prototype:

- one native vertical owner covering pinned and center body hit areas
- center-owned horizontal scroll retained as a separate owner
- existing row window and row metric sources reused
- current pinned transform sync bypassed only in the flagged path
- telemetry proving pinned touch starts use native scroll rather than manual touchmove forwarding

If that prototype cannot preserve overlay alignment, horizontal scroll stability, and pinned bottom behavior with bounded changes, defer the migration and document the current limitation as pinned-zone touch panning without native momentum.
