<template>
  <article
    ref="cardRootRef"
    class="card affino-datagrid-app-root"
  >
    <header class="card__header">
      <h2>{{ title }}</h2>
      <div class="controls">
        <label>
          Rows
          <select v-model.number="rowCount">
            <option v-for="option in ROW_MODE_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>
          Cols
          <select v-model.number="columnCount">
            <option v-for="option in COLUMN_MODE_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>
          Group by
          <select v-model="groupByField">
            <option value="">None</option>
            <option v-for="column in visibleColumns" :key="`group-by-${column.key}`" :value="column.key">
              {{ column.column.label ?? column.key }}
            </option>
          </select>
        </label>
        <label>
          Render
          <select v-model="rowRenderMode">
            <option value="virtualization">Virtualization</option>
            <option value="pagination">Pagination</option>
          </select>
        </label>
        <label v-if="rowRenderMode === 'pagination'">
          Page size
          <select v-model.number="paginationPageSize">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select>
        </label>
        <label v-if="rowRenderMode === 'pagination'">
          Page
          <input
            v-model.number="paginationPage"
            type="number"
            min="1"
            step="1"
          />
        </label>
        <label>
          Row mode
          <select v-model="rowHeightMode">
            <option value="fixed">Fixed</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label>
          Row size
          <input
            v-model.number="baseRowHeight"
            type="number"
            min="24"
            max="120"
            step="1"
          />
        </label>
      </div>
      <ColumnLayoutPanel
        :is-open="isColumnLayoutPanelOpen"
        :items="columnLayoutPanelItems"
        @open="openColumnLayoutPanel"
        @toggle-visibility="updateColumnVisibility"
        @move-up="moveColumnUp"
        @move-down="moveColumnDown"
        @apply="applyColumnLayoutPanel"
        @cancel="cancelColumnLayoutPanel"
      />
      <DiagnosticsPanel
        :is-open="isDiagnosticsPanelOpen"
        :snapshot="diagnosticsSnapshot"
        @open="openDiagnosticsPanel"
        @refresh="refreshDiagnosticsPanel"
        @close="closeDiagnosticsPanel"
      />
      <StatePanel
        :is-open="isStatePanelOpen"
        :import-text="stateImportText"
        :output-text="stateOutputText"
        @open="openStatePanel"
        @close="closeStatePanel"
        @export-state="exportStatePayload"
        @migrate-state="migrateStatePayload"
        @apply-state="applyStatePayload"
        @update-import="stateImportText = $event"
      />
      <ComputePolicyPanel
        :is-open="isComputePolicyPanelOpen"
        :projection-mode="projectionMode"
        :compute-mode="computeMode"
        :compute-supported="computeSupported"
        :diagnostics-output="computeDiagnosticsOutput"
        @open="openComputePolicyPanel"
        @close="closeComputePolicyPanel"
        @update-projection-mode="projectionMode = $event"
        @update-compute-mode="computeMode = $event"
        @apply-projection="applyProjectionMode"
        @apply-compute="applyComputeMode"
        @refresh-diagnostics="refreshComputeDiagnostics"
      />
      <RefreshCellsPanel
        :is-open="isRefreshCellsPanelOpen"
        :row-keys="refreshRowKeysInput"
        :column-keys="refreshColumnKeysInput"
        @open="openRefreshCellsPanel"
        @close="closeRefreshCellsPanel"
        @refresh="refreshCellsByRowKeys"
        @update-row-keys="refreshRowKeysInput = $event"
        @update-column-keys="refreshColumnKeysInput = $event"
      />
      <AdvancedFilterPanel
        :is-open="isAdvancedFilterPanelOpen"
        :clauses="advancedFilterDraftClauses"
        :columns="advancedFilterColumns"
        @open="openAdvancedFilterPanel"
        @add="addAdvancedFilterClause"
        @remove="removeAdvancedFilterClause"
        @update-clause="updateAdvancedFilterClause"
        @apply="applyAdvancedFilterPanel"
        @cancel="cancelAdvancedFilterPanel"
      />
      <div class="meta">
        <span>Rows in model: {{ totalRows }}</span>
        <span>Columns: {{ visibleColumns.length }}</span>
        <span>Viewport rows: {{ viewportRange.start }}..{{ viewportRange.end }}</span>
      </div>
    </header>

    <section class="grid-stage" :class="{ 'grid-stage--auto-row-height': rowHeightMode === 'auto' }">
      <div
        ref="headerViewportRef"
        class="grid-header-viewport"
        @scroll="handleHeaderScroll"
        @wheel="handleHeaderWheel"
      >
        <div class="grid-header-row" :style="gridContentStyle">
          <div class="grid-cell grid-cell--header grid-cell--index" :style="indexColumnStyle">#</div>
          <div class="grid-main-track" :style="mainTrackStyle">
            <div
              v-for="column in visibleColumns"
              :key="`header-${column.key}`"
              class="grid-cell grid-cell--header grid-cell--header-sortable"
              :style="columnStyle(column.key)"
              @click="toggleSortForColumn(column.key)"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
              <div class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :value="columnFilterTextByKey[column.key] ?? ''"
                  placeholder="Filter..."
                  @mousedown.stop
                  @keydown.stop
                  @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref="bodyViewportRef" class="grid-body-viewport table-wrap" @scroll="handleViewportScroll">
        <div class="grid-body-content" :style="gridContentStyle">
          <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
          <div
            v-for="(row, rowOffset) in displayRows"
            :key="String(row.rowId)"
            class="grid-row"
            :class="{ 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }"
            :style="rowStyle(row, rowOffset)"
          >
            <div class="grid-cell grid-cell--index" :style="indexColumnStyle">
              {{ rowIndexLabel(row, rowOffset) }}
              <button
                type="button"
                class="row-resize-handle"
                aria-label="Resize rows"
                @mousedown.stop.prevent="startRowResize($event, row, rowOffset)"
                @dblclick.stop.prevent="autosizeRow($event, row, rowOffset)"
              />
            </div>
            <div class="grid-main-track" :style="mainTrackStyle">
              <div
                v-for="(column, columnIndex) in visibleColumns"
                :key="`${String(row.rowId)}-${column.key}`"
                class="grid-cell"
                :class="{
                  'grid-cell--selected': shouldHighlightSelectedCell(rowOffset, columnIndex),
                  'grid-cell--selection-anchor': isSelectionAnchorCell(rowOffset, columnIndex),
                  'grid-cell--selection-frame': isCellSelected(rowOffset, columnIndex),
                  'grid-cell--selection-top': isCellOnSelectionEdge(rowOffset, columnIndex, 'top'),
                  'grid-cell--selection-right': isCellOnSelectionEdge(rowOffset, columnIndex, 'right'),
                  'grid-cell--selection-bottom': isCellOnSelectionEdge(rowOffset, columnIndex, 'bottom'),
                  'grid-cell--selection-left': isCellOnSelectionEdge(rowOffset, columnIndex, 'left'),
                  'grid-cell--fill-preview': isCellInFillPreview(rowOffset, columnIndex),
                  'grid-cell--clipboard-pending': isCellInPendingClipboardRange(rowOffset, columnIndex),
                  'grid-cell--clipboard-pending-top': isCellOnPendingClipboardEdge(rowOffset, columnIndex, 'top'),
                  'grid-cell--clipboard-pending-right': isCellOnPendingClipboardEdge(rowOffset, columnIndex, 'right'),
                  'grid-cell--clipboard-pending-bottom': isCellOnPendingClipboardEdge(rowOffset, columnIndex, 'bottom'),
                  'grid-cell--clipboard-pending-left': isCellOnPendingClipboardEdge(rowOffset, columnIndex, 'left'),
                  'grid-cell--editing': isEditingCell(row, column.key),
                }"
                :style="columnStyle(column.key)"
                :data-row-index="viewportRange.start + rowOffset"
                :data-column-index="columnIndex"
                tabindex="0"
                @mousedown.prevent="handleCellMouseDown($event, row, rowOffset, columnIndex)"
                @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndex)"
                @dblclick.stop="startInlineEdit(row, column.key)"
              >
                <button
                  v-if="isFillHandleCell(rowOffset, columnIndex) && !isEditingCell(row, column.key)"
                  type="button"
                  class="cell-fill-handle"
                  aria-label="Fill handle"
                  @mousedown.stop.prevent="startFillHandleDrag($event)"
                />
                <input
                  v-if="isEditingCell(row, column.key)"
                  class="cell-editor-input"
                  :value="editingCellValue"
                  @mousedown.stop
                  @click.stop
                  @input="editingCellValue = ($event.target as HTMLInputElement).value"
                  @keydown.stop="handleEditorKeydown"
                  @blur="commitInlineEdit"
                />
                <template v-else>{{ readCell(row, column.key) }}</template>
              </div>
            </div>
          </div>
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
        </div>
      </div>
    </section>

    <footer class="card__footer">
      Rendered {{ displayRows.length }} / {{ totalRows }} rows.
      <span v-if="selectionAggregatesLabel"> {{ selectionAggregatesLabel }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import {
  createClientRowModel,
  createDataGridApi,
  createDataGridColumnModel,
  createDataGridCore,
  type DataGridColumnSnapshot,
  type DataGridCoreSelectionService,
  type DataGridFilterSnapshot,
  type DataGridGroupBySpec,
  type DataGridRowNode,
  type DataGridSelectionSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "@affino/datagrid-core"
import {
  useDataGridAppAdvancedFilterBuilder,
  useDataGridAppColumnLayoutPanel,
  useDataGridAppDiagnosticsPanel,
  type DataGridAppAdvancedFilterColumnOption,
} from "@affino/datagrid-vue"
import { createGridSelectionRange, type GridSelectionContext, type GridSelectionPointLike } from "@affino/datagrid-core/advanced"
import {
  resolveDataGridHeaderScrollSyncLeft,
  useDataGridAxisAutoScrollDelta,
  useDataGridClipboardBridge,
  useDataGridCellPointerDownRouter,
  useDataGridCellNavigation,
  useDataGridCopyRangeHelpers,
  useDataGridDragPointerSelection,
  useDataGridFillHandleStart,
  useDataGridFillSelectionLifecycle,
  useDataGridHeaderResizeOrchestration,
  useDataGridHistoryActionRunner,
  useDataGridIntentHistory,
  useDataGridKeyboardCommandRouter,
  useDataGridRangeMoveLifecycle,
  useDataGridRangeMoveStart,
  useDataGridRangeMutationEngine,
  useDataGridPointerPreviewRouter,
  useDataGridPointerAutoScroll,
  type DataGridCopyRange,
} from "@affino/datagrid-orchestration"
import {
  buildCoreColumns,
  buildCoreRows,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
  toRowInputs,
  type CoreBaseRow,
} from "../sandboxData"
import AdvancedFilterPanel from "./AdvancedFilterPanel.vue"
import ColumnLayoutPanel from "./ColumnLayoutPanel.vue"
import DiagnosticsPanel from "./DiagnosticsPanel.vue"
import RefreshCellsPanel from "./RefreshCellsPanel.vue"
import StatePanel from "./StatePanel.vue"
import ComputePolicyPanel from "./ComputePolicyPanel.vue"

defineProps<{
  title: string
}>()

const cardRootRef = ref<HTMLElement | null>(null)
const sandboxThemeTokens = resolveGridThemeTokens(industrialNeutralTheme)

watchEffect(() => {
  if (!cardRootRef.value) {
    return
  }
  applyGridTheme(cardRootRef.value, sandboxThemeTokens)
})

type RowHeightMode = "fixed" | "auto"
type RowRenderMode = "virtualization" | "pagination"
const rowCount = ref<number>(10000)
const columnCount = ref<number>(16)
const columnFilterTextByKey = ref<Record<string, string>>({})
const groupByField = ref("")
const sortState = ref<{ key: string; direction: "asc" | "desc" } | null>(null)
const rowRenderMode = ref<RowRenderMode>("virtualization")
const paginationPageSize = ref<number>(200)
const paginationPage = ref<number>(1)
const isRefreshCellsPanelOpen = ref(false)
const refreshRowKeysInput = ref("")
const refreshColumnKeysInput = ref("")
const isStatePanelOpen = ref(false)
const stateImportText = ref("")
const stateOutputText = ref("")
const isComputePolicyPanelOpen = ref(false)
const projectionMode = ref<"mutable" | "immutable" | "excel-like">("immutable")
const computeMode = ref<"sync" | "worker">("sync")
const computeDiagnosticsOutput = ref("")
const columnWidths = ref<Record<string, number>>({})
const rowHeightMode = ref<RowHeightMode>("fixed")
const baseRowHeight = ref<number>(31)
const headerViewportRef = ref<HTMLElement | null>(null)
const bodyViewportRef = ref<HTMLElement | null>(null)
const viewportRange = ref<DataGridViewportRange>({ start: 0, end: 0 })

const MIN_COLUMN_WIDTH = 80
const DEFAULT_COLUMN_WIDTH = 140
const INDEX_COLUMN_WIDTH = 72
const MIN_ROW_HEIGHT = 24
const ROW_OVERSCAN = 8
const AUTO_RESIZE_SAMPLE_LIMIT = 400
let lastViewportScrollTop = 0

const rows = computed(() => buildCoreRows(rowCount.value, columnCount.value))
const columns = computed(() => buildCoreColumns(columnCount.value))
const {
  isAdvancedFilterPanelOpen,
  advancedFilterDraftClauses,
  advancedFilterColumns,
  appliedAdvancedFilterExpression,
  openAdvancedFilterPanel,
  addAdvancedFilterClause,
  removeAdvancedFilterClause,
  updateAdvancedFilterClause,
  cancelAdvancedFilterPanel,
  applyAdvancedFilterPanel,
} = useDataGridAppAdvancedFilterBuilder({
  resolveColumns: (): readonly DataGridAppAdvancedFilterColumnOption[] => visibleColumns.value.map(column => ({
    key: column.key,
    label: column.column.label ?? column.key,
  })),
})
const selectionSnapshot = ref<DataGridSelectionSnapshot | null>(null)
const selectionAnchor = ref<GridSelectionPointLike<string | number> | null>(null)
const editingCell = ref<{ rowId: string | number; columnKey: string } | null>(null)
const editingCellValue = ref("")
const rowHeightRenderRevision = ref(0)
const measuringRowKey = ref<string | null>(null)
const rowResizeState = ref<{ rowKey: string; startY: number; startBase: number } | null>(null)
const isPointerSelectingCells = ref(false)
const dragPointer = ref<{ clientX: number; clientY: number } | null>(null)
const lastDragCoord = ref<SandboxCellCoord | null>(null)

interface SandboxCellCoord {
  rowIndex: number
  columnIndex: number
  rowId: string | number | null
}

interface GridRowsSnapshot<TRow> {
  rows: Array<{ rowId: string | number; row: TRow }>
}

const cloneRowData = <TRow,>(row: TRow): TRow => {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(row)
  }
  if (row && typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as TRow
  }
  return row
}

const selectionService: DataGridCoreSelectionService = {
  name: "selection",
  getSelectionSnapshot: () => selectionSnapshot.value,
  setSelectionSnapshot: snapshot => {
    selectionSnapshot.value = snapshot
  },
  clearSelection: () => {
    selectionSnapshot.value = null
  },
}

const rowModel = createClientRowModel<CoreBaseRow>({ rows: toRowInputs(rows.value) })
const columnModel = createDataGridColumnModel({ columns: columns.value })
const core = createDataGridCore({
  services: {
    rowModel: { name: "rowModel", model: rowModel },
    columnModel: { name: "columnModel", model: columnModel },
    selection: selectionService,
  },
})
const api = createDataGridApi<CoreBaseRow>({ core })

const captureRowsSnapshot = (): GridRowsSnapshot<CoreBaseRow> => {
  const count = api.rows.getCount()
  const snapshotRows: Array<{ rowId: string | number; row: CoreBaseRow }> = []
  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    const node = api.rows.get(rowIndex)
    if (!node || node.rowId == null || node.kind === "group") {
      continue
    }
    snapshotRows.push({
      rowId: node.rowId,
      row: cloneRowData(node.data as CoreBaseRow),
    })
  }
  return { rows: snapshotRows }
}

