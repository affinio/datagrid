import type {
  DataGridApi,
  DataGridColumnModel,
  DataGridColumnSnapshot,
  DataGridRowNode,
  DataGridSelectionSnapshot,
  DataGridTreeDataSpec,
} from "@affino/datagrid-core"
import type { DataGridCellInteractionInvocationTrigger } from "@affino/datagrid-core"
import type {
  DataGridDomCellClassResolver,
  DataGridDomCellStyleResolver,
  DataGridDomCellRendererInteractiveContext,
  DataGridDomColumnInput,
  DataGridDomEmptyStateProps,
} from "../adapter/contracts.js"
import {
  buildDataGridCellRenderModel,
  invokeDataGridCellInteraction,
  resolveDataGridCellInteraction,
  resolveDataGridCellClickAction,
  toggleDataGridCellValue,
} from "@affino/datagrid-core"
import {
  createDataGridDomFormulaFieldIndex,
  resolveDataGridDomFormulaCellValue,
  type DataGridDomFormulaFieldIndex,
} from "../adapter/formulaCellValue.js"
import { reconcileChildren } from "./reconcileChildren.js"
import { DOM_ROW_SELECTION_COLUMN_WIDTH } from "../adapter/rowSelectionConstants.js"

export interface RenderGridInput<TRow> {
  grid: HTMLDivElement
  api: DataGridApi<TRow>
  columnModel: DataGridColumnModel
  /** Viewport-only update: data, columns and selection have not changed. */
  reuseExistingCells?: boolean
  columnReorder?: boolean
  columnMenu?: boolean
  groupLabelColumnKey?: string | null
  treeData?: DataGridTreeDataSpec<TRow> | null
  cellClass?: DataGridDomCellClassResolver<TRow>
  cellStyle?: DataGridDomCellStyleResolver<TRow>
  emptyState?: DataGridDomEmptyStateProps | null
  emptyStateRenderer?: (state: DataGridDomEmptyStateProps) => Node | string | null
  emptyStateAlignment?: "content" | "viewport"
  getTreeLeafDepth?: (row: DataGridRowNode<TRow>) => number
  rowSelection?: boolean
  rowSelectionHeaderState?: Readonly<{ checked: boolean; mixed: boolean }>
  copiedRange?: Readonly<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> | null
  virtualRows?: {
    startIndex: number
    endIndex: number
    totalRowCount: number
    rowHeight: number
  }
  virtualColumns?: {
    columns: readonly { index: number; width: number; pin: "left" | "right" | "none"; offset: number }[]
    leftPadding: number
    rightPadding: number
  }
}

const customCellClasses = new WeakMap<HTMLElement, Set<string>>()
const customCellStyles = new WeakMap<HTMLElement, Map<string, string>>()

type RenderColumn = {
  column: DataGridColumnSnapshot
  index: number
  width: number | null
  pin: "left" | "right" | "none"
  offset: number
}

interface RenderColumnGroups {
  pinnedLeft: readonly RenderColumn[]
  scrollable: readonly RenderColumn[]
  pinnedRight: readonly RenderColumn[]
}

