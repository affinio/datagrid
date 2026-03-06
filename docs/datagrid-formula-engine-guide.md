# DataGrid Formula Engine Guide

This guide explains how the Formula Engine works, why it is designed this way, and how to use it effectively in real projects.

## Why this engine is strong

The engine is optimized for **deterministic behavior**, **incremental recompute**, and **production safety**:

- Deterministic parse + compile flow (same input => same execution plan).
- Spreadsheet-like syntax (`=price * qty + tax`) with clear coercion rules.
- Incremental graph execution (recompute only affected formula nodes).
- Multiple execution paths (row-wise, batch, columnar) with safe fallback.
- Runtime diagnostics and explain snapshots for observability.

## Quick mental model

Each formula field is compiled into a computed node:

1. Parse expression into AST.
2. Resolve identifiers into dependency tokens (`field:*` / `computed:*`).
3. Build evaluator (AST or JIT).
4. Integrate into formula execution DAG.
5. On row patch, run only affected nodes/rows and emit diagnostics.

## Formula syntax

### Supported expression style

- Optional `=` prefix is accepted.
- Identifiers are field/computed names, for example: `price`, `price1`, `order.total`.
- String literals: `'text'` or `"text"`.
- Constants: `TRUE`, `FALSE`, `NULL`.

✅ Example:

```ts
"=price1 + price4"
```

Yes — formulas like `=price1+price4` are supported.

### Operators

- Arithmetic: `+`, `-`, `*`, `/`
- Logical: `AND`, `OR`, `NOT`
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`

### Important limitations

- Bracket notation is intentionally rejected (`orders[0].price` is not supported).
- Use dot paths instead (`order.total`).
- A1-style cell references (`A1`, `B2`) are not part of this engine contract.

## Built-in functions

Default function set:

- `ABS(x)`
- `IF(condition, whenTrue, whenFalse)`
- `IFS(cond1, value1, cond2, value2, ...)`
- `COALESCE(v1, v2, ...)`
- `MIN(...)`
- `MAX(...)`
- `ROUND(value, digits?)`
- `SUM(...)`

Function names are normalized to uppercase internally.

## Type and coercion rules (design contract)

Formula values are normalized to:

- `number | string | boolean | Date | null`

Key semantics:

- Arithmetic uses numeric coercion (`"10" + TRUE + NULL` => `11`).
- `Date` participates via timestamp coercion in numeric/comparison operations.
- `COALESCE` uses **first present** value semantics (not truthy semantics):
  - `COALESCE(0, 5)` => `0`
  - `COALESCE(FALSE, 1)` => `FALSE`
  - `COALESCE("", "fallback")` => `""`
- String-vs-string comparison is lexical and deterministic.

## Runtime error policy

Two runtime modes are supported:

- `coerce-zero` (default): formula runtime errors produce `0`.
- `throw`: runtime errors throw immediately.

You can always observe errors through `onRuntimeError`.

Typical runtime error categories:

- division by zero
- unknown function
- invalid function arity
- generic evaluation error

## Compilation pipeline (what happens under the hood)

When registering a formula, the engine runs:

1. **Normalize**: sanitize name/field/formula text.
2. **Tokenize + parse**: convert to typed AST.
3. **Validate functions**: ensure names/arity are valid.
4. **Constant folding**: precompute pure constant subtrees.
5. **Collect identifiers**: build stable, deduplicated dependency list.
6. **Resolve tokens**: map identifier -> dependency token.
7. **Compile evaluator**:
   - `ast`: interpreter-based evaluator
   - `jit`: generated evaluator with fast token index access
   - `auto`: JIT attempt with AST fallback
8. **Expose execution entrypoints**:
   - `compute` (single row)
   - `computeBatch` (row-batch)
   - `computeBatchColumnar` (columnar token arrays)

If batch/columnar JIT path hits a runtime fault on some rows, engine falls back to row-wise semantics so non-failing rows still evaluate correctly.

## Execution plan and incremental recompute

Inside row-model runtime, compiled formulas are integrated into a formula execution plan:

- Topological order + level buckets for dependency-safe evaluation.
- Precomputed closure indexes:
  - affected by changed source fields
  - affected by changed computed fields
- Dirty propagation with deterministic order.

This enables efficient patch handling: only impacted formulas and rows are recalculated.

## Practical API usage

### Register formula fields

```ts
api.rows.registerFormulaField({
  name: "subtotal",
  formula: "=price * qty",
})

api.rows.registerFormulaField({
  name: "total",
  formula: "=subtotal + tax",
})

api.rows.registerFormulaField({
  name: "sum2",
  formula: "=price1 + price4",
})
```

### Register custom formula functions

```ts
api.rows.registerFormulaFunction("MARGIN", {
  arity: 2,
  compute: ([revenue, cost]) => Number(revenue ?? 0) - Number(cost ?? 0),
})

api.rows.registerFormulaField({
  name: "margin",
  formula: "=MARGIN(revenue, cost)",
})
```

### Inspect diagnostics

```ts
const diagnostics = api.diagnostics.getAll()
const explain = api.diagnostics.getFormulaExplain()
```

`formulaExplain` includes execution-plan snapshot and runtime formula diagnostics.

## Why these principles were chosen

- **Determinism first**: predictable behavior is critical for financial/reporting grids.
- **Typed normalization**: prevents fragile JS coercion surprises.
- **Fail-safe runtime**: default `coerce-zero` keeps UX stable during bad input spikes.
- **Incremental graph recompute**: scales patch workflows better than full-table reevaluation.
- **Dual execution paths**: JIT for throughput, AST for resilience and fallback.
- **Diagnostics by default**: easier debugging, SLO tracking, and benchmark governance.

## Related docs

- [benchmarks-formula-engine.md](./benchmarks-formula-engine.md)
- [datagrid-state-events-compute-diagnostics.md](./datagrid-state-events-compute-diagnostics.md)
- [datagrid-delivery-pipeline-2026-03-06.md](./datagrid-delivery-pipeline-2026-03-06.md)