const intentHistory = useDataGridIntentHistory<GridRowsSnapshot<CoreBaseRow>>({
  captureSnapshot: captureRowsSnapshot,
  applySnapshot: snapshot => {
    api.rows.setData(snapshot.rows.map((entry, index) => ({
      rowId: entry.rowId,
      originalIndex: index,
      row: cloneRowData(entry.row),
    })))
    syncViewportFromDom()
  },
})

const rowVersion = ref(0)
const columnVersion = ref(0)
const displayRows = ref<readonly DataGridRowNode<CoreBaseRow>[]>([])

const unsubscribeRows = rowModel.subscribe(() => {
  rowVersion.value += 1
})
const unsubscribeColumns = columnModel.subscribe(() => {
  columnVersion.value += 1
})

const syncRangeRows = (range: DataGridViewportRange): void => {
  viewportRange.value = range
  api.view.setViewportRange(range)
  displayRows.value = api.rows.getRange(range)
}

const resolveViewportRangeFromElement = (element: HTMLElement): DataGridViewportRange => {
  const total = api.rows.getCount()
  if (total <= 0) {
    return { start: 0, end: 0 }
  }
  if (rowRenderMode.value === "pagination") {
    return { start: 0, end: total - 1 }
  }
  const estimatedRowHeight = normalizedBaseRowHeight.value
  const start = Math.max(0, Math.floor(element.scrollTop / estimatedRowHeight) - ROW_OVERSCAN)
  const visibleCount = Math.ceil(Math.max(1, element.clientHeight) / estimatedRowHeight) + ROW_OVERSCAN * 2
  const end = Math.min(total - 1, start + visibleCount - 1)
  return { start, end }
}

const syncHeaderScrollLeftFromBody = (bodyScrollLeft: number): void => {
  const headerViewport = headerViewportRef.value
  if (!headerViewport) {
    return
  }
  const nextHeaderScrollLeft = resolveDataGridHeaderScrollSyncLeft(headerViewport.scrollLeft, bodyScrollLeft)
  if (headerViewport.scrollLeft !== nextHeaderScrollLeft) {
    headerViewport.scrollLeft = nextHeaderScrollLeft
  }
}

const syncViewportFromDom = (): void => {
  const element = bodyViewportRef.value
  if (!element) {
    return
  }
  lastViewportScrollTop = element.scrollTop
  syncHeaderScrollLeftFromBody(element.scrollLeft)
  syncRangeRows(resolveViewportRangeFromElement(element))
  measureVisibleRowHeights()
}

const handleViewportScroll = (event: Event): void => {
  const element = event.target as HTMLElement
  syncHeaderScrollLeftFromBody(element.scrollLeft)
  if (element.scrollTop === lastViewportScrollTop) {
    return
  }
  lastViewportScrollTop = element.scrollTop
  syncRangeRows(resolveViewportRangeFromElement(element))
}

const handleHeaderScroll = (event: Event): void => {
  const headerViewport = event.target as HTMLElement | null
  const bodyViewport = bodyViewportRef.value
  if (!headerViewport || !bodyViewport) {
    return
  }
  if (bodyViewport.scrollLeft !== headerViewport.scrollLeft) {
    bodyViewport.scrollLeft = headerViewport.scrollLeft
  }
  syncViewportFromDom()
}

const handleHeaderWheel = (event: WheelEvent): void => {
  const bodyViewport = bodyViewportRef.value
  if (!bodyViewport) {
    return
  }
  const horizontalDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : (event.shiftKey ? event.deltaY : 0)
  const verticalDelta = horizontalDelta === 0 ? event.deltaY : 0
  if (horizontalDelta === 0 && verticalDelta === 0) {
    return
  }
  event.preventDefault()
  if (horizontalDelta !== 0) {
    bodyViewport.scrollLeft += horizontalDelta
  }
  if (verticalDelta !== 0) {
    bodyViewport.scrollTop += verticalDelta
  }
  syncViewportFromDom()
}

watch(rows, nextRows => {
  api.rows.setData(toRowInputs(nextRows))
  void nextTick(() => {
    syncViewportFromDom()
  })
}, { immediate: true })

watch(columns, nextColumns => {
  columnModel.setColumns(nextColumns)
  void nextTick(() => {
    syncViewportFromDom()
  })
}, { immediate: true })

watch([() => sortState.value?.key ?? "", () => sortState.value?.direction ?? "", columnFilterTextByKey, appliedAdvancedFilterExpression], () => {
  const sortModel: readonly DataGridSortState[] = sortState.value
    ? [{ key: sortState.value.key, direction: sortState.value.direction }]
    : []

  const nextColumnFilters: DataGridFilterSnapshot["columnFilters"] = {}
  for (const [columnKey, rawValue] of Object.entries(columnFilterTextByKey.value)) {
    const value = rawValue.trim()
    if (!value) {
      continue
    }
    nextColumnFilters[columnKey] = {
      kind: "predicate",
      operator: "contains",
      value,
      caseSensitive: false,
    }
  }

  const advancedExpression = appliedAdvancedFilterExpression.value
  const hasColumnFilters = Object.keys(nextColumnFilters).length > 0
  const nextFilter: DataGridFilterSnapshot | null = hasColumnFilters || advancedExpression
    ? {
        columnFilters: nextColumnFilters,
        advancedFilters: {},
        advancedExpression,
      }
    : null

  api.rows.setSortAndFilterModel({
    sortModel,
    filterModel: nextFilter,
  })

  void nextTick(() => {
    syncViewportFromDom()
  })
}, { immediate: true, deep: true })

