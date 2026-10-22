# `@affino/datagrid-formula-engine`

Formula engine package for Affino DataGrid.

## Purpose

This package establishes a dedicated formula-engine boundary without forcing a risky implementation move out of `@affino/datagrid-core` in one step.

Current state:

- formula parsing / analysis / compile APIs live here
- graph / execution-plan APIs live here
- reusable formula function packs, including finance helpers, live here
- low-level row-model integration still lives in `@affino/datagrid-core`

## Public surface

The package exposes:

- parse / diagnose / explain
- compile formula field definitions and artifacts
- formula value utilities
- formula graph and execution-plan builders
- formula-related type contracts
- `DATAGRID_FINANCE_FORMULA_FUNCTIONS` and `DATAGRID_FORMULA_PACKS`
- `listDataGridFormulaPackNames()` and `resolveDataGridFormulaFunctions()`

The Vue app can enable packs with the `formulaPacks` prop. User-provided
functions override built-in pack functions with the same name.

## Runtime ownership

`@affino/datagrid-vue` owns UI-facing formula runtime settings and diagnostics.
`@affino/datagrid-core` owns row-model formula registration, recomputation, and
runtime snapshots. Async formulas and server-side evaluation are not provided
by this package.

## Boundary rule

Use `@affino/datagrid-formula-engine` for formula language, function-pack, and
planning APIs. Keep row-model orchestration and snapshot integration in
`@affino/datagrid-core`.
