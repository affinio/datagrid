#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const rowCount = Number.parseInt(process.env.BENCH_SORTED_PATCH_ROWS ?? "100000", 10)
const iterations = Number.parseInt(process.env.BENCH_SORTED_PATCH_ITERATIONS ?? "12", 10)
const changeCounts = (process.env.BENCH_SORTED_PATCH_SIZES ?? "1,100,1000").split(",").map(Number)
const sortKeyMode = process.env.BENCH_SORTED_PATCH_MODE === "sort-key"

async function loadFactory() {
  for (const candidate of [resolve("packages/datagrid-core/dist/src/models/index.js"), resolve("packages/datagrid-core/dist/src/public.js")]) {
    if (!existsSync(candidate)) continue
    const module = await import(pathToFileURL(candidate).href)
    if (typeof module.createClientRowModel === "function") return module.createClientRowModel
  }
  throw new Error("Build @affino/datagrid-core before running this benchmark")
}
function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ?? 0
}
const createClientRowModel = await loadFactory()
const rows = Array.from({ length: rowCount }, (_, id) => ({
  row: { id, score: rowCount - id, label: `row-${id}` }, rowId: id, originalIndex: id, displayIndex: id,
}))
console.log(`sorted-patch mode=${sortKeyMode ? "sort-key" : "unrelated"} rows=${rowCount} iterations=${iterations}`)
for (const changeCount of changeCounts) {
  const model = createClientRowModel({ rows })
  const samples = []
  try {
    model.setSortModel([{ key: "score", direction: "asc" }])
    for (let warmup = 0; warmup < 2; warmup += 1) {
      model.patchRows(Array.from({ length: changeCount }, (_, index) => ({ rowId: index, data: { label: `warm-${warmup}-${index}` } })))
    }
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const updates = Array.from({ length: changeCount }, (_, index) => ({
        rowId: (iteration * changeCount + index) % rowCount,
        data: sortKeyMode
          ? { score: rowCount - ((iteration * changeCount + index) % rowCount) - iteration - 1 }
          : { label: `patch-${iteration}-${index}` },
      }))
      const startedAt = performance.now()
      model.patchRows(updates, sortKeyMode ? { recomputeSort: true } : undefined)
      samples.push(performance.now() - startedAt)
    }
    const first = model.getRowsInRange({ start: 0, end: 0 })[0]
    if (!sortKeyMode && first?.rowId !== rowCount - 1) throw new Error("sorted order changed during unrelated patch")
  } finally {
    model.dispose()
  }
  console.table([{ changedRows: changeCount, p50Ms: percentile(samples, 0.5), p95Ms: percentile(samples, 0.95), maxMs: Math.max(...samples) }])
}
