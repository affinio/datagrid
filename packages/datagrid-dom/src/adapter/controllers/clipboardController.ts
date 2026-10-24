import type {
  DataGridApi,
  DataGridClientRowPatch,
  DataGridColumnModel,
  DataGridColumnDef,
  DataGridRowId,
  DataGridRowNode,
} from "@affino/datagrid-core"
import { validateDataGridCellDraftValue } from "@affino/datagrid-core"
import {
  buildDataGridFillMatrix,
  canToggleDataGridFillBehavior,
  resolveDataGridDefaultFillBehavior,
  useDataGridClipboardBridge,
  type DataGridClipboardRange,
  type DataGridFillBehavior,
} from "@affino/datagrid-orchestration"
import {
  createDataGridDomFormulaFieldIndex,
  resolveDataGridDomFormulaCellValue,
} from "../formulaCellValue.js"
import { createHistoryPatch, createHistorySnapshot, type DomHistoryIntent } from "./historyController.js"

export interface CreateDomClipboardControllerOptions<TRow> {
  grid: HTMLElement
  api: DataGridApi<TRow>
  columnModel: DataGridColumnModel
  setCellSelection: (
    start: { rowIndex: number; colIndex: number; rowId: DataGridRowId },
    end: { rowIndex: number; colIndex: number; rowId: DataGridRowId },
  ) => void
  runWithRenderBatch: (operation: () => Promise<void>) => Promise<void>
  recordIntent: (intent: DomHistoryIntent<TRow>) => Promise<string | null>
  onCopiedSelectionChange?: (range: DataGridClipboardRange | null) => void
}

export interface DomClipboardController {
  fillRange(
    baseRange: DataGridClipboardRange,
    previewRange: DataGridClipboardRange,
    behavior?: DataGridFillBehavior,
  ): Promise<DomFillResult>
  dispose(): void
}

export interface DomFillResult {
  applied: boolean
  behavior: DataGridFillBehavior
  canToggle: boolean
  transactionId: string | null
}

