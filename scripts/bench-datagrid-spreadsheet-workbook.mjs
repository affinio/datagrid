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
const BENCH_WARMUP_RUNS = Number.parseInt(process.env.BENCH_WARMUP_RUNS ?? "1", 10)
const BENCH_ITERATIONS = Number.parseInt(process.env.BENCH_SPREADSHEET_WORKBOOK_ITERATIONS ?? "8", 10)
const BENCH_ORDERS_ROW_COUNT = Number.parseInt(process.env.BENCH_SPREADSHEET_ORDERS_ROW_COUNT ?? "12000", 10)
const BENCH_CUSTOMER_COUNT = Number.parseInt(process.env.BENCH_SPREADSHEET_CUSTOMER_COUNT ?? "3000", 10)
const BENCH_JOIN_FANOUT = Number.parseInt(process.env.BENCH_SPREADSHEET_JOIN_FANOUT ?? "3", 10)
const BENCH_PATCH_SIZE = Number.parseInt(process.env.BENCH_SPREADSHEET_PATCH_SIZE ?? "48", 10)
const BENCH_REWRITE_FORMULA_ROWS = Number.parseInt(
  process.env.BENCH_SPREADSHEET_REWRITE_FORMULA_ROWS ?? "320",
  10,
)
const BENCH_OUTPUT_JSON = resolve(
  process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-spreadsheet-workbook.json",
)
const BENCH_OUTPUT_MARKDOWN = resolve(
  process.env.BENCH_OUTPUT_MARKDOWN ?? "artifacts/performance/bench-datagrid-spreadsheet-workbook.md",
)

const PERF_BUDGET_TOTAL_MS = Number.parseFloat(process.env.PERF_BUDGET_TOTAL_MS ?? "Infinity")
const PERF_BUDGET_MAX_SYNC_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_SYNC_P95_MS ?? "Infinity")
const PERF_BUDGET_MAX_SYNC_PASS_P95 = Number.parseFloat(process.env.PERF_BUDGET_MAX_SYNC_PASS_P95 ?? "Infinity")
const PERF_BUDGET_MAX_REMATERIALIZATION_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_REMATERIALIZATION_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_CROSS_SHEET_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_CROSS_SHEET_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_REWRITE_INSERT_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_REWRITE_INSERT_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_REWRITE_REMOVE_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_REWRITE_REMOVE_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_EXPORT_P95_MS = Number.parseFloat(process.env.PERF_BUDGET_MAX_EXPORT_P95_MS ?? "Infinity")
const PERF_BUDGET_MAX_RESTORE_P95_MS = Number.parseFloat(
  process.env.PERF_BUDGET_MAX_RESTORE_P95_MS ?? "Infinity",
)
const PERF_BUDGET_MAX_HEAP_DELTA_MB = Number.parseFloat(process.env.PERF_BUDGET_MAX_HEAP_DELTA_MB ?? "Infinity")
const PERF_BUDGET_MAX_VARIANCE_PCT = Number.parseFloat(process.env.PERF_BUDGET_MAX_VARIANCE_PCT ?? "Infinity")
const PERF_BUDGET_VARIANCE_MIN_MEAN_MS = Number.parseFloat(process.env.PERF_BUDGET_VARIANCE_MIN_MEAN_MS ?? "0.5")

const REFERENCE_OPTIONS = Object.freeze({
  syntax: "smartsheet",
  smartsheetAbsoluteRowBase: 1,
  allowSheetQualifiedReferences: true,
})

const STATUS_VALUES = Object.freeze(["Draft", "Active", "Won", "Paused"])
const QUARTER_VALUES = Object.freeze(["Q1", "Q2", "Q3", "Q4"])
const REGION_VALUES = Object.freeze(["UK", "US", "DE", "FR", "CA", "AU"])
const TIER_VALUES = Object.freeze(["SMB", "Growth", "Scale", "Enterprise"])
const ROLE_VALUES = Object.freeze(["Owner", "Champion", "Procurement", "Ops"])

assertPositiveInteger(BENCH_ITERATIONS, "BENCH_SPREADSHEET_WORKBOOK_ITERATIONS")
assertPositiveInteger(BENCH_ORDERS_ROW_COUNT, "BENCH_SPREADSHEET_ORDERS_ROW_COUNT")
assertPositiveInteger(BENCH_CUSTOMER_COUNT, "BENCH_SPREADSHEET_CUSTOMER_COUNT")
assertPositiveInteger(BENCH_JOIN_FANOUT, "BENCH_SPREADSHEET_JOIN_FANOUT")
assertPositiveInteger(BENCH_PATCH_SIZE, "BENCH_SPREADSHEET_PATCH_SIZE")
assertPositiveInteger(BENCH_REWRITE_FORMULA_ROWS, "BENCH_SPREADSHEET_REWRITE_FORMULA_ROWS")
assertNonNegativeInteger(BENCH_WARMUP_RUNS, "BENCH_WARMUP_RUNS")
if (BENCH_SEEDS.length === 0) {
  throw new Error("BENCH_SEEDS must include at least one positive integer.")
}

function assertPositiveInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
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

function pickStats(values) {
  return stats(values.map(value => Number(value) || 0))
}

function ensureOutputDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function formatMs(value) {
  return `${value.toFixed(3)} ms`
}

function formatMb(value) {
  return `${value.toFixed(3)} MB`
}

