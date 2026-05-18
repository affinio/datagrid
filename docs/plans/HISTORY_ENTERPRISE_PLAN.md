# DataGrid History Enterprise Implementation Plan

This plan converts `docs/audits/HISTORY_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current public API remains the baseline: `history`, `DataGridHistoryController`, core `TransactionService`, app intent history, and server-backed stack undo/redo. Do not introduce a parallel history runtime unless a slice explicitly proposes and approves a public contract change.

Current execution state:

- Slice 1 is completed and should be treated as the enterprise history contract baseline.
- Slice 2 is completed and should be treated as the async history single-flight baseline.
- Slice 3 is next and should harden undo failure compensation.
- Server-backed grids should continue to prefer datasource stack undo/redo over client row snapshots.
- Client history is currently snapshot-based and in-memory; server history is operation-backed and persistent within the server-demo datasource scope.
- Virtualization, rendering, and server datasource enterprise tracks are closed as of 2026-05-18. History slices should reuse their diagnostics, datasource consistency language, and browser-frame expectations where useful instead of creating duplicate tracks.

## Slice 1: Enterprise History Contract

- Status: Completed. `docs/datagrid-history.md` now defines client snapshot history versus server stack history, ownership boundaries, stack invariants, persistence/recovery limits, snapshot limits, restoration limits, and collaboration limits. Server datasource protocol and consistency docs now state that server-backed grids should route normal undo/redo through scoped stack history and keep operation-id replay as diagnostics/manual replay.
- Objective: define the supported history modes, ownership boundaries, stack invariants, persistence boundaries, and unsupported enterprise behaviors before tightening runtime semantics.
- Affected packages/files:
  - `docs/datagrid-history.md`
  - `docs/audits/HISTORY_ENTERPRISE_AUDIT.md`
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/consistency.md`
- Expected behavior change: no runtime behavior change; host apps now have an explicit contract for client snapshot history versus server stack history, redo invalidation, persistence, reload, and collaborative limitations.
- Tests added/covered:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define enterprise history contract`

## Slice 2: Async History Action Serialization

- Status: Completed. Core `TransactionService` now rejects overlapping `applyTransaction`, `commitBatch`, `undo`, and `redo` calls while an async action is in progress, and also blocks batch begin/rollback during an active async action. The orchestration history action runner now ignores a second keyboard/control undo/redo trigger while the first trigger is pending and exposes pending state for integration layers.
- Objective: prevent overlapping undo, redo, apply, and batch actions from corrupting stack state or producing stale UI state.
- Affected packages/files:
  - `packages/datagrid-core/src/core/transactionService.ts`
  - `packages/datagrid-core/src/core/__tests__/transactionService.contract.spec.ts`
  - `packages/datagrid-orchestration/src/history/useDataGridHistoryActionRunner.ts`
  - `packages/datagrid-vue/src/composables/useDataGridHistoryActionRunner.ts`
- Expected behavior change: core transaction callers get a deterministic rejection for overlapping async history actions; keyboard/control runner callers get `false` for duplicate triggers while the first action is pending.
- Tests added/covered:
  - Concurrent apply, commit, begin batch, undo, redo, and follow-up apply calls cannot interleave stack mutation.
  - Keyboard/control runner ignores duplicate triggers before committing editor state twice.
  - Existing synchronous history behavior remains compatible.
- Validation command: `pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/core/__tests__/transactionService.contract.spec.ts && pnpm --filter @affino/datagrid-orchestration exec vitest run --config vitest.config.ts src/__tests__/useDataGridHistoryActionRunner.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): serialize history actions`

## Slice 3: Undo Failure Compensation

- Status: Planned.
- Objective: make failed undo paths as recoverable as failed apply paths, especially for multi-command transactions and batches.
- Affected packages/files:
  - `packages/datagrid-core/src/core/transactionService.ts`
  - `packages/datagrid-core/src/core/__tests__/transactionService.contract.spec.ts`
  - `docs/datagrid-history.md`
- Expected behavior change: if undo fails after partially rolling back a transaction, already-undone commands are compensated according to the documented order and the undo/redo stacks remain consistent.
- Tests to add/update:
  - Undo failure halfway through a multi-command transaction.
  - Undo failure in a batch.
  - Redo stack state after compensated undo failure.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/core/__tests__/transactionService.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-core): compensate failed undo batches`

## Slice 4: Snapshot Scope And Memory Budget

