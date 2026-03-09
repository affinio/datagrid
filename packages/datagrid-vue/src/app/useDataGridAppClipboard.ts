import { ref, type Ref } from "vue"
import type { DataGridClientRowPatch, DataGridColumnSnapshot, DataGridRowNode } from "@affino/datagrid-core"
import type { DataGridCopyRange } from "../advanced"
import { useDataGridClipboardBridge, useDataGridCopyRangeHelpers } from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./useDataGridAppControls"

export type DataGridAppPendingClipboardOperation = "none" | "copy" | "cut"
export type DataGridAppPendingClipboardEdge = "top" | "right" | "bottom" | "left"

export interface UseDataGridAppClipboardOptions<TRow, TSnapshot> {
  mode: Ref<DataGridAppMode>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  resolveSelectionRange: () => DataGridCopyRange | null
  resolveCurrentCellCoord: () => { rowIndex: number; columnIndex: number } | null
  applySelectionRange: (range: DataGridCopyRange) => void
  clearCellSelection: () => void
  captureRowsSnapshot: () => TSnapshot
  recordEditTransaction: (beforeSnapshot: TSnapshot) => void
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => string
  syncViewport: () => void
}

export interface UseDataGridAppClipboardResult<TRow> {
  pendingClipboardOperation: Ref<DataGridAppPendingClipboardOperation>
  pendingClipboardRange: Ref<DataGridCopyRange | null>
  normalizeClipboardRange: (range: DataGridCopyRange) => DataGridCopyRange | null
  applyClipboardEdits: (range: DataGridCopyRange, matrix: string[][]) => number
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  clearPendingClipboardOperation: (clearSelection: boolean, clearBufferedClipboardPayload?: boolean) => boolean
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  isCellInPendingClipboardRange: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdge: (
    rowOffset: number,
    columnIndex: number,
    edge: DataGridAppPendingClipboardEdge,
  ) => boolean
}

