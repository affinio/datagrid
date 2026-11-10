import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixtureRoot = mkdtempSync(join(tmpdir(), "affino-datagrid-vue-native-consumer-"))
const packageDirs = [
  "datagrid-plugins", "datagrid-format", "projection-engine", "datagrid-formula-engine",
  "datagrid-pivot", "export-xlsx", "datagrid-core", "datagrid-orchestration",
  "datagrid-worker", "datagrid-chrome", "datagrid-theme", "datagrid-gantt", "datagrid-vue",
]

try {
  assert.equal(Number(process.versions.node.split(".")[0]), 26, "Run this fixture with Node 26")
  const tarballs = Object.fromEntries(packageDirs.map(name => [name, pack(name)]))
  const fixture = join(fixtureRoot, "consumer")
  mkdirSync(fixture, { recursive: true })
  const dependencies = Object.fromEntries(packageDirs.map(name => [
    `@affino/${name}`, `file:${tarballs[name]}`,
  ]))
  dependencies.vue = "3.5.44"
  // Patched UI tarballs can be supplied while their coordinated patch releases are prepared.
  if (process.env.AFFINO_POPOVER_CORE_TARBALL) dependencies["@affino/popover-core"] = `file:${resolve(process.env.AFFINO_POPOVER_CORE_TARBALL)}`
  if (process.env.AFFINO_POPOVER_VUE_TARBALL) dependencies["@affino/popover-vue"] = `file:${resolve(process.env.AFFINO_POPOVER_VUE_TARBALL)}`
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "native-datagrid-consumer", private: true, type: "module", dependencies }, null, 2))
  execFileSync("npm", ["install", "--no-package-lock", "--ignore-scripts"], { cwd: fixture, stdio: "inherit" })

  const installed = join(fixture, "node_modules", "@affino")
  scan(installed)
  for (const name of readdirSync(installed)) {
    const manifestPath = join(installed, name, "package.json")
    let manifest
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")) } catch { continue }
    for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      for (const [dependency, version] of Object.entries(manifest[section] ?? {})) {
        assert.equal(String(version).startsWith("workspace:"), false, `${manifest.name} has unresolved ${dependency}=${version}`)
      }
    }
  }
  for (const [name, version] of [
    ["menu-vue", "2.2.1"], ["menu-core", "1.2.1"],
    ["popover-vue", "1.1.1"], ["popover-core", "1.1.1"],
  ]) {
    const manifest = JSON.parse(readFileSync(join(installed, name, "package.json"), "utf8"))
    assert.equal(manifest.version, version, `Expected @affino/${name}@${version} in packed consumer`)
  }
  const coreManifest = JSON.parse(readFileSync(join(installed, "datagrid-core", "package.json"), "utf8"))
  const vueManifest = JSON.parse(readFileSync(join(installed, "datagrid-vue", "package.json"), "utf8"))
  assert.equal(coreManifest.dependencies["@affino/datagrid-plugins"], "0.2.3")
  assert.equal(vueManifest.dependencies["@affino/datagrid-core"], "0.14.2")
  assert.equal(vueManifest.dependencies["@affino/menu-vue"], "2.2.1")
  assert.equal(vueManifest.dependencies["@affino/popover-vue"], "1.1.1")
  writeFileSync(join(fixture, "runtime.mjs"), 'await import("@affino/datagrid-vue")\n')
  execFileSync(process.execPath, ["runtime.mjs"], { cwd: fixture, stdio: "inherit" })
  console.log("AFFINO_DATAGRID_VUE_NATIVE_NODE_26_OK")
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true })
}

function pack(name) {
  const directory = resolve(workspace, `packages/${name}`)
  const output = execFileSync("pnpm", ["pack", "--pack-destination", fixtureRoot], {
    cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
  })
  const filename = output.trim().split("\n").at(-1)
  assert.ok(filename, `pnpm pack produced no tarball for ${name}`)
  return resolve(fixtureRoot, filename)
}

function scan(root) {
  const failures = []
  const visit = directory => {
    for (const entry of readdirSync(directory)) {
      const filename = join(directory, entry)
      if (statSync(filename).isDirectory()) { visit(filename); continue }
      if (!/[.]m?js$/.test(entry)) continue
      const source = readFileSync(filename, "utf8")
      const pattern = /\b(?:from\s*|import\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\1/g
      for (const match of source.matchAll(pattern)) {
        const specifier = match[2]
        const target = resolve(dirname(filename), specifier)
        if (!extname(specifier)) {
          failures.push(`${filename}: extensionless relative import ${specifier}`)
          continue
        }
        try { statSync(target) } catch { failures.push(`${filename}: missing relative import target ${specifier}`) }
      }
    }
  }
  visit(root)
  assert.deepEqual(failures, [], `Invalid relative imports in installed @affino graph:\n${failures.join("\n")}`)
}
