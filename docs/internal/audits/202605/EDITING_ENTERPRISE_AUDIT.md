# DataGrid Editing Enterprise Audit

## Executive Summary

The DataGrid editing architecture now has the enterprise editing hardening planned for this audit. The canonical app path supports inline text, date, datetime, select, async select options, keyboard commit/cancel, blur commit, clipboard paste, intent history, client-row patch fast paths, optimistic datasource-backed edits, draft validation, IME-safe key routing, pending/rejected commit state, and documented remount/formula boundaries. These remain the right building blocks and do not require a parallel editing architecture.

The remaining gaps are release-level hardening rather than planned-slice blockers: richer rejected-edit announcements, browser/e2e performance gates, touch-specific edit affordances, and optional spreadsheet-class formula editor integration for the table-stage DataGrid.

Current enterprise readiness: **9/10** for the planned Editing enterprise scope.
Target enterprise readiness: **9/10** after the 2026-05-18 implementation pass.

## Implementation Progress

- 2026-05-18: Enterprise editing implementation plan created at `docs/plans/EDITING_ENTERPRISE_PLAN.md`.
- 2026-05-18: Slices 1-9 completed. The implementation added the editing contract, IME guards, draft validation, datasource rejection surfacing, remount policy documentation, clipboard validation parity, async select load-error protection, formula boundary documentation, and focused a11y/type/test gates.

## Current Architecture Summary

- `datagrid-core` owns cell runtime metadata, parser/formatter behavior, edit-model storage, row-model mutation paths, formula engine primitives, and datasource-backed commit/rollback mechanics.
- `datagrid-vue` owns the canonical app inline-edit state machine, keyboard-triggered editing, clipboard paste, direct cell edit routing, history transaction capture, and focus restore.
- `datagrid-vue-app` owns the rendered editors inside the stage, editor DOM events, async select option loading, rendered cell identity, pinned/body panes, and scroll/touch interaction suppression.
- `datagrid-orchestration` contains older reusable inline-editor/focus/key-router composables. These are useful reference slices, but the reviewed canonical app-stage editing path is `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts` plus the stage rendering files.
- `datagrid-spreadsheet-vue-app` owns a richer spreadsheet formula editor. That is a separate spreadsheet surface and is not the same as the table-stage DataGrid inline formula editing path.

This layering is compatible with the project architecture. Editing state, focus ownership, validation, async commit state, and virtualization remount behavior are now documented as one deterministic contract in `docs/datagrid-editing.md`.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
- `docs/datagrid-history.md`
- `docs/server-datasource/ux-contract.md`
- `docs/datagrid-formula-engine-guide.md`
- `docs/MOBILE_TOUCH_SCROLL_AUDIT.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- `docs/SELECTION_ENTERPRISE_AUDIT.md`

Core editing, cells, row models, formula, and history:

- `packages/datagrid-core/src/cells/runtime.ts`
- `packages/datagrid-core/src/models/editModel.ts`
- `packages/datagrid-core/src/models/clientRowModel.ts`
- `packages/datagrid-core/src/models/mutation/clientRowPatchCoordinatorRuntime.ts`
- `packages/datagrid-core/src/models/host/clientRowPatchHostRuntime.ts`
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts`
- `packages/datagrid-core/src/spreadsheet/formulaEditorModel.ts`
- `packages/datagrid-core/src/models/formula/*`

Vue app editing, clipboard, keyboard, and history:

- `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
- `packages/datagrid-vue/src/app/useDataGridAppIntentHistory.ts`
- `packages/datagrid-vue/src/app/dataGridFocusRestore.ts`

Vue app stage and editors:

- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageCellIo.ts`
- `packages/datagrid-vue-app/src/overlays/DataGridCellComboboxEditor.vue`
- `packages/datagrid-vue-app/src/overlays/DataGridFilterableCombobox.vue`
- `packages/datagrid-spreadsheet-vue-app/src/DataGridSpreadsheetFormulaEditor.vue`

Orchestration reference slices:

- `packages/datagrid-orchestration/src/editing/useDataGridInlineEditOrchestration.ts`
- `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorKeyRouter.ts`
- `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorFocus.ts`

Tests and benchmarks sampled:

