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
const BENCH_WARMUP_RUNS = Number.parseInt(process.env.BENCH_WARMUP_RUNS ?? "0", 10)
const BENCH_FULL_RECOMPUTE_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_FULL_RECOMPUTE_ITERATIONS ?? "5", 10)
const BENCH_PATCH_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_PATCH_ITERATIONS ?? "5", 10)
const BENCH_COMPILE_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_COMPILE_ITERATIONS ?? "3", 10)
const BENCH_PATCH_SIZES = (process.env.BENCH_FORMULA_PATCH_SIZES ?? "1,100,1000")
  .split(",")
  .map(value => Number.parseInt(value.trim(), 10))
  .filter(value => Number.isFinite(value) && value > 0)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-formula-engine.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-formula-engine.md",
)

const PERF_BUDGET_TOTAL_MS = Number.parseFloat(process.env.PERF_BUDGET_TOTAL_MS ?? "Infinity")
const PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_PATCH_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_PATCH_P95_MS ?? "Infinity")
const PERF_BUDGET_MIN_FULL_EVALS_PER_SEC = Number.parseFloat(process.env.PERF_BUDGET_MIN_FULL_EVALS_PER_SEC ?? "0")
const PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC = Number.parseFloat(
  process.env.PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC ?? "0",
)
const PERF_BUDGET_INCREMENTAL_PATCH_SIZE = Number.parseInt(
  process.env.PERF_BUDGET_INCREMENTAL_PATCH_SIZE
    ?? `${Math.max(...BENCH_PATCH_SIZES)}`,
  10,
)
const PERF_BUDGET_MAX_HEAP_DELTA_MB = Number.parseFloat(process.env.PERF_BUDGET_MAX_HEAP_DELTA_MB ?? "Infinity")
const PERF_BUDGET_HEAP_EPSILON_MB = Number.parseFloat(process.env.PERF_BUDGET_HEAP_EPSILON_MB ?? "1")
const PERF_BUDGET_MAX_VARIANCE_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_VARIANCE_PCT ?? "Infinity")
const PERF_BUDGET_VARIANCE_MIN_MEAN_MS = Number.parseFloat(process.env.PERF_BUDGET_VARIANCE_MIN_MEAN_MS ?? "0.5")

const SCENARIO_PRESETS = Object.freeze({
  small: { rows: 10_000, formulas: 10, depth: 2 },
  medium: { rows: 50_000, formulas: 20, depth: 3 },
  large: { rows: 100_000, formulas: 40, depth: 4 },
  extreme: { rows: 250_000, formulas: 60, depth: 6 },
})

const BENCH_SCENARIOS = (process.env.BENCH_FORMULA_SCENARIOS ?? "small,medium,large,extreme")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(value => value.length > 0 && value in SCENARIO_PRESETS)
const BENCH_DAG_SHAPES = (process.env.BENCH_FORMULA_DAG_SHAPES ?? "uniform")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(value => value.length > 0 && [
    "uniform",
    "fanout",
    "chain",
    "random",
  ].includes(value))

assertPositiveInteger(BENCH_FULL_RECOMPUTE_ITERATIONS, "BENCH_FORMULA_FULL_RECOMPUTE_ITERATIONS")
assertPositiveInteger(BENCH_PATCH_ITERATIONS, "BENCH_FORMULA_PATCH_ITERATIONS")
assertPositiveInteger(BENCH_COMPILE_ITERATIONS, "BENCH_FORMULA_COMPILE_ITERATIONS")
assertPositiveInteger(PERF_BUDGET_INCREMENTAL_PATCH_SIZE, "PERF_BUDGET_INCREMENTAL_PATCH_SIZE")
assertNonNegativeInteger(BENCH_WARMUP_RUNS, "BENCH_WARMUP_RUNS")
if (BENCH_PATCH_SIZES.length === 0) {
  throw new Error("BENCH_FORMULA_PATCH_SIZES must include at least one positive integer.")
}
if (BENCH_SEEDS.length === 0) {
  throw new Error("BENCH_SEEDS must include at least one positive integer.")
}
if (BENCH_SCENARIOS.length === 0) {
  throw new Error("BENCH_FORMULA_SCENARIOS resolved to an empty scenario set.")
}
if (BENCH_DAG_SHAPES.length === 0) {
  throw new Error("BENCH_FORMULA_DAG_SHAPES resolved to an empty DAG shape set.")
}

const BASE_FIELDS = Object.freeze([
  "price",
  "qty",
  "taxRate",
  "shipping",
  "discount",
  "fee",
  "orders",
  "returns",
])

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

