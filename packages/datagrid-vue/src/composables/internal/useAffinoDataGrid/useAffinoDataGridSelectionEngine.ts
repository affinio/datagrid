import { computed, ref, watch, type Ref } from "vue"
import type { DataGridSelectionSnapshot } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"
import { useDataGridCellNavigation } from "@affino/datagrid-orchestration"

export interface AffinoDataGridCellSelectionCoord {
  rowKey: string
  columnKey: string
  rowIndex: number
  columnIndex: number
  rowId: string | number | null
}

export interface InternalCellRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseAffinoDataGridSelectionEngineOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  rows: Ref<readonly TRow[]>
  resolveRowKey: (row: TRow, index: number) => string
  internalSelectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  emitSelectionChange: (snapshot: DataGridSelectionSnapshot | null) => void
  emitRangeChange?: (range: InternalCellRange | null) => void
  closeContextMenu?: () => void
  setLastAction?: (message: string) => void
  resolveStepRows?: () => number
}

export interface UseAffinoDataGridSelectionEngineResult {
  activeCellSelection: Ref<AffinoDataGridCellSelectionCoord | null>
  anchorCellSelection: Ref<AffinoDataGridCellSelectionCoord | null>
  focusCellSelection: Ref<AffinoDataGridCellSelectionCoord | null>
  cellSelectionRange: Ref<InternalCellRange | null>
  cellSelectionRanges: Ref<readonly InternalCellRange[]>
  isPointerSelectingCells: Ref<boolean>
  isCellSelected: (rowIndex: number, columnIndex: number) => boolean
  setCellSelection: (
    coord: AffinoDataGridCellSelectionCoord,
    extend?: boolean,
    fallbackAnchor?: { rowIndex: number; columnIndex: number } | null,
  ) => void
  setCellByKey: (rowKey: string, columnKey: string, options?: { extend?: boolean }) => boolean
  clearCellSelection: () => void
  stopPointerCellSelection: () => void
  resolveVisibleColumnIndex: (columnKey: string) => number
  resolveVisibleRowIndexByKey: (rowKey: string) => number
  resolveCellCoordByIndex: (rowIndex: number, columnIndex: number) => AffinoDataGridCellSelectionCoord | null
  resolveCellCoordByKey: (rowKey: string, columnKey: string) => AffinoDataGridCellSelectionCoord | null
  applySelectionFromRange: (range: InternalCellRange, activePosition?: "start" | "end") => void
  cellNavigation: ReturnType<typeof useDataGridCellNavigation>
}

