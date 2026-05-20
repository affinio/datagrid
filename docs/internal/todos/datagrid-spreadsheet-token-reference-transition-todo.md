# Spreadsheet Token Reference Transition TODO

Date: 2026-03-11

Status as of `2026-05-20`: partially implemented. The sheet runtime has compiled formula/reference metadata and supports sheet-qualified references, but structural mutation paths still update/render `rawInput` eagerly in `sheetModel.ts` and `workbookModel.ts`. Treat P0/P1 as mostly present, P2/P3 as partially complete, and P4/P5 as still open.

## Goal

Move spreadsheet structural mutations away from formula text rewriting and toward persistent token/reference models.

Primary target metrics:

- `directRefRewrite.insertElapsedMs.p95`
- `directRefRewrite.removeElapsedMs.p95`
- `workbookSync.elapsedMs.p95`
- `workbookSync.heapDeltaMb.p95`

## Why

Current structural mutation paths are text-rewrite based:

- local sheet rewrite in `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
- cross-sheet rewrite in `packages/datagrid-core/src/spreadsheet/workbookModel.ts`

That makes row insert/remove cost scale with the number of formulas and absolute references. Benchmarks currently show multi-second rewrite latency on large workbook scenarios.

## Transition Plan

### P0. Keep current contract, add internal formula model

- [x] Add persistent compiled formula/reference storage in `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
- [x] Keep `rawInput` as externally visible editor/export representation
- [x] Store normalized references separately from text spans
- Initial formula model shape:
  - [x] `sheetReference`
  - [x] `columnKey`
  - [x] `rowSelector`
  - [x] `outputSyntax`

### P1. Extract token mutation/render helpers

- [x] Extend `packages/datagrid-core/src/spreadsheet/formulaEditorModel.ts`
- [~] Add API for:
  - [x] mutating normalized references after structural changes
  - [x] rendering normalized references back into canonical/smartsheet text
- [~] Do not change sheet/workbook behavior yet; current behavior still writes updated `rawInput` eagerly in some structural paths.

### P2. Replace local sheet structural rewrite hot path

- [~] Remove text rewrite as primary path in `insertRowsAt()` / `removeRowsAt()`
- [x] Update token/reference models instead
- [ ] Mark formula text dirty instead of eagerly rewriting every formula string
- [x] Rebuild dependency graph from token model

Expected impact:

- major reduction in local `insert/remove` rewrite latency

### P3. Replace cross-sheet structural rewrite hot path

- [~] Replace workbook-level formula patching in `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
- [ ] Stop doing `getFormulaCells() -> getCell() -> rewrite text -> setCellInputs()`
- [~] Mutate normalized references directly for dependent sheets
- [ ] Render formula text lazily for editor/export only

Expected impact:

- major reduction in cross-sheet absolute-reference rewrite latency

### P4. Separate storage contract from editor/export contract

- [ ] `rawInput` becomes derived view, not source-of-truth for formula structure
- [ ] Render formula strings only when needed by:
  - `getCell().rawInput`
  - `exportState()`
  - formula editor entry

### P5. Identity cleanup

- [x] Keep column references bound to stable `columnKey`
- [x] Keep row-relative semantics bound to row context
- [~] Preserve current absolute-reference semantics, but implement them through normalized selectors instead of text rewrite

## Files To Change First

- `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
- `packages/datagrid-core/src/spreadsheet/formulaEditorModel.ts`
- `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/sheetModel.spec.ts`
- `packages/datagrid-core/src/spreadsheet/__tests__/workbookModel.spec.ts`

## Guardrails

- Do not break existing editor/export behavior while token model is being introduced
- Keep old tests green while dual representation (`rawInput + formulaModel`) exists
- Add focused tests for:
  - local absolute ref insert/remove
  - cross-sheet absolute ref insert/remove
  - formula text rendering parity
  - no-op behavior for row-relative refs under structural changes

## Benchmark Gates For Each Stage

- `pnpm --filter @affino/datagrid-core test:file -- src/spreadsheet/__tests__/sheetModel.spec.ts src/spreadsheet/__tests__/workbookModel.spec.ts`
- `pnpm run bench:datagrid:spreadsheet-workbook:assert`

Track after each stage:

- `directRefRewrite.insertElapsedMs.p95`
- `directRefRewrite.removeElapsedMs.p95`
- `rematerialization.elapsedMs.p95`
- `crossSheet.elapsedMs.p95`
- `workbookSync.heapDeltaMb.p95`

## Success Criteria

- Structural rewrite leaves formula semantics unchanged
- Formula text remains correct for UI/export
- `directRefRewrite` drops by at least one order of magnitude versus current baseline
- No major regression in rematerialization or heap
