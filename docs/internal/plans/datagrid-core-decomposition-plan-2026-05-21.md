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
| P0 | Client row-model composition root cleanup | Keep `clientRowModel` as wiring-only by moving local domain policy into existing host/state/projection runtimes | done |
| P0 | Spreadsheet sheet runtime | Split sheet state, formula runtime, structural mutations, style runtime | done |
| P1 | Spreadsheet workbook runtime | Split graph/scheduler/sync/persistence ownership without reintroducing row-model workbook API | planned |
| P1 | View pipeline stage ownership | Split filter/sort/project/join/group/pivot stages behind existing materializers | planned |
| P1 | Viewport controller pipeline | Split measurement, model binding, update sequencing while preserving one scroll owner | planned |
| P2 | Tree projection runtime | Split path and parent projection engines behind `createTreeProjectionRuntime()` | planned |

## Current Slice: Spreadsheet Sheet Runtime

Objective: keep `sheetModel.ts` as the spreadsheet sheet facade while moving stable helper/storage responsibilities into named internal runtimes.

Completed:

- Extracted cell value/input/address helpers into `spreadsheetCellRuntime`.
- Extracted sparse raw-input and cell-style storage into `spreadsheetCellStoreRuntime`.
- Extracted formula table key normalization into `spreadsheetFormulaTableRuntime`.
- Extracted formula runtime types, structural snapshots, dependency closure, preservation checks, row-offset analysis shifts, and diagnostic error helpers into `spreadsheetFormulaRuntime`.
- Extracted mutation snapshot cloning into `spreadsheetMutationSnapshotRuntime`.
- Extracted sheet/column reference normalization and lookup into `spreadsheetReferenceRuntime`.
- Extracted row/column state initialization, indexes, resolved-value helpers, and address resolution into `spreadsheetSheetStateRuntime`.
- Extracted style normalization, merge, and sheet-state equivalence helpers into `spreadsheetStyleRuntime`.
- Extracted row insert/remove and column rename formula rewrite policy into `spreadsheetStructuralMutationRuntime`.
- Added focused helper tests and kept existing sheet/formula behavior tests green.

Remaining non-blocking candidates:

- Move formula evaluation context and same-shape restore orchestration only if the next formula/restore feature touches those paths.
- Move export/restore state builders into a dedicated persistence helper if spreadsheet persistence changes again.

Validation target:

- `pnpm --filter @affino/datagrid-core type-check`
- focused spreadsheet helper and sheet/formula tests
- `pnpm run quality:architecture:datagrid`

## Previous Slice: Client Row-Model Composition Root

Objective: make `clientRowModel.ts` read as orchestration, not as a place where new domain policy accumulates.

Rules:

- Do not change `CreateClientRowModelOptions` or `ClientRowModel`.
- Keep local helpers only when they are primitive wiring guards.
- Move formula, mutation, snapshot, projection, materialization, and cache policy into the matching internal runtime.
- Avoid adding a runtime unless the responsibility has an explicit lifecycle or policy boundary.

Completed:

- Extracted formula table patching and context invalidation into `clientRowFormulaTableHostRuntime`.
- Moved materialized source-row cache ownership into `clientRowMaterializationRuntime`.
- Moved calculation snapshot restore orchestration into `clientRowCalculationSnapshotRestoreRuntime`.
- Extracted column histogram read-policy into `clientRowColumnHistogramRuntime`.
- Extracted pivot drilldown facade wiring into `clientRowPivotDrilldownHostRuntime`.
- Extracted computed apply/materialization refresh policy into `clientRowComputedApplyRuntime`.
- Extracted computed recompute/projection refresh orchestration into `clientRowComputedRefreshRuntime`.
- Extracted row-model dispose cleanup into `clientRowDisposeHostRuntime`.
- Extracted row-model runtime constants and guards into `clientRowModelRuntimeConfig`.
- Extracted initial/manual refresh policy into `clientRowRefreshHostRuntime`.
- Extracted row access, row mutation facade, and calculation snapshot facade methods into focused host runtimes.
- Extracted formula/computed public facade methods into `clientRowFormulaFacadeRuntime`.

Next candidates:

- Move row-model public facade method groups into narrow host delegates only where this reduces local branching.

Validation target:

- `pnpm --filter @affino/datagrid-core type-check`
- focused `clientRowModel.spec.ts`
- `pnpm run quality:architecture:datagrid`
