import { describe, expect, it } from "vitest"
import { effectScope } from "vue"
import type { SelectionEnvironment } from "@affino/datagrid-core/selection/selectionEnvironment"
import type { GridSelectionContext } from "@affino/datagrid-core/selection/selectionState"
import { createGridSelectionRange } from "@affino/datagrid-core/selection/selectionState"
import type { HeadlessSelectionState } from "@affino/datagrid-core/selection/update"
import {
  createSelectionControllerAdapter,
  type SelectionControllerAdapter,
} from "../selectionControllerAdapter"

type RowKey = string

function createTestContext(): GridSelectionContext<RowKey> {
  return {
    grid: {
      rowCount: 12,
      colCount: 8,
    },
    getRowIdByIndex: rowIndex => `row-${rowIndex}`,
  }
}

function createTestEnvironment(): SelectionEnvironment<RowKey> {
  return {
    columns: [],
    overlays: {
      commit() {},
      clear() {},
    },
    measurement: {
      measureFillHandle: () => ({
        promise: Promise.resolve(null),
        cancel() {},
      }),
      measureCellRect: () => ({
        promise: Promise.resolve(null),
        cancel() {},
      }),
    },
    scheduler: {
      request(callback) {
        callback()
        return 1
      },
      cancel() {},
    },
    dom: {
      focusContainer() {},
      resolveCellElement() {
        return null
      },
      resolveHeaderCellElement() {
        return null
      },
      getRowIdByIndex(rowIndex) {
        return `row-${rowIndex}`
      },
      findRowIndexById(rowId) {
        const index = Number.parseInt(String(rowId).replace("row-", ""), 10)
        return Number.isFinite(index) ? index : null
      },
      scrollSelectionIntoView() {},
    },
    autoscroll: {
      stop() {},
      update() {},
    },
  }
}

function createHydratedState(context: GridSelectionContext<RowKey>): HeadlessSelectionState<RowKey> {
  const range = createGridSelectionRange<RowKey>(
    { rowIndex: 1, colIndex: 1, rowId: "row-1" },
    { rowIndex: 3, colIndex: 4, rowId: "row-3" },
    context,
  )
  return {
    ranges: [range],
    areas: [{
      startRow: range.startRow,
      endRow: range.endRow,
      startCol: range.startCol,
      endCol: range.endCol,
    }],
    activeRangeIndex: 0,
    selectedPoint: range.focus,
    anchorPoint: range.anchor,
    dragAnchorPoint: range.anchor,
  }
}

describe("selectionControllerAdapter contract", () => {
  it("hydrates state on mount and exposes diagnostics", () => {
    const context = createTestContext()
    const environment = createTestEnvironment()
    const initialState = createHydratedState(context)
    const scope = effectScope()

    let adapter: SelectionControllerAdapter<RowKey> | null = null

    scope.run(() => {
      adapter = createSelectionControllerAdapter<RowKey>({
        environment,
        context,
        initialState,
      })
    })

    expect(adapter).not.toBeNull()
    expect(adapter!.state.value.ranges).toHaveLength(1)
    expect(adapter!.state.value.selectedPoint?.rowIndex).toBe(3)
    expect(adapter!.diagnostics().initialized).toBe(true)
    expect(adapter!.diagnostics().initCount).toBeGreaterThanOrEqual(1)

    scope.stop()
  })

  it("syncs focus updates through lifecycle API", () => {
    const scope = effectScope()
    const context = createTestContext()
    const environment = createTestEnvironment()
    let adapter: SelectionControllerAdapter<RowKey> | null = null

    scope.run(() => {
      adapter = createSelectionControllerAdapter<RowKey>({
        environment,
        context,
      })
    })

    adapter!.sync({
      focusPoint: { rowIndex: 5, colIndex: 2, rowId: "row-5" },
    })

    expect(adapter!.state.value.selectedPoint?.rowIndex).toBe(5)
    expect(adapter!.state.value.selectedPoint?.colIndex).toBe(2)
    expect(adapter!.diagnostics().syncCount).toBeGreaterThan(0)

    scope.stop()
  })

  it("supports teardown + remount cycle on the same adapter instance", () => {
    const scope = effectScope()
    const context = createTestContext()
    const environment = createTestEnvironment()
    let adapter: SelectionControllerAdapter<RowKey> | null = null

    scope.run(() => {
      adapter = createSelectionControllerAdapter<RowKey>({
        environment,
        context,
      })
    })

    adapter!.teardown()
    expect(adapter!.diagnostics().initialized).toBe(false)
    expect(adapter!.diagnostics().disposed).toBe(true)

    adapter!.init()
    adapter!.sync({
      focusPoint: { rowIndex: 2, colIndex: 1, rowId: "row-2" },
    })

    expect(adapter!.state.value.selectedPoint?.rowIndex).toBe(2)
    expect(adapter!.diagnostics().initialized).toBe(true)
    expect(adapter!.diagnostics().teardownCount).toBeGreaterThanOrEqual(1)

    scope.stop()
  })

  it("marks disposed on unmount and can be recreated (remount)", () => {
    const context = createTestContext()
    const environment = createTestEnvironment()

    const firstScope = effectScope()
    let firstAdapter: SelectionControllerAdapter<RowKey> | null = null
    firstScope.run(() => {
      firstAdapter = createSelectionControllerAdapter<RowKey>({
        environment,
        context,
      })
    })
    firstScope.stop()
    expect(firstAdapter!.diagnostics().disposed).toBe(true)

    const secondScope = effectScope()
    let secondAdapter: SelectionControllerAdapter<RowKey> | null = null
    secondScope.run(() => {
      secondAdapter = createSelectionControllerAdapter<RowKey>({
        environment,
        context,
      })
    })
    expect(secondAdapter!.diagnostics().initialized).toBe(true)
    secondScope.stop()
  })
})
