import {
  resolveDataGridSelectableRowRange,
  type DataGridApi,
  type DataGridColumnInput,
  type DataGridCoreViewportService,
  type DataGridFilterSnapshot,
  type DataGridRowModelSnapshot,
} from "@affino/datagrid-core"
import { createDomCellNavigationController } from "./controllers/cellNavigationController.js"
import { createDomCellSelectionController } from "./controllers/cellSelectionController.js"
import { createDomCellToggleController } from "./controllers/cellToggleController.js"
import { createDomCellPointerSelectionController } from "./controllers/cellPointerSelectionController.js"
import { createDomRangeMoveController } from "./controllers/rangeMoveController.js"
import { createDomClipboardController } from "./controllers/clipboardController.js"
import { createDomFillHandleController, type DomFillHandleController } from "./controllers/fillHandleController.js"
import { createDomInlineEditingController } from "./controllers/inlineEditingController.js"
import { createDomColumnResizeController } from "./controllers/columnResizeController.js"
import { createDomColumnReorderController } from "./controllers/columnReorderController.js"
import { createDomHeaderSortController } from "./controllers/headerSortController.js"
import { createDomGroupingPresentationController } from "./controllers/groupingPresentationController.js"
import { createDomHistoryController } from "./controllers/historyController.js"
import { createDomSelectionService } from "./platform/selectionService.js"
import { createDomViewportController } from "./viewport/createDomViewportController.js"
import { revealMountedDomCell } from "./viewport/revealDomCell.js"
import { createHeaderScrollSync } from "./viewport/headerScrollSync.js"
import { createDomCanvasGridChromeController } from "./chrome/createDomCanvasGridChromeController.js"
import { createDomGanttView, type DomGanttView } from "./gantt/createDomGanttView.js"
import { useDataGridRuntimeService } from "@affino/datagrid-orchestration"
import type { DataGridDomHandle, DataGridDomOptions } from "./contracts.js"
import { renderGrid } from "../rendering/renderGrid.js"

let nextGridDomId = 0

