# DataGrid Formula Engine Benchmarks

This benchmark suite is focused on three questions:

1. How many rows can the engine process?
2. How many formulas can it evaluate?
3. How fast does it react to incremental changes?

## Scenarios

Default scenario matrix:

- `small`: `10k` rows, `10` formulas, depth `2`
- `medium`: `50k` rows, `20` formulas, depth `3`
- `large`: `100k` rows, `40` formulas, depth `4`
- `extreme`: `250k` rows, `60` formulas, depth `6`

Default incremental patch sizes: `1`, `100`, `1000` rows.

## Metrics

The benchmark writes both JSON and markdown reports and includes:

- compile time (`compileDataGridFormulaFieldDefinition`)
- model initialization time (`createClientRowModel` with formulas)
- full recompute latency (`recomputeComputedFields`)
- incremental patch recompute latency (`patchRows`)
- estimated formulas per second:
  - full recompute (from runtime `computeStage.evaluations`)
  - incremental recompute (from runtime `computeStage.evaluations`)
- heap delta

## Commands

Run benchmark:

```bash
pnpm run bench:datagrid:formula-engine
```

Run with CI/perf gates:

```bash
pnpm run bench:datagrid:formula-engine:assert
```

Scenario-specific gates are supported via env keys:

- `PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS_<SCENARIO>`
- `PERF_BUDGET_MAX_PATCH_P95_MS_<SCENARIO>`
- `PERF_BUDGET_INCREMENTAL_PATCH_SIZE` (patch size used for incremental throughput + patch p95 gate)

## Output

By default:

- JSON: `artifacts/performance/bench-datagrid-formula-engine.json`
- Markdown: `artifacts/performance/bench-datagrid-formula-engine.md`

Use the markdown report as the source table for README/perf tracking.
