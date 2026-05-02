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
- [ ] Remove `clearAll()` from:
  - [ ] setSortModel
  - [ ] setFilterModel
  - [ ] setAggregationModel
  - [ ] setGroupBy
  - [ ] setPivotModel
- [ ] Introduce **staging / atomic swap** of cache
- [ ] Keep existing rows visible during refresh
- [ ] Preserve request versioning (DO NOT break it)
- [x] Add state split:
  - [x] `initialLoading`
  - [x] `refreshing`
- [ ] Ensure viewport changes do NOT blank existing rows

### Acceptance Criteria

- [ ] Sorting does NOT blank the grid
- [ ] Filtering does NOT blank the grid
- [x] Only one request per sort/filter change
- [ ] No visible “table reload” effect
- [ ] Diagnostics show `refreshing` instead of empty

### Validation Notes

- Deferred cache replacement for sort/filter is covered by focused tests in `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- The targeted tests prove stale rows remain readable while the pending pull is unresolved, and the cache swaps to the new rows only after success
- Loading-state split is covered by explicit focused tests:
  - first critical load reports `initialLoading = true`, `refreshing = false`, `loading = true`
  - pending sort refresh with cached rows reports `initialLoading = false`, `refreshing = true`, `loading = true`
  - completed refresh reports all three flags false/derived correctly after the pull resolves

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
