# Affino DataGrid

Affino DataGrid is a Vue-first DataGrid for data-heavy products. It combines a ready app component, deterministic runtime contracts, virtualized rendering, spreadsheet-like editing, analytics projections, and backend-owned datasource support.

For normal Vue applications, start with `@affino/datagrid-vue-app` and its `<DataGrid />` component. Drop to `@affino/datagrid-vue` or `@affino/datagrid-core` only when you need runtime ownership, custom rendering, or platform-level integration.

## When To Use Affino DataGrid

Affino DataGrid is a strong fit when the grid is a primary workflow surface, not just a small read-only table.

Use it for:

- internal tools, back-office screens, analytics workbenches, and planning workflows
- large or wide datasets that need virtualized rows and columns
- product grids with selection, keyboard navigation, clipboard, fill, editing, and undo/redo
- saved views, persisted column layout, filters, selection, and viewport state
- sorting, filtering, grouping, aggregation, pivot, tree data, formulas, or Gantt-style views
- backend-owned tables where filtering, sorting, history, or paging must happen server-side

For a tiny static table, a simple HTML table or lightweight UI component is usually a better first choice.

## 5-Minute Vue Quick Start

Install the app-facing Vue package:

```bash
pnpm add @affino/datagrid-vue-app
```

Use `DataGrid` with local rows and columns:

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { rowId: "svc-1", service: "Billing API", owner: "Payments", status: "Healthy" },
  { rowId: "svc-2", service: "Edge Gateway", owner: "Platform", status: "Watch" },
  { rowId: "svc-3", service: "Risk Jobs", owner: "Operations", status: "Delayed" },
]

const columns = [
  { key: "service", label: "Service", initialState: { width: 220 } },
  { key: "owner", label: "Owner", initialState: { width: 180 } },
  { key: "status", label: "Status", initialState: { width: 140 } },
]
</script>

<template>
  <DataGrid :rows="rows" :columns="columns" virtualization />
</template>
```

This gives you a virtualized grid with the app-layer renderer and the stable component path. Add sorting, filtering, editing, selection, fill, state persistence, server rows, or custom cell rendering as your product flow needs them.

## Choose Your Package

| Need | Start with | Why |
| --- | --- | --- |
| Normal Vue app grid | `@affino/datagrid-vue-app` | App-facing `<DataGrid />` component and built-in UX. |
| Vue runtime or custom renderer ownership | `@affino/datagrid-vue` | Stable Vue adapter and headless runtime primitives. |
| Core model/API/platform integration | `@affino/datagrid-core` | Deterministic model, row, state, event, and `DataGridApi` contracts. |
| Backend-owned rows over Affino HTTP shape | `@affino/datagrid-server-adapters` | App-facing datasource factory for server-backed grids. |
| Lower-level server transport helpers | `@affino/datagrid-server-client` | Polling, invalidation, and custom datasource transport helpers. |
| Spreadsheet workbook shell | `@affino/datagrid-spreadsheet-vue-app` | Workbook-oriented shell built on DataGrid packages. |
| Styling/theme reuse | `@affino/datagrid-theme` | Shared theme tokens and presets. |
| Formula APIs | `@affino/datagrid-formula-engine` | Formula parsing, diagnostics, graph, and runtime contracts. |
| Pivot contracts/helpers | `@affino/datagrid-pivot` | Pivot spec normalization, cloning, layout, and drilldown contracts. |

Do not install a generic `@affino/datagrid` package for the primary Vue path; the app-facing package in this repository is `@affino/datagrid-vue-app`.

## Mental Model

```text
Rows or datasource
  -> Row model
  -> Sort/filter/group/pivot projection
  -> Derived cache and materialization
  -> Virtual viewport
  -> Vue DataGrid renderer
