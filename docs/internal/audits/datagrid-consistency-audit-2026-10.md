# Affino DataGrid consistency audit

Date: 2026-10-23
Scope: Core, orchestration, Vue, DOM/vanilla, and Laravel facade. This audit records implementation findings, not documentation gaps. Repository code was not modified to produce the audit; temporary reproductions were kept under `/tmp/affino-consistency-audit`.

## Summary

The runtime has sound ownership boundaries in several areas: Core owns row/projection, columns, viewport math and transactions; adapters own DOM/editor lifecycle; row selection storage is injected as a capability; cell selection freshness is tied to projection and column-order identity. There is no need for one global state or revision.

There are confirmed paths where an operation reports completion while dependent state is stale, an update is lost, or one adapter interprets a contract differently. The highest-risk issues are asynchronous edits losing their completion result, computed values missing from the live resolver, presentation columns writing to the wrong field, partial schema mutation, and lifecycle/event ordering defects.

## Findings

### 1. P1 — `rows.applyEdits()` drops asynchronous patch completion

- Confidence: high; reproduced with an asynchronous row model.
- Invariant: callers must not receive success before an asynchronous mutation commits or rejects.
- Path: `packages/datagrid-core/src/core/gridApiRowsMethods.ts:501` calls `capability.patchRows(...)` without returning/awaiting it, then publishes and returns. The datasource implementation is asynchronous (`packages/datagrid-core/src/models/dataSourceOptimisticPatchRuntime.ts`).
- Reproduction: call `applyEdits()` against a patch capability that resolves after a gate; the method returns `undefined` while the row is unchanged.
- Actual: adapters/history may treat the operation as complete before server confirmation; rejection is detached.
- Expected: preserve a completion result and rejection through the public API, while keeping local event semantics explicit.
- Coverage gap: `gridApi.contract.spec.ts:857` exercises synchronous client deltas; datasource tests invoke `model.patchRows()` directly.
- Minimal fix owner: Core row API; add an async capability contract test and propagate completion.

### 2. P1 — live `cells.resolveValue()` omits computed overlay values

- Confidence: high; reproduced.
- Invariant: live cell resolution and projected rows must agree on computed values for the same current model.
- Path: `packages/datagrid-core/src/core/gridApiCellValueMethods.ts:52` reads `rowModel.getRowById`; `packages/datagrid-core/src/models/clientRowModel.ts:854-860` returns source data, while projection materializes computed overlays.
- Reproduction: formula `double = amount * 2`, `amount = 1`; `rows.get(0).data.double` is `2`, but live `cells.resolveValue(..., purpose: "computed")` returns `undefined`.
- Actual: consumers resolving live data disagree with projection consumers. Snapshot-based resolver returns the computed value.
- Expected: computed resolution reads the canonical effective value without changing source-only `getById()` semantics.
- Coverage gap: formula tests assert materialized projection (`gridApi.contract.spec.ts:1479`), not the live resolver.
- Minimal fix owner: Core value resolver and its contract tests.

### 3. P1 — Vue editor and clipboard write presentation keys

- Confidence: high; reproduced with a presentation column.
- Invariant: reads and writes of a presentation cell must address the same declared source target.
- Path: `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts:531-539` resolves source for reads but patches `currentEditingCell.columnKey`; `useDataGridAppClipboard.ts:547-549` also writes by display key. DOM inline editing uses `resolved.writeTarget.key`.
- Reproduction: `{ key: "display", field: "name" }`; edit display to `Edited`.
- Actual: source `name` stays `A`, a stray `display: "Edited"` is added, and the rendered cell remains `A` although the edit reports success.
- Expected: patch the resolved write target or return an explicit unsupported result for custom setters.
- Coverage gap: current edit and clipboard cases use `key === field`.
- Minimal fix owner: Vue editing/clipboard mutation planning; add presentation-column parity tests.

### 4. P1 — DOM paste/fill/move skip column validation

- Confidence: high; reproduced.
- Invariant: equivalent user write intents should apply the same declared value parsing and validation policy across adapters.
- Path: `packages/datagrid-dom/src/adapter/controllers/clipboardController.ts:379` parses from current JS value type without column constraints; paste/fill use it. `rangeMoveController.ts:180` shares this path. Vue clipboard calls `validateDataGridCellDraftValue` at `useDataGridAppClipboard.ts:538`.
- Reproduction: paste `500` into a numeric column constrained to 0–10.
- Actual: DOM adapter accepts it; Vue/editor validation rejects it.
- Expected: DOM intent planners use the existing Core validation contract before applying the edit.
- Coverage gap: DOM clipboard tests do not configure constrained columns.
- Minimal fix owner: DOM adapter input planning backed by Core validation; do not impose UI validation on external source updates.

