#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const OUTPUT_DIR = resolve(process.env.BENCH_ENTERPRISE_OUTPUT_DIR ?? "artifacts/performance")
const OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? `${OUTPUT_DIR}/bench-datagrid-enterprise-workloads.json`,
)
const PROFILE = process.env.BENCH_ENTERPRISE_PROFILE === "smoke" ? "smoke" : "full"
const IS_SMOKE = PROFILE === "smoke"

const DEFAULT_SEEDS = IS_SMOKE ? "1337" : "1337,7331,2026"
const BENCH_SEEDS = parseIntegerList(process.env.BENCH_SEEDS ?? DEFAULT_SEEDS)
const BENCH_WARMUP_RUNS = intEnv("BENCH_WARMUP_RUNS", IS_SMOKE ? 0 : 1)

const CLIENT_ROW_MATRIX = parseIntegerList(
  process.env.BENCH_ENTERPRISE_CLIENT_ROW_MATRIX ??
    (IS_SMOKE ? "1000,5000" : "10000,100000,500000,1000000"),
)
const CLIENT_COLUMN_COUNT = intEnv("BENCH_ENTERPRISE_CLIENT_COLUMN_COUNT", 50)
const CLIENT_VIEWPORT_ROWS = intEnv("BENCH_ENTERPRISE_CLIENT_VIEWPORT_ROWS", IS_SMOKE ? 80 : 160)
const CLIENT_SCROLL_ITERATIONS = intEnv("BENCH_ENTERPRISE_CLIENT_SCROLL_ITERATIONS", IS_SMOKE ? 12 : 220)

const SERVER_ROW_COUNT = intEnv("BENCH_ENTERPRISE_SERVER_ROW_COUNT", IS_SMOKE ? 10000 : 1000000)
const SERVER_COLUMN_COUNT = intEnv("BENCH_ENTERPRISE_SERVER_COLUMN_COUNT", 50)
const SERVER_VIEWPORT_ROWS = intEnv("BENCH_ENTERPRISE_SERVER_VIEWPORT_ROWS", IS_SMOKE ? 80 : 180)
const SERVER_SCROLL_ITERATIONS = intEnv("BENCH_ENTERPRISE_SERVER_SCROLL_ITERATIONS", IS_SMOKE ? 12 : 180)
const SERVER_ROW_CACHE_LIMIT = intEnv("BENCH_ENTERPRISE_SERVER_ROW_CACHE_LIMIT", IS_SMOKE ? 1024 : 8192)
const SERVER_LATENCY_MS = floatEnv("BENCH_ENTERPRISE_SERVER_LATENCY_MS", IS_SMOKE ? 0 : 2)

const UPDATE_ROW_COUNT = intEnv("BENCH_ENTERPRISE_UPDATE_ROW_COUNT", IS_SMOKE ? 5000 : 100000)
const UPDATE_COLUMN_COUNT = intEnv("BENCH_ENTERPRISE_UPDATE_COLUMN_COUNT", 50)
const UPDATE_RATES = parseIntegerList(process.env.BENCH_ENTERPRISE_UPDATE_RATES ?? "100,1000,5000")
const UPDATE_WINDOW_SECONDS = floatEnv("BENCH_ENTERPRISE_UPDATE_WINDOW_SECONDS", IS_SMOKE ? 0.2 : 1)
const UPDATE_BATCHES_PER_SECOND = intEnv("BENCH_ENTERPRISE_UPDATE_BATCHES_PER_SECOND", 10)

const SORT_FILTER_ROW_COUNT = intEnv("BENCH_ENTERPRISE_SORT_FILTER_ROW_COUNT", IS_SMOKE ? 10000 : 500000)
const SORT_FILTER_COLUMN_COUNT = intEnv("BENCH_ENTERPRISE_SORT_FILTER_COLUMN_COUNT", 50)
const SORT_FILTER_ITERATIONS = intEnv("BENCH_ENTERPRISE_SORT_FILTER_ITERATIONS", IS_SMOKE ? 4 : 16)
const SORT_FILTER_VIEWPORT_ROWS = intEnv("BENCH_ENTERPRISE_SORT_FILTER_VIEWPORT_ROWS", IS_SMOKE ? 80 : 180)

const COPY_ROW_COUNT = intEnv("BENCH_ENTERPRISE_COPY_ROW_COUNT", IS_SMOKE ? 5000 : 100000)
const COPY_COLUMN_COUNT = intEnv("BENCH_ENTERPRISE_COPY_COLUMN_COUNT", 100)
const COPY_ROWS = intEnv("BENCH_ENTERPRISE_COPY_ROWS", IS_SMOKE ? 80 : 1000)
const COPY_COLUMNS = intEnv("BENCH_ENTERPRISE_COPY_COLUMNS", IS_SMOKE ? 8 : 20)
const FILL_ROWS = intEnv("BENCH_ENTERPRISE_FILL_ROWS", IS_SMOKE ? 200 : 5000)
const FILL_COLUMNS = intEnv("BENCH_ENTERPRISE_FILL_COLUMNS", IS_SMOKE ? 4 : 5)

const PIVOT_TREE_ROW_COUNT = intEnv("BENCH_ENTERPRISE_PIVOT_TREE_ROW_COUNT", IS_SMOKE ? 10000 : 100000)
const PIVOT_TREE_VIEWPORT_ROWS = intEnv("BENCH_ENTERPRISE_PIVOT_TREE_VIEWPORT_ROWS", IS_SMOKE ? 80 : 180)
const PIVOT_TREE_ITERATIONS = intEnv("BENCH_ENTERPRISE_PIVOT_TREE_ITERATIONS", IS_SMOKE ? 4 : 32)

const SOAK_ROW_COUNT = intEnv("BENCH_ENTERPRISE_SOAK_ROW_COUNT", IS_SMOKE ? 5000 : 100000)
const SOAK_COLUMN_COUNT = intEnv("BENCH_ENTERPRISE_SOAK_COLUMN_COUNT", 50)
const SOAK_SECONDS = floatEnv("BENCH_ENTERPRISE_SOAK_SECONDS", IS_SMOKE ? 3 : 300)
const SOAK_HEAP_SAMPLE_SECONDS = floatEnv("BENCH_ENTERPRISE_SOAK_HEAP_SAMPLE_SECONDS", IS_SMOKE ? 1 : 10)
const SOAK_EDIT_BATCH_SIZE = intEnv("BENCH_ENTERPRISE_SOAK_EDIT_BATCH_SIZE", IS_SMOKE ? 8 : 128)
const SOAK_VIEWPORT_ROWS = intEnv("BENCH_ENTERPRISE_SOAK_VIEWPORT_ROWS", IS_SMOKE ? 80 : 180)
const SOAK_SERVER_LATENCY_MS = floatEnv("BENCH_ENTERPRISE_SOAK_SERVER_LATENCY_MS", IS_SMOKE ? 0 : 2)

const PERF_BUDGET_MAX_SOAK_HEAP_GROWTH_MB = floatEnv(
  "PERF_BUDGET_MAX_SOAK_HEAP_GROWTH_MB",
  Number.POSITIVE_INFINITY,
)
const PERF_BUDGET_SOAK_HEAP_EPSILON_MB = floatEnv("PERF_BUDGET_SOAK_HEAP_EPSILON_MB", 1)

if (!BENCH_SEEDS.length) {
  throw new Error("BENCH_SEEDS must contain at least one positive integer")
}
for (const [label, value] of [
  ["BENCH_ENTERPRISE_CLIENT_COLUMN_COUNT", CLIENT_COLUMN_COUNT],
  ["BENCH_ENTERPRISE_SERVER_COLUMN_COUNT", SERVER_COLUMN_COUNT],
  ["BENCH_ENTERPRISE_UPDATE_COLUMN_COUNT", UPDATE_COLUMN_COUNT],
  ["BENCH_ENTERPRISE_SORT_FILTER_COLUMN_COUNT", SORT_FILTER_COLUMN_COUNT],
  ["BENCH_ENTERPRISE_COPY_COLUMN_COUNT", COPY_COLUMN_COUNT],
  ["BENCH_ENTERPRISE_SOAK_COLUMN_COUNT", SOAK_COLUMN_COUNT],
]) {
  assertPositiveInteger(value, label)
}

