# Datagrid Spreadsheet Runtime Refactor Pipeline

Date: 2026-03-12

## Goal

Move spreadsheet runtime from a sheet-centric editor model toward a graph-centric runtime model that can realistically hit workbook performance budgets.

This document is a working pipeline. Close one logical block at a time. After each block:

- run the required tests
- run the required benchmark
- compare against the current baseline
- only then start the next block

## Current Baseline

Reference run: `artifacts/performance/bench-datagrid-spreadsheet-workbook.assert.*` generated 2026-03-12 07:07.

- `workbook.sync() p95`: `302.540 ms`
- `rematerialization p95`: `587.982 ms`
- `cross-sheet recompute p95`: `231.340 ms`
- `directRefRewrite.insert p95`: `1848.126 ms`
- `directRefRewrite.remove p95`: `1992.597 ms`
- `restore p95`: `1662.038 ms`
- `heap p95`: `417.776 MB`

## Working Rules

- One block in progress at a time.
- No broad refactors across unrelated areas in the same block.
- Keep editor/export behavior stable unless the block explicitly changes the contract.
- Prefer feature flags or dual-runtime compatibility during migration.
- Any block that regresses correctness or widens benchmark variance must be rolled back or split smaller.

## Global Gates

Required tests for every block:

- `pnpm --filter @affino/datagrid-core build`
- `pnpm --filter @affino/datagrid-core test:file -- src/spreadsheet/__tests__/formulaEditorModel.spec.ts src/spreadsheet/__tests__/sheetModel.spec.ts src/spreadsheet/__tests__/workbookModel.spec.ts`

Required benchmark for every block:

- `pnpm run bench:datagrid:spreadsheet-workbook:assert`

Always check:

- `generated pivot columns`
- `summaryPivotValue`
- `orders-enriched/orders-contacts stateCells`
- `directRefRewrite.insertElapsedMs.p95`
- `directRefRewrite.removeElapsedMs.p95`
- `rematerialization.elapsedMs.p95`
- `crossSheet.elapsedMs.p95`
- `exportRestore.restoreMs.p95`
- `workbookSync.heapDeltaMb.p95`

## Block 0. Freeze Current State

- [x] Save current benchmark numbers into this doc when starting work.
- [x] Keep [datagrid-spreadsheet-token-reference-transition-todo.md](/Users/anton/Projects/affinio/datagrid/docs/datagrid-spreadsheet-token-reference-transition-todo.md) as the narrow token-ref rewrite tracker.
- [x] Treat this file as the broader runtime roadmap.

Block close criteria:

- tests green
- fresh benchmark attached
- no hidden local patches left unverified

## Block 1. Formula Runtime IR and Structural Bindings

Objective: stop treating formula text as the runtime source of truth.

- [x] Define runtime-level `CompiledSpreadsheetFormula` / `ReferenceBinding[]` model separate from editor spans/text.
- [ ] Keep `rawInput` as editor/export presentation layer only.
- [x] Store runtime formula IR in sheet/workbook model without breaking current public API.
- [x] Move structural mutations to binding-level updates instead of string-level rewrites.
- [ ] Regenerate formula text lazily for editor/export only.
- [x] Keep dual representation during migration: `rawInput + runtime IR`.
- [ ] Add focused tests for:
  - [ ] local absolute row insert/remove
  - [ ] cross-sheet absolute row insert/remove
  - [ ] row-relative refs no-op under structural change
  - [ ] `#REF!` invalidation semantics
  - [ ] editor/export text parity after structural mutations

Target impact:

- primary: `directRefRewrite`
- secondary: `restore`

Block close criteria:

- `directRefRewrite.insert/remove p95` materially lower than current baseline
- no semantic regression in direct-ref tests
- no major regression in `rematerialization` or `heap`

## Block 2. Split Data Sheets and Derived Sheets

Objective: stop representing view/projection nodes as fully editable sheet models.

- [x] Introduce `DerivedSheetRuntime` contract with only:
  - [x] `columns`
  - [x] `row ids`
  - [x] resolved row values / table source
  - [x] diagnostics
  - [x] revision
