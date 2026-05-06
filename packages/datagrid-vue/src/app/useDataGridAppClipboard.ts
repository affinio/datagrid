import { ref, type Ref } from "vue"
import type { DataGridClientRowPatch, DataGridColumnSnapshot, DataGridRowNode } from "@affino/datagrid-core"
import { getDataGridSelectionMissingRowIntervals } from "@affino/datagrid-core"
import type { DataGridCopyRange } from "../advanced"
import { useDataGridClipboardBridge, useDataGridCopyRangeHelpers } from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./useDataGridAppControls"

export type DataGridAppPendingClipboardOperation = "none" | "copy" | "cut"
export type DataGridAppPendingClipboardEdge = "top" | "right" | "bottom" | "left"
export type DataGridAppPasteMode = "default" | "values"

export interface DataGridAppPasteOptions {
  mode?: DataGridAppPasteMode
}

export interface UseDataGridAppClipboardOptions<TRow, TSnapshot> {
  mode: Ref<DataGridAppMode>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex">
  ensureEditableRowAtIndex?: (rowIndex: number) => DataGridRowNode<TRow> | null
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  resolveSelectionRange: () => DataGridCopyRange | null
  resolveSelectionRanges?: () => readonly DataGridCopyRange[]
  resolveCurrentCellCoord: () => { rowIndex: number; columnIndex: number } | null
  applySelectionRange: (range: DataGridCopyRange) => void
  clearCellSelection: () => void
  setLastAction?: (message: string) => void
  captureRowsSnapshot: () => TSnapshot
  captureRowsSnapshotForRowIds?: (rowIds: readonly (string | number)[]) => TSnapshot
  recordEditTransaction: (
    beforeSnapshot: TSnapshot,
    afterSnapshotOverride?: TSnapshot,
    label?: string,
  ) => void
  readCell: (row: DataGridRowNode<TRow>, columnKey: string) => string
  readClipboardCell?: (row: DataGridRowNode<TRow>, columnKey: string) => string
  isCellEditable: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    columnKey: string,
    columnIndex: number,
  ) => boolean
  syncViewport: () => void
  applyClipboardEdits?: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean; recordHistoryLabel?: string },
  ) => number | Promise<number>
  buildFillMatrixFromRange?: (range: DataGridCopyRange) => string[][]
  buildPasteSpecialMatrixFromRange?: (
    range: DataGridCopyRange,
    mode: Exclude<DataGridAppPasteMode, "default">,
  ) => string[][]
}

export interface UseDataGridAppClipboardResult {
  pendingClipboardOperation: Ref<DataGridAppPendingClipboardOperation>
  pendingClipboardRange: Ref<DataGridCopyRange | null>
  pendingClipboardRanges: Ref<readonly DataGridCopyRange[]>
  normalizeClipboardRange: (range: DataGridCopyRange) => DataGridCopyRange | null
  applyClipboardEdits: (
    range: DataGridCopyRange,
    matrix: string[][],
    options?: { recordHistory?: boolean; recordHistoryLabel?: string },
  ) => number | Promise<number>
  rangesEqual: (left: DataGridCopyRange | null, right: DataGridCopyRange | null) => boolean
  buildFillMatrixFromRange: (range: DataGridCopyRange) => string[][]
  clearPendingClipboardOperation: (clearSelection: boolean, clearBufferedClipboardPayload?: boolean) => boolean
  copySelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelectedCells: (
    trigger?: "keyboard" | "context-menu",
    options?: DataGridAppPasteOptions,
  ) => Promise<boolean>
  cutSelectedCells: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  isCellInPendingClipboardRange: (rowOffset: number, columnIndex: number) => boolean
  isCellOnPendingClipboardEdge: (
    rowOffset: number,
    columnIndex: number,
    edge: DataGridAppPendingClipboardEdge,
  ) => boolean
}

export function isDataGridRowMissingOrPlaceholder<TRow>(
  row: DataGridRowNode<TRow> | null | undefined,
): boolean {
  if (!row) {
    return true
  }
  return (row as { __placeholder?: boolean }).__placeholder === true
}

