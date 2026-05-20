#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, extname, relative, resolve } from "node:path"

const rootDir = process.cwd()
const baselinePath = resolve(rootDir, "docs/quality/datagrid-api-report.json")
const reportPath = resolve(rootDir, "artifacts/quality/datagrid-api-report.json")
const writeBaseline = process.argv.includes("--write-baseline")

const trackedPackages = [
  {
    packageDir: "packages/datagrid-core",
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
      ".": "advanced-adapter-internal",
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

function stableStringify(value) {
  return JSON.stringify(value, null, 2)
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex")
}

function normalizeDeclarationText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.trimEnd())
    .filter(line => !line.startsWith("//# sourceMappingURL="))
    .join("\n")
    .trim()
}

function normalizeExportTarget(target) {
  if (typeof target === "string") {
    return { types: target }
  }
  if (!target || typeof target !== "object") {
    return { types: null }
  }
  return {
    types: typeof target.types === "string" ? target.types : null,
  }
}

function resolveDeclarationSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null
  }
  const base = resolve(dirname(fromFile), specifier)
  const candidates = []
  const extension = extname(base)
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    candidates.push(base.replace(/\.(mjs|cjs|js)$/, ".d.ts"))
  } else if (extension === ".d.ts") {
    candidates.push(base)
  } else {
    candidates.push(`${base}.d.ts`)
    candidates.push(resolve(base, "index.d.ts"))
  }
  return candidates.find(candidate => existsSync(candidate)) ?? null
}

function readDeclarationGraph(entrypointPath, packageDir) {
  const packageRoot = resolve(rootDir, packageDir)
  const visited = new Set()
  const queue = [entrypointPath]
  const files = []

  while (queue.length > 0) {
    const file = queue.shift()
    if (!file || visited.has(file)) {
      continue
    }
    if (!file.startsWith(packageRoot)) {
      continue
    }
    if (!existsSync(file)) {
      continue
    }
    visited.add(file)
    const text = readFileSync(file, "utf8")
    const normalizedText = normalizeDeclarationText(text)
    const relativePath = relative(rootDir, file)
    files.push({
      path: relativePath,
      hash: hashText(normalizedText),
    })

    const fromRegex = /\b(?:export|import)\b[\s\S]*?\bfrom\s+["']([^"']+)["']/g
    for (const match of text.matchAll(fromRegex)) {
      const next = resolveDeclarationSpecifier(file, match[1])
      if (next && !visited.has(next)) {
        queue.push(next)
      }
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path))
  return files
}

function readEntrypointExports(entrypointPath) {
  if (!existsSync(entrypointPath)) {
    return []
  }
  const text = normalizeDeclarationText(readFileSync(entrypointPath, "utf8"))
  const exports = []
  let current = null
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!current && /^export(\s+type)?\s+(\*|\{|\w+)/.test(trimmed)) {
      current = trimmed
    } else if (current) {
      current = `${current} ${trimmed}`
    }
    if (current && /(;|})$/.test(trimmed)) {
      exports.push(current.replace(/\s+/g, " ").replace(/;$/, ""))
      current = null
    }
  }
  if (current) {
    exports.push(current.replace(/\s+/g, " "))
  }
  return exports.sort()
}

function buildApiReport() {
  const packages = trackedPackages.map(config => {
    const packageJsonPath = resolve(rootDir, config.packageDir, "package.json")
    const packageJson = readJson(packageJsonPath)
    const entries = Object.entries(packageJson.exports ?? {})
      .map(([subpath, target]) => {
        const normalizedTarget = normalizeExportTarget(target)
        const declarationPath = normalizedTarget.types
          ? resolve(rootDir, config.packageDir, normalizedTarget.types)
          : null
        const declarationFile = declarationPath ? relative(rootDir, declarationPath) : null
        const declarationFiles = declarationPath && existsSync(declarationPath)
          ? readDeclarationGraph(declarationPath, config.packageDir)
          : []
        const signatureInput = declarationFiles
          .map(file => `${file.path}:${file.hash}`)
          .join("\n")
        const entrypointExports = declarationPath ? readEntrypointExports(declarationPath) : []
        return {
          subpath,
          tier: config.tiers[subpath] ?? "unclassified",
          types: normalizedTarget.types,
          declarationFile,
          declarationExists: Boolean(declarationPath && existsSync(declarationPath)),
          declarationFileCount: declarationFiles.length,
          declarationHash: hashText(signatureInput),
          entrypointExportCount: entrypointExports.length,
          entrypointExports,
          declarationFiles,
        }
      })
      .sort((a, b) => a.subpath.localeCompare(b.subpath))

    return {
      packageName: packageJson.name,
      packageDir: config.packageDir,
      version: packageJson.version,
      exportCount: entries.length,
      missingDeclarations: entries.filter(entry => !entry.declarationExists).map(entry => entry.subpath),
      unclassifiedExports: entries.filter(entry => entry.tier === "unclassified").map(entry => entry.subpath),
      entries,
    }
  })

  return {
    schemaVersion: 1,
    trackedPackageCount: packages.length,
    packages,
  }
}

const apiReport = buildApiReport()
const report = {
  ok: true,
  baselinePath: relative(rootDir, baselinePath),
  generatedAt: new Date().toISOString(),
  apiReport,
  violations: [],
}

for (const packageReport of apiReport.packages) {
  for (const subpath of packageReport.unclassifiedExports) {
    report.violations.push(`${packageReport.packageName} export ${subpath} is not classified`)
  }
  for (const subpath of packageReport.missingDeclarations) {
    report.violations.push(`${packageReport.packageName} export ${subpath} has no emitted declaration file. Build the package before running the API report check.`)
  }
}

if (writeBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true })
  writeFileSync(baselinePath, `${stableStringify(apiReport)}\n`)
} else if (!existsSync(baselinePath)) {
  report.violations.push(`Missing baseline: ${relative(rootDir, baselinePath)}`)
} else {
  const baseline = readJson(baselinePath)
  if (stableStringify(baseline) !== stableStringify(apiReport)) {
    report.violations.push("Public API declaration report differs from docs/quality baseline. Run with --write-baseline after reviewing the semver impact.")
  }
}

report.ok = report.violations.length === 0
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${stableStringify(report)}\n`)

console.log("DataGrid Public API Report Check")
console.log(`report: ${reportPath}`)
console.log(`packages: ${apiReport.trackedPackageCount}`)
console.log(`violations: ${report.violations.length}`)

if (!report.ok) {
  for (const violation of report.violations) {
    console.error(`- ${violation}`)
  }
  process.exitCode = 1
}
