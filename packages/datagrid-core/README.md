# @affino/datagrid-core

Framework-agnostic data grid core.

## Stable Public API

Import only from the package root:

```ts
import {
  createInMemoryTableSettingsAdapter,
  type UiTableSettingsAdapter,
  type UiTableSortState,
  type UiTableFilterSnapshot,
} from "@affino/datagrid-core"
```

The root export is intentionally narrow while runtime internals are being hardened.

## Naming Migration

`DataGrid*` aliases are now available for key modules:
- settings adapter (`createInMemoryDataGridSettingsAdapter`)
- runtime (`createDataGridRuntime`)
- viewport controller (`createDataGridViewportController`)

Legacy `UiTable*` symbols remain available during migration.

## Pinning Contract (Canonical)

Runtime now treats only one pin state as canonical:
- `column.pin = "left" | "right" | "none"`
- `column.isSystem = true` is always resolved as left-pinned.

Legacy pin fields are adapter-only input compatibility and must be normalized before runtime:
- `pinned`, `sticky`, `stickyLeft`, `stickyRight`, `lock`, `locked`

### Migration Guide

Replace legacy fields in column definitions:
- `sticky: "left"` -> `pin: "left"`
- `sticky: "right"` -> `pin: "right"`
- `stickyLeft: true|number` -> `pin: "left"`
- `stickyRight: true|number` -> `pin: "right"`
- `pinned: true|"left"` -> `pin: "left"`
- `pinned: "right"` -> `pin: "right"`
- `lock: "left"|"right"` / `locked: true` -> `pin: "left"|"right"`

## Selection Geometry Spaces

Selection runtime uses one coordinate contract:
- `table/world` space: content coordinates before scroll transform.
- `viewport` space: visible coordinates after applying scroll.
- `client` space: DOM client coordinates (requires viewport origin for conversion).

Core helpers in `src/selection/coordinateSpace.ts` are the canonical conversion path used by overlay/fill/selection adapters.

## Horizontal Virtualization Contract

Horizontal virtualization now uses a deterministic clamp/update path:
- clamp calculation is centralized in `src/viewport/tableViewportHorizontalClamp.ts`
- prepare phase is pure (no mutation of input meta)
- stress coverage includes `100k` rows and `500+` columns with pinned left/right mix

## Build/Type Check

- `npm run build` - compile public contract to `dist`
- `npm run type-check` - check only public contract surface

## Roadmap

Execution and quality hardening are tracked in:
`/Users/anton/Projects/affinio/docs/datagrid-engine-9.5-pipeline-checklist.md`.
