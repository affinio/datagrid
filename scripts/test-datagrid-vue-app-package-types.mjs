import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)))
const packageDist = resolve(workspace, "packages/datagrid-vue-app/dist")
const ganttDist = resolve(workspace, "packages/datagrid-gantt/dist/index.d.ts")
const consumer = mkdtempSync(join(tmpdir(), "affino-datagrid-vue-app-types-"))

try {
  writeFileSync(join(consumer, "base.ts"), [
    'import { DataGrid, type DataGridProps } from "@affino/datagrid-vue-app"',
    "const component: typeof DataGrid = DataGrid",
    "const propsType: DataGridProps | undefined = undefined",
    "void component",
    "void propsType",
    "",
  ].join("\n"))
  writeFileSync(join(consumer, "gantt.ts"), [
    'import { DataGrid } from "@affino/datagrid-vue-app/gantt"',
    'import type { DataGridGanttOptions, DataGridGanttProp } from "@affino/datagrid-vue-app/gantt"',
    "const options: DataGridGanttOptions = { startKey: \"start\", endKey: \"end\" }",
    "const prop: DataGridGanttProp = options",
    "const component: typeof DataGrid = DataGrid",
    "void prop",
    "void component",
    "",
  ].join("\n"))

  runTypecheck("base.ts", false)
  runTypecheck("gantt.ts", true)
  console.log("AFFINO_DATAGRID_VUE_APP_PACKAGE_TYPES_OK")
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

function runTypecheck(entry, includeGantt) {
  const tsconfig = join(consumer, `${entry}.tsconfig.json`)
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: false,
      paths: {
        "@affino/datagrid-vue-app": [resolve(packageDist, "index.d.ts")],
        "@affino/datagrid-vue-app/gantt": [resolve(packageDist, "gantt.d.ts")],
        "@affino/datagrid-gantt": includeGantt ? [ganttDist] : [join(consumer, "missing-gantt.d.ts")],
      },
    },
    files: [join(consumer, entry)],
  }, null, 2))
  execFileSync("pnpm", ["exec", "tsc", "-p", tsconfig, "--noEmit"], {
    cwd: workspace,
    stdio: "inherit",
  })
}
