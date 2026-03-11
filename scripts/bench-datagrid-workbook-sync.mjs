#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const BENCH_ITERATIONS = Number.parseInt(process.env.BENCH_WORKBOOK_SYNC_ITERATIONS ?? "40", 10)
const BENCH_ROW_COUNT = Number.parseInt(process.env.BENCH_WORKBOOK_SYNC_ROW_COUNT ?? "10000", 10)
const BENCH_PATCH_SIZE = Number.parseInt(process.env.BENCH_WORKBOOK_SYNC_PATCH_SIZE ?? "100", 10)
const BENCH_CHAIN_LENGTH = Number.parseInt(process.env.BENCH_WORKBOOK_CHAIN_LENGTH ?? "4", 10)
const BENCH_FANOUT_WIDTH = Number.parseInt(process.env.BENCH_WORKBOOK_FANOUT_WIDTH ?? "5", 10)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-workbook-sync.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-workbook-sync.md",
)

const PERF_BUDGET_MAX_CHAIN_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_CHAIN_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_FANOUT_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_FANOUT_P95_MS ?? "Infinity",
)

if (!Number.isInteger(BENCH_ITERATIONS) || BENCH_ITERATIONS <= 0) {
  throw new Error("BENCH_WORKBOOK_SYNC_ITERATIONS must be a positive integer.")
}
if (!Number.isInteger(BENCH_ROW_COUNT) || BENCH_ROW_COUNT <= 0) {
  throw new Error("BENCH_WORKBOOK_SYNC_ROW_COUNT must be a positive integer.")
}
if (!Number.isInteger(BENCH_PATCH_SIZE) || BENCH_PATCH_SIZE <= 0) {
  throw new Error("BENCH_WORKBOOK_SYNC_PATCH_SIZE must be a positive integer.")
}
if (!Number.isInteger(BENCH_CHAIN_LENGTH) || BENCH_CHAIN_LENGTH < 2) {
  throw new Error("BENCH_WORKBOOK_CHAIN_LENGTH must be >= 2.")
}
if (!Number.isInteger(BENCH_FANOUT_WIDTH) || BENCH_FANOUT_WIDTH < 1) {
  throw new Error("BENCH_WORKBOOK_FANOUT_WIDTH must be >= 1.")
}

