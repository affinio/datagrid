# DataGrid Public API and Extensibility Enterprise Audit

Date: `2026-05-16`
Scope: public API boundaries, extension points, renderer APIs, datasource APIs, events, plugin readiness, typing, lifecycle, package boundaries, and migration safety across the DataGrid packages.

## Executive Summary

DataGrid has a strong enterprise API foundation: `DataGridApi` is namespaced, documented, version-aware, and backed by contract tests; core/Vue stable and advanced entrypoints are documented; datasource and row/column model contracts are explicit; and the app-facing Vue component exposes production-shaped props, events, imperative helpers, renderer hooks, state persistence, and saved-view helpers.

Current readiness is not yet enterprise-grade for a public extension ecosystem. The main blockers are API lifecycle coverage and public-surface depth: `@affino/datagrid-orchestration` still has a broad public root without tiering, and API diff gates are not yet declaration-level. These are solvable without inventing a parallel architecture: maintain the existing tiered entrypoints, keep the public API inventory current, and keep extension contracts centered on the current `DataGridApi` facade plus the capability-gated plugin runtime.

Update `2026-05-20`: the first public API inventory slices are implemented. `docs/datagrid-public-api-inventory.md` classifies tracked package export paths, `docs/quality/datagrid-public-api-inventory.json` is generated and checked by `pnpm run quality:api:datagrid:inventory`, `@affino/datagrid-core` no longer exposes a source-shaped package wildcard, `@affino/datagrid-vue` root/stable docs now match the current stable integration surface, `docs/datagrid-plugin-lifecycle.md` defines the canonical plugin model, `docs/datagrid-renderer-lifecycle.md` defines app renderer lifecycle/focus/remount/cleanup rules, and `docs/datagrid-event-matrix.md` maps core events, Vue emits, plugin events, and feature-local events. The generated snapshot is an export-map/entrypoint baseline, not yet a declaration-level API diff gate.

Enterprise readiness score: **7.0 / 10**.
Target score: **9.0 / 10**.
The target is blocked by orchestration tiering and API-diff quality gates across all public packages.

## Current Architecture Summary

- Stable core facade: `@affino/datagrid-core` exports row/column/edit models, `createDataGridCore`, `createDataGridApi`, protocol/version metadata, selection helpers, spreadsheet helpers, datasource-backed row models, formula types, projection diagnostics, and many typed model contracts through `packages/datagrid-core/src/public.ts`.
- Advanced core facade: `@affino/datagrid-core/advanced` exports viewport controller, transaction service, a11y state machine, adapter runtime, data-source-backed row model, and low-level selection/runtime helpers through `packages/datagrid-core/src/advanced.ts`.
- Internal core facade: `@affino/datagrid-core/internal` exports explicitly unsafe row/viewport normalization helpers through `packages/datagrid-core/src/internal.ts`.
- Vue adapter facade: `@affino/datagrid-vue` re-exports common core types/helpers, runtime composables, settings/context helpers, overlay/context-menu helpers, `createGrid`, `useAffinoGrid`, and selectors from `packages/datagrid-vue/src/public.ts`.
- Vue advanced facade: `@affino/datagrid-vue/advanced` delegates to domain advanced modules through `packages/datagrid-vue/src/advanced.ts` and the package export map.
- App facade: `@affino/datagrid-vue-app` exports the `DataGrid` component, app prop/types, renderer contexts, menus, toolbar modules, saved-view helpers, history types, Gantt types, and configuration helpers from `packages/datagrid-vue-app/src/index.ts`.
- Orchestration package: `@affino/datagrid-orchestration` publicly exports domain primitives for accessibility, scrolling, navigation, cells, pointer, clipboard, fill, grouping, headers, editing, history, selection, rows, viewport, runtime, and contracts from `packages/datagrid-orchestration/src/index.ts`.
- Datasource integration: core owns the `DataGridDataSource` protocol; `@affino/datagrid-server-adapters` maps DataGrid pull/filter/sort/group requests to server query shapes; `@affino/datagrid-server-client` owns HTTP/change-feed helpers.

