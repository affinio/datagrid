import { describe, expect, it } from "vitest"
import { transformDataGridPublicProtocolSource } from "../publicProtocolCodemod"

describe("publicProtocolCodemod contract", () => {
  it("rewrites deep imports to semver-safe package entrypoints", () => {
    const input = `
import { createDataGridViewportController } from "@affino/datagrid-core/viewport/dataGridViewportController"
import { createDataGridApi } from "@affino/datagrid-core/src/public"
import { buildSelectionOverlayTransform } from "@affino/datagrid-vue/src/public"
`.trim()

    const result = transformDataGridPublicProtocolSource(input)

    expect(result.changed).toBe(true)
    expect(result.code).toContain('from "@affino/datagrid-core/advanced"')
    expect(result.code).toContain('from "@affino/datagrid-core"')
    expect(result.code).toContain('from "@affino/datagrid-vue"')
    expect(result.code).not.toContain("@affino/datagrid-core/viewport/dataGridViewportController")
    expect(result.code).not.toContain("@affino/datagrid-core/src/public")
    expect(result.code).not.toContain("@affino/datagrid-vue/src/public")
  })

  it("splits mixed root imports into stable and advanced entrypoints", () => {
    const input = `
import { createDataGridApi, createDataGridViewportController, type DataGridHostEventName } from "@affino/datagrid-core"
`.trim()

    const result = transformDataGridPublicProtocolSource(input)

    expect(result.changed).toBe(true)
    expect(result.appliedTransforms).toContain("root-import-tier-split")
    expect(result.code).toContain('import { createDataGridApi } from "@affino/datagrid-core"')
    expect(result.code).toContain(
      'import { createDataGridViewportController, type DataGridHostEventName } from "@affino/datagrid-core/advanced"',
    )
  })


  it("keeps source untouched when no migration pattern is present", () => {
    const input = `
import { createDataGridApi } from "@affino/datagrid-core"
`.trim()

    const result = transformDataGridPublicProtocolSource(input)
    expect(result.changed).toBe(false)
    expect(result.code).toBe(input)
    expect(result.appliedTransforms).toEqual([])
  })
})
