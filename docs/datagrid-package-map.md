# DataGrid Package Map

Updated: 2026-05-24

This page is the external package decision sheet for Affino DataGrid. For normal Vue applications, start with `@affino/datagrid-vue-app`.

There is no published package named `@affino/datagrid` in this workspace. Do not use `@affino/datagrid` as the default install path unless a future release explicitly adds that package.

## Beginner Recommendation

Use this path first:

```bash
pnpm add @affino/datagrid-vue-app
```

```ts
import { DataGrid } from "@affino/datagrid-vue-app"
```

Move to lower-level packages only when your integration needs runtime ownership, custom rendering, server-owned data, or platform-level contracts.

## Package Decision Table

| Package | Intended user | When to use | Tier | Status | Install notes | Beginner recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `@affino/datagrid-vue-app` | Vue app engineers | You want the app-facing `<DataGrid />` component with built-in rendering and UX. | Stable app surface | Community | Install directly for normal Vue app grids. | Start here. |
| `@affino/datagrid-vue` | Vue integration/platform engineers | You need runtime ownership, headless integration, adapter primitives, datasource row models, or custom renderer wiring. | Root and `./stable` are stable; `./app`, `./app/worker`, `./worker`, and `./advanced/*` are advanced integration surfaces. | Community | Install when you need APIs below the app component or when server datasource setup requires row-model factories. | Use after `@affino/datagrid-vue-app` when you need runtime control. |
| `@affino/datagrid-core` | Platform/runtime engineers | You need deterministic core contracts, row-model primitives, `DataGridApi`, state/events, or model-level integration. | Root is stable; `./advanced` is power-user; `./internal` is unsafe/internal. | Community | Most Vue apps consume this transitively; install directly only for core/headless work. | Not a beginner app package. |
| `@affino/datagrid-server-adapters` | App teams with Affino-shaped HTTP backends | You want `createAffinoDatasource(...)` for the standard Affino server datasource endpoint shape. | Stable adapter surface | Community | Install with `@affino/datagrid-vue-app` and `@affino/datagrid-vue` for server-backed grids. | Use for backend-owned rows. |
| `@affino/datagrid-server-client` | Transport/integration engineers | You need lower-level polling, invalidation, normalization, or custom datasource transport helpers. | Stable client helper surface | Community | Advanced server integrations only; ordinary Affino HTTP grids should start with `@affino/datagrid-server-adapters`. | Not a beginner package. |
| `@affino/datagrid-theme` | App/design-system engineers | You need shared DataGrid theme tokens or presets. | Stable theme package | Community | Optional direct install when sharing theme config across packages. | Optional. |
| `@affino/datagrid-format` | Adapter/runtime engineers | You need shared number/date/currency formatting contracts outside the app component. | Stable support package | Community | Usually consumed by DataGrid packages; install directly for cross-adapter formatting reuse. | Optional. |
| `@affino/datagrid-pivot` | Analytics/platform engineers | You need pivot spec helpers, layout snapshots, normalization, cloning, equality, or drilldown contracts. | Stable contracts/helpers | Community | Use directly for pivot integrations or saved pivot layouts. | Optional analytics path. |
| `@affino/datagrid-formula-engine` | Formula/runtime engineers | You need formula parsing, diagnostics, compile artifacts, graph planning, or base runtime semantics. | Stable formula package | Community | Use directly for formula-centric integrations. | Optional formula path. |
| `@affino/datagrid-spreadsheet-vue-app` | Spreadsheet/workbook app engineers | You need the workbook-oriented Vue shell built on DataGrid packages. | Stable app package | Community | Use for spreadsheet-first workbook surfaces, not ordinary DataGrid tables. | Use only for workbook-style apps. |
| `@affino/datagrid-gantt` | Planning/timeline integration engineers | You need lower-level Gantt package contracts behind the app Gantt view. | Support package | Community | Ordinary Gantt usage should start through `@affino/datagrid-vue-app` view-mode/docs. | Optional advanced feature package. |
| `@affino/datagrid-worker` | Runtime/performance engineers | You need worker-owned runtime/protocol integration. | Advanced runtime support | Community | Most apps should use documented worker-owned row-model paths instead of direct worker plumbing. | Not a beginner package. |
| `@affino/datagrid-plugins` | Plugin/runtime host engineers | You need capability-gated plugin runtime foundations. | Advanced capability runtime | Community | Public app extensions should prefer stable `DataGridApi.plugins` unless capability negotiation is required. | Not a beginner package. |
| `@affino/datagrid-orchestration` | Adapter/framework engineers | You need adapter-internal interaction orchestration utilities. | Advanced adapter-internal surface | Community | Not intended as an app-level stable API. | Avoid for normal apps. |
| `@affino/datagrid-vue-app-enterprise` | Enterprise Vue app teams | You need additive enterprise app UX such as premium diagnostics, formula runtime controls, or performance presets. | Stable enterprise app wrapper plus enterprise-only additions | Enterprise | Enterprise package should be a strict superset of the community app surface. | Start with community unless you need enterprise tooling. |
| `@affino/datagrid-diagnostics-enterprise` | Enterprise diagnostics/tooling engineers | You need premium diagnostics/profiler surfaces. | Enterprise support package | Enterprise | Usually consumed through enterprise app package. | Not a beginner package. |
| `@affino/datagrid-formula-engine-enterprise` | Enterprise formula/runtime teams | You need premium formula packs or enterprise formula runtime configuration. | Enterprise formula extension | Enterprise | Additive over `@affino/datagrid-formula-engine`. | Not a beginner package. |
| `@affino/datagrid-laravel` | Laravel/Livewire integration engineers | You need Laravel-facing DataGrid integration contracts. | Stable framework facade | Community | Use for Laravel integrations, not Vue-only apps. | Framework-specific. |
| `@affino/datagrid-laravel-app` | Laravel app engineers | You need app-facing Laravel DataGrid integration. | App facade | Community/planned app boundary | Use only for Laravel app path. | Framework-specific. |
| `@affino/datagrid-sandbox` | Maintainers | You need local demos, validation scenarios, or manual/e2e sandbox flows. | Internal/private app | Internal tooling | Package is private. | Do not install in apps. |

