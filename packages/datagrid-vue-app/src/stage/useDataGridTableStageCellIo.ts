import {
  invokeDataGridCellInteraction,
  resolveDataGridCellClickAction,
  toggleDataGridCellValue,
  type DataGridColumnSnapshot,
} from "@affino/datagrid-vue"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import type { DataGridTableRow } from "./dataGridTableStage.types"

export interface UseDataGridTableStageCellIoOptions<TRow extends Record<string, unknown>> {
  runtime: Pick<import("@affino/datagrid-vue").UseDataGridRuntimeResult<TRow>, "api">
  viewportRowStart: import("vue").Ref<number>
  isRowSelectionColumnKey: (columnKey: string) => boolean
  isRowSelectionColumn: (column: DataGridColumnSnapshot) => boolean
  isCellEditableByKey: (row: DataGridTableRow<TRow>, rowIndex: number, columnKey: string, columnIndex: number) => boolean
  readRowSelectionCell: (row: DataGridTableRow<TRow>) => string
  readRowSelectionDisplayCell: (row: DataGridTableRow<TRow>) => string
  readCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
  readDisplayCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
  toggleRowCheckboxSelected: (row: DataGridTableRow<TRow>) => void
  captureHistorySnapshot: () => unknown
  recordHistoryIntentTransaction: (
    descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
    beforeSnapshot: unknown,
  ) => void
  syncViewport: () => void
}

export interface UseDataGridTableStageCellIoResult<TRow extends Record<string, unknown>> {
  readStageCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
  readStageDisplayCell: (row: DataGridTableRow<TRow>, columnKey: string) => string
  handleCellClick: (row: DataGridTableRow<TRow>, rowOffset: number, column: DataGridColumnSnapshot, columnIndex: number) => void
}

export function useDataGridTableStageCellIo<TRow extends Record<string, unknown>>(
  options: UseDataGridTableStageCellIoOptions<TRow>,
): UseDataGridTableStageCellIoResult<TRow> {
  const readStageCell = (row: DataGridTableRow<TRow>, columnKey: string): string => {
    if (options.isRowSelectionColumnKey(columnKey)) {
      return options.readRowSelectionCell(row)
    }
    return options.readCell(row, columnKey)
  }

  const readStageDisplayCell = (row: DataGridTableRow<TRow>, columnKey: string): string => {
    if (options.isRowSelectionColumnKey(columnKey)) {
      return options.readRowSelectionDisplayCell(row)
    }
    return options.readDisplayCell(row, columnKey)
  }

  const handleCellClick = (
    row: DataGridTableRow<TRow>,
    rowOffset: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ): void => {
    if (options.isRowSelectionColumn(column)) {
      options.toggleRowCheckboxSelected(row)
      return
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    const editable = options.isCellEditableByKey(row, rowIndex, column.key, columnIndex)
    const clickAction = resolveDataGridCellClickAction({
      column: column.column,
      row: row.kind !== "group" ? row.data : undefined,
      rowId: row.rowId,
      editable,
    })
    if (clickAction === "invoke") {
      invokeDataGridCellInteraction({
        column: column.column,
        row: row.kind !== "group" ? row.data : undefined,
        rowId: row.rowId,
        editable,
        trigger: "click",
      })
      return
    }
    if (clickAction !== "toggle") {
      return
    }
    if (row.kind === "group" || row.rowId == null) {
      return
    }
    const beforeSnapshot = options.captureHistorySnapshot()
    options.runtime.api.rows.applyEdits([
      {
        rowId: row.rowId,
        data: {
          [column.key]: toggleDataGridCellValue({
            column: column.column,
            row: row.data,
          }),
        } as Partial<TRow>,
      },
    ])
    options.recordHistoryIntentTransaction({
      intent: "edit",
      label: `Toggle ${column.key}`,
      affectedRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startColumn: columnIndex,
        endColumn: columnIndex,
      },
    }, beforeSnapshot)
    options.syncViewport()
  }

  return {
    readStageCell,
    readStageDisplayCell,
    handleCellClick,
  }
}