const buildGroupBySpec = (field: string): DataGridGroupBySpec | null => {
  const trimmed = field.trim()
  if (!trimmed) {
    return null
  }
  return {
    fields: [trimmed],
    expandedByDefault: true,
  }
}

watch(groupByField, nextField => {
  api.rows.setGroupBy(buildGroupBySpec(nextField))
  void nextTick(() => {
    syncViewportFromDom()
  })
}, { immediate: true })

watch([rowRenderMode, paginationPageSize, paginationPage], () => {
  if (rowRenderMode.value === "pagination") {
    const nextPageSize = Math.max(1, Math.trunc(paginationPageSize.value || 1))
    const nextPage = Math.max(1, Math.trunc(paginationPage.value || 1))
    paginationPageSize.value = nextPageSize
    paginationPage.value = nextPage
    api.rows.setPagination({
      pageSize: nextPageSize,
      currentPage: nextPage - 1,
    })
  } else {
    api.rows.setPagination(null)
  }
  void nextTick(() => {
    syncViewportFromDom()
  })
}, { immediate: true })

const splitCsvTokens = (value: string): string[] => {
  return value
    .split(",")
    .map(token => token.trim())
    .filter(token => token.length > 0)
}

const openRefreshCellsPanel = (): void => {
  isRefreshCellsPanelOpen.value = true
}

const closeRefreshCellsPanel = (): void => {
  isRefreshCellsPanelOpen.value = false
}

const refreshCellsByRowKeys = (): void => {
  const rowKeys = splitCsvTokens(refreshRowKeysInput.value)
  if (!rowKeys.length) {
    return
  }
  const defaultColumnKeys = visibleColumns.value.slice(0, 1).map(column => column.key)
  const columnKeys = splitCsvTokens(refreshColumnKeysInput.value)
  const keysToRefresh = columnKeys.length ? columnKeys : defaultColumnKeys
  if (!keysToRefresh.length) {
    return
  }
  api.view.refreshCellsByRowKeys(rowKeys, keysToRefresh)
}

const openStatePanel = (): void => {
  isStatePanelOpen.value = true
  exportStatePayload()
}

const closeStatePanel = (): void => {
  isStatePanelOpen.value = false
}

const exportStatePayload = (): void => {
  stateOutputText.value = JSON.stringify(api.state.get(), null, 2)
}

const migrateStatePayload = (): void => {
  const raw = stateImportText.value.trim()
  if (!raw) {
    return
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    const migrated = api.state.migrate(parsed, { strict: false })
    stateOutputText.value = migrated
      ? JSON.stringify(migrated, null, 2)
      : "State migration failed"
  } catch {
    stateOutputText.value = "Invalid state JSON"
  }
}

const applyStatePayload = (): void => {
  const raw = stateImportText.value.trim()
  if (!raw) {
    return
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    const migrated = api.state.migrate(parsed, { strict: false })
    if (!migrated) {
      stateOutputText.value = "State migration failed"
      return
    }
    api.state.set(migrated, {
      applyColumns: true,
      applySelection: true,
      applyViewport: true,
      strict: false,
    })
    stateOutputText.value = "State applied"
    void nextTick(() => {
      syncViewportFromDom()
    })
  } catch {
    stateOutputText.value = "Invalid state JSON"
  }
}

const computeSupported = computed<boolean>(() => api.compute.hasSupport())

const refreshComputeDiagnostics = (): void => {
  computeDiagnosticsOutput.value = JSON.stringify({
    mode: api.compute.getMode(),
    projectionMode: api.policy.getProjectionMode(),
    diagnostics: api.compute.getDiagnostics(),
  }, null, 2)
}

const openComputePolicyPanel = (): void => {
  isComputePolicyPanelOpen.value = true
  projectionMode.value = api.policy.getProjectionMode()
  computeMode.value = (api.compute.getMode() ?? "sync") as "sync" | "worker"
  refreshComputeDiagnostics()
}

const closeComputePolicyPanel = (): void => {
  isComputePolicyPanelOpen.value = false
}

const applyProjectionMode = (): void => {
  projectionMode.value = api.policy.setProjectionMode(projectionMode.value)
  refreshComputeDiagnostics()
}

const applyComputeMode = (): void => {
  if (!api.compute.hasSupport()) {
    return
  }
  api.compute.switchMode(computeMode.value)
  computeMode.value = (api.compute.getMode() ?? computeMode.value) as "sync" | "worker"
  refreshComputeDiagnostics()
}

const setColumnFilterText = (columnKey: string, value: string): void => {
  columnFilterTextByKey.value = {
    ...columnFilterTextByKey.value,
    [columnKey]: value,
  }
}

const toggleSortForColumn = (columnKey: string): void => {
  const current = sortState.value
  if (!current || current.key !== columnKey) {
    sortState.value = { key: columnKey, direction: "asc" }
    return
  }
  if (current.direction === "asc") {
    sortState.value = { key: columnKey, direction: "desc" }
    return
  }
  sortState.value = null
}

const sortIndicator = (columnKey: string): string => {
  const current = sortState.value
  if (!current || current.key !== columnKey) {
    return ""
  }
  return current.direction === "asc" ? "↑" : "↓"
}

const visibleColumns = computed<readonly DataGridColumnSnapshot[]>(() => {
  void columnVersion.value
  return columnModel.getSnapshot().visibleColumns
})
const {
  isColumnLayoutPanelOpen,
  columnLayoutPanelItems,
  openColumnLayoutPanel,
  cancelColumnLayoutPanel,
  applyColumnLayoutPanel,
  moveColumnUp,
  moveColumnDown,
  updateColumnVisibility,
} = useDataGridAppColumnLayoutPanel({
  resolveColumns: () => {
    void columnVersion.value
    const snapshot = api.columns.getSnapshot()
    return snapshot.columns.map(column => ({
      key: column.key,
      label: column.column.label ?? column.key,
      visible: column.visible,
    }))
  },
  applyColumnLayout: payload => {
    api.columns.setOrder(payload.order)
    for (const [key, visible] of Object.entries(payload.visibilityByKey)) {
      api.columns.setVisibility(key, visible)
    }
    syncViewportFromDom()
  },
})
const {
  isDiagnosticsPanelOpen,
  diagnosticsSnapshot,
  openDiagnosticsPanel,
  closeDiagnosticsPanel,
  refreshDiagnosticsPanel,
} = useDataGridAppDiagnosticsPanel({
  readDiagnostics: () => api.diagnostics.getAll(),
})
const mainTrackWidth = computed<number>(() => {
  return visibleColumns.value.reduce((sum, column) => sum + (columnWidths.value[column.key] ?? DEFAULT_COLUMN_WIDTH), 0)
})
const gridContentStyle = computed<Record<string, string>>(() => {
  const width = INDEX_COLUMN_WIDTH + mainTrackWidth.value
  const px = `${width}px`
  return {
    width: px,
    minWidth: px,
  }
})
const mainTrackStyle = computed<Record<string, string>>(() => {
  const px = `${mainTrackWidth.value}px`
  return {
    width: px,
    minWidth: px,
  }
})
const indexColumnStyle = computed<Record<string, string>>(() => {
  const px = `${INDEX_COLUMN_WIDTH}px`
  return {
    width: px,
    minWidth: px,
    maxWidth: px,
    left: "0px",
  }
})

const totalRows = computed(() => {
  void rowVersion.value
  return api.rows.getCount()
})

const normalizedBaseRowHeight = computed<number>(() => {
  const candidate = Number.isFinite(baseRowHeight.value) ? Math.trunc(baseRowHeight.value) : 31
  return Math.max(MIN_ROW_HEIGHT, candidate)
})

const resolveRenderedRowKey = (row: DataGridRowNode<CoreBaseRow>, rowOffset: number): string => {
  if (row.rowId != null) {
    return String(row.rowId)
  }
  return `row-${viewportRange.value.start + rowOffset}`
}

const resolveRowHeightPx = (rowIndex: number): number => {
  const override = api.view.getRowHeightOverride(rowIndex)
  return override ?? normalizedBaseRowHeight.value
}

const rowStyle = (row: DataGridRowNode<CoreBaseRow>, rowOffset: number): Record<string, string> => {
  void rowHeightRenderRevision.value
  if (rowHeightMode.value !== "fixed") {
    return {}
  }
  const rowKey = resolveRenderedRowKey(row, rowOffset)
  const rowIndex = viewportRange.value.start + rowOffset
  if (measuringRowKey.value === rowKey) {
    return {}
  }
  const px = `${resolveRowHeightPx(rowIndex)}px`
  return {
    height: px,
    minHeight: px,
  }
}

const isRowAutosizeProbe = (row: DataGridRowNode<CoreBaseRow>, rowOffset: number): boolean => {
  return measuringRowKey.value === resolveRenderedRowKey(row, rowOffset)
}

const applyRowHeightSettings = (): void => {
  api.view.setRowHeightMode(rowHeightMode.value)
  api.view.setBaseRowHeight(normalizedBaseRowHeight.value)
}

const measureVisibleRowHeights = (): void => {
  if (rowHeightMode.value !== "auto") {
    return
  }
  api.view.measureRowHeight()
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
  if (!state) {
    return
  }
  rowHeightMode.value = "fixed"
  const delta = event.clientY - state.startY
  const nextHeight = Math.max(MIN_ROW_HEIGHT, Math.round(state.startBase + delta))
  const rowIndex = Number.parseInt(state.rowKey, 10)
  if (Number.isFinite(rowIndex)) {
    api.view.setRowHeightOverride(rowIndex, nextHeight)
    rowHeightRenderRevision.value += 1
  }
}

const onRowResizeEnd = (): void => {
  if (!rowResizeState.value) {
    return
  }
  stopRowResize()
}

const startRowResize = (event: MouseEvent, _row: DataGridRowNode<CoreBaseRow>, rowOffset: number): void => {
  const rowIndex = viewportRange.value.start + rowOffset
  const rowKey = String(rowIndex)
  rowResizeState.value = {
    rowKey,
    startY: event.clientY,
    startBase: resolveRowHeightPx(rowIndex),
  }
  rowHeightMode.value = "fixed"
  if (typeof window !== "undefined") {
    window.addEventListener("mousemove", onRowResizeMove)
    window.addEventListener("mouseup", onRowResizeEnd)
  }
}

const autosizeRow = (event: MouseEvent, row: DataGridRowNode<CoreBaseRow>, rowOffset: number): void => {
  const rowIndex = viewportRange.value.start + rowOffset
  const rowKey = resolveRenderedRowKey(row, rowOffset)
  rowHeightMode.value = "fixed"
  measuringRowKey.value = rowKey
  const rowElement = (event.currentTarget as HTMLElement | null)?.closest(".grid-row") as HTMLElement | null
  void nextTick(() => {
    const measured = rowElement ? Math.round(rowElement.getBoundingClientRect().height) : normalizedBaseRowHeight.value
    api.view.setRowHeightOverride(rowIndex, Math.max(MIN_ROW_HEIGHT, measured))
    rowHeightRenderRevision.value += 1
    measuringRowKey.value = null
    syncViewportFromDom()
  })
}

