# Models MDR

## Purpose

`src/models/` is the row-engine layer of `datagrid-core`.

This folder owns:
- row-model contracts
- client row-model orchestration
- projection/compute/state/materialization subsystems
- server/data-source row-model adapters

This folder does not own:
- formula engine implementation
- Vue/UI behavior
- DOM/viewport/virtualization rendering concerns

## Root Files

- `clientRowModel.ts`
  - Composition root for the client row model.
  - Wires subsystem runtimes together.
  - Should stay thin and host-oriented.
- `rowModel.ts`
  - Main row-model contracts and public engine-facing row types.
- `columnModel.ts`
  - Column layout/order/visibility/pin/width model.
- `dataSourceBackedRowModel.ts`
  - Grid adapter over the data-source protocol.
- `serverBackedRowModel.ts`
  - Grid adapter over the low-level server row model runtime.
- `editModel.ts`
  - Local edit-state storage.

## Root Transitional Files

These files still exist at the root because they have not been fully re-homed yet:

- `clientRowExpansionRuntime.ts`
  - Legacy expansion-spec helper layer.
  - Candidate to move into `state/` or `projection/` later.
- `clientRowLifecycle.ts`
  - Lightweight lifecycle host (`emit/subscribe/dispose`).
  - Candidate to move into `host/` or `lifecycle/` if we continue regrouping.
- `clientRowModelHelpers.ts`
  - Transitional mixed helper file.
  - Contains domain helpers that should eventually be split by responsibility.
- `clientRowRuntimeUtils.ts`
  - Transitional mixed utility file.
  - Contains patch and row-identity helpers that should eventually move closer to `mutation/` and row identity concerns.

## Folder Ownership

- `aggregation/`
  - Aggregate computation helpers and aggregation engine support.
- `bootstrap/`
  - Composition-root bootstrap helpers for `clientRowModel.ts`.
  - Use for wiring, not for business logic.
- `compute/`
  - Compute runtime, compute host wiring, computed-field execution and registry integration.
- `dependency/`
  - Dependency graph and dependency model helpers.
- `filters/`
  - Filter DSL and reusable column-filter helpers.
- `formula/`
  - Formula integration shim layer inside `datagrid-core`.
  - Formula engine implementation lives in `@affino/datagrid-formula-engine`.
- `host/`
  - Host-level orchestration runtimes.
  - These coordinate subsystems, but should not own domain logic.
- `materialization/`
  - Base rows, computed overlay, effective row materialization, source column cache.
- `mutation/`
  - Patch analysis, patch coordination, row/state mutation runtimes.
- `pivot/`
  - Pivot integration helpers and pivot-specific runtime glue inside `core`.
  - Pure pivot contracts/helpers live in `@affino/datagrid-pivot`.
- `projection/`
  - Projection engine, handlers, orchestrator, projection-local derived cache and tree/pivot projection glue.
- `server/`
  - Data-source protocol, pull-row serialization, low-level server row model runtime.
- `snapshot/`
  - Row-model snapshots, calculation snapshots, restore/history support.
- `state/`
  - Mutable engine state runtimes: source state, view state, row versions, projection transient state.
- `tree/`
  - Tree integration layer inside `core`.
  - Heavy tree projection runtime still lives here until a stronger subsystem boundary exists.

## Placement Rules

- Put a file in a domain folder when it owns real logic for that domain.
- Put a file in `host/` only if it is orchestration glue across domains.
- Put a file in `bootstrap/` only if it exists to assemble runtimes for `clientRowModel.ts`.
- Do not add new formula implementation here; that belongs in `@affino/datagrid-formula-engine`.
- Do not add pure pivot helpers/contracts here; that belongs in `@affino/datagrid-pivot`.

## Reading Order

If you are new to the engine, read in this order:

1. `rowModel.ts`
2. `columnModel.ts`
3. `clientRowModel.ts`
4. `bootstrap/`
5. `host/`
6. `state/`, `snapshot/`, `materialization/`
7. `compute/`, `projection/`, `mutation/`
8. `pivot/`, `tree/`, `server/`
