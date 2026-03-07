# DataGrid Formula Engine Guide

This guide explains how the Formula Engine works, why it is designed this way, and how to use it effectively in real projects.

## Why this engine is strong

The engine is optimized for **deterministic behavior**, **incremental recompute**, and **production safety**:

- Deterministic parse + compile flow (same input => same execution plan).
- Spreadsheet-like syntax (`=price * qty + tax`) with clear coercion rules.
- Incremental graph execution (recompute only affected formula nodes).
- Multiple execution paths (row-wise, batch, columnar) with safe fallback.
- Hot-path dependency access is pre-specialized into reusable readers for field, computed, and meta dependencies.
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
- Bracketed references are supported for richer paths, for example: `orders[0].price`, `[gross margin]`, `metrics["tax.rate"]`.
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

- A1-style cell references (`A1`, `B2`) are not part of this engine contract.
- Colon range syntax (`A1:B10`) is still not part of the language surface.
- Reference segments normalize to a canonical path form internally (for example `metrics["tax.rate"]` => `metrics."tax.rate"`).

### Reference forms

- Plain field / computed names: `price`, `subtotal`
- Dot paths: `order.total`, `services.0.latencyMs`
- Bracketed numeric segments: `orders[0].price`
- Bracketed literal field names: `[gross margin]`
- Quoted bracket segments for literal dots or special keys: `metrics["tax.rate"]`, `payload['display name']`

Internally the engine canonicalizes these references so diagnostics and dependency tokens stay stable.

## Built-in functions

Default function set:

- `ABS(x)`
- `ARRAY(...)`
- `AVG(...)`
- `CEIL(x)`
- `CHOOSE(index, ...)`
- `CONCAT(...)`
- `COUNT(...)`
- `DATE(year, month, day)`
- `DAY(date)`
- `FLOOR(x)`
- `IF(condition, whenTrue, whenFalse)`
- `IN(value, ...)`
- `INDEX(array, index, fallback?)`
- `IFS(cond1, value1, cond2, value2, ...)`
- `COALESCE(v1, v2, ...)`
- `LEN(x)`
- `LEFT(text, count?)`
- `LOWER(x)`
- `MATCH(needle, array, matchMode?)`
- `MID(text, start, count)`
- `MIN(...)`
- `MAX(...)`
- `MOD(left, right)`
- `MONTH(date)`
- `POW(base, exponent)`
- `RANGE(...)`
- `RIGHT(text, count?)`
- `ROUND(value, digits?)`
- `SUM(...)`
- `TRIM(x)`
- `UPPER(x)`
- `XLOOKUP(needle, lookupArray, returnArray, notFound?, matchMode?)`
- `YEAR(date)`

Function names are normalized to uppercase internally.

### Arrays, ranges, and lookup helpers

The engine now supports first-class array values inside formulas.

```ts
"SUM(RANGE(price, tax, bonus))"
"INDEX(ARRAY(price, tax, bonus), 2)"
"MATCH(code, ARRAY('A', 'B', 'C'))"
"XLOOKUP(code, ARRAY('A', 'B', 'C'), ARRAY(price, tax, bonus), 0)"
```

Current contract:

- arrays are 1-dimensional formula values
- `ARRAY(...)` and `RANGE(...)` build arrays from scalar inputs
- aggregate helpers like `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`, `CONCAT` flatten array arguments
- lookup helpers currently support exact matching only (`matchMode = 0`)
- colon spreadsheet ranges are still intentionally out of scope for this block

## Type and coercion rules (design contract)

Formula values are normalized to:

- `number | string | boolean | Date | null`

Key semantics:

