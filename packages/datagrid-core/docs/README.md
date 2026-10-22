# `@affino/datagrid-core` documentation

This section documents the framework-independent engine: data and view models, API, contracts, and adapter integration. It does not describe a ready-made table UI. For the Vue component and user-facing configuration, see the [DataGrid documentation](../../../docs/README.md).

## Reading path

1. [Local data: first example](./examples/local-data/README.md) — assemble Core and render a small DOM table. It teaches the boundaries; it is not a production adapter.
2. [API overview](./grid-api.md) — learn what `DataGridApi` owns, how its namespaces are organized, and which operation matches a task.
3. [Model and API construction](./reference/factories.md) — constructors and the recommended runtime assembly path.
4. [Core and UI adapter boundaries](./integration-guide.md) — ownership of data, virtual windows, DOM, events, and gestures.
5. [Method reference](./reference/grid-api-methods.md) — complete signatures and semantics.

Use these references as needed; they describe individual contracts rather than mandatory learning steps:

- [Cell and range selection](./reference/cell-range-selection.md) — rectangular cell snapshots, range geometry, summaries, virtual coverage, and the column-selection boundary.
- [Row selection](./reference/row-selection.md) — framework-independent selected-record IDs, range intents, and drag sessions.
- [Datasource](./reference/data-source-api.md) — pull, push, invalidation, and backpressure contracts.
- [Advanced API](./reference/advanced-api.md) — lower-level entrypoints with a faster-changing contract.
- [Generated declaration catalog](../../../docs/reference/generated/datagrid-public-api-declarations.md) — declaration-derived export inventory, not a usage guide.

## Cross-package contracts

These documents cover behavior spanning Core, adapters, and the ready-made application layer, so they remain in the monorepo documentation:

- [Architecture and package boundaries](../../../docs/datagrid-architecture.md)
- [Virtualization support matrix](../../../docs/reference/datagrid-virtualization-support-matrix.md)
- [Accessibility contract](../../../docs/reference/datagrid-headless-a11y-contract.md)
- [Event matrix](../../../docs/reference/datagrid-event-matrix.md)
- [API stability and entrypoint tiers](../../../docs/api-stability.md)
- [Orchestration compatibility](../../../docs/internal/reference/datagrid-orchestration-public-contract.md)
