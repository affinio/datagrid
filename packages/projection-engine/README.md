# @affino/projection-engine

Small, framework-agnostic runtime for projection pipelines modeled as a declarative DAG.

Designed for Affino core packages (`datagrid-core`, `treeview-core`, and future engines) where data transformations are split into dependent stages (for example: filter -> sort -> group -> paginate -> visible).

Think of it as a minimal spreadsheet-style recalculation engine for ordered projection pipelines.

## Problem It Solves

When a source update happens, not every stage must be recomputed. This package provides:

- stage dependency graph with automatic topological execution order
- dirty stage propagation from requested roots
- selective recompute with optional blocked stages
- stale tracking (`requested > computed`) for diagnostics and deferred healing

## Core Model

Graph is declared by nodes and upstream dependencies:

```ts
const graph = {
  nodes: {
    filter: {},
    sort: { dependsOn: ["filter"] },
    group: { dependsOn: ["sort"] },
    paginate: { dependsOn: ["group"] },
    visible: { dependsOn: ["paginate"] },
  },
} as const
```

Engine derives:

- `stageOrder` (topological order)
- `dependents` (downstream edges)
- `downstreamByStage` closure for fast invalidation

## API

### `createProjectionStageEngine(options)`

Creates runtime with:

- `requestStages(stages, { trackRequested? })`
- `requestRefreshPass()`
- `recompute(executeStage, { blockedStages? })`
- `recomputeFromStage(stage, executeStage, options?)`
- `expandStages(stages)`
- `getStaleStages()`

Optional: pass `preparedGraph` from `prepareProjectionStageGraph(...)` to reuse prevalidated topology in engine creation.

### `prepareProjectionStageGraph(graph, options?)`

Prepares and validates graph once. Use this for repeated expansion operations to avoid repeated graph resolution/validation.

### `expandProjectionStages(stages, graphOrPreparedGraph)`

Returns downstream closure for the requested roots.

Important contract:

- expansion is **inclusive**, so each requested stage is included in result together with its downstream dependents.

## Example

```ts
import { createProjectionStageEngine } from "@affino/projection-engine"

type Stage = "filter" | "sort" | "group" | "visible"

const engine = createProjectionStageEngine<Stage>({
  nodes: {
    filter: {},
    sort: { dependsOn: ["filter"] },
    group: { dependsOn: ["sort"] },
    visible: { dependsOn: ["group"] },
  },
  refreshEntryStage: "filter",
})

const state = {
  filterApplied: false,
  sortApplied: false,
  groupApplied: false,
  visibleApplied: false,
}

function executeStage(stage: Stage, shouldRecompute: boolean): boolean {
  if (!shouldRecompute) {
    return false
  }
  if (stage === "filter") state.filterApplied = true
  if (stage === "sort") state.sortApplied = true
  if (stage === "group") state.groupApplied = true
  if (stage === "visible") state.visibleApplied = true
  return true
}

// 1) Incoming row update affects filter roots
engine.requestStages(["filter"])

// 2) Run recompute cycle
const meta = engine.recompute(executeStage)
// meta.recomputedStages -> ["filter", "sort", "group", "visible"]

// 3) Deferred mode: block sort/group for one cycle
engine.requestStages(["filter"])
engine.recompute(executeStage, { blockedStages: ["sort", "group"] })

// 4) Check unresolved stages and heal later
const stale = engine.getStaleStages()
if (stale.length > 0) {
  engine.recompute(executeStage)
}
```

## Recompute Contract

`recompute` calls `executeStage(stage, shouldRecompute)` only for dirty stages in topological order.

- `shouldRecompute = false` for blocked stages
- if a stage is stale (`requested > computed`) and not actually recomputed, it stays dirty
- if a stage is actually recomputed, `computed` catches up to `requested`

This allows deferred projection updates without losing consistency diagnostics.

## Validation Rules

Graph validation fails fast on:

- empty graph
- unknown dependency references
- duplicate dependencies in one node
- cycles
- `refreshEntryStage` not present in graph

## Intended Usage

Use this package in core engines where:

- projection is a DAG
- updates frequently touch only part of the pipeline
- you need deterministic recompute and stale diagnostics

Designed for small to medium DAGs (typically 5-50 stages).

## Non-goals (Current)

- async stage orchestration
- built-in memoization/hashing of stage inputs
- domain-specific projection logic

## Build / Test

```bash
pnpm --filter @affino/projection-engine build
pnpm --filter @affino/projection-engine test
```
