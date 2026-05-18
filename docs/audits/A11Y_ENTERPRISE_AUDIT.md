# DataGrid Accessibility Enterprise Audit

## Executive Summary

DataGrid has useful accessibility foundations, but the rendered enterprise grid is **not yet enterprise-grade for screen reader users**.

The strongest current pieces are keyboard navigation, focus restoration helpers, row-selection checkbox semantics, interactive cell labels, editor keyboard handling, and a deterministic headless a11y state machine in core. The biggest gap is integration: the main virtualized `datagrid-vue-app` stage does not currently render a complete ARIA grid/table contract. The reviewed stage uses focusable `div` cells and viewport focus, but does not consistently apply `role="grid"`, `role="row"`, `role="gridcell"`, `role="columnheader"`, `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex`, stable cell ids, or `aria-activedescendant`.

Current enterprise accessibility readiness: **5.5/10**.

Target: **9/10** after wiring the existing headless contract into the virtualized stage, defining pinned/grouped/tree semantics, adding screen-reader-oriented browser tests, and adding a large-grid a11y performance gate.

## Current Architecture Summary

- `packages/datagrid-core/src/a11y/headlessA11yStateMachine.ts` owns a deterministic headless accessibility state machine for focus, keyboard commands, roving tabindex, and ARIA state.
- `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts` maps headless grid/cell ARIA state to DOM-ready attributes.
- `packages/datagrid-orchestration/src/accessibility/useDataGridA11yCellIds.ts` builds stable cell/header ids and 1-based ARIA row/column indexes.
- `packages/datagrid-vue-app/src/stage/*` owns the rendered DataGrid stage, virtualized rows/cells, pinned panes, editors, overlays, keyboard routing, and focus restoration.
- Keyboard navigation and clipboard/edit/fill shortcuts are implemented through `datagrid-orchestration` and `datagrid-vue` interaction controllers rather than the headless a11y state machine.

This layering is compatible with the project architecture, but the headless a11y path and rendered stage path are not yet one integrated accessibility contract.

## Exact Files Reviewed

Docs:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/datagrid-headless-a11y-contract.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- `docs/SELECTION_ENTERPRISE_AUDIT.md`
- `docs/EDITING_ENTERPRISE_AUDIT.md`
- `docs/CLIPBOARD_ENTERPRISE_AUDIT.md`
- `docs/RENDERING_PIPELINE_AUDIT.md`

Core / Vue / orchestration:

- `packages/datagrid-core/src/a11y/headlessA11yStateMachine.ts`
- `packages/datagrid-core/src/a11y/__tests__/headlessA11yStateMachine.contract.spec.ts`
- `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts`
- `packages/datagrid-vue/src/composables/useDataGridA11yCellIds.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridA11yCellIds.contract.spec.ts`
- `packages/datagrid-orchestration/src/accessibility/useDataGridA11yCellIds.ts`
- `packages/datagrid-orchestration/src/navigation/useDataGridCellNavigation.ts`
- `packages/datagrid-orchestration/src/navigation/useDataGridKeyboardCommandRouter.ts`
- `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorKeyRouter.ts`
- `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorFocus.ts`

Rendered stage / app layer:

- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageOverlayLayer.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageFillActionMenu.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageViewportKeyboard.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRowIndex.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRowSelection.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
- `packages/datagrid-vue-app/src/overlays/DataGridFilterableCombobox.vue`
- `packages/datagrid-vue-app/src/overlays/DataGridCellComboboxEditor.vue`
- `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`

Tests searched/reviewed:

- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageCellState.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/useDataGridTableStageRowSelection.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridCellNavigation.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridKeyboardCommandRouter.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridInlineEditorKeyRouter.contract.spec.ts`

## Strengths

- **Headless a11y state exists.** `createDataGridA11yStateMachine` tracks grid focus, active cell, active descendant, row/column counts, clamped dimensions, and deterministic keyboard commands.
- **Adapter mapping exists.** `mapDataGridA11yGridAttributes` and `mapDataGridA11yCellAttributes` can emit grid/cell role, tabindex, row/column count, row/column index, active descendant, and selected state attributes.
- **Stable id/index helper exists.** `useDataGridA11yCellIds` sanitizes cell/header ids and computes 1-based ARIA indexes.
- **Keyboard-only cell navigation is strong.** `useDataGridCellNavigation` covers arrows, Home/End, PageUp/PageDown, Tab, Enter, Escape, shift extension, and ctrl/meta directional jumps.
- **Keyboard command routing exists.** Undo/redo, copy/paste/cut, select-all, context menu, clear, and range-move cancel have keyboard paths.
- **Focus restoration is pragmatic.** `restoreDataGridFocus` retries focus after `nextTick` and animation frame; active-cell viewport helpers scroll and refocus without forcing browser scroll jumps.
- **Inline editor keyboard semantics exist.** Escape cancels, Enter commits, Tab/Shift+Tab commits and moves to the next editable target.
- **Combobox editor follows a recognizable ARIA shape.** The input uses `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete`, and `aria-activedescendant`; options use `role="option"` and `aria-selected`.
- **Interactive cells can expose semantics.** Cell interactions can provide role, label, pressed/checked/disabled state; checkbox cells render `role="checkbox"` and `aria-checked`.
- **Decorative chrome is hidden.** Canvas chrome and visual selection/fill/move overlays use `aria-hidden="true"`.

## Findings By Severity

### Blocker

1. **Rendered virtualized stage is not wired as a complete ARIA grid.**
   - Evidence: `DataGridTableStageCenterPane.vue` renders the body viewport as a `div` with `tabindex="0"` but no `role="grid"`, `aria-rowcount`, `aria-colcount`, or `aria-activedescendant`. Rows are `div.grid-row` without `role="row"`. Normal cells only receive a role when `cellAriaRole` returns an interactive role or checkbox role; normal data cells do not consistently receive `role="gridcell"`, `aria-rowindex`, or `aria-colindex`.
   - Impact: screen readers cannot reliably understand the virtualized grid as a grid, know the total row/column count, or announce virtual positions.
   - Required: integrate the headless a11y contract or an equivalent stage-native ARIA grid contract into `datagrid-vue-app`.

2. **`aria-activedescendant` is defined in core but not applied to the main stage.**
   - Evidence: `headlessA11yStateMachine.ts` and `a11yAttributesAdapter.ts` support active descendant. Search found no usage of `createDataGridA11yStateMachine`, `mapDataGridA11yGridAttributes`, or `aria-activedescendant` in the main `DataGridTableStage` body; the only rendered `aria-activedescendant` found in app code is the filterable combobox.
   - Impact: focus can live on a viewport or a remounted cell, but screen readers do not have a stable active descendant model across virtualization.
   - Required: choose and document one focus model: roving DOM focus or container focus + active descendant. Then apply it consistently.

3. **Virtualized row/column indexes are not exposed to assistive tech.**
   - Evidence: stage cells expose `data-row-index` and `data-column-index`, but no rendered `aria-rowindex` / `aria-colindex` was found in `datagrid-vue-app` stage cells.
   - Impact: virtualized DOM rows appear as a partial DOM without reliable absolute row/column position.
   - Required: add absolute ARIA indexes for body, pinned, grouped, placeholder, and pinned-bottom rows.

### High

1. **Two accessibility architectures exist but are not unified.**
   - Evidence: `docs/datagrid-headless-a11y-contract.md` documents headless state machine guarantees. The app stage uses selection snapshot, DOM focus helpers, and interaction-controller keyboard routing instead.
   - Impact: future fixes can improve the headless API without improving the real rendered DataGrid.
   - Required: define whether the headless state machine is the canonical app-stage owner or a lower-level helper, then wire or retire the unused path.

2. **Roving tabindex is partial and can produce multiple competing focus targets.**
   - Evidence: body viewport has `tabindex="0"`, selected anchor cells get `tabindex="0"`, row-index cells can get `tabindex="0"` when a row is focused, and editor controls are focusable while editing.
   - Impact: keyboard-only users and screen readers may encounter unexpected tab stops, especially with row selection, editing, pinned panes, and viewport focus fallback.
   - Required: document one roving tabindex invariant and enforce it across viewport, body cells, row index cells, editors, and pinned panes.

3. **Headers are visually rich but not semantically complete.**
   - Evidence: header cells are `div.grid-cell--header`; column menu and resize buttons have labels, but header cells are not consistently rendered as `role="columnheader"` with sort state (`aria-sort`) or column indexes.
   - Impact: screen readers may miss sortable/filterable column semantics and virtual column position.
   - Required: add columnheader semantics, `aria-sort`, menu button relationships, and resize affordance semantics.

4. **Grouped/tree rows lack an enterprise ARIA contract.**
   - Evidence: group rows can be toggled by Space and group renderers receive `isGroup`, `childrenCount`, and `toggle`; no rendered `role="row"`, `aria-expanded`, `aria-level`, `aria-posinset`, or `aria-setsize` was found for stage group rows.
   - Impact: grouped/tree structure is not predictable for screen readers.
   - Required: define grid vs treegrid semantics and expose expansion state/levels where supported.

5. **Pinned panes can fragment screen-reader reading order.**
   - Evidence: left, center, right, and pinned-bottom panes render separate DOM trees. Focus lookup searches all pane roots, but no ARIA ownership/reading-order contract was found.
   - Impact: assistive tech may read pinned cells, center cells, and pinned-bottom cells as unrelated regions.
   - Required: provide one logical grid tree with stable ids/indexes, or hide duplicate/non-primary structural wrappers while exposing cells in logical order.

6. **No screen-reader or automated a11y gate was found.**
   - Evidence: tests cover headless state, ids, keyboard, row checkboxes, and interaction ARIA attributes, but no reviewed axe/Playwright accessibility tree/screen-reader smoke gate was found.
   - Impact: regressions in real browser semantics are likely.
   - Required: add component and browser a11y assertions for the rendered stage.

### Medium

1. **Editing accessibility is functional but under-specified.**
   - Evidence: text/date editors are plain inputs with generated `name` and autofocus, but no explicit `aria-label` / `aria-labelledby` binding to row+column context was found. Select editor combobox semantics are better.
   - Impact: active editor context may be unclear to screen readers.
   - Required: label editors with column label and row/index context; announce commit/cancel validation outcomes.

2. **Clipboard accessibility depends on internal status messages, not live-region guarantees.**
   - Evidence: clipboard code sets `lastAction` messages such as copied/pasted/skipped, but in the reviewed app-stage path `setLastAction` routes through `reportFillWarning`; only sorting has an explicit `role="status"` live region in `DataGridDefaultRenderer.ts`.
   - Impact: copy/paste/fill failures may not be announced reliably.
   - Required: add a grid-level polite live region for clipboard, fill, edit, history, filter, and server/placeholder actions.

3. **Touch accessibility is not defined beyond native-scroll protection.**
   - Evidence: touch handling preserves native scroll and supports long-press/context behavior, but no touch-specific accessibility contract for selection handles, fill handles, row resize, or context actions was found.
   - Impact: touch screen-reader and switch-control workflows are incomplete.
   - Required: define non-hover affordances, target sizes, labels, and alternatives for drag-only actions.

4. **Placeholder/loading rows are not announced.**
   - Evidence: datasource placeholder rows are visually represented and carry internal placeholder flags; stage cells do not expose a consistent `aria-busy`, loading label, or row status.
   - Impact: server-backed virtualized loading can be silent or confusing to assistive tech.
   - Required: expose loading/error placeholder state through row/cell labels and a live region with throttling.

5. **Selection state announcements remain incomplete.**
   - Evidence: visual classes and overlays represent selection, and stage body cells now expose deterministic `aria-selected` for rendered selected/unselected cells. Checkbox row selection exposes checked state.
   - Impact: active-cell changes, multi-range summaries, fill preview, and range move state are still not predictably announced as higher-level changes.
   - Required: expose active cell and selection summary through ARIA and live-region messages without adding per-cell heavy DOM churn.

### Low

1. **Decorative overlays are correctly hidden, but semantic equivalents are missing.**
   - Evidence: selection/fill/move overlays are `aria-hidden="true"`.
   - Impact: good for avoiding duplicate noise, but users need non-visual state announcements.

2. **Headless a11y doc references a Vue adapter test path that was not found.**
   - Evidence: `docs/datagrid-headless-a11y-contract.md` lists `packages/datagrid-vue/src/adapters/__tests__/a11yAttributesAdapter.contract.spec.ts`; `rg --files` found the adapter implementation and `useDataGridA11yCellIds` test, but not that adapter test file.
   - Impact: minor doc/test alignment gap.

## WCAG Alignment

Current likely alignment:

- **Keyboard access:** partial to strong for grid navigation and shortcuts.
- **Focus visible:** mostly covered through visual focus/selection classes and direct focus calls, but not verified by a browser a11y gate.
- **Name, role, value:** weak for the main grid because roles/counts/indexes are incomplete; stronger for checkbox cells, column menu buttons, comboboxes, and some interactive renderers.
- **Status messages:** partial; sorting has `role="status"`, but clipboard/edit/fill/server row model messages are not consistently live-region-backed.
- **Pointer/touch alternatives:** partial; keyboard alternatives exist for many actions, but resize/fill/range move/touch workflows need explicit accessible alternatives.

Do not claim WCAG conformance until the rendered stage has automated and manual assistive-tech validation.

## Virtualized DOM Accessibility

The current virtualized DOM is visually and interactively strong, but assistive tech needs a logical grid abstraction over a partial DOM:

- total row/column counts
- absolute row/column indexes
- stable cell/header ids
- active descendant or a single roving DOM focus target
- clear loading/error placeholder semantics
- a logical reading order across pinned panes and pinned bottom rows

The code already has helpers for most of these pieces. The missing work is integration and validation.

## Keyboard-Only Workflow Support

Implemented:

- arrow, Home/End, PageUp/PageDown, Tab, Enter, Escape navigation
- shift selection extension
- Ctrl/Cmd shortcuts for copy/paste/cut/select-all/undo/redo
- keyboard context menu through ContextMenu / Shift+F10
- row-index keyboard actions
- editor Escape/Enter/Tab semantics
- group row Space toggle in app stage

Risks:

- focus target ownership is split between viewport, selected cell, row index, editor, and context menu
- screen-reader focus semantics are weaker than visual keyboard behavior
- drag-centric features need keyboard alternatives and announcements

## Screen Reader Predictability

Main risk: visual state and logical state are richer than the accessibility tree.

Screen readers need stable announcements for:

- focused cell coordinates and column name
- selected range size and multi-range state
- sort/filter/group state
- row selection state
- editing start/commit/cancel
- clipboard/fill/range move outcomes
- server loading/error placeholders
- pinned pane and pinned-bottom context

Today these are not consistently exposed from the rendered stage.

## Large-Grid Accessibility Performance

The architecture should avoid per-cell heavy aria recomputation during scroll. Recommended approach:

- compute row/column counts once per snapshot
- emit row/cell indexes only for rendered cells
- use stable id helpers, not random ids, for grid cells
- keep overlays `aria-hidden`
- use one throttled live region for high-level announcements
- avoid updating `aria-activedescendant` more often than active-cell changes
- add a benchmark for scroll with a11y attributes enabled

## Enterprise Readiness Score

Current score: **5.5/10**

Target score: **9/10**

What blocks the target:

- rendered stage lacks complete ARIA grid semantics
- headless a11y state machine is not integrated into the main app stage
- no consistent active-descendant or roving-tabindex invariant across viewport/cells/editors/row index
- grouped/tree and pinned-pane semantics are not defined
- no automated browser a11y gate or screen-reader smoke plan
- no grid-level live region for common spreadsheet actions
- no large-grid a11y performance gate

## Recommended Roadmap

### Phase 1: Rendered Grid Semantics

- Choose `role="grid"` or `role="treegrid"` policy for the main stage.
- Add `aria-rowcount`, `aria-colcount`, and a stable labelled name for the grid.
- Add `role="row"` for rendered rows.
- Add `role="gridcell"` for normal body cells.
- Add `role="columnheader"` and `aria-sort` for headers.
- Add `aria-rowindex` and `aria-colindex` for rendered cells.

### Phase 2: Focus Model Unification

- Decide whether the app stage uses roving cell focus or container focus plus `aria-activedescendant`.
- Wire `createDataGridA11yStateMachine` or document why stage-native selection state is canonical.
- Ensure only expected elements are tabbable in normal browsing mode.
- Define editor focus takeover and focus restoration rules.

### Phase 3: Virtualization And Pinned Panes

- Use stable cell ids across remounts.
- Preserve active descendant across scroll-out/scroll-in.
- Define reading order for left/center/right pinned panes and pinned-bottom rows.
- Ensure placeholder/loading rows expose loading/error state.

### Phase 4: Interaction Announcements

- Add one grid-level polite live region.
- Announce selection changes, copy/paste/cut outcomes, edit commit/cancel/failure, fill/range move outcomes, sort/filter changes, and server loading/errors.
- Throttle high-frequency scroll/selection announcements.

### Phase 5: Grouped/Tree Semantics

- Define grouped row semantics under `grid` or migrate grouped mode to `treegrid`.
- Add `aria-expanded` for expandable groups.
- Add row level/position metadata if treegrid semantics are selected.
- Cover server-backed placeholders inside grouped/tree projections.

### Phase 6: Validation And Gates

- Add component tests for ARIA attributes.
- Add Playwright accessibility tree assertions for rendered grid, pinned panes, editors, and grouped rows.
- Add axe checks for static violations.
- Add manual screen-reader smoke checklist for NVDA/Firefox, JAWS/Chrome, and VoiceOver/Safari.
- Add large-grid scroll benchmark with a11y attributes enabled.

## Recommended Tests

Unit tests:

- headless state machine focus after resize, empty grids, active descendant, and keyboard sequences
- a11y attribute adapter mapping for grid and cells
- stable cell/header id generation for row ids and column keys with special characters
- row/column aria index calculations with row index column, pinned columns, and virtual row offsets

Component tests:

- rendered body has `role="grid"`, counts, active descendant, and stable label
- rendered rows/cells have row/cell roles and absolute aria indexes
- header cells have `role="columnheader"` and `aria-sort`
- only the expected active cell or grid container is tabbable
- checkbox cells and row-selection header expose checked/mixed state
- editor inputs are labelled by row/column context
- placeholder rows expose loading/error state

Playwright/e2e tests:

- keyboard-only navigate, edit, commit, cancel, copy, paste, undo, redo
- scroll active cell out and back in; active descendant/focus remains stable
- pinned left/right panes preserve logical indexes and reading order
- grouped rows announce expanded/collapsed state
- server-backed loading rows do not blank the accessibility tree
- touch/coarse-pointer mode still exposes non-drag alternatives

Performance/a11y gates:

- axe smoke check on default grid, grouped grid, server-backed grid, and editing state
- accessibility tree snapshot for first viewport before and after scroll
- scroll benchmark with ARIA attributes enabled and no large layout regression

## Recommended Telemetry

- current active cell row/column and whether its DOM node is mounted
- active descendant id and whether it resolves to a rendered element
- number of tabbable grid descendants
- rendered cell count with ARIA attributes
- live region event count and throttle drops
- placeholder/loading rows currently visible
- focus restore success/failure count
- time to update accessibility attributes during scroll

## Prioritized Implementation Slices

1. **Wire stage-level grid roles and counts**
   - Files: `DataGridTableStageCenterPane.vue`, `DataGridTableStagePinnedPane.vue`, `DataGridTableStageHeader.vue`, stage render APIs
   - Tests: component assertions for roles/counts/indexes
   - Risk: medium

2. **Unify focus and active descendant**
   - Files: `useDataGridStageFocusRuntime.ts`, `useDataGridTableStageViewportKeyboard.ts`, `useDataGridAppActiveCellViewport.ts`, a11y helpers
   - Tests: focus continuity across virtualization remount
   - Risk: high

3. **Add stable ids and aria indexes**
   - Files: `useDataGridA11yCellIds`, stage cell/header rendering
   - Tests: pinned/virtualized row index mapping
   - Risk: medium

4. **Add live-region announcements**
   - Files: stage runtime, default renderer/status UI, clipboard/edit/fill/history integrations
   - Tests: action messages update live region once per command
   - Risk: medium

5. **Define grouped/tree and pinned-pane semantics**
   - Files: docs first, then grouped stage render APIs
   - Tests: group expand/collapse ARIA state
   - Risk: high

6. **Add browser a11y validation**
   - Files: Playwright/e2e and component test harness
   - Tests: axe/a11y tree smoke checks
   - Risk: low

## Risks And Migration Notes

- Adding `role="grid"` and ARIA indexes changes the accessibility tree but should not change public TypeScript APIs.
- Changing from roving DOM focus to `aria-activedescendant` would be behaviorally significant for focus tests and custom renderers; propose the focus model before implementation.
- Header and group semantics must stay aligned with virtualization and pinned panes, otherwise screen readers may announce duplicated or out-of-order cells.
- Live-region messages need throttling to avoid noisy announcements during drag selection, fill preview, and fast scroll.
- Custom renderers should keep interactive semantics explicit through existing interaction metadata instead of embedding uncontrolled focusable children without labels.
