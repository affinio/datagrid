import { describe, expect, it } from "vitest"
import * as root from "../index"
import * as stable from "../stable"
import * as advanced from "../advanced"

describe("Vue entrypoint tier contract", () => {
  it("keeps root and stable entrypoints contract-equivalent", () => {
    expect(Object.keys(root).sort()).toEqual(Object.keys(stable).sort())
  })

  it("keeps low-level advanced hooks off the root stable surface", () => {
    expect("useDataGridGlobalPointerLifecycle" in root).toBe(false)
    expect("useDataGridDragSelectionLifecycle" in root).toBe(false)
    expect("useDataGridInlineEditorFocus" in root).toBe(false)
    expect("useDataGridHeaderResizeOrchestration" in root).toBe(false)

    expect(typeof advanced.useDataGridGlobalPointerLifecycle).toBe("function")
    expect(typeof advanced.useDataGridDragSelectionLifecycle).toBe("function")
    expect(typeof advanced.useDataGridInlineEditorFocus).toBe("function")
    expect(typeof advanced.useDataGridHeaderResizeOrchestration).toBe("function")
  })

  it("documents the stable integration primitives that intentionally remain on root", () => {
    expect(typeof root.useDataGridRuntime).toBe("function")
    expect(typeof root.createDataGridVueRuntime).toBe("function")
    expect(typeof root.useDataGridSelectionOverlayOrchestration).toBe("function")
    expect(typeof root.useAffinoGrid).toBe("function")
    expect(typeof root.createGrid).toBe("function")
    expect(typeof root.dataGridCellSelector).toBe("function")
  })
})