function formatCount(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let result = Math.imul(state ^ (state >>> 15), 1 | state)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(random, maxExclusive) {
  return Math.floor(random() * maxExclusive)
}

function safeGc() {
  if (typeof globalThis.gc === "function") {
    globalThis.gc()
  }
}

function heapUsedMb() {
  return process.memoryUsage().heapUsed / (1024 * 1024)
}

function currentHeapDeltaMb(beforeMb) {
  return Math.max(0, heapUsedMb() - beforeMb)
}

async function loadSpreadsheetApi() {
  const candidates = [
    resolve("packages/datagrid-core/dist/src/public.js"),
    resolve("packages/datagrid-core/dist/src/index.js"),
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue
    }
    const module = await import(pathToFileURL(candidate).href)
    if (typeof module.createDataGridSpreadsheetWorkbookModel === "function") {
      return {
        createDataGridSpreadsheetWorkbookModel: module.createDataGridSpreadsheetWorkbookModel,
      }
    }
  }

  throw new Error(
    "Unable to locate datagrid-core spreadsheet workbook artifacts. Run `pnpm --filter @affino/datagrid-core build`.",
  )
}

function createCustomersRows(seed) {
  const random = mulberry32(seed)
  return Array.from({ length: BENCH_CUSTOMER_COUNT }, (_, index) => {
    const customerNumber = index + 1
    return {
      id: `customer-${customerNumber}`,
      cells: {
        id: customerNumber,
        name: `Customer ${customerNumber}`,
        region: REGION_VALUES[randomInt(random, REGION_VALUES.length)],
        tier: TIER_VALUES[randomInt(random, TIER_VALUES.length)],
      },
    }
  })
}

function createOrdersRows(seed) {
  const random = mulberry32(seed ^ 0x9e3779b9)
  return Array.from({ length: BENCH_ORDERS_ROW_COUNT }, (_, index) => {
    const orderNumber = index + 1
    return {
      id: `order-${orderNumber}`,
      cells: {
        orderId: `SO-${100000 + orderNumber}`,
        customerId: (index % BENCH_CUSTOMER_COUNT) + 1,
        status: STATUS_VALUES[randomInt(random, STATUS_VALUES.length)],
        quarter: QUARTER_VALUES[randomInt(random, QUARTER_VALUES.length)],
        qty: (index % 9) + 1,
        price: 50 + ((index * 13) % 450),
        total: "=[qty]@row * [price]@row",
      },
    }
  })
}

function createContactsRows(seed) {
  const random = mulberry32(seed ^ 0x85ebca6b)
  const rows = []
  for (let customerId = 1; customerId <= BENCH_CUSTOMER_COUNT; customerId += 1) {
    for (let offset = 0; offset < BENCH_JOIN_FANOUT; offset += 1) {
      rows.push({
        id: `contact-${customerId}-${offset + 1}`,
        cells: {
          customerId,
          contactName: `Contact ${customerId}-${offset + 1}`,
          role: ROLE_VALUES[(offset + randomInt(random, ROLE_VALUES.length)) % ROLE_VALUES.length],
        },
      })
    }
  }
  return rows
}

function createSummaryRows(pivotMeasureColumnKey) {
  return [
    { id: "summary-1", cells: { metric: "Gross orders", value: "=SUM(TABLE('orders', 'total'))" } },
    {
      id: "summary-2",
      cells: {
        metric: "First order total",
        value: "=orders![total]1",
      },
    },
    {
      id: "summary-3",
      cells: {
        metric: "First enriched tier",
        value: "=orders-enriched![tier]1",
      },
    },
    {
      id: "summary-4",
      cells: {
        metric: "Grouped revenue",
        value: "=SUM(TABLE('orders-by-region', 'revenue'))",
      },
    },
    {
      id: "summary-5",
      cells: {
        metric: "Pivot max",
        value: `=MAX(TABLE('orders-pivot', '${pivotMeasureColumnKey}'))`,
      },
    },
    {
      id: "summary-6",
      cells: {
        metric: "Explode contact rows",
        value: "=SUM(TABLE('orders-contacts', 'customerId'))",
      },
    },
  ]
}

function createWorkbookInput(pivotMeasureColumnKey, seed) {
  return {
    activeSheetId: "summary",
    sheets: [
      {
        id: "orders",
        name: "Orders",
        sheetModelOptions: {
          referenceParserOptions: REFERENCE_OPTIONS,
          columns: [
            { key: "orderId", title: "Order" },
            { key: "customerId", title: "Customer ID" },
            { key: "status", title: "Status" },
            { key: "quarter", title: "Quarter" },
            { key: "qty", title: "Qty" },
            { key: "price", title: "Price" },
            { key: "total", title: "Total" },
          ],
          rows: createOrdersRows(seed),
        },
      },
      {
        id: "customers",
        name: "Customers",
        sheetModelOptions: {
          referenceParserOptions: REFERENCE_OPTIONS,
          columns: [
            { key: "id", title: "ID" },
            { key: "name", title: "Name" },
            { key: "region", title: "Region" },
            { key: "tier", title: "Tier" },
          ],
          rows: createCustomersRows(seed),
        },
      },
      {
        id: "contacts",
        name: "Contacts",
        sheetModelOptions: {
          columns: [
            { key: "customerId", title: "Customer ID" },
            { key: "contactName", title: "Contact" },
            { key: "role", title: "Role" },
          ],
          rows: createContactsRows(seed),
        },
      },
      {
        id: "orders-enriched",
        name: "Orders enriched",
        kind: "view",
        sourceSheetId: "orders",
        pipeline: [
          {
            type: "join",
            sheetId: "customers",
            on: {
              leftKey: "customerId",
              rightKey: "id",
            },
            select: [
              { key: "name", as: "customerName" },
              { key: "region" },
              { key: "tier" },
            ],
          },
        ],
      },
      {
        id: "orders-by-region",
        name: "Orders by region",
        kind: "view",
        sourceSheetId: "orders-enriched",
        pipeline: [
          {
            type: "group",
            by: [
              { key: "region", label: "Region" },
              { key: "tier", label: "Tier" },
            ],
            aggregations: [
              { key: "ordersCount", field: "orderId", agg: "count", label: "Orders" },
              { key: "revenue", field: "total", agg: "sum", label: "Revenue" },
            ],
          },
          {
            type: "sort",
            fields: [
              { key: "revenue", direction: "desc" },
              { key: "region", direction: "asc" },
            ],
          },
        ],
      },
      {
        id: "orders-pivot",
        name: "Orders pivot",
        kind: "view",
        sourceSheetId: "orders-enriched",
        pipeline: [
          {
            type: "pivot",
            spec: {
              rows: ["region"],
              columns: ["quarter", "status"],
              values: [{ field: "total", agg: "sum" }],
              columnGrandTotal: true,
            },
          },
        ],
      },
      {
        id: "orders-contacts",
        name: "Orders contacts",
        kind: "view",
        sourceSheetId: "orders",
        pipeline: [
          {
            type: "join",
            sheetId: "contacts",
            on: {
              leftKey: "customerId",
              rightKey: "customerId",
            },
            select: [
              { key: "contactName" },
              { key: "role" },
            ],
            multiMatch: "explode",
          },
        ],
      },
      {
        id: "summary",
        name: "Summary",
        sheetModelOptions: {
          referenceParserOptions: REFERENCE_OPTIONS,
          columns: [
            { key: "metric", title: "Metric" },
            { key: "value", title: "Value" },
          ],
          rows: createSummaryRows(pivotMeasureColumnKey),
        },
      },
    ],
  }
}