export function renderGrid<TRow>(input: RenderGridInput<TRow>): void {
  const { grid, api, columnModel } = input
  const document = grid.ownerDocument
  const allColumns = columnModel.getSnapshot().visibleColumns
  const sortModel = api.rows.getSnapshot().sortModel
  const groupDepth = api.rows.getSnapshot().groupBy?.fields.length ?? 0
  const rowSelectionEnabled = input.rowSelection === true && api.rowSelection.hasSupport()
  const rowSelectionWidth = rowSelectionEnabled ? DOM_ROW_SELECTION_COLUMN_WIDTH : 0
  const virtualColumns = input.virtualColumns
  const columns: readonly RenderColumn[] = virtualColumns
    ? virtualColumns.columns.flatMap(metric => {
      const column = allColumns[metric.index]
      return column ? [{
        ...metric,
        ...(rowSelectionWidth > 0 && metric.pin === "left" ? { offset: metric.offset + rowSelectionWidth } : {}),
        column,
      }] : []
    })
    : resolvePinnedColumns(allColumns, rowSelectionWidth)
  const columnGroups: RenderColumnGroups = {
    pinnedLeft: columns.filter(column => column.pin === "left"),
    scrollable: columns.filter(column => column.pin === "none"),
    pinnedRight: columns.filter(column => column.pin === "right"),
  }
  const pinnedLeftTracks = [
    ...(rowSelectionEnabled ? [`${rowSelectionWidth}px`] : []),
    ...columnGroups.pinnedLeft.map(column => `${column.width ?? 120}px`),
  ]
  const pinnedRightTracks = columnGroups.pinnedRight.map(column => `${column.width ?? 120}px`)
  const centerTracks = virtualColumns
    ? [
      ...(virtualColumns.leftPadding > 0 ? [`${virtualColumns.leftPadding}px`] : []),
      ...columnGroups.scrollable.map(column => `${column.width ?? 120}px`),
      ...(virtualColumns.rightPadding > 0 ? [`${virtualColumns.rightPadding}px`] : []),
    ]
    : columnGroups.scrollable.map((column, index, centerColumns) => {
      if (column.width == null) return "minmax(120px, 1fr)"
      return index === centerColumns.length - 1
        ? `minmax(${column.width}px, 1fr)`
        : `${column.width}px`
    })
  const columnTracks = [...pinnedLeftTracks, ...centerTracks, ...pinnedRightTracks]
  const pinnedLeftWidth = rowSelectionWidth
    + columnGroups.pinnedLeft.reduce((sum, column) => sum + (column.width ?? 120), 0)
  const pinnedRightWidth = columnGroups.pinnedRight.reduce((sum, column) => sum + (column.width ?? 120), 0)
  const centerMinWidth = virtualColumns
    ? virtualColumns.leftPadding + virtualColumns.rightPadding
      + columnGroups.scrollable.reduce((sum, column) => sum + (column.width ?? 120), 0)
    : columnGroups.scrollable.reduce((sum, column) => sum + (column.width ?? 120), 0)
  const hasPinnedLeftHeaderCells = rowSelectionEnabled || columnGroups.pinnedLeft.length > 0
  const hasCenterHeaderCells = columnGroups.scrollable.length > 0
  const headerGroupDepth = Math.max(0, ...allColumns.map(column => column.groupPath.length))
  const headerRowCount = headerGroupDepth + 1
  const groupLabelsAlreadyRendered = Array.from({ length: headerGroupDepth }, () => new Set<string>())
  grid.style.setProperty(
    "--affino-grid-dom-columns",
    columnTracks.join(" ") || "minmax(0, 1fr)",
  )
  grid.style.setProperty("--affino-grid-dom-pinned-left-width", `${pinnedLeftWidth}px`)
  grid.style.setProperty("--affino-grid-dom-pinned-right-width", `${pinnedRightWidth}px`)
  grid.style.setProperty("--affino-grid-dom-row-selection-width", `${rowSelectionWidth}px`)
  grid.style.setProperty("--affino-grid-dom-center-min-width", `${centerMinWidth}px`)
  grid.style.setProperty("--affino-grid-dom-content-min-width", `${pinnedLeftWidth + centerMinWidth + pinnedRightWidth}px`)
  grid.style.setProperty("--affino-grid-dom-left-columns", pinnedLeftTracks.join(" ") || "minmax(0, 1fr)")
  grid.style.setProperty("--affino-grid-dom-center-columns", centerTracks.join(" ") || "minmax(0, 1fr)")
  grid.style.setProperty("--affino-grid-dom-right-columns", pinnedRightTracks.join(" ") || "minmax(0, 1fr)")
  grid.setAttribute("aria-colcount", String(allColumns.length + (rowSelectionEnabled ? 1 : 0)))

  const existingHeaderShell = grid.querySelector<HTMLDivElement>(".affino-grid-dom__header-shell")
  const existingHeader = grid.querySelector<HTMLDivElement>(".affino-grid-dom__header-viewport")
  const existingBody = grid.querySelector<HTMLDivElement>(".affino-grid-dom__body")
  const existingPinnedBottom = grid.querySelector<HTMLDivElement>(".affino-grid-dom__pinned-bottom")
  const reuse = input.reuseExistingCells === true && existingHeaderShell != null && existingHeader != null && existingBody != null
  const formulaFieldsByTarget = reuse
    ? null
    : createDataGridDomFormulaFieldIndex(api)
  const headerShell = reuse ? existingHeaderShell : document.createElement("div")
  if (!reuse) {
    headerShell.className = "affino-grid-dom__header-shell"
    headerShell.setAttribute("role", "presentation")
  }
  const leftHeaderPane = getHeaderPane(headerShell, "left", reuse, document)
  const centerHeaderPane = getHeaderPane(headerShell, "center", reuse, document)
  const rightHeaderPane = getHeaderPane(headerShell, "right", reuse, document)
  const leftHeaderRows = renderHeaderPaneRows({ pinnedLeft: columnGroups.pinnedLeft, scrollable: [], pinnedRight: [] }, {
    document, pane: "left", existing: reuse ? leftHeaderPane : null, headerGroupDepth,
    columnReorder: input.columnReorder === true, columnMenu: input.columnMenu === true, sortModel, columnIndexOffset: rowSelectionEnabled ? 1 : 0,
    includeRowSelection: rowSelectionEnabled, rowSelectionHeaderState: input.rowSelectionHeaderState,
    drawStartEdge: hasPinnedLeftHeaderCells, rowSelectionEnabled, groupLabelsAlreadyRendered,
  })
  const leftHeaderOverlay = getHeaderOverlayLayer(leftHeaderPane, reuse, document)
  const centerHeaderRows = renderHeaderPaneRows({ pinnedLeft: [], scrollable: columnGroups.scrollable, pinnedRight: [] }, {
    document, pane: "center", existing: reuse ? centerHeaderPane : null, headerGroupDepth,
    columnReorder: input.columnReorder === true, columnMenu: input.columnMenu === true, sortModel, virtualColumns,
    columnIndexOffset: rowSelectionEnabled ? 1 : 0,
    drawStartEdge: !hasPinnedLeftHeaderCells && hasCenterHeaderCells, groupLabelsAlreadyRendered,
  })
  const rightHeaderRows = renderHeaderPaneRows({ pinnedLeft: [], scrollable: [], pinnedRight: columnGroups.pinnedRight }, {
    document, pane: "right", existing: reuse ? rightHeaderPane : null, headerGroupDepth,
    columnReorder: input.columnReorder === true, columnMenu: input.columnMenu === true, sortModel, columnIndexOffset: rowSelectionEnabled ? 1 : 0,
    drawStartEdge: !hasPinnedLeftHeaderCells && !hasCenterHeaderCells && columnGroups.pinnedRight.length > 0,
    groupLabelsAlreadyRendered,
  })
  reconcileChildren(leftHeaderPane, [...leftHeaderRows, leftHeaderOverlay])
  if (rowSelectionEnabled) {
    spanRowSelectionHeaderCell(leftHeaderRows.at(-1)!, leftHeaderOverlay, input.rowSelectionHeaderState)
  }
  reconcileChildren(centerHeaderPane, centerHeaderRows)
  reconcileChildren(rightHeaderPane, rightHeaderRows)
  if (!reuse) headerShell.append(leftHeaderPane, centerHeaderPane, rightHeaderPane)
  const body = reuse ? existingBody : document.createElement("div")
  if (!reuse) {
    body.className = "affino-grid-dom__body"
    body.setAttribute("role", "rowgroup")
  }
  const existingRows = new Map(reuse
    ? Array.from(body.children).flatMap(child => {
      const row = child as HTMLDivElement
      return row.dataset.rowIndex != null ? [[row.dataset.rowIndex, row] as const] : []
    })
    : [])
  const existingPinnedRows = new Map(reuse && existingPinnedBottom
    ? Array.from(existingPinnedBottom.children).flatMap(child => {
      const row = child as HTMLDivElement
      return row.dataset.rowIndex != null ? [[row.dataset.rowIndex, row] as const] : []
    })
    : [])
  const existingChromeAnchor = existingBody?.querySelector(":scope > .affino-grid-dom__chrome-anchor") ?? null
  const bodyChildren: Node[] = existingChromeAnchor ? [existingChromeAnchor] : []
  const pinnedBottomChildren: Node[] = []

  const rowCount = api.rows.getCount()
  const pivotActive = api.rows.getSnapshot().pivotModel != null
  const selection = api.selection.getSnapshot()
  const virtualRows = input.virtualRows
  grid.setAttribute("aria-rowcount", String((virtualRows?.totalRowCount ?? rowCount) + headerRowCount))
  if (virtualRows) {
    grid.style.setProperty("--affino-grid-dom-row-height", `${virtualRows.rowHeight}px`)
  }
  const activeCell = selection?.activeCell
  if (activeCell && activeCell.rowIndex >= 0 && activeCell.rowIndex < rowCount
    && activeCell.colIndex >= 0 && activeCell.colIndex < allColumns.length
    && (!virtualColumns || columns.some(column => column.index === activeCell.colIndex))) {
    grid.setAttribute("aria-activedescendant", `${grid.id}--cell-${activeCell.rowIndex}-${activeCell.colIndex}`)
  } else {
    grid.removeAttribute("aria-activedescendant")
  }
  const renderStart = virtualRows
    ? Math.max(0, Math.min(virtualRows.startIndex, virtualRows.totalRowCount))
    : 0
  const renderEnd = virtualRows
    ? Math.min(virtualRows.totalRowCount - 1, virtualRows.endIndex)
    : rowCount - 1
  const renderedRows = renderEnd >= renderStart
    ? api.rows.getRange({ start: renderStart, end: renderEnd })
    : []
  if (rowCount === 0 && input.emptyState) {
    const emptyState = document.createElement("div")
    emptyState.className = "affino-grid-dom__empty-state"
    if (input.emptyStateAlignment === "viewport") {
      emptyState.classList.add("affino-grid-dom__empty-state--viewport")
    }
    emptyState.setAttribute("role", "status")
    emptyState.setAttribute("aria-live", "polite")
    emptyState.setAttribute("aria-atomic", "true")
    const content = input.emptyStateRenderer
      ? input.emptyStateRenderer(input.emptyState)
      : input.emptyState.reason === "filtered"
        ? "No rows match the current filters."
        : "No rows to display."
    if (typeof content === "string") emptyState.textContent = content
    else if (content) emptyState.append(content)
    bodyChildren.push(emptyState)
  }
  if (virtualRows && renderStart > 0) {
    bodyChildren.push(createVirtualSpacer(renderStart * virtualRows.rowHeight, document))
  }
  for (let rowIndex = renderStart; rowIndex <= renderEnd; rowIndex += 1) {
    const row = renderedRows[rowIndex - renderStart] ?? api.rows.get(rowIndex)
    if (row) {
      const previous = existingRows.get(String(rowIndex)) ?? existingPinnedRows.get(String(rowIndex))
      const renderedRow = renderDataRow(
        row, rowIndex, columnGroups, selection, api, grid.id, document, virtualColumns,
        previous?.dataset.rowId === String(row.rowId) ? previous : null,
        input.groupLabelColumnKey ?? null,
        groupDepth,
        input.treeData ?? null,
        input.getTreeLeafDepth,
        rowSelectionEnabled,
        formulaFieldsByTarget,
        input.cellClass,
        input.cellStyle,
        pivotActive,
        headerRowCount,
        input.copiedRange ?? null,
      )
      if (!virtualRows && row.state.pinned === "bottom") pinnedBottomChildren.push(renderedRow)
      else bodyChildren.push(renderedRow)
    }
  }
  if (virtualRows) {
    const trailingRows = Math.max(0, virtualRows.totalRowCount - renderEnd - 1)
    if (trailingRows > 0) bodyChildren.push(createVirtualSpacer(trailingRows * virtualRows.rowHeight, document))
  }
  if (reuse) {
    reconcileChildren(body, bodyChildren)
    reconcilePinnedBottom(grid, existingPinnedBottom, pinnedBottomChildren, document)
    grid.classList.toggle("affino-grid-dom--has-pinned-bottom", pinnedBottomChildren.length > 0)
    return
  }
  if (existingChromeAnchor) {
    // Full reconciliation compares body children by position. Keep the live
    // canvas node in the existing body and use a markup twin as its next-tree
    // counterpart so the recursive reconciler cannot move or consume it.
    const anchorIndex = bodyChildren.indexOf(existingChromeAnchor)
    if (anchorIndex >= 0) bodyChildren[anchorIndex] = existingChromeAnchor.cloneNode(true)
  }
  body.append(...bodyChildren)
  const pinnedBottom = createPinnedBottomShell(existingPinnedBottom, pinnedBottomChildren, document)
  grid.classList.toggle("affino-grid-dom--has-pinned-bottom", pinnedBottomChildren.length > 0)
  if (!existingHeaderShell || !existingBody) {
    grid.replaceChildren(headerShell, body, ...(pinnedBottom ? [pinnedBottom] : []))
    return
  }
  reconcileElement(existingHeaderShell, headerShell)
  reconcileElement(existingBody, body)
  if (pinnedBottom) {
    if (existingPinnedBottom) reconcileElement(existingPinnedBottom, pinnedBottom)
    else grid.append(pinnedBottom)
  } else {
    existingPinnedBottom?.remove()
  }
}

