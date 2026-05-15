# DataGrid Open-Core Monetization Pipeline

Baseline date: `2026-03-06`

Goal: split OSS and paid surface before first public release so monetization is possible without later semver pain.

Principles:

- Keep OSS genuinely useful.
- Put monetization on expensive runtime/tooling/integration layers, not on basic usability.
- Do not let OSS packages depend on enterprise packages.
- Prefer additive enterprise packages over hiding/removing already-public OSS API.

## Target package model

OSS packages:

- `@affino/datagrid-core`
- `@affino/datagrid-formula-engine`
- `@affino/datagrid-pivot`
- `@affino/datagrid-vue`
- `@affino/datagrid-vue-app`
- `@affino/datagrid-orchestration`
- `@affino/datagrid-laravel`
- `@affino/datagrid-laravel-app`
- `@affino/datagrid-theme`

Enterprise packages:

- `@affino/datagrid-vue-app-enterprise`
- `@affino/datagrid-formula-engine-enterprise`
- `@affino/datagrid-pivot-enterprise`
- `@affino/datagrid-diagnostics-enterprise`
- `@affino/datagrid-worker-enterprise`

## OSS vs Paid boundary

Keep in OSS:

- client row model
- projection pipeline
- base formulas
- selection / history / clipboard / navigation
- base grouping / pivot engine
- base datasource contracts
- basic adapters
- CSV/text export

Move to paid:

- SSRM v2 / hierarchical stores / block cache policy
- advanced formula runtime tiers
- enterprise worker/performance runtime
- native Excel export/import
- advanced devtools / profiler / inspector
- premium pivot/group/filter UI shells
- collaboration / audit / sync layers
- premium vector/fusion execution track if monetized separately

Do not try to move to paid after release:

- formulas
- selection
- clipboard
- history
- navigation
- basic grouping/pivot runtime

## Commercial candidate map

Highest-value candidates:

1. `advanced server data / SSRM v2`
2. `advanced pivot`
3. `diagnostics / devtools / profiler`
4. `worker / ultra-perf runtime`
5. `advanced tree data`
6. `advanced filtering`
7. `native Excel export`

Good paid candidates:

- `advanced formula runtime`
  - worker-owned formula execution
  - premium vector / fused execution tiers
  - formula profiler / explain tooling
  - enterprise compute policies
- `advanced server data`
  - hierarchical stores
  - block cache policy
  - server grouping / pivot / tree stores
  - remote filter-values
  - streaming / partial refresh
- `advanced pivot`
  - high-cardinality optimization
  - incremental pivot patch tiers
  - premium pivot runtime perf
  - pivot panels / pivot UX
- `advanced tree data`
  - huge hierarchy optimization
  - server-backed tree
  - advanced structural patch optimization
  - lazy children loading
- `diagnostics / devtools / profiler`
  - projection inspector
  - invalidation trace
  - compute / pivot / tree profiler
  - cache diagnostics
  - explain tooling
- `advanced filtering`
  - filter builder UI
  - saved filters
  - remote distinct values
  - enterprise filter presets / policies
- `worker / ultra-perf runtime`
  - worker compute orchestration
  - background snapshot recompute
  - premium fused / vector runtime tiers
- `native Excel export`
  - xlsx export
  - import bridge if pursued

Keep in OSS for adoption:

- base tree data
- base pivot runtime
- base filtering DSL
- base formulas
- selection / clipboard / history / navigation

Recommended package targets:

- `@affino/datagrid-formula-engine-enterprise`
- `@affino/datagrid-vue-app-enterprise`
- `@affino/datagrid-pivot-enterprise`
- `@affino/datagrid-diagnostics-enterprise`
- `@affino/datagrid-worker-enterprise`

Commercial prioritization checklist:

1. [x] Freeze `@affino/datagrid-formula-engine` as community-safe formula API boundary.
2. [x] Freeze `@affino/datagrid-pivot` as community-safe pivot API boundary.
3. [ ] Validate `advanced server data` as first enterprise moat.
4. [ ] Validate `advanced pivot` as second enterprise moat.
5. [ ] Validate `diagnostics/devtools` as third enterprise moat.
6. [ ] Decide whether `advanced tree data` ships as a separate package or inside the enterprise app/runtime bundle.
7. [ ] Decide whether premium app diagnostics move first through `@affino/datagrid-vue-app-enterprise`.
8. [ ] Decide whether premium worker/vector runtime is sold standalone or bundled into the enterprise app/runtime bundle.
9. [ ] Keep OSS story strong enough that adoption is not damaged.

## Phase 0: Boundary Freeze

Goal: freeze what is allowed to be OSS forever vs what is allowed to become enterprise.

Checklist:

1. [ ] Freeze OSS adoption surface list.
2. [ ] Freeze enterprise monetization surface list.
3. [ ] Mark current exports as `keep OSS`, `move to enterprise`, or `needs decision`.
4. [x] Add package-boundary decision doc links to core/vue/laravel README files.

Exit criteria:

- Every exported surface is classified before first release.

## Phase 1: Boundary Rules and Guardrails

Goal: make boundary leakage mechanically hard.

Checklist:

1. [ ] Add `docs/datagrid-open-core-boundary.md` with package ownership rules.
2. [ ] Add quality gate: OSS packages must not import enterprise packages.
3. [ ] Add quality gate: OSS docs/examples must not import enterprise packages.
4. [ ] Add quality gate: enterprise packages may depend on OSS, never the reverse.
5. [ ] Add acceptance report artifact for boundary leakage checks.