## Entrypoint Tier Rules

| Tier | Meaning | Examples |
| --- | --- | --- |
| Stable | Semver-safe public API. | `@affino/datagrid-vue-app`, `@affino/datagrid-vue`, `@affino/datagrid-vue/stable`, `@affino/datagrid-core` |
| Advanced | Supported power-user API for custom renderers, adapters, runtime ownership, or low-level integration. | `@affino/datagrid-vue/advanced/*`, `@affino/datagrid-core/advanced`, `@affino/datagrid-orchestration` |
| Internal | Unsafe implementation surface with no app-level compatibility promise. | `./internal` subpaths, package-private implementation files |

Stable does not mean beginner-facing. It means the API is semver-safe. The beginner-facing path remains `@affino/datagrid-vue-app`.

## Common Install Paths

Local Vue rows:

```bash
pnpm add @affino/datagrid-vue-app
```

Server-backed Vue grid:

```bash
pnpm add @affino/datagrid-vue-app @affino/datagrid-vue @affino/datagrid-server-adapters
```

Headless/custom Vue runtime:

```bash
pnpm add @affino/datagrid-vue @affino/datagrid-core
```

Spreadsheet workbook shell:

```bash
pnpm add @affino/datagrid-spreadsheet-vue-app
```

Enterprise app wrapper:

```bash
pnpm add @affino/datagrid-vue-app-enterprise
```

## Community Vs Enterprise Rule

Community packages should be production-useful on their own. Enterprise packages are additive and reserved for premium diagnostics, formula/runtime controls, performance presets, scaling tooling, and enterprise support workflows.
