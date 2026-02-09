# @affino/datagrid-vue

Vue adapter surface for `@affino/datagrid-core`.

## Stable API (`@affino/datagrid-vue`)

- `createDataGridVueRuntime`
- `useDataGridRuntime`
- `useDataGridSettingsStore`
- `createDataGridSettingsAdapter`
- `buildDataGridOverlayTransform`
- `buildDataGridOverlayTransformFromSnapshot`
- `mapDataGridA11yGridAttributes`
- `mapDataGridA11yCellAttributes`
- `useDataGridContextMenu`

## Advanced API (`@affino/datagrid-vue/advanced`)

- `useDataGridViewportBridge`
- `useDataGridHeaderOrchestration`
- `createDataGridHeaderBindings`
- `useDataGridCellPointerDownRouter`
- `useDataGridCellPointerHoverRouter`
- `useDataGridDragSelectionLifecycle`
- `useDataGridDragPointerSelection`
- `useDataGridFillSelectionLifecycle`
- `useDataGridFillHandleStart`
- `useDataGridRangeMoveLifecycle`
- `useDataGridRangeMoveStart`
- `useDataGridSelectionMoveHandle`
- `useDataGridTabTargetResolver`
- `useDataGridCellNavigation`
- `useDataGridClipboardValuePolicy`
- `useDataGridCellDatasetResolver`
- `useDataGridCellRangeHelpers`
- `useDataGridNavigationPrimitives`
- `useDataGridMutationSnapshot`
- `useDataGridCellVisualStatePredicates`
- `useDataGridRangeMutationEngine`
- `useDataGridA11yCellIds`
- `useDataGridColumnUiPolicy`
- `useDataGridEditableValuePolicy`
- `useDataGridMoveMutationPolicy`
- `useDataGridInlineEditorSchema`
- `useDataGridInlineEditOrchestration`
- `useDataGridInlineEditorTargetNavigation`
- `useDataGridInlineEditorKeyRouter`
- `useDataGridHeaderContextActions`
- `useDataGridCopyRangeHelpers`
- `useDataGridHeaderSortOrchestration`
- `useDataGridHeaderResizeOrchestration`
- `useDataGridHeaderInteractionRouter`
- `useDataGridColumnFilterOrchestration`
- `useDataGridEnumTrigger`
- `useDataGridGroupValueLabelResolver`
- `useDataGridGroupMetaOrchestration`
- `useDataGridGroupBadge`
- `useDataGridGroupingSortOrchestration`
- `useDataGridViewportMeasureScheduler`
- `useDataGridVisibleRowsSyncScheduler`
- `useDataGridColumnLayoutOrchestration`
- `useDataGridSelectionOverlayOrchestration`
- `useDataGridRowsProjection`
- `useDataGridRowSelectionOrchestration`
- `useDataGridRowSelectionInputHandlers`
- `useDataGridVirtualRangeMetrics`
- `useDataGridContextMenuAnchor`
- `useDataGridContextMenuActionRouter`
- `useDataGridViewportContextMenuRouter`
- `useDataGridViewportBlurHandler`
- `useDataGridViewportScrollLifecycle`
- `useDataGridClearSelectionLifecycle`
- `useDataGridGlobalPointerLifecycle`
- `useDataGridPointerAutoScroll`
- `useDataGridPointerPreviewRouter`
- `useDataGridPointerCellCoordResolver`
- `useDataGridAxisAutoScrollDelta`
- `useDataGridCellVisibilityScroller`
- `useDataGridGlobalMouseDownContextMenuCloser`
- `useDataGridKeyboardCommandRouter`
- `useDataGridQuickFilterActions`
- `useDataGridCellCoordNormalizer`
- `useDataGridSelectionComparators`
- `useDataGridPointerModifierPolicy`
- `useDataGridHistoryActionRunner`
- `useDataGridInlineEditorFocus`
- `useDataGridRowSelectionFacade`
- `useDataGridFindReplaceFacade`
- `useDataGridClipboardBridge`
- `useDataGridClipboardMutations`
- `useDataGridIntentHistory`

## Quick start

```ts
import { ref } from "vue"
import { useDataGridRuntime } from "@affino/datagrid-vue"

const rows = ref([])
const columns = ref([
  { key: "service", label: "Service", width: 220 },
])

const { api, columnSnapshot } = useDataGridRuntime({
  rows,
  columns,
})
```