function createPinnedBottomShell(
  existing: HTMLDivElement | null,
  children: readonly Node[],
  document: Document,
): HTMLDivElement | null {
  if (children.length === 0) return null
  const shell = existing ?? document.createElement("div")
  shell.className = "affino-grid-dom__pinned-bottom"
  shell.setAttribute("role", "rowgroup")
  reconcileChildren(shell, children)
  return shell
}

function reconcilePinnedBottom(
  grid: HTMLElement,
  existing: HTMLDivElement | null,
  children: readonly Node[],
  document: Document,
): void {
  const shell = createPinnedBottomShell(existing, children, document)
  if (!shell) {
    existing?.remove()
    return
  }
  if (existing) reconcileChildren(existing, children)
  else grid.append(shell)
}

function renderHeaderPaneRows(
  columns: RenderColumnGroups,
  options: {
    document: Document
    pane: "left" | "center" | "right"
    existing: HTMLElement | null
    headerGroupDepth: number
    columnReorder: boolean
    columnMenu: boolean
    sortModel: readonly { key: string; direction: "asc" | "desc" }[]
    virtualColumns?: RenderGridInput<unknown>["virtualColumns"]
    columnIndexOffset: number
    includeRowSelection?: boolean
    rowSelectionHeaderState?: Readonly<{ checked: boolean; mixed: boolean }>
    drawStartEdge: boolean
    rowSelectionEnabled?: boolean
    groupLabelsAlreadyRendered: readonly Set<string>[]
  },
): HTMLDivElement[] {
  const rows: HTMLDivElement[] = []
  for (let depth = 0; depth < options.headerGroupDepth; depth += 1) {
    rows.push(renderColumnGroupHeaderRow(columns, options.document, {
      depth,
      pane: options.pane,
      virtualColumns: options.virtualColumns,
      existing: options.existing?.children.item(depth) as HTMLDivElement | null,
      columnIndexOffset: options.columnIndexOffset,
      rowSelectionEnabled: options.rowSelectionEnabled === true,
      drawStartEdge: options.drawStartEdge,
      groupLabelsAlreadyRendered: options.groupLabelsAlreadyRendered[depth]!,
    }))
  }
  rows.push(renderHeaderRow(
    columns,
    options.document,
    options.virtualColumns,
    options.existing?.children.item(options.headerGroupDepth) as HTMLDivElement | null,
    options.columnReorder,
    options.columnMenu,
    options.pane,
    options.sortModel,
    options.columnIndexOffset,
    options.includeRowSelection,
    options.rowSelectionHeaderState,
    options.drawStartEdge,
    options.headerGroupDepth + 1,
    options.headerGroupDepth,
  ))
  return rows
}

function renderColumnGroupHeaderRow(
  columns: RenderColumnGroups,
  document: Document,
  options: {
    depth: number
    pane: "left" | "center" | "right"
    virtualColumns?: RenderGridInput<unknown>["virtualColumns"]
    existing: HTMLDivElement | null
    columnIndexOffset: number
    rowSelectionEnabled: boolean
    drawStartEdge: boolean
    groupLabelsAlreadyRendered: Set<string>
  },
): HTMLDivElement {
  const row = options.existing ?? document.createElement("div")
  const cells = collectColumnChildren(options.existing)
  const entries = [...columns.pinnedLeft, ...columns.scrollable, ...columns.pinnedRight]
  const children: Node[] = []
  if (!options.existing) {
    row.className = `affino-grid-dom__row affino-grid-dom__header-group-row affino-grid-dom__header--${options.pane}`
    row.setAttribute("role", options.pane === "center" ? "row" : "presentation")
  }
  if (options.pane === "center") row.setAttribute("aria-rowindex", String(options.depth + 1))

  const virtualLeftTrack = options.pane === "center" && (options.virtualColumns?.leftPadding ?? 0) > 0 ? 1 : 0
  if (options.virtualColumns?.leftPadding) {
    const spacer = createColumnSpacer(options.virtualColumns.leftPadding, document, "left", cells.get("left"))
    spacer.style.gridColumn = "1"
    children.push(spacer)
  }

  let startIndex = 0
  while (startIndex < entries.length) {
    const first = entries[startIndex]!
    const group = first.column.groupPath[options.depth]
    const groupIdentity = group
      ? first.column.groupPath.slice(0, options.depth + 1).map(segment => segment.id).join("/")
      : null
    let endIndex = startIndex + 1
    while (endIndex < entries.length) {
      const previous = entries[endIndex - 1]!
      const next = entries[endIndex]!
      const nextGroup = next.column.groupPath[options.depth]
      const nextIdentity = nextGroup
        ? next.column.groupPath.slice(0, options.depth + 1).map(segment => segment.id).join("/")
        : null
      if (next.index !== previous.index + 1 || nextIdentity !== groupIdentity) break
      endIndex += 1
    }
    const span = endIndex - startIndex
    const cell = document.createElement("div")
    cell.className = "affino-grid-dom__cell affino-grid-dom__column-header affino-grid-dom__column-group-header"
    cell.dataset.columnGroupDepth = String(options.depth)
    const trackOffset = options.pane === "left" && options.rowSelectionEnabled ? 1 : virtualLeftTrack
    cell.style.gridColumn = `${trackOffset + startIndex + 1} / span ${span}`
    cell.style.gridRow = "1"
    if (group) {
      const isContinuation = options.groupLabelsAlreadyRendered.has(groupIdentity!)
      options.groupLabelsAlreadyRendered.add(groupIdentity!)
      cell.setAttribute("role", "columnheader")
      cell.setAttribute("aria-colindex", String(first.index + options.columnIndexOffset + 1))
      cell.setAttribute("aria-colspan", String(span))
      cell.setAttribute("aria-label", group.label)
      cell.dataset.columnGroupId = group.id
      cell.dataset.columnGroupLabel = group.label
      cell.dataset.columnGroupSpan = String(span)
      if (isContinuation) {
        cell.classList.add("affino-grid-dom__column-group-header--continuation")
      } else {
        cell.textContent = group.label
      }
    } else {
      cell.classList.add("affino-grid-dom__column-group-header--empty")
      cell.setAttribute("role", "presentation")
      cell.setAttribute("aria-hidden", "true")
      cell.dataset.columnGroupEmpty = "true"
      cell.dataset.columnGroupSpan = String(span)
    }
    if (children.length === 0 && options.drawStartEdge) {
      cell.classList.add("affino-grid-dom__cell--grid-start")
    }
    children.push(cell)
    startIndex = endIndex
  }

  if (options.virtualColumns?.rightPadding) {
    const spacer = createColumnSpacer(options.virtualColumns.rightPadding, document, "right", cells.get("right"))
    spacer.style.gridColumn = String(virtualLeftTrack + entries.length + 1)
    children.push(spacer)
  }
  if (options.existing) reconcileChildren(row, children)
  else row.append(...children)
  return row
}

