# Server Data-Source Grid UX Stabilization Plan

## 🎯 Goal

Make server/data-source-backed grid behave like a local spreadsheet from a UX perspective:

- no flicker
- no “empty table” during operations
- no visible reloads
- smooth continuity during:
  - sorting
  - filtering
  - aggregation
  - fill handle
  - inline edit
  - undo/redo
  - viewport changes

---

## 🔍 Current Problems (from audit)

- Cache is cleared (`clearAll()`) before new data arrives → grid goes blank
- Sort + filter triggers **two refreshes**
- No distinction between `initialLoading` and `refreshing`
- No stale-while-refresh behavior
- No optimistic UI for edits/fill (later phase)

---

## 🧱 Phases

---

## Phase 1 — Stale-While-Refresh + Batch Sort/Filter

**Goal:** remove flicker and blank states

### Tasks

- [x] Implement `setSortAndFilterModel()` in `dataSourceBackedRowModel`
  - Validation: targeted vitest passed
  - Note: full spec has pre-existing unrelated failures
- [x] Ensure sort + filter = **one backend pull**
- [x] Remove `clearAll()` from:
  - [x] setSortModel
  - [x] setFilterModel
  - [x] setAggregationModel
  - [x] setGroupBy
  - [x] setPivotModel
- [x] Introduce **staging / atomic swap** of cache
  - Validation: sort/filter/group focused tests + grouping/aggregation sandbox UI checks
- [x] Keep existing rows visible during refresh
  - Validation: sort/filter tests; grouping/aggregation manually verified in sandbox
- [x] Preserve request versioning (DO NOT break it)
  - Validation: existing requestId/stateKey logic preserved; no changes to stale-response discard path
- [x] Add state split:
  - [x] `initialLoading`
  - [x] `refreshing`
- [x] Ensure viewport changes do NOT blank existing rows
  - Validation: focused viewport-stability tests cover cache retention across viewport churn, partial cache reuse while missing rows load, and final swap on resolve

### Acceptance Criteria

- [x] Sorting does NOT blank the grid
- [x] Filtering does NOT blank the grid
- [x] Only one request per sort/filter change
- [x] No visible “table reload” effect
- [x] Diagnostics show `refreshing` instead of empty

### Validation Notes

- Deferred cache replacement for sort/filter/group refresh is covered by focused tests in `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- The targeted tests prove stale rows remain readable while the pending pull is unresolved, and the cache swaps to the new rows only after success
- Loading-state split is covered by explicit focused tests:
  - first critical load reports `initialLoading = true`, `refreshing = false`, `loading = true`
  - pending sort refresh with cached rows reports `initialLoading = false`, `refreshing = true`, `loading = true`
  - completed refresh reports all three flags false/derived correctly after the pull resolves
- `initialLoading` and `refreshing` are now first-class typed snapshot fields, and the sandbox snapshot diagnostic string prints both alongside `loading`
- Sandbox diagnostics now read the active row-model snapshot during `handleStateUpdate()`, so the `RowModel snapshot` and `Runtime snapshot` cards are populated during normal server refreshes
- Server-data-source sandbox grouping is visually testable through the existing Region column menu action. Selecting "Group by this column" sends `groupBy.fields = ["region"]`; the demo datasource returns deterministic `group:region:<REGION>` group rows and expanded leaf rows according to the row-model expansion snapshot.
- Group trigger expand/collapse now follows the same stale-while-refresh rule: existing rows stay visible while the expansion pull returns, then the cache is replaced with the flattened expanded/collapsed result.
- Data-source `expandGroup()` / `collapseGroup()` now evaluate group keys against the active `expandedByDefault` value, so column-menu grouping with default-expanded groups can collapse and re-expand correctly.
- Server-data-source sandbox aggregation is visually testable with the "Aggregate value by region" toolbar control. It sends an aggregation model for `value:sum`; the demo datasource returns deterministic `aggregate:region:<REGION>` leaf rows with `value = sum(value)` and `status = Count <n>`.
- Viewport stability slice: the server/data-source row model now avoids a transient pre-inflight emit during viewport pulls, so the grid no longer sees a brief non-loading snapshot while a new viewport request is starting.

---

## Phase 2 — Optimistic UI (Fill + Edit)

**Goal:** eliminate latency during edits

### Tasks

- [ ] Add optimistic patch layer (rowId-based)
- [ ] Apply patch immediately on:
  - [ ] fill handle
  - [ ] inline edit
- [ ] Commit to backend in background
- [ ] Reconcile on success
- [ ] Rollback on failure (partial, not full reset)

### Acceptance Criteria

- [ ] Fill feels instant
- [ ] Edits feel instant
- [ ] No full refresh after edit
- [ ] Errors rollback only affected cells

### Validation Notes

- Phase 2 slice 1 is now implemented for server/data-source-backed inline edits only: cached rows update immediately, successful commits reconcile through the normal refresh path without clearing cache, and failed commits roll back only the affected rows while leaving unrelated cache entries intact.
- Phase 2 slice 2 is now implemented for server-backed fill on fully materialized ranges: the controller derives optimistic rowId-based patches locally, applies them before `commitFillOperation()` resolves, and rolls back only the affected cells when the server commit fails. Unloaded ranges still use the existing pessimistic server-fill behavior.

---

## Phase 3 — Selection & Range Consistency

**Goal:** support large, non-loaded ranges safely

### Tasks

- [ ] Ensure selection is NOT tied to loaded rows
- [ ] Reconcile selection after sort/filter
- [ ] Maintain selection during refresh
- [ ] Ensure fill/operations work on virtual ranges

---

## Phase 4 — Visual Polish

**Goal:** make backend invisible to user

### Tasks

- [ ] Add subtle “refreshing” indicator (no full overlay)
- [ ] Optional skeleton only for truly missing rows
- [ ] Smooth transition on snapshot swap
- [ ] Avoid layout jumps

---

## ⚠️ Risk Areas

- [ ] Selection correctness
- [ ] Undo/redo consistency
- [ ] Fill handle behavior
- [ ] History snapshots vs optimistic patches
- [ ] Cache eviction logic
- [ ] Diagnostics correctness

---

## 📊 Diagnostics (must expose)

- [ ] initialLoading
- [ ] refreshing
- [ ] cache size
- [ ] pending requests
- [ ] request version

---

## 🧠 Design Rules

- Never clear visible cache before new data is ready
- Always prefer **atomic swap over incremental destruction**
- Separate:
  - data state
  - loading state
  - rendering state
- Backend must feel invisible

---

## 📝 Notes

(Add findings, edge cases, or decisions here)
