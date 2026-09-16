import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const packageRoot = resolve(import.meta.dirname, "..", "..")
const distRoot = resolve(packageRoot, "dist")

describe("datagrid-vue-app package entrypoints", () => {
  it("keeps Gantt runtime out of the root production entry", () => {
    const rootEntry = readFileSync(resolve(distRoot, "index.js"), "utf8")

    expect(rootEntry).not.toContain("DataGridGanttStage")
    expect(rootEntry).not.toContain("@affino/datagrid-gantt")
  })

  it("builds the Gantt runtime through its explicit subpath", () => {
    expect(existsSync(resolve(distRoot, "gantt.js"))).toBe(true)
    expect(existsSync(resolve(distRoot, "gantt.d.ts"))).toBe(true)
    expect(readFileSync(resolve(distRoot, "gantt.js"), "utf8")).toContain("DataGridGanttStage")
  })
})