function createRewriteWorkbookInput() {
  return {
    activeSheetId: "summary",
    sheets: [
      {
        id: "orders",
        name: "Orders",
        sheetModelOptions: {
          referenceParserOptions: REFERENCE_OPTIONS,
          columns: [
            { key: "qty", title: "Qty" },
            { key: "price", title: "Price" },
            { key: "total", title: "Total" },
          ],
          rows: Array.from({ length: BENCH_ORDERS_ROW_COUNT }, (_, index) => ({
            id: `order-${index + 1}`,
            cells: {
              qty: (index % 7) + 1,
              price: 100 + (index % 17),
              total: "=[qty]@row * [price]@row",
            },
          })),
        },
      },
      {
        id: "summary",
        name: "Summary",
        sheetModelOptions: {
          referenceParserOptions: REFERENCE_OPTIONS,
          columns: [
            { key: "metric", title: "Metric" },
            { key: "value", title: "Value" },
          ],
          rows: Array.from({ length: BENCH_REWRITE_FORMULA_ROWS }, (_, index) => {
            const left = ((index * 3) % Math.max(3, BENCH_ORDERS_ROW_COUNT - 2)) + 1
            const middle = left + 1
            const right = left + 2
            return {
              id: `summary-${index + 1}`,
              cells: {
                metric: `Rewrite ${index + 1}`,
                value: `=orders![total]${left} + orders![total]${middle} + orders![total]${right}`,
              },
            }
          }),
        },
      },
    ],
  }
}

function countChangedSheets(beforeSnapshot, afterSnapshot) {
  const beforeRevisions = new Map(beforeSnapshot.sheets.map(sheet => [sheet.id, sheet.revision]))
  const changedSheetIds = afterSnapshot.sheets
    .filter(sheet => beforeRevisions.get(sheet.id) !== sheet.revision)
    .map(sheet => sheet.id)
  return {
    count: changedSheetIds.length,
    sheetIds: changedSheetIds,
  }
}

function readSummaryValue(workbook, rowId) {
  return workbook.getSheet("summary")?.sheetModel.getCell({
    sheetId: "summary",
    rowId,
    rowIndex: Number.parseInt(String(rowId).replace(/^\D+/g, ""), 10) - 1 || 0,
    columnKey: "value",
  })?.displayValue ?? null
}

function readSummaryRawInput(workbook, rowId) {
  return workbook.getSheet("summary")?.sheetModel.getCell({
    sheetId: "summary",
    rowId,
    rowIndex: Number.parseInt(String(rowId).replace(/^\D+/g, ""), 10) - 1 || 0,
    columnKey: "value",
  })?.rawInput ?? null
}

function summarizeScope(samples) {
  const counts = samples.map(sample => sample.count)
  const sheetCounts = new Map()
  for (const sample of samples) {
    for (const sheetId of sample.sheetIds) {
      sheetCounts.set(sheetId, (sheetCounts.get(sheetId) ?? 0) + 1)
    }
  }
  return {
    changedSheets: pickStats(counts),
    hotSheets: [...sheetCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([sheetId, hits]) => ({ sheetId, hits })),
  }
}

async function discoverPivotMeasureColumnKey(api) {
  const probeInput = createWorkbookInput("total", BENCH_SEEDS[0] ?? BENCH_SEED)
  const summarySheet = probeInput.sheets.find(sheet => sheet.id === "summary")
  if (summarySheet?.sheetModelOptions?.rows?.[4]?.cells) {
    summarySheet.sheetModelOptions.rows[4].cells.value = "=SUM(TABLE('orders', 'total'))"
  }
  const workbook = api.createDataGridSpreadsheetWorkbookModel(probeInput)
  try {
    workbook.sync()
    const pivotSheet = workbook.getSheet("orders-pivot")?.sheetModel
    const pivotColumn = pivotSheet?.getColumns().find(column => column.key.startsWith("pivot|"))
    if (!pivotColumn) {
      throw new Error("Unable to resolve a generated pivot measure column key for spreadsheet benchmarks.")
    }
    return pivotColumn.key
  } finally {
    workbook.dispose()
  }
}