/** Mounts an ARIA grid backed by the shared grid runtime. */
export function mountDataGrid<TRow>(
  element: HTMLElement,
  options: DataGridDomOptions<TRow>,
): DataGridDomHandle<TRow> {
  const hasRows = options.rows !== undefined
  const hasRowModel = options.rowModel !== undefined
  if (hasRows === hasRowModel) {
    throw new TypeError("mountDataGrid requires exactly one of rows or rowModel.")
  }
  const rowVirtualization = options.rowVirtualization === false ? null : options.rowVirtualization ?? null
  const columnVirtualization = options.columnVirtualization === false ? null : options.columnVirtualization ?? null
  if (rowVirtualization && (!Number.isFinite(rowVirtualization.rowHeight) || rowVirtualization.rowHeight <= 0)) {
    throw new RangeError("rowVirtualization.rowHeight must be a positive finite number.")
  }
  if (options.gridChrome === "canvas" && (!rowVirtualization || !columnVirtualization)) {
    throw new TypeError("gridChrome: 'canvas' requires fixed rowVirtualization and columnVirtualization.")
  }

  const viewportEnabled = rowVirtualization != null || columnVirtualization != null
  const viewportService = viewportEnabled
    ? { name: "viewport" as const } as DataGridCoreViewportService
    : null
  const previousChildren = Array.from(element.childNodes)
  const grid = createGridElement(element, options, viewportEnabled, rowVirtualization, columnVirtualization)
  const mountDisposers: Array<() => void> = [() => grid.remove()]
  const rollbackMountSetup = (): void => {
    for (const dispose of mountDisposers.splice(0).reverse()) {
      try { dispose() } catch { /* Continue releasing resources after setup failure. */ }
    }
    element.replaceChildren(...previousChildren)
  }
  const createMountResource = <T>(create: () => T, dispose: (resource: T) => void): T => {
    try {
      const resource = create()
      mountDisposers.push(() => dispose(resource))
      return resource
    } catch (error) {
      rollbackMountSetup()
      throw error
    }
  }
  let runtimeApi: DataGridApi<TRow> | null = null
  let runWithRenderBatch: (operation: () => Promise<void>) => Promise<void> = operation => operation()
  let commitInlineEdit: () => Promise<void> = async () => undefined
  let fillHandle: DomFillHandleController | null = null
  let rangeMove: ReturnType<typeof createDomRangeMoveController<TRow>> | null = null
  let history: ReturnType<typeof createDomHistoryController<TRow>>
  try {
    history = createDomHistoryController<TRow>({
      grid,
      getApi: () => runtimeApi,
      runWithRenderBatch: operation => runWithRenderBatch(operation),
      commitInlineEdit: () => commitInlineEdit(),
      setLastAction: message => { grid.dataset.historyAction = message },
    })
  } catch (error) {
    rollbackMountSetup()
    throw error
  }
  let runtime: ReturnType<typeof useDataGridRuntimeService<TRow>>
  try {
    runtime = useDataGridRuntimeService<TRow>({
      ...(options.rowModel ? { rowModel: options.rowModel } : { rows: options.rows! }),
      columns: options.columns as readonly DataGridColumnInput<unknown>[],
      ...(options.treeData || options.formulas?.length
        ? {
          clientRowModelOptions: {
            ...(options.treeData ? { initialTreeData: options.treeData } : {}),
            ...(options.formulas?.length ? { initialFormulaFields: options.formulas } : {}),
          },
        }
        : {}),
      services: {
        selection: createDomSelectionService(options.rowSelection === true),
        transaction: history.transactionService,
        ...(viewportService ? { viewport: viewportService } : {}),
      },
    })
  } catch (error) {
    rollbackMountSetup()
    throw error
  }
  mountDisposers.push(() => {
    void runtime.stop().catch(error => {
      console.error("[DataGridDom] runtime cleanup failed during mount rollback.", error)
    })
  })
  const { api, columnModel } = runtime
  runtimeApi = api
  let ganttView: DomGanttView | null = null
  const columnResize = createMountResource(() => createDomColumnResizeController({
    grid,
    api,
    getColumns: () => columnModel.getSnapshot().visibleColumns,
    setWidth: (key, width) => api.columns.setWidth(key, width),
  }), controller => controller.dispose())
  const columnReorder = options.columnReorder
    ? createMountResource(() => createDomColumnReorderController({ grid, api }), controller => controller.dispose())
    : null
  const headerSort = createMountResource(() => createDomHeaderSortController({
    grid,
    api,
    getColumns: () => columnModel.getSnapshot().visibleColumns,
  }), controller => controller.dispose())
  const groupingPresentation = createMountResource(
    () => createDomGroupingPresentationController(api, options.treeData),
    controller => controller.dispose(),
  )
  const headerScrollSync = createMountResource(() => createHeaderScrollSync(grid), controller => controller.detach())
  let destroyed = false
  let renderBatchDepth = 0
  let renderDeferred = false
  let columnsInvalidated = false
  let headerWidthInvalidated = false
  let groupingPresentationSyncActive = false
  let viewport: ReturnType<typeof createDomViewportController<TRow>> = null
  let canvasChrome: ReturnType<typeof createDomCanvasGridChromeController> | null = null
  let rowSelectionHeaderState = { checked: false, mixed: false }
  let selectableProjectionRowIds: Array<string | number> = []
  let selectableProjectionRowIdSet = new Set<string | number>()
  const readProjectionIdentitySignature = (): string => {
    const identities: string[] = []
    for (let index = 0; index < api.rows.getCount(); index += 1) {
      const row = api.rows.get(index)
      identities.push(row ? `${row.kind}:${typeof row.rowId}:${String(row.rowId)}` : "missing")
    }
    return JSON.stringify(identities)
  }
  let projectionRevisionFromCore = resolveProjectionRevision(api.rows.getSnapshot())
  let projectionIdentitySignature = projectionRevisionFromCore == null ? readProjectionIdentitySignature() : null
  let previousGroupByFields = [...(api.rows.getSnapshot().groupBy?.fields ?? [])]
  let groupScrollResetFrame: number | null = null
  let rowSelectionProjectionRevision = projectionRevisionFromCore ?? 0
  let rowSelectionAnchor: { rowId: string | number; projectionRevision: number } | null = null
  let copiedClipboardRange: { startRow: number; endRow: number; startColumn: number; endColumn: number } | null = null
  const rowSelectionShiftByInput = new WeakMap<HTMLInputElement, boolean>()
  let destroyPromise: Promise<void> | null = null
  const syncGroupingPresentation = (): boolean => {
    if (groupingPresentationSyncActive) return false
    const previousColumnRevision = columnModel.getSnapshot().revision
    groupingPresentationSyncActive = true
    try {
      groupingPresentation.sync()
    } finally {
      groupingPresentationSyncActive = false
    }
    return columnModel.getSnapshot().revision !== previousColumnRevision
  }
  const refreshSelectableProjectionRows = (): void => {
    const next: Array<string | number> = []
    for (let index = 0; index < api.rows.getCount(); index += 1) {
      const row = api.rows.get(index)
      if (row?.kind === "leaf") next.push(row.rowId)
    }
    selectableProjectionRowIds = next
    selectableProjectionRowIdSet = new Set(next)
  }
  const syncProjectionRevision = (
    snapshot: ReturnType<typeof api.rows.getSnapshot>,
    announcedRevision?: number,
  ): boolean => {
    const nextCoreRevision = announcedRevision ?? resolveProjectionRevision(snapshot)
    let changed: boolean
    if (nextCoreRevision != null) {
      changed = projectionRevisionFromCore !== nextCoreRevision
      projectionRevisionFromCore = nextCoreRevision
      if (changed) rowSelectionProjectionRevision = nextCoreRevision
      projectionIdentitySignature = null
    } else {
      const nextSignature = readProjectionIdentitySignature()
      changed = projectionIdentitySignature !== nextSignature
      projectionIdentitySignature = nextSignature
      if (changed) rowSelectionProjectionRevision += 1
    }
    if (changed) {
      rowSelectionAnchor = null
      copiedClipboardRange = null
      const groupingColumnsChanged = syncGroupingPresentation()
      if (groupingColumnsChanged && columnVirtualization && viewport) viewport.refresh()
      refreshSelectableProjectionRows()
      refreshRowSelectionHeaderState()
    }
    return changed
  }
  const refreshRowSelectionHeaderState = (): void => {
    if (options.rowSelection !== true) {
      rowSelectionHeaderState = { checked: false, mixed: false }
      return
    }
    const selectableCount = selectableProjectionRowIds.length
    const snapshot = api.rowSelection.getSnapshot()
    let selectedCount = 0
    if (snapshot?.mode === "all") {
      const excludedVisibleCount = (snapshot.excludedRows ?? [])
        .reduce<number>((count, rowId) => count + Number(selectableProjectionRowIdSet.has(rowId)), 0)
      selectedCount = selectableCount - excludedVisibleCount
    } else {
      selectedCount = (snapshot?.selectedRows ?? [])
        .reduce<number>((count, rowId) => count + Number(selectableProjectionRowIdSet.has(rowId)), 0)
    }
    rowSelectionHeaderState = {
      checked: selectableCount > 0 && selectedCount === selectableCount,
      mixed: selectedCount > 0 && selectedCount < selectableCount,
    }
  }

  const renderView = (reuseExistingCells: boolean): void => {
    if (destroyed) return
    if (renderBatchDepth > 0) {
      renderDeferred = true
      return
    }
    renderGrid({
      grid,
      api,
      columnModel,
      ...viewport?.getRenderState(),
      reuseExistingCells,
      columnReorder: options.columnReorder,
      columnMenu: options.columnMenu === true,
      cellClass: options.cellClass,
      cellStyle: options.cellStyle,
      emptyState: resolveEmptyState(api),
      emptyStateRenderer: options.emptyState,
      emptyStateAlignment: options.emptyStateAlignment ?? "content",
      rowSelection: options.rowSelection === true,
      rowSelectionHeaderState,
      copiedRange: copiedClipboardRange,
      groupLabelColumnKey: groupingPresentation.getLabelColumnKey(),
      treeData: options.treeData,
      getTreeLeafDepth: groupingPresentation.getLeafDepth,
    })
    canvasChrome?.sync()
    ganttView?.sync()
    fillHandle?.sync()
    rangeMove?.sync()
    if (headerWidthInvalidated) {
      headerWidthInvalidated = false
      headerScrollSync.refresh()
    }
  }
  const updateView = (): void => renderView(false)
  viewport = createMountResource(() => createDomViewportController({
    runtime,
    service: viewportService,
    grid,
    rowVirtualization,
    columnVirtualization,
    rowSelection: options.rowSelection === true,
    onWindowChanged: () => {
      renderView(!columnsInvalidated)
      columnsInvalidated = false
    },
  }), controller => controller?.detach())
  if (options.gridChrome === "canvas") {
    canvasChrome = createMountResource(() => createDomCanvasGridChromeController({
      grid,
      rowSelection: options.rowSelection === true,
      resolveViewportState: () => viewport?.getRenderState() ?? {},
    }), controller => controller.detach())
  }
  runWithRenderBatch = async (operation: () => Promise<void>): Promise<void> => {
    renderBatchDepth += 1
    let pending: Promise<void>
    try {
      // Batch only the synchronous prefix. The operation may wait on a remote
      // datasource; holding the render lock across that wait would also hide
      // unrelated row, selection, and viewport updates.
      pending = operation()
    } finally {
      renderBatchDepth -= 1
      if (renderBatchDepth === 0 && renderDeferred) {
        renderDeferred = false
        updateView()
      }
    }
    await pending
  }

  const selection = createDomCellSelectionController({
    api,
    getColumnCount: () => columnModel.getSnapshot().visibleColumns.length,
  })
  if (options.viewMode === "gantt") {
    ganttView = createMountResource(() => createDomGanttView({
      host: element,
      grid,
      api,
      options: options.gantt ?? {},
      rowHeight: rowVirtualization?.rowHeight ?? 36,
      getColumnCount: () => columnModel.getSnapshot().visibleColumns.length,
      setRowSelection: (rowIndex, rowId, columnCount) => {
        if (columnCount <= 0) return
        const anchor = { rowIndex, colIndex: 0, rowId }
        const focus = { rowIndex, colIndex: columnCount - 1, rowId }
        selection.setCellSelection(focus, anchor, "datagrid-dom-gantt-task")
      },
      recordIntent: history.recordIntent,
      onHistoryKeyDown: history.onKeyDown,
    }), view => view.detach())
  }
  const toggleGroup = (groupKey: string): void => {
    const activeCell = api.selection.getSnapshot()?.activeCell
    const activeRow = activeCell ? api.rows.get(activeCell.rowIndex) : null
    const wasActiveGroup = activeRow?.kind === "group"
      && activeRow.groupMeta?.groupKey === groupKey
    api.rows.toggleGroup(groupKey)
    const activeRowIsNowCollapsed = activeCell != null
      && activeRow != null
      && api.rows.resolveById(activeRow.rowId).status === "ancestor-collapsed"
    if (!wasActiveGroup && !activeRowIsNowCollapsed) return

    let rowIndex = -1
    for (let index = 0; index < api.rows.getCount(); index += 1) {
      const row = api.rows.get(index)
      if (row?.kind === "group" && row.groupMeta?.groupKey === groupKey) {
        rowIndex = index
        break
      }
    }
    if (rowIndex < 0 || !activeCell) return
    const row = api.rows.get(rowIndex)
    if (!row) return
    const point = {
      rowIndex,
      colIndex: Math.min(activeCell.colIndex, Math.max(0, columnModel.getSnapshot().visibleColumns.length - 1)),
      rowId: row.rowId,
    }
    selection.setCellSelection(point, point, "datagrid-dom-group-toggle")
  }
  rangeMove = createMountResource(() => createDomRangeMoveController({
    grid,
    api,
    columnModel,
    runWithRenderBatch,
    recordIntent: history.recordIntent,
    setCellSelection: selection.setCellSelection,
  }), controller => controller.dispose())
  const pointerSelection = createMountResource(() => createDomCellPointerSelectionController({
    grid,
    api,
    // A drag that starts in a pinned column may continue into the center pane.
    // Sticky positioning keeps the origin cell stable while the body scrolls.
    resolveAllowHorizontalAutoScroll: () => true,
    setCellSelection: selection.setCellSelection,
  }), controller => controller.dispose())
  const revealCell = (rowIndex: number, columnIndex: number): void => {
    if (viewport) {
      viewport.revealCell(rowIndex, columnIndex)
      return
    }
    const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")
    if (body && !revealMountedDomCell(body, rowIndex, columnIndex)) {
      grid.querySelector<HTMLElement>(`[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`)
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
    }
  }
  const clipboard = createMountResource(() => createDomClipboardController({
    grid,
    api,
    columnModel,
    setCellSelection: (start, end) => selection.setCellSelection(end, start, "datagrid-dom-paste"),
    runWithRenderBatch,
    recordIntent: history.recordIntent,
    onCopiedSelectionChange: range => {
      copiedClipboardRange = range
      renderView(false)
    },
  }), controller => controller.dispose())
  const inlineEditing = createMountResource(() => createDomInlineEditingController({
    api,
    columnModel,
    grid,
    setCellSelection: selection.setCellSelection,
    revealCell,
    updateView,
    recordIntent: history.recordIntent,
  }), controller => controller.dispose())
  fillHandle = createMountResource(() => createDomFillHandleController({
    grid,
    api,
    clipboard,
    enabled: options.fillHandle === true,
  }), controller => controller.dispose())
  const cellToggle = createDomCellToggleController({
    api,
    columnModel,
    recordIntent: history.recordIntent,
    updateView,
  })
  commitInlineEdit = inlineEditing.commitActiveEdit
  const navigation = createDomCellNavigationController({
    api,
    columnModel,
    setCellSelection: selection.setCellSelection,
    toggleGroup,
    tryStartInlineEdit: inlineEditing.tryStartFromKey,
    isCellToggle: cellToggle.isKeyboardToggle,
    toggleCell: cellToggle.toggleCell,
    revealCell,
  })

  const onCellClick = (event: MouseEvent): void => {
    const target = event.target as Element | null
    if (target?.closest?.("[data-fill-handle], [data-fill-action]")) return
    if (rangeMove?.consumeClick()) {
      pointerSelection.consumeClick()
      return
    }
    if (target?.closest?.("[data-row-selection-toggle], [data-row-selection-select-all]")) {
      pointerSelection.consumeClick()
      return
    }
    if (target?.closest?.("[data-group-toggle]")) {
      pointerSelection.consumeClick()
      return
    }
    const pointerOutcome = pointerSelection.consumeClick()
    if (pointerOutcome === "dragged") return
    const cell = target?.closest?.(".affino-grid-dom__cell[data-row-index][data-column-index]") as HTMLElement | null
    if (!cell) return
    const rowIndex = Number(cell.dataset.rowIndex)
    const columnIndex = Number(cell.dataset.columnIndex)
    const row = api.rows.get(rowIndex)
    const column = columnModel.getSnapshot().visibleColumns[columnIndex]
    if (!row || !column) return

    if (api.selection.hasSupport() && pointerOutcome === "none") {
      const point = { rowIndex, colIndex: columnIndex, rowId: row.rowId }
      const snapshot = event.shiftKey && api.selection.getSnapshotStatus() === "current"
        ? api.selection.getSnapshot()
        : null
      const anchor = snapshot?.ranges[snapshot.activeRangeIndex]?.anchor ?? point
      grid.focus({ preventScroll: true })
      selection.setCellSelection(
        point,
        { rowIndex: anchor.rowIndex, colIndex: anchor.colIndex, rowId: anchor.rowId },
        event.shiftKey ? "datagrid-dom-shift-cell-click" : "datagrid-dom-cell-click",
        event.shiftKey ? "extend" : event.ctrlKey || event.metaKey ? "add" : "replace",
      )
    }
    cellToggle.handleCellClick(rowIndex, columnIndex)
  }
  const onRowSelectionClick = (event: MouseEvent): void => {
    const input = event.target as HTMLInputElement | null
    if (!input?.matches?.("[data-row-selection-toggle], [data-row-selection-select-all]")) return
    rowSelectionShiftByInput.set(input, event.shiftKey)
  }

  const onRowSelectionChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null
    if (!input?.matches?.("[data-row-selection-toggle], [data-row-selection-select-all]")) return
    const shiftKey = rowSelectionShiftByInput.get(input) ?? false
    rowSelectionShiftByInput.delete(input)
    const selected = input.checked
    if (input?.matches?.("[data-row-selection-select-all]")) {
      if (selected) {
        api.rowSelection.setSnapshot({
          focusedRow: api.rowSelection.getFocusedRow(),
          selectedRows: [],
          mode: "all",
          excludedRows: [],
        }, { origin: "datagrid-dom-select-visible-rows" })
      } else {
        api.rowSelection.clearSelectedRows({ origin: "datagrid-dom-deselect-visible-rows" })
      }
      grid.focus({ preventScroll: true })
      return
    }
    const rowElement = input.closest<HTMLElement>("[data-row-index]")
    const rowIndex = Number(rowElement?.dataset.rowIndex)
    const row = Number.isInteger(rowIndex) ? api.rows.get(rowIndex) : null
    if (!row || row.kind !== "leaf") return
    const context = { origin: "datagrid-dom-row-checkbox" }
    if (shiftKey && rowSelectionAnchor
      && rowSelectionAnchor.projectionRevision === rowSelectionProjectionRevision) {
      const range = resolveDataGridSelectableRowRange({
        anchorRowId: rowSelectionAnchor.rowId,
        targetRowId: row.rowId,
        projectionRevision: rowSelectionAnchor.projectionRevision,
        currentProjectionRevision: rowSelectionProjectionRevision,
        resolveRowIndexById: rowId => {
          const resolved = api.rows.resolveById(rowId)
          return resolved.status === "loaded" && resolved.row.displayIndex >= 0
            ? resolved.row.displayIndex
            : null
        },
        resolveRowAtIndex: index => {
          const candidate = api.rows.get(index)
          if (!candidate) return null
          return {
            rowId: candidate.rowId,
            kind: candidate.kind === "leaf" ? "data" : candidate.kind,
          }
        },
      })
      if (range.status === "complete") {
        if (selected) api.rowSelection.selectRows(range.rowIds, context)
        else api.rowSelection.deselectRows(range.rowIds, context)
      } else {
        api.rowSelection.setSelected(row.rowId, selected, context)
        rowSelectionAnchor = { rowId: row.rowId, projectionRevision: rowSelectionProjectionRevision }
      }
    } else {
      api.rowSelection.setSelected(row.rowId, selected, context)
      rowSelectionAnchor = { rowId: row.rowId, projectionRevision: rowSelectionProjectionRevision }
    }
    grid.focus({ preventScroll: true })
  }
  const onGroupToggle = (event: MouseEvent): void => {
    const target = event.target as Element | null
    const toggle = target?.closest?.<HTMLButtonElement>("[data-group-toggle]")
    const groupKey = toggle?.dataset.groupToggle
    if (!groupKey) return
    event.preventDefault()
    toggleGroup(groupKey)
    grid.focus({ preventScroll: true })
  }

  const onRowsChanged = (event: { snapshot: ReturnType<typeof api.rows.getSnapshot> }): void => {
    syncProjectionRevision(event.snapshot)
    updateView()
  }
  const unsubscribeRows = api.events.on("rows:changed", onRowsChanged)
  mountDisposers.push(unsubscribeRows)
  const onProjectionChanged = (event: { snapshot: ReturnType<typeof api.rows.getSnapshot>; nextVersion: number }): void => {
    const nextGroupByFields = [...(event.snapshot.groupBy?.fields ?? [])]
    const addedGroupField = nextGroupByFields.some(field => !previousGroupByFields.includes(field))
    previousGroupByFields = nextGroupByFields
    const projectionChanged = syncProjectionRevision(event.snapshot, event.nextVersion)
    if (addedGroupField) scheduleGroupScrollReset()
    if (!projectionChanged) return
    updateView()
  }
  const scheduleGroupScrollReset = (): void => {
    const window = grid.ownerDocument.defaultView
    if (!window) return
    if (groupScrollResetFrame != null) window.cancelAnimationFrame(groupScrollResetFrame)
    groupScrollResetFrame = window.requestAnimationFrame(() => {
      groupScrollResetFrame = null
      if (destroyed) return
      const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")
      if (!body || body.scrollLeft === 0) return
      body.scrollLeft = 0
      body.dispatchEvent(new Event("scroll", { bubbles: true }))
    })
  }
  const unsubscribeProjection = api.events.on("projection:recomputed", onProjectionChanged)
  mountDisposers.push(unsubscribeProjection)
  const onColumnsChanged = (): void => {
    copiedClipboardRange = null
    columnsInvalidated = true
    headerWidthInvalidated = true
    // Group presentation may update visibility, pin state, and order in one
    // synchronous pass. Its nested column events are already represented by
    // the final snapshot, so render and refresh the viewport once.
    if (groupingPresentationSyncActive) return
    syncGroupingPresentation()
    if (columnVirtualization && viewport) viewport.refresh()
    updateView()
  }
  const unsubscribeColumns = api.events.on("columns:changed", onColumnsChanged)
  mountDisposers.push(unsubscribeColumns)
  const unsubscribeSelection = api.events.on("selection:changed", updateView)
  mountDisposers.push(unsubscribeSelection)
  const onRowSelectionChanged = (): void => {
    refreshRowSelectionHeaderState()
    updateView()
  }
  const unsubscribeRowSelection = api.events.on("row-selection:changed", onRowSelectionChanged)
  mountDisposers.push(unsubscribeRowSelection)
  grid.addEventListener("click", onCellClick)
  grid.addEventListener("click", onRowSelectionClick)
  grid.addEventListener("change", onRowSelectionChange)
  grid.addEventListener("click", onGroupToggle)
  grid.addEventListener("click", inlineEditing.onCellClick)
  grid.addEventListener("dblclick", inlineEditing.onCellDoubleClick)
  grid.addEventListener("keydown", navigation.onKeyDown)
  grid.addEventListener("keydown", history.onKeyDown)
  mountDisposers.push(() => {
    grid.removeEventListener("click", onCellClick)
    grid.removeEventListener("click", onRowSelectionClick)
    grid.removeEventListener("change", onRowSelectionChange)
    grid.removeEventListener("click", onGroupToggle)
    grid.removeEventListener("click", inlineEditing.onCellClick)
    grid.removeEventListener("dblclick", inlineEditing.onCellDoubleClick)
    grid.removeEventListener("keydown", navigation.onKeyDown)
    grid.removeEventListener("keydown", history.onKeyDown)
  })

  let ready: Promise<void> = Promise.resolve()
  const destroy = (): Promise<void> => {
    if (destroyPromise) return destroyPromise
    destroyed = true
    if (groupScrollResetFrame != null) {
      grid.ownerDocument.defaultView?.cancelAnimationFrame(groupScrollResetFrame)
      groupScrollResetFrame = null
    }
    unsubscribeRows()
    unsubscribeProjection()
    unsubscribeColumns()
    unsubscribeSelection()
    unsubscribeRowSelection()
    groupingPresentation.dispose()
    fillHandle?.dispose()
    rangeMove?.dispose()
    grid.removeEventListener("click", onCellClick)
    grid.removeEventListener("click", onRowSelectionClick)
    grid.removeEventListener("change", onRowSelectionChange)
    grid.removeEventListener("click", onGroupToggle)
    grid.removeEventListener("click", inlineEditing.onCellClick)
    grid.removeEventListener("dblclick", inlineEditing.onCellDoubleClick)
    grid.removeEventListener("keydown", navigation.onKeyDown)
    grid.removeEventListener("keydown", history.onKeyDown)
    pointerSelection.dispose()
    columnResize.dispose()
    columnReorder?.dispose()
    headerSort.dispose()
    inlineEditing.dispose()
    clipboard.dispose()
    headerScrollSync.detach()
    viewport?.detach()
    canvasChrome?.detach()
    ganttView?.detach()
    grid.remove()

    destroyPromise = (async () => {
      await ready.catch(() => undefined)
      await runtime.stop()
    })()
    return destroyPromise
  }
  try {
    syncGroupingPresentation()
    refreshSelectableProjectionRows()
    refreshRowSelectionHeaderState()
    updateView()
    headerScrollSync.attach()
    viewport?.attach()
    canvasChrome?.attach()
  } catch (error) {
    rollbackMountSetup()
    throw error
  }
  mountDisposers.length = 0
  ready = runtime.start().then(() => {
    if (destroyed) return
    if (viewport) viewport.refresh()
    else updateView()
  }).catch(error => {
    void destroy().catch(cleanupError => {
      console.error("[DataGridDom] cleanup failed after runtime startup failure.", cleanupError)
    })
    throw error
  })

  return {
    api,
    ready,
    destroy,
  }
}