export function useDataGridAppClipboard<TRow, TSnapshot>(
  options: UseDataGridAppClipboardOptions<TRow, TSnapshot>,
): UseDataGridAppClipboardResult<TRow> {
  const copiedSelectionRange = ref<DataGridCopyRange | null>(null)
  const lastCopiedPayload = ref("")
  const pendingClipboardOperation = ref<DataGridAppPendingClipboardOperation>("none")
  const pendingClipboardRange = ref<DataGridCopyRange | null>(null)

  const normalizeClipboardRange = (range: DataGridCopyRange): DataGridCopyRange | null => {
    const rowCount = options.totalRows.value
    const columnCount = options.visibleColumns.value.length
    if (rowCount <= 0 || columnCount <= 0) {
      return null
    }
    const startRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.min(range.startRow, range.endRow))))
    const endRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.max(range.startRow, range.endRow))))
    const startColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.min(range.startColumn, range.endColumn))))
    const endColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.max(range.startColumn, range.endColumn))))
    if (startRow > endRow || startColumn > endColumn) {
      return null
    }
    return {
      startRow,
      endRow,
      startColumn,
      endColumn,
    }
  }

  const copyRangeHelpers = useDataGridCopyRangeHelpers({
    resolveSelectionRange: options.resolveSelectionRange,
    resolveCurrentCellCoord: options.resolveCurrentCellCoord,
  })

  const clipboardBridge = useDataGridClipboardBridge<DataGridRowNode<TRow>, DataGridCopyRange>({
    copiedSelectionRange,
    lastCopiedPayload,
    resolveCopyRange: copyRangeHelpers.resolveCopyRange,
    getRowAtIndex: rowIndex => options.runtime.api.rows.get(rowIndex),
    getColumnKeyAtIndex: columnIndex => options.visibleColumns.value[columnIndex]?.key ?? null,
    getCellValue: (row, columnKey) => options.readCell(row, columnKey),
    setLastAction: () => undefined,
    closeContextMenu: () => undefined,
    writeClipboardText: async payload => {
      lastCopiedPayload.value = payload
    },
    readClipboardText: async () => lastCopiedPayload.value,
  })

  const applyClipboardEdits = (range: DataGridCopyRange, matrix: string[][]): number => {
    const normalized = normalizeClipboardRange(range)
    if (!normalized) {
      return 0
    }
    const matrixHeight = Math.max(1, matrix.length)
    const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
    const editsByRowId = new Map<string | number, Record<string, string>>()

    for (let rowIndex = normalized.startRow; rowIndex <= normalized.endRow; rowIndex += 1) {
      const row = options.runtime.api.rows.get(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        continue
      }
      for (let columnIndex = normalized.startColumn; columnIndex <= normalized.endColumn; columnIndex += 1) {
        const columnKey = options.visibleColumns.value[columnIndex]?.key
        if (!columnKey) {
          continue
        }
        const rowOffset = rowIndex - normalized.startRow
        const columnOffset = columnIndex - normalized.startColumn
        const value = matrix[rowOffset % matrixHeight]?.[columnOffset % matrixWidth] ?? ""
        const current = editsByRowId.get(row.rowId) ?? {}
        current[columnKey] = value
        editsByRowId.set(row.rowId, current)
      }
    }

    if (editsByRowId.size === 0) {
      return 0
    }

    const beforeSnapshot = options.captureRowsSnapshot()
    const updates: DataGridClientRowPatch<TRow>[] = Array.from(editsByRowId.entries(), ([rowId, data]) => ({
      rowId,
      data: data as Partial<TRow>,
    }))
    options.runtime.api.rows.applyEdits(updates)
    options.applySelectionRange(normalized)
    options.recordEditTransaction(beforeSnapshot)
    return editsByRowId.size
  }

  const rangesEqual = (left: DataGridCopyRange | null, right: DataGridCopyRange | null): boolean => {
    if (!left || !right) {
      return left === right
    }
    return (
      left.startRow === right.startRow
      && left.endRow === right.endRow
      && left.startColumn === right.startColumn
      && left.endColumn === right.endColumn
    )
  }

  const buildFillMatrixFromRange = (range: DataGridCopyRange): string[][] => {
    const matrix: string[][] = []
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = options.runtime.api.rows.get(rowIndex)
      if (!row || row.kind === "group") {
        matrix.push([])
        continue
      }
      const rowValues: string[] = []
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const columnKey = options.visibleColumns.value[columnIndex]?.key
        rowValues.push(columnKey ? options.readCell(row, columnKey) : "")
      }
      matrix.push(rowValues)
    }
    return matrix
  }

  const clearPendingClipboardOperation = (
    clearSelection: boolean,
    clearBufferedClipboardPayload = false,
  ): boolean => {
    if (pendingClipboardOperation.value === "none" && !pendingClipboardRange.value) {
      return false
    }
    pendingClipboardOperation.value = "none"
    pendingClipboardRange.value = null
    if (clearBufferedClipboardPayload) {
      copiedSelectionRange.value = null
      lastCopiedPayload.value = ""
    }
    clipboardBridge.clearCopiedSelectionFlash()
    if (clearSelection) {
      options.clearCellSelection()
    }
    return true
  }

  const stageClipboardOperation = async (
    operation: Exclude<DataGridAppPendingClipboardOperation, "none">,
    trigger: "keyboard" | "context-menu",
  ): Promise<boolean> => {
    if (options.mode.value !== "base") {
      return false
    }
    const copied = await clipboardBridge.copySelection(trigger)
    if (!copied) {
      return false
    }
    const rawSourceRange = copyRangeHelpers.resolveCopyRange() ?? copiedSelectionRange.value
    const sourceRange = rawSourceRange ? normalizeClipboardRange(rawSourceRange) : null
    if (!sourceRange) {
      return false
    }
    pendingClipboardOperation.value = operation
    pendingClipboardRange.value = sourceRange
    return true
  }

  const copySelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
    return stageClipboardOperation("copy", trigger)
  }

  const pasteSelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
    if (options.mode.value !== "base") {
      return false
    }
    const activeCoord = options.resolveCurrentCellCoord()
    if (!activeCoord) {
      return false
    }
    const payload = await clipboardBridge.readClipboardPayload()
    if (!payload.trim()) {
      return false
    }
    const matrix = clipboardBridge.parseClipboardMatrix(payload)
    const matrixHeight = Math.max(1, matrix.length)
    const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
    const pendingOperation = pendingClipboardOperation.value
    const rawPendingSourceRange = pendingClipboardRange.value ?? copiedSelectionRange.value
    const pendingSourceRange = rawPendingSourceRange ? normalizeClipboardRange(rawPendingSourceRange) : null
    const selected = options.resolveSelectionRange()
    const targetRange = selected && matrixHeight === 1 && matrixWidth === 1 && copyRangeHelpers.isMultiCellSelection(selected)
      ? selected
      : {
          startRow: activeCoord.rowIndex,
          endRow: activeCoord.rowIndex + matrixHeight - 1,
          startColumn: activeCoord.columnIndex,
          endColumn: activeCoord.columnIndex + matrixWidth - 1,
        }
    const normalizedTargetRange = normalizeClipboardRange(targetRange)
    if (!normalizedTargetRange) {
      return false
    }
    if (pendingOperation === "cut" && pendingSourceRange && rangesEqual(pendingSourceRange, normalizedTargetRange)) {
      clearPendingClipboardOperation(true)
      void trigger
      return true
    }
    if (pendingOperation === "cut" && pendingSourceRange) {
      applyClipboardEdits(pendingSourceRange, [[""]])
    }
    const appliedRows = applyClipboardEdits(targetRange, matrix)
    if (appliedRows <= 0) {
      return false
    }
    if (pendingOperation !== "none") {
      clearPendingClipboardOperation(true)
    }
    options.syncViewport()
    void trigger
    return true
  }

  const cutSelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
    return stageClipboardOperation("cut", trigger)
  }

  const isCellInPendingClipboardRange = (rowOffset: number, columnIndex: number): boolean => {
    if (options.mode.value !== "base" || pendingClipboardOperation.value === "none") {
      return false
    }
    const range = pendingClipboardRange.value
    if (!range) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    return (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    )
  }

  const isCellOnPendingClipboardEdge = (
    rowOffset: number,
    columnIndex: number,
    edge: DataGridAppPendingClipboardEdge,
  ): boolean => {
    if (!isCellInPendingClipboardRange(rowOffset, columnIndex)) {
      return false
    }
    const range = pendingClipboardRange.value
    if (!range) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (edge === "top") {
      return rowIndex === range.startRow
    }
    if (edge === "right") {
      return columnIndex === range.endColumn
    }
    if (edge === "bottom") {
      return rowIndex === range.endRow
    }
    return columnIndex === range.startColumn
  }

  return {
    pendingClipboardOperation,
    pendingClipboardRange,
    normalizeClipboardRange,
    applyClipboardEdits,
    rangesEqual,
    buildFillMatrixFromRange,
    clearPendingClipboardOperation,
    copySelectedCells,
    pasteSelectedCells,
    cutSelectedCells,
    isCellInPendingClipboardRange,
    isCellOnPendingClipboardEdge,
  }
}
