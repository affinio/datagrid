import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from "vue"
import type { DataGridRowNode } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode, DataGridAppRowHeightMode } from "./useDataGridAppControls"
import { shouldPrioritizeNativeScrollForMouseEvent } from "./dataGridMouseEventGuards"
import {
  resolveDataGridAppInteractionOwnerSnapshot,
  type DataGridAppInteractionOwnerSnapshot,
} from "./dataGridInteractionOwner"

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
  isRowResizing: ComputedRef<boolean>
  interactionOwnerSnapshot: ComputedRef<DataGridAppInteractionOwnerSnapshot>
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
  const rowResizeState = ref<{ rowIndex: number; rowId: DataGridRowNode<TRow>["rowId"] | null; startY: number; startBase: number } | null>(null)
  const isRowResizing = computed(() => rowResizeState.value !== null)
  const interactionOwnerSnapshot = computed(() => resolveDataGridAppInteractionOwnerSnapshot({
    rowResize: isRowResizing.value,
  }))
  const suppressNextRowIndexClick = ref(false)
  const autoMeasuredRowIndexes = new Set<number>()
  const manualAutoRowHeightFloors = new Map<string, number>()

  const shouldUseFixedRowHeight = (): boolean => {
    return options.rowHeightMode.value === "fixed"
  }

  const resolveRenderedRowKey = (row: DataGridRowNode<TRow>, rowOffset: number): string => {
    if (row.rowId != null) {
      return String(row.rowId)
    }
    return `row-${options.viewportRowStart.value + rowOffset}`
  }

  const resolveHeightIdentity = (rowId: DataGridRowNode<TRow>["rowId"] | null | undefined, rowIndex: number): string => {
    return rowId != null ? `id:${typeof rowId}:${String(rowId)}` : `index:${rowIndex}`
  }

  const resolveOverride = (row: DataGridRowNode<TRow>, rowIndex: number): number | null => {
    return row.rowId != null
      ? options.runtime.api.view.getRowHeightOverrideById(row.rowId) ?? options.runtime.api.view.getRowHeightOverride(rowIndex)
      : options.runtime.api.view.getRowHeightOverride(rowIndex)
  }

  const resolveFixedRowHeightPx = (rowIndex: number, row?: DataGridRowNode<TRow>): number => {
    const override = row ? resolveOverride(row, rowIndex) : options.runtime.api.view.getRowHeightOverride(rowIndex)
    return override ?? options.normalizedBaseRowHeight.value
  }

  const resolveAutoRowHeightFloorPx = (rowIndex: number, row?: DataGridRowNode<TRow>): number => {
    return Math.max(
      minRowHeight,
      options.normalizedBaseRowHeight.value,
      manualAutoRowHeightFloors.get(resolveHeightIdentity(row?.rowId, rowIndex)) ?? 0,
    )
  }

  const resolveRowHeightPx = (rowIndex: number, row?: DataGridRowNode<TRow>): number => {
    if (shouldUseFixedRowHeight()) {
      return resolveFixedRowHeightPx(rowIndex, row)
    }
    const override = row ? resolveOverride(row, rowIndex) : options.runtime.api.view.getRowHeightOverride(rowIndex)
    return Math.max(resolveAutoRowHeightFloorPx(rowIndex, row), override ?? 0)
  }

  const rowStyle = (row: DataGridRowNode<TRow>, rowOffset: number): Record<string, string> => {
    void rowHeightRenderRevision.value
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (!shouldUseFixedRowHeight()) {
      return {
        minHeight: `${resolveRowHeightPx(rowIndex, row)}px`,
      }
    }
    const rowKey = resolveRenderedRowKey(row, rowOffset)
    if (measuringRowKey.value === rowKey) {
      return {}
    }
    const px = `${resolveRowHeightPx(rowIndex, row)}px`
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
      const row = options.runtime.api.rows.get(rowIndex)
      if (manualAutoRowHeightFloors.has(resolveHeightIdentity(row?.rowId, rowIndex))) {
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
      const row = options.runtime.api.rows.get(rowIndex)
      const heightIdentity = resolveHeightIdentity(row?.rowId, rowIndex)
      const nextHeight = Math.max(measuredHeight, resolveAutoRowHeightFloorPx(rowIndex, row ?? undefined))
      const nextOverride = nextHeight === options.normalizedBaseRowHeight.value && !manualAutoRowHeightFloors.has(heightIdentity)
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
    const rowIndex = state.rowIndex
    if (Number.isFinite(rowIndex)) {
      if (options.rowHeightMode.value === "auto") {
        manualAutoRowHeightFloors.set(resolveHeightIdentity(state.rowId, rowIndex), nextHeight)
        autoMeasuredRowIndexes.add(rowIndex)
      }
      if (state.rowId != null) options.runtime.api.view.setRowHeightOverrideById(state.rowId, nextHeight)
      else options.runtime.api.view.setRowHeightOverride(rowIndex, nextHeight)
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

  const startRowResize = (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number): void => {
    if (options.mode.value !== "base" || shouldPrioritizeNativeScrollForMouseEvent(event)) {
      return
    }
    event.preventDefault()
    suppressNextRowIndexClick.value = true
    const rowIndex = options.viewportRowStart.value + rowOffset
    rowResizeState.value = {
      rowIndex,
      rowId: row.rowId ?? null,
      startY: event.clientY,
      startBase: resolveRowHeightPx(rowIndex, row),
    }
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", onRowResizeMove)
      window.addEventListener("mouseup", onRowResizeEnd)
    }
  }

  const autosizeRow = (event: MouseEvent, row: DataGridRowNode<TRow>, rowOffset: number): void => {
    if (options.mode.value !== "base" || shouldPrioritizeNativeScrollForMouseEvent(event)) {
      return
    }
    event.preventDefault()
    suppressNextRowIndexClick.value = true
    const rowIndex = options.viewportRowStart.value + rowOffset
    if (options.rowHeightMode.value === "auto") {
      manualAutoRowHeightFloors.delete(resolveHeightIdentity(row.rowId, rowIndex))
      if (row.rowId != null) options.runtime.api.view.setRowHeightOverrideById(row.rowId, null)
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
      const height = Math.max(minRowHeight, measured)
      if (row.rowId != null) options.runtime.api.view.setRowHeightOverrideById(row.rowId, height)
      else options.runtime.api.view.setRowHeightOverride(rowIndex, height)
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
    isRowResizing,
    interactionOwnerSnapshot,
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
