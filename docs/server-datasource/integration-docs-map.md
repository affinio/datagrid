# Server Datasource Integration Docs Map

This is the ordered reading path for package users and Codex agents integrating a backend-owned table.

## Main Route

1. [Server datasource README](./README.md) - main entry point.
2. [Package installation](./package-installation.md) - frontend and backend packages.
3. [UX contract](./ux-contract.md) - sandbox-equivalent behavior without app-level reload workarounds.
4. [Quick start](./quick-start.md) - minimal working frontend/backend setup.
5. [Integration playbook](./integration-playbook.md) - step-by-step integration for a real table.
6. [Integration checklist](./checklist.md) - final verification list.

## Frontend

7. [Frontend adapter reference](./frontend-adapter.md) - `@affino/datagrid-server-adapters`.
8. [Frontend template](./frontend-template.md) - Vue host app template.
9. [Adapter package README](../../packages/datagrid-server-adapters/README.md) - public adapter package docs.
10. [Vue row model package README](../../packages/datagrid-vue/README.md) - row model/runtime layer.
11. [Vue app package README](../../packages/datagrid-vue-app/README.md) - `<DataGrid />` app component.

## Backend And Protocol

12. [Protocol](./protocol.md) - HTTP contract for pull, histogram, edits, fill, history, and change feed.
13. [Backend template](./backend-template.md) - backend integration template.
14. [Backend FastAPI reference](./backend-fastapi.md) - FastAPI reference implementation.
15. [Consistency](./consistency.md) - `revision`, `datasetVersion`, invalidation, and conflict model.

## Codex Support

16. [Codex integration prompt](./codex-integration-prompt.md) - prompt for implementing an integration.
17. [Core factories reference](../datagrid-core-factories-reference.md) - `createDataSourceBackedRowModel`.
18. [State/events/diagnostics](../datagrid-state-events-compute-diagnostics.md) - `initialLoading`, `refreshing`, row-model state, and backpressure.
19. [History](../datagrid-history.md) - undo/redo context.

## Internal References

- [Server grid UX plan](../internal/plans/server-grid-ux-plan.md) - implementation history, not the user integration path.
- [Old server data source checklist](../internal/checklists/server-data-source-checklist.md) - sandbox-oriented legacy checklist.

Recommended order for new users:

`README -> package-installation -> ux-contract -> quick-start -> integration-playbook -> protocol -> checklist`
