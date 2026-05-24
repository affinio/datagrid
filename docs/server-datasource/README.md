# Server-Backed Data Source

This folder is the practical integration kit for Affino DataGrid backend-owned tables.

Use it when your backend owns row access, filtering, sorting, paging, edits, history, consistency, or live updates. The first successful integration does not need the full protocol. It only needs one read endpoint:

```text
POST /api/{tableId}/pull
```

Start with a read-only grid, then add capabilities in layers.

## Adoption Path

### 1. Read-Only In 10 Minutes

Goal: render backend-owned rows in `<DataGrid />`.

Implement only:

- `POST /api/{tableId}/pull`

Frontend packages:

```bash
pnpm add @affino/datagrid-vue-app @affino/datagrid-vue @affino/datagrid-server-adapters
```

Read:

- [Quick start](./quick-start.md)
- [Package installation](./package-installation.md)

### 2. Add Histograms

Goal: support value-list column filters backed by the server.

Add:

- `POST /api/{tableId}/histogram`

Read:

- [Quick start: add histograms](./quick-start.md#2-add-histograms)
- [Frontend adapter reference](./frontend-adapter.md)

### 3. Add Edits

Goal: commit user edits through the backend instead of local-only row patches.

Add:

- `POST /api/{tableId}/edits`

Read:

- [UX contract](./ux-contract.md)
- [Integration playbook](./integration-playbook.md)
- [Backend template](./backend-template.md)

### 4. Add Fill

Goal: support server-backed fill handle behavior for unloaded or backend-owned ranges.

Add:

- `POST /api/{tableId}/fill-boundary`
- `POST /api/{tableId}/fill/commit`

Read:

- [Protocol](./protocol.md)
- [Backend FastAPI reference](./backend-fastapi.md)

### 5. Add Server History

Goal: support durable undo/redo over backend operations.

Add table-scoped or shared history endpoints:

- `POST /api/{tableId}/operations/{operationId}/undo`
- `POST /api/{tableId}/operations/{operationId}/redo`
- `POST /api/history/undo`
- `POST /api/history/redo`
- `POST /api/history/status`

Read:

- [History](../datagrid-history.md)
- [Consistency](./consistency.md)
- [Protocol](./protocol.md)

### 6. Add Live Updates

Goal: refresh client state as backend rows change.

Add:

- `GET /api/changes?sinceVersion=...`

The server demo also documents WebSocket-style live updates where available.

Read:

- [Consistency](./consistency.md)
- [Protocol](./protocol.md)
- [Frontend adapter reference](./frontend-adapter.md)

### 7. Advanced Protocol And Consistency

Use the full protocol and consistency docs when you need revisions, dataset versions, invalidation, conflict behavior, server-side selection semantics, retries, or enterprise-grade backend contracts.

Read:

- [Protocol](./protocol.md)
- [Consistency](./consistency.md)
- [Server selection operations](./selection-operations.md)
- [Integration checklist](./checklist.md)

## Canonical Reading Order

For new integrations:

1. [Quick start](./quick-start.md)
2. [Package installation](./package-installation.md)
3. [UX contract](./ux-contract.md)
4. [Integration playbook](./integration-playbook.md)
5. [Protocol](./protocol.md)
6. [Consistency](./consistency.md)
7. [Checklist](./checklist.md)

## Reference And Examples

- [Backend template](./backend-template.md)
- [Frontend template](./frontend-template.md)
- [Backend FastAPI reference](./backend-fastapi.md)
- [Frontend adapter reference](./frontend-adapter.md)
- [Integration docs map](./integration-docs-map.md)
- [Codex integration prompt](./codex-integration-prompt.md)

## Notes

- The examples track the current `server_demo` implementation in this repo.
- Current limitations are documented in [consistency](./consistency.md) and [protocol](./protocol.md).
- Older reference pages are retained for cross-checking implementation details, but the files linked above are the canonical integration docs.