const REGIONS = ["AMER", "EMEA", "APAC", "LATAM"]
const TEAMS = ["core", "growth", "payments", "platform", "ops", "infra", "data", "support"]
const STATUSES = ["critical", "warning", "ok", "queued"]
const YEARS = [2022, 2023, 2024, 2025, 2026]
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"]

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10)
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`)
  }
  return value
}

function floatEnv(name, fallback) {
  const value = Number.parseFloat(process.env[name] ?? String(fallback))
  if (!Number.isFinite(value) && value !== Number.POSITIVE_INFINITY) {
    throw new Error(`${name} must be a finite number or Infinity`)
  }
  return value
}

function parseIntegerList(input) {
  return String(input ?? "")
    .split(",")
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value) && value > 0)
}

function assertPositiveInteger(value, label) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function quantile(values, q) {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  if (sorted[base + 1] === undefined) {
    return sorted[base]
  }
  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

function stats(values) {
  if (!values.length) {
    return { mean: 0, stdev: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, cvPct: 0 }
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
    min: Math.min(...values),
    max: Math.max(...values),
    cvPct: mean === 0 ? 0 : (stdev / mean) * 100,
  }
}

function createRng(seed) {
  let state = seed % 2147483647
  if (state <= 0) {
    state += 2147483646
  }
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function randomInt(rng, min, max) {
  const span = Math.max(1, max - min + 1)
  return min + Math.floor(rng() * span)
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, Math.max(0, ms)))
}

function sleepTick() {
  return sleep(0)
}

function toMb(bytes) {
  return bytes / (1024 * 1024)
}

function heapMbNow() {
  return toMb(process.memoryUsage().heapUsed)
}

function addTiming(target, key, elapsedMs) {
  target[key] = (target[key] ?? 0) + elapsedMs
}

function measurePhase(target, key, fn) {
  const startedAt = performance.now()
  const result = fn()
  addTiming(target, key, performance.now() - startedAt)
  return result
}

function recordMemory(target, key) {
  target[key] = heapMbNow()
}

function aggregatePhaseTimings(runs, phaseKeys) {
  return Object.fromEntries(
    phaseKeys.map(key => [key, stats(runs.map(run => run.phaseTimingsMs?.[key] ?? 0))]),
  )
}

function aggregatePhaseSamples(runs, sampleKeys) {
  return Object.fromEntries(
    sampleKeys.map(key => [key, stats(runs.flatMap(run => run.phaseSamplesMs?.[key] ?? []))]),
  )
}

function aggregatePhaseMemoryDeltas(runs, phasePairs) {
  return Object.fromEntries(
    phasePairs.map(([key, fromKey, toKey]) => [
      key,
      stats(
        runs.map(run => {
          const from = run.phaseMemoryMb?.[fromKey]
          const to = run.phaseMemoryMb?.[toKey]
          return typeof from === "number" && typeof to === "number" ? to - from : 0
        }),
      ),
    ]),
  )
}

async function sampleHeapUsed() {
  const maybeGc = globalThis.gc
  let minHeap = Number.POSITIVE_INFINITY
  for (let iteration = 0; iteration < 3; iteration += 1) {
    if (typeof maybeGc === "function") {
      maybeGc()
    }
    await sleepTick()
    const heapUsed = process.memoryUsage().heapUsed
    if (heapUsed < minHeap) {
      minHeap = heapUsed
    }
  }
  return Number.isFinite(minHeap) ? minHeap : process.memoryUsage().heapUsed
}

function normalizeRange(start, rowCount, viewportRows) {
  const safeRowCount = Math.max(1, rowCount)
  const safeViewport = Math.max(1, Math.min(viewportRows, safeRowCount))
  const safeStart = Math.max(0, Math.min(safeRowCount - safeViewport, Math.trunc(start)))
  return {
    start: safeStart,
    end: Math.min(safeRowCount - 1, safeStart + safeViewport - 1),
  }
}

function createEnterpriseRow(index, seed, physicalColumns = 10) {
  const region = REGIONS[index % REGIONS.length] ?? "AMER"
  const team = TEAMS[Math.floor(index / REGIONS.length) % TEAMS.length] ?? "core"
  const status = STATUSES[index % STATUSES.length] ?? "ok"
  const year = YEARS[index % YEARS.length] ?? 2024
  const quarter = QUARTERS[index % QUARTERS.length] ?? "Q1"
  const base = {
    id: index,
    rowId: index,
    region,
    team,
    status,
    year,
    quarter,
    band: String(index % 100),
    treeA: region,
    treeB: team,
    treeC: `bucket-${index % 32}`,
    revenue: ((index * 37 + seed) % 500000) + 100,
    orders: (index % 25) + 1,
    latency: (index * 17 + seed) % 2000,
    score: (index * 29 + seed) % 100000,
    version: 0,
  }
  const limit = Math.min(physicalColumns, 20)
  for (let column = 0; column < limit; column += 1) {
    base[`c${column}`] = deterministicCellValue(index, column, seed)
  }
  return base
}

function createEnterpriseRows(rowCount, seed, options = {}) {
  const physicalColumns = options.physicalColumns ?? 10
  const rows = new Array(rowCount)
  for (let index = 0; index < rowCount; index += 1) {
    rows[index] = createEnterpriseRow(index, seed, physicalColumns)
  }
  return rows
}

function deterministicCellValue(rowIndex, columnIndex, seed) {
  return (rowIndex * 1009 + columnIndex * 9176 + seed * 37) % 1000003
}

const COLUMN_KEY_CACHE = new Map()

function getColumnKeys(columnCount) {
  const safeColumnCount = Math.max(0, Math.trunc(columnCount))
  let keys = COLUMN_KEY_CACHE.get(safeColumnCount)
  if (!keys) {
    keys = new Array(safeColumnCount)
    for (let column = 0; column < safeColumnCount; column += 1) {
      keys[column] = `c${column}`
    }
    COLUMN_KEY_CACHE.set(safeColumnCount, keys)
  }
  return keys
}

function readCell(row, columnIndex, seed = 0) {
  const key = getColumnKeys(columnIndex + 1)[columnIndex]
  if (Object.prototype.hasOwnProperty.call(row, key)) {
    return row[key]
  }
  return deterministicCellValue(Number(row.id ?? row.rowId ?? 0), columnIndex, seed)
}

function materializeViewportCells(rows, columnCount, seed) {
  const keys = getColumnKeys(columnCount)
  let checksum = 0
  for (const rowNode of rows) {
    const row = rowNode?.row ?? rowNode?.data ?? rowNode
    if (!row) {
      continue
    }
    const rowId = Number(row.id ?? row.rowId ?? 0)
    for (let column = 0; column < columnCount; column += 1) {
      const key = keys[column]
      const value = Object.prototype.hasOwnProperty.call(row, key)
        ? row[key]
        : (rowId * 1009 + column * 9176 + seed * 37) % 1000003
      checksum = (checksum + Number(value ?? 0) + column) % 2147483647
    }
  }
  return checksum
}

function buildFilterModel(iteration = 0) {
  const region = REGIONS[iteration % REGIONS.length] ?? "AMER"
  const team = TEAMS[(iteration + 2) % TEAMS.length] ?? "core"
  const status = STATUSES[(iteration + 1) % STATUSES.length] ?? "ok"
  return {
    columnFilters: {
      region: { kind: "valueSet", tokens: [`string:${region}`] },
      team: { kind: "valueSet", tokens: [`string:${team}`] },
      status: { kind: "valueSet", tokens: [`string:${status}`] },
    },
    advancedFilters: {},
  }
}

function buildSortModel(iteration = 0) {
  const direction = iteration % 2 === 0 ? "asc" : "desc"
  return [
    { key: "revenue", direction },
    { key: "latency", direction: direction === "asc" ? "desc" : "asc" },
    { key: "score", direction },
  ]
}

function diffDerivedCache(before, after) {
  return {
    filterPredicateHits: Math.max(0, after.filterPredicateHits - before.filterPredicateHits),
    filterPredicateMisses: Math.max(0, after.filterPredicateMisses - before.filterPredicateMisses),
    sortValueHits: Math.max(0, after.sortValueHits - before.sortValueHits),
    sortValueMisses: Math.max(0, after.sortValueMisses - before.sortValueMisses),
    groupValueHits: Math.max(0, after.groupValueHits - before.groupValueHits),
    groupValueMisses: Math.max(0, after.groupValueMisses - before.groupValueMisses),
    sourceColumnCacheEvictions: Math.max(0, after.sourceColumnCacheEvictions - before.sourceColumnCacheEvictions),
    sourceColumnCacheSize: after.sourceColumnCacheSize,
  }
}

function ratioPct(hits, misses) {
  const total = hits + misses
  return total > 0 ? (hits / total) * 100 : 0
}

async function maybeRefresh(model, reason = "reapply") {
  const result = model.refresh?.(reason)
  if (result && typeof result.then === "function") {
    await result
  }
}

function summarizeStageTimes(stageTimes) {
  if (!stageTimes || typeof stageTimes !== "object") {
    return {}
  }
  return Object.fromEntries(
    Object.entries(stageTimes).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
  )
}

function estimateJsonBytes(value, seen = new Set()) {
  if (value == null) {
    return 4
  }
  const type = typeof value
  if (type === "string") {
    return value.length + 2
  }
  if (type === "number" || type === "boolean") {
    return String(value).length
  }
  if (type !== "object") {
    return 0
  }
  if (seen.has(value)) {
    return 0
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.reduce((sum, entry) => sum + estimateJsonBytes(entry, seen) + 1, 2)
  }
  let total = 2
  for (const [key, entry] of Object.entries(value)) {
    total += key.length + 3 + estimateJsonBytes(entry, seen)
  }
  return total
}

async function loadDatagridCore() {
  const publicCandidates = [
    resolve("packages/datagrid-core/dist/src/models/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]
  const selectionCandidates = [
    resolve("packages/datagrid-core/dist/src/selection/selectionState.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]
  const sourceCandidates = [
    resolve("packages/datagrid-core/src/models/clientRowModel.ts"),
    resolve("packages/datagrid-core/src/models/dataSourceBackedRowModel.ts"),
    resolve("packages/datagrid-core/src/public.ts"),
  ]
  const buildMarkerCandidates = [
    resolve("packages/datagrid-core/tsconfig.public.tsbuildinfo"),
    resolve("packages/datagrid-core/tsconfig.tsbuildinfo"),
    resolve("packages/datagrid-core/dist/tsconfig.public.tsbuildinfo"),
    resolve("packages/datagrid-core/dist/tsconfig.tsbuildinfo"),
  ]

  warnIfDistLooksStale(publicCandidates, sourceCandidates, buildMarkerCandidates)

  let lastError = null
  let factories = null
  for (const candidate of publicCandidates) {
    if (!existsSync(candidate)) {
      continue
    }
    try {
      const module = await import(pathToFileURL(candidate).href)
      if (
        typeof module.createClientRowModel === "function" &&
        typeof module.createDataSourceBackedRowModel === "function"
      ) {
        factories = {
          createClientRowModel: module.createClientRowModel,
          createDataSourceBackedRowModel: module.createDataSourceBackedRowModel,
        }
        break
      }
    } catch (error) {
      lastError = error
    }
  }
  if (!factories) {
    if (lastError) {
      throw new Error(`Failed to load datagrid core benchmark factories: ${String(lastError)}`)
    }
    throw new Error("Unable to locate datagrid-core build artifacts. Run `pnpm --filter @affino/datagrid-core build`.")
  }

  let selection = {}
  for (const candidate of selectionCandidates) {
    if (!existsSync(candidate)) {
      continue
    }
    try {
      const module = await import(pathToFileURL(candidate).href)
      selection = {
        createGridSelectionContextFromFlattenedRows: module.createGridSelectionContextFromFlattenedRows,
        createGridSelectionRange: module.createGridSelectionRange,
      }
      break
    } catch {
      selection = {}
    }
  }

  return { ...factories, selection }
}

function warnIfDistLooksStale(distCandidates, sourceCandidates, buildMarkerCandidates) {
  if (process.env.BENCH_ALLOW_STALE_DIST === "1") {
    return
  }
  const sourceTimestamps = sourceCandidates
    .filter(candidate => existsSync(candidate))
    .map(candidate => statSync(candidate).mtimeMs)
  const newestSourceTimestamp = sourceTimestamps.length ? Math.max(...sourceTimestamps) : 0
  const buildMarkerTimestamps = buildMarkerCandidates
    .filter(candidate => existsSync(candidate))
    .map(candidate => statSync(candidate).mtimeMs)
  const newestBuildMarkerTimestamp = buildMarkerTimestamps.length ? Math.max(...buildMarkerTimestamps) : 0
  for (const candidate of distCandidates) {
    if (!existsSync(candidate)) {
      continue
    }
    const freshnessTimestamp = Math.max(statSync(candidate).mtimeMs, newestBuildMarkerTimestamp)
    if (newestSourceTimestamp > freshnessTimestamp) {
      const message = `Datagrid dist artifact appears stale (${candidate}). Run \`pnpm --filter @affino/datagrid-core build\` before benchmarks.`
      if (process.env.BENCH_ENFORCE_FRESH_DIST === "1") {
        throw new Error(message)
      }
      console.warn(`[bench] ${message} Continuing because BENCH_ENFORCE_FRESH_DIST is not set.`)
      return
    }
  }
}

async function writeScenarioReport(fileName, report) {
  const path = resolve(OUTPUT_DIR, fileName)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(report, null, 2))
  return path
}

function createScenarioReport(name, config, runs, aggregate, extra = {}) {
  return {
    benchmark: `datagrid-enterprise-${name}`,
    generatedAt: new Date().toISOString(),
    observationMode: true,
    config,
    aggregate,
    runs,
    budgetErrors: [],
    ok: true,
    ...extra,
  }
}

const CLIENT_VIEWPORT_PHASE_KEYS = [
  "datasetGeneration",
  "rowModelCreation",
  "viewportRangeCalculation",
  "rowModelViewportUpdate",
  "renderedRangeAccess",
  "logicalCellMaterialization",
  "columnAccessValueResolution",
  "selectionDecoratorReferenceGeometry",
]

const CLIENT_VIEWPORT_SAMPLE_KEYS = [
  "viewportRangeCalculation",
  "rowModelViewportUpdate",
  "renderedRangeAccess",
  "logicalCellMaterialization",
  "columnAccessValueResolution",
  "selectionDecoratorReferenceGeometry",
]

const CLIENT_VIEWPORT_MEMORY_PHASES = [
  ["datasetGeneration", "beforeSetup", "afterDatasetGeneration"],
  ["rowModelCreation", "afterDatasetGeneration", "afterRowModelCreation"],
  ["operations", "afterRowModelCreation", "afterOperations"],
  ["dispose", "afterOperations", "afterDispose"],
  ["postGcRetained", "beforeSetup", "afterGc"],
]

