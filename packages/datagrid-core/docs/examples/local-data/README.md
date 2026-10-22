# Core engine example: local data

This is a framework-independent TypeScript example of assembling and consuming `@affino/datagrid-core`. It uses browser DOM APIs only in the renderer module. A React, Vue, Web Component, or Laravel-rendered page can keep the same engine modules and replace the renderer/input binding with its own adapter.

The example intentionally separates engine construction, view rendering, and host lifecycle:

```text
schema.ts          column definitions and row type
rows.ts            source data
create-grid.ts     row/column models and DataGridApi
render-table.ts    projection snapshot -> semantic HTML table
main.ts            subscriptions, commands, teardown
```

Core does not provide the HTML table or CSS. The renderer below is a small teaching adapter, not a production virtualization or accessibility implementation. For a production adapter, also follow the [architecture guide](../../../../../docs/datagrid-architecture.md), [accessibility contract](../../../../../docs/reference/datagrid-headless-a11y-contract.md), [virtualization matrix](../../../../../docs/reference/datagrid-virtualization-support-matrix.md), and the detailed [API method reference](../../reference/api/grid-api-methods.md).

## Files

- [`schema.ts`](./schema.ts) — row and column schema.
- [`rows.ts`](./rows.ts) — initial data.
- [`create-grid.ts`](./create-grid.ts) — core model assembly and lifecycle.
- [`render-table.ts`](./render-table.ts) — framework-neutral DOM renderer.
- [`main.ts`](./main.ts) — subscribe, update model, render, dispose.

## Why this split

- `schema.ts` has no runtime state.
- `rows.ts` is the application data boundary and can be replaced by an API client or datasource.
- `create-grid.ts` creates the engine once; UI frameworks should not reconstruct it on every render.
- `render-table.ts` derives markup from current projected data and visible columns. It does not own sorting or row identity.
- `main.ts` exports `mount(host)`, the host integration boundary: it maps UI actions to API calls and returns a cleanup function for subscriptions, models, and DOM.