function setHeaderColumnLabel(
  cell: HTMLElement,
  entry: RenderColumn,
  headerGroupDepth: number,
): void {
  const label = cell.ownerDocument.createElement("span")
  label.className = "affino-grid-dom__column-header-label"
  label.textContent = entry.column.column.label ?? entry.column.key
  cell.append(label)

  const mergedDepth = Math.max(0, headerGroupDepth - entry.column.groupPath.length)
  if (mergedDepth === 0) return

  const groupHeight = "var(--affino-grid-dom-header-group-row-height)"
  const centerOffset = "var(--affino-grid-dom-header-group-center-offset)"
  cell.classList.add("affino-grid-dom__column-header--merged")
  cell.style.setProperty(
    "--affino-grid-dom-header-merge-offset",
    `calc(${Array.from({ length: mergedDepth }, () => groupHeight).join(" + ")})`,
  )
  cell.style.setProperty(
    "--affino-grid-dom-header-merge-center-offset",
    `calc(${Array.from({ length: mergedDepth }, () => centerOffset).join(" + ")})`,
  )
}

function appendColumnMenuTrigger(
  cell: HTMLElement,
  entry: RenderColumn,
  document: Document,
): void {
  cell.dataset.hasColumnMenu = "true"
  const button = document.createElement("button")
  button.type = "button"
  button.className = "affino-grid-dom__column-menu-trigger"
  button.dataset.columnMenuTrigger = entry.column.key
  button.setAttribute("aria-label", `Options for ${entry.column.column.label ?? entry.column.key}`)
  button.setAttribute("aria-haspopup", "dialog")
  button.setAttribute("aria-expanded", "false")
  button.textContent = "⋯"
  cell.append(button)
}

function getHeaderPane(
  headerShell: HTMLElement,
  side: "left" | "center" | "right",
  reuse: boolean,
  document: Document,
): HTMLDivElement {
  const pane = reuse
    ? headerShell.querySelector<HTMLDivElement>(`.affino-grid-dom__header-${side}`)
    : null
  if (pane) return pane
  const element = document.createElement("div")
  element.className = side === "center"
    ? "affino-grid-dom__header-center affino-grid-dom__header-viewport"
    : `affino-grid-dom__header-${side}`
  element.setAttribute("role", "presentation")
  return element
}

function getHeaderOverlayLayer(
  pane: HTMLElement,
  reuse: boolean,
  document: Document,
): HTMLDivElement {
  const existing = reuse
    ? pane.querySelector<HTMLDivElement>(":scope > .affino-grid-dom__header-overlay-layer")
    : null
  if (existing) return existing
  const layer = document.createElement("div")
  layer.className = "affino-grid-dom__header-overlay-layer"
  layer.setAttribute("role", "presentation")
  return layer
}

function spanRowSelectionHeaderCell(
  leafRow: HTMLElement,
  overlayLayer: HTMLElement,
  state: Readonly<{ checked: boolean; mixed: boolean }> | undefined,
): void {
  let cell = overlayLayer.querySelector<HTMLDivElement>(".affino-grid-dom__row-selection-header--spanning")
  const renderedCell = leafRow.querySelector<HTMLDivElement>(":scope > .affino-grid-dom__row-selection-header:not(.affino-grid-dom__row-selection-header-placeholder)")
  if (!cell && renderedCell) {
    cell = renderedCell
    cell.classList.add("affino-grid-dom__row-selection-header--spanning")
    const placeholder = cell.ownerDocument.createElement("div")
    placeholder.className = "affino-grid-dom__cell affino-grid-dom__column-header affino-grid-dom__row-selection-header affino-grid-dom__row-selection-header-placeholder"
    placeholder.dataset.columnIndex = "-1"
    placeholder.setAttribute("role", "presentation")
    placeholder.setAttribute("aria-hidden", "true")
    renderedCell.replaceWith(placeholder)
    overlayLayer.append(cell)
  } else if (renderedCell) {
    renderedCell.replaceWith(leafRow.querySelector(".affino-grid-dom__row-selection-header-placeholder")!)
  }
  if (cell) {
    cell.classList.add("affino-grid-dom__cell--grid-start")
    if (state) updateRowSelectionHeaderCell(cell, state)
  }
}

function resolvePinnedColumns(columns: readonly DataGridColumnSnapshot[], initialLeftOffset = 0): readonly RenderColumn[] {
  let leftOffset = initialLeftOffset
  const resolved = columns.map((column, index) => {
    const pin = column.pin ?? "none"
    const width = column.width ?? (pin === "none" ? null : 120)
    const offset = pin === "left" ? leftOffset : 0
    if (pin === "left") leftOffset += width ?? 120
    return { column, index, width, pin, offset }
  })
  let rightOffset = 0
  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    const column = resolved[index]!
    if (column.pin !== "right") continue
    column.offset = rightOffset
    rightOffset += column.width ?? 120
  }
  return resolved
}

