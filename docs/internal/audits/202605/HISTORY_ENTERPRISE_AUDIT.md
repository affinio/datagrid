# DataGrid History Enterprise Audit

## Executive Summary

The DataGrid history stack is useful and production-shaped, but it is not yet uniformly enterprise-grade across client-only grids, server-backed grids, and collaborative workflows.

There are three distinct history paths today:

- A generic in-memory transaction service in `datagrid-core`.
- A client-side intent history in `datagrid-orchestration` / `datagrid-vue` that records row snapshots.
- A server-backed stack history path for the server demo datasource and backend.

These paths are compatible enough for current edit, paste, fill, toolbar, shortcut, placeholder, and server-demo workflows. The strongest enterprise pieces are rollback payload enforcement, batch-as-one-undo-unit semantics, redo invalidation, scoped server stack undo/redo, revision/datasetVersion integration, and focused tests.

The remaining main gaps are persisted operation recovery, editor/formula restoration depth, structural row operation support, collaborative conflict semantics, and direct external/server adapter concurrency semantics outside the built-in runner.

Current enterprise readiness is **7/10**. A realistic target is **9/10** after adding persisted operation recovery, deeper editor restoration, server-backed non-cell operation support, and collaborative revision semantics.

## Implementation Progress

- 2026-05-18: Slice 1, Enterprise History Contract, is complete. `docs/datagrid-history.md` now defines client snapshot history versus server stack history, ownership boundaries, stack invariants, persistence/recovery limits, snapshot limits, restoration limits, and collaboration limits. `docs/server-datasource/protocol.md` and `docs/server-datasource/consistency.md` now state that server-backed grids should use scoped stack undo/redo as the normal owner and keep operation-id replay as diagnostics/manual replay.
- 2026-05-18: Slice 2, Async History Action Serialization, is complete. Core `TransactionService` now rejects overlapping async `applyTransaction`, `commitBatch`, `undo`, and `redo` calls and blocks batch begin/rollback during an active async action. The orchestration history runner now ignores duplicate keyboard/control undo/redo triggers while the first action is pending.
- 2026-05-18: Slice 3, Undo Failure Compensation, is complete. Core `TransactionService` now re-applies commands already rolled back inside a failed undo transaction and re-applies transactions already rolled back inside a failed undo batch, leaving undo/redo stacks unchanged when the action fails.
- 2026-05-18: Slice 4, Snapshot Scope And Memory Budget, is complete. Client app intent history now marks full/partial snapshots that exceed row, cell, or byte-estimate budgets and skips recording those over-budget intents instead of creating unbounded undo entries.
- 2026-05-18: Slice 5, Restoration State Payload, is complete. Client app history snapshots now carry optional active-cell, selection snapshot, scroll anchor, focus target, and edit target metadata, and the Vue app stage restores selection/focus context through existing selection and active-cell viewport paths.
- 2026-05-18: Slice 6, Versioned Operation Payloads, is complete. Core transaction metadata now preserves operation payloads, app intent descriptors can carry optional operation metadata, and built-in app history derives normalized version-1 operation metadata beside snapshot replay payloads.
- 2026-05-18: Slice 7, Server History Idempotency Guard, is complete. Server-demo operation ids are now protected by database uniqueness within workspace/table scope, and edit/fill insert races are converted to the existing `duplicate-operation-id` API error.
- 2026-05-18: Slice 8, Server Operation Coverage And Collaboration Policy, is complete. Server stack history remains explicitly limited to edit/fill cell events, and cell-event undo/redo now rejects overlapping remote edits with `history-conflict` without overwriting the remote value.
- Remaining runtime gaps: persisted operation recovery, broader server operation implementation beyond documented cell-event support, concurrent server stack action coverage, and deeper inline/formula editor recovery.

## Current Architecture Summary

