#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const BENCH_ITERATIONS = Number.parseInt(process.env.BENCH_SPREADSHEET_SHEET_ITERATIONS ?? "30", 10)
const BENCH_ROW_COUNT = Number.parseInt(process.env.BENCH_SPREADSHEET_SHEET_ROW_COUNT ?? "10000", 10)
const BENCH_PATCH_SIZE = Number.parseInt(process.env.BENCH_SPREADSHEET_SHEET_PATCH_SIZE ?? "200", 10)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-spreadsheet-sheet.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-spreadsheet-sheet.md",
)

const PERF_BUDGET_MAX_PATCH_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_PATCH_P95_MS ?? "Infinity",
)

if (!Number.isInteger(BENCH_ITERATIONS) || BENCH_ITERATIONS <= 0) {
  throw new Error("BENCH_SPREADSHEET_SHEET_ITERATIONS must be a positive integer.")
}
if (!Number.isInteger(BENCH_ROW_COUNT) || BENCH_ROW_COUNT <= 0) {
  throw new Error("BENCH_SPREADSHEET_SHEET_ROW_COUNT must be a positive integer.")
}
if (!Number.isInteger(BENCH_PATCH_SIZE) || BENCH_PATCH_SIZE <= 0) {
  throw new Error("BENCH_SPREADSHEET_SHEET_PATCH_SIZE must be a positive integer.")
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

async function loadSpreadsheetApi() {
  const candidates = [
    resolve("packages/datagrid-core/dist/src/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    const module = await import(pathToFileURL(candidate).href)
    if (typeof module.createDataGridSpreadsheetSheetModel === "function") {
      return {
        createDataGridSpreadsheetSheetModel: module.createDataGridSpreadsheetSheetModel,
      }
    }
  }

  throw new Error(
    "Unable to locate datagrid-core spreadsheet build artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
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

function buildRows() {
  return Array.from({ length: BENCH_ROW_COUNT }, (_, rowIndex) => ({
    id: `row-${rowIndex + 1}`,
    cells: {
      price: String((rowIndex % 25) + 1),
      qty: String((rowIndex % 7) + 1),
      tax: String((rowIndex % 5) + 1),
      subtotal: "=[price]@row * [qty]@row",
      total: "=[subtotal]@row + [tax]@row",
    },
  }))
}

function createHarness(api) {
  const prices = Array.from({ length: BENCH_ROW_COUNT }, (_, rowIndex) => (rowIndex % 25) + 1)
  const sheet = api.createDataGridSpreadsheetSheetModel({
    sheetId: "bench",
    sheetName: "Bench",
    columns: [
      { key: "price" },
      { key: "qty" },
      { key: "tax" },
      { key: "subtotal" },
      { key: "total" },
    ],
    rows: buildRows(),
    referenceParserOptions: {
      syntax: "smartsheet",
    },
  })

  return {
    sheet,
    sample(iteration) {
      const patches = []
      for (let offset = 0; offset < BENCH_PATCH_SIZE; offset += 1) {
        const rowIndex = (iteration * BENCH_PATCH_SIZE + offset) % BENCH_ROW_COUNT
        prices[rowIndex] = (prices[rowIndex] % 1000) + 1
        patches.push({
          cell: {
            sheetId: "bench",
            rowId: `row-${rowIndex + 1}`,
            rowIndex,
            columnKey: "price",
          },
          rawInput: String(prices[rowIndex]),
        })
      }
      const startedAt = performance.now()
      sheet.setCellInputs(patches)
      return performance.now() - startedAt
    },
  }
}

const api = await loadSpreadsheetApi()
const harness = createHarness(api)
const samples = []

for (let iteration = 0; iteration < 3; iteration += 1) {
  harness.sample(iteration)
}

for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
  samples.push(harness.sample(iteration + 3))
}

harness.sheet.dispose()

const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    iterations: BENCH_ITERATIONS,
    rowCount: BENCH_ROW_COUNT,
    patchSize: BENCH_PATCH_SIZE,
  },
  patch: stats(samples),
}

assertBudget("patch.p95", summary.patch.p95, PERF_BUDGET_MAX_PATCH_P95_MS)

ensureOutputDir(BENCH_OUTPUT_JSON)
ensureOutputDir(BENCH_OUTPUT_MARKDOWN)

writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
writeFileSync(BENCH_OUTPUT_MARKDOWN, [
  "# Spreadsheet Sheet Benchmark",
  "",
  `Generated at: ${summary.generatedAt}`,
  "",
  `Iterations: ${BENCH_ITERATIONS}`,
  `Rows: ${BENCH_ROW_COUNT}`,
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
