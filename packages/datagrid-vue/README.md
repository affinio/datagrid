# @affino/datagrid-vue

Vue adapter package for `@affino/datagrid-core`.

## Stable Public API

Preferred import for common usage:

```ts
import {
  useDataGridSettingsStore,
  createDataGridSettingsAdapter,
  buildDataGridOverlayTransform,
  buildDataGridOverlayTransformFromSnapshot,
} from "@affino/datagrid-vue"
```

Equivalent explicit stable entrypoint:

```ts
import {
  useDataGridSettingsStore,
  createDataGridSettingsAdapter,
  buildDataGridOverlayTransform,
  buildDataGridOverlayTransformFromSnapshot,
} from "@affino/datagrid-vue/stable"
```

Current stable contract is focused on:
- settings persistence bridge
- deterministic overlay transform helpers for pinned/scroll sync

Legacy stable aliases (`useTableSettingsStore`, `createPiniaTableSettingsAdapter`) are no longer exported from root/stable surface.

## Advanced Entrypoint

Power-user hooks are exported only from explicit advanced entrypoint:

```ts
import {
  useDataGridViewportBridge,
  useDataGridHeaderOrchestration,
  useDataGridRowSelectionFacade,
  useDataGridFindReplaceFacade,
} from "@affino/datagrid-vue/advanced"
```

These hooks are intentionally excluded from root/stable entrypoint to keep common-usage API small and semver-safe.

## Deterministic Overlay Contract

Use public helpers instead of ad-hoc transform math in product integration:

```ts
const transform = buildDataGridOverlayTransformFromSnapshot({
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
  pinnedOffsetLeft,
  pinnedOffsetRight,
})
```

This keeps overlay transform behavior aligned with core viewport contracts.
Component-level exports are intentionally held back until adapter hardening steps are closed.

## Naming Migration

Core component files now use the `DataGrid*` prefix (`DataGrid.vue`, `DataGridViewport.vue`, `DataGridOverlayLayer.vue`).
Legacy `UiTable*` files are kept as compatibility shims during migration in `/src/components/legacy.ts`.
Deprecation window: supported through `2026-08-31`, scheduled removal on `2026-09-01`.

## Pinning Contract (Adapter Normalization)

Vue adapter now normalizes all legacy pin inputs into a canonical runtime state:
- canonical: `column.pin = "left" | "right" | "none"`
- system columns are normalized to `pin: "left"`

Legacy inputs are accepted only as migration compatibility at adapter boundary:
- `pinned`, `sticky`, `stickyLeft`, `stickyRight`, `lock`, `locked`

After normalization these legacy fields are removed from local runtime column models.

## Selection Space Contract

Vue adapter follows core selection coordinate spaces:
- table/world space for stored overlay/fill coordinates
- viewport space for visible placement math
- client space only at DOM boundary (converted via core helpers)

## Selection Engine Decomposition

`useTableSelection` now delegates critical responsibilities to focused modules:
- `src/composables/selection/selectionStateSync.ts` - state bridge/reconcile between headless controller and Vue shared state.
- `src/composables/selection/selectionInput.ts` - DOM pointer input normalization.
- `src/composables/selection/selectionGeometry.ts` - deterministic selection geometry/signature helpers.
- `src/composables/selection/selectionControllerStateScheduler.ts` - controller state flush policy.
- `src/composables/selection/selectionOverlayUpdateScheduler.ts` - render-sync scheduling policy for overlay updates.

This keeps scheduler policy separate from selection business logic and reduces duplicated lifecycle update paths in watchers.

## Adapter Contract (Headless + Vue Bridge)

Selection adapter now follows a strict lifecycle API:
- `init()` - initialize headless controller bridge.
- `sync(...)` - apply state/overlay/autoscroll updates through one adapter entry point.
- `teardown()` - release controller resources deterministically.
- `diagnostics()` - read adapter lifecycle counters and state.

Implementation split:
- Headless layer: `src/adapters/selectionHeadlessAdapter.ts` (framework-agnostic lifecycle/control surface).
- Vue bridge layer: `src/adapters/selectionControllerAdapter.ts` (Vue refs/scope integration for SFC/composables).

## Build/Type Check

- `npm run build` - compile public contract to `dist`
- `npm run type-check` - check only public contract surface

## Roadmap

Execution and quality hardening are tracked in:
`/Users/anton/Projects/affinio/docs/datagrid-ag-architecture-9.5-pipeline-checklist.md`.