- `packages/datagrid-core/src/core/transactionService.ts` owns generic transaction mechanics: commands, rollback payloads, pending batches, undo/redo stacks, max depth, lifecycle snapshots, and transaction events.
- `packages/datagrid-core/src/core/gridApiTransactionMethods.ts` exposes transaction methods through the Grid API capability boundary.
- `packages/datagrid-orchestration/src/history/useDataGridIntentHistory.ts` adapts the core transaction service into intent history by storing before/after snapshots as transaction payload and rollback payload.
- `packages/datagrid-vue/src/composables/useDataGridIntentHistory.ts` wraps orchestration history in Vue refs.
- `packages/datagrid-vue/src/app/useDataGridAppIntentHistory.ts` captures full or partial row snapshots and replays them through `rows.applyEdits(...)` or `rows.setData(...)`.
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageHistory.ts` chooses between an external history adapter and the built-in intent history.
- `packages/datagrid-vue-app/src/dataGridHistory.ts` defines public `history` prop normalization, shortcut modes, toolbar modes, and the exposed controller contract.
- `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts` wires built-in toolbar controls, window/grid shortcuts, external adapters, and server datasource stack history.
- `packages/datagrid-server-adapters/src/index.ts` exposes server datasource edit/fill/history methods, maintains cached history status, posts scoped stack undo/redo/status requests, applies row snapshots or invalidations, and updates dataset versions.
- `backend/app/features/server_demo/history.py` and `backend/packages/affino_grid_backend/affino_grid_backend/history/base.py` implement server-side operation replay from persisted cell events.
- `backend/app/features/server_demo/edits.py` and `backend/app/features/server_demo/fill.py` record edit/fill operations, cell events, redo-branch invalidation, and change-feed events.
- `docs/server-datasource/protocol.md` and `docs/server-datasource/consistency.md` document scoped stack undo/redo, operation-id replay, history status, revision monotonicity, redo invalidation, and deterministic replay expectations.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/datagrid-history.md`
- `docs/server-datasource/integration-docs-map.md`
- `docs/server-datasource/protocol.md`
- `docs/server-datasource/consistency.md`
- `docs/FORMULA_ENGINE_ENTERPRISE_AUDIT.md`

Core and Vue history:

- `packages/datagrid-core/src/core/transactionService.ts`
- `packages/datagrid-core/src/core/gridApiTransactionMethods.ts`
- `packages/datagrid-core/src/core/__tests__/transactionService.contract.spec.ts`
- `packages/datagrid-orchestration/src/history/useDataGridIntentHistory.ts`
- `packages/datagrid-orchestration/src/history/useDataGridHistoryActionRunner.ts`
- `packages/datagrid-vue/src/composables/useDataGridIntentHistory.ts`
- `packages/datagrid-vue/src/composables/useDataGridHistoryActionRunner.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridIntentHistory.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridHistoryActionRunner.contract.spec.ts`
- `packages/datagrid-vue/src/app/useDataGridAppIntentHistory.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
- `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-vue/src/app/useDataGridAppFill.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppIntentHistory.contract.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`

Vue app and server datasource adapters:

- `packages/datagrid-vue-app/src/dataGridHistory.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageHistory.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridTableStageHistory.spec.ts`
- `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
- `packages/datagrid-vue-app/src/host/DataGridHistoryToolbarButton.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-server-adapters/src/index.ts`
- `packages/datagrid-server-adapters/src/index.spec.ts`
- `packages/datagrid-server-client/src/client.ts`
- `packages/datagrid-server-client/src/client.spec.ts`

Backend and sandbox:

- `backend/app/features/server_demo/history.py`
- `backend/app/features/server_demo/history_router.py`
- `backend/app/features/server_demo/edits.py`
- `backend/app/features/server_demo/fill.py`
- `backend/app/features/server_demo/repository.py`
- `backend/app/features/server_demo/models.py`
- `backend/packages/affino_grid_backend/affino_grid_backend/history/base.py`
- `backend/alembic/versions/20260504_0003_create_server_demo_operation_history.py`
- `backend/alembic/versions/20260505_0005_scope_server_demo_operations_and_cell_events_by_workspace.py`
- `backend/alembic/versions/20260506_0001_add_user_session_scope_to_server_demo_operations.py`
- `backend/alembic/versions/20260506_0002_add_table_id_to_server_demo_operations.py`
- `backend/tests/test_server_demo_history_stack.py`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoHistoryScope.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoHistoryState.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoHistoryState.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpAdapter.spec.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.ts`
- `packages/datagrid-sandbox/src/serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource.spec.ts`

## Strengths

- The core transaction service requires `rollbackPayload` for every command. This is the right baseline for rollback safety.
- Core transaction apply is atomic at command granularity. If a later command fails during apply, `transactionService.ts` rolls back already-applied commands in reverse order.
- Batches are supported as a single undo unit. Tests in `transactionService.contract.spec.ts` cover pending batch commit, reverse undo order, and redo order.
- Redo invalidation exists in both client and server paths. Core clears `redoStack` on new committed transactions, and server edit/fill services call `invalidate_redo_branch_for_scope(...)`.
- History depth is bounded by `maxHistoryDepth` in core and exposed as `history.depth` in `@affino/datagrid-vue-app`.
- The app history path prefers partial row snapshots when row ids are known. `useDataGridAppIntentHistory.ts`, inline editing, clipboard, and interaction controller paths all use row-id scoped snapshots where possible.
- Clipboard history grouping is practical. Paste across multiple ranges merges updates into one recorded edit transaction; cut-paste records source clear and target paste as one operation.
- Fill and range move are integrated with history for materialized client ranges through `useDataGridAppInteractionController.ts`.
- Server fill is separated from client snapshot history. Server datasource history uses stack undo/redo through `/api/history/undo|redo`, while operation-id routes remain diagnostic/manual replay paths.
- Server history has real persistence. `server_demo_operations` stores operation scope/status/type/revision, and `server_demo_cell_events` stores before/after cell values.
- Server history scope is explicit. The backend and adapter use workspace, table, user, and session scope, and tests cover user/session isolation.
- Server undo/redo bump revision and return datasetVersion, invalidation, rows, and history status. This matches the protocol and helps avoid immediate status probes after successful mutations.
- History controls are public and test-covered. `DataGrid.contract.spec.ts` covers toolbar controls, external module hosts, shortcuts, server datasource history, and exposed controller behavior.
- Placeholder-row history has targeted coverage. The app tests cover undoing placeholder materialization and recording mixed real-plus-placeholder deletes as real-row history only.

## Findings By Severity

### Blocker

1. **Client-side history is snapshot-based and not serializable as an operation log.**
   `useDataGridIntentHistory.ts` stores snapshot payloads inside in-memory transaction commands. `useDataGridAppIntentHistory.ts` records row snapshots, not normalized edit/fill/delete operations. This is fine for local undo/redo, but it blocks enterprise expectations for persisted client history, reload recovery, operation inspection, conflict replay, and collaborative editing.
   Status after Slice 6: built-in client history now records version-1 operation metadata beside snapshots. Snapshot replay is still the source of undo/redo truth, and persisted recovery/conflict replay remains future work.

2. **There is no unified history contract across client snapshot history and server operation history.**
   `docs/datagrid-history.md` documents the public prop/controller, while `docs/server-datasource/protocol.md` documents server stack history. The code supports both, but the boundary is implicit: client history restores snapshots, server history replays persisted operations. Enterprise consumers need a single contract that states which mode owns undo/redo, what is persisted, how redo invalidation works, and what restoration semantics are guaranteed.
   Status after Slice 1: documentation now defines this boundary. Runtime hardening and operation serialization remain open.

### High

1. **Async history actions are not guarded by a single-flight lock.**
   `transactionService.ts` supports async executors, and tests verify async snapshot replay waits before resolving. However, the service does not serialize concurrent `applyTransaction`, `undo`, `redo`, or `commitBatch` calls. Two simultaneous shortcut/toolbar/server actions can race stack state unless caller code prevents it.
   Status after Slice 2: core transaction actions and keyboard/control history runner triggers are now single-flight. Direct external adapters and server datasource calls still own their backend idempotency/concurrency semantics.

2. **Undo failure is not compensated the same way apply failure is.**
   Apply and redo use `applyCommittedBatch(...)`, which rolls back applied transactions if a later transaction fails. Undo uses `rollbackCommittedBatch(...)` and does not restore already-undone commands if a later rollback command fails. This is a concrete rollback consistency gap for multi-command or multi-transaction undo.
   Status after Slice 3: core undo now compensates partial command and batch rollback failures and leaves stacks unchanged on failure.

3. **Client snapshots can overwrite unrelated concurrent changes.**
   Partial row history restores entire captured row objects through `rows.applyEdits(...)`. If another workflow or server refresh changes another field on the same row after the snapshot is recorded, undo can revert more than the edited cells. This is acceptable for single-user local grids, but not enterprise collaborative or server-optimistic editing.

4. **Selection, focus, and edit restoration are not first-class history payloads.**
   `useDataGridHistoryActionRunner.ts` commits active inline editors before history actions and closes context menus. Some edit/fill paths restore focus after mutation. But history snapshots do not include active cell, selection ranges, scroll anchor, editor state, or formula-edit state, so undo/redo can restore data without restoring spreadsheet context.
   Status after Slice 5: built-in client history snapshots now include optional active-cell, selection snapshot, scroll anchor, focus target, and edit target metadata, and the Vue app stage restores selection/focus context. Reopening inline/formula editors remains future work.

5. **Client history memory is bounded by entry count, not bytes/cells.**
   `maxHistoryDepth` caps stack depth, but a single transaction can store a full-grid snapshot when row ids are unavailable or a structural operation falls back to `captureRowsSnapshot()`. There is no byte budget, cell budget, compression, or large-range spill strategy.
   Status after Slice 4: app intent snapshots now have row, cell, and byte-estimate budgets and over-budget intents are not recorded as undo entries. Compression/spill remains out of scope.

6. **Server-backed history currently records cell events, not all DataGrid operations.**
   `GridHistoryServiceBase` replays `before_value` / `after_value` cell events. Backend edit/fill paths record cell events, but structural row insert/delete, column operations, selection state, formulas, grouping/tree expansion, pivot changes, and workbook-level operations are unsupported rather than broken.
   Status after Slice 8: server stack history is documented as cell-event only unless a host backend adds an explicit capability. Cell-event undo/redo now checks the current cell value and rejects remote overlaps with `history-conflict` instead of overwriting them.

### Medium

1. **Full snapshot fallback can scan very large row models.**
   `captureRowsSnapshot()` loops over `runtime.api.rows.getCount()` and clones every non-group row. This is a known scalability risk for 100k/1M row client models and should be avoided or guarded for large data.

2. **Server operation uniqueness is enforced in service code rather than database constraints.**
   `ServerDemoEditService.ensure_operation_id_available(...)` and `ServerDemoFillService.ensure_operation_id_available(...)` reject duplicate operation ids by query. The schema has indexes for operation id and workspace but no reviewed unique constraint. This is probably adequate in the demo path, but a production backend should enforce idempotency at the storage boundary.
   Status after Slice 7: server-demo operation ids now have a storage-level unique index by operation id, normalized workspace scope, and table id. Service-level checks remain as the fast path, while insert-time uniqueness errors map to `duplicate-operation-id`.

3. **Server redo branch invalidation is scoped and implemented, but needs broader tests.**
   Backend tests cover commit A/B, undo B, commit C, and discarded redo branch. Additional tests should cover redo invalidation after fill, mixed user/session scopes, failed commit after undo, and concurrent commits.

4. **Operation-id undo/redo remains available beside stack undo/redo.**
   Protocol docs mark operation-id routes as diagnostics/manual replay. Keeping both paths is useful, but enterprise docs should warn that normal UX must use scoped stack routes to avoid replaying an operation outside the current stack position.

5. **Server history replay is deterministic only for compatible cell-event operations.**
   `GridHistoryServiceBase.apply_loaded_operation(...)` rejects missing rows/unsupported columns and returns rejected cells without partial writes when preparation fails. That is good. Still, deterministic replay over changed projections, moved rows, deleted rows, or schema changes is not fully defined.
   Status after Slice 8: changed same-cell values are now deterministic conflicts. Changed projections, moved rows, deleted rows, and schema changes remain capability-specific backend concerns.

6. **History status is eventually synced through adapter cache.**
   `createAffinoDatasource(...)` updates cached history status from mutation responses and `/history/status`. `DataGridDefaultRenderer.ts` watches datasource history status. This is a sound design, but toolbar state can lag if a mutation omits history fields and the status probe fails.

7. **Batch operations are available in core but not broadly used at app level.**
   Core batches are generic, while app-level edit/paste/fill grouping is implemented through single snapshot transactions. This is not wrong, but enterprise docs should distinguish core transaction batches from app intent grouping.

8. **History does not expose operation introspection or serialization metadata.**
   Core transaction events include ids, labels, intent, and affected range. They do not expose command payloads, byte size, schema version, author, timestamp, or source. Server operations store metadata but the public client controller only exposes canUndo/canRedo/run.

### Low

1. **`recordServerFillTransaction` is a no-op for the built-in server stack adapter.**
   In `DataGridDefaultRenderer.ts`, server history is owned by datasource stack undo/redo, so the adapter intentionally ignores server fill transaction recording. This is acceptable, but it should be documented because the stage adapter interface still exposes the hook.

2. **History action messages expose committed ids rather than user-facing labels.**
   `useDataGridHistoryActionRunner.ts` sets messages like `Undo ${committedId}`. This is useful for debugging but less polished than labels such as “Undo paste”.

3. **Current history docs are minimal.**
   `docs/datagrid-history.md` documents props and controller usage, but not invariants, unsupported operations, memory semantics, server/client ownership, or recovery behavior.

## Correctness Guarantees

- Core transaction apply is deterministic when the executor is deterministic and rollback payloads are correct.
- Core redo invalidation is guaranteed for new committed transactions because `redoStack.length = 0` is executed after successful apply/commit.
- Core batch undo order is deterministic: transactions undo in reverse order, commands undo in reverse order.
- Client intent history restores exactly the captured snapshots for tested edit, paste, fill, and optimistic-refresh cases.
- Server history replays persisted cell events inside database transactions and uses row locks for loaded operations.
- Server stack history is scoped by workspace/table/user/session and returns consistent status for tested flows.
- Server undo/redo bump revisions and emit change-feed events for replayed operations.

## Correctness Risks

- Undo compensation is weaker than apply compensation for async multi-command failures.
- Concurrent history calls can interleave stack state because there is no service-level action lock.
- Client row snapshots can restore stale row fields beyond the cells touched by the original operation.
- Selection/focus/editor/scroll restoration is not part of the history invariant.
- Structural row operations and column operations are not represented in the server operation replay model.
- Operation-id history routes can bypass stack semantics if used as normal UX.
- Snapshot history correctness depends on stable row ids; fallback full snapshots are expensive and can be stale for server-backed data.

## Server-Backed History Risks

- Server history is strongest for edit and fill operations over persisted cells.
- Server-side series fill is explicitly unsupported in the protocol.
- Full off-viewport materialization may be bounded; server fill currently requires source and target row ids to be resolved.
- The backend uses best-effort fallback for scope divergence between request/body/header and persisted operation scope. This is practical but should be tightened for production authorization.
- Database-level idempotency is enforced for server-demo edit/fill operation ids within workspace/table scope. Undo/redo action concurrency still needs focused stack-level coverage.
- Change-feed gaps can fall back to dataset invalidation. That is safe but can erase precise history-linked invalidation.
- Collaborative editing semantics now include cell-event overlap prevention for server stack undo/redo. They still do not include automatic merge or structural operation replay.

## Virtualization Interaction Risks

- Client history records row snapshots by row id, so undo/redo can work across virtual remounts for loaded/materialized rows.
- For unloaded server rows, client snapshot history is not the right mechanism; server stack history must own undo/redo.
- Placeholder rows are handled in targeted app tests, but larger placeholder and virtual-range cases need coverage for paste, fill, delete, and undo/redo after scroll.
- Selection/focus restoration across virtual remounts is not part of history payloads.

## Clipboard And Fill Risks

- Paste and cut-paste are grouped into a single history transaction in the app path.
- Multi-range paste can merge row patches into one snapshot transaction.
- Client fill/range move records history for materialized rows; server fill is committed through datasource operations and stack history.
- Server fill records range invalidation and cell events, but server-side series mode remains unsupported.
- Large clipboard/fill operations can create large snapshots or many server cell events. No cell-count/byte-count history budget is enforced in the client history layer.

## Recovery And Collaboration Risks

- Client intent history is in-memory only. It does not survive reload, crash, tab close, or device handoff.
- Server history persists operations and cell events, but currently targets the server-demo table rather than a generalized backend-owned table contract.
- Server stack undo/redo rejects overlapping cell-event conflicts instead of merging them. There is still no collaborative merge model for resolving those conflicts automatically.
- There is no durable operation serialization format for app-layer client history.
- There is no public recovery API for “restore history from serialized operations”.

## Enterprise Readiness Score

Current score: **7/10**.

Target score: **9/10**.

What blocks the target:

- Snapshot-only client history and lack of operation serialization.
- Missing async action single-flight guard.
- Incomplete undo failure compensation.
- No selection/focus/edit restoration payload.
- No memory budget beyond stack depth.
- Server operation model limited to edit/fill cell events.
- Collaboration semantics not specified.

## Recommended Roadmap

### Phase 1: History Invariants And Locking

- Add a single-flight guard around core transaction actions or the app history runner.
- Add tests for concurrent undo/redo/apply calls.
- Add tests for undo failure halfway through a multi-command transaction.
- Document stack invariants: apply order, rollback order, redo invalidation, batch grouping, and failure behavior.

### Phase 2: Operation Payload Contract

- Define a versioned operation shape for edit, paste, cut-paste, fill, range move, row insert/delete, and placeholder materialization.
- Keep snapshot history as a compatibility fallback, but prefer operation payloads for new enterprise flows.
- Add serialization/deserialization tests for operations.

### Phase 3: Restoration State

- Add optional history payload fields for active cell, selection ranges, scroll anchor, edit target, and focus restoration.
- Restore selection/focus after undo/redo with virtualization-aware row id and column key anchors.
- Add tests for undo/redo after virtual remount and after server refresh.

### Phase 4: Server History Generalization

- Move server-demo-specific history semantics into reusable backend package contracts where possible.
- Keep database idempotency constraints for operation ids within workspace/table scope and extend concurrency coverage to stack undo/redo.
- Extend server history beyond cell events or keep unsupported structural operations documented as explicit backend capability gaps.
- Add fill, edit, undo, redo, change-feed, and stale-revision tests under concurrent request scenarios.

### Phase 5: Collaboration And Recovery

- Define deeper per-operation author/session metadata and merge rules beyond the current cell-event overlap rejection.
- Define local undo behavior after remote changes touch the same cells.
- Add persisted client operation history or declare client history non-recoverable.
- Add recovery tests for reload/status sync and stale operation replay.

## Recommended Tests

Unit tests:

- Core transaction concurrent action serialization.
- Undo compensation after rollback failure.
- History memory budget behavior by bytes/cells.
- Operation serialization round trips.
- Redo invalidation for committed operations after undo.

Component tests:

- Undo/redo restores active cell and selection after virtual remount.
- Inline edit commit followed by undo restores focus and editor context.
- Multi-range paste undo/redo preserves selection and values.
- Placeholder paste/fill/delete undo across scrolled windows.
- Toolbar and shortcut actions are disabled while an async history action is in flight.

Backend tests:

- Database-enforced duplicate operation id behavior.
- Concurrent stack undo requests for the same scope.
- Concurrent commit after undo invalidates redo exactly once.
- Fill undo/redo branch invalidation.
- Missing row/schema change replay behavior.
- Change-feed event ordering after undo/redo.

Performance tests:

- Full snapshot capture over 10k/100k rows.
- Partial snapshot capture over large selected ranges.
- Clipboard/fill history memory growth.
- Server history replay over large fill operations.

## Recommended Telemetry

- `historyUndoDepth`
- `historyRedoDepth`
- `historyPendingAction`
- `historyActionDurationMs`
- `historySnapshotKind`
- `historySnapshotRowCount`
- `historySnapshotCellEstimate`
- `historySnapshotBytesEstimate`
- `historyOperationIntent`
- `historyOperationAffectedRange`
- `historyRedoInvalidationCount`
- `historyRollbackFailureCount`
- `serverHistoryOperationId`
- `serverHistoryScope`
- `serverHistoryDatasetVersion`
- `serverHistoryRejectedCellCount`

## Prioritized Implementation Slices

1. Add history action single-flight guard and tests.
2. Add undo failure compensation tests and decide rollback semantics.
3. Document client-vs-server history ownership in `docs/datagrid-history.md`.
4. Add snapshot size telemetry and soft warnings.
5. Add selection/active-cell restoration payload for app history.
6. Define versioned operation payloads for edit, paste, fill, and row operations.
7. Add database uniqueness/idempotency guard for server operation ids. Completed in Slice 7.
8. Add server concurrent undo/redo tests.
9. Add collaborative overlap semantics. Initial cell-event conflict rejection completed in Slice 8.
10. Add reload/recovery story for serialized or server-backed history.

## Migration Notes

- Keep current `history` prop and `DataGridHistoryController` stable.
- Treat operation serialization as additive; do not remove snapshot fallback until existing app integrations migrate.
- Server-backed grids should continue to prefer datasource stack undo/redo over client row snapshots.
- Operation-id undo/redo routes should remain diagnostics-only unless explicitly configured.
- Any new restoration payload must be optional so existing adapters can ignore it.