- [x] Keep `DataGridSpreadsheetSheetModel` only for editable data sheets.
- [x] Update workbook runtime so derived nodes are not instantiated as full editable `sheetModel`.
- [x] Preserve read API for workbook consumers:
  - [x] sheet discovery
  - [x] cell reads
  - [x] table source export
  - [x] diagnostics
- [x] Remove view-only maps/state that do not make sense for derived nodes:
  - [x] raw input maps
  - [x] formula analysis maps
  - [x] row mutation state
  - [x] mutable patch APIs
- [x] Keep export contract stable while internal runtime splits.

Target impact:

- primary: `heap`, `restore`, `workbook.sync`
- secondary: `rematerialization`

Block close criteria:

- [x] `heap p95` drops materially versus current baseline
- [x] `restore p95` drops materially
- [x] workbook semantics remain unchanged for visible sheets

Post-block cleanup:

- [ ] Remove legacy fallback for externally supplied view `sheetModel` if we decide that contract is no longer needed.
- [ ] Remove legacy `sheetState`-first helpers for view materialization once no callers remain.
- [ ] Narrow workbook export/restore compatibility branches that still exist only for old view runtime assumptions.

## Block 3. Projection Graph Runtime

Objective: split formula/value graph from projection/query graph.

- [ ] Define explicit projection graph stages:
  - [ ] projection
  - [ ] filter
  - [ ] sort
  - [ ] join
  - [ ] group
  - [ ] pivot
- [ ] Give each stage its own runtime cache and invalidation inputs.
- [ ] Stop treating `viewPipeline.ts` as only a full batch materializer.
- [ ] Introduce stage revision tracking and stage-local diagnostics.
- [ ] Add graph-level tracing for:
  - [ ] touched source sheets
  - [ ] touched rows
  - [ ] touched join keys
  - [ ] touched group buckets
  - [ ] touched pivot buckets

Target impact:

- primary: `rematerialization`
- secondary: `crossSheet`

Block close criteria:

- stage caches exist and are exercised in tests
- benchmark variance stays finite
- `rematerialization p95` clearly trends down

## Block 4. Stateful Incremental Join/Group/Pivot

Objective: replace full projection rematerialization with stateful incremental runtime.

### Join

- [ ] Add persistent right-side hash index keyed by join field.
- [ ] Add delta application for inserted/updated/removed left rows.
- [ ] Add targeted fanout/explode invalidation.

### Group

- [ ] Add persistent aggregate bucket store.
- [ ] Support old-row contribution removal and new-row contribution application.

### Pivot

- [ ] Add persistent aggregate cube-like state.
- [ ] Separate aggregate state from rendered pivot rows/columns.
- [ ] Re-render pivot layout from cached aggregate state instead of rebuilding from source rows every time.

### Verification

- [ ] Add tests for row deltas flowing through join/group/pivot without full rebuild.
- [ ] Add touched-key diagnostics in benchmark report when available.

Target impact:

- primary: `rematerialization`
- secondary: `crossSheet`, `heap`

Block close criteria:

- `rematerialization p95` moves toward sub-200ms territory
- no scope explosion beyond current sheet chain
- no regression in pivot correctness

## Block 5. Persistence Model and Restore

Objective: stop treating restore as full runtime reconstruction of everything.

- [ ] Split document persistence from runtime caches.
- [ ] Persistent document state should contain only:
  - [ ] sheet metadata
  - [ ] raw inputs
  - [ ] styles
  - [ ] view definitions
  - [ ] workbook settings
- [ ] Runtime caches should be rebuildable or lazily hydratable:
  - [ ] dependency graph
  - [ ] compiled formulas
  - [ ] join indexes
  - [ ] group buckets
  - [ ] pivot caches
- [ ] Add restore modes:
  - [ ] cold restore
  - [ ] warm restore
  - [ ] lazy view/materialization restore
- [ ] Avoid exporting derived view rows as persistent document payload.

Target impact:

- primary: `restore`
- secondary: `export`, `heap`

Block close criteria:

- `restore p95` drops materially
- export payload stays stable or shrinks
- no compatibility break in workbook snapshot contract unless explicitly versioned

## Block 6. Compact Storage

Objective: reduce object churn and string-key overhead in core runtime.

- [ ] Replace string-key-heavy cell metadata maps where possible with numeric or row/column indexed structures.
- [ ] Move sparse metadata to compact storage:
  - [ ] formula metadata
  - [ ] styles
  - [ ] raw inputs where sparse
- [ ] Evaluate per-column or compact vector storage for heavy compute paths.
- [ ] Keep UI-facing row/cell APIs stable while runtime storage becomes denser.

Target impact:

- primary: `heap`
- secondary: `workbook.sync`, `export`, GC variance

Block close criteria:

- `heap p95` drops materially
- benchmark variance does not worsen
- no regression in editor/read APIs

## Block 7. Lazy and Demand-Driven Evaluation

Objective: stop eagerly paying for the whole affected subtree when only part of the workbook is observed.

- [ ] Add dirty marking for formula graph and projection graph separately.
- [ ] Make inactive/offscreen derived nodes lazily evaluated.
- [ ] Keep active sheet and visible summaries eager.
- [ ] Add instrumentation for eager vs lazy work performed per sync.

Target impact:

- primary: `workbook.sync`
- secondary: `rematerialization`, `crossSheet`

Block close criteria:

- active-sheet UX remains deterministic
- lazy runtime does not break exported/read semantics

## Block 8. Datasource and External Input Layer

Objective: add external data ingestion on top of the new runtime, not inside the old sheet-centric core.

- [ ] Define `data sheet source` contract for external providers.
- [ ] Add adapters for:
  - [ ] file import (`csv` / workbook-json first)
  - [ ] database-backed source (`postgres` via adapter, not direct core dependency)
- [ ] Keep datasource responsibility outside formula/projection core:
  - [ ] fetch rows
  - [ ] map rows into data-sheet runtime
  - [ ] emit refresh deltas
- [ ] Do not couple Postgres/file concerns into `sheetModel` internals.

Block close criteria:

- data-sheet runtime can be hydrated from adapter-provided rows
- no direct database/file coupling in spreadsheet core runtime

## Block 9. Project Structure and Subsystem Boundaries

Objective: align the codebase layout with the actual runtime subsystems so future refactors land in the right place and do not keep accreting into `workbookModel.ts` / `sheetModel.ts` / `viewPipeline.ts`.

Target layout:

```text
spreadsheet/
  workbook/
    workbookModel.ts
    workbookGraph.ts
    workbookSync.ts
    workbookPersistence.ts
    workbookDiagnostics.ts
    workbookReferenceRewrite.ts
    workbookTypes.ts

  sheet/
    sheetModel.ts
    sheetState.ts
    sheetFormulaRuntime.ts
    sheetRowMutation.ts
    sheetStyleRuntime.ts
    sheetTypes.ts

  formula/
    formulaEditorModel.ts
    formulaReferenceFormat.ts
    formulaReferenceRewrite.ts
    formulaAnalysis.ts
    formulaEditorTypes.ts

  view/
    viewPipeline.ts
    viewDataset.ts
    viewJoin.ts
    viewGroup.ts
    viewPivot.ts
    viewMaterialization.ts
    viewTypes.ts
```

Rules for this block:

- This is not a lines-of-code split. Move code only along real subsystem boundaries.
- Keep facade files thin:
  - `workbookModel.ts`
  - `sheetModel.ts`
  - `formulaEditorModel.ts`
  - `viewPipeline.ts`
- Each extraction step must keep tests and benchmark gates green before moving the next subsystem.
- Prefer moving pure helpers/types first, then orchestration/runtime code.

