# DataGrid Public API and Extensibility Enterprise Audit

Date: `2026-05-16`
Scope: public API boundaries, extension points, renderer APIs, datasource APIs, events, plugin readiness, typing, lifecycle, package boundaries, and migration safety across the DataGrid packages.

## Executive Summary

DataGrid has a strong enterprise API foundation: `DataGridApi` is namespaced, documented, version-aware, and backed by contract tests; core/Vue stable and advanced entrypoints are documented; datasource and row/column model contracts are explicit; and the app-facing Vue component exposes production-shaped props, events, imperative helpers, renderer hooks, state persistence, and saved-view helpers.

Current readiness is not yet enterprise-grade for a public extension ecosystem. The main blockers are boundary enforcement and extension-model coherence: `@affino/datagrid-core` still exposes a package wildcard that can make forbidden deep imports reachable, Vue stable exports do not fully match the stable-entrypoint documentation, and there are at least three extension models (`api.plugins`, `@affino/datagrid-plugins`, and Vue `createGrid` features) without one canonical public plugin lifecycle. These are solvable without inventing a parallel architecture: tighten the existing tiered entrypoints, publish an API inventory, and converge extension contracts around the current `DataGridApi` facade plus the capability-gated plugin runtime.

Enterprise readiness score: **7.0 / 10**.
Target score: **9.0 / 10**.
The target is blocked by public boundary enforcement, plugin lifecycle unification, renderer lifecycle guarantees, and API-diff quality gates across all public packages.

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

1. **Public boundary enforcement is not complete for `@affino/datagrid-core`.**
   - Evidence: `packages/datagrid-core/package.json` exports `"./*": { "types": "./src/*.ts", "import": "./src/*.ts" }`, while `docs/datagrid-versioned-public-protocol.md` says paths outside the tiered entrypoints are not public and explicitly forbids examples such as `@affino/datagrid-core/viewport/*`.
   - Impact: external users can rely on alternate deep paths that bypass the stable/advanced/internal entrypoints, turning internals into de facto public API.
   - Required: remove or narrow the wildcard export, or document it as development-only with a package-level enforcement strategy before declaring enterprise public API stability.

2. **Plugin readiness is split across three extension models.**
   - Evidence: `DataGridApiPluginDefinition` in `gridApiContracts.ts` supports `id`, `onRegister`, `onDispose`, and `onEvent`; `@affino/datagrid-plugins` defines capability-gated `setup(context)` plugins; Vue `createGrid` defines feature registration with `requires`, local events, and cleanup.
   - Impact: integrators cannot tell which plugin model is canonical for enterprise extensions, capability negotiation, lifecycle ordering, state serialization, or compatibility.
   - Required: designate one public plugin model and define bridge/deprecation rules for the other two.

### High

1. **Vue stable-entrypoint docs and root exports are out of sync.**
   - Evidence: `docs/datagrid-vue-stable-entrypoint.md` lists the stable surface and says no advanced hooks are part of it; `packages/datagrid-vue/src/public.ts` additionally exports `useDataGridSelectionOverlayOrchestration`, `createGrid`, `useAffinoGrid`, engine/view/context providers, selectors, and `DataGridRuntimeOverrides`.
   - Impact: semver commitments are ambiguous because undocumented root exports may be treated as stable by consumers.
   - Required: either document these as stable, move them to `advanced`, or add a compatibility plan.

2. **`@affino/datagrid-orchestration` has a broad public root surface without a tiered contract.**
   - Evidence: `packages/datagrid-orchestration/src/index.ts` re-exports many domain modules from root, and `package.json` exposes only `"."`.
   - Impact: low-level interaction primitives can become public by accident, increasing long-term compatibility cost.
   - Required: define stable vs advanced orchestration exports or document this package as adapter-internal.

3. **Renderer lifecycle guarantees are partial.**
   - Evidence: renderer context types are exported from `dataGridFormulaOptions.ts`, and tests cover render output and interactive activation; no reviewed doc defines mount/unmount cleanup, virtualization remount behavior, focus ownership inside custom renderers, async renderer expectations, or performance budgets.
   - Impact: custom renderers can break selection, editing, focus, a11y, and scroll performance under virtualization.
   - Required: publish a renderer lifecycle and safety contract, with tests for focusable custom children and virtual remounts.

4. **Event APIs are coherent in core but fragmented across integration layers.**
   - Evidence: `api.events.on` is typed in `gridApiContracts.ts`; `DataGrid.ts` separately emits Vue events such as `cell-change`, `cell-edit`, `selection-change`, `row-selection-change`, and model update events; Vue `createGrid` has a stringly local event bus.
   - Impact: integrators may duplicate listeners or miss ordering guarantees across API events, Vue emits, and local feature events.
   - Required: document an event matrix with source, payload, ordering, reentrancy, and preferred integration path.

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
- Internal vs public boundaries are documented but undermined by the core wildcard export.
- Extension ownership is unclear because plugin registration, capability-gated plugins, and feature registration overlap.
- Service overrides can replace core subsystems from app code; this is useful but must be treated as advanced and lifecycle-sensitive.
- Renderer hooks can return arbitrary Vue children; without a lifecycle/focus contract, they can interfere with grid-owned selection, editing, keyboard navigation, and accessibility.

