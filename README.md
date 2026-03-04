# Affino DataGrid Monorepo

This repository contains only DataGrid packages and supporting infrastructure.

## Packages

- `@affino/datagrid-core`
- `@affino/datagrid-orchestration`
- `@affino/datagrid-vue`
- `@affino/datagrid-worker`
- `@affino/datagrid-plugins`
- `@affino/datagrid-theme`
- `@affino/projection-engine` (internal dependency)

## Requirements

- Node.js `>=20`
- pnpm `>=10`

## Setup

```bash
pnpm install
```

## Common Commands

```bash
pnpm run typecheck
pnpm run test:datagrid:unit
pnpm run test:datagrid:contracts
pnpm run test:datagrid:integration
pnpm run lint
```

## Benchmarks

```bash
pnpm run bench:datagrid
pnpm run bench:datagrid:markdown
pnpm run bench:regression
```

Baseline artifacts for performance and API checks are located in `docs/perf` and `docs/quality`.

## Scope

The following are intentionally out of scope in this repository:

- E2E/Playwright pipelines;
- demo applications (`demo-vue`, `demo-laravel`);

## License

See `LICENSE`.
