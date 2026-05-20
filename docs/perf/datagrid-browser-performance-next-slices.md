# DataGrid Browser Performance Next Slices

## Current Findings

The enterprise browser frame benchmark on `/vue/shell/base-grid` with `100000` rows and `32` columns separates the remaining browser costs into two buckets:

- Smooth vertical scroll is effectively 60 FPS, so viewport RAF work and ordinary scroll rendering are not the current bottleneck.
- `sort-only` still has main-thread spikes from column-menu value loading and synchronous full-table client sorting.

The low-risk slice is started: large column-menu value-filter histograms are deferred until after the menu is visible, and pending deferred histogram loading is canceled/invalidated when a sort action closes the menu before the histogram starts. Single-column local sort now avoids allocating one sort-value array per row. The focused interaction-frame artifact adds edit-burst diagnostics and shows context-menu open/cleanup is not the active blocker. Remaining work is to decide whether deeper local sort projection needs progressive, worker-backed, or server-backed execution, and to reduce inline-edit commit burst long tasks using the new update/open/commit diagnostics.

## Riskier Future Paths

- Async or progressive client-side sorting so large sorts do not monopolize the UI thread.
- Worker-backed sorting and projection for large client datasets.
- Server-backed sorting for large datasets where client-side full-table sort is not the right execution model.
- RAF-split sort apply or transition UX for cases where synchronous sort remains necessary.
- Lower-allocation bulk patch representation for copy, paste, and fill workloads.
- Deeper row and cell DOM reuse for jump-scroll stress cases.

These paths should be handled in separate design slices because they affect execution policy, user feedback, or core row-model/projection architecture.
