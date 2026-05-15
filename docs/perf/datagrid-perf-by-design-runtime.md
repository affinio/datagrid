# DataGrid Perf-by-Design Runtime Contracts

Updated: `2026-02-08`

This document captures mandatory runtime performance contracts for `@affino/datagrid-core`.

## Hot Path Contracts

Scope:
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`

Required invariants:
- row pool is reused (`RowPoolItem[]`) instead of recreated per update.
- visible row snapshots use bounded ring buffers (`visibleSnapshotBuffers`) instead of per-frame `slice`.
- row callback signature uses numeric hashing (`computeRowsCallbackSignature`) instead of array/string join allocations.
- zero-row/reset paths clear pools in-place and reuse buffers.

## Validation Contracts

Runtime contract tests:
- `packages/datagrid-core/src/viewport/__tests__/perfHotPath.contract.spec.ts`

Required assertions:
- bounded `visibleRows` reference reuse under scroll churn (`<= 3` unique arrays).
- no redundant `onRows` callback emissions for stable state signature.

Static perf-contract gate:
- command: `pnpm run quality:perf:datagrid`
- script: `scripts/check-datagrid-perf-contracts.mjs`
- report: `artifacts/quality/datagrid-perf-contracts-report.json`

## CI Budget Contracts

Row-model benchmark must pass both p95 and p99 limits:

- `PERF_BUDGET_MAX_CLIENT_RANGE_P95_MS`
- `PERF_BUDGET_MAX_CLIENT_RANGE_P99_MS`
- `PERF_BUDGET_MAX_SERVER_RANGE_P95_MS`
- `PERF_BUDGET_MAX_SERVER_RANGE_P99_MS`
- `PERF_BUDGET_MAX_WINDOW_SHIFT_P95_MS`
- `PERF_BUDGET_MAX_WINDOW_SHIFT_P99_MS`

Harness source:
- `scripts/bench-datagrid-harness.mjs`
- `scripts/bench-datagrid-rowmodels.mjs`

Interaction benchmark (selection/fill virtualization proxy) must pass:

- `PERF_BUDGET_MAX_SELECTION_DRAG_P95_MS`
- `PERF_BUDGET_MAX_SELECTION_DRAG_P99_MS`
- `PERF_BUDGET_MAX_FILL_APPLY_P95_MS`
- `PERF_BUDGET_MAX_FILL_APPLY_P99_MS`

Harness source:
- `scripts/bench-datagrid-interactions.mjs`

## Baseline Drift Lock

CI benchmark gate also enforces baseline drift lock:

- baseline file: `docs/perf/datagrid-benchmark-baseline.json`
- gate script: `scripts/check-datagrid-benchmark-report.mjs`
- checks:
  - task runtime duration drift;
  - aggregate elapsed drift;
  - aggregate heap drift.
