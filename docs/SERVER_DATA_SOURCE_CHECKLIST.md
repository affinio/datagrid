# Server Data Source Parity Checklist

Status: baseline demo implemented; filtering/histograms and demo-local editing slice implemented.

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
- [x] Sandbox navigation link

## Next Slices
- [ ] Undo/redo semantics
- [ ] Fill handle semantics
- [ ] Range move

Note: the row model remains read/pull-oriented; the demo uses a datasource-local `commitEdits` adapter for optimistic edits.
Note: single-cell `cell-edit` remains single-cell only; batch edits flow through `applyEdits([]) -> patchRows -> commitEdits([])`.
Note: batch failure simulation rejects alternating rows so rollback behavior can be verified visually.

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

## Manual Test Checklist
- [ ] Open the demo and verify initial load completes
- [ ] Scroll quickly and confirm viewport-driven requests continue
- [ ] Sort by multiple columns if supported by the grid header
- [ ] Apply a filter and confirm the visible range reloads against filtered rows
- [ ] Trigger a refresh and confirm row identities remain stable
- [ ] Trigger the error path and verify diagnostics update
- [ ] Confirm cached rows and loaded rows labels match observed behavior