## Files and Docs Reviewed

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/datagrid-grid-api.md`
- `docs/datagrid-core-factories-reference.md`
- `docs/datagrid-core-advanced-reference.md`
- `docs/datagrid-model-contracts.md`
- `docs/datagrid-data-source-protocol.md`
- `docs/datagrid-feature-catalog.md`
- `docs/datagrid-migration-guide.md`
- `docs/datagrid-versioned-public-protocol.md`
- `docs/datagrid-vue-stable-entrypoint.md`
- `docs/datagrid-vue-advanced-entrypoint.md`
- `docs/datagrid-plugin-capability-model.md`
- `docs/datagrid-state-events-compute-diagnostics.md`
- `packages/datagrid-core/package.json`
- `packages/datagrid-core/src/public.ts`
- `packages/datagrid-core/src/advanced.ts`
- `packages/datagrid-core/src/internal.ts`
- `packages/datagrid-core/src/core/gridApiContracts.ts`
- `packages/datagrid-core/src/core/gridApiPluginsRuntime.ts`
- `packages/datagrid-core/src/protocol/eventContractTiers.ts`
- `packages/datagrid-core/src/protocol/__tests__/entrypointTiers.contract.spec.ts`
- `packages/datagrid-vue/package.json`
- `packages/datagrid-vue/src/public.ts`
- `packages/datagrid-vue/src/advanced.ts`
- `packages/datagrid-vue/src/grid/createGrid.ts`
- `packages/datagrid-vue/src/grid/types.ts`
- `packages/datagrid-vue/src/composables/useAffinoGrid.ts`
- `packages/datagrid-vue-app/package.json`
- `packages/datagrid-vue-app/src/DataGrid.ts`
- `packages/datagrid-vue-app/src/index.ts`
- `packages/datagrid-vue-app/src/config/dataGridFormulaOptions.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
- `packages/datagrid-orchestration/package.json`
- `packages/datagrid-orchestration/src/index.ts`
- `packages/datagrid-plugins/src/types.ts`
- `packages/datagrid-plugins/src/manager.ts`
- `packages/datagrid-server-adapters/src/index.ts`
- `packages/datagrid-server-client/src/index.ts`
- `scripts/codemods/datagrid-public-protocol-codemod.mjs`
- `scripts/check-datagrid-architecture-acceptance.mjs`
- `scripts/check-datagrid-flat-api-usage.mjs`

## Strengths

- `DataGridApi` is the right enterprise centerpiece. `docs/datagrid-grid-api.md` defines namespaced domains (`lifecycle`, `rows`, `data`, `columns`, `view`, `selection`, `transaction`, `state`, `events`, `plugins`, `diagnostics`, etc.), lifecycle methods, capability guards, event reentrancy, state import boundaries, and semantic viewport APIs.
- Public protocol rules exist. `docs/datagrid-versioned-public-protocol.md` defines stable, advanced, and internal tiers, semver rules, forbidden deep imports, deprecation windows, and a public-protocol codemod.
- API contracts have tests. `packages/datagrid-core/src/protocol/__tests__/entrypointTiers.contract.spec.ts` verifies stable vs advanced vs internal exports; `packages/datagrid-core/src/core/__tests__/gridApi.contract.spec.ts` covers the API facade and plugin namespace.
- Datasource API is strong. `docs/datagrid-data-source-protocol.md` defines pull, abort-first cancellation, push events, invalidation, backpressure diagnostics, and histogram requests.
- App-level Vue API is production-shaped. `packages/datagrid-vue-app/src/DataGrid.ts` exposes controlled props, `rowModel`, `services`, state/saved-view APIs, virtualization/pagination options, menus, history, row selection, renderer hooks, toolbar modules, and typed component events.
- Renderer extension is practical. `DataGridAppCellRendererContext` and `DataGridAppGroupCellRendererContext` expose row/column/value/surface/interactive context, and component tests cover custom cell renderers, grouped row renderers, and `interactive.activate`.
- Typing is generally strong. Public contracts use generics, typed snapshots, discriminated row nodes, typed event maps, typed datasource request/result shapes, and helper functions such as `defineDataGridColumns`.
- Migration support is real. The migration guide documents flat-to-namespaced API movement, state restore, import migration, validation commands, and the public-protocol codemod.

## Findings by Severity

### Blocker

