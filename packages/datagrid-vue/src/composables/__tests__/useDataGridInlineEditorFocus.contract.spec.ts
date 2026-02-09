import { describe, expect, it, vi } from "vitest"
import { useDataGridInlineEditorFocus } from "../useDataGridInlineEditorFocus"

describe("useDataGridInlineEditorFocus contract", () => {
  it("focuses and selects input editors", async () => {
    const viewport = document.createElement("div")
    const host = document.createElement("div")
    host.dataset.inlineEditorRowId = "row-1"
    host.dataset.inlineEditorColumnKey = "owner"
    const input = document.createElement("input")
    host.appendChild(input)
    viewport.appendChild(host)

    const focusSpy = vi.spyOn(input, "focus")
    const selectSpy = vi.spyOn(input, "select")

    const focusOrchestration = useDataGridInlineEditorFocus({
      resolveViewportElement: () => viewport,
    })

    await focusOrchestration.focusInlineEditorElement("row-1", "owner", "text", false)
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(selectSpy).toHaveBeenCalledTimes(1)
  })

  it("click-opens select editors when requested", async () => {
    const viewport = document.createElement("div")
    const host = document.createElement("div")
    host.dataset.inlineEditorRowId = "row-2"
    host.dataset.inlineEditorColumnKey = "severity"
    const button = document.createElement("button")
    host.appendChild(button)
    viewport.appendChild(host)

    const clickSpy = vi.spyOn(button, "click")
    const focusOrchestration = useDataGridInlineEditorFocus({
      resolveViewportElement: () => viewport,
    })

    await focusOrchestration.focusInlineEditorElement("row-2", "severity", "select", true)
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})