### 5. P1 — invalid `columnModel.setAll()` partially mutates live storage

- Confidence: high; reproduced.
- Invariant: rejected schema updates leave the current schema and its revision/cache coherent.
- Path: `packages/datagrid-core/src/models/columnModel.ts:646` clears live maps/order before validating the full replacement; duplicate keys throw before dirty revision/cache invalidation.
- Reproduction: existing schema `[name, amount]`; call `setAll([{key:"x"},{key:"x"}])`, catch error, then `setWidth("x",123)`.
- Actual: public snapshot remains old but subsequent mutation publishes an `x` column from partially replaced internal maps.
- Expected: validate/build a candidate schema, then atomically replace live storage.
- Coverage gap: `columnModel.spec.ts:381` tests invalid construction, not failed replacement of a live model.
- Minimal fix owner: Core column model.

### 6. P1 — orchestration pivot roundtrip resurrects obsolete base columns

- Confidence: high; reproduced.
- Invariant: pivot composition must use the currently accepted source schema.
- Path: `packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts:530-537` retains `baseColumns`; public `api.columns.setAll()` changes the model but not this retained base schema.
- Reproduction: runtime schema `name/year/amount`; call public `setAll()` with `customName/year/amount`; enable then disable pivot.
- Actual: disabling pivot restores the old `name/year/amount` schema.
- Expected: accepted schema changes update the base schema used for pivot composition, while generated pivot columns stay derived.
- Coverage gap: pivot test at `src/__tests__/useDataGridRuntimeService.contract.spec.ts:111` does not change schema through public API before roundtrip.
- Minimal fix owner: orchestration schema composition; test public schema mutation plus pivot on/off.

### 7. P1 — Vue `activateCell()` can report success while selecting the wrong row

- Confidence: high; reproduced in a mounted Vue DataGrid.
- Invariant: an ID-addressed operation must resolve its target against current projection immediately before committing index-addressed effects.
- Path: `packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts:4127,4145` captures row/column indexes before asynchronous reveal, then finds the target by ID but applies selection using the old indexes.
- Reproduction: activate row A with selection replacement; sort descending before reveal completes.
- Actual: result is `activated`, the active cell is row B at index 0, and B is shown first.
- Expected: re-resolve row and column identity after reveal and before selection/focus commit; return unavailable/cancelled if identity no longer resolves.
- Coverage gap: existing navigation tests do not mutate projection during reveal.
- Minimal fix owner: Vue app activation lifecycle; focused race regression.

### 8. P1 — transaction service can resume and record history after dispose

- Confidence: high; reproduced.
- Invariant: disposed runtime must not execute queued work or repopulate cleared history.
- Path: `packages/datagrid-core/src/core/transactionService.ts:447` checks active only at entry; `:742` pushes history after awaited commands without rechecking disposal.
- Reproduction: two-command transaction; first command waits; dispose service; release gate.
- Actual: second command runs and undo depth becomes 1 after disposal cleared it.
- Expected: check lifecycle generation after awaits and before subsequent commands/history/hooks. Already-dispatched external work remains the executor's cancellation responsibility.
- Coverage gap: `transactionService.contract.spec.ts:318` tests async exclusivity, not dispose while in flight.
- Minimal fix owner: Core transaction service.

### 9. P1 — reentrant row mutation publishes projection revisions backwards

- Confidence: high; reproduced.
- Invariant: emitted revision transitions must be monotonic and agree with committed model state.
- Path: `packages/datagrid-core/src/core/gridApiEventsRuntime.ts:237` emits `rows:changed` before updating `lastProjectionVersion`; a listener can synchronously trigger another projection recompute.
- Reproduction: rows:changed listener changes sort while an outer row mutation is publishing.
- Actual: projection events report `0→2`, then `2→1` although live projection revision is 2.
- Expected: prepare/update publication bookkeeping before invoking listeners, preserving the defined model notification ordering.
- Coverage gap: reentrant case at `gridApi.contract.spec.ts:3120` changes selection, not projection.
- Minimal fix owner: Core event publication runtime.

### 10. P1 — strict restore preflight misses unavailable viewport capability