function resolveScenarioBudget(baseKey, scenarioName, fallback = Number.POSITIVE_INFINITY) {
  const key = `${baseKey}_${scenarioName.toUpperCase()}`
  const raw = process.env[key]
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback
  }
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveScenarioPatchBudget(baseKey, options) {
  const {
    scenarioName,
    dagShape,
    patchSize,
    fallback = Number.NaN,
  } = options

  const candidates = [
    `${baseKey}_${String(scenarioName).toUpperCase()}_${String(dagShape).toUpperCase()}_PATCH_${patchSize}`,
    `${baseKey}_${String(scenarioName).toUpperCase()}_PATCH_${patchSize}`,
    `${baseKey}_PATCH_${patchSize}`,
  ]

  for (const key of candidates) {
    const raw = process.env[key]
    if (typeof raw !== "string" || raw.trim().length === 0) {
      continue
    }
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
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
      stdev: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      cvPct: 0,
      min: 0,
      max: 0,
    }
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

function cloneComputeDiagnostics(diagnostics) {
  if (!diagnostics || typeof diagnostics !== "object") {
    return null
  }
  return {
    strategy: diagnostics.strategy ?? null,
    rowsTouched: Number.isFinite(diagnostics.rowsTouched) ? Number(diagnostics.rowsTouched) : 0,
    changedRows: Number.isFinite(diagnostics.changedRows) ? Number(diagnostics.changedRows) : 0,
    evaluations: Number.isFinite(diagnostics.evaluations) ? Number(diagnostics.evaluations) : 0,
    skippedByObjectIs: Number.isFinite(diagnostics.skippedByObjectIs)
      ? Number(diagnostics.skippedByObjectIs)
      : 0,
    dirtyRows: Number.isFinite(diagnostics.dirtyRows) ? Number(diagnostics.dirtyRows) : 0,
    dirtyNodes: Array.isArray(diagnostics.dirtyNodes)
      ? diagnostics.dirtyNodes.map(value => String(value))
      : [],
    nodes: Array.isArray(diagnostics.nodes)
      ? diagnostics.nodes.map((node) => ({
        name: String(node?.name ?? ""),
        dirtyRows: Number.isFinite(node?.dirtyRows) ? Number(node.dirtyRows) : 0,
        evaluations: Number.isFinite(node?.evaluations) ? Number(node.evaluations) : 0,
        touched: node?.touched === true,
        dirty: node?.dirty === true,
      }))
      : [],
  }
}

function summarizeComputeDiagnostics(samples) {
  const validSamples = samples.filter(sample => sample !== null)
  const strategyCounts = {}
  const dirtyNodeSet = new Set()
  const hotNodeScores = new Map()

  for (const sample of validSamples) {
    const strategy = sample.strategy ?? "unknown"
    strategyCounts[strategy] = (strategyCounts[strategy] ?? 0) + 1
    for (const dirtyNode of sample.dirtyNodes) {
      dirtyNodeSet.add(dirtyNode)
    }
    for (const node of sample.nodes) {
      if (!node?.name) {
        continue
      }
      const current = hotNodeScores.get(node.name) ?? { evaluations: 0, dirtyRows: 0, touches: 0 }
      current.evaluations += node.evaluations
      current.dirtyRows += node.dirtyRows
      if (node.touched) {
        current.touches += 1
      }
      hotNodeScores.set(node.name, current)
    }
  }

  return {
    samples: validSamples.length,
    strategyCounts,
    rowsTouched: stats(validSamples.map(sample => sample.rowsTouched)),
    changedRows: stats(validSamples.map(sample => sample.changedRows)),
    skippedByObjectIs: stats(validSamples.map(sample => sample.skippedByObjectIs)),
    dirtyRows: stats(validSamples.map(sample => sample.dirtyRows)),
    dirtyNodes: Array.from(dirtyNodeSet).sort((left, right) => left.localeCompare(right)),
    hotNodes: Array.from(hotNodeScores.entries())
      .map(([name, score]) => ({
        name,
        evaluations: score.evaluations,
        dirtyRows: score.dirtyRows,
        touches: score.touches,
      }))
      .sort((left, right) => right.evaluations - left.evaluations || right.dirtyRows - left.dirtyRows)
      .slice(0, 8),
  }
}

function shouldEnforceVariance(stat) {
  return (
    PERF_BUDGET_MAX_VARIANCE_PCT !== Number.POSITIVE_INFINITY
    && stat.mean >= PERF_BUDGET_VARIANCE_MIN_MEAN_MS
  )
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
      if (
        typeof module.createClientRowModel === "function"
        && typeof module.compileDataGridFormulaFieldDefinition === "function"
      ) {
        return {
          createClientRowModel: module.createClientRowModel,
          compileDataGridFormulaFieldDefinition: module.compileDataGridFormulaFieldDefinition,
        }
      }
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw new Error(`Failed to load formula API from datagrid-core dist: ${String(lastError)}`)
  }
  throw new Error(
    "Unable to locate datagrid-core build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
  )
}

function buildRows(rowCount, rng) {
  const mutableRows = new Array(rowCount)
  const rowNodes = new Array(rowCount)
  for (let index = 0; index < rowCount; index += 1) {
    const row = {
      id: index + 1,
      price: 10 + rng() * 500,
      qty: 1 + Math.floor(rng() * 10),
      taxRate: 0.02 + rng() * 0.2,
      shipping: rng() * 50,
      discount: 0.5 + rng() * 0.5,
      fee: rng() * 5,
      orders: 10 + Math.floor(rng() * 500),
      returns: Math.floor(rng() * 10),
    }
    mutableRows[index] = row
    rowNodes[index] = {
      row: { ...row },
      rowId: row.id,
      originalIndex: index,
      displayIndex: index,
    }
  }
  return {
    mutableRows,
    rowNodes,
  }
}

