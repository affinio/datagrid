import { describe, expect, it } from "vitest"
import {
  createClientRowModel,
  createDataGridColumnModel,
  createDataGridEditModel,
} from "../../models"
import { createDataGridCore } from "../gridCore"

describe("grid core state-engine composition contract", () => {
  it("wires row/column/edit/transaction/selection services through shared core registry", async () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1 }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "id", width: 120 }],
    })
    const editModel = createDataGridEditModel()
    const log: string[] = []

    const core = createDataGridCore({
      services: {
        event: { name: "event", init: () => log.push("init:event") },
        rowModel: { name: "rowModel", model: rowModel, init: () => log.push("init:rowModel") },
        columnModel: { name: "columnModel", model: columnModel, init: () => log.push("init:columnModel") },
        edit: { name: "edit", model: editModel, init: () => log.push("init:edit") },
        transaction: { name: "transaction", init: () => log.push("init:transaction") },
        selection: {
          name: "selection",
          init(context) {
            const row = context.getService("rowModel").model
            const column = context.getService("columnModel").model
            const edit = context.getService("edit").model
            const transaction = context.getService("transaction")
            if (!row || !column || !edit || !transaction) {
              throw new Error("state engine composition is incomplete")
            }
            log.push("init:selection")
          },
          getSelectionSnapshot() {
            return { ranges: [], activeRangeIndex: -1, activeCell: null }
          },
        },
        viewport: { name: "viewport", init: () => log.push("init:viewport") },
      },
    })

    await core.start()

    expect(core.getService("rowModel").model).toBe(rowModel)
    expect(core.getService("columnModel").model).toBe(columnModel)
    expect(core.getService("edit").model).toBe(editModel)
    expect(core.getService("selection").getSelectionSnapshot?.()).toEqual({
      ranges: [],
      activeRangeIndex: -1,
      activeCell: null,
    })
    expect(log).toEqual([
      "init:event",
      "init:rowModel",
      "init:columnModel",
      "init:edit",
      "init:transaction",
      "init:selection",
      "init:viewport",
    ])

    await core.dispose()
    rowModel.dispose()
    columnModel.dispose()
    editModel.dispose()
  })

  it("keeps deterministic init ordering for unified state services", async () => {
    const log: string[] = []
    const core = createDataGridCore({
      services: {
        event: { name: "event", init: () => log.push("init:event") },
        rowModel: { name: "rowModel", init: () => log.push("init:rowModel") },
        columnModel: { name: "columnModel", init: () => log.push("init:columnModel") },
        edit: { name: "edit", init: () => log.push("init:edit") },
        transaction: { name: "transaction", init: () => log.push("init:transaction") },
        selection: { name: "selection", init: () => log.push("init:selection") },
        viewport: { name: "viewport", init: () => log.push("init:viewport") },
      },
    })

    await core.init()

    const selectionIndex = log.indexOf("init:selection")
    expect(log.indexOf("init:rowModel")).toBeLessThan(selectionIndex)
    expect(log.indexOf("init:columnModel")).toBeLessThan(selectionIndex)
    expect(log.indexOf("init:edit")).toBeLessThan(selectionIndex)
    expect(log.indexOf("init:transaction")).toBeLessThan(selectionIndex)
  })
})
