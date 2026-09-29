# DataGrid Formula Engine Guide

Status: public feature guide.

Use formulas when a displayed or computed value depends on other row fields.
The community formula package provides parsing and evaluation; DataGrid row
models provide registration, dependency tracking, and recomputation.

## Package boundaries

- `@affino/datagrid-formula-engine` — parser, compiler, functions, diagnostics.
- `@affino/datagrid-core` — formula fields on client row models and `api.rows`.
- `@affino/datagrid-vue-app` — UI integration and editors owned by the app layer.
- [Community vs enterprise](./datagrid-formula-engine-community-vs-enterprise.md) — additive package boundaries.

Server-backed grids do not get server formula evaluation automatically. Formula
values are client/model-owned unless the host implements a separate backend
contract.

## Formula syntax

Formulas may use an optional `=` prefix:

```text
=price * quantity + tax
```

Supported forms include:

- identifiers: `price`, `subtotal`, `order.total`;
- bracketed names: `[gross margin]`, `metrics["tax.rate"]`;
- strings: `'Open'` or `"Open"`;
- constants: `TRUE`, `FALSE`, `NULL`;
- arithmetic: `+`, `-`, `*`, `/`;
- logical operators: `AND`, `OR`, `NOT`;
- comparisons: `>`, `<`, `>=`, `<=`, `==`, `!=`.

A1 cell references and colon ranges such as `A1:B10` are not part of the
current row-model formula contract.

## Built-in functions

The built-in registry includes numeric, logical, text, date/time, array,
lookup, and conditional aggregate helpers. Function names are case-insensitive.

```text
=IF(status == "Open", currentPrice * 1.1, currentPrice)
=SUM(price, shipping, tax)
=XLOOKUP(code, ARRAY("A", "B"), ARRAY(10, 20), 0)
```

See the [formula function reference](./reference/datagrid-formula-engine-function-reference.md)
for the complete catalog and per-function examples.

## Register formula fields

Register fields through the public core API:

```ts
api.rows.registerFormulaField({
  name: "subtotal",
  formula: "=price * quantity",
})

api.rows.registerFormulaField({
  name: "total",
  formula: "=subtotal + tax",
})
```

When a source field changes, the row model recomputes affected formulas. A
formula field should have a stable name and should not mutate source row
objects in place.

For custom functions:

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

Unregister a function with `api.rows.unregisterFormulaFunction(name)` and list
registered names with `api.rows.getFormulaFunctionNames()`.

## External context

Custom functions that read deterministic host state must declare context keys.
The host then explicitly requests recomputation when that state changes:

```ts
api.rows.registerFormulaFunction("FX_RATE", {
  arity: 0,
  contextKeys: ["pricing"],
  compute: () => fxRate,
})

api.rows.recomputeFormulaContext({
  contextKeys: ["pricing"],
  rowIds: ["order-42"],
})
```

The engine does not install timers for `TODAY()` or other volatile-like
helpers. Recompute is always initiated by an explicit host/runtime action.

## Values and errors

The formula runtime normalizes values to `number | string | boolean | Date |
null`. Missing values become `null`; empty text, zero, and `FALSE` remain
distinct values.

Runtime error policy is selected by the formula runtime. Depending on the
configured mode, an error becomes zero, throws, or returns a typed error value.
Use formula diagnostics for user-facing validation and runtime error reporting.

## Diagnostics

Use the formula APIs when building an editor or diagnostics panel:

```ts
const parsed = parseDataGridFormulaExpression("price * quantity")
const diagnostics = diagnoseDataGridFormulaExpression("price + )")
const explanation = explainDataGridFormulaExpression("subtotal + tax")
```

At row-model level:

```ts
const fields = api.rows.getFormulaFields()
const diagnostics = api.diagnostics.getFormulaExplain()
```

Diagnostics are read-only. They do not replace explicit recomputation or
change the formula state.

## Limits to plan for

- formula functions are synchronous;
- async/promise-returning formula functions are unsupported;
- server-evaluated formulas need a host-owned protocol;
- circular formulas are rejected by default;
- cross-table formula sources must be replaced or explicitly patched when
  their contents change;
- large formula workloads should be measured with the relevant row-model or
  worker runtime before enabling them for every column.

The detailed compiler, scheduler, cache, explain graph, and benchmark
contracts are maintained in the internal
[formula runtime reference](./internal/reference/datagrid-formula-engine-runtime-reference.md).