function buildUniformFormulaDefinitions(formulaCount, requestedDepth) {
  const depth = Math.max(1, Math.min(requestedDepth, formulaCount))
  const levelCounts = new Array(depth).fill(0)
  for (let index = 0; index < formulaCount; index += 1) {
    levelCounts[index % depth] += 1
  }

  const levels = []
  const definitions = []
  let globalIndex = 0

  for (let levelIndex = 0; levelIndex < depth; levelIndex += 1) {
    const count = levelCounts[levelIndex] ?? 0
    const levelNames = []
    const previousLevel = levelIndex > 0 ? (levels[levelIndex - 1] ?? []) : []
    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const numericIndex = globalIndex + 1
      const name = `f${numericIndex}`
      const field = name
      let formula
      if (levelIndex === 0) {
        const variant = numericIndex % 5
        if (variant === 0) {
          formula = "price * qty"
        } else if (variant === 1) {
          formula = "price + shipping"
        } else if (variant === 2) {
          formula = "(price * discount) + fee"
        } else if (variant === 3) {
          formula = "orders - returns"
        } else {
          formula = "(qty * taxRate) + shipping"
        }
      } else {
        const parentName = previousLevel[localIndex % previousLevel.length]
        const baseField = BASE_FIELDS[(numericIndex + levelIndex) % BASE_FIELDS.length]
        formula = levelIndex % 2 === 0
          ? `(${parentName} * 1.01) + ${baseField}`
          : `${parentName} + ${baseField}`
      }
      definitions.push({
        name,
        field,
        formula,
      })
      levelNames.push(name)
      globalIndex += 1
    }
    levels.push(levelNames)
  }

  return {
    definitions,
    depth,
  }
}

function buildFanoutFormulaDefinitions(formulaCount, requestedDepth) {
  const depth = Math.max(2, Math.min(requestedDepth, formulaCount))
  const rootCount = Math.max(1, Math.min(5, Math.ceil(formulaCount * 0.15)))
  const definitions = []
  const rootNames = []

  for (let index = 0; index < rootCount; index += 1) {
    const name = `f${index + 1}`
    const variant = index % 4
    const formula = variant === 0
      ? "price * qty"
      : variant === 1
        ? "price + shipping"
        : variant === 2
          ? "(qty * taxRate) + shipping"
          : "(orders - returns) + fee"
    definitions.push({ name, field: name, formula })
    rootNames.push(name)
  }

  const hubName = rootNames[0] ?? "f1"
  for (let index = rootCount; index < formulaCount; index += 1) {
    const numericIndex = index + 1
    const name = `f${numericIndex}`
    const baseField = BASE_FIELDS[index % BASE_FIELDS.length]
    const secondaryRoot = rootNames[(index - rootCount + 1) % rootNames.length] ?? hubName
    const formula = index % 3 === 0
      ? `(${hubName} * 1.01) + ${baseField}`
      : index % 3 === 1
        ? `${hubName} + ${secondaryRoot}`
        : `(${hubName} - ${secondaryRoot}) + ${baseField}`
    definitions.push({ name, field: name, formula })
  }

  return {
    definitions,
    depth,
  }
}

function buildChainFormulaDefinitions(formulaCount) {
  const definitions = []
  for (let index = 0; index < formulaCount; index += 1) {
    const numericIndex = index + 1
    const name = `f${numericIndex}`
    let formula
    if (index === 0) {
      formula = "price * qty"
    } else {
      const parentName = `f${index}`
      const baseField = BASE_FIELDS[index % BASE_FIELDS.length]
      formula = index % 2 === 0
        ? `(${parentName} * 1.01) + ${baseField}`
        : `${parentName} + ${baseField}`
    }
    definitions.push({ name, field: name, formula })
  }

  return {
    definitions,
    depth: formulaCount,
  }
}

function buildRandomFormulaDefinitions(formulaCount, requestedDepth, rng) {
  const definitions = []
  const nodeDepths = []
  let maxDepth = 1

  for (let index = 0; index < formulaCount; index += 1) {
    const numericIndex = index + 1
    const name = `f${numericIndex}`
    let formula
    let nodeDepth = 1

    if (index < 3) {
      const variant = index % 3
      formula = variant === 0
        ? "price * qty"
        : variant === 1
          ? "price + shipping"
          : "(qty * taxRate) + shipping"
    } else {
      const useTwoComputedDeps = rng() > 0.45 && index >= 2
      const leftIndex = randomInt(rng, 0, index - 1)
      const leftName = `f${leftIndex + 1}`
      const leftDepth = nodeDepths[leftIndex] ?? 1
      if (useTwoComputedDeps) {
        const rightIndex = randomInt(rng, 0, index - 1)
        const rightName = `f${rightIndex + 1}`
        const rightDepth = nodeDepths[rightIndex] ?? 1
        formula = index % 2 === 0
          ? `(${leftName} * 1.01) + ${rightName}`
          : `${leftName} + ${rightName}`
        nodeDepth = Math.max(leftDepth, rightDepth) + 1
      } else {
        const baseField = BASE_FIELDS[index % BASE_FIELDS.length]
        formula = index % 2 === 0
          ? `(${leftName} * 1.01) + ${baseField}`
          : `${leftName} + ${baseField}`
        nodeDepth = leftDepth + 1
      }
    }

    definitions.push({ name, field: name, formula })
    nodeDepths.push(nodeDepth)
    maxDepth = Math.max(maxDepth, nodeDepth)
  }

  return {
    definitions,
    depth: Math.max(Math.min(maxDepth, formulaCount), Math.min(requestedDepth, formulaCount)),
  }
}

