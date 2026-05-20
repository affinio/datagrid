#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"

const rootDir = process.cwd()
const baselinePath = resolve(rootDir, "docs/quality/datagrid-public-api-inventory.json")
const reportPath = resolve(rootDir, "artifacts/quality/datagrid-public-api-inventory-report.json")
const writeBaseline = process.argv.includes("--write-baseline")

const trackedPackages = [
  {
    packageDir: "packages/datagrid-core",
    allowWildcardExports: false,
    tiers: {
      ".": "stable",
      "./advanced": "advanced",
      "./internal": "internal",
    },
  },
  {
    packageDir: "packages/datagrid-vue",
    tiers: {
      ".": "stable-alias",
      "./stable": "stable",
      "./app": "advanced",
      "./app/worker": "advanced",
      "./advanced": "advanced",
      "./advanced/layout": "advanced",
      "./advanced/pointer": "advanced",
      "./advanced/selection": "advanced",
      "./advanced/editing": "advanced",
      "./advanced/clipboard": "advanced",
      "./advanced/filtering": "advanced",
      "./advanced/history": "advanced",
      "./worker": "advanced",
    },
  },
  {
    packageDir: "packages/datagrid-vue-app",
    tiers: {
      ".": "stable",
      "./gantt": "stable-feature",
      "./aggregations": "stable-feature",
      "./advanced-filter": "stable-feature",
      "./quick-filter": "stable-feature",
      "./find-replace": "stable-feature",
      "./internal": "internal",
    },
  },
  {
    packageDir: "packages/datagrid-orchestration",
    tiers: {
      ".": "adapter-internal-public-root-risk",
    },
  },
  {
    packageDir: "packages/datagrid-server-adapters",
    tiers: {
      ".": "stable",
    },
  },
  {
    packageDir: "packages/datagrid-server-client",
    tiers: {
      ".": "stable",
    },
  },
]

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function normalizeExportTarget(target) {
  if (typeof target === "string") {
    return { import: target, types: null }
  }
  if (!target || typeof target !== "object") {
    return { import: null, types: null }
  }
  return {
    import: typeof target.import === "string" ? target.import : null,
    types: typeof target.types === "string" ? target.types : null,
  }
}

function sourceFileForTypes(packageDir, subpath, typesPath) {
  if (!typesPath) {
    return null
  }
  if (subpath === "./*") {
    return "src/*.ts"
  }
  let source = typesPath
    .replace(/^\.\//, "")
    .replace(/^dist\/src\//, "src/")
    .replace(/^dist\//, "src/")
    .replace(/\.d\.ts$/, ".ts")
  if (source === "src/index.ts") {
    return source
  }
  if (existsSync(resolve(rootDir, packageDir, source))) {
    return source
  }
  if (source.startsWith("src/app/") && existsSync(resolve(rootDir, packageDir, source))) {
    return source
  }
  return source
}

function readExportDeclarations(packageDir, sourceFile) {
  if (!sourceFile || sourceFile.includes("*")) {
    return []
  }
  const absolutePath = resolve(rootDir, packageDir, sourceFile)
  if (!existsSync(absolutePath)) {
    return []
  }
  const text = readFileSync(absolutePath, "utf8")
  const declarations = []
  let current = null
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!current && /^export(\s+type)?\s+(\*|\{|\w+)/.test(trimmed)) {
      current = trimmed
    } else if (current) {
      current = `${current} ${trimmed}`
    }
    if (current && /(;|})$/.test(trimmed)) {
      declarations.push(current.replace(/\s+/g, " ").replace(/;$/, ""))
      current = null
    }
  }
  if (current) {
    declarations.push(current.replace(/\s+/g, " "))
  }
  return declarations.sort()
}

function buildInventory() {
  const packages = trackedPackages.map(config => {
    const packageJsonPath = resolve(rootDir, config.packageDir, "package.json")
    const packageJson = readJson(packageJsonPath)
    const exportEntries = Object.entries(packageJson.exports ?? {})
      .map(([subpath, target]) => {
        const normalizedTarget = normalizeExportTarget(target)
        const sourceFile = sourceFileForTypes(config.packageDir, subpath, normalizedTarget.types)
        const sourceExists = sourceFile ? existsSync(resolve(rootDir, config.packageDir, sourceFile.replace("*", "index"))) || sourceFile.includes("*") : false
        const declarations = readExportDeclarations(config.packageDir, sourceFile)
        return {
          subpath,
          tier: config.tiers[subpath] ?? "unclassified",
          types: normalizedTarget.types,
          import: normalizedTarget.import,
          sourceFile,
          sourceExists,
          wildcard: subpath.includes("*"),
          exportDeclarationCount: declarations.length,
          exportDeclarations: declarations,
        }
      })
      .sort((a, b) => a.subpath.localeCompare(b.subpath))
    return {
      packageName: packageJson.name,
      packageDir: config.packageDir,
      version: packageJson.version,
      exportCount: exportEntries.length,
      unclassifiedExports: exportEntries.filter(entry => entry.tier === "unclassified").map(entry => entry.subpath),
      wildcardExports: exportEntries.filter(entry => entry.wildcard).map(entry => entry.subpath),
      missingSourceFiles: exportEntries.filter(entry => !entry.sourceExists).map(entry => entry.subpath),
      exports: exportEntries,
    }
  })
  return {
    schemaVersion: 1,
    trackedPackageCount: packages.length,
    packages,
  }
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2)
}

const inventory = buildInventory()
const report = {
  ok: true,
  baselinePath: relative(rootDir, baselinePath),
  generatedAt: new Date().toISOString(),
  inventory,
  violations: [],
}

for (const packageReport of inventory.packages) {
  for (const subpath of packageReport.unclassifiedExports) {
    report.violations.push(`${packageReport.packageName} export ${subpath} is not classified`)
  }
  for (const subpath of packageReport.missingSourceFiles) {
    report.violations.push(`${packageReport.packageName} export ${subpath} has no source file mapping`)
  }
  const config = trackedPackages.find(packageConfig => packageConfig.packageDir === packageReport.packageDir)
  if (config?.allowWildcardExports === false && packageReport.wildcardExports.length > 0) {
    report.violations.push(`${packageReport.packageName} must not expose wildcard package exports`)
  }
}

if (writeBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true })
  writeFileSync(baselinePath, `${stableStringify(inventory)}\n`)
} else if (!existsSync(baselinePath)) {
  report.violations.push(`Missing baseline: ${relative(rootDir, baselinePath)}`)
} else {
  const baseline = readJson(baselinePath)
  if (stableStringify(baseline) !== stableStringify(inventory)) {
    report.violations.push("Public API inventory differs from docs/quality baseline. Run with --write-baseline after reviewing the API change.")
  }
}

report.ok = report.violations.length === 0
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${stableStringify(report)}\n`)

console.log("DataGrid Public API Inventory Check")
console.log(`report: ${reportPath}`)
console.log(`packages: ${inventory.trackedPackageCount}`)
console.log(`violations: ${report.violations.length}`)

if (!report.ok) {
  for (const violation of report.violations) {
    console.error(`- ${violation}`)
  }
  process.exitCode = 1
}
