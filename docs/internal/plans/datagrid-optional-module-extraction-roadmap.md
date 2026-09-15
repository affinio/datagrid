# Optional Module Extraction Roadmap

Status: active roadmap  
Scope: `@affino/datagrid-vue-app`, `@affino/datagrid-vue`, and optional runtime packages  
Owner: DataGrid package architecture

## Goal

Keep the package root suitable for ordinary tables. Optional runtime code must load only through an explicit subpath or an explicit module entry.

The root entry must not acquire optional code through:

- shared barrel files;
- type imports that become runtime imports;
- default renderers;
- package-level dependency edges;
- build-only `manualChunks` workarounds.

Each slice must preserve the stable base API, add a focused contract test, and compare both the root consumer build and the optional consumer build.

## Guardrails

- [ ] Keep `datagrid-core` framework-agnostic and stable.
- [ ] Keep the Vue adapter responsible for adapter lifecycle and runtime wiring.
- [ ] Keep `datagrid-vue-app` responsible for mounted rendering and UI composition.
- [ ] Do not move selection, viewport math, base row models, table stage, chrome, or theme out of the root.
- [ ] Do not remove a root export until its replacement subpath and migration note are validated.
- [ ] Keep optional packages out of root runtime dependencies when they are needed only by a subpath.
- [ ] Do not solve package boundaries with consumer-local Vite `manualChunks`.
- [ ] For every slice, record root entry size, optional entry size, and production consumer evidence.

## Slice 0 — Inventory and baseline

- [ ] Record current package exports, dependencies, build inputs, and public declarations.
- [ ] Trace root runtime imports from `@affino/datagrid-vue-app` through `@affino/datagrid-vue`.
- [ ] Classify every candidate as base, optional UI, optional projection, optional adapter, or enterprise integration.
- [ ] Build a minimal ordinary-table Vite consumer and save its bundle report.
- [ ] Build one consumer for each optional feature that is already supported.
- [ ] Add a repeatable entrypoint graph check for forbidden root imports.
- [ ] Save baseline measurements in the roadmap or a linked audit document.

## Slice 1 — Gantt

Status: implemented in the current worktree.

- [x] Remove the static Gantt stage import from the root renderer.
- [x] Add an internal stage injection contract.
- [x] Add the opt-in `@affino/datagrid-vue-app/gantt` DataGrid wrapper.
- [x] Make `@affino/datagrid-gantt` optional for the package root.
- [x] Add root-isolation and Gantt-subpath contract tests.
- [x] Update package README with root and Gantt imports.
- [x] Run package build, type-check, unit tests, ESM smoke tests, and ordinary-table Vite build.
- [ ] Separate and commit the implementation changes independently from this roadmap commit.

Migration rule: ordinary tables keep importing from the root. Gantt consumers import `DataGrid` from `@affino/datagrid-vue-app/gantt`.

## Slice 2 — Pivot boundary audit

Pivot is more coupled than Gantt. It currently participates in `DataGrid` props, state, API, projection, row materialization, and the Vue adapter.

- [ ] Identify which Pivot code is required by the base runtime contract.
- [ ] Separate Pivot contracts and types from Pivot runtime implementation.
- [ ] Identify whether ordinary tables still need a lightweight Pivot namespace in the root API.
- [ ] Measure Pivot contribution to the root `datagrid-vue` and `datagrid-vue-app` graphs.
- [ ] Define the module contract before moving runtime code.
- [ ] Decide whether the public entry is `@affino/datagrid-vue-app/pivot`, `@affino/datagrid-vue/pivot`, or both.
- [ ] Add a compatibility and migration note before removing any root runtime edge.

## Slice 3 — Pivot extraction

- [ ] Move Pivot projection/runtime registration behind an explicit optional module.
- [ ] Keep base row, column, selection, and viewport contracts independent of Pivot.
- [ ] Provide a Pivot-enabled DataGrid wrapper or module registration API.
- [ ] Preserve Pivot state import/export behavior in the optional entry.
- [ ] Add tests for root import without Pivot runtime.
- [ ] Add tests for Pivot import, rendering, state restore, and API operations.
- [ ] Verify no circular initialization in root and Pivot consumers.
- [ ] Compare ordinary-table and Pivot production bundles.
- [ ] Update package exports, dependency metadata, README, and migration docs.

