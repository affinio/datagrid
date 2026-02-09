import { computed, ref, type Ref } from "vue"
import type { DataGridSortDirection, DataGridSortState } from "@affino/datagrid-core"
import {
  buildDataGridOverlayTransformFromSnapshot,
} from "./composables/selectionOverlayTransform"
import type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
} from "./types"
export {
  useDataGridInlineEditorKeyRouter,
  type UseDataGridInlineEditorKeyRouterOptions,
  type UseDataGridInlineEditorKeyRouterResult,
} from "./composables/useDataGridInlineEditorKeyRouter"
export {
  useDataGridCellNavigation,
  type DataGridNavigationCellCoord,
  type UseDataGridCellNavigationOptions,
  type UseDataGridCellNavigationResult,
} from "./composables/useDataGridCellNavigation"
export {
  useDataGridHeaderContextActions,
  type UseDataGridHeaderContextActionsOptions,
  type UseDataGridHeaderContextActionsResult,
} from "./composables/useDataGridHeaderContextActions"
export {
  useDataGridHeaderSortOrchestration,
  type DataGridHeaderSortEntry,
  type UseDataGridHeaderSortOrchestrationOptions,
  type UseDataGridHeaderSortOrchestrationResult,
} from "./composables/useDataGridHeaderSortOrchestration"
export {
  useDataGridHeaderResizeOrchestration,
  type DataGridHeaderResizeState,
  type UseDataGridHeaderResizeOrchestrationOptions,
  type UseDataGridHeaderResizeOrchestrationResult,
} from "./composables/useDataGridHeaderResizeOrchestration"
export {
  useDataGridContextMenuAnchor,
  type DataGridContextMenuAnchorCellCoord,
  type DataGridContextMenuAnchorRange,
  type DataGridContextMenuAnchorRowIdentity,
  type DataGridContextMenuAnchorColumnIdentity,
  type UseDataGridContextMenuAnchorOptions,
  type UseDataGridContextMenuAnchorResult,
} from "./composables/useDataGridContextMenuAnchor"
export {
  useDataGridCellPointerDownRouter,
  type DataGridCellPointerCoord,
  type DataGridCellPointerRange,
  type UseDataGridCellPointerDownRouterOptions,
  type UseDataGridCellPointerDownRouterResult,
} from "./composables/useDataGridCellPointerDownRouter"
export {
  useDataGridCellPointerHoverRouter,
  type DataGridCellPointerHoverCoord,
  type UseDataGridCellPointerHoverRouterOptions,
  type UseDataGridCellPointerHoverRouterResult,
} from "./composables/useDataGridCellPointerHoverRouter"
export {
  useDataGridDragSelectionLifecycle,
  type UseDataGridDragSelectionLifecycleOptions,
  type UseDataGridDragSelectionLifecycleResult,
} from "./composables/useDataGridDragSelectionLifecycle"
export {
  useDataGridDragPointerSelection,
  type DataGridDragPointerSelectionCoord,
  type DataGridDragPointerSelectionCoordinates,
  type UseDataGridDragPointerSelectionOptions,
  type UseDataGridDragPointerSelectionResult,
} from "./composables/useDataGridDragPointerSelection"
export {
  useDataGridFillSelectionLifecycle,
  type UseDataGridFillSelectionLifecycleOptions,
  type UseDataGridFillSelectionLifecycleResult,
} from "./composables/useDataGridFillSelectionLifecycle"
export {
  useDataGridRangeMoveLifecycle,
  type UseDataGridRangeMoveLifecycleOptions,
  type UseDataGridRangeMoveLifecycleResult,
} from "./composables/useDataGridRangeMoveLifecycle"
export {
  useDataGridRangeMoveStart,
  type DataGridRangeMoveStartCoord,
  type DataGridRangeMoveStartRange,
  type DataGridRangeMoveStartPointer,
  type UseDataGridRangeMoveStartOptions,
  type UseDataGridRangeMoveStartResult,
} from "./composables/useDataGridRangeMoveStart"
export {
  useDataGridTabTargetResolver,
  type DataGridTabTargetCoord,
  type DataGridTabTargetNextCoord,
  type UseDataGridTabTargetResolverOptions,
  type UseDataGridTabTargetResolverResult,
} from "./composables/useDataGridTabTargetResolver"
export {
  useDataGridContextMenuActionRouter,
  type DataGridContextMenuActionRouterState,
  type UseDataGridContextMenuActionRouterOptions,
  type UseDataGridContextMenuActionRouterResult,
} from "./composables/useDataGridContextMenuActionRouter"
export {
  useDataGridViewportContextMenuRouter,
  type DataGridViewportContextMenuCoord,
  type DataGridViewportContextMenuRange,
  type UseDataGridViewportContextMenuRouterOptions,
  type UseDataGridViewportContextMenuRouterResult,
} from "./composables/useDataGridViewportContextMenuRouter"
export {
  useDataGridViewportBlurHandler,
  type UseDataGridViewportBlurHandlerOptions,
  type UseDataGridViewportBlurHandlerResult,
} from "./composables/useDataGridViewportBlurHandler"
export {
  useDataGridGlobalPointerLifecycle,
  type DataGridPointerCoordinates,
  type DataGridPointerInteractionState,
  type UseDataGridGlobalPointerLifecycleOptions,
  type UseDataGridGlobalPointerLifecycleResult,
} from "./composables/useDataGridGlobalPointerLifecycle"
export {
  useDataGridPointerAutoScroll,
  type DataGridPointerAutoScrollInteractionState,
  type DataGridPointerAutoScrollPosition,
  type UseDataGridPointerAutoScrollOptions,
  type UseDataGridPointerAutoScrollResult,
} from "./composables/useDataGridPointerAutoScroll"
export {
  useDataGridPointerPreviewRouter,
  type DataGridPointerPreviewCoord,
  type DataGridPointerPreviewRange,
  type DataGridPointerPreviewCoordinates,
  type UseDataGridPointerPreviewRouterOptions,
  type UseDataGridPointerPreviewRouterResult,
} from "./composables/useDataGridPointerPreviewRouter"
export {
  useDataGridPointerCellCoordResolver,
  type DataGridPointerCellCoord,
  type DataGridPointerColumnMetric,
  type DataGridPointerColumnSnapshot,
  type UseDataGridPointerCellCoordResolverOptions,
  type UseDataGridPointerCellCoordResolverResult,
} from "./composables/useDataGridPointerCellCoordResolver"
export {
  useDataGridAxisAutoScrollDelta,
  type UseDataGridAxisAutoScrollDeltaOptions,
  type UseDataGridAxisAutoScrollDeltaResult,
} from "./composables/useDataGridAxisAutoScrollDelta"
export {
  useDataGridCellVisibilityScroller,
  type DataGridCellVisibilityCoord,
  type DataGridCellVisibilityColumnMetric,
  type DataGridCellVisibilityScrollPosition,
  type UseDataGridCellVisibilityScrollerOptions,
  type UseDataGridCellVisibilityScrollerResult,
} from "./composables/useDataGridCellVisibilityScroller"
export {
  useDataGridGlobalMouseDownContextMenuCloser,
  type UseDataGridGlobalMouseDownContextMenuCloserOptions,
  type UseDataGridGlobalMouseDownContextMenuCloserResult,
} from "./composables/useDataGridGlobalMouseDownContextMenuCloser"
export {
  useDataGridKeyboardCommandRouter,
  type UseDataGridKeyboardCommandRouterOptions,
  type UseDataGridKeyboardCommandRouterResult,
} from "./composables/useDataGridKeyboardCommandRouter"
export {
  useDataGridClipboardBridge,
  type DataGridClipboardRange,
  type UseDataGridClipboardBridgeOptions,
  type UseDataGridClipboardBridgeResult,
} from "./composables/useDataGridClipboardBridge"
export {
  useDataGridClipboardMutations,
  type DataGridClipboardCoord,
  type DataGridClipboardMutationResult,
  type UseDataGridClipboardMutationsOptions,
  type UseDataGridClipboardMutationsResult,
} from "./composables/useDataGridClipboardMutations"
export {
  useDataGridIntentHistory,
  type DataGridIntentTransactionDescriptor,
  type UseDataGridIntentHistoryOptions,
  type UseDataGridIntentHistoryResult,
} from "./composables/useDataGridIntentHistory"

