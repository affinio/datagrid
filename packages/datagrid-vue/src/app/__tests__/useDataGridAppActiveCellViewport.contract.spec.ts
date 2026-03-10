import { ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridAppActiveCellViewport } from "../useDataGridAppActiveCellViewport"

function createViewport(): HTMLElement {
  const viewport = document.createElement("div")
  viewport.className = "grid-body-viewport"
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 120 })
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 200 })
  viewport.scrollTop = 0
  viewport.scrollLeft = 0
  viewport.focus = vi.fn()
  return viewport
}

function appendStageCell(stage: HTMLElement, rowIndex: number, columnIndex: number): HTMLElement {
  const cell = document.createElement("div")
  cell.className = "grid-cell"
  cell.dataset.rowIndex = String(rowIndex)
  cell.dataset.columnIndex = String(columnIndex)
  cell.tabIndex = -1
  cell.focus = vi.fn()
  stage.appendChild(cell)
  return cell
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("useDataGridAppActiveCellViewport contract", () => {
  it("does not change horizontal scroll when target column is pinned-right", () => {
    const stage = document.createElement("section")
    stage.className = "grid-stage"
    const viewport = createViewport()
    viewport.scrollLeft = 120
    stage.appendChild(viewport)
    document.body.appendChild(stage)

    const pinnedRightCell = appendStageCell(stage, 1, 2)
    const syncViewport = vi.fn()

    const { ensureKeyboardActiveCellVisible } = useDataGridAppActiveCellViewport({
      bodyViewportRef: ref(viewport),
      visibleColumns: ref([
        { key: "left", pin: "left", width: 80 },
        { key: "center", pin: "center", width: 140 },
        { key: "right", pin: "right", width: 90 },
      ] as unknown as readonly DataGridColumnSnapshot[]),
      columnWidths: ref({ left: 80, center: 140, right: 90 }),
      normalizedBaseRowHeight: ref(31),
      syncViewport,
    })

    ensureKeyboardActiveCellVisible(1, 2)

    expect(viewport.scrollLeft).toBe(120)
    expect(syncViewport).not.toHaveBeenCalled()
    expect((pinnedRightCell.focus as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })

  it("uses row offsets and row heights for variable-height vertical visibility", () => {
    const stage = document.createElement("section")
    stage.className = "grid-stage"
    const viewport = createViewport()
    stage.appendChild(viewport)
    document.body.appendChild(stage)

    const centerCell = appendStageCell(stage, 3, 0)
    const syncViewport = vi.fn()
    const rowOffsets = [0, 30, 90, 120]
    const rowHeights = [30, 60, 30, 45]

    const { ensureKeyboardActiveCellVisible } = useDataGridAppActiveCellViewport({
      bodyViewportRef: ref(viewport),
      visibleColumns: ref([
        { key: "center", pin: "center", width: 140 },
      ] as unknown as readonly DataGridColumnSnapshot[]),
      columnWidths: ref({ center: 140 }),
      normalizedBaseRowHeight: ref(31),
      resolveRowOffset: rowIndex => rowOffsets[rowIndex] ?? 0,
      resolveRowHeight: rowIndex => rowHeights[rowIndex] ?? 31,
      syncViewport,
    })

    ensureKeyboardActiveCellVisible(3, 0)

    expect(viewport.scrollTop).toBe(45)
    expect(syncViewport).toHaveBeenCalledTimes(1)
    expect((centerCell.focus as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)
  })
})
