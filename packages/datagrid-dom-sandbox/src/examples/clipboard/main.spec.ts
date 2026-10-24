import { afterEach, describe, expect, it, vi } from "vitest"
import { mountClipboardDemo, type ClipboardDemoHandle } from "./main"

describe("clipboard sandbox example", () => {
  let demo: ClipboardDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    vi.useRealTimers()
    demo = undefined
    root?.remove()
  })

  it("copies a range to TSV and pastes it into editable cells", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountClipboardDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))

    let payload = ""
    const clipboardData = {
      setData: (_type: string, value: string) => { payload = value },
      getData: (_type: string) => payload,
    }
    const copy = new Event("copy", { bubbles: true, cancelable: true })
    Object.defineProperty(copy, "clipboardData", { value: clipboardData })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(copy)
    expect(payload).toBe("Ada Lovelace\tEngine")

    root.querySelector<HTMLElement>('[data-row-index="2"][data-column-index="0"]')!.click()
    const paste = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(paste, "clipboardData", { value: clipboardData })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(paste)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(demo.grid.api.rows.getById("p3")?.data).toMatchObject({ name: "Ada Lovelace", team: "Engine" })
    expect(root.querySelector("output")?.textContent).toContain("Pasted values")
  })

  it("draws a temporary copied-range frame and clears it after the flash", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountClipboardDemo(root)
    await demo.grid.ready
    vi.useFakeTimers()

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    const copy = new Event("copy", { bubbles: true, cancelable: true })
    Object.defineProperty(copy, "clipboardData", { value: { setData: () => undefined } })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(copy)

    expect(root.querySelectorAll(".affino-grid-dom__cell--clipboard-copied")).toHaveLength(4)
    expect(root.querySelector('[data-row-index="0"][data-column-index="0"]')?.classList)
      .toContain("affino-grid-dom__cell--clipboard-copied-top")
    expect(root.querySelector('[data-row-index="1"][data-column-index="1"]')?.classList)
      .toContain("affino-grid-dom__cell--clipboard-copied-bottom")

    vi.advanceTimersByTime(1200)
    expect(root.querySelectorAll(".affino-grid-dom__cell--clipboard-copied")).toHaveLength(0)
  })
})
