# DataGrid Core Decomposition Plan

Date: `2026-05-21`
Scope: `packages/datagrid-core`
Status: active

## Principles

- Keep public package APIs stable unless a separate API proposal is approved.
- Keep current facade functions as composition roots: they should wire services and expose the public contract.
- Extract only responsibilities that already have clear ownership, tests, and stable inputs.
- Prefer small host/runtime modules over broad manager layers.
- Validate every slice with the smallest focused package checks before wider gates.

## Slice Order

| Priority | Slice | Target | Status |
| --- | --- | --- | --- |
| P0 | Server datasource runtime ownership | `dataSourceBackedRowModel` cache, transport, invalidation, telemetry, optimistic mutations | done in Track 1 |
| P0 | Client row-model composition root cleanup | Keep `clientRowModel` as wiring-only by moving local domain policy into existing host/state/projection runtimes | active |
| P0 | Spreadsheet sheet runtime | Split sheet state, formula runtime, structural mutations, style runtime | planned |
| P1 | Spreadsheet workbook runtime | Split graph/scheduler/sync/persistence ownership without reintroducing row-model workbook API | planned |
| P1 | View pipeline stage ownership | Split filter/sort/project/join/group/pivot stages behind existing materializers | planned |
| P1 | Viewport controller pipeline | Split measurement, model binding, update sequencing while preserving one scroll owner | planned |
| P2 | Tree projection runtime | Split path and parent projection engines behind `createTreeProjectionRuntime()` | planned |

## Current Slice: Client Row-Model Composition Root

Objective: make `clientRowModel.ts` read as orchestration, not as a place where new domain policy accumulates.

Rules:

- Do not change `CreateClientRowModelOptions` or `ClientRowModel`.
- Keep local helpers only when they are primitive wiring guards.
- Move formula, mutation, snapshot, projection, materialization, and cache policy into the matching internal runtime.
- Avoid adding a runtime unless the responsibility has an explicit lifecycle or policy boundary.

Completed:

- Extracted formula table patching and context invalidation into `clientRowFormulaTableHostRuntime`.

Next candidates:

- Move calculation snapshot restore orchestration behind snapshot host runtime if its inputs can stay explicit.
- Move materialized source-row cache ownership into materialization runtime.
- Move row-model public facade method groups into narrow host delegates only where this reduces local branching.

Validation target:

- `pnpm --filter @affino/datagrid-core type-check`
- focused `clientRowModel.spec.ts`
- `pnpm run quality:architecture:datagrid`
