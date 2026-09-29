# App layer: `@affino/datagrid-vue-app`

Status: public user guide.

This is the recommended and self-contained entry point for most users. It exposes the declarative `DataGrid` component with a built-in renderer and product-facing interaction model.

```ts
import { DataGrid } from "@affino/datagrid-vue-app"
```

## Data and columns

`rows` is an array of application records. Every row needs a stable identity: provide `id`/`rowId`, or configure the row-id resolver when using a lower-level row model. `columns` describes the visible data contract; `key` addresses the value and `label` is the header text.

| Option | Purpose |
| --- | --- |
| `key` | Public column key used by sorting, filters, selection, and state. |
| `label` | Header label. |
| `dataType` | Value semantics such as `number` or `date`. |
| `initialState` | Initial width, visibility, and pinning state. |
| `capabilities` | Enable sorting, filtering, and aggregation per column. |
| `presentation` | Display formatting and alignment; it does not change the raw value. |
| `cellRenderer` | Custom Vue cell content for app-owned presentation. |

Keep `presentation` separate from data transformation: editing, clipboard, and row patches use raw values.

## Layout and common features

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  virtualization
  layout-mode="auto-height"
  :min-rows="6"
  :max-rows="14"
  :chrome="{ toolbarPlacement: 'integrated', density: 'compact' }"
  :history="{ controls: true }"
  :row-selection="{ enabled: true }"
  :quick-filter="{ placeholder: 'Search orders', applyMode: 'debounce' }"
/>
```

Use `layout-mode="fill"` for an app shell and `auto-height` for embedded cards or forms. Use `chrome.toolbarPlacement="hidden"` when the host renders toolbar modules itself.

The app package also provides opt-in subpaths for `quick-filter`, `advanced-filter`, `find-replace`, `aggregations`, and `gantt`. Ordinary tables should import from the package root; Gantt usage should import `DataGrid` from `@affino/datagrid-vue-app/gantt`.

## State and refs

Persist user-facing saved views through the unified state boundary exposed by the component/runtime. Do not persist DOM scroll positions or query internal signals. For lower-level state control, use the [core API guide](./core-api.md).

## Server-backed rows

The app component accepts a row model instead of `rows`:

```vue
<DataGrid :row-model="rowModel" :columns="columns" virtualization />
```

Create that model with `createDataSourceBackedRowModel` and `createAffinoDatasource`; see the [server datasource quick start](./server-datasource/quick-start.md).

## Accessibility and customization

Use the built-in renderer unless you have a concrete ownership requirement. For custom cell content, prefer `cellRenderer`. For a fully custom host, move to the [Vue adapter](./vue-adapter.md) so DOM, lifecycle, and interaction ownership remain explicit. Review the [accessibility guide](./datagrid-accessibility.md) when replacing renderer pieces.
