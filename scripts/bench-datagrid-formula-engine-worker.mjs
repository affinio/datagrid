#!/usr/bin/env node

import { Worker } from "node:worker_threads"
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
const BENCH_FULL_REFRESH_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_FULL_REFRESH_ITERATIONS ?? "3", 10)
const BENCH_PATCH_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_PATCH_ITERATIONS ?? "5", 10)
const BENCH_COMPILE_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_COMPILE_ITERATIONS ?? "3", 10)
const BENCH_PATCH_SIZES = (process.env.BENCH_FORMULA_PATCH_SIZES ?? "1,100,1000")
  .split(",")
  .map(value => Number.parseInt(value.trim(), 10))
  .filter(value => Number.isFinite(value) && value > 0)
const BENCH_SCENARIOS = (process.env.BENCH_FORMULA_SCENARIOS ?? "small,medium,large")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean)
const BENCH_RUNTIME_MODES = (process.env.BENCH_FORMULA_RUNTIME_MODES ?? "main-thread,worker-owned")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean)

const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-formula-engine-worker.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-formula-engine-worker.md",
)
const BENCH_WORKER_RUNTIME_PATH = resolve(
  process.env.BENCH_WORKER_RUNTIME_PATH ?? "scripts/bench-datagrid-formula-engine-worker.runtime.mjs",
)

const PERF_BUDGET_TOTAL_MS = Number.parseFloat(process.env.PERF_BUDGET_TOTAL_MS ?? "Infinity")
const PERF_BUDGET_MAX_HEAP_DELTA_MB = Number.parseFloat(process.env.PERF_BUDGET_MAX_HEAP_DELTA_MB ?? "Infinity")
const PERF_BUDGET_HEAP_EPSILON_MB = Number.parseFloat(process.env.PERF_BUDGET_HEAP_EPSILON_MB ?? "1")
const PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL = Number.parseFloat(process.env.PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL ?? "0")
const PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH = Number.parseFloat(process.env.PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH ?? "0")
const PERF_BUDGET_WORKER_SPEEDUP_PATCH_SIZE = Number.parseInt(
  process.env.PERF_BUDGET_WORKER_SPEEDUP_PATCH_SIZE
    ?? `${Math.max(...BENCH_PATCH_SIZES)}`,
  10,
)

const RUNTIME_MODE_MAIN_THREAD = "main-thread"
const RUNTIME_MODE_WORKER_OWNED = "worker-owned"
const SUPPORTED_RUNTIME_MODES = new Set([
  RUNTIME_MODE_MAIN_THREAD,
  RUNTIME_MODE_WORKER_OWNED,
])

const SCENARIO_PRESETS = Object.freeze({
  small: { rows: 10_000, formulas: 10, depth: 2 },
  medium: { rows: 50_000, formulas: 20, depth: 3 },
  large: { rows: 100_000, formulas: 40, depth: 4 },
  extreme: { rows: 250_000, formulas: 60, depth: 6 },
})

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

assertPositiveInteger(BENCH_FULL_REFRESH_ITERATIONS, "BENCH_FORMULA_FULL_REFRESH_ITERATIONS")
assertPositiveInteger(BENCH_PATCH_ITERATIONS, "BENCH_FORMULA_PATCH_ITERATIONS")
assertPositiveInteger(BENCH_COMPILE_ITERATIONS, "BENCH_FORMULA_COMPILE_ITERATIONS")
assertNonNegativeInteger(BENCH_WARMUP_RUNS, "BENCH_WARMUP_RUNS")
assertPositiveInteger(PERF_BUDGET_WORKER_SPEEDUP_PATCH_SIZE, "PERF_BUDGET_WORKER_SPEEDUP_PATCH_SIZE")