function buildFormulaDefinitions(formulaCount, requestedDepth, dagShape, rng) {
  switch (dagShape) {
    case "fanout":
      return buildFanoutFormulaDefinitions(formulaCount, requestedDepth)
    case "chain":
      return buildChainFormulaDefinitions(formulaCount)
    case "random":
      return buildRandomFormulaDefinitions(formulaCount, requestedDepth, rng)
    case "uniform":
    default:
      return buildUniformFormulaDefinitions(formulaCount, requestedDepth)
  }
}

function formatScenarioKey(scenarioName, dagShape) {
  return `${scenarioName}/${dagShape}`
}

function countAffectedComputedNamesFromSnapshot(planSnapshot, changedFields) {
  if (!planSnapshot || !Array.isArray(planSnapshot.nodes) || planSnapshot.nodes.length === 0) {
    return 0
  }
  const affected = new Set()
  const dependentsByComputed = new Map()

  for (const node of planSnapshot.nodes) {
    for (const computedDep of node.computedDeps ?? []) {
      const dependents = dependentsByComputed.get(computedDep) ?? []
      dependents.push(node.name)
      dependentsByComputed.set(computedDep, dependents)
    }
  }

  const queue = []
  for (const node of planSnapshot.nodes) {
    if (!Array.isArray(node.fieldDeps)) {
      continue
    }
    if (node.fieldDeps.some(field => changedFields.has(field))) {
      affected.add(node.name)
      queue.push(node.name)
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }
    const dependents = dependentsByComputed.get(current)
    if (!dependents) {
      continue
    }
    for (const dependent of dependents) {
      if (affected.has(dependent)) {
        continue
      }
      affected.add(dependent)
      queue.push(dependent)
    }
  }

  return affected.size
}

function selectPatchIndices(rowCount, patchSize, rng) {
  if (patchSize >= rowCount) {
    return Array.from({ length: rowCount }, (_, index) => index)
  }
  const indices = new Set()
  while (indices.size < patchSize) {
    indices.add(randomInt(rng, 0, rowCount - 1))
  }
  return Array.from(indices)
}

function createMarkdownSummary(summary) {
  const lines = []
  lines.push("# Formula Engine Benchmarks")
  lines.push("")
  lines.push(`Generated: ${summary.generatedAt}`)
  lines.push("")
  lines.push("## Config")
  lines.push("")
  lines.push(`- Scenarios: ${summary.config.scenarios.join(", ")}`)
  lines.push(`- DAG shapes: ${summary.config.dagShapes.join(", ")}`)
  lines.push(`- Seeds: ${summary.config.seeds.join(", ")}`)
  lines.push(`- Patch sizes: ${summary.config.patchSizes.join(", ")}`)
  lines.push(`- Full recompute iterations: ${summary.config.fullRecomputeIterations}`)
  lines.push(`- Patch iterations: ${summary.config.patchIterations}`)
  lines.push("")
  lines.push("## Results")
  lines.push("")
  lines.push(`| scenario | shape | rows | formulas | depth | compile mean (ms) | init mean (ms) | full p95 (ms) | patch p95 (1) | patch p95 (100) | patch p95 (1000) | full eval/s | incr eval/s (${PERF_BUDGET_INCREMENTAL_PATCH_SIZE}) |`)
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")

  for (const scenario of summary.aggregate.workloads) {
    const patchP95 = new Map(
      scenario.patch.map(entry => [entry.patchSize, entry.p95AcrossRunsMs.p95]),
    )
    const targetPatchSize = Math.min(PERF_BUDGET_INCREMENTAL_PATCH_SIZE, scenario.config.rows)
    const targetPatch = scenario.patch.find(entry => entry.patchSize === targetPatchSize)
    lines.push(
      `| ${scenario.name} | ${scenario.dagShape} | ${scenario.config.rows} | ${scenario.config.formulas} | ${scenario.config.depth} | ${scenario.compileMs.mean.toFixed(3)} | ${scenario.initMs.mean.toFixed(3)} | ${scenario.fullRecomputeP95Ms.p95.toFixed(3)} | ${((patchP95.get(1) ?? 0)).toFixed(3)} | ${((patchP95.get(100) ?? 0)).toFixed(3)} | ${((patchP95.get(1000) ?? 0)).toFixed(3)} | ${scenario.fullEvaluationsPerSec.mean.toFixed(0)} | ${(targetPatch?.evaluationsPerSec.mean ?? 0).toFixed(0)} |`,
    )
  }

  lines.push("")
  lines.push(`Benchmark status: ${summary.ok ? "OK" : "FAILED"}`)
  if (Array.isArray(summary.budgetErrors) && summary.budgetErrors.length > 0) {
    lines.push("")
    lines.push("## Budget errors")
    lines.push("")
    for (const error of summary.budgetErrors) {
      lines.push(`- ${error}`)
    }
  }
  return lines.join("\n")
}

