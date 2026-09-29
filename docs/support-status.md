# DataGrid support status

Status: public product reference.

This page explains the labels used in the documentation. The feature catalog describes the capability inventory; this page tells you whether a capability is safe to plan around today.

## Status labels

| Label | Meaning | Can a product depend on it? |
| --- | --- | --- |
| **Implemented** | Shipped in the referenced package and covered by the current public contract. | Yes, within the documented tier and runtime limits. |
| **Partial** | The public path exists, but important modes, scale limits, or integrations are still incomplete. | Only after reading the linked limitations and testing the exact mode. |
| **Planned** | Roadmap, proposal, audit, or internal implementation work; not a current product capability. | No. Do not build production dependencies on it. |
| **Advanced** | Supported power-user surface that can evolve faster than the stable tier. | Yes, if the package and entrypoint are explicitly marked advanced. |
| **Internal** | Maintainer-only implementation detail. | No. |

## Current product-level status

| Area | Status | Practical guidance |
| --- | --- | --- |
| Vue application grid with local data | Implemented | Start with [`@affino/datagrid-vue-app`](./getting-started.md). |
| Headless core row models and `DataGridApi` | Implemented | Use the [core guide](./core-api.md) and [method reference](./reference/datagrid-grid-api-methods.md). |
| Vue adapter and custom hosts | Implemented | Use the [Vue adapter guide](./vue-adapter.md); advanced render and orchestration entrypoints are separately labeled. |
| Server datasource pull, editing, fill, history, invalidation | Implemented | Use the [server datasource quick start](./server-datasource/quick-start.md) and check backend responsibilities. |
| Server-side tree/pivot projection, offline replay, live SSE/WebSocket transport | Partial or planned | The protocol leaves room for these modes, but the shipped demo/backend path is not a complete enterprise implementation. See the [server datasource status](./server-datasource/README.md). |
| Client tree data and pivot projection | Implemented | Core and adapter projection paths are available; server-side behavior has separate capability limits. |
| Formula evaluation in the client/runtime | Implemented | Use the [formula guide](./datagrid-formula-engine-guide.md); server-evaluated formulas remain host-owned. |
| Spreadsheet workbook shell and interaction model | Implemented | Use the [spreadsheet guide](./datagrid-spreadsheet-vue-app.md); structural formula rewrites still have documented limitations. |
| Offline mutation queue and conflict replay | Planned | Do not assume automatic offline synchronization from the current datasource contract. |
| General column groups and top/bottom row pinning | Partial | Some shell and pivot behavior exists, but these are not complete stable public contracts. |

## How to interpret feature pages

Every public feature page should state its status near the title and link to this page when a capability is partial or planned. Internal audits, comparisons, hypotheses, and implementation plans live under [`docs/internal/`](./internal/README.md) and are not product promises.

