# DataGrid Accessibility Enterprise Audit

## Executive Summary

DataGrid has useful accessibility foundations, but the rendered enterprise grid is **not yet enterprise-grade for screen reader users**.

Update `2026-05-20`: this audit predates several implemented stage accessibility slices. The current `datagrid-vue-app` stage now exposes baseline virtualized grid semantics for the body viewport: `role="grid"`, logical row/column counts, row roles, body/pinned cell `gridcell` fallback, one-based row/column indexes, deterministic rendered selection state, placeholder disabled state, and app status live regions. The implemented current-state contract is tracked in `docs/datagrid-accessibility.md` and `docs/datagrid-headless-a11y-contract.md`.

The strongest current pieces are keyboard navigation, focus restoration helpers, baseline virtualized body ARIA metadata, leaf header/sort semantics, stable mounted cell/header ids, row-selection checkbox semantics, grouped row expansion context, placeholder row disabled/context metadata, a stage-native normal-mode tab-stop invariant, interactive cell labels, contextual inline editor labels, editor keyboard handling, documented grid status live-region coverage, browser-level mounted-grid a11y gates, large-grid A11Y browser performance diagnostics, and a deterministic headless a11y state machine in core. The biggest remaining gap is integration depth: the main virtualized `datagrid-vue-app` stage intentionally keeps roving DOM focus instead of app-stage `aria-activedescendant`, and still needs manual assistive-technology validation.

Current enterprise accessibility readiness: **5.5/10**.

Target: **9/10** after wiring the existing headless contract into the virtualized stage, defining deeper pinned/tree semantics, and completing manual assistive-technology validation.

## Current Architecture Summary

- `packages/datagrid-core/src/a11y/headlessA11yStateMachine.ts` owns a deterministic headless accessibility state machine for focus, keyboard commands, roving tabindex, and ARIA state.
- `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts` maps headless grid/cell ARIA state to DOM-ready attributes.
- `packages/datagrid-orchestration/src/accessibility/useDataGridA11yCellIds.ts` builds stable cell/header ids and 1-based ARIA row/column indexes.
- `packages/datagrid-vue-app/src/stage/*` owns the rendered DataGrid stage, virtualized rows/cells, baseline body ARIA roles/counts/indexes, pinned panes, editors, overlays, keyboard routing, and focus restoration.
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
- **Inline editor keyboard semantics and contextual labels exist.** Escape cancels, Enter commits, Tab/Shift+Tab commits and moves to the next editable target. Text, date/datetime, and select editors expose row/column context in their accessible names.
- **Combobox editor follows a recognizable ARIA shape.** The input uses `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete`, and `aria-activedescendant`; options use `role="option"` and `aria-selected`.
- **Interactive cells can expose semantics.** Cell interactions can provide role, label, pressed/checked/disabled state; checkbox cells render `role="checkbox"` and `aria-checked`.
- **Decorative chrome is hidden.** Canvas chrome and visual selection/fill/move overlays use `aria-hidden="true"`.

## Findings By Severity

### Blocker

None after the 2026-05-20 rebaseline and stage slices. The mounted stage now has body/header roles, stable indexes, one normal-mode tab stop, and deterministic mounted cell/header ids. The remaining risks are high-priority completeness and validation gaps, not known blockers.

### High

1. **Two accessibility architectures exist but are not unified.**
   - Evidence: `docs/datagrid-headless-a11y-contract.md` documents headless state machine guarantees. The app stage uses selection snapshot, DOM focus helpers, and interaction-controller keyboard routing instead.
   - Impact: future fixes can improve the headless API without improving the real rendered DataGrid unless docs and tests stay explicit about the current mounted-stage owner.
   - Required: keep the current roving DOM focus decision documented, and only migrate to `aria-activedescendant` through a dedicated focus-model proposal with browser validation.

2. **Treegrid hierarchy semantics remain a future contract.**
   - Evidence: grouped rows now stay under the mounted `grid` model and expose `aria-expanded` plus group label context. The stage does not expose tree-only metadata such as `aria-level`, `aria-posinset`, or `aria-setsize`.
   - Impact: grouped rows have basic expansion semantics, but deep tree hierarchy is not yet predictable enough to claim treegrid support.
   - Required: keep grouped mode under `grid` until a future treegrid proposal defines hierarchy metadata and browser validation.

3. **Pinned panes still need manual screen-reader validation.**
   - Evidence: browser `@a11y` tests now verify mounted grid roles, indexes, ids, and pinned-pane ARIA coordinates, but left, center, right, and pinned-bottom panes still render separate DOM trees.
   - Impact: automated coverage protects ARIA contracts, but assistive-tech reading order needs manual validation before an enterprise readiness claim.
   - Required: run manual screen-reader smoke checks and keep browser tests guarding pinned-pane indexes/ids.

