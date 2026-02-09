# @affino/datagrid-vue

Vue adapter surface for `@affino/datagrid-core`.

## Stable API (`@affino/datagrid-vue`)

- `createDataGridVueRuntime`
- `useDataGridRuntime`
- `useAffinoDataGrid`
- `useAffinoDataGridUi`
- `AffinoDataGridSimple`
- `DataGrid`
- `useDataGridSettingsStore`
- `createDataGridSettingsAdapter`
- `buildDataGridOverlayTransform`
- `buildDataGridOverlayTransformFromSnapshot`
- `mapDataGridA11yGridAttributes`
- `mapDataGridA11yCellAttributes`
- `useDataGridContextMenu`

## Advanced API (`@affino/datagrid-vue/advanced`)

Compatibility entrypoint. New demo/workbench wiring should import `@affino/datagrid-vue/internal`.

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

## 60-second integration (junior-friendly)

```ts
import { ref } from "vue"
import { AffinoDataGridSimple } from "@affino/datagrid-vue/components"

const rows = ref([
  { rowId: "1", service: "edge-gateway", owner: "NOC" },
  { rowId: "2", service: "billing-api", owner: "Payments" },
])

const columns = [
  { key: "service", label: "Service", width: 220 },
  { key: "owner", label: "Owner", width: 180 },
]
```

```vue
<AffinoDataGridSimple
  v-model:rows="rows"
  :columns="columns"
  :features="{ selection: true, clipboard: true, editing: true }"
/>
```

- Includes pre-wired sort, row-selection, context-menu, clipboard and inline edit.
- Emits `update:rows`, `update:status`, and `action` for app-level integration.

## High-level sugar API

```ts
import { ref } from "vue"
import { useAffinoDataGrid } from "@affino/datagrid-vue"

const rows = ref([
  { rowId: "1", service: "edge-gateway", owner: "NOC" },
  { rowId: "2", service: "billing-api", owner: "Payments" },
])

const columns = ref([
  { key: "service", label: "Service", width: 220 },
  { key: "owner", label: "Owner", width: 180 },
])

const grid = useAffinoDataGrid({
  rows,
  columns,
  features: {
    selection: true,
    clipboard: true,
    editing: {
      mode: "cell",
      enum: true,
    },
    filtering: {
      enabled: true,
      initialFilterModel: {
        columnFilters: {},
        advancedFilters: {},
      },
    },
    summary: {
      enabled: true,
      columns: [
        { key: "owner", aggregations: ["countDistinct"] },
      ],
    },
    visibility: {
      enabled: true,
      hiddenColumnKeys: [],
    },
    tree: {
      enabled: true,
      initialGroupBy: {
        fields: ["owner"],
        expandedByDefault: true,
      },
    },
  },
})

type Grid = ReturnType<typeof useAffinoDataGrid>
// grid is fully typed and safe to destructure.
```

```vue
<th v-for="column in columns" :key="column.key" v-bind="grid.bindings.headerCell(column.key)">
  {{ column.label }}
</th>

<td
  v-for="column in columns"
  :key="column.key"
  v-bind="grid.bindings.dataCell({ row, rowIndex, columnKey: column.key, value: row[column.key] })"
>
  <input
    v-if="grid.bindings.isCellEditing(String(row.rowId), column.key)"
    v-bind="grid.bindings.inlineEditor({ rowKey: String(row.rowId), columnKey: column.key })"
  />
  <span v-else>{{ row[column.key] }}</span>
</td>
```

- `grid.componentProps` can be passed into `<DataGrid v-bind="grid.componentProps" />`.
- `grid.bindings` provides ready wiring helpers:
  - `grid.bindings.headerSort(column.key)` for sortable header handlers/ARIA.
  - `grid.bindings.rowSelection(row, rowIndex)` for row selection click/keyboard behavior.
  - `grid.bindings.editableCell({ row, rowIndex, columnKey })` + `grid.bindings.inlineEditor(...)` for inline edit flows.
  - `grid.bindings.headerCell(column.key)` and `grid.bindings.dataCell(...)` for pre-wired sort/edit + context-menu behavior.
  - `grid.bindings.contextMenuRoot()` + `grid.bindings.contextMenuAction(action.id)` for menu keyboard/click wiring.
  - `grid.bindings.actionButton("copy" | "cut" | "paste" | ...)` for toolbar-level actions.
- `grid.actions` provides no-router commands for common flows:
  - `runAction("copy" | "cut" | "paste" | "clear" | "sort-asc" | "sort-desc" | "sort-clear")`
  - `copySelectedRows()`, `cutSelectedRows()`, `pasteRowsAppend()`, `selectAllRows()`
- `grid.contextMenu` wraps menu state + keyboard support + action execution:
  - `open(x, y, { zone, columnKey?, rowId? })`
  - `runAction(actionId)` (maps directly into `grid.actions`)
- `grid.features.filtering` exposes `model`, `setModel`, `setAdvancedExpression`, and `clear`.
- `grid.features.summary.selected` returns deterministic aggregates for current selection scope.
- `grid.features.visibility` exposes `setColumnVisible`, `toggleColumnVisible`, `setHiddenColumnKeys`, `reset`.
- `grid.features.tree` exposes `groupBy`, `groupExpansion`, `setGroupBy`, `toggleGroup`, `expandAll`, `collapseAll`.

## Complete integration playbook

For end-to-end integration (tree rendering contract, advanced-filter AST cookbook, interaction/hotkey contract, and full-page setup), use:

- `/Users/anton/Projects/affinio/docs/datagrid-vue-sugar-playbook.md`
- `/Users/anton/Projects/affinio/docs/datagrid-sheets-user-interactions-and-integrator-api.md`

## Junior-first UI wrapper

```ts
import { ref } from "vue"
import { useAffinoDataGridUi } from "@affino/datagrid-vue"

const status = ref("Ready")
const grid = useAffinoDataGridUi({
  rows,
  columns,
  status,
  features: {
    selection: true,
    clipboard: true,
    editing: true,
  },
})
```

```vue
<button v-bind="grid.ui.bindToolbarAction('copy')">Copy</button>
<th v-bind="grid.ui.bindHeaderCell(column.key)">{{ column.label }}</th>
<td v-bind="grid.ui.bindDataCell({ row, rowIndex, columnKey: column.key, value: row[column.key] })">
  <input
    v-if="grid.ui.isCellEditing(String(row.rowId), column.key)"
    v-bind="grid.ui.bindInlineEditor({ rowKey: String(row.rowId), columnKey: column.key })"
  />
</td>
```
- Demo-level orchestration can be imported from `@affino/datagrid-vue/internal`.