watch([rowHeightMode, normalizedBaseRowHeight], () => {
  applyRowHeightSettings()
  void nextTick(() => {
    measureVisibleRowHeights()
    syncViewportFromDom()
  })
}, { immediate: true })

const aggregateNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

const formatAggregateNumber = (value: number | null): string => {
  if (value == null || !Number.isFinite(value)) {
    return "—"
  }
  return aggregateNumberFormatter.format(value)
}

const selectionAggregates = computed<{
  count: number
  sum: number | null
  min: number | null
  max: number | null
  average: number | null
} | null>(() => {
  const snapshot = selectionSnapshot.value
  if (!snapshot || snapshot.ranges.length === 0) {
    return null
  }
  const rowCount = totalRows.value
  const columnCount = visibleColumns.value.length
  if (rowCount <= 0 || columnCount <= 0) {
    return null
  }

  let selectedCellCount = 0
  let numericCount = 0
  let numericSum = 0
  let numericMin = Number.POSITIVE_INFINITY
  let numericMax = Number.NEGATIVE_INFINITY
  const seenCells = new Set<string>()

  for (const range of snapshot.ranges) {
    const startRow = Math.max(0, Math.min(rowCount - 1, Math.min(range.startRow, range.endRow)))
    const endRow = Math.max(0, Math.min(rowCount - 1, Math.max(range.startRow, range.endRow)))
    const startColumn = Math.max(0, Math.min(columnCount - 1, Math.min(range.startCol, range.endCol)))
    const endColumn = Math.max(0, Math.min(columnCount - 1, Math.max(range.startCol, range.endCol)))

    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      const rowNode = api.rows.get(rowIndex)
      if (!rowNode || rowNode.kind === "group") {
        continue
      }
      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        const cellKey = `${rowIndex}:${columnIndex}`
        if (seenCells.has(cellKey)) {
          continue
        }
        seenCells.add(cellKey)
        selectedCellCount += 1

        const columnKey = visibleColumns.value[columnIndex]?.key
        if (!columnKey) {
          continue
        }
        const rawValue = (rowNode.data as Record<string, unknown>)[columnKey]
        const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue)
        if (!Number.isFinite(numericValue)) {
          continue
        }
        numericCount += 1
        numericSum += numericValue
        numericMin = Math.min(numericMin, numericValue)
        numericMax = Math.max(numericMax, numericValue)
      }
    }
  }

  if (selectedCellCount <= 1) {
    return null
  }

  return {
    count: selectedCellCount,
    sum: numericCount > 0 ? numericSum : null,
    min: numericCount > 0 ? numericMin : null,
    max: numericCount > 0 ? numericMax : null,
    average: numericCount > 0 ? numericSum / numericCount : null,
  }
})

const selectionAggregatesLabel = computed<string>(() => {
  const summary = selectionAggregates.value
  if (!summary) {
    return ""
  }
  return `Selection: count ${summary.count} · sum ${formatAggregateNumber(summary.sum)} · min ${formatAggregateNumber(summary.min)} · max ${formatAggregateNumber(summary.max)} · avg ${formatAggregateNumber(summary.average)}`
})

const topSpacerHeight = computed<number>(() => {
  return Math.max(0, viewportRange.value.start * normalizedBaseRowHeight.value)
})

const bottomSpacerHeight = computed<number>(() => {
  const total = totalRows.value
  if (total <= 0) {
    return 0
  }
  const afterCount = Math.max(0, total - (viewportRange.value.end + 1))
  return afterCount * normalizedBaseRowHeight.value
})

const buildSelectionContext = (): GridSelectionContext<string | number> => {
  return {
    grid: {
      rowCount: totalRows.value,
      colCount: visibleColumns.value.length,
    },
    getRowIdByIndex: (rowIndex: number) => api.rows.get(rowIndex)?.rowId ?? null,
  }
}

const buildSelectionSnapshot = (
  range: ReturnType<typeof createGridSelectionRange<string | number>>,
  activeCell: GridSelectionPointLike<string | number>,
): DataGridSelectionSnapshot => {
  return {
    ranges: [
      {
        startRow: range.startRow,
        endRow: range.endRow,
        startCol: range.startCol,
        endCol: range.endCol,
        startRowId: range.startRowId ?? null,
        endRowId: range.endRowId ?? null,
        anchor: {
          rowIndex: range.anchor.rowIndex,
          colIndex: range.anchor.colIndex,
          rowId: range.anchor.rowId ?? null,
        },
        focus: {
          rowIndex: range.focus.rowIndex,
          colIndex: range.focus.colIndex,
          rowId: range.focus.rowId ?? null,
        },
      },
    ],
    activeRangeIndex: 0,
    activeCell: {
      rowIndex: activeCell.rowIndex,
      colIndex: activeCell.colIndex,
      rowId: activeCell.rowId ?? null,
    },
  }
}

const normalizeCellCoord = (coord: SandboxCellCoord): SandboxCellCoord | null => {
  const rowCount = totalRows.value
  const colCount = visibleColumns.value.length
  if (rowCount <= 0 || colCount <= 0) {
    return null
  }
  const rowIndex = Math.max(0, Math.min(rowCount - 1, Math.trunc(coord.rowIndex)))
  const columnIndex = Math.max(0, Math.min(colCount - 1, Math.trunc(coord.columnIndex)))
  return {
    rowIndex,
    columnIndex,
    rowId: api.rows.get(rowIndex)?.rowId ?? null,
  }
}

const normalizeClipboardRange = (range: DataGridCopyRange): DataGridCopyRange | null => {
  const rowCount = totalRows.value
  const columnCount = visibleColumns.value.length
  if (rowCount <= 0 || columnCount <= 0) {
    return null
  }
  const startRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.min(range.startRow, range.endRow))))
  const endRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.max(range.startRow, range.endRow))))
  const startColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.min(range.startColumn, range.endColumn))))
  const endColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.max(range.startColumn, range.endColumn))))
  if (startRow > endRow || startColumn > endColumn) {
    return null
  }
  return {
    startRow,
    endRow,
    startColumn,
    endColumn,
  }
}

const resolveSelectionRangeForClipboard = (): DataGridCopyRange | null => {
  const snapshot = selectionSnapshot.value
  if (!snapshot || snapshot.ranges.length === 0) {
    return null
  }
  const activeIndex = snapshot.activeRangeIndex ?? 0
  const range = snapshot.ranges[activeIndex] ?? snapshot.ranges[0]
  if (!range) {
    return null
  }
  return normalizeClipboardRange({
    startRow: range.startRow,
    endRow: range.endRow,
    startColumn: range.startCol,
    endColumn: range.endCol,
  })
}

const resolveCurrentCellCoordForClipboard = (): { rowIndex: number; columnIndex: number } | null => {
  const activeCell = selectionSnapshot.value?.activeCell
  if (!activeCell) {
    return null
  }
  const normalized = normalizeCellCoord({
    rowIndex: activeCell.rowIndex,
    columnIndex: activeCell.colIndex,
    rowId: normalizeRowId(activeCell.rowId),
  })
  if (!normalized) {
    return null
  }
  return {
    rowIndex: normalized.rowIndex,
    columnIndex: normalized.columnIndex,
  }
}

const applyClipboardSelectionRange = (range: DataGridCopyRange): void => {
  const normalized = normalizeClipboardRange(range)
  if (!normalized) {
    return
  }
  const context = buildSelectionContext()
  const anchor = {
    rowIndex: normalized.startRow,
    colIndex: normalized.startColumn,
    rowId: api.rows.get(normalized.startRow)?.rowId ?? null,
  }
  const focus = {
    rowIndex: normalized.endRow,
    colIndex: normalized.endColumn,
    rowId: api.rows.get(normalized.endRow)?.rowId ?? null,
  }
  const createdRange = createGridSelectionRange(anchor, focus, context)
  const snapshot = buildSelectionSnapshot(createdRange, {
    rowIndex: createdRange.focus.rowIndex,
    colIndex: createdRange.focus.colIndex,
    rowId: createdRange.focus.rowId ?? null,
  })
  selectionAnchor.value = {
    rowIndex: createdRange.anchor.rowIndex,
    colIndex: createdRange.anchor.colIndex,
    rowId: createdRange.anchor.rowId ?? null,
  }
  selectionSnapshot.value = snapshot
  api.selection.setSnapshot(snapshot)
}

const copiedSelectionRange = ref<DataGridCopyRange | null>(null)
const lastCopiedPayload = ref("")
type PendingClipboardOperation = "none" | "copy" | "cut"
const pendingClipboardOperation = ref<PendingClipboardOperation>("none")
const pendingClipboardRange = ref<DataGridCopyRange | null>(null)
const isFillDragging = ref(false)
const fillPointer = ref<{ clientX: number; clientY: number } | null>(null)
const fillBaseRange = ref<DataGridCopyRange | null>(null)
const fillPreviewRange = ref<DataGridCopyRange | null>(null)
const isRangeMoving = ref(false)
const rangeMovePointer = ref<{ clientX: number; clientY: number } | null>(null)
const rangeMoveBaseRange = ref<DataGridCopyRange | null>(null)
const rangeMoveOrigin = ref<SandboxCellCoord | null>(null)
const rangeMovePreviewRange = ref<DataGridCopyRange | null>(null)

const copyRangeHelpers = useDataGridCopyRangeHelpers({
  resolveSelectionRange: resolveSelectionRangeForClipboard,
  resolveCurrentCellCoord: resolveCurrentCellCoordForClipboard,
})

const clipboardBridge = useDataGridClipboardBridge<DataGridRowNode<CoreBaseRow>, DataGridCopyRange>({
  copiedSelectionRange,
  lastCopiedPayload,
  resolveCopyRange: copyRangeHelpers.resolveCopyRange,
  getRowAtIndex: rowIndex => api.rows.get(rowIndex),
  getColumnKeyAtIndex: columnIndex => visibleColumns.value[columnIndex]?.key ?? null,
  getCellValue: (row, columnKey) => readCell(row, columnKey),
  setLastAction: () => undefined,
  closeContextMenu: () => undefined,
  writeClipboardText: async payload => {
    lastCopiedPayload.value = payload
  },
  readClipboardText: async () => lastCopiedPayload.value,
})

