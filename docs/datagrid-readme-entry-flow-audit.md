# DataGrid README Entry Flow Audit

Date: 2026-05-24

Perspective: first-time external engineer trying to understand Affino DataGrid within 3-5 minutes.

Focus areas:

- positioning clarity
- value proposition
- architecture explanation order
- install friction
- quick-start readability
- package confusion
- stable vs advanced entrypoints
- server datasource discoverability
- spreadsheet/Gantt visibility
- mental model simplicity

## Executive Summary

Current README is optimized for maintainers, not first-time adopters. It starts with monorepo/package internals, validation commands, benchmarks, and performance tables before explaining what Affino DataGrid is, who it is for, how to install it, or how to render a grid.

The docs already contain strong material, but the entry flow is fragmented across root README, `docs/README.md`, `packages/datagrid-vue-app/README.md`, stable entrypoint docs, feature catalog, and server datasource docs. The highest-impact fix is a new root README order that gives an external engineer this mental model in 3-5 minutes:

> Use `@affino/datagrid-vue-app` for the default Vue component. Use `@affino/datagrid-vue` when you need runtime/headless control. Use server datasource docs when the backend owns data shape. Use advanced entrypoints only when building custom renderer or interaction plumbing.

## Proposed Ideal README Structure

The root README should become the external landing page first, maintainer reference second.

Recommended purpose:

- explain product value in the first screen
- show one working Vue grid quickly
- explain package choices without overwhelming users
- make server datasource, spreadsheet, Gantt, performance, and advanced APIs discoverable
- move contributor/benchmark-heavy content lower or into docs

## Exact Section Order

1. `# Affino DataGrid`
2. One-line positioning
3. When to use it
4. 5-minute quick start
5. Choose your package
6. Mental model
7. Main capabilities
8. Common integration paths
9. Stable vs advanced entrypoints
10. Server datasource
11. Performance snapshot
12. Documentation map
13. Requirements
14. Contributor setup
15. Validation commands
16. Benchmarks
17. License

### Section Details

#### One-Line Positioning

High-performance Vue DataGrid for data-heavy products: virtualized tables, spreadsheet-like editing, analytics projections, and backend-owned datasets.

#### When To Use It

Best fit:

- internal tools
- analytics apps
- back-office workflows
- financial and data-entry screens
- large remote datasets

Not best fit:

- tiny read-only tables where a simple HTML table or small UI component is enough

#### 5-Minute Quick Start

Include:

- install command
- minimal Vue example
- expected result
- next links

#### Choose Your Package

Explain:

- app component
- Vue runtime/headless
- core
- server adapters
- optional spreadsheet/Gantt packages or entrypoints

#### Mental Model

Show the runtime path before package internals:

```text
Rows or datasource
  -> Row model
  -> Sort/filter/group/pivot projection
  -> Virtual viewport
  -> Vue DataGrid renderer
```

#### Main Capabilities

Keep this scannable:

- virtualization
- selection/editing/clipboard/fill
- sorting/filtering/grouping/pivot
- state persistence
- formulas/spreadsheet capabilities
- Gantt
- server datasource

#### Common Integration Paths

Start from user intent:

- local rows
- backend-owned rows
- custom renderer/runtime
- spreadsheet-heavy surface
- Gantt view

#### Stable vs Advanced Entrypoints

State the rule first:

- use `@affino/datagrid-vue-app` for normal Vue apps
- use `@affino/datagrid-vue` for runtime/headless ownership
- use `@affino/datagrid-vue/advanced` only for custom interaction/layout ownership
- do not use internal entrypoints from application code

## What Should Be Removed Or Moved Out

Move out of the top-level README opening:

- Current "This repository contains only DataGrid packages..." intro.
- Raw package list that omits app-facing/server packages.
- Full benchmark command list.
- Large performance table.
- Tree scale envelope.
- Benchmark notes.
- Scope statement about E2E/demo apps being out of scope.

Where to move:

- Maintainer setup and benchmark details -> `docs/README.md` or `docs/perf/`.
- Full performance snapshot -> `docs/perf/` with only a short README summary.
- Monorepo package inventory -> package map section lower in README or separate `docs/datagrid-package-map.md`.
- "Out of scope" repo note -> contributor section, not first-screen content.

## What Should Become Advanced Docs Only

These should not be in the first 3-5 minute path:

- Full stable surface export list from `docs/datagrid-vue-stable-entrypoint.md`.
- Long advanced hook lists from `@affino/datagrid-vue/advanced`.
- Worker protocol details.
- Event ordering/reentrancy details.
- Diagnostics and lifecycle helper inventory.
- Plugin sandbox/runtime hook details.
- Low-level server client package details.
- Full server consistency model.
- Full benchmark harness instructions.
- Internal performance gates and CI drift language.
- `render-mode` and renderer ownership details.

