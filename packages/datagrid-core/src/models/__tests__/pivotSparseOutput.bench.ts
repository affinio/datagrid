import { bench, describe } from "vitest"
import { createPivotRuntime } from "../pivot/pivotRuntime"
import type { DataGridRowNode } from "../rowModel"

interface BenchRow {
  id: number
  region: string
  year: number
  revenue: number
}

const rows: DataGridRowNode<BenchRow>[] = Array.from({ length: 10_000 }, (_, index) => {
  const row: BenchRow = {
    id: index,
    region: "region-" + (index % 100),
    year: index % 100,
    revenue: index + 1,
  }
  return {
    kind: "leaf",
    data: row,
    row,
    rowKey: index,
    rowId: index,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
})

const pivotModel = {
  rows: ["region"],
  columns: ["year"],
  values: [{ field: "revenue", agg: "sum" as const }],
}

describe("pivot sparse output payload", () => {
  bench("dense output row payload", () => {
    createPivotRuntime<BenchRow>().projectRows({
      inputRows: rows,
      pivotModel,
      normalizeFieldValue: value => String(value ?? ""),
    })
  }, { iterations: 3, time: 500 })

  bench("sparse output row payload", () => {
    createPivotRuntime<BenchRow>({ sparseOutput: true }).projectRows({
      inputRows: rows,
      pivotModel,
      normalizeFieldValue: value => String(value ?? ""),
    })
  }, { iterations: 3, time: 500 })
})
