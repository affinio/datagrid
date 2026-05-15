# DataGrid v2 Modular Kernel Plan

Updated: `2026-03-08`  
Scope: whole `datagrid` architecture, centered on `@affino/datagrid-core` as host kernel.

## Goal

Turn `core` into a strong host/kernel that can run without optional subsystems, while allowing mature subsystems to plug in through stable contracts.

Target shape:

- `core` owns lifecycle, state, scheduling, invalidation orchestration, API composition.
- subsystems own their domain logic and public surface.
- subsystems are optional capabilities, not assumptions baked into the kernel.
- advanced tiers can later move into paid packages without weakening OSS baseline.

This is not a thin-core plan. `core` remains the place of strength.

## Principles

- `core` must work without optional subsystems.
- Only extract a subsystem when it has real domain ownership, not just re-exported types.
- Stop extraction when deeper moves increase bridge/coupling cost faster than they improve clarity.
- After each subsystem step:
  - run targeted tests and benches,
  - verify no regressions,
  - user commits,
  - then move to the next subsystem.

## Kernel Ownership

`@affino/datagrid-core` remains owner of:

- row identity and row state lifecycle
- projection scheduling and stage orchestration
- patch/invalidation orchestration
- snapshot/state host semantics
- public API composition
- subsystem registration and capability wiring

## Subsystem Categories

### Compute modules

- `formula`

### Projection modules

- `pivot`
- `tree`

### Data modules

- `server`

### Tooling modules

- `diagnostics`

## Maturity Assessment

### Ready enough for modular ownership

- [x] `formula`
- [x] `pivot`

### Partial / boundary-first only

- [ ] `tree`
- [ ] `diagnostics`

### Too coupled for deep extraction today

- [ ] `server`

## Current Decisions

### Keep as extracted domain packages

- [x] `@affino/datagrid-formula-engine`
- [x] `@affino/datagrid-pivot`

### Keep only as light boundaries or stop extraction

- [ ] `tree` deeper extraction
- [ ] `diagnostics` deeper extraction
- [ ] `server` deeper extraction

Reason:

- `formula` clearly owns real engine logic.
- `pivot` owns enough domain contracts/helpers/runtime helper layers to justify the package.
- `tree`, `diagnostics`, and `server` start adding complexity too quickly if pushed deeper today.

## Host Contracts to Introduce in v2

### 1. Compute Module Host

- [ ] Define compute module contract.
- [ ] Allow `core` to register compute modules.
- [ ] Move formula stage registration behind compute module contract.
- [ ] Keep compute invalidation hooks host-owned by `core`.

Target responsibilities:

- module:
  - compile/plan/evaluate own domain
  - expose compute-stage hooks
- core:
  - decide when compute stage runs
  - provide row/snapshot/state host services

### 2. Projection Module Host

- [ ] Define projection module contract.
- [ ] Allow `core` to register projection modules.
- [ ] Move pivot stage registration behind projection module contract.
- [ ] Later move tree stage registration behind the same contract.

Target responsibilities:

- module:
  - own projection-specific planning/materialization helpers
  - declare stage dependencies and invalidation needs
- core:
  - own stage scheduler
  - own projection pipeline lifecycle

### 3. Data Module Host

- [ ] Define data module contract.
- [ ] Keep `server` in `core` for now, but design host interface first.
- [ ] Defer deep runtime extraction until host contract is proven stable.

Target responsibilities:

- module:
  - own data fetch/store semantics
  - expose refresh/patch/store hooks
- core:
  - own row lifecycle and integration with projection/compute

### 4. Diagnostics Module Host

- [ ] Define diagnostics module contract.
- [ ] Keep low-level counters/hooks/snapshots in `core`.
- [ ] Allow additive diagnostics tooling modules to subscribe to host events.

Target responsibilities:

- module:
  - reporting
  - profiling
  - explain tooling
- core:
  - emit snapshots and runtime signals

## Execution Order

Follow simplest subsystem to hardest subsystem.

### Phase 1. Formula Host Integration

