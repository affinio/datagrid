#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

const rootDir = process.cwd()
const packagesDir = resolve(rootDir, "packages")
const packageManifests = readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join(packagesDir, entry.name, "package.json"))
  .filter(existsSync)
  .map(path => JSON.parse(readFileSync(path, "utf8")))
  .filter(manifest => typeof manifest.name === "string" && manifest.name.startsWith("@affino/datagrid-"))

const byName = new Map(packageManifests.map(manifest => [manifest.name, manifest]))
const violations = []
const checks = []

function record(id, ok, details) {
  checks.push({ id, ok, ...details })
  if (!ok) {
    violations.push(`${id}: ${details.reason}`)
  }
}

function dependencyEntries(manifest) {
  return [
    ["dependencies", manifest.dependencies ?? {}],
    ["optionalDependencies", manifest.optionalDependencies ?? {}],
    ["peerDependencies", manifest.peerDependencies ?? {}],
  ]
}

function publishedSpecifier(specifier, targetVersion) {
  if (specifier === "workspace:*") return targetVersion
  if (specifier === "workspace:^") return `^${targetVersion}`
  if (specifier === "workspace:~") return `~${targetVersion}`
  return specifier
}

for (const manifest of packageManifests) {
  for (const [section, dependencies] of dependencyEntries(manifest)) {
    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      const dependency = byName.get(dependencyName)
      if (!dependency) continue

      record(`${manifest.name}:${section}:${dependencyName}:workspace-link`, specifier.startsWith("workspace:"), {
        reason: `uses ${JSON.stringify(specifier)}; internal DataGrid package dependencies must use the workspace protocol`,
      })

      const published = publishedSpecifier(specifier, dependency.version)
      record(`${manifest.name}:${section}:${dependencyName}:publish-resolution`, published === dependency.version || published.startsWith("^") || published.startsWith("~"), {
        reason: `cannot resolve ${JSON.stringify(specifier)} to the published ${dependencyName}@${dependency.version}`,
        published,
      })
    }
  }
}

const core = byName.get("@affino/datagrid-core")
for (const packageName of ["@affino/datagrid-server-client", "@affino/datagrid-server-adapters"]) {
  const manifest = byName.get(packageName)
  const specifier = manifest?.dependencies?.["@affino/datagrid-core"]
  record(`${packageName}:core-current-version`, Boolean(core && specifier === "workspace:*"), {
    reason: `must depend on @affino/datagrid-core through workspace:* so publication resolves to Core ${core?.version ?? "unknown"}`,
    packageVersion: manifest?.version ?? null,
    coreVersion: core?.version ?? null,
    specifier: specifier ?? null,
  })
}

console.log("DataGrid package compatibility check")
console.log(`packages: ${packageManifests.length}`)
console.log(`checks: ${checks.length}`)
console.log(`violations: ${violations.length}`)
for (const violation of violations) console.error(`- ${violation}`)

if (violations.length > 0) process.exitCode = 1
