# `@affino/datagrid-vue-app-enterprise`

Enterprise app facade for Affino DataGrid Vue.

## Role

This package is the additive commercial layer on top of
[`@affino/datagrid-vue-app`](../datagrid-vue-app/README.md).

Community package keeps the default app-facing grid experience:

- declarative `<DataGrid />`
- column menu
- column layout
- advanced filter
- aggregations
- theme-aware default renderer

Enterprise package is reserved for higher-cost app layers:

- diagnostics / profiler / explain panels
- enterprise formula runtime controls
- enterprise formula packs
- performance / worker app presets
- license-gated enterprise app features

Current right-side inspector panel uses tabbed sections for `Overview`,
`License`, `Performance`, `Formula`, `Traces`, and `Raw`.
It surfaces the effective enterprise performance
policy, including active preset, compute mode, worker threshold, formula cache,
and merged virtualization behavior.
It also surfaces license status, tier, claim source, expiry, and feature scope,
so trial/scoped/expired states are visible inside the same enterprise tooling.
It also exposes enterprise formula-explain summaries such as execution levels,
recomputed fields, dirty nodes, and active formula fields.
Recent diagnostics captures are retained as trace history so teams can compare
opened vs refreshed runtime pressure without leaving the inspector panel.

Expected internal enterprise support packages:

- `@affino/datagrid-diagnostics-enterprise`
- `@affino/datagrid-formula-engine-enterprise`

## Package UX

Community:

```ts
import { DataGrid } from "@affino/datagrid-vue-app"
```

Enterprise:

```ts
import { DataGrid } from "@affino/datagrid-vue-app-enterprise"
```

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  license-key="affino-dg-v1:trial:demo:2099-12-31:all:0STI525"
  column-menu
  column-layout
  advanced-filter
  aggregations
  diagnostics
  formula-packs
  performance="throughput"
  :formula-runtime="{ formulaColumnCacheMaxColumns: 64 }"
/>
```

The intent is to keep enterprise as a strict superset of the community app
experience while changing only the dependency and import path.

License format:

- `affino-dg-v1:<tier>:<customer>:<expiresAt>:<features>:<checksum>`
- example features: `all` or `diagnostics,formulaRuntime,formulaPacks`

App-level provider:

```ts
import { provideAffinoDataGridEnterpriseLicense } from "@affino/datagrid-vue-app-enterprise"

provideAffinoDataGridEnterpriseLicense(
  "affino-dg-v1:trial:demo:2099-12-31:all:0STI525",
)
```

Current gating rule:

- enterprise diagnostics requires `licenseKey`
- enterprise formula runtime controls require `licenseKey`
- enterprise formula packs require `licenseKey`
- enterprise performance presets require `licenseKey`
- blocked premium requests surface an enterprise badge in the toolbar in addition
  to `console.warn`
- trial, expired, and invalid license states also surface a status badge in the toolbar

Current license ops flow:

- issue keys outside the runtime with
  [`scripts/issue-datagrid-enterprise-license.mjs`](../../scripts/issue-datagrid-enterprise-license.mjs)
- example:

```sh
node scripts/issue-datagrid-enterprise-license.mjs \
  --customer acme-inc \
  --expires-at 2026-12-31 \
  --tier trial \
  --features diagnostics,formulaRuntime,formulaPacks,performance
```

Current performance presets:

- `balanced`: default worker preset for mixed interactive usage
- `throughput`: lower patch threshold and larger caches for sustained worker throughput
- `formulaHeavy`: larger formula cache with tighter overscan for formula-dense grids
- `patchHeavy`: aggressive worker dispatch for mutation-heavy or streaming workloads

## Boundary

`@affino/datagrid-vue-app-enterprise` may depend on
`@affino/datagrid-vue-app`.

The reverse must never happen.
