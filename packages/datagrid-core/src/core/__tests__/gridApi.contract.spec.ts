import { describe, expect, it } from "vitest"
import { createDataGridColumnModel, createClientRowModel } from "../../models"
import type { DataGridSelectionSnapshot } from "../../selection/snapshot"
import { createDataGridTransactionService } from "../transactionService"
import { createDataGridApi as createDataGridApiFromPublic } from "../../public"
import { createDataGridApi } from "../gridApi"
import { createDataGridCore } from "../gridCore"

describe("data grid api facade contracts", () => {
  it("is exported through the stable public entrypoint", () => {
    expect(typeof createDataGridApiFromPublic).toBe("function")
  })

  it("fails fast when required model services are missing", () => {
    const core = createDataGridCore()
    expect(() => createDataGridApi({ core })).toThrow(/rowModel/)
  })

  it("routes row/column/filter/sort/refresh through core services", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, name: "alpha" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, name: "beta" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
      ],
    })
    let viewportRange = { start: -1, end: -1 }

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        viewport: {
          name: "viewport",
          setViewportRange(range) {
            viewportRange = { ...range }
          },
        },
      },
    })

    const api = createDataGridApi({ core })

    api.setSortModel([{ key: "id", direction: "asc" }])
    api.setFilterModel({ columnFilters: { name: ["alpha"] }, advancedFilters: {} })
    api.setViewportRange({ start: 0, end: 1 })
    api.setColumnVisibility("id", false)
    api.setColumnWidth("name", 280)
    api.setColumnPin("name", "left")
    api.setColumnOrder(["name", "id"])
    api.refreshRows("manual")

    const rowSnapshot = api.getRowModelSnapshot<{ id: number; name: string }>()
    const columnSnapshot = api.getColumnModelSnapshot()

    expect(rowSnapshot.sortModel).toEqual([{ key: "id", direction: "asc" }])
    expect(rowSnapshot.filterModel).toEqual({
      columnFilters: { name: ["alpha"] },
      advancedFilters: {},
    })
    expect(rowSnapshot.viewportRange).toEqual({ start: 0, end: 1 })
    expect(viewportRange).toEqual({ start: 0, end: 1 })
    expect(api.getRowCount()).toBe(2)
    expect(api.getRow<{ id: number; name: string }>(0)?.row.name).toBe("alpha")
    expect(columnSnapshot.order).toEqual(["name", "id"])
    expect(api.getColumn("id")?.visible).toBe(false)
    expect(api.getColumn("name")?.pin).toBe("left")
    expect(api.getColumn("name")?.width).toBe(280)
  })

  it("exposes selection capability checks and fails loudly for missing capability methods", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: { name: "selection" },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.hasSelectionSupport()).toBe(false)
    expect(api.getSelectionSnapshot()).toBeNull()
    expect(() => api.clearSelection()).toThrow(/selection/)
  })

  it("delegates selection APIs when selection capability is implemented", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    let selectionSnapshot: DataGridSelectionSnapshot | null = null
    let clearCount = 0

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
            clearCount += 1
          },
        },
      },
    })

    const api = createDataGridApi({ core })
    const snapshot = {
      ranges: [],
      activeRangeIndex: -1,
      activeCell: null,
    } satisfies DataGridSelectionSnapshot

    api.setSelectionSnapshot(snapshot)
    expect(api.hasSelectionSupport()).toBe(true)
    expect(api.getSelectionSnapshot()).toBe(snapshot)

    api.clearSelection()
    expect(clearCount).toBe(1)
    expect(api.getSelectionSnapshot()).toBeNull()
  })

  it("exposes transaction capability checks and fails loudly for missing methods", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        transaction: { name: "transaction" },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.hasTransactionSupport()).toBe(false)
    expect(api.getTransactionSnapshot()).toBeNull()
    expect(() => api.undoTransaction()).toThrow(/transaction/)
  })

  it("delegates transaction APIs when transaction capability is implemented", async () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    const values: Record<string, number> = {}
    const transactionService = createDataGridTransactionService({
      execute(command) {
        if (command.type !== "set") {
          return
        }
        const payload = command.payload as { key: string; value: number }
        values[payload.key] = payload.value
      },
    })

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        transaction: {
          name: "transaction",
          getTransactionSnapshot: transactionService.getSnapshot,
          beginTransactionBatch: transactionService.beginBatch,
          commitTransactionBatch: transactionService.commitBatch,
          rollbackTransactionBatch: transactionService.rollbackBatch,
          applyTransaction: transactionService.applyTransaction,
          canUndoTransaction: transactionService.canUndo,
          canRedoTransaction: transactionService.canRedo,
          undoTransaction: transactionService.undo,
          redoTransaction: transactionService.redo,
        },
      },
    })

    const api = createDataGridApi({ core })
    await api.applyTransaction({
      commands: [
        {
          type: "set",
          payload: { key: "a", value: 1 },
          rollbackPayload: { key: "a", value: 0 },
        },
      ],
    })
    expect(api.hasTransactionSupport()).toBe(true)
    expect(api.canUndoTransaction()).toBe(true)
    expect(values.a).toBe(1)

    await api.undoTransaction()
    expect(values.a).toBe(0)
    expect(api.canRedoTransaction()).toBe(true)
  })
})
