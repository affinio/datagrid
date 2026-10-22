import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = resolve(fileURLToPath(new URL("..", import.meta.url)))
const fixtureRoot = mkdtempSync(join(tmpdir(), "affino-datagrid-vue-packed-consumer-"))

try {
  const tarballs = {
    core: packPackage("datagrid-core"),
    exportXlsx: packPackage("export-xlsx"),
    formulaEngine: packPackage("datagrid-formula-engine"),
    theme: packPackage("datagrid-theme"),
    orchestration: packPackage("datagrid-orchestration"),
    worker: packPackage("datagrid-worker"),
    gantt: packPackage("datagrid-gantt"),
    vue: packPackage("datagrid-vue"),
  }
  runFixture("table-and-headless", tarballs, false)
  runFixture("gantt", tarballs, true)
  console.log("AFFINO_DATAGRID_VUE_PACKED_CONSUMERS_OK")
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
  if (!filename) throw new Error(`pnpm pack produced no tarball for ${packageName}`)
  return resolve(fixtureRoot, filename)
}

function runFixture(name, tarballs, withGantt) {
  const fixture = join(fixtureRoot, name)
  mkdirSync(join(fixture, "src"), { recursive: true })
  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    name: `affino-datagrid-vue-${name}-consumer`,
    private: true,
    type: "module",
    dependencies: {
      "@affino/datagrid-core": `file:${tarballs.core}`,
      "@affino/export-xlsx": `file:${tarballs.exportXlsx}`,
      "@affino/datagrid-formula-engine": `file:${tarballs.formulaEngine}`,
      "@affino/datagrid-theme": `file:${tarballs.theme}`,
      "@affino/datagrid-orchestration": `file:${tarballs.orchestration}`,
      "@affino/datagrid-worker": `file:${tarballs.worker}`,
      "@affino/datagrid-gantt": `file:${tarballs.gantt}`,
      "@affino/datagrid-vue": `file:${tarballs.vue}`,
      vue: "3.5.22",
    },
    devDependencies: { typescript: "7.0.2" },
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
      'import { DataGrid } from "@affino/datagrid-vue/gantt"',
      'import type { DataGridGanttOptions, DataGridGanttProp } from "@affino/datagrid-vue/gantt"',
      'const options: DataGridGanttOptions = { startKey: "start", endKey: "end" }',
      "const prop: DataGridGanttProp = options",
      "const component: typeof DataGrid = DataGrid",
      "void prop",
      "void component",
      "",
    ].join("\n")
    : [
      'import { DataGrid, type DataGridProps, type DataGridRowsEditedEvent } from "@affino/datagrid-vue"',
      'import { useDataGridRuntime, type DataGridApiRowsEditedEvent, type DataGridApplyEditsOptions } from "@affino/datagrid-vue/headless"',
      "const component: typeof DataGrid = DataGrid",
      "const headlessRuntime: typeof useDataGridRuntime = useDataGridRuntime",
      "const propsType: DataGridProps | undefined = undefined",
      "const event: DataGridRowsEditedEvent<{ id: string }> | DataGridApiRowsEditedEvent<{ id: string }> | undefined = undefined",
      'const options: DataGridApplyEditsOptions = { source: "grid" }',
      "void component",
      "void headlessRuntime",
      "void propsType",
      "void event",
      "void options",
      "",
    ].join("\n"))
  if (!withGantt) {
    writeFileSync(join(fixture, "runtime.mjs"), [
      'import assert from "node:assert/strict"',
      'import { readFile, readdir, stat } from "node:fs/promises"',
      'import path from "node:path"',
      'const root = await import("@affino/datagrid-vue")',
      'const headless = await import("@affino/datagrid-vue/headless")',
      'assert.equal(typeof root.DataGrid, "object")',
      'assert.equal(root.createDataGridVueRuntime, headless.createDataGridVueRuntime)',
      'assert.equal("DataGrid" in headless, false)',
      'for (const name of ["window", "document", "HTMLElement", "requestAnimationFrame"]) assert.equal(globalThis[name], undefined)',
      'const entry = new URL(import.meta.resolve("@affino/datagrid-vue/headless"))',
      'const headlessRoot = path.dirname(entry.pathname)',
      'async function scan(directory) { for (const name of await readdir(directory)) { const filename = path.join(directory, name); const info = await stat(filename); if (info.isDirectory()) await scan(filename); else if (name.endsWith(".js")) { const source = await readFile(filename, "utf8"); assert.equal(source.includes(".css"), false, "headless graph contains CSS import"); for (const match of source.matchAll(/(?:from|import)\\s*[\\(]?[\\s\\\"](\\.[^\\\"]+)[\\\"]?/g)) { const resolved = path.resolve(path.dirname(filename), match[1]); assert.equal(resolved.startsWith(headlessRoot + path.sep) || resolved === headlessRoot, true, "headless relative import escapes its output tree"); } } } }',
      'await scan(headlessRoot)',
      'console.log("Vue unified tarball entrypoint/runtime contract: passed")',
      "",
    ].join("\n"))
  }

  run("npm", ["install", "--no-package-lock", "--ignore-scripts"], fixture)
  run("npm", ["exec", "--", "tsc", "-p", "tsconfig.json", "--noEmit"], fixture)
  if (!withGantt) {
    const bundler = resolve(workspace, "node_modules/esbuild/bin/esbuild")
    run(bundler, ["runtime.mjs", "--bundle", "--platform=node", "--format=esm", "--packages=bundle", "--loader:.css=empty", "--outfile=runtime.bundle.mjs"], fixture)
    run(process.execPath, ["runtime.bundle.mjs"], fixture)
  }
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" })
}