- [ ] Treat `formula` as the first-class compute module.
- [ ] Replace direct formula stage wiring in `clientRowModel` with compute-module registration.
- [ ] Keep current package boundary.

Validation:

- [ ] `@affino/datagrid-formula-engine` build
- [ ] `@affino/datagrid-core` build
- [ ] `@affino/datagrid-worker` build
- [ ] `@affino/datagrid-vue` type-check
- [ ] `bench:datagrid:formula-engine:assert`
- [ ] `bench:datagrid:formula-backends:assert`

### Phase 2. Pivot Host Integration

- [ ] Treat `pivot` as the first-class projection module.
- [ ] Replace direct pivot stage wiring in `clientRowModel` with projection-module registration.
- [ ] Keep current stop-line: domain package + core orchestration.

Validation:

- [ ] `@affino/datagrid-pivot` build
- [ ] `@affino/datagrid-core` build
- [ ] `@affino/datagrid-vue` type-check
- [ ] `@affino/datagrid-laravel` build
- [ ] `bench:datagrid:pivot:assert`

### Phase 3. Diagnostics Host Integration

- [ ] Add diagnostics host contract.
- [ ] Keep runtime counters/hooks in `core`.
- [ ] Move only additive tooling wiring behind diagnostics-module registration.

Validation:

- [ ] `@affino/datagrid-diagnostics` build
- [ ] `@affino/datagrid-core` build
- [ ] `quality:architecture:datagrid`

### Phase 4. Tree Host Integration

- [ ] Add tree as projection module under the same projection host contract as pivot.
- [ ] Do not deep-extract tree runtime unless host boundary proves clean.

Validation:

- [ ] `@affino/datagrid-tree` build
- [ ] `@affino/datagrid-core` build
- [ ] `@affino/datagrid-vue` type-check
- [ ] `bench:datagrid:tree:assert`
- [ ] `bench:datagrid:tree:matrix:assert`

### Phase 5. Server Host Interface

- [ ] Design server/data module host contract.
- [ ] Keep runtime in `core`.
- [ ] Delay extraction until coupling is reduced by host contracts, not by package tricks.

Validation:

- [ ] `@affino/datagrid-core` build
- [ ] `@affino/datagrid-vue` type-check
- [ ] relevant server-backed tests

## Stop-Lines

These are explicit anti-complexity guards.

### Formula

- [x] keep extracted package
- [x] do not re-embed engine into `core`

### Pivot

- [x] keep extracted package
- [x] stop before deep orchestration extraction

### Diagnostics

- [x] keep additive tooling package only
- [ ] do not move low-level runtime counters/hooks out of `core`

### Tree

- [x] keep only light domain boundary for now
- [ ] do not force deep runtime extraction yet

### Server

- [x] do not continue package extraction today
- [ ] only design host contract first

## Main Refactor Area

The main v2 refactor is expected to center on:

- `clientRowModel`

Reason:

- it is the current host where compute, projection, patch orchestration, snapshots, and diagnostics converge.

v2 does not mean rewriting it from scratch.

It means converting it from:

- subsystem-aware orchestration shell with hardcoded knowledge

into:

- kernel host that registers and coordinates optional subsystem capabilities

## Definition of Done

v2 modular kernel is considered established when:

1. [ ] `core` can run without optional subsystem packages.
2. [ ] `formula` is registered as a compute module, not hardwired stage logic.
3. [ ] `pivot` is registered as a projection module, not hardwired stage logic.
4. [ ] `diagnostics` tooling can attach without owning runtime counters.
5. [ ] `tree` can be hosted through the same projection module contract without deep extraction pressure.
6. [ ] `server` has a clean host contract, even if runtime still lives in `core`.
7. [ ] After each subsystem step, tests/benches remain green before moving on.

## Commit Discipline

For every subsystem step:

1. [ ] implement one bounded host-integration step
2. [ ] run targeted tests/benches
3. [ ] inspect regressions
4. [ ] user commits
5. [ ] only then move to the next subsystem