function renderHeaderRow(
  columns: RenderColumnGroups,
  document: Document,
  virtualColumns: RenderGridInput<unknown>["virtualColumns"],
  existing: HTMLDivElement | null = null,
  columnReorder = false,
  columnMenu = false,
  pane: "left" | "center" | "right" = "center",
  sortModel: readonly { key: string; direction: "asc" | "desc" }[] = [],
  columnIndexOffset = 0,
  includeRowSelection = false,
  rowSelectionHeaderState: Readonly<{ checked: boolean; mixed: boolean }> = { checked: false, mixed: false },
  drawStartEdge = false,
  ariaRowIndex = 1,
  headerGroupDepth = 0,
): HTMLDivElement {
  const row = existing ?? document.createElement("div")
  const cells = collectColumnChildren(existing)
  const children: Node[] = []
  if (!existing) {
    row.className = `affino-grid-dom__row affino-grid-dom__header affino-grid-dom__header--${pane}`
    row.setAttribute("role", pane === "center" ? "row" : "presentation")
  }
  if (pane === "center") row.setAttribute("aria-rowindex", String(ariaRowIndex))
  if (includeRowSelection) {
    const retained = cells.get("-1")
    const cell = retained ?? createRowSelectionHeaderCell(document, rowSelectionHeaderState)
    if (retained) updateRowSelectionHeaderCell(cell, rowSelectionHeaderState)
    children.push(cell)
  }
  for (const entry of columns.pinnedLeft) {
    const retained = cells.get(String(entry.index))
    if (retained) { applyHeaderSortState(retained, entry, sortModel); children.push(retained); continue }
    const cell = createColumnCell(entry, document, false)
    cell.classList.add("affino-grid-dom__column-header")
    applyHeaderSortState(cell, entry, sortModel)
    cell.setAttribute("role", "columnheader")
    cell.setAttribute("aria-colindex", String(entry.index + columnIndexOffset + 1))
    cell.dataset.columnIndex = String(entry.index)
    configureColumnDrag(cell, entry, columnReorder)
    setHeaderColumnLabel(cell, entry, headerGroupDepth)
    if (columnMenu) appendColumnMenuTrigger(cell, entry, document)
    appendColumnResizeHandle(cell, entry, document)
    children.push(cell)
  }
  if (virtualColumns?.leftPadding) children.push(createColumnSpacer(virtualColumns.leftPadding, document, "left", cells.get("left")))
  for (const entry of columns.scrollable) {
    const retained = cells.get(String(entry.index))
    if (retained) { applyHeaderSortState(retained, entry, sortModel); children.push(retained); continue }
    const cell = createColumnCell(entry, document, false)
    cell.classList.add("affino-grid-dom__column-header")
    applyHeaderSortState(cell, entry, sortModel)
    cell.setAttribute("role", "columnheader")
    cell.setAttribute("aria-colindex", String(entry.index + columnIndexOffset + 1))
    cell.dataset.columnIndex = String(entry.index)
    configureColumnDrag(cell, entry, columnReorder)
    setHeaderColumnLabel(cell, entry, headerGroupDepth)
    if (columnMenu) appendColumnMenuTrigger(cell, entry, document)
    appendColumnResizeHandle(cell, entry, document)
    children.push(cell)
  }
  if (virtualColumns?.rightPadding) children.push(createColumnSpacer(virtualColumns.rightPadding, document, "right", cells.get("right")))
  for (const entry of columns.pinnedRight) {
    const retained = cells.get(String(entry.index))
    if (retained) { applyHeaderSortState(retained, entry, sortModel); children.push(retained); continue }
    const cell = createColumnCell(entry, document, false)
    cell.classList.add("affino-grid-dom__column-header")
    applyHeaderSortState(cell, entry, sortModel)
    cell.setAttribute("role", "columnheader")
    cell.setAttribute("aria-colindex", String(entry.index + columnIndexOffset + 1))
    cell.dataset.columnIndex = String(entry.index)
    configureColumnDrag(cell, entry, columnReorder)
    setHeaderColumnLabel(cell, entry, headerGroupDepth)
    if (columnMenu) appendColumnMenuTrigger(cell, entry, document)
    appendColumnResizeHandle(cell, entry, document)
    children.push(cell)
  }
  const firstCell = children.find((child): child is HTMLDivElement => (
    child.nodeType === 1
    && (child as HTMLDivElement).classList.contains("affino-grid-dom__cell")
  ))
  firstCell?.classList.toggle("affino-grid-dom__cell--grid-start", drawStartEdge)
  if (existing) reconcileChildren(row, children)
  else row.append(...children)
  return row
}

function applyHeaderSortState(
  cell: HTMLElement,
  entry: RenderColumn,
  sortModel: readonly { key: string; direction: "asc" | "desc" }[],
): void {
  const sortable = entry.column.column.capabilities?.sortable !== false
  if (sortable) cell.dataset.sortable = ""
  else delete cell.dataset.sortable

  const sort = sortModel.find(item => item.key === entry.column.key)
  if (!sort) {
    cell.removeAttribute("aria-sort")
    delete cell.dataset.sortDirection
    return
  }
  cell.setAttribute("aria-sort", sort.direction === "asc" ? "ascending" : "descending")
  cell.dataset.sortDirection = sort.direction
}

function createRowSelectionHeaderCell(
  document: Document,
  state: Readonly<{ checked: boolean; mixed: boolean }>,
): HTMLDivElement {
  const cell = document.createElement("div")
  cell.className = "affino-grid-dom__cell affino-grid-dom__column-header affino-grid-dom__row-selection-header"
  cell.setAttribute("role", "columnheader")
  cell.setAttribute("aria-colindex", "1")
  cell.dataset.columnIndex = "-1"
  const checkbox = document.createElement("input")
  checkbox.type = "checkbox"
  checkbox.className = "affino-grid-dom__row-selection-checkbox"
  checkbox.dataset.rowSelectionSelectAll = ""
  checkbox.checked = state.checked
  checkbox.indeterminate = state.mixed
  checkbox.setAttribute("aria-label", "Select all visible rows")
  checkbox.setAttribute("aria-checked", state.mixed ? "mixed" : String(state.checked))
  cell.append(checkbox)
  return cell
}

function updateRowSelectionHeaderCell(
  cell: HTMLElement,
  state: Readonly<{ checked: boolean; mixed: boolean }>,
): void {
  const checkbox = cell.querySelector<HTMLInputElement>("[data-row-selection-select-all]")
  if (!checkbox) return
  checkbox.checked = state.checked
  checkbox.indeterminate = state.mixed
  checkbox.setAttribute("aria-checked", state.mixed ? "mixed" : String(state.checked))
}

function createRowSelectionCell<TRow>(
  row: DataGridRowNode<TRow>,
  rowIndex: number,
  selected: boolean,
  gridId: string,
  document: Document,
): HTMLDivElement {
  const cell = document.createElement("div")
  cell.className = "affino-grid-dom__cell affino-grid-dom__cell--pinned affino-grid-dom__cell--pinned-left affino-grid-dom__row-selection-cell"
  cell.style.left = "0px"
  cell.setAttribute("role", "gridcell")
  cell.setAttribute("aria-colindex", "1")
  cell.id = `${gridId}--selection-${rowIndex}`
  cell.dataset.rowIndex = String(rowIndex)
  cell.dataset.columnIndex = "-1"
  if (isDataSourceLoadingRow(row)) {
    cell.classList.add("affino-grid-dom__cell--data-loading")
    cell.setAttribute("aria-busy", "true")
    cell.setAttribute("aria-disabled", "true")
  } else if (row.kind === "leaf") {
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.className = "affino-grid-dom__row-selection-checkbox"
    checkbox.dataset.rowSelectionToggle = ""
    checkbox.checked = selected
    checkbox.setAttribute("aria-label", `Select row ${String(row.rowId)}`)
    cell.append(checkbox)
  }
  return cell
}

function configureColumnDrag(cell: HTMLElement, entry: RenderColumn, enabled: boolean): void {
  const draggable = enabled && entry.column.column.meta?.isSystem !== true
  cell.draggable = draggable
  if (draggable) cell.dataset.columnKey = entry.column.key
  else delete cell.dataset.columnKey
}

function appendColumnResizeHandle(cell: HTMLElement, entry: RenderColumn, document: Document): void {
  if (entry.column.column.meta?.isSystem === true) return
  const handle = document.createElement("span")
  handle.className = "affino-grid-dom__resize-handle"
  handle.setAttribute("role", "separator")
  handle.setAttribute("aria-orientation", "vertical")
  handle.setAttribute("aria-label", `Resize ${entry.column.column.label ?? entry.column.key}`)
  handle.setAttribute("aria-valuemin", String(entry.column.column.minWidth ?? 56))
  handle.setAttribute("aria-valuemax", "640")
  handle.setAttribute("aria-valuenow", String(entry.width ?? 160))
  handle.tabIndex = 0
  handle.dataset.columnResizeHandle = entry.column.key
  if (entry.width != null) handle.dataset.datagridResizeColumnWidth = String(entry.width)
  cell.append(handle)
}

function collectColumnChildren(row: HTMLElement | null): Map<string, HTMLElement> {
  return new Map(row ? Array.from(row.children).flatMap(child => {
    const cell = child as HTMLElement
    const key = cell.dataset.columnIndex ?? cell.dataset.columnSpacer
    return key != null ? [[key, cell] as const] : []
  }) : [])
}

