import type { Ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridRowId,
  DataGridRowNode,
  DataGridSelectionProjectionIdentity,
  DataGridSelectionSnapshot,
  DataGridSelectionSnapshotRange,
} from "@affino/datagrid-core"
import {
  collectDataGridSelectionLoadedCoverage,
  createDataGridVirtualSelectionMetadata,
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
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api" | "getBodyRowAtIndex">
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  viewportRowStart: Ref<number>
  resolveRowIndex?: (rowOffset: number) => number
  selectionSnapshot: Ref<DataGridSelectionSnapshot | null>
  selectionAnchor: Ref<GridSelectionPointLike<DataGridRowId> | null>
  isEditingCell: (row: DataGridRowNode<TRow>, columnKey: string) => boolean
  isVirtualSelectionMode?: () => boolean
  isRowLoadedAtIndex?: (rowIndex: number) => boolean
  resolveProjectionIdentity?: () => DataGridSelectionProjectionIdentity | null
}

export interface UseDataGridAppCellSelectionResult<TRow> {
  normalizeRowId: (value: unknown) => DataGridRowId | null
  normalizeCellCoord: (coord: DataGridAppCellCoord) => DataGridAppCellCoord | null
  resolveSelectionRange: () => DataGridCopyRange | null
  resolveSelectionRanges: () => readonly DataGridCopyRange[]
  resolveCurrentCellCoord: () => { rowIndex: number; columnIndex: number } | null
  applySelectionRange: (range: DataGridCopyRange) => void
  applyCellSelectionByCoord: (
    coord: DataGridAppCellCoord,
    extend: boolean,
    fallbackAnchor?: DataGridAppSelectionAnchorLike,
    additive?: boolean,
  ) => void
  setCellSelection: (
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
    extend: boolean,
    additive?: boolean,
  ) => void
  clearCellSelection: () => void
  isCellSelected: (rowOffset: number, columnIndex: number) => boolean
  isSelectionAnchorCell: (rowOffset: number, columnIndex: number) => boolean
  shouldHighlightSelectedCell: (rowOffset: number, columnIndex: number) => boolean
  isCellOnSelectionEdge: (
    rowOffset: number,
    columnIndex: number,
    edge: "top" | "right" | "bottom" | "left",
  ) => boolean
}

