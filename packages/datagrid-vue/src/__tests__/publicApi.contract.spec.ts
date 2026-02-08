import { describe, expect, it } from "vitest"
import {
  buildSelectionOverlayTransform,
  buildSelectionOverlayTransformFromSnapshot,
  createPiniaTableSettingsAdapter,
  mapDataGridA11yCellAttributes,
  mapDataGridA11yGridAttributes,
  useTableSettingsStore,
} from "../public"

describe("datagrid-vue public api contract", () => {
  it("exports stable settings bridge symbols", () => {
    expect(typeof createPiniaTableSettingsAdapter).toBe("function")
    expect(typeof useTableSettingsStore).toBe("function")
  })

  it("exports deterministic overlay transform helpers", () => {
    const transform = buildSelectionOverlayTransform(
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

    const fromSnapshot = buildSelectionOverlayTransformFromSnapshot({
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