Exit criteria:

- Boundary violations fail quality gates automatically.

## Phase 2: Narrow OSS Root Public Surface

Goal: stop over-exporting advanced/server/commercial candidates from OSS root entrypoints.

Checklist:

1. [ ] Audit [public.ts](/Users/anton/Projects/affinio/datagrid/packages/datagrid-core/src/public.ts).
2. [ ] Audit [advanced.ts](/Users/anton/Projects/affinio/datagrid/packages/datagrid-core/src/advanced.ts).
3. [ ] Audit [public.ts](/Users/anton/Projects/affinio/datagrid/packages/datagrid-vue/src/public.ts).
4. [ ] Audit [index.ts](/Users/anton/Projects/affinio/datagrid/packages/datagrid-laravel/resources/js/index.ts).
5. [ ] Remove enterprise-candidate exports from OSS root facades before first release.
6. [ ] Keep OSS stable root semver-safe and intentionally narrow.
7. [ ] Update docs/examples to use only the surviving OSS public surface.

Current known candidates to review:

- `createDataSourceBackedRowModel`
- `createServerBackedRowModel`
- `createServerRowModel`
- `createDataGridServerPivotRowId`
- worker-owned runtime helpers

Exit criteria:

- Root OSS entrypoints export only what is intended to stay free long-term.

## Phase 3: Create Enterprise Package Skeletons

Goal: create additive package homes before moving expensive features.

Checklist:

1. [x] Add `packages/datagrid-formula-engine` as the first extracted OSS engine package.
2. [x] Define community vs enterprise formula-engine boundary before first release.
3. [x] Add `packages/datagrid-pivot` as community-safe pivot package boundary.
4. [x] Define community vs enterprise pivot boundary before first release.
5. [x] Create `packages/datagrid-vue-app-enterprise`.
6. [x] Create `packages/datagrid-diagnostics-enterprise`.
7. [ ] Create `packages/datagrid-worker-enterprise`.
9. [x] Create `packages/datagrid-formula-engine-enterprise`.
10. [x] Create `packages/datagrid-pivot-enterprise`.
11. [ ] Decide whether `export-xlsx` stays community or needs an enterprise-only companion package.
12. [ ] Add workspace package manifests and build/type-check scripts.
13. [ ] Add repository/homepage/license metadata.
14. [ ] Add placeholder README files explaining OSS vs enterprise role.

Exit criteria:

- Enterprise packages build as empty/additive shells inside the monorepo.

## Phase 4: Move First Paid Surfaces

Goal: move the easiest and most defensible monetization targets first.

Checklist:

1. [ ] Move native Excel export into `@affino/datagrid-export-excel`.
2. [ ] Move premium worker/performance runtime into `@affino/datagrid-enterprise-worker`.
3. [ ] Move enterprise devtools/profiler/inspector into enterprise package(s).
4. [ ] Keep OSS integration points additive, not broken.
5. [ ] Update sandbox/demo to consume enterprise packages where needed.

Exit criteria:

- First monetizable capabilities exist outside OSS packages.

## Phase 5: Build Enterprise-Core Track

Goal: place future high-value engine work directly in enterprise packages instead of leaking it into OSS root.

Checklist:

1. [ ] Build SSRM v2 in `@affino/datagrid-enterprise-core`.
2. [ ] Add hierarchical store runtime and block cache policy there.
3. [ ] Add premium datasource/store diagnostics there.
4. [ ] Add enterprise sync/audit/collaboration runtime there if pursued.
5. [ ] Keep OSS datasource protocol compatible but simpler.

Exit criteria:

- Core monetization moat exists in enterprise-core, not as ad-hoc OSS exports.

## Phase 6: Build Enterprise Adapter Surfaces

Goal: expose premium UX/tooling without polluting OSS adapters.

Checklist:

1. [ ] Add `@affino/datagrid-enterprise-vue` premium panels/tooling.
2. [ ] Add `@affino/datagrid-enterprise-laravel` premium facade/integration helpers.
3. [ ] Add enterprise docs/examples separate from OSS docs/examples.
4. [ ] Mark enterprise demos clearly inside sandbox routes.

Exit criteria:

- Premium UX/tooling has a clear package home and docs story.

## Phase 7: Release and Packaging Readiness

Goal: be able to release OSS and paid independently.

Checklist:

1. [ ] Add OSS vs enterprise publish policy doc.
2. [ ] Add release scripts/workflows for enterprise packages.
3. [ ] Add package-boundary checks to architecture acceptance.
4. [ ] Add commercial/readiness checks that match the real package structure.
5. [ ] Verify monorepo can build OSS-only and OSS+enterprise variants.

Exit criteria:

- OSS and enterprise can be versioned and shipped independently.

## Recommended execution order

1. [ ] Phase 0
2. [ ] Phase 1
3. [ ] Phase 2
4. [ ] Phase 3
5. [ ] Phase 4
6. [ ] Phase 5
7. [ ] Phase 6
8. [ ] Phase 7

## Definition of Done

All of the following must be true:

1. [ ] OSS packages build and function without enterprise dependencies.
2. [ ] Enterprise packages depend on OSS packages, never the reverse.
3. [ ] Root OSS exports are intentionally narrow and future-safe.
4. [ ] First monetizable capabilities live only in enterprise packages.
5. [ ] Docs, demos, and quality checks clearly separate OSS from enterprise.
6. [ ] Release workflows and commercial checks match the actual monorepo structure.
