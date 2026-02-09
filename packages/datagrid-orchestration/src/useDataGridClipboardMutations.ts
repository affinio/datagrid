import type { DataGridClipboardRange } from "./useDataGridClipboardBridge"
import type { DataGridWritableRef } from "./dataGridWritableRef"

export interface DataGridClipboardCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridClipboardMutationResult<TRange extends DataGridClipboardRange = DataGridClipboardRange> {
  applied: number
  blocked: number
  range: TRange
}

export interface UseDataGridClipboardMutationsOptions<
  TRow,
  TColumnKey extends string,
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
  TCoord extends DataGridClipboardCoord = DataGridClipboardCoord,
  TSnapshot = unknown,
> {
  sourceRows: DataGridWritableRef<readonly TRow[]>
  setSourceRows: (rows: readonly TRow[]) => void
  cloneRow: (row: TRow) => TRow
  resolveRowId: (row: TRow) => string

  resolveCopyRange: () => TRange | null
  resolveCurrentCellCoord: () => TCoord | null
  normalizeCellCoord: (coord: TCoord) => TCoord | null
  normalizeSelectionRange: (range: TRange) => TRange | null

  resolveRowAtViewIndex: (rowIndex: number) => TRow | undefined
  resolveColumnKeyAtIndex: (columnIndex: number) => TColumnKey | null
  isEditableColumn: (columnKey: TColumnKey) => boolean
  canApplyPastedValue: (columnKey: TColumnKey, value: string) => boolean
  applyEditedValue: (row: TRow, columnKey: TColumnKey, value: string) => void
  clearValueForCut: (row: TRow, columnKey: TColumnKey) => boolean
  finalizeMutableRows?: (rowsById: Map<string, TRow>) => void

  applySelectionRange: (range: TRange) => void
  closeContextMenu: () => void
  setLastAction: (message: string) => void

  readClipboardPayload: () => Promise<string>
  parseClipboardMatrix: (payload: string) => string[][]
  copySelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>

  captureBeforeSnapshot?: () => TSnapshot
  recordIntentTransaction?: (
    descriptor: { intent: "paste" | "clear" | "cut"; label: string; affectedRange: TRange },
    beforeSnapshot: TSnapshot,
  ) => Promise<void>
}

export interface UseDataGridClipboardMutationsResult<
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
> {
  pasteSelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>
  clearCurrentSelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>
  cutSelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>
}

interface MutableRowBundle<TRow> {
  sourceById: Map<string, TRow>
  mutableById: Map<string, TRow>
  getMutableRow: (rowId: string) => TRow | null
}

function createMutableRows<TRow>(
  rows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
  cloneRow: (row: TRow) => TRow,
): MutableRowBundle<TRow> {
  const sourceById = new Map<string, TRow>(rows.map(row => [resolveRowId(row), row]))
  const mutableById = new Map<string, TRow>()

  const getMutableRow = (rowId: string): TRow | null => {
    const existing = mutableById.get(rowId)
    if (existing) {
      return existing
    }
    const source = sourceById.get(rowId)
    if (!source) {
      return null
    }
    const clone = cloneRow(source)
    mutableById.set(rowId, clone)
    return clone
  }

  return {
    sourceById,
    mutableById,
    getMutableRow,
  }
}

function commitMutableRows<TRow>(
  rows: readonly TRow[],
  resolveRowId: (row: TRow) => string,
  mutableById: Map<string, TRow>,
): readonly TRow[] {
  if (mutableById.size === 0) {
    return rows
  }
  return rows.map(row => mutableById.get(resolveRowId(row)) ?? row)
}

export function useDataGridClipboardMutations<
  TRow,
  TColumnKey extends string,
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
  TCoord extends DataGridClipboardCoord = DataGridClipboardCoord,
  TSnapshot = unknown,
