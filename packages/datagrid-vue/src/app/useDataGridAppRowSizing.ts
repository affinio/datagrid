import { nextTick, ref, watch, type Ref } from "vue"
import type { DataGridRowNode } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode, DataGridAppRowHeightMode } from "./useDataGridAppControls"

export interface UseDataGridAppRowSizingOptions<TRow> {
  mode: Ref<DataGridAppMode>
  rowHeightMode: Ref<DataGridAppRowHeightMode>
  normalizedBaseRowHeight: Ref<number>
  viewportRowStart: Ref<number>
  bodyViewportRef?: Ref<HTMLElement | null>
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
  consumeRecentRowResizeInteraction: () => boolean
  dispose: () => void
}

export function useDataGridAppRowSizing<TRow>(
  options: UseDataGridAppRowSizingOptions<TRow>,
): UseDataGridAppRowSizingResult<TRow> {
  const minRowHeight = options.minRowHeight ?? 24
  const rowHeightRenderRevision = ref(0)
  const measuringRowKey = ref<string | null>(null)
  const rowResizeState = ref<{ rowKey: string; startY: number; startBase: number } | null>(null)
  const suppressNextRowIndexClick = ref(false)
  const autoMeasuredRowIndexes = new Set<number>()
  const manualAutoRowHeightFloors = new Map<number, number>()

  const shouldUseFixedRowHeight = (): boolean => {
    return options.rowHeightMode.value === "fixed"
  }

  const resolveRenderedRowKey = (row: DataGridRowNode<TRow>, rowOffset: number): string => {
    if (row.rowId != null) {
      return String(row.rowId)
    }
    return `row-${options.viewportRowStart.value + rowOffset}`
  }

  const resolveFixedRowHeightPx = (rowIndex: number): number => {
    const override = options.runtime.api.view.getRowHeightOverride(rowIndex)
    return override ?? options.normalizedBaseRowHeight.value
  }

  const resolveAutoRowHeightFloorPx = (rowIndex: number): number => {
    return Math.max(
      minRowHeight,
      options.normalizedBaseRowHeight.value,
      manualAutoRowHeightFloors.get(rowIndex) ?? 0,
    )
  }

  const resolveRowHeightPx = (rowIndex: number): number => {
    if (shouldUseFixedRowHeight()) {
      return resolveFixedRowHeightPx(rowIndex)
    }
    const override = options.runtime.api.view.getRowHeightOverride(rowIndex)
    return Math.max(resolveAutoRowHeightFloorPx(rowIndex), override ?? 0)
  }

  const rowStyle = (row: DataGridRowNode<TRow>, rowOffset: number): Record<string, string> => {
    void rowHeightRenderRevision.value
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (!shouldUseFixedRowHeight()) {
      return {
        minHeight: `${resolveRowHeightPx(rowIndex)}px`,
      }
    }
    const rowKey = resolveRenderedRowKey(row, rowOffset)
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

  const clearAutoMeasuredRowHeights = (): boolean => {
    if (autoMeasuredRowIndexes.size === 0) {
      return false
    }
    for (const rowIndex of autoMeasuredRowIndexes) {
      if (manualAutoRowHeightFloors.has(rowIndex)) {
        continue
      }
      options.runtime.api.view.setRowHeightOverride(rowIndex, null)
    }
    autoMeasuredRowIndexes.clear()
    rowHeightRenderRevision.value += 1
    return true
  }

  const measureVisibleRowHeights = (): void => {
    if (options.mode.value !== "base" || options.rowHeightMode.value !== "auto") {
      return
    }
    const viewport = options.bodyViewportRef?.value
    const measurementRoot = viewport?.closest(".grid-body-shell") as HTMLElement | null
    const rowElements = measurementRoot
      ? Array.from(measurementRoot.querySelectorAll<HTMLElement>(".grid-row[data-row-index]"))
      : viewport
        ? Array.from(viewport.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row[data-row-index]"))
        : []

    if (rowElements.length === 0) {
      options.runtime.api.view.measureRowHeight()
      return
    }

    const measuredHeightByRowIndex = new Map<number, number>()
    for (const rowElement of rowElements) {
      const indexRaw = rowElement.getAttribute("data-row-index")
      if (!indexRaw) {
        continue
      }
      const rowIndex = Number.parseInt(indexRaw, 10)
      if (!Number.isFinite(rowIndex) || rowIndex < 0) {
        continue
      }
      const measuredHeight = Math.max(
        minRowHeight,
        Math.round(rowElement.getBoundingClientRect().height || rowElement.offsetHeight || options.normalizedBaseRowHeight.value),
      )
      const previous = measuredHeightByRowIndex.get(rowIndex) ?? 0
      measuredHeightByRowIndex.set(rowIndex, Math.max(previous, measuredHeight))
    }

    let changed = false
    for (const [rowIndex, measuredHeight] of measuredHeightByRowIndex) {
      const nextHeight = Math.max(measuredHeight, resolveAutoRowHeightFloorPx(rowIndex))
      const nextOverride = nextHeight === options.normalizedBaseRowHeight.value && !manualAutoRowHeightFloors.has(rowIndex)
        ? null
        : nextHeight
      const previousOverride = options.runtime.api.view.getRowHeightOverride(rowIndex)
      if (previousOverride === nextOverride) {
        if (nextOverride == null) {
          autoMeasuredRowIndexes.delete(rowIndex)
        } else {
          autoMeasuredRowIndexes.add(rowIndex)
        }
        continue
      }
      options.runtime.api.view.setRowHeightOverride(rowIndex, nextOverride)
      if (nextOverride == null) {
        autoMeasuredRowIndexes.delete(rowIndex)
      } else {
        autoMeasuredRowIndexes.add(rowIndex)
      }
      changed = true
    }

    if (changed) {
      rowHeightRenderRevision.value += 1
      options.syncViewport?.()
    }
  }

  watch(options.rowHeightMode, (nextMode, previousMode) => {
    if (previousMode === "auto" && nextMode !== "auto") {
      if (clearAutoMeasuredRowHeights()) {
        options.syncViewport?.()
      }
    }
  })

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
    const delta = event.clientY - state.startY
    const nextHeight = Math.max(minRowHeight, Math.round(state.startBase + delta))
    const rowIndex = Number.parseInt(state.rowKey, 10)
    if (Number.isFinite(rowIndex)) {
      if (options.rowHeightMode.value === "auto") {
        manualAutoRowHeightFloors.set(rowIndex, nextHeight)
        autoMeasuredRowIndexes.add(rowIndex)
      }
      options.runtime.api.view.setRowHeightOverride(rowIndex, nextHeight)
      rowHeightRenderRevision.value += 1
      options.syncViewport?.()
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
    suppressNextRowIndexClick.value = true
    const rowIndex = options.viewportRowStart.value + rowOffset
    const rowKey = String(rowIndex)
    rowResizeState.value = {
      rowKey,
      startY: event.clientY,
      startBase: resolveRowHeightPx(rowIndex),
    }
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", onRowResizeMove)
      window.addEventListener("mouseup", onRowResizeEnd)
    }
  }

  const autosizeRow = (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number): void => {
    if (options.mode.value !== "base") {
      return
    }
    suppressNextRowIndexClick.value = true
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (options.rowHeightMode.value === "auto") {
      manualAutoRowHeightFloors.delete(rowIndex)
      void nextTick(() => {
        measureVisibleRowHeights()
        options.syncViewport?.()
      })
      return
    }
    const rowKey = resolveRenderedRowKey(row, rowOffset)
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

  const consumeRecentRowResizeInteraction = (): boolean => {
    if (!suppressNextRowIndexClick.value) {
      return false
    }
    suppressNextRowIndexClick.value = false
    return true
  }

  return {
    rowStyle,
    isRowAutosizeProbe,
    measureVisibleRowHeights,
    startRowResize,
    autosizeRow,
    consumeRecentRowResizeInteraction,
    dispose: () => {
      stopRowResize()
      clearAutoMeasuredRowHeights()
    },
  }
}