1. **Public boundary enforcement for `@affino/datagrid-core` is hardened.** (completed 2026-05-20)
   - Evidence: `packages/datagrid-core/package.json` now exposes only `.`, `./advanced`, and `./internal`; the source-shaped `"./*"` export is removed. `entrypointTiers.contract.spec.ts` and the public API inventory check guard this boundary.
   - Impact: unsupported deep imports such as `@affino/datagrid-core/src/*` and `@affino/datagrid-core/viewport/*` are no longer package exports.
   - Required: keep new public needs flowing through an approved tiered entrypoint and migration note.

2. **Plugin model roles are defined.** (completed 2026-05-20)
   - Evidence: `docs/datagrid-plugin-lifecycle.md` designates `api.plugins` as the stable public plugin facade, `@affino/datagrid-plugins` as the advanced capability-gated runtime foundation, and Vue `createGrid` features as local composition features.
   - Impact: integrators now have one public plugin lifecycle and bridge rules for capability-sensitive and Vue-local extensions.
   - Required: keep future plugin expansion aligned with this role split instead of adding a fourth model.

### High

1. **Vue stable-entrypoint docs and root exports are reconciled.** (completed 2026-05-20)
   - Evidence: `docs/datagrid-vue-stable-entrypoint.md` now documents the current root/stable integration primitives, and `packages/datagrid-vue/src/__tests__/entrypointTiers.contract.spec.ts` proves root and `./stable` are contract-equivalent while low-level advanced hooks stay off root.
   - Impact: semver commitments are explicit for the current root/stable surface.
   - Required: keep new Vue root exports documented and covered by the entrypoint tier contract.

2. **`@affino/datagrid-orchestration` has a broad public root surface without a tiered contract.**
   - Evidence: `packages/datagrid-orchestration/src/index.ts` re-exports many domain modules from root, and `package.json` exposes only `"."`.
   - Impact: low-level interaction primitives can become public by accident, increasing long-term compatibility cost.
   - Required: define stable vs advanced orchestration exports or document this package as adapter-internal.

3. **Renderer lifecycle guarantees are documented and covered.** (completed 2026-05-20)
   - Evidence: `docs/datagrid-renderer-lifecycle.md` defines mount/unmount cleanup, virtualization remount behavior, focus ownership inside custom renderers, async renderer expectations, and performance budgets; `DataGrid.contract.spec.ts` covers focusable renderer children, `interactive.activate`, group renderer toggles, virtual remount continuity, and renderer child cleanup.
   - Impact: custom renderer authors have an explicit safety contract for selection, editing, focus, a11y, and scroll performance under virtualization.
   - Required: keep future renderer behavior changes aligned with the lifecycle doc and component contract coverage.

4. **Event APIs are coherent across integration layers.** (completed 2026-05-20)
   - Evidence: `docs/datagrid-event-matrix.md` maps `api.events`, Vue app emits, `api.plugins.onEvent`, `createGrid` feature-local events, payload ownership, ordering, reentrancy, failure behavior, and preferred integration paths. Core, Vue, and Vue app tests cover representative ordering and failure semantics.
   - Impact: integrators can choose one event surface for a workflow and avoid duplicate listeners across mirrored runtime/component events.
   - Required: keep new public event names and Vue emit aliases reflected in the event matrix.

5. **Migration safety lacks generated API surface diff gates across all public packages.**
   - Evidence: contract tests and `quality:api:datagrid:flat` exist; no reviewed script generates or compares `.d.ts` public API reports for `datagrid-core`, `datagrid-vue`, `datagrid-vue-app`, `datagrid-orchestration`, server adapters, and server client.
   - Impact: accidental public type changes can ship without a focused semver review.
   - Required: add API report / export inventory gates and require migration notes for breaking diffs.

### Medium

1. **The feature catalog lists `@affino/datagrid`, but no `packages/datagrid` package was found.**
   - Evidence: `docs/datagrid-feature-catalog.md` lists `@affino/datagrid` as the app-team facade; `packages/datagrid` does not exist in this workspace.
   - Impact: documentation points to an unsupported or planned package.
   - Required: mark the facade as planned, add the package, or update the package entry map.

2. **App-layer `services` and `startupOrder` props expose core service wiring.**
   - Evidence: `DataGrid.ts` accepts `services?: DataGridRuntimeOverrides` and `startupOrder?: CreateDataGridCoreOptions["startupOrder"]`.
   - Impact: powerful integration hook, but it can bypass normal ownership if not documented as advanced.
   - Required: document this as advanced escape hatch with supported service names, lifecycle requirements, and compatibility risk.

