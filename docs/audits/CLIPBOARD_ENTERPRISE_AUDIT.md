# DataGrid Clipboard Enterprise Audit

## Executive Summary

The DataGrid clipboard architecture has a useful enterprise foundation, but it is not yet enterprise-grade. The canonical Vue app path supports range copy, paste, cut, multi-range scalar paste, pending clipboard outlines, system clipboard read/write with in-memory fallback, placeholder materialization on paste, row clipboard actions, fill integration, history capture, and blocked copy/cut over unloaded rows.

The main gaps are interoperability breadth and large-range/server semantics: quoted TSV cells with tabs, newlines, quotes, and explicit blank rows are now handled, but CSV, multi-MIME payloads, richer structured clipboard metadata, large virtual server delegation, async paste pending/error UX, and browser clipboard permission reporting remain incomplete. Paste now shares the typed draft validation boundary for supported cell types, but enterprise spreadsheet expectations still require stronger failure reporting, server-side operations, and performance gates.

Current enterprise readiness: **7/10**.
Target enterprise readiness: **9/10** after hardening TSV/CSV interoperability, validation, server-backed virtual operations, async failure UX, accessibility, and large-range performance gates.

## Current Architecture Summary

- `datagrid-orchestration` owns the generic clipboard bridge and legacy/local mutation helpers.
- `datagrid-vue` owns the canonical app clipboard behavior used by the table stage: range normalization, system clipboard bridging, matrix paste, cut-paste, multi-range scalar paste, history capture, and unloaded-row preflight.
- `datagrid-vue-app` wires clipboard into the rendered stage, context menus, keyboard shortcuts, placeholder row materialization, row-index clipboard actions, pending clipboard visuals, and fill/range interactions.
- `datagrid-core` owns virtual-selection metadata and operation decision helpers that can distinguish materialized, server-delegated, virtual, and blocked operations.
- Benchmark coverage exists for copy/paste/fill style workloads, but the canonical clipboard UI path is not yet covered by an enterprise browser clipboard performance SLA.

The existing package split is sound. The architecture should be hardened in place rather than replaced.

## Implementation Plan Status

- `docs/plans/CLIPBOARD_ENTERPRISE_PLAN.md` now tracks slice-by-slice closure for this audit.
- Slice 1, Enterprise Clipboard Contract, is completed as of 2026-05-20 in `docs/datagrid-clipboard.md`.
- Slice 2, Clipboard Format Parser And Writer, is completed as of 2026-05-20 for quoted TSV fields with tabs, newlines, quotes, and explicit blank rows.
- Slice 3, Clipboard Read/Write Feedback, is completed as of 2026-05-20 for user-facing system clipboard fallback messages.
- Slice 4, Structured Paste Result, is completed as of 2026-05-20 for local applied, blocked, skipped, invalid, and target cell status reporting while preserving the existing updated-row return value.
- Slice 5, Clipboard Validation Completeness, is completed as of 2026-05-20 for built-in number, currency, percent, date, datetime, select, formula text, and empty clear value coverage.
- Slice 6, Server Clipboard Operation Contract, is completed as of 2026-05-20 for planned copy/export, paste/import, cut, clear/delete, revision, projection, partial result, and history semantics.
- Current code includes typed draft validation and local target/applied/blocked/skipped/invalid status on the canonical app clipboard paste path; the remaining validation work is custom/server result contracts, host paste policies, and per-cell rejection UI.
- Server-delegated clipboard operations remain planned; local virtual/unloaded operations continue to block safely.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
- `docs/datagrid-format.md`
- `docs/perf/datagrid-performance-gates.md`
- `docs/perf/datagrid-browser-performance-next-slices.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- `docs/SELECTION_ENTERPRISE_AUDIT.md`
- `docs/EDITING_ENTERPRISE_AUDIT.md`

Clipboard and interaction implementation:

- `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
- `packages/datagrid-vue/src/app/useDataGridAppFill.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-orchestration/src/clipboard/useDataGridClipboardBridge.ts`
- `packages/datagrid-orchestration/src/clipboard/useDataGridClipboardMutations.ts`
- `packages/datagrid-orchestration/src/clipboard/useDataGridCopyRangeHelpers.ts`
- `packages/datagrid-orchestration/src/internal/browserClipboard.ts`
- `packages/datagrid-orchestration/src/internal/dataGridRangeMutationKernel.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRowState.ts`
- `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
- `packages/datagrid-vue-app/src/overlays/dataGridContextMenu.ts`
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts`

