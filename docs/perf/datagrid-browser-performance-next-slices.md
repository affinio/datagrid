# DataGrid Browser Performance Next Slices

## Current Findings

The enterprise browser frame benchmark on `/vue/shell/base-grid` with `100000` rows and `32` columns separates the remaining browser costs into two buckets:

- Smooth vertical scroll is effectively 60 FPS, so viewport RAF work and ordinary scroll rendering are not the current bottleneck.
- `sort-only` still has main-thread spikes from column-menu value loading and synchronous full-table client sorting.

The low-risk slice is to keep the column menu responsive by deferring large value-filter histogram loading until after the menu is visible.

## Riskier Future Paths

- Async or progressive client-side sorting so large sorts do not monopolize the UI thread.
- Worker-backed sorting and projection for large client datasets.
- Server-backed sorting for large datasets where client-side full-table sort is not the right execution model.
- RAF-split sort apply or transition UX for cases where synchronous sort remains necessary.
- Lower-allocation bulk patch representation for copy, paste, and fill workloads.
- Deeper row and cell DOM reuse for jump-scroll stress cases.

These paths should be handled in separate design slices because they affect execution policy, user feedback, or core row-model/projection architecture.