- Status: Planned.
- Objective: bound client history snapshot size by row/cell/byte estimates and reduce unsafe full-model snapshot fallback for large grids.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/dataGridHistory.ts`
  - `packages/datagrid-vue-app/src/app/useDataGridAppIntentHistory.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGridApp.history.spec.ts`
  - `docs/datagrid-history.md`
- Expected behavior change: large or unscoped client history entries are guarded by explicit budgets and diagnostics instead of silently capturing unbounded snapshots.
- Tests to add/update:
  - Partial snapshot capture stays within configured row/cell budgets.
  - Full snapshot fallback is rejected or downgraded when it exceeds the budget.
  - Redo invalidation remains unchanged after budget rejection.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- DataGridApp.history`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): bound history snapshot size`

## Slice 5: Restoration State Payload

- Status: Planned.
- Objective: add optional history restoration payloads for spreadsheet context: active cell, selection ranges, focus target, scroll anchor, and edit target where supported.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/app/useDataGridAppIntentHistory.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageHistory.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGridApp.history.spec.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
  - `docs/datagrid-history.md`
- Expected behavior change: supported undo/redo actions can restore user context after virtual remount, server refresh, and common edit/fill/paste flows without changing existing adapters that ignore restoration metadata.
- Tests to add/update:
  - Undo/redo restores active cell and selection after virtual remount.
  - Inline edit commit followed by undo restores focus target where feasible.
  - Scroll anchors use row ids and column keys, not volatile indexes, when available.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- DataGridApp.history DataGridTableStage`
- Risk level: High
- Suggested commit message: `feat(datagrid-vue-app): restore history interaction state`

## Slice 6: Versioned Operation Payloads

- Status: Planned.
- Objective: define a versioned operation shape for enterprise history while keeping snapshot history as a compatibility fallback.
- Affected packages/files:
  - `packages/datagrid-core/src/core/transactionService.ts`
  - `packages/datagrid-vue-app/src/dataGridHistory.ts`
  - `packages/datagrid-vue-app/src/app/useDataGridAppIntentHistory.ts`
  - `docs/datagrid-history.md`
- Expected behavior change: edit, paste, cut-paste, fill, range move, row insert/delete, and placeholder materialization can be represented by serializable metadata before any persistence or recovery API is exposed.
- Tests to add/update:
  - Operation serialization round trips for supported intents.
  - Snapshot fallback remains available for unsupported operations.
  - Operation metadata includes intent, scope, affected rows/columns, and compatibility version.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- dataGridHistory DataGridApp.history`
- Risk level: High
- Suggested commit message: `feat(datagrid): define versioned history operations`

## Slice 7: Server History Idempotency Guard

- Status: Planned.
- Objective: enforce server operation idempotency at the storage boundary instead of relying only on service-level duplicate checks.
- Affected packages/files:
  - `backend/app/features/server_demo/history_models.py`
  - `backend/app/features/server_demo/history_service.py`
  - `backend/app/features/server_demo/edit_service.py`
  - `backend/app/features/server_demo/fill_service.py`
  - `backend/tests/test_server_demo_history.py`
  - `docs/server-datasource/consistency.md`
- Expected behavior change: duplicate operation ids within the same workspace/table/history scope produce deterministic responses under concurrent requests.
- Tests to add/update:
  - Database-enforced duplicate operation id behavior.
  - Concurrent edit/fill with the same operation id.
  - Concurrent stack undo requests for the same history scope.
- Validation command: `cd backend && uv run pytest tests/test_server_demo_history.py`
- Risk level: High
- Suggested commit message: `fix(backend): enforce history operation idempotency`

## Slice 8: Server Operation Coverage And Collaboration Policy

- Status: Planned.
- Objective: either extend server-backed history beyond cell edit/fill events or explicitly document unsupported structural/collaborative operations and their conflict behavior.
- Affected packages/files:
  - `backend/app/features/server_demo/history_service.py`
  - `backend/tests/test_server_demo_history.py`
  - `docs/datagrid-history.md`
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/consistency.md`
- Expected behavior change: server-backed history has deterministic capability behavior for row insert/delete, structural operations, remote overlap conflicts, reload recovery, and stale operation replay.
- Tests to add/update:
  - Unsupported structural operations fail with a capability error or are replayed if implemented.
  - Local undo after overlapping remote changes follows the documented conflict policy.
  - Reload/status sync does not imply unavailable client history recovery.
- Validation command: `cd backend && uv run pytest tests/test_server_demo_history.py`
- Risk level: High
- Suggested commit message: `docs(datagrid): define server history operation scope`

## Recommended Execution Order

1. Slice 1: Enterprise History Contract
2. Slice 2: Async History Action Serialization (completed)
3. Slice 3: Undo Failure Compensation (next)
4. Slice 4: Snapshot Scope And Memory Budget
5. Slice 5: Restoration State Payload
6. Slice 6: Versioned Operation Payloads
7. Slice 7: Server History Idempotency Guard
8. Slice 8: Server Operation Coverage And Collaboration Policy

## Execution Notes

- Preserve the current `history` prop and `DataGridHistoryController` public surface unless a slice explicitly proposes an API change.
- Keep server-backed datasource undo/redo on the server stack path; do not mix it with client row snapshots.
- Treat operation serialization as additive until migration and recovery semantics are approved.
- Keep restoration payloads optional so existing adapters can ignore them.
- Avoid broad transaction abstractions until stack locking, compensation, and operation shape are covered by focused tests.
- Document unsupported collaborative merge, reload recovery, structural operations, and offline replay behavior instead of implying enterprise coverage.