function createWorkbook(api, pivotMeasureColumnKey, seed) {
  return api.createDataGridSpreadsheetWorkbookModel(createWorkbookInput(pivotMeasureColumnKey, seed))
}

function createRewriteWorkbook(api) {
  return api.createDataGridSpreadsheetWorkbookModel(createRewriteWorkbookInput())
}

function measureWorkbookSync(api, pivotMeasureColumnKey, seed) {
  safeGc()
  const beforeHeapMb = heapUsedMb()
  const workbook = createWorkbook(api, pivotMeasureColumnKey, seed)
  try {
    const startedAt = performance.now()
    workbook.sync()
    const elapsedMs = performance.now() - startedAt
    safeGc()
    const heapDeltaMb = currentHeapDeltaMb(beforeHeapMb)
    const snapshot = workbook.getSnapshot()
    const pivotSheet = workbook.getSheet("orders-pivot")?.sheetModel
    const explodeSheet = workbook.getSheet("orders-contacts")?.sheetModel
    const generatedPivotColumns = pivotSheet?.getColumns().filter(column => column.key.startsWith("pivot|")).length ?? 0
    const summaryPivotValue = readSummaryValue(workbook, "summary-5")

    return {
      elapsedMs,
      heapDeltaMb,
      passCount: snapshot.sync.passCount,
      converged: snapshot.sync.converged,
      diagnosticsCount: snapshot.diagnostics.length,
      generatedPivotColumns,
      explodeRowCount: explodeSheet?.getSnapshot().rowCount ?? 0,
      summaryPivotValue: Number(summaryPivotValue) || 0,
    }
  } finally {
    workbook.dispose()
    safeGc()
  }
}

function measureRematerialization(api, pivotMeasureColumnKey, seed) {
  const workbook = createWorkbook(api, pivotMeasureColumnKey, seed)
  const elapsedSamples = []
  const passCountSamples = []
  const scopeSamples = []
  const summarySamples = []

  try {
    workbook.sync()
    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    if (!ordersSheet) {
      throw new Error("Orders sheet is missing.")
    }

    const measureIteration = iteration => {
      const patches = []
      for (let offset = 0; offset < BENCH_PATCH_SIZE; offset += 1) {
        const rowIndex = (iteration * BENCH_PATCH_SIZE + offset) % BENCH_ORDERS_ROW_COUNT
        patches.push({
          cell: {
            sheetId: "orders",
            rowId: `order-${rowIndex + 1}`,
            rowIndex,
            columnKey: "qty",
          },
          rawInput: String(((iteration + offset) % 11) + 1),
        })
      }
      const beforeSnapshot = workbook.getSnapshot()
      const startedAt = performance.now()
      ordersSheet.setCellInputs(patches)
      const elapsedMs = performance.now() - startedAt
      const afterSnapshot = workbook.getSnapshot()
      elapsedSamples.push(elapsedMs)
      passCountSamples.push(afterSnapshot.sync.passCount)
      scopeSamples.push(countChangedSheets(beforeSnapshot, afterSnapshot))
      summarySamples.push(Number(readSummaryValue(workbook, "summary-4")) || 0)
    }

    for (let iteration = 0; iteration < BENCH_WARMUP_RUNS; iteration += 1) {
      measureIteration(iteration)
      elapsedSamples.pop()
      passCountSamples.pop()
      scopeSamples.pop()
      summarySamples.pop()
    }

    for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
      measureIteration(iteration + BENCH_WARMUP_RUNS)
    }

    return {
      elapsedMs: stats(elapsedSamples),
      passCount: pickStats(passCountSamples),
      scope: summarizeScope(scopeSamples),
      summaryValue: pickStats(summarySamples),
    }
  } finally {
    workbook.dispose()
  }
}

function measureCrossSheetRecompute(api, pivotMeasureColumnKey, seed) {
  const workbook = createWorkbook(api, pivotMeasureColumnKey, seed)
  const elapsedSamples = []
  const passCountSamples = []
  const scopeSamples = []
  const summarySamples = []

  try {
    workbook.sync()
    const customersSheet = workbook.getSheet("customers")?.sheetModel
    if (!customersSheet) {
      throw new Error("Customers sheet is missing.")
    }

    const measureIteration = iteration => {
      const rowIndex = iteration % BENCH_CUSTOMER_COUNT
      const customerId = rowIndex + 1
      const currentRegion = customersSheet.getCell({
        sheetId: "customers",
        rowId: `customer-${customerId}`,
        rowIndex,
        columnKey: "region",
      })?.displayValue
      const nextRegion = REGION_VALUES.find(region => region !== currentRegion) ?? REGION_VALUES[0]
      const beforeSnapshot = workbook.getSnapshot()
      const startedAt = performance.now()
      customersSheet.setCellInput({
        sheetId: "customers",
        rowId: `customer-${customerId}`,
        rowIndex,
        columnKey: "region",
      }, nextRegion)
      const elapsedMs = performance.now() - startedAt
      const afterSnapshot = workbook.getSnapshot()
      elapsedSamples.push(elapsedMs)
      passCountSamples.push(afterSnapshot.sync.passCount)
      scopeSamples.push(countChangedSheets(beforeSnapshot, afterSnapshot))
      summarySamples.push(Number(readSummaryValue(workbook, "summary-5")) || 0)
    }

    for (let iteration = 0; iteration < BENCH_WARMUP_RUNS; iteration += 1) {
      measureIteration(iteration)
      elapsedSamples.pop()
      passCountSamples.pop()
      scopeSamples.pop()
      summarySamples.pop()
    }

    for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
      measureIteration(iteration + BENCH_WARMUP_RUNS)
    }

    return {
      elapsedMs: stats(elapsedSamples),
      passCount: pickStats(passCountSamples),
      scope: summarizeScope(scopeSamples),
      summaryValue: pickStats(summarySamples),
    }
  } finally {
    workbook.dispose()
  }
}