if (BENCH_SEEDS.length === 0) {
  throw new Error("BENCH_SEEDS must include at least one positive integer")
}
if (BENCH_PATCH_SIZES.length === 0) {
  throw new Error("BENCH_FORMULA_PATCH_SIZES must include at least one positive integer")
}
if (BENCH_SCENARIOS.length === 0) {
  throw new Error("BENCH_FORMULA_SCENARIOS resolved to an empty set")
}
for (const scenario of BENCH_SCENARIOS) {
  if (!(scenario in SCENARIO_PRESETS)) {
    throw new Error(`Unsupported BENCH_FORMULA_SCENARIOS entry '${scenario}'`)
  }
}
if (BENCH_RUNTIME_MODES.length === 0) {
  throw new Error("BENCH_FORMULA_RUNTIME_MODES resolved to an empty set")
}
for (const mode of BENCH_RUNTIME_MODES) {
  if (!SUPPORTED_RUNTIME_MODES.has(mode)) {
    throw new Error(`Unsupported BENCH_FORMULA_RUNTIME_MODES entry '${mode}'`)
  }
}
if (!existsSync(BENCH_WORKER_RUNTIME_PATH) && BENCH_RUNTIME_MODES.includes(RUNTIME_MODE_WORKER_OWNED)) {
  throw new Error(
    `Worker runtime entry is missing: ${BENCH_WORKER_RUNTIME_PATH}. Make sure bench-datagrid-formula-engine-worker.runtime.mjs exists.`,
  )
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
  return new Promise(resolveSleep => {
    setTimeout(resolveSleep, ms)
  })
}

async function waitFor(predicate, timeoutMs = 15_000, pollMs = 5) {
  const startedAt = performance.now()
  while ((performance.now() - startedAt) <= timeoutMs) {
    if (predicate()) {
      return true
    }
    await sleep(pollMs)
  }
  return false
}