async function runScenario({ scenarioName, dagShape, seed, api }) {
  const scenarioConfig = SCENARIO_PRESETS[scenarioName]
  const rng = createRng(seed)
  const startedAt = performance.now()
  const heapStart = await sampleHeapUsed()

  const { mutableRows, rowNodes } = buildRows(scenarioConfig.rows, rng)
  const { definitions, depth } = buildFormulaDefinitions(
    scenarioConfig.formulas,
    scenarioConfig.depth,
    dagShape,
    rng,
  )
  const knownComputedNames = new Set(definitions.map(definition => definition.name))
  const knownComputedNameByField = new Map(
    definitions.map(definition => [definition.field, definition.name]),
  )

  const compileDurations = []
  for (let iteration = 0; iteration < BENCH_COMPILE_ITERATIONS; iteration += 1) {
    const compileStart = performance.now()
    const compiled = definitions.map(definition =>
      api.compileDataGridFormulaFieldDefinition(definition, {
        resolveDependencyToken: (identifier) => {
          const normalized = identifier.trim()
          const byField = knownComputedNameByField.get(normalized)
          if (byField) {
            return `computed:${byField}`
          }
          if (knownComputedNames.has(normalized)) {
            return `computed:${normalized}`
          }
          return `field:${normalized}`
        },
      }),
    )
    compileDurations.push(performance.now() - compileStart)
    if (compiled.length !== definitions.length) {
      throw new Error("formula compile benchmark produced unexpected result length")
    }
  }

  const initStart = performance.now()
  const model = api.createClientRowModel({
    rows: rowNodes,
    initialFormulaFields: definitions,
    captureFormulaRowRecomputeDiagnostics: false,
    captureFormulaExplainDiagnostics: false,
  })
  const initMs = performance.now() - initStart

  if (typeof model.getFormulaComputeStageDiagnostics !== "function") {
    model.dispose?.()
    throw new Error(
      [
        "Loaded datagrid-core build does not expose getFormulaComputeStageDiagnostics().",
        "The formula benchmark is running against a stale dist build.",
        "Rebuild @affino/datagrid-core before running the benchmark.",
      ].join(" "),
    )
  }

  const planSnapshot = model.getFormulaExecutionPlan?.() ?? null
  const depthFromPlan = planSnapshot?.levels?.length ?? depth
  const affectedByPatchFields = countAffectedComputedNamesFromSnapshot(
    planSnapshot,
    new Set(["price", "qty"]),
  )

  const fullRecomputeDurations = []
  const fullRecomputeEvaluations = []
  const fullRecomputeDiagnostics = []
  for (let iteration = 0; iteration < BENCH_FULL_RECOMPUTE_ITERATIONS; iteration += 1) {
    const recomputeStart = performance.now()
    model.recomputeComputedFields()
    fullRecomputeDurations.push(performance.now() - recomputeStart)
    const computeDiagnostics = model.getFormulaComputeStageDiagnostics?.()
    fullRecomputeDiagnostics.push(cloneComputeDiagnostics(computeDiagnostics))
    fullRecomputeEvaluations.push(
      Number.isFinite(computeDiagnostics?.evaluations)
        ? Math.max(0, Number(computeDiagnostics.evaluations))
        : scenarioConfig.rows * scenarioConfig.formulas,
    )
  }

  const patchBenchmarks = []
  for (const patchSize of BENCH_PATCH_SIZES) {
    const effectivePatchSize = Math.min(patchSize, scenarioConfig.rows)
    const patchDurations = []
    const patchEvaluationCounts = []
    const patchDiagnostics = []
    for (let iteration = 0; iteration < BENCH_PATCH_ITERATIONS; iteration += 1) {
      const indices = selectPatchIndices(scenarioConfig.rows, effectivePatchSize, rng)
      const updates = []
      for (const index of indices) {
        const row = mutableRows[index]
        if (!row) {
          continue
        }
        row.price = row.price + 1 + rng() * 0.01
        row.qty = Math.max(1, ((row.qty + 1) % 10))
        updates.push({
          rowId: row.id,
          data: {
            price: row.price,
            qty: row.qty,
          },
        })
      }
      const patchStart = performance.now()
      model.patchRows(updates, {
        recomputeSort: false,
        recomputeFilter: false,
        recomputeGroup: false,
        emit: false,
      })
      patchDurations.push(performance.now() - patchStart)
      const computeDiagnostics = model.getFormulaComputeStageDiagnostics?.()
      patchDiagnostics.push(cloneComputeDiagnostics(computeDiagnostics))
      patchEvaluationCounts.push(
        Number.isFinite(computeDiagnostics?.evaluations)
          ? Math.max(0, Number(computeDiagnostics.evaluations))
          : effectivePatchSize * Math.max(affectedByPatchFields, 1),
      )
    }
    const durationStat = stats(patchDurations)
    const evaluationsStat = stats(patchEvaluationCounts)
    const evaluationsPerSecSamples = patchDurations.map((duration, index) => {
      if (!Number.isFinite(duration) || duration <= 0) {
        return 0
      }
      const evaluations = patchEvaluationCounts[index] ?? 0
      return evaluations / (duration / 1000)
    })
    const evaluationsPerSecStat = stats(evaluationsPerSecSamples)
    patchBenchmarks.push({
      patchSize: effectivePatchSize,
      evaluations: evaluationsStat,
      durationMs: durationStat,
      evaluationsPerSec: evaluationsPerSecStat.mean,
      evaluationsPerSecStat,
      diagnostics: summarizeComputeDiagnostics(patchDiagnostics),
    })
  }

  model.dispose()

  const heapEnd = await sampleHeapUsed()
  const heapDeltaMb = (heapEnd - heapStart) / (1024 * 1024)
  const elapsedMs = performance.now() - startedAt
  const fullRecomputeStat = stats(fullRecomputeDurations)
  const fullRecomputeEvaluationsStat = stats(fullRecomputeEvaluations)
  const fullEvaluationsPerSecSamples = fullRecomputeDurations.map((duration, index) => {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0
    }
    const evaluations = fullRecomputeEvaluations[index] ?? (scenarioConfig.rows * scenarioConfig.formulas)
    return evaluations / (duration / 1000)
  })
  const fullEvaluationsPerSecStat = stats(fullEvaluationsPerSecSamples)

  return {
    seed,
    scenario: scenarioName,
    dagShape,
    workloadKey: formatScenarioKey(scenarioName, dagShape),
    config: {
      rows: scenarioConfig.rows,
      formulas: scenarioConfig.formulas,
      depthRequested: scenarioConfig.depth,
      depthActual: depthFromPlan,
      affectedByPatchFields,
    },
    compileMs: stats(compileDurations),
    initMs,
    fullRecomputeMs: fullRecomputeStat,
    fullEvaluations: fullRecomputeEvaluationsStat,
    fullEvaluationsPerSec: fullEvaluationsPerSecStat.mean,
    fullEvaluationsPerSecStat,
    fullRecomputeDiagnostics: summarizeComputeDiagnostics(fullRecomputeDiagnostics),
    patch: patchBenchmarks,
    elapsedMs,
    heapDeltaMb,
  }
}

