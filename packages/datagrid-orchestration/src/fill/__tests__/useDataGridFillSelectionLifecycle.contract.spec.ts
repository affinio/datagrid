import { describe, expect, it } from "vitest"
import { useDataGridFillSelectionLifecycle } from "../useDataGridFillSelectionLifecycle"

describe("fill selection lifecycle", () => {
  it("releases every gesture resource even when committing the preview throws", () => {
    const calls: string[] = []
    const lifecycle = useDataGridFillSelectionLifecycle({
      applyFillPreview: () => { calls.push("commit"); throw new Error("commit-failed") },
      setFillDragging: value => { calls.push(`drag:${value}`) },
      clearFillDragStartPointer: () => calls.push("start-pointer"),
      clearFillPointer: () => calls.push("pointer"),
      clearFillBaseRange: () => calls.push("base"),
      clearFillPreviewRange: () => calls.push("preview"),
      stopAutoScrollFrameIfIdle: () => calls.push("autoscroll"),
    })

    expect(() => lifecycle.stopFillSelection(true)).toThrow("commit-failed")
    expect(calls).toEqual([
      "commit", "drag:false", "start-pointer", "pointer", "base", "preview", "autoscroll",
    ])
  })
})