- `packages/datagrid-vue/src/app/__tests__/*`
- `packages/datagrid-vue-app/src/stage/__tests__/*`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-core/src/cells/__tests__/runtime.spec.ts`
- `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- `packages/datagrid-core/src/models/__tests__/clientRowModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/formulaEditorModel.spec.ts`
- `packages/datagrid-core/src/models/__tests__/formulaEngine.spec.ts`
- `packages/datagrid-sandbox/src/components/VueSpreadsheetWorkbookCard.spec.ts`
- `e2e/sandbox-interactions.spec.ts`
- `scripts/bench-datagrid-enterprise-browser-frames.mjs`

## Strengths

- `useDataGridAppInlineEditing.ts` has a clear canonical edit state: edited row id, column key, draft value, initial filter, open-on-mount flag, editor mode, and blur-suppression flag.
- Edit start checks current app mode, group rows, row id availability, row editability, and cell editability before opening the editor.
- Commit resolves the edited row by row id, parses the draft with `parseDataGridCellDraftValue`, applies a row edit through `runtime.api.rows.applyEdits`, fires `onCellEdit`, restores grid focus, and records intent history after the apply promise resolves.
- Keyboard editing supports common spreadsheet-style flows: printable/F2/select action opens edit, Enter commits and moves vertically, Tab commits and moves horizontally, and Escape cancels.
- The stage renders one editor per edited cell and keeps rendered identity stable with row keys by `row.rowId` and cell keys by `row.rowId` plus `column.key`.
- `DataGridFilterableCombobox.vue` has a real async option guard using `requestId`, exposes combobox/listbox roles, and handles Arrow/Home/End/Enter/Tab/Escape interaction.
- `cells/runtime.ts` centralizes built-in cell editor modes, keyboard actions, parsing, formatting, checkbox toggles, and custom cell interactions.
- Client row editing is performance-conscious. `clientRowPatchCoordinatorRuntime.ts` applies row patches, computed fields, row versions, and projection invalidation; `clientRowPatchHostRuntime.ts` has a flat-projection fast path.
- `dataSourceBackedRowModel.ts` has a real optimistic edit transaction queue, serializes commits, applies optimistic overlays, rolls back rejected or failed edits, and reconciles datasource invalidation and snapshots.
- Clipboard paste batches row patches and captures history snapshots in `useDataGridAppClipboard.ts`.
- Intent history stores row snapshots and supports partial rollback/redo through `useDataGridAppIntentHistory.ts`.
- The spreadsheet package has a richer formula editor model and Vue editor, including formula diagnostics, references, selection tracking, autocomplete hooks, and preview segments.

## Findings By Severity

### Blocker

1. **IME and input composition are protected.**
   `useDataGridAppInlineEditing.ts`, `useDataGridAppInteractionController.ts`, and `DataGridFilterableCombobox.vue` now guard composing key events so Enter, Tab, Escape, and printable keys do not commit, cancel, navigate, or start editing while IME composition is active.

2. **Validation is a first-class edit state.**
   `cells/runtime.ts` exposes shared draft validation, and the canonical inline edit path blocks invalid number, date, datetime, and select drafts before row mutation. Invalid drafts keep the editor open and expose invalid state.

3. **Server-backed rejection UX is deterministic for the app-stage contract.**
   `dataSourceBackedRowModel.ts` rejects failed optimistic commits after rollback, and `useDataGridAppInlineEditing.ts` exposes pending/rejected state while avoiding successful history records for rejected commits. Rich retry UI and live-region announcements remain host/release-level work.

4. **Virtualization remount continuity while editing is specified.**
   Editor state remains keyed by row id and column key, stage cells use stable row/cell keys, and `docs/datagrid-editing.md` documents commit/cancel/reject expectations for unmount, remount, placeholders, and cache replacement.

### High

1. **Edit ownership is split across state, focus, selection, stage rendering, and row models.**
   `useDataGridAppInlineEditing.ts` owns draft state, `useDataGridAppInteractionController.ts` starts editing from keyboard/pointer actions, `dataGridFocusRestore.ts` restores DOM focus, `DataGridTableStageCenterPane.vue` mounts the editor, and row models own commit persistence. This works in common paths, but enterprise readiness needs a documented state machine and invariants.

2. **Blur commit behavior needs a stricter policy.**
   Text/date editors commit on blur. Select blur commits after checking whether focus remains inside the combobox. That is reasonable for desktop, but no audited contract distinguishes blur caused by intentional focus loss, virtualization unmount, touch scroll, popup focus movement, window blur, or route teardown.

