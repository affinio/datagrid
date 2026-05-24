# DataGrid API Start Here

Updated: 2026-05-24

This guide explains the stable Affino DataGrid API path for external engineers without making the beginner path look harder than it is.

## Short Version

Start with the app component:

```ts
import { DataGrid } from "@affino/datagrid-vue-app"
```

Use lower-level packages only when your integration needs lower-level ownership:

| Need | Use | Why |
| --- | --- | --- |
| Normal Vue app grid | `DataGrid` from `@affino/datagrid-vue-app` | App-facing component with built-in renderer and UX. |
| Runtime/headless ownership | `@affino/datagrid-vue` | Vue runtime, row-model factories, context/selectors, and adapter-level integration. |
| Platform/core integration | `@affino/datagrid-core` | Core row model, state, event, and `DataGridApi` contracts. |
| Custom renderer, adapter, or interaction plumbing | `/advanced` entrypoints | Power-user APIs for low-level integration work. |

## Stable Does Not Mean Beginner

Stable means semver-safe. It does not mean every stable export is part of the first-use path.

- Beginner app path: `@affino/datagrid-vue-app`
- Stable runtime path: `@affino/datagrid-vue` or `@affino/datagrid-vue/stable`
- Stable core path: `@affino/datagrid-core`
- Power-user path: `@affino/datagrid-vue/advanced/*` or `@affino/datagrid-core/advanced`
- Internal path: `./internal` subpaths, only for package implementation work

Most app teams should not need `/advanced` imports.

## Starter API Subset

Use this subset first. It covers most app integrations without requiring direct core API ownership.

| Task | API |
| --- | --- |
| Render a Vue grid | `DataGrid` from `@affino/datagrid-vue-app` |
| Provide local data | `rows` prop |
| Define columns | `columns` prop with `key`, `label`, and optional `initialState` |
| Enable virtualization | `virtualization` prop |
| Persist app state | `v-model:state` or saved-view helpers |
| Persist column layout | `v-model:column-state` or unified state |
| Enable full-row checkbox selection | `rowSelection` / `rowSelectionState` |
| Enable spreadsheet-like fill | `fill-handle` |
| Enable range move | `range-move` |
| Use server-backed rows | `createDataSourceBackedRowModel(...)` plus a datasource adapter |
| Own runtime/headless behavior | `useDataGridRuntime` from `@affino/datagrid-vue` |
| Use core API directly | `DataGridApi` from `@affino/datagrid-core` |

## Package Roles

### `@affino/datagrid-vue-app`

Use this for normal Vue applications. It owns the app-facing component and built-in UX.

```vue
<DataGrid :rows="rows" :columns="columns" virtualization />
```

### `@affino/datagrid-vue`

Use this when you need Vue runtime or headless ownership instead of the default app component path.

Typical cases:

- custom renderer shell
- custom host integration
- datasource-backed row-model setup
- runtime/context access
- adapter-level selectors or overlay helpers

### `@affino/datagrid-core`

Use this when you are integrating core model contracts directly.

Typical cases:

- platform package work
- custom row-model behavior
- stable `DataGridApi` integration
- state/event/model contract tests

### `/advanced` Entrypoints

Use `/advanced` only when you intentionally own lower-level integration details.

Typical cases:

- custom renderer plumbing
- adapter internals
- viewport controller integration
- low-level interaction orchestration
- advanced core runtime integration

Do not use `/advanced` as a shortcut for normal app features.

## Mutation Decision Table

Several APIs can change rows or projection state. Use the one that matches the intent.

| Use case | Preferred API | What it means |
| --- | --- | --- |
| External data update or backend patch | `api.rows.patch(...)` | Applies row updates with explicit patch policy flags. |
| User edit flow | `api.rows.applyEdits(...)` | Applies edit-oriented updates and can optionally reapply the view. |
| Many row updates as one logical cycle | `api.rows.batch(...)` | Groups row operations into one coalesced facade event cycle. |
| Structured transaction, undo/redo-style mutation, or rollback path | `api.transaction.apply(...)` | Uses the transaction subsystem for structured mutation semantics. |
| Data did not change, but projection should recompute | `api.view.reapply()` | Recomputes sort/filter/group/pivot projection only. |

Rules of thumb:

- Use `applyEdits` for user edits.
- Use `patch` for external row-value updates.
- Use `batch` when many row changes should notify as one logical change.
- Use `transaction.apply` when you need transaction semantics.
- Use `view.reapply` when you need to recompute the view without changing data.

## Selection Terminology

Affino DataGrid has related but separate selection concepts.

| Term | Meaning | Common API |
| --- | --- | --- |
| Cell/range selection | The active cell or one or more rectangular ranges. Used for keyboard navigation, clipboard, fill, summaries, and range interactions. | `api.selection`, `selection-change` |
| Row selection | Full-row checkbox-style selection, including select-all and controlled row id state. | `rowSelection`, `rowSelectionState`, `row-selection-change` |
| Selection summary | Aggregates over selected scope. | `api.selection.summarize(...)` |
| Selected row data | Selected row payloads resolved against current projected rows. | row-selection APIs/events |

Use `api.selection` for cell/range workflows. Use `rowSelection` and `rowSelectionState` for checkbox/full-row selection.

## Server Datasource Pointer

Use server datasource when your backend owns large data access, filtering, sorting, paging, history, or consistency.

Start with:

- [Server datasource quick start](./server-datasource/quick-start.md)
- [Server datasource integration map](./server-datasource/integration-docs-map.md)
- [Package map](./datagrid-package-map.md)

Minimal frontend package path:

```bash
pnpm add @affino/datagrid-vue-app @affino/datagrid-vue @affino/datagrid-server-adapters
```

Minimal frontend setup:

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

Then pass `rowModel` to `DataGrid`:

```vue
<DataGrid :row-model="rowModel" :columns="columns" virtualization />
```

## Where To Go Next

- [Package map](./datagrid-package-map.md) - package roles, tiers, install paths, and community/enterprise status.
- [Vue stable entrypoint](./datagrid-vue-stable-entrypoint.md) - stable Vue runtime entrypoints.
- [Grid API](./datagrid-grid-api.md) - full `DataGridApi` reference.
- [Versioned public protocol](./datagrid-versioned-public-protocol.md) - semver, deprecation, codemod, and deep-import rules.
- [Feature catalog](./datagrid-feature-catalog.md) - full capability inventory.
