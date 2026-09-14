#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const rowCount = Math.max(1, Number.parseInt(process.env.BENCH_RUNTIME_ROWS ?? "10000", 10))
const iterations = Math.max(3, Number.parseInt(process.env.BENCH_RUNTIME_ITERATIONS ?? "7", 10))
const outputPath = resolve(process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-runtime-lifecycle.json")

const { createClientRowModel } = await import("../packages/datagrid-core/dist/src/models/index.js")

function createRows(count) {
  return Array.from({ length: count }, (_, id) => ({
    row: { id, region: id % 3 === 0 ? "AMER" : id % 3 === 1 ? "EMEA" : "APAC", value: id },
    rowId: id,
  }))
}

function percentile(values, quantile) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))] ?? 0
}

const rows = createRows(rowCount)
const profiles = [
  ["plain", {}],
  ["sorted-filtered", {
    initialSortModel: [{ key: "value", direction: "desc" }],
    initialFilterModel: {
      columnFilters: [{ key: "region", operator: "equals", value: "AMER" }],
    },
  }],
  ["advanced", {
    initialGroupBy: { fields: ["region"], expandedByDefault: true },
    initialPivotModel: {
      rows: ["region"],
      columns: [],
      values: [{ field: "value", agg: "sum" }],
    },
    initialAggregationModel: {
      columns: [{ key: "value", field: "value", op: "sum" }],
    },
  }],
]

function measure(name, options) {
  const createSamples = []
  const disposeSamples = []
  let heapBefore = 0
  let heapAfter = 0
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (typeof global.gc === "function") global.gc()
    heapBefore = process.memoryUsage().heapUsed
    const createStarted = performance.now()
    const model = createClientRowModel({ rows, ...options })
    createSamples.push(performance.now() - createStarted)
    heapAfter = process.memoryUsage().heapUsed
    const disposeStarted = performance.now()
    model.dispose()
    disposeSamples.push(performance.now() - disposeStarted)
  }
  return {
    name,
    rowCount,
    iterations,
    createMs: { p50: percentile(createSamples, 0.5), p95: percentile(createSamples, 0.95), samples: createSamples },
    disposeMs: { p50: percentile(disposeSamples, 0.5), p95: percentile(disposeSamples, 0.95), samples: disposeSamples },
    heapDeltaMb: (heapAfter - heapBefore) / 1024 / 1024,
  }
}

const measurements = profiles.map(([name, options]) => measure(name, options))
const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  rowCount,
  iterations,
  measurement: "synchronous client-row-model factory-to-ready and dispose; rows allocated outside timed region; GC requested before each cycle when available",
  profiles: measurements,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n")
for (const profile of measurements) {
  console.log(`${profile.name}: createP50=${profile.createMs.p50.toFixed(2)}ms createP95=${profile.createMs.p95.toFixed(2)}ms disposeP95=${profile.disposeMs.p95.toFixed(2)}ms heapDelta=${profile.heapDeltaMb.toFixed(2)}MB`)
}
