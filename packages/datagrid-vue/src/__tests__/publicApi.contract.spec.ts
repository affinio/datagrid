import { describe, expect, it } from "vitest"
import {
  buildDataGridOverlayTransform,
  buildDataGridOverlayTransformFromSnapshot,
  createDataGridSettingsAdapter,
  mapDataGridA11yCellAttributes,
  mapDataGridA11yGridAttributes,
  useDataGridSettingsStore,
} from "../stable"
import * as rootEntrypoint from "../index"
import * as stableEntrypoint from "../stable"

describe("datagrid-vue public api contract", () => {
  it("keeps root entrypoint aligned with stable common-usage entrypoint", () => {
    const rootKeys = Object.keys(rootEntrypoint).sort()
    const stableKeys = Object.keys(stableEntrypoint).sort()
    expect(rootKeys).toEqual(stableKeys)
    expect(rootKeys.length).toBeGreaterThan(0)
    expect(rootKeys.includes("useTableSettingsStore")).toBe(false)
    expect(rootKeys.includes("createPiniaTableSettingsAdapter")).toBe(false)
    expect(rootKeys.includes("useDataGridViewportBridge")).toBe(false)
    expect(rootKeys.includes("useDataGridRowSelectionFacade")).toBe(false)
    expect(rootKeys.includes("useDataGridFindReplaceFacade")).toBe(false)
    expect(rootKeys.includes("buildSelectionOverlayTransform")).toBe(false)
    expect(rootKeys.includes("buildSelectionOverlayTransformFromSnapshot")).toBe(false)
  })

  it("exports stable settings bridge symbols", () => {
    expect(typeof createDataGridSettingsAdapter).toBe("function")
    expect(typeof useDataGridSettingsStore).toBe("function")
  })

  it("exports deterministic overlay transform helpers", () => {
    const transform = buildDataGridOverlayTransform(
      {
        width: 900,
        height: 500,
        scrollLeft: 210,
        scrollTop: 44,
      },
      10,
      180,
    )
    expect(transform).toEqual({
      viewportWidth: 900,
      viewportHeight: 500,
      scrollLeft: 210,
      scrollTop: 44,
      pinnedLeftTranslateX: 220,
      pinnedRightTranslateX: 30,
    })

    const fromSnapshot = buildDataGridOverlayTransformFromSnapshot({
      viewportWidth: 900,
      viewportHeight: 500,
      scrollLeft: 210,
      scrollTop: 44,
      pinnedOffsetLeft: 10,
      pinnedOffsetRight: 180,
    })
    expect(fromSnapshot).toEqual(transform)
  })

  it("exports deterministic a11y DOM attribute mappers", () => {
    expect(typeof mapDataGridA11yGridAttributes).toBe("function")
    expect(typeof mapDataGridA11yCellAttributes).toBe("function")
  })
})
