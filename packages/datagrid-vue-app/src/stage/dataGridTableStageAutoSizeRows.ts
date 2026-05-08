import type {
  DataGridRowModel,
  DataGridRowNode,
} from "@affino/datagrid-vue"

export type DataGridTableStageAutoSizeRowModel<TRow> = Pick<
  DataGridRowModel<TRow>,
  "getSnapshot" | "getRow" | "getRowCount" | "getRowsInRange"
>

export interface ResolveDataGridTableStageAutoSizeRowsInput<TRow> {
  rowModel: Partial<DataGridTableStageAutoSizeRowModel<TRow>> | null | undefined
  fallbackRows: readonly TRow[]
  sampleLimit: number
}

export function resolveDataGridTableStageAutoSizeRows<TRow>(
  input: ResolveDataGridTableStageAutoSizeRowsInput<TRow>,
): readonly TRow[] {
  const rowModel = input.rowModel
  if (!rowModel || typeof rowModel.getRow !== "function" || typeof rowModel.getRowCount !== "function") {
    return input.fallbackRows
  }

  const sampleLimit = Number.isFinite(input.sampleLimit)
    ? Math.max(0, Math.trunc(input.sampleLimit))
    : 0
  if (sampleLimit <= 0) {
    return input.fallbackRows
  }

  const rows: TRow[] = []
  const seenRowIds = new Set<string | number>()
  const appendRow = (rowNode: DataGridRowNode<TRow> | undefined | null): void => {
    if (!rowNode) {
      return
    }
    if (typeof rowNode.rowId === "string" || typeof rowNode.rowId === "number") {
      if (seenRowIds.has(rowNode.rowId)) {
        return
      }
      seenRowIds.add(rowNode.rowId)
    }
    rows.push(rowNode.data)
  }

  if (typeof rowModel.getRowsInRange === "function") {
    const viewportRange = rowModel.getSnapshot?.().viewportRange
    if (viewportRange) {
      for (const rowNode of rowModel.getRowsInRange(viewportRange)) {
        appendRow(rowNode)
        if (rows.length >= sampleLimit) {
          break
        }
      }
    }
  }

  const rawRowCount = rowModel.getRowCount()
  const rowCount = Number.isFinite(rawRowCount) ? Math.max(0, Math.trunc(rawRowCount)) : 0
  const remainingLimit = Math.max(0, sampleLimit - rows.length)
  if (remainingLimit > 0 && rowCount > 0) {
    const step = Math.max(1, Math.floor(rowCount / remainingLimit))
    for (let rowIndex = 0; rowIndex < rowCount && rows.length < sampleLimit; rowIndex += step) {
      appendRow(rowModel.getRow(rowIndex))
    }
  }

  return rows.length > 0 ? rows : input.fallbackRows
}
