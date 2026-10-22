# API stability and versioning

Status: public policy reference.

Affino DataGrid publishes three API tiers. Import from the package entrypoint that matches the ownership level of your integration.

| Tier | Guarantee | Examples |
| --- | --- | --- |
| Stable | Semver-safe public contract. Breaking changes require a migration path. | `@affino/datagrid-vue`, `@affino/datagrid-vue`, `@affino/datagrid-vue/stable`, `@affino/datagrid-core` |
| Advanced | Supported power-user contract for custom renderers, adapters, workers, and runtime integration. It may evolve faster. | `@affino/datagrid-vue/advanced/*`, `@affino/datagrid-core/advanced` |
| Internal | Implementation detail with no application compatibility promise. | `./internal` subpaths and source-shaped deep imports |

## Cross-package versioning

Internal DataGrid package dependencies use pnpm's `workspace:*` protocol. When a package is published, pnpm resolves that reference to the current published version of the dependency instead of preserving an old repository-local version.

The repository checks this contract with `pnpm run quality:packages:compatibility`. In particular, `@affino/datagrid-server-client` and `@affino/datagrid-server-adapters` must resolve their Core dependency to the current `@affino/datagrid-core` version during publication.

The row-management additions in this slice (`rows.getById`, `rows.removeData`,
`rows.batchMutations`, and formula/computed-field unregister capability checks) are stable facade
contracts. Their availability remains capability-gated by the active row model;
unsupported operations retain the existing explicit error behavior.

`state.set(..., { atomic: true })` is a stable opt-in consistency contract for
best-effort rollback of local state components; it does not claim rollback for
irreversible datasource or adapter work.

## Import rules

Use package-root or documented subpath imports:

```ts
import { DataGrid } from "@affino/datagrid-vue"
import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"
import { useDataGridCellNavigation } from "@affino/datagrid-vue/advanced/selection"
```

Do not import from `src/*`, private files, generated `dist` paths, or undocumented package internals. These paths can change without a migration window.

The stable core root no longer exports `createClientRowModel`, `ClientRowModel`, or `CreateClientRowModelOptions`. Migrate those imports to the explicitly advanced names:

```ts
// Before: import { createClientRowModel } from "@affino/datagrid-core"
import { createAdvancedClientRowModel } from "@affino/datagrid-core/advanced-client-row-model"
```

`AdvancedClientRowModel` and `CreateAdvancedClientRowModelOptions` are exported from the same subpath for type imports.

## What changes require migration notes

A change needs a migration note when it affects a stable export, component prop, emitted event, public type, datasource request/response contract, state payload, or documented behavior. The migration note should identify the old contract, the replacement, and the version boundary.

Put consumer-facing migration notes next to the affected guide or release note. Data-source API changes belong in the [data source API](../packages/datagrid-core/docs/reference/data-source-api.md); HTTP wire changes belong in the [server datasource protocol](./server-datasource/reference/protocol.md). Historical repository migrations are kept in the internal [legacy migration reference](./internal/reference/datagrid-legacy-migration-guide.md).

## Package ownership

The app component, diagnostics UI, formula runtime options, and performance
presets ship from `@affino/datagrid-vue`. Formula language APIs and reusable
function packs ship from `@affino/datagrid-formula-engine`. These capabilities
do not require a separate enterprise package or license key. Framework-neutral
runtime behavior remains owned by core and orchestration packages.

## Compatibility checks

The core API exposes version and protocol metadata through `api.meta`. Integration code that coordinates more than one runtime should use these values rather than guessing package internals. Public events and state payloads should be treated as versioned contracts.