- Confidence: high; reproduced.
- Invariant: strict validation must reject unsupported requested sections before applying earlier sections.
- Path: `packages/datagrid-core/src/core/gridApiStateMethods.ts:250` checks selection capabilities but not viewport; `state.set()` applies rows/columns before failing at viewport.
- Reproduction: no viewport service; state includes changed sort and viewport position; validate strict then set.
- Actual: validation says valid, rows and columns apply, then viewport fails; report describes partial application.
- Expected: capability preflight covers every requested section before mutation.
- Coverage gap: strict test at `gridApi.contract.spec.ts:3648` only omits selection capability.
- Minimal fix owner: Core state preflight; retain existing documented non-atomic policy for failures that cannot be preflighted.

### 11. P1 — restore creates immediately stale all-row selection

- Confidence: high; reproduced.
- Invariant: restored selection scope must use the same revision identity as ordinary row-selection operations.
- Path: normal scope uses `buildDataGridSelectionProjectionIdentity(...).revision` in `gridApiRowSelectionMethods.ts:43`; restore uses `rowModel.getSnapshot().revision` in `gridApiStateMethods.ts:496` (also rollback).
- Reproduction: mutate a value without changing projection revision, set all-selection, capture state, restore it.
- Actual: `state.set()` succeeds but scope becomes stale and `isSelected()` is false.
- Expected: one shared current-scope resolver for set, restore and rollback.
- Coverage gap: scope tests at `gridApi.contract.spec.ts:2429` do not cross restore.
- Minimal fix owner: Core state and row-selection integration.

### 12. P1 — `captureView()` bypasses stale-aware selection facade

- Confidence: high; reproduced.
- Invariant: a read view must not mark stale positional selection as current with a newer projection.
- Path: `packages/datagrid-core/src/core/gridApiReadMethods.ts:219` reads raw selection capability snapshots instead of the stale-aware public facade; row selection has a parallel raw scope path.
- Reproduction: select A at index 0, sort B to index 0, compare `selection.getSnapshot()` and `read.captureView()`.
- Actual: public selection is null/stale while capture reports available selection from the old coordinates alongside current rows.
- Expected: capture uses semantic stale-aware getters and reports stale/unavailable consistently.
- Coverage gap: capture tests in `gridApi.contract.spec.ts:43` do not include a selection service.
- Minimal fix owner: Core read-view composition.

### 13. P1 — DOM external row update removes the editor but leaves its session active

- Confidence: high; reproduced by reachable DOM interaction.
- Invariant: an active edit session must correspond to a visible editor or an explicit conflict/parked-draft state; a removed row must not retain an invisible lock.
- Path: `packages/datagrid-dom/src/adapter/controllers/inlineEditingController.ts:27-30` keeps `activeEditor`; on external update the grid rerenders and removes the editor DOM, but no conflict/reconciliation path clears or relocates the session.
- Reproduction: open cell editor, patch the row externally, then try to edit the cell again.
- Actual: editor disappears and new edit is rejected because `activeEditor` remains set.
- Expected: reconcile by rowId/columnKey; preserve a visible draft or cancel according to explicit policy, and clear when row is deleted.
- Coverage gap: DOM editor tests cover normal commit/cancel, not external updates. Vue already tests source-value conflict handling.
- Minimal fix owner: DOM editing lifecycle.

### 14. P2 — batched column-selection event is buffered but never flushed

- Confidence: high; reproduced.
- Invariant: supported batched events must be delivered when the batch ends.
- Path: `packages/datagrid-core/src/core/gridApiEventsRuntime.ts:134` omits `column-selection:changed` from `orderedEvents`; its payload is stored but never dispatched/removed in flush.
- Reproduction: set column selection inside `api.rows.batch()`.
- Actual: selection snapshot changes but listener count stays zero.
- Expected: flush the event in deterministic event order and clear buffered payload.
- Coverage gap: column-selection tests cover direct changes/restore, not batch.
- Minimal fix owner: Core event batch flush.

### 15. P2 — DOM paste reapplies old positional selection after rows reorder

- Confidence: high for DOM; Vue same pattern inspected but not independently reproduced.
- Invariant: index-based selection must not be restamped as current after its projection identity changes.
- Path: `packages/datagrid-dom/src/adapter/controllers/clipboardController.ts:243` resolves start/end using old indexes after `applyEdits()` and writes that range as fresh selection. Vue clipboard has a similar old-range reapply at `useDataGridAppClipboard.ts:586-587`.
- Reproduction: sort A,B; paste value that makes A sort to end.
- Actual: write targets A correctly, but selection now paints B at A's former index.
- Expected: re-resolve affected IDs in current projection or clear according to stale-selection policy.
- Coverage gap: paste tests do not cause projection reorder during paste.
- Minimal fix owner: clipboard adapters, with logical target IDs preserved through mutation.