### Medium

1. **Placeholder/loading rows still need row-local context.**
   - Evidence: row-model loading/error outcomes now update the polite grid status region, but individual datasource placeholder rows still need richer per-row loading/error context.
   - Impact: server-backed loading is announced at the grid level, but row-local placeholder semantics can still be unclear.
   - Required: expose loading/error placeholder state through row/cell labels without adding per-cell live updates.

2. **Touch accessibility is not defined beyond native-scroll protection.**
   - Evidence: touch handling preserves native scroll and supports long-press/context behavior, but no touch-specific accessibility contract for selection handles, fill handles, row resize, or context actions was found.
   - Impact: touch screen-reader and switch-control workflows are incomplete.
   - Required: define non-hover affordances, target sizes, labels, and alternatives for drag-only actions.

3. **Selection state announcements remain incomplete.**
   - Evidence: visual classes and overlays represent selection, and stage body cells now expose deterministic `aria-selected` for rendered selected/unselected cells. Checkbox row selection exposes checked state.
   - Impact: active-cell changes, multi-range summaries, fill preview, and range move state are still not predictably announced as higher-level changes.
   - Required: expose active cell and selection summary through ARIA and live-region messages without adding per-cell heavy DOM churn.

### Low

1. **Decorative overlays are correctly hidden, but semantic equivalents are missing.**
   - Evidence: selection/fill/move overlays are `aria-hidden="true"`.
   - Impact: good for avoiding duplicate noise, but users need non-visual state announcements.

2. **Headless and mounted-stage accessibility docs now need to stay in sync.**
   - Evidence: `docs/datagrid-headless-a11y-contract.md` documents headless adapter behavior while `docs/datagrid-accessibility.md` documents mounted-stage current state.
   - Impact: future runtime slices can accidentally update one contract but leave the other stale.
   - Required: update both docs when a slice changes focus, ARIA mapping, ids, status regions, or mounted-stage semantics.

## WCAG Alignment

Current likely alignment:

- **Keyboard access:** partial to strong for grid navigation and shortcuts.
- **Focus visible:** mostly covered through visual focus/selection classes, direct focus calls, and browser `@a11y` smoke gates.
- **Name, role, value:** partial for the main grid because baseline body roles/counts/indexes, leaf header semantics, group expansion state, placeholder disabled/context metadata, and inline editor labels are implemented, but pinned-pane ownership still needs browser validation; stronger for checkbox cells, column menu buttons, comboboxes, and some interactive renderers.
- **Status messages:** partial to strong; app status regions use polite live-region semantics for clipboard, edit, fill, range move, history, sort/filter, and row-model loading/error outcomes, but browser and screen-reader validation is still required.
- **Pointer/touch alternatives:** partial; keyboard alternatives exist for many actions, but resize/fill/range move/touch workflows need explicit accessible alternatives.

Do not claim WCAG conformance until the rendered stage has automated and manual assistive-tech validation.

## Virtualized DOM Accessibility

The current virtualized DOM is visually and interactively strong. Assistive tech still needs a more complete logical grid abstraction over a partial DOM:

- validated pivot/header-group semantics
- stable cell/header ids
- active descendant or a single roving DOM focus target
- clear loading/error placeholder semantics
- a logical reading order across pinned panes and pinned bottom rows

The code already has helpers for most of these pieces, and baseline body roles/counts/indexes are now integrated. The remaining work is focus/header/group/pinned integration and validation.

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
- keep `pnpm run bench:datagrid:enterprise:a11y:browser:assert` in release validation for scroll with a11y attributes enabled

## Enterprise Readiness Score

Current score: **5.5/10**

Target score: **9/10**

What blocks the target:

- rendered stage lacks complete pinned-pane reading-order validation and future treegrid hierarchy semantics
- headless a11y state machine is not integrated into the main app stage
- app-stage `aria-activedescendant` is intentionally absent under the current roving-focus model
- pinned-pane reading order and future treegrid hierarchy semantics are not manually screen-reader validated
- no documented manual screen-reader smoke plan
- manual assistive-technology smoke validation is not documented or executed

## Recommended Roadmap

### Phase 1: Rendered Grid Semantics

- Baseline body `role="grid"`, row/cell roles, row/column counts, and row/column indexes are implemented.
- Leaf header `role="columnheader"`, `aria-colindex`, `aria-sort`, and contextual resize/filter labels are implemented.
- Add a stable labelled name for the grid where hosts do not provide one.
- Add pivot/header-group and pinned-pane reading-order validation where missing.

### Phase 2: Focus Model Unification

