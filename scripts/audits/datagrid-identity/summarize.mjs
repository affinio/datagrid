import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import os from "node:os"

const root = resolve(import.meta.dirname, "../../..")
const output = process.env.IDENTITY_OUTPUT ?? "/tmp/affino-identity-audit"
const target = process.env.IDENTITY_REPORT_JSON ?? `${output}/identity-results.json`
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
const hash = value => createHash("sha256").update(value).digest("hex")
const owners = [
  "packages/datagrid-core/src/models/dataSourceBackedRowModel.ts",
  "packages/datagrid-core/src/models/editModel.ts",
  "packages/datagrid-core/src/models/projection/groupProjectionController.ts",
  "packages/datagrid-core/src/models/projection/clientRowProjectionSort.ts",
  "packages/datagrid-core/src/models/tree/treeProjectionParentMaterializer.ts",
  "packages/datagrid-core/src/models/state/clientRowRuntimeStateStore.ts",
  "packages/datagrid-core/src/core/gridApiStateMethods.ts",
  "packages/datagrid-core/src/selection/virtualSelection.ts",
  "packages/datagrid-orchestration/src/runtime/useDataGridRuntimeService.ts",
  "packages/datagrid-orchestration/src/grouping/useDataGridGroupMetaOrchestration.ts",
  "packages/datagrid-vue/src/app-layer/host/DataGridDefaultRenderer.ts",
  "packages/datagrid-vue/src/app/useDataGridAppIntentHistory.ts",
]
const data = {
  capturedAt: new Date().toISOString(),
  commit: git(["rev-parse", "HEAD"]),
  environment: { node: process.version, platform: os.platform(), arch: os.arch(), pnpm: execFileSync("pnpm", ["--version"], { encoding: "utf8" }).trim() },
  workingTreeChangesAtCapture: git(["status", "--short"]).split("\n"),
  productTrackedDiffShaBefore: readFileSync(`${output}/product-diff-before.sha`, "utf8").split(/\s/)[0],
  productTrackedDiffShaAtCapture: hash(execFileSync("git", ["diff", "--binary", "--", "packages"], { cwd: root })),
  sourceSha256: Object.fromEntries(owners.map(file => [file, hash(readFileSync(resolve(root, file)))])),
  headless: JSON.parse(readFileSync(`${output}/headless.json`, "utf8")),
  vueJsdom: JSON.parse(readFileSync(`${output}/vue.json`, "utf8")),
}
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`)
console.log(target)
