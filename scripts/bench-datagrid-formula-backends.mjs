#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const BENCH_SEED = Number.parseInt(process.env.BENCH_SEED ?? "1337", 10)
const BENCH_SEEDS = (process.env.BENCH_SEEDS ?? `${BENCH_SEED}`)
  .split(",")
  .map(value => Number.parseInt(value.trim(), 10))
  .filter(value => Number.isFinite(value) && value > 0)
const BENCH_ROW_COUNT = Number.parseInt(process.env.BENCH_FORMULA_BACKEND_ROWS ?? "100000", 10)
const BENCH_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_BACKEND_ITERATIONS ?? "7", 10)
const BENCH_WARMUP_RUNS = Number.parseInt(process.env.BENCH_FORMULA_BACKEND_WARMUP_RUNS ?? "1", 10)
const BENCH_COMPILE_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_BACKEND_COMPILE_ITERATIONS ?? "5", 10)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-formula-backends.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-formula-backends.md",
)
const PERF_BUDGET_TOTAL_MS = Number.parseFloat(process.env.PERF_BUDGET_TOTAL_MS ?? "Infinity")
const PERF_BUDGET_MAX_HEAP_DELTA_MB = Number.parseFloat(process.env.PERF_BUDGET_MAX_HEAP_DELTA_MB ?? "Infinity")

const MODE_CANDIDATES = Object.freeze([
  {
    targetMode: "columnar-fused",
    label: "fused",
    compileStrategy: "jit",
    formulas: [
      "price * qty + tax",
      "price * qty + tax + fee",
      "(price * qty) + tax - fee",
    ],
  },
  {
    targetMode: "columnar-jit",
    label: "jit",
    compileStrategy: "jit",
    formulas: [
      "SUM(price, qty, tax)",
      "ROUND(price) + ABS(tax)",
      "MAX(price, qty, tax) - MIN(price, qty, tax)",
      "COALESCE(primary, fallback)",
    ],
  },
  {
    targetMode: "columnar-vector",
    label: "vector",
    compileStrategy: "ast",
    formulas: [
      "IF(qty == 0, 0, price / qty)",
      "COALESCE(primary, fallback, 10 / qty)",
      "IFS(qty == 0, 0, qty < 3, price, price / qty)",
    ],
  },
  {
    targetMode: "columnar-ast",
    label: "ast",
    compileStrategy: "ast",
    formulas: [
      "SUM(price, qty, tax)",
      "MAX(price, qty, tax)",
      "MIN(price, qty, tax) + shipping",
    ],
  },
])

assertPositiveInteger(BENCH_ROW_COUNT, "BENCH_FORMULA_BACKEND_ROWS")
assertPositiveInteger(BENCH_ITERATIONS, "BENCH_FORMULA_BACKEND_ITERATIONS")
assertNonNegativeInteger(BENCH_WARMUP_RUNS, "BENCH_FORMULA_BACKEND_WARMUP_RUNS")
assertPositiveInteger(BENCH_COMPILE_ITERATIONS, "BENCH_FORMULA_BACKEND_COMPILE_ITERATIONS")
if (BENCH_SEEDS.length === 0) {
  throw new Error("BENCH_SEEDS must include at least one positive integer")
}

function assertPositiveInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

function resolveScenarioBudget(baseKey, scenarioLabel, fallback = Number.POSITIVE_INFINITY) {
  const key = `${baseKey}_${scenarioLabel.toUpperCase()}`
  const raw = process.env[key]
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback
  }
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function quantile(values, q) {
  if (!values.length) {
    return 0
  }
  const sorted = [...values].sort((left, right) => left - right)
  const position = Math.max(0, Math.min(1, q)) * (sorted.length - 1)
  const base = Math.floor(position)
  const rest = position - base
  const current = sorted[base] ?? 0
  const next = sorted[base + 1] ?? current
  return current + (next - current) * rest
}

