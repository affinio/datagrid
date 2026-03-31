import { computed, ref, type ComputedRef, type Ref } from "vue"
import {
  parseDataGridCellDraftValue,
  type DataGridColumnSnapshot,
  type DataGridRowNode,
  type UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"

export interface DataGridFindReplaceCellCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridFindReplaceVisualTarget {
  rowId: string | number
  columnKey: string
  flashPhase: 0 | 1
}

export interface UseDataGridAppFindReplaceOptions<TRow extends Record<string, unknown>, TSnapshot> {
  runtime: Pick<
    UseDataGridRuntimeResult<TRow>,
    "api" | "getBodyRowAtIndex" | "resolveBodyRowIndexById"
  >
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  stageVisibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  resolveCurrentCellCoord: () => DataGridFindReplaceCellCoord | null
  applyActiveCell: (coord: DataGridFindReplaceCellCoord) => void
  revealCellInComfortZone: (rowIndex: number, columnIndex: number) => void | Promise<void>
  captureRowsSnapshot: () => TSnapshot
  captureRowsSnapshotForRowIds: (rowIds: readonly (string | number)[]) => TSnapshot
  recordHistoryIntentTransaction: (
    descriptor: {
      intent: string
      label: string
      affectedRange?: {
        startRow: number
        endRow: number
        startColumn: number
        endColumn: number
      } | null
    },
    beforeSnapshot: TSnapshot,
  ) => void
  isCellEditable: (
    row: DataGridRowNode<TRow>,
    rowIndex: number,
    column: DataGridColumnSnapshot,
    columnIndex: number,
  ) => boolean
}

interface DataGridFindReplaceMatch {
  rowId: string | number
  rowIndex: number
  dataColumnIndex: number
  stageColumnIndex: number
  columnKey: string
}

export interface UseDataGridAppFindReplaceResult {
  isPanelOpen: Ref<boolean>
  findText: Ref<string>
  replaceText: Ref<string>
  matchCase: Ref<boolean>
  statusText: Ref<string>
  active: ComputedRef<boolean>
  canFind: ComputedRef<boolean>
  canReplaceCurrent: ComputedRef<boolean>
  canReplaceAll: ComputedRef<boolean>
  highlightedCell: ComputedRef<DataGridFindReplaceVisualTarget | null>
  openPanel: () => void
  closePanel: () => void
  updateFindText: (value: string) => void
  updateReplaceText: (value: string) => void
  updateMatchCase: (value: boolean) => void
  findNext: () => Promise<boolean>
  findPrevious: () => Promise<boolean>
  replaceCurrent: () => Promise<boolean>
  replaceAll: () => Promise<number>
}

const EMPTY_STATUS = ""

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeSearchText(value: string, matchCase: boolean): string {
  return matchCase ? value : value.toLocaleLowerCase()
}

function replaceFirstOccurrence(
  source: string,
  query: string,
  replacement: string,
  matchCase: boolean,
): string | null {
  const normalizedSource = normalizeSearchText(source, matchCase)
  const normalizedQuery = normalizeSearchText(query, matchCase)
  const index = normalizedSource.indexOf(normalizedQuery)
  if (index < 0) {
    return null
  }
  return source.slice(0, index) + replacement + source.slice(index + query.length)
}

function replaceAllOccurrences(
  source: string,
  query: string,
  replacement: string,
  matchCase: boolean,
): { value: string; count: number } {
  const normalizedSource = normalizeSearchText(source, matchCase)
  const normalizedQuery = normalizeSearchText(query, matchCase)
  if (normalizedQuery.length === 0) {
    return { value: source, count: 0 }
  }
  let searchIndex = 0
  let replacementCount = 0
  let nextValue = ""

  while (searchIndex < source.length) {
    const matchIndex = normalizedSource.indexOf(normalizedQuery, searchIndex)
    if (matchIndex < 0) {
      nextValue += source.slice(searchIndex)
      break
    }
    nextValue += source.slice(searchIndex, matchIndex)
    nextValue += replacement
    searchIndex = matchIndex + query.length
    replacementCount += 1
  }

  return {
    value: replacementCount > 0 ? nextValue : source,
    count: replacementCount,
  }
}

export function useDataGridAppFindReplace<
  TRow extends Record<string, unknown>,
  TSnapshot,
>(
  options: UseDataGridAppFindReplaceOptions<TRow, TSnapshot>,
): UseDataGridAppFindReplaceResult {
  const isPanelOpen = ref(false)
  const findText = ref("")
  const replaceText = ref("")
  const matchCase = ref(false)
  const statusText = ref(EMPTY_STATUS)
  const activeMatch = ref<DataGridFindReplaceMatch | null>(null)
  const highlightedCellRef = ref<DataGridFindReplaceVisualTarget | null>(null)
  const flashPhase = ref<0 | 1>(0)

  const stageColumnIndexByKey = computed(() => {
    const indexByKey = new Map<string, number>()
    options.stageVisibleColumns.value.forEach((column, index) => {
      indexByKey.set(column.key, index)
    })
    return indexByKey
  })

  const normalizedQuery = computed(() => findText.value.trim())
  const canFind = computed(() => normalizedQuery.value.length > 0 && options.visibleColumns.value.length > 0)
  const canReplaceCurrent = computed(() => canFind.value && activeMatch.value !== null)
  const canReplaceAll = computed(() => canFind.value)
  const active = computed(() => isPanelOpen.value || normalizedQuery.value.length > 0)
  const highlightedCell = computed(() => highlightedCellRef.value)

  const clearActiveMatch = (): void => {
    activeMatch.value = null
  }

  const clearHighlightedCell = (): void => {
    highlightedCellRef.value = null
  }

  const updateHighlightedCell = (rowId: string | number, columnKey: string): void => {
    flashPhase.value = flashPhase.value === 0 ? 1 : 0
    highlightedCellRef.value = {
      rowId,
      columnKey,
      flashPhase: flashPhase.value,
    }
  }

  const resolveRowAtIndex = (rowIndex: number): DataGridRowNode<TRow> | null => {
    return options.runtime.getBodyRowAtIndex(rowIndex) ?? options.runtime.api.rows.get(rowIndex) ?? null
  }

  const resolveRowById = (rowId: string | number): { row: DataGridRowNode<TRow>; rowIndex: number } | null => {
    const rowIndex = options.runtime.resolveBodyRowIndexById(rowId)
    if (rowIndex >= 0) {
      const row = resolveRowAtIndex(rowIndex)
      if (row && row.rowId === rowId) {
        return { row, rowIndex }
      }
    }
    const rowCount = options.runtime.api.rows.getCount()
    for (let candidateIndex = 0; candidateIndex < rowCount; candidateIndex += 1) {
      const candidate = options.runtime.api.rows.get(candidateIndex)
      if (candidate && candidate.rowId === rowId) {
        return {
          row: candidate as DataGridRowNode<TRow>,
          rowIndex: candidateIndex,
        }
      }
    }
    return null
  }

  const resolveCellSourceValue = (
    row: DataGridRowNode<TRow>,
    column: DataGridColumnSnapshot,
  ): unknown => {
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
    return (row.data as Record<string, unknown>)[field]
  }

  const readSearchableCellText = (
    row: DataGridRowNode<TRow>,
    column: DataGridColumnSnapshot,
  ): string => {
    const value = resolveCellSourceValue(row, column)
    return value == null ? "" : String(value)
  }

  const resolveSearchOriginLinearIndex = (direction: 1 | -1): number => {
    const rowCount = options.runtime.api.rows.getCount()
    const columnCount = options.visibleColumns.value.length
    if (rowCount <= 0 || columnCount <= 0) {
      return -1
    }
    const currentMatch = activeMatch.value
    if (currentMatch) {
      const resolvedRowIndex = options.runtime.resolveBodyRowIndexById(currentMatch.rowId)
      const rowIndex = resolvedRowIndex >= 0 ? resolvedRowIndex : currentMatch.rowIndex
      return (clamp(rowIndex, 0, rowCount - 1) * columnCount) + currentMatch.dataColumnIndex
    }
    const currentCoord = options.resolveCurrentCellCoord()
    if (!currentCoord) {
      return direction > 0 ? -1 : 0
    }
    const stageColumnKey = options.stageVisibleColumns.value[currentCoord.columnIndex]?.key ?? null
    const dataColumnIndex = stageColumnKey == null
      ? -1
      : options.visibleColumns.value.findIndex(column => column.key === stageColumnKey)
    const rowIndex = clamp(currentCoord.rowIndex, 0, rowCount - 1)
    if (direction > 0) {
      return (rowIndex * columnCount) + dataColumnIndex
    }
    return dataColumnIndex >= 0
      ? (rowIndex * columnCount) + dataColumnIndex
      : (rowIndex * columnCount)
  }

  const activateMatch = async (match: DataGridFindReplaceMatch, status: string): Promise<void> => {
    activeMatch.value = match
    updateHighlightedCell(match.rowId, match.columnKey)
    options.applyActiveCell({
      rowIndex: match.rowIndex,
      columnIndex: match.stageColumnIndex,
    })
    await options.revealCellInComfortZone(match.rowIndex, match.stageColumnIndex)
    statusText.value = status
  }

  const findRelative = async (direction: 1 | -1): Promise<boolean> => {
    const query = normalizedQuery.value
    const columnCount = options.visibleColumns.value.length
    const rowCount = options.runtime.api.rows.getCount()
    if (query.length === 0) {
      clearActiveMatch()
      clearHighlightedCell()
      statusText.value = "Enter a value to find."
      return false
    }
    if (columnCount === 0 || rowCount === 0) {
      clearActiveMatch()
      clearHighlightedCell()
      statusText.value = "No searchable cells in the current grid."
      return false
    }

    const normalizedSearchQuery = normalizeSearchText(query, matchCase.value)
    const originLinearIndex = resolveSearchOriginLinearIndex(direction)
    const totalPositions = rowCount * columnCount

    for (let step = 1; step <= totalPositions; step += 1) {
      const linearIndex = direction > 0
        ? (originLinearIndex + step + totalPositions) % totalPositions
        : (originLinearIndex - step + totalPositions) % totalPositions
      const rowIndex = Math.floor(linearIndex / columnCount)
      const dataColumnIndex = linearIndex % columnCount
      const row = resolveRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        continue
      }
      const column = options.visibleColumns.value[dataColumnIndex]
      if (!column) {
        continue
      }
      const cellText = readSearchableCellText(row, column)
      if (!normalizeSearchText(cellText, matchCase.value).includes(normalizedSearchQuery)) {
        continue
      }
      const stageColumnIndex = stageColumnIndexByKey.value.get(column.key)
      if (stageColumnIndex == null) {
        continue
      }
      await activateMatch({
        rowId: row.rowId,
        rowIndex,
        dataColumnIndex,
        stageColumnIndex,
        columnKey: column.key,
      }, `Found in ${column.column.label ?? column.key} at row ${rowIndex + 1}.`)
      return true
    }

    clearActiveMatch()
    clearHighlightedCell()
    statusText.value = `No matches for “${query}”.`
    return false
  }

  const openPanel = (): void => {
    isPanelOpen.value = true
  }

  const closePanel = (): void => {
    isPanelOpen.value = false
  }

  const updateFindText = (value: string): void => {
    findText.value = value
    clearActiveMatch()
    clearHighlightedCell()
    statusText.value = EMPTY_STATUS
  }

  const updateReplaceText = (value: string): void => {
    replaceText.value = value
  }

  const updateMatchCase = (value: boolean): void => {
    matchCase.value = value
    clearActiveMatch()
    clearHighlightedCell()
    statusText.value = EMPTY_STATUS
  }

  const findNext = (): Promise<boolean> => findRelative(1)
  const findPrevious = (): Promise<boolean> => findRelative(-1)

  const replaceCurrent = async (): Promise<boolean> => {
    if (!canFind.value) {
      statusText.value = "Enter a value to find."
      return false
    }
    if (!activeMatch.value) {
      return findNext()
    }
    const query = normalizedQuery.value
    const currentMatch = activeMatch.value
    const resolvedRow = resolveRowById(currentMatch.rowId)
    if (!resolvedRow) {
      clearActiveMatch()
      clearHighlightedCell()
      statusText.value = "The active match is no longer available."
      return false
    }
    const column = options.visibleColumns.value.find(candidate => candidate.key === currentMatch.columnKey)
    if (!column) {
      clearActiveMatch()
      clearHighlightedCell()
      statusText.value = "The active match column is no longer visible."
      return false
    }
    const columnIndex = options.visibleColumns.value.findIndex(candidate => candidate.key === column.key)
    if (columnIndex < 0) {
      clearActiveMatch()
      clearHighlightedCell()
      statusText.value = "The active match column is no longer searchable."
      return false
    }
    if (!options.isCellEditable(resolvedRow.row, resolvedRow.rowIndex, column, columnIndex)) {
      statusText.value = `${column.column.label ?? column.key} is read-only.`
      return false
    }
    const currentText = readSearchableCellText(resolvedRow.row, column)
    const nextText = replaceFirstOccurrence(currentText, query, replaceText.value, matchCase.value)
    if (nextText == null || nextText === currentText) {
      statusText.value = "The active cell no longer matches the current query."
      clearActiveMatch()
      clearHighlightedCell()
      return false
    }
    const beforeSnapshot = options.captureRowsSnapshotForRowIds([resolvedRow.row.rowId])
    options.runtime.api.rows.applyEdits([{
      rowId: resolvedRow.row.rowId,
      data: {
        [column.key]: parseDataGridCellDraftValue({
          column: column.column,
          row: resolvedRow.row.data,
          draft: nextText,
        }),
      } as Partial<TRow>,
    }])
    options.recordHistoryIntentTransaction({
      intent: "edit",
      label: "Replace",
      affectedRange: {
        startRow: resolvedRow.rowIndex,
        endRow: resolvedRow.rowIndex,
        startColumn: columnIndex,
        endColumn: columnIndex,
      },
    }, beforeSnapshot)
    updateHighlightedCell(resolvedRow.row.rowId, column.key)

    const hasNextMatch = await findRelative(1)
    if (!hasNextMatch) {
      const stageColumnIndex = stageColumnIndexByKey.value.get(column.key)
      const currentRowIndex = options.runtime.resolveBodyRowIndexById(resolvedRow.row.rowId)
      if (stageColumnIndex != null && currentRowIndex >= 0) {
        options.applyActiveCell({
          rowIndex: currentRowIndex,
          columnIndex: stageColumnIndex,
        })
        await options.revealCellInComfortZone(currentRowIndex, stageColumnIndex)
      }
      statusText.value = "Replaced 1 match."
    }
    else {
      statusText.value = "Replaced 1 match."
    }
    return true
  }

  const replaceAll = async (): Promise<number> => {
    const query = normalizedQuery.value
    const columnCount = options.visibleColumns.value.length
    const rowCount = options.runtime.api.rows.getCount()
    if (query.length === 0) {
      statusText.value = "Enter a value to find."
      return 0
    }
    if (columnCount === 0 || rowCount === 0) {
      statusText.value = "No searchable cells in the current grid."
      return 0
    }

    const updatesByRowId = new Map<string | number, Partial<TRow>>()
    const affectedRowIds: Array<string | number> = []
    const affectedRowIdSet = new Set<string | number>()
    let firstAffectedMatch: DataGridFindReplaceMatch | null = null
    let replacedCellCount = 0
    let startRow = Number.POSITIVE_INFINITY
    let endRow = Number.NEGATIVE_INFINITY
    let startColumn = Number.POSITIVE_INFINITY
    let endColumn = Number.NEGATIVE_INFINITY

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = resolveRowAtIndex(rowIndex)
      if (!row || row.rowId == null || row.kind === "group") {
        continue
      }
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const column = options.visibleColumns.value[columnIndex]
        if (!column || !options.isCellEditable(row, rowIndex, column, columnIndex)) {
          continue
        }
        const currentText = readSearchableCellText(row, column)
        const replaced = replaceAllOccurrences(currentText, query, replaceText.value, matchCase.value)
        if (replaced.count <= 0 || replaced.value === currentText) {
          continue
        }
        const currentRowUpdate = updatesByRowId.get(row.rowId) ?? {}
        currentRowUpdate[column.key] = parseDataGridCellDraftValue({
          column: column.column,
          row: row.data,
          draft: replaced.value,
        }) as Partial<TRow>[keyof TRow]
        updatesByRowId.set(row.rowId, currentRowUpdate)
        if (!affectedRowIdSet.has(row.rowId)) {
          affectedRowIdSet.add(row.rowId)
          affectedRowIds.push(row.rowId)
        }
        replacedCellCount += replaced.count
        startRow = Math.min(startRow, rowIndex)
        endRow = Math.max(endRow, rowIndex)
        startColumn = Math.min(startColumn, columnIndex)
        endColumn = Math.max(endColumn, columnIndex)
        if (!firstAffectedMatch) {
          const stageColumnIndex = stageColumnIndexByKey.value.get(column.key)
          if (stageColumnIndex != null) {
            firstAffectedMatch = {
              rowId: row.rowId,
              rowIndex,
              dataColumnIndex: columnIndex,
              stageColumnIndex,
              columnKey: column.key,
            }
          }
        }
      }
    }

    if (updatesByRowId.size === 0) {
      clearActiveMatch()
      clearHighlightedCell()
      statusText.value = `No editable matches for “${query}”.`
      return 0
    }

    const beforeSnapshot = options.captureRowsSnapshotForRowIds(affectedRowIds)
    options.runtime.api.rows.applyEdits(Array.from(updatesByRowId.entries(), ([rowId, data]) => ({
      rowId,
      data,
    })))
    options.recordHistoryIntentTransaction({
      intent: "edit",
      label: "Replace all",
      affectedRange: Number.isFinite(startRow) && Number.isFinite(startColumn)
        ? {
          startRow,
          endRow,
          startColumn,
          endColumn,
        }
        : null,
    }, beforeSnapshot)

    clearActiveMatch()
    if (firstAffectedMatch) {
      const resolvedRowIndex = options.runtime.resolveBodyRowIndexById(firstAffectedMatch.rowId)
      if (resolvedRowIndex >= 0) {
        updateHighlightedCell(firstAffectedMatch.rowId, firstAffectedMatch.columnKey)
        options.applyActiveCell({
          rowIndex: resolvedRowIndex,
          columnIndex: firstAffectedMatch.stageColumnIndex,
        })
        await options.revealCellInComfortZone(resolvedRowIndex, firstAffectedMatch.stageColumnIndex)
      }
      else {
        clearHighlightedCell()
      }
    }

    statusText.value = `Replaced ${replacedCellCount} match${replacedCellCount === 1 ? "" : "es"} across ${updatesByRowId.size} row${updatesByRowId.size === 1 ? "" : "s"}.`
    return replacedCellCount
  }

  return {
    isPanelOpen,
    findText,
    replaceText,
    matchCase,
    statusText,
    active,
    canFind,
    canReplaceCurrent,
    canReplaceAll,
    highlightedCell,
    openPanel,
    closePanel,
    updateFindText,
    updateReplaceText,
    updateMatchCase,
    findNext,
    findPrevious,
    replaceCurrent,
    replaceAll,
  }
}
