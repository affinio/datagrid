# @affino/datagrid-pro

Pro licensing activation package for Affino DataGrid.

## Install

```bash
npm install @affino/datagrid @affino/datagrid-pro
```

## Usage

```ts
import { createDataGridRuntime } from "@affino/datagrid"
import { enableProFeatures } from "@affino/datagrid-pro"

enableProFeatures({
  licenseKey: process.env.DATAGRID_LICENSE!,
})

const runtime = createDataGridRuntime({
  columns,
  rows,
})
```

You can also pass `licenseKey` inline to `createDataGridApi(...)` or `createDataGridRuntime(...)`.