function quantile(values, q) {
  if (values.length === 0) {
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
  if (values.length === 0) {
    return { mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    mean,
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

async function loadWorkbookApi() {
  const candidates = [
    resolve("packages/datagrid-core/dist/src/models/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    const module = await import(pathToFileURL(candidate).href)
    if (
      typeof module.createClientRowModel === "function"
      && typeof module.createClientWorkbookModel === "function"
    ) {
      return {
        createClientRowModel: module.createClientRowModel,
        createClientWorkbookModel: module.createClientWorkbookModel,
      }
    }
  }

  throw new Error(
    "Unable to locate datagrid-core build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
  )
}

function ensureOutputDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function formatMs(value) {
  return `${value.toFixed(3)} ms`
}

function assertBudget(label, value, budget) {
  if (value > budget) {
    throw new Error(`${label} exceeded budget: ${value.toFixed(3)}ms > ${budget.toFixed(3)}ms`)
  }
}

function buildOrdersRows(rowCount) {
  return Array.from({ length: rowCount }, (_, index) => ({
    id: `order-${index + 1}`,
    amount: (index % 20) + 1,
    tax: (index % 7) + 1,
  }))
}

function createOrdersHarness(api, rowCount) {
  const amounts = Array.from({ length: rowCount }, (_, index) => (index % 20) + 1)
  const orders = api.createClientRowModel({
    rows: buildOrdersRows(rowCount),
    resolveRowId: row => row.id,
  })

  const buildPatch = (iteration, patchSize) => {
    const updates = []
    for (let offset = 0; offset < patchSize; offset += 1) {
      const index = (iteration * patchSize + offset) % rowCount
      amounts[index] = (amounts[index] % 1000) + 1
      updates.push({
        rowId: `order-${index + 1}`,
        data: {
          amount: amounts[index],
        },
      })
    }
    return updates
  }

  return {
    orders,
    buildPatch,
  }
}

function createFormulaSheet(api, sheetId, formula) {
  return api.createClientRowModel({
    rows: [{ id: `${sheetId}-row` }],
    resolveRowId: row => row.id,
    initialFormulaFields: [{
      name: "value",
      field: "value",
      formula,
    }],
  })
}

function createChainScenario(api) {
  const source = createOrdersHarness(api, BENCH_ROW_COUNT)
  const sheets = [{
    id: "orders",
    name: "Orders",
    rowModel: source.orders,
    ownRowModel: true,
  }]

  let previousSheetId = "orders"
  for (let index = 1; index < BENCH_CHAIN_LENGTH; index += 1) {
    const sheetId = index === 1 ? "revenue" : `dashboard-${index - 1}`
    const formula = previousSheetId === "orders"
      ? "SUM(TABLE('orders', 'amount'))"
      : `SUM(TABLE('${previousSheetId}', 'value'))`
    sheets.push({
      id: sheetId,
      name: sheetId,
      rowModel: createFormulaSheet(api, sheetId, formula),
      ownRowModel: true,
    })
    previousSheetId = sheetId
  }

  const workbook = api.createClientWorkbookModel({ sheets })
  return {
    workbook,
    sample(iteration) {
      const startedAt = performance.now()
      source.orders.patchRows(source.buildPatch(iteration, BENCH_PATCH_SIZE))
      return performance.now() - startedAt
    },
  }
}

function createFanoutScenario(api) {
  const source = createOrdersHarness(api, BENCH_ROW_COUNT)
  const sheets = [{
    id: "orders",
    name: "Orders",
    rowModel: source.orders,
    ownRowModel: true,
  }]
  const summarySheetIds = []

  for (let index = 0; index < BENCH_FANOUT_WIDTH; index += 1) {
    const sheetId = `summary-${index + 1}`
    summarySheetIds.push(sheetId)
    sheets.push({
      id: sheetId,
      name: sheetId,
      rowModel: createFormulaSheet(api, sheetId, "SUM(TABLE('orders', 'amount'))"),
      ownRowModel: true,
    })
  }

  const dashboardFormula = summarySheetIds
    .map(sheetId => `SUM(TABLE('${sheetId}', 'value'))`)
    .join(" + ")

  sheets.push({
    id: "dashboard",
    name: "Dashboard",
    rowModel: createFormulaSheet(api, "dashboard", dashboardFormula),
    ownRowModel: true,
  })

  const workbook = api.createClientWorkbookModel({ sheets })
  return {
    workbook,
    sample(iteration) {
      const startedAt = performance.now()
      source.orders.patchRows(source.buildPatch(iteration, BENCH_PATCH_SIZE))
      return performance.now() - startedAt
    },
  }
}

function runScenario(factory) {
  const scenario = factory()
  const samples = []

  for (let iteration = 0; iteration < 3; iteration += 1) {
    scenario.sample(iteration)
  }

  for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
    samples.push(scenario.sample(iteration + 3))
  }

  scenario.workbook.dispose()
  return stats(samples)
}

const api = await loadWorkbookApi()
const chainStats = runScenario(() => createChainScenario(api))
const fanoutStats = runScenario(() => createFanoutScenario(api))

const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    iterations: BENCH_ITERATIONS,
    rowCount: BENCH_ROW_COUNT,
    patchSize: BENCH_PATCH_SIZE,
    chainLength: BENCH_CHAIN_LENGTH,
    fanoutWidth: BENCH_FANOUT_WIDTH,
  },
  chain: chainStats,
  fanout: fanoutStats,
}

assertBudget("chain.p95", summary.chain.p95, PERF_BUDGET_MAX_CHAIN_P95_MS)
assertBudget("fanout.p95", summary.fanout.p95, PERF_BUDGET_MAX_FANOUT_P95_MS)

ensureOutputDir(BENCH_OUTPUT_JSON)
ensureOutputDir(BENCH_OUTPUT_MARKDOWN)

writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
writeFileSync(BENCH_OUTPUT_MARKDOWN, [
  "# Workbook Sync Benchmark",
  "",
  `Generated at: ${summary.generatedAt}`,
  "",
  `Iterations: ${BENCH_ITERATIONS}`,
  `Row count: ${BENCH_ROW_COUNT}`,
  `Patch size: ${BENCH_PATCH_SIZE}`,
  `Chain length: ${BENCH_CHAIN_LENGTH}`,
  `Fanout width: ${BENCH_FANOUT_WIDTH}`,
  "",
  "## Chain",
  "",
  `- p95: ${formatMs(summary.chain.p95)}`,
  `- p99: ${formatMs(summary.chain.p99)}`,
  "",
  "## Fanout",
  "",
  `- p95: ${formatMs(summary.fanout.p95)}`,
  `- p99: ${formatMs(summary.fanout.p99)}`,
  "",
].join("\n"), "utf8")

console.log(JSON.stringify({
  json: BENCH_OUTPUT_JSON,
  markdown: BENCH_OUTPUT_MARKDOWN,
  chainP95Ms: summary.chain.p95,
  fanoutP95Ms: summary.fanout.p95,
}))
