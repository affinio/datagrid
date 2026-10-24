import { afterEach, describe, expect, it, vi } from "vitest"
import { createDataGridRuntime } from "@affino/datagrid-orchestration"
import { renderGrid, type RenderGridInput } from "../renderGrid.js"

const rows = [
  { id: "r0", a: "A0", b: "B0", c: "C0", d: "D0", e: "E0", f: "F0" },
  { id: "r1", a: "A1", b: "B1", c: "C1", d: "D1", e: "E1", f: "F1" },
]

function windowColumns(indices: number[]): NonNullable<RenderGridInput<unknown>["virtualColumns"]> {
  return {
    columns: indices.map(index => ({
      index, width: 100,
      pin: index === 0 ? "left" : index === 5 ? "right" : "none",
      offset: index === 0 || index === 5 ? 0 : (index - 1) * 100,
    })),
    leftPadding: (indices[1]! - 1) * 100,
    rightPadding: (4 - indices.at(-2)!) * 100,
  }
}

async function createHarness() {
  const runtime = createDataGridRuntime({
    rows,
    columns: ["a", "b", "c", "d", "e", "f"].map(key => ({
      key, field: key, initialState: { width: 100 },
    })),
  })
  await runtime.api.start()
  const grid = document.createElement("div")
  grid.id = "window-grid"
  document.body.append(grid)
  const render = (indices: number[], reuseExistingCells = false) => renderGrid({
    grid, api: runtime.api, columnModel: runtime.columnModel,
    virtualColumns: windowColumns(indices), reuseExistingCells,
  })
  return { runtime, grid, render }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe("viewport-only rendering", () => {
  it("preserves retained cells, an editor and pinned columns while resolving only entering cells", async () => {
    const { runtime, grid, render } = await createHarness()
    try {
      render([0, 1, 2, 3, 5])
      expect(grid.style.getPropertyValue("--affino-grid-dom-columns"))
        .toBe("100px 100px 100px 100px 100px 100px")
      const cell = (index: number) => grid.querySelector<HTMLElement>(
        `[data-row-index="0"] [data-column-index="${index}"]`,
      )!
      const pinned = cell(0)
      const retained = cell(2)
      const header = grid.querySelector('.affino-grid-dom__header [data-column-index="2"]')
      const editor = document.createElement("input")
      retained.replaceChildren(editor)
      editor.focus()
      const resolve = vi.spyOn(runtime.api.cells, "resolveValue")

      render([0, 2, 3, 4, 5], true)

      expect(cell(0)).toBe(pinned)
      expect(cell(2)).toBe(retained)
      expect(grid.querySelector('.affino-grid-dom__header [data-column-index="2"]')).toBe(header)
      expect(document.activeElement).toBe(editor)
      expect(cell(4).textContent).toBe("E0")
      expect(cell(1)).toBeNull()
      expect(resolve).toHaveBeenCalledTimes(2)
      expect([...grid.querySelector('[data-row-index="0"]')!.children].map(node =>
        (node as HTMLElement).dataset.columnIndex ?? "spacer",
      )).toEqual(["0", "spacer", "2", "3", "4", "5"])

      resolve.mockClear()
      const create = vi.spyOn(document, "createElement")
      render([0, 2, 3, 4, 5], true)
      expect(create).not.toHaveBeenCalled()
      expect(resolve).not.toHaveBeenCalled()
    } finally {
      await runtime.api.dispose()
    }
  })

  it("refreshes retained values on full data updates and never reuses cells for a different row id", async () => {
    const { runtime, grid, render } = await createHarness()
    try {
      render([0, 1, 2, 3, 5])
      await runtime.api.rows.applyEdits([{ rowId: "r0", data: { c: "Changed" } }])
      render([0, 1, 2, 3, 5])
      expect(grid.querySelector('[data-row-index="0"] [data-column-index="2"]')?.textContent).toBe("Changed")

      const previous = grid.querySelector('[data-row-index="0"]')
      runtime.api.rows.setData([rows[1]!, rows[0]!])
      render([0, 2, 3, 4, 5], true)
      expect(grid.querySelector('[data-row-index="0"]')).not.toBe(previous)
      expect(grid.querySelector('[data-row-index="0"] [data-column-index="2"]')?.textContent).toBe("C1")
    } finally {
      await runtime.api.dispose()
    }
  })
})
