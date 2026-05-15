# Spreadsheet Token Reference Transition TODO

Date: 2026-03-11

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

- Add persistent `formulaModelByCellKey` storage in `packages/datagrid-core/src/spreadsheet/sheetModel.ts`
- Keep `rawInput` as externally visible editor/export representation
- Store normalized references separately from text spans
- Initial formula model shape:
  - `sheetReference`
  - `columnKey`
  - `rowSelector`
  - `outputSyntax`

### P1. Extract token mutation/render helpers

- Extend `packages/datagrid-core/src/spreadsheet/formulaEditorModel.ts`
- Add API for:
  - mutating normalized references after structural changes
  - rendering normalized references back into canonical/smartsheet text
- Do not change sheet/workbook behavior yet

### P2. Replace local sheet structural rewrite hot path

- Remove text rewrite as primary path in `insertRowsAt()` / `removeRowsAt()`
- Update token/reference models instead
- Mark formula text dirty instead of eagerly rewriting every formula string
- Rebuild dependency graph from token model

Expected impact:

- major reduction in local `insert/remove` rewrite latency

### P3. Replace cross-sheet structural rewrite hot path

- Replace workbook-level formula patching in `packages/datagrid-core/src/spreadsheet/workbookModel.ts`
- Stop doing `getFormulaCells() -> getCell() -> rewrite text -> setCellInputs()`
- Mutate normalized references directly for dependent sheets
- Render formula text lazily for editor/export only

Expected impact:

- major reduction in cross-sheet absolute-reference rewrite latency

### P4. Separate storage contract from editor/export contract

- `rawInput` becomes derived view, not source-of-truth for formula structure
- Render formula strings only when needed by:
  - `getCell().rawInput`
  - `exportState()`
  - formula editor entry

### P5. Identity cleanup

- Keep column references bound to stable `columnKey`
- Keep row-relative semantics bound to row context
- Preserve current absolute-reference semantics, but implement them through normalized selectors instead of text rewrite

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
