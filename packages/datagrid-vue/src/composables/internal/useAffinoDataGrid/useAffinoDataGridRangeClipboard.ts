import { ref, watch, type Ref } from "vue"
import type { DataGridRowNode, DataGridSelectionSnapshot } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"
import {
  useDataGridClipboardBridge,
  useDataGridClipboardMutations,
  useDataGridRangeMutationEngine,
} from "@affino/datagrid-orchestration"
import type { AffinoDataGridCellRange } from "../../useAffinoDataGrid.types"
import type { UseAffinoDataGridFeatureSuiteResult } from "./useAffinoDataGridFeatureSuite"
import type {
  AffinoDataGridCellSelectionCoord,
  InternalCellRange,
} from "./useAffinoDataGridSelectionEngine"

interface AffinoDataGridMutationSnapshot<TRow> {
  rows: readonly TRow[]
  selection: DataGridSelectionSnapshot | null
}

export interface UseAffinoDataGridRangeClipboardOptions<TRow> {
  rows: Ref<readonly TRow[]>
  runtime: UseDataGridRuntimeResult<TRow>
  featureSuite: UseAffinoDataGridFeatureSuiteResult<TRow>
  resolveRowKey: (row: TRow, index: number) => string
  resolveVisibleColumnIndex: (columnKey: string) => number
  resolveCellCoordByIndex: (rowIndex: number, columnIndex: number) => AffinoDataGridCellSelectionCoord | null
  cellSelectionRange: Ref<InternalCellRange | null>
  activeCellSelection: Ref<AffinoDataGridCellSelectionCoord | null>
  clearCellSelection: () => void
  applySelectionFromRange: (range: InternalCellRange, activePosition?: "start" | "end") => void
  closeContextMenu: () => void
  interactions: {
    enabled: boolean
    rangeEnabled: boolean
    fillEnabled: boolean
    moveEnabled: boolean
  }
  pushFeedback: (event: {
    source: "range"
    action: string
    message: string
    affected?: number
    ok?: boolean
  }) => void
}

export interface UseAffinoDataGridRangeClipboardResult {
  copiedRange: Ref<InternalCellRange | null>
  fillPreviewRange: Ref<InternalCellRange | null>
  rangeMovePreviewRange: Ref<InternalCellRange | null>
  lastAction: Ref<string>
  interactionsEnabled: Ref<boolean>
  rangeInteractionsEnabled: Ref<boolean>
  rangeFillEnabled: Ref<boolean>
  rangeMoveEnabled: Ref<boolean>
  rangePointerMode: Ref<"idle" | "fill" | "move">
  stopRangePointerInteraction: (apply?: boolean) => void
  startRangePointerInteraction: (mode: "fill" | "move", params: { rowIndex: number; columnKey: string }) => boolean
  updateRangePointerPreview: (rowIndex: number, columnKey: string) => void
  hasCellRangeContext: () => boolean
  resolveActiveRangeCellCount: () => number
  copySelection: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  pasteSelection: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  cutSelection: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  clearSelection: (trigger?: "keyboard" | "context-menu") => Promise<boolean>
  setFillPreviewRange: (range: AffinoDataGridCellRange | null) => void
  setRangeMovePreviewRange: (range: AffinoDataGridCellRange | null) => void
  applyFillPreview: () => void
  applyRangeMove: () => boolean
  dispose: () => void
}

function isRecordRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function coerceStringDraftToCellValue(current: unknown, draft: string): unknown {
  if (typeof current === "number") {
    const parsed = Number(draft)
    return Number.isFinite(parsed) ? parsed : current
  }
  if (typeof current === "boolean") {
    const normalized = draft.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") {
      return true
    }
    if (normalized === "false" || normalized === "0") {
      return false
    }
    return current
  }
  return draft
}

