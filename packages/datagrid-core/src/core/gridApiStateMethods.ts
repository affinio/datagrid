import type {
  DataGridAggregationModel,
  DataGridColumnModel,
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPivotSpec,
  DataGridRowModel,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../models/index.js"
import type {
  DataGridBackpressureControlCapability,
  DataGridRowSelectionCapability,
  DataGridColumnSelectionCapability,
  DataGridSelectionCapability,
  DataGridSortFilterBatchCapability,
  DataGridTransactionCapability,
} from "./gridApiCapabilities"
import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection"
import {
  dataGridColumnSelectionSnapshotsEqual,
  normalizeDataGridColumnSelectionSnapshot,
} from "../selection/columnSelection.js"
import type { DataGridColumnSelectionSnapshot } from "../selection/columnSelection.js"
import type {
  DataGridGetStateOptions,
  DataGridMigrateStateOptions,
  DataGridSetStateOptions,
  DataGridUnifiedState,
} from "./gridApiContracts"
import { DataGridStateRestoreError } from "./gridApiContracts"
import type { DataGridStateRestoreReport, DataGridStateRestoreValidation } from "./gridApiContracts"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type { DataGridViewportPositionSnapshot } from "./gridApiViewContracts"

export interface DataGridApiStateMethods<TRow = unknown> {
  getUnifiedState: (options?: DataGridGetStateOptions) => DataGridUnifiedState<TRow>
  migrateUnifiedState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<TRow> | null
  validateUnifiedState: (state: unknown, options?: DataGridSetStateOptions) => DataGridStateRestoreValidation
  setUnifiedState: (state: DataGridUnifiedState<TRow>, options?: DataGridSetStateOptions) => DataGridStateRestoreReport
}

export interface CreateDataGridApiStateMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  getSelectionCapability: () => DataGridSelectionCapability | null
  getRowSelectionCapability: () => DataGridRowSelectionCapability | null
  getColumnSelectionCapability: () => DataGridColumnSelectionCapability | null
  getTransactionCapability: () => DataGridTransactionCapability | null
  getSortFilterBatchCapability: () => DataGridSortFilterBatchCapability | null
  getBackpressureControlCapability?: () => DataGridBackpressureControlCapability | null
  setViewportRange: (range: DataGridViewportRange) => void
  getViewportPosition: () => DataGridViewportPositionSnapshot | null
  setViewportPosition: (
    position: DataGridViewportPositionSnapshot,
    options?: DataGridSetStateOptions,
  ) => void
  onSelectionChanged?: (snapshot: DataGridSelectionSnapshot | null) => void
  onRowSelectionChanged?: (snapshot: DataGridRowSelectionSnapshot | null) => void
  onColumnSelectionChanged?: (snapshot: DataGridColumnSelectionSnapshot | null) => void
  onStateImported?: (state: DataGridUnifiedState<TRow>) => void
}

function cloneSerializable<T>(value: T): T {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(input: U) => U
  }).structuredClone
  if (typeof structuredCloneRef === "function") {
    try {
      return structuredCloneRef(value)
    } catch {
      // Fall through to JSON clone.
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function normalizePin(pin: unknown): DataGridColumnPin | null {
  return pin === "left" || pin === "right" || pin === "none" ? pin : null
}

function normalizeSortModel(value: unknown): readonly DataGridSortState[] {
  if (!Array.isArray(value)) {
    return []
  }
  return cloneSerializable(value as readonly DataGridSortState[])
}

function normalizeFilterModel(value: unknown): DataGridFilterSnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridFilterSnapshot)
}

function normalizeGroupBy(value: unknown): DataGridGroupBySpec | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridGroupBySpec)
}

function normalizePivotModel(value: unknown): DataGridPivotSpec | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridPivotSpec)
}

function normalizeAggregationModel<TRow>(value: unknown): DataGridAggregationModel<TRow> | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridAggregationModel<TRow>)
}

function normalizeGroupExpansion(value: unknown): DataGridGroupExpansionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }
  return cloneSerializable(value as DataGridGroupExpansionSnapshot)
}

function normalizeViewportRange(value: unknown): DataGridViewportRange | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const range = value as Partial<DataGridViewportRange>
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return null
  }
  const start = Math.max(0, Math.trunc(range.start as number))
  const end = Math.max(start, Math.trunc(range.end as number))
  return { start, end }
}

