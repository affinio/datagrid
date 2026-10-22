# Examples

Examples are grouped by integration layer so a framework-specific snippet is not mistaken for an engine contract.

## Framework-independent Core

- [Core engine example](../../packages/datagrid-core/docs/examples/local-data/README.md) — separate TypeScript files for schema, data, engine construction, rendering, subscriptions, and teardown. It uses no UI framework.

## Vue app integrations

These examples are intended for Vue 3 applications:

- [Local data and formatting](./local-data.md) — columns, sorting/filtering capabilities, and display-only formatting.
- [Editing and fill](./editing-and-fill.md) — editable columns, row identity, and spreadsheet fill behavior.
- [Controlled state](./controlled-state.md) — persist and restore unified grid state.
- [Server-backed rows](../server-datasource/quick-start.md) — backend-owned data and bounded viewport pulls.

The runnable showcase and sandbox are maintained separately. They demonstrate more features, but are not required reading for application integration.
