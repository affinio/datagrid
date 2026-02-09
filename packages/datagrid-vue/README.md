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
- `useDataGridRangeMoveLifecycle`
- `useDataGridRangeMoveStart`
- `useDataGridTabTargetResolver`
- `useDataGridCellNavigation`
- `useDataGridInlineEditorKeyRouter`
- `useDataGridHeaderContextActions`
- `useDataGridHeaderSortOrchestration`
- `useDataGridHeaderResizeOrchestration`
- `useDataGridContextMenuAnchor`
- `useDataGridContextMenuActionRouter`
- `useDataGridViewportContextMenuRouter`
- `useDataGridViewportBlurHandler`
- `useDataGridGlobalPointerLifecycle`
- `useDataGridPointerAutoScroll`
- `useDataGridPointerPreviewRouter`
- `useDataGridPointerCellCoordResolver`
- `useDataGridAxisAutoScrollDelta`
- `useDataGridCellVisibilityScroller`
- `useDataGridGlobalMouseDownContextMenuCloser`
- `useDataGridKeyboardCommandRouter`
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
