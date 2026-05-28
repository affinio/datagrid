import { ref, type Ref, type VNodeChild } from "vue"
import {
  getDataGridRowRenderMeta,
  invokeDataGridCellInteraction,
  resolveDataGridCellInteraction,
  resolveDataGridCellType,
  type DataGridCellInteractionInvocationTrigger,
} from "@affino/datagrid-vue"
import type {
  DataGridAppCellRendererInteractiveContext,
  DataGridAppRowSurfaceContext,
} from "../config/dataGridFormulaOptions"
import type { DataGridFilterableComboboxOption } from "../overlays/dataGridFilterableCombobox"
import {
  recordDataGridPerfSample,
  resolveDataGridPerfNow,
} from "../perf/dataGridPerfTrace"
import { isDataGridPlaceholderSurfaceRow } from "./useDataGridTableStagePlaceholderRows"
import type {
  DataGridTableMode,
  DataGridTableRow,
  DataGridTableStageEditingSection,
  DataGridTableStageRowsSection,
} from "./dataGridTableStage.types"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageSelectEditorOption,
  DataGridTableStageSelectEditorOptionsLoader,
} from "./dataGridTableStageBody.types"

export interface UseDataGridStageCellRenderingOptions {
  mode: Readonly<Ref<DataGridTableMode>>
  visibleColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  rows: Readonly<Ref<DataGridTableStageRowsSection<Record<string, unknown>>>>
  cells: Readonly<Ref<{
    readCell: (row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => string
    readDisplayCell: (row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => string
  }>>
  editing: Readonly<Ref<DataGridTableStageEditingSection<Record<string, unknown>>>>
  isCellEditableSafe: (row: DataGridTableRow<Record<string, unknown>>, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isEditingCellSafe: (row: DataGridTableRow<Record<string, unknown>>, columnKey: string) => boolean
  columnIndexByKey: (columnKey: string) => number
  suppressInlineEditStart?: Readonly<Ref<boolean>>
  perfTraceEnabled?: boolean
}

export interface UseDataGridStageCellRenderingResult {
  startInlineEditIfAllowed: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn, rowOffset: number, event?: MouseEvent) => void
  resolveCellEditorMode: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn) => "none" | "text" | "select" | "date" | "datetime"
  resolveSelectEditorOptions: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn) => readonly DataGridTableStageSelectEditorOption[]
  resolveSelectEditorOptionsLoader: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn) => DataGridTableStageSelectEditorOptionsLoader | undefined
  handleSelectEditorOptionsResolved: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn, options: ReadonlyArray<DataGridFilterableComboboxOption>) => void
  readResolvedDisplayCell: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn) => string
  renderResolvedCellContent: (row: DataGridTableRow<Record<string, unknown>>, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => VNodeChild
  resolveSelectEditorValue: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn) => string
  isSelectEditorCell: (row: DataGridTableRow<Record<string, unknown>>, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  isDateEditorCell: (row: DataGridTableRow<Record<string, unknown>>, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  resolveDateEditorInputType: (row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn) => "date" | "datetime-local"
  isTextEditorCell: (row: DataGridTableRow<Record<string, unknown>>, rowOffset: number, column: DataGridTableStageBodyColumn, columnIndex: number) => boolean
  handleSelectEditorCommit: (value: string, target?: "stay" | "next" | "previous") => void
  handleSelectEditorCancel: () => void
  handleDateEditorChange: (value: string, target?: "stay" | "next" | "previous") => void
  handleTextEditorBlur: () => void
  updateEditingCellValue: (value: string) => void
  handleEditorKeydown: (event: KeyboardEvent) => void
}

function isPromiseLike<TValue>(value: unknown): value is PromiseLike<TValue> {
  return typeof value === "object"
    && value !== null
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function normalizeSelectEditorOption(option: unknown): DataGridTableStageSelectEditorOption {
  if (option && typeof option === "object" && "label" in option) {
    const record = option as { label?: unknown; value?: unknown }
    const label = String(record.label ?? "")
    return {
      label,
      value: String(record.value ?? label),
    }
  }
  return {
    label: String(option ?? ""),
    value: String(option ?? ""),
  }
}

type DataGridStageRendererScope = "cellRenderer" | "groupCellRenderer"
type DataGridStageRendererRowKind = "leaf" | "group"

interface InvokeDataGridStageRendererWithFallbackOptions<TContext> {
  scope: DataGridStageRendererScope
  rowKind: DataGridStageRendererRowKind
  renderer: (context: TContext) => VNodeChild
  context: TContext
  displayValue: string
  perfTraceEnabled?: boolean
  rowOffset: number
  columnIndex: number
  surfaceKind: string
  columnKey: string
}

function recordDataGridStageRendererInvocation(
  options: Omit<InvokeDataGridStageRendererWithFallbackOptions<unknown>, "renderer" | "context" | "displayValue"> & {
    startedAt: number
    rendererError: boolean
  },
): void {
  if (!options.perfTraceEnabled) {
    return
  }
  const finishedAt = resolveDataGridPerfNow()
  recordDataGridPerfSample({
    scope: options.scope,
    ts: finishedAt,
    totalMs: finishedAt - options.startedAt,
    rowOffset: options.rowOffset,
    columnIndex: options.columnIndex,
    surfaceKind: options.surfaceKind,
    rowKind: options.rowKind,
    columnKey: options.columnKey,
    rendererError: options.rendererError ? 1 : 0,
  })
}

function invokeDataGridStageRendererWithFallback<TContext>(
  options: InvokeDataGridStageRendererWithFallbackOptions<TContext>,
): VNodeChild {
  const startedAt = options.perfTraceEnabled ? resolveDataGridPerfNow() : 0
  try {
    const rendered = options.renderer(options.context) ?? options.displayValue
    recordDataGridStageRendererInvocation({
      scope: options.scope,
      rowKind: options.rowKind,
      perfTraceEnabled: options.perfTraceEnabled,
      rowOffset: options.rowOffset,
      columnIndex: options.columnIndex,
      surfaceKind: options.surfaceKind,
      columnKey: options.columnKey,
      startedAt,
      rendererError: false,
    })
    return rendered
  }
  catch {
    recordDataGridStageRendererInvocation({
      scope: options.scope,
      rowKind: options.rowKind,
      perfTraceEnabled: options.perfTraceEnabled,
      rowOffset: options.rowOffset,
      columnIndex: options.columnIndex,
      surfaceKind: options.surfaceKind,
      columnKey: options.columnKey,
      startedAt,
      rendererError: true,
    })
    return options.displayValue
  }
}

export function useDataGridStageCellRendering(
  options: UseDataGridStageCellRenderingOptions,
): UseDataGridStageCellRenderingResult {
  const asyncSelectOptionCache = ref(new Map<string, readonly DataGridTableStageSelectEditorOption[]>())

  function resolveCellEditorMode(
    _row: DataGridTableRow<Record<string, unknown>>,
    column: DataGridTableStageBodyColumn,
  ): "none" | "text" | "select" | "date" | "datetime" {
    return resolveDataGridCellType({ column: column.column }).editorMode ?? "text"
  }

  function buildSelectEditorCacheKey(row: DataGridTableRow<Record<string, unknown>>, columnKey: string): string | null {
    if (row.kind === "group") {
      return null
    }
    return `${String(row.rowId)}::${columnKey}`
  }

  function readCachedSelectEditorOptions(row: DataGridTableRow<Record<string, unknown>>, columnKey: string): readonly DataGridTableStageSelectEditorOption[] {
    const cacheKey = buildSelectEditorCacheKey(row, columnKey)
    if (!cacheKey) {
      return []
    }
    return asyncSelectOptionCache.value.get(cacheKey) ?? []
  }

  function readRowCellValue(row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn): unknown {
    if (row.kind === "group") {
      return undefined
    }
    if (typeof column.column.accessor === "function") {
      return column.column.accessor(row.data)
    }
    if (typeof column.column.valueGetter === "function") {
      return column.column.valueGetter(row.data)
    }
    const field = typeof column.column.field === "string" && column.column.field.length > 0
      ? column.column.field
      : column.key
    return isRecord(row.data) ? row.data[field] : undefined
  }

  function resolveSelectEditorOptionsSource(row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn): unknown {
    const source = column.column.presentation?.options
    return typeof source === "function"
      ? (row.kind !== "group" ? source(row.data) : [])
      : source
  }

  function resolveSelectEditorOptions(row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn): readonly DataGridTableStageSelectEditorOption[] {
    const resolved = resolveSelectEditorOptionsSource(row, column)
    if (Array.isArray(resolved)) {
      return resolved.map(normalizeSelectEditorOption)
    }
    if (isPromiseLike<readonly unknown[]>(resolved)) {
      return readCachedSelectEditorOptions(row, column.key)
    }
    return []
  }

  function resolveSelectEditorOptionsLoader(
    row: DataGridTableRow<Record<string, unknown>>,
    column: DataGridTableStageBodyColumn,
  ): DataGridTableStageSelectEditorOptionsLoader | undefined {
    if (row.kind === "group") {
      return undefined
    }
    const resolvedSource = resolveSelectEditorOptionsSource(row, column)
    if (!isPromiseLike<readonly unknown[]>(resolvedSource)) {
      return undefined
    }
    return async (_query: string) => {
      const resolved = resolveSelectEditorOptionsSource(row, column)
      if (isPromiseLike<readonly unknown[]>(resolved)) {
        const loaded = await resolved
        return Array.isArray(loaded) ? loaded.map(normalizeSelectEditorOption) : []
      }
      return Array.isArray(resolved) ? resolved.map(normalizeSelectEditorOption) : []
    }
  }

  function handleSelectEditorOptionsResolved(
    row: DataGridTableRow<Record<string, unknown>>,
    column: DataGridTableStageBodyColumn,
    optionsValue: ReadonlyArray<DataGridFilterableComboboxOption>,
  ): void {
    const cacheKey = buildSelectEditorCacheKey(row, column.key)
    if (!cacheKey) {
      return
    }
    const normalizedOptions = optionsValue.map(normalizeSelectEditorOption)
    const currentOptions = asyncSelectOptionCache.value.get(cacheKey)
    if (
      currentOptions
      && currentOptions.length === normalizedOptions.length
      && currentOptions.every((option, index) => (
        option.value === normalizedOptions[index]?.value && option.label === normalizedOptions[index]?.label
      ))
    ) {
      return
    }
    const nextCache = new Map(asyncSelectOptionCache.value)
    nextCache.set(cacheKey, normalizedOptions)
    asyncSelectOptionCache.value = nextCache
  }

  function readResolvedDisplayCell(row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn): string {
    const displayValue = options.cells.value.readDisplayCell(row, column.key)
    if (row.kind === "group" || resolveCellEditorMode(row, column) !== "select") {
      return displayValue
    }
    const cachedOptions = readCachedSelectEditorOptions(row, column.key)
    if (cachedOptions.length === 0) {
      return displayValue
    }
    const rawValue = readRowCellValue(row, column)
    const match = cachedOptions.find(option => option.value === String(rawValue ?? ""))
    return match?.label ?? displayValue
  }

  function resolveRowSurfaceContext(row: DataGridTableRow<Record<string, unknown>>): DataGridAppRowSurfaceContext {
    return {
      kind: isDataGridPlaceholderSurfaceRow(row) ? "placeholder" : "real",
    }
  }

  function resolveRendererInteractiveContext(
    row: DataGridTableRow<Record<string, unknown>>,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): DataGridAppCellRendererInteractiveContext | null {
    if (!column.column.cellInteraction) {
      return null
    }
    const editable = options.isCellEditableSafe(row, rowOffset, column, columnIndex)
    const interaction = resolveDataGridCellInteraction({
      column: column.column,
      row: row.kind !== "group" ? row.data : undefined,
      rowId: row.rowId,
      editable,
    })
    if (!interaction) {
      return null
    }
    return {
      enabled: interaction.disabled !== true,
      click: interaction.click,
      keyboard: interaction.keyboard,
      role: interaction.role,
      ariaLabel: interaction.label,
      ariaPressed: interaction.pressed,
      ariaChecked: interaction.checked,
      ariaDisabled: interaction.disabled ? "true" : undefined,
      activate: (trigger?: DataGridCellInteractionInvocationTrigger) => invokeDataGridCellInteraction({
        column: column.column,
        row: row.kind !== "group" ? row.data : undefined,
        rowId: row.rowId,
        editable,
        trigger: trigger ?? "click",
      }),
    }
  }

  function renderResolvedCellContent(
    row: DataGridTableRow<Record<string, unknown>>,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): VNodeChild {
    const displayValue = readResolvedDisplayCell(row, column)

    if (row.kind === "group") {
      const groupRenderer = column.column.groupCellRenderer
      const cellRenderer = column.column.cellRenderer
      if (typeof groupRenderer !== "function" && typeof cellRenderer !== "function") {
        return displayValue
      }
      const surface = resolveRowSurfaceContext(row)
      const interactive = resolveRendererInteractiveContext(row, rowOffset, column, columnIndex)
      const groupRow = row as DataGridTableRow<Record<string, unknown>> & { kind: "group" }
      const childrenCount = Number.isFinite(row.groupMeta?.childrenCount)
        ? Math.max(0, Math.trunc(row.groupMeta?.childrenCount as number))
        : 0
      const renderMeta = getDataGridRowRenderMeta(groupRow)
      const baseContext = {
        row: undefined,
        rowNode: groupRow,
        surface,
        rowOffset,
        column,
        columnIndex,
        value: options.cells.value.readCell(row, column.key),
        displayValue,
        interactive,
      }
      if (typeof groupRenderer !== "function") {
        if (typeof cellRenderer !== "function") {
          return displayValue
        }
        return invokeDataGridStageRendererWithFallback({
          scope: "cellRenderer",
          rowKind: "group",
          renderer: cellRenderer,
          context: baseContext,
          displayValue,
          perfTraceEnabled: options.perfTraceEnabled,
          rowOffset,
          columnIndex,
          surfaceKind: surface.kind,
          columnKey: column.key,
        })
      }
      return invokeDataGridStageRendererWithFallback({
        scope: "groupCellRenderer",
        rowKind: "group",
        renderer: groupRenderer,
        context: {
          ...baseContext,
          group: {
            key: row.groupMeta?.groupKey ?? String(row.rowId ?? ""),
            field: String(row.groupMeta?.groupField ?? "group"),
            value: String(row.groupMeta?.groupValue ?? row.rowId ?? ""),
            childrenCount,
            isLabelColumn: options.mode.value === "tree"
              ? column.key === "name"
              : column.key === (options.visibleColumns.value[0]?.key ?? "name"),
            renderMeta: {
              ...renderMeta,
              isGroup: true,
            },
            toggle: () => {
              options.rows.value.toggleGroupRow(row)
            },
          },
        },
        displayValue,
        perfTraceEnabled: options.perfTraceEnabled,
        rowOffset,
        columnIndex,
        surfaceKind: surface.kind,
        columnKey: column.key,
      })
    }

    const renderer = column.column.cellRenderer
    if (typeof renderer !== "function") {
      return displayValue
    }
    const surface = resolveRowSurfaceContext(row)
    const interactive = resolveRendererInteractiveContext(row, rowOffset, column, columnIndex)

    return invokeDataGridStageRendererWithFallback({
      scope: "cellRenderer",
      rowKind: "leaf",
      renderer,
      context: {
        row: row.data,
        rowNode: row,
        surface,
        rowOffset,
        column,
        columnIndex,
        value: options.cells.value.readCell(row, column.key),
        displayValue,
        interactive,
      },
      displayValue,
      perfTraceEnabled: options.perfTraceEnabled,
      rowOffset,
      columnIndex,
      surfaceKind: surface.kind,
      columnKey: column.key,
    })
  }

  function resolveSelectEditorValue(row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn): string {
    const rawValue = readRowCellValue(row, column)
    return rawValue == null ? "" : String(rawValue)
  }

  function isSelectEditorCell(
    row: DataGridTableRow<Record<string, unknown>>,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): boolean {
    return options.isEditingCellSafe(row, column.key)
      && options.isCellEditableSafe(row, rowOffset, column, columnIndex)
      && resolveCellEditorMode(row, column) === "select"
  }

  function isDateEditorCell(
    row: DataGridTableRow<Record<string, unknown>>,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): boolean {
    if (!options.isEditingCellSafe(row, column.key) || !options.isCellEditableSafe(row, rowOffset, column, columnIndex)) {
      return false
    }
    const editorMode = resolveCellEditorMode(row, column)
    return editorMode === "date" || editorMode === "datetime"
  }

  function resolveDateEditorInputType(row: DataGridTableRow<Record<string, unknown>>, column: DataGridTableStageBodyColumn): "date" | "datetime-local" {
    return resolveCellEditorMode(row, column) === "datetime" ? "datetime-local" : "date"
  }

  function isTextEditorCell(
    row: DataGridTableRow<Record<string, unknown>>,
    rowOffset: number,
    column: DataGridTableStageBodyColumn,
    columnIndex: number,
  ): boolean {
    return options.isEditingCellSafe(row, column.key)
      && options.isCellEditableSafe(row, rowOffset, column, columnIndex)
      && resolveCellEditorMode(row, column) === "text"
  }

  function startInlineEditIfAllowed(
    row: DataGridTableRow<Record<string, unknown>>,
    column: DataGridTableStageBodyColumn,
    rowOffset: number,
    event?: MouseEvent,
  ): void {
    const columnIndex = options.columnIndexByKey(column.key)
    if (
      options.suppressInlineEditStart?.value === true
      || rowOffset < 0
      || !options.isCellEditableSafe(row, rowOffset, column, columnIndex)
    ) {
      return
    }
    event?.preventDefault()
    options.editing.value.startInlineEdit(
      row,
      column.key,
      resolveCellEditorMode(row, column) === "select"
        ? { openOnMount: true }
        : undefined,
    )
  }

  function handleSelectEditorCommit(
    value: string,
    target: "stay" | "next" | "previous" = "stay",
  ): void {
    options.editing.value.updateEditingCellValue(value)
    options.editing.value.commitInlineEdit(target)
  }

  function handleSelectEditorCancel(): void {
    options.editing.value.cancelInlineEdit()
  }

  function handleDateEditorChange(value: string, target: "stay" | "next" | "previous" = "stay"): void {
    options.editing.value.updateEditingCellValue(value)
    options.editing.value.commitInlineEdit(target)
  }

  function handleTextEditorBlur(): void {
    options.editing.value.handleEditorBlur()
  }

  function updateEditingCellValue(value: string): void {
    options.editing.value.updateEditingCellValue(value)
  }

  function handleEditorKeydown(event: KeyboardEvent): void {
    options.editing.value.handleEditorKeydown(event)
  }

  return {
    startInlineEditIfAllowed,
    resolveCellEditorMode,
    resolveSelectEditorOptions,
    resolveSelectEditorOptionsLoader,
    handleSelectEditorOptionsResolved,
    readResolvedDisplayCell,
    renderResolvedCellContent,
    resolveSelectEditorValue,
    isSelectEditorCell,
    isDateEditorCell,
    resolveDateEditorInputType,
    isTextEditorCell,
    handleSelectEditorCommit,
    handleSelectEditorCancel,
    handleDateEditorChange,
    handleTextEditorBlur,
    updateEditingCellValue,
    handleEditorKeydown,
  }
}