3. **Async select editing is enterprise-consistent for stale-load and load-error paths.**
   `DataGridFilterableCombobox.vue` ignores stale option loads by request id, exposes loading/error state through ARIA, blocks commits during load/error, and invalidates in-flight loads on unmount. AbortController integration remains optional future hardening.

4. **Clipboard paste shares inline parse/validation semantics.**
   `useDataGridAppClipboard.ts` now validates pasted drafts through the shared cell draft validation boundary and applies only valid editable cells.

5. **Formula editing is not enterprise spreadsheet-class in the table-stage DataGrid.**
   `cells/runtime.ts` treats the formula cell type as `editorMode: "text"` and returns the draft string. The formula engine and spreadsheet formula editor are strong, but the table-stage DataGrid does not expose formula diagnostics, reference picking, formula bar behavior, autocomplete, or commit validation.

6. **Commit race behavior is specified for successful and rejected commits.**
   Inline commit clears the editor before `runtime.api.rows.applyEdits` settles, exposes pending state, fires `onCellEdit` only after successful commit settlement, records history only after success, and stores rejection reason on failure.

7. **Focus ownership can diverge from editing ownership.**
   Focus restore is retry-based through `dataGridFocusRestore.ts`; active selection and editing state are managed separately. Enterprise behavior needs tests proving that focus, active cell, edit draft, and rendered editor remain coherent through keyboard movement, pinned panes, scroll-to-cell, and remount.

### Medium

1. **Edit batching is partial.**
   Paste batches multiple cell updates into row patches, and row models support batch patching. Inline rapid editing remains per-cell apply calls. This is acceptable for normal use but needs a policy for rapid Enter/Tab editing with server latency and optimistic queues.

2. **Undo/redo integration is strong for local snapshots but split from server history.**
   `useDataGridAppIntentHistory.ts` captures before/after row snapshots. `docs/server-datasource/ux-contract.md` expects backend operation ids, revisions, invalidation, and server history endpoints. The two paths need an explicit enterprise contract for datasource-backed edit undo/redo.

3. **Touch editing is protected from accidental desktop gestures but not fully designed.**
   Existing mobile docs and stage suppression protect native scroll and suppress touch-generated desktop interactions. There is no enterprise touch editing model for long-press, explicit edit affordances, virtual keyboard resize, select popovers, or blur-on-scroll behavior.

4. **Grouped/tree row editing is mostly blocked at obvious boundaries but not fully specified.**
   Inline edit start blocks group rows. The remaining enterprise contract should state behavior for editable leaf rows under collapsed groups, tree expansion/collapse during edit, server placeholders inside groups, and edit history after grouped projection changes.

5. **Pinned-pane editor behavior needs broader validation.**
   Stage rendering and overlays support pinned panes, and cell identity is stable. The audit did not find a dedicated browser gate proving edit start, focus, Tab/Enter movement, blur commit, and cancel across left, center, right, and pinned-bottom panes.

6. **Accessibility behavior has baseline editing state.**
   Native inputs and the select combobox have meaningful roles, invalid state, and busy state where applicable. Live-region announcements for validation/rejection and spreadsheet-class formula diagnostics remain future work.

7. **Performance under custom renderers and rapid editing is not gated.**
   Core row patching is efficient, but rapid edit loops can trigger focus restore retries, history snapshots, row-model updates, and custom renderer remounts. Browser frame benchmarks touch editing, but there is no focused rapid-edit SLA.

### Low

1. **`editModel.ts` appears separate from the canonical app inline path.**
   The pending edit model is simple and deterministic, but the canonical app path uses its own inline edit refs. This is not a bug; it should be documented or consolidated only if it becomes a maintenance burden.

2. **The orchestration inline editor helpers are not the canonical stage path.**
   `datagrid-orchestration` has reusable key/focus/edit composables. The app-stage path currently uses separate logic. This is acceptable, but tests and docs should name the canonical owner to avoid future duplicate behavior.

3. **Some editor values are normalized for native controls before display.**
   Date and datetime draft normalization in `useDataGridAppInlineEditing.ts` is useful, but enterprise docs should state what values are preserved, normalized, or rejected for timezone-sensitive fields.

## Focus Area Evaluation

