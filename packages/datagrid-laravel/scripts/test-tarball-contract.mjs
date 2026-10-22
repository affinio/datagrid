import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workspaceRoot = path.resolve(packageDir, "../..")
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "affino-laravel-tarball-"))
const tarballDir = path.join(temporaryRoot, "tarballs")
const consumerDir = path.join(temporaryRoot, "consumer")
const internalPackages = [
  "datagrid-format",
  "datagrid-formula-engine",
  "datagrid-pivot",
  "projection-engine",
  "datagrid-plugins",
  "datagrid-core",
  "datagrid-orchestration",
  "datagrid-laravel",
]

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
    env: { ...process.env, ...options.env },
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`)
  }
}

try {
  await mkdir(tarballDir, { recursive: true })
  for (const packageName of internalPackages) {
    run("pnpm", ["--dir", path.join(workspaceRoot, "packages", packageName), "pack", "--pack-destination", tarballDir], {
      stdio: "ignore",
    })
  }
  run("npm", ["pack", "--silent", "--pack-destination", tarballDir], {
    cwd: path.join(workspaceRoot, "node_modules", "typescript"),
  })

  const tarballs = (await (await import("node:fs/promises")).readdir(tarballDir))
    .filter(name => name.endsWith(".tgz"))
    .map(name => path.join(tarballDir, name))
  const packageSpecs = {}
  for (const tarballPath of tarballs) {
    const metadata = JSON.parse(runCapture("tar", ["-xOf", tarballPath, "package/package.json"]))
    packageSpecs[metadata.name] = `file:${tarballPath}`
  }

  await mkdir(consumerDir, { recursive: true })
  await writeFile(path.join(consumerDir, "package.json"), JSON.stringify({
    name: "laravel-tarball-contract-consumer",
    private: true,
    type: "module",
    dependencies: packageSpecs,
  }, null, 2))
  await writeFile(path.join(consumerDir, "consumer.mjs"), `
import assert from "node:assert/strict";
const forbiddenGlobals = ["window", "document", "HTMLElement", "requestAnimationFrame"];
for (const name of forbiddenGlobals) {
  assert.equal(globalThis[name], undefined, "unexpected browser global: " + name);
}
const facade = await import("@affino/datagrid-laravel");
const runtimeNames = [
  "createDataGridRuntime",
  "buildDataGridColumnLayers",
  "resolveDataGridLayerTrackTemplate",
  "useDataGridColumnLayoutOrchestration",
  "useDataGridManagedWheelScroll",
  "resolveDataGridHeaderLayerViewportGeometry",
  "resolveDataGridHeaderScrollSyncLeft",
];
for (const name of runtimeNames) assert.equal(typeof facade[name], "function", "missing export: " + name);
const runtime = facade.createDataGridRuntime({ rows: [{ id: "a", value: 1 }], columns: [{ key: "value", field: "value" }] });
assert.equal(runtime.api.rows.getCount(), 1);
runtime.api.rows.setData([{ id: "b", value: 2 }]);
assert.equal(runtime.api.rows.getCount(), 1);
assert.equal(runtime.api.rows.get(0)?.data.id, "b");
await runtime.core.dispose();
assert.equal(runtime.core.lifecycle.state, "disposed");
await runtime.core.dispose();
console.log("Laravel tarball runtime contract: passed");
`)
  await writeFile(path.join(consumerDir, "consumer-types.ts"), `
import type {
  DataGridColumnLayoutColumn,
  DataGridColumnLayoutMetric,
  DataGridColumnLayer,
  DataGridColumnLayerKey,
  DataGridVisibleColumnsWindow,
  DataGridManagedWheelBodyViewport,
  DataGridManagedWheelMainViewport,
  UseDataGridManagedWheelScrollOptions,
  UseDataGridManagedWheelScrollResult,
} from "@affino/datagrid-laravel";
type Resolved<T> = T;
type TypeContract = [
  Resolved<DataGridColumnLayoutColumn>,
  Resolved<DataGridColumnLayoutMetric>,
  Resolved<DataGridColumnLayer<DataGridColumnLayoutColumn>>,
  Resolved<DataGridColumnLayerKey>,
  Resolved<DataGridVisibleColumnsWindow>,
  Resolved<DataGridManagedWheelBodyViewport>,
  Resolved<DataGridManagedWheelMainViewport>,
  Resolved<UseDataGridManagedWheelScrollOptions>,
  Resolved<UseDataGridManagedWheelScrollResult>,
];
declare const contract: TypeContract;
void contract;
`)
  await writeFile(path.join(consumerDir, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      skipLibCheck: false,
    },
    files: ["consumer-types.ts"],
  }, null, 2))

  run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: consumerDir,
  })
  run(process.execPath, [path.join(consumerDir, "consumer.mjs")], { cwd: consumerDir })

  const consumerRequire = createRequire(path.join(consumerDir, "package.json"))
  try {
    consumerRequire.resolve("vue")
    throw new Error("Vue appeared in the Laravel runtime dependency tree")
  } catch (error) {
    if (error?.message === "Vue appeared in the Laravel runtime dependency tree") throw error
    if (error?.code !== "MODULE_NOT_FOUND") throw error
  }

  const tsc = path.join(consumerDir, "node_modules", "typescript", "bin", "tsc")
  run(process.execPath, [tsc, "-p", path.join(consumerDir, "tsconfig.json")], { cwd: consumerDir })
  console.log("Laravel tarball type contract: passed")
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" })
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`)
  return result.stdout
}
