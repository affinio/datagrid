# DataGrid Browser Performance Next Slices

## Current Findings

The enterprise browser frame benchmark on `/vue/shell/base-grid` with `100000` rows and `32` columns separates the remaining browser costs into two buckets:

- Smooth vertical scroll is effectively 60 FPS, so viewport RAF work and ordinary scroll rendering are not the current bottleneck; large jump-scroll stress is improved by the teleport-overscan cap, fixed-slot body-window row/cell shell recycling, and native non-interactive renderer VNode patching. Component, array, and interactive native renderer outputs remain row-keyed to avoid leaking renderer state across rows.
- Chrome canvas redraw diagnostics now include redraw request sources and merged source chains in perf traces. Use the `chromeRedrawRequest` samples plus `chromeDraw.redrawSources` to identify which full redraw owner is merging into vertical scroll frames before changing scroll/chrome architecture again.
- Row-only chrome revisions now redraw body chrome with `body-scroll`, and unchanged column redraw signatures are ignored before layout metrics are re-read. Pinned-bottom row chrome changes still force a full redraw.
- Unfocused body scroll no longer keeps the focus-remount watcher subscribed to viewport row/window signatures; focus restoration still tracks the full window only while the grid owns focus.
- Canvas-chrome body cells now skip the legacy inline row-fill fallback in the per-cell style hot path. Non-canvas row-fill behavior is still covered for compatibility.
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