const api = await loadFormulaApi()
const results = []
const budgetErrors = []
const varianceSkippedChecks = []

console.log("\nAffino DataGrid Formula Engine Benchmark")
console.log(
  `scenarios=${BENCH_SCENARIOS.join(",")} dagShapes=${BENCH_DAG_SHAPES.join(",")} seeds=${BENCH_SEEDS.join(",")} patchSizes=${BENCH_PATCH_SIZES.join(",")} fullIters=${BENCH_FULL_RECOMPUTE_ITERATIONS} patchIters=${BENCH_PATCH_ITERATIONS}`,
)

for (const seed of BENCH_SEEDS) {
  for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
    for (const scenarioName of BENCH_SCENARIOS) {
      for (const dagShape of BENCH_DAG_SHAPES) {
        await runScenario({
          scenarioName,
          dagShape,
          seed: seed + (warmup + 1) * 997,
          api,
        })
      }
    }
  }

  for (const scenarioName of BENCH_SCENARIOS) {
    for (const dagShape of BENCH_DAG_SHAPES) {
      const run = await runScenario({ scenarioName, dagShape, seed, api })
      results.push(run)

      const patchSummary = run.patch.map(entry => `${entry.patchSize}:${entry.durationMs.p95.toFixed(3)}ms`).join(" ")
      const fullStrategies = Object.entries(run.fullRecomputeDiagnostics.strategyCounts)
        .map(([strategy, count]) => `${strategy}:${count}`)
        .join(",")
      console.log(
        `seed=${seed} scenario=${scenarioName} shape=${dagShape} rows=${run.config.rows} formulas=${run.config.formulas} depth=${run.config.depthActual} compileMean=${run.compileMs.mean.toFixed(3)}ms init=${run.initMs.toFixed(3)}ms fullP95=${run.fullRecomputeMs.p95.toFixed(3)}ms fullEval/s=${run.fullEvaluationsPerSec.toFixed(0)} fullStrategy=[${fullStrategies}] fullDirtyRows=${run.fullRecomputeDiagnostics.dirtyRows.mean.toFixed(0)} fullSkipped=${run.fullRecomputeDiagnostics.skippedByObjectIs.mean.toFixed(0)} patchP95=[${patchSummary}] heapDelta=${run.heapDeltaMb.toFixed(2)}MB`,
      )
    }
  }
}

const aggregateElapsed = stats(results.map(run => run.elapsedMs))
const aggregateHeapDelta = stats(results.map(run => run.heapDeltaMb))
const resolveTargetPatchSizeForRows = rowCount => Math.min(PERF_BUDGET_INCREMENTAL_PATCH_SIZE, rowCount)
const getTargetPatchEntryForRun = run => {
  const targetPatchSize = resolveTargetPatchSizeForRows(run.config.rows)
  return run.patch.find(entry => entry.patchSize === targetPatchSize) ?? null
}

const workloadConfigs = BENCH_SCENARIOS.flatMap(
  scenarioName => BENCH_DAG_SHAPES.map(dagShape => ({ scenarioName, dagShape })),
)

