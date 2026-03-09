import type { Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowNode,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import type { DataGridCopyRange, GridSelectionPointLike } from "../advanced"
import { createGridSelectionRange } from "../advanced"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./useDataGridAppControls"

export interface DataGridAppCellCoord {
  rowIndex: number
  columnIndex: number
  rowId: DataGridRowId | null
}

export type DataGridAppSelectionAnchorLike =
  | DataGridAppCellCoord
  | GridSelectionPointLike<DataGridRowId>

export interface UseDataGridAppCellSelectionOptions<TRow> {
  mode: Ref<DataGridAppMode>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionAnchor: Ref<GridSelectionPointLike<DataGridRowId> | null>
  isEditingCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
}

export interface UseDataGridAppCellSelectionResult<TRow> {
  normalizeRowId: (value: unknown) => DataGridRowId | null
  normalizeCellCoord: (coord: DataGridAppCellCoord) => DataGridAppCellCoord | null
  resolveSelectionRange: () => DataGridCopyRange | null
  resolveCurrentCellCoord: () => { rowIndex: number; columnIndex: number } | null
  applySelectionRange: (range: DataGridCopyRange) => void
  applyCellSelectionByCoord: (
    coord: DataGridAppCellCoord,
    extend: boolean,
    fallbackAnchor?: DataGridAppSelectionAnchorLike,
  ) => void
  setCellSelection: (
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
    extend: boolean,
  ) => void
  clearCellSelection: () => void
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean
}

export function useDataGridAppCellSelection<TRow>(
  options: UseDataGridAppCellSelectionOptions<TRow>,
): UseDataGridAppCellSelectionResult<TRow> {
  const buildSelectionContext = () => {
    return {
      grid: {
        rowCount: options.totalRows.value,
        colCount: options.visibleColumns.value.length,
      },
      getRowIdByIndex: (rowIndex: number) => options.runtime.api.rows.get(rowIndex)?.rowId ?? null,
    }
  }

  const buildSelectionSnapshot = (
    range: ReturnType<typeof createGridSelectionRange<DataGridRowId>>,
    activeCell: GridSelectionPointLike<DataGridRowId>,
  ): DataGridSelectionSnapshot => {
    return {
      ranges: [
        {
          startRow: range.startRow,
          endRow: range.endRow,
          startCol: range.startCol,
          endCol: range.endCol,
          startRowId: range.startRowId ?? null,
          endRowId: range.endRowId ?? null,
          anchor: {
            rowIndex: range.anchor.rowIndex,
            colIndex: range.anchor.colIndex,
            rowId: range.anchor.rowId ?? null,
          },
          focus: {
            rowIndex: range.focus.rowIndex,
            colIndex: range.focus.colIndex,
            rowId: range.focus.rowId ?? null,
          },
        },
      ],
      activeRangeIndex: 0,
      activeCell: {
        rowIndex: activeCell.rowIndex,
        colIndex: activeCell.colIndex,
        rowId: activeCell.rowId ?? null,
      },
    }
  }

  const normalizeRowId = (value: unknown): DataGridRowId | null => {
    return typeof value === "string" || typeof value === "number" ? value : null
  }

  const normalizeCellCoord = (coord: DataGridAppCellCoord): DataGridAppCellCoord | null => {
    const rowCount = options.totalRows.value
    const colCount = options.visibleColumns.value.length
    if (rowCount <= 0 || colCount <= 0) {
      return null
    }
    const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.trunc(coord.rowIndex)))
    const columnIndex = Math.max(0, Math.min(colCount - 1, Math.trunc(coord.columnIndex)))
    return {
      rowIndex,
      columnIndex,
      rowId: options.runtime.api.rows.get(rowIndex)?.rowId ?? null,
    }
  }

  const normalizeSelectionRange = (range: DataGridCopyRange): DataGridCopyRange | null => {
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

  const resolveSelectionRange = (): DataGridCopyRange | null => {
    const snapshot = options.selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const activeIndex = snapshot.activeRangeIndex ?? 0
    const range = snapshot.ranges[activeIndex] ?? snapshot.ranges[0]
    if (!range) {
      return null
    }
    return normalizeSelectionRange({
      startRow: range.startRow,
      endRow: range.endRow,
      startColumn: range.startCol,
      endColumn: range.endCol,
    })
  }

  const resolveCurrentCellCoord = (): { rowIndex: number; columnIndex: number } | null => {
    const activeCell = options.selectionSnapshot.value?.activeCell
    if (!activeCell) {
      return null
    }
    const normalized = normalizeCellCoord({
      rowIndex: activeCell.rowIndex,
      columnIndex: activeCell.colIndex,
      rowId: normalizeRowId(activeCell.rowId),
    })
    if (!normalized) {
      return null
    }
    return {
      rowIndex: normalized.rowIndex,
      columnIndex: normalized.columnIndex,
    }
  }

  const applySelectionRange = (range: DataGridCopyRange): void => {
    const normalized = normalizeSelectionRange(range)
    if (!normalized || !options.runtime.api.selection.hasSupport()) {
      return
    }
    const context = buildSelectionContext()
    const anchor = {
      rowIndex: normalized.startRow,
      colIndex: normalized.startColumn,
      rowId: options.runtime.api.rows.get(normalized.startRow)?.rowId ?? null,
    }
    const focus = {
      rowIndex: normalized.endRow,
      colIndex: normalized.endColumn,
      rowId: options.runtime.api.rows.get(normalized.endRow)?.rowId ?? null,
    }
    const createdRange = createGridSelectionRange(anchor, focus, context)
    const snapshot = buildSelectionSnapshot(createdRange, {
      rowIndex: createdRange.focus.rowIndex,
      colIndex: createdRange.focus.colIndex,
      rowId: createdRange.focus.rowId ?? null,
    })
    options.selectionAnchor.value = {
      rowIndex: createdRange.anchor.rowIndex,
      colIndex: createdRange.anchor.colIndex,
      rowId: createdRange.anchor.rowId ?? null,
    }
    options.selectionSnapshot.value = snapshot
    options.runtime.api.selection.setSnapshot(snapshot)
  }

  const applyCellSelectionByCoord = (
    coord: DataGridAppCellCoord,
    extend: boolean,
    fallbackAnchor?: DataGridAppSelectionAnchorLike,
  ): void => {
    if (options.mode.value !== "base" || !options.runtime.api.selection.hasSupport()) {
      return
    }
    const normalizedCoord = normalizeCellCoord(coord)
    if (!normalizedCoord) {
      return
    }
    const context = buildSelectionContext()
    const rawAnchor = extend
      ? (options.selectionAnchor.value ?? fallbackAnchor ?? normalizedCoord)
      : normalizedCoord
    const normalizedAnchor = normalizeCellCoord({
      rowIndex: rawAnchor.rowIndex,
      columnIndex: rawAnchor.colIndex ?? rawAnchor.columnIndex ?? 0,
      rowId: normalizeRowId(rawAnchor.rowId),
    })
    if (!normalizedAnchor) {
      return
    }
    const range = createGridSelectionRange({
      rowIndex: normalizedAnchor.rowIndex,
      colIndex: normalizedAnchor.columnIndex,
      rowId: normalizedAnchor.rowId,
    }, {
      rowIndex: normalizedCoord.rowIndex,
      colIndex: normalizedCoord.columnIndex,
      rowId: normalizedCoord.rowId,
    }, context)
    const snapshot = buildSelectionSnapshot(range, {
      rowIndex: normalizedCoord.rowIndex,
      colIndex: normalizedCoord.columnIndex,
      rowId: normalizedCoord.rowId,
    })
    options.selectionAnchor.value = {
      rowIndex: range.anchor.rowIndex,
      colIndex: range.anchor.colIndex,
      rowId: range.anchor.rowId ?? null,
    }
    options.selectionSnapshot.value = snapshot
    options.runtime.api.selection.setSnapshot(snapshot)
  }

  const setCellSelection = (
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
    extend: boolean,
  ): void => {
    if (options.isEditingCell(row, options.visibleColumns.value[columnIndex]?.key ?? "")) {
      return
    }
    applyCellSelectionByCoord({
      rowIndex: options.viewportRowStart.value + rowOffset,
      columnIndex,
      rowId: row.rowId ?? null,
    }, extend)
  }

  const clearCellSelection = (): void => {
    options.selectionAnchor.value = null
    options.selectionSnapshot.value = null
    options.runtime.api.selection.clear()
  }

  const isCellSelected = (rowOffset: number, columnIndex: number): boolean => {
    const snapshot = options.selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return false
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    return snapshot.ranges.some(range => (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startCol
      && columnIndex <= range.endCol
    ))
  }

  return {
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange,
    resolveCurrentCellCoord,
    applySelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection,
    isCellSelected,
  }
}
