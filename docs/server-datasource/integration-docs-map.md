# Server Datasource Integration Docs Map

This is the ordered reading path for package users and Codex agents integrating a backend-owned table.

First success only needs:

```text
POST /api/{tableId}/pull
```

Use the deeper protocol and consistency docs after the read-only grid renders.

## Adoption Route

1. [Quick start](./quick-start.md) - read-only in 10 minutes with `POST /api/{tableId}/pull`.
2. [Package installation](./package-installation.md) - frontend and backend packages.
3. [Server datasource README](./README.md) - staged capability overview.
4. [UX contract](./ux-contract.md) - sandbox-equivalent behavior without app-level reload workarounds.
5. [Integration playbook](./integration-playbook.md) - step-by-step integration for a real table.
6. [Integration checklist](./checklist.md) - final verification list.

## Capability Stages

| Stage | Add | Read |
| --- | --- | --- |
| 1. Read-only in 10 minutes | `POST /api/{tableId}/pull` | [Quick start](./quick-start.md) |
| 2. Add histograms | `POST /api/{tableId}/histogram` | [Quick start](./quick-start.md#2-add-histograms), [frontend adapter](./frontend-adapter.md) |
| 3. Add edits | `POST /api/{tableId}/edits` | [UX contract](./ux-contract.md), [integration playbook](./integration-playbook.md), [protocol](./protocol.md) |
| 4. Add fill | `POST /api/{tableId}/fill-boundary`, `POST /api/{tableId}/fill/commit` | [protocol](./protocol.md), [backend reference](./backend-fastapi.md) |
| 5. Add server history | table-scoped or shared undo/redo/status endpoints | [history](../datagrid-history.md), [consistency](./consistency.md), [protocol](./protocol.md) |
| 6. Add live updates | `GET /api/changes?sinceVersion=...` | [consistency](./consistency.md), [frontend adapter](./frontend-adapter.md), [protocol](./protocol.md) |
| 7. Advanced protocol/consistency | revisions, dataset versions, invalidation, conflict handling, selection operations | [protocol](./protocol.md), [consistency](./consistency.md), [selection operations](./selection-operations.md) |

## Frontend

- [Frontend adapter reference](./frontend-adapter.md) - `@affino/datagrid-server-adapters`.
- [Frontend template](./frontend-template.md) - Vue host app template.
- [Adapter package README](../../packages/datagrid-server-adapters/README.md) - public adapter package docs.
- [Vue row model package README](../../packages/datagrid-vue/README.md) - row model/runtime layer.
- [Vue app package README](../../packages/datagrid-vue-app/README.md) - `<DataGrid />` app component.
- [Package map](../datagrid-package-map.md) - package roles and install paths.
- [API start here](../datagrid-api-start-here.md) - stable API starter path.

## Backend And Protocol

- [Protocol](./protocol.md) - HTTP contract for pull, histogram, edits, fill, history, and change feed.
- [Backend template](./backend-template.md) - backend integration template.
- [Backend FastAPI reference](./backend-fastapi.md) - FastAPI reference implementation.
- [Consistency](./consistency.md) - `revision`, `datasetVersion`, invalidation, and conflict model.
- [Server selection operations](./selection-operations.md) - operation matrix for loaded, unloaded, placeholder, grouped, stale, local, blocked, server-delegated selection work, and planned clipboard delegation.

## Codex Support

- [Codex integration prompt](./codex-integration-prompt.md) - prompt for implementing an integration.
- [Core factories reference](../datagrid-core-factories-reference.md) - `createDataSourceBackedRowModel`.
- [State/events/diagnostics](../datagrid-state-events-compute-diagnostics.md) - `initialLoading`, `refreshing`, row-model state, and backpressure.
- [History](../datagrid-history.md) - undo/redo context.

## Internal References

- [Server grid UX plan](../internal/plans/server-grid-ux-plan.md) - implementation history, not the user integration path.
- [Old server data source checklist](../internal/checklists/server-data-source-checklist.md) - sandbox-oriented legacy checklist.