function stats(values) {
  if (!values.length) {
    return {
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      stdev: 0,
      cvPct: 0,
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const stdev = Math.sqrt(variance)
  return {
    mean,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    min: Math.min(...values),
    max: Math.max(...values),
    stdev,
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

async function loadFormulaApi() {
  const candidates = [
    resolve("packages/datagrid-formula-engine/dist/index.js"),
    resolve("packages/datagrid-formula-engine/dist/src/index.js"),
  ]

  let lastError = null
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    try {
      const module = await import(pathToFileURL(candidate).href)
      if (typeof module.compileDataGridFormulaFieldDefinition === "function") {
        return {
          compileDataGridFormulaFieldDefinition: module.compileDataGridFormulaFieldDefinition,
        }
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw new Error(`Failed to load formula engine dist: ${String(lastError)}`)
  }
  throw new Error(
    "Unable to locate datagrid-formula-engine build artifacts. Run `pnpm --filter @affino/datagrid-formula-engine build`.",
  )
}

function buildContexts(rowCount) {
  return Array.from({ length: rowCount }, (_, index) => ({
    row: {},
    rowId: `r${index + 1}`,
    sourceIndex: index,
  }))
}

function buildColumns(rowCount, rng) {
  const fields = {
    price: new Array(rowCount),
    qty: new Array(rowCount),
    tax: new Array(rowCount),
    shipping: new Array(rowCount),
    fee: new Array(rowCount),
    primary: new Array(rowCount),
    fallback: new Array(rowCount),
  }

  for (let index = 0; index < rowCount; index += 1) {
    const qty = index % 17 === 0 ? 0 : 1 + Math.floor(rng() * 8)
    fields.price[index] = 10 + rng() * 500
    fields.qty[index] = qty
    fields.tax[index] = rng() * 20
    fields.shipping[index] = rng() * 50
    fields.fee[index] = rng() * 5
    fields.primary[index] = index % 5 === 0 ? null : (index % 7 === 0 ? 0 : 5 + rng() * 50)
    fields.fallback[index] = index % 3 === 0 ? 1 + rng() * 25 : null
  }

  return fields
}

function createTokenColumnsForCompiled(compiled, columnsByField) {
  return compiled.identifiers.map((identifier) => {
    const column = columnsByField[identifier]
    if (!column) {
      throw new Error(`Missing synthetic token column for identifier: ${identifier}`)
    }
    return column
  })
}

function checksumValues(values) {
  let checksum = 0
  for (const value of values) {
    if (Array.isArray(value)) {
      checksum += value.length
      continue
    }
    if (typeof value === "number") {
      checksum += value
      continue
    }
    if (typeof value === "string") {
      checksum += value.length
      continue
    }
    if (typeof value === "boolean") {
      checksum += value ? 1 : 0
      continue
    }
    if (value && typeof value === "object" && "code" in value) {
      checksum += 13
      continue
    }
  }
  return checksum
}

function pickBackendScenario(api) {
  const scenarios = []
  for (const modeConfig of MODE_CANDIDATES) {
    let matched = null
    let lastMode = null
    for (const formula of modeConfig.formulas) {
      const compiled = api.compileDataGridFormulaFieldDefinition({
        name: `${modeConfig.label}Bench`,
        formula,
      }, {
        compileStrategy: modeConfig.compileStrategy,
        runtimeErrorPolicy: "coerce-zero",
      })
      lastMode = compiled.batchExecutionMode ?? null
      if (compiled.batchExecutionMode === modeConfig.targetMode && typeof compiled.computeBatchColumnar === "function") {
        matched = {
          ...modeConfig,
          formula,
          compiled,
        }
        break
      }
    }
    if (!matched) {
      throw new Error(
        `Unable to resolve backend scenario for ${modeConfig.targetMode}. Last observed mode: ${String(lastMode)}`,
      )
    }
    scenarios.push(matched)
  }
  return scenarios
}

async function benchmarkSeed(seed, api) {
  const rng = createRng(seed)
  const contexts = buildContexts(BENCH_ROW_COUNT)
  const columnsByField = buildColumns(BENCH_ROW_COUNT, rng)
  const scenarios = pickBackendScenario(api)
  const heapBefore = await sampleHeapUsed()

  const results = []
  for (const scenario of scenarios) {
    const compileDurations = []
    for (let iteration = 0; iteration < BENCH_COMPILE_ITERATIONS; iteration += 1) {
      const compileStart = performance.now()
      api.compileDataGridFormulaFieldDefinition({
        name: `${scenario.label}CompileProbe`,
        formula: scenario.formula,
      }, {
        compileStrategy: scenario.compileStrategy,
        runtimeErrorPolicy: "coerce-zero",
      })
      compileDurations.push(performance.now() - compileStart)
    }

    const tokenColumns = createTokenColumnsForCompiled(scenario.compiled, columnsByField)

    for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
      scenario.compiled.computeBatchColumnar(contexts, tokenColumns)
    }

    const computeDurations = []
    const checksums = []
    for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
      const computeStart = performance.now()
      const values = scenario.compiled.computeBatchColumnar(contexts, tokenColumns)
      computeDurations.push(performance.now() - computeStart)
      checksums.push(checksumValues(values))
    }

    const computeStats = stats(computeDurations)
    const compileStats = stats(compileDurations)
    const evaluations = BENCH_ROW_COUNT
    results.push({
      label: scenario.label,
      targetMode: scenario.targetMode,
      actualMode: scenario.compiled.batchExecutionMode ?? null,
      compileStrategy: scenario.compileStrategy,
      formula: scenario.formula,
      identifiers: scenario.compiled.identifiers,
      deps: scenario.compiled.deps,
      compileMs: compileStats,
      computeMs: computeStats,
      evaluations,
      evalsPerSec: computeStats.mean === 0 ? 0 : evaluations / (computeStats.mean / 1000),
      checksum: checksums.at(-1) ?? 0,
    })
  }

  const heapAfter = await sampleHeapUsed()
  return {
    seed,
    rowCount: BENCH_ROW_COUNT,
    heapDeltaMb: (heapAfter - heapBefore) / (1024 * 1024),
    scenarios: results,
  }
}

function aggregateSeedRuns(seedRuns) {
  const byLabel = new Map()
  for (const run of seedRuns) {
    for (const scenario of run.scenarios) {
      const bucket = byLabel.get(scenario.label) ?? {
        targetMode: scenario.targetMode,
        actualMode: scenario.actualMode,
        compileStrategy: scenario.compileStrategy,
        formula: scenario.formula,
        compileMeans: [],
        computeMeans: [],
        evalsPerSec: [],
        heapDeltas: [],
        checksums: new Set(),
      }
      bucket.compileMeans.push(scenario.compileMs.mean)
      bucket.computeMeans.push(scenario.computeMs.mean)
      bucket.evalsPerSec.push(scenario.evalsPerSec)
      bucket.heapDeltas.push(run.heapDeltaMb)
      bucket.checksums.add(String(scenario.checksum))
      byLabel.set(scenario.label, bucket)
    }
  }

  return Array.from(byLabel.entries())
    .map(([label, bucket]) => ({
      label,
      targetMode: bucket.targetMode,
      actualMode: bucket.actualMode,
      compileStrategy: bucket.compileStrategy,
      formula: bucket.formula,
      compileMs: stats(bucket.compileMeans),
      computeMs: stats(bucket.computeMeans),
      evalsPerSec: stats(bucket.evalsPerSec),
      heapDeltaMb: stats(bucket.heapDeltas),
      checksumVariants: Array.from(bucket.checksums),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function formatMs(value) {
  return `${value.toFixed(3)}ms`
}

function formatRate(value) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M/s`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k/s`
  }
  return `${value.toFixed(0)}/s`
}

function formatMb(value) {
  return `${value.toFixed(2)}MB`
}

function renderMarkdown(report) {
  const lines = [
    "# DataGrid Formula Backend Benchmark",
    "",
    `Benchmark status: ${report.status}`,
    "",
    `rows=${report.rowCount} iterations=${BENCH_ITERATIONS} warmup=${BENCH_WARMUP_RUNS} seeds=${BENCH_SEEDS.join(",")}`,
    "",
    "| backend | mode | strategy | compile mean | compute mean | compute p95 | eval/s | heap delta mean | formula |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ]

  for (const scenario of report.aggregate.scenarios) {
    lines.push(
      `| ${scenario.label} | ${scenario.actualMode ?? "n/a"} | ${scenario.compileStrategy} | ${formatMs(scenario.compileMs.mean)} | ${formatMs(scenario.computeMs.mean)} | ${formatMs(scenario.computeMs.p95)} | ${formatRate(scenario.evalsPerSec.mean)} | ${formatMb(scenario.heapDeltaMb.mean)} | \`${scenario.formula}\` |`,
    )
  }

  if (report.failures.length > 0) {
    lines.push("", "## Failed checks", "")
    for (const failure of report.failures) {
      lines.push(`- ${failure}`)
    }
  }

  lines.push("", "## Seeds", "")
  for (const seedRun of report.seedRuns) {
    lines.push(`### Seed ${seedRun.seed}`, "")
    for (const scenario of seedRun.scenarios) {
      lines.push(
        `- ${scenario.label}: mode=${scenario.actualMode ?? "n/a"}, compute=${formatMs(scenario.computeMs.mean)}, eval/s=${formatRate(scenario.evalsPerSec)}, checksum=${scenario.checksum.toFixed(3)}`,
      )
    }
    lines.push(`- heap delta: ${formatMb(seedRun.heapDeltaMb)}`, "")
  }

  return `${lines.join("\n")}\n`
}

function collectFailures(report, elapsedMs) {
  const failures = []
  if (Number.isFinite(PERF_BUDGET_TOTAL_MS) && elapsedMs > PERF_BUDGET_TOTAL_MS) {
    failures.push(`aggregate elapsed ${elapsedMs.toFixed(2)}ms exceeds budget ${PERF_BUDGET_TOTAL_MS}ms`)
  }

  for (const scenario of report.aggregate.scenarios) {
    if (scenario.actualMode !== scenario.targetMode) {
      failures.push(`backend ${scenario.label} resolved mode ${String(scenario.actualMode)} instead of ${scenario.targetMode}`)
    }

    const maxComputeP95 = resolveScenarioBudget("PERF_BUDGET_MAX_COMPUTE_P95_MS", scenario.label)
    if (Number.isFinite(maxComputeP95) && scenario.computeMs.p95 > maxComputeP95) {
      failures.push(
        `backend ${scenario.label} compute p95 ${scenario.computeMs.p95.toFixed(3)}ms exceeds budget ${maxComputeP95}ms`,
      )
    }

    const minEvalsPerSec = resolveScenarioBudget("PERF_BUDGET_MIN_EVALS_PER_SEC", scenario.label, 0)
    if (scenario.evalsPerSec.mean < minEvalsPerSec) {
      failures.push(
        `backend ${scenario.label} eval/s ${scenario.evalsPerSec.mean.toFixed(0)} below budget ${minEvalsPerSec.toFixed(0)}`,
      )
    }

    if (Number.isFinite(PERF_BUDGET_MAX_HEAP_DELTA_MB) && scenario.heapDeltaMb.mean > PERF_BUDGET_MAX_HEAP_DELTA_MB) {
      failures.push(
        `backend ${scenario.label} heap delta ${scenario.heapDeltaMb.mean.toFixed(2)}MB exceeds budget ${PERF_BUDGET_MAX_HEAP_DELTA_MB}MB`,
      )
    }
  }

  return failures
}

const api = await loadFormulaApi()
const benchStart = performance.now()
const seedRuns = []
for (const seed of BENCH_SEEDS) {
  const run = await benchmarkSeed(seed, api)
  seedRuns.push(run)
  console.log(`seed=${seed} rows=${run.rowCount}`)
  for (const scenario of run.scenarios) {
    console.log(
      `  backend=${scenario.label} mode=${scenario.actualMode} compile=${formatMs(scenario.compileMs.mean)} compute=${formatMs(scenario.computeMs.mean)} eval/s=${formatRate(scenario.evalsPerSec)}`,
    )
  }
  console.log(`  heapDelta=${formatMb(run.heapDeltaMb)}`)
}

const report = {
  generatedAt: new Date().toISOString(),
  rowCount: BENCH_ROW_COUNT,
  iterations: BENCH_ITERATIONS,
  warmupRuns: BENCH_WARMUP_RUNS,
  compileIterations: BENCH_COMPILE_ITERATIONS,
  seeds: BENCH_SEEDS,
  seedRuns,
  aggregate: {
    scenarios: aggregateSeedRuns(seedRuns),
  },
}
const elapsedMs = performance.now() - benchStart
const failures = collectFailures(report, elapsedMs)
report.elapsedMs = elapsedMs
report.failures = failures
report.status = failures.length === 0 ? "OK" : "FAILED"

mkdirSync(dirname(BENCH_OUTPUT_JSON), { recursive: true })
writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
mkdirSync(dirname(BENCH_OUTPUT_MARKDOWN), { recursive: true })
writeFileSync(BENCH_OUTPUT_MARKDOWN, renderMarkdown(report))

console.log(`status: ${report.status}`)
if (failures.length > 0) {
  console.log("failed checks:")
  for (const failure of failures) {
    console.log(`- ${failure}`)
  }
}
console.log(`json: ${BENCH_OUTPUT_JSON}`)
console.log(`markdown: ${BENCH_OUTPUT_MARKDOWN}`)

if (failures.length > 0) {
  process.exitCode = 1
}
