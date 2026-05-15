# DataGrid AG-Style Architecture Acceptance Checklist

Baseline date: `2026-03-06`
Scope: `packages/datagrid-core`, `packages/datagrid-vue`, CI quality gates, docs contracts.
Goal: keep the grid architecture at an enterprise-grade bar and prevent silent regressions in public/runtime contracts.

## Acceptance checklist

- [x] Public API is versioned and guarded by contract tests.
- [x] Stable/advanced/components entrypoints are documented and deep imports are treated as protocol violations.
- [x] Grid runtime exposes typed event routing and contract coverage for runtime/plugin boundaries.
- [x] Client row model has deterministic projection stages, diagnostics, and strict contract tests.
- [x] Tree/group/pivot/aggregate semantics are covered by focused unit/contract suites.
- [x] Vue adapter preserves headless ownership boundaries and framework-track docs do not leak core/orchestration imports.
- [x] Flat API usage is tracked by a baseline lock and checked in architecture quality gates.
- [x] Cross-framework parity is enforced by a blocking CI `quality-gates` job.
- [x] CI installs Playwright before parity runs and publishes `artifacts/quality` plus `artifacts/performance`.
- [x] Performance gates emit machine-readable reports under `artifacts/quality` and `artifacts/performance`.
- [x] Commercial/package boundary checks run as part of the datagrid architecture quality suite.
- [x] Migration docs, model contracts, service registry docs, and strict contract testing docs are present.

## Current gaps to close toward top-tier

- [ ] Column groups runtime is first-class, not only typed.
- [ ] Server-side row model has hierarchical stores and partial refresh semantics.
- [ ] Editing is a first-class subsystem with validation and commit lifecycle.
- [ ] Layout/state snapshots are versioned, migratable, and separated from row data snapshots.
- [ ] Row pinning has runtime/API semantics, not only row-state typing.
- [ ] Aggregation registry, comparator policy, and quick/global filter are first-class core services.

## Quality gate references

- Architecture acceptance: `pnpm run quality:architecture:datagrid`
- Performance contracts: `pnpm run quality:perf:datagrid`
- Full parity lock: `pnpm run quality:lock:datagrid:parity`
- Flat API baseline lock: `pnpm run quality:api:datagrid:flat`