| Area | Current Assessment | Enterprise Gap |
| --- | --- | --- |
| Edit lifecycle | Documented start/commit/cancel/pending/rejected flow | Release gates should keep it stable across browser scenarios |
| Inline editors | Text, date, datetime, select are implemented with typed validation | Broader pinned-pane/browser gates remain release-level work |
| Async editors | Async select loader has stale-request, loading, and error guards | AbortController support remains optional future hardening |
| Commit/cancel semantics | Enter/Tab commit, Escape cancel, blur commit, server rejection handling | Retry UI can be host-specific |
| Blur behavior | Functional and documented for desktop, popover, and unmount paths | Touch-specific edit affordances remain future UX work |
| Virtualization remount | Row/cell keys, rowId state, and policy are documented | Add broader e2e coverage before release locks |
| Keyboard editing | Strong common shortcuts with IME guard | Server-latency browser gates remain useful |
| IME/input composition | Composition-aware key routing is implemented | Cross-browser IME e2e remains useful |
| Clipboard paste | Batches edits/history and shares inline validation | Server virtual semantics stay in server operation tracks |
| Formula editing | Formula engine and spreadsheet editor exist | Table-stage formula cells are explicitly basic text editing |
| Validation | Shared first-class validation exists | Async/custom validation hooks remain future API work |
| Focus ownership | Retry-based focus restore works in common paths with documented ownership | Broader pinned/browser gates remain useful |
| Touch editing | Scroll suppression protects mobile basics | Missing designed touch edit UX |
| Editor mount/unmount | Stage mounts editors directly in cells | Needs unmount/remount commit/cancel policy |
| Edit batching | Paste and row models batch; inline is per-cell | Need rapid-edit/server latency policy |
| Optimistic updates | Datasource-backed model supports optimistic queue | App-level pending/rejection UX missing |
| Server-backed editing | Strong datasource row model foundation | Simple server row model unsupported; rejection UX incomplete |
| Undo/redo | Local intent history works | Need server history alignment |
| Accessibility | Native controls plus combobox roles, invalid state, and busy state | Live-region announcements remain future work |

## Correctness Risks

- Cross-browser IME behavior should still be covered by browser/e2e gates even though app key routing is composition-aware.
- Blocking typed validation is now the default for supported cell types; hosts that need raw fallback must define an explicit policy.
- Clearing the editor before async commit settles is safe for local history now, but rejected-edit announcements remain future a11y work.
- Edit state can outlive a projection change unless sort/filter/group/pivot/cache replacement paths follow the documented commit/cancel/reject policy.
- Async select options can resolve after the visual editing context changed; stale request ids protect the component, and release gates should preserve that behavior.
- Group rows are blocked, but leaf-row edits across expand/collapse and server placeholders need explicit invariants.

## Performance Risks

- Rapid inline editing can trigger repeated focus restore passes, row patches, history snapshots, and renderer updates.
- Client row patching has good fast paths, but datasource-backed rapid edits serialize through an optimistic queue and can accumulate latency without UI backpressure.
- Clipboard paste builds row updates locally and can be expensive for very large materialized ranges.
- Formula engine benchmarks exist, but table-stage formula edit diagnostics and formula commit cost are not part of the stage editing SLA because that richer editor is in the spreadsheet package.
- Custom cell renderers can dominate edit mount/remount cost; there is no focused benchmark for editor open, commit, cancel, and rapid keyboard navigation.

## Server-Backed Editing Risks

- `dataSourceBackedRowModel.ts` is the correct enterprise direction: commitEdits support, optimistic overlays, serialized transactions, rollback, invalidation handling, and revision updates.
- `docs/server-datasource/ux-contract.md` defines stronger server behavior than the generic app edit UX currently exposes, including operation ids, committed/rejected rows, invalidation, and server history.
- `serverBackedRowModel.ts` did not show an equivalent edit commit path in the reviewed search. Treat editing on that simpler model as unsupported unless a separate adapter handles it.
- Server rejection currently rolls back in the row model, but app editing has no rejected-cell surface, no retry path, and no clear history behavior for rejected commits.
- Placeholder rows and cache replacement can interact with active edits; the required commit/cancel/rebase policy is not documented.

## Formula Editing Risks

- The formula engine and spreadsheet formula editor are strong, but they are not automatically available in the table-stage DataGrid editor.
- Table-stage formula cells currently use text editor mode through `cells/runtime.ts`, so formula drafts lack inline diagnostics, reference highlighting, autocomplete, and formula-specific commit validation.
- Enterprise docs should label table-stage formula editing as basic text editing until the spreadsheet editor model is intentionally integrated or exposed as a public editor extension.