Virtualization and server-related support:

- `packages/datagrid-core/src/selection/virtualSelection.ts`
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts`

Tests and benchmarks sampled:

- `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridClipboardBridge.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridKeyboardCommandRouter.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridContextMenuActionRouter.contract.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageCellState.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/ensureDataGridAppStyles.contract.spec.ts`
- `e2e/sandbox-interactions.spec.ts`
- `scripts/bench-datagrid-enterprise-workloads.mjs`
- `scripts/bench-datagrid-interactions.mjs`

## Strengths

- `useDataGridAppClipboard.ts` is the canonical app-layer owner for cell clipboard behavior and keeps the surface focused: copy, paste, cut, pending range state, range normalization, history, and matrix application.
- Copy and cut preflight unloaded or placeholder rows through `resolveMissingRowIndexInRange`; the app blocks unsafe local operations with a clear message instead of silently copying partial data.
- `useDataGridClipboardBridge.ts` writes to `navigator.clipboard.writeText`, reads from `navigator.clipboard.readText`, and falls back to the last in-memory payload when browser read permissions are unavailable.
- Copy output is deterministic TSV for simple cells: rows are joined with `\n` and cells with `\t`.
- `readClipboardCell` lets the stage supply clipboard-specific values instead of rendered/display values, which matches `docs/datagrid-format.md` guidance that clipboard/export should choose raw or formatted output explicitly.
- Paste supports matrix repetition over larger targets and treats a scalar paste into multiple committed ranges as a multi-range operation.
- Paste/cut history is transaction-aware. Cut-paste is recorded as one deterministic transaction in `useDataGridAppClipboard.ts`, and tests cover undo/redo for that flow.
- `captureRowsSnapshotForRowIds` is used when available, reducing history snapshot size for paste/fill.
- Clipboard paste into placeholder rows can materialize rows through `ensureEditableRowAtIndex` and `placeholderRows.ensureMaterializedRowAt(..., "paste")`; `DataGrid.contract.spec.ts` covers empty-grid placeholder paste.
- Row-index clipboard actions in `DataGridDefaultRenderer.ts` support copy, cut, paste, row move for pending cuts, JSON row serialization, fresh row identity, and placeholder-row paste.
- Pending clipboard visuals are rendered for cells and rows, including pinned-pane row outlines, and scrolling disables animated clipboard ants in CSS.
- Fill reuses the same `applyClipboardEdits` pathway, so local fill and local paste share row patch/history mechanics.
- `virtualSelection.ts` already models whether copy, cut, clear, fill, and range move require materialized values or can be delegated to a server.
- Benchmarks in `scripts/bench-datagrid-enterprise-workloads.mjs` include copy-paste-fill phases, and performance docs already call out lower-allocation bulk patch representation for copy, paste, and fill as a future slice.

## Findings By Severity

### Blocker

1. **CSV, multi-MIME, and full spreadsheet clipboard interoperability are still incomplete.**
   Slice 2 added quoted TSV parsing/writing for tabs, newlines, quotes, and explicit blank rows. CSV comma-separated payloads, multi-MIME payloads, HTML clipboard payloads, fixture coverage for external spreadsheet apps, and richer internal structured formats remain planned work.

2. **Virtualized and unloaded large-range copy/cut are blocked rather than server-delegated.**
   `useDataGridAppClipboard.ts` blocks selected ranges with unloaded or placeholder rows and tells users to load rows or use server export. This is safe, and Slice 6 now documents the planned server copy/export/cut/clear/paste contract for unloaded ranges. Runtime server delegation is still not implemented.

3. **Validation failures are first-class for built-in local paste status but not yet durable telemetry.**
   `collectClipboardEdits` validates built-in typed drafts through the shared cell runtime boundary before row mutation and reports applied, skipped, invalid, blocked, and target cell counts. The remaining gap is host paste policies, durable telemetry, custom/server validation results, and per-cell rejected UI.

4. **Async paste failure handling is incomplete.**
   `pasteSelectedCells` awaits clipboard read and row edits, but there is no pending state, progress indicator, cancellation, rollback UX, retry surface, or clear rejected-cell feedback when `applyEdits` or a custom async `applyClipboardEdits` fails.

### High

1. **Browser clipboard permission failures now have basic status feedback but not structured diagnostics.**
   `useDataGridClipboardBridge.ts` catches write failures and still stores the in-memory payload. `readClipboardPayload` catches read failures and falls back to memory. Slice 3 added user-facing fallback messages; structured permission diagnostics, browser policy detail, and retry guidance remain planned work.

2. **Multi-range copy visuals exist, but multi-range copy payload semantics are only active-range based.**
   Pending visuals track each committed selection range, and scalar paste can target multiple ranges. Copy payload generation still resolves one copy range through `resolveCopyRange`. Enterprise spreadsheet behavior should explicitly define whether multi-range copy is unsupported, active-range-only, or serialized in a specific order.

3. **Large local paste and fill are row/cell iterative.**
   `collectClipboardEdits` loops every target row and column; the orchestration mutation helper also iterates every range cell. This is fine for moderate materialized ranges, but 100k-row or wide table paste/fill needs chunking, server delegation, worker/bulk patch representation, or an explicit size cap.

4. **Partial paste reporting now covers local status but not server/custom apply results.**
   Non-editable, group, missing, skipped, and invalid cells are counted for the canonical local app path. Custom `applyClipboardEdits` and future server paste responses still need structured result contracts.

5. **Paste return semantics remain row-count based for API stability.**
   User-facing local paste status distinguishes target, applied, skipped, blocked, and invalid cells. The public `applyClipboardEdits` return value remains updated row count; enterprise telemetry and custom/server paste result contracts still need a structured shape.

6. **Clipboard payload format is single-channel plain text.**
   Cell copy uses plain TSV text. Row clipboard uses JSON text. There is no multi-MIME write/read strategy for `text/plain`, `text/tab-separated-values`, `text/csv`, and an internal structured format. This limits Excel/Sheets interoperability and safe internal round trips.

7. **Server-backed paste semantics are not fully defined.**
   The stage accepts `applyClipboardEdits`, and datasource-backed row models can apply edits, but the audit did not find a complete server-side paste protocol for large unloaded ranges, validation failures, partial acceptance, operation ids, or undo/redo integration equivalent to the server fill path.

### Medium

1. **Empty trailing rows are discarded during paste parsing.**
   `parseClipboardMatrix` filters rows with `row.length > 0`. This may be convenient for common copy payloads, but spreadsheet users may expect trailing blank rows or blank copied rows to be preserved in some paste operations.

2. **Ragged matrix semantics are implicit.**
   Paste width is based on `matrix[0]?.length`, while each cell lookup falls back to `""` for missing values. Ragged clipboard input from external tools should be documented and tested.

3. **Copy counts can include skipped non-copyable columns.**
   `useDataGridClipboardBridge.ts` skips non-copyable columns such as `"select"` in the payload, but the last-action message reports range dimensions, not emitted cells. This can mislead users copying ranges that include selection/system columns.

4. **Cut-paste is not atomic across source clear and target write.**
   The app clears the source range and then applies target edits. It records one transaction after both steps, but if the second operation fails, the code path does not show a deterministic rollback before returning.

5. **Row clipboard JSON is useful internally but not interoperable with spreadsheets.**
   `DataGridDefaultRenderer.ts` serializes row copies as JSON and can paste that JSON into row-index actions. This is appropriate for internal row copy, but external apps will not treat it as spreadsheet rows.

6. **Accessibility feedback is minimal.**
   Clipboard actions call `setLastAction` or `reportFillWarning`, and visual outlines exist. There is no audited live-region contract for copied, paste blocked, partially pasted, clipboard denied, or async paste pending states.

7. **Touch/mobile clipboard behavior is not deliberately designed.**
   Keyboard shortcuts and context menus work on desktop. Mobile selection/copy/paste typically relies on OS affordances, long-press, and virtual keyboard behavior, which are not specified in the current clipboard architecture.

8. **Pending clipboard outlines are viewport-relative and virtualized.**
   `isCellInPendingClipboardRange` uses `viewportRowStart + rowOffset`, which is correct for rendered windows. Enterprise tests should verify that outlines reappear correctly after vertical/horizontal virtualization remounts, pinned panes, and cache refresh.

### Low

1. **In-memory clipboard fallback is session-local.**
   This is expected and safe, but docs should be explicit that it is a fallback, not system clipboard synchronization.

2. **Context menu paste-special currently supports values mode only.**
   `pasteSelectedCells` accepts `mode: "values"`, and `buildPasteSpecialMatrixFromRange` can provide value matrices. Formula/format paste modes are unsupported rather than broken.

3. **`useDataGridClipboardMutations.ts` appears legacy/reference for the canonical app stage.**
   It has useful applied/blocked count semantics but mutates source rows directly. Future hardening should reuse the good result shape without shifting the canonical app path away from row-model APIs.

## Focus Area Evaluation

| Area | Current Assessment | Enterprise Gap |
| --- | --- | --- |
| Copy semantics | Deterministic quoted TSV over one resolved range | Needs multi-MIME, multi-range policy, unloaded server copy, and emitted-cell counts |
| Paste semantics | Matrix-aware paste with repetition, typed draft validation, history, and local applied/blocked status reporting | Needs async failure UX, durable telemetry, custom/server structured results, and server delegation |
| Large-range operations | Works for materialized moderate ranges | Needs caps, chunking, server delegation, or bulk patch representation |
| TSV interoperability | Quoted tabs, newlines, quotes, and explicit blank rows are handled | Needs external spreadsheet fixture coverage and performance gates |
| CSV interoperability | Unsupported | Add CSV parser or clearly document TSV-only support |
| Excel/Google Sheets compatibility | Stronger for quoted TSV cells | Needs external fixtures for formulas, formatted values, CSV, and multi-MIME |
| Virtualized ranges | Visuals are range/index based; unloaded copy is blocked | Need remount tests and server-delegated virtual operations |
| Unloaded rows | Safe-blocked for copy/cut | Need server export/copy/cut contract |
| Placeholders | Paste can materialize placeholders; copy/cut blocked | Need broader e2e for multi-row/multi-range placeholder paste |
| Fill interaction | Reuses `applyClipboardEdits`; server fill exists separately | Need shared telemetry and partial failure semantics |
| Async paste | Awaited but not surfaced | Need pending, cancel, failure, retry, rollback UX |
| Validation failures | Editable check only in app path | Need type parse/validation result model |
| Partial paste | Reports local target/applied/blocked/skipped/invalid counts | Need custom/server structured results and per-cell rejected UI |
| Multi-range copy | Visuals track ranges; payload active-range-like | Need explicit policy and tests |
| Browser clipboard APIs | Uses `navigator.clipboard` with fallback and fallback status messages | Need structured permission diagnostics and secure-context expectations |
| Security restrictions | Catches denied reads/writes safely and reports fallback use | Need retry guidance and no stale fallback surprise |
| Accessibility | Visual/status-message baseline | Need live-region and keyboard/context-menu announcements |
| Touch/mobile | Not a dedicated clipboard model | Need long-press/context-menu/mobile paste contract |

## Interoperability Risks

- Quoted TSV now protects values containing tabs, newlines, and quotes; remaining interoperability risk is external fixture coverage and unsupported CSV/multi-MIME payloads.
- Comma-separated CSV from external tools is treated as a single-column TSV row.
- Quoted TSV fields are parsed; quoted CSV fields are not parsed as CSV.
- Formulas are copied as whichever string `readClipboardCell` provides, but formula/value paste modes beyond values are unsupported.
- Date, number, currency, percent, select, formula text, and empty clear paste use shared draft validation where the canonical app path has column type metadata; remaining risk is per-cell rejection UI and host-specific paste policies.
- Row clipboard JSON is internal and not spreadsheet-interoperable.

## Performance Risks

- Large paste/fill paths allocate matrix arrays, per-row patch objects, maps keyed by row id, and history snapshots.
- `collectAffectedRowIds` scans rows in every normalized range before snapshot capture.
- Multi-range paste flattens and merges updates, which is simple but can grow costly for many ranges or wide selections.
- Copy payload creation is synchronous and builds one large string in memory.
- Browser clipboard write/read of large payloads can block or fail without progress feedback.
- Existing performance gates cover fill and enterprise copy-paste-fill benchmark phases, but not the full browser clipboard permission/read/write path or TSV parser costs.

## Virtualization And Server Risks

- Local copy/cut correctly refuses unloaded rows, but enterprise server-backed grids need copy/export/cut/clear over unloaded ranges.
- `virtualSelection.ts` can evaluate server capabilities for copy/cut/clear/fill/range-move, but app clipboard does not yet consume those decisions.
- Placeholder paste is strong for editable placeholder tails, but placeholder copy/cut is blocked. That is correct unless a server/export path is added.
- Pending clipboard outlines should remain stable across virtual remounts because they are range-based, but this needs e2e coverage with scroll-out/scroll-in and horizontal virtualization.
- Projection changes after copy/cut can make row indexes stale. Current pending range state is index-based; enterprise behavior needs a stale/rebase/clear policy using projection identity.

## Failure Handling Risks

- Clipboard write failure stores the in-memory payload and reports fallback use; remaining gap is structured diagnostics.
- Clipboard read failure reports in-memory fallback use; remaining gap is stale-payload age/source reporting.
- Async `applyEdits` failure during paste has no visible rejected-state contract.
- Cut-paste source clear and target paste are not guarded as one atomic row-model transaction.
- Partial paste reports blocked cells in the canonical local app path; custom/server paste paths still need structured responses.
- Custom `applyClipboardEdits` can return a number but cannot return structured partial validation failures.

## Accessibility And Mobile Risks

- Clipboard outlines are visual and animated; CSS disables animation while scrolling, which is good for performance, but there is no audited reduced-motion or screen-reader status contract.
- `setLastAction`/`reportFillWarning` can carry messages, but no live-region guarantee was found in the reviewed clipboard path.
- Touch clipboard flows are not specified. Enterprise mobile behavior should define long-press selection, OS paste affordances, context-menu availability, and whether custom paste buttons are required.
- Browser clipboard APIs require secure contexts and user gestures in real browsers. Tests mock `navigator.clipboard`, so Playwright coverage is needed for permission-denied and user-gesture cases.

## Enterprise Readiness Score

Current score: **7/10**.

Target score: **9/10**.

What blocks the target score:

- No CSV parser/writer, multi-MIME clipboard strategy, or external spreadsheet fixture gate. Quoted TSV parser/writer support is implemented.
- No multi-MIME clipboard payload strategy.
- No runtime server-delegated copy/cut/clear/paste implementation for unloaded virtual ranges. The planned contract is documented.
- No custom/server paste validation result contract. Built-in local paste validation and status reporting are implemented.
- No async paste pending/failure/retry UX.
- No structured partial paste result.
- No structured browser clipboard permission/a11y/mobile validation gate.

## Recommended Tests

Unit and contract tests:

- Copy escapes tabs, newlines, quotes, and blank values according to the chosen TSV/CSV contract.
- Paste parses Excel/Google Sheets quoted TSV and CSV payloads.
- Paste preserves or intentionally trims trailing blank rows according to documented policy.
- Ragged matrices apply deterministic blanks or preserve row widths.
- Number/date/select/formula paste uses the same validation model as inline edit.
- Copy/cut over unloaded rows returns a structured blocked/server-delegated decision.
- Multi-range copy behavior is explicitly tested as active-range-only, blocked, or ordered serialization.
- Clipboard read/write failures report whether fallback memory was used.

Component tests:

- Placeholder paste materializes shallow and deep placeholder rows with history.
- Pending cell and row clipboard outlines reappear after virtualization remount and pinned-pane scroll.
- Partial paste reports applied and blocked cells.
- Cut-paste failure rolls back or reports a deterministic recoverable state.
- Paste-special values mode does not read system clipboard when an internal copied range exists.

Playwright/e2e tests:

- Browser clipboard copy/paste works in a secure context with user gestures.
- Browser permission denial shows the expected fallback/failure status.
- Copy from DataGrid into Excel/Google Sheets-compatible TSV fixture round-trips shape.
- Paste from Excel/Google Sheets fixtures with tabs, newlines, quotes, formulas, dates, and empty trailing rows.
- Large virtual range copy is blocked or server-delegated with the correct user message.
- Touch/coarse-pointer copy/paste path works through the designed mobile affordance.

Performance tests:

- Copy payload creation time and memory for 10k, 100k materialized cells.
- Paste parse time for large TSV/CSV payloads.
- Paste patch creation and row-model apply time for 10k, 100k cells.
- Multi-range scalar paste cost for many ranges.
- Browser clipboard read/write latency and failure rate for large payloads.
- Fill and paste shared `applyClipboardEdits` telemetry with applied/blocked cell counts.

## Recommended Telemetry

- Copy selected row count, column count, emitted cell count, payload bytes.
- Copy payload build duration.
- Clipboard write success/failure and fallback usage.
- Clipboard read success/failure and fallback usage.
- Paste payload bytes, parsed rows, parsed columns, parser duration.
- Paste target cell count, applied cell count, blocked cell count, materialized row count.
- Paste patch creation duration and row-model apply duration.
- Async paste pending duration and failure reason.
- Server-delegated operation id, revision, accepted/rejected counts.
- Pending clipboard outline range count and visible rendered outline count.

## Recommended Next Work

1. Extend the clipboard format contract beyond implemented quoted TSV if CSV, HTML, or internal structured MIME are required.
2. Add Excel/Google Sheets fixture gates for the quoted TSV parser/writer.
3. Add custom/server structured paste result contracts for materialized rows, failed cells, operation id, and durable telemetry.
4. Reuse inline edit parse/validation for paste or document an explicit paste-specific policy.
5. Wire virtual-selection operation decisions into copy/cut/clear and define server delegation APIs.
6. Add async paste pending, failure, retry, and rollback UX.
7. Add projection identity handling for pending copy/cut ranges after sort/filter/group/pivot/cache replacement.
8. Add browser clipboard Playwright coverage for permission and user-gesture behavior.
9. Add mobile clipboard UX documentation and tests after the touch selection model is defined.
10. Add performance gates for copy payload creation, parse, paste patch creation, and large materialized paste.

## Risks And Migration Notes

- Escaping copied TSV may change payloads for values that currently include tabs/newlines. Treat this as a compatibility improvement with release notes.
- Blocking invalid paste values by default can change behavior for users relying on raw string insertion. Prefer a column/paste policy or staged migration.
- Server-delegated clipboard operations should align with existing datasource revision, operation id, invalidation, and history contracts rather than introducing a separate protocol.
- Keep row clipboard JSON as an internal row-index operation unless a public structured clipboard format is designed.
- Do not make public API changes until the clipboard format and validation result shape are proposed.
