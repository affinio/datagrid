# Affino DataGrid Showcase

Private product-shaped demo app for first-time external evaluation.

This package is intentionally separate from `@affino/datagrid-sandbox`:

- no validation controls
- no debug diagnostics
- no sandbox-only grid wrappers
- no public API changes
- uses stable app/runtime surfaces from `@affino/datagrid-vue-app` and `@affino/datagrid-vue`

## Showcase Scenarios

- Huge operations table: 100k local rows with virtualization, pinned columns, menus, selection, fill, and range move.
- Backend-owned model: 250k-row sparse datasource using `createDataSourceBackedRowModel`, viewport pulls, and histogram support.
- Spreadsheet formulas: editable planning inputs with computed subtotal, tax, total, margin, and margin percent columns.
- Advanced filter review: account review workflow with advanced filter, quick filter, column menus, and selection.
- Aggregation groups: grouped revenue rollups with aggregation-backed parent rows.
- Pivot analysis: owner-by-region revenue matrix.
- Tree portfolio: hierarchical account portfolio with intrinsic tree paths.
- Gantt planning: timeline planning with dependencies, baselines, progress, and critical path.

## Commands

```bash
pnpm --filter @affino/datagrid-showcase dev
pnpm --filter @affino/datagrid-showcase build
pnpm --filter @affino/datagrid-showcase type-check
```

Use the sandbox for exhaustive validation and e2e scenarios. Use this package for product-shaped demos, screenshots, and external onboarding.