3. **Typing uses bivariant callback helpers for ergonomics.**
   - Evidence: app-level callbacks such as cell renderers and readers use `DataGridBivariantCallback`.
   - Impact: practical Vue ergonomics, but less strict callback variance can hide unsafe narrowing.
   - Required: keep helper APIs, but document expected callback input handling and add public type tests for common typed rows.

4. **Datasource and server adapter contracts are strong but not a complete backend extension SDK.**
   - Evidence: core datasource protocol is documented; server adapters expose query codecs and HTTP client helpers.
   - Impact: live updates, retries, offline/reconnect, server grouping/pivot semantics, and optimistic editing require separate integration decisions.
   - Required: align with `docs/SERVER_DATASOURCE_ENTERPRISE_AUDIT.md` before declaring backend integration enterprise-complete.

5. **Public API documentation is spread across multiple files.**
   - Evidence: stable/advanced entrypoints, model contracts, grid API, data source protocol, feature catalog, and migration guide each own part of the story.
   - Impact: maintainers can make API decisions without seeing the full contract surface.
   - Required: add a single public API inventory that links each export group to stable/advanced/internal status.

### Low

1. **Naming still mixes plugin and feature terminology.**
   - Evidence: `DataGridApiPluginDefinition`, `DataGridPlugin`, and `DataGridFeature` describe different systems.
   - Impact: documentation and examples can confuse extension authors.
   - Required: standardize user-facing vocabulary after the canonical model is chosen.

2. **Component expose surface is broader than `DataGridExposed` interface.**
   - Evidence: `expose(...)` includes helpers such as `getCore`, `getColumnSnapshot`, `getSelectionSummary`, `setView`, and `applyColumnState`; not all are represented in the reviewed `DataGridExposed` interface block.
   - Impact: Vue ref consumers may depend on helpers whose public status is unclear.
   - Required: reconcile exposed runtime helpers with exported `DataGridExposed`.

## Correctness and Ownership Risks

- Public API ownership is strongest in core and weaker in integration packages.
- Internal vs public boundaries are documented and enforced for `@affino/datagrid-core`; other public packages still need richer tiering and diff gates.
- Extension ownership is now documented across `api.plugins`, capability-gated plugins, and Vue features; implementation depth still needs future API report gates.
- Service overrides can replace core subsystems from app code; this is useful but must be treated as advanced and lifecycle-sensitive.
- Renderer hooks can return arbitrary Vue children; lifecycle, focus, cleanup, and performance rules are now documented for app-level cell and group renderers.

## Extensibility Quality

- Strong: typed `DataGridApi`, capability introspection, stable events, datasource protocol, renderer contexts, toolbar modules, menu customization, saved views, state import/export, and server adapters.
- Partial: extension conflict detection, extension ordering, plugin state serialization, capability namespacing, and API version negotiation for third-party extensions.
- Unsupported as enterprise contract: a full plugin marketplace model, sandboxed third-party plugins, external plugin manifest/version policy, and cross-extension conflict resolution.

## Package Boundary Risks

- `datagrid-core` is architecturally well separated, and its package export map now blocks forbidden deep import patterns.
- `datagrid-vue` root/stable surface is now documented and guarded; future changes need inventory and entrypoint-tier updates.
- `datagrid-vue-app` is a broad app facade, which is appropriate, but it needs a public-vs-advanced table for props, exposes, and subpath exports.
- `datagrid-orchestration` needs either public tiering or an adapter-internal positioning statement.
- Server adapters and server client are cleanly separated, but they need compatibility notes if their query shapes become public backend contracts.

## Enterprise Readiness Score

Current score: **7.0 / 10**.

Target score: **9.0 / 10**.

Blocks to target:

- API surface diff gate for public packages.
- Orchestration package tiering or explicit adapter-internal positioning.

## Phased Roadmap

### Phase 1: Public API Inventory and Boundary Lock

- Generate an export inventory for `datagrid-core`, `datagrid-vue`, `datagrid-vue-app`, `datagrid-orchestration`, `datagrid-server-adapters`, and `datagrid-server-client`.
- Classify every export as `stable`, `advanced`, `internal`, `deprecated`, or `planned`.
- Keep `docs/datagrid-vue-stable-entrypoint.md` reconciled with `packages/datagrid-vue/src/public.ts`.
- Keep the `@affino/datagrid-core` package export map locked to the tiered entrypoints.
- Add an API report or typed export snapshot check.