async function sampleHeapUsed() {
  const maybeGc = globalThis.gc
  let minHeap = Number.POSITIVE_INFINITY
  for (let iteration = 0; iteration < 3; iteration += 1) {
    if (typeof maybeGc === "function") {
      maybeGc()
    }
    await sleep(0)
    const used = process.memoryUsage().heapUsed
    if (used < minHeap) {
      minHeap = used
    }
  }
  return Number.isFinite(minHeap) ? minHeap : process.memoryUsage().heapUsed
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
      row,
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

function materializeRowNodes(mutableRows) {
  const rowNodes = new Array(mutableRows.length)
  for (let index = 0; index < mutableRows.length; index += 1) {
    const row = mutableRows[index]
    rowNodes[index] = {
      row,
      rowId: row.id,
      originalIndex: index,
      displayIndex: index,
    }
  }
  return rowNodes
}

function buildFormulaDefinitions(formulaCount, requestedDepth) {
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
      definitions.push({ name, field, formula })
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

function formatNumber(value, fractionDigits = 3) {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : "0"
}

function loadDistModuleCandidates(candidates, requiredExports, label) {
  return (async () => {
    let lastError = null
    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        continue
      }
      try {
        const module = await import(pathToFileURL(candidate).href)
        const missing = requiredExports.filter(name => typeof module[name] !== "function")
        if (missing.length === 0) {
          return {
            module,
            path: candidate,
          }
        }
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) {
      throw new Error(`${label} dist import failed: ${String(lastError)}`)
    }

    throw new Error(`${label} dist is missing required exports (${requiredExports.join(", ")}). Build the package first.`)
  })()
}

async function loadCoreApi() {
  const loaded = await loadDistModuleCandidates(
    [
      resolve("packages/datagrid-core/dist/src/models/index.js"),
      resolve("packages/datagrid-core/dist/src/public.js"),
    ],
    ["createClientRowModel", "compileDataGridFormulaFieldDefinition"],
    "datagrid-core",
  )
  return {
    createClientRowModel: loaded.module.createClientRowModel,
    compileDataGridFormulaFieldDefinition: loaded.module.compileDataGridFormulaFieldDefinition,
  }
}

async function loadWorkerApi() {
  const loaded = await loadDistModuleCandidates(
    [resolve("packages/datagrid-worker/dist/index.js")],
    ["createDataGridWorkerOwnedRowModel", "createDataGridWorkerOwnedRowModelHost"],
    "datagrid-worker",
  )
  return {
    createDataGridWorkerOwnedRowModel: loaded.module.createDataGridWorkerOwnedRowModel,
    workerModulePath: loaded.path,
  }
}

function createMainThreadRuntime(coreApi, rows, definitions) {
  const model = coreApi.createClientRowModel({
    rows,
    initialFormulaFields: definitions,
  })

  const readEvaluations = (fallback) => {
    const diagnostics = model.getFormulaComputeStageDiagnostics?.()
    if (Number.isFinite(diagnostics?.evaluations)) {
      return Math.max(0, Number(diagnostics.evaluations))
    }
    return fallback
  }

  return {
    mode: RUNTIME_MODE_MAIN_THREAD,
    getFormulaExecutionPlanSnapshot() {
      return model.getFormulaExecutionPlan?.() ?? null
    },
    async setRows(nextRows, fallbackEvaluations) {
      const startedAt = performance.now()
      model.setRows(nextRows)
      const durationMs = performance.now() - startedAt
      return {
        durationMs,
        evaluations: readEvaluations(fallbackEvaluations),
      }
    },
    async patchRows(updates, options, fallbackEvaluations) {
      const startedAt = performance.now()
      model.patchRows(updates, options)
      const durationMs = performance.now() - startedAt
      return {
        durationMs,
        evaluations: readEvaluations(fallbackEvaluations),
      }
    },
    dispose() {
      model.dispose()
    },
  }
}

function isControlResponseMessage(message) {
  return Boolean(
    message
      && typeof message === "object"
      && message.__benchFormulaWorkerControl === true
      && Number.isFinite(message.id),
  )
}

function createWorkerEndpoint(worker) {
  const messageListeners = new Set()
  const pendingControl = new Map()
  let nextControlId = 1

  const onMessage = (message) => {
    if (isControlResponseMessage(message)) {
      const pending = pendingControl.get(message.id)
      if (!pending) {
        return
      }
      pendingControl.delete(message.id)
      if (message.ok) {
        pending.resolve(message.payload ?? null)
      } else {
        const errorText = message?.payload?.error
          ? String(message.payload.error)
          : "worker control command failed"
        pending.reject(new Error(errorText))
      }
      return
    }

    for (const listener of messageListeners) {
      listener({ data: message })
    }
  }

  worker.on("message", onMessage)

  const source = {
    addEventListener(type, listener) {
      if (type !== "message") {
        return
      }
      messageListeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type !== "message") {
        return
      }
      messageListeners.delete(listener)
    },
  }

  const target = {
    postMessage(message) {
      worker.postMessage(message)
    },
  }

  const requestControl = (type, payload = null, timeoutMs = 20_000) => {
    const id = nextControlId
    nextControlId += 1
    return new Promise((resolveControl, rejectControl) => {
      const timeout = setTimeout(() => {
        pendingControl.delete(id)
        rejectControl(new Error(`worker control '${type}' timed out`))
      }, timeoutMs)

      pendingControl.set(id, {
        resolve: (value) => {
          clearTimeout(timeout)
          resolveControl(value)
        },
        reject: (error) => {
          clearTimeout(timeout)
          rejectControl(error)
        },
      })

      worker.postMessage({
        __benchFormulaWorkerControl: true,
        id,
        type,
        payload,
      })
    })
  }

  const dispose = () => {
    worker.off("message", onMessage)
    messageListeners.clear()
    for (const pending of pendingControl.values()) {
      pending.reject(new Error("worker endpoint disposed"))
    }
    pendingControl.clear()
  }

  return {
    source,
    target,
    requestControl,
    dispose,
  }
}

