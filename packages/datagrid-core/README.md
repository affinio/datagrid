# @affino/datagrid-core

Framework-agnostic data grid core.

## API Tiers

### Tier 1: Stable (`@affino/datagrid-core`)

Semver-safe surface for application integrations.

```ts
import {
  createDataGridApi,
  createDataGridCore,
  createClientRowModel,
  createServerBackedRowModel,
} from "@affino/datagrid-core"
```

### Tier 2: Advanced (`@affino/datagrid-core/advanced`)

Power-user APIs (supported, but can evolve faster):

```ts
import {
  createDataGridViewportController,
  createDataGridA11yStateMachine,
  createDataGridTransactionService,
  createDataGridAdapterRuntime,
} from "@affino/datagrid-core/advanced"
```

### Tier 3: Internal (`@affino/datagrid-core/internal`)

Unsafe, no semver guarantees. Use only for local tooling and migrations.

## Naming

Core naming is fully canonicalized to `DataGrid*` across stable, advanced, and internal entrypoints.

## Deterministic Integration Snapshot

Viewport integration should read deterministic state from controller snapshot API instead of peeking into internal signals or DOM transforms:

```ts
import { createDataGridViewportController } from "@affino/datagrid-core/advanced"

const viewport = createDataGridViewportController({ resolvePinMode })
const snapshot = viewport.getIntegrationSnapshot()

// stable integration fields:
snapshot.virtualWindow
snapshot.visibleRowRange
snapshot.visibleColumnRange
snapshot.pinnedWidth
snapshot.overlaySync
```

`visibleRowRange` / `visibleColumnRange` are legacy mirrors of `virtualWindow` for compatibility.

For imperative adapters, `DataGridViewportImperativeCallbacks` also exposes `onWindow(payload)` with the same `virtualWindow` snapshot.

`getViewportSyncState()` is also available when only sync transform state is needed.

## Pinning Contract (Canonical)

Runtime now treats only one pin state as canonical:
- `column.pin = "left" | "right" | "none"`
- `column.isSystem = true` is always resolved as left-pinned.

Legacy pin fields are not part of the supported contract.

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
- clamp calculation is centralized in `src/viewport/dataGridViewportHorizontalClamp.ts`
- prepare phase is pure (no mutation of input meta)
- stress coverage includes `100k` rows and `500+` columns with pinned left/right mix

## Build/Type Check

- `npm run build` - compile public contract to `dist`
- `npm run type-check` - check only public contract surface

## Roadmap

Execution and quality hardening are tracked in:
`/Users/anton/Projects/affinio/docs/datagrid-ag-architecture-9.5-pipeline-checklist.md`.
