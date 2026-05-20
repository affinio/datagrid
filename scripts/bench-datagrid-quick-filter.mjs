#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const ROW_COUNTS = (process.env.BENCH_QUICK_FILTER_ROW_COUNTS ?? "10000,50000,100000")
  .split(",")
  .map(value => Number.parseInt(value.trim(), 10))
  .filter(value => Number.isFinite(value) && value > 0)
const ITERATIONS = Number.parseInt(process.env.BENCH_QUICK_FILTER_ITERATIONS ?? "6", 10)
const WARMUP_RUNS = Number.parseInt(process.env.BENCH_WARMUP_RUNS ?? "1", 10)
const BENCH_SEEDS = (process.env.BENCH_SEEDS ?? process.env.BENCH_SEED ?? "1337")
  .split(",")
  .map(value => Number.parseInt(value.trim(), 10))
  .filter(value => Number.isFinite(value) && value > 0)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-quick-filter.json",
)

const PERF_BUDGET_TOTAL_MS = Number.parseFloat(process.env.PERF_BUDGET_TOTAL_MS ?? "Infinity")
const PERF_BUDGET_MAX_HEAP_DELTA_MB = Number.parseFloat(process.env.PERF_BUDGET_MAX_HEAP_DELTA_MB ?? "Infinity")
const PERF_BUDGET_MAX_VARIANCE_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_VARIANCE_PCT ?? "Infinity")
const PERF_BUDGET_VARIANCE_MIN_MEAN_MS = Number.parseFloat(process.env.PERF_BUDGET_VARIANCE_MIN_MEAN_MS ?? "0.5")
const PERF_BUDGET_MAX_FIRST_APPLY_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_FIRST_APPLY_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_QUERY_CHANGE_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_QUERY_CHANGE_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_CLEAR_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_CLEAR_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_SORT_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_SORT_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_COLUMN_FILTER_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_COLUMN_FILTER_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_100K_1COL_FIRST_APPLY_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_100K_1COL_FIRST_APPLY_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_100K_5COL_FIRST_APPLY_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_100K_5COL_FIRST_APPLY_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_100K_1COL_QUERY_CHANGE_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_100K_1COL_QUERY_CHANGE_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_100K_5COL_QUERY_CHANGE_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_QUICK_FILTER_100K_5COL_QUERY_CHANGE_P95_MS ?? "Infinity",
)

if (ROW_COUNTS.length === 0) {
  throw new Error("BENCH_QUICK_FILTER_ROW_COUNTS must include at least one positive integer")
}
if (BENCH_SEEDS.length === 0) {
  throw new Error("BENCH_SEEDS must include at least one positive integer")
}
assertPositiveInteger(ITERATIONS, "BENCH_QUICK_FILTER_ITERATIONS")
assertNonNegativeInteger(WARMUP_RUNS, "BENCH_WARMUP_RUNS")

function assertPositiveInteger(value, label) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

function quantile(values, q) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] === undefined) {
    return sorted[base]
  }
  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