function normalizePaginationInput(value: unknown): DataGridPaginationInput | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const pagination = value as { enabled?: unknown; pageSize?: unknown; currentPage?: unknown }
  if (pagination.enabled === false) {
    return null
  }
  if (!Number.isFinite(pagination.pageSize) || !Number.isFinite(pagination.currentPage)) {
    return null
  }
  const pageSize = Math.max(1, Math.trunc(pagination.pageSize as number))
  const currentPage = Math.max(0, Math.trunc(pagination.currentPage as number))
  return { pageSize, currentPage }
}

function normalizeNullableNumber(value: unknown): number | null {
  return Number.isFinite(value) ? Math.trunc(value as number) : null
}

function normalizeViewportPosition(value: unknown): DataGridViewportPositionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const candidate = value as Partial<DataGridViewportPositionSnapshot>
  if (candidate.version !== 1) {
    return null
  }
  const range = normalizeViewportRange(candidate.range)
  if (!range) {
    return null
  }
  const anchor = candidate.anchor && typeof candidate.anchor === "object"
    ? {
        rowId: candidate.anchor.rowId ?? null,
        rowIndex: normalizeNullableNumber(candidate.anchor.rowIndex),
        columnKey: typeof candidate.anchor.columnKey === "string" ? candidate.anchor.columnKey : null,
        columnIndex: normalizeNullableNumber(candidate.anchor.columnIndex),
      }
    : null
  const scroll = candidate.scroll && typeof candidate.scroll === "object"
    ? {
        top: Number.isFinite(candidate.scroll.top) ? Math.max(0, candidate.scroll.top) : 0,
        left: Number.isFinite(candidate.scroll.left) ? Math.max(0, candidate.scroll.left) : 0,
      }
    : null
  return {
    version: 1,
    range,
    anchor,
    scroll,
  }
}