function measureDirectRefRewrite(api) {
  const workbook = createRewriteWorkbook(api)
  const insertSamples = []
  const removeSamples = []
  const insertPassCountSamples = []
  const removePassCountSamples = []
  const insertScopeSamples = []
  const removeScopeSamples = []

  try {
    workbook.sync()
    const ordersSheet = workbook.getSheet("orders")?.sheetModel
    if (!ordersSheet) {
      throw new Error("Orders sheet is missing for rewrite benchmark.")
    }

    const baselineFormula = readSummaryRawInput(workbook, "summary-1")
    if (baselineFormula !== "=orders![total]1 + orders![total]2 + orders![total]3") {
      throw new Error(`Unexpected baseline rewrite formula: ${String(baselineFormula)}`)
    }

    const measureIteration = iteration => {
      const insertedRowId = `inserted-${iteration + 1}`
      const beforeInsertSnapshot = workbook.getSnapshot()
      const insertStartedAt = performance.now()
      ordersSheet.insertRowsAt(0, [{
        id: insertedRowId,
        cells: {
          qty: 1,
          price: 99,
          total: "=[qty]@row * [price]@row",
        },
      }])
      const insertElapsedMs = performance.now() - insertStartedAt
      const afterInsertSnapshot = workbook.getSnapshot()
      const shiftedFormula = readSummaryRawInput(workbook, "summary-1")
      if (shiftedFormula !== "=orders![total]2 + orders![total]3 + orders![total]4") {
        throw new Error(`Insert rewrite failed: ${String(shiftedFormula)}`)
      }

      insertSamples.push(insertElapsedMs)
      insertPassCountSamples.push(afterInsertSnapshot.sync.passCount)
      insertScopeSamples.push(countChangedSheets(beforeInsertSnapshot, afterInsertSnapshot))

      const beforeRemoveSnapshot = workbook.getSnapshot()
      const removeStartedAt = performance.now()
      ordersSheet.removeRowsAt(0, 1)
      const removeElapsedMs = performance.now() - removeStartedAt
      const afterRemoveSnapshot = workbook.getSnapshot()
      const restoredFormula = readSummaryRawInput(workbook, "summary-1")
      if (restoredFormula !== baselineFormula) {
        throw new Error(`Remove rewrite failed: ${String(restoredFormula)}`)
      }

      removeSamples.push(removeElapsedMs)
      removePassCountSamples.push(afterRemoveSnapshot.sync.passCount)
      removeScopeSamples.push(countChangedSheets(beforeRemoveSnapshot, afterRemoveSnapshot))
    }

    for (let iteration = 0; iteration < BENCH_WARMUP_RUNS; iteration += 1) {
      measureIteration(iteration)
      insertSamples.pop()
      removeSamples.pop()
      insertPassCountSamples.pop()
      removePassCountSamples.pop()
      insertScopeSamples.pop()
      removeScopeSamples.pop()
    }

    for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
      measureIteration(iteration + BENCH_WARMUP_RUNS)
    }

    return {
      insert: {
        elapsedMs: stats(insertSamples),
        passCount: pickStats(insertPassCountSamples),
        scope: summarizeScope(insertScopeSamples),
      },
      remove: {
        elapsedMs: stats(removeSamples),
        passCount: pickStats(removePassCountSamples),
        scope: summarizeScope(removeScopeSamples),
      },
    }
  } finally {
    workbook.dispose()
  }
}

function measureExportRestore(api, pivotMeasureColumnKey, seed) {
  const workbook = createWorkbook(api, pivotMeasureColumnKey, seed)
  const exportSamples = []
  const restoreSamples = []
  const snapshotBytesSamples = []

  try {
    workbook.sync()
    const measureIteration = iteration => {
      const exportStartedAt = performance.now()
      const exportedState = workbook.exportState()
      const exportElapsedMs = performance.now() - exportStartedAt
      exportSamples.push(exportElapsedMs)
      snapshotBytesSamples.push(Buffer.byteLength(JSON.stringify(exportedState), "utf8"))

      const rowIndex = iteration % BENCH_ORDERS_ROW_COUNT
      const ordersSheet = workbook.getSheet("orders")?.sheetModel
      if (!ordersSheet) {
        throw new Error("Orders sheet is missing for export/restore benchmark.")
      }
      ordersSheet.setCellInput({
        sheetId: "orders",
        rowId: `order-${rowIndex + 1}`,
        rowIndex,
        columnKey: "price",
      }, 999 + iteration)

      const restoreStartedAt = performance.now()
      const restored = workbook.restoreState(exportedState)
      const restoreElapsedMs = performance.now() - restoreStartedAt
      if (!restored) {
        throw new Error("Workbook restoreState returned false.")
      }
      restoreSamples.push(restoreElapsedMs)
    }

    for (let iteration = 0; iteration < BENCH_WARMUP_RUNS; iteration += 1) {
      measureIteration(iteration)
      exportSamples.pop()
      restoreSamples.pop()
      snapshotBytesSamples.pop()
    }

    for (let iteration = 0; iteration < BENCH_ITERATIONS; iteration += 1) {
      measureIteration(iteration + BENCH_WARMUP_RUNS)
    }

    return {
      exportMs: stats(exportSamples),
      restoreMs: stats(restoreSamples),
      snapshotBytes: pickStats(snapshotBytesSamples),
    }
  } finally {
    workbook.dispose()
  }
}