## Slice 4 — Worker runtime

- [ ] Trace worker imports through `@affino/datagrid-vue` and `@affino/datagrid-vue-app`.
- [ ] Keep worker-safe contracts and basic synchronous behavior in the root.
- [ ] Move worker runtime, worker transport, and worker-only formula code behind the existing worker subpath or a documented app subpath.
- [ ] Mark worker packages optional where they are subpath-only runtime dependencies.
- [ ] Test ordinary tables without worker packages installed.
- [ ] Test worker consumer initialization and teardown.
- [ ] Compare root and worker consumer bundles.

## Slice 5 — Server adapters

- [ ] Trace HTTP, Laravel, server history, and datasource-specific imports.
- [ ] Keep datasource protocol types and base row-model interfaces in the stable contract.
- [ ] Move HTTP/Laravel/history implementations behind a server subpath.
- [ ] Keep local client-row tables independent of server adapter runtime.
- [ ] Test local table imports without server packages.
- [ ] Test bounded pull, sorting/filtering, revisions, undo/redo, and error paths through the server entry.
- [ ] Update install and migration documentation.

## Slice 6 — Formula and compute runtime

- [ ] Split basic formula contracts and lightweight built-ins from the heavy formula engine.
- [ ] Confirm whether formulas are a base product capability or an optional enterprise capability.
- [ ] Keep ordinary column rendering free of unused parser/compiler/JIT runtime.
- [ ] Move worker-only and advanced formula integrations behind explicit entries.
- [ ] Add root, synchronous formula, and worker formula bundle checks.
- [ ] Preserve formula diagnostics and type declarations for supported consumers.

## Slice 7 — Optional UI utilities

Existing subpaths require verification that their runtime is actually isolated.

- [ ] Audit `advanced-filter`.
- [ ] Audit `quick-filter`.
- [ ] Audit `find-replace`.
- [ ] Audit `aggregations`.
- [ ] Remove any accidental root imports through renderer barrels.
- [ ] Keep shared option types in internal/shared modules without runtime edges.
- [ ] Add one root-isolation test per utility family where the current graph proves a risk.
- [ ] Verify each subpath build and consumer import independently.

## Slice 8 — Advanced integrations and enterprise tooling

- [ ] Inventory diagnostics, profiler, explain panels, devtools, and license-gated integrations.
- [ ] Keep diagnostics hooks and stable error contracts lightweight in the root.
- [ ] Move visual tooling and enterprise integrations behind explicit entries.
- [ ] Add production build checks for applications with and without those integrations.
- [ ] Document package ownership and support tier.

## Slice 9 — Final package contract

- [ ] Verify every `package.json.exports` entry has matching `types` and `import` paths.
- [ ] Verify optional packages are not mandatory root runtime dependencies.
- [ ] Verify root declarations do not accidentally create runtime imports.
- [ ] Run all package builds and focused tests.
- [ ] Run ordinary-table, Gantt, Pivot, worker, server, and formula consumer builds.
- [ ] Run circular initialization checks.
- [ ] Update README, package map, migration guide, and architecture notes.
- [ ] Record final bundle sizes and remaining limitations.
- [ ] Create separate conventional commits per implementation slice.

## Definition of done

- [ ] An ordinary root DataGrid loads no Gantt, Pivot, worker, server adapter, or advanced integration runtime unless the base contract explicitly requires it.
- [ ] Optional features remain available through documented public subpaths.
- [ ] Root API compatibility is documented for every intentional migration.
- [ ] Root and optional type declarations compile independently.
- [ ] Production consumers build without `Cannot access '<identifier>' before initialization`.
- [ ] Bundle reports show that optional runtime is absent from ordinary-table consumers.
- [ ] Focused tests and package quality gates pass.

