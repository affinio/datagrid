# @affino/datagrid

Community entrypoint for Affino DataGrid.

## Install

```bash
npm install @affino/datagrid
```

## Usage

```ts
import { createDataGridRuntime } from "@affino/datagrid"

const runtime = createDataGridRuntime({
  columns: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
  ],
  rows: [
    { id: 1, name: "Alpha" },
    { id: 2, name: "Beta" },
  ],
})
```

Community tier blocks pro-only domains by default (pivot, grouping/tree, worker compute, server/data-source row models, backpressure controls).

## Unlocking pro

You can unlock pro either:

- by activating `@affino/datagrid-pro` via `enableProFeatures(...)`
- or by passing `licenseKey` directly to `createDataGridApi(...)` / `createDataGridRuntime(...)`

