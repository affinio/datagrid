# DataGrid Editing Enterprise Implementation Plan

This plan converts `docs/audits/EDITING_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current public API remains the baseline: column editability, `isCellEditable`, inline editors, `rows.applyEdits`, datasource `commitEdits`, clipboard edits, and app intent history. Do not introduce a parallel editing runtime unless a slice explicitly proposes and approves a public contract change.

Current execution state:

- Slice 1 is next and should define the enterprise editing contract before runtime hardening.
- The canonical app-stage editing path is `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts` plus `packages/datagrid-vue-app/src/stage/*` rendering and bindings.
- `datagrid-orchestration` editing helpers are reference/shared utilities, not the current mounted table-stage owner.
- Client row editing and datasource-backed editing must stay on the same `rows.applyEdits` / `commitEdits` boundary.
- History, server datasource, rendering, selection, and virtualization enterprise tracks are closed as of 2026-05-18. Editing slices should reuse their focus, history, datasource, remount, and render-lightening contracts instead of duplicating ownership.

## Slice 1: Enterprise Editing Contract

- Status: Planned.
- Objective: document the supported editing modes, package ownership, state machine, commit/cancel/pending/rejected states, focus ownership, and unsupported enterprise behaviors before runtime changes.
- Affected packages/files:
  - `docs/datagrid-editing.md`
  - `docs/audits/EDITING_ENTERPRISE_AUDIT.md`
  - `docs/datagrid-history.md`
  - `docs/server-datasource/ux-contract.md`
- Expected behavior change: no runtime behavior change; future slices get one explicit contract for inline editing, datasource editing, clipboard edit semantics, validation, blur/unmount behavior, and server rejection recovery.
- Tests to add/update:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define enterprise editing contract`

## Slice 2: IME Composition Guard

- Status: Planned.
- Objective: prevent composition input from being interrupted by grid shortcut handling, printable-key edit start, Enter/Tab commit, or Escape cancel.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/overlays/DataGridFilterableCombobox.vue`
  - Relevant contract tests under `packages/datagrid-vue/src/app/__tests__` and `packages/datagrid-vue-app/src/__tests__`
- Expected behavior change: while IME composition is active, editing keystrokes update composition only; grid edit commit/cancel/navigation starts after composition ends.
- Tests to add/update:
  - Enter/Tab/Escape do not commit/cancel/navigate during composition.
  - Printable key routing does not start a new grid edit while an editor is composing.
  - Combobox editor preserves composition behavior.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts && pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): guard editing ime composition`

## Slice 3: Draft Validation Contract

- Status: Planned.
- Objective: make invalid inline edit drafts explicit instead of silently committing parser fallback values.
- Affected packages/files:
  - `packages/datagrid-core/src/cells/runtime.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - Relevant core, Vue, and app tests
- Expected behavior change: invalid number/date/datetime/select drafts produce deterministic validation state and block commit unless the column policy explicitly allows raw fallback.
- Tests to add/update:
  - Invalid number/date/datetime drafts do not mutate rows.
  - Valid drafts still parse to raw values.
  - Validation state survives focus restore and clears on cancel/success.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/cells/__tests__/runtime.spec.ts packages/datagrid-vue/src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): validate inline edit drafts`

## Slice 4: Server Edit Pending And Rejection Recovery

- Status: Planned.
- Objective: expose deterministic app-layer state for datasource-backed edit commit pending, rejection, rollback, retry, and history recording.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
  - `packages/datagrid-server-adapters/src/index.ts`
  - `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
  - Relevant datasource and app tests
- Expected behavior change: datasource commit rejections do not look like successful inline edits; rejected cells surface stable state and successful history is not recorded for rejected commits.
- Tests to add/update:
  - Rejected datasource edit rolls back row state and does not record successful edit history.
  - Pending commit state prevents duplicate commit of the same active editor.
  - Retry/cancel behavior follows the documented contract.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts packages/datagrid-server-adapters/src/index.spec.ts packages/datagrid-vue/src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): surface rejected edit commits`

## Slice 5: Blur, Unmount, And Virtualization Policy

- Status: Planned.
- Objective: define and enforce what happens when an active editor blurs, scrolls out, unmounts, remounts, is replaced by a placeholder, or is invalidated by projection/cache changes.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `e2e/sandbox-interactions.spec.ts`
  - `docs/datagrid-editing.md`
- Expected behavior change: editor blur/unmount/remount behavior is deterministic across virtualized body rows, pinned panes, placeholder materialization, and datasource refresh.
- Tests to add/update:
  - Edited cell scrolls out and back according to the documented commit/cancel/remount policy.
  - Popup focus and combobox interactions do not trigger unintended blur commit.
  - Projection/cache invalidation handles active edit state explicitly.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts src/__tests__/DataGrid.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): stabilize edit remount policy`

## Slice 6: Clipboard Edit Validation Parity

- Status: Planned.
- Objective: make paste/clear/cut use the same parse, validation, editability, and history semantics as inline edits.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
  - `packages/datagrid-core/src/cells/runtime.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Expected behavior change: pasted number/date/datetime/select/formula drafts are accepted or rejected consistently with inline edit drafts, and mixed editable/non-editable ranges report deterministic outcomes.
- Tests to add/update:
  - Paste uses shared parser/validation for supported data types.
  - Mixed editable/non-editable paste records only committed cells and clear rejections.
  - Clipboard history records only successful committed patches.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): align paste edit validation`

## Slice 7: Async Select Editor Hardening

- Status: Planned.
- Objective: harden async select editors with abort/error/pending semantics and commit-time selected-value validation.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/overlays/DataGridCellComboboxEditor.vue`
  - `packages/datagrid-vue-app/src/overlays/DataGridFilterableCombobox.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - Relevant Vue app tests
- Expected behavior change: stale option loads cannot update newer editor context, load failures are observable, pending state is accessible, and commit validates selected values against the latest allowed options when required.
- Tests to add/update:
  - Stale async loads are ignored and aborted where supported.
  - Load error state does not commit an invalid value.
  - `aria-busy` / invalid state follows pending/error status.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-vue-app): harden async select editing`

## Slice 8: Formula Editing Boundary

- Status: Planned.
- Objective: either keep table-stage formula editing explicitly basic text editing or integrate approved spreadsheet formula editor capabilities behind a clear public contract.
- Affected packages/files:
  - `packages/datagrid-core/src/cells/runtime.ts`
  - `packages/datagrid-core/src/spreadsheet/formulaEditorModel.ts`
  - `packages/datagrid-vue-app/src/stage/*`
  - `docs/datagrid-editing.md`
  - `docs/datagrid-formula-engine-guide.md`
- Expected behavior change: formula cell editing has an explicit capability boundary: basic text commit only, or approved diagnostics/autocomplete/reference picking if implemented.
- Tests to add/update:
  - Formula draft behavior matches the documented capability.
  - Formula diagnostics do not imply table-stage support unless wired.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/spreadsheet/__tests__/formulaEditorModel.spec.ts packages/datagrid-core/src/cells/__tests__/runtime.spec.ts`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): define formula editing boundary`

## Slice 9: Editing Accessibility And Performance Gates

- Status: Planned.
- Objective: add focused validation for editor a11y state, rapid keyboard editing, pinned panes, touch scroll protection, and edit mount/commit frame cost.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/*`
  - `e2e/sandbox-interactions.spec.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no product behavior change unless tests expose fixes; editing gets focused enterprise gates for a11y and performance regressions.
- Tests to add/update:
  - `aria-invalid`, rejected edit, async loading, and edit mode announcements where supported.
  - Pinned left/center/right/pinned-bottom editor start, commit, cancel, and navigation.
  - Rapid Enter/Tab editing with frame budget and custom renderers.
  - Touch scroll does not start, commit, or cancel edit accidentally.
- Validation command: `pnpm exec vitest run packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts && pnpm exec playwright test e2e/sandbox-interactions.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate enterprise editing behavior`

## Recommended Execution Order

1. Slice 1: Enterprise Editing Contract (next)
2. Slice 2: IME Composition Guard
3. Slice 3: Draft Validation Contract
4. Slice 4: Server Edit Pending And Rejection Recovery
5. Slice 5: Blur, Unmount, And Virtualization Policy
6. Slice 6: Clipboard Edit Validation Parity
7. Slice 7: Async Select Editor Hardening
8. Slice 8: Formula Editing Boundary
9. Slice 9: Editing Accessibility And Performance Gates

## Execution Notes

- Preserve the current public `DataGrid` props and row API unless a slice explicitly proposes a public API change and gets approval.
- Keep one editing owner per user action: inline edit, selection, fill, range move, clipboard, and datasource commit must not compete for the same gesture.
- Treat validation, pending, rejected, and stale states as user-visible correctness states, not console-only diagnostics.
- Keep server-backed grids on datasource `commitEdits` and server history paths; do not record successful local history for rejected server commits.
- Avoid speculative formula editor integration until the table-stage capability boundary is approved.
