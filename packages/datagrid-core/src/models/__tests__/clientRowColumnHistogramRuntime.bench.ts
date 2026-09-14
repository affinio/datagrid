import { bench, describe } from "vitest"
import { createClientRowColumnHistogramRuntime } from "../projection/clientRowColumnHistogramRuntime"
import type { DataGridRowNode } from "../rowModel"

interface BenchRow { id: number; status: string }

const rows: DataGridRowNode<BenchRow>[] = Array.from({ length: 100_000 }, (_, index) => {
  const row: BenchRow = { id: index, status: `status-${index % 256}` }
  return {
    kind: "leaf", data: row, row, rowKey: index, rowId: index,
    sourceIndex: index, originalIndex: index, displayIndex: index,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
})

function createRuntime(getCacheKey: () => string) {
  return createClientRowColumnHistogramRuntime<BenchRow>({
    ensureActive: () => {},
    getBaseSourceRows: () => rows,
    getFilteredRowsProjection: () => rows,
    readProjectionRowField: (row, key) => row.data[key as keyof BenchRow],
    resolveFilterPredicate: () => () => true,
    getCacheKey,
  })
}

describe("client column histogram repeated menu opens", () => {
  const cached = createRuntime(() => "stable")
  let revision = 0
  const cold = createRuntime(() => String(revision))

  bench("cached repeated query", () => {
    cached.getColumnHistogram("status", { limit: 64 })
  }, { iterations: 20, time: 500 })

  bench("cold high-cardinality query", () => {
    revision += 1
    cold.getColumnHistogram("status", { limit: 64 })
  }, { iterations: 3, time: 500 })
})