export function useAffinoDataGridSelectionEngine<TRow>(
  options: UseAffinoDataGridSelectionEngineOptions<TRow>,
): UseAffinoDataGridSelectionEngineResult {
  const cellSelectionAnchor = ref<AffinoDataGridCellSelectionCoord | null>(null)
  const cellSelectionFocus = ref<AffinoDataGridCellSelectionCoord | null>(null)
  const isPointerSelectingCells = ref(false)

  const resolveVisibleColumnIndex = (columnKey: string): number => (
    options.runtime.columnSnapshot.value.visibleColumns.findIndex(column => column.key === columnKey)
  )

  const resolveVisibleRowIndexByKey = (rowKey: string): number => {
    const rowCount = options.runtime.api.getRowCount()
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowNode = options.runtime.api.getRow<TRow>(rowIndex)
      if (!rowNode) {
        continue
      }
      const candidateRowKey = rowNode.kind === "leaf"
        ? options.resolveRowKey(rowNode.data as TRow, rowNode.sourceIndex)
        : String(rowNode.rowId ?? rowNode.rowKey ?? rowIndex)
      if (candidateRowKey === rowKey) {
        return rowIndex
      }
    }
    return -1
  }

  const resolveCellCoordByIndex = (
    rowIndexRaw: number,
    columnIndexRaw: number,
  ): AffinoDataGridCellSelectionCoord | null => {
    const rowCount = options.runtime.api.getRowCount()
    const columnCount = options.runtime.columnSnapshot.value.visibleColumns.length
    if (rowCount <= 0 || columnCount <= 0) {
      return null
    }
    const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.trunc(rowIndexRaw)))
    const columnIndex = Math.max(0, Math.min(columnCount - 1, Math.trunc(columnIndexRaw)))
    const rowNode = options.runtime.api.getRow<TRow>(rowIndex)
    const column = options.runtime.columnSnapshot.value.visibleColumns[columnIndex]
    if (!rowNode || !column) {
      return null
    }
    const rowKey = rowNode.kind === "leaf"
      ? options.resolveRowKey(rowNode.data as TRow, rowNode.sourceIndex)
      : String(rowNode.rowId ?? rowNode.rowKey ?? rowIndex)
    return {
      rowKey,
      columnKey: column.key,
      rowIndex,
      columnIndex,
      rowId: rowNode.rowId ?? null,
    }
  }

  const resolveCellCoordByKey = (
    rowKey: string,
    columnKey: string,
  ): AffinoDataGridCellSelectionCoord | null => {
    const rowIndex = resolveVisibleRowIndexByKey(rowKey)
    const columnIndex = resolveVisibleColumnIndex(columnKey)
    if (rowIndex < 0 || columnIndex < 0) {
      return null
    }
    return resolveCellCoordByIndex(rowIndex, columnIndex)
  }

  const activeCellSelection = computed<AffinoDataGridCellSelectionCoord | null>(() => (
    cellSelectionFocus.value ?? cellSelectionAnchor.value
  ))
  const anchorCellSelection = computed<AffinoDataGridCellSelectionCoord | null>(() => (
    cellSelectionAnchor.value
  ))
  const focusCellSelection = computed<AffinoDataGridCellSelectionCoord | null>(() => (
    cellSelectionFocus.value
  ))

  const setCellSelection = (
    coord: AffinoDataGridCellSelectionCoord,
    extend = false,
    fallbackAnchor: { rowIndex: number; columnIndex: number } | null = null,
  ): void => {
    if (!extend) {
      cellSelectionAnchor.value = coord
      cellSelectionFocus.value = coord
      return
    }

    const anchor = cellSelectionAnchor.value
      ?? (fallbackAnchor
        ? resolveCellCoordByIndex(fallbackAnchor.rowIndex, fallbackAnchor.columnIndex)
        : null)
      ?? activeCellSelection.value
      ?? coord

    cellSelectionAnchor.value = anchor
    cellSelectionFocus.value = coord
  }

  const clearCellSelection = (): void => {
    cellSelectionAnchor.value = null
    cellSelectionFocus.value = null
    isPointerSelectingCells.value = false
  }

  const stopPointerCellSelection = (): void => {
    isPointerSelectingCells.value = false
  }

  const cellSelectionRange = computed<InternalCellRange | null>(() => {
    const anchor = cellSelectionAnchor.value
    const focus = cellSelectionFocus.value
    if (!anchor || !focus) {
      return null
    }
    return {
      startRow: Math.min(anchor.rowIndex, focus.rowIndex),
      endRow: Math.max(anchor.rowIndex, focus.rowIndex),
      startColumn: Math.min(anchor.columnIndex, focus.columnIndex),
      endColumn: Math.max(anchor.columnIndex, focus.columnIndex),
    }
  })

  const cellSelectionRanges = computed(() => (
    cellSelectionRange.value ? [cellSelectionRange.value] : []
  ))

  const isCellSelected = (rowIndex: number, columnIndex: number): boolean => {
    const range = cellSelectionRange.value
    if (!range) {
      return false
    }
    return (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    )
  }

  const setCellByKey = (
    rowKey: string,
    columnKey: string,
    selectionOptions: { extend?: boolean } = {},
  ): boolean => {
    const coord = resolveCellCoordByKey(rowKey, columnKey)
    if (!coord) {
      return false
    }
    setCellSelection(coord, Boolean(selectionOptions.extend))
    return true
  }

  const buildCellSelectionSnapshot = (): DataGridSelectionSnapshot | null => {
    const range = cellSelectionRange.value
    const anchor = cellSelectionAnchor.value
    const focus = cellSelectionFocus.value
    if (!range || !anchor || !focus) {
      return null
    }
    const startRowId = options.runtime.api.getRow(range.startRow)?.rowId ?? null
    const endRowId = options.runtime.api.getRow(range.endRow)?.rowId ?? null
    return {
      ranges: [
        {
          startRow: range.startRow,
          endRow: range.endRow,
          startCol: range.startColumn,
          endCol: range.endColumn,
          startRowId,
          endRowId,
          anchor: {
            rowIndex: anchor.rowIndex,
            colIndex: anchor.columnIndex,
            rowId: anchor.rowId,
          },
          focus: {
            rowIndex: focus.rowIndex,
            colIndex: focus.columnIndex,
            rowId: focus.rowId,
          },
        },
      ],
      activeRangeIndex: 0,
      activeCell: {
        rowIndex: focus.rowIndex,
        colIndex: focus.columnIndex,
        rowId: focus.rowId,
      },
    }
  }

  const syncSelectionSnapshot = (): void => {
    const nextSnapshot = buildCellSelectionSnapshot() ?? options.selectionSnapshot.value
    options.internalSelectionSnapshot.value = nextSnapshot
    if (!options.runtime.api.hasSelectionSupport()) {
      return
    }
    if (!nextSnapshot) {
      options.runtime.api.clearSelection()
      options.emitSelectionChange(null)
      return
    }
    options.runtime.api.setSelectionSnapshot(nextSnapshot)
    options.emitSelectionChange(nextSnapshot)
  }

  watch(
    [cellSelectionRange, () => options.selectionSnapshot.value],
    () => {
      syncSelectionSnapshot()
    },
    { immediate: true, flush: "sync" },
  )

  watch(
    cellSelectionRange,
    nextRange => {
      options.emitRangeChange?.(nextRange)
    },
    { flush: "sync" },
  )

  const cellNavigation = useDataGridCellNavigation({
    resolveCurrentCellCoord: () => {
      const active = activeCellSelection.value
      if (!active) {
        return null
      }
      return {
        rowIndex: active.rowIndex,
        columnIndex: active.columnIndex,
      }
    },
    resolveTabTarget: (current, backwards) => {
      const rowCount = options.runtime.api.getRowCount()
      const columnCount = options.runtime.columnSnapshot.value.visibleColumns.length
      if (rowCount <= 0 || columnCount <= 0) {
        return null
      }
      let rowIndex = current.rowIndex
      let columnIndex = current.columnIndex + (backwards ? -1 : 1)
      if (columnIndex < 0) {
        rowIndex -= 1
        columnIndex = columnCount - 1
      } else if (columnIndex >= columnCount) {
        rowIndex += 1
        columnIndex = 0
      }
      if (rowIndex < 0 || rowIndex >= rowCount) {
        return null
      }
      return {
        rowIndex,
        columnIndex,
      }
    },
    normalizeCellCoord: coord => {
      const normalized = resolveCellCoordByIndex(coord.rowIndex, coord.columnIndex)
      if (!normalized) {
        return null
      }
      return {
        rowIndex: normalized.rowIndex,
        columnIndex: normalized.columnIndex,
      }
    },
    getAdjacentNavigableColumnIndex: (columnIndex, direction) => {
      const max = Math.max(0, options.runtime.columnSnapshot.value.visibleColumns.length - 1)
      return Math.max(0, Math.min(max, columnIndex + direction))
    },
    getFirstNavigableColumnIndex: () => (
      options.runtime.columnSnapshot.value.visibleColumns.length > 0 ? 0 : -1
    ),
    getLastNavigableColumnIndex: () => (
      Math.max(-1, options.runtime.columnSnapshot.value.visibleColumns.length - 1)
    ),
    getLastRowIndex: () => Math.max(0, options.runtime.api.getRowCount() - 1),
    resolveStepRows: options.resolveStepRows ?? (() => 20),
    closeContextMenu: options.closeContextMenu ?? (() => {}),
    clearCellSelection,
    setLastAction: options.setLastAction ?? (() => {}),
    applyCellSelection: (nextCoord, extend, fallbackAnchor) => {
      const normalized = resolveCellCoordByIndex(nextCoord.rowIndex, nextCoord.columnIndex)
      if (!normalized) {
        return
      }
      setCellSelection(normalized, extend, fallbackAnchor ?? null)
    },
  })

  const normalizeCellRange = (range: InternalCellRange | null): InternalCellRange | null => {
    if (!range) {
      return null
    }
    const rowTotal = options.runtime.api.getRowCount()
    const colTotal = options.runtime.columnSnapshot.value.visibleColumns.length
    if (rowTotal <= 0 || colTotal <= 0) {
      return null
    }
    const clamp = (value: number, max: number): number => (
      Math.max(0, Math.min(max, Math.trunc(value)))
    )
    const maxRow = Math.max(0, rowTotal - 1)
    const maxCol = Math.max(0, colTotal - 1)
    const startRow = clamp(Math.min(range.startRow, range.endRow), maxRow)
    const endRow = clamp(Math.max(range.startRow, range.endRow), maxRow)
    const startColumn = clamp(Math.min(range.startColumn, range.endColumn), maxCol)
    const endColumn = clamp(Math.max(range.startColumn, range.endColumn), maxCol)
    return {
      startRow,
      endRow,
      startColumn,
      endColumn,
    }
  }

  const applySelectionFromRange = (range: InternalCellRange, activePosition: "start" | "end" = "end"): void => {
    const normalized = normalizeCellRange(range)
    if (!normalized) {
      clearCellSelection()
      return
    }
    const start = resolveCellCoordByIndex(normalized.startRow, normalized.startColumn)
    const end = resolveCellCoordByIndex(normalized.endRow, normalized.endColumn)
    if (!start || !end) {
      return
    }
    if (activePosition === "start") {
      cellSelectionAnchor.value = end
      cellSelectionFocus.value = start
      return
    }
    cellSelectionAnchor.value = start
    cellSelectionFocus.value = end
  }

  return {
    activeCellSelection,
    anchorCellSelection,
    focusCellSelection,
    cellSelectionRange,
    cellSelectionRanges,
    isPointerSelectingCells,
    isCellSelected,
    setCellSelection,
    setCellByKey,
    clearCellSelection,
    stopPointerCellSelection,
    resolveVisibleColumnIndex,
    resolveVisibleRowIndexByKey,
    resolveCellCoordByIndex,
    resolveCellCoordByKey,
    applySelectionFromRange,
    cellNavigation,
  }
}
