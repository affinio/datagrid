import { afterEach, describe, expect, it } from "vitest"
import { mountEmptyStateDemo, type EmptyStateDemoHandle } from "./main"

describe("empty state sandbox example", () => {
  let demo: EmptyStateDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("shows separate no-rows and filtered messages, then restores rows", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountEmptyStateDemo(root)
    await demo.grid.ready

    expect(readEmptyMessage(root)).toContain("No people yet")
    root.querySelector<HTMLButtonElement>('[data-empty-state-action="filtered"]')!.click()
    expect(readEmptyMessage(root)).toContain("No matching people")
    expect(readEmptyMessage(root)).toContain("active filter")

    root.querySelector<HTMLButtonElement>('[data-empty-state-action="restore"]')!.click()
    expect(root.querySelector(".affino-grid-dom__empty-state")).toBeNull()
    expect(readNames(root)).toEqual(["Ada Lovelace", "Grace Hopper", "Katherine Johnson"])

    root.querySelector<HTMLButtonElement>('[data-empty-state-action="no-rows"]')!.click()
    expect(readEmptyMessage(root)).toContain("No people yet")
  })
})

function readEmptyMessage(root: HTMLElement): string {
  return root.querySelector(".affino-grid-dom__empty-state")?.textContent ?? ""
}

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"]')?.textContent ?? "")
}
