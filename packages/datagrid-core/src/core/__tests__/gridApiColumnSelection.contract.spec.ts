import { describe, expect, it } from "vitest"
import type { DataGridColumnSelectionSnapshot } from "../../selection/columnSelection.js"
import { createDataGridApi } from "../gridApi.js"
import { createDataGridCore } from "../gridCore.js"
import { createDataGridColumnModel, createAdvancedClientRowModel } from "../../models/index.js"

function createHarness(withColumnSelection = true) {
  const rowModel = createAdvancedClientRowModel()
  const columnModel = createDataGridColumnModel({
    columns: [
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
      { key: "owner", label: "Owner" },
    ],
  })
  let snapshot: DataGridColumnSelectionSnapshot | null = null
  const core = createDataGridCore({
    services: {
      rowModel: { name: "rowModel", model: rowModel },
      columnModel: { name: "columnModel", model: columnModel },
      ...(withColumnSelection
        ? {
            selection: {
              name: "selection" as const,
              getColumnSelectionSnapshot: () => snapshot,
              setColumnSelectionSnapshot: (next: DataGridColumnSelectionSnapshot) => { snapshot = next },
              clearColumnSelection: () => { snapshot = null },
            },
          }
        : {}),
    },
  })
  return { api: createDataGridApi({ core }), columnModel, getStoredSnapshot: () => snapshot }
}

describe("DataGridApi column selection contracts", () => {
  it("reports an optional capability and throws for unsupported mutations", () => {
    const { api } = createHarness(false)
    expect(api.columnSelection.hasSupport()).toBe(false)
    expect(api.columnSelection.getSnapshot()).toBeNull()
    expect(api.capabilities.columnSelection).toBe(false)
    expect(api.meta.getCapabilities().columnSelection).toBe(false)
    expect(() => api.columnSelection.clear()).toThrow(/columnSelection/)
  })

  it("selects by stable column key and emits one contextual event per set change", () => {
    const { api, columnModel, getStoredSnapshot } = createHarness()
    const events: Array<{ snapshot: DataGridColumnSelectionSnapshot | null; origin?: string; operationId: string }> = []
    api.events.on("column-selection:changed", event => events.push(event))

    api.columnSelection.setSelected("status", true, { origin: "header", operationId: "column-op-1" })
    expect(api.columnSelection.getSelectedColumns()).toEqual(["status"])
    expect(api.columnSelection.isSelected("status")).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ origin: "header", operationId: "column-op-1" })

    api.columnSelection.setSnapshot({ selectedColumnKeys: ["status", "status"] })
    expect(events).toHaveLength(1)
    expect(getStoredSnapshot()?.selectedColumnKeys).toEqual(["status"])

    api.columns.setOrder(["owner", "status", "name"])
    api.columns.setVisibility("status", false)
    expect(api.columnSelection.getSelectedColumns()).toEqual(["status"])

    api.columnSelection.selectColumns(["name", "owner", "status"])
    expect(api.columnSelection.getSelectedColumns()).toEqual(["status", "name", "owner"])
    api.columnSelection.deselectColumns(["status", "missing"])
    expect(api.columnSelection.getSelectedColumns()).toEqual(["name", "owner"])

    const returned = api.columnSelection.getSnapshot()
    expect(returned).not.toBeNull()
    expect(Object.isFrozen(returned)).toBe(true)
    expect(Object.isFrozen(returned?.selectedColumnKeys)).toBe(true)
    expect(columnModel.getSnapshot().columns.find(column => column.key === "status")?.visible).toBe(false)
  })

  it("captures, restores, and migrates column selection in unified state", () => {
    const { api, getStoredSnapshot } = createHarness()
    api.columnSelection.selectColumns(["status", "owner"])
    const saved = api.state.get()
    expect(saved.columnSelection).toEqual({ selectedColumnKeys: ["status", "owner"] })

    api.columnSelection.clear()
    expect(api.columnSelection.getSnapshot()).toBeNull()
    api.state.set(saved)
    expect(api.columnSelection.getSelectedColumns()).toEqual(["status", "owner"])

    let changes = 0
    api.events.on("column-selection:changed", () => { changes += 1 })
    api.state.set(saved)
    expect(changes).toBe(0)

    const legacyState = { ...saved, columnSelection: undefined }
    const migrated = api.state.migrate(legacyState)
    expect(migrated?.columnSelection).toBeNull()
    api.state.set(legacyState)
    expect(api.columnSelection.getSnapshot()).toBeNull()
    expect(getStoredSnapshot()).toBeNull()
  })

  it("prevalidates strict restore when the saved selection capability is missing", () => {
    const source = createHarness()
    source.api.columnSelection.selectColumns(["status"])
    const saved = source.api.state.get()
    const target = createHarness(false)
    const before = target.api.columns.getSnapshot()

    expect(() => target.api.state.set(saved, { strict: true })).toThrow(/columnSelection capability/)
    expect(target.api.columns.getSnapshot()).toEqual(before)
  })
})
