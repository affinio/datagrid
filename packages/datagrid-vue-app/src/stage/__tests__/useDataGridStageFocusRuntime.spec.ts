import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import { useDataGridStageFocusRuntime } from "../useDataGridStageFocusRuntime"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "../dataGridTableStageBody.types"

function createFocusRuntimeHarness(options: {
  isScrolling?: boolean
  runWhenIdle?: (callback: () => void) => void
  shouldRestoreAnchorFocus?: () => boolean
} = {}) {
  const bodyViewport = document.createElement("div")
  const cell = document.createElement("button")
  cell.className = "grid-cell"
  cell.dataset.rowIndex = "7"
  cell.dataset.columnIndex = "0"
  bodyViewport.appendChild(cell)

  const runtime = useDataGridStageFocusRuntime({
    bodyShellRef: ref(document.createElement("div")),
    bodyViewportEl: ref(bodyViewport),
    leftPaneContentRef: ref(null),
    rightPaneContentRef: ref(null),
    leftBottomPaneContentRef: ref(null),
    rightBottomPaneContentRef: ref(null),
    displayRows: ref([{} as DataGridTableStageBodyRow]),
    visibleColumns: ref([{} as DataGridTableStageBodyColumn]),
    viewportRowStart: ref(7),
    resolveAbsoluteRowIndex: () => 7,
    isSelectionAnchorCellSafe: () => true,
    isCellEditableSafe: () => true,
    isBodyViewportScrolling: ref(options.isScrolling ?? false),
    runWhenBodyViewportScrollIdle: options.runWhenIdle,
    shouldRestoreAnchorFocus: options.shouldRestoreAnchorFocus,
  })

  return {
    cell,
    runtime,
  }
}

describe("useDataGridStageFocusRuntime", () => {
  it("defers anchor focus restoration until body scroll idle and coalesces duplicate requests", () => {
    const idleCallbacks: Array<() => void> = []
    const runWhenIdle = vi.fn((callback: () => void) => {
      idleCallbacks.push(callback)
    })
    const { cell, runtime } = createFocusRuntimeHarness({
      isScrolling: true,
      runWhenIdle,
    })
    const focusSpy = vi.spyOn(cell, "focus")

    runtime.restoreAnchorCellFocus()
    runtime.restoreAnchorCellFocus()

    expect(runWhenIdle).toHaveBeenCalledTimes(1)
    expect(focusSpy).not.toHaveBeenCalled()

    idleCallbacks[0]?.()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it("does not steal focus when anchor restoration is blocked before scroll idle", () => {
    const idleCallbacks: Array<() => void> = []
    let canRestore = false
    const { cell, runtime } = createFocusRuntimeHarness({
      isScrolling: true,
      runWhenIdle: callback => {
        idleCallbacks.push(callback)
      },
      shouldRestoreAnchorFocus: () => canRestore,
    })
    const focusSpy = vi.spyOn(cell, "focus")

    runtime.restoreAnchorCellFocus()
    idleCallbacks[0]?.()

    expect(focusSpy).not.toHaveBeenCalled()

    canRestore = true
    runtime.restoreAnchorCellFocus()
    idleCallbacks[1]?.()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })
})