export interface UseDataGridViewportBridgeOptions {
  snapshot: Ref<DataGridOverlayTransformInput>
}

export function useDataGridViewportBridge(options: UseDataGridViewportBridgeOptions) {
  const overlayTransform = computed<DataGridOverlayTransform>(() => {
    return buildDataGridOverlayTransformFromSnapshot(options.snapshot.value)
  })
  return {
    overlayTransform,
  }
}

export interface UseDataGridHeaderOrchestrationOptions {
  initialSortState?: readonly DataGridSortState[]
}

export function useDataGridHeaderOrchestration(
  options: UseDataGridHeaderOrchestrationOptions = {},
) {
  const sortState = ref<readonly DataGridSortState[]>(options.initialSortState ?? [])

  function setSortState(nextState: readonly DataGridSortState[]) {
    sortState.value = nextState.map(entry => ({ ...entry }))
  }

  function toggleColumnSort(columnKey: string, directionCycle: readonly DataGridSortDirection[] = ["asc", "desc"]) {
    const current = sortState.value.find(entry => entry.key === columnKey)
    if (!current) {
      setSortState([{ key: columnKey, direction: directionCycle[0] ?? "asc" }])
      return
    }

    const currentIndex = directionCycle.indexOf(current.direction)
    if (currentIndex < 0 || currentIndex === directionCycle.length - 1) {
      setSortState(sortState.value.filter(entry => entry.key !== columnKey))
      return
    }
    setSortState(sortState.value.map(entry => (
      entry.key === columnKey
        ? { key: columnKey, direction: directionCycle[currentIndex + 1] ?? "asc" }
        : { ...entry }
    )))
  }

  return {
    sortState,
    setSortState,
    toggleColumnSort,
  }
}