async function createWorkerOwnedRuntime(workerApi, rows, definitions, scenarioName, seed) {
  const workerModuleUrl = pathToFileURL(workerApi.workerModulePath).href
  const worker = new Worker(pathToFileURL(BENCH_WORKER_RUNTIME_PATH), {
    type: "module",
    workerData: {
      workerModuleUrl,
    },
  })

  const endpoint = createWorkerEndpoint(worker)
  const channel = `bench-formula-worker-${scenarioName}-${seed}-${Math.random().toString(36).slice(2)}`

  try {
    await endpoint.requestControl("init", {
      rows,
      initialFormulaFields: definitions,
      channel,
    })

    const model = workerApi.createDataGridWorkerOwnedRowModel({
      source: endpoint.source,
      target: endpoint.target,
      channel,
      requestInitialSync: true,
      viewportCoalescingStrategy: "simple",
    })

    const settled = await waitFor(() => {
      const snapshot = model.getSnapshot()
      const diagnostics = model.getWorkerProtocolDiagnostics()
      return (
        diagnostics.updatesApplied > 0
        && snapshot.rowCount === rows.length
        && snapshot.loading === false
      )
    }, 30_000, 5)

    if (!settled) {
      model.dispose()
      throw new Error("worker-owned row model did not settle after initial sync")
    }

    const readEvaluations = (fallback) => {
      const diagnostics = model.getFormulaComputeStageDiagnostics?.()
      if (Number.isFinite(diagnostics?.evaluations)) {
        return Math.max(0, Number(diagnostics.evaluations))
      }
      return fallback
    }

    const runAndAwaitUpdate = async (invoke, fallbackEvaluations) => {
      const before = model.getWorkerProtocolDiagnostics().updatesApplied
      const startedAt = performance.now()
      invoke()
      const applied = await waitFor(() => {
        const diagnostics = model.getWorkerProtocolDiagnostics()
        return diagnostics.updatesApplied > before
      }, 120_000, 5)
      if (!applied) {
        throw new Error("worker-owned row model did not apply command update in time")
      }
      const durationMs = performance.now() - startedAt
      return {
        durationMs,
        evaluations: readEvaluations(fallbackEvaluations),
      }
    }

    return {
      mode: RUNTIME_MODE_WORKER_OWNED,
      getFormulaExecutionPlanSnapshot() {
        return model.getFormulaExecutionPlan?.() ?? null
      },
      async setRows(nextRows, fallbackEvaluations) {
        return runAndAwaitUpdate(() => {
          model.setRows(nextRows)
        }, fallbackEvaluations)
      },
      async patchRows(updates, options, fallbackEvaluations) {
        return runAndAwaitUpdate(() => {
          model.patchRows(updates, options)
        }, fallbackEvaluations)
      },
      async dispose() {
        model.dispose()
        try {
          await endpoint.requestControl("dispose", null, 5_000)
        } catch {
          // Ignore disposal race and force terminate below.
        }
        endpoint.dispose()
        await worker.terminate()
      },
    }
  } catch (error) {
    endpoint.dispose()
    await worker.terminate()
    throw error
  }
}

async function createRuntime(mode, dependencies) {
  if (mode === RUNTIME_MODE_MAIN_THREAD) {
    return createMainThreadRuntime(
      dependencies.coreApi,
      dependencies.rows,
      dependencies.definitions,
    )
  }
  if (mode === RUNTIME_MODE_WORKER_OWNED) {
    return createWorkerOwnedRuntime(
      dependencies.workerApi,
      dependencies.rows,
      dependencies.definitions,
      dependencies.scenarioName,
      dependencies.seed,
    )
  }
  throw new Error(`Unsupported runtime mode '${mode}'`)
}

function resolveDependencyToken(identifier, knownComputedNames, knownComputedNameByField) {
  const normalized = identifier.trim()
  const byField = knownComputedNameByField.get(normalized)
  if (byField) {
    return `computed:${byField}`
  }
  if (knownComputedNames.has(normalized)) {
    return `computed:${normalized}`
  }
  return `field:${normalized}`
}