function aggregateRuns(runSummaries) {
  const syncElapsed = []
  const syncPassCount = []
  const syncHeapDelta = []
  const syncDiagnostics = []
  const pivotColumns = []
  const explodeRows = []

  const rematerializationElapsed = []
  const rematerializationPassCount = []
  const rematerializationScope = []

  const crossSheetElapsed = []
  const crossSheetPassCount = []
  const crossSheetScope = []

  const rewriteInsertElapsed = []
  const rewriteInsertPassCount = []
  const rewriteInsertScope = []
  const rewriteRemoveElapsed = []
  const rewriteRemovePassCount = []
  const rewriteRemoveScope = []

  const exportElapsed = []
  const restoreElapsed = []
  const snapshotBytes = []

  for (const run of runSummaries) {
    syncElapsed.push(run.workbookSync.elapsedMs)
    syncPassCount.push(run.workbookSync.passCount)
    syncHeapDelta.push(run.workbookSync.heapDeltaMb)
    syncDiagnostics.push(run.workbookSync.diagnosticsCount)
    pivotColumns.push(run.workbookSync.generatedPivotColumns)
    explodeRows.push(run.workbookSync.explodeRowCount)

    rematerializationElapsed.push(run.rematerialization.elapsedMs.p95)
    rematerializationPassCount.push(run.rematerialization.passCount.p95)
    rematerializationScope.push(run.rematerialization.scope.changedSheets.p95)

    crossSheetElapsed.push(run.crossSheet.elapsedMs.p95)
    crossSheetPassCount.push(run.crossSheet.passCount.p95)
    crossSheetScope.push(run.crossSheet.scope.changedSheets.p95)

    rewriteInsertElapsed.push(run.directRefRewrite.insert.elapsedMs.p95)
    rewriteInsertPassCount.push(run.directRefRewrite.insert.passCount.p95)
    rewriteInsertScope.push(run.directRefRewrite.insert.scope.changedSheets.p95)
    rewriteRemoveElapsed.push(run.directRefRewrite.remove.elapsedMs.p95)
    rewriteRemovePassCount.push(run.directRefRewrite.remove.passCount.p95)
    rewriteRemoveScope.push(run.directRefRewrite.remove.scope.changedSheets.p95)

    exportElapsed.push(run.exportRestore.exportMs.p95)
    restoreElapsed.push(run.exportRestore.restoreMs.p95)
    snapshotBytes.push(run.exportRestore.snapshotBytes.p95)
  }

  return {
    workbookSync: {
      elapsedMs: stats(syncElapsed),
      passCount: pickStats(syncPassCount),
      heapDeltaMb: stats(syncHeapDelta),
      diagnosticsCount: pickStats(syncDiagnostics),
      generatedPivotColumns: pickStats(pivotColumns),
      explodeRowCount: pickStats(explodeRows),
    },
    rematerialization: {
      elapsedMs: stats(rematerializationElapsed),
      passCount: pickStats(rematerializationPassCount),
      scope: pickStats(rematerializationScope),
    },
    crossSheet: {
      elapsedMs: stats(crossSheetElapsed),
      passCount: pickStats(crossSheetPassCount),
      scope: pickStats(crossSheetScope),
    },
    directRefRewrite: {
      insertElapsedMs: stats(rewriteInsertElapsed),
      insertPassCount: pickStats(rewriteInsertPassCount),
      insertScope: pickStats(rewriteInsertScope),
      removeElapsedMs: stats(rewriteRemoveElapsed),
      removePassCount: pickStats(rewriteRemovePassCount),
      removeScope: pickStats(rewriteRemoveScope),
    },
    exportRestore: {
      exportMs: stats(exportElapsed),
      restoreMs: stats(restoreElapsed),
      snapshotBytes: pickStats(snapshotBytes),
    },
  }
}

