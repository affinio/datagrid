export interface DataGridRangeMutationRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridRangeMutationEngineOptions<
  TRow,
  TDisplayRow,
  TSnapshot,
  TRange extends DataGridRangeMutationRange = DataGridRangeMutationRange,
> {
  resolveRangeMoveBaseRange: () => TRange | null
  resolveRangeMovePreviewRange: () => TRange | null
  resolveFillBaseRange: () => TRange | null
  resolveFillPreviewRange: () => TRange | null
  areRangesEqual: (left: TRange | null, right: TRange | null) => boolean
  captureBeforeSnapshot: () => TSnapshot
  resolveSourceRows: () => readonly TRow[]
  resolveSourceRowId: (row: TRow) => string
  applySourceRows: (rows: TRow[]) => void
  resolveDisplayedRows: () => readonly TDisplayRow[]
  resolveDisplayedRowId: (row: TDisplayRow) => string
  resolveColumnKeyAtIndex: (columnIndex: number) => string | null
  resolveDisplayedCellValue: (row: TDisplayRow, columnKey: string) => unknown
  resolveSourceCellValue: (row: TRow, columnKey: string) => unknown
  normalizeClipboardValue: (value: unknown) => string
  isExcludedColumn?: (columnKey: string) => boolean
  isEditableColumn: (columnKey: string) => boolean
  applyValueForMove: (row: TRow, columnKey: string, value: string) => boolean
  clearValueForMove: (row: TRow, columnKey: string) => boolean
  applyEditedValue: (row: TRow, columnKey: string, draft: string) => void
  shouldRecomputeDerivedForColumn?: (columnKey: string) => boolean
  recomputeDerived: (row: TRow) => void
  isCellWithinRange: (rowIndex: number, columnIndex: number, range: TRange) => boolean
  setSelectionFromRange: (range: TRange, activePosition: "start" | "end") => void
  recordIntent: (
    descriptor: { intent: "move" | "fill"; label: string; affectedRange: TRange },
    beforeSnapshot: TSnapshot,
  ) => void | Promise<void>
  setLastAction: (message: string) => void
}

export interface UseDataGridRangeMutationEngineResult {
  applyRangeMove: () => boolean
  applyFillPreview: () => void
}

function positiveModulo(value: number, divisor: number): number {
  if (divisor <= 0) {
    return 0
  }
  const remainder = value % divisor
  return remainder < 0 ? remainder + divisor : remainder
}

export function useDataGridRangeMutationEngine<
  TRow,
  TDisplayRow,
  TSnapshot,
  TRange extends DataGridRangeMutationRange = DataGridRangeMutationRange,