export function createDomClipboardController<TRow>(
  options: CreateDomClipboardControllerOptions<TRow>,
): DomClipboardController {
  const { grid, api, columnModel } = options
  let copiedRange: DataGridClipboardRange | null = null
  const copiedSelectionRange = {
    get value() { return copiedRange },
    set value(range: DataGridClipboardRange | null) {
      copiedRange = range
      options.onCopiedSelectionChange?.(range)
    },
  }
  const lastCopiedPayload = { value: "" }
  let formulaFields = createDataGridDomFormulaFieldIndex(api)
  const clipboard = useDataGridClipboardBridge<DataGridRowNode<TRow>, DataGridClipboardRange>({
    copiedSelectionRange,
    lastCopiedPayload,
    resolveCopyRange,
    getRowAtIndex: rowIndex => api.rows.get(rowIndex),
    getColumnKeyAtIndex: columnIndex => columnModel.getSnapshot().visibleColumns[columnIndex]?.key ?? null,
    getCellValue: (row, columnKey) => {
      const column = columnModel.getSnapshot().byKey[columnKey]
      if (column) {
        const formulaValue = resolveDataGridDomFormulaCellValue({ row, column, formulaFields })
        if (formulaValue.matched) return formulaValue.value
      }
      const resolved = api.cells.resolveValue({ rowId: row.rowId, columnKey, purpose: "source" })
      return resolved.status === "available" ? resolved.sourceValue : ""
    },
    setLastAction: message => {
      grid.dataset.clipboardAction = message
    },
    closeContextMenu: () => undefined,
  })

  function resolveCopyRange(): DataGridClipboardRange | null {
    if (api.selection.getSnapshotStatus() !== "current") return null
    const selection = api.selection.getSnapshot()
    const range = selection?.ranges[selection.activeRangeIndex]
    if (range) {
      return normalizeRange({
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startCol,
        endColumn: range.endCol,
      })
    }
    const activeCell = selection?.activeCell
    return activeCell
      ? normalizeRange({
        startRow: activeCell.rowIndex,
        endRow: activeCell.rowIndex,
        startColumn: activeCell.colIndex,
        endColumn: activeCell.colIndex,
      })
      : null
  }

  function normalizeRange(range: DataGridClipboardRange): DataGridClipboardRange | null {
    const rowCount = api.rows.getCount()
    const columnCount = columnModel.getSnapshot().visibleColumns.length
    if (rowCount <= 0 || columnCount <= 0) return null
    const startRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.min(range.startRow, range.endRow))))
    const endRow = Math.max(0, Math.min(rowCount - 1, Math.trunc(Math.max(range.startRow, range.endRow))))
    const startColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.min(range.startColumn, range.endColumn))))
    const endColumn = Math.max(0, Math.min(columnCount - 1, Math.trunc(Math.max(range.startColumn, range.endColumn))))
    return startRow <= endRow && startColumn <= endColumn
      ? { startRow, endRow, startColumn, endColumn }
      : null
  }

  function resolveProjectionRevision(): number | null {
    const projection = api.rows.getSnapshot().projection
    return projection?.recomputeVersion ?? projection?.version ?? null
  }

  function buildPayload(range: DataGridClipboardRange): string {
    const rows: string[] = []
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = api.rows.get(rowIndex)
      if (!row) continue
      const fields: string[] = []
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const column = columnModel.getSnapshot().visibleColumns[columnIndex]
        const formulaValue = column
          ? resolveDataGridDomFormulaCellValue({ row, column, formulaFields })
          : { matched: false as const }
        const resolved = column
          ? api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
          : null
        fields.push(serializeTsvField(
          formulaValue.matched
            ? formulaValue.value
            : resolved?.status === "available" ? resolved.sourceValue : "",
        ))
      }
      rows.push(fields.join("\t"))
    }
    return rows.join("\n")
  }

  function onCopy(event: ClipboardEvent): void {
    if (isEditorTarget(event.target)) return
    const range = resolveCopyRange()
    if (!range) return
    const payload = buildPayload(range)

    if (event.clipboardData) {
      event.clipboardData.setData("text/plain", payload)
      event.preventDefault()
    } else {
      event.preventDefault()
      void clipboard.copySelection("keyboard").catch(() => {
        grid.dataset.clipboardAction = "Copy failed"
      })
    }
    lastCopiedPayload.value = payload
    clipboard.flashCopiedSelection(range)
    grid.dataset.clipboardAction = `Copied ${range.endRow - range.startRow + 1}×${range.endColumn - range.startColumn + 1} cells`
  }

  function onPaste(event: ClipboardEvent): void {
    if (isEditorTarget(event.target) || !api.rows.hasPatchSupport()) return
    const payload = event.clipboardData?.getData("text/plain") ?? ""
    if (event.clipboardData) {
      event.preventDefault()
      if (payload !== "") {
        void applyPayload(payload).catch(() => {
          grid.dataset.clipboardAction = "Paste failed"
        })
      }
      return
    }
    event.preventDefault()
    void clipboard.readClipboardPayload().then(applyPayload).catch(() => {
      grid.dataset.clipboardAction = "Paste failed"
    })
  }

  const unsubscribeFormulaFields = api.events.on("rows:changed", () => {
    formulaFields = createDataGridDomFormulaFieldIndex(api)
  })

  async function applyPayload(payload: string): Promise<void> {
    if (!payload) return
    const matrix = clipboard.parseClipboardMatrix(payload)
    const selected = resolveCopyRange()
    if (!selected) return

    const matrixHeight = matrix.length
    const matrixWidth = Math.max(0, ...matrix.map(row => row.length))
    if (matrixHeight === 0 || matrixWidth === 0) return
    const fillSelection = matrixHeight === 1 && matrixWidth === 1
      && (selected.startRow !== selected.endRow || selected.startColumn !== selected.endColumn)
    const range = fillSelection
      ? selected
      : normalizeRange({
        startRow: selected.startRow,
        endRow: selected.startRow + matrixHeight - 1,
        startColumn: selected.startColumn,
        endColumn: selected.startColumn + matrixWidth - 1,
      })
    if (!range) return

    const patches = new Map<DataGridRowId, DataGridClientRowPatch<TRow>>()
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = api.rows.get(rowIndex)
      if (!row || row.kind !== "leaf" || row.rowId == null) continue
      const rowOffset = rowIndex - selected.startRow
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const column = columnModel.getSnapshot().visibleColumns[columnIndex]
        if (!column || column.column.capabilities?.editable !== true) continue
        const resolved = api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
        if (resolved.status !== "available" || resolved.writeTarget?.kind !== "row-patch") continue
        const columnOffset = columnIndex - selected.startColumn
        const rawValue = fillSelection
          ? matrix[0]?.[0] ?? ""
          : matrix[rowOffset]?.[columnOffset] ?? ""
        const parsed = validateClipboardValue(rawValue, resolved.sourceValue, column.column, row.data)
        if (!parsed.ok) continue

        const existing = patches.get(row.rowId) ?? {
          rowId: row.rowId,
          data: {} as Partial<TRow>,
          previousData: {} as Partial<TRow>,
        }
        ;(existing.data as Record<string, unknown>)[resolved.writeTarget.key] = parsed.value
        ;(existing.previousData as Record<string, unknown>)[resolved.writeTarget.key] = resolved.sourceValue
        patches.set(row.rowId, existing)
      }
    }

    if (patches.size === 0) return
    const beforeSelection = api.selection.getSnapshot()
    const beforeProjectionRevision = resolveProjectionRevision()
    const beforeColumnOrderRevision = columnModel.getSnapshot().orderRevision
    const beforePatches = [...patches.values()].map(patch => createHistoryPatch(patch.rowId, patch.previousData ?? {}))
    const afterPatches = [...patches.values()].map(patch => createHistoryPatch(patch.rowId, patch.data))
    await options.runWithRenderBatch(async () => {
      await api.rows.applyEdits([...patches.values()], { source: "grid" })
      if (resolveProjectionRevision() === beforeProjectionRevision
        && columnModel.getSnapshot().orderRevision === beforeColumnOrderRevision) {
        const start = api.rows.get(range.startRow)
        const end = api.rows.get(range.endRow)
        if (start?.kind === "leaf" && end?.kind === "leaf") {
          options.setCellSelection(
            { rowIndex: range.startRow, colIndex: range.startColumn, rowId: start.rowId },
            { rowIndex: range.endRow, colIndex: range.endColumn, rowId: end.rowId },
          )
        }
      } else {
        api.selection.clear()
      }
    })
    await options.recordIntent({
      intent: "paste",
      label: fillSelection ? "Fill selected range" : "Paste cells",
      affectedRange: {
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startColumn,
        endColumn: range.endColumn,
      },
      before: createHistorySnapshot(beforePatches, beforeSelection),
      after: createHistorySnapshot(afterPatches, api.selection.getSnapshot()),
    })
    grid.dataset.clipboardAction = `Pasted values into ${patches.size} rows`
  }

  async function fillRange(
    baseRange: DataGridClipboardRange,
    previewRange: DataGridClipboardRange,
    requestedBehavior?: DataGridFillBehavior,
  ): Promise<DomFillResult> {
    const base = normalizeRange(baseRange)
    const range = normalizeRange(previewRange)
    if (!base || !range || rangesEqual(base, range)) {
      return { applied: false, behavior: requestedBehavior ?? "copy", canToggle: false, transactionId: null }
    }
    const sourceMatrix = clipboard.parseClipboardMatrix(buildPayload(base))
    if (sourceMatrix.length === 0 || Math.max(0, ...sourceMatrix.map(row => row.length)) === 0) {
      return { applied: false, behavior: requestedBehavior ?? "copy", canToggle: false, transactionId: null }
    }
    const defaultBehavior = resolveDataGridDefaultFillBehavior({ baseRange: base, previewRange: range, sourceMatrix })
    const behavior = requestedBehavior ?? defaultBehavior
    const canToggle = canToggleDataGridFillBehavior({ baseRange: base, previewRange: range, sourceMatrix })
    const generatedMatrix = buildDataGridFillMatrix({ baseRange: base, previewRange: range, sourceMatrix, behavior })
    const matrix = behavior === "copy"
      ? generatedMatrix.map((_row, rowOffset) => Array.from(
        { length: generatedMatrix[rowOffset]?.length ?? 0 },
        (_unused, columnOffset) => {
          const sourceRow = positiveModulo(range.startRow + rowOffset - base.startRow, sourceMatrix.length)
          const sourceColumn = positiveModulo(range.startColumn + columnOffset - base.startColumn, sourceMatrix[0]?.length ?? 0)
          return sourceMatrix[sourceRow]?.[sourceColumn] ?? ""
        },
      ))
      : generatedMatrix
    const patches = new Map<DataGridRowId, DataGridClientRowPatch<TRow>>()

    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = api.rows.get(rowIndex)
      if (!row || row.kind !== "leaf" || row.rowId == null) continue
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const inBase = rowIndex >= base.startRow && rowIndex <= base.endRow
          && columnIndex >= base.startColumn && columnIndex <= base.endColumn
        if (inBase) continue
        const column = columnModel.getSnapshot().visibleColumns[columnIndex]
        if (!column || column.column.capabilities?.editable !== true) continue
        const resolved = api.cells.resolveValue({ rowId: row.rowId, columnKey: column.key, purpose: "source" })
        if (resolved.status !== "available" || resolved.writeTarget?.kind !== "row-patch") continue
        const rawValue = matrix[rowIndex - range.startRow]?.[columnIndex - range.startColumn] ?? ""
        const parsed = validateClipboardValue(rawValue, resolved.sourceValue, column.column, row.data)
        if (!parsed.ok) continue
        const patch = patches.get(row.rowId) ?? {
          rowId: row.rowId,
          data: {} as Partial<TRow>,
          previousData: {} as Partial<TRow>,
        }
        ;(patch.data as Record<string, unknown>)[resolved.writeTarget.key] = parsed.value
        ;(patch.previousData as Record<string, unknown>)[resolved.writeTarget.key] = resolved.sourceValue
        patches.set(row.rowId, patch)
      }
    }

    if (patches.size === 0) return { applied: false, behavior, canToggle, transactionId: null }
    const beforeSelection = api.selection.getSnapshot()
    const beforeProjectionRevision = resolveProjectionRevision()
    const beforeColumnOrderRevision = columnModel.getSnapshot().orderRevision
    const beforePatches = [...patches.values()].map(patch => createHistoryPatch(patch.rowId, patch.previousData ?? {}))
    const afterPatches = [...patches.values()].map(patch => createHistoryPatch(patch.rowId, patch.data))
    await options.runWithRenderBatch(async () => {
      await api.rows.applyEdits([...patches.values()], { source: "grid" })
      if (resolveProjectionRevision() === beforeProjectionRevision
        && columnModel.getSnapshot().orderRevision === beforeColumnOrderRevision) {
        const start = api.rows.get(range.startRow)
        const end = api.rows.get(range.endRow)
        if (start?.kind === "leaf" && end?.kind === "leaf") {
          options.setCellSelection(
            { rowIndex: range.startRow, colIndex: range.startColumn, rowId: start.rowId },
            { rowIndex: range.endRow, colIndex: range.endColumn, rowId: end.rowId },
          )
        }
      } else {
        api.selection.clear()
      }
    })
    const intentId = await options.recordIntent({
      intent: "fill",
      label: "Fill cells",
      affectedRange: {
        startRow: range.startRow,
        endRow: range.endRow,
        startColumn: range.startColumn,
        endColumn: range.endColumn,
      },
      before: createHistorySnapshot(beforePatches, beforeSelection),
      after: createHistorySnapshot(afterPatches, api.selection.getSnapshot()),
    })
    const transactionId = api.transaction.getSnapshot()?.lastCommittedId ?? intentId
    grid.dataset.clipboardAction = `Filled ${patches.size} rows`
    return { applied: true, behavior, canToggle, transactionId }
  }

  grid.addEventListener("copy", onCopy)
  grid.addEventListener("paste", onPaste)
  return {
    fillRange,
    dispose() {
      grid.removeEventListener("copy", onCopy)
      grid.removeEventListener("paste", onPaste)
      unsubscribeFormulaFields()
      clipboard.dispose()
    },
  }
}

