#!/usr/bin/env node

import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { dirname, resolve, join } from "node:path"

const require = createRequire(import.meta.url)
const outputPath = resolve(process.env.BENCH_OUTPUT_JSON ?? "artifacts/performance/bench-datagrid-ag-comparator.json")
const rowCount = Number.parseInt(process.env.BENCH_COMPARATOR_ROWS ?? "100000", 10)
const columnCount = Number.parseInt(process.env.BENCH_COMPARATOR_COLUMNS ?? "32", 10)

function packageVersion(name) {
  let directory = dirname(require.resolve(name))
  while (directory !== dirname(directory)) {
    const packageJson = join(directory, "package.json")
    try {
      return JSON.parse(readFileSync(packageJson, "utf8")).version
    } catch {
      directory = dirname(directory)
    }
  }
  throw new Error(`Unable to resolve ${name} package version`)
}

function buildRows(count) {
  return Array.from({ length: count }, (_, id) => ({
    id,
    region: ["AMER", "EMEA", "APAC"][id % 3],
    team: ["core", "growth", "platform", "payments"][id % 4],
    score: (id * 17) % 10000,
    label: `row-${id}`,
  }))
}

const rows = buildRows(rowCount)
const checksum = createHash("sha256").update(JSON.stringify(rows)).digest("hex")
const report = {
  generatedAt: new Date().toISOString(),
  versions: {
    agGridCommunity: packageVersion("ag-grid-community"),
    agGridVue3: packageVersion("ag-grid-vue3"),
    agGridEnterprise: packageVersion("ag-grid-enterprise"),
  },
  workload: {
    rowCount,
    columnCount,
    rowSchema: ["id", "region", "team", "score", "label"],
    checksum,
    profiles: [
      "plain-cells",
      "formatter-cells",
      "vue-renderer-cells",
      "pinned-left-right",
      "sorted-batched-updates",
    ],
    updatePolicy: "equal batches, same seed/data, warmup before measurement",
  },
  status: "fixture-manifest",
  browserRun: {
    required: true,
    license: "AG Grid Enterprise license must be provided by CI/local secret; no license value is stored in artifacts",
  },
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n")
console.log(`AG comparator manifest: ${rowCount} rows, ${columnCount} columns, checksum=${checksum}`)
console.log(`AG Grid ${report.versions.agGridEnterprise}; browser fixture required for timing comparison`)
