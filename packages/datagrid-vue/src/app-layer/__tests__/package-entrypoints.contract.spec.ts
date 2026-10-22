import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const packageRoot = resolve(import.meta.dirname, "..", "..", "..")
const distRoot = resolve(packageRoot, "dist")

describe("unified datagrid-vue package entrypoints", () => {
  it("composes the ready-to-use app and headless APIs at the package root", () => {
    const rootEntry = readFileSync(resolve(distRoot, "index.js"), "utf8")
    const rootTypes = readFileSync(resolve(distRoot, "index.d.ts"), "utf8")

    expect(rootEntry).toContain('./app/index.js')
    expect(rootEntry).toContain('./headless/index.js')
    expect(rootTypes).toContain('./app/index.js')
    expect(rootTypes).toContain('./headless/index.js')
  })

  it("publishes app feature entrypoints and defers optional UI chunks", () => {
    expect(existsSync(resolve(distRoot, "gantt.js"))).toBe(true)
    expect(existsSync(resolve(distRoot, "app/gantt.d.ts"))).toBe(true)
    const chunksRoot = resolve(distRoot, "chunks")
    const appChunkName = readdirSync(chunksRoot).find(name => /^useDataGridAppRowModel-.*\.js$/.test(name))
    const menuChunkName = readdirSync(chunksRoot).find(name => /^DataGridColumnMenu-.*\.js$/.test(name))

    expect(appChunkName).toBeDefined()
    expect(menuChunkName).toBeDefined()
    expect(readFileSync(resolve(chunksRoot, appChunkName!), "utf8"))
      .toContain(`import("./${menuChunkName}")`)
    expect(existsSync(resolve(distRoot, "index.js"))).toBe(true)
    expect(existsSync(resolve(distRoot, "headless/index.js"))).toBe(true)
  })
})