function stats(values) {
  if (!values.length) {
    return { mean: 0, stdev: 0, p50: 0, p95: 0, p99: 0, cvPct: 0, min: 0, max: 0 }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const stdev = Math.sqrt(variance)
  return {
    mean,
    stdev,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    cvPct: mean === 0 ? 0 : (stdev / mean) * 100,
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function createRng(seed) {
  let state = seed % 2147483647
  if (state <= 0) state += 2147483646
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function randomInt(rng, min, max) {
  const span = Math.max(1, max - min + 1)
  return min + Math.floor(rng() * span)
}

function sleepTick() {
  return new Promise(resolveTick => {
    setTimeout(resolveTick, 0)
  })
}

async function sampleHeapUsed() {
  const maybeGc = globalThis.gc
  let minHeap = Number.POSITIVE_INFINITY
  for (let iteration = 0; iteration < 3; iteration += 1) {
    if (typeof maybeGc === "function") {
      maybeGc()
    }
    await sleepTick()
    const used = process.memoryUsage().heapUsed
    if (used < minHeap) {
      minHeap = used
    }
  }
  return Number.isFinite(minHeap) ? minHeap : process.memoryUsage().heapUsed
}

function toMb(bytes) {
  return bytes / (1024 * 1024)
}

async function loadCore() {
  const candidates = [
    resolve("packages/datagrid-core/dist/src/models/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]
  let lastError = null
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    try {
      const module = await import(pathToFileURL(candidate).href)
      if (typeof module.createClientRowModel === "function") {
        return { createClientRowModel: module.createClientRowModel }
      }
    } catch (error) {
      lastError = error
    }
  }
  if (lastError) {
    throw new Error(`Failed to load @affino/datagrid-core build artifacts: ${String(lastError)}`)
  }
  throw new Error("Run `pnpm --filter @affino/datagrid-core build` before quick-filter benchmarks.")
}

const REGIONS = ["AMER", "EMEA", "APAC", "LATAM"]
const TEAMS = ["api", "worker", "platform", "billing", "analytics", "ops"]
const OWNERS = ["alice", "bob", "carol", "david", "elena", "frank", "grace", "harry"]
const STATUSES = ["active", "paused", "queued", "failed", "complete"]
const QUICK_FILTER_COLUMNS_1 = ["service"]
const QUICK_FILTER_COLUMNS_5 = ["service", "owner", "status", "region", "note"]
const ALLOWED_FILTER_COLUMNS = new Set(QUICK_FILTER_COLUMNS_5)

function createRows(count, seed) {
  const rng = createRng(seed)
  const rows = new Array(count)
  for (let index = 0; index < count; index += 1) {
    rows[index] = {
      id: index,
      service: TEAMS[index % TEAMS.length],
      owner: OWNERS[index % OWNERS.length],
      status: STATUSES[index % STATUSES.length],
      region: REGIONS[index % REGIONS.length],
      note: `ticket-${index % 997}-seed-${seed}`,
      score: randomInt(rng, 0, 100000),
      latencyMs: randomInt(rng, 5, 2000),
    }
  }
  return rows
}

function createQuickFilter(query, columns) {
  return {
    columnFilters: {},
    advancedFilters: {},
    quickFilter: {
      query,
      columns,
    },
  }
}

function createColumnFilter() {
  return {
    columnFilters: {
      status: { kind: "valueSet", tokens: ["string:active"] },
    },
    advancedFilters: {},
  }
}

function createQuickAndColumnFilter(query, columns) {
  return {
    columnFilters: {
      status: { kind: "valueSet", tokens: ["string:active"] },
    },
    advancedFilters: {},
    quickFilter: {
      query,
      columns,
    },
  }
}

function createModel(createClientRowModel, rows) {
  return createClientRowModel({
    rows,
    resolveRowId: row => row.id,
    isolateInputRows: false,
    readFilterCell: (rowNode, columnKey) => {
      if (!ALLOWED_FILTER_COLUMNS.has(columnKey)) {
        throw new Error(`Unexpected quick-filter column lookup: ${columnKey}`)
      }
      return rowNode.data[columnKey]
    },
  })
}

function measure(operation) {
  const startedAt = performance.now()
  const result = operation()
  return {
    durationMs: performance.now() - startedAt,
    rowCount: result?.rowCount ?? 0,
  }
}

function applyFilter(model, filterModel) {
  model.setFilterModel(filterModel)
  return model.getSnapshot()
}

function applySortAndFilter(model, sortModel, filterModel) {
  model.setSortAndFilterModel({ sortModel, filterModel })
  return model.getSnapshot()
}

function refresh(model) {
  model.refresh("manual")
  return model.getSnapshot()
}

function runWarmup(createClientRowModel, rows, columns) {
  for (let iteration = 0; iteration < WARMUP_RUNS; iteration += 1) {
    const model = createModel(createClientRowModel, rows)
    applyFilter(model, createQuickFilter("api", columns))
    applyFilter(model, createQuickFilter("platform", columns))
    applyFilter(model, null)
    applySortAndFilter(model, [{ key: "score", direction: "desc" }], createQuickFilter("api", columns))
    applySortAndFilter(model, [], null)
    model.dispose?.()
  }
}

function runScenario(createClientRowModel, rows, columns, searchableColumnCount) {
  const durations = {
    noQuickFilterRefresh: [],
    firstApply: [],
    queryChange: [],
    clear: [],
    quickFilterAndSort: [],
    quickFilterAndColumnFilter: [],
  }
  const rowCounts = {
    firstApply: [],
    queryChange: [],
    clear: [],
    quickFilterAndSort: [],
    quickFilterAndColumnFilter: [],
  }

  runWarmup(createClientRowModel, rows, columns)

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const model = createModel(createClientRowModel, rows)

    let measured = measure(() => refresh(model))
    durations.noQuickFilterRefresh.push(measured.durationMs)

    measured = measure(() => applyFilter(model, createQuickFilter("api", columns)))
    durations.firstApply.push(measured.durationMs)
    rowCounts.firstApply.push(measured.rowCount)

    measured = measure(() => applyFilter(model, createQuickFilter("platform", columns)))
    durations.queryChange.push(measured.durationMs)
    rowCounts.queryChange.push(measured.rowCount)

    measured = measure(() => applyFilter(model, null))
    durations.clear.push(measured.durationMs)
    rowCounts.clear.push(measured.rowCount)

    measured = measure(() => applySortAndFilter(
      model,
      [{ key: "score", direction: "desc" }],
      createQuickFilter("api", columns),
    ))
    durations.quickFilterAndSort.push(measured.durationMs)
    rowCounts.quickFilterAndSort.push(measured.rowCount)

    applySortAndFilter(model, [], null)

    measured = measure(() => applyFilter(model, createQuickAndColumnFilter("api", columns)))
    durations.quickFilterAndColumnFilter.push(measured.durationMs)
    rowCounts.quickFilterAndColumnFilter.push(measured.rowCount)

    applyFilter(model, createColumnFilter())
    model.dispose?.()
  }

  return {
    searchableColumnCount,
    columns,
    durationsMs: Object.fromEntries(
      Object.entries(durations).map(([name, values]) => [name, stats(values)]),
    ),
    rowCounts: Object.fromEntries(
      Object.entries(rowCounts).map(([name, values]) => [name, stats(values)]),
    ),
  }
}

async function benchmarkSeed(seed, createClientRowModel) {
  const heapBefore = await sampleHeapUsed()
  const startedAt = performance.now()
  const rowCountResults = []

  for (const rowCount of ROW_COUNTS) {
    const rows = createRows(rowCount, seed)
    const scenarios = [
      runScenario(createClientRowModel, rows, QUICK_FILTER_COLUMNS_1, 1),
      runScenario(createClientRowModel, rows, QUICK_FILTER_COLUMNS_5, 5),
    ]
    rowCountResults.push({ rowCount, scenarios })
  }

  const elapsedMs = performance.now() - startedAt
  const heapAfter = await sampleHeapUsed()
  return {
    seed,
    elapsedMs,
    heapDeltaMb: toMb(heapAfter - heapBefore),
    rowCounts: rowCountResults,
  }
}

function collectOperationP95(results, operationName) {
  const values = []
  for (const result of results) {
    for (const rowCountResult of result.rowCounts) {
      for (const scenario of rowCountResult.scenarios) {
        values.push(scenario.durationsMs[operationName].p95)
      }
    }
  }
  return stats(values)
}

function collectScenarioOperationP95(results, rowCount, searchableColumnCount, operationName) {
  const values = []
  for (const result of results) {
    const rowCountResult = result.rowCounts.find(candidate => candidate.rowCount === rowCount)
    const scenario = rowCountResult?.scenarios.find(candidate => (
      candidate.searchableColumnCount === searchableColumnCount
    ))
    if (scenario) {
      values.push(scenario.durationsMs[operationName].p95)
    }
  }
  return stats(values)
}

function shouldEnforceVariance(stat) {
  return (
    PERF_BUDGET_MAX_VARIANCE_PCT !== Number.POSITIVE_INFINITY &&
    stat.mean >= PERF_BUDGET_VARIANCE_MIN_MEAN_MS
  )
}

function checkBudget(label, stat, budget, budgetErrors) {
  if (Number.isFinite(budget) && stat.p95 > budget) {
    budgetErrors.push(`${label} p95 ${stat.p95.toFixed(3)}ms exceeds budget ${budget}ms`)
  }
  if (shouldEnforceVariance(stat) && stat.cvPct > PERF_BUDGET_MAX_VARIANCE_PCT) {
    budgetErrors.push(`${label} variance ${stat.cvPct.toFixed(2)}% exceeds budget ${PERF_BUDGET_MAX_VARIANCE_PCT}%`)
  }
}

const { createClientRowModel } = await loadCore()
const runResults = []
for (const seed of BENCH_SEEDS) {
  const result = await benchmarkSeed(seed, createClientRowModel)
  runResults.push(result)
  const firstApply = collectOperationP95([result], "firstApply")
  const queryChange = collectOperationP95([result], "queryChange")
  const clear = collectOperationP95([result], "clear")
  console.log(
    `seed=${seed} firstApplyP95=${firstApply.p95.toFixed(3)}ms queryChangeP95=${queryChange.p95.toFixed(3)}ms clearP95=${clear.p95.toFixed(3)}ms heapDelta=${result.heapDeltaMb.toFixed(2)}MB`,
  )
}

const aggregate = {
  elapsedMs: stats(runResults.map(result => result.elapsedMs)),
  heapDeltaMb: stats(runResults.map(result => result.heapDeltaMb)),
  noQuickFilterRefreshP95Ms: collectOperationP95(runResults, "noQuickFilterRefresh"),
  firstApplyP95Ms: collectOperationP95(runResults, "firstApply"),
  queryChangeP95Ms: collectOperationP95(runResults, "queryChange"),
  clearP95Ms: collectOperationP95(runResults, "clear"),
  quickFilterAndSortP95Ms: collectOperationP95(runResults, "quickFilterAndSort"),
  quickFilterAndColumnFilterP95Ms: collectOperationP95(runResults, "quickFilterAndColumnFilter"),
  typingScenarios: {
    "100k_1col": {
      firstApplyP95Ms: collectScenarioOperationP95(runResults, 100000, 1, "firstApply"),
      queryChangeP95Ms: collectScenarioOperationP95(runResults, 100000, 1, "queryChange"),
    },
    "100k_5col": {
      firstApplyP95Ms: collectScenarioOperationP95(runResults, 100000, 5, "firstApply"),
      queryChangeP95Ms: collectScenarioOperationP95(runResults, 100000, 5, "queryChange"),
    },
  },
}

const budgetErrors = []
checkBudget("firstApply", aggregate.firstApplyP95Ms, PERF_BUDGET_MAX_FIRST_APPLY_P95_MS, budgetErrors)
checkBudget("queryChange", aggregate.queryChangeP95Ms, PERF_BUDGET_MAX_QUERY_CHANGE_P95_MS, budgetErrors)
checkBudget("clear", aggregate.clearP95Ms, PERF_BUDGET_MAX_CLEAR_P95_MS, budgetErrors)
checkBudget("quickFilterAndSort", aggregate.quickFilterAndSortP95Ms, PERF_BUDGET_MAX_SORT_P95_MS, budgetErrors)
checkBudget(
  "quickFilterAndColumnFilter",
  aggregate.quickFilterAndColumnFilterP95Ms,
  PERF_BUDGET_MAX_COLUMN_FILTER_P95_MS,
  budgetErrors,
)
checkBudget(
  "100k/1col firstApply",
  aggregate.typingScenarios["100k_1col"].firstApplyP95Ms,
  PERF_BUDGET_MAX_100K_1COL_FIRST_APPLY_P95_MS,
  budgetErrors,
)
checkBudget(
  "100k/5col firstApply",
  aggregate.typingScenarios["100k_5col"].firstApplyP95Ms,
  PERF_BUDGET_MAX_100K_5COL_FIRST_APPLY_P95_MS,
  budgetErrors,
)
checkBudget(
  "100k/1col queryChange",
  aggregate.typingScenarios["100k_1col"].queryChangeP95Ms,
  PERF_BUDGET_MAX_100K_1COL_QUERY_CHANGE_P95_MS,
  budgetErrors,
)
checkBudget(
  "100k/5col queryChange",
  aggregate.typingScenarios["100k_5col"].queryChangeP95Ms,
  PERF_BUDGET_MAX_100K_5COL_QUERY_CHANGE_P95_MS,
  budgetErrors,
)
if (Number.isFinite(PERF_BUDGET_TOTAL_MS) && aggregate.elapsedMs.p95 > PERF_BUDGET_TOTAL_MS) {
  budgetErrors.push(`elapsed p95 ${aggregate.elapsedMs.p95.toFixed(3)}ms exceeds budget ${PERF_BUDGET_TOTAL_MS}ms`)
}
if (Number.isFinite(PERF_BUDGET_MAX_HEAP_DELTA_MB) && aggregate.heapDeltaMb.p95 > PERF_BUDGET_MAX_HEAP_DELTA_MB) {
  budgetErrors.push(
    `heap delta p95 ${aggregate.heapDeltaMb.p95.toFixed(3)}MB exceeds budget ${PERF_BUDGET_MAX_HEAP_DELTA_MB}MB`,
  )
}

const summary = {
  benchmark: "datagrid-quick-filter",
  config: {
    rowCounts: ROW_COUNTS,
    iterations: ITERATIONS,
    warmupRuns: WARMUP_RUNS,
    seeds: BENCH_SEEDS,
    scenarios: [
      { searchableColumnCount: 0, operation: "noQuickFilterRefresh" },
      { searchableColumnCount: 1, columns: QUICK_FILTER_COLUMNS_1 },
      { searchableColumnCount: 5, columns: QUICK_FILTER_COLUMNS_5 },
    ],
  },
  budgets: {
    firstApplyP95Ms: PERF_BUDGET_MAX_FIRST_APPLY_P95_MS,
    queryChangeP95Ms: PERF_BUDGET_MAX_QUERY_CHANGE_P95_MS,
    clearP95Ms: PERF_BUDGET_MAX_CLEAR_P95_MS,
    quickFilterAndSortP95Ms: PERF_BUDGET_MAX_SORT_P95_MS,
    quickFilterAndColumnFilterP95Ms: PERF_BUDGET_MAX_COLUMN_FILTER_P95_MS,
    typingScenarios: {
      "100k_1col": {
        firstApplyP95Ms: PERF_BUDGET_MAX_100K_1COL_FIRST_APPLY_P95_MS,
        queryChangeP95Ms: PERF_BUDGET_MAX_100K_1COL_QUERY_CHANGE_P95_MS,
      },
      "100k_5col": {
        firstApplyP95Ms: PERF_BUDGET_MAX_100K_5COL_FIRST_APPLY_P95_MS,
        queryChangeP95Ms: PERF_BUDGET_MAX_100K_5COL_QUERY_CHANGE_P95_MS,
      },
    },
  },
  aggregate,
  runs: runResults,
  budgetErrors,
}

mkdirSync(dirname(BENCH_OUTPUT_JSON), { recursive: true })
writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`)
console.log(`Benchmark summary written: ${BENCH_OUTPUT_JSON}`)
console.log(
  `quickFilter firstApplyP95=${aggregate.firstApplyP95Ms.p95.toFixed(3)}ms queryChangeP95=${aggregate.queryChangeP95Ms.p95.toFixed(3)}ms clearP95=${aggregate.clearP95Ms.p95.toFixed(3)}ms`,
)

if (budgetErrors.length > 0) {
  console.error("\nQuick filter benchmark budget check failed:")
  for (const error of budgetErrors) {
    console.error(`- ${error}`)
  }
  process.exitCode = 1
}