async function runClientViewportScrollScenario(createClientRowModel) {
  const rowCountResults = []
  const runs = []

  for (const rowCount of CLIENT_ROW_MATRIX) {
    const sizeRuns = []
    for (const seed of BENCH_SEEDS) {
      for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
        await measureClientViewportSeed(createClientRowModel, rowCount, seed + warmup + 1000, {
          warmupOnly: true,
        })
      }
      const result = await measureClientViewportSeed(createClientRowModel, rowCount, seed)
      runs.push(result)
      sizeRuns.push(result)
    }
    rowCountResults.push({
      rowCount,
      columnCount: CLIENT_COLUMN_COUNT,
      viewportCalculationMs: stats(sizeRuns.flatMap(run => run.viewportCalculationSamplesMs)),
      renderedRangeUpdateMs: stats(sizeRuns.flatMap(run => run.renderedRangeUpdateSamplesMs)),
      phaseTimingsMs: aggregatePhaseTimings(sizeRuns, CLIENT_VIEWPORT_PHASE_KEYS),
      phaseSamplesMs: aggregatePhaseSamples(sizeRuns, CLIENT_VIEWPORT_SAMPLE_KEYS),
      phaseMemoryDeltaMb: aggregatePhaseMemoryDeltas(sizeRuns, CLIENT_VIEWPORT_MEMORY_PHASES),
      totalElapsedWithSetupMs: stats(sizeRuns.map(run => run.totalElapsedWithSetupMs)),
      operationElapsedMs: stats(sizeRuns.map(run => run.elapsedMs)),
      materializedCells: stats(sizeRuns.map(run => run.materializedCells)),
      viewportLatencyMs: stats(sizeRuns.flatMap(run => run.viewportLatencySamplesMs)),
      elapsedMs: stats(sizeRuns.map(run => run.elapsedMs)),
      heapDeltaMb: stats(sizeRuns.map(run => run.heapDeltaMb)),
    })
  }

  const report = createScenarioReport(
    "client-viewport-scroll",
    {
      seeds: BENCH_SEEDS,
      rowMatrix: CLIENT_ROW_MATRIX,
      columnCount: CLIENT_COLUMN_COUNT,
      viewportRows: CLIENT_VIEWPORT_ROWS,
      scrollIterations: CLIENT_SCROLL_ITERATIONS,
      warmupRuns: BENCH_WARMUP_RUNS,
    },
    runs,
    {
      byRowCount: rowCountResults,
      phaseTimingsMs: aggregatePhaseTimings(runs, CLIENT_VIEWPORT_PHASE_KEYS),
      phaseSamplesMs: aggregatePhaseSamples(runs, CLIENT_VIEWPORT_SAMPLE_KEYS),
      phaseMemoryDeltaMb: aggregatePhaseMemoryDeltas(runs, CLIENT_VIEWPORT_MEMORY_PHASES),
      totalElapsedWithSetupMs: stats(runs.map(run => run.totalElapsedWithSetupMs)),
      operationElapsedMs: stats(runs.map(run => run.elapsedMs)),
      materializedCells: stats(runs.map(run => run.materializedCells)),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      heapDeltaMb: stats(runs.map(run => run.heapDeltaMb)),
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-client-viewport-scroll.json", report)
  return report
}

async function measureClientViewportSeed(createClientRowModel, rowCount, seed, options = {}) {
  const heapStart = await sampleHeapUsed()
  const phaseTimingsMs = {}
  const phaseMemoryMb = {
    beforeSetup: toMb(heapStart),
  }
  const rows = measurePhase(phaseTimingsMs, "datasetGeneration", () =>
    createEnterpriseRows(rowCount, seed, { physicalColumns: Math.min(10, CLIENT_COLUMN_COUNT) }),
  )
  recordMemory(phaseMemoryMb, "afterDatasetGeneration")
  const model = measurePhase(phaseTimingsMs, "rowModelCreation", () =>
    createClientRowModel({
      rows,
      resolveRowId: row => row.id,
      isolateInputRows: false,
      captureFormulaExplainDiagnostics: false,
      captureFormulaRowRecomputeDiagnostics: false,
    }),
  )
  recordMemory(phaseMemoryMb, "afterRowModelCreation")
  const rng = createRng(seed)
  const viewportCalculationSamplesMs = []
  const renderedRangeUpdateSamplesMs = []
  const viewportLatencySamplesMs = []
  const phaseSamplesMs = {
    viewportRangeCalculation: [],
    rowModelViewportUpdate: [],
    renderedRangeAccess: [],
    logicalCellMaterialization: [],
    columnAccessValueResolution: [],
    selectionDecoratorReferenceGeometry: [],
  }
  let checksum = 0
  let materializedCells = 0
  const startedAt = performance.now()

  try {
    const iterations = options.warmupOnly ? Math.min(6, CLIENT_SCROLL_ITERATIONS) : CLIENT_SCROLL_ITERATIONS
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const rawStart = randomInt(rng, 0, Math.max(0, rowCount - CLIENT_VIEWPORT_ROWS - 1))
      const opStartedAt = performance.now()
      const rangeStartedAt = performance.now()
      const range = normalizeRange(rawStart, rowCount, CLIENT_VIEWPORT_ROWS)
      const rangeElapsedMs = performance.now() - rangeStartedAt
      const viewportUpdateStartedAt = performance.now()
      model.setViewportRange(range)
      const viewportUpdateElapsedMs = performance.now() - viewportUpdateStartedAt
      const viewportDoneAt = performance.now()
      const rangeAccessStartedAt = performance.now()
      const visibleRows = model.getRowsInRange(range)
      const rangeAccessElapsedMs = performance.now() - rangeAccessStartedAt
      const materializationStartedAt = performance.now()
      checksum = (checksum + materializeViewportCells(visibleRows, CLIENT_COLUMN_COUNT, seed)) % 2147483647
      const materializationElapsedMs = performance.now() - materializationStartedAt
      const selectionDecoratorReferenceGeometryElapsedMs = 0
      materializedCells += visibleRows.length * CLIENT_COLUMN_COUNT
      const renderDoneAt = performance.now()
      if (!options.warmupOnly) {
        viewportCalculationSamplesMs.push(viewportDoneAt - opStartedAt)
        renderedRangeUpdateSamplesMs.push(renderDoneAt - viewportDoneAt)
        viewportLatencySamplesMs.push(renderDoneAt - opStartedAt)
        phaseSamplesMs.viewportRangeCalculation.push(rangeElapsedMs)
        phaseSamplesMs.rowModelViewportUpdate.push(viewportUpdateElapsedMs)
        phaseSamplesMs.renderedRangeAccess.push(rangeAccessElapsedMs)
        phaseSamplesMs.logicalCellMaterialization.push(materializationElapsedMs)
        phaseSamplesMs.columnAccessValueResolution.push(materializationElapsedMs)
        phaseSamplesMs.selectionDecoratorReferenceGeometry.push(selectionDecoratorReferenceGeometryElapsedMs)
        addTiming(phaseTimingsMs, "viewportRangeCalculation", rangeElapsedMs)
        addTiming(phaseTimingsMs, "rowModelViewportUpdate", viewportUpdateElapsedMs)
        addTiming(phaseTimingsMs, "renderedRangeAccess", rangeAccessElapsedMs)
        addTiming(phaseTimingsMs, "logicalCellMaterialization", materializationElapsedMs)
        addTiming(phaseTimingsMs, "columnAccessValueResolution", materializationElapsedMs)
        addTiming(phaseTimingsMs, "selectionDecoratorReferenceGeometry", selectionDecoratorReferenceGeometryElapsedMs)
      }
    }
  } finally {
    recordMemory(phaseMemoryMb, "afterOperations")
    model.dispose()
    recordMemory(phaseMemoryMb, "afterDispose")
  }

  const elapsedMs = performance.now() - startedAt
  const heapEnd = await sampleHeapUsed()
  phaseMemoryMb.afterGc = toMb(heapEnd)
  return {
    seed,
    rowCount,
    columnCount: CLIENT_COLUMN_COUNT,
    elapsedMs,
    totalElapsedWithSetupMs:
      elapsedMs + (phaseTimingsMs.datasetGeneration ?? 0) + (phaseTimingsMs.rowModelCreation ?? 0),
    heapDeltaMb: toMb(heapEnd - heapStart),
    checksum,
    materializedCells,
    phaseTimingsMs,
    phaseSamplesMs,
    phaseMemoryMb,
    viewportCalculationSamplesMs,
    renderedRangeUpdateSamplesMs,
    viewportLatencySamplesMs,
    viewportCalculationMs: stats(viewportCalculationSamplesMs),
    renderedRangeUpdateMs: stats(renderedRangeUpdateSamplesMs),
    viewportLatencyMs: stats(viewportLatencySamplesMs),
  }
}

function createEnterpriseDataSource(totalRows, columnCount, seed, latencyMs) {
  const metrics = {
    requestCount: 0,
    requestedRows: 0,
    abortedRequests: 0,
  }
  return {
    metrics,
    dataSource: {
      async pull(request) {
        metrics.requestCount += 1
        if (latencyMs > 0) {
          await sleep(latencyMs)
        } else {
          await Promise.resolve()
        }
        if (request.signal.aborted) {
          metrics.abortedRequests += 1
          const error = new Error("Aborted")
          error.name = "AbortError"
          throw error
        }
        const start = Math.max(0, Math.trunc(request.range.start))
        const end = Math.max(start, Math.min(totalRows - 1, Math.trunc(request.range.end)))
        const rows = []
        for (let index = start; index <= end; index += 1) {
          metrics.requestedRows += 1
          rows.push({
            index,
            rowId: index,
            row: createEnterpriseRow(index, seed, Math.min(10, columnCount)),
          })
        }
        return { rows, total: totalRows }
      },
      subscribe() {
        return () => {}
      },
    },
  }
}

async function runServerViewportScrollScenario(createDataSourceBackedRowModel) {
  const runs = []
  for (const seed of BENCH_SEEDS) {
    for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
      await measureServerViewportSeed(createDataSourceBackedRowModel, seed + warmup + 2000, { warmupOnly: true })
    }
    runs.push(await measureServerViewportSeed(createDataSourceBackedRowModel, seed))
  }

  const aggregateCache = aggregateServerCache(runs)
  const report = createScenarioReport(
    "server-viewport-scroll",
    {
      seeds: BENCH_SEEDS,
      rowCount: SERVER_ROW_COUNT,
      columnCount: SERVER_COLUMN_COUNT,
      viewportRows: SERVER_VIEWPORT_ROWS,
      scrollIterations: SERVER_SCROLL_ITERATIONS,
      rowCacheLimit: SERVER_ROW_CACHE_LIMIT,
      deterministicLatencyMs: SERVER_LATENCY_MS,
      warmupRuns: BENCH_WARMUP_RUNS,
    },
    runs,
    {
      viewportLatencyMs: stats(runs.flatMap(run => run.viewportLatencySamplesMs)),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      heapDeltaMb: stats(runs.map(run => run.heapDeltaMb)),
      cacheHitRatioPct: aggregateCache.cacheHitRatioPct,
      requestCount: stats(runs.map(run => run.metrics.requestCount)),
      pullCoalesced: stats(runs.map(run => run.diagnostics.pullCoalesced)),
      pullDeferred: stats(runs.map(run => run.diagnostics.pullDeferred)),
      pullDropped: stats(runs.map(run => run.diagnostics.pullDropped)),
      rowCacheEvicted: stats(runs.map(run => run.diagnostics.rowCacheEvicted)),
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-server-viewport-scroll.json", report)
  return report
}

function aggregateServerCache(runs) {
  const hitRows = runs.reduce((sum, run) => sum + run.metrics.cacheHitRows, 0)
  const missRows = runs.reduce((sum, run) => sum + run.metrics.cacheMissRows, 0)
  return {
    cacheHitRows: hitRows,
    cacheMissRows: missRows,
    cacheHitRatioPct: ratioPct(hitRows, missRows),
  }
}

async function measureServerViewportSeed(createDataSourceBackedRowModel, seed, options = {}) {
  const source = createEnterpriseDataSource(SERVER_ROW_COUNT, SERVER_COLUMN_COUNT, seed, SERVER_LATENCY_MS)
  const model = createDataSourceBackedRowModel({
    dataSource: source.dataSource,
    initialTotal: SERVER_ROW_COUNT,
    rowCacheLimit: SERVER_ROW_CACHE_LIMIT,
  })
  const rng = createRng(seed)
  const viewportLatencySamplesMs = []
  const metrics = {
    cacheHitRows: 0,
    cacheMissRows: 0,
    requestCount: 0,
    requestedRows: 0,
    abortedRequests: 0,
  }
  let previousStart = 0
  let checksum = 0
  const heapStart = await sampleHeapUsed()
  const startedAt = performance.now()

  try {
    const iterations = options.warmupOnly ? Math.min(6, SERVER_SCROLL_ITERATIONS) : SERVER_SCROLL_ITERATIONS
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const localScroll = rng() < 0.7
      const delta = randomInt(rng, -SERVER_VIEWPORT_ROWS * 2, SERVER_VIEWPORT_ROWS * 2)
      const randomStart = randomInt(rng, 0, Math.max(0, SERVER_ROW_COUNT - SERVER_VIEWPORT_ROWS - 1))
      const nextStart = localScroll ? previousStart + delta : randomStart
      previousStart = Math.max(0, Math.min(Math.max(0, SERVER_ROW_COUNT - SERVER_VIEWPORT_ROWS - 1), nextStart))
      const range = normalizeRange(previousStart, SERVER_ROW_COUNT, SERVER_VIEWPORT_ROWS)
      const cachedBefore = model.getRowsInRange(range).length
      metrics.cacheHitRows += Math.min(SERVER_VIEWPORT_ROWS, cachedBefore)
      metrics.cacheMissRows += Math.max(0, SERVER_VIEWPORT_ROWS - cachedBefore)
      const opStartedAt = performance.now()
      model.setViewportRange(range)
      await maybeRefresh(model, "viewport-change")
      const rows = model.getRowsInRange(range)
      checksum = (checksum + materializeViewportCells(rows, SERVER_COLUMN_COUNT, seed)) % 2147483647
      if (!options.warmupOnly) {
        viewportLatencySamplesMs.push(performance.now() - opStartedAt)
      }
    }
  } finally {
    metrics.requestCount = source.metrics.requestCount
    metrics.requestedRows = source.metrics.requestedRows
    metrics.abortedRequests = source.metrics.abortedRequests
  }

  const diagnostics = model.getBackpressureDiagnostics()
  model.dispose()
  const heapEnd = await sampleHeapUsed()
  return {
    seed,
    elapsedMs: performance.now() - startedAt,
    heapDeltaMb: toMb(heapEnd - heapStart),
    checksum,
    metrics,
    diagnostics,
    viewportLatencySamplesMs,
    viewportLatencyMs: stats(viewportLatencySamplesMs),
    cacheHitRatioPct: ratioPct(metrics.cacheHitRows, metrics.cacheMissRows),
  }
}