>(
  options: UseDataGridRangeMutationEngineOptions<TRow, TDisplayRow, TSnapshot, TRange>,
): UseDataGridRangeMutationEngineResult {
  const isExcludedColumn = options.isExcludedColumn ?? (columnKey => columnKey === "select")
  const shouldRecomputeDerivedForColumn = options.shouldRecomputeDerivedForColumn ?? (() => false)

  function applyRangeMove(): boolean {
    const baseRange = options.resolveRangeMoveBaseRange()
    const targetRange = options.resolveRangeMovePreviewRange()
    if (!baseRange || !targetRange || options.areRangesEqual(baseRange, targetRange)) {
      return false
    }
    const beforeSnapshot = options.captureBeforeSnapshot()

    const sourceRows = options.resolveSourceRows()
    const sourceById = new Map(sourceRows.map(row => [options.resolveSourceRowId(row), row]))
    const mutableById = new Map<string, TRow>()
    const needsRecompute = new Set<string>()
    const moveEntries: Array<{
      sourceRowId: string
      sourceColumnKey: string
      targetRowId: string
      targetColumnKey: string
      value: string
    }> = []

    const getMutableRow = (rowId: string): TRow | null => {
      const existing = mutableById.get(rowId)
      if (existing) {
        return existing
      }
      const source = sourceById.get(rowId)
      if (!source) {
        return null
      }
      const clone = { ...source } as TRow
      mutableById.set(rowId, clone)
      return clone
    }

    let blocked = 0
    const displayedRows = options.resolveDisplayedRows()
    const rowSpan = baseRange.endRow - baseRange.startRow
    const columnSpan = baseRange.endColumn - baseRange.startColumn
    for (let rowOffset = 0; rowOffset <= rowSpan; rowOffset += 1) {
      const sourceRow = displayedRows[baseRange.startRow + rowOffset]
      const targetRow = displayedRows[targetRange.startRow + rowOffset]
      if (!sourceRow || !targetRow) {
        blocked += columnSpan + 1
        continue
      }
      for (let columnOffset = 0; columnOffset <= columnSpan; columnOffset += 1) {
        const sourceColumnKey = options.resolveColumnKeyAtIndex(baseRange.startColumn + columnOffset)
        const targetColumnKey = options.resolveColumnKeyAtIndex(targetRange.startColumn + columnOffset)
        if (!sourceColumnKey || !targetColumnKey) {
          blocked += 1
          continue
        }
        if (isExcludedColumn(sourceColumnKey) || isExcludedColumn(targetColumnKey)) {
          blocked += 1
          continue
        }
        moveEntries.push({
          sourceRowId: options.resolveDisplayedRowId(sourceRow),
          sourceColumnKey,
          targetRowId: options.resolveDisplayedRowId(targetRow),
          targetColumnKey,
          value: options.normalizeClipboardValue(
            options.resolveDisplayedCellValue(sourceRow, sourceColumnKey),
          ),
        })
      }
    }

    if (!moveEntries.length) {
      if (blocked > 0) {
        options.setLastAction(`Move blocked (${blocked} cells)`)
      }
      return false
    }

    const sourceCellsToClear = new Map<string, Set<string>>()
    for (const entry of moveEntries) {
      const rowCells = sourceCellsToClear.get(entry.sourceRowId) ?? new Set<string>()
      rowCells.add(entry.sourceColumnKey)
      sourceCellsToClear.set(entry.sourceRowId, rowCells)
    }

    for (const [rowId, columnKeys] of sourceCellsToClear.entries()) {
      const mutable = getMutableRow(rowId)
      if (!mutable) {
        blocked += columnKeys.size
        continue
      }
      for (const columnKey of columnKeys) {
        const didClear = options.clearValueForMove(mutable, columnKey)
        if (!didClear) {
          blocked += 1
          continue
        }
        if (shouldRecomputeDerivedForColumn(columnKey)) {
          needsRecompute.add(rowId)
        }
      }
    }

    let applied = 0
    for (const entry of moveEntries) {
      const mutable = getMutableRow(entry.targetRowId)
      if (!mutable) {
        blocked += 1
        continue
      }
      const didApply = options.applyValueForMove(mutable, entry.targetColumnKey, entry.value)
      if (!didApply) {
        blocked += 1
        continue
      }
      if (shouldRecomputeDerivedForColumn(entry.targetColumnKey)) {
        needsRecompute.add(entry.targetRowId)
      }
      applied += 1
    }

    for (const rowId of needsRecompute) {
      const row = mutableById.get(rowId)
      if (!row) {
        continue
      }
      options.recomputeDerived(row)
    }

    options.applySourceRows(sourceRows.map(row => mutableById.get(options.resolveSourceRowId(row)) ?? row))
    options.setSelectionFromRange(targetRange, "start")
    void options.recordIntent(
      {
        intent: "move",
        label: blocked > 0 ? `Move ${applied} cells (blocked ${blocked})` : `Move ${applied} cells`,
        affectedRange: targetRange,
      },
      beforeSnapshot,
    )
    options.setLastAction(
      blocked > 0 ? `Moved ${applied} cells, blocked ${blocked}` : `Moved ${applied} cells`,
    )
    return applied > 0
  }

  function applyFillPreview(): void {
    const baseRange = options.resolveFillBaseRange()
    const previewRange = options.resolveFillPreviewRange()
    if (!baseRange || !previewRange || options.areRangesEqual(baseRange, previewRange)) {
      return
    }
    const beforeSnapshot = options.captureBeforeSnapshot()
    const displayedRows = options.resolveDisplayedRows()
    if (!displayedRows.length) {
      return
    }
    const baseHeight = baseRange.endRow - baseRange.startRow + 1
    if (baseHeight <= 0) {
      return
    }

    const sourceRows = options.resolveSourceRows()
    const sourceById = new Map(sourceRows.map(row => [options.resolveSourceRowId(row), row]))
    const mutableById = new Map<string, TRow>()
    const needsRecompute = new Set<string>()
    const baseEditableKeys = new Set<string>()

    for (let columnIndex = baseRange.startColumn; columnIndex <= baseRange.endColumn; columnIndex += 1) {
      const columnKey = options.resolveColumnKeyAtIndex(columnIndex)
      if (!columnKey) {
        continue
      }
      if (!options.isEditableColumn(columnKey) || isExcludedColumn(columnKey)) {
        continue
      }
      baseEditableKeys.add(columnKey)
    }
    if (!baseEditableKeys.size) {
      return
    }

    const getMutableRow = (rowId: string): TRow | null => {
      const existing = mutableById.get(rowId)
      if (existing) {
        return existing
      }
      const source = sourceById.get(rowId)
      if (!source) {
        return null
      }
      const clone = { ...source } as TRow
      mutableById.set(rowId, clone)
      return clone
    }

    let changedCells = 0
    for (let rowIndex = previewRange.startRow; rowIndex <= previewRange.endRow; rowIndex += 1) {
      const destinationDisplayRow = displayedRows[rowIndex]
      if (!destinationDisplayRow) {
        continue
      }
      for (let columnIndex = previewRange.startColumn; columnIndex <= previewRange.endColumn; columnIndex += 1) {
        if (options.isCellWithinRange(rowIndex, columnIndex, baseRange)) {
          continue
        }
        const columnKey = options.resolveColumnKeyAtIndex(columnIndex)
        if (!columnKey || isExcludedColumn(columnKey)) {
          continue
        }
        if (!options.isEditableColumn(columnKey) || !baseEditableKeys.has(columnKey)) {
          continue
        }

        const sourceRowIndex = baseRange.startRow + positiveModulo(rowIndex - baseRange.startRow, baseHeight)
        const sourceDisplayRow = displayedRows[sourceRowIndex]
        if (!sourceDisplayRow) {
          continue
        }

        const sourceRow = sourceById.get(options.resolveDisplayedRowId(sourceDisplayRow))
        const destinationRow = getMutableRow(options.resolveDisplayedRowId(destinationDisplayRow))
        if (!sourceRow || !destinationRow) {
          continue
        }

        options.applyEditedValue(
          destinationRow,
          columnKey,
          String(options.resolveSourceCellValue(sourceRow, columnKey) ?? ""),
        )
        if (shouldRecomputeDerivedForColumn(columnKey)) {
          needsRecompute.add(options.resolveSourceRowId(destinationRow))
        }
        changedCells += 1
      }
    }

    if (changedCells === 0) {
      return
    }

    for (const rowId of needsRecompute) {
      const row = mutableById.get(rowId)
      if (!row) {
        continue
      }
      options.recomputeDerived(row)
    }

    options.applySourceRows(sourceRows.map(row => mutableById.get(options.resolveSourceRowId(row)) ?? row))
    options.setSelectionFromRange(previewRange, "end")
    void options.recordIntent(
      {
        intent: "fill",
        label: `Fill ${changedCells} cells`,
        affectedRange: previewRange,
      },
      beforeSnapshot,
    )
    options.setLastAction(`Fill applied (${changedCells} cells)`)
  }

  return {
    applyRangeMove,
    applyFillPreview,
  }
}