const applyClipboardEdits = (range: DataGridCopyRange, matrix: string[][]): number => {
  const normalized = normalizeClipboardRange(range)
  if (!normalized) {
    return 0
  }
  const matrixHeight = Math.max(1, matrix.length)
  const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
  const editsByRowId = new Map<string | number, Record<string, string>>()

  for (let rowIndex = normalized.startRow; rowIndex <= normalized.endRow; rowIndex += 1) {
    const row = api.rows.get(rowIndex)
    if (!row || row.rowId == null || row.kind === "group") {
      continue
    }
    for (let columnIndex = normalized.startColumn; columnIndex <= normalized.endColumn; columnIndex += 1) {
      const columnKey = visibleColumns.value[columnIndex]?.key
      if (!columnKey) {
        continue
      }
      const rowOffset = rowIndex - normalized.startRow
      const columnOffset = columnIndex - normalized.startColumn
      const value = matrix[rowOffset % matrixHeight]?.[columnOffset % matrixWidth] ?? ""
      const current = editsByRowId.get(row.rowId) ?? {}
      current[columnKey] = value
      editsByRowId.set(row.rowId, current)
    }
  }

  if (editsByRowId.size === 0) {
    return 0
  }

  const beforeSnapshot = captureRowsSnapshot()
  api.rows.applyEdits(Array.from(editsByRowId.entries(), ([rowId, data]) => ({ rowId, data })))
  syncRangeRows(viewportRange.value)
  applyClipboardSelectionRange(normalized)
  void intentHistory.recordIntentTransaction({
    intent: "edit",
    label: "Cell edit",
  }, beforeSnapshot)
  return editsByRowId.size
}

const rangesEqual = (left: DataGridCopyRange | null, right: DataGridCopyRange | null): boolean => {
  if (!left || !right) {
    return left === right
  }
  return (
    left.startRow === right.startRow
    && left.endRow === right.endRow
    && left.startColumn === right.startColumn
    && left.endColumn === right.endColumn
  )
}

const buildFillMatrixFromRange = (range: DataGridCopyRange): string[][] => {
  const matrix: string[][] = []
  for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
    const row = api.rows.get(rowIndex)
    if (!row || row.kind === "group") {
      matrix.push([])
      continue
    }
    const rowValues: string[] = []
    for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
      const columnKey = visibleColumns.value[columnIndex]?.key
      rowValues.push(columnKey ? readCell(row, columnKey) : "")
    }
    matrix.push(rowValues)
  }
  return matrix
}

const applyFillPreview = (): void => {
  const baseRange = fillBaseRange.value
  const previewRange = fillPreviewRange.value
  if (!baseRange || !previewRange || rangesEqual(baseRange, previewRange)) {
    return
  }
  const matrix = buildFillMatrixFromRange(baseRange)
  if (!matrix.length) {
    return
  }
  applyClipboardEdits(previewRange, matrix)
}

const clearCellSelection = (): void => {
  selectionAnchor.value = null
  selectionSnapshot.value = null
  api.selection.clear()
}

const clearPendingClipboardOperation = (
  clearSelection: boolean,
  clearBufferedClipboardPayload = false,
): boolean => {
  if (pendingClipboardOperation.value === "none" && !pendingClipboardRange.value) {
    return false
  }
  pendingClipboardOperation.value = "none"
  pendingClipboardRange.value = null
  if (clearBufferedClipboardPayload) {
    copiedSelectionRange.value = null
    lastCopiedPayload.value = ""
  }
  clipboardBridge.clearCopiedSelectionFlash()
  if (clearSelection) {
    clearCellSelection()
  }
  return true
}

const stageClipboardOperation = async (
  operation: Exclude<PendingClipboardOperation, "none">,
  trigger: "keyboard" | "context-menu",
): Promise<boolean> => {
  const copied = await clipboardBridge.copySelection(trigger)
  if (!copied) {
    return false
  }
  const rawSourceRange = copyRangeHelpers.resolveCopyRange() ?? copiedSelectionRange.value
  const sourceRange = rawSourceRange ? normalizeClipboardRange(rawSourceRange) : null
  if (!sourceRange) {
    return false
  }
  pendingClipboardOperation.value = operation
  pendingClipboardRange.value = sourceRange
  return true
}

const copySelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
  return stageClipboardOperation("copy", trigger)
}

const pasteSelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
  const activeCoord = resolveCurrentCellCoordForClipboard()
  if (!activeCoord) {
    return false
  }
  const payload = await clipboardBridge.readClipboardPayload()
  if (!payload.trim()) {
    return false
  }
  const matrix = clipboardBridge.parseClipboardMatrix(payload)
  const matrixHeight = Math.max(1, matrix.length)
  const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
  const pendingOperation = pendingClipboardOperation.value
  const rawPendingSourceRange = pendingClipboardRange.value ?? copiedSelectionRange.value
  const pendingSourceRange = rawPendingSourceRange ? normalizeClipboardRange(rawPendingSourceRange) : null
  const selected = resolveSelectionRangeForClipboard()
  const targetRange = selected && matrixHeight === 1 && matrixWidth === 1 && copyRangeHelpers.isMultiCellSelection(selected)
    ? selected
    : {
        startRow: activeCoord.rowIndex,
        endRow: activeCoord.rowIndex + matrixHeight - 1,
        startColumn: activeCoord.columnIndex,
        endColumn: activeCoord.columnIndex + matrixWidth - 1,
      }
  const normalizedTargetRange = normalizeClipboardRange(targetRange)
  if (!normalizedTargetRange) {
    return false
  }
  if (pendingOperation === "cut" && pendingSourceRange && rangesEqual(pendingSourceRange, normalizedTargetRange)) {
    clearPendingClipboardOperation(true)
    void trigger
    return true
  }
  if (pendingOperation === "cut" && pendingSourceRange) {
    applyClipboardEdits(pendingSourceRange, [[""]])
  }
  const appliedRows = applyClipboardEdits(targetRange, matrix)
  if (appliedRows <= 0) {
    return false
  }
  if (pendingOperation !== "none") {
    clearPendingClipboardOperation(true)
  }
  void trigger
  return true
}

const cutSelectedCells = async (trigger: "keyboard" | "context-menu" = "keyboard"): Promise<boolean> => {
  return stageClipboardOperation("cut", trigger)
}

const normalizeRowId = (value: unknown): string | number | null => {
  return typeof value === "string" || typeof value === "number" ? value : null
}

const resolveRowIndexById = (rowId: string | number): number => {
  const count = api.rows.getCount()
  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    if (api.rows.get(rowIndex)?.rowId === rowId) {
      return rowIndex
    }
  }
  return -1
}

const isCoordInsideRange = (coord: SandboxCellCoord, range: DataGridCopyRange): boolean => {
  return (
    coord.rowIndex >= range.startRow
    && coord.rowIndex <= range.endRow
    && coord.columnIndex >= range.startColumn
    && coord.columnIndex <= range.endColumn
  )
}

const resolveBaseDataRows = (): CoreBaseRow[] => {
  const count = api.rows.getCount()
  const result: CoreBaseRow[] = []
  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    const node = api.rows.get(rowIndex)
    if (!node || node.rowId == null || node.kind === "group") {
      continue
    }
    const cloned = cloneRowData(node.data as CoreBaseRow)
    ;(cloned as { rowId?: string | number }).rowId = node.rowId
    result.push(cloned)
  }
  return result
}

const rangeMutationEngine = useDataGridRangeMutationEngine<
  CoreBaseRow,
  { rowId: string },
  GridRowsSnapshot<CoreBaseRow>,
  DataGridCopyRange
>({
  resolveRangeMoveBaseRange: () => rangeMoveBaseRange.value,
  resolveRangeMovePreviewRange: () => rangeMovePreviewRange.value,
  resolveFillBaseRange: () => fillBaseRange.value,
  resolveFillPreviewRange: () => fillPreviewRange.value,
  areRangesEqual: rangesEqual,
  captureBeforeSnapshot: captureRowsSnapshot,
  resolveSourceRows: resolveBaseDataRows,
  resolveSourceRowId: row => String(row.rowId),
  applySourceRows: nextRows => {
    api.rows.setData(nextRows.map((row, index) => ({
      rowId: row.rowId,
      originalIndex: index,
      row: cloneRowData(row),
    })))
    syncRangeRows(viewportRange.value)
  },
  resolveDisplayedRows: () => resolveBaseDataRows().map(row => ({ rowId: String(row.rowId) })),
  resolveDisplayedRowId: row => row.rowId,
  resolveColumnKeyAtIndex: columnIndex => visibleColumns.value[columnIndex]?.key ?? null,
  resolveDisplayedCellValue: (row, columnKey) => {
    const rowIndex = resolveRowIndexById(row.rowId)
    const node = rowIndex >= 0 ? api.rows.get(rowIndex) : null
    if (!node || node.kind === "group") {
      return ""
    }
    return (node.data as Record<string, unknown>)[columnKey]
  },
  resolveSourceCellValue: (row, columnKey) => (row as Record<string, unknown>)[columnKey],
  normalizeClipboardValue: value => String(value ?? ""),
  isEditableColumn: () => true,
  applyValueForMove: (row, columnKey, value) => {
    ;(row as Record<string, unknown>)[columnKey] = value
    return true
  },
  clearValueForMove: (row, columnKey) => {
    ;(row as Record<string, unknown>)[columnKey] = ""
    return true
  },
  applyEditedValue: (row, columnKey, draft) => {
    ;(row as Record<string, unknown>)[columnKey] = draft
  },
  recomputeDerived: () => undefined,
  isCellWithinRange: (rowIndex, columnIndex, range) => {
    return isCoordInsideRange({ rowIndex, columnIndex, rowId: null }, range)
  },
  setSelectionFromRange: (range, activePosition) => {
    applyClipboardSelectionRange(range)
    if (activePosition === "start") {
      const normalized = normalizeClipboardRange(range)
      if (!normalized) {
        return
      }
      applyCellSelectionByCoord({
        rowIndex: normalized.startRow,
        columnIndex: normalized.startColumn,
        rowId: api.rows.get(normalized.startRow)?.rowId ?? null,
      }, false)
    }
  },
  recordIntent: (descriptor, beforeSnapshot) => {
    void intentHistory.recordIntentTransaction({
      intent: descriptor.intent,
      label: descriptor.label,
      affectedRange: descriptor.affectedRange ?? null,
    }, beforeSnapshot)
  },
  setLastAction: () => undefined,
})

const applyCellSelectionByCoord = (
  coord: SandboxCellCoord,
  extend: boolean,
  fallbackAnchor?: SandboxCellCoord,
): void => {
  if (!api.selection.hasSupport()) {
    return
  }
  const normalizedCoord = normalizeCellCoord(coord)
  if (!normalizedCoord) {
    return
  }
  const context = buildSelectionContext()
  const rawAnchor = extend
    ? (selectionAnchor.value ?? fallbackAnchor ?? normalizedCoord)
    : normalizedCoord
  const normalizedAnchor = normalizeCellCoord({
    rowIndex: rawAnchor.rowIndex,
    columnIndex: ("colIndex" in rawAnchor ? rawAnchor.colIndex : rawAnchor.columnIndex),
    rowId: normalizeRowId(rawAnchor.rowId),
  })
  if (!normalizedAnchor) {
    return
  }
  const range = createGridSelectionRange({
    rowIndex: normalizedAnchor.rowIndex,
    colIndex: normalizedAnchor.columnIndex,
    rowId: normalizedAnchor.rowId,
  }, {
    rowIndex: normalizedCoord.rowIndex,
    colIndex: normalizedCoord.columnIndex,
    rowId: normalizedCoord.rowId,
  }, context)
  const snapshot = buildSelectionSnapshot(range, {
    rowIndex: normalizedCoord.rowIndex,
    colIndex: normalizedCoord.columnIndex,
    rowId: normalizedCoord.rowId,
  })
  selectionAnchor.value = {
    rowIndex: range.anchor.rowIndex,
    colIndex: range.anchor.colIndex,
    rowId: range.anchor.rowId ?? null,
  }
  selectionSnapshot.value = snapshot
  api.selection.setSnapshot(snapshot)
}

