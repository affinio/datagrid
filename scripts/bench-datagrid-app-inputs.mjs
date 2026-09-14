#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const rowCount = Number.parseInt(process.env.BENCH_APP_INPUT_ROWS ?? "100000", 10)
const iterations = Number.parseInt(process.env.BENCH_APP_INPUT_ITERATIONS ?? "100", 10)

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
function createRows(count) {
  return Array.from({ length: count }, (_, id) => ({
    row: { id, value: id, status: "ready" }, rowId: id,
  }))
}
function measure(label, createModel, update) {
  const model = createModel()
  const samples = []
  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const startedAt = performance.now()
      update(model, iteration)
      samples.push(performance.now() - startedAt)
    }
    return { label, p50Ms: percentile(samples, 0.5), p95Ms: percentile(samples, 0.95), maxMs: Math.max(...samples) }
  } finally {
    model.dispose()
  }
}

const createClientRowModel = await loadFactory()
const initialRows = createRows(rowCount)
const patchRows = Array.from({ length: iterations }, (_, iteration) => ({
  rowId: (iteration * 997) % rowCount,
  data: { status: `updated-${iteration}` },
}))
console.log(`app-inputs rows=${rowCount} iterations=${iterations}`)
console.table([
  measure("stable model + patchRows", () => createClientRowModel({ rows: initialRows }), (model, iteration) => {
    model.patchRows([patchRows[iteration]])
  }),
  measure("immutable replacement + setRows", () => createClientRowModel({ rows: initialRows }), (model, iteration) => {
    const nextRows = initialRows.slice()
    const update = patchRows[iteration]
    const rowIndex = update.rowId
    const current = nextRows[rowIndex]
    nextRows[rowIndex] = { ...current, row: { ...current.row, ...update.data } }
    model.setRows(nextRows)
  }),
])
