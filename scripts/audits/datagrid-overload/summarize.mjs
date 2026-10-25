import { readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import os from "node:os"
import { createHash } from "node:crypto"
const output = process.env.OVERLOAD_OUTPUT ?? "/tmp/affino-overload-audit"
const queues = JSON.parse(readFileSync(`${output}/queues.json`))
const browser = JSON.parse(readFileSync(`${output}/browser.json`))
const stat = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return { count: sorted.length, median: sorted[Math.floor(sorted.length / 2)] ?? null, min: sorted[0] ?? null, max: sorted.at(-1) ?? null }
}
const browserSummary = []
for (const n of [1000, 20000]) for (const kind of ["burst", "exclusive", "stream"]) {
  const rows = browser.results.filter(row => row.n === n && row.kind === kind)
  browserSummary.push({ n, kind, mutationMs: stat(rows.map(row => row.mutationMs)), settledMs: stat(rows.map(row => row.settledMs)), inputQueueDelayMs: stat(rows.flatMap(row => row.input.map(event => event.delayMs))), longTasks: rows.flatMap(row => row.longTasks.map(task => task.duration)) })
}
const packages = Object.fromEntries(["datagrid-core", "datagrid-orchestration", "datagrid-vue", "datagrid-worker", "datagrid-server-client"].map(name => [name, JSON.parse(readFileSync(`packages/${name}/package.json`)).version]))
const state = execFileSync("git", ["status", "--short"], { encoding: "utf8" }).split("\n").filter(Boolean)
const auditPaths = ["scripts/audits/datagrid-overload", "docs/internal/audits/datagrid-overload-audit-2026-10.md", "docs/internal/audits/202610/datagrid-overload-results.json"]
const sourceOwners = [
  "packages/datagrid-core/src/core/gridApiLifecycleRuntime.ts",
  "packages/datagrid-core/src/runtime/rafScheduler.ts",
  "packages/datagrid-core/src/models/server/dataSourceOptimisticMutationEngine.ts",
  "packages/datagrid-core/src/models/server/dataSourceOptimisticCommitRuntime.ts",
  "packages/datagrid-core/src/models/server/dataSourcePullSchedulingRuntime.ts",
  "packages/datagrid-orchestration/src/runtime/useDataGridCellRefreshBatcher.ts",
  "packages/datagrid-worker/src/workerOwnedRowModel.ts",
  "packages/datagrid-worker/src/postMessageTransport.ts",
  "packages/datagrid-server-client/src/changeFeedPoller.ts",
  "packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts",
]
const hash = data => createHash("sha256").update(data).digest("hex")
const sourceOwnerHashes = Object.fromEntries(sourceOwners.map(path => { const sha256 = hash(readFileSync(path)); return [path, { sha256, matchesHEAD: sha256 === hash(execFileSync("git", ["show", `HEAD:${path}`])) }] }))
const artifact = {
  audit: "overload/backpressure", capturedAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTreeChangesAtCapture: state.filter(line => !auditPaths.some(path => line.slice(3).startsWith(path))), sourceOwnerHashes,
  environment: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, osRelease: os.release(), logicalCPUs: os.cpus().length, cpu: os.cpus()[0]?.model, packages },
  diagnosticsWarning: "DIAGNOSTIC ONLY tests assert the observed defects, not product correctness.",
  queues, browserSummary, browser,
}
const target = process.env.OVERLOAD_REPORT_JSON ?? `${output}/results.json`
writeFileSync(target, JSON.stringify(artifact, null, 2) + "\n")
console.log(JSON.stringify({ target, queueScenarios: Object.keys(queues).length, browserSamples: browser.results.length, browserErrors: browser.errors }))