function resolveEmptyState<TRow>(api: DataGridApi<TRow>) {
  const snapshot = api.rows.getSnapshot()
  if (api.rows.getCount() > 0 || snapshot.loading || snapshot.initialLoading || snapshot.error) return null
  const hasActiveFilters = hasActiveFilterModel(snapshot.filterModel)
  return {
    reason: hasActiveFilters ? "filtered" as const : "no-rows" as const,
    hasActiveFilters,
    rowCount: 0 as const,
  }
}

function hasActiveFilterModel(filterModel: DataGridFilterSnapshot | null): boolean {
  if (!filterModel) return false
  if (Object.values(filterModel.columnFilters ?? {}).some(Boolean)) return true
  if (filterModel.advancedExpression) return true
  return typeof filterModel.quickFilter?.query === "string"
    && filterModel.quickFilter.query.trim().length > 0
}

function resolveProjectionRevision<TRow>(snapshot: DataGridRowModelSnapshot<TRow>): number | null {
  const projection = snapshot.projection
  if (!projection) return null
  if (Number.isFinite(projection.recomputeVersion)) return projection.recomputeVersion ?? null
  return Number.isFinite(projection.version) ? projection.version : null
}

function createGridElement<TRow>(
  element: HTMLElement,
  options: DataGridDomOptions<TRow>,
  viewportEnabled: boolean,
  rowVirtualization: Exclude<DataGridDomOptions<TRow>["rowVirtualization"], false | undefined> | null,
  columnVirtualization: Exclude<DataGridDomOptions<TRow>["columnVirtualization"], false | undefined> | null,
): HTMLDivElement {
  const grid = element.ownerDocument.createElement("div")
  grid.className = [
    "affino-grid-dom",
    viewportEnabled ? "affino-grid-dom--virtualized" : null,
    options.gridChrome === "canvas" ? "affino-grid-dom--canvas-chrome" : null,
    rowVirtualization ? "affino-grid-dom--row-virtualized" : null,
    columnVirtualization ? "affino-grid-dom--column-virtualized" : null,
    options.className,
  ].filter(Boolean).join(" ")
  grid.id = element.id ? `${element.id}--grid` : `affino-grid-dom-${++nextGridDomId}`
  grid.setAttribute("role", "grid")
  grid.setAttribute("aria-label", options.label ?? "Data grid")
  grid.tabIndex = 0
  element.replaceChildren(grid)
  return grid
}