function reconcileElement(current: Element, next: Element): void {
  for (const attribute of Array.from(current.attributes)) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name)
  }
  for (const attribute of Array.from(next.attributes)) {
    if (current.getAttribute(attribute.name) !== attribute.value) {
      current.setAttribute(attribute.name, attribute.value)
    }
  }

  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement
    && current.matches("[data-row-selection-toggle], [data-row-selection-select-all], .affino-grid-dom__cell-checkbox")) {
    current.checked = next.checked
    current.indeterminate = next.indeterminate
  }

  const currentChildren = Array.from(current.childNodes)
  const nextChildren = Array.from(next.childNodes)
  const sharedLength = Math.min(currentChildren.length, nextChildren.length)
  for (let index = 0; index < sharedLength; index += 1) {
    const currentChild = currentChildren[index]!
    const nextChild = nextChildren[index]!
    if (currentChild.nodeType === Node.ELEMENT_NODE && nextChild.nodeType === Node.ELEMENT_NODE
      && (currentChild as Element).tagName === (nextChild as Element).tagName) {
      reconcileElement(currentChild as Element, nextChild as Element)
    } else if (currentChild.nodeType === Node.TEXT_NODE && nextChild.nodeType === Node.TEXT_NODE) {
      if (currentChild.nodeValue !== nextChild.nodeValue) currentChild.nodeValue = nextChild.nodeValue
    } else {
      currentChild.replaceWith(nextChild)
    }
  }
  for (let index = currentChildren.length - 1; index >= nextChildren.length; index -= 1) {
    currentChildren[index]?.remove()
  }
  for (let index = sharedLength; index < nextChildren.length; index += 1) {
    const child = nextChildren[index]
    if (child) current.append(child)
  }
}

function createColumnCell(entry: RenderColumn, document: Document, applyPinPosition = true): HTMLDivElement {
  const cell = document.createElement("div")
  cell.className = "affino-grid-dom__cell"
  if (entry.pin !== "none") {
    cell.classList.add("affino-grid-dom__cell--pinned", `affino-grid-dom__cell--pinned-${entry.pin}`)
    if (applyPinPosition) cell.style.setProperty(entry.pin, `${entry.offset}px`)
  }
  return cell
}

function createColumnSpacer(
  width: number,
  document: Document,
  side: "left" | "right",
  existing?: HTMLElement,
): HTMLElement {
  const spacer = existing ?? document.createElement("div")
  if (!existing) {
    spacer.className = "affino-grid-dom__column-spacer"
    spacer.setAttribute("role", "presentation")
    spacer.setAttribute("aria-hidden", "true")
    spacer.dataset.columnSpacer = side
  }
  if (spacer.style.width !== `${width}px`) spacer.style.width = `${width}px`
  return spacer
}

function createVirtualSpacer(height: number, document: Document): HTMLDivElement {
  const spacer = document.createElement("div")
  spacer.className = "affino-grid-dom__virtual-spacer"
  spacer.setAttribute("role", "presentation")
  spacer.setAttribute("aria-hidden", "true")
  spacer.style.height = `${height}px`
  return spacer
}

