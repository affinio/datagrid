# Server-Backed Data Source

This folder is the practical integration kit for Affino DataGrid backend-owned tables.

Use it when your backend owns row access, filtering, sorting, paging, edits, history, consistency, or live updates. The first successful integration does not need the full protocol. It only needs one read endpoint:

```text
POST /api/{tableId}/pull
```

Start with a read-only grid, then add capabilities in layers.

## Canonical Reading Order

For new integrations:

1. [Quick start](./quick-start.md)
2. [Package installation](./package-installation.md)
3. [UX contract](./ux-contract.md)
4. [Integration playbook](./integration-playbook.md)
5. [Protocol](./reference/protocol.md)
6. [Consistency](./reference/consistency.md)
7. [Checklist](./checklist.md)

## Add capabilities by task

| Need | Endpoint or contract | Read next |
| --- | --- | --- |
| Read backend-owned rows | `POST /api/{tableId}/pull` | [Quick start](./quick-start.md) |
| Server-backed value filters | `POST /api/{tableId}/histogram` | [Frontend adapter](./reference/frontend-adapter.md) |
| Persist edits | `POST /api/{tableId}/edits` | [UX contract](./ux-contract.md), [integration playbook](./integration-playbook.md) |
| Fill unloaded ranges | `POST /api/{tableId}/fill-boundary`, `/fill/commit` | [Protocol](./reference/protocol.md) |
| Durable undo/redo | history endpoints | [History](../datagrid-history.md), [Consistency](./reference/consistency.md) |
| Live updates | `GET /api/changes?sinceVersion=...` | [Consistency](./reference/consistency.md), [Protocol](./reference/protocol.md) |
| Backend implementation | SQLAlchemy/FastAPI integration | [Integration playbook](./integration-playbook.md), [Backend template](./templates/backend-template.md) |

## Reference And Examples

- [Backend template](./templates/backend-template.md)
- [Frontend template](./templates/frontend-template.md)
- [Backend FastAPI reference](./reference/backend-fastapi.md)
- [Frontend adapter reference](./reference/frontend-adapter.md)
- [Advanced integration map](../internal/reference/server-datasource-integration-map.md)

## Notes

- The examples track the current `server_demo` implementation in this repo.
- Current limitations are documented in [consistency](./reference/consistency.md) and [protocol](./reference/protocol.md).
- Older reference pages are retained for cross-checking implementation details, but the files linked above are the canonical integration docs.