async function runHighFrequencyUpdatesScenario(createClientRowModel) {
  const runs = []
  for (const seed of BENCH_SEEDS) {
    for (const rate of UPDATE_RATES) {
      for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
        await measureHighFrequencySeed(createClientRowModel, seed + warmup + 3000, rate, { warmupOnly: true })
      }
      runs.push(await measureHighFrequencySeed(createClientRowModel, seed, rate))
    }
  }

  const byRate = UPDATE_RATES.map(rate => {
    const rateRuns = runs.filter(run => run.updatesPerSecond === rate)
    return {
      updatesPerSecond: rate,
      updateRate: rate,
      totalUpdates: stats(rateRuns.map(run => run.totalUpdates)),
      batchesApplied: stats(rateRuns.map(run => run.batchesApplied)),
      patchTimeMs: stats(rateRuns.flatMap(run => run.patchSamplesMs)),
      patchLatencyMs: stats(rateRuns.flatMap(run => run.patchSamplesMs)),
      derivedInvalidationMs: stats(rateRuns.flatMap(run => run.derivedInvalidationSamplesMs)),
      operationLatencyMs: stats(rateRuns.flatMap(run => run.operationLatencySamplesMs)),
      elapsedMs: stats(rateRuns.map(run => run.elapsedMs)),
      updateThroughputPerSecond: stats(rateRuns.map(run => run.updateThroughputPerSecond)),
      cellUpdatesPerPatchCall: stats(rateRuns.map(run => run.cellUpdatesPerPatchCall)),
      rowPatchesPerBatch: stats(rateRuns.map(run => run.rowPatchesPerBatch)),
      heapDeltaMb: stats(rateRuns.map(run => run.heapDeltaMb)),
    }
  })

  const report = createScenarioReport(
    "high-frequency-updates",
    {
      seeds: BENCH_SEEDS,
      rowCount: UPDATE_ROW_COUNT,
      columnCount: UPDATE_COLUMN_COUNT,
      updateRates: UPDATE_RATES,
      updateWindowSeconds: UPDATE_WINDOW_SECONDS,
      batchesPerSecond: UPDATE_BATCHES_PER_SECOND,
      warmupRuns: BENCH_WARMUP_RUNS,
    },
    runs,
    {
      byRate,
      totalUpdates: stats(runs.map(run => run.totalUpdates)),
      updateRate: stats(runs.map(run => run.updateRate)),
      batchesApplied: stats(runs.map(run => run.batchesApplied)),
      patchTimeMs: stats(runs.flatMap(run => run.patchSamplesMs)),
      patchLatencyMs: stats(runs.flatMap(run => run.patchSamplesMs)),
      derivedInvalidationMs: stats(runs.flatMap(run => run.derivedInvalidationSamplesMs)),
      operationLatencyMs: stats(runs.flatMap(run => run.operationLatencySamplesMs)),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      updateThroughputPerSecond: stats(runs.map(run => run.updateThroughputPerSecond)),
      heapDeltaMb: stats(runs.map(run => run.heapDeltaMb)),
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-high-frequency-updates.json", report)
  return report
}

async function measureHighFrequencySeed(createClientRowModel, seed, updatesPerSecond, options = {}) {
  const rows = createEnterpriseRows(UPDATE_ROW_COUNT, seed, { physicalColumns: Math.min(10, UPDATE_COLUMN_COUNT) })
  const model = createClientRowModel({
    rows,
    resolveRowId: row => row.id,
    isolateInputRows: false,
    captureFormulaExplainDiagnostics: false,
    captureFormulaRowRecomputeDiagnostics: false,
  })
  const rng = createRng(seed + updatesPerSecond)
  model.setSortModel(buildSortModel(0))
  model.setFilterModel(buildFilterModel(0))
  model.getRowsInRange(normalizeRange(0, model.getRowCount(), Math.min(UPDATE_ROW_COUNT, 80)))

  const totalCellUpdates = Math.max(1, Math.round(updatesPerSecond * UPDATE_WINDOW_SECONDS))
  const batchCount = Math.max(1, Math.ceil(UPDATE_WINDOW_SECONDS * UPDATE_BATCHES_PER_SECOND))
  const updatesPerBatch = Math.max(1, Math.ceil(totalCellUpdates / batchCount))
  const patchSamplesMs = []
  const derivedInvalidationSamplesMs = []
  const operationLatencySamplesMs = []
  let patchCallCount = 0
  let rowPatchCount = 0
  let appliedCellUpdates = 0
  const heapStart = await sampleHeapUsed()
  const startedAt = performance.now()

  try {
    for (let batch = 0; batch < batchCount; batch += 1) {
      const cellBudget = Math.min(updatesPerBatch, totalCellUpdates - appliedCellUpdates)
      if (cellBudget <= 0) {
        break
      }
      const updates = createCellUpdateBatch(rng, UPDATE_ROW_COUNT, UPDATE_COLUMN_COUNT, cellBudget)
      const opStartedAt = performance.now()
      const patchStartedAt = performance.now()
      model.patchRows(updates, {
        recomputeSort: false,
        recomputeFilter: false,
        recomputeGroup: false,
        emit: false,
      })
      const patchElapsed = performance.now() - patchStartedAt
      const invalidationStartedAt = performance.now()
      await maybeRefresh(model, "reapply")
      const invalidationElapsed = performance.now() - invalidationStartedAt
      const range = normalizeRange(randomInt(rng, 0, UPDATE_ROW_COUNT - 1), model.getRowCount(), 80)
      model.setViewportRange(range)
      materializeViewportCells(model.getRowsInRange(range), Math.min(UPDATE_COLUMN_COUNT, 50), seed)
      if (!options.warmupOnly) {
        patchSamplesMs.push(patchElapsed)
        derivedInvalidationSamplesMs.push(invalidationElapsed)
        operationLatencySamplesMs.push(performance.now() - opStartedAt)
      }
      patchCallCount += 1
      rowPatchCount += updates.length
      appliedCellUpdates += cellBudget
    }
  } finally {
    model.dispose()
  }

  const elapsedMs = performance.now() - startedAt
  const heapEnd = await sampleHeapUsed()
  return {
    seed,
    updatesPerSecond,
    updateRate: updatesPerSecond,
    elapsedMs,
    heapDeltaMb: toMb(heapEnd - heapStart),
    totalUpdates: appliedCellUpdates,
    totalCellUpdates: appliedCellUpdates,
    batchesApplied: patchCallCount,
    patchCallCount,
    rowPatchCount,
    batchCount,
    cellUpdatesPerPatchCall: patchCallCount > 0 ? appliedCellUpdates / patchCallCount : 0,
    rowPatchesPerBatch: patchCallCount > 0 ? rowPatchCount / patchCallCount : 0,
    updateThroughputPerSecond: elapsedMs > 0 ? appliedCellUpdates / (elapsedMs / 1000) : 0,
    patchSamplesMs,
    derivedInvalidationSamplesMs,
    operationLatencySamplesMs,
    patchTimeMs: stats(patchSamplesMs),
    derivedInvalidationMs: stats(derivedInvalidationSamplesMs),
    operationLatencyMs: stats(operationLatencySamplesMs),
  }
}

function createCellUpdateBatch(rng, rowCount, columnCount, cellCount) {
  const byRow = new Map()
  for (let index = 0; index < cellCount; index += 1) {
    const rowId = randomInt(rng, 0, rowCount - 1)
    const column = randomInt(rng, 0, columnCount - 1)
    let data = byRow.get(rowId)
    if (!data) {
      data = { version: randomInt(rng, 1, 1000000) }
      byRow.set(rowId, data)
    }
    data[`c${column}`] = randomInt(rng, 0, 1000000)
    if (column % 7 === 0) {
      data.revenue = randomInt(rng, 100, 500000)
    }
    if (column % 11 === 0) {
      data.latency = randomInt(rng, 10, 3000)
    }
  }
  return Array.from(byRow, ([rowId, data]) => ({ rowId, data }))
}

async function runSortFilterComboScenario(createClientRowModel) {
  const runs = []
  for (const seed of BENCH_SEEDS) {
    for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
      await measureSortFilterSeed(createClientRowModel, seed + warmup + 4000, { warmupOnly: true })
    }
    runs.push(await measureSortFilterSeed(createClientRowModel, seed))
  }

  const aggregateCache = aggregateDerivedCache(runs.map(run => run.cacheDelta))
  const report = createScenarioReport(
    "sort-filter-combo",
    {
      seeds: BENCH_SEEDS,
      rowCount: SORT_FILTER_ROW_COUNT,
      columnCount: SORT_FILTER_COLUMN_COUNT,
      iterations: SORT_FILTER_ITERATIONS,
      viewportRows: SORT_FILTER_VIEWPORT_ROWS,
      activeFilters: 3,
      sortColumns: 3,
      warmupRuns: BENCH_WARMUP_RUNS,
    },
    runs,
    {
      filterTimeMs: stats(runs.flatMap(run => run.filterSamplesMs)),
      sortTimeMs: stats(runs.flatMap(run => run.sortSamplesMs)),
      comboTimeMs: stats(runs.flatMap(run => run.comboSamplesMs)),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      heapDeltaMb: stats(runs.map(run => run.heapDeltaMb)),
      cache: aggregateCache,
      lastProjectionStageTimes: runs.at(-1)?.lastProjectionStageTimes ?? {},
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-sort-filter-combo.json", report)
  return report
}

async function measureSortFilterSeed(createClientRowModel, seed, options = {}) {
  const heapStart = await sampleHeapUsed()
  const rows = createEnterpriseRows(SORT_FILTER_ROW_COUNT, seed, {
    physicalColumns: Math.min(10, SORT_FILTER_COLUMN_COUNT),
  })
  const model = createClientRowModel({
    rows,
    resolveRowId: row => row.id,
    isolateInputRows: false,
    captureFormulaExplainDiagnostics: false,
    captureFormulaRowRecomputeDiagnostics: false,
  })
  const filterSamplesMs = []
  const sortSamplesMs = []
  const comboSamplesMs = []
  const iterations = options.warmupOnly ? Math.min(2, SORT_FILTER_ITERATIONS) : SORT_FILTER_ITERATIONS
  const cacheBefore = model.getDerivedCacheDiagnostics()
  let checksum = 0
  const startedAt = performance.now()

  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      let started = performance.now()
      model.setFilterModel(buildFilterModel(iteration))
      checksum += materializeViewportCells(
        model.getRowsInRange(normalizeRange(0, model.getRowCount(), SORT_FILTER_VIEWPORT_ROWS)),
        SORT_FILTER_COLUMN_COUNT,
        seed,
      )
      if (!options.warmupOnly) {
        filterSamplesMs.push(performance.now() - started)
      }

      started = performance.now()
      model.setSortModel(buildSortModel(iteration))
      checksum += materializeViewportCells(
        model.getRowsInRange(normalizeRange(iteration * 13, model.getRowCount(), SORT_FILTER_VIEWPORT_ROWS)),
        SORT_FILTER_COLUMN_COUNT,
        seed,
      )
      if (!options.warmupOnly) {
        sortSamplesMs.push(performance.now() - started)
      }

      started = performance.now()
      if (typeof model.setSortAndFilterModel === "function") {
        model.setSortAndFilterModel({
          sortModel: buildSortModel(iteration + 1),
          filterModel: buildFilterModel(iteration + 1),
        })
      } else {
        model.setFilterModel(buildFilterModel(iteration + 1))
        model.setSortModel(buildSortModel(iteration + 1))
      }
      checksum += materializeViewportCells(
        model.getRowsInRange(normalizeRange(iteration * 31, model.getRowCount(), SORT_FILTER_VIEWPORT_ROWS)),
        SORT_FILTER_COLUMN_COUNT,
        seed,
      )
      if (!options.warmupOnly) {
        comboSamplesMs.push(performance.now() - started)
      }
    }
  } finally {
    // Keep diagnostics available until after the measured loop.
  }

  const cacheAfter = model.getDerivedCacheDiagnostics()
  const snapshot = model.getSnapshot()
  const lastProjectionStageTimes = summarizeStageTimes(snapshot.projection?.performance?.stageTimes)
  model.dispose()
  const heapEnd = await sampleHeapUsed()
  return {
    seed,
    elapsedMs: performance.now() - startedAt,
    heapDeltaMb: toMb(heapEnd - heapStart),
    checksum,
    filterSamplesMs,
    sortSamplesMs,
    comboSamplesMs,
    filterTimeMs: stats(filterSamplesMs),
    sortTimeMs: stats(sortSamplesMs),
    comboTimeMs: stats(comboSamplesMs),
    cacheDelta: diffDerivedCache(cacheBefore, cacheAfter),
    lastProjectionStageTimes,
  }
}

