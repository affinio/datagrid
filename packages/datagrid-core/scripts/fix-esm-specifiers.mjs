#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const DIST_DIR = resolve("dist")

function walkJsFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkJsFiles(fullPath))
      continue
    }
    if (entry.isFile() && fullPath.endsWith(".js")) {
      results.push(fullPath)
    }
  }
  return results
}

function hasKnownExtension(specifier) {
  return /\.(?:js|mjs|cjs|json|node)$/i.test(specifier)
}

function shouldRewriteSpecifier(specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return false
  }
  if (hasKnownExtension(specifier)) {
    return false
  }
  if (specifier.endsWith("/")) {
    return false
  }
  return true
}

function resolveTargetExists(sourceFile, specifier) {
  const targetPath = resolve(sourceFile, "..", `${specifier}.js`)
  try {
    return statSync(targetPath).isFile()
  } catch {
    return false
  }
}

function rewriteCode(sourceFile, code) {
  let changed = false
  const rewritten = code.replace(
    /((?:import|export)\s+(?:[^"'`]*?\s+from\s+)?)((?:"|'))(\.\.?\/[^"']+?)\2/g,
    (match, prefix, quote, specifier) => {
      if (!shouldRewriteSpecifier(specifier)) {
        return match
      }
      if (!resolveTargetExists(sourceFile, specifier)) {
        return match
      }
      changed = true
      return `${prefix}${quote}${specifier}.js${quote}`
    },
  )

  return { rewritten, changed }
}

function main() {
  const files = walkJsFiles(DIST_DIR)
  let updatedCount = 0

  for (const filePath of files) {
    const original = readFileSync(filePath, "utf8")
    const { rewritten, changed } = rewriteCode(filePath, original)
    if (!changed) {
      continue
    }
    writeFileSync(filePath, rewritten, "utf8")
    updatedCount += 1
  }

  console.log(
    `[fix-esm-specifiers] scanned ${files.length} files, updated ${updatedCount} files under ${relative(process.cwd(), DIST_DIR) || "dist"}`,
  )
}

main()
