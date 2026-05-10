import type {
  DataGridColumnModel,
  DataGridRowModel,
} from "../models/index.js"
import type { DataGridCoreViewportService } from "../core/gridCore.js"
import type {
  DataGridViewportCellTarget,
  DataGridViewportColumnTarget,
  DataGridViewportPositionSnapshot,
  DataGridViewportRowTarget,
} from "../core/gridApiViewContracts.js"
import type { DataGridViewportController } from "./dataGridViewportController.js"

export interface CreateDataGridViewportCoreServiceOptions<TRow = unknown> {
  controller: DataGridViewportController<TRow>
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
}

function normalizeIndex(value: unknown): number | null {
  if (!Number.isFinite(value)) {
    return null
  }
  const normalized = Math.trunc(value as number)
  return normalized >= 0 ? normalized : null
}

function normalizeScrollOffset(value: unknown): number | null {
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.max(0, value as number)
}

function resolveRowIndex<TRow>(
  rowModel: DataGridRowModel<TRow>,
  target: DataGridViewportRowTarget,
): number | null {
  const rowId = target.rowId
  if (rowId != null) {
    const count = rowModel.getRowCount()
    for (let index = 0; index < count; index += 1) {
      if (rowModel.getRow(index)?.rowId === rowId) {
        return index
      }
    }
  }
  const index = normalizeIndex(target.rowIndex)
  if (index == null) {
    return null
  }
  return Math.min(index, Math.max(0, rowModel.getRowCount() - 1))
}

function resolveColumnKey(
  columnModel: DataGridColumnModel,
  target: DataGridViewportColumnTarget,
): string | null {
  if (typeof target.columnKey === "string" && columnModel.getColumn(target.columnKey)) {
    return target.columnKey
  }
  const index = normalizeIndex(target.columnIndex)
  if (index == null) {
    return null
  }
  return columnModel.getSnapshot().visibleColumns[index]?.key ?? null
}

function buildAnchor<TRow>(
  rowModel: DataGridRowModel<TRow>,
  columnModel: DataGridColumnModel,
  rowIndex: number,
  columnIndex: number,
): DataGridViewportPositionSnapshot["anchor"] {
  const normalizedRowIndex = normalizeIndex(rowIndex)
  const normalizedColumnIndex = normalizeIndex(columnIndex)
  const row = normalizedRowIndex == null ? undefined : rowModel.getRow(normalizedRowIndex)
  const column = normalizedColumnIndex == null
    ? undefined
    : columnModel.getSnapshot().visibleColumns[normalizedColumnIndex]
  return {
    rowId: row?.rowId ?? null,
    rowIndex: normalizedRowIndex,
    columnKey: column?.key ?? null,
    columnIndex: normalizedColumnIndex,
  }
}

function applyScrollFallback<TRow>(
  controller: DataGridViewportController<TRow>,
  position: DataGridViewportPositionSnapshot,
): void {
  const top = normalizeScrollOffset(position.scroll?.top)
  const left = normalizeScrollOffset(position.scroll?.left)
  if (top != null) {
    controller.input.scrollTop.value = top
  }
  if (left != null) {
    controller.input.scrollLeft.value = left
  }
}

export function createDataGridViewportCoreService<TRow = unknown>(
  options: CreateDataGridViewportCoreServiceOptions<TRow>,
): DataGridCoreViewportService {
  const { controller, rowModel, columnModel } = options

  return {
    name: "viewport",
    getViewportRange() {
      const snapshot = controller.getIntegrationSnapshot()
      return {
        start: snapshot.visibleRowRange.start,
        end: snapshot.visibleRowRange.end,
      }
    },
    setViewportRange(range) {
      rowModel.setViewportRange(range)
      const start = normalizeIndex(range.start)
      if (start != null) {
        controller.scrollToRow(start)
      }
    },
    getViewportPosition() {
      const snapshot = controller.getIntegrationSnapshot()
      const syncState = controller.getViewportSyncState()
      return {
        version: 1,
        range: {
          start: snapshot.visibleRowRange.start,
          end: snapshot.visibleRowRange.end,
        },
        anchor: buildAnchor(
          rowModel,
          columnModel,
          snapshot.visibleRowRange.start,
          snapshot.visibleColumnRange.start,
        ),
        scroll: {
          top: normalizeScrollOffset(snapshot.scrollTop) ?? normalizeScrollOffset(syncState.scrollTop) ?? 0,
          left: normalizeScrollOffset(snapshot.scrollLeft) ?? normalizeScrollOffset(syncState.scrollLeft) ?? 0,
        },
      }
    },
    setViewportPosition(position) {
      rowModel.setViewportRange(position.range)
      const rowIndex = resolveRowIndex(rowModel, position.anchor ?? {})
      const columnKey = resolveColumnKey(columnModel, position.anchor ?? {})

      if (rowIndex != null) {
        controller.scrollToRow(rowIndex)
      }
      if (columnKey) {
        controller.scrollToColumn(columnKey)
      }
      if (rowIndex == null || !columnKey) {
        applyScrollFallback(controller, position)
      }
      controller.refresh(true)
    },
    scrollToRow(target) {
      const rowIndex = resolveRowIndex(rowModel, target)
      if (rowIndex != null) {
        controller.scrollToRow(rowIndex)
      }
    },
    scrollToColumn(target) {
      const columnKey = resolveColumnKey(columnModel, target)
      if (columnKey) {
        controller.scrollToColumn(columnKey)
      }
    },
    scrollToCell(target: DataGridViewportCellTarget) {
      const rowIndex = resolveRowIndex(rowModel, target)
      const columnKey = resolveColumnKey(columnModel, target)
      if (rowIndex != null) {
        controller.scrollToRow(rowIndex)
      }
      if (columnKey) {
        controller.scrollToColumn(columnKey)
      }
    },
    setRowHeightMode(mode) {
      controller.setRowHeightMode(mode)
    },
    setBaseRowHeight(height) {
      controller.setBaseRowHeight(height)
    },
    measureRowHeight() {
      controller.measureRowHeight()
    },
    getEffectiveRowHeight() {
      return controller.getEffectiveRowHeight()
    },
  }
}
