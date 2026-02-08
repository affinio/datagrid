import { describe, expect, it } from "vitest"
import { transformDataGridPublicProtocolSource } from "../publicProtocolCodemod"

describe("publicProtocolCodemod contract", () => {
  it("rewrites deep imports to semver-safe package entrypoints", () => {
    const input = `
import { createTableViewportController } from "@affino/datagrid-core/viewport/tableViewportController"
import { createDataGridApi } from "@affino/datagrid-core/src/public"
import { buildSelectionOverlayTransform } from "@affino/datagrid-vue/src/public"
`.trim()

    const result = transformDataGridPublicProtocolSource(input)

    expect(result.changed).toBe(true)
    expect(result.code).toContain('from "@affino/datagrid-core/advanced"')
    expect(result.code).toContain('from "@affino/datagrid-core"')
    expect(result.code).toContain('from "@affino/datagrid-vue"')
    expect(result.code).not.toContain("@affino/datagrid-core/viewport/tableViewportController")
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

  it("renames legacy viewport factory and marks serverIntegration path", () => {
    const input = `
const controller = createTableViewportController({
  serverIntegration: createLegacyBridge(),
})
`.trim()

    const result = transformDataGridPublicProtocolSource(input)
    expect(result.code).toContain("createDataGridViewportController")
    expect(result.code).toContain("TODO(datagrid-codemod): migrate to rowModel boundary")
    expect(result.appliedTransforms).toContain("viewport-factory-rename")
    expect(result.appliedTransforms).toContain("server-integration-todo")
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
