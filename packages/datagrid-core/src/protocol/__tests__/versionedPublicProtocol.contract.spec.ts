import { describe, expect, it } from "vitest"
import {
  DATAGRID_DEPRECATION_WINDOWS,
  DATAGRID_PUBLIC_PROTOCOL_VERSION,
  compareDatagridSemver,
  getDataGridVersionedPublicProtocol,
  resolveDatagridDeprecationStatus,
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

  it("resolves deprecation statuses by package version", () => {
    const firstWindow = DATAGRID_DEPRECATION_WINDOWS[0]
    expect(firstWindow).toBeDefined()
    if (!firstWindow) {
      return
    }

    expect(resolveDatagridDeprecationStatus("0.1.0", firstWindow)).toBe("active")
    expect(resolveDatagridDeprecationStatus("0.2.1", firstWindow)).toBe("warning")
    expect(resolveDatagridDeprecationStatus("0.4.0", firstWindow)).toBe("removal-ready")
  })

  it("returns semver-safe protocol snapshot with deprecation statuses", () => {
    const protocol = getDataGridVersionedPublicProtocol("0.3.0")
    expect(protocol.stableEntrypoints).toContain("@affino/datagrid-core")
    expect(protocol.stableEntrypoints).toContain("@affino/datagrid-vue")
    expect(protocol.advancedEntrypoints).toContain("@affino/datagrid-core/advanced")
    expect(protocol.internalEntrypoints).toContain("@affino/datagrid-core/internal")
    expect(protocol.forbiddenDeepImportPatterns).toContain("@affino/datagrid-core/src/*")
    expect(protocol.deprecations.length).toBeGreaterThan(0)
    for (const window of protocol.deprecations) {
      expect(["active", "warning", "removal-ready"]).toContain(window.status)
      expect(window.id.length).toBeGreaterThan(0)
      if (window.id === "core.viewport.createTableViewportController") {
        expect(window.replacement).toContain("@affino/datagrid-core/advanced")
      }
    }
  })
})