## Accessibility Risks

- Validation failures, rejected server commits, async option loading, and formula diagnostics have no consistent live-region or `aria-invalid` contract in the reviewed editing path.
- Grid focus and editor focus are both valid states, but there is no documented a11y state transition contract for entering edit mode, committing, canceling, or restoring focus after remount.
- Combobox editor roles are a good baseline, but touch/mobile and screen-reader behavior under async loading needs browser validation.

## Recommended Next Work

1. Add browser/e2e release gates for editing across virtualization remounts, pinned panes, server placeholders, resize, touch scroll, and rapid keyboard edits.
2. Add performance telemetry for editor open latency, commit latency, rollback latency, rapid-edit frame cost, and editor mount/unmount churn.
3. Add optional live-region announcements for validation failures, rejected server commits, and async option loading.
4. Decide separately whether table-stage formula editing should stay basic text editing or integrate the spreadsheet formula editor model.

## Recommended Tests

Unit and contract tests:

- IME composition does not commit, cancel, navigate, or start printable edit until composition ends.
- `parseDataGridCellDraftValue` and clipboard paste use the same type validation for number, date, datetime, percent, select, and formula cells.
- Invalid drafts produce a deterministic validation state and do not silently commit as raw values unless a column policy allows it.
- Async select stale loads cannot overwrite newer option state, commit state, or cached options.
- Datasource-backed rejected edits leave predictable app state and do not record successful history.
- Edit state is cleared, committed, cancelled, or marked stale on sort/filter/group/pivot/cache replacement according to the documented policy.

Component tests:

- Text, date, datetime, and select editors commit/cancel consistently on Enter, Tab, Escape, blur, click outside, and popup focus movement.
- Pinned left, center, right, and pinned-bottom panes preserve edit focus and movement.
- Group rows cannot enter edit mode; leaf rows under grouped/tree projections edit deterministically.
- Clipboard paste into editable and non-editable mixed ranges uses the same validation and history behavior as inline editing.

Playwright/e2e tests:

- Edit a cell, scroll it out of the virtual window, scroll it back, and verify the documented remount behavior.
- Edit during datasource latency and verify pending, commit, reject, rollback, and retry UX.
- Rapid Enter/Tab editing across 100 visible rows preserves focus, selection, history, and frame budget.
- IME composition in a text editor does not trigger grid shortcuts.
- Touch scroll does not accidentally commit/cancel/start edit, and explicit touch edit affordances behave according to the mobile contract.

Performance and benchmark tests:

- Editor open latency and commit latency for 10k, 100k, and datasource-backed rows.
- Rapid keyboard editing frame budget with custom renderers enabled.
- Clipboard paste budget for large but materialized ranges.
- Datasource optimistic queue latency and rollback latency.
- Editor mount/unmount churn while editing near virtualization boundaries.

## Recommended Telemetry

- Editor open latency.
- Editor commit latency.
- Server commit pending duration.
- Rejected edit count and rejection reason.
- Validation failure count by cell type.
- Editor mount/unmount count.
- Edit remount count.
- Clipboard paste cell count and parse/validation duration.
- Rapid-edit frame budget and long tasks.
- Datasource optimistic queue depth.
- Undo/redo transaction record duration.

## Enterprise Readiness Score

Current score: **9/10**.

Target score: **9/10**.

What blocks the target score:

- Nothing blocks the planned 9/10 Editing enterprise scope as of 2026-05-18.
- Remaining release-level work is richer a11y announcements, broader browser/e2e performance gates, and any future spreadsheet-class formula editor integration.

## Risks And Migration Notes

- Avoid changing public editor APIs until the state machine and validation shape are proposed separately.
- Keep datasource-backed editing aligned with `docs/server-datasource/ux-contract.md`; do not invent a second server edit protocol.
- Treat `serverBackedRowModel.ts` editing as unsupported unless an explicit adapter path is added.
- Validation is now blocking for supported typed drafts; hosts that need raw fallback behavior should define an explicit column/editor policy before widening behavior.
- If formula editing is upgraded in table-stage DataGrid, reuse the existing formula engine/editor model rather than creating a separate parser or reference model.
- Keep future slices small: release gates, live-region announcements, touch edit affordances, and optional formula editor integration should remain separate changes.
