import { nextTick, ref, type Ref } from "vue"
import type { DataGridRowNode } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode, DataGridAppRowHeightMode } from "./useDataGridAppControls"

export interface UseDataGridAppRowSizingOptions<TRow> {
  mode: Ref<DataGridAppMode>
  rowHeightMode: Ref<DataGridAppRowHeightMode>
  normalizedBaseRowHeight: Ref<number>
  viewportRowStart: Ref<number>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  minRowHeight?: number
  syncViewport?: () => void
}

export interface UseDataGridAppRowSizingResult<TRow> {
  rowStyle: (row: DataGridRowNode<TRow>, rowOffset: number) => Record<string, string>
  isRowAutosizeProbe: (row: DataGridRowNode<TRow>, rowOffset: number) => boolean
  measureVisibleRowHeights: () => void
  startRowResize: (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number) => void
  autosizeRow: (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number) => void
  dispose: () => void
}

export function useDataGridAppRowSizing<TRow>(
  options: UseDataGridAppRowSizingOptions<TRow>,
): UseDataGridAppRowSizingResult<TRow> {
  const minRowHeight = options.minRowHeight ?? 24
  const rowHeightRenderRevision = ref(0)
  const measuringRowKey = ref<string | null>(null)
  const rowResizeState = ref<{ rowKey: string; startY: number; startBase: number } | null>(null)

  const shouldUseFixedRowHeight = (): boolean => {
    return options.rowHeightMode.value === "fixed"
  }

  const resolveRenderedRowKey = (row: DataGridRowNode<TRow>, rowOffset: number): string => {
    if (row.rowId != null) {
      return String(row.rowId)
    }
    return `row-${options.viewportRowStart.value + rowOffset}`
  }

  const resolveRowHeightPx = (rowIndex: number): number => {
    const override = options.runtime.api.view.getRowHeightOverride(rowIndex)
    return override ?? options.normalizedBaseRowHeight.value
  }

  const rowStyle = (row: DataGridRowNode<TRow>, rowOffset: number): Record<string, string> => {
    void rowHeightRenderRevision.value
    if (!shouldUseFixedRowHeight()) {
      return {}
    }
    const rowKey = resolveRenderedRowKey(row, rowOffset)
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (measuringRowKey.value === rowKey) {
      return {}
    }
    const px = `${resolveRowHeightPx(rowIndex)}px`
    return {
      height: px,
      minHeight: px,
    }
  }

  const isRowAutosizeProbe = (row: DataGridRowNode<TRow>, rowOffset: number): boolean => {
    return measuringRowKey.value === resolveRenderedRowKey(row, rowOffset)
  }

  const measureVisibleRowHeights = (): void => {
    if (options.mode.value !== "base" || options.rowHeightMode.value !== "auto") {
      return
    }
    options.runtime.api.view.measureRowHeight()
  }

  const stopRowResize = (): void => {
    rowResizeState.value = null
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", onRowResizeMove)
      window.removeEventListener("mouseup", onRowResizeEnd)
    }
  }

  const onRowResizeMove = (event: MouseEvent): void => {
    const state = rowResizeState.value
    if (!state || options.mode.value !== "base") {
      return
    }
    options.rowHeightMode.value = "fixed"
    const delta = event.clientY - state.startY
    const nextHeight = Math.max(minRowHeight, Math.round(state.startBase + delta))
    const rowIndex = Number.parseInt(state.rowKey, 10)
    if (Number.isFinite(rowIndex)) {
      options.runtime.api.view.setRowHeightOverride(rowIndex, nextHeight)
      rowHeightRenderRevision.value += 1
    }
  }

  const onRowResizeEnd = (): void => {
    if (!rowResizeState.value) {
      return
    }
    stopRowResize()
  }

  const startRowResize = (event: MouseEvent, _row: DataGridRowNode<TRow>, rowOffset: number): void => {
    if (options.mode.value !== "base") {
      return
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    const rowKey = String(rowIndex)
    rowResizeState.value = {
      rowKey,
      startY: event.clientY,
      startBase: resolveRowHeightPx(rowIndex),
    }
    options.rowHeightMode.value = "fixed"
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", onRowResizeMove)
      window.addEventListener("mouseup", onRowResizeEnd)
    }
  }

  const autosizeRow = (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number): void => {
    if (options.mode.value !== "base") {
      return
    }
    const rowIndex = options.viewportRowStart.value + rowOffset
    const rowKey = resolveRenderedRowKey(row, rowOffset)
    options.rowHeightMode.value = "fixed"
    measuringRowKey.value = rowKey
    const rowElement = (event.currentTarget as HTMLElement | null)?.closest(".grid-row") as HTMLElement | null
    void nextTick(() => {
      const measured = rowElement ? Math.round(rowElement.getBoundingClientRect().height) : options.normalizedBaseRowHeight.value
      options.runtime.api.view.setRowHeightOverride(rowIndex, Math.max(minRowHeight, measured))
      rowHeightRenderRevision.value += 1
      measuringRowKey.value = null
      options.syncViewport?.()
    })
  }

  return {
    rowStyle,
    isRowAutosizeProbe,
    measureVisibleRowHeights,
    startRowResize,
    autosizeRow,
    dispose: stopRowResize,
  }
}
