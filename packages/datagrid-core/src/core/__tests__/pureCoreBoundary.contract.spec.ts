import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const srcRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)))

function collectTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      if (entry === "__tests__") {
        continue
      }
      files.push(...collectTypeScriptFiles(fullPath))
      continue
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".d.ts")) {
      continue
    }
    files.push(fullPath)
  }

  return files
}

const pureCoreFiles = [
  ...collectTypeScriptFiles(join(srcRoot, "models")),
  ...collectTypeScriptFiles(join(srcRoot, "a11y")),
  ...collectTypeScriptFiles(join(srcRoot, "protocol")),
  join(srcRoot, "core", "gridCore.ts"),
  join(srcRoot, "core", "gridApi.ts"),
  join(srcRoot, "core", "transactionService.ts"),
  join(srcRoot, "selection", "snapshot.ts"),
]

const forbiddenImportPatterns: ReadonlyArray<RegExp> = [
  /from\s+["']vue["']/,
  /from\s+["'][^"']*livewire[^"']*["']/i,
]

const forbiddenDomPatterns: ReadonlyArray<RegExp> = [
  /\bdocument\b/,
  /\bwindow\b/,
  /\bHTMLElement\b/,
  /\bHTML[A-Za-z]+Element\b/,
  /\bDOMRect\b/,
]

const forbiddenRuntimePatterns: ReadonlyArray<RegExp> = [
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\brequestAnimationFrame\b/,
  /\bMath\.random\b/,
  /\bDate\.now\b/,
  /\bperformance\.now\b/,
]

describe("pure core boundary contract", () => {
  it("forbids framework and livewire imports in deterministic core layer", () => {
    for (const file of pureCoreFiles) {
      const source = readFileSync(file, "utf8")
      for (const pattern of forbiddenImportPatterns) {
        expect(pattern.test(source), `Forbidden import pattern ${pattern} in ${file}`).toBe(false)
      }
    }
  })

  it("forbids DOM globals/types and time-based side effects in deterministic core layer", () => {
    for (const file of pureCoreFiles) {
      const source = readFileSync(file, "utf8")
      for (const pattern of forbiddenDomPatterns) {
        expect(pattern.test(source), `Forbidden DOM pattern ${pattern} in ${file}`).toBe(false)
      }
      for (const pattern of forbiddenRuntimePatterns) {
        expect(pattern.test(source), `Forbidden runtime pattern ${pattern} in ${file}`).toBe(false)
      }
    }
  })
})
