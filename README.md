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
pnpm run bench:regression
pnpm run bench:datagrid:tree:assert
pnpm run bench:datagrid:pivot:assert
pnpm run bench:datagrid:spreadsheet-workbook:assert
pnpm run bench:datagrid:formula-engine:assert
pnpm run bench:datagrid:formula-backends:assert
```

Baseline artifacts for performance and API checks are located in `docs/perf` and `docs/quality`.

## Performance Snapshot

Latest numbers are pulled from benchmark artifacts in `artifacts/performance`.

Latency classes: `<1ms realtime`, `<16ms frame-safe`, `<100ms interactive`, `<1s heavy`, `>=1s blocking`.

| Area | Dataset scale | Latency snapshot | Throughput | Class |
| --- | --- | --- | --- | --- |
| Tree model | 25k grouped rows | expand p95 `0.95ms`, filter/sort p95 `8.26ms` | — | realtime / frame-safe |
| Pivot runtime | 24k rows, 2 layouts | rebuild p95 `15.04ms`, patch p95 `6.71ms` | — | frame-safe |
| Spreadsheet workbook | 16k orders, 4k customers, join fanout 3 | sync p95 `140.12ms`, restore p95 `399.71ms` | — | heavy |
| Formula kernel | 100k rows | compute p95 `4.231ms` | `23.64M eval/s` | frame-safe |
| Formula pipeline | 100k rows, 40 formulas, depth 4 | full recompute p95 `1427.37ms`, patch p95 `109.88ms` | `4.14M eval/s` | blocking / heavy |
| Grid stress | mixed sort/filter/patch workload | sort p95 `87.12ms`, patch storm p95 `27.23ms` | `139,886 rows/s` | interactive |
| Vue adapters | 120 roots across 9 packages | controller churn `~0.07ms`, relayout `~0.15ms` | — | realtime |

### Tree Scale Envelope

| Rows | Snapshot | Class |
| --- | --- | --- |
| 10k | expand p95 `0.53ms`, filter/sort p95 `3.52ms` | realtime / frame-safe |
| 25k | expand p95 `0.95ms`, filter/sort p95 `8.26ms` | realtime / frame-safe |
| 50k | expand p95 `2.13ms`, filter/sort p95 `18.43ms` | frame-safe / interactive |
| 100k | expand p95 `4.36ms`, filter/sort p95 `53.17ms` | frame-safe / interactive |

### Runtime Architecture

```text
Row source
	-> Row model
	-> Projection pipeline
	-> Derived cache
	-> Materialization
	-> Viewport
	-> Renderer
```

### Benchmark Notes

- `bench:regression` is the aggregate CI harness for baseline drift on the core suite.
- Heavy-load suites such as workbook, hardcore, worker pressure, soak, group-depth, and server-pivot interop remain standalone asserts.
- Formula metrics are split into backend ceiling (`formula-backends`) and full pipeline cost (`formula-engine`).
- Useful repro commands: `pnpm run bench:regression`, `pnpm run bench:datagrid:tree:matrix:assert`, `pnpm run bench:datagrid:pivot:assert`, `pnpm run bench:datagrid:spreadsheet-workbook:assert`, `pnpm run bench:datagrid:formula-engine:assert`, `pnpm run bench:datagrid:formula-backends:assert`, `pnpm run bench:datagrid:hardcore:assert`.

## Docs

- Formula engine guide: `docs/datagrid-formula-engine-guide.md`
- Formula engine roadmap: `docs/datagrid-formula-engine-first-class-pipeline.md`
- Formula benchmarks: `docs/benchmarks-formula-engine.md`
- Compute/formula diagnostics: `docs/datagrid-state-events-compute-diagnostics.md`

## Scope

The following are intentionally out of scope in this repository:

- E2E/Playwright pipelines;
- demo applications (`demo-vue`, `demo-laravel`);

## License

See `LICENSE`.
