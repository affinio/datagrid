import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distRoot = path.resolve(__dirname, "../dist/src")

if (!existsSync(distRoot)) {
  process.exit(0)
}

const jsFiles = []
const stack = [distRoot]
while (stack.length > 0) {
  const current = stack.pop()
  if (!current) {
    continue
  }
  for (const entry of readdirSync(current)) {
    const fullPath = path.join(current, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      stack.push(fullPath)
      continue
    }
    if (entry.endsWith(".js")) {
      jsFiles.push(fullPath)
    }
  }
}

const shouldKeepAsIs = (specifier) => {
  return (
    !specifier.startsWith(".") ||
    specifier.endsWith(".js") ||
    specifier.endsWith(".json") ||
    specifier.endsWith(".node")
  )
}

const resolveNodeEsmSpecifier = (filePath, specifier) => {
  if (shouldKeepAsIs(specifier)) {
    return specifier
  }

  const sourceDir = path.dirname(filePath)
  const candidateBase = path.resolve(sourceDir, specifier)
  const asFile = `${candidateBase}.js`
  const asIndex = path.join(candidateBase, "index.js")

  if (existsSync(asFile)) {
    return `${specifier}.js`
  }
  if (existsSync(asIndex)) {
    return `${specifier}/index.js`
  }

  return specifier
}

const rewriteSpecifiers = (content, filePath) => {
  const replacers = [
    /\bfrom\s*(["'])(\.{1,2}\/[^"']+)\1/g,
    /\bimport\s*(["'])(\.{1,2}\/[^"']+)\1/g,
  ]

  let next = content
  for (const pattern of replacers) {
    next = next.replace(pattern, (match, quote, specifier) => {
      const normalized = resolveNodeEsmSpecifier(filePath, specifier)
      if (normalized === specifier) {
        return match
      }
      return match.replace(`${quote}${specifier}${quote}`, `${quote}${normalized}${quote}`)
    })
  }

  return next
}

let changedCount = 0
for (const filePath of jsFiles) {
  const original = readFileSync(filePath, "utf8")
  const updated = rewriteSpecifiers(original, filePath)
  if (updated !== original) {
    writeFileSync(filePath, updated, "utf8")
    changedCount += 1
  }
}

process.stdout.write(`normalized esm imports in ${changedCount} files\n`)