const setCellSelection = (
  row: DataGridRowNode<CoreBaseRow>,
  rowOffset: number,
  columnIndex: number,
  extend: boolean,
): void => {
  if (isEditingCell(row, visibleColumns.value[columnIndex]?.key ?? "")) {
    return
  }
  const coord: SandboxCellCoord = {
    rowIndex: viewportRange.value.start + rowOffset,
    columnIndex,
    rowId: row.rowId ?? null,
  }
  applyCellSelectionByCoord(coord, extend)
}

type PendingClipboardEdge = "top" | "right" | "bottom" | "left"

const isCellInPendingClipboardRange = (rowOffset: number, columnIndex: number): boolean => {
  if (pendingClipboardOperation.value === "none") {
    return false
  }
  const range = pendingClipboardRange.value
  if (!range) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  return (
    rowIndex >= range.startRow
    && rowIndex <= range.endRow
    && columnIndex >= range.startColumn
    && columnIndex <= range.endColumn
  )
}

const isCellOnPendingClipboardEdge = (
  rowOffset: number,
  columnIndex: number,
  edge: PendingClipboardEdge,
): boolean => {
  if (!isCellInPendingClipboardRange(rowOffset, columnIndex)) {
    return false
  }
  const range = pendingClipboardRange.value
  if (!range) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  if (edge === "top") {
    return rowIndex === range.startRow
  }
  if (edge === "right") {
    return columnIndex === range.endColumn
  }
  if (edge === "bottom") {
    return rowIndex === range.endRow
  }
  return columnIndex === range.startColumn
}

const isCellInFillPreview = (rowOffset: number, columnIndex: number): boolean => {
  const preview = fillPreviewRange.value
  if (!preview) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  const inPreview = (
    rowIndex >= preview.startRow
    && rowIndex <= preview.endRow
    && columnIndex >= preview.startColumn
    && columnIndex <= preview.endColumn
  )
  if (!inPreview) {
    return false
  }
  const base = fillBaseRange.value
  if (!base) {
    return true
  }
  const inBase = (
    rowIndex >= base.startRow
    && rowIndex <= base.endRow
    && columnIndex >= base.startColumn
    && columnIndex <= base.endColumn
  )
  return !inBase
}

const isFillHandleCell = (rowOffset: number, columnIndex: number): boolean => {
  const range = resolveSelectionRangeForClipboard()
  if (!range) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  return rowIndex === range.endRow && columnIndex === range.endColumn
}

const startFillHandleDrag = (event: MouseEvent): void => {
  fillHandleStart.onSelectionHandleMouseDown(event)
}

const resolveCellCoordFromElement = (element: HTMLElement | null): SandboxCellCoord | null => {
  if (!element) {
    return null
  }
  const rowIndex = Number.parseInt(element.dataset.rowIndex ?? "", 10)
  const columnIndex = Number.parseInt(element.dataset.columnIndex ?? "", 10)
  if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) {
    return null
  }
  return normalizeCellCoord({ rowIndex, columnIndex, rowId: api.rows.get(rowIndex)?.rowId ?? null })
}

const resolveCellCoordFromPointer = (clientX: number, clientY: number): SandboxCellCoord | null => {
  const target = document.elementFromPoint(clientX, clientY)
  const cell = target instanceof HTMLElement
    ? target.closest(".grid-cell[data-row-index][data-column-index]") as HTMLElement | null
    : null
  return resolveCellCoordFromElement(cell)
}

const cellNavigation = useDataGridCellNavigation<SandboxCellCoord>({
  resolveCurrentCellCoord: () => {
    const activeCell = selectionSnapshot.value?.activeCell
    if (!activeCell) {
      return null
    }
    return normalizeCellCoord({
      rowIndex: activeCell.rowIndex,
      columnIndex: activeCell.colIndex,
      rowId: normalizeRowId(activeCell.rowId),
    })
  },
  resolveTabTarget: (current, backwards) => {
    const lastRow = Math.max(0, totalRows.value - 1)
    const lastColumn = Math.max(0, visibleColumns.value.length - 1)
    if (backwards) {
      if (current.columnIndex > 0) {
        return { ...current, columnIndex: current.columnIndex - 1 }
      }
      if (current.rowIndex <= 0) {
        return current
      }
      return { ...current, rowIndex: current.rowIndex - 1, columnIndex: lastColumn }
    }
    if (current.columnIndex < lastColumn) {
      return { ...current, columnIndex: current.columnIndex + 1 }
    }
    if (current.rowIndex >= lastRow) {
      return current
    }
    return { ...current, rowIndex: current.rowIndex + 1, columnIndex: 0 }
  },
  normalizeCellCoord: coord => normalizeCellCoord(coord),
  getAdjacentNavigableColumnIndex: (columnIndex, direction) => {
    const lastColumn = Math.max(0, visibleColumns.value.length - 1)
    return Math.max(0, Math.min(lastColumn, columnIndex + direction))
  },
  getFirstNavigableColumnIndex: () => 0,
  getLastNavigableColumnIndex: () => Math.max(0, visibleColumns.value.length - 1),
  getLastRowIndex: () => Math.max(0, totalRows.value - 1),
  resolveStepRows: () => 20,
  closeContextMenu: () => undefined,
  clearCellSelection: () => {
    clearCellSelection()
  },
  setLastAction: () => undefined,
  applyCellSelection: (nextCoord, extend, fallbackAnchor) => {
    applyCellSelectionByCoord(nextCoord, extend, fallbackAnchor)
  },
  onNavigationApplied: nextCoord => {
    void nextTick(() => {
      ensureKeyboardActiveCellVisible(nextCoord.rowIndex, nextCoord.columnIndex)
    })
  },
})

const dragPointerSelection = useDataGridDragPointerSelection<SandboxCellCoord>({
  isDragSelecting: () => isPointerSelectingCells.value,
  resolveDragPointer: () => dragPointer.value,
  resolveCellCoordFromPointer,
  resolveLastDragCoord: () => lastDragCoord.value,
  setLastDragCoord: coord => {
    lastDragCoord.value = coord
  },
  cellCoordsEqual: (left, right) => (
    left?.rowIndex === right?.rowIndex
    && left?.columnIndex === right?.columnIndex
  ),
  applyCellSelection: (coord, extend, fallbackAnchor) => {
    applyCellSelectionByCoord(coord, extend, fallbackAnchor)
  },
})

const pointerPreviewRouter = useDataGridPointerPreviewRouter<SandboxCellCoord, DataGridCopyRange>({
  isFillDragging: () => isFillDragging.value,
  resolveFillPointer: () => fillPointer.value,
  resolveFillBaseRange: () => fillBaseRange.value,
  resolveFillPreviewRange: () => fillPreviewRange.value,
  setFillPreviewRange: (range) => {
    fillPreviewRange.value = normalizeClipboardRange(range)
  },
  isRangeMoving: () => isRangeMoving.value,
  resolveRangeMovePointer: () => rangeMovePointer.value,
  resolveRangeMoveBaseRange: () => rangeMoveBaseRange.value,
  resolveRangeMoveOrigin: () => rangeMoveOrigin.value,
  resolveRangeMovePreviewRange: () => rangeMovePreviewRange.value,
  setRangeMovePreviewRange: (range) => {
    rangeMovePreviewRange.value = normalizeClipboardRange(range)
  },
  resolveCellCoordFromPointer,
  buildExtendedRange: (baseRange, coord) => {
    const rowDistance = Math.abs(coord.rowIndex - baseRange.endRow)
    const columnDistance = Math.abs(coord.columnIndex - baseRange.endColumn)
    if (rowDistance >= columnDistance) {
      return normalizeClipboardRange({
        startRow: Math.min(baseRange.startRow, coord.rowIndex),
        endRow: Math.max(baseRange.endRow, coord.rowIndex),
        startColumn: baseRange.startColumn,
        endColumn: baseRange.endColumn,
      })
    }
    return normalizeClipboardRange({
      startRow: baseRange.startRow,
      endRow: baseRange.endRow,
      startColumn: Math.min(baseRange.startColumn, coord.columnIndex),
      endColumn: Math.max(baseRange.endColumn, coord.columnIndex),
    })
  },
  normalizeSelectionRange: range => normalizeClipboardRange(range),
  rangesEqual,
})

const axisAutoScroll = useDataGridAxisAutoScrollDelta({
  edgePx: 28,
  maxStepPx: 22,
})

const pointerAutoScroll = useDataGridPointerAutoScroll({
  resolveInteractionState: () => ({
    isDragSelecting: isPointerSelectingCells.value,
    isFillDragging: isFillDragging.value,
    isRangeMoving: isRangeMoving.value,
  }),
  resolveRangeMovePointer: () => rangeMovePointer.value,
  resolveFillPointer: () => fillPointer.value,
  resolveDragPointer: () => dragPointer.value,
  resolveViewportElement: () => bodyViewportRef.value,
  resolveHeaderHeight: () => 0,
  resolveAxisAutoScrollDelta: axisAutoScroll.resolveAxisAutoScrollDelta,
  setScrollPosition: () => {
    syncViewportFromDom()
  },
  applyRangeMovePreviewFromPointer: () => {
    pointerPreviewRouter.applyRangeMovePreviewFromPointer()
  },
  applyFillPreviewFromPointer: () => {
    pointerPreviewRouter.applyFillPreviewFromPointer()
  },
  applyDragSelectionFromPointer: () => {
    dragPointerSelection.applyDragSelectionFromPointer()
  },
})

const fillSelectionLifecycle = useDataGridFillSelectionLifecycle<DataGridCopyRange>({
  applyFillPreview,
  setFillDragging: (value) => {
    isFillDragging.value = value
  },
  clearFillPointer: () => {
    fillPointer.value = null
  },
  clearFillBaseRange: () => {
    fillBaseRange.value = null
  },
  clearFillPreviewRange: () => {
    fillPreviewRange.value = null
  },
  stopAutoScrollFrameIfIdle: () => {
    pointerAutoScroll.stopAutoScrollFrameIfIdle()
  },
  resolveFillPreviewRange: () => fillPreviewRange.value,
})