export function resolveMissingRowIndexInRange<TRow>(
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<TRow> | null | undefined,
  range: DataGridCopyRange,
): number | null {
  return getDataGridSelectionMissingRowIntervals(range, rowIndex => (
    !isDataGridRowMissingOrPlaceholder(getBodyRowAtIndex(rowIndex))
  ))[0]?.startRow ?? null
}

export function useDataGridAppClipboard<TRow, TSnapshot>(
  options: UseDataGridAppClipboardOptions<TRow, TSnapshot>,
): UseDataGridAppClipboardResult {
  const getBodyRowAtIndex = (rowIndex: number): DataGridRowNode<TRow> | undefined => {
    const runtime = options.runtime as typeof options.runtime & {
      getBodyRowAtIndex?: (index: number) => DataGridRowNode<TRow> | null
    }
    return runtime.getBodyRowAtIndex?.(rowIndex) ?? options.runtime.api.rows.get(rowIndex) ?? undefined
  }

  const copiedSelectionRange = ref<DataGridCopyRange | null>(null)
  const lastCopiedPayload = ref("")
  const pendingClipboardOperation = ref<DataGridAppPendingClipboardOperation>("none")
  const pendingClipboardRange = ref<DataGridCopyRange | null>(null)
  const pendingClipboardRanges = ref<readonly DataGridCopyRange[]>([])

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
    getRowAtIndex: rowIndex => getBodyRowAtIndex(rowIndex),
    getColumnKeyAtIndex: columnIndex => options.visibleColumns.value[columnIndex]?.key ?? null,
    getCellValue: (row, columnKey) => (
      options.readClipboardCell
        ? options.readClipboardCell(row, columnKey)
        : options.readCell(row, columnKey)
    ),
    setLastAction: message => {
      options.setLastAction?.(message)
    },
    closeContextMenu: () => undefined,
  })

  const collectClipboardEdits = (
    range: DataGridCopyRange,
    matrix: string[][],
  ): {
    normalizedRange: DataGridCopyRange | null
    updates: DataGridClientRowPatch<TRow>[]
  } => {
    const normalized = normalizeClipboardRange(range)
    if (!normalized) {
      return { normalizedRange: null, updates: [] }
    }
    const matrixHeight = Math.max(1, matrix.length)
    const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
    const editsByRowId = new Map<string | number, Record<string, string>>()
    for (let rowIndex = normalized.startRow; rowIndex <= normalized.endRow; rowIndex += 1) {
      const row = options.ensureEditableRowAtIndex?.(rowIndex) ?? getBodyRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        continue
      }
      for (let columnIndex = normalized.startColumn; columnIndex <= normalized.endColumn; columnIndex += 1) {
        const columnKey = options.visibleColumns.value[columnIndex]?.key
        if (!columnKey) {
          continue
        }
        if (!options.isCellEditable(row, rowIndex, columnKey, columnIndex)) {
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
    return {
      normalizedRange: normalized,
      updates: Array.from(editsByRowId.entries(), ([rowId, data]) => ({
        rowId,
        data: data as Partial<TRow>,
      })),
    }
  }

  const customApplyClipboardEdits = options.applyClipboardEdits

  const applyClipboardEdits = customApplyClipboardEdits ?? (async (
    range: DataGridCopyRange,
    matrix: string[][],
    applyOptions: { recordHistory?: boolean; recordHistoryLabel?: string } = {},
  ): Promise<number> => {
    const { normalizedRange: normalized, updates } = collectClipboardEdits(range, matrix)
    if (!normalized) {
      return 0
    }
    if (updates.length === 0) {
      return 0
    }

    const rowIds = Array.from(new Set(updates.map(update => update.rowId)))
    const beforeSnapshot = applyOptions.recordHistory === false
      ? null
      : (options.captureRowsSnapshotForRowIds?.(rowIds) ?? options.captureRowsSnapshot())
    const afterSnapshot = beforeSnapshot != null
      ? buildAfterEditSnapshot(beforeSnapshot, updates)
      : null
    await options.runtime.api.rows.applyEdits(updates)
    options.applySelectionRange(normalized)
    if (beforeSnapshot != null) {
      options.recordEditTransaction(
        beforeSnapshot,
        afterSnapshot ?? undefined,
        applyOptions.recordHistoryLabel,
      )
    }
    return updates.length
  })

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

  const collectAffectedRowIds = (ranges: readonly (DataGridCopyRange | null | undefined)[]): readonly (string | number)[] => {
    const rowIds = new Set<string | number>()
    for (const candidateRange of ranges) {
      const range = candidateRange ? normalizeClipboardRange(candidateRange) : null
      if (!range) {
        continue
      }
      for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
        const rowId = getBodyRowAtIndex(rowIndex)?.rowId
        if (typeof rowId === "string" || typeof rowId === "number") {
          rowIds.add(rowId)
        }
      }
    }
    return Array.from(rowIds)
  }

  const captureBeforeEditSnapshot = (ranges: readonly (DataGridCopyRange | null | undefined)[]): TSnapshot => {
    const rowIds = collectAffectedRowIds(ranges)
    if (rowIds.length > 0 && typeof options.captureRowsSnapshotForRowIds === "function") {
      return options.captureRowsSnapshotForRowIds(rowIds)
    }
    return options.captureRowsSnapshot()
  }

  const buildAfterEditSnapshot = (
    beforeSnapshot: TSnapshot,
    updates: readonly DataGridClientRowPatch<TRow>[],
  ): TSnapshot => {
    if (!beforeSnapshot || typeof beforeSnapshot !== "object") {
      return beforeSnapshot
    }
    const snapshot = beforeSnapshot as { rows?: Array<{ rowId: string | number; row: TRow }> }
    if (!Array.isArray(snapshot.rows)) {
      return beforeSnapshot
    }
    const updatesByRowId = new Map<string | number, Partial<TRow>>()
    for (const update of updates) {
      updatesByRowId.set(update.rowId, update.data)
    }
    return {
      ...(beforeSnapshot as Record<string, unknown>),
      rows: snapshot.rows.map(entry => {
        const patch = updatesByRowId.get(entry.rowId)
        if (!patch) {
          return entry
        }
        return {
          ...entry,
          row: {
            ...(entry.row as Record<string, unknown>),
            ...patch,
          } as TRow,
        }
      }),
    } as TSnapshot
  }

  const normalizeClipboardRanges = (
    ranges: readonly (DataGridCopyRange | null | undefined)[],
  ): DataGridCopyRange[] => {
    const normalizedRanges: DataGridCopyRange[] = []
    const seenRanges = new Set<string>()
    for (const range of ranges) {
      const normalized = range ? normalizeClipboardRange(range) : null
      if (!normalized) {
        continue
      }
      const key = [
        normalized.startRow,
        normalized.endRow,
        normalized.startColumn,
        normalized.endColumn,
      ].join(":")
      if (seenRanges.has(key)) {
        continue
      }
      seenRanges.add(key)
      normalizedRanges.push(normalized)
    }
    return normalizedRanges
  }

  const mergeClipboardUpdates = (
    updates: readonly DataGridClientRowPatch<TRow>[],
  ): DataGridClientRowPatch<TRow>[] => {
    const updatesByRowId = new Map<string | number, Partial<TRow>>()
    for (const update of updates) {
      const current = updatesByRowId.get(update.rowId) ?? {}
      updatesByRowId.set(update.rowId, {
        ...(current as Record<string, unknown>),
        ...(update.data as Record<string, unknown>),
      } as Partial<TRow>)
    }
    return Array.from(updatesByRowId.entries(), ([rowId, data]) => ({ rowId, data }))
  }

  const applyClipboardEditsToRanges = async (
    ranges: readonly DataGridCopyRange[],
    matrix: string[][],
    applyOptions: { recordHistory?: boolean; recordHistoryLabel?: string } = {},
  ): Promise<number> => {
    const normalizedRanges = normalizeClipboardRanges(ranges)
    if (normalizedRanges.length === 0) {
      return 0
    }
    if (normalizedRanges.length === 1 && normalizedRanges[0]) {
      return applyClipboardEdits(normalizedRanges[0], matrix, applyOptions)
    }

    if (customApplyClipboardEdits) {
      const beforeSnapshot = applyOptions.recordHistory === false
        ? null
        : captureBeforeEditSnapshot(normalizedRanges)
      let appliedRows = 0
      for (const range of normalizedRanges) {
        appliedRows += await customApplyClipboardEdits(range, matrix, {
          ...applyOptions,
          recordHistory: false,
        })
      }
      if (appliedRows <= 0) {
        return 0
      }
      if (beforeSnapshot != null) {
        options.recordEditTransaction(
          beforeSnapshot,
          undefined,
          applyOptions.recordHistoryLabel,
        )
      }
      return appliedRows
    }

    const updates = mergeClipboardUpdates(normalizedRanges.flatMap(range => collectClipboardEdits(range, matrix).updates))
    if (updates.length === 0) {
      return 0
    }

    const beforeSnapshot = applyOptions.recordHistory === false
      ? null
      : captureBeforeEditSnapshot(normalizedRanges)
    const afterSnapshot = beforeSnapshot != null
      ? buildAfterEditSnapshot(beforeSnapshot, updates)
      : null
    await options.runtime.api.rows.applyEdits(updates)
    if (beforeSnapshot != null) {
      options.recordEditTransaction(
        beforeSnapshot,
        afterSnapshot ?? undefined,
        applyOptions.recordHistoryLabel,
      )
    }
    return updates.length
  }

  const resolvePasteTargetRanges = (
    activeCoord: { rowIndex: number; columnIndex: number },
    matrixHeight: number,
    matrixWidth: number,
    pendingOperation: DataGridAppPendingClipboardOperation,
  ): DataGridCopyRange[] => {
    const selected = options.resolveSelectionRange()
    if (pendingOperation !== "cut" && matrixHeight === 1 && matrixWidth === 1) {
      const selectionRanges = normalizeClipboardRanges([
        ...(options.resolveSelectionRanges?.() ?? []),
        ...(selected ? [selected] : []),
      ])
      if (selectionRanges.length > 0) {
        return selectionRanges
      }
    }

    const targetRange = selected && matrixHeight === 1 && matrixWidth === 1 && copyRangeHelpers.isMultiCellSelection(selected)
      ? selected
      : {
          startRow: activeCoord.rowIndex,
          endRow: activeCoord.rowIndex + matrixHeight - 1,
          startColumn: activeCoord.columnIndex,
          endColumn: activeCoord.columnIndex + matrixWidth - 1,
        }
    const normalizedTargetRange = normalizeClipboardRange(targetRange)
    return normalizedTargetRange ? [normalizedTargetRange] : []
  }

  const buildFillMatrixFromRange = options.buildFillMatrixFromRange ?? ((range: DataGridCopyRange): string[][] => {
    const matrix: string[][] = []
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
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
  })

  const clearPendingClipboardOperation = (
    clearSelection: boolean,
    clearBufferedClipboardPayload = false,
  ): boolean => {
    if (pendingClipboardOperation.value === "none" && !pendingClipboardRange.value) {
      return false
    }
    pendingClipboardOperation.value = "none"
    pendingClipboardRange.value = null
    pendingClipboardRanges.value = []
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
    const preflightRange = copyRangeHelpers.resolveCopyRange()
    if (preflightRange) {
      const missingRowIndex = resolveMissingRowIndexInRange(getBodyRowAtIndex, preflightRange)
      if (missingRowIndex != null) {
        options.setLastAction?.(
          "Selected range includes unloaded rows. Load rows or use server export.",
        )
        return false
      }
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
    pendingClipboardRanges.value = options.resolveSelectionRanges?.()
      .map(range => normalizeClipboardRange(range))
      .filter((range): range is DataGridCopyRange => range != null)
      ?? [sourceRange]
    if (pendingClipboardRanges.value.length === 0) {
      pendingClipboardRanges.value = [sourceRange]
    }
    return true
  }

  const copySelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
    return stageClipboardOperation("copy", trigger)
  }

  const pasteSelectedCells = async (
    trigger: "keyboard" | "context-menu" = "keyboard",
    pasteOptions: DataGridAppPasteOptions = {},
  ): Promise<boolean> => {
    if (options.mode.value !== "base") {
      return false
    }
    const activeCoord = options.resolveCurrentCellCoord()
    if (!activeCoord) {
      return false
    }
    const pendingOperation = pendingClipboardOperation.value
    const rawPendingSourceRange = pendingClipboardRange.value ?? copiedSelectionRange.value
    const pendingSourceRange = rawPendingSourceRange ? normalizeClipboardRange(rawPendingSourceRange) : null
    const pasteMode = pasteOptions.mode ?? "default"
    let matrix: string[][] = []

    if (pasteMode === "values" && pendingSourceRange) {
      matrix = options.buildPasteSpecialMatrixFromRange?.(pendingSourceRange, "values")
        ?? buildFillMatrixFromRange(pendingSourceRange)
    } else {
      const payload = await clipboardBridge.readClipboardPayload()
      if (!payload.trim()) {
        return false
      }
      matrix = clipboardBridge.parseClipboardMatrix(payload)
    }

    const matrixHeight = Math.max(1, matrix.length)
    const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
    const targetRanges = resolvePasteTargetRanges(activeCoord, matrixHeight, matrixWidth, pendingOperation)
    const normalizedTargetRange = targetRanges[0] ?? null
    if (!normalizedTargetRange) {
      return false
    }
    if (pendingOperation === "cut" && pendingSourceRange && rangesEqual(pendingSourceRange, normalizedTargetRange)) {
      clearPendingClipboardOperation(false)
      void trigger
      return true
    }
    if (pendingOperation === "cut" && pendingSourceRange) {
      const beforeSnapshot = captureBeforeEditSnapshot([pendingSourceRange, normalizedTargetRange])
      const sourceClearUpdates = collectClipboardEdits(pendingSourceRange, [[""]]).updates
      const targetUpdates = collectClipboardEdits(normalizedTargetRange, matrix).updates
      await applyClipboardEdits(pendingSourceRange, [[""]], { recordHistory: false })
      const appliedRows = await applyClipboardEdits(normalizedTargetRange, matrix, { recordHistory: false })
      if (appliedRows <= 0) {
        return false
      }
      const afterSnapshot = buildAfterEditSnapshot(beforeSnapshot, [
        ...sourceClearUpdates,
        ...targetUpdates,
      ])
      options.recordEditTransaction(beforeSnapshot, afterSnapshot)
      clearPendingClipboardOperation(false)
      options.applySelectionRange(normalizedTargetRange)
      options.syncViewport()
      void trigger
      return true
    }
    const appliedRows = await applyClipboardEditsToRanges(targetRanges, matrix, { recordHistory: true })
    if (appliedRows <= 0) {
      return false
    }
    if (pendingOperation !== "none") {
      clearPendingClipboardOperation(false)
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
    if (pendingClipboardRanges.value.length === 0) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    return pendingClipboardRanges.value.some(range => (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    ))
  }

  const isCellOnPendingClipboardEdge = (
    rowOffset: number,
    columnIndex: number,
    edge: DataGridAppPendingClipboardEdge,
  ): boolean => {
    if (!isCellInPendingClipboardRange(rowOffset, columnIndex)) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    return pendingClipboardRanges.value.some(range => {
      if (
        rowIndex < range.startRow
        || rowIndex > range.endRow
        || columnIndex < range.startColumn
        || columnIndex > range.endColumn
      ) {
        return false
      }
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
    })
  }

  return {
    pendingClipboardOperation,
    pendingClipboardRange,
    pendingClipboardRanges,
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
