# DataGrid Core Factories Reference

Status: public reference.

This is the constructor-level reference for stable and documented advanced `@affino/datagrid-core` entrypoints.

## Stable constructors

| Factory | Returns | Typical use |
| --- | --- | --- |
| `createDataGridCore(options?)` | `DataGridCore` | Service registry and lifecycle wiring. |
| `createDataGridApi(options)` | `DataGridApi` | Stable namespace facade (`lifecycle/rows/data/columns/view/pivot/selection/transaction/state/events/meta/policy/compute/diagnostics/plugins`). |
| `createDataGridColumnModel(options?)` | `DataGridColumnModel` | Column definitions/order/visibility/width/pin state. |
| `createDataGridEditModel(options?)` | `DataGridEditModel` | Headless edit patches and revision tracking. |
| `createDataGridSelectionSummary(options)` | `DataGridSelectionSummarySnapshot` | Deterministic summary over selected scope. |

## Additional stable constructors

| Factory | Returns | Typical use |
| --- | --- | --- |
| `createServerRowModel(options, config?)` | `ServerRowModel<T>` | Block cache + lazy-loading model. |
| `createServerBackedRowModel(options)` | `ServerBackedRowModel<T>` | Adapter from server row model to `DataGridRowModel`. |
| `createDataSourceBackedRowModel(options)` | `DataSourceBackedRowModel<T>` | Pull/push/invalidation/backpressure protocol model. |
| `createDataGridServerPivotRowId(input)` | `string` | Stable row-id generation for server-side pivot rows. |

The full client model is available as `createAdvancedClientRowModel(options?)` from `@affino/datagrid-core/advanced-client-row-model`. The stable root no longer exports the deprecated `createClientRowModel` name.

## Canonical API assembly

Use `createDataGridCore(...)` as canonical assembly path:

```ts
import {
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
} from "@affino/datagrid-core"
import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"

const rowModel = createAdvancedClientRowModel({ rows })
const columnModel = createDataGridColumnModel({ columns })

const core = createDataGridCore({
  services: {
    rowModel: { name: "rowModel", model: rowModel },
    columnModel: { name: "columnModel", model: columnModel },
  },
})

const api = createDataGridApi({ core })
await api.start()
```

## `createDataGridApi(...)` input shapes

Supported options:

- `createDataGridApi({ core, plugins? })`
- `createDataGridApi({ lifecycle, init, start, stop, dispose, rowModel, columnModel, ... })`

For product integrations prefer `core` form.

## Related references

- `docs/datagrid-grid-api.md`
- `docs/reference/datagrid-core-advanced-reference.md`
- `docs/datagrid-state-events-compute-diagnostics.md`