async function runScenarioMode({
  mode,
  scenarioName,
  seed,
  coreApi,
  workerApi,
}) {
  const scenarioConfig = SCENARIO_PRESETS[scenarioName]
  const rng = createRng(seed * 17 + (mode === RUNTIME_MODE_MAIN_THREAD ? 3 : 7))
  const startedAt = performance.now()
  const heapStart = await sampleHeapUsed()

  const { mutableRows, rowNodes } = buildRows(scenarioConfig.rows, rng)
  const { definitions, depth } = buildFormulaDefinitions(scenarioConfig.formulas, scenarioConfig.depth)
  const knownComputedNames = new Set(definitions.map(definition => definition.name))
  const knownComputedNameByField = new Map(definitions.map(definition => [definition.field, definition.name]))

  const compileDurations = []
  for (let iteration = 0; iteration < BENCH_COMPILE_ITERATIONS; iteration += 1) {
    const compileStartedAt = performance.now()
    const compiled = definitions.map(definition => coreApi.compileDataGridFormulaFieldDefinition(definition, {
      resolveDependencyToken: identifier => resolveDependencyToken(
        identifier,
        knownComputedNames,
        knownComputedNameByField,
      ),
    }))
    compileDurations.push(performance.now() - compileStartedAt)
    if (compiled.length !== definitions.length) {
      throw new Error("formula compile benchmark produced unexpected result length")
    }
  }

  const initStartedAt = performance.now()
  const runtime = await createRuntime(mode, {
    coreApi,
    workerApi,
    rows: rowNodes,
    definitions,
    scenarioName,
    seed,
  })
  const initMs = performance.now() - initStartedAt

  try {
    const planSnapshot = runtime.getFormulaExecutionPlanSnapshot?.() ?? null
    const depthFromPlan = planSnapshot?.levels?.length ?? depth
    const affectedByPatchFields = countAffectedComputedNamesFromSnapshot(
      planSnapshot,
      new Set(["price", "qty"]),
    )

    const fullRefreshDurations = []
    const fullRefreshEvaluations = []
    for (let iteration = 0; iteration < BENCH_FULL_REFRESH_ITERATIONS; iteration += 1) {
      const fullResult = await runtime.setRows(
        materializeRowNodes(mutableRows),
        scenarioConfig.rows * scenarioConfig.formulas,
      )
      fullRefreshDurations.push(fullResult.durationMs)
      fullRefreshEvaluations.push(fullResult.evaluations)
    }

    const patchBenchmarks = []

    for (const patchSize of BENCH_PATCH_SIZES) {
      const effectivePatchSize = Math.min(patchSize, scenarioConfig.rows)
      const patchDurations = []
      const patchEvaluationCounts = []

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

        const patchResult = await runtime.patchRows(
          updates,
          {
            recomputeSort: false,
            recomputeFilter: false,
            recomputeGroup: false,
            emit: false,
          },
          effectivePatchSize * Math.max(affectedByPatchFields, 1),
        )

        patchDurations.push(patchResult.durationMs)
        patchEvaluationCounts.push(patchResult.evaluations)
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
      })
    }

    const heapEnd = await sampleHeapUsed()
    const heapDeltaMb = (heapEnd - heapStart) / (1024 * 1024)
    const elapsedMs = performance.now() - startedAt

    const fullRefreshStat = stats(fullRefreshDurations)
    const fullRefreshEvaluationsStat = stats(fullRefreshEvaluations)
    const fullEvaluationsPerSecSamples = fullRefreshDurations.map((duration, index) => {
      if (!Number.isFinite(duration) || duration <= 0) {
        return 0
      }
      const evaluations = fullRefreshEvaluations[index] ?? (scenarioConfig.rows * scenarioConfig.formulas)
      return evaluations / (duration / 1000)
    })
    const fullEvaluationsPerSecStat = stats(fullEvaluationsPerSecSamples)

    return {
      mode,
      seed,
      scenario: scenarioName,
      config: {
        rows: scenarioConfig.rows,
        formulas: scenarioConfig.formulas,
        depthRequested: scenarioConfig.depth,
        depthActual: depthFromPlan,
        affectedByPatchFields,
      },
      compileMs: stats(compileDurations),
      initMs,
      fullRefreshMs: fullRefreshStat,
      fullEvaluations: fullRefreshEvaluationsStat,
      fullEvaluationsPerSec: fullEvaluationsPerSecStat.mean,
      fullEvaluationsPerSecStat,
      patch: patchBenchmarks,
      elapsedMs,
      heapDeltaMb,
    }
  } finally {
    await runtime.dispose()
  }
}

