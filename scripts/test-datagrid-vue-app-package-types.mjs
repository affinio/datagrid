import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)))
const packageDirectory = resolve(workspace, "packages/datagrid-vue-app")
const fixtureRoot = mkdtempSync(join(tmpdir(), "affino-datagrid-vue-app-packed-consumer-"))

try {
  const tarball = packPackage()
  runFixture("base", tarball, false)
  runFixture("gantt", tarball, true)
  console.log("AFFINO_DATAGRID_VUE_APP_PACKED_CONSUMERS_OK")
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true })
}

function packPackage() {
  const output = execFileSync("pnpm", ["pack", "--pack-destination", fixtureRoot], {
    cwd: packageDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
  const filename = output.trim().split("\n").at(-1)
  if (!filename) {
    throw new Error("pnpm pack produced no datagrid-vue-app tarball")
  }
  return resolve(fixtureRoot, filename)
}

function runFixture(name, tarball, withGantt) {
  const fixture = join(fixtureRoot, name)
  mkdirSync(join(fixture, "src"), { recursive: true })
  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    name: `affino-datagrid-vue-app-${name}-consumer`,
    private: true,
    type: "module",
    dependencies: {
      "@affino/datagrid-vue-app": `file:${tarball}`,
      ...(withGantt ? { "@affino/datagrid-gantt": "0.1.2" } : {}),
      vue: "3.4.38",
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
      'import { DataGrid, type DataGridProps } from "@affino/datagrid-vue-app"',
      "const component: typeof DataGrid = DataGrid",
      "const propsType: DataGridProps | undefined = undefined",
      "void component",
      "void propsType",
      "",
    ].join("\n"))

  run("npm", ["install", "--no-package-lock", "--ignore-scripts"], fixture)
  run("npm", ["exec", "--", "tsc", "-p", "tsconfig.json", "--noEmit"], fixture)
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" })
}
