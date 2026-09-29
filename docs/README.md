# Affino DataGrid Documentation

This is the public documentation for the DataGrid repository. Choose one entry point and stay within that layer until you need more control.

## Start here

- [Getting started](./getting-started.md) - install the grid and render a useful table in a Vue application.
- [App layer guide](./app-layer.md) - the recommended, self-contained path for product teams using `DataGrid`.
- [Vue adapter guide](./vue-adapter.md) - headless Vue runtime, custom renderers, row models, and adapter ownership.
- [Core API guide](./core-api.md) - framework-independent row models, `DataGridApi`, lifecycle, state, events, and projection semantics.
- [Core factories reference](./reference/datagrid-core-factories-reference.md) - core runtime assembly and constructor options.
- [Package map](./datagrid-package-map.md) - package roles and when to move between layers.
- [Feature catalog](./datagrid-feature-catalog.md) - capability matrix and runtime modes.
- [Support status](./support-status.md) - implemented, partial, planned, advanced, and internal labels.
- [Examples](./examples/README.md) - copyable local, editing, state, and server integration examples.
- [App component API](./app-api.md) - props, events, state, and component refs.
- [API stability](./api-stability.md) - stable, advanced, and internal import guarantees.

The app guide is the primary user experience. The Vue and core guides are complete integration surfaces, not prerequisites for ordinary usage.

## Integration guides

- [Server datasource quick start](./server-datasource/quick-start.md)
- [Server datasource protocol](./server-datasource/reference/protocol.md)
- [Server datasource frontend adapter](./server-datasource/reference/frontend-adapter.md)
- [State and saved views](./datagrid-state-events-compute-diagnostics.md)
- [Editing and mutations](./datagrid-editing.md)
- [Clipboard and range workflows](./datagrid-clipboard.md)
- [Accessibility](./datagrid-accessibility.md)
- [Troubleshooting](./datagrid-troubleshooting-runbook.md)
- [Contributing](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)
- [Code of conduct](../CODE_OF_CONDUCT.md)

## Feature guides

- [Quick filter](./datagrid-quick-filter.md)
- [Formula engine](./datagrid-formula-engine-guide.md)
- [Tree data](./datagrid-tree-data.md)
- [Gantt](./datagrid-gantt.md)
- [Spreadsheet Vue app](./datagrid-spreadsheet-vue-app.md)

## API and architecture reference

- [Unified Grid API](./datagrid-grid-api.md)
- [Event matrix](./reference/datagrid-event-matrix.md)
- [Data source API](./reference/datagrid-data-source-api.md)
- [Architecture](./datagrid-architecture.md)
- [Virtualization support matrix](./reference/datagrid-virtualization-support-matrix.md)
- [Vue stable entrypoint](./reference/datagrid-vue-stable-entrypoint.md)
- [Vue advanced entrypoint](./reference/datagrid-vue-advanced-entrypoint.md)
- [Plugin capability model](./reference/datagrid-plugin-capability-model.md)
- [Community vs enterprise](./datagrid-vue-app-community-vs-enterprise.md)

## Specialized folders

- [server-datasource](./server-datasource/README.md) - backend integration kit.
- [perf](./perf/) - benchmark baselines and performance gates.
- [quality](./quality/) - generated/static quality baselines.
- [internal](./internal/README.md) - audits, plans, pipelines, checklists, and todos.

Research notes, audits, hypotheses, performance baselines, and delivery plans are intentionally excluded from the public reading path. Maintainers can find them under `docs/internal/` and `docs/perf/`.

## Advanced reference

- [Public reference index](./reference/README.md)
