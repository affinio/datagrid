# DataGrid Public API Enterprise Implementation Plan

This plan converts `docs/audits/API_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current package boundaries remain the baseline: core owns framework-agnostic runtime contracts, Vue owns adapter/composable integration, Vue app owns mounted component contracts, orchestration owns shared interaction primitives, and server packages own backend integration helpers.

Current execution state:

- Slices 1-5 are implemented as of 2026-05-20.
- The first API inventory is now generated under `docs/quality/datagrid-public-api-inventory.json` and summarized in `docs/datagrid-public-api-inventory.md`.
- Remaining blockers are event matrix coverage, orchestration package tiering, and API diff gates.
- Do not change public API or package export maps without a focused slice and migration notes.

## Slice 1: API Inventory And Export Snapshot

- Status: Completed on 2026-05-20.
- Objective: create a current-state public API inventory and a generated export snapshot before changing package boundaries.
- Affected packages/files:
  - `scripts/check-datagrid-public-api-inventory.mjs`
  - `docs/quality/datagrid-public-api-inventory.json`
  - `docs/datagrid-public-api-inventory.md`
  - `docs/audits/API_ENTERPRISE_AUDIT.md`
  - `docs/README.md`
  - `package.json`
- Expected behavior change: no runtime behavior change; API surface changes now have a package export inventory baseline.
- Tests to add/update:
  - Inventory check for tracked package exports, tier classification, source entrypoint mapping, and baseline drift.
- Validation command: `pnpm run quality:api:datagrid:inventory`
- Risk level: Low
- Suggested commit message: `docs(datagrid): inventory public api surfaces`

## Slice 2: Core Package Export Map Hardening

- Status: Completed on 2026-05-20.
- Objective: resolve the `@affino/datagrid-core` wildcard export so forbidden deep imports cannot silently become public API.
- Affected packages/files:
  - `packages/datagrid-core/package.json`
  - `packages/datagrid-core/src/protocol/__tests__/entrypointTiers.contract.spec.ts`
  - `scripts/codemods/datagrid-public-protocol-codemod.mjs`
  - `docs/datagrid-versioned-public-protocol.md`
  - `docs/datagrid-migration-guide.md`
  - `docs/datagrid-public-api-inventory.md`
- Expected behavior change: package import behavior may change for unsupported deep imports; stable, advanced, and internal entrypoints remain supported.
- Tests to add/update:
  - Published-package import assertions for allowed root/advanced/internal entrypoints.
  - Forbidden deep-import assertions or documented development-only exception coverage.
- Validation command: `pnpm --filter @affino/datagrid-core test:contracts && pnpm run quality:api:datagrid:inventory`
- Risk level: High
- Suggested commit message: `fix(datagrid-core): harden public export boundaries`

## Slice 3: Vue Stable Surface Reconciliation

- Status: Completed on 2026-05-20.
- Objective: make `@affino/datagrid-vue` root/stable exports match the stable-entrypoint documentation or explicitly classify current root exports.
- Affected packages/files:
  - `packages/datagrid-vue/src/index.ts`
  - `packages/datagrid-vue/src/stable.ts`
  - `packages/datagrid-vue/src/public.ts`
  - `docs/datagrid-vue-stable-entrypoint.md`
  - `docs/datagrid-vue-advanced-entrypoint.md`
  - `docs/datagrid-public-api-inventory.md`
- Expected behavior change: no runtime behavior change unless exports are moved; any export movement requires migration notes.
- Tests to add/update:
  - Public type/import checks for stable and advanced Vue entrypoints.
  - Inventory drift check for root/stable classification.
- Validation command: `pnpm --filter @affino/datagrid-vue type-check:public && pnpm run quality:api:datagrid:inventory`
- Risk level: Medium
- Suggested commit message: `docs(datagrid-vue): reconcile stable api surface`

## Slice 4: Canonical Plugin Model Decision

- Status: Completed on 2026-05-20.
- Objective: designate the canonical plugin/extension model and define bridge rules for `api.plugins`, `@affino/datagrid-plugins`, and Vue `DataGridFeature`.
- Affected packages/files:
  - `docs/datagrid-plugin-capability-model.md`
  - `docs/datagrid-grid-api.md`
  - `packages/datagrid-core/src/core/gridApiContracts.ts`
  - `packages/datagrid-core/src/core/gridApiPluginsRuntime.ts`
  - `packages/datagrid-plugins/src/types.ts`
  - `packages/datagrid-vue/src/grid/createGrid.ts`
- Expected behavior change: no default runtime behavior change; plugin authors get one documented lifecycle and compatibility model.
- Tests to add/update:
  - Plugin duplicate id, setup failure, cleanup failure, capability denial, event handler error, and ordering contracts.
- Validation command: `pnpm --filter @affino/datagrid-core test:contracts`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): define plugin lifecycle contract`

