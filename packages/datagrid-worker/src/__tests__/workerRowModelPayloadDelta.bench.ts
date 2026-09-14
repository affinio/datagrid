import { bench, describe } from "vitest"
import { createDataGridWorkerRowModelUpdateMessage } from "../workerOwnedRowModelProtocol"
import type { DataGridRowNode } from "@affino/datagrid-core"

interface BenchRow { id: number; value: number }

const rows: DataGridRowNode<BenchRow>[] = Array.from({ length: 200 }, (_, index) => {
  const row: BenchRow = { id: index, value: index }
  return {
    kind: "leaf", data: row, row, rowKey: index, rowId: index,
    sourceIndex: index, originalIndex: index, displayIndex: index,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
})
const range = { start: 0, end: rows.length - 1 }
const base = {
  snapshot: { rowCount: rows.length, viewportRange: range },
  aggregationModel: null,
  formulaFields: [],
  formulaExecutionPlan: null,
  formulaComputeStageDiagnostics: null,
  visibleRange: range,
} as const
const full = createDataGridWorkerRowModelUpdateMessage(1, { ...base, visibleRows: rows, visibleRowsMode: "full" })
const delta = createDataGridWorkerRowModelUpdateMessage(2, {
  ...base,
  visibleRows: [],
  visibleRowsMode: "delta",
  visibleRowsDelta: [{ index: 17, row: rows[17]! }],
})

function jsonBytes(value: unknown): number {
  return JSON.stringify(value).length
}

describe("worker row model visible window payload", () => {
  bench("serialize full 200-row window", () => jsonBytes(full))
  bench("serialize one-row delta window", () => jsonBytes(delta))
})