function aggregateDerivedCache(deltas) {
  const totals = deltas.reduce((acc, delta) => {
    for (const key of [
      "filterPredicateHits",
      "filterPredicateMisses",
      "sortValueHits",
      "sortValueMisses",
      "groupValueHits",
      "groupValueMisses",
      "sourceColumnCacheEvictions",
    ]) {
      acc[key] = (acc[key] ?? 0) + (delta[key] ?? 0)
    }
    acc.sourceColumnCacheSize = Math.max(acc.sourceColumnCacheSize ?? 0, delta.sourceColumnCacheSize ?? 0)
    return acc
  }, {})
  return {
    ...totals,
    filterHitRatePct: ratioPct(totals.filterPredicateHits ?? 0, totals.filterPredicateMisses ?? 0),
    sortHitRatePct: ratioPct(totals.sortValueHits ?? 0, totals.sortValueMisses ?? 0),
    groupHitRatePct: ratioPct(totals.groupValueHits ?? 0, totals.groupValueMisses ?? 0),
  }
}

const COPY_PASTE_FILL_PHASE_KEYS = [
  "datasetGeneration",
  "rowModelCreation",
  "copySourceRangeAccess",
  "copiedRangeCreation",
  "calculationSnapshotCreation",
  "historySnapshotSizeEstimate",
  "historySnapshotPush",
  "pastePayloadCreation",
  "pastePatchApplication",
  "fillPayloadCreation",
  "fillPatchApplication",
  "undoRollback",
]

const COPY_PASTE_FILL_MEMORY_PHASES = [
  ["datasetGeneration", "beforeSetup", "afterDatasetGeneration"],
  ["rowModelCreation", "afterDatasetGeneration", "afterRowModelCreation"],
  ["copiedRangeCreation", "afterRowModelCreation", "afterCopiedRangeCreation"],
  ["historySnapshot", "afterCopiedRangeCreation", "afterHistorySnapshot"],
  ["pastePayloadCreation", "afterHistorySnapshot", "afterPastePayloadCreation"],
  ["pastePatchApplication", "afterPastePayloadCreation", "afterPastePatchApplication"],
  ["fillPayloadCreation", "afterPastePatchApplication", "afterFillPayloadCreation"],
  ["fillPatchApplication", "afterFillPayloadCreation", "afterFillPatchApplication"],
  ["undoRollback", "afterFillPatchApplication", "afterUndoRollback"],
  ["dispose", "afterUndoRollback", "afterDispose"],
  ["postGcRetained", "beforeSetup", "afterGc"],
]

const COPY_PATCH_DIAGNOSTIC_PHASES = ["paste", "fill"]
const COPY_PATCH_DIAGNOSTIC_NUMERIC_KEYS = [
  "rowPatches",
  "changedCellFields",
  "uniqueChangedFields",
  "patchElapsedMs",
  "patchMsPerRow",
  "patchUsPerChangedCell",
  "rowNodeCloneCount",
  "rowDataCloneCount",
  "rowReferenceCloneCount",
  "missingPatchedRows",
  "eventCount",
  "projectionVersionDelta",
  "projectionRecomputeVersionDelta",
  "projectionHadActualRecompute",
  "projectionRecomputedStageCount",
  "projectionBlockedStageCount",
  "projectionStaleStageCountAfter",
  "rowIndexBytesDelta",
  "sortBufferBytesDelta",
]

const COPY_PATCH_DERIVED_CACHE_KEYS = [
  "filterPredicateHits",
  "filterPredicateMisses",
  "sortValueHits",
  "sortValueMisses",
  "groupValueHits",
  "groupValueMisses",
  "sourceColumnCacheEvictions",
]

function countPatchFields(updates) {
  const uniqueFields = new Set()
  let changedCellFields = 0
  for (const update of updates) {
    const data = update?.data
    if (!data || typeof data !== "object") {
      continue
    }
    for (const key of Object.keys(data)) {
      changedCellFields += 1
      uniqueFields.add(key)
    }
  }
  return {
    rowPatches: updates.length,
    changedCellFields,
    uniqueChangedFields: uniqueFields.size,
  }
}

function capturePatchRowReferences(model, updates) {
  const rowIds = new Set()
  let minRowId = Number.POSITIVE_INFINITY
  let maxRowId = Number.NEGATIVE_INFINITY
  let allNumericRowIds = true
  for (const update of updates) {
    rowIds.add(update.rowId)
    if (typeof update.rowId === "number" && Number.isFinite(update.rowId)) {
      minRowId = Math.min(minRowId, update.rowId)
      maxRowId = Math.max(maxRowId, update.rowId)
    } else {
      allNumericRowIds = false
    }
  }
  if (rowIds.size === 0) {
    return new Map()
  }
  const rows = allNumericRowIds
    ? model.getRowsInRange(normalizeRange(minRowId, model.getRowCount(), maxRowId - minRowId + 1))
    : model.getRowsInRange(normalizeRange(0, model.getRowCount(), model.getRowCount()))
  const references = new Map()
  for (const rowNode of rows) {
    if (rowIds.has(rowNode?.rowId)) {
      references.set(rowNode.rowId, {
        node: rowNode,
        data: rowNode.data,
        row: rowNode.row,
      })
    }
  }
  return references
}

function summarizePatchRowReferences(updates, before, after) {
  let rowNodeCloneCount = 0
  let rowDataCloneCount = 0
  let rowReferenceCloneCount = 0
  let missingPatchedRows = 0
  const seen = new Set()
  for (const update of updates) {
    if (seen.has(update.rowId)) {
      continue
    }
    seen.add(update.rowId)
    const beforeRef = before.get(update.rowId)
    const afterRef = after.get(update.rowId)
    if (!beforeRef || !afterRef) {
      missingPatchedRows += 1
      continue
    }
    if (beforeRef.node !== afterRef.node) {
      rowNodeCloneCount += 1
    }
    if (beforeRef.data !== afterRef.data) {
      rowDataCloneCount += 1
    }
    if (beforeRef.row !== afterRef.row) {
      rowReferenceCloneCount += 1
    }
  }
  return {
    rowNodeCloneCount,
    rowDataCloneCount,
    rowReferenceCloneCount,
    missingPatchedRows,
  }
}

function capturePatchProjectionDiagnostics(model) {
  const projection = model.getSnapshot?.().projection ?? null
  return {
    version: projection?.version ?? 0,
    recomputeVersion: projection?.recomputeVersion ?? 0,
    lastRecomputeHadActual: projection?.lastRecomputeHadActual === true,
    lastRecomputedStages: [...(projection?.lastRecomputedStages ?? [])],
    lastBlockedStages: [...(projection?.lastBlockedStages ?? [])],
    staleStages: [...(projection?.staleStages ?? [])],
    lastInvalidationReasons: [...(projection?.lastInvalidationReasons ?? [])],
    rowIndexBytes: projection?.memory?.rowIndexBytes ?? 0,
    sortBufferBytes: projection?.memory?.sortBufferBytes ?? 0,
  }
}

function summarizePatchProjectionDiagnostics(before, after) {
  return {
    projectionVersionDelta: after.version - before.version,
    projectionRecomputeVersionDelta: after.recomputeVersion - before.recomputeVersion,
    projectionHadActualRecompute: after.lastRecomputeHadActual ? 1 : 0,
    projectionRecomputedStageCount: after.lastRecomputedStages.length,
    projectionBlockedStageCount: after.lastBlockedStages.length,
    projectionStaleStageCountAfter: after.staleStages.length,
    rowIndexBytesDelta: after.rowIndexBytes - before.rowIndexBytes,
    sortBufferBytesDelta: after.sortBufferBytes - before.sortBufferBytes,
    projectionLastInvalidationReasons: after.lastInvalidationReasons,
    projectionLastRecomputedStages: after.lastRecomputedStages,
    projectionLastBlockedStages: after.lastBlockedStages,
    projectionStaleStagesAfter: after.staleStages,
  }
}

function captureDerivedCacheDiagnostics(model) {
  return typeof model.getDerivedCacheDiagnostics === "function"
    ? model.getDerivedCacheDiagnostics()
    : null
}

function diffDerivedCacheDiagnostics(before, after) {
  if (!before || !after) {
    return Object.fromEntries(COPY_PATCH_DERIVED_CACHE_KEYS.map(key => [key, 0]))
  }
  return diffDerivedCache(before, after)
}

function createPatchApplicationDiagnostics(input) {
  const patchShape = countPatchFields(input.updates)
  const rowReferenceSummary = summarizePatchRowReferences(
    input.updates,
    input.rowReferencesBefore,
    input.rowReferencesAfter,
  )
  return {
    ...patchShape,
    ...rowReferenceSummary,
    patchElapsedMs: input.elapsedMs,
    patchMsPerRow: patchShape.rowPatches > 0 ? input.elapsedMs / patchShape.rowPatches : 0,
    patchUsPerChangedCell: patchShape.changedCellFields > 0
      ? (input.elapsedMs * 1000) / patchShape.changedCellFields
      : 0,
    eventCount: input.eventCount,
    ...summarizePatchProjectionDiagnostics(input.projectionBefore, input.projectionAfter),
    derivedCacheDelta: diffDerivedCacheDiagnostics(input.derivedCacheBefore, input.derivedCacheAfter),
  }
}

function aggregateCopyPatchDiagnostics(runs) {
  return Object.fromEntries(
    COPY_PATCH_DIAGNOSTIC_PHASES.map(phase => {
      const diagnostics = runs.map(run => run.patchDiagnostics?.[phase]).filter(Boolean)
      return [
        phase,
        {
          ...Object.fromEntries(
            COPY_PATCH_DIAGNOSTIC_NUMERIC_KEYS.map(key => [
              key,
              stats(diagnostics.map(entry => entry[key] ?? 0)),
            ]),
          ),
          derivedCacheDelta: Object.fromEntries(
            COPY_PATCH_DERIVED_CACHE_KEYS.map(key => [
              key,
              stats(diagnostics.map(entry => entry.derivedCacheDelta?.[key] ?? 0)),
            ]),
          ),
        },
      ]
    }),
  )
}