const aggregateByWorkload = workloadConfigs.map(({ scenarioName, dagShape }) => {
  const scenarioRuns = results.filter(
    run => run.scenario === scenarioName && run.dagShape === dagShape,
  )
  const scenarioConfig = SCENARIO_PRESETS[scenarioName]
  const patchBySize = BENCH_PATCH_SIZES.map((patchSize) => {
    const matches = scenarioRuns
      .map(run => run.patch.find(entry => entry.patchSize === Math.min(patchSize, run.config.rows)))
      .filter(entry => Boolean(entry))
    return {
      patchSize,
      durationMs: stats(matches.map(entry => entry.durationMs.mean)),
      p95AcrossRunsMs: stats(matches.map(entry => entry.durationMs.p95)),
      evaluationsPerSec: stats(matches.map(entry => entry.evaluationsPerSec)),
    }
  })

  return {
    name: scenarioName,
    dagShape,
    workloadKey: formatScenarioKey(scenarioName, dagShape),
    config: scenarioConfig,
    compileMs: stats(scenarioRuns.map(run => run.compileMs.mean)),
    initMs: stats(scenarioRuns.map(run => run.initMs)),
    fullRecomputeMs: stats(scenarioRuns.map(run => run.fullRecomputeMs.mean)),
    fullRecomputeP95Ms: stats(scenarioRuns.map(run => run.fullRecomputeMs.p95)),
    fullEvaluationsPerSec: stats(scenarioRuns.map(run => run.fullEvaluationsPerSec)),
    patch: patchBySize,
    heapDeltaMb: stats(scenarioRuns.map(run => run.heapDeltaMb)),
  }
})

const fullRecomputeP95AcrossAll = stats(results.map(run => run.fullRecomputeMs.p95))
const patchP95AcrossAll = stats(results
  .map(getTargetPatchEntryForRun)
  .filter(entry => entry !== null)
  .map(entry => entry.durationMs.p95))
const fullEvaluationsPerSecAcrossAll = stats(results.map(run => run.fullEvaluationsPerSec))
const incrementalEvaluationsPerSecAcrossAll = stats(results
  .map(getTargetPatchEntryForRun)
  .filter(entry => entry !== null)
  .map(entry => entry.evaluationsPerSec))

if (aggregateElapsed.p95 > PERF_BUDGET_TOTAL_MS) {
  budgetErrors.push(
    `aggregate elapsed p95 ${aggregateElapsed.p95.toFixed(2)}ms exceeds PERF_BUDGET_TOTAL_MS=${PERF_BUDGET_TOTAL_MS}ms`,
  )
}
if (fullRecomputeP95AcrossAll.p95 > PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS) {
  budgetErrors.push(
    `full recompute p95 ${fullRecomputeP95AcrossAll.p95.toFixed(3)}ms exceeds PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS=${PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS}ms`,
  )
}
if (patchP95AcrossAll.p95 > PERF_BUDGET_MAX_PATCH_P95_MS) {
  budgetErrors.push(
    `patch p95 (size=${PERF_BUDGET_INCREMENTAL_PATCH_SIZE}) ${patchP95AcrossAll.p95.toFixed(3)}ms exceeds PERF_BUDGET_MAX_PATCH_P95_MS=${PERF_BUDGET_MAX_PATCH_P95_MS}ms`,
  )
}
if (fullEvaluationsPerSecAcrossAll.mean < PERF_BUDGET_MIN_FULL_EVALS_PER_SEC) {
  budgetErrors.push(
    `full eval/sec mean ${fullEvaluationsPerSecAcrossAll.mean.toFixed(0)} below PERF_BUDGET_MIN_FULL_EVALS_PER_SEC=${PERF_BUDGET_MIN_FULL_EVALS_PER_SEC}`,
  )
}
if (incrementalEvaluationsPerSecAcrossAll.mean < PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC) {
  budgetErrors.push(
    `incremental eval/sec mean (patchSize=${PERF_BUDGET_INCREMENTAL_PATCH_SIZE}) ${incrementalEvaluationsPerSecAcrossAll.mean.toFixed(0)} below PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC=${PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC}`,
  )
}
if (aggregateHeapDelta.p95 > PERF_BUDGET_MAX_HEAP_DELTA_MB + PERF_BUDGET_HEAP_EPSILON_MB) {
  budgetErrors.push(
    `heap delta p95 ${aggregateHeapDelta.p95.toFixed(2)}MB exceeds PERF_BUDGET_MAX_HEAP_DELTA_MB=${PERF_BUDGET_MAX_HEAP_DELTA_MB}MB (epsilon ${PERF_BUDGET_HEAP_EPSILON_MB.toFixed(2)}MB)`,
  )
}

for (const aggregate of [
  { name: "total elapsed", stat: aggregateElapsed },
  { name: "full recompute p95", stat: fullRecomputeP95AcrossAll },
  { name: `patch p95 (size=${PERF_BUDGET_INCREMENTAL_PATCH_SIZE})`, stat: patchP95AcrossAll },
]) {
  if (shouldEnforceVariance(aggregate.stat)) {
    if (aggregate.stat.cvPct > PERF_BUDGET_MAX_VARIANCE_PCT) {
      budgetErrors.push(
        `${aggregate.name} CV ${aggregate.stat.cvPct.toFixed(2)}% exceeds PERF_BUDGET_MAX_VARIANCE_PCT=${PERF_BUDGET_MAX_VARIANCE_PCT}%`,
      )
    }
  } else if (PERF_BUDGET_MAX_VARIANCE_PCT !== Number.POSITIVE_INFINITY) {
    varianceSkippedChecks.push(
      `${aggregate.name} variance gate skipped (mean ${aggregate.stat.mean.toFixed(3)}ms < PERF_BUDGET_VARIANCE_MIN_MEAN_MS=${PERF_BUDGET_VARIANCE_MIN_MEAN_MS}ms)`,
    )
  }
}