function renderDataRow<TRow>(
  row: DataGridRowNode<TRow>,
  rowIndex: number,
  columns: RenderColumnGroups,
  selection: DataGridSelectionSnapshot | null,
  api: DataGridApi<TRow>,
  gridId: string,
  document: Document,
  virtualColumns: RenderGridInput<unknown>["virtualColumns"],
  existing: HTMLDivElement | null = null,
  groupLabelColumnKey: string | null = null,
  groupDepth = 0,
  treeData: DataGridTreeDataSpec<TRow> | null = null,
  getTreeLeafDepth?: (row: DataGridRowNode<TRow>) => number,
  rowSelectionEnabled = false,
  formulaFieldsByTarget: DataGridDomFormulaFieldIndex | null = null,
  cellClassResolver?: DataGridDomCellClassResolver<TRow>,
  cellStyleResolver?: DataGridDomCellStyleResolver<TRow>,
  pivotActive = false,
  headerRowCount = 1,
  copiedRange: RenderGridInput<TRow>["copiedRange"] = null,
): HTMLDivElement {
  const loadingRow = isDataSourceLoadingRow(row)
  const element = existing ?? document.createElement("div")
  const cells = collectColumnChildren(existing)
  const children: Node[] = []
  if (!existing) {
    element.className = "affino-grid-dom__row"
    element.setAttribute("role", "row")
    element.dataset.rowId = String(row.rowId)
    element.dataset.rowIndex = String(rowIndex)
  }
  element.setAttribute("aria-rowindex", String(rowIndex + headerRowCount + 1))
  element.classList.toggle("affino-grid-dom__row--data-loading", loadingRow)
  if (loadingRow) {
    element.setAttribute("aria-busy", "true")
    element.setAttribute("aria-label", `Loading row ${rowIndex + 1}`)
  } else {
    element.removeAttribute("aria-busy")
    element.removeAttribute("aria-label")
  }
  const recordSelected = rowSelectionEnabled && row.kind === "leaf" && api.rowSelection.isSelected(row.rowId)
  element.classList.toggle("affino-grid-dom__row--record-selected", recordSelected)
  if (rowSelectionEnabled) element.setAttribute("aria-selected", String(recordSelected))
  else element.removeAttribute("aria-selected")
  if (row.kind === "group") {
    element.classList.add("affino-grid-dom__row--group")
    element.setAttribute("aria-level", String((row.groupMeta?.level ?? 0) + 1))
  } else {
    element.classList.remove("affino-grid-dom__row--group")
    element.removeAttribute("aria-level")
  }
  const leafDepth = groupDepth > 0
    ? groupDepth
    : getTreeLeafDepth?.(row) ?? resolveTreeLeafDepth(treeData, row)
  const appendCells = (entries: readonly RenderColumn[]): void => {
    for (const entry of entries) {
      const columnIndex = entry.index
      const retained = cells.get(String(columnIndex))
      const column = entry.column
      if (loadingRow) {
        const cell = retained ?? createColumnCell(entry, document)
        cell.classList.add("affino-grid-dom__cell--data-loading")
        cell.setAttribute("role", "gridcell")
        cell.setAttribute("aria-colindex", String(columnIndex + (rowSelectionEnabled ? 2 : 1)))
        cell.setAttribute("aria-selected", "false")
        cell.setAttribute("aria-busy", "true")
        cell.setAttribute("aria-disabled", "true")
        cell.id = `${gridId}--cell-${rowIndex}-${columnIndex}`
        cell.dataset.rowIndex = String(rowIndex)
        cell.dataset.columnIndex = String(columnIndex)
        children.push(cell)
        continue
      }
      const interaction = resolveDataGridCellInteraction({
        column: column.column,
        row: row.kind === "leaf" ? row.data : undefined,
        rowId: row.rowId,
        editable: column.column.capabilities?.editable !== false,
      })
      if (retained) {
        applyCellInteractionSemantics(retained, interaction)
        applyCustomCellPresentation(retained, row, rowIndex, column, columnIndex, cellClassResolver, cellStyleResolver)
        children.push(retained)
        continue
      }
      const cell = createColumnCell(entry, document)
      if (row.kind === "leaf" && column.column.capabilities?.editable === true && column.column.presentation?.options != null) {
        cell.classList.add("affino-grid-dom__cell--combobox")
      }
      applyCellInteractionSemantics(cell, interaction)
      cell.setAttribute("aria-colindex", String(columnIndex + (rowSelectionEnabled ? 2 : 1)))
      cell.id = `${gridId}--cell-${rowIndex}-${columnIndex}`
      cell.dataset.rowIndex = String(rowIndex)
      cell.dataset.columnIndex = String(columnIndex)
      const selectedRanges = selection?.ranges.filter(range => (
        rowIndex >= Math.min(range.startRow, range.endRow)
        && rowIndex <= Math.max(range.startRow, range.endRow)
        && columnIndex >= Math.min(range.startCol, range.endCol)
        && columnIndex <= Math.max(range.startCol, range.endCol)
      )) ?? []
      const selected = selectedRanges.length > 0
      const active = selection?.activeCell?.rowIndex === rowIndex
        && selection.activeCell.colIndex === columnIndex
        && (selection.activeCell.rowId == null || selection.activeCell.rowId === row.rowId)
      cell.setAttribute("aria-selected", String(selected))
      if (selected) cell.classList.add("affino-grid-dom__cell--selected")
      if (active) cell.classList.add("affino-grid-dom__cell--active")
      applyCustomCellPresentation(cell, row, rowIndex, column, columnIndex, cellClassResolver, cellStyleResolver)
      for (const range of selectedRanges) {
        const startRow = Math.min(range.startRow, range.endRow)
        const endRow = Math.max(range.startRow, range.endRow)
        const startCol = Math.min(range.startCol, range.endCol)
        const endCol = Math.max(range.startCol, range.endCol)
        cell.classList.add("affino-grid-dom__cell--range-frame")
        if (rowIndex === startRow) cell.classList.add("affino-grid-dom__cell--range-top")
        if (rowIndex === endRow) cell.classList.add("affino-grid-dom__cell--range-bottom")
        if (columnIndex === startCol) cell.classList.add("affino-grid-dom__cell--range-left")
        if (columnIndex === endCol) cell.classList.add("affino-grid-dom__cell--range-right")
        if (range.anchor.rowIndex === rowIndex && range.anchor.colIndex === columnIndex) {
          cell.classList.add("affino-grid-dom__cell--range-anchor")
        }
      }
      if (copiedRange
        && rowIndex >= Math.min(copiedRange.startRow, copiedRange.endRow)
        && rowIndex <= Math.max(copiedRange.startRow, copiedRange.endRow)
        && columnIndex >= Math.min(copiedRange.startColumn, copiedRange.endColumn)
        && columnIndex <= Math.max(copiedRange.startColumn, copiedRange.endColumn)) {
        cell.classList.add("affino-grid-dom__cell--clipboard-copied")
        if (rowIndex === Math.min(copiedRange.startRow, copiedRange.endRow)) cell.classList.add("affino-grid-dom__cell--clipboard-copied-top")
        if (rowIndex === Math.max(copiedRange.startRow, copiedRange.endRow)) cell.classList.add("affino-grid-dom__cell--clipboard-copied-bottom")
        if (columnIndex === Math.min(copiedRange.startColumn, copiedRange.endColumn)) cell.classList.add("affino-grid-dom__cell--clipboard-copied-left")
        if (columnIndex === Math.max(copiedRange.startColumn, copiedRange.endColumn)) cell.classList.add("affino-grid-dom__cell--clipboard-copied-right")
      }
      if (row.kind === "group" && row.groupMeta) {
        cell.classList.add("affino-grid-dom__cell--group")
        if (column.key === groupLabelColumnKey) {
          const content = document.createElement("span")
          content.className = "affino-grid-dom__group-label"
          content.style.paddingInlineStart = `${row.groupMeta.level * 16}px`
          const toggle = document.createElement("button")
          toggle.type = "button"
          toggle.className = "affino-grid-dom__group-toggle"
          toggle.dataset.groupToggle = row.groupMeta.groupKey
          const isTreeRow = row.groupMeta.groupField === "path" || row.groupMeta.groupField === "parent"
          toggle.setAttribute("aria-label", `${row.state.expanded ? "Collapse" : "Expand"} ${row.groupMeta.groupField}: ${row.groupMeta.groupValue}`)
          toggle.setAttribute("aria-expanded", String(row.state.expanded))
          toggle.textContent = row.state.expanded ? "−" : "+"
          const fieldLabel = allGroupFieldLabel(api, row.groupMeta.groupField)
          const label = document.createElement("span")
          let groupValue = String(row.groupMeta.groupValue)
          if (row.groupMeta.groupField === "parent") {
            const resolved = api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "display" })
            if (resolved.status === "available" && resolved.displayValue) groupValue = resolved.displayValue
          }
          label.textContent = isTreeRow
            ? `${groupValue} (${row.groupMeta.childrenCount})`
            : `${fieldLabel}: ${groupValue} (${row.groupMeta.childrenCount})`
          content.append(toggle, label)
          cell.append(content)
        } else {
          const pivotValue = resolvePivotProjectedCellValue(row, column, pivotActive)
          const aggregate = pivotValue.matched
            ? pivotValue.value
            : row.groupMeta.aggregates?.[column.key]
          if (aggregate != null) {
            cell.classList.add("affino-grid-dom__cell--group-aggregate")
            cell.textContent = pivotValue.matched ? pivotValue.displayValue : String(aggregate)
          } else {
            cell.textContent = ""
          }
        }
        children.push(cell)
        continue
      }
      const formulaValue = resolveDataGridDomFormulaCellValue({ row, column, formulaFields: formulaFieldsByTarget })
      let value: unknown
      let displayValue: string
      if (formulaValue.matched) {
        value = formulaValue.value
        displayValue = buildDataGridCellRenderModel({
          column: column.column,
          row: row.row,
          value: formulaValue.value,
        }).displayValue
      } else {
        const pivotValue = resolvePivotProjectedCellValue(row, column, pivotActive)
        if (pivotValue.matched) {
          value = pivotValue.value
          displayValue = pivotValue.displayValue
        } else {
          const resolved = api.cells.resolveValue({
            rowId: row.rowId,
            columnKey: column.key,
            purpose: "display",
            snapshot: { row, column },
          })
          value = resolved.status === "available" ? resolved.computedValue : undefined
          displayValue = resolved.status === "available" ? resolved.displayValue : ""
        }
      }
      const renderer = (column.column as DataGridDomColumnInput<TRow>).cellRenderer
      if (renderer) {
        const interactive = createCellRendererInteractiveContext({ api, column, row, value })
        const content = renderer({
          document,
          row: row.data,
          rowNode: row,
          column,
          rowIndex,
          columnIndex,
          value,
          displayValue,
          interactive,
        })
        if (typeof content === "string") cell.textContent = content
        else if (content) cell.append(content)
      } else if (column.column.cellType === "checkbox" || column.column.dataType === "boolean") {
        cell.classList.add("affino-grid-dom__cell--checkbox")
        const checkbox = document.createElement("input")
        checkbox.type = "checkbox"
        checkbox.className = "affino-grid-dom__cell-checkbox"
        checkbox.tabIndex = -1
        checkbox.setAttribute("aria-label", `${column.column.label ?? column.key} for row ${rowIndex + 1}`)
        const source = api.cells.resolveValue({
          rowId: row.rowId,
          columnKey: column.key,
          purpose: "source",
          snapshot: { row, column },
        })
        const editable = column.column.capabilities?.editable === true && api.rows.hasPatchSupport()
        checkbox.checked = source.status === "available"
          && !toggleDataGridCellValue({ column: column.column, row: row.row, value: source.sourceValue })
        checkbox.disabled = !editable
          || source.status !== "available"
          || source.writeTarget?.kind !== "row-patch"
          || resolveDataGridCellClickAction({
            column: column.column,
            row: row.row,
            rowId: row.rowId,
            editable,
          }) !== "toggle"
        cell.append(checkbox)
      } else if (leafDepth > 0 && column.key === groupLabelColumnKey) {
        const leafLabel = document.createElement("span")
        leafLabel.className = "affino-grid-dom__group-leaf-label"
        leafLabel.style.paddingInlineStart = `${leafDepth * 16}px`
        leafLabel.textContent = displayValue
        cell.append(leafLabel)
      } else {
        cell.textContent = displayValue
      }
      children.push(cell)
    }
  }
  if (rowSelectionEnabled) {
    const retained = cells.get("-1")
    const cell = retained ?? createRowSelectionCell(
      row,
      rowIndex,
      recordSelected,
      gridId,
      document,
    )
    if (retained) reconcileElement(cell, createRowSelectionCell(row, rowIndex, recordSelected, gridId, document))
    children.push(cell)
  }
  appendCells(columns.pinnedLeft)
  if (virtualColumns?.leftPadding) children.push(createColumnSpacer(virtualColumns.leftPadding, document, "left", cells.get("left")))
  appendCells(columns.scrollable)
  if (virtualColumns?.rightPadding) children.push(createColumnSpacer(virtualColumns.rightPadding, document, "right", cells.get("right")))
  appendCells(columns.pinnedRight)
  if (existing) reconcileChildren(element, children)
  else element.append(...children)
  return element
}