Root README should link to these areas, but not explain them up front.

## Missing Diagrams And Examples

### Architecture Diagram

```text
Rows or datasource
  -> Row model
  -> Sort/filter/group/pivot projection
  -> Virtual viewport
  -> Vue DataGrid renderer
```

### Package Choice Diagram

```text
Most Vue apps
  -> @affino/datagrid-vue-app

Custom runtime or renderer
  -> @affino/datagrid-vue
  -> @affino/datagrid-vue/advanced only when needed

Backend-owned data
  -> @affino/datagrid-server-adapters
  -> createDataSourceBackedRowModel
```

### Server Datasource Diagram

```text
DataGrid
  -> datasource-backed row model
  -> createAffinoDatasource
  -> POST /api/{tableId}/pull
  -> backend table/query layer
```

### Missing Examples

- Minimal local rows example.
- Minimal server datasource example.
- Spreadsheet fill-handle example.
- Gantt view example.
- State persistence example.
- Package install matrix.

## Suggested Minimal Code Examples

### Local Vue Grid

```bash
pnpm add @affino/datagrid-vue-app
```

```vue
<script setup lang="ts">
import { DataGrid } from "@affino/datagrid-vue-app"

const rows = [
  { rowId: "1", service: "Billing API", owner: "Payments", status: "Healthy" },
  { rowId: "2", service: "Edge Gateway", owner: "Platform", status: "Watch" },
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

### Server Datasource

```bash
pnpm add @affino/datagrid-vue-app @affino/datagrid-vue @affino/datagrid-server-adapters
```

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

### Spreadsheet Affordances

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  fill-handle
  range-move
/>
```

### Gantt View

```vue
<DataGrid
  :rows="tasks"
  :columns="columns"
  view-mode="gantt"
  :gantt="{ startKey: 'start', endKey: 'end', labelKey: 'title' }"
/>
```

## Golden Path Onboarding Flow

1. Land on root README.
2. Understand the product in one paragraph.
3. Install `@affino/datagrid-vue-app`.
4. Paste the minimal Vue example.
5. See a virtualized grid render.
6. Use package decision table:
   - local rows: stay with `DataGrid`
   - backend-owned data: go to server datasource quick start
   - custom renderer/runtime: go to stable Vue entrypoint
   - interaction internals: go to advanced docs
7. Discover feature paths:
   - spreadsheet fill/editing
   - Gantt
   - pivot/group/filter
   - formulas
   - state persistence
8. Validate with one adopter-level check.
9. Only then read architecture, benchmark, or advanced docs.

## Slice-By-Slice Implementation Plan

| Slice | Change | Type | ROI |
| --- | --- | --- | --- |
| 1 | Rewrite root README top section with positioning, use cases, and 5-minute quick start. | Docs-only | Very high |
| 2 | Add package decision table and remove misleading `@affino/datagrid` recommendation unless actually published. | Docs/packaging | Very high |
| 3 | Move benchmark-heavy content lower and link full perf docs. | Docs-only | High |
| 4 | Add simple architecture and package-choice diagrams. | Docs-only | High |
| 5 | Add stable vs advanced entrypoint guidance before export inventory. | Docs-only | High |
| 6 | Add server datasource callout from root README to `docs/server-datasource/quick-start.md`. | Docs-only | High |
| 7 | Add spreadsheet and Gantt visibility examples in README. | Docs-only | Medium |
| 8 | Add adopter validation checklist separate from maintainer validation. | Docs-only | Medium |
| 9 | Add English product overview or fold it into README. | Docs-only | Medium |
| 10 | Add docs index "Start here" ordering: quick start -> packages -> server datasource -> feature catalog -> architecture. | Docs-only | Medium |

## Validation Checklist

- A new Vue user can identify `@affino/datagrid-vue-app` as the default package within 30 seconds.
- The first code example compiles without needing advanced docs.
- Root README links directly to server datasource quick start.
- Root README mentions spreadsheet and Gantt without making them look mandatory.
- Package table contains only real package names or explicitly marks planned packages.
- Stable vs advanced guidance says when to use each entrypoint.
- Benchmark details no longer dominate the first screen.
- `docs/README.md` mirrors the same onboarding order.
- `rg '@affino/datagrid' README.md docs packages/*/README.md` does not show misleading primary-package guidance.
- Minimal examples use one row identity convention consistently.

## Expected Adoption Improvement

- First 30 seconds: clearer positioning and value proposition.
- First 2 minutes: user knows which package to install.
- First 5 minutes: user can render a basic grid.
- First 10 minutes: user can choose between local rows, server datasource, app component, or custom runtime.
- Reduced support burden: fewer questions about `core` vs `vue` vs `vue-app`, stable vs advanced, and server adapter vs server client.
- Better enterprise signal: performance, server datasource, spreadsheet, and Gantt remain visible, but no longer block the basic onboarding path.
