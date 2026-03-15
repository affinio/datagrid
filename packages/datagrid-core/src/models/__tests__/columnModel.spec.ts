import { describe, expect, it } from "vitest"
import { createDataGridColumnModel } from "../index"

describe("createDataGridColumnModel", () => {
  it("builds deterministic order and visibility snapshot", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "a", label: "A" },
        { key: "b", label: "B", initialState: { visible: false } },
        { key: "c", label: "C" },
      ],
    })

    const snapshot = model.getSnapshot()
    expect(snapshot.order).toEqual(["a", "b", "c"])
    expect(snapshot.visibleColumns.map(column => column.key)).toEqual(["a", "c"])
    model.dispose()
  })

  it("applies order/visibility/pin/width mutations", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
      ],
    })

    model.setColumnOrder(["c", "a"])
    model.setColumnVisibility("b", false)
    model.setColumnPin("a", "left")
    model.setColumnWidth("c", 240)

    const snapshot = model.getSnapshot()
    expect(snapshot.order).toEqual(["c", "a", "b"])
    expect(snapshot.visibleColumns.map(column => column.key)).toEqual(["c", "a"])
    expect(model.getColumn("a")?.pin).toBe("left")
    expect(model.getColumn("c")?.width).toBe(240)
    model.dispose()
  })

  it("accepts headless column defs without UI-only fields", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "id" },
        { key: "status", initialState: { pin: "right", width: 120 } },
      ],
    })

    const snapshot = model.getSnapshot()
    expect(snapshot.order).toEqual(["id", "status"])
    expect(snapshot.columns[0]?.column.label).toBeUndefined()
    expect(snapshot.columns[1]?.pin).toBe("right")
    expect(snapshot.columns[1]?.width).toBe(120)
    model.dispose()
  })

  it("keeps adapter metadata in a dedicated meta channel", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "name", label: "Name", meta: { isSystem: true, align: "left", formatter: "text" } },
      ],
    })

    const column = model.getColumn("name")
    expect(column?.column.meta).toEqual({
      isSystem: true,
      align: "left",
      formatter: "text",
    })
    model.dispose()
  })

  it("preserves nested semantic column contracts", () => {
    const model = createDataGridColumnModel({
      columns: [
        {
          key: "amount",
          field: "billing.amount",
          label: "Amount",
          dataType: "currency",
          presentation: {
            align: "right",
            headerAlign: "center",
            format: {
              number: {
                locale: "en-GB",
                style: "currency",
                currency: "GBP",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
              dateTime: {
                locale: "en-GB",
                year: "numeric",
                month: "short",
                day: "2-digit",
              },
            },
          },
          capabilities: {
            editable: true,
            sortable: true,
            filterable: true,
            aggregatable: true,
          },
          constraints: {
            min: 0,
            max: 10_000,
          },
        },
      ],
    })

    const column = model.getColumn("amount")
    expect(column?.column.field).toBe("billing.amount")
    expect(column?.column.dataType).toBe("currency")
    expect(column?.column.cellType).toBe("currency")
    expect(column?.column.presentation).toEqual({
      align: "right",
      headerAlign: "center",
      format: {
        number: {
          locale: "en-GB",
          style: "currency",
          currency: "GBP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
        dateTime: {
          locale: "en-GB",
          year: "numeric",
          month: "short",
          day: "2-digit",
        },
      },
    })
    expect(column?.column.capabilities).toEqual({
      editable: true,
      sortable: true,
      filterable: true,
      aggregatable: true,
    })
    expect(column?.column.constraints).toEqual({
      min: 0,
      max: 10_000,
    })
    model.dispose()
  })

  it("normalizes implicit semantic inputs into canonical cellType", () => {
    const model = createDataGridColumnModel({
      columns: [
        { key: "approved", dataType: "boolean" },
        {
          key: "status",
          presentation: {
            options: ["Pending", "Approved"],
          },
        },
        { key: "ratio", dataType: "percent" },
      ],
    })

    const snapshot = model.getSnapshot()
    expect(snapshot.byKey.approved?.column.cellType).toBe("checkbox")
    expect(snapshot.byKey.status?.column.cellType).toBe("select")
    expect(snapshot.byKey.status?.column.presentation).toEqual({
      options: ["Pending", "Approved"],
    })
    expect(snapshot.byKey.ratio?.column.cellType).toBe("percent")
    expect(snapshot.byKey.ratio?.column.presentation).toEqual({
      format: {
        number: {
          style: "percent",
        },
      },
    })

    model.dispose()
  })

  it("reuses cached normalized columns when immutable inputs are reused", () => {
    const amountColumn = {
      key: "amount",
      label: "Amount",
      dataType: "currency" as const,
      presentation: {
        align: "right" as const,
        format: {
          number: {
            locale: "en-GB",
            style: "currency" as const,
            currency: "GBP",
          },
        },
      },
    }
    const model = createDataGridColumnModel({
      columns: [amountColumn],
    })

    const firstDefinition = model.getColumn("amount")?.column
    model.setColumns([amountColumn])
    const secondDefinition = model.getColumn("amount")?.column

    expect(secondDefinition).toBe(firstDefinition)
    model.dispose()
  })

  it("separates immutable definitions from runtime state and freezes snapshots", () => {
    const model = createDataGridColumnModel({
      columns: [
        {
          key: "amount",
          label: "Amount",
          minWidth: 100,
          maxWidth: 160,
          initialState: {
            visible: false,
            pin: "left",
            width: 220,
          },
        },
        {
          key: "name",
          label: "Name",
        },
      ],
    })

    const snapshot = model.getSnapshot()
    const amount = snapshot.byKey.amount

    expect(amount?.column).toEqual({
      key: "amount",
      label: "Amount",
      minWidth: 100,
      maxWidth: 160,
    })
    expect(amount?.state).toEqual({
      visible: false,
      pin: "left",
      width: 160,
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.columns)).toBe(true)
    expect(Object.isFrozen(snapshot.order)).toBe(true)
    expect(Object.isFrozen(snapshot.byKey)).toBe(true)
    expect(Object.isFrozen(amount ?? {})).toBe(true)
    expect(Object.isFrozen(amount?.column ?? {})).toBe(true)
    expect(Object.isFrozen(amount?.state ?? {})).toBe(true)
    expect(snapshot.pinnedLeftColumns.map(column => column.key)).toEqual([])
    expect(snapshot.centerColumns.map(column => column.key)).toEqual(["name"])
    expect(snapshot.pinnedRightColumns).toEqual([])

    model.dispose()
  })

  it("clamps runtime widths against definition constraints", () => {
    const model = createDataGridColumnModel({
      columns: [{ key: "amount", minWidth: 120, maxWidth: 240 }],
    })

    model.setColumnWidth("amount", 20)
    expect(model.getColumn("amount")?.width).toBe(120)

    model.setColumnWidth("amount", 480)
    expect(model.getColumn("amount")?.width).toBe(240)

    model.dispose()
  })

  it("fails fast for invalid or duplicated column keys", () => {
    expect(() => createDataGridColumnModel({
      columns: [{ key: "" }],
    })).toThrowError(/column key/i)

    expect(() => createDataGridColumnModel({
      columns: [{ key: "owner" }, { key: "owner" }],
    })).toThrowError(/duplicate column key/i)
  })
})