```

Most app teams use the top-level `DataGrid` component and configure rows, columns, and feature props. Platform teams can own lower layers directly through the Vue runtime and core API packages.

## Main Capabilities

- Virtualized row and column rendering for large and wide datasets
- Column sizing, visibility, order, pinning, menus, and layout persistence
- Sorting, filtering, quick filter, advanced filter, grouping, tree data, aggregation, and pivot
- Cell/range selection, row selection, clipboard, fill handle, range move, and inline editing
- Unified state export/import for saved views and restore flows
- Formula engine boundaries for computed fields and formula diagnostics
- Gantt view entrypoint for planning/timeline workflows
- Worker-owned and server-side row-model paths for heavier workloads
- Stable, namespaced `DataGridApi` contracts with public events, diagnostics, state, and plugin surfaces
- Contract tests, API inventory checks, and performance gates for release discipline

## Server Datasource

Use the server datasource path when your backend owns query shape, filtering, sorting, paging, history, or large dataset access.

For the recommended Affino HTTP endpoint shape, install:

```bash
pnpm add @affino/datagrid-vue-app @affino/datagrid-vue @affino/datagrid-server-adapters
```

The minimal read-only backend milestone is one endpoint:

```text
POST /api/{tableId}/pull
```

The frontend path is:

```ts
import { createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import { createAffinoDatasource } from "@affino/datagrid-server-adapters"

const datasource = createAffinoDatasource({
  baseUrl: "http://localhost:8000",
  tableId: "orders",
})

const rowModel = createDataSourceBackedRowModel({
  dataSource: datasource,
  initialTotal: 0,
})
```

```vue
<DataGrid :row-model="rowModel" :columns="columns" virtualization />
```

Start with the [server datasource quick start](./docs/server-datasource/quick-start.md), then use the [integration map](./docs/server-datasource/integration-docs-map.md) when you need histograms, edits, fill, history, invalidation, or consistency details.

## Stable Vs Advanced Entrypoints

Affino DataGrid keeps public API tiers explicit.

| Tier | Use when | Entrypoints |
| --- | --- | --- |
| Starter app path | You want a production Vue component quickly. | `@affino/datagrid-vue-app` |
| Stable runtime/API | You need semver-safe runtime, model, state, event, or adapter integration. | `@affino/datagrid-vue`, `@affino/datagrid-vue/stable`, `@affino/datagrid-core` |
| Advanced / power-user | You are building custom renderers, adapter plumbing, viewport integration, or low-level interaction flows. | `@affino/datagrid-vue/advanced/*`, `@affino/datagrid-core/advanced` |
| Internal | You are working inside Affino packages. | `./internal` subpaths only where documented |

Stable means semver-safe. It does not mean every stable export is part of the beginner path. App teams should start with `@affino/datagrid-vue-app`; custom runtime work should start with `@affino/datagrid-vue`; platform-level contracts live in `@affino/datagrid-core`.

## Docs Map

Start here:

- [Documentation index](./docs/README.md)
- [Package map](./docs/datagrid-package-map.md)
- [API start here](./docs/datagrid-api-start-here.md)
- [Vue stable entrypoint](./docs/datagrid-vue-stable-entrypoint.md)
- [Feature catalog](./docs/datagrid-feature-catalog.md)
- [Server datasource quick start](./docs/server-datasource/quick-start.md)
- [Server datasource integration map](./docs/server-datasource/integration-docs-map.md)

Core references:

- [Grid API](./docs/datagrid-grid-api.md)
- [Public API inventory](./docs/datagrid-public-api-inventory.md)
- [Versioned public protocol](./docs/datagrid-versioned-public-protocol.md)
- [Migration guide](./docs/datagrid-migration-guide.md)
- [Architecture](./docs/datagrid-architecture.md)

Feature guides:

- [Quick filter](./docs/datagrid-quick-filter.md)
- [Formula engine guide](./docs/datagrid-formula-engine-guide.md)
- [Tree data](./docs/datagrid-tree-data.md)
- [Gantt](./docs/datagrid-gantt.md)
- [Spreadsheet Vue app](./docs/datagrid-spreadsheet-vue-app.md)

## Requirements

- Node.js `>=20`
- pnpm `>=10`

The root workspace currently pins the package manager through `package.json`.

## Contributor Setup

```bash
pnpm install
```

Useful workspace commands:

```bash
pnpm type-check
pnpm test:datagrid:unit
pnpm test:datagrid:contracts
pnpm test:datagrid:integration
pnpm lint
```

For a narrow docs-only change, a manual link/package-name review is usually enough. For package behavior changes, prefer the smallest package-level type-check or test before running broader gates.

## Package Inventory

This repository contains DataGrid packages and supporting infrastructure, including:

- `@affino/datagrid-core`
- `@affino/datagrid-vue`
- `@affino/datagrid-vue-app`
- `@affino/datagrid-server-adapters`
- `@affino/datagrid-server-client`
- `@affino/datagrid-worker`
- `@affino/datagrid-plugins`
- `@affino/datagrid-theme`
- `@affino/datagrid-format`
- `@affino/datagrid-pivot`
- `@affino/datagrid-formula-engine`
- `@affino/datagrid-spreadsheet-vue-app`
- `@affino/projection-engine`

## Performance And Benchmarks

Affino DataGrid treats performance as part of the public product contract. Baseline artifacts for performance and API checks are located in `docs/perf` and `docs/quality`, with benchmark outputs in `artifacts/performance`.

Latency classes used in benchmark summaries: `<1ms realtime`, `<16ms frame-safe`, `<100ms interactive`, `<1s heavy`, `>=1s blocking`.

| Area | Dataset scale | Latency snapshot | Throughput | Class |
| --- | --- | --- | --- | --- |
| Tree model | 25k grouped rows | expand p95 `0.95ms`, filter/sort p95 `8.26ms` | - | realtime / frame-safe |
| Pivot runtime | 24k rows, 2 layouts | rebuild p95 `15.04ms`, patch p95 `6.71ms` | - | frame-safe |
| Spreadsheet workbook | 16k orders, 4k customers, join fanout 3 | sync p95 `140.12ms`, restore p95 `399.71ms` | - | heavy |
| Formula kernel | 100k rows | compute p95 `4.231ms` | `23.64M eval/s` | frame-safe |
| Formula pipeline | 100k rows, 40 formulas, depth 4 | full recompute p95 `1427.37ms`, patch p95 `109.88ms` | `4.14M eval/s` | blocking / heavy |
| Grid stress | mixed sort/filter/patch workload | sort p95 `87.12ms`, patch storm p95 `27.23ms` | `139,886 rows/s` | interactive |
| Vue adapters | 120 roots across 9 packages | controller churn `~0.07ms`, relayout `~0.15ms` | - | realtime |

Tree scale envelope:

| Rows | Snapshot | Class |
| --- | --- | --- |
| 10k | expand p95 `0.53ms`, filter/sort p95 `3.52ms` | realtime / frame-safe |
| 25k | expand p95 `0.95ms`, filter/sort p95 `8.26ms` | realtime / frame-safe |
| 50k | expand p95 `2.13ms`, filter/sort p95 `18.43ms` | frame-safe / interactive |
| 100k | expand p95 `4.36ms`, filter/sort p95 `53.17ms` | frame-safe / interactive |

Benchmark commands:

```bash
pnpm run bench:regression
pnpm run bench:datagrid:tree:assert
pnpm run bench:datagrid:pivot:assert
pnpm run bench:datagrid:spreadsheet-workbook:assert
pnpm run bench:datagrid:formula-engine:assert
pnpm run bench:datagrid:formula-backends:assert
```

Notes:

- `bench:regression` is the aggregate CI harness for baseline drift on the core suite.
- Heavy-load suites such as workbook, hardcore, worker pressure, soak, group-depth, and server-pivot interop remain standalone asserts.
- Formula metrics are split into backend ceiling (`formula-backends`) and full pipeline cost (`formula-engine`).

## Repository Scope

The following remain intentionally outside this repository's current source scope:

- separate demo applications such as `demo-vue` and `demo-laravel`
- external E2E/Playwright pipelines beyond the workspace-owned sandbox/e2e harnesses

## License

See `LICENSE`.
