# AFFINO-DG002 — DataGrid 0.5.x Package Health & Consumer Compatibility

Date: 2026-08-31
Scope: Affino packages only. FxLab was not modified.

## conclusions

Classification: AFFINO_DATAGRID_05_READY_WITH_LIMITATIONS

The corrected package set is consumable from packed artifacts with root public imports, strict TypeScript, and a Vue/Vite production build. The release candidates are not published, and browser-level render/accessibility verification remains deferred because the local Playwright Chromium executable is unavailable.

## dg_050_failure_reproduction

A clean external Vue 3/Vite/TypeScript fixture installed packed 0.5.0 artifacts (not workspace links).

Observed failures:

- Node runtime import of `@affino/datagrid-vue` failed because emitted ESM imports referenced `@affino/datagrid-vue/dist/stable` without a file extension.
- Direct theme runtime import failed for the same emitted extensionless ESM pattern (`dist/types`).
- Strict consumer typecheck failed because `@affino/datagrid-core` declarations referenced public pivot types absent from the published `@affino/datagrid-pivot@0.1.2` artifact.
- The published `@affino/popover-vue@1.1.0` runtime also contains extensionless imports. The app build now owns this boundary by bundling the interaction implementation into the app artifact.
- Vite production bundling completed, but that did not prove direct Node runtime resolution.

The consumer used only package-root imports. No node_modules or FxLab files were changed.

## runtime_entry_audit

The TypeScript package build now runs `scripts/fix-esm-specifiers.mjs` over emitted dist JavaScript for the DataGrid dependency graph. Relative ESM imports and exports resolve to emitted `.js` files or `index.js` entries.

`@affino/datagrid-vue-app` keeps Vue and DataGrid-family packages external, while bundling the required menu/popover/overlay/focus implementation. Its public package-root runtime entry therefore does not load the broken standalone popover runtime.

Package exports, emitted runtime files, and declarations agree for the tested root entries. No consumer dist/internal import is required.

## pivot_conflict_root_cause

Classification: TYPE_IDENTITY_SPLIT with a VERSION_MISMATCH publication defect.

The source pivot package already contained the types referenced by the current core contract, but the published 0.1.2 artifact did not. A clean consumer could therefore resolve same-named package instances with incompatible declaration surfaces. This was not suppressed in the consumer.

Fix: publish `@affino/datagrid-pivot@0.1.3`, align all corrected DataGrid packages to that public contract, and validate strict declarations against the packed candidate.

## dependency_version_matrix

| Package | Corrected candidate |
|---|---:|
| @affino/datagrid-vue-app | 0.5.1 |
| @affino/datagrid-vue | 0.5.1 |
| @affino/datagrid-core | 0.5.1 |
| @affino/datagrid-orchestration | 0.5.1 |
| @affino/datagrid-worker | 0.5.1 |
| @affino/datagrid-pivot | 0.1.3 |
| @affino/datagrid-theme | 0.2.5 |
| @affino/menu-vue | 2.1.1 |
| @affino/popover-vue | 1.1.0, bundled by app runtime |
| Vue peer | Vue 3 |

The packed fixture used local tarball overrides only because corrected candidates are intentionally not published. The supported production install should use the published package versions after release, without undocumented manual pins.

## public_api_inventory

Verified public package-root API:

- `@affino/datagrid-vue-app`: `DataGrid`, typed component factory, row-selection props/events.
- `@affino/datagrid-vue`: `createDataSourceBackedRowModel`, server row-model factories, datasource request/result types, row identity and viewport controls.
- `@affino/datagrid-pivot`: pivot helpers and public pivot model types.
- `@affino/datagrid-theme`: theme tokens, presets, `applyGridTheme`, and documented CSS subpath.

The consumer fixture imported these entries without source paths, internal paths, `any`, or `@ts-ignore`.

## lazy_loading_contract

The native contract is a data-source-backed row model. The grid supplies a bounded viewport range (plus priority/reason and optional sort/filter/pagination context); the consumer returns bounded rows, optional total/cursor, and stable row entries. Viewport changes trigger subsequent pulls and prefetch/cache behavior.

This is a public API path and does not require internal grid access. Cursor/pagination context is available where a backend prefers cursor windows. No lazy-loading gap was found.

## server_sort_contract

Sort state is part of the documented pull request. The consumer receives the externally controlled sort model in the datasource pull callback, translates it to a backend query, and returns server-ordered rows. The grid does not need the complete dataset to sort.

