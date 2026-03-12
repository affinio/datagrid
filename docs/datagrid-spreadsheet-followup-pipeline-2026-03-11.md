# Datagrid Spreadsheet Follow-Up Pipeline

Remaining work after the 2026-03-11 direct-reference/core-worksheet increment.

## P1 Correctness and Core Model

- Column structural mutations: `insertColumnsAt()` / `removeColumnsAt()`.
- Formula rewrite for column-qualified direct refs during column insert/remove.
- Workbook-level cross-sheet rewrite for future column mutations.
- `duplicateSheet()` semantics, including alias allocation and formula rewrite policy.
- Workbook snapshot/export/import contract.
- Workbook history and undo/redo contract.
- Alias collision policy between workbook-managed sheet aliases and manual formula-table aliases.
- Mixed dependency coverage tests: direct refs plus `TABLE()`, `RELATED()`, and `ROLLUP()` in the same workbook.

## P2 Formula and Parser Surface

- Parser profile registry for Excel/A1 and additional dialects.
- Public diagnostics surface for bad cross-sheet refs and relation metadata.
- Named relation registry on top of `RELATED()` / `ROLLUP()`.
- Relation direction diagnostics and higher-level relation syntax sugar.

## P2 Editor and App Integration

- Move the spreadsheet shell out of sandbox and into `datagrid-vue-app`.
- Cross-sheet click-to-insert UX instead of local-ref-only insertion behavior.
- Range resize/stretch editing on top of the new rectangular range grammar/runtime.
- Reverse hover and preview: target cell to formula span and cross-tab highlighting.
- Raw-input-preserving edit transaction flow through app/runtime.
- Clipboard and history payloads that preserve raw formula plus style across sheets/workbooks.
- Integration tests for editor/runtime behavior, not only core unit tests.

## P3 Product Layer

- Conditional formatting.
- Workbook-level named styles/themes.
- Clipboard semantics for style plus formula together.
- Fill/autofill semantics on top of structural mutations.
- Move/duplicate row semantics in the spreadsheet model.

## Verification Debt

- Run spreadsheet/core tests in devcontainer.
- Update the broader roadmap doc so it reflects the already-landed cross-sheet/direct-ref work.
