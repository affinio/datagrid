# DataGrid Troubleshooting Runbook

Status: maintained public documentation.
Scope: overlay, pinned columns, virtualization, selection sync

## Incident Triage Order

1. Reproduce with deterministic dataset and stable viewport size.
2. Identify failing invariant (transform owner, pin canonical state, coordinate space, clamp determinism).
3. Run focused contract tests.
4. Validate quality gates and performance harness.

## Symptom: Overlay drifts from cells while scrolling

Checks:
- Verify there is no duplicate transform owner in adapter layer.
- Verify sync targets are explicit refs, not DOM fallback queries.

Relevant tests:
- `packages/datagrid-core/src/viewport/__tests__/scrollSync.transforms.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/syncTargets.contract.spec.ts`

## Symptom: Pinned columns overlap or jump during scroll/resize

Checks:
- Confirm runtime receives canonical `pin` only.
- Confirm host column pin fields are normalized to canonical `pin` before reaching core.

Relevant tests:
- `packages/datagrid-core/src/columns/__tests__/pinning.spec.ts`
- `packages/datagrid-vue/src/adapters/__tests__/columnPinNormalization.spec.ts`

## Symptom: Center pane shifts while resizing columns beside pinned flex columns

Checks:
- Flex fill applies only to visible center columns. A pinned column has no remaining viewport to absorb, so it keeps its authored or user-resized width.
- Resizing a center column must not change pinned pane width or the center pane's left boundary.
- Center flex columns continue to absorb the remaining center viewport width after pinned panes and fixed center columns are accounted for.

Relevant regression:
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppViewport.contract.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `e2e/sandbox-grid.spec.ts` (`column flex resize does not move the pinned pane boundary or overflow the sandbox route`)

## Symptom: Horizontal virtualization not deterministic

Checks:
- Confirm clamp logic is served only by `dataGridViewportHorizontalClamp.ts`.
- Confirm prepare/update path does not mutate input metadata.

Relevant tests:
- `packages/datagrid-core/src/viewport/__tests__/horizontalClamp.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalUpdate.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts`

## Symptom: Header drifts from body near the end of horizontal scrolling

Checks:
- Compare the center header scrollport width with the body's measured horizontal viewport width. Classic vertical scrollbars can reduce the body width while leaving the header's natural grid width unchanged.
- The app stage synchronizes the header scrollport width from the body viewport during its existing resize/metric sync path.
- Header ref rebinding must preserve scroll position through Vue rerenders. After width synchronization, the header immediately receives the body's current offset again.
- Body horizontal movement mirrors directly to the header and both pinned row viewports; peer-originated scrolling propagates the offset actually accepted by the body, including boundary clamping. Reactive state and chrome redraw stay frame-batched.
- Keyboard movement between center headers reveals the focused column by scrolling the body horizontal owner. Header focus uses `preventScroll` so the browser cannot move the header independently of the body.
- Group header labels read the mirrored header scroll offset directly from its browser scroll event; pane widths remain measured through the resize observer. This avoids adding a second animation-frame delay before a clipped group label appears at its visible edge.

Relevant test:
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageChromeCanvas.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageViewportRuntime.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
- `e2e/sandbox-interactions.spec.ts` (`keyboard navigation across virtualized headers scrolls without focus retry churn`)

## Symptom: The final header column has no right divider

Checks:
- In canvas-chrome mode, header cell `border-right` is suppressed and the canvas owns column dividers.
- Interior dividers remain at cell boundaries; the outer edge is drawn only when a modeled boundary reaches the rightmost pane edge. Do not draw edges on clipped center columns or internal pane seams.
- Pivot/group headers still render their internal dividers through CSS; canvas paints only the outer right edge.

Relevant test:
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageChromeCanvas.spec.ts`

## Symptom: Pinned canvas chrome keeps the previous theme

Checks:
- The default theme observes `data-theme` and the configured dark-mode class on `document.documentElement`; custom themes update through the `theme` prop.
- Successful changes to the resolved theme tokens invalidate the cached canvas palette and schedule one full chrome redraw. A full redraw covers pinned header/body panes and pinned-bottom chrome; pinned-top rows use DOM rendering and inherit the updated CSS variables.
- Direct live CSS variable changes from unrelated classes, inline styles, or stylesheet replacement do not trigger canvas invalidation. Use the `theme` prop or the observed document attributes for reactive switching.
- Equal resolved tokens do not schedule a redraw, including document changes under a non-inheriting explicit theme.

Relevant browser regression:
- `e2e/sandbox-grid.spec.ts` (`document and reactive theme changes repaint canvas chrome for every mounted grid`, `document theme changes repaint pinned-bottom canvas chrome`)

## Symptom: Fill handle and selection rectangles are desynced

Checks:
- Confirm world/viewport/client coordinate conversions use canonical helpers.
- Confirm overlay updates are split by dirty signatures, not full rebuilds.

Relevant tests:
- `packages/datagrid-core/src/selection/__tests__/coordinateSpace.contract.spec.ts`
- `packages/datagrid-core/src/selection/__tests__/overlay.fill.geometry.contract.spec.ts`

## Symptom: Selection controller behaves differently after remount

Checks:
- Verify lifecycle calls order: `init` -> repeated `sync` -> `teardown`.
- Verify no stale refs remain after unmount.

Relevant tests:
- `packages/datagrid-vue/src/adapters/__tests__/selectionControllerAdapter.contract.spec.ts`
- `packages/datagrid-vue/src/composables/selection/__tests__/selectionDecomposition.integration.spec.ts`

## Standard Validation Commands

- `pnpm run test:matrix:unit`
- `pnpm run test:matrix:integration`
- `pnpm run quality:gates:datagrid`
- `pnpm run bench:datagrid:harness:ci`

## Escalation Criteria

Escalate as release blocker if any apply:
- Overlay/cell mismatch reproducible in deterministic scenario.
- Pinned columns produce wrong hit target or visual overlap.
- Horizontal virtualization fails stress contract.
- Performance harness breaks fail-fast budgets.

## Recovery Actions

- Roll back to last green commit where quality and performance gates passed.
- Keep compatibility shims enabled during rollback window.
- Re-open incident with failing invariant and exact spec path.

### Row resize leaves dividers or selection at old offsets

Manual row height edits must invalidate the shared row-height metrics even when
the virtual row range and spacer sizes do not change. The app stage runtime tracks
a reactive height revision in the metrics version resolver and advances it from
the row-sizing synchronization callback. This updates dividers, selection, pinned
panes, and total content height during the drag. No public API change is required.

Regression: `row resize keeps dividers and selection aligned before pointer release`
in `e2e/sandbox-grid.spec.ts`; includes repeated edits, multiple rows, and shrinking.
