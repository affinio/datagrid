#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const BENCH_ITERATIONS = Number.parseInt(process.env.BENCH_FORMULA_RELATIONS_ITERATIONS ?? "25", 10)
const BENCH_CUSTOMER_COUNT = Number.parseInt(process.env.BENCH_RELATION_CUSTOMER_COUNT ?? "5000", 10)
const BENCH_ORDER_COUNT = Number.parseInt(process.env.BENCH_RELATION_ORDER_COUNT ?? "50000", 10)
const BENCH_PATCH_SIZE = Number.parseInt(process.env.BENCH_RELATION_PATCH_SIZE ?? "200", 10)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-formula-relations.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-formula-relations.md",
)

const PERF_BUDGET_MAX_PATCH_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_PATCH_P95_MS ?? "Infinity",
)

if (!Number.isInteger(BENCH_ITERATIONS) || BENCH_ITERATIONS <= 0) {
  throw new Error("BENCH_FORMULA_RELATIONS_ITERATIONS must be a positive integer.")
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

function assertFreshRelationBuildArtifacts() {
  const formulaEngineSourceFile = resolve(
    "packages/datagrid-formula-engine/src/syntax/functionGroups/advancedFunctions.ts",
  )
  const formulaEngineDistFile = resolve(
    "packages/datagrid-formula-engine/dist/syntax/functionGroups/advancedFunctions.js",
  )

  if (!existsSync(formulaEngineDistFile)) {
    throw new Error(
      "Relation benchmark requires datagrid-formula-engine build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
    )
  }

  const formulaEngineDistSource = readFileSync(formulaEngineDistFile, "utf8")
  if (
    !formulaEngineDistSource.includes("RELATED:")
    || !formulaEngineDistSource.includes("ROLLUP:")
  ) {
    throw new Error(
      "Relation benchmark found stale datagrid-formula-engine artifacts without RELATED/ROLLUP. Run `pnpm --filter @affino/datagrid-core build`.",
    )
  }

  const formulaEngineSourceStat = statSync(formulaEngineSourceFile)
  const formulaEngineDistStat = statSync(formulaEngineDistFile)
  if (formulaEngineSourceStat.mtimeMs > formulaEngineDistStat.mtimeMs) {
    throw new Error(
      "Relation benchmark found outdated datagrid-formula-engine build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
    )
  }
}

async function loadCoreApi() {
  assertFreshRelationBuildArtifacts()

  const candidates = [
    resolve("packages/datagrid-core/dist/src/models/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    const module = await import(pathToFileURL(candidate).href)
    if (typeof module.createClientRowModel === "function") {
      return { createClientRowModel: module.createClientRowModel }
    }
  }

  throw new Error(
    "Unable to locate fresh datagrid-core build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
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

function buildCustomersRows() {
  return Array.from({ length: BENCH_CUSTOMER_COUNT }, (_, index) => ({
    id: index + 1,
    tier: index % 3 === 0 ? "enterprise" : "standard",
  }))
}

function buildOrdersRows() {
  return Array.from({ length: BENCH_ORDER_COUNT }, (_, index) => ({
    id: index + 1,
    customer_id: (index % BENCH_CUSTOMER_COUNT) + 1,
    amount: (index % 200) + 1,
    status: index % 4 === 0 ? "open" : "closed",
  }))
}

function createHarness(api) {
  const orders = buildOrdersRows()
  const customers = api.createClientRowModel({
    rows: buildCustomersRows(),
    resolveRowId: row => row.id,
    initialFormulaFields: [
      {
        name: "firstOrderAmount",
        field: "firstOrderAmount",
        formula: "RELATED('orders', id, 'customer_id', 'amount', 0)",
      },
      {
        name: "ordersTotal",
        field: "ordersTotal",
        formula: "ROLLUP('orders', 'customer_id', id, 'amount', 'sum', 0)",
      },
      {
        name: "orderCount",
        field: "orderCount",
        formula: "ROLLUP('orders', 'customer_id', id, 'status', 'count', 0)",
      },
    ],
  })

  customers.setFormulaTable("orders", { rows: orders })

  const mutateOrders = (iteration) => {
    for (let offset = 0; offset < BENCH_PATCH_SIZE; offset += 1) {
      const index = (iteration * BENCH_PATCH_SIZE + offset) % orders.length
      const row = orders[index]
      if (!row) {
        continue
      }
      row.amount = (row.amount % 1000) + 1
      row.status = row.status === "open" ? "closed" : "open"
    }
  }

  return {
    customers,
    sample(iteration) {
      mutateOrders(iteration)
      const startedAt = performance.now()
      customers.setFormulaTable("orders", { rows: orders })
      return performance.now() - startedAt
    },
  }
}

const api = await loadCoreApi()
const harness = createHarness(api)
const samples = []

for (let iteration = 0; iteration < 3; iteration += 1) {
  harness.sample(iteration)
}

for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
  samples.push(harness.sample(iteration + 3))
}

harness.customers.dispose()

const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    iterations: BENCH_ITERATIONS,
    customerCount: BENCH_CUSTOMER_COUNT,
    orderCount: BENCH_ORDER_COUNT,
    patchSize: BENCH_PATCH_SIZE,
  },
  patch: stats(samples),
}

assertBudget("patch.p95", summary.patch.p95, PERF_BUDGET_MAX_PATCH_P95_MS)

ensureOutputDir(BENCH_OUTPUT_JSON)
ensureOutputDir(BENCH_OUTPUT_MARKDOWN)

writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
writeFileSync(BENCH_OUTPUT_MARKDOWN, [
  "# Formula Relations Benchmark",
  "",
  `Generated at: ${summary.generatedAt}`,
  "",
  `Iterations: ${BENCH_ITERATIONS}`,
  `Customers: ${BENCH_CUSTOMER_COUNT}`,
  `Orders: ${BENCH_ORDER_COUNT}`,
  `Patch size: ${BENCH_PATCH_SIZE}`,
  "",
  "## Patch",
  "",
  `- p95: ${formatMs(summary.patch.p95)}`,
  `- p99: ${formatMs(summary.patch.p99)}`,
  "",
].join("\n"), "utf8")

console.log(JSON.stringify({
  json: BENCH_OUTPUT_JSON,
  markdown: BENCH_OUTPUT_MARKDOWN,
  patchP95Ms: summary.patch.p95,
}))
