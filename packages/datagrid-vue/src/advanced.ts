/**
 * Advanced composition surface.
 * For demo/workbench orchestration prefer "@affino/datagrid-vue/internal".
 * For product integrations prefer stable API from "@affino/datagrid-vue".
 */
import { computed, ref, type Ref } from "vue"
import type { DataGridSortDirection, DataGridSortState } from "@affino/datagrid-core"
import {
  buildDataGridOverlayTransformFromSnapshot,
} from "./composables/selectionOverlayTransform"
import type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
} from "./types"

// Curated advanced core facade exports for Vue consumers that need lower-level viewport/runtime
// primitives without importing @affino/datagrid-core/advanced directly.
export {
  createDataGridViewportController,
} from "@affino/datagrid-core/advanced"

export type {
  DataGridImperativeRowUpdatePayload,
  DataGridVirtualWindowSnapshot,
} from "@affino/datagrid-core/advanced"

export {
  useDataGridClipboardValuePolicy,
  type UseDataGridClipboardValuePolicyResult,
} from "./composables/useDataGridClipboardValuePolicy"
export {
  useDataGridCopyRangeHelpers,
  type DataGridCopyRangeCoord,
  type DataGridCopyRange,
  type UseDataGridCopyRangeHelpersOptions,
  type UseDataGridCopyRangeHelpersResult,
} from "./composables/useDataGridCopyRangeHelpers"
export {
  useDataGridCellDatasetResolver,
  type DataGridDatasetCellCoord,
  type UseDataGridCellDatasetResolverOptions,
  type UseDataGridCellDatasetResolverResult,
} from "./composables/useDataGridCellDatasetResolver"
export {
  useDataGridCellRangeHelpers,
  type DataGridCellRangeCoord,
  type DataGridCellRange,
  type UseDataGridCellRangeHelpersOptions,
  type UseDataGridCellRangeHelpersResult,
} from "./composables/useDataGridCellRangeHelpers"
export {
  useDataGridNavigationPrimitives,
  type DataGridNavigationPrimitiveCoord,
  type DataGridNavigationPrimitiveRange,
  type DataGridNavigationPrimitiveColumn,
  type UseDataGridNavigationPrimitivesOptions,
  type UseDataGridNavigationPrimitivesResult,
} from "./composables/useDataGridNavigationPrimitives"
export {
  useDataGridMutationSnapshot,
  type DataGridMutationSnapshotCoord,
  type DataGridMutationSnapshotRange,
  type DataGridMutationAffectedRange,
  type DataGridMutationSnapshotState,
  type UseDataGridMutationSnapshotOptions,
  type UseDataGridMutationSnapshotResult,
} from "./composables/useDataGridMutationSnapshot"
export {
  useDataGridCellVisualStatePredicates,
  type DataGridCellVisualStateCoord,
  type DataGridCellVisualStateRange,
  type UseDataGridCellVisualStatePredicatesOptions,
  type UseDataGridCellVisualStatePredicatesResult,
} from "./composables/useDataGridCellVisualStatePredicates"
export {
  useDataGridRangeMutationEngine,
  type DataGridRangeMutationRange,
  type UseDataGridRangeMutationEngineOptions,
  type UseDataGridRangeMutationEngineResult,
} from "./composables/useDataGridRangeMutationEngine"
export {
  useDataGridA11yCellIds,
  type UseDataGridA11yCellIdsOptions,
  type UseDataGridA11yCellIdsResult,
} from "./composables/useDataGridA11yCellIds"
export {
  useDataGridColumnUiPolicy,
  type UseDataGridColumnUiPolicyOptions,
  type UseDataGridColumnUiPolicyResult,
} from "./composables/useDataGridColumnUiPolicy"
export {
  useDataGridMoveMutationPolicy,
  type UseDataGridMoveMutationPolicyOptions,
  type UseDataGridMoveMutationPolicyResult,
} from "./composables/useDataGridMoveMutationPolicy"
export {
  useDataGridEditableValuePolicy,
  type DataGridEditableValueStrategy,
  type UseDataGridEditableValuePolicyOptions,
  type UseDataGridEditableValuePolicyResult,
} from "./composables/useDataGridEditableValuePolicy"
export {
  useDataGridInlineEditorSchema,
  type UseDataGridInlineEditorSchemaOptions,
  type UseDataGridInlineEditorSchemaResult,
} from "./composables/useDataGridInlineEditorSchema"
export {
  useDataGridInlineEditOrchestration,
  type DataGridInlineEditorMode,
  type DataGridInlineEditorState,
  type DataGridInlineEditTarget,
  type UseDataGridInlineEditOrchestrationOptions,
  type UseDataGridInlineEditOrchestrationResult,
} from "./composables/useDataGridInlineEditOrchestration"
export {
  useDataGridInlineEditorTargetNavigation,
  type DataGridInlineEditorNavigationColumnLike,
  type DataGridInlineEditorNavigationCoord,
  type DataGridInlineEditorNavigationTarget,
  type UseDataGridInlineEditorTargetNavigationOptions,
  type UseDataGridInlineEditorTargetNavigationResult,
} from "./composables/useDataGridInlineEditorTargetNavigation"
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
  type DataGridHeaderResizeApplyMode,
  type DataGridHeaderResizeState,
  type UseDataGridHeaderResizeOrchestrationOptions,
  type UseDataGridHeaderResizeOrchestrationResult,
} from "./composables/useDataGridHeaderResizeOrchestration"
export {
  useDataGridHeaderInteractionRouter,
  type UseDataGridHeaderInteractionRouterOptions,
  type UseDataGridHeaderInteractionRouterResult,
} from "./composables/useDataGridHeaderInteractionRouter"
export {
  useDataGridColumnFilterOrchestration,
  type DataGridColumnFilterKind,
  type DataGridAppliedColumnFilter,
  type DataGridColumnFilterDraft,
  type DataGridFilterOperatorOption,
  type UseDataGridColumnFilterOrchestrationOptions,
  type UseDataGridColumnFilterOrchestrationResult,
} from "./composables/useDataGridColumnFilterOrchestration"
export {
  useDataGridEnumTrigger,
  type UseDataGridEnumTriggerOptions,
  type UseDataGridEnumTriggerResult,
} from "./composables/useDataGridEnumTrigger"
export {
  useDataGridGroupValueLabelResolver,
  type UseDataGridGroupValueLabelResolverOptions,
  type UseDataGridGroupValueLabelResolverResult,
} from "./composables/useDataGridGroupValueLabelResolver"
export {
  useDataGridGroupMetaOrchestration,
  type DataGridGroupMetaSnapshot,
  type UseDataGridGroupMetaOrchestrationOptions,
  type UseDataGridGroupMetaOrchestrationResult,
} from "./composables/useDataGridGroupMetaOrchestration"
export {
  useDataGridGroupBadge,
  type UseDataGridGroupBadgeOptions,
  type UseDataGridGroupBadgeResult,
} from "./composables/useDataGridGroupBadge"
export {
  useDataGridGroupingSortOrchestration,
  type UseDataGridGroupingSortOrchestrationOptions,
  type UseDataGridGroupingSortOrchestrationResult,
} from "./composables/useDataGridGroupingSortOrchestration"
export {
  type DataGridHeaderLayerViewportGeometryInput,
  type DataGridHeaderLayerViewportGeometry,
  resolveDataGridHeaderScrollSyncLeft,
  resolveDataGridHeaderLayerViewportGeometry,
} from "./composables/useDataGridHeaderLayerOrchestration"
export {
  useDataGridViewportMeasureScheduler,
  type DataGridViewportMeasuredState,
  type UseDataGridViewportMeasureSchedulerOptions,
  type UseDataGridViewportMeasureSchedulerResult,
} from "./composables/useDataGridViewportMeasureScheduler"
export {
  useDataGridVisibleRowsSyncScheduler,
  type DataGridVisibleRowsRange,
  type UseDataGridVisibleRowsSyncSchedulerOptions,
  type UseDataGridVisibleRowsSyncSchedulerResult,
} from "./composables/useDataGridVisibleRowsSyncScheduler"
export {
  useDataGridColumnLayoutOrchestration,
  type DataGridColumnLayoutColumn,
  type DataGridColumnLayoutMetric,
  type DataGridVisibleColumnsWindow,
  type DataGridColumnLayerKey,
  type DataGridColumnLayer,
  type UseDataGridColumnLayoutOrchestrationOptions,
  type UseDataGridColumnLayoutOrchestrationResult,
} from "./composables/useDataGridColumnLayoutOrchestration"
export {
  setsEqual,
} from "@affino/datagrid-orchestration"
export {
  useDataGridSelectionOverlayOrchestration,
  type DataGridOverlayRange,
  type DataGridOverlayColumnLike,
  type DataGridOverlayColumnMetricLike,
  type DataGridSelectionOverlaySegment,
  type UseDataGridSelectionOverlayOrchestrationOptions,
  type UseDataGridSelectionOverlayOrchestrationResult,
} from "./composables/useDataGridSelectionOverlayOrchestration"
export {
  useDataGridRowsProjection,
  type UseDataGridRowsProjectionOptions,
  type UseDataGridRowsProjectionResult,
} from "./composables/useDataGridRowsProjection"
export {
  useDataGridRowSelectionOrchestration,
  type UseDataGridRowSelectionOrchestrationOptions,
  type UseDataGridRowSelectionOrchestrationResult,
} from "./composables/useDataGridRowSelectionOrchestration"
export {
  useDataGridRowSelectionInputHandlers,
  type UseDataGridRowSelectionInputHandlersOptions,
  type UseDataGridRowSelectionInputHandlersResult,
} from "./composables/useDataGridRowSelectionInputHandlers"
export {
  useDataGridVirtualRangeMetrics,
  type DataGridVirtualRange,
  type UseDataGridVirtualRangeMetricsOptions,
  type UseDataGridVirtualRangeMetricsResult,
} from "./composables/useDataGridVirtualRangeMetrics"
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
  useDataGridClearSelectionLifecycle,
  type UseDataGridClearSelectionLifecycleOptions,
  type UseDataGridClearSelectionLifecycleResult,
} from "./composables/useDataGridClearSelectionLifecycle"
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
  useDataGridFillHandleStart,
  type DataGridFillHandleStartRange,
  type UseDataGridFillHandleStartOptions,
  type UseDataGridFillHandleStartResult,
} from "./composables/useDataGridFillHandleStart"
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
  useDataGridSelectionMoveHandle,
  type DataGridSelectionMoveHandleCoord,
  type DataGridSelectionMoveHandleRange,
  type DataGridSelectionMoveHandleSides,
  type UseDataGridSelectionMoveHandleOptions,
  type UseDataGridSelectionMoveHandleResult,
} from "./composables/useDataGridSelectionMoveHandle"
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
  useDataGridViewportScrollLifecycle,
  type UseDataGridViewportScrollLifecycleOptions,
  type UseDataGridViewportScrollLifecycleResult,
} from "./composables/useDataGridViewportScrollLifecycle"
export {
  type DataGridLinkedPaneSyncMode,
  type UseDataGridLinkedPaneScrollSyncOptions,
  type UseDataGridLinkedPaneScrollSyncResult,
  useDataGridLinkedPaneScrollSync,
} from "./composables/useDataGridLinkedPaneScrollSync"
export {
  type UseDataGridResizeClickGuardOptions,
  type UseDataGridResizeClickGuardResult,
  useDataGridResizeClickGuard,
} from "./composables/useDataGridResizeClickGuard"
export {
  type UseDataGridInitialViewportRecoveryOptions,
  type UseDataGridInitialViewportRecoveryResult,
  useDataGridInitialViewportRecovery,
} from "./composables/useDataGridInitialViewportRecovery"
export {
  type DataGridWheelMode,
  type DataGridWheelAxisLockMode,
  type DataGridWheelPropagationMode,
  type DataGridWheelAxisPolicy,
  type DataGridManagedWheelBodyViewport,
  type DataGridManagedWheelMainViewport,
  type UseDataGridManagedWheelScrollOptions,
  type UseDataGridManagedWheelScrollResult,
  normalizeDataGridWheelDelta,
  resolveDataGridWheelAxisPolicy,
  resolveDataGridWheelPropagationDecision,
  useDataGridManagedWheelScroll,
} from "./composables/useDataGridManagedWheelScroll"
export {
  type UseDataGridScrollIdleGateOptions,
  type UseDataGridScrollIdleGateResult,
  useDataGridScrollIdleGate,
} from "./composables/useDataGridScrollIdleGate"
export {
  type DataGridScrollPerfQuality,
  type DataGridScrollPerfSnapshot,
  type UseDataGridScrollPerfTelemetryOptions,
  type UseDataGridScrollPerfTelemetryResult,
  useDataGridScrollPerfTelemetry,
} from "./composables/useDataGridScrollPerfTelemetry"
export {
  type DataGridPointerPreviewApplyMode,
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
  type DataGridPointerVirtualWindowSnapshot,
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
  type DataGridCellVisibilityVirtualWindow,
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
  useDataGridQuickFilterActions,
  type UseDataGridQuickFilterActionsOptions,
  type UseDataGridQuickFilterActionsResult,
} from "./composables/useDataGridQuickFilterActions"
export {
  useDataGridCellCoordNormalizer,
  type DataGridCellCoordNormalizerCoord,
  type DataGridCellCoordNormalizerVirtualWindow,
  type UseDataGridCellCoordNormalizerOptions,
  type UseDataGridCellCoordNormalizerResult,
} from "./composables/useDataGridCellCoordNormalizer"
export {
  useDataGridSelectionComparators,
  type DataGridSelectionComparatorCoord,
  type DataGridSelectionComparatorRange,
  type UseDataGridSelectionComparatorsResult,
} from "./composables/useDataGridSelectionComparators"
export {
  type DataGridRowSelectionGesture,
  type UseDataGridRowSelectionModelOptions,
  type UseDataGridRowSelectionModelResult,
  useDataGridRowSelectionModel,
} from "./composables/useDataGridRowSelectionModel"
export {
  useDataGridPointerModifierPolicy,
  type UseDataGridPointerModifierPolicyResult,
} from "./composables/useDataGridPointerModifierPolicy"
export {
  useDataGridHistoryActionRunner,
  type UseDataGridHistoryActionRunnerOptions,
  type UseDataGridHistoryActionRunnerResult,
} from "./composables/useDataGridHistoryActionRunner"
export {
  useDataGridInlineEditorFocus,
  type UseDataGridInlineEditorFocusOptions,
  type UseDataGridInlineEditorFocusResult,
} from "./composables/useDataGridInlineEditorFocus"
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