function rangesEqual(left: DataGridClipboardRange, right: DataGridClipboardRange): boolean {
  return left.startRow === right.startRow
    && left.endRow === right.endRow
    && left.startColumn === right.startColumn
    && left.endColumn === right.endColumn
}

function positiveModulo(value: number, divisor: number): number {
  return divisor > 0 ? ((value % divisor) + divisor) % divisor : 0
}

export function parseClipboardValue(value: string, currentValue: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof currentValue === "number") {
    if (value.trim() === "") return { ok: true, value: null }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false }
  }
  if (typeof currentValue === "boolean") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "") return { ok: true, value: null }
    if (normalized === "true") return { ok: true, value: true }
    if (normalized === "false") return { ok: true, value: false }
    return { ok: false }
  }
  return { ok: true, value }
}

export function validateClipboardValue<TRow>(
  value: string,
  currentValue: unknown,
  column: DataGridColumnDef<TRow>,
  row: TRow,
): { ok: true; value: unknown } | { ok: false } {
  const parsed = parseClipboardValue(value, currentValue)
  if (!parsed.ok) return parsed
  return validateDataGridCellDraftValue({ column, row, draft: value }).valid ? parsed : { ok: false }
}

function isEditorTarget(target: EventTarget | null): boolean {
  const element = target as Element | null
  return typeof element?.closest === "function" && element.closest(".affino-grid-dom__editor") !== null
}

function serializeTsvField(value: unknown): string {
  const normalized = value == null ? "" : String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return /[\t\n"]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}
