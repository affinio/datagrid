# @affino/datagrid-vue

Vue adapter package for `@affino/datagrid-core`.

## Stable Public API

Import only from the package root:

```ts
import {
  useTableSettingsStore,
  createPiniaTableSettingsAdapter,
} from "@affino/datagrid-vue"
```

Current stable contract is focused on settings persistence bridge.
Component-level exports are intentionally held back until adapter hardening steps are closed.

## Naming Migration

Core component files now use the `DataGrid*` prefix (`DataGrid.vue`, `DataGridViewport.vue`, `DataGridOverlayLayer.vue`).
Legacy `UiTable*` files are kept as compatibility shims during migration.

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
`/Users/anton/Projects/affinio/docs/datagrid-engine-9.5-pipeline-checklist.md`.