function getPatchEntry(run, patchSize) {
  const effectivePatchSize = Math.min(patchSize, run.config.rows)
  return run.patch.find(entry => entry.patchSize === effectivePatchSize) ?? null
}

function createMarkdownSummary(summary) {
  const lines = []
  lines.push("# Formula Engine Worker Compare Benchmarks")
  lines.push("")
  lines.push(`Generated: ${summary.generatedAt}`)
  lines.push("")
  lines.push("## Config")
  lines.push("")
  lines.push(`- Modes: ${summary.config.runtimeModes.join(", ")}`)
  lines.push(`- Scenarios: ${summary.config.scenarios.join(", ")}`)
  lines.push(`- Seeds: ${summary.config.seeds.join(", ")}`)
  lines.push(`- Patch sizes: ${summary.config.patchSizes.join(", ")}`)
  lines.push(`- Full refresh iterations: ${summary.config.fullRefreshIterations}`)
  lines.push(`- Patch iterations: ${summary.config.patchIterations}`)
  lines.push("")
  lines.push("## Results")
  lines.push("")
  lines.push("| mode | scenario | rows | formulas | depth | compile mean (ms) | init mean (ms) | full-setRows p95 (ms) | patch p95 (1) | patch p95 (100) | patch p95 (1000) | full eval/s | incr eval/s (patch=1000) |")
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")

  for (const aggregate of summary.aggregate.byModeScenario) {
    const patchP95 = new Map(aggregate.patch.map(entry => [entry.patchSize, entry.p95AcrossRunsMs.p95]))
    const patchTarget = aggregate.patch.find(entry => entry.patchSize === Math.min(1000, aggregate.config.rows))
    lines.push(
      `| ${aggregate.mode} | ${aggregate.name} | ${aggregate.config.rows} | ${aggregate.config.formulas} | ${aggregate.config.depth} | ${formatNumber(aggregate.compileMs.mean)} | ${formatNumber(aggregate.initMs.mean)} | ${formatNumber(aggregate.fullRefreshP95Ms.p95)} | ${formatNumber(patchP95.get(1) ?? 0)} | ${formatNumber(patchP95.get(100) ?? 0)} | ${formatNumber(patchP95.get(1000) ?? 0)} | ${formatNumber(aggregate.fullEvaluationsPerSec.mean, 0)} | ${formatNumber(patchTarget?.evaluationsPerSec.mean ?? 0, 0)} |`,
    )
  }

  if (summary.aggregate.speedups.length > 0) {
    lines.push("")
    lines.push("## Worker Speedup")
    lines.push("")
    lines.push("| scenario | init speedup (main/worker) | full speedup (main/worker) | patch speedup (main/worker, target patch) |")
    lines.push("| --- | ---: | ---: | ---: |")
    for (const speedup of summary.aggregate.speedups) {
      lines.push(
        `| ${speedup.scenario} | ${formatNumber(speedup.init)} | ${formatNumber(speedup.full)} | ${formatNumber(speedup.patch)} |`,
      )
    }
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

const coreApi = await loadCoreApi()
const workerApi = BENCH_RUNTIME_MODES.includes(RUNTIME_MODE_WORKER_OWNED)
  ? await loadWorkerApi()
  : null

const results = []
const budgetErrors = []

console.log("\nAffino DataGrid Formula Engine Worker Compare Benchmark")
console.log(
  `modes=${BENCH_RUNTIME_MODES.join(",")} scenarios=${BENCH_SCENARIOS.join(",")} seeds=${BENCH_SEEDS.join(",")} patchSizes=${BENCH_PATCH_SIZES.join(",")} fullIters=${BENCH_FULL_REFRESH_ITERATIONS} patchIters=${BENCH_PATCH_ITERATIONS}`,
)

for (const seed of BENCH_SEEDS) {
  for (let warmup = 0; warmup < BENCH_WARMUP_RUNS; warmup += 1) {
    for (const mode of BENCH_RUNTIME_MODES) {
      for (const scenarioName of BENCH_SCENARIOS) {
        await runScenarioMode({
          mode,
          scenarioName,
          seed: seed + (warmup + 1) * 997,
          coreApi,
          workerApi,
        })
      }
    }
  }

  for (const mode of BENCH_RUNTIME_MODES) {
    for (const scenarioName of BENCH_SCENARIOS) {
      const run = await runScenarioMode({
        mode,
        scenarioName,
        seed,
        coreApi,
        workerApi,
      })
      results.push(run)

      const patchSummary = run.patch
        .map(entry => `${entry.patchSize}:${entry.durationMs.p95.toFixed(3)}ms`)
        .join(" ")

      console.log(
        `seed=${seed} mode=${mode} scenario=${scenarioName} rows=${run.config.rows} formulas=${run.config.formulas} depth=${run.config.depthActual} init=${run.initMs.toFixed(3)}ms fullSetRowsP95=${run.fullRefreshMs.p95.toFixed(3)}ms fullEval/s=${run.fullEvaluationsPerSec.toFixed(0)} patchP95=[${patchSummary}] heapDelta=${run.heapDeltaMb.toFixed(2)}MB`,
      )
    }
  }
}

const aggregateElapsed = stats(results.map(run => run.elapsedMs))
const aggregateHeapDelta = stats(results.map(run => run.heapDeltaMb))

const aggregateByModeScenario = BENCH_RUNTIME_MODES.flatMap((mode) => {
  return BENCH_SCENARIOS.map((scenarioName) => {
    const scenarioRuns = results.filter(run => run.mode === mode && run.scenario === scenarioName)
    const scenarioConfig = SCENARIO_PRESETS[scenarioName]

    const patchBySize = BENCH_PATCH_SIZES.map((patchSize) => {
      const matches = scenarioRuns
        .map(run => getPatchEntry(run, patchSize))
        .filter(entry => Boolean(entry))
      return {
        patchSize,
        durationMs: stats(matches.map(entry => entry.durationMs.mean)),
        p95AcrossRunsMs: stats(matches.map(entry => entry.durationMs.p95)),
        evaluationsPerSec: stats(matches.map(entry => entry.evaluationsPerSec)),
      }
    })

    return {
      mode,
      name: scenarioName,
      config: scenarioConfig,
      compileMs: stats(scenarioRuns.map(run => run.compileMs.mean)),
      initMs: stats(scenarioRuns.map(run => run.initMs)),
      fullRefreshMs: stats(scenarioRuns.map(run => run.fullRefreshMs.mean)),
      fullRefreshP95Ms: stats(scenarioRuns.map(run => run.fullRefreshMs.p95)),
      fullEvaluationsPerSec: stats(scenarioRuns.map(run => run.fullEvaluationsPerSec)),
      patch: patchBySize,
      heapDeltaMb: stats(scenarioRuns.map(run => run.heapDeltaMb)),
    }
  })
})

const speedups = BENCH_SCENARIOS.map((scenarioName) => {
  const mainAggregate = aggregateByModeScenario.find(
    entry => entry.mode === RUNTIME_MODE_MAIN_THREAD && entry.name === scenarioName,
  )
  const workerAggregate = aggregateByModeScenario.find(
    entry => entry.mode === RUNTIME_MODE_WORKER_OWNED && entry.name === scenarioName,
  )
  if (!mainAggregate || !workerAggregate) {
    return null
  }

  const patchTargetSize = Math.min(PERF_BUDGET_WORKER_SPEEDUP_PATCH_SIZE, mainAggregate.config.rows)
  const mainPatch = mainAggregate.patch.find(entry => entry.patchSize === patchTargetSize)
  const workerPatch = workerAggregate.patch.find(entry => entry.patchSize === patchTargetSize)

  const initSpeedup = workerAggregate.initMs.mean > 0
    ? mainAggregate.initMs.mean / workerAggregate.initMs.mean
    : 0
  const fullSpeedup = workerAggregate.fullRefreshP95Ms.p95 > 0
    ? mainAggregate.fullRefreshP95Ms.p95 / workerAggregate.fullRefreshP95Ms.p95
    : 0
  const patchSpeedup = mainPatch && workerPatch && workerPatch.p95AcrossRunsMs.p95 > 0
    ? mainPatch.p95AcrossRunsMs.p95 / workerPatch.p95AcrossRunsMs.p95
    : 0

  return {
    scenario: scenarioName,
    patchTargetSize,
    init: initSpeedup,
    full: fullSpeedup,
    patch: patchSpeedup,
  }
}).filter(Boolean)

if (aggregateElapsed.p95 > PERF_BUDGET_TOTAL_MS) {
  budgetErrors.push(
    `aggregate elapsed p95 ${aggregateElapsed.p95.toFixed(2)}ms exceeds PERF_BUDGET_TOTAL_MS=${PERF_BUDGET_TOTAL_MS}ms`,
  )
}

if (aggregateHeapDelta.p95 > PERF_BUDGET_MAX_HEAP_DELTA_MB + PERF_BUDGET_HEAP_EPSILON_MB) {
  budgetErrors.push(
    `heap delta p95 ${aggregateHeapDelta.p95.toFixed(2)}MB exceeds PERF_BUDGET_MAX_HEAP_DELTA_MB=${PERF_BUDGET_MAX_HEAP_DELTA_MB}MB (epsilon ${PERF_BUDGET_HEAP_EPSILON_MB.toFixed(2)}MB)`,
  )
}

if (PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL > 0) {
  for (const entry of speedups) {
    if (entry.full < PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL) {
      budgetErrors.push(
        `scenario=${entry.scenario} worker full speedup ${entry.full.toFixed(3)} below PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL=${PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL.toFixed(3)}`,
      )
    }
  }
}

if (PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH > 0) {
  for (const entry of speedups) {
    if (entry.patch < PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH) {
      budgetErrors.push(
        `scenario=${entry.scenario} worker patch speedup(size=${entry.patchTargetSize}) ${entry.patch.toFixed(3)} below PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH=${PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH.toFixed(3)}`,
      )
    }
  }
}

const summary = {
  benchmark: "datagrid-formula-engine-worker-compare",
  generatedAt: new Date().toISOString(),
  config: {
    runtimeModes: BENCH_RUNTIME_MODES,
    scenarios: BENCH_SCENARIOS,
    seeds: BENCH_SEEDS,
    warmupRuns: BENCH_WARMUP_RUNS,
    fullRefreshIterations: BENCH_FULL_REFRESH_ITERATIONS,
    patchIterations: BENCH_PATCH_ITERATIONS,
    compileIterations: BENCH_COMPILE_ITERATIONS,
    patchSizes: BENCH_PATCH_SIZES,
  },
  budgets: {
    totalMs: PERF_BUDGET_TOTAL_MS,
    maxHeapDeltaMb: PERF_BUDGET_MAX_HEAP_DELTA_MB,
    heapEpsilonMb: PERF_BUDGET_HEAP_EPSILON_MB,
    minWorkerSpeedupFull: PERF_BUDGET_MIN_WORKER_SPEEDUP_FULL,
    minWorkerSpeedupPatch: PERF_BUDGET_MIN_WORKER_SPEEDUP_PATCH,
    workerSpeedupPatchSize: PERF_BUDGET_WORKER_SPEEDUP_PATCH_SIZE,
  },
  aggregate: {
    elapsedMs: aggregateElapsed,
    heapDeltaMb: aggregateHeapDelta,
    byModeScenario: aggregateByModeScenario,
    speedups,
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
  console.error("\nFormula worker compare benchmark budget check failed:")
  for (const error of budgetErrors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}
