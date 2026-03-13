import { describe, expect, it } from "vitest"
import { createDataGridSpreadsheetSheetModel } from "../sheetModel.js"
import { materializeDataGridSpreadsheetViewRuntimeResult } from "../viewPipeline.js"

describe("spreadsheet view pipeline join reuse", () => {
  it("reuses explode join outputs for unchanged source rows when the right sheet is unchanged", () => {
    const ordersSheet = createDataGridSpreadsheetSheetModel({
      sheetId: "orders",
      sheetName: "Orders",
      columns: [{ key: "customerId" }, { key: "qty" }],
      rows: [
        { id: "order-1", cells: { customerId: 1, qty: 2 } },
        { id: "order-2", cells: { customerId: 2, qty: 4 } },
      ],
    })
    const contactsSheet = createDataGridSpreadsheetSheetModel({
      sheetId: "contacts",
      sheetName: "Contacts",
      columns: [{ key: "customerId" }, { key: "contactName" }],
      rows: [
        { id: "contact-1", cells: { customerId: 1, contactName: "Ada" } },
        { id: "contact-2", cells: { customerId: 1, contactName: "Bea" } },
        { id: "contact-3", cells: { customerId: 2, contactName: "Cy" } },
      ],
    })

    const pipeline = [
      {
        type: "join" as const,
        sheetId: "contacts",
        on: { leftKey: "customerId", rightKey: "customerId" },
        select: [{ key: "contactName" }],
        multiMatch: "explode" as const,
      },
    ]

    const initial = materializeDataGridSpreadsheetViewRuntimeResult({
      sheetId: "orders-with-contacts",
      sheetName: "Orders with contacts",
      sourceSheetId: "orders",
      sourceSheetModel: ordersSheet,
      resolveSheetModel: sheetId => (sheetId === "contacts" ? contactsSheet : null),
      pipeline,
    })

    ordersSheet.setCellInput({
      sheetId: "orders",
      rowId: "order-2",
      rowIndex: 1,
      columnKey: "qty",
    }, 5)

    const updated = materializeDataGridSpreadsheetViewRuntimeResult({
      sheetId: "orders-with-contacts",
      sheetName: "Orders with contacts",
      sourceSheetId: "orders",
      sourceSheetModel: ordersSheet,
      resolveSheetModel: sheetId => (sheetId === "contacts" ? contactsSheet : null),
      pipeline,
      previousJoinStageStatesByKey: initial.joinStageStatesByKey,
    })

    const initialJoinStage = initial.joinStageStatesByKey.values().next().value
    const updatedJoinStage = updated.joinStageStatesByKey.values().next().value
    expect(initialJoinStage).toBeTruthy()
    expect(updatedJoinStage).toBeTruthy()

    const initialOrder1Outputs = initialJoinStage.outputRowsBySourceRowId.get("order-1")
    const updatedOrder1Outputs = updatedJoinStage.outputRowsBySourceRowId.get("order-1")
    const initialOrder2Outputs = initialJoinStage.outputRowsBySourceRowId.get("order-2")
    const updatedOrder2Outputs = updatedJoinStage.outputRowsBySourceRowId.get("order-2")

    expect(updatedOrder1Outputs).toBe(initialOrder1Outputs)
    expect(updatedOrder2Outputs).not.toBe(initialOrder2Outputs)
    expect(updated.derivedRuntime.rows.map(row => row.id)).toEqual([
      "join:7:order-1|9:contact-1|0",
      "join:7:order-1|9:contact-2|1",
      "join:7:order-2|9:contact-3|0",
    ])

    ordersSheet.dispose()
    contactsSheet.dispose()
  })
})