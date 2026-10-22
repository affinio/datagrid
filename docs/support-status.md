# DataGrid support status

Status: public product reference.
Last reviewed: 2026-10-21.

This page explains the labels used in the documentation. The feature catalog describes the capability inventory; this page tells you whether a capability is safe to plan around today.

## Status labels

| Label | Meaning | Can a product depend on it? |
| --- | --- | --- |
| **Implemented** | Shipped in the referenced package and covered by the current public contract. | Yes, within the documented tier and runtime limits. |
| **Partial** | The public path exists, but important modes, scale limits, or integrations are still incomplete. | Only after reading the linked limitations and testing the exact mode. |
| **Planned** | Roadmap, proposal, audit, or internal implementation work; not a current product capability. | No. Do not build production dependencies on it. |
| **Not supported** | There is no shipped package contract for this capability. A host may implement it separately. | No, unless your own adapter/backend provides and validates it. |
| **Advanced** | Supported power-user surface that can evolve faster than the stable tier. | Yes, if the package and entrypoint are explicitly marked advanced. |
| **Internal** | Maintainer-only implementation detail. | No. |

## Current product-level status

| Area | Status | Practical guidance |
| --- | --- | --- |
| Vue application grid with local data | Implemented | Start with [`@affino/datagrid-vue`](./getting-started.md). |
| Headless core row models and `DataGridApi` | Implemented | Use the [core guide](../packages/datagrid-core/docs/README.md) and [method reference](../packages/datagrid-core/docs/reference/api/grid-api-methods.md). |
| Vue adapter and custom hosts | Implemented | Use the [Vue adapter guide](./vue-adapter.md); advanced render and orchestration entrypoints are separately labeled. |
| Row and cell selection | Implemented | Cell-range behavior remains the row-header default. Opt into row-ID selection, click modifiers, Shift keyboard ranges, and drag preview/commit with `rowHeader.action: "select-records"`; see the [row-selection reference](../packages/datagrid-core/docs/reference/modules/selection/row-selection.md). |
| Column-group headers and top/body/bottom row pinning | Implemented | Core models and the Vue app stage support these contracts, including cross-pane group headers and separate pinned-row surfaces. See [column state](../packages/datagrid-vue/README.component.md#column-state) and the [virtualization support matrix](./reference/datagrid-virtualization-support-matrix.md). |
| Row and column virtualization | Implemented | The standard Vue app path supports virtual rows; opt into column virtualization for wide tables. Browser scale and mode limits are in the [virtualization support matrix](./reference/datagrid-virtualization-support-matrix.md). |
| Touch/mobile interactions | Partial | Native touch scrolling and explicit interaction handles have browser coverage. Real-device validation and hardware threshold review remain open; see the [mobile touch audit](./internal/audits/202605/MOBILE_TOUCH_SCROLL_AUDIT.md). |
| Server datasource pull, editing, fill, history, invalidation, polling, and WebSocket updates | Implemented | Use the [server datasource guide](./server-datasource/quick-start.md). The demo backend supports region grouping only; arbitrary server tree/pivot projections and offline mutation replay are not supported. |
| Server-side tree/pivot projection and arbitrary grouping | Partial | Client projections are supported; the FastAPI demo supports only single-level `region` grouping. Other server projections must be implemented by the host backend. |
| Offline mutation queue and durable reconnect replay | Not supported | The datasource keeps read/cache recovery behavior, but does not queue and replay mutations after reconnect. |
| Server-sent events (SSE) transport | Not supported | Supply a host-owned transport through the live-update transport factory if needed. |
| Client tree data and pivot projection | Implemented | Core and adapter projection paths are available; server-side behavior has separate capability limits. |
| Formula evaluation in the client/runtime | Implemented | Use the [formula guide](./datagrid-formula-engine-guide.md); server-evaluated formulas remain host-owned. |
| Spreadsheet workbook shell and interaction model | Implemented | Use the [spreadsheet guide](./datagrid-spreadsheet-vue-app.md); structural formula rewrites still have documented limitations. |
| Virtualized screen-reader workflows | Partial | ARIA state and browser contracts are implemented; manual assistive-technology validation and some grouped/server-placeholder semantics remain open. See [accessibility](./datagrid-accessibility.md). |
| General column header groups | Implemented | Nested group paths, resizing, visibility, reorder, and pinning are part of the column model and app renderer. |

## How to interpret feature pages

Every public feature page should state its status near the title and link to this page when a capability is partial or planned. Internal audits, comparisons, hypotheses, and implementation plans live under [`docs/internal/`](./internal/README.md) and are not product promises.