function checkBudgetErrors(summary) {
  const errors = []

  const varianceChecks = [
    ["workbookSync.elapsedMs.cvPct", summary.aggregate.workbookSync.elapsedMs.cvPct],
    ["rematerialization.elapsedMs.cvPct", summary.aggregate.rematerialization.elapsedMs.cvPct],
    ["crossSheet.elapsedMs.cvPct", summary.aggregate.crossSheet.elapsedMs.cvPct],
    ["directRefRewrite.insertElapsedMs.cvPct", summary.aggregate.directRefRewrite.insertElapsedMs.cvPct],
    ["directRefRewrite.removeElapsedMs.cvPct", summary.aggregate.directRefRewrite.removeElapsedMs.cvPct],
    ["exportRestore.exportMs.cvPct", summary.aggregate.exportRestore.exportMs.cvPct],
    ["exportRestore.restoreMs.cvPct", summary.aggregate.exportRestore.restoreMs.cvPct],
  ]
  for (const [label, value] of varianceChecks) {
    const meanPath = label.replace(".cvPct", ".mean")
    const meanValue = meanPath === "workbookSync.elapsedMs.mean"
      ? summary.aggregate.workbookSync.elapsedMs.mean
      : meanPath === "rematerialization.elapsedMs.mean"
        ? summary.aggregate.rematerialization.elapsedMs.mean
        : meanPath === "crossSheet.elapsedMs.mean"
          ? summary.aggregate.crossSheet.elapsedMs.mean
          : meanPath === "directRefRewrite.insertElapsedMs.mean"
            ? summary.aggregate.directRefRewrite.insertElapsedMs.mean
            : meanPath === "directRefRewrite.removeElapsedMs.mean"
              ? summary.aggregate.directRefRewrite.removeElapsedMs.mean
              : meanPath === "exportRestore.exportMs.mean"
                ? summary.aggregate.exportRestore.exportMs.mean
                : summary.aggregate.exportRestore.restoreMs.mean
    if (meanValue >= PERF_BUDGET_VARIANCE_MIN_MEAN_MS && value > PERF_BUDGET_MAX_VARIANCE_PCT) {
      errors.push(`${label} exceeded variance budget: ${value.toFixed(3)} > ${PERF_BUDGET_MAX_VARIANCE_PCT.toFixed(3)}`)
    }
  }

  if (summary.elapsedMs > PERF_BUDGET_TOTAL_MS) {
    errors.push(`total elapsed exceeded budget: ${summary.elapsedMs.toFixed(3)}ms > ${PERF_BUDGET_TOTAL_MS.toFixed(3)}ms`)
  }
  if (summary.aggregate.workbookSync.elapsedMs.p95 > PERF_BUDGET_MAX_SYNC_P95_MS) {
    errors.push(
      `workbookSync.elapsedMs.p95 exceeded budget: ${summary.aggregate.workbookSync.elapsedMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_SYNC_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.workbookSync.passCount.p95 > PERF_BUDGET_MAX_SYNC_PASS_P95) {
    errors.push(
      `workbookSync.passCount.p95 exceeded budget: ${summary.aggregate.workbookSync.passCount.p95.toFixed(3)} > ${PERF_BUDGET_MAX_SYNC_PASS_P95.toFixed(3)}`,
    )
  }
  if (summary.aggregate.rematerialization.elapsedMs.p95 > PERF_BUDGET_MAX_REMATERIALIZATION_P95_MS) {
    errors.push(
      `rematerialization.elapsedMs.p95 exceeded budget: ${summary.aggregate.rematerialization.elapsedMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_REMATERIALIZATION_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.crossSheet.elapsedMs.p95 > PERF_BUDGET_MAX_CROSS_SHEET_P95_MS) {
    errors.push(
      `crossSheet.elapsedMs.p95 exceeded budget: ${summary.aggregate.crossSheet.elapsedMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_CROSS_SHEET_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.directRefRewrite.insertElapsedMs.p95 > PERF_BUDGET_MAX_REWRITE_INSERT_P95_MS) {
    errors.push(
      `directRefRewrite.insertElapsedMs.p95 exceeded budget: ${summary.aggregate.directRefRewrite.insertElapsedMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_REWRITE_INSERT_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.directRefRewrite.removeElapsedMs.p95 > PERF_BUDGET_MAX_REWRITE_REMOVE_P95_MS) {
    errors.push(
      `directRefRewrite.removeElapsedMs.p95 exceeded budget: ${summary.aggregate.directRefRewrite.removeElapsedMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_REWRITE_REMOVE_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.exportRestore.exportMs.p95 > PERF_BUDGET_MAX_EXPORT_P95_MS) {
    errors.push(
      `exportRestore.exportMs.p95 exceeded budget: ${summary.aggregate.exportRestore.exportMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_EXPORT_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.exportRestore.restoreMs.p95 > PERF_BUDGET_MAX_RESTORE_P95_MS) {
    errors.push(
      `exportRestore.restoreMs.p95 exceeded budget: ${summary.aggregate.exportRestore.restoreMs.p95.toFixed(3)}ms > ${PERF_BUDGET_MAX_RESTORE_P95_MS.toFixed(3)}ms`,
    )
  }
  if (summary.aggregate.workbookSync.heapDeltaMb.p95 > PERF_BUDGET_MAX_HEAP_DELTA_MB) {
    errors.push(
      `workbookSync.heapDeltaMb.p95 exceeded budget: ${summary.aggregate.workbookSync.heapDeltaMb.p95.toFixed(3)}MB > ${PERF_BUDGET_MAX_HEAP_DELTA_MB.toFixed(3)}MB`,
    )
  }

  return errors
}

function createMarkdownSummary(summary) {
  return [
    "# Spreadsheet Workbook Benchmark",
    "",
    `Generated at: ${summary.generatedAt}`,
    `Status: ${summary.ok ? "OK" : "FAILED"}`,
    "",
    "## Config",
    "",
    `- Seeds: ${summary.config.seeds.join(", ")}`,
    `- Iterations: ${summary.config.iterations}`,
    `- Warmup runs: ${summary.config.warmupRuns}`,
    `- Orders: ${summary.config.ordersRowCount}`,
    `- Customers: ${summary.config.customerCount}`,
    `- Join fanout: ${summary.config.joinFanout}`,
    `- Patch size: ${summary.config.patchSize}`,
    `- Rewrite formulas: ${summary.config.rewriteFormulaRows}`,
    "",
    "## Aggregate",
    "",
    `- workbook.sync() p95: ${formatMs(summary.aggregate.workbookSync.elapsedMs.p95)} | pass p95 ${formatCount(summary.aggregate.workbookSync.passCount.p95)} | heap p95 ${formatMb(summary.aggregate.workbookSync.heapDeltaMb.p95)}`,
    `- rematerialization p95: ${formatMs(summary.aggregate.rematerialization.elapsedMs.p95)} | scope p95 ${formatCount(summary.aggregate.rematerialization.scope.p95)} sheets`,
    `- cross-sheet recompute p95: ${formatMs(summary.aggregate.crossSheet.elapsedMs.p95)} | scope p95 ${formatCount(summary.aggregate.crossSheet.scope.p95)} sheets`,
    `- insert rewrite p95: ${formatMs(summary.aggregate.directRefRewrite.insertElapsedMs.p95)} | remove rewrite p95: ${formatMs(summary.aggregate.directRefRewrite.removeElapsedMs.p95)}`,
    `- export p95: ${formatMs(summary.aggregate.exportRestore.exportMs.p95)} | restore p95: ${formatMs(summary.aggregate.exportRestore.restoreMs.p95)} | snapshot bytes p95 ${formatCount(summary.aggregate.exportRestore.snapshotBytes.p95)}`,
    `- generated pivot columns p95: ${formatCount(summary.aggregate.workbookSync.generatedPivotColumns.p95)} | explode rows p95: ${formatCount(summary.aggregate.workbookSync.explodeRowCount.p95)}`,
    "",
    ...(summary.budgetErrors.length > 0
      ? [
        "## Budget Errors",
        "",
        ...summary.budgetErrors.map(error => `- ${error}`),
        "",
      ]
      : []),
  ].join("\n")
}

const benchStartedAt = performance.now()
const api = await loadSpreadsheetApi()
const pivotMeasureColumnKey = await discoverPivotMeasureColumnKey(api)
const runSummaries = []

for (const seed of BENCH_SEEDS) {
  console.log(
    `[spreadsheet-workbook] seed=${seed} orders=${BENCH_ORDERS_ROW_COUNT} customers=${BENCH_CUSTOMER_COUNT} fanout=${BENCH_JOIN_FANOUT}`,
  )
  runSummaries.push({
    seed,
    workbookSync: measureWorkbookSync(api, pivotMeasureColumnKey, seed),
    rematerialization: measureRematerialization(api, pivotMeasureColumnKey, seed),
    crossSheet: measureCrossSheetRecompute(api, pivotMeasureColumnKey, seed),
    directRefRewrite: measureDirectRefRewrite(api),
    exportRestore: measureExportRestore(api, pivotMeasureColumnKey, seed),
  })
}

const summary = {
  generatedAt: new Date().toISOString(),
  elapsedMs: performance.now() - benchStartedAt,
  config: {
    seeds: BENCH_SEEDS,
    warmupRuns: BENCH_WARMUP_RUNS,
    iterations: BENCH_ITERATIONS,
    ordersRowCount: BENCH_ORDERS_ROW_COUNT,
    customerCount: BENCH_CUSTOMER_COUNT,
    joinFanout: BENCH_JOIN_FANOUT,
    patchSize: BENCH_PATCH_SIZE,
    rewriteFormulaRows: BENCH_REWRITE_FORMULA_ROWS,
    pivotMeasureColumnKey,
  },
  budgets: {
    totalMs: PERF_BUDGET_TOTAL_MS,
    syncP95Ms: PERF_BUDGET_MAX_SYNC_P95_MS,
    syncPassP95: PERF_BUDGET_MAX_SYNC_PASS_P95,
    rematerializationP95Ms: PERF_BUDGET_MAX_REMATERIALIZATION_P95_MS,
    crossSheetP95Ms: PERF_BUDGET_MAX_CROSS_SHEET_P95_MS,
    rewriteInsertP95Ms: PERF_BUDGET_MAX_REWRITE_INSERT_P95_MS,
    rewriteRemoveP95Ms: PERF_BUDGET_MAX_REWRITE_REMOVE_P95_MS,
    exportP95Ms: PERF_BUDGET_MAX_EXPORT_P95_MS,
    restoreP95Ms: PERF_BUDGET_MAX_RESTORE_P95_MS,
    heapDeltaP95Mb: PERF_BUDGET_MAX_HEAP_DELTA_MB,
    variancePct: PERF_BUDGET_MAX_VARIANCE_PCT,
    varianceMinMeanMs: PERF_BUDGET_VARIANCE_MIN_MEAN_MS,
  },
  runs: runSummaries,
  aggregate: aggregateRuns(runSummaries),
}

summary.budgetErrors = checkBudgetErrors(summary)
summary.ok = summary.budgetErrors.length === 0

ensureOutputDir(BENCH_OUTPUT_JSON)
ensureOutputDir(BENCH_OUTPUT_MARKDOWN)

writeFileSync(BENCH_OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
writeFileSync(BENCH_OUTPUT_MARKDOWN, `${createMarkdownSummary(summary)}\n`, "utf8")

console.log(`Benchmark summary written: ${BENCH_OUTPUT_JSON}`)
console.log(`Benchmark markdown written: ${BENCH_OUTPUT_MARKDOWN}`)
console.log(
  [
    `sync.p95=${summary.aggregate.workbookSync.elapsedMs.p95.toFixed(3)}ms`,
    `remat.p95=${summary.aggregate.rematerialization.elapsedMs.p95.toFixed(3)}ms`,
    `cross.p95=${summary.aggregate.crossSheet.elapsedMs.p95.toFixed(3)}ms`,
    `rewriteInsert.p95=${summary.aggregate.directRefRewrite.insertElapsedMs.p95.toFixed(3)}ms`,
    `rewriteRemove.p95=${summary.aggregate.directRefRewrite.removeElapsedMs.p95.toFixed(3)}ms`,
    `export.p95=${summary.aggregate.exportRestore.exportMs.p95.toFixed(3)}ms`,
    `restore.p95=${summary.aggregate.exportRestore.restoreMs.p95.toFixed(3)}ms`,
    `heap.p95=${summary.aggregate.workbookSync.heapDeltaMb.p95.toFixed(3)}MB`,
  ].join(" "),
)

if (!summary.ok) {
  throw new Error(summary.budgetErrors.join("\n"))
}