export function useDataGridAppCellSelection<TRow>(
  options: UseDataGridAppCellSelectionOptions<TRow>,
): UseDataGridAppCellSelectionResult<TRow> {
  const resolveRowIndex = (rowOffset: number): number => {
    if (typeof options.resolveRowIndex === "function") {
      return options.resolveRowIndex(rowOffset)
    }
    return options.viewportRowStart.value + rowOffset
  }

  const supportsCellSelectionMode = (): boolean => {
    return options.mode.value === "base" || options.mode.value === "tree" || options.mode.value === "worker"
  }

  const resolveAnchorColumnIndex = (anchor: DataGridAppSelectionAnchorLike): number => {
    return "columnIndex" in anchor ? anchor.columnIndex : anchor.colIndex
  }

  const resolveSelectionAnchorCoord = (): { rowIndex: number; columnIndex: number } | null => {
    const explicitAnchor = options.selectionAnchor.value
    if (explicitAnchor) {
      return {
        rowIndex: explicitAnchor.rowIndex,
        columnIndex: resolveAnchorColumnIndex(explicitAnchor),
      }
    }

    const snapshot = options.selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const activeIndex = snapshot.activeRangeIndex ?? 0
    const range = snapshot.ranges[activeIndex] ?? snapshot.ranges[0]
    if (!range?.anchor) {
      return null
    }

    return {
      rowIndex: range.anchor.rowIndex,
      columnIndex: range.anchor.colIndex,
    }
  }

  const buildSelectionContext = () => {
    return {
      grid: {
        rowCount: options.totalRows.value,
        colCount: options.visibleColumns.value.length,
      },
      getRowIdByIndex: (rowIndex: number) => options.runtime.getBodyRowAtIndex(rowIndex)?.rowId ?? null,
    }
  }

  const buildSelectionSnapshot = (
    ranges: readonly DataGridSelectionSnapshotRange[],
    activeRangeIndex: number,
    activeCell: GridSelectionPointLike<DataGridRowId>,
  ): DataGridSelectionSnapshot => {
    return {
      ranges: [...ranges],
      activeRangeIndex,
      activeCell: {
        rowIndex: activeCell.rowIndex,
        colIndex: activeCell.colIndex,
        rowId: activeCell.rowId ?? null,
      },
    }
  }

  const buildSnapshotRange = (
    range: ReturnType<typeof createGridSelectionRange<DataGridRowId>>,
  ): DataGridSelectionSnapshotRange => {
    const anchor = {
      rowIndex: range.anchor.rowIndex,
      colIndex: range.anchor.colIndex,
      rowId: range.anchor.rowId ?? null,
    }
    const focus = {
      rowIndex: range.focus.rowIndex,
      colIndex: range.focus.colIndex,
      rowId: range.focus.rowId ?? null,
    }
    const baseRange: DataGridSelectionSnapshotRange = {
      startRow: range.startRow,
      endRow: range.endRow,
      startCol: range.startCol,
      endCol: range.endCol,
      startRowId: range.startRowId ?? null,
      endRowId: range.endRowId ?? null,
      anchor,
      focus,
    }
    if (options.isVirtualSelectionMode?.() !== true) {
      return baseRange
    }
    const isRowLoaded = (rowIndex: number): boolean => {
      if (typeof options.isRowLoadedAtIndex === "function") {
        return options.isRowLoadedAtIndex(rowIndex)
      }
      const row = options.runtime.getBodyRowAtIndex(rowIndex)
      return !!row && (row as { __placeholder?: boolean }).__placeholder !== true
    }
    const coverage = collectDataGridSelectionLoadedCoverage({
      startRow: range.startRow,
      endRow: range.endRow,
      startColumn: range.startCol,
      endColumn: range.endCol,
    }, {
      isRowLoaded,
      getRowIdAtIndex: rowIndex => options.runtime.getBodyRowAtIndex(rowIndex)?.rowId ?? null,
    })
    return {
      ...baseRange,
      virtual: createDataGridVirtualSelectionMetadata({
        range: baseRange,
        anchorCell: anchor,
        focusCell: focus,
        coverage,
        projectionIdentity: options.resolveProjectionIdentity?.() ?? null,
      }),
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
      rowId: options.runtime.getBodyRowAtIndex(rowIndex)?.rowId ?? null,
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

  const normalizeSelectionSnapshotRange = (
    range: DataGridSelectionSnapshotRange | null | undefined,
  ): DataGridCopyRange | null => {
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

  const resolveActiveSnapshotRange = (
    snapshot: DataGridSelectionSnapshot | null,
  ): DataGridSelectionSnapshotRange | null => {
    if (!snapshot || snapshot.ranges.length === 0) {
      return null
    }
    const activeIndex = snapshot.activeRangeIndex ?? 0
    return snapshot.ranges[activeIndex] ?? snapshot.ranges[0] ?? null
  }

  const areSnapshotRangesEqual = (
    left: DataGridSelectionSnapshotRange,
    right: DataGridSelectionSnapshotRange,
  ): boolean => {
    return left.startRow === right.startRow
      && left.endRow === right.endRow
      && left.startCol === right.startCol
      && left.endCol === right.endCol
      && left.anchor.rowIndex === right.anchor.rowIndex
      && left.anchor.colIndex === right.anchor.colIndex
      && left.focus.rowIndex === right.focus.rowIndex
      && left.focus.colIndex === right.focus.colIndex
  }

  const applySelectionSnapshot = (
    snapshot: DataGridSelectionSnapshot,
    anchor: GridSelectionPointLike<DataGridRowId>,
  ): void => {
    options.selectionAnchor.value = {
      rowIndex: anchor.rowIndex,
      colIndex: anchor.colIndex,
      rowId: anchor.rowId ?? null,
    }
    options.selectionSnapshot.value = snapshot
    options.runtime.api.selection.setSnapshot(snapshot)
  }

  const resolveSelectionRange = (): DataGridCopyRange | null => {
    return normalizeSelectionSnapshotRange(resolveActiveSnapshotRange(options.selectionSnapshot.value))
  }

  const resolveSelectionRanges = (): readonly DataGridCopyRange[] => {
    const snapshot = options.selectionSnapshot.value
    if (!snapshot || snapshot.ranges.length === 0) {
      return []
    }
    return snapshot.ranges
      .map(range => normalizeSelectionSnapshotRange(range))
      .filter((range): range is DataGridCopyRange => range != null)
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
      rowId: options.runtime.getBodyRowAtIndex(normalized.startRow)?.rowId ?? null,
    }
    const focus = {
      rowIndex: normalized.endRow,
      colIndex: normalized.endColumn,
      rowId: options.runtime.getBodyRowAtIndex(normalized.endRow)?.rowId ?? null,
    }
    const createdRange = createGridSelectionRange(anchor, focus, context)
    const snapshot = buildSelectionSnapshot([buildSnapshotRange(createdRange)], 0, {
      rowIndex: createdRange.focus.rowIndex,
      colIndex: createdRange.focus.colIndex,
      rowId: createdRange.focus.rowId ?? null,
    })
    applySelectionSnapshot(snapshot, createdRange.anchor)
  }

  const applyCellSelectionByCoord = (
    coord: DataGridAppCellCoord,
    extend: boolean,
    fallbackAnchor?: DataGridAppSelectionAnchorLike,
    additive = false,
  ): void => {
    if (!supportsCellSelectionMode() || !options.runtime.api.selection.hasSupport()) {
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
      columnIndex: resolveAnchorColumnIndex(rawAnchor),
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
    const nextSnapshotRange = buildSnapshotRange(range)
    const currentSnapshot = options.selectionSnapshot.value
    const normalizedActiveIndex = currentSnapshot && currentSnapshot.ranges.length > 0
      ? Math.max(0, Math.min(currentSnapshot.activeRangeIndex ?? 0, currentSnapshot.ranges.length - 1))
      : 0
    let nextRanges: DataGridSelectionSnapshotRange[]
    let activeRangeIndex = 0

    if (extend && currentSnapshot && currentSnapshot.ranges.length > 0) {
      nextRanges = currentSnapshot.ranges.map((entry, index) => (
        index === normalizedActiveIndex ? nextSnapshotRange : entry
      ))
      activeRangeIndex = normalizedActiveIndex
    } else if (additive && currentSnapshot && currentSnapshot.ranges.length > 0) {
      const duplicateIndex = currentSnapshot.ranges.findIndex(entry => areSnapshotRangesEqual(entry, nextSnapshotRange))
      if (duplicateIndex >= 0) {
        nextRanges = [...currentSnapshot.ranges]
        activeRangeIndex = duplicateIndex
      } else {
        nextRanges = [...currentSnapshot.ranges, nextSnapshotRange]
        activeRangeIndex = nextRanges.length - 1
      }
    } else {
      nextRanges = [nextSnapshotRange]
    }

    const snapshot = buildSelectionSnapshot(nextRanges, activeRangeIndex, {
      rowIndex: normalizedCoord.rowIndex,
      colIndex: normalizedCoord.columnIndex,
      rowId: normalizedCoord.rowId,
    })
    applySelectionSnapshot(snapshot, range.anchor)
  }

  const setCellSelection = (
    row: DataGridRowNode<TRow>,
    rowOffset: number,
    columnIndex: number,
    extend: boolean,
    additive = false,
  ): void => {
    if (options.isEditingCell(row, options.visibleColumns.value[columnIndex]?.key ?? "")) {
      return
    }
    const rowIndex = Number.isFinite(row.displayIndex)
      ? Math.max(0, Math.trunc(row.displayIndex))
      : resolveRowIndex(rowOffset)
    const coord = {
      rowIndex,
      columnIndex,
      rowId: row.rowId ?? null,
    }
    if (additive) {
      applyCellSelectionByCoord(coord, extend, undefined, true)
      return
    }
    applyCellSelectionByCoord(coord, extend)
  }

  const clearCellSelection = (): void => {
    options.selectionAnchor.value = null
    options.selectionSnapshot.value = null
    options.runtime.api.selection.clear()
  }

  const isCellSelected = (rowOffset: number, columnIndex: number): boolean => {
    const ranges = resolveSelectionRanges()
    if (ranges.length === 0) {
      return false
    }
    const rowIndex = resolveRowIndex(rowOffset)
    return ranges.some(range => (
      rowIndex >= range.startRow
      && rowIndex <= range.endRow
      && columnIndex >= range.startColumn
      && columnIndex <= range.endColumn
    ))
  }

  const isSelectionAnchorCell = (rowOffset: number, columnIndex: number): boolean => {
    const anchor = resolveSelectionAnchorCoord()
    if (!anchor) {
      return false
    }
    const rowIndex = resolveRowIndex(rowOffset)
    return rowIndex === anchor.rowIndex && columnIndex === anchor.columnIndex
  }

  const shouldHighlightSelectedCell = (rowOffset: number, columnIndex: number): boolean => {
    const ranges = resolveSelectionRanges()
    if (ranges.length === 0 || !isCellSelected(rowOffset, columnIndex)) {
      return false
    }
    if (
      ranges.length === 1
      && ranges[0]
      && ranges[0].startRow === ranges[0].endRow
      && ranges[0].startColumn === ranges[0].endColumn
    ) {
      return false
    }
    return !isSelectionAnchorCell(rowOffset, columnIndex)
  }

  const isCellOnSelectionEdge = (
    rowOffset: number,
    columnIndex: number,
    edge: "top" | "right" | "bottom" | "left",
  ): boolean => {
    const ranges = resolveSelectionRanges()
    if (ranges.length === 0 || !isCellSelected(rowOffset, columnIndex)) {
      return false
    }
    const rowIndex = resolveRowIndex(rowOffset)
    return ranges.some(range => {
      if (
        rowIndex < range.startRow
        || rowIndex > range.endRow
        || columnIndex < range.startColumn
        || columnIndex > range.endColumn
      ) {
        return false
      }
      switch (edge) {
        case "top":
          return rowIndex === range.startRow
        case "right":
          return columnIndex === range.endColumn
        case "bottom":
          return rowIndex === range.endRow
        case "left":
          return columnIndex === range.startColumn
      }
    })
  }

  return {
    normalizeRowId,
    normalizeCellCoord,
    resolveSelectionRange,
    resolveSelectionRanges,
    resolveCurrentCellCoord,
    applySelectionRange,
    applyCellSelectionByCoord,
    setCellSelection,
    clearCellSelection,
    isCellSelected,
    isSelectionAnchorCell,
    shouldHighlightSelectedCell,
    isCellOnSelectionEdge,
  }
}
