#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const artifactPath = resolve(process.env.BENCH_COMPARATOR_ARTIFACT ?? "artifacts/performance/bench-datagrid-ag-comparator.json")
const expectedVersion = "36.1.0"
const requiredProfiles = [
  "plain-cells",
  "formatter-cells",
  "vue-renderer-cells",
  "pinned-left-right",
  "sorted-batched-updates",
]

const artifact = JSON.parse(readFileSync(artifactPath, "utf8"))
const workload = artifact.workload ?? {}
const rowCount = Number(workload.rowCount)
const columnCount = Number(workload.columnCount)
if (!Number.isInteger(rowCount) || rowCount <= 0) throw new Error("AG comparator rowCount must be a positive integer")
if (!Number.isInteger(columnCount) || columnCount <= 0) throw new Error("AG comparator columnCount must be a positive integer")
const rows = Array.from({ length: rowCount }, (_, id) => ({
  id,
  region: ["AMER", "EMEA", "APAC"][id % 3],
  team: ["core", "growth", "platform", "payments"][id % 4],
  score: (id * 17) % 10000,
  label: `row-${id}`,
}))
const checksum = createHash("sha256").update(JSON.stringify(rows)).digest("hex")
if (workload.checksum !== checksum) throw new Error(`AG comparator checksum mismatch: expected ${checksum}, got ${workload.checksum}`)
for (const name of ["agGridCommunity", "agGridVue3", "agGridEnterprise"]) {
  if (artifact.versions?.[name] !== expectedVersion) throw new Error(`${name} must be pinned to ${expectedVersion}`)
}
for (const profile of requiredProfiles) {
  if (!workload.profiles?.includes(profile)) throw new Error(`AG comparator profile missing: ${profile}`)
}
if (artifact.status !== "fixture-manifest" || artifact.browserRun?.required !== true) {
  throw new Error("AG comparator artifact must remain an explicit browser fixture manifest")
}
console.log(`AG comparator manifest OK: ${rowCount} rows, ${columnCount} columns, checksum=${checksum}`)