const rangeMoveLifecycle = useDataGridRangeMoveLifecycle({
  applyRangeMove: () => rangeMutationEngine.applyRangeMove(),
  setRangeMoving: (value) => {
    isRangeMoving.value = value
  },
  clearRangeMovePointer: () => {
    rangeMovePointer.value = null
  },
  clearRangeMoveBaseRange: () => {
    rangeMoveBaseRange.value = null
  },
  clearRangeMoveOrigin: () => {
    rangeMoveOrigin.value = null
  },
  clearRangeMovePreviewRange: () => {
    rangeMovePreviewRange.value = null
  },
  stopAutoScrollFrameIfIdle: () => {
    pointerAutoScroll.stopAutoScrollFrameIfIdle()
  },
})

const rangeMoveStart = useDataGridRangeMoveStart<SandboxCellCoord, DataGridCopyRange>({
  resolveSelectionRange: resolveSelectionRangeForClipboard,
  isCoordInsideRange,
  closeContextMenu: () => undefined,
  focusViewport: () => {
    bodyViewportRef.value?.focus({ preventScroll: true })
  },
  stopDragSelection: () => {
    stopPointerSelection()
  },
  stopFillSelection: (applyPreview) => {
    fillSelectionLifecycle.stopFillSelection(applyPreview)
  },
  setRangeMoving: (value) => {
    isRangeMoving.value = value
  },
  setRangeMovePointer: (pointer) => {
    rangeMovePointer.value = pointer
  },
  setRangeMoveBaseRange: (range) => {
    rangeMoveBaseRange.value = normalizeClipboardRange(range)
  },
  setRangeMoveOrigin: (coord) => {
    rangeMoveOrigin.value = normalizeCellCoord(coord)
  },
  setRangeMovePreviewRange: (range) => {
    rangeMovePreviewRange.value = normalizeClipboardRange(range)
  },
  startInteractionAutoScroll: () => {
    pointerAutoScroll.startInteractionAutoScroll()
  },
  setLastAction: () => undefined,
})

const fillHandleStart = useDataGridFillHandleStart<DataGridCopyRange>({
  resolveSelectionRange: resolveSelectionRangeForClipboard,
  focusViewport: () => {
    bodyViewportRef.value?.focus({ preventScroll: true })
  },
  stopRangeMove: (commit) => {
    rangeMoveLifecycle.stopRangeMove(commit)
  },
  setDragSelecting: (value) => {
    isPointerSelectingCells.value = value
  },
  setDragPointer: (pointer) => {
    dragPointer.value = pointer
  },
  setFillDragging: (value) => {
    isFillDragging.value = value
  },
  setFillBaseRange: (range) => {
    fillBaseRange.value = range ? normalizeClipboardRange(range) : null
  },
  setFillPreviewRange: (range) => {
    fillPreviewRange.value = range ? normalizeClipboardRange(range) : null
  },
  setFillPointer: (pointer) => {
    fillPointer.value = pointer
  },
  startInteractionAutoScroll: () => {
    pointerAutoScroll.startInteractionAutoScroll()
  },
  setLastAction: () => undefined,
})

const historyActionRunner = useDataGridHistoryActionRunner({
  hasInlineEditor: () => editingCell.value != null,
  commitInlineEdit: () => {
    commitInlineEdit()
  },
  closeContextMenu: () => undefined,
  canUndo: () => intentHistory.canUndo(),
  canRedo: () => intentHistory.canRedo(),
  runHistoryAction: intentHistory.runHistoryAction,
  setLastAction: () => undefined,
})

const keyboardCommandRouter = useDataGridKeyboardCommandRouter({
  isRangeMoving: () => isRangeMoving.value,
  isContextMenuVisible: () => false,
  closeContextMenu: () => undefined,
  focusViewport: () => {
    bodyViewportRef.value?.focus({ preventScroll: true })
  },
  openContextMenuFromCurrentCell: () => undefined,
  selectAllCells: () => {
    const lastRow = totalRows.value - 1
    const lastColumn = visibleColumns.value.length - 1
    if (lastRow < 0 || lastColumn < 0) {
      return
    }
    applyClipboardSelectionRange({
      startRow: 0,
      endRow: lastRow,
      startColumn: 0,
      endColumn: lastColumn,
    })
  },
  runHistoryAction: historyActionRunner.runHistoryAction,
  copySelection: copySelectedCells,
  pasteSelection: pasteSelectedCells,
  cutSelection: cutSelectedCells,
  stopRangeMove: (commit) => {
    rangeMoveLifecycle.stopRangeMove(commit)
  },
  setLastAction: () => undefined,
})

const cellPointerDownRouter = useDataGridCellPointerDownRouter<
  DataGridRowNode<CoreBaseRow>,
  SandboxCellCoord,
  DataGridCopyRange
>({
  isSelectionColumn: () => false,
  isRangeMoveModifierActive: event => event.button === 0 && !event.shiftKey,
  isEditorInteractionTarget: target => Boolean(target?.closest(".cell-editor-input")),
  hasInlineEditor: () => editingCell.value != null,
  commitInlineEdit: () => {
    if (!editingCell.value) {
      return false
    }
    commitInlineEdit("stay")
    return true
  },
  resolveCellCoord: (row, columnKey) => {
    if (row.rowId == null) {
      return null
    }
    const rowIndex = resolveRowIndexById(row.rowId)
    if (rowIndex < 0) {
      return null
    }
    const columnIndex = visibleColumns.value.findIndex(column => column.key === columnKey)
    if (columnIndex < 0) {
      return null
    }
    return normalizeCellCoord({
      rowIndex,
      columnIndex,
      rowId: row.rowId,
    })
  },
  resolveSelectionRange: resolveSelectionRangeForClipboard,
  isCoordInsideRange,
  startRangeMove: (coord, pointer) => {
    rangeMoveStart.startRangeMove(coord, pointer)
  },
  closeContextMenu: () => undefined,
  focusViewport: () => {
    bodyViewportRef.value?.focus({ preventScroll: true })
  },
  isFillDragging: () => isFillDragging.value,
  stopFillSelection: (commit) => {
    fillSelectionLifecycle.stopFillSelection(commit)
  },
  setDragSelecting: (value) => {
    isPointerSelectingCells.value = value
  },
  setLastDragCoord: (coord) => {
    lastDragCoord.value = coord
  },
  setDragPointer: (pointer) => {
    dragPointer.value = pointer
  },
  applyCellSelection: (coord, extend, fallbackAnchor) => {
    applyCellSelectionByCoord(coord, extend, fallbackAnchor)
  },
  startInteractionAutoScroll: () => {
    pointerAutoScroll.startInteractionAutoScroll()
  },
  setLastAction: () => undefined,
})

const headerResize = useDataGridHeaderResizeOrchestration<CoreBaseRow>({
  resolveColumnBaseWidth: (columnKey) => {
    const snapshot = visibleColumns.value.find(column => column.key === columnKey)
    return snapshot?.column.width ?? DEFAULT_COLUMN_WIDTH
  },
  resolveColumnLabel: (columnKey) => {
    return visibleColumns.value.find(column => column.key === columnKey)?.column.label ?? columnKey
  },
  resolveRowsForAutoSize: () => rows.value,
  resolveCellText: (row, columnKey) => {
    const value = (row as Record<string, unknown>)[columnKey]
    return value == null ? "" : String(value)
  },
  resolveColumnWidthOverride: (columnKey) => columnWidths.value[columnKey] ?? null,
  resolveColumnMinWidth: () => MIN_COLUMN_WIDTH,
  applyColumnWidth: (columnKey, width) => {
    columnWidths.value = {
      ...columnWidths.value,
      [columnKey]: width,
    }
  },
  isColumnResizable: (columnKey) => visibleColumns.value.some(column => column.key === columnKey),
  isFillDragging: () => isFillDragging.value,
  stopFillSelection: () => {
    fillSelectionLifecycle.stopFillSelection(false)
  },
  isDragSelecting: () => isPointerSelectingCells.value,
  stopDragSelection: () => {
    stopPointerSelection()
    pointerAutoScroll.stopAutoScrollFrameIfIdle()
  },
  setLastAction: () => undefined,
  autoSizeSampleLimit: AUTO_RESIZE_SAMPLE_LIMIT,
  autoSizeCharWidth: 7.2,
  autoSizeHorizontalPadding: 42,
  autoSizeMaxWidth: 640,
  resizeApplyMode: "sync",
})

const handleCellMouseDown = (
  event: MouseEvent,
  row: DataGridRowNode<CoreBaseRow>,
  rowOffset: number,
  columnIndex: number,
): void => {
  const columnKey = visibleColumns.value[columnIndex]?.key
  if (!columnKey) {
    return
  }

  const handled = cellPointerDownRouter.dispatchCellPointerDown(row, columnKey, event)
  if (handled) {
    const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
    target?.focus({ preventScroll: true })
    return
  }

  if (event.button !== 0) {
    return
  }
  setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
  isPointerSelectingCells.value = true
  dragPointer.value = { clientX: event.clientX, clientY: event.clientY }
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  target?.focus({ preventScroll: true })
  lastDragCoord.value = resolveCellCoordFromElement(target)
  pointerAutoScroll.startInteractionAutoScroll()
}

const resolveColumnRenderWidth = (columnKey: string): number => {
  return columnWidths.value[columnKey] ?? DEFAULT_COLUMN_WIDTH
}

const resolvePinnedViewportInsets = (): { left: number; right: number } => {
  const leftPinnedWidth = visibleColumns.value
    .filter(column => column.pin === "left")
    .reduce((sum, column) => sum + resolveColumnRenderWidth(column.key), 0)
  const rightPinnedWidth = visibleColumns.value
    .filter(column => column.pin === "right")
    .reduce((sum, column) => sum + resolveColumnRenderWidth(column.key), 0)
  return {
    left: INDEX_COLUMN_WIDTH + leftPinnedWidth,
    right: rightPinnedWidth,
  }
}