### Phase 2: Canonical Extensibility Model

- Keep `api.plugins` as the canonical public extension model.
- Keep `@affino/datagrid-plugins` as the advanced capability-gated runtime foundation and Vue `DataGridFeature` as local composition.
- Maintain lifecycle ordering, cleanup, event delivery, failure isolation, capability namespacing, duplicate handling, dependency ordering, and state serialization policy.
- Add contract tests for plugin ordering, failed setup, failed cleanup, capability denial, and event handler errors.

### Phase 3: Renderer and Customization Safety

- Keep renderer lifecycle docs current for app-level cell/group renderers.
- Keep focus, keyboard, selection, editing, a11y, virtualization remount, async rendering, cleanup, and performance rules covered by component tests.

### Phase 4: Event and Lifecycle Contract

- Keep the event matrix current for `api.events`, Vue component emits, plugin events, feature events, state import events, selection/editing/clipboard events, and error events.
- Keep ordering and reentrancy guarantees covered for each public event family.

### Phase 5: Migration and Compatibility Gates

- Add API diff reports to CI.
- Require migration notes for public surface changes.
- Expand codemod coverage when exports move between stable and advanced tiers.
- Add release checklist entries for API inventory, docs update, and semver classification.

## Recommended Tests

- Unit tests:
  - package export inventory classification
  - plugin duplicate id, dependency order, setup failure, cleanup failure, capability denial
  - event namespace payload typing and reentrancy
  - renderer context normalization
- Type tests:
  - stable root imports only
  - forbidden deep imports fail in published package mode
  - generic row inference through `DataGridProps`, `defineDataGridColumns`, renderers, readers, and plugins
  - API report diff for public `.d.ts`
- Component tests:
  - custom cell renderer with focusable child
  - custom group renderer toggle behavior
  - renderer remount across vertical and horizontal virtualization
  - Vue emits vs `api.events` order for selection/editing/state restore
- Integration tests:
  - datasource adapters with sort/filter/group/quick-filter query mapping
  - app-level `services` override lifecycle
  - plugin registration through `DataGrid` prop and runtime API
- Release checks:
  - `pnpm run quality:api:datagrid:flat`
  - package-level public type check for `@affino/datagrid-vue`
  - API report comparison for public packages
  - docs framework track check

## Prioritized Implementation Slices

1. **API inventory doc and generated export snapshot**
   - Status: completed 2026-05-20.
   - Risk: low
   - Outcome: every public export has an owner and tier.

2. **Core package export map hardening**
   - Status: completed 2026-05-20.
   - Risk: high
   - Outcome: forbidden deep imports are technically blocked or explicitly isolated.

3. **Vue stable surface reconciliation**
   - Status: completed 2026-05-20.
   - Risk: medium
   - Outcome: root exports match stable docs, or docs intentionally commit to current root exports.

4. **Plugin model decision record**
   - Status: completed 2026-05-20.
   - Risk: medium
   - Outcome: one canonical plugin model with bridge rules for `api.plugins`, capability plugins, and Vue features.

5. **Renderer lifecycle contract**
   - Status: completed 2026-05-20.
   - Risk: medium
   - Outcome: custom renderer authors have explicit safety rules and tests.

6. **Event matrix and event-order tests**
   - Status: completed 2026-05-20.
   - Risk: medium
   - Outcome: API events, Vue emits, plugin events, and feature events are predictable.

7. **API diff quality gate**
   - Risk: medium
   - Outcome: public type changes become reviewable release artifacts.

## Risks and Migration Notes

- The core wildcard export was removed; consumers that imported `@affino/datagrid-core/src/*` must migrate to `.`, `./advanced`, or `./internal` using the existing public-protocol codemod guidance.
- Moving documented Vue root exports to `advanced` may be breaking; future movement needs migration notes and a focused API proposal.
- Future plugin work should avoid a new fourth abstraction; keep `api.plugins` as the stable facade and the capability-gated plugin system as the advanced foundation unless a concrete approved gap blocks that path.
- Service override props should remain available for advanced integrators, but their compatibility status must be explicit.
- Renderer lifecycle documentation now describes observable behavior and ownership boundaries; avoid expanding it into implementation-specific guarantees.
