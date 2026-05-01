# Server Data Source Parity Checklist

Status: baseline demo implemented; filtering/histograms, demo-local editing, and server-v1 fill diagnostics implemented.

## Current Baseline
- Demo route: `/vue/server-data-source-grid`
- Demo uses `createDataSourceBackedRowModel`
- Goal: validate a realistic server/data-source row-model path in the sandbox before wider adoption

## Implemented
- [x] 100k deterministic fake rows
- [x] `createDataSourceBackedRowModel` demo
- [x] Async pull with latency
- [x] Viewport/infinite loading
- [x] Stable row identity
- [x] Loading/error diagnostics
- [x] Server-side sorting
- [x] Server-side filtering
- [x] Server-side column histograms
- [x] Inline editing
- [x] Optimistic updates
- [x] Commit failure / rollback UX
- [x] Batch commit support
- [x] Partial batch rollback UX
- [x] Server-v1 fill diagnostics
- [x] Sandbox navigation link

## Next Slices
- [ ] Undo/redo semantics
- [ ] Range move

Note: the row model remains read/pull-oriented; the demo uses a datasource-local `commitEdits` adapter for optimistic edits.
Note: single-cell `cell-edit` remains single-cell only; batch edits flow through `applyEdits([]) -> patchRows -> commitEdits([])`.
Note: batch failure simulation rejects alternating rows so rollback behavior can be verified visually.
Note: server-v1 fill is supported only for loaded rows; drag fill and double-click autofill remain viewport/cache bounded and reuse the normal grouped history transaction path.
Note: server-v1 fill does not search beyond loaded rows for the true double-click autofill boundary and does not materialize unloaded rows.
Note: if fill or batch commit hits partial rejection, the demo surfaces a warning and the refresh is suppressed until the commit path resolves.

## Client-Model Parity Checklist
- [ ] Selection across unloaded rows
- [ ] Copy/paste across unloaded rows
- [ ] Grouping
- [ ] Aggregation
- [ ] Pivot/histograms if applicable
- Note: numeric buckets are not implemented yet; value histograms use exact numeric values for now.

## Server-Specific Behaviour
- [ ] Cache invalidation
- [ ] Push updates
- [ ] Error/retry UX
- [ ] Performance profiling
- [x] Fill diagnostics for loaded-row server v1

## Open API Gaps
- [ ] Confirm whether additional public hooks are needed for server cache invalidation UX
- [ ] Confirm whether retry and push-update affordances belong in the public app layer
- [ ] Confirm whether diagnostics should expose more server-specific cache/prefetch state

## Proposed Mutation API
- Optional `commitEdits` method on `DataGridDataSource`
- `pull()` remains read-only
- Optimistic lifecycle: apply local override, commit to datasource, refresh/invalidate on success
- Rollback/error handling: restore the local override and surface the failure if commit is rejected
- Revision/conflict support is optional future enhancement, not required for v1
- Batch edits are supported by the `edits[]` request shape
- Out of scope for v1: `before-cell-edit`, conflict UI, merge semantics, `patchRows` on `DataSourceBackedRowModel`

## Server v1 Fill Contract
- Supported: drag fill over loaded, editable rows.
- Supported: double-click autofill over loaded, editable rows.
- Supported: one grouped history transaction for a committed fill.
- Supported: undo/redo for committed loaded-row fills.
- Out of scope: finding the true autofill boundary beyond loaded/cache rows.
- Out of scope: filling unloaded rows or materializing them implicitly.
- Out of scope: server-specific formula rebasing semantics.
- Diagnostics: batch row count, skipped/unloaded row count when detectable, cache-boundary warning, and partial-rejection/refresh-suppression warning.

## Manual Test Checklist
- [ ] Open the demo and verify initial load completes
- [ ] Scroll quickly and confirm viewport-driven requests continue
- [ ] Sort by multiple columns if supported by the grid header
- [ ] Apply a filter and confirm the visible range reloads against filtered rows
- [ ] Trigger a refresh and confirm row identities remain stable
- [ ] Trigger the error path and verify diagnostics update
- [ ] Confirm cached rows and loaded rows labels match observed behavior
