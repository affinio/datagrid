# Server Data Source Parity Checklist

Status: baseline demo implemented; filtering/editing parity not started.

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
- [x] Sandbox navigation link

## Next Slices
- [ ] Server-side filtering
- [ ] Inline editing
- [ ] Optimistic updates
- [ ] Undo/redo semantics
- [ ] Fill handle semantics
- [ ] Range move

## Client-Model Parity Checklist
- [ ] Selection across unloaded rows
- [ ] Copy/paste across unloaded rows
- [ ] Grouping
- [ ] Aggregation
- [ ] Pivot/histograms if applicable

## Server-Specific Behaviour
- [ ] Cache invalidation
- [ ] Push updates
- [ ] Error/retry UX
- [ ] Performance profiling

## Open API Gaps
- [ ] Confirm whether additional public hooks are needed for server cache invalidation UX
- [ ] Confirm whether retry and push-update affordances belong in the public app layer
- [ ] Confirm whether diagnostics should expose more server-specific cache/prefetch state

## Manual Test Checklist
- [ ] Open the demo and verify initial load completes
- [ ] Scroll quickly and confirm viewport-driven requests continue
- [ ] Sort by multiple columns if supported by the grid header
- [ ] Trigger a refresh and confirm row identities remain stable
- [ ] Trigger the error path and verify diagnostics update
- [ ] Confirm cached rows and loaded rows labels match observed behavior