Status: READY.

## server_filter_contract

Filter state is likewise part of the documented pull request. The consumer can translate the public filter model into backend predicates and return the bounded result window.

Status: READY.

## row_selection_contract

Selection is exposed through public app props/state and row-selection update events. The row model selection state is row-id based, so virtualized/server-backed replacement does not require DOM event interception or private instance access.

Status: READY for the tested public contract.

## row_identity_contract

Consumers provide `resolveRowId(row, index)` or row entries with a `rowId`. The identity is consumer-owned and remains stable when remote windows are replaced or ordering changes. Index-only identity is not required.

## theme_contract

The public theme package supplies token/preset APIs and the documented CSS entry. Token-driven application mapping supports centralized light/dark/system theme selection. The contract does not require private selectors, `!important`, or private DOM assumptions.

Browser visual confirmation is deferred by the missing Playwright browser binary; the packed Vite CSS build succeeded.

## large_dataset_observation

The repository row-model benchmark covers logical collections at 1k, 10k, and 100k rows while keeping viewport work bounded. With one seed and reduced smoke iterations, window-shift p95/p99 were 1.121/1.157 ms (1k), 1.105/1.164 ms (10k), and 1.183/1.259 ms (100k); heap delta was about 0.70 MB in each run. The result is a row-model/virtualization observation, not a million-row performance claim. Vite production output completed; it emitted the existing large-chunk advisory for the app artifact.

The browser benchmark/visual memory trace was not completed because Chromium is not installed in the environment.

## packed_consumer_test

Fixture: `.tmp/affino-dg-consumer`, isolated from the workspace package graph.

Passed:

- standard pnpm install of packed candidates;
- runtime smoke importing app, Vue, theme, and pivot public entries;
- strict `vue-tsc --noEmit`;
- Vue/Vite production build;
- CSS/theme import in the production build.

Install/build observations:

- plugin-vue 5.2.4 with Vite 7 produced a peer advisory; this is a fixture toolchain advisory.
- pnpm reported ignored esbuild build scripts; toolchain advisory.
- Vite reported a chunk larger than 500 KB; performance advisory.
- no DataGrid package peer warning or declaration failure remained.

A real browser mount smoke is pending the Playwright Chromium executable.

## migration_041_to_05x

Unchanged basic package-root component usage remains conceptually compatible. For the corrected 0.5.x line:

- use the aligned package set above;
- import from package roots;
- use `defineDataGridComponent<Row>()` for typed Vue components;
- use `createDataSourceBackedRowModel` for bounded server data;
- provide `resolveRowId`;
- translate pull-request sort/filter state to the server;
- use public row-selection state/events;
- use the theme token/CSS entry.

Do not carry forward the rejected 0.5.0 tarball or dist-path imports. No FxLab migration was made in this slice.

## fxlab_readiness_matrix

| Requirement | Status |
|---|---|
| Trades grid | READY |
| Runs grid | READY |
| Virtualization | READY |
| Infinite/lazy server loading | READY |
| Server sort | READY |
| Server filter | READY |
| Row selection | READY |
| Stable identity | READY |
| Theme mapping | READY |
| Large collections | READY with browser measurement limitation |

## tests

Passed:

- datagrid-vue-app type-check and public type contracts;
- datagrid-vue unit tests: 505 tests;
- datagrid-core tests: 791 tests;
- server-client and server-adapters type-checks;
- server datasource demo fake-server test;
- corrected packed consumer runtime, strict typecheck, and production build;
- relevant package builds and ESM normalization;
- `git diff --check`.

The local Playwright launch was attempted and blocked only by the missing Chromium executable.

## remaining_debt

1. Publish the corrected candidates through the repository release process; do not publish automatically as part of this audit.
2. Run browser render, keyboard/focus, selected-row semantics, and screen-reader-role smoke tests after installing the approved browser binary.
3. Reassess the existing app bundle-size advisory.
4. The standalone external `@affino/popover-vue@1.1.0` package remains extensionless when consumed directly; DataGrid app packaging contains that defect, but the dependency should receive its own upstream patch if it is intended for standalone public consumption.

## recommended_release

Use `0.5.1` for the backwards-compatible DataGrid app/core/Vue line, `0.1.3` for the pivot declaration correction, and `0.2.5` for the theme ESM correction.

## suggested_commit

`fix(datagrid): align 0.5.1 package exports and tarball runtime`
