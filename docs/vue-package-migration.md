# Vue package consolidation

Status: complete in the workspace. `@affino/datagrid-vue` is the sole published Vue integration package. The former `@affino/datagrid-vue-app` workspace package and compatibility facade have been removed. Previously published versions of that npm package are not replaced; consumers must migrate their dependency and imports.

The package root provides the ready-to-use table:

```ts
import { DataGrid } from "@affino/datagrid-vue"
```

Custom renderers can use the low-level Vue integration without importing the app renderer:

```ts
import { useDataGridRuntime } from "@affino/datagrid-vue/headless"
```

## Entry point map

| Previous entry | Current entry | Status |
| --- | --- | --- |
| `@affino/datagrid-vue-app` | `@affino/datagrid-vue` | Required package and root import migration |
| `@affino/datagrid-vue-app/gantt` | `@affino/datagrid-vue/gantt` | Preserved feature entry |
| `@affino/datagrid-vue-app/aggregations` | `@affino/datagrid-vue/aggregations` | Preserved feature entry |
| `@affino/datagrid-vue-app/advanced-filter` | `@affino/datagrid-vue/advanced-filter` | Preserved feature entry |
| `@affino/datagrid-vue-app/quick-filter` | `@affino/datagrid-vue/quick-filter` | Preserved feature entry |
| `@affino/datagrid-vue-app/find-replace` | `@affino/datagrid-vue/find-replace` | Preserved feature entry |
| `@affino/datagrid-vue-app/internal` | `@affino/datagrid-vue/internal` | Preserved for Affino integrations; internal contract only |
| `@affino/datagrid-vue` (adapter root) | `@affino/datagrid-vue/headless` | Use the explicit headless subpath |
| `@affino/datagrid-vue/stable`, `/advanced`, `/worker`, `/app` | Same existing adapter paths | Preserved compatibility aliases; use `/headless` for new custom-renderer integrations |

The root combines `app-layer/index` with the prior adapter stable exports. The app `DataGrid` is the default export. The source tree is now under `packages/datagrid-vue/src/app-layer`; the adapter remains under its own source directories. The `/headless` output is built separately and its tarball graph is checked for CSS and app UI imports.

The former `@affino/datagrid-vue-app` package directory, source wrappers, build configuration, and workspace aliases are gone. A source-level unified entry (`src/unified.ts`) mirrors the published root for workspace type resolution. Detailed component usage is in [`packages/datagrid-vue/README.component.md`](../packages/datagrid-vue/README.component.md).

## Validation contract

The Vue tarball consumer script packs the actual package and dependencies, installs them in temporary consumer projects outside the package source tree, and checks root, headless, and Gantt imports, type resolution, import without browser globals, and isolation of the headless graph. The Laravel tarball check remains independent and confirms Laravel does not acquire a Vue runtime dependency.

`createDataGridRuntime` returns `{ rowModel, columnModel, core, api }`, does not start Core automatically, and has no attached Vue lifecycle. Callers must `await runtime.core.dispose()`. Core disposal stops a started runtime and attempts all service cleanup; repeated calls share the same completion. It disposes the default row model and runtime-created column model; a supplied `options.rowModel` remains caller-owned and must be disposed by its owner. The Vue runtime service removes its subscriptions and exposes `stop(): Promise<void>`; await it to observe teardown completion or cleanup failure.

## Deferred orchestration work

- **Alternative row projection helpers:** `packages/datagrid-orchestration/src/rows/useDataGridRowsProjection.ts` applies quick and column filters and sorting to caller-provided `options.rows`. It has not been shown to reprocess Core output. Before changing it, trace all callers and prove matching semantics for value resolution, filter ordering, stable ties, grouping, pivoting, and pagination. Preserve it if it serves a distinct input contract.
- **Repeated virtual-window recomputation:** `packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts` routes model subscriptions and explicit methods through `recomputeVirtualWindow()`, which reads Core viewport state (or a fallback) and equality-checks before notifying. Synchronous callbacks can repeat calculation, but not publication. Optimize only with profiling/call-count evidence and tests for immediate state, totals, overscan, and subscription ordering.
