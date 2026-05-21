import { describe, expect, it } from "vitest"
import {
  DATAGRID_DEPRECATION_WINDOWS,
  DATAGRID_PUBLIC_PROTOCOL_VERSION,
  compareDatagridSemver,
  getDataGridVersionedPublicProtocol,
} from "../versionedPublicProtocol"
import {
  getDataGridVersionedPublicProtocol as getDataGridVersionedPublicProtocolFromPublic,
} from "../../public"

describe("versionedPublicProtocol contract", () => {
  it("keeps protocol version in semver format", () => {
    expect(DATAGRID_PUBLIC_PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it("is exported through stable public API", () => {
    expect(typeof getDataGridVersionedPublicProtocolFromPublic).toBe("function")
  })

  it("ensures each deprecation window has increasing semver range", () => {
    for (const window of DATAGRID_DEPRECATION_WINDOWS) {
      expect(compareDatagridSemver(window.deprecatedIn, window.removeIn)).toBeLessThan(0)
      expect(window.replacement.length).toBeGreaterThan(0)
    }
  })

  it("returns semver-safe protocol snapshot with deprecation statuses", () => {
    const protocol = getDataGridVersionedPublicProtocol("0.3.0")
    expect(protocol.stableEntrypoints).toContain("@affino/datagrid-core")
    expect(protocol.stableEntrypoints).toContain("@affino/datagrid-vue")
    expect(protocol.advancedEntrypoints).toContain("@affino/datagrid-core/advanced")
    expect(protocol.internalEntrypoints).toContain("@affino/datagrid-core/internal")
    expect(protocol.forbiddenDeepImportPatterns).toContain("@affino/datagrid-core/src/*")
    expect(protocol.deprecations).toEqual([])
  })
})