## Slice 5: Renderer Lifecycle Contract

- Status: Completed on 2026-05-20.
- Objective: document and test custom renderer lifecycle, focus, keyboard, selection, editing, a11y, remount, async, cleanup, and performance expectations.
- Affected packages/files:
  - `docs/datagrid-renderer-lifecycle.md`
  - `packages/datagrid-vue-app/src/config/dataGridFormulaOptions.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `packages/datagrid-vue-app/README.md`
- Expected behavior change: custom renderer semantics become explicit; runtime changes only if tests reveal current contract gaps.
- Tests to add/update:
  - Focusable custom renderer child.
  - Group renderer toggle behavior.
  - Vertical/horizontal virtualization remount continuity.
  - Interactive renderer activation and cleanup.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts`
- Risk level: Medium
- Suggested commit message: `docs(datagrid-vue-app): define renderer lifecycle`

## Slice 6: Event Matrix And Event-Order Coverage

- Status: Planned.
- Objective: document event sources, payloads, ordering, reentrancy, and preferred integration path across `api.events`, Vue emits, plugin events, and feature-local events.
- Affected packages/files:
  - `docs/datagrid-event-matrix.md`
  - `docs/datagrid-grid-api.md`
  - `packages/datagrid-core/src/core/gridApiContracts.ts`
  - `packages/datagrid-vue-app/src/DataGrid.ts`
  - `packages/datagrid-vue/src/grid/createGrid.ts`
- Expected behavior change: event semantics become predictable; runtime changes only if ordering gaps are found.
- Tests to add/update:
  - Representative selection/edit/state event order across API facade and Vue emits.
  - Reentrancy/error handling contracts for plugin/feature events.
- Validation command: `pnpm --filter @affino/datagrid-core test:contracts && pnpm --filter @affino/datagrid-vue-app test:unit`
- Risk level: Medium
- Suggested commit message: `test(datagrid): cover public event ordering`

## Slice 7: API Diff Quality Gate

- Status: Planned.
- Objective: add a declaration-level API diff/report gate for public packages so semver-relevant type changes are reviewable.
- Affected packages/files:
  - `scripts/check-datagrid-api-report.mjs`
  - `docs/quality/*api-report*.json`
  - `package.json`
  - `docs/datagrid-public-api-inventory.md`
  - `docs/datagrid-migration-guide.md`
- Expected behavior change: no runtime behavior change; public type changes become a release artifact.
- Tests to add/update:
  - API report generation and baseline comparison for core, Vue, Vue app, orchestration, server adapters, and server client.
- Validation command: `pnpm run quality:api:datagrid:report`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate public api reports`

## Recommended Execution Order

1. Slice 1: API Inventory And Export Snapshot (completed 2026-05-20)
2. Slice 2: Core Package Export Map Hardening (completed 2026-05-20)
3. Slice 3: Vue Stable Surface Reconciliation (completed 2026-05-20)
4. Slice 4: Canonical Plugin Model Decision (completed 2026-05-20)
5. Slice 5: Renderer Lifecycle Contract (completed 2026-05-20)
6. Slice 6: Event Matrix And Event-Order Coverage
7. Slice 7: API Diff Quality Gate

## Execution Notes

- Public API changes require migration notes before implementation unless the slice is docs-only.
- Prefer tightening existing tiered entrypoints over adding new facades.
- Do not create a fourth plugin model; choose or bridge the existing models.
- Keep generated inventory checks small and deterministic until a declaration-level API report gate exists.