- [ ] Create `spreadsheet/workbook`, `spreadsheet/sheet`, `spreadsheet/formula`, and `spreadsheet/view` module boundaries.
- [ ] Split workbook runtime into:
  - [ ] `workbookTypes.ts` for public/internal workbook types and snapshots
  - [ ] `workbookGraph.ts` for aliases, dependency graph, SCC, affected-sheet resolution
  - [ ] `workbookDiagnostics.ts` for workbook diagnostics collection/normalization
  - [ ] `workbookReferenceRewrite.ts` for alias rewrites and cross-sheet row mutation rewrites
  - [ ] `workbookPersistence.ts` for export/restore and state builders
  - [ ] `workbookSync.ts` for sync orchestration, component schedule, materialization pass application
  - [ ] keep `workbookModel.ts` as facade/orchestrator only
- [ ] Split sheet runtime into:
  - [ ] `sheetTypes.ts` for model interfaces, patches, snapshots, mutation/state types
  - [ ] `sheetState.ts` for init/export/restore/normalization/equality helpers
  - [ ] `sheetFormulaRuntime.ts` for formula analysis maps, dependency graph, compilation, evaluation
  - [ ] `sheetRowMutation.ts` for insert/remove and structural mutation rewrite logic
  - [ ] `sheetStyleRuntime.ts` for style resolution and style mutation helpers
  - [ ] keep `sheetModel.ts` as facade/orchestrator only
- [ ] Split formula editor/runtime helpers into:
  - [ ] `formulaEditorTypes.ts` for editor/runtime formula types
  - [ ] `formulaAnalysis.ts` for cell input analysis, diagnostics, reference target resolution
  - [ ] `formulaReferenceFormat.ts` for canonical/smartsheet formatting and insert helpers
  - [ ] `formulaReferenceRewrite.ts` for presentation/runtime formula model mapping and rewrite/render helpers
  - [ ] keep `formulaEditorModel.ts` focused on editor state lifecycle only
- [ ] Split view runtime into:
  - [ ] `viewTypes.ts` for dataset/view/materialization types
  - [ ] `viewDataset.ts` for dataset construction and shared helpers
  - [ ] `viewJoin.ts` for join/explode logic
  - [ ] `viewGroup.ts` for group/aggregate logic
  - [ ] `viewPivot.ts` for pivot logic
  - [ ] `viewMaterialization.ts` for dataset-to-runtime/materialization result
  - [ ] keep `viewPipeline.ts` as thin pipeline dispatcher/facade
- [ ] Preserve import stability where possible with barrel exports or compatibility re-exports during migration.
- [ ] Keep this block behavior-preserving: no new perf logic mixed into file extraction patches.

Target impact:

- primary: maintainability and refactor velocity
- secondary: safer iteration on `Blocks 1-8`

Block close criteria:

- the main spreadsheet runtime files are subsystem-sized rather than kitchen-sink files
- facades are thin and mostly composition/orchestration
- tests and benchmark numbers remain within normal variance
- no accidental architecture regressions hidden inside file-move patches

## Recommended Execution Order

- [ ] Block 0. Freeze Current State
- [ ] Block 1. Formula Runtime IR and Structural Bindings
- [x] Block 2. Split Data Sheets and Derived Sheets
- [ ] Block 3. Projection Graph Runtime
- [ ] Block 4. Stateful Incremental Join/Group/Pivot
- [ ] Block 5. Persistence Model and Restore
- [ ] Block 6. Compact Storage
- [ ] Block 7. Lazy and Demand-Driven Evaluation
- [ ] Block 8. Datasource and External Input Layer
- [ ] Block 9. Project Structure and Subsystem Boundaries

## What Not To Do

- [ ] Do not keep chasing `directRefRewrite` with small string-rewrite optimizations only.
- [ ] Do not keep editor text model as runtime dependency model.
- [ ] Do not keep derived views as full editable sheets long term.
- [ ] Do not add Postgres/file coupling directly into current `sheetModel`.
- [ ] Do not try to hit the final rewrite/rematerialization budgets before Blocks 1-4 land.

## Success Definition

- `directRefRewrite` no longer scales with formula text rewrite work
- derived views are no longer full editable sheet models
- projection runtime supports incremental invalidation instead of batch rematerialization
- restore is document-oriented, not cold-boot runtime reconstruction
- runtime storage is compact enough that heap and variance stop being chronic blockers