## Extensibility Quality

- Strong: typed `DataGridApi`, capability introspection, stable events, datasource protocol, renderer contexts, toolbar modules, menu customization, saved views, state import/export, and server adapters.
- Partial: plugin lifecycle, renderer lifecycle, extension conflict detection, extension ordering, plugin state serialization, capability namespacing, and API version negotiation for third-party extensions.
- Unsupported as enterprise contract: a full plugin marketplace model, sandboxed third-party plugins, external plugin manifest/version policy, and cross-extension conflict resolution.

## Package Boundary Risks

- `datagrid-core` is architecturally well separated, but its package export map still permits forbidden deep import patterns.
- `datagrid-vue` root is larger than the stable-entrypoint doc suggests.
- `datagrid-vue-app` is a broad app facade, which is appropriate, but it needs a public-vs-advanced table for props, exposes, and subpath exports.
- `datagrid-orchestration` needs either public tiering or an adapter-internal positioning statement.
- Server adapters and server client are cleanly separated, but they need compatibility notes if their query shapes become public backend contracts.

## Enterprise Readiness Score

Current score: **7.0 / 10**.

Target score: **9.0 / 10**.

Blocks to target:

- Enforced package export boundaries for stable, advanced, and internal surfaces.
- Single canonical plugin/extensibility lifecycle.
- API surface diff gate for public packages.
- Renderer lifecycle and customization safety contract.
- Event matrix across core API, Vue emits, and feature/plugin events.
- Public inventory that reconciles docs with real exports.

## Phased Roadmap

### Phase 1: Public API Inventory and Boundary Lock

- Generate an export inventory for `datagrid-core`, `datagrid-vue`, `datagrid-vue-app`, `datagrid-orchestration`, `datagrid-server-adapters`, and `datagrid-server-client`.
- Classify every export as `stable`, `advanced`, `internal`, `deprecated`, or `planned`.
- Reconcile `docs/datagrid-vue-stable-entrypoint.md` with `packages/datagrid-vue/src/public.ts`.
- Resolve the `@affino/datagrid-core` wildcard package export.
- Add an API report or typed export snapshot check.

### Phase 2: Canonical Extensibility Model

- Choose the canonical public extension model.
- Map `api.plugins`, `@affino/datagrid-plugins`, and Vue `DataGridFeature` into stable/advanced/internal roles.
- Define lifecycle ordering, cleanup, event delivery, failure isolation, capability namespacing, duplicate handling, dependency ordering, and state serialization policy.
- Add contract tests for plugin ordering, failed setup, failed cleanup, capability denial, and event handler errors.

### Phase 3: Renderer and Customization Safety

- Publish renderer lifecycle docs for app-level cell/group renderers.
- Define focus, keyboard, selection, editing, a11y, virtualization remount, async rendering, cleanup, and performance rules.
- Add component tests for custom focusable renderers, group renderers, virtual remount continuity, and interactive cell actions.

### Phase 4: Event and Lifecycle Contract

- Create an event matrix covering `api.events`, Vue component emits, plugin events, feature events, state import events, selection/editing/clipboard events, and error events.
- Document ordering and reentrancy guarantees for each event family.
- Add tests for representative event order across API facade and Vue component emits.

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
   - Risk: low
   - Outcome: every public export has an owner and tier.

2. **Core package export map hardening**
   - Risk: high
   - Outcome: forbidden deep imports are technically blocked or explicitly isolated.

3. **Vue stable surface reconciliation**
   - Risk: medium
   - Outcome: root exports match stable docs, or docs intentionally commit to current root exports.

4. **Plugin model decision record**
   - Risk: medium
   - Outcome: one canonical plugin model with bridge rules for `api.plugins`, capability plugins, and Vue features.

5. **Renderer lifecycle contract**
   - Risk: medium
   - Outcome: custom renderer authors have explicit safety rules and tests.

6. **Event matrix and event-order tests**
   - Risk: medium
   - Outcome: API events, Vue emits, plugin events, and feature events are predictable.

7. **API diff quality gate**
   - Risk: medium
   - Outcome: public type changes become reviewable release artifacts.

## Risks and Migration Notes

- Removing the core wildcard export can break consumers that imported `@affino/datagrid-core/src/*`; use the existing public-protocol codemod and a deprecation window if those consumers exist.
- Moving undocumented Vue root exports to `advanced` may be breaking if external consumers already use them.
- Unifying plugin models should avoid a new fourth abstraction; prefer designating the existing capability-gated plugin system as the advanced plugin foundation and keeping `api.plugins` as the stable facade unless a concrete gap blocks that path.
- Service override props should remain available for advanced integrators, but their compatibility status must be explicit.
- Renderer lifecycle documentation should avoid over-constraining implementation details; document observable behavior and ownership boundaries instead.
