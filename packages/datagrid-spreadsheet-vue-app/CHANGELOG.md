# @affino/datagrid-spreadsheet-vue-app

## Unreleased

### Patch Changes

- ## Summary

  Expanded the workbook shell with effective-value filtering and aggregation, an exportable formula-editor component, workbook theme override support, bottom-right selection aggregates, additive Ctrl/Cmd multi-range cell selection, and full-column header selection with spreadsheet-style visuals.

  ## User impact

  Workbook users now get more Excel-like behavior: filters and advanced predicates evaluate formula/display values, the selection overlay can show aggregate metrics for the current selection, Ctrl/Cmd can add independent cells or ranges, copied-range visuals stay attached to every selected block, and clicking a column header selects the whole workbook column. Integrators can also theme the workbook shell and reuse the formula editor component in custom layouts.

  ## Migration
  - No migration required.
  - Optional adoption:
    - pass the `theme` prop when the workbook shell should follow a package-level theme preset or custom token map,
    - import `DataGridSpreadsheetFormulaEditor` when you need the workbook formula bar as a standalone component.

  ## Validation
  - focused workbook filter regressions passed for value-set and advanced-filter formula paths
  - focused workbook regression passed for additive Cmd-click selection
  - full `DataGridSpreadsheetWorkbookApp.spec.ts` suite passed (`26 passed`)