# DataGrid Worker Compute Pipeline

Date: `2026-03-02`  
Scope: `@affino/datagrid-core`, `@affino/datagrid-worker`, `@affino/datagrid-orchestration`, `@affino/datagrid-vue`

## Goal

Introduce a compute-backend layer that keeps current synchronous behavior stable while opening a clean path to dedicated Web Worker execution.

## Current architecture

`createClientRowModel` now uses a dedicated compute runtime:

- `clientRowProjectionOrchestrator` (stage orchestration logic)
- `clientRowComputeRuntime` (execution backend adapter)

Execution entry points (`setSortModel`, `setFilterModel`, `patchRows`, `refresh`) no longer call projection orchestrator directly.  
They call `computeRuntime`, which selects backend mode:

- `sync` (default): direct in-thread orchestrator calls
- `worker`: transport-driven dispatch with deterministic fallback

This is still **compute mirror mode** (main-thread state remains authoritative).

## Contracts

Core compute transport contract (`clientRowComputeRuntime.ts`):

- `DataGridClientComputeRequest`
  - `recompute-from-stage`
  - `recompute-with-execution-plan`
  - `refresh`
- `DataGridClientComputeTransport.dispatch(request)`
  - returns `{ handled?: boolean }`
  - if not handled, runtime falls back to sync orchestrator

Diagnostics (`model.getComputeDiagnostics()`):

- configured/effective mode
- transport kind (`none|loopback|custom`)
- dispatch/fallback counters

Worker transport package (`@affino/datagrid-worker`) now provides:

- protocol envelopes + guards (`compute-request`, `compute-ack`)
- `createDataGridWorkerPostMessageTransport(...)`
- `createDataGridWorkerMessageHost(...)`
- parity tests for `sync` vs `worker-mode` deterministic projection

## Enablement path

### Core

`createClientRowModel` supports:

- `computeMode?: "sync" | "worker"`
- `computeTransport?: DataGridClientComputeTransport | null`

### Orchestration

`createDataGridRuntime` supports:

- `clientRowModelOptions?: Omit<CreateClientRowModelOptions, "rows">`

### Vue adapter

`useDataGridRuntime` supports:

- `clientRowModelOptions`

So worker-mode can be enabled at app runtime construction without custom row-model wiring.

Example:

```ts
import { useDataGridRuntime } from "@affino/datagrid-vue"
import { createDataGridWorkerPostMessageTransport } from "@affino/datagrid-vue"

const transport = createDataGridWorkerPostMessageTransport({
  target: worker,
  source: worker,
  dispatchStrategy: "sync-fallback",
})

const runtime = useDataGridRuntime({
  rows,
  columns,
  clientRowModelOptions: {
    computeMode: "worker",
    computeTransport: transport,
  },
})
```

`dispatchStrategy: "sync-fallback"` is the safe default: requests are mirrored to worker transport while main-thread sync compute remains source-of-truth.

## Worker Owns State (Variant B)

`@affino/datagrid-worker` now includes a full worker-owned row-model protocol:

- `createDataGridWorkerOwnedRowModelHost(...)`
  - runs `createClientRowModel(...)` inside worker host
  - publishes canonical snapshot + visible slice updates
- `createDataGridWorkerOwnedRowModel(...)`
  - thin-client row model on main thread
  - dispatches row-model commands (`sort/filter/group/pivot/patch/refresh`)
  - renders from worker-provided visible slice

Minimal wiring pattern:

```ts
import { createDataGridVueRuntime } from "@affino/datagrid-vue"
import {
  createDataGridWorkerOwnedRowModel,
  createDataGridWorkerOwnedRowModelHost,
} from "@affino/datagrid-worker"

// inside worker bootstrap:
createDataGridWorkerOwnedRowModelHost({
  source: self,
  target: self,
  rows,
})

// main thread:
const workerRowModel = createDataGridWorkerOwnedRowModel({
  source: worker,
  target: worker,
})

const runtime = createDataGridVueRuntime({
  rowModel: workerRowModel,
  columns,
})
```

Or directly through Vue composable:

```ts
import { useDataGridRuntime } from "@affino/datagrid-vue"

const runtime = useDataGridRuntime({
  columns,
  workerOwnedRowModelOptions: {
    source: worker,
    target: worker,
  },
})
```

## Why this is safe

- API remains synchronous by default (`sync` mode).
- Worker mode has explicit fallback to sync path if transport cannot handle a request.
- Existing projection and patch pipelines are unchanged semantically.

## Next implementation steps (real worker)

1. Add pull-query endpoints for non-viewport reads (pivot drilldown, histogram) with local cache windows.
2. Move heavy pure compute stages first:
   - sort/group/pivot/aggregate full recompute
3. Keep UI-critical operations on main thread:
   - selection, focus/editing, viewport sync.
4. Add worker parity checks:
   - deterministic hash equality (sync vs worker on same seed/ops)
   - benchmark gates for worker mode.

## Benchmarks

Worker-specific benchmarks are now split into two tracks:

- correctness stress:
  - `pnpm run bench:datagrid:worker:protocol`
  - `pnpm run bench:datagrid:worker:protocol:assert`
  - validates `loading` lifecycle under jitter/drop/stale updates and compares viewport coalescing strategies.
- browser UX throughput:
  - `pnpm run bench:datagrid:worker:frames`
  - `pnpm run bench:datagrid:worker:frames:assert`
  - measures frame pacing and dropped-frame behavior on `/datagrid/worker` for `main-thread` and `worker-owned` modes.
- heavy-pressure throughput:
  - `pnpm run bench:datagrid:worker:pressure`
  - `pnpm run bench:datagrid:worker:pressure:assert`
  - runs 100k-row stress workload (`sort + group + aggregation + patch storm + expensive formatter/deep-clone pressure`) and compares frame stability between `main-thread` and `worker-owned`.
