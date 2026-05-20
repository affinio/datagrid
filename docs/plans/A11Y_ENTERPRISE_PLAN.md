# DataGrid Accessibility Enterprise Implementation Plan

This plan converts `docs/audits/A11Y_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current public API remains the baseline: keyboard navigation, row selection, inline editing, clipboard actions, custom cell interactions, virtualization, pinned panes, and datasource placeholders. Do not change focus semantics or public renderer contracts without a focused proposal for that slice.

Current execution state:

- Slices 1-5 are implemented as of 2026-05-20.
- The original A11Y audit has been rebaselined against current code: the virtualized app stage now exposes baseline grid/row/gridcell roles, logical row/column counts, one-based ARIA row/column indexes, deterministic rendered selection state, placeholder disabled state, and app status live regions.
- Header leaves now expose columnheader roles, logical column indexes, sort state, contextual labels, and contextual filter/resize labels.
- Normal-mode tab stops now use a documented stage-native priority: focused row index, then visible selection anchor cell, then body viewport fallback.
- Header and body cells now expose deterministic sanitized DOM ids across center, pinned, and virtualized remount paths. The mounted stage keeps roving DOM focus and intentionally does not emit app-stage `aria-activedescendant`.
- Group rows now expose grid-mode expansion and label context; placeholder rows expose row-level disabled/context metadata while preserving cell coordinates.
- Remaining enterprise gaps are pinned-pane reading-order browser validation, editor/context labels, broader live-region coverage, browser a11y gates, and large-grid a11y performance validation.
- Runtime slices must preserve the existing package boundaries: core owns headless a11y state, Vue owns adapters/app interaction state, orchestration owns shared id/navigation helpers, and `datagrid-vue-app` owns rendered stage semantics.

## Slice 1: Accessibility Contract Rebaseline

- Status: Completed on 2026-05-20.
- Objective: document current implemented accessibility behavior, distinguish known gaps from completed stage ARIA work, and create a slice roadmap before runtime changes.
- Affected packages/files:
  - `docs/datagrid-accessibility.md`
  - `docs/audits/A11Y_ENTERPRISE_AUDIT.md`
  - `docs/plans/A11Y_ENTERPRISE_PLAN.md`
  - `docs/README.md`
- Expected behavior change: no runtime behavior change; `docs/datagrid-accessibility.md` is now the current-state accessibility contract and the audit no longer treats implemented stage grid roles/indexes as missing.
- Tests to add/update:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): plan enterprise accessibility slices`

## Slice 2: Header And Sort Semantics

- Status: Completed on 2026-05-20.
- Objective: expose table-stage headers as semantic column headers with stable indexes, sort state, and menu relationships without changing column APIs.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
  - `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `docs/datagrid-accessibility.md`
- Expected behavior change: leaf header cells now expose `role="columnheader"`, one-based `aria-colindex`, `aria-sort` for sortable columns, and contextual header/menu/resize/filter labels.
- Tests to add/update:
  - Header role/index/sort assertions for unsorted, sorted, filtered, and pinned columns.
  - Header resize/filter controls keep column-specific accessible names.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-vue-app): expose header accessibility state`

## Slice 3: Focus Ownership And Tab Stop Invariant

- Status: Completed on 2026-05-20.
- Objective: document and enforce one normal-mode focus invariant across viewport, body cells, row-index cells, pinned panes, editors, and context menus.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageViewportKeyboard.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
  - `docs/datagrid-accessibility.md`
- Expected behavior change: keyboard tabbing reaches one normal-mode stage owner. A focused row index wins over cell focus, a visible selection anchor cell wins over viewport fallback, and the body viewport is tabbable only when no visible focus target exists.
- Tests to add/update:
  - Normal mode has one expected tabbable owner across viewport, body cells, and row index.
  - Row-index focus takes priority over cell focus.
  - Body viewport remains the fallback when the active anchor is not mounted.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): enforce grid focus ownership`

## Slice 4: Active Descendant And Stable Cell IDs

- Status: Completed on 2026-05-20.
- Objective: decide whether the app stage uses container focus plus `aria-activedescendant` or continues with roving DOM focus, then wire stable ids consistently for the approved model.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/dataGridTableStageA11y.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
  - `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
  - `docs/datagrid-accessibility.md`
- Expected behavior change: header and body cells now expose deterministic sanitized ids. Center, pinned-left, and pinned-right body ids are stable across virtualized remounts. App-stage `aria-activedescendant` remains absent because the approved mounted-stage model is still roving DOM focus.
- Tests to add/update:
  - Header/body ids sanitize row ids and column keys.
  - Pinned left, center, and right cells use non-conflicting ids.
  - Center cell id remains stable after horizontal unmount/remount.
  - `aria-activedescendant` stays absent under the roving-focus model.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): stabilize active cell accessibility ids`

## Slice 5: Grouped, Tree, Placeholder, And Pinned-Pane Semantics

- Status: Completed on 2026-05-20.
- Objective: define screen-reader semantics for grouped/tree projections, datasource placeholders, and split pinned DOM panes before adding attributes that could imply the wrong reading order.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `docs/datagrid-accessibility.md`
  - `docs/server-datasource/ux-contract.md`
- Expected behavior change: the mounted stage keeps `role="grid"` for the current model; grouped rows expose expansion state and group label context, placeholder rows expose row disabled/context metadata, and center/pinned panes receive the same row semantics through shared render APIs.
- Tests to add/update:
  - Group expand/collapse state is exposed through ARIA attributes.
  - Placeholder rows keep row/column indexes and expose disabled/context metadata.
  - Center and pinned panes consume the same row semantics through the shared render API.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue-app): define projected row accessibility`