function isDataSourceLoadingRow<TRow>(row: DataGridRowNode<TRow>): boolean {
  return (row as DataGridRowNode<TRow> & { __dataSourceLoadingRow?: unknown }).__dataSourceLoadingRow === true
}

function resolvePivotProjectedCellValue<TRow>(
  row: DataGridRowNode<TRow>,
  column: DataGridColumnSnapshot,
  pivotActive: boolean,
): { matched: false } | { matched: true; value: unknown; displayValue: string } {
  if (!pivotActive) {
    return { matched: false }
  }
  const data = row.data as Record<string, unknown> | null
  if (!data || typeof data !== "object" || String(data.rowId) !== String(row.rowId)) {
    return { matched: false }
  }
  const field = typeof column.column.field === "string" && column.column.field.length > 0
    ? column.column.field
    : column.key
  let value: unknown
  if (Object.prototype.hasOwnProperty.call(data, field)) {
    value = data[field]
  } else if (Object.prototype.hasOwnProperty.call(data, column.key)) {
    value = data[column.key]
  } else {
    return { matched: false }
  }
  if (typeof column.column.accessor === "function") {
    value = column.column.accessor(row.data)
  } else if (typeof column.column.valueGetter === "function") {
    value = column.column.valueGetter(row.data)
  }
  return {
    matched: true,
    value,
    displayValue: value == null
      ? ""
      : buildDataGridCellRenderModel({ column: column.column, row: row.data, value }).displayValue,
  }
}

function applyCustomCellPresentation<TRow>(
  cell: HTMLElement,
  row: DataGridRowNode<TRow>,
  rowIndex: number,
  column: DataGridColumnSnapshot,
  columnIndex: number,
  resolveClass?: DataGridDomCellClassResolver<TRow>,
  resolveStyle?: DataGridDomCellStyleResolver<TRow>,
): void {
  const previousClasses = customCellClasses.get(cell) ?? new Set<string>()
  const resolvedClass = resolveClass?.(row, rowIndex, column, columnIndex)
  const nextClasses = new Set<string>()
  if (typeof resolvedClass === "string") {
    for (const name of resolvedClass.split(/\s+/)) if (name) nextClasses.add(name)
  } else if (Array.isArray(resolvedClass)) {
    for (const value of resolvedClass) {
      for (const name of value.split(/\s+/)) if (name) nextClasses.add(name)
    }
  } else if (resolvedClass && typeof resolvedClass === "object") {
    for (const [value, enabled] of Object.entries(resolvedClass)) {
      if (!enabled) continue
      for (const name of value.split(/\s+/)) if (name) nextClasses.add(name)
    }
  }
  for (const name of nextClasses) {
    if (name.startsWith("affino-grid-dom__")) nextClasses.delete(name)
  }
  for (const name of previousClasses) if (!nextClasses.has(name)) cell.classList.remove(name)
  for (const name of nextClasses) if (!previousClasses.has(name)) cell.classList.add(name)
  customCellClasses.set(cell, nextClasses)

  const previousStyles = customCellStyles.get(cell) ?? new Map<string, string>()
  const style = resolveStyle?.(row, rowIndex, column, columnIndex) ?? {}
  const nextStyles = new Map<string, string>()
  for (const [property, value] of Object.entries(style)) {
    if (value == null) continue
    const cssProperty = toCssPropertyName(property)
    nextStyles.set(cssProperty, value)
  }
  for (const property of previousStyles.keys()) {
    if (!nextStyles.has(property)) cell.style.removeProperty(property)
  }
  for (const [property, value] of nextStyles) {
    if (previousStyles.get(property) !== value) cell.style.setProperty(property, value)
  }
  customCellStyles.set(cell, nextStyles)
}

function toCssPropertyName(property: string): string {
  return property.startsWith("--")
    ? property
    : property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

function applyCellInteractionSemantics(
  cell: HTMLElement,
  interaction: ReturnType<typeof resolveDataGridCellInteraction>,
): void {
  cell.classList.toggle("affino-grid-dom__cell--interactive", interaction !== null)
  cell.setAttribute("role", interaction?.role ?? "gridcell")
  setOptionalAttribute(cell, "aria-label", interaction?.label)
  setOptionalAttribute(cell, "aria-pressed", interaction?.pressed)
  setOptionalAttribute(cell, "aria-checked", interaction?.checked)
  setOptionalAttribute(cell, "aria-disabled", interaction?.disabled ? "true" : undefined)
}

function setOptionalAttribute(element: HTMLElement, name: string, value: string | undefined): void {
  if (value == null) element.removeAttribute(name)
  else element.setAttribute(name, value)
}

function resolveTreeLeafDepth<TRow>(treeData: DataGridTreeDataSpec<TRow> | null, row: DataGridRowNode<TRow>): number {
  if (row.kind !== "leaf" || treeData?.mode !== "path") return 0
  try {
    return Math.max(0, treeData.getDataPath(row.data, row.sourceIndex).length)
  } catch {
    return 0
  }
}

function createCellRendererInteractiveContext<TRow>(input: {
  api: DataGridApi<TRow>
  column: DataGridColumnSnapshot
  row: DataGridRowNode<TRow>
  value: unknown
}): DataGridDomCellRendererInteractiveContext | null {
  if (input.row.kind !== "leaf") return null
  const interactionOptions = {
    column: input.column.column,
    row: input.row.data,
    rowId: input.row.rowId,
    value: input.value,
    editable: input.column.column.capabilities?.editable !== false,
  }
  const interaction = resolveDataGridCellInteraction(interactionOptions)
  if (!interaction) return null
  const activate = (trigger: DataGridCellInteractionInvocationTrigger = "click"): boolean => (
    invokeDataGridCellInteraction({ ...interactionOptions, trigger })
  )

  return {
    enabled: !interaction.disabled,
    click: interaction.click,
    keyboard: interaction.keyboard,
    ...(interaction.role ? { role: interaction.role } : {}),
    ...(interaction.label ? { ariaLabel: interaction.label } : {}),
    ...(interaction.pressed ? { ariaPressed: interaction.pressed } : {}),
    ...(interaction.checked ? { ariaChecked: interaction.checked } : {}),
    ...(interaction.disabled ? { ariaDisabled: "true" as const } : {}),
    activate,
  }
}

function allGroupFieldLabel<TRow>(api: DataGridApi<TRow>, field: string): string {
  const column = api.columns.getSnapshot().columns.find(candidate => (
    candidate.key === field || candidate.column.field === field
  ))
  return String(column?.column.label ?? field)
}