### 16. P2 — row-height getter depends on another getter having run

- Confidence: high; reproduced with viewport service.
- Invariant: read results must not depend on unrelated prior read order.
- Path: `packages/datagrid-core/src/core/gridApiViewMethods.ts:277` does not refresh projected ID overrides; refresh occurs in `getRowHeightVersion()`/snapshot getters.
- Reproduction: set height 60 for row A at index0 by ID; sort A to index1; read index0 before and after `getRowHeightVersion()`.
- Actual: first getter incorrectly returns 60 for row B, second returns null after remap.
- Expected: refresh projection-bound overrides before every dependent read or eagerly on projection change.
- Coverage gap: current row-height test lacks viewport service and follows the fallback path.
- Minimal fix owner: Core view-height bridge.

### 17. P2 — stale all-selection mutation has no explicit transition result

- Confidence: high that behavior occurs; contract ambiguity remains.
- Invariant needing definition: a user intent against stale all-selection should either re-establish a current scope, explicitly refuse, or transition through a documented replacement policy.
- Path: `packages/datagrid-core/src/core/gridApiRowSelectionMethods.ts:94-107` treats stale all as selecting no rows; setting one row selected returns without surfacing staleness.
- Reproduction: select all, change projection, then `setSelected("b", true)`.
- Actual: call succeeds but `isSelected("b")` stays false and raw snapshot retains stale scope.
- Expected: explicit transition/result consistent across adapters. Existing “stale all selects no rows” policy remains safe; only the subsequent intent is underspecified.
- Coverage gap: scope tests stop after checking stale membership.
- Minimal fix owner: Core row-selection transition policy, followed by adapter parity tests.

## Ownership and consistency matrix

