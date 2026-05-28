# DataGrid Browser Performance Next Slices

## Current Findings

The enterprise browser frame benchmark on `/vue/shell/base-grid` with `100000` rows and `32` columns separates the remaining browser costs into two buckets:

- Smooth vertical scroll is effectively 60 FPS, so viewport RAF work and ordinary scroll rendering are not the current bottleneck; large jump-scroll stress is improved by the teleport-overscan cap, fixed-slot body-window row/cell shell recycling, and native non-interactive renderer VNode patching. Primitive native span renderers normalize text children into patchable text nodes, removing scroll-time descendant `childList` churn while component, array, and interactive native renderer outputs remain row-keyed to avoid leaking renderer state across rows.
- Chrome canvas redraw diagnostics now include redraw request sources and merged source chains in perf traces. Use the `chromeRedrawRequest` samples plus `chromeDraw.redrawSources` to identify which full redraw owner is merging into vertical scroll frames before changing scroll/chrome architecture again.
- Row-only chrome revisions now redraw body chrome with `body-scroll`, and unchanged column redraw signatures are ignored before layout metrics are re-read. Pinned-bottom row chrome changes still force a full redraw.
- Unfocused body scroll no longer keeps the focus-remount watcher subscribed to viewport row/window signatures; focus restoration still tracks the full window only while the grid owns focus.
- Canvas-chrome body cells now skip the legacy inline row-fill fallback in the per-cell style hot path. Non-canvas row-fill behavior is still covered for compatibility.
- Stage editor-mode checks now resolve the column cell type directly instead of building a full render model, avoiding row value reads and click-action resolution in the per-cell render path.
- Inactive editor predicates and non-interactive renderer cells now skip editability and interaction resolution in the stage render path; wrapper-level ARIA/interaction behavior remains unchanged.
- Stage cell-state ARIA helpers now skip interaction/editability resolution for columns without `cellInteraction`, and fill-handle rendering checks the single active handle before running editability logic across center/pinned panes.
- `stageWindowFlush` perf samples now include row/window deltas, spacer deltas, scrollTop, and first/last row identity changes so the next optimization slice can separate virtual-window movement from same-window row replacement and spacer-only updates.
- The enterprise browser-frame benchmark now classifies `stageWindowFlush` samples as `window-jump`, `window-step`, `row-identity-replacement`, `row-count-change`, `spacer-only`, or `unchanged` and aggregates duration/delta stats by class.
- `scripts/compare-datagrid-enterprise-browser-frames.mjs` compares before/after browser-frame artifacts by scenario for frame, dropped-frame, long-task, stage-window-flush, churn, and blank-viewport metrics; use it to reject speculative runtime changes before keeping them.
- Enterprise browser-frame scenarios reset vertical and horizontal scroll origins before telemetry starts, so smooth-scroll runs cannot inherit the previous scenario's bottom scroll position and silently produce zero viewport/render samples.
- Enterprise browser-frame artifacts now include `scrollFrameAttribution`, which summarizes slow writes, per-write max frame duration, long-task overlap, and mutation callback/mount counts for jump-scroll diagnostics.
- Body pane cell rendering now uses a functional content renderer and precomputed row/column slot metadata, reducing repeated per-cell index resolution during `stageWindowFlush`; targeted 100k-row vertical jump-scroll improved `stageWindowFlush` p95 from about `9.92ms` to about `7.21ms` with `blankViewportCount = 0`.
- `sort-only` still has main-thread spikes from column-menu value loading and synchronous full-table client sorting.

The low-risk slice is started: large column-menu value-filter histograms are deferred until after the menu is visible, and pending deferred histogram loading is canceled/invalidated when a sort action closes the menu before the histogram starts. Single-column local sort now avoids allocating one sort-value array per row. Frozen inline-edit patches now avoid full body-row partition rebuilds and lazily refresh cached body rows. Server-backed placeholder exposure, viewport availability, cache miss, pull-duration, retry, stale-retention, pull-count, abort, dropped-pull, and row-cache eviction diagnostics are now hard-gated. Mixed scroll/edit/filter/server-refresh/renderer soak profiles now gate heap slope, plateau drift, peak heap, server row-cache, renderer-cache, listener, and DOM-node retention. Grouped/tree/pivot gates now include 100k tree matrix CI coverage and server pivot interop. The focused interaction-frame artifact adds edit-burst diagnostics and shows context-menu open/cleanup is not the active blocker. Remaining work is to decide whether deeper local sort projection needs progressive, worker-backed, or server-backed execution.

## Riskier Future Paths

- Async or progressive client-side sorting so large sorts do not monopolize the UI thread.
- Worker-backed sorting and projection for large client datasets.
- Server-backed sorting for large datasets where client-side full-table sort is not the right execution model.
- RAF-split sort apply or transition UX for cases where synchronous sort remains necessary.
- Lower-allocation bulk patch representation for copy, paste, and fill workloads.
- Broader component-renderer reuse for jump-scroll stress cases, if future traces show keyed component remount cost still dominates after body shell recycling.

These paths should be handled in separate design slices because they affect execution policy, user feedback, or core row-model/projection architecture.
