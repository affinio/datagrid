# Affino DataGrid Monorepo

This repository contains only DataGrid packages and supporting infrastructure.

## Packages

- `@affino/datagrid-core`
- `@affino/datagrid-orchestration`
- `@affino/datagrid-vue`
- `@affino/datagrid-worker`
- `@affino/datagrid-plugins`
- `@affino/datagrid-theme`
- `@affino/projection-engine`

## Requirements

- Node.js `>=20`
- pnpm `>=10`

## Setup

```bash
pnpm install
```

## Common Commands

```bash
pnpm type-check
pnpm test:datagrid:unit
pnpm test:datagrid:contracts
pnpm test:datagrid:integration
pnpm lint
```

## Benchmarks

```bash
pnpm run bench:datagrid
pnpm run bench:datagrid:markdown
pnpm run bench:regression
```

Baseline artifacts for performance and API checks are located in `docs/perf` and `docs/quality`.

## Docs

- Formula engine guide: `docs/datagrid-formula-engine-guide.md`
- Formula benchmarks: `docs/benchmarks-formula-engine.md`
- Compute/formula diagnostics: `docs/datagrid-state-events-compute-diagnostics.md`

## Scope

The following are intentionally out of scope in this repository:

- E2E/Playwright pipelines;
- demo applications (`demo-vue`, `demo-laravel`);

## License

See `LICENSE`.
