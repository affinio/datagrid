# DataGrid Spreadsheet Gap Plan

Updated: `2026-03-11`
Scope: `datagrid-vue-app` + `datagrid-formula-engine` spreadsheet path.

## What already exists

- high-performance grid rendering, selection, fill, move, clipboard, inline edit
- formula engine with dependency DAG, row-aware refs, diagnostics, explain, worker/runtime modes
- row-model formula recompute with snapshot-aware execution

## What is missing for a real mini spreadsheet

### 1. Formula syntax adaptation layer

Current engine IR is grid-native:

- `price`
- `balance[-1]`
- `SUM(price[-2:0])`

Needed for spreadsheet UX:

- parser-level syntax profiles
- Smartsheet-style refs like `=[Amount]@row + [Tax]5`
- future Excel/A1 adapters without rewriting runtime or dependency graph

Status:

- `2026-03-11`: first block implemented
  - added `referenceParserOptions`
  - added Smartsheet-style current-row `@row`
  - added Smartsheet-style absolute row refs like `[Column]5`
  - kept canonical row-aware IR as the runtime contract

Still missing in this area:

- Smartsheet range refs
- cross-sheet reference grammar
- parser profile registry for Excel/A1 and custom enterprise dialects

### 2. Workbook / multi-sheet core model

Current runtime is row-model scoped.

Needed:

- workbook container
- multiple sheets with stable sheet ids
- cross-sheet dependency descriptors
- recompute scheduling across sheet boundaries
- sheet-level history / rename / duplication semantics

Status:

- `2026-03-11`: second block implemented
  - added `createClientWorkbookModel`
  - added stable sheet ids + active-sheet state
  - added add/remove/rename sheet flows
  - added auto-sync of sheets into formula `TABLE()` aliases by both `sheet.id` and `sheet.name`
  - replaced full-workbook multi-pass sync with dependency-graph propagation so only downstream sheets resync on source changes
  - added SCC-aware component scheduling so chains like `sheetA -> sheetB -> sheetC` still converge without manual refresh
  - added stable `ClientRowModel.getSourceRows()` export for materialized source rows
  - added lazy workbook table exports and batched formula-table patching to avoid `map + freeze + clone` on every inter-sheet sync
  - added cached workbook graph state with invalidation on structural/formula changes instead of rebuilding graph on every sync
  - switched workbook export invalidation to explicit source/formula structure revisions instead of relying on array identity

Still missing in this area:

- direct cross-sheet reference grammar in formulas (for example sheet-qualified cell refs)
- workbook-level dependency graph / explain surface in public diagnostics
- sheet duplication / workbook snapshot / workbook history semantics
- conflict policy for workbook-managed aliases vs external manual formula tables

### 2.5. Relation-aware formula helpers

Needed:

- keyed lookup helpers on top of workbook tables
- efficient index reuse for cross-sheet parent/child lookups
- path from spreadsheet tables toward database-like relations

Status:

- `2026-03-11`: fourth core block implemented
  - added `RELATED(table, localValue, tableKeyField, returnField, notFound?)`
  - added `ROLLUP(table, tableKeyField, localValue, aggregateField, method, empty?)`
  - added lazy per-table lookup index cache keyed by `table source + key field`
  - kept dependency scheduling workbook-safe by using literal table names in function context keys

Still missing in this area:

- named relation registry / relation metadata on top of raw table names
- relation-direction metadata and diagnostics
- query-like sugar such as `WHERE customer_id = Customers.id`

### 3. Spreadsheet editing model

Current grid editing is cell-value oriented.

Needed:

- explicit cell source model: raw input vs computed display value
- formula bar / editor session model
- click-to-insert cell references while editing formulas
- parsed reference spans for color-highlight and reverse-highlight

Status:

- `2026-03-11`: third block implemented
  - added spreadsheet cell-input analysis (`blank` / `value` / `formula`)
  - added raw-input-aware formula diagnostics/spans for editor usage
  - added extracted reference spans with stable color indexes and resolved target row indexes
  - added formula reference formatter + click-insert helper for canonical and Smartsheet-style output
  - added `createDataGridSpreadsheetFormulaEditorModel()` for formula bar / inline editor session state
- `2026-03-11`: sheet runtime block implemented
  - added `createDataGridSpreadsheetSheetModel()` with per-cell raw input persistence
  - added per-cell formula execution using the existing formula-engine as a single-cell evaluator
  - added cell dependency closure recompute for row-aware references like `=[price]@row + [tax]5`
  - added formula-table context support in sheet cells for `TABLE`, `RELATED`, `ROLLUP`
  - added sheet/row/column/cell style scopes plus style copy/apply across cells
  - added sheet benchmark for value patch -> per-cell formula recompute

Still missing in this area:

- integration with selection/cell-click orchestration in `datagrid-vue-app`
- reverse mapping from target cells back to reference spans for hover/focus interactions
- edit transactions that preserve raw input separately from computed display payload
- row/column insert-remove semantics with reference shifting and fill/autofill semantics
- spreadsheet workbook model that hosts multiple per-cell sheets directly, rather than only row-model workbook tables

### 4. Style system

Current app has row/column styling hooks and theme tokens.

Needed:

- cell-level style descriptors
- style inheritance / copy-paste
- conditional style rules
- style application ranges and column defaults

### 5. Spreadsheet UI shell

Needed:

- sheet tabs
- formula bar
- named color overlays for active formula references
- reference builder interactions on top of selection engine
- clipboard modes that preserve formula/style payloads

## Recommended build order

1. syntax adaptation layer
2. workbook + sheet dependency model
3. cell input model (`raw`, `formula`, `display`, `error`)
4. UI reference builder + formula highlight overlays
5. style model + style copy/apply flows
6. demo spreadsheet shell in sandbox / app package

## Immediate next block

After the workbook graph refactor, the next high-leverage core block is:

- add sheet-level per-cell formula execution/persistence model
- add named relation registry on top of `RELATED` / `ROLLUP`
- connect spreadsheet editor model to selection-driven reference insertion in `datagrid-vue-app`
- add sheet-qualified reference grammar on top of the parser profile layer