| State / scenario | Owner | Main consumers / copies | Consistency guarantee | Audit result |
| --- | --- | --- | --- | --- |
| Source rows and computed overlay | Core row model and formula pipeline | projection, live cell resolver, Vue/DOM renderers | source and computed values are distinct; projection materializes effective values | live resolver misses overlay (#2); async edit completion lost (#1) |
| Filter/sort/group/tree/pivot/aggregate projection | Core row model; orchestration composes pivot schema | selection, activation, clipboard, adapters | projection revision defines positional freshness | backwards event revision (#9), stale activation (#7), pivot schema resurrection (#6), stale paste range (#15) |
| Column definitions/order/visibility/pin | Core column model; orchestration owns pivot base composition | renderers, selection, widths, state | column/order revisions and stable keys | failed `setAll` corrupts hidden state (#5); pivot can restore old schema (#6) |
| Cell/row/column selection | Core contracts; row-selection capability supplied by adapter | Vue/DOM controls, overlays, capture/state | cell ranges bind to projection/order revisions; all-row mode binds to scope | capture bypass (#12), restore scope mismatch (#11), batched event lost (#14), stale-all intent ambiguous (#17) |
| Active cell/focus/editor | adapter owns editor DOM/session; Core activation API addresses IDs | Vue renderer, DOM controller, keyboard handlers | logical target resolved against current model before effects | Vue async activation uses stale index (#7); DOM editor session becomes orphaned (#13) |
| Viewport, heights, sticky/pinned geometry | Core viewport math; adapter samples DOM geometry | hit testing, overlays, canvas, renderers | shared geometry snapshots and logical row heights | row-height read order bug (#16); visual browser combinations not exhaustively exercised |
| Transaction history | Core transaction service | Vue/DOM history UI, datasource executor | committed operations correspond to history entries | disposal allows post-teardown work/history (#8); async apply result can precede actual commit (#1) |
| Datasource/query state | Core datasource model and scheduler | DOM/Vue adapters, Laravel exported facade | query revisions, abort/supersession, coverage | async row API detaches errors (#1); no separate Laravel implementation found |
| Shell controls | Vue/DOM shell adapters | query/filter/state APIs | drafts may differ while focused; committed model is authoritative | quick-filter reset sync is present; no defect found in checked path |

## Confirmed scenarios without a found violation

- Formula/group/aggregation update with Undo/Redo in the exercised client scenario: projection’s effective computed value and aggregate followed transaction commit/undo/redo.
- XLSX export: captures the view and prepares an independent worksheet matrix before asynchronous worker serialization; source row references in general `captureView()` remain explicitly a fast structural snapshot mode.
- Core pinned/viewport geometry contracts exercised by focused suites did not show a separate math-owner divergence.
- Vue quick-filter API reset updates the search control through the committed query watcher. DOM shell focused drafts may intentionally differ until submission/blur.
- Listener exceptions are documented to propagate and stop remaining listeners; the model may already be committed. This was treated as a defined behavior, not an atomicity defect.
- Datasource `flush()` is documented/implemented as drain-until-empty; continuous streams may delay it. This is a current contract limitation, not counted as a mismatch.
- Laravel JS package reexports Core/orchestration contracts; no separate conflicting implementation was found in the package facade.

## Not fully verified

- Real browser pixel sampling for every canvas pane under all pinned/sticky/scroll/resize combinations.
- A full PHP/Livewire consuming application lifecycle; the Laravel package facade was inspected, but no external application was run.
- Every custom callback and every reentrant event combination.
- All late network/worker continuations after teardown.
- Full monorepo E2E and performance profiling.

Temporary verification used 18 focused reproductions/control checks under `/tmp/affino-consistency-audit`; all 18 passed as reproductions of the reported outcomes. Existing focused suites also passed: Core transaction/event/state suites, Vue editing/history/export suites, geometry suites, and DOM shell tests. These are overlapping test counts, not a claim of 65 unique tests.

## Fix order

1. Core operation integrity: async completion, transaction disposal, event revision ordering, event batch flush, atomic schema replacement (#1, #5, #8, #9, #14).
2. Value/mutation parity: live computed resolver, Vue presentation write targets, DOM clipboard validation (#2, #3, #4).
3. Projection/schema coordination: accepted schema through pivot; activation and clipboard re-resolution (#6, #7, #15).
4. State and reads: complete restore preflight, shared row-selection scope, stale-aware capture (#10, #11, #12).
5. Adapter lifecycle and view state: DOM edit reconciliation, row-height remapping, stale-all intent transition (#13, #16, #17).

No broad rewrite, new namespace, global revision, or universal coordinator is warranted by these findings.

## Remediation status

| Finding | Status | Resolution |
| --- | --- | --- |
| #1 Async row edits | Fixed | Await asynchronous row-model patches and publish completion only after success. |
| #2 Effective cell values | Fixed | Added optional `getEffectiveRowById()` for client models; computed overlays without this capability report unavailable explicitly. |
| #3 Vue presentation write targets | Fixed | Inline editing and clipboard resolve writes to the source column target. |
| #4 DOM paste/fill/move validation | Fixed | DOM clipboard and range move use Core value validation and target-column constraints. |
| #5 Atomic column replacement | Fixed | Validate replacement schema before committing model storage. |
| #6 Pivot/base schema coordination | Fixed | Preserve externally replaced base schema and avoid feeding transient order/zone changes back into schema replacement. |
| #7 Async Vue activation | Fixed | Re-resolve row and column identities after reveal and before selection/focus effects. |
| #8 Transaction disposal | Fixed | In-flight work checks lifecycle state before applying follow-up commands or history changes. |
| #9 Reentrant event revisions | Fixed | Queue each model notification sequence before listener dispatch so nested mutations cannot publish revisions out of order. |
| #10 Strict restore preflight | Fixed | Validate viewport-position capability before applying strict restore. |
| #11 Restored all-selection scope | Fixed | Stamp the current projection identity when restoring, including rollback. |
| #12 Stale-aware capture | Fixed | Capture uses the same selection getters and stale filtering as live API reads. |
| #13 DOM editor reconciliation | Fixed | External row/column changes cancel an invalid active edit session and release the editor lock. |
| #14 Batched column-selection event | Fixed | Include the event in the batch flush order. |
| #15 Stale positional clipboard range | Fixed | Do not restore positional decoration after projection or column-order revision changes. |
| #16 Row-height read order | Fixed | Refresh projection-bound height overrides in the effective-height getter itself. |
| #17 Stale all-selection intent | Fixed | Explicit row-selection intents rebase to a current explicit selection rather than silently retaining stale scope. |

Focused validation passed after remediation: Core, orchestration, Vue, DOM, and DOM-sandbox type-checks; Core build (131 focused tests), orchestration build (8 focused tests), Vue build (275 focused tests), and DOM build (clipboard contract test). DOM-sandbox editing/clipboard integration tests passed (4 tests). Browser pixel sampling and full consuming Laravel/PHP application validation remain outside this remediation run.
