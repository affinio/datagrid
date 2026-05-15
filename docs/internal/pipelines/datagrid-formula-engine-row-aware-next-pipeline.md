# DataGrid Formula Engine: row-aware next-step pipeline

## Status now

Implemented and validated:

- row-aware selector model:
  - `current`
  - `absolute`
  - `relative`
  - `window`
- parser/tokenizer support for:
  - `price`
  - `price[-1]`
  - `price[4]`
  - `price[-5:0]`
  - `price[+1]`
- row-aware dependency token serialization
- runtime row-aware reads via row index resolution
- safe compile fallback to `row` execution mode for row-aware formulas
- explain/tooling support for row selectors

Current state is semantically correct and test-validated.

## Goal of the next stage

Move from production-correct row-aware semantics to engine-grade architecture and performance.

---

## Execution pipeline

### Phase 1 — Structured dependency token layer

### Goal
Stop using raw string tokens as the primary runtime/compile dependency shape.

### Why
Current token form like:

- `field:price::row::relative:-1`

is compatible, but not ideal for:

- repeated string parsing
- allocation pressure
- cache-key normalization
- compile/runtime ergonomics

### Target model

```ts
interface DataGridDependencyTokenDescriptor {
  domain: "field" | "computed" | "meta"
  name: string
  rowDomain:
    | { kind: "current" }
    | { kind: "absolute"; rowIndex: number }
    | { kind: "relative"; offset: number }
    | { kind: "window"; startOffset: number; endOffset: number }
}
```

### Rules

- descriptor becomes the internal canonical representation
- string token remains only for:
  - cache keys
  - snapshots
  - compatibility boundaries
- string parse/serialize moves to boundary adapters only

### Main files

- [packages/datagrid-formula-engine/src/contracts.ts](packages/datagrid-formula-engine/src/contracts.ts)
- [packages/datagrid-formula-engine/src/runtime/compile.ts](packages/datagrid-formula-engine/src/runtime/compile.ts)
- [packages/datagrid-core/src/models/compute/clientRowComputedRegistryFormulaCompilationRuntime.ts](packages/datagrid-core/src/models/compute/clientRowComputedRegistryFormulaCompilationRuntime.ts)
- [packages/datagrid-core/src/models/compute/clientRowComputedRegistryTokenResolverRuntime.ts](packages/datagrid-core/src/models/compute/clientRowComputedRegistryTokenResolverRuntime.ts)

### Done when

- runtime uses structured token descriptors internally
- string tokens are only compatibility wrappers
- dependency caches use canonical keys from descriptor serialization

---

### Phase 2 — Canonical identifier/reference model

### Goal
Make identifier collection and dependency lookup descriptor-based, not raw-string-based.

### Why
Need to avoid edge cases like:

- `price`
- `price[-1]`
- `price[-01]`
- `price[-1 ]`

all drifting through different string forms.

### Target
Canonical reference object:

```ts
interface DataGridFormulaIdentifierRef {
  referenceName: string
  rowSelector:
    | { kind: "current" }
    | { kind: "absolute"; rowIndex: number }
    | { kind: "relative"; offset: number }
    | { kind: "window"; startOffset: number; endOffset: number }
}
```

### Rules

- AST remains user-friendly
- analysis/compile stages dedupe on canonical identifier descriptor
- `identifier.name` stays as a display/serialized surface, not the only key

### Main files

- [packages/datagrid-formula-engine/src/syntax/tokenizer.ts](packages/datagrid-formula-engine/src/syntax/tokenizer.ts)
- [packages/datagrid-formula-engine/src/syntax/parser.ts](packages/datagrid-formula-engine/src/syntax/parser.ts)
- [packages/datagrid-formula-engine/src/syntax/optimizer.ts](packages/datagrid-formula-engine/src/syntax/optimizer.ts)
- [packages/datagrid-formula-engine/src/runtime/compile.ts](packages/datagrid-formula-engine/src/runtime/compile.ts)

### Done when

- identifier collection is canonical
- dependency lookup keys are canonical
- explain output still shows readable serialized references

---

### Phase 3 — Row-domain-aware dependency graph

### Goal
Teach the dependency graph the difference between same-row and directional cross-row dependencies.

### Why
Today the graph can collapse this into a plain self-edge:

- `balance -> balance`

But the real runtime meaning is directional:

- `balance[n] -> balance[n-1]`

That matters for:

- cycle classification
- incremental recompute correctness
- future scheduling optimizations

### Target semantics

Dependency edges should carry row semantics:

- same-row
- backward relative
- forward relative
- window

### Main files

