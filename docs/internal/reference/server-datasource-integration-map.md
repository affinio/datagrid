# Server Datasource Integration Docs Map

This is the ordered reading path for package users and backend integrators integrating a backend-owned table.

First success only needs:

```text
POST /api/{tableId}/pull
```

Use the deeper protocol and consistency docs after the read-only grid renders.

## Adoption Route

1. [Quick start](../../server-datasource/quick-start.md) - read-only in 10 minutes with `POST /api/{tableId}/pull`.
2. [Package installation](../../server-datasource/package-installation.md) - frontend and backend packages.
3. [Server datasource README](../../server-datasource/README.md) - staged capability overview.
4. [UX contract](../../server-datasource/ux-contract.md) - sandbox-equivalent behavior without app-level reload workarounds.
5. [Integration playbook](../../server-datasource/integration-playbook.md) - step-by-step integration for a real table.
6. [Integration checklist](../../server-datasource/checklist.md) - final verification list.

## Capability Stages

| Stage | Add | Read |
| --- | --- | --- |
| 1. Read-only in 10 minutes | `POST /api/{tableId}/pull` | [Quick start](../../server-datasource/quick-start.md) |
| 2. Add histograms | `POST /api/{tableId}/histogram` | [Quick start](../../server-datasource/quick-start.md#2-add-histograms), [frontend adapter](../../server-datasource/reference/frontend-adapter.md) |
| 3. Add edits | `POST /api/{tableId}/edits` | [UX contract](../../server-datasource/ux-contract.md), [integration playbook](../../server-datasource/integration-playbook.md), [protocol](../../server-datasource/reference/protocol.md) |
| 4. Add fill | `POST /api/{tableId}/fill-boundary`, `POST /api/{tableId}/fill/commit` | [protocol](../../server-datasource/reference/protocol.md), [backend reference](../../server-datasource/reference/backend-fastapi.md) |
| 5. Add server history | table-scoped or shared undo/redo/status endpoints | [history](../../datagrid-history.md), [consistency](../../server-datasource/reference/consistency.md), [protocol](../../server-datasource/reference/protocol.md) |
| 6. Add live updates | `GET /api/changes?sinceVersion=...` | [consistency](../../server-datasource/reference/consistency.md), [frontend adapter](../../server-datasource/reference/frontend-adapter.md), [protocol](../../server-datasource/reference/protocol.md) |
| 7. Advanced protocol/consistency | revisions, dataset versions, invalidation, conflict handling, selection operations | [protocol](../../server-datasource/reference/protocol.md), [consistency](../../server-datasource/reference/consistency.md), [selection operations](../../server-datasource/reference/selection-operations.md) |

## Frontend

- [Frontend adapter reference](../../server-datasource/reference/frontend-adapter.md) - `@affino/datagrid-server-adapters`.
- [Frontend template](../../server-datasource/templates/frontend-template.md) - Vue host app template.
- [Adapter package README](../../../packages/datagrid-server-adapters/README.md) - public adapter package docs.
- [Vue row model package README](../../../packages/datagrid-vue/README.md) - row model/runtime layer.
- [Vue app package README](../../../packages/datagrid-vue-app/README.md) - `<DataGrid />` app component.
- [Package map](../../datagrid-package-map.md) - package roles and install paths.
- [Documentation index](../../README.md) - choose the app, Vue, or core integration layer.

## Backend And Protocol

- [Protocol](../../server-datasource/reference/protocol.md) - HTTP contract for pull, histogram, edits, fill, history, and change feed.
- [Backend template](../../server-datasource/templates/backend-template.md) - backend integration template.
- [Backend FastAPI reference](../../server-datasource/reference/backend-fastapi.md) - FastAPI reference implementation.
- [Consistency](../../server-datasource/reference/consistency.md) - `revision`, `datasetVersion`, invalidation, and conflict model.
- [Server selection operations](../../server-datasource/reference/selection-operations.md) - operation matrix for loaded, unloaded, placeholder, grouped, stale, local, blocked, server-delegated selection work, and planned clipboard delegation.