export function useAffinoDataGridRangeClipboard<TRow>(
  options: UseAffinoDataGridRangeClipboardOptions<TRow>,
): UseAffinoDataGridRangeClipboardResult {
  const cellRangeLastAction = ref("Ready")
  const copiedSelectionRange = ref<InternalCellRange | null>(null)
  const fillPreviewRange = ref<InternalCellRange | null>(null)
  const rangeMovePreviewRange = ref<InternalCellRange | null>(null)

  const setRangeLastAction = (
    message: string,
    actionOptions: { action?: string; affected?: number } = {},
  ): void => {
    cellRangeLastAction.value = message
    options.pushFeedback({
      source: "range",
      action: actionOptions.action ?? "range",
      message,
      affected: actionOptions.affected,
      ok: true,
    })
  }

  const resolveColumnKeyAtIndex = (columnIndex: number): string | null => (
    options.runtime.columnSnapshot.value.visibleColumns[columnIndex]?.key ?? null
  )

  const resolveDisplayNodeAtIndex = (rowIndex: number): DataGridRowNode<TRow> | undefined => (
    options.runtime.api.getRow(rowIndex)
  )

  const resolveDisplayLeafRowAtIndex = (rowIndex: number): TRow | undefined => {
    const rowNode = resolveDisplayNodeAtIndex(rowIndex)
    if (!rowNode || rowNode.kind !== "leaf") {
      return undefined
    }
    return rowNode.data as TRow
  }

  const materializeDisplayRows = (): readonly DataGridRowNode<TRow>[] => {
    const rowCount = options.runtime.api.getRowCount()
    const rowsBuffer: DataGridRowNode<TRow>[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowNode = resolveDisplayNodeAtIndex(rowIndex)
      if (rowNode) {
        rowsBuffer.push(rowNode)
      }
    }
    return rowsBuffer
  }

  const normalizeCellRange = (range: InternalCellRange | null): InternalCellRange | null => {
    if (!range) {
      return null
    }
    const rowTotal = options.runtime.api.getRowCount()
    const colTotal = options.runtime.columnSnapshot.value.visibleColumns.length
    if (rowTotal <= 0 || colTotal <= 0) {
      return null
    }
    const clamp = (value: number, max: number): number => (
      Math.max(0, Math.min(max, Math.trunc(value)))
    )
    const maxRow = Math.max(0, rowTotal - 1)
    const maxCol = Math.max(0, colTotal - 1)
    const startRow = clamp(Math.min(range.startRow, range.endRow), maxRow)
    const endRow = clamp(Math.max(range.startRow, range.endRow), maxRow)
    const startColumn = clamp(Math.min(range.startColumn, range.endColumn), maxCol)
    const endColumn = clamp(Math.max(range.startColumn, range.endColumn), maxCol)
    return {
      startRow,
      endRow,
      startColumn,
      endColumn,
    }
  }

  const areCellRangesEqual = (left: InternalCellRange | null, right: InternalCellRange | null): boolean => {
    if (!left && !right) {
      return true
    }
    if (!left || !right) {
      return false
    }
    return (
      left.startRow === right.startRow
      && left.endRow === right.endRow
      && left.startColumn === right.startColumn
      && left.endColumn === right.endColumn
    )
  }

  const resolveCurrentCellCoord = () => {
    const active = options.activeCellSelection.value
    if (!active) {
      return null
    }
    return {
      rowIndex: active.rowIndex,
      columnIndex: active.columnIndex,
    }
  }

  const resolveCopyRange = (): InternalCellRange | null => (
    normalizeCellRange(options.cellSelectionRange.value)
  )

  const resolveActiveRangeCellCount = (): number => {
    const range = resolveCopyRange()
    if (!range) {
      return 0
    }
    return Math.max(0, range.endRow - range.startRow + 1)
      * Math.max(0, range.endColumn - range.startColumn + 1)
  }

  const resolveCellValue = (row: TRow, columnKey: string): unknown => {
    if (!isRecordRow(row)) {
      return undefined
    }
    return row[columnKey]
  }

  const applyDraftValue = (row: TRow, columnKey: string, draft: string): boolean => {
    if (!isRecordRow(row)) {
      return false
    }
    const record = row as Record<string, unknown>
    const current = record[columnKey]
    record[columnKey] = coerceStringDraftToCellValue(current, draft)
    return true
  }

  const clearCellValue = (row: TRow, columnKey: string): boolean => {
    if (!isRecordRow(row)) {
      return false
    }
    const record = row as Record<string, unknown>
    record[columnKey] = null
    return true
  }

  const cloneRowForMutation = (row: TRow): TRow => {
    try {
      if (typeof structuredClone === "function") {
        return structuredClone(row)
      }
    } catch {
      // Fall through to shallow clone.
    }
    if (Array.isArray(row)) {
      return [...row] as TRow
    }
    if (isRecordRow(row)) {
      return { ...row } as TRow
    }
    return row
  }

  const sourceRowIdMap = ref<Map<TRow, string>>(new Map())
  watch(
    options.rows,
    nextRows => {
      const nextMap = new Map<TRow, string>()
      nextRows.forEach((row, index) => {
        nextMap.set(row, options.resolveRowKey(row, index))
      })
      sourceRowIdMap.value = nextMap
    },
    { immediate: true, flush: "sync" },
  )

  const resolveSourceRowId = (row: TRow): string => {
    const direct = sourceRowIdMap.value.get(row)
    if (direct) {
      return direct
    }
    const index = options.rows.value.indexOf(row)
    if (index >= 0) {
      return options.resolveRowKey(row, index)
    }
    return String(index)
  }

  const captureMutationSnapshot = (): AffinoDataGridMutationSnapshot<TRow> => ({
    rows: options.rows.value,
    selection: options.runtime.api.hasSelectionSupport() ? options.runtime.api.getSelectionSnapshot() : null,
  })

  const recordCellRangeIntent = async (
    descriptor: { intent: "paste" | "clear" | "cut" | "fill" | "move"; label: string; affectedRange: InternalCellRange },
    beforeSnapshot: AffinoDataGridMutationSnapshot<TRow>,
  ): Promise<void> => {
    if (!options.runtime.api.hasTransactionSupport()) {
      return
    }
    const afterSelection = options.runtime.api.hasSelectionSupport()
      ? options.runtime.api.getSelectionSnapshot()
      : null
    const affectedRange = normalizeCellRange(descriptor.affectedRange)
    await options.runtime.api.applyTransaction({
      label: descriptor.label,
      meta: {
        intent: `cells-${descriptor.intent}`,
        affectedRange: affectedRange
          ? {
              startRow: affectedRange.startRow,
              endRow: affectedRange.endRow,
              startColumn: affectedRange.startColumn,
              endColumn: affectedRange.endColumn,
            }
          : null,
      },
      commands: [
        {
          type: `cells.${descriptor.intent}`,
          payload: {
            rows: options.rows.value,
            selection: afterSelection,
          },
          rollbackPayload: {
            rows: beforeSnapshot.rows,
            selection: beforeSnapshot.selection,
          },
          meta: {
            intent: `cells-${descriptor.intent}`,
          },
        },
      ],
    })
  }

  const clipboardBridge = useDataGridClipboardBridge<TRow, InternalCellRange>({
    copiedSelectionRange,
    lastCopiedPayload: options.featureSuite.lastCopiedText,
    resolveCopyRange,
    getRowAtIndex: resolveDisplayLeafRowAtIndex,
    getColumnKeyAtIndex: resolveColumnKeyAtIndex,
    getCellValue: resolveCellValue,
    setLastAction(message) {
      setRangeLastAction(message, { action: "copy-range" })
    },
    closeContextMenu: options.closeContextMenu,
    writeClipboardText: async text => {
      await options.featureSuite.copyText(text)
    },
    readClipboardText: options.featureSuite.readText,
    isColumnCopyable: columnKey => columnKey !== "select",
  })

  const clipboardMutations = useDataGridClipboardMutations<
    TRow,
    string,
    InternalCellRange,
    { rowIndex: number; columnIndex: number },
    AffinoDataGridMutationSnapshot<TRow>
  >({
    sourceRows: options.rows,
    setSourceRows(nextRows) {
      options.rows.value = nextRows
    },
    cloneRow: cloneRowForMutation,
    resolveRowId: resolveSourceRowId,
    resolveCopyRange,
    resolveCurrentCellCoord,
    normalizeCellCoord(coord) {
      const normalized = options.resolveCellCoordByIndex(coord.rowIndex, coord.columnIndex)
      if (!normalized) {
        return null
      }
      return {
        rowIndex: normalized.rowIndex,
        columnIndex: normalized.columnIndex,
      }
    },
    normalizeSelectionRange(range) {
      return normalizeCellRange(range)
    },
    resolveRowAtViewIndex: resolveDisplayLeafRowAtIndex,
    resolveColumnKeyAtIndex: resolveColumnKeyAtIndex,
    isEditableColumn: columnKey => columnKey !== "select",
    canApplyPastedValue: () => true,
    applyEditedValue: applyDraftValue,
    clearValueForCut: clearCellValue,
    applySelectionRange(range) {
      const current = options.cellSelectionRange.value
      if (
        current
        && current.startRow === current.endRow
        && current.startColumn === current.endColumn
      ) {
        options.applySelectionFromRange(current, "end")
        return
      }
      options.applySelectionFromRange(range, "end")
    },
    closeContextMenu: options.closeContextMenu,
    setLastAction(message) {
      setRangeLastAction(message, { action: "clipboard-range" })
    },
    readClipboardPayload: clipboardBridge.readClipboardPayload,
    parseClipboardMatrix: clipboardBridge.parseClipboardMatrix,
    copySelection: clipboardBridge.copySelection,
    captureBeforeSnapshot: captureMutationSnapshot,
    async recordIntentTransaction(descriptor, beforeSnapshot) {
      try {
        await recordCellRangeIntent(descriptor, beforeSnapshot)
      } catch {
        // Keep mutation result deterministic even when history record fails.
      }
    },
  })

  const rangeMutationEngine = useDataGridRangeMutationEngine<
    TRow,
    DataGridRowNode<TRow>,
    AffinoDataGridMutationSnapshot<TRow>,
    InternalCellRange
  >({
    resolveRangeMoveBaseRange: resolveCopyRange,
    resolveRangeMovePreviewRange: () => normalizeCellRange(rangeMovePreviewRange.value),
    resolveFillBaseRange: resolveCopyRange,
    resolveFillPreviewRange: () => normalizeCellRange(fillPreviewRange.value),
    areRangesEqual: areCellRangesEqual,
    captureBeforeSnapshot: captureMutationSnapshot,
    resolveSourceRows: () => options.rows.value,
    resolveSourceRowId: resolveSourceRowId,
    applySourceRows(nextRows) {
      options.rows.value = nextRows
    },
    resolveDisplayedRows: materializeDisplayRows,
    resolveDisplayedRowId(rowNode) {
      return String(rowNode.rowId ?? rowNode.rowKey ?? rowNode.sourceIndex)
    },
    resolveColumnKeyAtIndex: resolveColumnKeyAtIndex,
    resolveDisplayedCellValue(rowNode, columnKey) {
      if (rowNode.kind !== "leaf") {
        return null
      }
      return resolveCellValue(rowNode.data as TRow, columnKey)
    },
    resolveSourceCellValue: resolveCellValue,
    normalizeClipboardValue(value) {
      if (value === null || typeof value === "undefined") {
        return ""
      }
      return String(value)
    },
    isExcludedColumn: columnKey => columnKey === "select",
    isEditableColumn: columnKey => columnKey !== "select",
    applyValueForMove: applyDraftValue,
    clearValueForMove: clearCellValue,
    applyEditedValue: applyDraftValue,
    recomputeDerived: () => {},
    isCellWithinRange(rowIndex, columnIndex, range) {
      return (
        rowIndex >= range.startRow
        && rowIndex <= range.endRow
        && columnIndex >= range.startColumn
        && columnIndex <= range.endColumn
      )
    },
    setSelectionFromRange(range, activePosition) {
      options.applySelectionFromRange(range, activePosition)
    },
    recordIntent(descriptor, beforeSnapshot) {
      void recordCellRangeIntent(descriptor, beforeSnapshot).catch(() => {
        // Keep range mutation deterministic when history logging fails.
      })
    },
    setLastAction(message) {
      setRangeLastAction(message, { action: "range-mutation" })
    },
  })

  const setFillPreviewRange = (range: AffinoDataGridCellRange | null): void => {
    fillPreviewRange.value = normalizeCellRange(range)
  }

  const setRangeMovePreviewRange = (range: AffinoDataGridCellRange | null): void => {
    rangeMovePreviewRange.value = normalizeCellRange(range)
  }

  const interactionsEnabled = ref(options.interactions.enabled)
  const rangeInteractionsEnabled = ref(options.interactions.rangeEnabled)
  const rangeFillEnabled = ref(options.interactions.fillEnabled)
  const rangeMoveEnabled = ref(options.interactions.moveEnabled)
  const rangePointerMode = ref<"idle" | "fill" | "move">("idle")
  const isRangePointerActive = ref(false)

  const clearRangePreviews = (): void => {
    setFillPreviewRange(null)
    setRangeMovePreviewRange(null)
  }

  const computeFillPreview = (
    baseRange: InternalCellRange,
    rowIndex: number,
    columnIndex: number,
  ): InternalCellRange => {
    const rowDistance = Math.abs(rowIndex - baseRange.endRow)
    const columnDistance = Math.abs(columnIndex - baseRange.endColumn)
    const fillAxis = rowDistance >= columnDistance ? "vertical" : "horizontal"
    if (fillAxis === "vertical") {
      return normalizeCellRange({
        startRow: Math.min(baseRange.startRow, rowIndex),
        endRow: Math.max(baseRange.endRow, rowIndex),
        startColumn: baseRange.startColumn,
        endColumn: baseRange.endColumn,
      }) ?? baseRange
    }
    return normalizeCellRange({
      startRow: baseRange.startRow,
      endRow: baseRange.endRow,
      startColumn: Math.min(baseRange.startColumn, columnIndex),
      endColumn: Math.max(baseRange.endColumn, columnIndex),
    }) ?? baseRange
  }

  const computeRangeMovePreview = (
    baseRange: InternalCellRange,
    rowIndex: number,
    columnIndex: number,
  ): InternalCellRange => {
    const rowSpan = Math.max(1, baseRange.endRow - baseRange.startRow + 1)
    const columnSpan = Math.max(1, baseRange.endColumn - baseRange.startColumn + 1)
    return normalizeCellRange({
      startRow: rowIndex,
      endRow: rowIndex + rowSpan - 1,
      startColumn: columnIndex,
      endColumn: columnIndex + columnSpan - 1,
    }) ?? baseRange
  }

  const updateRangePointerPreview = (rowIndex: number, columnKey: string): void => {
    if (!rangeInteractionsEnabled.value || !isRangePointerActive.value) {
      return
    }
    const baseRange = normalizeCellRange(options.cellSelectionRange.value)
    const columnIndex = options.resolveVisibleColumnIndex(columnKey)
    if (!baseRange || columnIndex < 0) {
      return
    }
    if (rangePointerMode.value === "fill" && rangeFillEnabled.value) {
      setFillPreviewRange(computeFillPreview(baseRange, rowIndex, columnIndex))
      return
    }
    if (rangePointerMode.value === "move" && rangeMoveEnabled.value) {
      setRangeMovePreviewRange(computeRangeMovePreview(baseRange, rowIndex, columnIndex))
    }
  }

  const stopRangePointerInteraction = (apply = true): void => {
    if (!isRangePointerActive.value) {
      return
    }
    const mode = rangePointerMode.value
    isRangePointerActive.value = false
    rangePointerMode.value = "idle"
    if (!apply) {
      clearRangePreviews()
      return
    }
    if (mode === "fill" && rangeFillEnabled.value) {
      rangeMutationEngine.applyFillPreview()
      return
    }
    if (mode === "move" && rangeMoveEnabled.value) {
      rangeMutationEngine.applyRangeMove()
    }
  }

  const startRangePointerInteraction = (
    mode: "fill" | "move",
    params: { rowIndex: number; columnKey: string },
  ): boolean => {
    if (!interactionsEnabled.value || !rangeInteractionsEnabled.value) {
      return false
    }
    if (mode === "fill" && !rangeFillEnabled.value) {
      return false
    }
    if (mode === "move" && !rangeMoveEnabled.value) {
      return false
    }
    const columnIndex = options.resolveVisibleColumnIndex(params.columnKey)
    if (columnIndex < 0 || !normalizeCellRange(options.cellSelectionRange.value)) {
      return false
    }
    rangePointerMode.value = mode
    isRangePointerActive.value = true
    updateRangePointerPreview(params.rowIndex, params.columnKey)
    return true
  }

  const copySelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardBridge.copySelection(trigger)
  )

  const pasteSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardMutations.pasteSelection(trigger)
  )

  const cutSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardMutations.cutSelection(trigger)
  )

  const clearSelection = (trigger: "keyboard" | "context-menu" = "context-menu") => (
    clipboardMutations.clearCurrentSelection(trigger)
  )

  const hasCellRangeContext = (): boolean => Boolean(resolveCopyRange() || resolveCurrentCellCoord())

  return {
    copiedRange: copiedSelectionRange,
    fillPreviewRange,
    rangeMovePreviewRange,
    lastAction: cellRangeLastAction,
    interactionsEnabled,
    rangeInteractionsEnabled,
    rangeFillEnabled,
    rangeMoveEnabled,
    rangePointerMode,
    stopRangePointerInteraction,
    startRangePointerInteraction,
    updateRangePointerPreview,
    hasCellRangeContext,
    resolveActiveRangeCellCount,
    copySelection,
    pasteSelection,
    cutSelection,
    clearSelection,
    setFillPreviewRange,
    setRangeMovePreviewRange,
    applyFillPreview: rangeMutationEngine.applyFillPreview,
    applyRangeMove: rangeMutationEngine.applyRangeMove,
    dispose: clipboardBridge.dispose,
  }
}