- Missing / `undefined` inputs are normalized to `null`.
- `null` is the engine's only blank / missing runtime value.
- Empty string `""` is preserved and is **not** treated as blank.
- Zero `0`, `FALSE`, and `""` are all distinct values even though some coercions map them to falsy/zero behavior.
- Arithmetic uses numeric coercion (`"10" + TRUE + NULL` => `11`).
- `Date` participates via timestamp coercion in numeric/comparison operations.
- `COALESCE` uses **first present** value semantics (not truthy semantics):
  - `COALESCE(0, 5)` => `0`
  - `COALESCE(FALSE, 1)` => `FALSE`
  - `COALESCE("", "fallback")` => `""`
- String-vs-string comparison is lexical and deterministic.

### Blank vs empty text vs zero

| Input | Normalized runtime value | Present? | Notes |
| --- | --- | --- | --- |
| `undefined` / missing token | `null` | no | treated as blank |
| `null` | `null` | no | canonical blank |
| `""` | `""` | yes | empty text, not blank |
| `0` | `0` | yes | numeric zero |
| `FALSE` | `false` | yes | boolean false |

This contract is important for `COALESCE`, equality, and editor/runtime parity.

## Runtime error policy

Two runtime modes are supported:

- `coerce-zero` (default): formula runtime errors produce `0`.
- `throw`: runtime errors throw immediately.
- `error-value`: formula runtime errors return typed error values.

You can always observe errors through `onRuntimeError`.

Typed error value shape:

```ts
{
  kind: "error",
  code: "DIV_ZERO" | "FUNCTION_UNKNOWN" | "FUNCTION_ARITY" | "EVAL_ERROR",
  message: string,
}
```

Propagation contract:

- In `error-value` mode, top-level runtime failures return typed error values instead of `0`.
- Dependent formulas propagate typed error values through arithmetic/comparison/function evaluation.
- Short-circuit constructs (`IF`, `IFS`, `COALESCE`, logical short-circuit) only propagate errors from evaluated branches/arguments.

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

### CSP-safe execution mode

For strict CSP environments, dynamic code generation can be disabled explicitly:

```ts
const compiled = compileDataGridFormulaFieldDefinition(definition, {
  compileStrategy: "auto",
  allowDynamicCodegen: false,
})
```

Contract:

- `allowDynamicCodegen: false` disables all `new Function` paths.
- `compileStrategy: "auto"` falls back to AST evaluation without attempting JIT.
- `compileStrategy: "jit"` throws when dynamic code generation is disabled.
- batch and columnar entrypoints remain available via row-wise safe fallback semantics.

## Compile diagnostics and source spans

The engine now tracks source spans on tokens and AST nodes.

Useful APIs:

```ts
const parsed = parseDataGridFormulaExpression("price * qty + tax")
const diagnostics = diagnoseDataGridFormulaExpression("price + )")
```

Diagnostic shape:

```ts
{
  severity: "error",
  message: string,
  span: { start: number, end: number }
}
```

Current guarantees:

- Syntax diagnostics include exact source spans.
- Function-validation diagnostics include call-expression spans.
- Parsed AST nodes expose deterministic spans for editor/explain tooling.

## Explain / introspection APIs

The engine now exposes structural explain helpers for formula tooling:

```ts
const explained = explainDataGridFormulaExpression("IF(price > qty, subtotal + tax, 0)")
const fieldExplain = explainDataGridFormulaFieldDefinition({
  name: "total",
  formula: "subtotal + tax",
})
```

Explain payload includes:

- stable AST-backed explain tree (`tree`)
- deduplicated identifier list (`identifiers`)
- resolved dependency trace (`dependencies`)
- source spans on every explain node

Dependency entries distinguish source domains:

- `field`
- `computed`
- `meta`
- `unknown`

This is intended for formula inspectors, editors, and diagnostics panels.

## Meta dependencies (`meta.*`)

Client row-model formulas now support first-class meta identifiers.

Examples:

```ts
"CONCAT(meta.rowId, '-', meta.sourceIndex)"
"IF(meta.isGroup, 1, 0)"
"meta.kind"
```

Supported meta identifiers:

- `meta.rowId`
- `meta.rowKey`
- `meta.sourceIndex`
- `meta.originalIndex`
- `meta.kind`
- `meta.isGroup`

