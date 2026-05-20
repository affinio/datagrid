# DataGrid Top Improvement Slice Plan

Date: `2026-05-20`

Scope: the five highest-impact DataGrid improvement tracks selected after the internal docs sweep.

## Track 1. Server-Side Row Model V2

Goal: make backend-owned grids work with large projected datasets, not only flat loaded rows.

Slices:

1. [x] Add server-demo grouping projection for `groupBy: region` using the existing pull protocol.
2. [x] Add server projection capability metadata and docs for supported/unsupported group/tree/pivot modes.
3. [x] Add server tree pull context contract and deterministic row ids for current branch rows.
4. [ ] Add block-store cache semantics for hierarchical projections.
5. [ ] Add partial refresh/invalidation per group branch/block.
6. [ ] Add server pivot projection implementation or explicit enterprise adapter boundary.
7. [ ] Add browser/perf gates for grouped server datasource scroll, expand/collapse, and refresh.

## Track 2. Unloaded-Row Operations

Goal: selection, clipboard, fill, and range move should delegate to the server when the target spans unloaded rows.

Slices:

1. [ ] Define operation eligibility and blocked/server/local states in app diagnostics.
2. [ ] Add server operation request/response shape for delete/clear/copy/paste/fill/range move.
3. [ ] Implement copy/paste over unloaded ranges with revision and projection tokens.
4. [ ] Implement fill over unloaded ranges; keep series fill explicitly unsupported until implemented.
5. [ ] Implement range move over unloaded ranges with conflict handling.
6. [ ] Add browser checks for placeholder, stale, and grouped projection cases.

## Track 3. Column Groups And Row Pinning

Goal: make enterprise layout semantics first-class instead of stage-local behavior.

Slices:

1. [ ] Define public column-group model, state snapshot, and migration behavior.
2. [ ] Implement column-group header runtime across center/pinned panes.
3. [ ] Add column-group resize/reorder/visibility semantics.
4. [ ] Define row pinning model for top/bottom rows and state persistence.
5. [ ] Implement pinned-row virtualization and keyboard/selection semantics.
6. [ ] Add visual/browser coverage for wide tables, pinned panes, selection overlays, and state restore.

## Track 4. Comparator Policy And Aggregation Registry

Goal: make business sorting and aggregation extensible without patching core internals.

Slices:

1. [ ] Define comparator policy contract: default, locale, natural, custom.
2. [ ] Wire comparator policy into sort, group, pivot, and server query serialization.
3. [ ] Define public aggregation registry contract.
4. [ ] Add custom aggregation registration and validation.
5. [ ] Add docs and tests for client, worker, pivot, and server boundaries.

## Track 5. Pivot/Tree Performance Hardening

Goal: reduce latency and heap cost for large tree/pivot workloads.

Slices:

1. [ ] Profile current tree path/parent cache build and pivot rebuild hot paths.
2. [ ] Tighten tree invalidation to structural dependency fields.
3. [ ] Add tree value-only patch fast path.
4. [ ] Expand pivot patch tiers beyond value-only patch.
5. [ ] Reduce pivot/tree allocation churn and duplicated materialized state.
6. [ ] Promote sustained regression gates and memory budgets.
