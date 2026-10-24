# DataGrid Package Map

Status: maintained public documentation.

This page is the external package decision sheet for Affino DataGrid. For normal Vue applications, start with `@affino/datagrid-vue`.

There is no published package named `@affino/datagrid` in this workspace. Do not use `@affino/datagrid` as the default install path unless a future release explicitly adds that package.

## Beginner Recommendation

Use this path first:

```bash
pnpm add @affino/datagrid-vue
```

```ts
import { DataGrid } from "@affino/datagrid-vue"
```

Move to lower-level packages only when your integration needs runtime ownership, custom rendering, server-owned data, or platform-level contracts.

## Package Decision Table

| Package | Intended user | When to use | API track | Status | Install notes | Beginner recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `@affino/datagrid-vue` | Vue app engineers | You want the app-facing `<DataGrid />` component with built-in rendering and UX. | Stable app root | Public | Install directly for normal Vue app grids. | Start here. |
| `@affino/datagrid-vue/headless` | Vue integration/platform engineers | You need runtime ownership, adapter primitives, datasource row models, or custom renderer wiring. | Stable `./headless` and `./stable`; `./advanced/*`, `./app`, and `./worker` are advanced integration surfaces. | Public | Same package as the app component; select the headless subpath for custom renderers. | Use when you need runtime control. |
| `@affino/datagrid-core` | Platform/runtime engineers | You need deterministic core contracts, row-model primitives, `DataGridApi`, state/events, or model-level integration. | Root is stable; `./advanced` is power-user; `./internal` is unsafe/internal. | Public | Most Vue apps consume this transitively; install directly only for core/headless work. | Not a beginner app package. |
| `@affino/datagrid-dom` | Framework-independent browser app engineers | You need the DOM adapter without Vue or another UI runtime. | Stable root; optional `./xlsx` export integration. | Initial implementation | Requires Core and orchestration; theme, XLSX writer, and formula engine are optional. | Use when the host app does not use Vue. |
| `@affino/datagrid-server-adapters` | App teams with Affino-shaped HTTP backends | You want `createAffinoDatasource(...)` for the standard Affino server datasource endpoint shape. | Stable adapter surface | Public | Install with `@affino/datagrid-vue` for server-backed grids. | Use for backend-owned rows. |
| `@affino/datagrid-server-client` | Transport/integration engineers | You need lower-level polling, invalidation, normalization, or custom datasource transport helpers. | Stable client helper surface | Public | Advanced server integrations only; ordinary Affino HTTP grids should start with `@affino/datagrid-server-adapters`. | Not a beginner package. |
| `@affino/datagrid-theme` | App/design-system engineers | You need shared DataGrid theme tokens or presets. | Stable theme package | Public | Optional direct install when sharing theme config across packages. | Optional. |
| `@affino/datagrid-format` | Adapter/runtime engineers | You need shared number/date/currency formatting contracts outside the app component. | Stable support package | Public | Usually consumed by DataGrid packages; install directly for cross-adapter formatting reuse. | Optional. |
| `@affino/datagrid-pivot` | Analytics/platform engineers | You need pivot spec helpers, layout snapshots, normalization, cloning, equality, or drilldown contracts. | Stable contracts/helpers | Public | Use directly for pivot integrations or saved pivot layouts. | Optional analytics path. |
| `@affino/datagrid-formula-engine` | Formula/runtime engineers | You need formula parsing, diagnostics, compile artifacts, graph planning, or base runtime semantics. | Stable formula package | Public | Use directly for formula-centric integrations. | Optional formula path. |
| `@affino/datagrid-spreadsheet-vue-app` | Spreadsheet/workbook app engineers | You need the workbook-oriented Vue shell built on DataGrid packages. | Stable app package | Public | Use for spreadsheet-first workbook surfaces, not ordinary DataGrid tables. | Use only for workbook-style apps. |
| `@affino/datagrid-gantt` | Planning/timeline integration engineers | You need lower-level Gantt package contracts behind the app Gantt view. | Support package | Public | Ordinary Gantt usage should start through `@affino/datagrid-vue` view-mode/docs. | Optional advanced feature package. |
| `@affino/datagrid-worker` | Runtime/performance engineers | You need worker-owned runtime/protocol integration. | Advanced runtime support | Public | Most apps should use documented worker-owned row-model paths instead of direct worker plumbing. | Not a beginner package. |
| `@affino/datagrid-plugins` | Plugin/runtime host engineers | You need capability-gated plugin runtime foundations. | Advanced capability runtime | Public | Public app extensions should prefer stable `DataGridApi.plugins` unless capability negotiation is required. | Not a beginner package. |
| `@affino/datagrid-orchestration` | Adapter/framework engineers | You need adapter-internal interaction orchestration utilities. | Advanced adapter-internal surface | Public | Not intended as an app-level stable API. | Avoid for normal apps. |
| `@affino/datagrid-laravel` | Laravel/Livewire integration engineers | You need Laravel-facing DataGrid integration contracts. | Stable framework facade | Public | Use for Laravel integrations, not Vue-only apps. | Framework-specific. |
| `@affino/datagrid-showcase` | Maintainers and evaluators | You need the product-shaped external demo app without sandbox validation/debug controls. | Internal/private demo app | Internal tooling | Private workspace package; run with `pnpm run showcase:dev`. | Do not install in apps. |
| `@affino/datagrid-sandbox` | Maintainers | You need local demos, validation scenarios, or manual/e2e sandbox flows. | Internal/private app | Internal tooling | Package is private. | Do not install in apps. |

## Entrypoint Tier Rules

| Tier | Meaning | Examples |
| --- | --- | --- |
| Stable | Semver-safe public API. | `@affino/datagrid-vue`, `@affino/datagrid-vue`, `@affino/datagrid-vue/stable`, `@affino/datagrid-core` |
| Advanced | Supported power-user API for custom renderers, adapters, runtime ownership, or low-level integration. | `@affino/datagrid-vue/advanced/*`, `@affino/datagrid-core/advanced`, `@affino/datagrid-orchestration` |
| Internal | Unsafe implementation surface with no app-level compatibility promise. | `./internal` subpaths, package-private implementation files |

Stable does not mean beginner-facing. It means the API is semver-safe. The beginner-facing path remains `@affino/datagrid-vue`.

## Common Install Paths

Local Vue rows:

```bash
pnpm add @affino/datagrid-vue
```

Server-backed Vue grid:

```bash
pnpm add @affino/datagrid-vue @affino/datagrid-vue @affino/datagrid-server-adapters
```

Headless/custom Vue runtime:

```bash
pnpm add @affino/datagrid-vue @affino/datagrid-core
```

Spreadsheet workbook shell:

```bash
pnpm add @affino/datagrid-spreadsheet-vue-app
```

Formula packs, runtime presets, and diagnostics are available through
`@affino/datagrid-formula-engine` and `@affino/datagrid-vue`. There is no
separate package or license key required for these features.
