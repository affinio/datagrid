import { readFile } from "node:fs/promises"

delete globalThis.window
delete globalThis.document
delete globalThis.HTMLElement

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
const runtimeDependencies = Object.keys(manifest.dependencies ?? {}).sort()
const expectedRuntimeDependencies = [
  "@affino/datagrid-chrome",
  "@affino/datagrid-core",
  "@affino/datagrid-gantt",
  "@affino/datagrid-orchestration",
  "@affino/menu-core",
  "@affino/overlay-host",
].sort()
if (JSON.stringify(runtimeDependencies) !== JSON.stringify(expectedRuntimeDependencies)) {
  throw new Error(`Unexpected runtime dependencies: ${runtimeDependencies.join(", ")}`)
}
if (manifest.peerDependenciesMeta?.["@affino/datagrid-theme"]?.optional !== true) {
  throw new Error("@affino/datagrid-theme must remain an optional peer dependency")
}

const adapter = await import("../dist/index.js")
if (typeof adapter.mountDataGrid !== "function") {
  throw new Error("mountDataGrid is not exported")
}

process.stdout.write("DOM adapter import works without browser globals or Vue runtime dependencies.\n")