>(
  options: UseDataGridClipboardMutationsOptions<TRow, TColumnKey, TRange, TCoord, TSnapshot>,
): UseDataGridClipboardMutationsResult<TRange> {
  function resolvePasteStartCoord(): TCoord | null {
    const selected = options.resolveCopyRange()
    if (selected) {
      return options.normalizeCellCoord({
        rowIndex: selected.startRow,
        columnIndex: selected.startColumn,
      } as TCoord)
    }
    const current = options.resolveCurrentCellCoord()
    if (!current) {
      return null
    }
    return options.normalizeCellCoord(current)
  }

  function resolvePasteTargets(matrix: string[][], start: TCoord): TRange | null {
    const rowCount = Math.max(1, matrix.length)
    const columnCount = Math.max(1, matrix[0]?.length ?? 1)
    const selected = options.resolveCopyRange()
    if (
      selected &&
      rowCount === 1 &&
      columnCount === 1 &&
      (selected.endRow !== selected.startRow || selected.endColumn !== selected.startColumn)
    ) {
      return selected
    }
    return options.normalizeSelectionRange({
      startRow: start.rowIndex,
      endRow: start.rowIndex + rowCount - 1,
      startColumn: start.columnIndex,
      endColumn: start.columnIndex + columnCount - 1,
    } as TRange)
  }

  async function maybeRecordTransaction(
    descriptor: { intent: "paste" | "clear" | "cut"; label: string; affectedRange: TRange },
    beforeSnapshot: TSnapshot | null,
  ) {
    if (!options.recordIntentTransaction || beforeSnapshot === null) {
      return
    }
    await options.recordIntentTransaction(descriptor, beforeSnapshot)
  }

  async function pasteSelection(trigger: "keyboard" | "context-menu"): Promise<boolean> {
    const start = resolvePasteStartCoord()
    if (!start) {
      options.closeContextMenu()
      options.setLastAction("Paste skipped: no active target")
      return false
    }
    const payload = await options.readClipboardPayload()
    if (!payload.trim()) {
      options.closeContextMenu()
      options.setLastAction("Paste skipped: clipboard empty")
      return false
    }
    const matrix = options.parseClipboardMatrix(payload)
    const targetRange = resolvePasteTargets(matrix, start)
    if (!targetRange) {
      options.closeContextMenu()
      options.setLastAction("Paste skipped: target out of range")
      return false
    }

    const beforeSnapshot = options.captureBeforeSnapshot ? options.captureBeforeSnapshot() : null
    const bundle = createMutableRows(options.sourceRows.value, options.resolveRowId, options.cloneRow)
    const { mutableById, getMutableRow } = bundle

    let applied = 0
    let blocked = 0
    const matrixHeight = matrix.length
    const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)

    for (let rowOffset = 0; rowOffset <= targetRange.endRow - targetRange.startRow; rowOffset += 1) {
      const targetRowIndex = targetRange.startRow + rowOffset
      const targetRow = options.resolveRowAtViewIndex(targetRowIndex)
      if (!targetRow) {
        blocked += matrixWidth
        continue
      }
      for (let columnOffset = 0; columnOffset <= targetRange.endColumn - targetRange.startColumn; columnOffset += 1) {
        const targetColumnIndex = targetRange.startColumn + columnOffset
        const targetColumnKey = options.resolveColumnKeyAtIndex(targetColumnIndex)
        if (!targetColumnKey || !options.isEditableColumn(targetColumnKey)) {
          blocked += 1
          continue
        }
        const sourceValue = matrix[rowOffset % matrixHeight]?.[columnOffset % matrixWidth] ?? ""
        if (!options.canApplyPastedValue(targetColumnKey, sourceValue)) {
          blocked += 1
          continue
        }
        const mutable = getMutableRow(options.resolveRowId(targetRow))
        if (!mutable) {
          blocked += 1
          continue
        }
        options.applyEditedValue(mutable, targetColumnKey, sourceValue)
        applied += 1
      }
    }

    if (applied === 0) {
      options.closeContextMenu()
      options.setLastAction(`Paste blocked (${blocked} cells)`)
      return false
    }

    options.finalizeMutableRows?.(mutableById)
    options.setSourceRows(commitMutableRows(options.sourceRows.value, options.resolveRowId, mutableById))
    options.applySelectionRange(targetRange)

    await maybeRecordTransaction(
      {
        intent: "paste",
        label: blocked > 0
          ? `Paste ${applied} cells (blocked ${blocked})`
          : `Paste ${applied} cells`,
        affectedRange: targetRange,
      },
      beforeSnapshot,
    )
    options.closeContextMenu()
    options.setLastAction(
      blocked > 0
        ? `Pasted ${applied} cells (${trigger}), blocked ${blocked}`
        : `Pasted ${applied} cells (${trigger})`,
    )
    return true
  }

  function clearSelectionValues(range: TRange): DataGridClipboardMutationResult<TRange> {
    const bundle = createMutableRows(options.sourceRows.value, options.resolveRowId, options.cloneRow)
    const { mutableById, getMutableRow } = bundle

    let applied = 0
    let blocked = 0
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const targetRow = options.resolveRowAtViewIndex(rowIndex)
      if (!targetRow) {
        blocked += range.endColumn - range.startColumn + 1
        continue
      }
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const targetColumnKey = options.resolveColumnKeyAtIndex(columnIndex)
        if (!targetColumnKey || !options.isEditableColumn(targetColumnKey)) {
          blocked += 1
          continue
        }
        const mutable = getMutableRow(options.resolveRowId(targetRow))
        if (!mutable) {
          blocked += 1
          continue
        }
        const didClear = options.clearValueForCut(mutable, targetColumnKey)
        if (!didClear) {
          blocked += 1
          continue
        }
        applied += 1
      }
    }

    if (applied > 0) {
      options.finalizeMutableRows?.(mutableById)
      options.setSourceRows(commitMutableRows(options.sourceRows.value, options.resolveRowId, mutableById))
      options.applySelectionRange(range)
    }

    return { applied, blocked, range }
  }

  async function clearCurrentSelection(trigger: "keyboard" | "context-menu"): Promise<boolean> {
    const range = options.resolveCopyRange()
    if (!range) {
      options.closeContextMenu()
      options.setLastAction("Clear skipped: no active selection")
      return false
    }
    const beforeSnapshot = options.captureBeforeSnapshot ? options.captureBeforeSnapshot() : null
    const result = clearSelectionValues(range)
    options.closeContextMenu()
    if (result.applied === 0) {
      options.setLastAction(`Clear blocked (${result.blocked} cells)`)
      return false
    }
    await maybeRecordTransaction(
      {
        intent: "clear",
        label: result.blocked > 0
          ? `Clear ${result.applied} cells (blocked ${result.blocked})`
          : `Clear ${result.applied} cells`,
        affectedRange: range,
      },
      beforeSnapshot,
    )
    options.setLastAction(
      result.blocked > 0
        ? `Cleared ${result.applied} cells (${trigger}), blocked ${result.blocked}`
        : `Cleared ${result.applied} cells (${trigger})`,
    )
    return true
  }

  async function cutSelection(trigger: "keyboard" | "context-menu"): Promise<boolean> {
    const range = options.resolveCopyRange()
    if (!range) {
      options.closeContextMenu()
      options.setLastAction("Cut skipped: no active selection")
      return false
    }
    const copied = await options.copySelection(trigger)
    if (!copied) {
      return false
    }
    const beforeSnapshot = options.captureBeforeSnapshot ? options.captureBeforeSnapshot() : null
    const result = clearSelectionValues(range)
    options.closeContextMenu()
    if (result.applied === 0) {
      options.setLastAction(`Cut blocked (${result.blocked} cells)`)
      return false
    }
    await maybeRecordTransaction(
      {
        intent: "cut",
        label: result.blocked > 0
          ? `Cut ${result.applied} cells (blocked ${result.blocked})`
          : `Cut ${result.applied} cells`,
        affectedRange: range,
      },
      beforeSnapshot,
    )
    options.setLastAction(
      result.blocked > 0
        ? `Cut ${result.applied} cells (${trigger}), blocked ${result.blocked}`
        : `Cut ${result.applied} cells (${trigger})`,
    )
    return true
  }

  return {
    pasteSelection,
    clearCurrentSelection,
    cutSelection,
  }
}