export function createDataGridApiStateMethods<TRow = unknown>(
  input: CreateDataGridApiStateMethodsInput<TRow>,
): DataGridApiStateMethods<TRow> {
  const {
    rowModel,
    columnModel,
    getSelectionCapability,
    getRowSelectionCapability,
    getColumnSelectionCapability,
    getTransactionCapability,
    getSortFilterBatchCapability,
    getBackpressureControlCapability,
    setViewportRange,
    getViewportPosition,
    setViewportPosition,
    onSelectionChanged,
    onRowSelectionChanged,
    onColumnSelectionChanged,
    onStateImported,
  } = input

  const migrateUnifiedState = (
    state: unknown,
    options: DataGridMigrateStateOptions = {},
  ): DataGridUnifiedState<TRow> | null => {
    if (!state || typeof state !== "object") {
      if (options.strict) {
        throw new Error("[DataGridApi] State migration failed: input must be an object.")
      }
      return null
    }

    const candidate = state as { version?: unknown }
    if (candidate.version !== 1) {
      if (options.strict) {
        throw new Error(`[DataGridApi] Unsupported state version: ${String(candidate.version)}`)
      }
      return null
    }

    const migrated = cloneSerializable(state as DataGridUnifiedState<TRow>)
    return {
      ...migrated,
      columnSelection: normalizeDataGridColumnSelectionSnapshot(migrated.columnSelection).selectedColumnKeys.length > 0
        ? normalizeDataGridColumnSelectionSnapshot(migrated.columnSelection)
        : null,
    }
  }

  return {
    validateUnifiedState(state: unknown, options: DataGridSetStateOptions = {}) {
      const migrated = migrateUnifiedState(state)
      const issues: Array<{ section: string; reason: string }> = []
      if (!migrated) issues.push({ section: "state", reason: "invalid-or-unsupported-version" })
      if (migrated?.transaction) issues.push({ section: "transaction", reason: "restore-not-supported" })
      if (options.strict && options.applySelection !== false) {
        if (migrated?.selection && !getSelectionCapability()) issues.push({ section: "selection", reason: "capability-unavailable" })
        if (migrated?.rowSelection && !getRowSelectionCapability()) issues.push({ section: "rowSelection", reason: "capability-unavailable" })
        if (migrated?.columnSelection && !getColumnSelectionCapability()) issues.push({ section: "columnSelection", reason: "capability-unavailable" })
      }
      const candidates = ["rows", "columns", "selection", "viewport", "viewportPosition"]
      const enabled: Record<string, boolean> = {
        rows: options.applyRows !== false && Boolean(migrated?.rows?.snapshot),
        columns: options.applyColumns !== false && Boolean(migrated?.columns),
        selection: options.applySelection !== false && Boolean(migrated?.selection || migrated?.rowSelection || migrated?.columnSelection),
        viewport: options.applyViewport !== false && Boolean(migrated?.rows?.snapshot?.viewportRange),
        viewportPosition: options.applyViewport !== false && options.applyViewportPosition !== false && Boolean(migrated?.view?.viewportPosition),
      }
      return Object.freeze({
        valid: issues.length === 0,
        applicableSections: Object.freeze(candidates.filter(section => enabled[section])),
        skippedSections: Object.freeze([
          ...candidates.filter(section => !enabled[section]),
          ...(migrated?.transaction ? ["transaction"] : []),
        ]),
        issues: Object.freeze(issues.map(issue => Object.freeze(issue))),
      })
    },
    getUnifiedState(options: DataGridGetStateOptions = {}) {
      const rowSnapshot = rowModel.getSnapshot()
      const columnSnapshot = columnModel.getSnapshot()
      const visibility: Record<string, boolean> = {}
      const widths: Record<string, number | null> = {}
      const pins: Record<string, DataGridColumnPin> = {}
      for (const column of columnSnapshot.columns) {
        visibility[column.key] = column.visible
        widths[column.key] = column.width
        pins[column.key] = column.pin
      }
      const state: DataGridUnifiedState<TRow> = {
        version: 1,
        rows: {
          snapshot: cloneSerializable(rowSnapshot),
          aggregationModel: cloneSerializable(rowModel.getAggregationModel()),
        },
        columns: {
          order: cloneSerializable(columnSnapshot.order),
          zoneOrder: cloneSerializable(columnSnapshot.zoneOrder),
          visibility,
          widths,
          pins,
        },
        selection: cloneSerializable(getSelectionCapability()?.getSelectionSnapshot() ?? null),
        rowSelection: cloneSerializable(getRowSelectionCapability()?.getRowSelectionSnapshot() ?? null),
        columnSelection: cloneSerializable(getColumnSelectionCapability()?.getColumnSelectionSnapshot() ?? null),
        transaction: cloneSerializable(getTransactionCapability()?.getTransactionSnapshot() ?? null),
      }
      if (options.includeViewportPosition) {
        state.view = {
          viewportPosition: cloneSerializable(getViewportPosition()),
        }
      }
      return state
    },
    migrateUnifiedState(state: unknown, options?: DataGridMigrateStateOptions) {
      return migrateUnifiedState(state, options)
    },
    setUnifiedState(state: DataGridUnifiedState<TRow>, options: DataGridSetStateOptions = {}) {
      const validation = this.validateUnifiedState(state, options)
      if (options.strict && !validation.valid) {
        const issue = validation.issues[0]
        const cause = new Error(issue?.section === "transaction"
          ? "[DataGridApi] Transaction state restore is not supported by current facade."
          : issue?.reason === "capability-unavailable"
            ? `[DataGridApi] Cannot restore ${issue.section} state without ${issue.section} capability.`
            : issue ? `${issue.section}: ${issue.reason}` : "State validation failed.")
        throw new DataGridStateRestoreError(cause.message, {
          status: "failed",
          appliedSections: [],
          skippedSections: [...validation.skippedSections],
          failedSection: issue?.section ?? "state",
          rollback: "not-requested",
        }, cause)
      }
      const migratedState = migrateUnifiedState(state, { strict: false })
      if (!migratedState) {
        return Object.freeze({ status: "applied", appliedSections: Object.freeze([]), skippedSections: Object.freeze(["state"]), rollback: "not-needed" })
      }
      const appliedSections: string[] = []
      const skippedSections: string[] = [...(migratedState.transaction ? ["transaction"] : [])]
      let activeSection = "preflight"
      let rollbackStatus: "not-requested" | "complete" | "partial" = "not-requested"

      const rollbackState = options.atomic
        ? (() => {
            const columnSnapshot = columnModel.getSnapshot()
            const visibility: Record<string, boolean> = {}
            const widths: Record<string, number | null> = {}
            const pins: Record<string, DataGridColumnPin> = {}
            for (const column of columnSnapshot.columns) {
              visibility[column.key] = column.visible
              widths[column.key] = column.width
              pins[column.key] = column.pin
            }
            return {
              version: 1 as const,
              rows: {
                snapshot: cloneSerializable(rowModel.getSnapshot()),
                aggregationModel: cloneSerializable(rowModel.getAggregationModel()),
              },
              columns: {
                order: cloneSerializable(columnSnapshot.order),
                zoneOrder: cloneSerializable(columnSnapshot.zoneOrder),
                visibility,
                widths,
                pins,
              },
              selection: cloneSerializable(getSelectionCapability()?.getSelectionSnapshot() ?? null),
              rowSelection: cloneSerializable(getRowSelectionCapability()?.getRowSelectionSnapshot() ?? null),
              columnSelection: cloneSerializable(getColumnSelectionCapability()?.getColumnSelectionSnapshot() ?? null),
              transaction: null,
              view: { viewportPosition: cloneSerializable(getViewportPosition()) },
            } satisfies DataGridUnifiedState<TRow>
          })()
        : null

      const dataSourceOptions = options.dataSource

      // Validate failures that are independent of the mutation order before
      // touching any row, column, selection, or viewport state. State import
      // remains sequential for runtime failures, but strict capability errors
      // must not leave a partially applied state behind.
      if (options.strict && migratedState.transaction) {
        throw new Error("[DataGridApi] Transaction state restore is not supported by current facade.")
      }
      if (options.strict && options.applySelection !== false) {
        if (migratedState.selection && !getSelectionCapability()) {
          throw new Error("[DataGridApi] Cannot restore selection state without selection capability.")
        }
        if (migratedState.rowSelection && !getRowSelectionCapability()) {
          throw new Error("[DataGridApi] Cannot restore rowSelection state without rowSelection capability.")
        }
        if (migratedState.columnSelection && !getColumnSelectionCapability()) {
          throw new Error("[DataGridApi] Cannot restore columnSelection state without columnSelection capability.")
        }
      }

      const backpressureCapability = dataSourceOptions && dataSourceOptions.atomic !== false
        ? getBackpressureControlCapability?.() ?? null
        : null
      const pausedByStateImport = backpressureCapability?.pauseBackpressure() ?? false

      try {
        const rowSnapshot = migratedState.rows?.snapshot
        activeSection = "rows"
        if (rowSnapshot && options.applyRows !== false) {
          const dataSourceResetViewportRange = normalizeViewportRange(dataSourceOptions?.resetViewportRange)
          if (options.applyViewport !== false && dataSourceResetViewportRange) {
            setViewportRange(dataSourceResetViewportRange)
          }

          const sortModel = normalizeSortModel(rowSnapshot.sortModel)
          const filterModel = normalizeFilterModel(rowSnapshot.filterModel)
          const batchedInput: DataGridSortAndFilterModelInput = {
            sortModel,
            filterModel,
          }
          const sortFilterBatchCapability = getSortFilterBatchCapability()
          if (sortFilterBatchCapability) {
            sortFilterBatchCapability.setSortAndFilterModel(batchedInput)
          } else {
            rowModel.setFilterModel(batchedInput.filterModel)
            rowModel.setSortModel(batchedInput.sortModel)
          }

          rowModel.setGroupBy(normalizeGroupBy(rowSnapshot.groupBy))
          rowModel.setPivotModel(normalizePivotModel(rowSnapshot.pivotModel))
          rowModel.setAggregationModel(normalizeAggregationModel(migratedState.rows?.aggregationModel))
          rowModel.setGroupExpansion(normalizeGroupExpansion(rowSnapshot.groupExpansion))
          rowModel.setPagination(normalizePaginationInput(rowSnapshot.pagination))
          if (options.applyViewport !== false && !dataSourceResetViewportRange) {
            const viewportRange = normalizeViewportRange(rowSnapshot.viewportRange)
            if (viewportRange) {
              setViewportRange(viewportRange)
            }
          }
          appliedSections.push("rows")
        } else skippedSections.push("rows")

        activeSection = "columns"
        if (options.applyColumns !== false && migratedState.columns) {
          const order = Array.isArray(migratedState.columns.order) ? migratedState.columns.order : []
          if (order.length > 0) {
            columnModel.setColumnOrder(order)
          }
          for (const [key, value] of Object.entries(migratedState.columns.visibility ?? {})) {
            columnModel.setColumnVisibility(key, Boolean(value))
          }
          for (const [key, value] of Object.entries(migratedState.columns.widths ?? {})) {
            const width = Number.isFinite(value) ? Math.max(0, Math.trunc(value as number)) : null
            columnModel.setColumnWidth(key, width)
          }
          for (const [key, value] of Object.entries(migratedState.columns.pins ?? {})) {
            const pin = normalizePin(value)
            if (!pin) {
              continue
            }
            columnModel.setColumnPin(key, pin)
          }
          const zoneOrder = migratedState.columns.zoneOrder
          if (zoneOrder) {
            columnModel.setColumnZoneOrder("pinnedLeft", Array.isArray(zoneOrder.pinnedLeft) ? zoneOrder.pinnedLeft : [])
            columnModel.setColumnZoneOrder("center", Array.isArray(zoneOrder.center) ? zoneOrder.center : [])
            columnModel.setColumnZoneOrder("pinnedRight", Array.isArray(zoneOrder.pinnedRight) ? zoneOrder.pinnedRight : [])
          }
          appliedSections.push("columns")
        } else skippedSections.push("columns")

        activeSection = "selection"
        if (options.applySelection !== false) {
          const selectionCapability = getSelectionCapability()
          if (selectionCapability) {
            if (migratedState.selection) {
              selectionCapability.setSelectionSnapshot({
                ...cloneSerializable(migratedState.selection),
                projectionRevision: rowModel.getSnapshot().revision ?? null,
                columnRevision: columnModel.getSnapshot().orderRevision,
              })
              onSelectionChanged?.(selectionCapability.getSelectionSnapshot())
            } else {
              selectionCapability.clearSelection()
              onSelectionChanged?.(selectionCapability.getSelectionSnapshot())
            }
          } else if (options.strict && migratedState.selection) {
            throw new Error("[DataGridApi] Cannot restore selection state without selection capability.")
          }

          const rowSelectionCapability = getRowSelectionCapability()
          if (rowSelectionCapability) {
            if (migratedState.rowSelection) {
              const rowSelection = cloneSerializable(migratedState.rowSelection)
              rowSelectionCapability.setRowSelectionSnapshot(rowSelection.mode === "all"
                ? {
                    ...rowSelection,
                    scope: {
                      kind: "current-projection",
                      queryRevision: rowModel.getSnapshot().revision ?? null,
                      datasetVersion: rowModel.getSnapshot().datasetVersion ?? null,
                    },
                  }
                : rowSelection)
              onRowSelectionChanged?.(rowSelectionCapability.getRowSelectionSnapshot())
            } else {
              rowSelectionCapability.clearRowSelection()
              onRowSelectionChanged?.(rowSelectionCapability.getRowSelectionSnapshot())
            }
          } else if (options.strict && migratedState.rowSelection) {
            throw new Error("[DataGridApi] Cannot restore rowSelection state without rowSelection capability.")
          }

          const columnSelectionCapability = getColumnSelectionCapability()
          if (columnSelectionCapability) {
            const previous = columnSelectionCapability.getColumnSelectionSnapshot()
            if (!dataGridColumnSelectionSnapshotsEqual(previous, migratedState.columnSelection)) {
              if (migratedState.columnSelection) {
                columnSelectionCapability.setColumnSelectionSnapshot(cloneSerializable(migratedState.columnSelection))
              } else {
                columnSelectionCapability.clearColumnSelection()
              }
              onColumnSelectionChanged?.(columnSelectionCapability.getColumnSelectionSnapshot())
            }
          } else if (options.strict && migratedState.columnSelection) {
            throw new Error("[DataGridApi] Cannot restore columnSelection state without columnSelection capability.")
          }
          if (migratedState.selection || migratedState.rowSelection || migratedState.columnSelection) appliedSections.push("selection")
          else skippedSections.push("selection")
        } else skippedSections.push("selection")

        activeSection = "viewport"
        if (options.applyViewport !== false && options.applyViewportPosition !== false) {
          const viewportPosition = normalizeViewportPosition(migratedState.view?.viewportPosition)
          if (viewportPosition) {
            setViewportPosition(viewportPosition, { strict: options.strict })
          }
          if (migratedState.view?.viewportPosition) appliedSections.push("viewportPosition")
          else skippedSections.push("viewportPosition")
        } else skippedSections.push("viewportPosition")
        if (options.applyViewport !== false && rowSnapshot?.viewportRange) appliedSections.push("viewport")
        else skippedSections.push("viewport")

        activeSection = "events"
        onStateImported?.(cloneSerializable(migratedState))
        return Object.freeze({ status: "applied", appliedSections: Object.freeze([...appliedSections]), skippedSections: Object.freeze([...skippedSections]), rollback: "not-needed" })
      } catch (error) {
        if (rollbackState) {
          try {
            const snapshot = rollbackState.rows.snapshot
            const sortFilterBatchCapability = getSortFilterBatchCapability()
            if (options.applyRows !== false) {
              const input: DataGridSortAndFilterModelInput = {
                sortModel: normalizeSortModel(snapshot.sortModel),
                filterModel: normalizeFilterModel(snapshot.filterModel),
              }
              if (sortFilterBatchCapability) {
                sortFilterBatchCapability.setSortAndFilterModel(input)
              } else {
                rowModel.setFilterModel(input.filterModel)
                rowModel.setSortModel(input.sortModel)
              }
              rowModel.setGroupBy(normalizeGroupBy(snapshot.groupBy))
              rowModel.setPivotModel(normalizePivotModel(snapshot.pivotModel))
              rowModel.setAggregationModel(normalizeAggregationModel(rollbackState.rows.aggregationModel))
              rowModel.setGroupExpansion(normalizeGroupExpansion(snapshot.groupExpansion))
              rowModel.setPagination(normalizePaginationInput(snapshot.pagination))
              const viewportRange = normalizeViewportRange(snapshot.viewportRange)
              if (viewportRange) {
                setViewportRange(viewportRange)
              }
            }
            if (options.applyColumns !== false) {
              columnModel.setColumnOrder(rollbackState.columns.order)
              for (const [key, value] of Object.entries(rollbackState.columns.visibility)) {
                columnModel.setColumnVisibility(key, value)
              }
              for (const [key, value] of Object.entries(rollbackState.columns.widths)) {
                columnModel.setColumnWidth(key, value)
              }
              for (const [key, value] of Object.entries(rollbackState.columns.pins)) {
                columnModel.setColumnPin(key, value)
              }
              for (const zone of ["pinnedLeft", "center", "pinnedRight"] as const) {
                columnModel.setColumnZoneOrder(zone, rollbackState.columns.zoneOrder[zone] ?? [])
              }
            }
            if (options.applySelection !== false) {
              const selectionCapability = getSelectionCapability()
              if (selectionCapability) {
                if (rollbackState.selection) {
                  selectionCapability.setSelectionSnapshot({
                    ...cloneSerializable(rollbackState.selection),
                    projectionRevision: rowModel.getSnapshot().revision ?? null,
                    columnRevision: columnModel.getSnapshot().orderRevision,
                  })
                } else {
                  selectionCapability.clearSelection()
                }
                onSelectionChanged?.(selectionCapability.getSelectionSnapshot())
              }
              const rowSelectionCapability = getRowSelectionCapability()
              if (rowSelectionCapability) {
                if (rollbackState.rowSelection) {
                  const rowSelection = cloneSerializable(rollbackState.rowSelection)
                  rowSelectionCapability.setRowSelectionSnapshot(rowSelection.mode === "all"
                    ? {
                        ...rowSelection,
                        scope: {
                          kind: "current-projection",
                          queryRevision: rowModel.getSnapshot().revision ?? null,
                          datasetVersion: rowModel.getSnapshot().datasetVersion ?? null,
                        },
                      }
                    : rowSelection)
                } else {
                  rowSelectionCapability.clearRowSelection()
                }
                onRowSelectionChanged?.(rowSelectionCapability.getRowSelectionSnapshot())
              }
              const columnSelectionCapability = getColumnSelectionCapability()
              if (columnSelectionCapability) {
                const previous = columnSelectionCapability.getColumnSelectionSnapshot()
                if (!dataGridColumnSelectionSnapshotsEqual(previous, rollbackState.columnSelection)) {
                  if (rollbackState.columnSelection) {
                    columnSelectionCapability.setColumnSelectionSnapshot(cloneSerializable(rollbackState.columnSelection))
                  } else {
                    columnSelectionCapability.clearColumnSelection()
                  }
                  onColumnSelectionChanged?.(columnSelectionCapability.getColumnSelectionSnapshot())
                }
              }
            }
            if (options.applyViewport !== false && options.applyViewportPosition !== false) {
              const viewportPosition = normalizeViewportPosition(rollbackState.view?.viewportPosition)
              if (viewportPosition) {
                setViewportPosition(viewportPosition, { strict: false })
              }
            }
          } catch (rollbackError) {
            rollbackStatus = "partial"
            throw new DataGridStateRestoreError("[DataGridApi] State import and rollback failed.", {
              status: "failed", appliedSections, skippedSections, failedSection: activeSection, rollback: rollbackStatus,
            }, { error, rollbackError })
          }
          rollbackStatus = "complete"
        }
        throw new DataGridStateRestoreError(error instanceof Error ? error.message : String(error), {
          status: "failed", appliedSections, skippedSections, failedSection: activeSection, rollback: rollbackStatus,
        }, error)
      } finally {
        if (pausedByStateImport) {
          backpressureCapability?.resumeBackpressure()
        }
      }
    },
  }
}
