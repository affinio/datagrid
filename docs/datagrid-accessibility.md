# DataGrid Accessibility

Updated: `2026-05-20`

This document is the current-state accessibility contract for the Affino DataGrid packages. It records implemented behavior, known gaps, and the validation expected for future enterprise accessibility slices.

## Ownership

- `packages/datagrid-core/src/a11y/headlessA11yStateMachine.ts` owns deterministic headless focus, keyboard, and ARIA state.
- `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts` maps headless grid/cell ARIA state to DOM-ready attributes.
- `packages/datagrid-orchestration/src/accessibility/useDataGridA11yCellIds.ts` owns stable cell/header id and one-based ARIA index helpers.
- `packages/datagrid-vue-app/src/stage/*` owns the mounted virtualized stage, pinned panes, row index cells, editors, overlays, and focus restoration.
- `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts` owns app-level status regions rendered around the stage.

## Implemented Stage Contract

The mounted table stage currently exposes baseline ARIA metadata for the virtualized body:

- the center body viewport exposes `role="grid"`, `aria-rowcount`, `aria-colcount`, and `aria-multiselectable="true"`;
- rendered body rows expose `role="row"` and one-based `aria-rowindex`;
- rendered center body cells expose one-based `aria-rowindex` and `aria-colindex`;
- rendered pinned body cells use the same row indexes and logical column indexes as the center pane;
- normal body cells expose `role="gridcell"` unless an interactive role such as `checkbox` or `rowheader` overrides it;
- rendered selected cells expose deterministic `aria-selected` state after virtualized unmount/remount;
- leaf header cells expose `role="columnheader"`, one-based `aria-colindex`, sortable-column `aria-sort`, and contextual accessible names;
- header resize and text-filter controls include the target column in their accessible names;
- normal-mode keyboard tabbing exposes one stage owner: focused row index first, visible selection anchor cell second, and body viewport fallback only when no visible focus target exists;
- row-selection checkbox cells expose `role="checkbox"` and `aria-checked`;
- placeholder cells that cannot materialize into editable rows expose disabled state while preserving their row/column coordinates;
- decorative canvas chrome, selection overlays, fill overlays, and move overlays are hidden from assistive technologies;
- app status regions use polite live-region semantics for supported high-level messages.

This stage contract is covered by component tests in `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts` and mounted-grid coverage in `e2e/sandbox-interactions.spec.ts`.

## Focus Model

The app stage currently uses stage-native DOM focus restoration and selection snapshot state as the mounted-grid owner. Normal browsing mode uses one tabbable stage target: focused row index, visible selection anchor cell, or body viewport fallback. The headless a11y state machine supports roving tabindex and `aria-activedescendant`, but the mounted stage has not yet adopted container focus plus active descendant as its canonical browser contract.

Until active-descendant integration is implemented:

- do not claim that app-stage `aria-activedescendant` is complete;
- preserve existing keyboard navigation, editor focus takeover, and focus restoration behavior;
- avoid adding additional tabbable descendants in body cells unless the interaction metadata explicitly requires it;
- treat any change to normal-mode tab stops as browser-visible behavior requiring component and Playwright validation.

## Known Gaps

- Pivot header group semantics and deeper menu relationship metadata still need browser-level validation.
- Stable cell ids and active-cell semantics need to be finalized for virtualization remounts and pinned panes.
- Grouped/tree projections need a documented `grid` versus `treegrid` policy, expansion state, and row hierarchy metadata.
- Datasource loading/error placeholders need stronger screen-reader context and throttled announcements.
- Editor inputs and custom interactive cells need consistent row/column contextual labels.
- Live-region coverage needs to include clipboard, fill, edit, history, sort/filter, and server outcomes consistently.
- Browser accessibility tree, axe-style smoke checks, and large-grid a11y performance gates are not yet release-level gates.

## Validation Expectations

Runtime accessibility slices should include the smallest relevant validation first:

- component tests for rendered ARIA roles, counts, indexes, labels, focus ownership, and state;
- Playwright tests for browser-mounted behavior across scroll, virtualization remount, pinned panes, editing, grouped rows, and datasource placeholders;
- performance validation for large-grid scroll paths when adding ARIA state to hot render surfaces;
- manual screen-reader smoke testing before claiming WCAG conformance or enterprise screen-reader readiness.

Do not document WCAG conformance until browser and assistive-technology validation exists for the mounted app stage.