- The app stage now enforces one normal-mode tab stop: focused row index, visible selection anchor cell, then viewport fallback.
- Decide whether the app stage keeps stage-native roving focus or migrates to container focus plus `aria-activedescendant`.
- Wire `createDataGridA11yStateMachine` or document why stage-native selection state is canonical.
- Define editor focus takeover and focus restoration rules.

### Phase 3: Virtualization And Pinned Panes

- Stable body/header ids are implemented across remounts.
- Preserve roving focus and mounted cell id resolution across scroll-out/scroll-in.
- Define reading order for left/center/right pinned panes and pinned-bottom rows.
- Ensure placeholder/loading rows expose loading/error state.

### Phase 4: Interaction Announcements

- Add one grid-level polite live region.
- Announce selection changes, copy/paste/cut outcomes, edit commit/cancel/failure, fill/range move outcomes, sort/filter changes, and server loading/errors.
- Throttle high-frequency scroll/selection announcements.

### Phase 5: Grouped/Tree Semantics

- Current grouped rows stay under `role="grid"` and expose expansion plus label context.
- Add row level/position metadata only if a future slice migrates grouped/tree mode to `treegrid`.
- Cover server-backed placeholders inside grouped/tree projections.

### Phase 6: Validation And Gates

- Add component tests for ARIA attributes.
- Add Playwright accessibility tree assertions for rendered grid, pinned panes, editors, and grouped rows.
- Add axe checks for static violations.
- Add manual screen-reader smoke checklist for NVDA/Firefox, JAWS/Chrome, and VoiceOver/Safari.
- Keep the large-grid A11Y browser benchmark in release validation.

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
- `bench:datagrid:enterprise:a11y:browser:assert` for ARIA-heavy large-grid scroll with tab-stop/id-resolution budgets

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

1. **Rebaseline accessibility contract and plan**
   - Files: `docs/datagrid-accessibility.md`, `docs/plans/A11Y_ENTERPRISE_PLAN.md`, this audit
   - Tests: docs validation
   - Risk: low

2. **Add header and sort semantics** (completed 2026-05-20)
   - Files: `DataGridTableStageHeader.vue`, default renderer/header render APIs
   - Tests: component assertions for `columnheader`, column indexes, sort state, menu labels
   - Risk: medium

3. **Unify normal-mode focus ownership** (completed 2026-05-20)
   - Files: `DataGridTableStage.vue`, `DataGridTableStageCenterPane.vue`, stage focus tests
   - Tests: normal-mode tab-stop priority across viewport, cells, and row index
   - Risk: high

4. **Add stable ids and active-cell ARIA** (completed 2026-05-20)
   - Files: `DataGridTableStage.vue`, `DataGridTableStageCenterPane.vue`, `DataGridTableStagePinnedPane.vue`, `DataGridTableStageHeader.vue`, `dataGridTableStageA11y.ts`
   - Tests: sanitized header/body ids across pinned panes and virtualized remount; `aria-activedescendant` remains absent under roving focus
   - Risk: high

5. **Define grouped/tree and pinned-pane semantics** (completed 2026-05-20)
   - Files: `DataGridTableStage.vue`, center/pinned pane templates, shared render APIs, docs
   - Tests: group expand/collapse ARIA state and placeholder row disabled/context metadata
   - Risk: high

6. **Add editor and interactive-cell labels** (completed 2026-05-20)
   - Files: stage render APIs, editor overlays, interaction metadata
   - Tests: accessible names/state for editors and custom interactive cells
   - Risk: medium

7. **Add live-region announcements** (completed 2026-05-20)
   - Files: stage runtime, default renderer/status UI, clipboard/edit/fill/history integrations
   - Tests: action messages update live region once per command
   - Risk: medium

8. **Add browser a11y validation** (completed 2026-05-20)
   - Files: Playwright/e2e and component test harness
   - Tests: axe/a11y tree smoke checks
   - Risk: low

9. **Add large-grid a11y performance gate** (completed 2026-05-20)
   - Files: browser benchmark scripts, perf docs, package scripts
   - Tests: large-grid scroll and tab-stop/id-resolution budget
   - Risk: medium

## Risks And Migration Notes

- Adding `role="grid"` and ARIA indexes changes the accessibility tree but should not change public TypeScript APIs.
- Changing from roving DOM focus to `aria-activedescendant` would be behaviorally significant for focus tests and custom renderers; propose the focus model before implementation.
- Header and group semantics must stay aligned with virtualization and pinned panes, otherwise screen readers may announce duplicated or out-of-order cells.
- Live-region messages need throttling to avoid noisy announcements during drag selection, fill preview, and fast scroll.
- Custom renderers should keep interactive semantics explicit through existing interaction metadata instead of embedding uncontrolled focusable children without labels.
