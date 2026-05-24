# Contributing to Affino DataGrid

Affino DataGrid is a multi-package DataGrid workspace. Contributions should keep the package boundaries clear, preserve deterministic core behavior, and avoid turning narrow fixes into broad rewrites.

## Package Boundaries

Use the highest-level package that owns the behavior you are changing:

| Area | Package / path | Ownership |
| --- | --- | --- |
| App-facing Vue grid | `packages/datagrid-vue-app` | Ready `<DataGrid />` UX, app props, default renderer, stage composition. |
| Vue runtime and adapter | `packages/datagrid-vue` | Vue bindings, runtime ownership, datasource row models, advanced renderer/adapter hooks. |
| Deterministic core | `packages/datagrid-core` | Row models, state, events, selection, transactions, `DataGridApi`, pure runtime contracts. |
| Server datasource adapters | `packages/datagrid-server-adapters`, `packages/datagrid-server-client` | HTTP datasource integration, transport helpers, polling/live-update behavior. |
| Worker runtime | `packages/datagrid-worker` | Worker-owned row model protocols and parity behavior. |
| Sandbox | `packages/datagrid-sandbox` | Demos, manual validation, and e2e scenarios. It is private tooling, not an install target. |
| Docs | `docs/`, package READMEs, root README | Public onboarding, architecture notes, protocol docs, migration notes, plans. |

Do not move behavior across core, Vue adapter, app layer, sandbox, or backend boundaries unless the issue is explicitly about that boundary.

## API Tiers

Affino uses stable, advanced, and internal API tiers.

- Stable APIs are semver-safe public surfaces. Examples: `@affino/datagrid-vue-app`, `@affino/datagrid-vue`, `@affino/datagrid-vue/stable`, `@affino/datagrid-core`.
- Advanced APIs are supported power-user surfaces for custom renderers, adapters, worker/runtime ownership, or integration plumbing. Examples: `@affino/datagrid-vue/advanced/*`, `@affino/datagrid-core/advanced`, `@affino/datagrid-orchestration`.
- Internal APIs are unsafe implementation details. Do not use or promote `./internal` paths in docs, examples, or app code.

Stable does not always mean beginner-facing. Normal Vue apps should start with `@affino/datagrid-vue-app`; lower-level packages are for runtime ownership and platform integration.

## Setup

Requirements:

- Node.js matching `package.json` engines: `^20.19.0 || >=22.12.0`
- `pnpm` matching the workspace package manager when possible

Install dependencies:

```bash
pnpm install
```

Common commands:

```bash
pnpm run build
pnpm run type-check
pnpm run test:datagrid:unit
pnpm run test:e2e:sandbox
```

Prefer the smallest package-level command that proves your change before running broad monorepo checks.

## Validation By Change Type

| Change type | Minimum validation |
| --- | --- |
| Docs only | Link/path check where practical, plus `git diff --check`. |
| Package exports or public types | Relevant package build/type-check, `pnpm run quality:api:datagrid:inventory`, and `pnpm run quality:api:datagrid:report` when declaration output changes. |
| Core runtime behavior | Focused `@affino/datagrid-core` unit/contract tests, then broader DataGrid tests if shared contracts changed. |
| Vue app or adapter behavior | Relevant `@affino/datagrid-vue` / `@affino/datagrid-vue-app` type-check and tests. Use sandbox e2e for browser-visible behavior. |
| Server datasource behavior | Focused server datasource adapter/client tests and sandbox server datasource e2e smoke where applicable. |
| Sandbox/demo changes | `pnpm --filter @affino/datagrid-sandbox type-check` and a focused Playwright route smoke. |
| Performance-sensitive changes | Focused unit/contract tests first, then the smallest relevant benchmark or performance gate. |

If a broad suite fails for unrelated reasons, report the failing command and the first relevant failure clearly.

## Public API Change Process

Public API changes need review before implementation when they affect stable exports, props, emitted events, public types, package export maps, or documented integration behavior.

For proposed public API changes, include:

- affected package and entrypoint
- stable / advanced / internal tier
- current behavior
- proposed behavior
- migration impact
- semver impact
- tests and docs that will change

Do not add wildcard source exports or promote internal imports as a shortcut. Add a tiered entrypoint only after the API tier is agreed.

## Docs Expectations

Docs are part of the change when behavior, public APIs, architecture, integration contracts, migration risk, onboarding, or browser-visible workflows change.

Update the smallest relevant doc:

- root `README.md` for first-time adoption or package choice changes
- `docs/README.md` for docs navigation changes
- package README for package-local usage
- `docs/datagrid-migration-guide.md` for migration-impacting behavior
- server datasource docs for backend-owned data contracts
- internal plan docs under `docs/internal/plans/` when closing an adoption-hardening slice

Keep docs concrete. Mark planned work as planned; do not describe it as implemented.

## Performance-Sensitive Guidance

DataGrid performance work is latency-sensitive. Before changing scroll, virtualization, interaction, selection, fill, resize, rendering, worker, or datasource refresh paths:

- read the relevant architecture/performance docs under `docs/`
- keep diffs narrow and package-owned
- avoid reactive writes in hot scroll or pointer paths
- avoid layout reads/writes that cause thrashing
- preserve virtualization invariants and pinned/header/body synchronization
- add focused tests for the specific regression risk
- run the smallest relevant benchmark or e2e smoke when behavior is browser-visible

## Pull Requests

Keep PRs focused and reviewable.

Before opening a PR:

- explain the user-visible or maintainer-visible change
- list files/packages touched
- list validation run
- note docs updated or why docs were not needed
- call out public API, migration, performance, or visual risks

Use `.github/pull_request_template.md`.

## Reporting Issues

Use GitHub issues for bugs and feature requests. Use `SECURITY.md` for vulnerabilities; do not open public security issues.

By participating, you agree to `CODE_OF_CONDUCT.md`.