for (const aggregate of aggregateByWorkload) {
  const scenarioFullBudget = resolveScenarioBudget(
    "PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS",
    `${aggregate.name}_${aggregate.dagShape}`,
    resolveScenarioBudget(
      "PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS",
      aggregate.name,
      PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS,
    ),
  )
  if (
    Number.isFinite(scenarioFullBudget)
    && aggregate.fullRecomputeP95Ms.p95 > scenarioFullBudget
  ) {
    budgetErrors.push(
      `scenario=${aggregate.name} shape=${aggregate.dagShape} full recompute p95 ${aggregate.fullRecomputeP95Ms.p95.toFixed(3)}ms exceeds ${scenarioFullBudget}ms`,
    )
  }

  const scenarioPatchBudget = resolveScenarioBudget(
    "PERF_BUDGET_MAX_PATCH_P95_MS",
    `${aggregate.name}_${aggregate.dagShape}`,
    Number.NaN,
  )
  const resolvedScenarioPatchBudget = Number.isFinite(scenarioPatchBudget)
    ? scenarioPatchBudget
    : resolveScenarioBudget(
      "PERF_BUDGET_MAX_PATCH_P95_MS",
      aggregate.name,
      PERF_BUDGET_MAX_PATCH_P95_MS,
    )
  const targetPatchSize = resolveTargetPatchSizeForRows(aggregate.config.rows)
  for (const patchEntry of aggregate.patch) {
    const patchBudget = resolveScenarioPatchBudget("PERF_BUDGET_MAX_PATCH_P95_MS", {
      scenarioName: aggregate.name,
      dagShape: aggregate.dagShape,
      patchSize: patchEntry.patchSize,
      fallback: patchEntry.patchSize === targetPatchSize
        ? resolvedScenarioPatchBudget
        : Number.NaN,
    })
    if (!Number.isFinite(patchBudget) || patchEntry.p95AcrossRunsMs.p95 <= patchBudget) {
      continue
    }
    budgetErrors.push(
      `scenario=${aggregate.name} shape=${aggregate.dagShape} patch p95(size=${patchEntry.patchSize}) ${patchEntry.p95AcrossRunsMs.p95.toFixed(3)}ms exceeds ${patchBudget}ms`,
    )
  }
}

const summary = {
  benchmark: "datagrid-formula-engine",
  generatedAt: new Date().toISOString(),
  config: {
    scenarios: BENCH_SCENARIOS,
    dagShapes: BENCH_DAG_SHAPES,
    seeds: BENCH_SEEDS,
    warmupRuns: BENCH_WARMUP_RUNS,
    fullRecomputeIterations: BENCH_FULL_RECOMPUTE_ITERATIONS,
    patchIterations: BENCH_PATCH_ITERATIONS,
    compileIterations: BENCH_COMPILE_ITERATIONS,
    patchSizes: BENCH_PATCH_SIZES,
  },
  budgets: {
    totalMs: PERF_BUDGET_TOTAL_MS,
    maxFullRecomputeP95Ms: PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS,
    maxPatchP95Ms: PERF_BUDGET_MAX_PATCH_P95_MS,
    minFullEvaluationsPerSec: PERF_BUDGET_MIN_FULL_EVALS_PER_SEC,
    minIncrementalEvaluationsPerSec: PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC,
    incrementalPatchSize: PERF_BUDGET_INCREMENTAL_PATCH_SIZE,
    maxHeapDeltaMb: PERF_BUDGET_MAX_HEAP_DELTA_MB,
    heapEpsilonMb: PERF_BUDGET_HEAP_EPSILON_MB,
    maxVariancePct: PERF_BUDGET_MAX_VARIANCE_PCT,
    varianceMinMeanMs: PERF_BUDGET_VARIANCE_MIN_MEAN_MS,
  },
  varianceSkippedChecks,
  aggregate: {
    elapsedMs: aggregateElapsed,
    heapDeltaMb: aggregateHeapDelta,
    fullRecomputeP95Ms: fullRecomputeP95AcrossAll,
    patchP95Ms: patchP95AcrossAll,
    fullEvaluationsPerSec: fullEvaluationsPerSecAcrossAll,
    incrementalEvaluationsPerSec: incrementalEvaluationsPerSecAcrossAll,
    scenarios: aggregateByWorkload,
    workloads: aggregateByWorkload,
  },
  runs: results,
  budgetErrors,
  ok: budgetErrors.length === 0,
}

mkdirSync(dirname(BENCH_OUTPUT_JSON), { recursive: true })
writeFileSync(BENCH_OUTPUT_JSON, JSON.stringify(summary, null, 2))
console.log(`\nBenchmark summary written: ${BENCH_OUTPUT_JSON}`)

const markdown = createMarkdownSummary(summary)
mkdirSync(dirname(BENCH_OUTPUT_MARKDOWN), { recursive: true })
writeFileSync(BENCH_OUTPUT_MARKDOWN, `${markdown}\n`)
console.log(`Markdown report written: ${BENCH_OUTPUT_MARKDOWN}`)

if (budgetErrors.length > 0) {
  console.error("\nFormula benchmark budget check failed:")
  for (const error of budgetErrors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}
