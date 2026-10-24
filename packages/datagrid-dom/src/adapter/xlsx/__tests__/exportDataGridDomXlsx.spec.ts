import { afterEach, describe, expect, it, vi } from "vitest"
import { writeXlsx, type XlsxWorkbookInput } from "@affino/export-xlsx"
import { mountDataGrid } from "../../mountDataGrid.js"
import { exportDataGridDomXlsx } from "../index.js"

describe("exportDataGridDomXlsx", () => {
  let workerInstances: Array<{ input: XlsxWorkbookInput | null; terminated: boolean }> = []

  afterEach(() => {
    vi.unstubAllGlobals()
    workerInstances = []
    document.body.replaceChildren()
  })

  function installWorker(): void {
    class TestWorker {
      onmessage: ((event: MessageEvent<{ bytes?: ArrayBuffer; error?: string }>) => void) | null = null
      onerror: ((event: ErrorEvent) => void) | null = null
      readonly state = { input: null as XlsxWorkbookInput | null, terminated: false }

      constructor() { workerInstances.push(this.state) }
      terminate(): void { this.state.terminated = true }
      postMessage(input: XlsxWorkbookInput): void {
        this.state.input = input
        const bytes = writeXlsx(input)
        const buffer = Uint8Array.from(bytes).buffer as ArrayBuffer
        queueMicrotask(() => this.onmessage?.({ data: { bytes: buffer } } as MessageEvent<{ bytes?: ArrayBuffer }>))
      }
    }
    vi.stubGlobal("Worker", TestWorker)
  }

  it("exports the complete sorted Core projection and computed formula values", async () => {
    installWorker()
    const host = document.createElement("div")
    document.body.append(host)
    const grid = mountDataGrid(host, {
      rows: [
        { id: "r1", item: "Small", price: 3, quantity: 2 },
        { id: "r2", item: "Large", price: 9, quantity: 4 },
        { id: "r3", item: "Medium", price: 5, quantity: 3 },
      ],
      formulas: [{ name: "total", formula: "price * quantity" }],
      columns: [
        { key: "item", field: "item", label: "Item", export: { dataType: "text" } },
        { key: "price", field: "price", label: "Price", dataType: "currency", export: { numberFormat: '"$"#,##0.00' } },
        { key: "quantity", field: "quantity", label: "Qty", dataType: "number" },
        { key: "total", field: "total", label: "Total", dataType: "currency", export: { style: { bold: true, fillColor: "EAF2FB" } } },
      ],
    })
    await grid.ready
    grid.api.rows.setSortModel([{ key: "price", direction: "desc" }])

    const result = await exportDataGridDomXlsx(grid.api, { fileName: "orders.xlsx", sheetName: "Orders" })

    if (result.status !== "success") throw new Error(JSON.stringify(result))
    expect(result.fileName).toBe("orders.xlsx")
    expect(result.rowCount).toBe(3)
    expect(result.columnCount).toBe(4)
    expect(result.bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]))
    const workbook = workerInstances[0]?.input
    expect(workbook?.sheets[0]?.name).toBe("Orders")
    expect(workbook?.sheets[0]?.rows).toHaveLength(4)
    expect(workbook?.sheets[0]?.rows[1]?.[0]).toMatchObject({ type: "string", value: "Large" })
    expect(workbook?.sheets[0]?.rows[1]?.[3]).toMatchObject({ type: "number", value: 36, style: { bold: true, fillColor: "EAF2FB" } })
    expect(workerInstances[0]?.terminated).toBe(true)

    const formulaResult = await exportDataGridDomXlsx(grid.api, { formulas: "excel" })
    expect(formulaResult.status).toBe("success")
    expect(workerInstances[1]?.input?.sheets[0]?.rows[1]?.[3]).toMatchObject({
      type: "formula",
      value: "=(B2*C2)",
      cachedValue: 36,
    })
    await grid.destroy()
  })

  it("exports the current pivot projection with generated value columns", async () => {
    installWorker()
    const grid = mountDataGrid(document.createElement("div"), {
      rows: [
        { id: "s1", team: "Platform", quarter: "Q1", revenue: 120 },
        { id: "s2", team: "Platform", quarter: "Q2", revenue: 145 },
        { id: "s3", team: "Research", quarter: "Q1", revenue: 80 },
        { id: "s4", team: "Research", quarter: "Q2", revenue: 110 },
      ],
      columns: [
        { key: "team", field: "team", label: "Team" },
        { key: "quarter", field: "quarter", label: "Quarter" },
        { key: "revenue", field: "revenue", label: "Revenue", dataType: "number" },
      ],
    })
    await grid.ready
    grid.api.pivot.setModel({
      rows: ["team"],
      columns: ["quarter"],
      values: [{ field: "revenue", agg: "sum" }],
      grandTotal: true,
      columnGrandTotal: true,
    })

    const result = await exportDataGridDomXlsx(grid.api)

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error(JSON.stringify(result))
    const workbookRows = workerInstances[0]?.input?.sheets[0]?.rows ?? []
    expect(result.rowCount).toBe(grid.api.rows.getCount())
    expect(result.columnCount).toBe(grid.api.columns.getSnapshot().visibleColumns.length)
    expect(workbookRows[0]?.map(cell => cell?.value)).toEqual(
      grid.api.columns.getSnapshot().visibleColumns.map(column => column.column.label ?? column.key),
    )
    expect(workbookRows.flat().some(cell => cell?.value === 120)).toBe(true)
    expect(workbookRows.flat().some(cell => cell?.value === 455)).toBe(true)
    await grid.destroy()
  })

  it("rejects incomplete projections and does not serialize partial data", async () => {
    installWorker()
    const grid = mountDataGrid(document.createElement("div"), {
      rows: [{ id: "r1", name: "One" }],
      columns: [{ key: "name", field: "name" }],
    })
    await grid.ready
    const captureView = vi.spyOn(grid.api.read, "captureView").mockImplementation(() => ({
      rows: { status: "available", revision: 1, value: {
        snapshot: { ...grid.api.rows.getSnapshot(), loading: false, initialLoading: false },
        projection: [],
        coverage: { scope: "current-projection", completeness: "partial", queryRevision: 1, datasetVersion: null, totalRowCount: 2, loadedRowCount: 1, missingIntervals: [{ start: 1, end: 1 }] },
      } },
      columns: { status: "available", revision: 1, value: grid.api.columns.getSnapshot() },
    } as never))

    const result = await exportDataGridDomXlsx(grid.api)

    expect(result).toMatchObject({ status: "unsupported", code: "incomplete-data" })
    expect(workerInstances).toHaveLength(0)
    captureView.mockRestore()
    await grid.destroy()
  })

  it("honors cancellation before snapshot work starts", async () => {
    installWorker()
    const grid = mountDataGrid(document.createElement("div"), {
      rows: [{ id: "r1", name: "One" }],
      columns: [{ key: "name", field: "name" }],
    })
    await grid.ready
    const controller = new AbortController()
    controller.abort()

    await expect(exportDataGridDomXlsx(grid.api, { signal: controller.signal })).resolves.toEqual({ status: "cancelled" })
    expect(workerInstances).toHaveLength(0)
    await grid.destroy()
  })

  it("refuses a workbook if a column accessor changes the grid during preparation", async () => {
    installWorker()
    let mutateWidth = false
    const grid = mountDataGrid(document.createElement("div"), {
      rows: [{ id: "r1", name: "One" }],
      columns: [{ key: "name", field: "name", valueGetter: row => {
        if (mutateWidth) grid.api.columns.setWidth("name", 180)
        return row.name
      } }],
    })
    await grid.ready
    mutateWidth = true

    const result = await exportDataGridDomXlsx(grid.api)

    expect(result).toMatchObject({ status: "error", code: "snapshot-changed" })
    expect(workerInstances).toHaveLength(0)
    await grid.destroy()
  })

  it("writes group sums as Excel SUBTOTAL formulas over exported detail rows", async () => {
    installWorker()
    const grid = mountDataGrid(document.createElement("div"), {
      rows: [
        { id: "r1", team: "A", amount: 10 },
        { id: "r2", team: "A", amount: 12 },
        { id: "r3", team: "B", amount: 20 },
      ],
      columns: [
        { key: "team", field: "team", label: "Team" },
        { key: "amount", field: "amount", label: "Amount", dataType: "number" },
        { key: "sum", field: "sum", label: "Team total", dataType: "number" },
      ],
    })
    await grid.ready
    grid.api.rows.setGroupBy({ fields: ["team"], expandedByDefault: true })
    grid.api.rows.setAggregationModel({ basis: "filtered", columns: [{ key: "sum", field: "amount", op: "sum" }] })

    const result = await exportDataGridDomXlsx(grid.api, { formulas: "excel" })

    expect(result.status).toBe("success")
    const rows = workerInstances[0]?.input?.sheets[0]?.rows
    expect(rows?.[1]?.[1]).toMatchObject({ type: "formula", value: "=SUBTOTAL(9,A3:A4)", cachedValue: 22 })
    expect(rows?.[4]?.[1]).toMatchObject({ type: "formula", value: "=SUBTOTAL(9,A6:A6)", cachedValue: 20 })
    expect(workerInstances[0]?.input?.sheets[0]?.rowOutlineLevels).toEqual([0, 0, 1, 1, 0, 1])
    await grid.destroy()
  })
})
