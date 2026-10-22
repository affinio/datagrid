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
- `packages/datagrid-vue/src/app-layer/__tests__/DataGrid.contract.spec.ts`
- `e2e/sandbox-grid.spec.ts` (`column flex resize does not move the pinned pane boundary or overflow the sandbox route`)

## Symptom: Horizontal virtualization not deterministic

Checks:
- Confirm clamp logic is served only by `dataGridViewportHorizontalClamp.ts`.
- Confirm prepare/update path does not mutate input metadata.

Relevant tests:
- `packages/datagrid-core/src/viewport/__tests__/horizontalClamp.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalUpdate.contract.spec.ts`
- `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts`

## Symptom: A short pause on the first scroll

Checks:
- Separate cold page initialization from scroll work; compare the first and subsequent scrolls with the same viewport and CPU settings.
- Synchronous authored cell/group renderer resolution does not subscribe to deferred-renderer queue revisions. Scroll start therefore avoids an extra queue-driven invalidation; pane updates for hover, sticky rows, or other state can still render cells.
- Only the opt-in `rendererPolicy.mode: "defer"` path invalidates queue consumers on scroll start and schedules renderer release at idle. Viewport changes, editing, selection, and row data retain their existing update paths.
- The viewport DOM adapter owns the `grid-stage--scrolling` class, including restoration after Vue patches other root classes. Keep that CSS-only state out of the stage template's reactive class binding.
- This removes one source of cold-scroll work; a browser trace is still needed for intermittent pauses caused by layout, initial data work, or other render dependencies.

Relevant regression:
- `packages/datagrid-vue/src/app-layer/stage/__tests__/useDataGridStageCellRendering.spec.ts` (default/synchronous renderer effects stay unchanged across scroll start and idle; deferred rendering still resumes at idle).
- [First-scroll diagnostic and reproduction](./perf/datagrid-first-scroll.md).

## Symptom: Worker grid stalls or loses viewport coverage on long scrolls

Checks:
- Sparse worker row models only have a bounded set of loaded row windows. A viewport-only range update must not trigger a scan across `rowCount` to relocate a cell-selection anchor.
- Reconcile stable cell anchors when the logical projection changes. For a same-projection update, retry only an anchor already pending materialization or a recognized placeholder anchor.
- Reading a range already covered by the worker cache must not publish a row-model change; the viewport controller owns range updates explicitly.

Relevant regressions:
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppSelection.contract.spec.ts` (sparse viewport updates do not scan rows; placeholder anchors still rebind).
- `packages/datagrid-worker/src/__tests__/workerOwnedRowModel.spec.ts` (cached subrange reads do not publish an update).
- `e2e/sandbox-grid.spec.ts` (`vue worker grid keeps viewport covered across long scroll jumps`, `stays covered during a rapid scroll burst`, and `reaches the last logical row beyond native scroll height`).

## Symptom: Header drifts from body near the end of horizontal scrolling

Checks:
- Compare the center header scrollport width with the body's measured horizontal viewport width. Classic vertical scrollbars can reduce the body width while leaving the header's natural grid width unchanged.
- The app stage synchronizes the header scrollport width from the body viewport during its existing resize/metric sync path.
- Header ref rebinding must preserve scroll position through Vue rerenders. After width synchronization, the header immediately receives the body's current offset again.
- Body horizontal movement mirrors directly to the header and both pinned row viewports; peer-originated scrolling propagates the offset actually accepted by the body, including boundary clamping. Reactive state and chrome redraw stay frame-batched.
- Keyboard movement between center headers reveals the focused column by scrolling the body horizontal owner. Header focus uses `preventScroll` so the browser cannot move the header independently of the body.
- Group header labels read the mirrored header scroll offset directly from its browser scroll event; pane widths remain measured through the resize observer. This avoids adding a second animation-frame delay before a clipped group label appears at its visible edge.

Relevant test:
- `packages/datagrid-vue/src/app-layer/stage/__tests__/useDataGridStageChromeCanvas.spec.ts`
- `packages/datagrid-vue/src/app-layer/stage/__tests__/useDataGridStageViewportRuntime.spec.ts`
- `packages/datagrid-vue/src/app-layer/__tests__/DataGridTableStage.contract.spec.ts`
- `e2e/sandbox-interactions.spec.ts` (`keyboard navigation across virtualized headers scrolls without focus retry churn`)

## Symptom: The final header column has no right divider

Checks:
- In canvas-chrome mode, header cell `border-right` is suppressed and the canvas owns column dividers.
- Interior dividers remain at cell boundaries; the outer edge is drawn only when a modeled boundary reaches the rightmost pane edge. Do not draw edges on clipped center columns or internal pane seams.
- Pivot/group headers still render their internal dividers through CSS; canvas paints only the outer right edge.

Relevant test:
- `packages/datagrid-vue/src/app-layer/stage/__tests__/useDataGridStageChromeCanvas.spec.ts`

## Symptom: The grid frame disappears at rounded corners or outside content shows through

Checks:
- `.grid-stage` is the single owner of the surface background, border, radius, and clipping. Keep the border on the stage itself so child panes cannot paint over it.
- Keep the app layout host transparent; avoid adding a second rounded clipping shell around the grid.
- Integrated stages intentionally remove their border and radius when they join another surface. Gantt table stages keep only the outer left frame at the table/timeline seam.

Relevant test:
- `packages/datagrid-vue/src/app-layer/__tests__/ensureDataGridAppStyles.contract.spec.ts`

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

## Symptom: A cell selection anchor disappears after a row projection change

Checks:
- Single-cell anchors follow the stable row ID when the row is temporarily removed from the displayed projection, such as during a tree collapse.
- While that row is absent, do not draw its old positional highlight over the row that now occupies the same index.
- When the row returns, reconcile the anchor to its current projection index and refresh the Core selection snapshot.
- Rebind IDs only for recognized loading or visual placeholder rows that materialize in place; ordinary filtered or collapsed rows must not be rebound to a different record.

Relevant regressions:
- `e2e/sandbox-tree-pivot.spec.ts` (`tree group anchor survives collapse and expand roundtrip`)
- `e2e/sandbox-interactions.spec.ts` (`placeholder tail materialization keeps selection anchor and fill handle`)

## Symptom: Inline edits on visual placeholder rows are rejected as conflicts

Checks:
- Edit conflict detection compares the source value resolved for the row patch target.
- Materializing a visual placeholder changes its synthetic row ID to the newly created data row ID; this is part of the edit operation and must not be treated as an external update.
- Ordinary edit sessions still reject a commit when the source value changed after the editor opened.

Relevant regressions:
- `packages/datagrid-vue/src/app-layer/__tests__/DataGrid.contract.spec.ts` (placeholder edit, materialization, and undo contracts).
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppInlineEditing.contract.spec.ts` (source-value conflict detection).

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
