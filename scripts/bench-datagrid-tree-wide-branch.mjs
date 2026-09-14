#!/usr/bin/env node

import { performance } from "node:perf_hooks"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const leafCount = Number.parseInt(process.env.BENCH_TREE_WIDE_BRANCH_ROWS ?? "150000", 10)
const iterations = Number.parseInt(process.env.BENCH_TREE_WIDE_BRANCH_ITERATIONS ?? "3", 10)
const heapProfile = process.env.BENCH_TREE_WIDE_BRANCH_HEAP === "true"
if (!Number.isInteger(leafCount) || leafCount <= 0) throw new Error("BENCH_TREE_WIDE_BRANCH_ROWS must be positive")
if (!Number.isInteger(iterations) || iterations <= 0) throw new Error("BENCH_TREE_WIDE_BRANCH_ITERATIONS must be positive")

async function loadFactory() {
  const candidates = [
    resolve("packages/datagrid-core/dist/src/models/index.js"),
    resolve("packages/datagrid-core/dist/src/public.js"),
  ]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const module = await import(pathToFileURL(candidate).href)
    if (typeof module.createClientRowModel === "function") return module.createClientRowModel
  }
  throw new Error("Build @affino/datagrid-core before running this benchmark")
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const quantile = q => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ?? 0
  return { p50Ms: quantile(0.5), p95Ms: quantile(0.95), p99Ms: quantile(0.99), maxMs: sorted.at(-1) ?? 0 }
}

function sampleHeapUsed() {
  if (typeof globalThis.gc === "function") globalThis.gc()
  return process.memoryUsage().heapUsed
}

function makeRows(mode) {
  if (mode === "path") {
    return Array.from({ length: leafCount }, (_, id) => ({
      row: { id, path: ["root"] }, rowId: id, originalIndex: id, displayIndex: id,
    }))
  }
  return Array.from({ length: leafCount + 1 }, (_, id) => ({
    row: { id: id === 0 ? "root" : id - 1, parentId: id === 0 ? null : "root" },
    rowId: id === 0 ? "root" : id - 1, originalIndex: id, displayIndex: id,
  }))
}

const createClientRowModel = await loadFactory()
console.log(`wide-tree-branch rows=${leafCount} iterations=${iterations}`)
for (const mode of ["path", "parent"]) {
  const model = createClientRowModel({
    rows: makeRows(mode),
    initialTreeData: mode === "path"
      ? { mode, getDataPath: row => row.path, expandedByDefault: true }
      : { mode, getParentId: row => row.parentId, expandedByDefault: true },
  })
  const expectedRows = leafCount + 1
  if (model.getRowCount() !== expectedRows) throw new Error(`${mode}: initial row count mismatch`)
  const key = mode === "path" ? "tree:path:4:root" : "tree:parent:root"
  const durations = []
  const heapStart = heapProfile ? sampleHeapUsed() : null
  let heapPeak = heapStart
  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      model.collapseGroup(key)
      if (model.getRowCount() !== 1) throw new Error(`${mode}: collapse row count mismatch`)
      const startedAt = performance.now()
      model.expandGroup(key)
      durations.push(performance.now() - startedAt)
      if (heapProfile) heapPeak = Math.max(heapPeak ?? 0, sampleHeapUsed())
      if (model.getRowCount() !== expectedRows) throw new Error(`${mode}: expand row count mismatch`)
      const last = model.getRowsInRange({ start: expectedRows - 1, end: expectedRows - 1 })[0]
      if (last?.rowId !== (mode === "path" ? leafCount - 1 : leafCount - 1)) throw new Error(`${mode}: row order mismatch`)
    }
  } finally {
    model.dispose()
  }
  const heapEnd = heapProfile ? sampleHeapUsed() : null
  console.table([{
    mode,
    ...stats(durations),
    ...(heapProfile ? {
      heapStartMb: (heapStart / (1024 * 1024)).toFixed(2),
      heapPeakMb: (heapPeak / (1024 * 1024)).toFixed(2),
      heapEndMb: (heapEnd / (1024 * 1024)).toFixed(2),
      heapDeltaMb: ((heapEnd - heapStart) / (1024 * 1024)).toFixed(2),
    } : {}),
  }])
}