async function runCopyPasteFillScenario(createClientRowModel) {
  const runs = []
  for (const seed of BENCH_SEEDS) {
    for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
      await measureCopyPasteFillSeed(createClientRowModel, seed + warmup + 5000, { warmupOnly: true })
    }
    runs.push(await measureCopyPasteFillSeed(createClientRowModel, seed))
  }
  const report = createScenarioReport(
    "copy-paste-fill",
    {
      seeds: BENCH_SEEDS,
      rowCount: COPY_ROW_COUNT,
      columnCount: COPY_COLUMN_COUNT,
      copyRows: COPY_ROWS,
      copyColumns: COPY_COLUMNS,
      fillRows: FILL_ROWS,
      fillColumns: FILL_COLUMNS,
      warmupRuns: BENCH_WARMUP_RUNS,
    },
    runs,
    {
      copyLatencyMs: stats(runs.map(run => run.copyLatencyMs)),
      pasteLatencyMs: stats(runs.map(run => run.pasteLatencyMs)),
      fillLatencyMs: stats(runs.map(run => run.fillLatencyMs)),
      undoLatencyMs: stats(runs.map(run => run.undoLatencyMs)),
      historySnapshotSizeBytes: stats(runs.map(run => run.historySnapshotSizeBytes)),
      phaseTimingsMs: aggregatePhaseTimings(runs, COPY_PASTE_FILL_PHASE_KEYS),
      phaseMemoryDeltaMb: aggregatePhaseMemoryDeltas(runs, COPY_PASTE_FILL_MEMORY_PHASES),
      patchDiagnostics: aggregateCopyPatchDiagnostics(runs),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      heapDeltaMb: stats(runs.map(run => run.heapDeltaMb)),
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-copy-paste-fill.json", report)
  return report
}

async function measureCopyPasteFillSeed(createClientRowModel, seed, options = {}) {
  const heapStart = await sampleHeapUsed()
  const phaseTimingsMs = {}
  const phaseMemoryMb = {
    beforeSetup: toMb(heapStart),
  }
  const rows = measurePhase(phaseTimingsMs, "datasetGeneration", () =>
    createEnterpriseRows(COPY_ROW_COUNT, seed, { physicalColumns: Math.min(20, COPY_COLUMN_COUNT) }),
  )
  recordMemory(phaseMemoryMb, "afterDatasetGeneration")
  const model = measurePhase(phaseTimingsMs, "rowModelCreation", () =>
    createClientRowModel({
      rows,
      resolveRowId: row => row.id,
      isolateInputRows: false,
      captureFormulaExplainDiagnostics: false,
      captureFormulaRowRecomputeDiagnostics: false,
    }),
  )
  recordMemory(phaseMemoryMb, "afterRowModelCreation")
  const startedAt = performance.now()
  const patchDiagnostics = {}
  const patchEventCounts = { paste: 0, fill: 0 }
  let activePatchEventPhase = null
  const unsubscribePatchListener = typeof model.subscribe === "function"
    ? model.subscribe(() => {
      if (activePatchEventPhase && Object.prototype.hasOwnProperty.call(patchEventCounts, activePatchEventPhase)) {
        patchEventCounts[activePatchEventPhase] += 1
      }
    })
    : null

  const copied = []
  const sourceRows = measurePhase(phaseTimingsMs, "copySourceRangeAccess", () =>
    model.getRowsInRange(normalizeRange(0, COPY_ROW_COUNT, COPY_ROWS)),
  )
  measurePhase(phaseTimingsMs, "copiedRangeCreation", () => {
    for (let rowIndex = 0; rowIndex < Math.min(COPY_ROWS, sourceRows.length); rowIndex += 1) {
      const row = sourceRows[rowIndex]?.row
      const values = new Array(COPY_COLUMNS)
      for (let column = 0; column < COPY_COLUMNS; column += 1) {
        values[column] = readCell(row, column, seed)
      }
      copied.push(values)
    }
  })
  recordMemory(phaseMemoryMb, "afterCopiedRangeCreation")
  const copyLatencyMs =
    (phaseTimingsMs.copySourceRangeAccess ?? 0) + (phaseTimingsMs.copiedRangeCreation ?? 0)

  const snapshot = measurePhase(phaseTimingsMs, "calculationSnapshotCreation", () =>
    typeof model.createCalculationSnapshot === "function" ? model.createCalculationSnapshot() : null,
  )
  const historySnapshotSizeBytes = measurePhase(phaseTimingsMs, "historySnapshotSizeEstimate", () =>
    snapshot ? estimateJsonBytes(snapshot) : 0,
  )
  measurePhase(phaseTimingsMs, "historySnapshotPush", () => {
    if (typeof model.pushCalculationSnapshot === "function") {
      model.pushCalculationSnapshot("enterprise-copy-paste-fill")
    }
  })
  recordMemory(phaseMemoryMb, "afterHistorySnapshot")

  const pasteUpdates = []
  measurePhase(phaseTimingsMs, "pastePayloadCreation", () => {
    const pasteStartRow = Math.min(COPY_ROW_COUNT - 1, Math.max(0, Math.floor(COPY_ROW_COUNT / 3)))
    for (let rowOffset = 0; rowOffset < copied.length; rowOffset += 1) {
      const data = {}
      for (let column = 0; column < COPY_COLUMNS; column += 1) {
        data[`c${column}`] = copied[rowOffset]?.[column] ?? 0
      }
      pasteUpdates.push({ rowId: pasteStartRow + rowOffset, data })
    }
  })
  recordMemory(phaseMemoryMb, "afterPastePayloadCreation")
  const pasteRowReferencesBefore = capturePatchRowReferences(model, pasteUpdates)
  const pasteProjectionBefore = capturePatchProjectionDiagnostics(model)
  const pasteDerivedCacheBefore = captureDerivedCacheDiagnostics(model)
  const pastePatchStartedAt = performance.now()
  activePatchEventPhase = "paste"
  try {
    model.patchRows(pasteUpdates, {
      recomputeSort: false,
      recomputeFilter: false,
      recomputeGroup: false,
      emit: false,
    })
  } finally {
    activePatchEventPhase = null
  }
  const pastePatchApplicationMs = performance.now() - pastePatchStartedAt
  addTiming(phaseTimingsMs, "pastePatchApplication", pastePatchApplicationMs)
  patchDiagnostics.paste = createPatchApplicationDiagnostics({
    updates: pasteUpdates,
    elapsedMs: pastePatchApplicationMs,
    rowReferencesBefore: pasteRowReferencesBefore,
    rowReferencesAfter: capturePatchRowReferences(model, pasteUpdates),
    projectionBefore: pasteProjectionBefore,
    projectionAfter: capturePatchProjectionDiagnostics(model),
    derivedCacheBefore: pasteDerivedCacheBefore,
    derivedCacheAfter: captureDerivedCacheDiagnostics(model),
    eventCount: patchEventCounts.paste,
  })
  recordMemory(phaseMemoryMb, "afterPastePatchApplication")
  const pasteLatencyMs =
    (phaseTimingsMs.pastePayloadCreation ?? 0) + (phaseTimingsMs.pastePatchApplication ?? 0)

  const fillUpdates = []
  const pasteStartRow = Math.min(COPY_ROW_COUNT - 1, Math.max(0, Math.floor(COPY_ROW_COUNT / 3)))
  const fillStartRow = Math.min(COPY_ROW_COUNT - 1, pasteStartRow + copied.length + 10)
  const fillLimit = Math.min(FILL_ROWS, Math.max(0, COPY_ROW_COUNT - fillStartRow))
  measurePhase(phaseTimingsMs, "fillPayloadCreation", () => {
    for (let rowOffset = 0; rowOffset < fillLimit; rowOffset += 1) {
      const data = {}
      for (let column = 0; column < FILL_COLUMNS; column += 1) {
        data[`c${column}`] = (copied[rowOffset % Math.max(1, copied.length)]?.[column] ?? 0) + rowOffset
      }
      fillUpdates.push({ rowId: fillStartRow + rowOffset, data })
    }
  })
  recordMemory(phaseMemoryMb, "afterFillPayloadCreation")
  const fillRowReferencesBefore = capturePatchRowReferences(model, fillUpdates)
  const fillProjectionBefore = capturePatchProjectionDiagnostics(model)
  const fillDerivedCacheBefore = captureDerivedCacheDiagnostics(model)
  const fillPatchStartedAt = performance.now()
  activePatchEventPhase = "fill"
  try {
    model.patchRows(fillUpdates, {
      recomputeSort: false,
      recomputeFilter: false,
      recomputeGroup: false,
      emit: false,
    })
  } finally {
    activePatchEventPhase = null
  }
  const fillPatchApplicationMs = performance.now() - fillPatchStartedAt
  addTiming(phaseTimingsMs, "fillPatchApplication", fillPatchApplicationMs)
  patchDiagnostics.fill = createPatchApplicationDiagnostics({
    updates: fillUpdates,
    elapsedMs: fillPatchApplicationMs,
    rowReferencesBefore: fillRowReferencesBefore,
    rowReferencesAfter: capturePatchRowReferences(model, fillUpdates),
    projectionBefore: fillProjectionBefore,
    projectionAfter: capturePatchProjectionDiagnostics(model),
    derivedCacheBefore: fillDerivedCacheBefore,
    derivedCacheAfter: captureDerivedCacheDiagnostics(model),
    eventCount: patchEventCounts.fill,
  })
  recordMemory(phaseMemoryMb, "afterFillPatchApplication")
  const fillLatencyMs =
    (phaseTimingsMs.fillPayloadCreation ?? 0) + (phaseTimingsMs.fillPatchApplication ?? 0)

  let undoSupported = false
  let undoLatencyMs = 0
  measurePhase(phaseTimingsMs, "undoRollback", () => {
    if (!options.warmupOnly && typeof model.undoCalculationSnapshot === "function") {
      const undoStartedAt = performance.now()
      undoSupported = model.undoCalculationSnapshot() === true
      undoLatencyMs = performance.now() - undoStartedAt
    }
  })
  recordMemory(phaseMemoryMb, "afterUndoRollback")

  unsubscribePatchListener?.()
  model.dispose()
  recordMemory(phaseMemoryMb, "afterDispose")
  const heapEnd = await sampleHeapUsed()
  phaseMemoryMb.afterGc = toMb(heapEnd)
  return {
    seed,
    elapsedMs: performance.now() - startedAt,
    heapDeltaMb: toMb(heapEnd - heapStart),
    copyLatencyMs,
    pasteLatencyMs,
    fillLatencyMs,
    undoLatencyMs,
    undoSupported,
    copiedCells: copied.length * COPY_COLUMNS,
    pastedCells: pasteUpdates.length * COPY_COLUMNS,
    filledCells: fillUpdates.length * FILL_COLUMNS,
    pasteRowPatches: pasteUpdates.length,
    fillRowPatches: fillUpdates.length,
    historySnapshotSizeBytes,
    patchDiagnostics,
    phaseTimingsMs,
    phaseMemoryMb,
  }
}

const PIVOT_TREE_PHASE_KEYS = [
  "pivotSourceGeneration",
  "pivotRowModelCreation",
  "treeRowModelCreation",
  "treeKeySampling",
  "pivotProjectionRebuild",
  "pivotViewportRangeUpdate",
  "pivotMaterialization",
  "pivotPatchApplication",
  "pivotPatchSnapshot",
  "treeExpandCollapse",
  "treeMaterialization",
  "groupedFilterProjection",
  "groupedSortProjection",
  "groupedViewportMaterialization",
]

const PIVOT_TREE_SAMPLE_KEYS = [
  "pivotProjectionRebuild",
  "pivotViewportRangeUpdate",
  "pivotMaterialization",
  "pivotPatchApplication",
  "pivotPatchSnapshot",
  "treeExpandCollapse",
  "treeMaterialization",
  "groupedFilterProjection",
  "groupedSortProjection",
  "groupedViewportMaterialization",
]

const PIVOT_TREE_MEMORY_PHASES = [
  ["pivotSourceGeneration", "beforeSetup", "afterPivotSourceGeneration"],
  ["pivotRowModelCreation", "afterPivotSourceGeneration", "afterPivotRowModelCreation"],
  ["treeRowModelCreation", "afterPivotRowModelCreation", "afterTreeRowModelCreation"],
  ["operations", "afterTreeRowModelCreation", "afterOperations"],
  ["dispose", "afterOperations", "afterDispose"],
  ["postGcRetained", "beforeSetup", "afterGc"],
]

async function runPivotTreeWorkloadScenario(createClientRowModel) {
  const runs = []
  for (const seed of BENCH_SEEDS) {
    for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
      await measurePivotTreeSeed(createClientRowModel, seed + warmup + 6000, { warmupOnly: true })
    }
    runs.push(await measurePivotTreeSeed(createClientRowModel, seed))
  }
  const report = createScenarioReport(
    "pivot-tree-workload",
    {
      seeds: BENCH_SEEDS,
      rowCount: PIVOT_TREE_ROW_COUNT,
      viewportRows: PIVOT_TREE_VIEWPORT_ROWS,
      iterations: PIVOT_TREE_ITERATIONS,
      warmupRuns: BENCH_WARMUP_RUNS,
    },
    runs,
    {
      pivotRebuildMs: stats(runs.flatMap(run => run.pivotRebuildSamplesMs)),
      pivotPatchMs: stats(runs.flatMap(run => run.pivotPatchSamplesMs)),
      treeToggleMs: stats(runs.flatMap(run => run.treeToggleSamplesMs)),
      groupedFilterSortViewportMs: stats(runs.flatMap(run => run.groupedFilterSortSamplesMs)),
      phaseTimingsMs: aggregatePhaseTimings(runs, PIVOT_TREE_PHASE_KEYS),
      phaseSamplesMs: aggregatePhaseSamples(runs, PIVOT_TREE_SAMPLE_KEYS),
      phaseMemoryDeltaMb: aggregatePhaseMemoryDeltas(runs, PIVOT_TREE_MEMORY_PHASES),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      heapDeltaMb: stats(runs.map(run => run.heapDeltaMb)),
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-pivot-tree-workload.json", report)
  return report
}

async function measurePivotTreeSeed(createClientRowModel, seed, options = {}) {
  const heapStart = await sampleHeapUsed()
  const phaseTimingsMs = {}
  const phaseMemoryMb = {
    beforeSetup: toMb(heapStart),
  }
  const rows = measurePhase(phaseTimingsMs, "pivotSourceGeneration", () =>
    createEnterpriseRows(PIVOT_TREE_ROW_COUNT, seed, { physicalColumns: 10 }),
  )
  recordMemory(phaseMemoryMb, "afterPivotSourceGeneration")
  const pivotModelPrimary = {
    rows: ["region", "team"],
    columns: ["year", "quarter"],
    values: [{ field: "revenue", agg: "sum" }, { field: "orders", agg: "count" }],
  }
  const pivotModelAlt = {
    rows: ["team"],
    columns: ["status"],
    values: [{ field: "latency", agg: "avg" }, { field: "score", agg: "max" }],
  }
  const pivotModel = measurePhase(phaseTimingsMs, "pivotRowModelCreation", () =>
    createClientRowModel({
      rows,
      resolveRowId: row => row.id,
      isolateInputRows: false,
      captureFormulaExplainDiagnostics: false,
      captureFormulaRowRecomputeDiagnostics: false,
    }),
  )
  recordMemory(phaseMemoryMb, "afterPivotRowModelCreation")
  const treeModel = measurePhase(phaseTimingsMs, "treeRowModelCreation", () =>
    createClientRowModel({
      rows,
      resolveRowId: row => row.id,
      isolateInputRows: false,
      initialTreeData: {
        mode: "path",
        getDataPath: row => [row.treeA, row.treeB, row.treeC],
        expandedByDefault: false,
        dependencyFields: ["treeA", "treeB", "treeC", "revenue", "orders"],
      },
      initialAggregationModel: {
        columns: [
          { key: "revenue", field: "revenue", op: "sum" },
          { key: "orders", field: "orders", op: "sum" },
        ],
      },
      captureFormulaExplainDiagnostics: false,
      captureFormulaRowRecomputeDiagnostics: false,
    }),
  )
  recordMemory(phaseMemoryMb, "afterTreeRowModelCreation")
  const rng = createRng(seed)
  const pivotRebuildSamplesMs = []
  const pivotPatchSamplesMs = []
  const treeToggleSamplesMs = []
  const groupedFilterSortSamplesMs = []
  const phaseSamplesMs = {
    pivotProjectionRebuild: [],
    pivotViewportRangeUpdate: [],
    pivotMaterialization: [],
    pivotPatchApplication: [],
    pivotPatchSnapshot: [],
    treeExpandCollapse: [],
    treeMaterialization: [],
    groupedFilterProjection: [],
    groupedSortProjection: [],
    groupedViewportMaterialization: [],
  }
  let checksum = 0
  const startedAt = performance.now()

  try {
    const iterations = options.warmupOnly ? Math.min(2, PIVOT_TREE_ITERATIONS) : PIVOT_TREE_ITERATIONS
    const treeKeys = measurePhase(phaseTimingsMs, "treeKeySampling", () =>
      sampleTreeGroupKeys(treeModel, PIVOT_TREE_VIEWPORT_ROWS),
    )
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      let started = performance.now()
      let phaseStartedAt = performance.now()
      pivotModel.setPivotModel(iteration % 2 === 0 ? pivotModelPrimary : pivotModelAlt)
      const pivotProjectionRebuildElapsedMs = performance.now() - phaseStartedAt
      const pivotRange = normalizeRange(iteration * 17, Math.max(1, pivotModel.getRowCount()), PIVOT_TREE_VIEWPORT_ROWS)
      phaseStartedAt = performance.now()
      pivotModel.setViewportRange(pivotRange)
      const pivotViewportRangeUpdateElapsedMs = performance.now() - phaseStartedAt
      phaseStartedAt = performance.now()
      checksum += materializeViewportCells(pivotModel.getRowsInRange(pivotRange), 20, seed)
      const pivotMaterializationElapsedMs = performance.now() - phaseStartedAt
      if (!options.warmupOnly) {
        pivotRebuildSamplesMs.push(performance.now() - started)
        phaseSamplesMs.pivotProjectionRebuild.push(pivotProjectionRebuildElapsedMs)
        phaseSamplesMs.pivotViewportRangeUpdate.push(pivotViewportRangeUpdateElapsedMs)
        phaseSamplesMs.pivotMaterialization.push(pivotMaterializationElapsedMs)
        addTiming(phaseTimingsMs, "pivotProjectionRebuild", pivotProjectionRebuildElapsedMs)
        addTiming(phaseTimingsMs, "pivotViewportRangeUpdate", pivotViewportRangeUpdateElapsedMs)
        addTiming(phaseTimingsMs, "pivotMaterialization", pivotMaterializationElapsedMs)
      }

      started = performance.now()
      phaseStartedAt = performance.now()
      pivotModel.patchRows(createCellUpdateBatch(rng, PIVOT_TREE_ROW_COUNT, 8, 8), {
        recomputeSort: false,
        recomputeFilter: false,
        recomputeGroup: true,
        emit: false,
      })
      const pivotPatchApplicationElapsedMs = performance.now() - phaseStartedAt
      phaseStartedAt = performance.now()
      checksum += pivotModel.getSnapshot().pivotColumns?.length ?? 0
      const pivotPatchSnapshotElapsedMs = performance.now() - phaseStartedAt
      if (!options.warmupOnly) {
        pivotPatchSamplesMs.push(performance.now() - started)
        phaseSamplesMs.pivotPatchApplication.push(pivotPatchApplicationElapsedMs)
        phaseSamplesMs.pivotPatchSnapshot.push(pivotPatchSnapshotElapsedMs)
        addTiming(phaseTimingsMs, "pivotPatchApplication", pivotPatchApplicationElapsedMs)
        addTiming(phaseTimingsMs, "pivotPatchSnapshot", pivotPatchSnapshotElapsedMs)
      }

      started = performance.now()
      const key = treeKeys[iteration % Math.max(1, treeKeys.length)]
      phaseStartedAt = performance.now()
      if (key) {
        treeModel.toggleGroup(key)
      }
      const treeExpandCollapseElapsedMs = performance.now() - phaseStartedAt
      const treeRange = normalizeRange(iteration * 11, Math.max(1, treeModel.getRowCount()), PIVOT_TREE_VIEWPORT_ROWS)
      phaseStartedAt = performance.now()
      checksum += materializeViewportCells(treeModel.getRowsInRange(treeRange), 20, seed)
      const treeMaterializationElapsedMs = performance.now() - phaseStartedAt
      if (!options.warmupOnly) {
        treeToggleSamplesMs.push(performance.now() - started)
        phaseSamplesMs.treeExpandCollapse.push(treeExpandCollapseElapsedMs)
        phaseSamplesMs.treeMaterialization.push(treeMaterializationElapsedMs)
        addTiming(phaseTimingsMs, "treeExpandCollapse", treeExpandCollapseElapsedMs)
        addTiming(phaseTimingsMs, "treeMaterialization", treeMaterializationElapsedMs)
      }

      started = performance.now()
      phaseStartedAt = performance.now()
      treeModel.setFilterModel(buildFilterModel(iteration))
      const groupedFilterProjectionElapsedMs = performance.now() - phaseStartedAt
      phaseStartedAt = performance.now()
      treeModel.setSortModel(buildSortModel(iteration))
      const groupedSortProjectionElapsedMs = performance.now() - phaseStartedAt
      const groupedRange = normalizeRange(iteration * 7, Math.max(1, treeModel.getRowCount()), PIVOT_TREE_VIEWPORT_ROWS)
      phaseStartedAt = performance.now()
      checksum += materializeViewportCells(treeModel.getRowsInRange(groupedRange), 20, seed)
      const groupedViewportMaterializationElapsedMs = performance.now() - phaseStartedAt
      if (!options.warmupOnly) {
        groupedFilterSortSamplesMs.push(performance.now() - started)
        phaseSamplesMs.groupedFilterProjection.push(groupedFilterProjectionElapsedMs)
        phaseSamplesMs.groupedSortProjection.push(groupedSortProjectionElapsedMs)
        phaseSamplesMs.groupedViewportMaterialization.push(groupedViewportMaterializationElapsedMs)
        addTiming(phaseTimingsMs, "groupedFilterProjection", groupedFilterProjectionElapsedMs)
        addTiming(phaseTimingsMs, "groupedSortProjection", groupedSortProjectionElapsedMs)
        addTiming(phaseTimingsMs, "groupedViewportMaterialization", groupedViewportMaterializationElapsedMs)
      }
    }
  } finally {
    recordMemory(phaseMemoryMb, "afterOperations")
    pivotModel.dispose()
    treeModel.dispose()
    recordMemory(phaseMemoryMb, "afterDispose")
  }

  const heapEnd = await sampleHeapUsed()
  phaseMemoryMb.afterGc = toMb(heapEnd)
  return {
    seed,
    elapsedMs: performance.now() - startedAt,
    heapDeltaMb: toMb(heapEnd - heapStart),
    checksum,
    phaseTimingsMs,
    phaseSamplesMs,
    phaseMemoryMb,
    pivotRebuildSamplesMs,
    pivotPatchSamplesMs,
    treeToggleSamplesMs,
    groupedFilterSortSamplesMs,
    pivotRebuildMs: stats(pivotRebuildSamplesMs),
    pivotPatchMs: stats(pivotPatchSamplesMs),
    treeToggleMs: stats(treeToggleSamplesMs),
    groupedFilterSortViewportMs: stats(groupedFilterSortSamplesMs),
  }
}

function sampleTreeGroupKeys(model, viewportRows) {
  const keys = []
  const range = normalizeRange(0, Math.max(1, model.getRowCount()), viewportRows * 4)
  const rows = model.getRowsInRange(range)
  for (const row of rows) {
    const key = row?.groupMeta?.groupKey
    if (typeof key === "string" && key.length > 0) {
      keys.push(key)
    }
  }
  return keys.slice(0, 64)
}

async function runMemoryLeakSoakScenario(createClientRowModel, createDataSourceBackedRowModel, selection) {
  const runs = []
  for (const seed of BENCH_SEEDS) {
    runs.push(await measureSoakSeed(createClientRowModel, createDataSourceBackedRowModel, selection, seed))
  }
  const heapTrends = runs.map(run => run.heapTrend)
  const budgetErrors = []
  if (PERF_BUDGET_MAX_SOAK_HEAP_GROWTH_MB !== Number.POSITIVE_INFINITY) {
    for (const run of runs) {
      if (
        run.heapTrend.continuousGrowth &&
        run.heapTrend.deltaMb > PERF_BUDGET_MAX_SOAK_HEAP_GROWTH_MB + PERF_BUDGET_SOAK_HEAP_EPSILON_MB
      ) {
        budgetErrors.push(
          `seed ${run.seed}: heap grew ${run.heapTrend.deltaMb.toFixed(2)}MB continuously; max ${PERF_BUDGET_MAX_SOAK_HEAP_GROWTH_MB}MB`,
        )
      }
    }
  }

  const report = createScenarioReport(
    "memory-leak-soak",
    {
      seeds: BENCH_SEEDS,
      rowCount: SOAK_ROW_COUNT,
      columnCount: SOAK_COLUMN_COUNT,
      durationSeconds: SOAK_SECONDS,
      heapSampleSeconds: SOAK_HEAP_SAMPLE_SECONDS,
      editBatchSize: SOAK_EDIT_BATCH_SIZE,
      viewportRows: SOAK_VIEWPORT_ROWS,
      serverLatencyMs: SOAK_SERVER_LATENCY_MS,
      maxHeapGrowthMb: PERF_BUDGET_MAX_SOAK_HEAP_GROWTH_MB,
    },
    runs,
    {
      operationLatencyMs: stats(runs.flatMap(run => run.operationSamplesMs)),
      elapsedMs: stats(runs.map(run => run.elapsedMs)),
      heapDeltaMb: stats(heapTrends.map(trend => trend.deltaMb)),
      heapSlopeMbPerMinute: stats(heapTrends.map(trend => trend.slopeMbPerMinute)),
      serverRefreshCount: stats(runs.map(run => run.operationCounts.serverRefresh)),
      coalescedOperations: stats(runs.map(run => run.serverDiagnostics.pullCoalesced)),
      deferredOperations: stats(runs.map(run => run.serverDiagnostics.pullDeferred)),
      droppedOperations: stats(runs.map(run => run.serverDiagnostics.pullDropped)),
    },
    {
      budgetErrors,
      ok: budgetErrors.length === 0,
    },
  )
  report.path = await writeScenarioReport("bench-datagrid-enterprise-memory-leak-soak.json", report)
  if (budgetErrors.length > 0) {
    throw new Error(`memory-leak-soak budget failed:\n${budgetErrors.join("\n")}`)
  }
  return report
}

async function measureSoakSeed(createClientRowModel, createDataSourceBackedRowModel, selection, seed) {
  const rows = createEnterpriseRows(SOAK_ROW_COUNT, seed, { physicalColumns: Math.min(10, SOAK_COLUMN_COUNT) })
  const clientModel = createClientRowModel({
    rows,
    resolveRowId: row => row.id,
    isolateInputRows: false,
    captureFormulaExplainDiagnostics: false,
    captureFormulaRowRecomputeDiagnostics: false,
  })
  const source = createEnterpriseDataSource(SOAK_ROW_COUNT, SOAK_COLUMN_COUNT, seed, SOAK_SERVER_LATENCY_MS)
  const serverModel = createDataSourceBackedRowModel({
    dataSource: source.dataSource,
    initialTotal: SOAK_ROW_COUNT,
    rowCacheLimit: Math.min(4096, Math.max(512, SOAK_ROW_COUNT)),
  })
  const rng = createRng(seed)
  const operationSamplesMs = []
  const heapSamples = []
  const operationCounts = {
    scroll: 0,
    filter: 0,
    sort: 0,
    editBatch: 0,
    selection: 0,
    serverRefresh: 0,
  }
  const heapStart = await sampleHeapUsed()
  heapSamples.push({ elapsedSeconds: 0, heapMb: toMb(heapStart) })
  const startedAt = performance.now()
  let nextHeapSampleAt = startedAt + SOAK_HEAP_SAMPLE_SECONDS * 1000
  let operationIndex = 0

  try {
    while ((performance.now() - startedAt) / 1000 < SOAK_SECONDS) {
      const opStartedAt = performance.now()
      const opType = operationIndex % 6
      if (opType === 0) {
        const range = normalizeRange(randomInt(rng, 0, SOAK_ROW_COUNT - 1), clientModel.getRowCount(), SOAK_VIEWPORT_ROWS)
        clientModel.setViewportRange(range)
        materializeViewportCells(clientModel.getRowsInRange(range), SOAK_COLUMN_COUNT, seed)
        operationCounts.scroll += 1
      } else if (opType === 1) {
        clientModel.setFilterModel(buildFilterModel(operationIndex))
        clientModel.getRowsInRange(normalizeRange(0, Math.max(1, clientModel.getRowCount()), SOAK_VIEWPORT_ROWS))
        operationCounts.filter += 1
      } else if (opType === 2) {
        clientModel.setSortModel(buildSortModel(operationIndex))
        clientModel.getRowsInRange(normalizeRange(0, Math.max(1, clientModel.getRowCount()), SOAK_VIEWPORT_ROWS))
        operationCounts.sort += 1
      } else if (opType === 3) {
        clientModel.patchRows(createCellUpdateBatch(rng, SOAK_ROW_COUNT, SOAK_COLUMN_COUNT, SOAK_EDIT_BATCH_SIZE), {
          recomputeSort: false,
          recomputeFilter: false,
          recomputeGroup: false,
          emit: false,
        })
        await maybeRefresh(clientModel, "reapply")
        operationCounts.editBatch += 1
      } else if (opType === 4) {
        runSelectionOperation(clientModel, selection, SOAK_COLUMN_COUNT, rng)
        operationCounts.selection += 1
      } else {
        const range = normalizeRange(randomInt(rng, 0, SOAK_ROW_COUNT - 1), SOAK_ROW_COUNT, SOAK_VIEWPORT_ROWS)
        serverModel.setViewportRange(range)
        await maybeRefresh(serverModel, "viewport-change")
        serverModel.getRowsInRange(range)
        operationCounts.serverRefresh += 1
      }
      operationSamplesMs.push(performance.now() - opStartedAt)
      operationIndex += 1

      if (performance.now() >= nextHeapSampleAt) {
        const heapUsed = await sampleHeapUsed()
        heapSamples.push({
          elapsedSeconds: (performance.now() - startedAt) / 1000,
          heapMb: toMb(heapUsed),
        })
        nextHeapSampleAt += SOAK_HEAP_SAMPLE_SECONDS * 1000
      }
    }
  } finally {
    // Capture diagnostics before disposal clears transient state.
  }

  const heapEnd = await sampleHeapUsed()
  heapSamples.push({
    elapsedSeconds: (performance.now() - startedAt) / 1000,
    heapMb: toMb(heapEnd),
  })
  const serverDiagnostics = serverModel.getBackpressureDiagnostics()
  clientModel.dispose()
  serverModel.dispose()
  const elapsedMs = performance.now() - startedAt
  const heapTrend = computeHeapTrend(heapSamples)
  return {
    seed,
    elapsedMs,
    operationCounts,
    operationSamplesMs,
    operationLatencyMs: stats(operationSamplesMs),
    heapSamples,
    heapTrend,
    serverMetrics: source.metrics,
    serverDiagnostics,
  }
}

function runSelectionOperation(model, selection, columnCount, rng) {
  const rows = model.getRowsInRange(normalizeRange(0, Math.max(1, model.getRowCount()), SOAK_VIEWPORT_ROWS))
  const flattenedRows = rows.map(row => ({
    rowId: row.rowId,
    isGroup: row.kind === "group",
    level: row.groupMeta?.level ?? 0,
  }))
  if (
    typeof selection?.createGridSelectionContextFromFlattenedRows === "function" &&
    typeof selection?.createGridSelectionRange === "function"
  ) {
    const context = selection.createGridSelectionContextFromFlattenedRows({
      rows: flattenedRows,
      colCount: columnCount,
    })
    return selection.createGridSelectionRange(
      { rowIndex: randomInt(rng, 0, Math.max(0, flattenedRows.length - 1)), colIndex: randomInt(rng, 0, columnCount - 1) },
      { rowIndex: randomInt(rng, 0, Math.max(0, flattenedRows.length - 1)), colIndex: randomInt(rng, 0, columnCount - 1) },
      context,
    )
  }
  return {
    startRow: 0,
    endRow: Math.max(0, flattenedRows.length - 1),
    startCol: 0,
    endCol: Math.max(0, columnCount - 1),
  }
}

function computeHeapTrend(samples) {
  if (samples.length < 2) {
    return {
      deltaMb: 0,
      peakMb: samples[0]?.heapMb ?? 0,
      slopeMbPerMinute: 0,
      continuousGrowth: false,
      continuousGrowthWindows: 0,
    }
  }
  const first = samples[0]
  const last = samples[samples.length - 1]
  let continuousGrowthWindows = 0
  let currentGrowthRun = 0
  for (let index = 1; index < samples.length; index += 1) {
    if ((samples[index]?.heapMb ?? 0) > (samples[index - 1]?.heapMb ?? 0) + PERF_BUDGET_SOAK_HEAP_EPSILON_MB) {
      currentGrowthRun += 1
      continuousGrowthWindows = Math.max(continuousGrowthWindows, currentGrowthRun)
    } else {
      currentGrowthRun = 0
    }
  }
  const elapsedMinutes = Math.max(1 / 60, ((last.elapsedSeconds ?? 0) - (first.elapsedSeconds ?? 0)) / 60)
  const deltaMb = (last.heapMb ?? 0) - (first.heapMb ?? 0)
  return {
    deltaMb,
    peakMb: samples.reduce((max, sample) => Math.max(max, sample.heapMb), Number.NEGATIVE_INFINITY),
    slopeMbPerMinute: deltaMb / elapsedMinutes,
    continuousGrowth: continuousGrowthWindows >= Math.max(2, samples.length - 2),
    continuousGrowthWindows,
  }
}

function createCombinedSummary(scenarioReports, startedAt) {
  const elapsedValues = scenarioReports.map(report => report.aggregate?.elapsedMs?.p50 ?? 0)
  const heapValues = scenarioReports.map(report => report.aggregate?.heapDeltaMb?.p50 ?? 0)
  const scenarioSummaries = Object.fromEntries(
    scenarioReports.map(report => [
      report.benchmark.replace("datagrid-enterprise-", ""),
      {
        path: report.path,
        ok: report.ok,
        elapsedMs: report.aggregate?.elapsedMs ?? null,
        heapDeltaMb: report.aggregate?.heapDeltaMb ?? null,
      },
    ]),
  )
  return {
    benchmark: "datagrid-enterprise-workloads",
    generatedAt: new Date().toISOString(),
    observationMode: true,
    profile: PROFILE,
    baselinePolicy: {
      status: "observation",
      requiredLocalRuns: 3,
      requiredCiRuns: 3,
      localBaselinePath: "docs/perf/datagrid-enterprise-workload-baseline.local.json",
      ciBaselinePath: "docs/perf/datagrid-enterprise-workload-baseline.ci.json",
      note: "No hard drift thresholds are enforced until local and CI baselines are captured separately.",
    },
    config: {
      seeds: BENCH_SEEDS,
      warmupRuns: BENCH_WARMUP_RUNS,
      outputDir: OUTPUT_DIR,
    },
    aggregate: {
      elapsedMs: stats(elapsedValues),
      heapDeltaMb: stats(heapValues),
      totalWallTimeMs: performance.now() - startedAt,
    },
    scenarios: scenarioSummaries,
    reports: scenarioReports.map(report => report.path),
    budgetErrors: scenarioReports.flatMap(report => report.budgetErrors ?? []),
    ok: scenarioReports.every(report => report.ok !== false),
  }
}

const startedAt = performance.now()
mkdirSync(OUTPUT_DIR, { recursive: true })
const core = await loadDatagridCore()

console.log("\nAffino DataGrid Enterprise Workloads Benchmark")
console.log(`profile=${PROFILE} seeds=${BENCH_SEEDS.join(",")} observationMode=true`)

const scenarioReports = []

console.log("[enterprise] client-viewport-scroll...")
scenarioReports.push(await runClientViewportScrollScenario(core.createClientRowModel))

console.log("[enterprise] server-viewport-scroll...")
scenarioReports.push(await runServerViewportScrollScenario(core.createDataSourceBackedRowModel))

console.log("[enterprise] high-frequency-updates...")
scenarioReports.push(await runHighFrequencyUpdatesScenario(core.createClientRowModel))

console.log("[enterprise] sort-filter-combo...")
scenarioReports.push(await runSortFilterComboScenario(core.createClientRowModel))

console.log("[enterprise] copy-paste-fill...")
scenarioReports.push(await runCopyPasteFillScenario(core.createClientRowModel))

console.log("[enterprise] pivot-tree-workload...")
scenarioReports.push(await runPivotTreeWorkloadScenario(core.createClientRowModel))

console.log("[enterprise] memory-leak-soak...")
scenarioReports.push(
  await runMemoryLeakSoakScenario(core.createClientRowModel, core.createDataSourceBackedRowModel, core.selection),
)

const summary = createCombinedSummary(scenarioReports, startedAt)
writeFileSync(OUTPUT_JSON, JSON.stringify(summary, null, 2))

console.log(`\nEnterprise benchmark summary written: ${OUTPUT_JSON}`)
console.log(`scenario reports: ${scenarioReports.length}`)
console.log(`total wall time: ${summary.aggregate.totalWallTimeMs.toFixed(2)}ms`)

if (!summary.ok) {
  console.error("\nEnterprise benchmark observation failed:")
  for (const error of summary.budgetErrors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}
