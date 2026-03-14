import { type Ref } from "vue"
import type { DataGridColumnSnapshot } from "@affino/datagrid-core"
import { useDataGridHeaderResizeOrchestration } from "../advanced"

export interface UseDataGridAppHeaderResizeOptions<TRow> {
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  rows: Ref<readonly TRow[]>
  persistColumnWidth?: (columnKey: string, width: number) => void
  defaultColumnWidth?: number
  minColumnWidth?: number
  autoSizeSampleLimit?: number
  autoSizeCharWidth?: number
  autoSizeHorizontalPadding?: number
  autoSizeMaxWidth?: number
  isFillDragging: () => boolean
  stopFillSelection: () => void
  isDragSelecting: () => boolean
  stopDragSelection: () => void
  readCellText: (row: TRow, columnKey: string) => string
}

export interface UseDataGridAppHeaderResizeResult {
  isColumnResizing: Ref<boolean>
  startResize: (event: MouseEvent, key: string) => void
  handleResizeDoubleClick: (event: MouseEvent, key: string) => void
  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void
  resolveColumnRenderWidth: (columnKey: string) => number
  dispose: () => void
}

export function useDataGridAppHeaderResize<TRow>(
  options: UseDataGridAppHeaderResizeOptions<TRow>,
): UseDataGridAppHeaderResizeResult {
  const defaultColumnWidth = options.defaultColumnWidth ?? 140
  const minColumnWidth = options.minColumnWidth ?? 80

  const headerResize = useDataGridHeaderResizeOrchestration<TRow>({
    resolveColumnBaseWidth: (columnKey) => {
      const snapshot = options.visibleColumns.value.find(column => column.key === columnKey)
      return snapshot?.width ?? defaultColumnWidth
    },
    resolveColumnLabel: (columnKey) => {
      return options.visibleColumns.value.find(column => column.key === columnKey)?.column.label ?? columnKey
    },
    resolveRowsForAutoSize: () => options.rows.value,
    resolveCellText: (row, columnKey) => options.readCellText(row, columnKey),
    resolveColumnWidthOverride: (columnKey) => {
      return options.visibleColumns.value.find(column => column.key === columnKey)?.width ?? null
    },
    resolveColumnMinWidth: () => minColumnWidth,
    applyColumnWidth: (columnKey, width) => {
      options.persistColumnWidth?.(columnKey, width)
    },
    isColumnResizable: (columnKey) => options.visibleColumns.value.some(column => column.key === columnKey),
    isFillDragging: () => options.isFillDragging(),
    stopFillSelection: () => {
      options.stopFillSelection()
    },
    isDragSelecting: () => options.isDragSelecting(),
    stopDragSelection: () => {
      options.stopDragSelection()
    },
    setLastAction: () => undefined,
    autoSizeSampleLimit: options.autoSizeSampleLimit ?? 400,
    autoSizeCharWidth: options.autoSizeCharWidth ?? 7.2,
    autoSizeHorizontalPadding: options.autoSizeHorizontalPadding ?? 42,
    autoSizeMaxWidth: options.autoSizeMaxWidth ?? 640,
    resizeApplyMode: "sync",
  })

  const startResize = (event: MouseEvent, key: string): void => {
    headerResize.onHeaderResizeHandleMouseDown(key, event)
  }

  const handleResizeDoubleClick = (event: MouseEvent, key: string): void => {
    headerResize.onHeaderResizeHandleDoubleClick(key, event)
  }

  const resolveColumnRenderWidth = (columnKey: string): number => {
    return options.visibleColumns.value.find(column => column.key === columnKey)?.width ?? defaultColumnWidth
  }

  return {
    isColumnResizing: headerResize.isColumnResizing,
    startResize,
    handleResizeDoubleClick,
    applyColumnResizeFromPointer: headerResize.applyColumnResizeFromPointer,
    stopColumnResize: headerResize.stopColumnResize,
    resolveColumnRenderWidth,
    dispose: headerResize.dispose,
  }
}
