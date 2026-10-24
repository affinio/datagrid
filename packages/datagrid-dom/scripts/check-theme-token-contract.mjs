import { readdir, readFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDirectory, "..")
const stylesRoot = resolve(packageRoot, "src/styles")
const tokenSource = resolve(packageRoot, "../datagrid-theme/src/tokens.ts")

async function collectCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectCssFiles(path))
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(path)
  }
  return files
}

const tokenMapText = await readFile(tokenSource, "utf8")
const publicVariables = new Set(
  [...tokenMapText.matchAll(/"(--datagrid-[\w-]+)"/g)].map(match => match[1]),
)
const cssFiles = await collectCssFiles(stylesRoot)
const unknownVariables = new Map()
const usedVariables = new Set()

for (const cssFile of cssFiles) {
  const cssText = await readFile(cssFile, "utf8")
  for (const match of cssText.matchAll(/var\(\s*(--datagrid-[\w-]+)/g)) {
    const variable = match[1]
    usedVariables.add(variable)
    if (!publicVariables.has(variable)) {
      unknownVariables.set(variable, relative(packageRoot, cssFile))
    }
  }
}

if (unknownVariables.size > 0) {
  const details = [...unknownVariables].map(([variable, file]) => `  ${variable} in ${file}`).join("\n")
  throw new Error(`DOM adapter CSS uses variables missing from @affino/datagrid-theme:\n${details}`)
}

console.log(`DOM adapter CSS uses ${usedVariables.size} canonical @affino/datagrid-theme tokens.`)
