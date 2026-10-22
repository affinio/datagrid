import { afterEach, describe, expect, it, vi } from "vitest"
import { exportDataGridXlsx } from "../exportDataGridXlsx"
import type { DataGridApi } from "@affino/datagrid-vue/headless"

const originalWorker = globalThis.Worker

function makeApi(overrides: Record<string, unknown> = {}): DataGridApi<{ id: string; amount: number }> {
  const columns = [
    { key: "id", visible: true, width: 80, column: { key: "id", label: "ID", field: "id", dataType: "text" } },
    { key: "amount", visible: true, width: 120, column: { key: "amount", label: "Amount", field: "amount", dataType: "currency", presentation: { format: { number: { style: "currency", currency: "GBP" } } }, export: { style: { fillColor: "DCFCE7", fontColor: "166534", bold: true } } } },
    { key: "hidden", visible: false, width: 90, column: { key: "hidden", label: "Hidden", field: "id" } },
  ]
  const api = {
    rows: {
      getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: null }),
      getCount: () => 2,
      get: (index: number) => index === 0
        ? { kind: "leaf", data: { id: "001234", amount: 1200 } }
        : { kind: "leaf", data: { id: "=SUM(A1:A2)", amount: 8.5 } },
      getAggregationModel: () => null,
      getFormulaFields: () => [],
    },
    columns: {
      getSnapshot: () => ({ columns, visibleColumns: columns.filter(column => column.visible) }),
    },
    ...overrides,
  }
  return api as unknown as DataGridApi<{ id: string; amount: number }>
}

class FakeWorker {
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent<{ bytes?: ArrayBuffer; error?: string }>) => void) | null = null
  payload: unknown
  terminated = false

  postMessage(payload: unknown): void {
    this.payload = payload
    queueMicrotask(() => this.onmessage?.({ data: { bytes: new Uint8Array([1, 2, 3]).buffer } } as MessageEvent))
  }

  terminate(): void {
    this.terminated = true
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: originalWorker })
})

