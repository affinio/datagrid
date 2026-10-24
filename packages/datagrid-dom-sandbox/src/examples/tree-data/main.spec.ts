import { afterEach, describe, expect, it } from "vitest"
import { mountDataGrid } from "@affino/datagrid-dom"
import { mountTreeDataDemo, type TreeDataDemoHandle } from "./main"

describe("tree data sandbox example", () => {
  let demo: TreeDataDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("renders Core tree projection and toggles nested groups", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountTreeDataDemo(root)
    await demo.grid.ready

    expect(demo.grid.api.rows.getSnapshot().treeDataDiagnostics).not.toBeNull()
    expect(demo.grid.api.rows.getCount()).toBe(11)
    expect(root.querySelectorAll('.affino-grid-dom__row[aria-level="1"]')).toHaveLength(2)
    expect(root.querySelectorAll('.affino-grid-dom__row[aria-level="2"]')).toHaveLength(4)
    expect(root.querySelector(".affino-grid-dom__group-leaf-label")?.getAttribute("style"))
      .toContain("padding-inline-start: 32px")
    expect(root.querySelector('.affino-grid-dom__row[data-row-id^="tree:path:"] [role=gridcell]')?.textContent)
      .toContain("Atlas")

    const atlas = Array.from(root.querySelectorAll<HTMLElement>('.affino-grid-dom__row[aria-level="1"]'))
      .find(row => row.textContent?.includes("Atlas"))!
    atlas.querySelector<HTMLButtonElement>("[data-group-toggle]")!.click()
    expect(demo.grid.api.rows.getCount()).toBe(6)
    expect(root.querySelectorAll('.affino-grid-dom__row[aria-level="2"]')).toHaveLength(2)

    root.querySelector<HTMLButtonElement>('[data-tree-action="expand-all"]')!.click()
    expect(demo.grid.api.rows.getCount()).toBe(11)
    root.querySelector<HTMLButtonElement>('[data-tree-action="collapse-all"]')!.click()
    expect(demo.grid.api.rows.getCount()).toBe(2)
  })

  it("renders parent-linked tree nodes and indents visible child rows", async () => {
    root = document.createElement("div")
    document.body.append(root)
    const grid = mountDataGrid(root, {
      label: "Parent-linked tree",
      rows: [
        { id: "project", title: "Atlas", parentId: null },
        { id: "workstream", title: "Implementation", parentId: "project" },
        { id: "task", title: "Build viewport", parentId: "workstream" },
      ],
      columns: [{ key: "title", field: "title", label: "Name" }],
      treeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        rootParentId: null,
        expandedByDefault: true,
      },
    })
    await grid.ready

    expect(grid.api.rows.getCount()).toBe(3)
    expect(root.querySelector('.affino-grid-dom__row[aria-level="1"] [role=gridcell]')?.textContent)
      .toContain("Atlas")
    expect(root.querySelector('.affino-grid-dom__row[aria-level="2"] [role=gridcell]')?.textContent)
      .toContain("Implementation")
    expect(root.querySelector(".affino-grid-dom__group-leaf-label")?.getAttribute("style"))
      .toContain("padding-inline-start: 32px")
    await grid.destroy()
  })

  it("toggles the active tree node with Space", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountTreeDataDemo(root)
    await demo.grid.ready

    root.querySelector<HTMLElement>('.affino-grid-dom__row[aria-level="1"] [role=gridcell]')!.click()
    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const collapse = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    grid.dispatchEvent(collapse)
    expect(collapse.defaultPrevented).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(6)
    expect(root.querySelector('.affino-grid-dom__row[aria-level="1"] [role=gridcell]')
      ?.classList.contains("affino-grid-dom__cell--range-frame")).toBe(true)

    const expand = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    grid.dispatchEvent(expand)
    expect(expand.defaultPrevented).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(11)

    const disclosure = root.querySelector<HTMLButtonElement>("[data-group-toggle]")!
    disclosure.focus()
    const buttonSpace = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    disclosure.dispatchEvent(buttonSpace)
    expect(buttonSpace.defaultPrevented).toBe(true)
    expect(demo.grid.api.rows.getCount()).toBe(6)
  })
})