## Slice 6: Editor And Interactive Cell Labels

- Status: Planned.
- Objective: ensure editors, checkbox cells, custom interactive renderers, filter comboboxes, menu controls, and resize controls expose contextual names and state.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `packages/datagrid-vue-app/src/overlays/DataGridFilterableCombobox.vue`
  - `packages/datagrid-vue-app/src/overlays/DataGridCellComboboxEditor.vue`
  - `packages/datagrid-vue-app/src/overlays/DataGridColumnMenu.vue`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `docs/datagrid-accessibility.md`
- Expected behavior change: active editors and interactive cells expose column/row context, validation state, pending state, disabled state, and selected/checked/pressed state consistently.
- Tests to add/update:
  - Text, number, date, datetime, checkbox, select, async select, and custom interactive cells have stable accessible names/state.
  - Invalid/pending editor state remains visible to assistive technologies.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts src/overlays/__tests__/DataGridFilterableCombobox.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-vue-app): label editors and interactive cells`

## Slice 7: Grid Live Region Coverage

- Status: Planned.
- Objective: route high-level spreadsheet outcomes through one polite grid status channel without per-cell announcement noise.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInlineEditing.ts`
  - `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
  - `packages/datagrid-vue-app/src/stage/*`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `docs/datagrid-accessibility.md`
- Expected behavior change: copy, cut, paste, clear, edit commit/cancel/failure, fill, range move, undo/redo, sort/filter, and server loading/error outcomes update the documented polite status region with throttling where needed.
- Tests to add/update:
  - Each command family emits one meaningful status update.
  - Rapid selection/scroll/fill preview does not spam the live region.
  - Clipboard and server errors remain announced after partial failures.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts && pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-vue-app): announce grid command outcomes`

## Slice 8: Browser Accessibility Gates

- Status: Planned.
- Objective: add browser-level accessibility validation for the mounted sandbox grid so component tests do not become the only protection.
- Affected packages/files:
  - `e2e/sandbox-interactions.spec.ts`
  - `e2e/sandbox-grid.spec.ts`
  - `package.json`
  - `docs/datagrid-accessibility.md`
- Expected behavior change: no runtime behavior change; CI/manual release validation gains mounted-grid a11y assertions.
- Tests to add/update:
  - Playwright assertions for grid roles/counts/indexes after scroll and remount.
  - Accessibility tree smoke checks for default, pinned, grouped, editing, and server-placeholder states where Playwright support is stable.
  - Optional axe smoke gate if dependency/runtime cost is approved.
- Validation command: `pnpm exec playwright test e2e/sandbox-interactions.spec.ts e2e/sandbox-grid.spec.ts --grep @a11y`
- Risk level: Low
- Suggested commit message: `test(datagrid): gate mounted grid accessibility`

## Slice 9: Large-Grid A11Y Performance Gate

- Status: Planned.
- Objective: prove accessibility attributes do not regress scroll/render latency or create excessive DOM/tab-stop churn on large virtualized grids.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/datagrid-accessibility.md`
  - `package.json`
- Expected behavior change: no user-visible behavior change; performance validation covers ARIA-heavy large-grid paths.
- Tests to add/update:
  - Browser benchmark assertion for large-grid scroll with a11y attributes enabled.
  - Tab-stop count and active descendant/id resolution checks.
  - Budget documentation for rendered ARIA attribute churn.
- Validation command: `pnpm run bench:datagrid:enterprise:a11y:browser:assert`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate accessibility scroll performance`

## Recommended Execution Order

1. Slice 1: Accessibility Contract Rebaseline (completed 2026-05-20)
2. Slice 2: Header And Sort Semantics (completed 2026-05-20)
3. Slice 3: Focus Ownership And Tab Stop Invariant (completed 2026-05-20)
4. Slice 4: Active Descendant And Stable Cell IDs (completed 2026-05-20)
5. Slice 5: Grouped, Tree, Placeholder, And Pinned-Pane Semantics (completed 2026-05-20)
6. Slice 6: Editor And Interactive Cell Labels
7. Slice 7: Grid Live Region Coverage
8. Slice 8: Browser Accessibility Gates
9. Slice 9: Large-Grid A11Y Performance Gate

## Execution Notes

- Treat focus-model changes as browser-visible behavior changes. Document the approved policy before implementation.
- Preserve desktop keyboard behavior unless a slice explicitly targets and validates a semantic correction.
- Keep ARIA work render-light: compute counts/indexes from existing viewport and selection snapshots, avoid reactive writes in scroll handlers, and do not add per-cell live updates.
- Prefer stage-native integration with existing orchestration id helpers over creating another accessibility manager.
- Custom renderers should keep interactive semantics explicit through existing interaction metadata and should not add unlabeled focusable descendants.
