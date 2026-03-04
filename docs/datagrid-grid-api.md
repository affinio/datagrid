# DataGrid Unified Grid API

Updated: `2026-03-03`

`DataGridApi` is the semver-safe, namespace-based facade for model/service operations in `@affino/datagrid-core`.

## Entry point

Use only package public exports:

- `createDataGridApi`
- `DataGridApi`

Deep imports are outside the stable public contract.

## Namespaced surface

Stable domains:

- `api.lifecycle`
- `api.rows.*`
- `api.data.*`
- `api.columns.*`
- `api.view.*`
- `api.pivot.*`
- `api.selection.*`
- `api.transaction.*`
- `api.compute.*`
- `api.diagnostics.*`
- `api.meta.*`
- `api.policy.*`
- `api.plugins.*`
- `api.state.*`
- `api.events.*`

Lifecycle:

- `api.init()`
- `api.start()`
- `api.stop()`
- `api.dispose()`

Flat API methods are removed from `DataGridApi`.

## Capability contract

`api.capabilities` is runtime-resolved:

- `patch`
- `dataMutation`
- `backpressureControl`
- `compute`
- `selection`
- `transaction`
- `histogram`
- `sortFilterBatch`

Use it as guard before capability-dependent mutating calls.

## Key semantics

- `rows.applyEdits(...)` mutates data (optionally with reapply policy).
- `rows.batch(...)` is an explicit bulk mutation boundary with one coalesced facade event-cycle.
- `view.reapply()` recomputes projection only.
- `pivot` remains a separate analytical subsystem (intentionally not nested under `rows`).
- `data.pause()/resume()/flush()` is the public backpressure control surface for supported server/data-source row models.
- `state.get/set` is the unified state boundary for export/import (V1 model-centric payload).
- `state.migrate(...)` is the explicit payload migration/validation hook before restore.
- `events.on` is the typed public event surface with documented in-process ordering.
- `events` includes explicit state import boundaries (`state:import:begin/end`).
- `compute.switchMode(...)` is synchronous and does not implicitly trigger recompute.
- `diagnostics.getAll()` is read-only and does not trigger recompute.
- `meta.getApiVersion()/getProtocolVersion()` expose compatibility versions for multi-runtime integrations.
- `plugins` lifecycle is event-driven (`onRegister`/`onDispose`/`onEvent`).

## Runtime guarantees

- Snapshot isolation: public read methods are revision-consistent within the same synchronous call stack.
- Guarded mutation serialization: high-impact guarded operations are serialized through lifecycle exclusivity.
- Event reentrancy: reentrant emissions are queued FIFO; mutation from handlers is allowed.
- State import boundary: `state.set(...)` is a begin/end logical boundary, not single-event atomic payload.

## Concurrency and error model

- `lifecycle.runExclusive` provides exclusive mutation windows for guarded operations.
- `lifecycle.whenIdle` resolves after the exclusive queue drains.
- `lifecycle.isBusy()` reports whether guarded mutation queue / lifecycle transition is in progress.
- `events.error` provides typed recoverable runtime conflict payloads.
- Guarded operations may still throw/reject for control-flow correctness.

## Plugin safety model

- Plugins are observational by default and consume only public event payloads.
- Plugin handler failures are isolated from core dispatch.
- Plugins can mutate state only through public API calls.

## Service binding notes

`createDataGridApi` binds to `GridCore` services:

- required: `rowModel`, `columnModel`
- optional capabilities: selection, transaction, viewport, histogram, compute mode switching, data mutation support, backpressure controls

Creation is fail-fast for missing required services.

## Selection summary contract

`api.selection.summarize(options?)` computes deterministic aggregates over selected scope:

- `count`, `countDistinct`, `sum`, `avg`, `min`, `max`

Selection stays headless in core; adapter/UI mapping remains at adapter boundary.

## Viewport integration boundary

Pinned/overlay geometry sync remains in advanced viewport controller API:

- `createDataGridViewportController(...).getIntegrationSnapshot()`
- `createDataGridViewportController(...).getViewportSyncState()`

Use these for deterministic adapter geometry integration instead of internal signal reads.

## Related docs

- `docs/datagrid-core-factories-reference.md`
- `docs/datagrid-core-advanced-reference.md`
- `docs/datagrid-state-events-compute-diagnostics.md`
- `docs/datagrid-feature-catalog.md`