These resolve to `meta:*` dependency tokens in the execution plan and explain snapshots.

Current contract:

- meta dependencies are available in client row-model formula fields
- explain snapshots preserve them as `domain: "meta"`
- unknown `meta.*` identifiers are treated as normal field identifiers unless explicitly resolved another way

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

### Recompute context-driven formulas explicitly

Use `contextKeys` when a custom function closes over external deterministic state.

```ts
let fxRate = 1.12

api.rows.registerFormulaFunction("FX_RATE", {
  arity: 0,
  contextKeys: ["pricing"],
  compute: () => fxRate,
})

api.rows.registerFormulaField({
  name: "convertedTotal",
  formula: "=netTotal * FX_RATE()",
})

fxRate = 1.2
api.rows.recomputeFormulaContext({
  contextKeys: ["pricing"],
  rowIds: ["order-42"],
})
```

This keeps the core deterministic: external state changes are only observed when the host explicitly invalidates the matching formula context.

### Enable iterative circular formulas explicitly

Cycles are still rejected by default.

If a model intentionally uses circular formulas, opt in at row-model creation time:

```ts
const model = createClientRowModel({
  rows,
  formulaCyclePolicy: "iterative",
  formulaIterativeCalculation: {
    maxIterations: 16,
    epsilon: 1e-6,
  },
  initialFormulaFields: [
    { name: "leftFormula", field: "left", formula: "seed + right * 0.5" },
    { name: "rightFormula", field: "right", formula: "left * 0.5" },
  ],
})
```

Notes:

- `formulaCyclePolicy: "error"` remains the default and preserves previous behavior
- `formulaCyclePolicy: "iterative"` enables controlled strongly-connected cycle groups
- `maxIterations` caps each iterative group pass
- `epsilon` treats numeric deltas smaller than the threshold as converged
- execution-plan diagnostics now expose `iterativeGroups`
- compute-stage node diagnostics can expose `iterative`, `converged`, `iterationCount`, and `cycleGroup`

### Inspect diagnostics

```ts
const diagnostics = api.diagnostics.getAll()
const explain = api.diagnostics.getFormulaExplain()
```

`formulaExplain` includes execution-plan snapshot, runtime formula diagnostics, and per-formula explain entries with:

- explain tree
- dependency trace
- function context keys
- dependents
- dirty / recomputed / touched flags
- dirty-cause visibility from the latest compute pass

Projection formula diagnostics now also expose optional compile-cache metrics:

- `compileCache.hits`
- `compileCache.misses`
- `compileCache.size`

Internally, repeated formulas now reuse compiled artifacts by exact formula text, and compiled formulas carry a normalized `expressionHash` so structurally equivalent expressions can share identity even when their source text formatting differs.

Execution now also prebuilds dependency reader tables per computed/formula node, so row-wise `get(...)`, batch readers, and columnar token columns reuse resolved field/computed/meta accessors instead of going back through generic token-string resolution on every read.

## Why these principles were chosen

- **Determinism first**: predictable behavior is critical for financial/reporting grids.
- **Typed normalization**: prevents fragile JS coercion surprises.
- **Fail-safe runtime**: default `coerce-zero` keeps UX stable during bad input spikes.
- **Incremental graph recompute**: scales patch workflows better than full-table reevaluation.
- **Dual execution paths**: JIT for throughput, AST for resilience and fallback.
- **Diagnostics by default**: easier debugging, SLO tracking, and benchmark governance.

## Related docs

- [benchmarks-formula-engine.md](./benchmarks-formula-engine.md)
- [datagrid-formula-engine-first-class-pipeline.md](./datagrid-formula-engine-first-class-pipeline.md)
- [datagrid-state-events-compute-diagnostics.md](./datagrid-state-events-compute-diagnostics.md)
- [datagrid-delivery-pipeline-2026-03-06.md](./datagrid-delivery-pipeline-2026-03-06.md)