- [packages/datagrid-formula-engine/src/graph/executionPlan.ts](packages/datagrid-formula-engine/src/graph/executionPlan.ts)
- [packages/datagrid-core/src/models/compute/clientRowComputedRegistryRuntime.ts](packages/datagrid-core/src/models/compute/clientRowComputedRegistryRuntime.ts)
- [packages/datagrid-core/src/models/__tests__/formulaExecutionPlan.spec.ts](packages/datagrid-core/src/models/__tests__/formulaExecutionPlan.spec.ts)

### Done when

- graph distinguishes same-row cycles from directional row references
- `balance[-1]` no longer looks identical to a same-row self-cycle
- plan snapshots expose row-domain dependency metadata

---

### Phase 4 — Deterministic row-direction execution policy

### Goal
Make execution policy explicit for directional row formulas.

### Why
Formulas like:

- `balance = amount + balance[-1]`

require deterministic order:

- row 0
- row 1
- row 2
- row 3

### Target behavior

Introduce explicit row-direction policy for row-aware formulas:

- neutral
- forward-only
- backward-only
- full-window

### Main files

- [packages/datagrid-core/src/models/compute/clientRowComputedExecutionRuntime.ts](packages/datagrid-core/src/models/compute/clientRowComputedExecutionRuntime.ts)
- [packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts](packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts)

### Done when

- runtime mode selection knows when row order is semantically required
- recurrence formulas are deterministic by policy, not just by current implementation accident

---

### Phase 5 — Vectorized relative row shifts

### Goal
Recover fast execution for simple row-relative formulas.

### Why
Not all row-aware formulas must fall back to row mode.

Example:

- `price[-1]`

can be implemented as a shifted column.

### First optimization target

Support vectorized relative reads for:

- single relative field refs
- single relative computed refs backed by column cache
- arithmetic compositions of relative/current refs

### Not in first cut

- complex branching with arbitrary mixed windows
- recurrence formulas like `balance[-1]`

### Main files

- [packages/datagrid-formula-engine/src/evaluators/vector.ts](packages/datagrid-formula-engine/src/evaluators/vector.ts)
- [packages/datagrid-formula-engine/src/evaluators/columnar.ts](packages/datagrid-formula-engine/src/evaluators/columnar.ts)
- [packages/datagrid-formula-engine/src/runtime/compile.ts](packages/datagrid-formula-engine/src/runtime/compile.ts)

### Done when

- formulas with safe relative shifts can run in columnar mode
- recurrence-sensitive formulas still force row mode
- runtime diagnostics show the chosen fast path clearly

---

### Phase 6 — Sliding-window execution

### Goal
Avoid $O(n \cdot w)$ behavior for common window aggregates.

### Why
This formula:

- `SUM(price[-5:0])`

should eventually run as a sliding window, not as repeated naive window reads.

### Initial scope

Optimize built-ins:

- `SUM`
- `AVG`
- `MIN`
- `MAX`
- `COUNT`

when fed a pure row window reference.

### Main files

- [packages/datagrid-formula-engine/src/evaluators/vector.ts](packages/datagrid-formula-engine/src/evaluators/vector.ts)
- [packages/datagrid-formula-engine/src/syntax/functions.ts](packages/datagrid-formula-engine/src/syntax/functions.ts)
- [packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts](packages/datagrid-core/src/models/compute/clientRowComputedExecutionExecutorRuntime.ts)

### Done when

- common window aggregates run with incremental/sliding kernels
- performance scales linearly with row count for bounded windows

---

### Phase 7 — Syntax ambiguity guardrails

### Goal
Keep future syntax evolution safe.

### Why
Current tokenizer treats `[...]` as part of identifier syntax.
That is acceptable now, but must be guarded if future syntax adds:

- array literals
- generic index operators
- richer expression slices

### Plan

- document current bracket semantics as reference-only
- reserve any future conflicting syntax explicitly
- add tests for ambiguity boundaries

### Main files

- [packages/datagrid-formula-engine/src/syntax/tokenizer.ts](packages/datagrid-formula-engine/src/syntax/tokenizer.ts)
- [packages/datagrid-formula-engine/src/syntax/parser.ts](packages/datagrid-formula-engine/src/syntax/parser.ts)

### Done when

- syntax ownership is explicit
- future parser extensions do not accidentally break row references

---

## Recommended implementation order

1. Structured dependency token layer
2. Canonical identifier/reference model
3. Row-domain-aware dependency graph
4. Deterministic row-direction execution policy
5. Vectorized relative row shifts
6. Sliding-window execution
7. Syntax ambiguity guardrails

## Suggested stop points

### Stop point A
After phases 1-2:
- better architecture
- no major semantic changes
- low runtime risk

### Stop point B
After phases 3-4:
- graph/runtime become row-direction aware
- recurrence semantics become explicit

### Stop point C
After phases 5-6:
- substantial performance uplift
- engine moves from correctness-first to optimized row-aware execution

## Rollout rule

Do not batch all phases together.
Implement one phase at a time, validate, then continue on explicit approval.
