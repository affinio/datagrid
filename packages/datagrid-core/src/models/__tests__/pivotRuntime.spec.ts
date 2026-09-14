import { describe, expect, it } from "vitest"
import { createPivotRuntime } from "../pivotRuntime"
import type { DataGridPivotSpec, DataGridRowNode } from "../rowModel"

interface PivotRow {
  id: string
  region: string
  year: number
  revenue: number
}

function createLeafRow(row: PivotRow, index: number): DataGridRowNode<PivotRow> {
  return {
    kind: "leaf",
    data: row,
    row: row,
    rowKey: row.id,
    rowId: row.id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: "none",
      expanded: false,
    },
  }
}

describe("pivotRuntime incremental patching", () => {

  it("fails closed before dense materialization when output cell limit is exceeded", () => {
    const runtime = createPivotRuntime<PivotRow>({ maxOutputCells: 2 })
    const sourceRows = [
      createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
      createLeafRow({ id: "r2", region: "EMEA", year: 2025, revenue: 20 }, 1),
    ]
    const result = runtime.projectRows({
      inputRows: sourceRows,
      pivotModel: {
        rows: ["region"],
        columns: ["year"],
        values: [{ field: "revenue", agg: "sum" }],
      },
      normalizeFieldValue: value => String(value ?? ""),
    })

    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.diagnostics).toEqual({
      kind: "output-limit-exceeded",
      estimatedCells: 4,
      maxOutputCells: 2,
    })
  })
  it("fails closed for a high-cardinality 50k-row pivot before dense rows are built", () => {
    const runtime = createPivotRuntime<PivotRow>({ maxOutputCells: 1_000 })
    const sourceRows = Array.from({ length: 50_000 }, (_, index) => createLeafRow({
      id: `r${index}`,
      region: `region-${index % 100}`,
      year: index,
      revenue: index,
    }, index))

    const result = runtime.projectRows({
      inputRows: sourceRows,
      pivotModel: {
        rows: ["region"],
        columns: ["year"],
        values: [{ field: "revenue", agg: "sum" }],
      },
      normalizeFieldValue: value => String(value ?? ""),
    })

    expect(result.rows).toEqual([])
    expect(result.columns).toEqual([])
    expect(result.diagnostics).toEqual({
      kind: "output-limit-exceeded",
      estimatedCells: 5_000_000,
      maxOutputCells: 1_000,
    })
  })

  it("omits absent aggregate fields in opt-in sparse row payloads", () => {
    const runtime = createPivotRuntime<PivotRow>({ sparseOutput: true })
    const result = runtime.projectRows({
      inputRows: [
        createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
        createLeafRow({ id: "r2", region: "EMEA", year: 2025, revenue: 20 }, 1),
      ],
      pivotModel: {
        rows: ["region"],
        columns: ["year"],
        values: [{ field: "revenue", agg: "sum" }],
      },
      normalizeFieldValue: value => String(value ?? ""),
    })

    const amer = result.rows.find(row => String((row.row as Record<string, unknown>).region) === "AMER")
    const emea = result.rows.find(row => String((row.row as Record<string, unknown>).region) === "EMEA")
    expect(amer).toBeDefined()
    expect(emea).toBeDefined()
    const amerData = amer!.row as Record<string, unknown>
    const emeaData = emea!.row as Record<string, unknown>
    const amerYearColumns = result.columns.filter(column => column.columnPath.some(segment => segment.value === "2024"))
    const emeaYearColumns = result.columns.filter(column => column.columnPath.some(segment => segment.value === "2025"))
    expect(amerYearColumns.every(column => Object.hasOwn(amerData, column.id))).toBe(true)
    expect(amerYearColumns.length).toBeGreaterThan(0)
    expect(emeaYearColumns.every(column => !Object.hasOwn(amerData, column.id))).toBe(true)
    expect(emeaYearColumns.every(column => Object.hasOwn(emeaData, column.id))).toBe(true)
  })

  it("stores opt-in sparse aggregate values outside row objects", () => {
    const runtime = createPivotRuntime<PivotRow>({ sparseOutput: true, sparseStorage: true })
    const projected = runtime.projectRows({
      inputRows: [createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0)],
      pivotModel: { rows: ["region"], columns: ["year"], values: [{ field: "revenue", agg: "sum" }] },
      normalizeFieldValue: value => String(value ?? ""),
    })
    const column = projected.columns[0]!
    const row = projected.rows[0]!
    expect(Object.hasOwn(row.data as Record<string, unknown>, column.id)).toBe(false)
    expect(runtime.readCell({ rowKey: String(row.rowId), columnKey: column.id, valueField: column.valueField })).toEqual({ kind: "value", value: 10 })
    expect(runtime.materializeRows({ mode: "dense", maxCells: 10 }).rows[0]?.data).toHaveProperty(column.id, 10)
  })

  it("reads sparse cells without materializing missing neighbors", () => {
    const runtime = createPivotRuntime<PivotRow>({ sparseOutput: true })
    const result = runtime.projectRows({
      inputRows: [
        createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
        createLeafRow({ id: "r2", region: "EMEA", year: 2025, revenue: 20 }, 1),
      ],
      pivotModel: {
        rows: ["region"],
        columns: ["year"],
        values: [{ field: "revenue", agg: "sum" }],
      },
      normalizeFieldValue: value => String(value ?? ""),
    })
    const amer = result.rows.find(row => String((row.row as Record<string, unknown>).region) === "AMER")!
    const amerColumn = result.columns.find(column => column.columnPath.some(segment => segment.value === "2024"))!
    const emeaColumn = result.columns.find(column => column.columnPath.some(segment => segment.value === "2025"))!

    expect(runtime.readCell({
      rowKey: String(amer.rowId),
      columnKey: amerColumn.id,
      valueField: amerColumn.valueField,
    })).toEqual({ kind: "value", value: 10 })
    expect(runtime.readCell({
      rowKey: String(amer.rowId),
      columnKey: emeaColumn.id,
      valueField: emeaColumn.valueField,
    })).toEqual({ kind: "missing" })
    expect(Object.keys(amer.row as Record<string, unknown>)).toHaveLength(4)
  })

  it("materializes bounded dense compatibility rows from sparse output", () => {
    const runtime = createPivotRuntime<PivotRow>({ sparseOutput: true })
    const projected = runtime.projectRows({
      inputRows: [
        createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
        createLeafRow({ id: "r2", region: "EMEA", year: 2025, revenue: 20 }, 1),
      ],
      pivotModel: { rows: ["region"], columns: ["year"], values: [{ field: "revenue", agg: "sum" }] },
      normalizeFieldValue: value => String(value ?? ""),
    })
    const dense = runtime.materializeRows({ mode: "dense", maxCells: 10 })
    expect(dense.diagnostics).toBeUndefined()
    expect(dense.rows).toHaveLength(projected.rows.length)
    for (const row of dense.rows) {
      for (const column of dense.columns) {
        expect(Object.hasOwn(row.data as Record<string, unknown>, column.id)).toBe(true)
      }
    }
    expect(runtime.materializeRows({ mode: "dense", maxCells: 1 })).toMatchObject({
      rows: [],
      columns: [],
      diagnostics: { kind: "output-limit-exceeded", estimatedCells: 4, maxOutputCells: 1 },
    })
  })

  it("applies value-only patch without relying on cached binding by rowId", () => {
    const runtime = createPivotRuntime<PivotRow>()
    const sourceRows = [
      createLeafRow({ id: "r1", region: "AMER", year: 2024, revenue: 10 }, 0),
      createLeafRow({ id: "r2", region: "EMEA", year: 2024, revenue: 20 }, 1),
    ]
    const pivotModel: DataGridPivotSpec = {
      rows: ["region"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    }

    const projected = runtime.projectRows({
      inputRows: sourceRows,
      pivotModel,
      normalizeFieldValue: value => String(value ?? ""),
    })
    expect(projected.rows.length).toBeGreaterThanOrEqual(2)

    const yearColumnId = projected.columns[0]?.id
    expect(typeof yearColumnId).toBe("string")

    const patched = runtime.applyValueOnlyPatch({
      projectedRows: projected.rows,
      pivotModel,
      changedRows: [
        {
          previousRow: sourceRows[0]!,
          nextRow: createLeafRow({ id: "external-r1", region: "AMER", year: 2024, revenue: 100 }, 0),
        },
      ],
    })

    expect(patched).not.toBeNull()
    const amer = patched!.rows.find(row => String((row.row as unknown as Record<string, unknown>).region ?? "") === "AMER")
    const emea = patched!.rows.find(row => String((row.row as unknown as Record<string, unknown>).region ?? "") === "EMEA")
    expect(amer).toBeDefined()
    expect(emea).toBeDefined()
    const amerRow = amer!.row as unknown as Record<string, unknown>
    const emeaRow = emea!.row as unknown as Record<string, unknown>
    expect(amerRow[String(yearColumnId)]).toBe(100)
    expect(emeaRow[String(yearColumnId)]).toBe(20)
  })

  it("applies patch when raw axis values change but normalized pivot buckets stay stable", () => {
    const runtime = createPivotRuntime<PivotRow>()
    const sourceRows = [
      createLeafRow({ id: "r1", region: "1", year: 2024, revenue: 10 }, 0),
      createLeafRow({ id: "r2", region: "2", year: 2024, revenue: 20 }, 1),
    ]
    const pivotModel: DataGridPivotSpec = {
      rows: ["region"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    }

    const projected = runtime.projectRows({
      inputRows: sourceRows,
      pivotModel,
      normalizeFieldValue: value => String(value ?? ""),
    })
    const yearColumnId = projected.columns[0]?.id
    expect(typeof yearColumnId).toBe("string")

    const patched = runtime.applyValueOnlyPatch({
      projectedRows: projected.rows,
      pivotModel,
      changedRows: [
        {
          previousRow: sourceRows[0]!,
          nextRow: createLeafRow({ id: "r1", region: 1 as unknown as string, year: 2024, revenue: 100 }, 0),
        },
      ],
    })

    expect(patched).not.toBeNull()
    const rowOne = patched!.rows.find(row => String((row.row as unknown as Record<string, unknown>).region ?? "") === "1")
    const rowTwo = patched!.rows.find(row => String((row.row as unknown as Record<string, unknown>).region ?? "") === "2")
    expect((rowOne!.row as unknown as Record<string, unknown>)[String(yearColumnId)]).toBe(100)
    expect((rowTwo!.row as unknown as Record<string, unknown>)[String(yearColumnId)]).toBe(20)
  })
})