const ensureKeyboardActiveCellVisible = (rowIndex: number, columnIndex: number): void => {
  const viewport = bodyViewportRef.value
  if (!viewport) {
    return
  }
  const selector = `.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
  let targetCell = viewport.querySelector<HTMLElement>(selector)

  if (!targetCell) {
    const estimatedTop = Math.max(0, rowIndex * normalizedBaseRowHeight.value)
    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const nextTop = Math.min(maxTop, estimatedTop)
    if (viewport.scrollTop !== nextTop) {
      viewport.scrollTop = nextTop
      syncViewportFromDom()
    }
    targetCell = viewport.querySelector<HTMLElement>(selector)
  }

  if (!targetCell) {
    return
  }

  targetCell.scrollIntoView({ block: "nearest", inline: "nearest" })

  const viewportRect = viewport.getBoundingClientRect()
  const cellRect = targetCell.getBoundingClientRect()
  const insets = resolvePinnedViewportInsets()
  const visibleLeft = viewportRect.left + Math.max(0, insets.left)
  const visibleRight = viewportRect.right - Math.max(0, insets.right)

  if (cellRect.left < visibleLeft) {
    viewport.scrollLeft = Math.max(0, viewport.scrollLeft - (visibleLeft - cellRect.left))
  } else if (cellRect.right > visibleRight) {
    viewport.scrollLeft += cellRect.right - visibleRight
  }

  targetCell.focus({ preventScroll: true })
  syncViewportFromDom()
}

const handleCellKeydown = (
  event: KeyboardEvent,
  row: DataGridRowNode<CoreBaseRow>,
  rowOffset: number,
  columnIndex: number,
): void => {
  const isPrintableEditingKey = !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1
  if (isFillDragging.value && event.key === "Escape") {
    event.preventDefault()
    fillSelectionLifecycle.stopFillSelection(false)
    return
  }
  if (!selectionSnapshot.value?.activeCell) {
    setCellSelection(row, rowOffset, columnIndex, false)
  }
  if (!isRangeMoving.value && event.key === "Escape" && clearPendingClipboardOperation(true, true)) {
    event.preventDefault()
    return
  }
  if (keyboardCommandRouter.dispatchKeyboardCommands(event)) {
    return
  }
  if (event.key === "Enter") {
    event.preventDefault()
    const columnKey = visibleColumns.value[columnIndex]?.key
    if (columnKey) {
      startInlineEdit(row, columnKey)
    }
    return
  }
  if (cellNavigation.dispatchNavigation(event)) {
    return
  }
  if (isPrintableEditingKey) {
    event.preventDefault()
    const columnKey = visibleColumns.value[columnIndex]?.key
    if (columnKey) {
      startInlineEdit(row, columnKey, { draftValue: event.key })
    }
    return
  }
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault()
    setCellSelection(row, rowOffset, columnIndex, event.shiftKey)
  }
  if (event.key === "F2") {
    event.preventDefault()
    const columnKey = visibleColumns.value[columnIndex]?.key
    if (columnKey) {
      startInlineEdit(row, columnKey)
    }
  }
}

const isEditingCell = (row: DataGridRowNode<CoreBaseRow>, columnKey: string): boolean => {
  return editingCell.value?.rowId === row.rowId && editingCell.value?.columnKey === columnKey
}

const focusInlineEditor = (): void => {
  void nextTick(() => {
    const applyFocus = (): void => {
      const editor = bodyViewportRef.value?.querySelector<HTMLInputElement>(".cell-editor-input")
      if (!editor) {
        return
      }
      editor.focus({ preventScroll: true })
      const caretPosition = editor.value.length
      editor.setSelectionRange(caretPosition, caretPosition)
    }
    applyFocus()
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        applyFocus()
      })
    }
  })
}

const startInlineEdit = (
  row: DataGridRowNode<CoreBaseRow>,
  columnKey: string,
  options: { draftValue?: string } = {},
): void => {
  if (row.kind === "group" || row.rowId == null) {
    return
  }
  editingCell.value = {
    rowId: row.rowId,
    columnKey,
  }
  editingCellValue.value = options.draftValue ?? readCell(row, columnKey)
  focusInlineEditor()
}

const clearInlineEdit = (): void => {
  editingCell.value = null
  editingCellValue.value = ""
}

const focusAfterInlineEdit = (
  rowId: string | number,
  columnKey: string,
  target: "stay" | "next" | "previous",
): void => {
  const columnIndex = visibleColumns.value.findIndex(column => column.key === columnKey)
  if (columnIndex < 0) {
    return
  }
  const currentRowIndex = resolveRowIndexById(rowId)
  if (currentRowIndex < 0) {
    return
  }
  const maxRowIndex = Math.max(0, totalRows.value - 1)
  const nextRowIndex = target === "next"
    ? Math.min(maxRowIndex, currentRowIndex + 1)
    : target === "previous"
      ? Math.max(0, currentRowIndex - 1)
      : currentRowIndex
  const nextRowId = normalizeRowId(api.rows.get(nextRowIndex)?.rowId)
  if (nextRowId == null) {
    return
  }
  applyCellSelectionByCoord({
    rowIndex: nextRowIndex,
    columnIndex,
    rowId: nextRowId,
  }, false)
  void nextTick(() => {
    ensureKeyboardActiveCellVisible(nextRowIndex, columnIndex)
  })
}

const commitInlineEdit = (
  targetOrEvent: "stay" | "next" | "previous" | boolean | FocusEvent = "stay",
): void => {
  const currentEditingCell = editingCell.value
  if (!currentEditingCell) {
    return
  }
  const target = typeof targetOrEvent === "string"
    ? targetOrEvent
    : typeof targetOrEvent === "boolean"
      ? (targetOrEvent ? "next" : "stay")
      : "stay"
  const beforeSnapshot = captureRowsSnapshot()
  api.rows.applyEdits([
    {
      rowId: currentEditingCell.rowId,
      data: {
        [currentEditingCell.columnKey]: editingCellValue.value,
      },
    },
  ])
  void intentHistory.recordIntentTransaction({
    intent: "edit",
    label: "Cell edit",
  }, beforeSnapshot)
  syncRangeRows(viewportRange.value)
  clearInlineEdit()
  focusAfterInlineEdit(currentEditingCell.rowId, currentEditingCell.columnKey, target)
}

const cancelInlineEdit = (): void => {
  const currentEditingCell = editingCell.value
  clearInlineEdit()
  if (!currentEditingCell) {
    return
  }
  focusAfterInlineEdit(currentEditingCell.rowId, currentEditingCell.columnKey, "stay")
}

const handleEditorKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Enter") {
    event.preventDefault()
    commitInlineEdit(event.shiftKey ? "previous" : "next")
    return
  }
  if (event.key === "Escape") {
    event.preventDefault()
    cancelInlineEdit()
  }
}

const stopPointerSelection = (): void => {
  isPointerSelectingCells.value = false
  dragPointer.value = null
  lastDragCoord.value = null
}

const handleWindowMouseMove = (event: MouseEvent): void => {
  if (headerResize.isColumnResizing()) {
    headerResize.applyColumnResizeFromPointer(event.clientX)
    return
  }
  if (isRangeMoving.value) {
    rangeMovePointer.value = { clientX: event.clientX, clientY: event.clientY }
    pointerPreviewRouter.applyRangeMovePreviewFromPointer()
    return
  }
  if (isFillDragging.value) {
    fillPointer.value = { clientX: event.clientX, clientY: event.clientY }
    pointerPreviewRouter.applyFillPreviewFromPointer()
    return
  }
  if (!isPointerSelectingCells.value) {
    return
  }
  dragPointer.value = { clientX: event.clientX, clientY: event.clientY }
  dragPointerSelection.applyDragSelectionFromPointer()
}

const handleWindowMouseUp = (): void => {
  headerResize.stopColumnResize()
  if (isRangeMoving.value) {
    rangeMoveLifecycle.stopRangeMove(true)
  }
  if (isFillDragging.value) {
    fillSelectionLifecycle.stopFillSelection(true)
  }
  stopPointerSelection()
  pointerAutoScroll.stopAutoScrollFrameIfIdle()
}

const isCellSelected = (rowOffset: number, columnIndex: number): boolean => {
  const range = resolveSelectionRangeForClipboard()
  if (!range) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  return (
    rowIndex >= range.startRow
    && rowIndex <= range.endRow
    && columnIndex >= range.startColumn
    && columnIndex <= range.endColumn
  )
}

const isSelectionAnchorCell = (rowOffset: number, columnIndex: number): boolean => {
  const snapshot = selectionSnapshot.value
  if (!snapshot || snapshot.ranges.length === 0) {
    return false
  }
  const activeIndex = snapshot.activeRangeIndex ?? 0
  const range = snapshot.ranges[activeIndex] ?? snapshot.ranges[0]
  if (!range?.anchor) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  return rowIndex === range.anchor.rowIndex && columnIndex === range.anchor.colIndex
}

const shouldHighlightSelectedCell = (rowOffset: number, columnIndex: number): boolean => {
  const range = resolveSelectionRangeForClipboard()
  if (!range || !isCellSelected(rowOffset, columnIndex)) {
    return false
  }
  const isSingleCell = range.startRow === range.endRow && range.startColumn === range.endColumn
  if (isSingleCell) {
    return false
  }
  return !isSelectionAnchorCell(rowOffset, columnIndex)
}

const isCellOnSelectionEdge = (
  rowOffset: number,
  columnIndex: number,
  edge: PendingClipboardEdge,
): boolean => {
  const range = resolveSelectionRangeForClipboard()
  if (!range || !isCellSelected(rowOffset, columnIndex)) {
    return false
  }
  const rowIndex = viewportRange.value.start + rowOffset
  if (edge === "top") {
    return rowIndex === range.startRow
  }
  if (edge === "right") {
    return columnIndex === range.endColumn
  }
  if (edge === "bottom") {
    return rowIndex === range.endRow
  }
  return columnIndex === range.startColumn
}

const columnStyle = (key: string): Record<string, string> => {
  const width = columnWidths.value[key] ?? DEFAULT_COLUMN_WIDTH
  const px = `${width}px`
  return {
    width: px,
    minWidth: px,
    maxWidth: px,
  }
}

const rowIndexLabel = (row: DataGridRowNode<CoreBaseRow>, rowOffset: number): string => {
  if (row.kind === "group") {
    return ""
  }
  const sourceId = (row.data as { id?: unknown }).id
  if (typeof sourceId === "number" && Number.isFinite(sourceId)) {
    return String(sourceId)
  }
  return String(viewportRange.value.start + rowOffset + 1)
}

const startResize = (event: MouseEvent, key: string): void => {
  headerResize.onHeaderResizeHandleMouseDown(key, event)
}

const handleResizeDoubleClick = (event: MouseEvent, key: string): void => {
  headerResize.onHeaderResizeHandleDoubleClick(key, event)
}

const readCell = (row: DataGridRowNode<CoreBaseRow>, key: string): string => {
  if (row.kind === "group") {
    return key === "name"
      ? `[group] ${String(row.groupMeta?.groupValue ?? row.rowId)}`
      : ""
  }
  const value = (row.data as Record<string, unknown>)[key]
  return value == null ? "" : String(value)
}

onMounted(() => {
  selectionSnapshot.value = api.selection.hasSupport()
    ? api.selection.getSnapshot()
    : null
  void nextTick(() => {
    applyRowHeightSettings()
    syncViewportFromDom()
  })
  window.addEventListener("resize", syncViewportFromDom)
  window.addEventListener("mousemove", handleWindowMouseMove)
  window.addEventListener("mouseup", handleWindowMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewportFromDom)
  window.removeEventListener("mousemove", handleWindowMouseMove)
  window.removeEventListener("mouseup", handleWindowMouseUp)
  stopRowResize()
  headerResize.dispose()
  pointerAutoScroll.dispose()
  clipboardBridge.dispose()
  intentHistory.dispose()
  unsubscribeRows()
  unsubscribeColumns()
  core.dispose()
  rowModel.dispose()
  columnModel.dispose()
})
</script>
