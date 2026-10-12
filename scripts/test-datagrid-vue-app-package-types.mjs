import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)))
const packageDirectory = resolve(workspace, "packages/datagrid-vue-app")
const fixtureRoot = mkdtempSync(join(tmpdir(), "affino-datagrid-vue-app-packed-consumer-"))

try {
  const tarballs = {
    core: packPackage("datagrid-core"),
    orchestration: packPackage("datagrid-orchestration"),
    worker: packPackage("datagrid-worker"),
    gantt: packPackage("datagrid-gantt"),
    vue: packPackage("datagrid-vue"),
    app: packPackage("datagrid-vue-app"),
  }
  runFixture("base", tarballs, false)
  runFixture("gantt", tarballs, true)
  console.log("AFFINO_DATAGRID_VUE_APP_PACKED_CONSUMERS_OK")
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true })
}

function packPackage(packageName) {
  const packageDirectory = resolve(workspace, `packages/${packageName}`)
  const output = execFileSync("pnpm", ["pack", "--pack-destination", fixtureRoot], {
    cwd: packageDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
  const filename = output.trim().split("\n").at(-1)
  if (!filename) {
    throw new Error(`pnpm pack produced no tarball for ${packageName}`)
  }
  return resolve(fixtureRoot, filename)
}

function runFixture(name, tarballs, withGantt) {
  const fixture = join(fixtureRoot, name)
  mkdirSync(join(fixture, "src"), { recursive: true })
  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    name: `affino-datagrid-vue-app-${name}-consumer`,
    private: true,
    type: "module",
    dependencies: {
      "@affino/datagrid-core": `file:${tarballs.core}`,
      "@affino/datagrid-orchestration": `file:${tarballs.orchestration}`,
      "@affino/datagrid-worker": `file:${tarballs.worker}`,
      "@affino/datagrid-gantt": `file:${tarballs.gantt}`,
      "@affino/datagrid-vue": `file:${tarballs.vue}`,
      "@affino/datagrid-vue-app": `file:${tarballs.app}`,
      vue: "3.5.22",
    },
    devDependencies: {
      typescript: "7.0.2",
    },
  }, null, 2))
  writeFileSync(join(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: false,
      lib: ["ES2022", "DOM"],
    },
    include: ["src/**/*.ts"],
  }, null, 2))
  writeFileSync(join(fixture, "src/index.ts"), withGantt
    ? [
      'import { DataGrid } from "@affino/datagrid-vue-app/gantt"',
      'import type { DataGridGanttOptions, DataGridGanttProp } from "@affino/datagrid-vue-app/gantt"',
      "const options: DataGridGanttOptions = { startKey: \"start\", endKey: \"end\" }",
      "const prop: DataGridGanttProp = options",
      "const component: typeof DataGrid = DataGrid",
      "void prop",
      "void component",
      "",
    ].join("\n")
    : [
      'import { DataGrid, type DataGridProps, type DataGridRowsEditedEvent } from "@affino/datagrid-vue-app"',
      'import type { DataGridApiRowsEditedEvent, DataGridApplyEditsOptions } from "@affino/datagrid-vue"',
      "const component: typeof DataGrid = DataGrid",
      "const propsType: DataGridProps | undefined = undefined",
      "const event: DataGridRowsEditedEvent<{ id: string }> | DataGridApiRowsEditedEvent<{ id: string }> | undefined = undefined",
      'const options: DataGridApplyEditsOptions = { source: "grid" }',
      "void component",
      "void propsType",
      "void event",
      "void options",
      "",
    ].join("\n"))

  run("npm", ["install", "--no-package-lock", "--ignore-scripts"], fixture)
  run("npm", ["exec", "--", "tsc", "-p", "tsconfig.json", "--noEmit"], fixture)
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" })
}