export function createDataGridHeaderBindings(
  columnKey: string,
  orchestration: ReturnType<typeof useDataGridHeaderOrchestration>,
) {
  return {
    onClick() {
      orchestration.toggleColumnSort(columnKey)
    },
    onKeydown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        orchestration.toggleColumnSort(columnKey)
      }
    },
  }
}

export interface UseDataGridRowSelectionFacadeOptions {
  initialSelectedKeys?: readonly string[]
}

export function useDataGridRowSelectionFacade(
  options: UseDataGridRowSelectionFacadeOptions = {},
) {
  const selectedRowKeys = ref<Set<string>>(new Set(options.initialSelectedKeys ?? []))

  function isSelected(rowKey: string): boolean {
    return selectedRowKeys.value.has(rowKey)
  }

  function setSelected(rowKey: string, selected: boolean) {
    const next = new Set(selectedRowKeys.value)
    if (selected) {
      next.add(rowKey)
    } else {
      next.delete(rowKey)
    }
    selectedRowKeys.value = next
  }

  function clearSelection() {
    if (selectedRowKeys.value.size === 0) {
      return
    }
    selectedRowKeys.value = new Set()
  }

  return {
    selectedRowKeys,
    isSelected,
    setSelected,
    clearSelection,
  }
}

export interface UseDataGridFindReplaceFacadeOptions<TRow> {
  rows: Ref<readonly TRow[]>
  resolveCellValue: (row: TRow, columnKey: string) => string
  applyCellValue: (row: TRow, columnKey: string, nextValue: string) => TRow
}

export interface DataGridFindResult {
  rowIndex: number
  columnKey: string
  value: string
}

export function useDataGridFindReplaceFacade<TRow>(
  options: UseDataGridFindReplaceFacadeOptions<TRow>,
) {
  function findMatches(query: string, columnKeys: readonly string[]): DataGridFindResult[] {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return []
    }
    const results: DataGridFindResult[] = []
    options.rows.value.forEach((row, rowIndex) => {
      columnKeys.forEach(columnKey => {
        const value = options.resolveCellValue(row, columnKey)
        if (value.toLowerCase().includes(normalizedQuery)) {
          results.push({ rowIndex, columnKey, value })
        }
      })
    })
    return results
  }

  function replaceAll(search: string, replaceWith: string, columnKeys: readonly string[]): number {
    const normalizedSearch = search.trim()
    if (!normalizedSearch) {
      return 0
    }
    let updates = 0
    const nextRows = options.rows.value.map(row => {
      let nextRow = row
      columnKeys.forEach(columnKey => {
        const current = options.resolveCellValue(nextRow, columnKey)
        if (!current.includes(normalizedSearch)) {
          return
        }
        const replaced = current.split(normalizedSearch).join(replaceWith)
        if (replaced !== current) {
          nextRow = options.applyCellValue(nextRow, columnKey, replaced)
          updates += 1
        }
      })
      return nextRow
    })
    options.rows.value = nextRows
    return updates
  }

  return {
    findMatches,
    replaceAll,
  }
}