describe("exportDataGridXlsx", () => {
  function useWorker(worker: FakeWorker): void {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: class extends FakeWorker {
        constructor() {
          super()
          return worker
        }
      },
    })
  }

  it("exports the logical current view with typed values without reading the DOM", async () => {
    const worker = new FakeWorker()
    useWorker(worker)

    const result = await exportDataGridXlsx(makeApi(), { sheetName: "Orders", fileName: "orders.xlsx" })

    expect(result).toMatchObject({ status: "success", rowCount: 2, columnCount: 2, fileName: "orders.xlsx" })
    const workbook = worker.payload as { sheets: Array<{ rows: Array<Array<{ type: string; value: unknown }>>; freezeRows: number }> }
    expect(workbook.sheets[0]?.freezeRows).toBe(1)
    expect(workbook.sheets[0]?.rows[0]?.map(cell => cell.value)).toEqual(["ID", "Amount"])
    expect(workbook.sheets[0]?.rows[1]?.[0]).toMatchObject({ type: "string", value: "001234" })
    expect(workbook.sheets[0]?.rows[1]?.[1]).toMatchObject({
      type: "number",
      value: 1200,
      style: { numberFormat: expect.any(String), fillColor: "DCFCE7", fontColor: "166534", bold: true },
    })
    expect(workbook.sheets[0]?.rows[2]?.[0]).toMatchObject({ type: "string", value: "=SUM(A1:A2)" })
    expect(worker.terminated).toBe(true)
  })

  it("uses the column key as the default accessor when no field is declared", async () => {
    const worker = new FakeWorker()
    useWorker(worker)
    const columns = [
      { key: "id", visible: true, width: 80, column: { key: "id", label: "ID", dataType: "text" } },
      { key: "amount", visible: true, width: 120, column: { key: "amount", label: "Amount", dataType: "number" } },
    ]
    const api = makeApi({
      rows: {
        getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: null }),
        getCount: () => 1,
        get: () => ({ kind: "leaf", data: { id: "r1", amount: 42 } }),
      },
      columns: { getSnapshot: () => ({ columns, visibleColumns: columns }) },
    })

    await expect(exportDataGridXlsx(api)).resolves.toMatchObject({ status: "success", rowCount: 1 })
    const workbook = worker.payload as { sheets: Array<{ rows: Array<Array<{ value: unknown } | null>> }> }
    expect(workbook.sheets[0]?.rows[1]).toEqual([
      expect.objectContaining({ value: "r1" }),
      expect.objectContaining({ value: 42 }),
    ])
  })

  it("writes supported formula fields as Excel formula cells with same-row references", async () => {
    const worker = new FakeWorker()
    useWorker(worker)
    const columns = [
      { key: "id", visible: true, width: 80, column: { key: "id", label: "ID" } },
      { key: "qty", visible: true, width: 80, column: { key: "qty", label: "Qty", dataType: "number" } },
      { key: "price", visible: true, width: 80, column: { key: "price", label: "Price", dataType: "currency" } },
      { key: "subtotal", visible: true, width: 100, column: { key: "subtotal", label: "Subtotal", dataType: "currency" } },
      { key: "unitPrice", visible: true, width: 100, column: { key: "unitPrice", label: "Unit price", dataType: "currency" } },
    ]
    const api = makeApi({
      rows: {
        getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: null }),
        getCount: () => 1,
        get: () => ({ kind: "leaf", data: { id: "r1", qty: 3, price: 4, subtotal: 12, unitPrice: 4 } }),
        getFormulaFields: () => [
          { name: "subtotal", field: "subtotal", formula: "qty * price", deps: [], contextKeys: [] },
          { name: "unitPrice", field: "unitPrice", formula: "SAFE_DIVIDE(subtotal, qty, 0)", deps: [], contextKeys: [] },
        ],
      },
      columns: { getSnapshot: () => ({ columns, visibleColumns: columns }) },
    })

    await expect(exportDataGridXlsx(api, { formulas: "excel" })).resolves.toMatchObject({ status: "success" })
    const workbook = worker.payload as { sheets: Array<{ rows: Array<Array<{ type: string; value: unknown } | null>> }> }
    expect(workbook.sheets[0]?.rows[1]?.[3]).toMatchObject({ type: "formula", value: "=(B2*C2)", cachedValue: 12 })
    expect(workbook.sheets[0]?.rows[1]?.[4]).toMatchObject({ type: "formula", value: "=IF(B2=0,0,D2/B2)", cachedValue: 4 })
  })

  it("keeps group rows, aggregate values, and hierarchy levels in the workbook", async () => {
    const worker = new FakeWorker()
    useWorker(worker)
    const columns = [
      {
        key: "__affino_hierarchy__",
        visible: true,
        width: 180,
        column: {
          key: "__affino_hierarchy__",
          label: "Team",
          field: "name",
          meta: { hierarchyLeafSourceColumnKey: "name" },
        },
      },
      { key: "amount", visible: true, width: 100, column: { key: "amount", label: "Amount", field: "amount", dataType: "currency" } },
    ]
    const groupNode = {
      kind: "group",
      rowId: "region=North",
      data: { __group: true },
      groupMeta: {
        groupKey: "region=North",
        groupField: "region",
        groupValue: "North",
        level: 0,
        childrenCount: 2,
        aggregates: { amount: 1200 },
      },
    }
    const leafNode = { kind: "leaf", rowId: "r1", data: { name: "Ada", amount: 1200 } }
    const api = makeApi({
      rows: {
        getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: { fields: ["region"] }, pivotModel: null }),
        getCount: () => 2,
        get: (index: number) => index === 0 ? groupNode : leafNode,
      },
      columns: { getSnapshot: () => ({ columns, visibleColumns: columns }) },
    })

    const result = await exportDataGridXlsx(api)

    expect(result).toMatchObject({ status: "success", rowCount: 2 })
    const workbook = worker.payload as { sheets: Array<{ rows: Array<Array<{ type: string; value: unknown; style?: { indent?: number } }>>; rowOutlineLevels: number[] }> }
    expect(workbook.sheets[0]?.rows[1]?.[0]).toMatchObject({ type: "string", value: "North (2)" })
    expect(workbook.sheets[0]?.rows[1]?.[1]).toMatchObject({ type: "number", value: 1200 })
    expect(workbook.sheets[0]?.rows[2]?.[0]).toMatchObject({ type: "string", value: "Ada", style: { indent: 1 } })
    expect(workbook.sheets[0]?.rowOutlineLevels).toEqual([0, 0, 1])
  })

  it("exports nested sum group rows as SUBTOTAL formulas without double-counting child totals", async () => {
    const worker = new FakeWorker()
    useWorker(worker)
    const columns = [
      { key: "region", visible: true, width: 120, column: { key: "region", label: "Region" } },
      { key: "amount", visible: true, width: 100, column: { key: "amount", label: "Amount", dataType: "currency" } },
    ]
    const rowNodes = [
      { kind: "group", rowId: "region=north", data: {}, groupMeta: { groupKey: "region=north", groupField: "region", groupValue: "North", level: 0, childrenCount: 1, aggregates: { amount: 30 } } },
      { kind: "group", rowId: "segment=retail", data: {}, groupMeta: { groupKey: "segment=retail", groupField: "segment", groupValue: "Retail", level: 1, childrenCount: 2, aggregates: { amount: 30 } } },
      { kind: "leaf", rowId: "r1", data: { region: "North", amount: 10 } },
      { kind: "leaf", rowId: "r2", data: { region: "North", amount: 20 } },
    ]
    const api = makeApi({
      rows: {
        getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: { fields: ["region", "segment"] }, pivotModel: null }),
        getCount: () => rowNodes.length,
        get: (index: number) => rowNodes[index],
        getFormulaFields: () => [],
        getAggregationModel: () => ({ columns: [{ key: "amount", field: "amount", op: "sum" }], basis: "filtered" }),
      },
      columns: { getSnapshot: () => ({ columns, visibleColumns: columns }) },
    })

    await expect(exportDataGridXlsx(api, { formulas: "excel" })).resolves.toMatchObject({ status: "success", rowCount: 4 })
    const workbook = worker.payload as { sheets: Array<{ rows: Array<Array<{ type: string; value: unknown; cachedValue?: unknown } | null>> }> }
    expect(workbook.sheets[0]?.rows[1]?.[1]).toMatchObject({ type: "formula", value: "=SUBTOTAL(9,B3:B5)", cachedValue: 30 })
    expect(workbook.sheets[0]?.rows[2]?.[1]).toMatchObject({ type: "formula", value: "=SUBTOTAL(9,B4:B5)", cachedValue: 30 })
  })

  it("exports expanded tree-path rows with nested outline levels", async () => {
    const worker = new FakeWorker()
    useWorker(worker)
    const api = makeApi({
      rows: {
        getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: null, treeDataDiagnostics: {} }),
        getCount: () => 2,
        get: (index: number) => index === 0
          ? {
              kind: "group",
              rowId: "path:Projects",
              data: { __tree: true },
              groupMeta: { groupKey: "path:Projects", groupField: "path", groupValue: "Projects", level: 0, childrenCount: 1 },
            }
          : { kind: "leaf", rowId: "r1", data: { id: "001", amount: 5 } },
      },
    })

    await expect(exportDataGridXlsx(api)).resolves.toMatchObject({ status: "success", rowCount: 2 })
    const workbook = worker.payload as { sheets: Array<{ rows: Array<Array<{ type: string; value: unknown; style?: { indent?: number } }>>; rowOutlineLevels: number[] }> }
    expect(workbook.sheets[0]?.rows[1]?.[0]).toMatchObject({ type: "string", value: "Projects (1)" })
    expect(workbook.sheets[0]?.rows[2]?.[0]).toMatchObject({ type: "string", value: "001", style: { indent: 1 } })
    expect(workbook.sheets[0]?.rowOutlineLevels).toEqual([0, 0, 1])
  })

  it("refuses pivot projections", async () => {
    const api = makeApi({ rows: {
      getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: { rows: [], columns: [], values: [] } }),
      getCount: () => 0,
      get: () => undefined,
    } })
    await expect(exportDataGridXlsx(api)).resolves.toMatchObject({ status: "unsupported", code: "pivot-view" })
  })

  it("refuses an unloaded row rather than silently exporting a partial view", async () => {
    const api = makeApi({ rows: {
      getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: null }),
      getCount: () => 2,
      get: (index: number) => index === 0 ? { kind: "leaf", data: { id: "1", amount: 1 } } : undefined,
    } })
    await expect(exportDataGridXlsx(api)).resolves.toMatchObject({ status: "unsupported", code: "incomplete-data" })
  })

  it("refuses server loading placeholders even when the row lookup returns a node", async () => {
    const api = makeApi({ rows: {
      getSnapshot: () => ({ revision: 1, loading: false, initialLoading: false, groupBy: null, pivotModel: null }),
      getCount: () => 1,
      get: () => ({ kind: "leaf", data: {}, __placeholder: true }),
    } })
    await expect(exportDataGridXlsx(api)).resolves.toMatchObject({ status: "unsupported", code: "incomplete-data" })
  })

  it("cancels before starting worker serialization", async () => {
    const worker = vi.fn()
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: worker })
    const controller = new AbortController()
    controller.abort()
    await expect(exportDataGridXlsx(makeApi(), { signal: controller.signal })).resolves.toEqual({ status: "cancelled" })
    expect(worker).not.toHaveBeenCalled()
  })
})
