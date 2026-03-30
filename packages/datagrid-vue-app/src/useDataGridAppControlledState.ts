import { onBeforeUnmount, watch, type Ref } from "vue"
import type {
  DataGridApi,
  DataGridAggregationModel,
  DataGridRowModel,
  DataGridColumnModel,
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridMigrateStateOptions,
  DataGridSetStateOptions,
  DataGridSortState,
  DataGridUnifiedColumnState,
  DataGridUnifiedState,
} from "@affino/datagrid-vue"
import type {
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
} from "@affino/datagrid-vue"

type DataGridRowRecord = Record<string, unknown>

export type DataGridAppControlledApi = DataGridApi<DataGridRowRecord>

export interface DataGridAppControlledExpose {
  api: DataGridAppControlledApi
  rowModel: DataGridRowModel<DataGridRowRecord>
  columnModel: DataGridColumnModel
}

export interface UseDataGridAppControlledStateOptions {
  gridRef: Ref<DataGridAppControlledExpose | null>
  props: {
    state?: DataGridUnifiedState<DataGridRowRecord> | null
    stateOptions?: DataGridSetStateOptions | null
    columnState?: DataGridUnifiedColumnState | null
    columnOrder?: readonly string[] | null
    hiddenColumnKeys?: readonly string[] | null
    columnWidths?: Readonly<Record<string, number | null>> | null
    columnPins?: Readonly<Record<string, DataGridColumnPin>> | null
    sortModel?: readonly DataGridSortState[]
    filterModel?: DataGridFilterSnapshot | null
    groupBy?: DataGridGroupBySpec | null
    aggregationModel?: DataGridAggregationModel<DataGridRowRecord> | null
    pivotModel?: DataGridPivotSpec | null
    rowHeightMode: "fixed" | "auto"
    baseRowHeight: number
    columns: readonly unknown[]
  }
  emit: {
    columnState: (payload: DataGridUnifiedColumnState) => void
    columnOrder: (payload: readonly string[]) => void
    hiddenColumnKeys: (payload: readonly string[]) => void
    columnWidths: (payload: Readonly<Record<string, number | null>>) => void
    columnPins: (payload: Readonly<Record<string, DataGridColumnPin>>) => void
    groupBy: (payload: DataGridGroupBySpec | null) => void
    state: (payload: DataGridUnifiedState<DataGridRowRecord>) => void
    ready: (payload: { api: DataGridAppControlledApi }) => void
  }
}

export interface UseDataGridAppControlledStateResult {
  emitSnapshotUpdates: () => void
  handleGridReady: () => void
  dispose: () => void
  getColumnState: () => DataGridUnifiedColumnState | null
  getState: () => DataGridUnifiedState<DataGridRowRecord> | null
  migrateState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<DataGridRowRecord> | null
  applyColumnState: (columnState: DataGridUnifiedColumnState) => boolean
  applyState: (state: DataGridUnifiedState<DataGridRowRecord>, options?: DataGridSetStateOptions) => boolean
  exportPivotLayout: () => DataGridPivotLayoutSnapshot<DataGridRowRecord> | null
  exportPivotInterop: () => DataGridPivotInteropSnapshot<DataGridRowRecord> | null
  importPivotLayout: (
    layout: DataGridPivotLayoutSnapshot<DataGridRowRecord>,
    options?: DataGridPivotLayoutImportOptions,
  ) => boolean
  expandAllGroups: () => void
  collapseAllGroups: () => void
}

interface PendingColumnStateApplication {
  columnState: DataGridUnifiedColumnState
}

interface PendingUnifiedStateApplication {
  state: DataGridUnifiedState<DataGridRowRecord>
  options?: DataGridSetStateOptions
}

function normalizeWidth(width: number | null | undefined): number | null {
  if (!Number.isFinite(width)) {
    return null
  }
  return Math.max(0, Math.trunc(width as number))
}

function createSyncKey(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function cloneGroupBySpec(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null {
  if (!groupBy) {
    return null
  }
  return {
    fields: [...groupBy.fields],
    expandedByDefault: groupBy.expandedByDefault,
  }
}

export function useDataGridAppControlledState(
  options: UseDataGridAppControlledStateOptions,
): UseDataGridAppControlledStateResult {
  let unsubscribeRowModel: (() => void) | null = null
  let unsubscribeColumnModel: (() => void) | null = null
  let scheduledSnapshotEmit = false
  let lastAppliedColumnInputsKey: string | null = null
  let lastAppliedStateInputKey: string | null = null
  let lastEmittedColumnStateKey: string | null = null
  let lastEmittedUnifiedStateKey: string | null = null
  let lastEmittedGroupByKey: string | null = null
  let lastObservedColumnStateKey: string | null = null
  let lastObservedUnifiedStateKey: string | null = null
  let pendingColumnStateApplication: PendingColumnStateApplication | null = null
  let pendingUnifiedStateApplication: PendingUnifiedStateApplication | null = null

  const disposeSubscriptions = (): void => {
    unsubscribeRowModel?.()
    unsubscribeColumnModel?.()
    unsubscribeRowModel = null
    unsubscribeColumnModel = null
  }

  const resolveActiveGrid = (): DataGridAppControlledExpose | null => {
    const grid = options.gridRef.value
    if (!grid || grid.api.lifecycle.state === "disposed") {
      return null
    }
    return grid
  }

  const resolveActiveApi = (): DataGridAppControlledApi | null => {
    return resolveActiveGrid()?.api ?? null
  }

  const getColumnState = (): DataGridUnifiedColumnState | null => {
    const columnsApi = resolveActiveApi()?.columns
    if (!columnsApi) {
      return null
    }
    const snapshot = columnsApi.getSnapshot()
    const visibility: Record<string, boolean> = {}
    const widths: Record<string, number | null> = {}
    const pins: Record<string, DataGridColumnPin> = {}

    for (const column of snapshot.columns) {
      visibility[column.key] = column.visible
      widths[column.key] = column.width
      pins[column.key] = column.pin
    }

    return {
      order: [...snapshot.order],
      visibility,
      widths,
      pins,
    }
  }

  const emitSnapshotUpdates = (): void => {
    if (scheduledSnapshotEmit) {
      return
    }
    scheduledSnapshotEmit = true
    queueMicrotask(() => {
      scheduledSnapshotEmit = false
      const columnState = getColumnState()
      const api = resolveActiveApi()
      if (columnState) {
        const columnStateKey = createSyncKey(columnState)
        lastObservedColumnStateKey = columnStateKey
        if (columnStateKey !== lastEmittedColumnStateKey) {
          lastEmittedColumnStateKey = columnStateKey
          options.emit.columnState(columnState)
          options.emit.columnOrder(columnState.order)
          options.emit.hiddenColumnKeys(
            Object.entries(columnState.visibility)
              .filter(([, visible]) => !visible)
              .map(([columnKey]) => columnKey),
          )
          options.emit.columnWidths(columnState.widths)
          options.emit.columnPins(columnState.pins)
        }
      }
      if (api) {
        const groupBy = cloneGroupBySpec(api.rows.getSnapshot().groupBy)
        const groupByKey = createSyncKey(groupBy)
        if (groupByKey !== lastEmittedGroupByKey) {
          lastEmittedGroupByKey = groupByKey
          options.emit.groupBy(groupBy)
        }
        const unifiedState = api.state.get()
        const unifiedStateKey = createSyncKey(unifiedState)
        lastObservedUnifiedStateKey = unifiedStateKey
        if (unifiedStateKey !== lastEmittedUnifiedStateKey) {
          lastEmittedUnifiedStateKey = unifiedStateKey
          options.emit.state(unifiedState)
        }
      }
    })
  }

  const syncSortAndFilterModel = (): void => {
    const api = resolveActiveApi()
    if (!api || (options.props.sortModel === undefined && options.props.filterModel === undefined)) {
      return
    }
    api.rows.setSortAndFilterModel({
      sortModel: options.props.sortModel ?? [],
      filterModel: options.props.filterModel ?? null,
    })
  }

  const getRuntimeColumnKeys = (): Set<string> | null => {
    const columnsApi = resolveActiveApi()?.columns
    if (!columnsApi) {
      return null
    }
    return new Set(columnsApi.getSnapshot().columns.map(column => column.key))
  }

  const getRequiredColumnKeys = (columnState: DataGridUnifiedColumnState | null | undefined): Set<string> => {
    const required = new Set<string>()
    if (!columnState) {
      return required
    }
    for (const columnKey of columnState.order) {
      required.add(columnKey)
    }
    for (const columnKey of Object.keys(columnState.visibility ?? {})) {
      required.add(columnKey)
    }
    for (const columnKey of Object.keys(columnState.widths ?? {})) {
      required.add(columnKey)
    }
    for (const columnKey of Object.keys(columnState.pins ?? {})) {
      required.add(columnKey)
    }
    return required
  }

  const canApplyColumnState = (columnState: DataGridUnifiedColumnState | null | undefined): boolean => {
    const runtimeColumnKeys = getRuntimeColumnKeys()
    if (!runtimeColumnKeys) {
      return false
    }
    const requiredColumnKeys = getRequiredColumnKeys(columnState)
    if (requiredColumnKeys.size === 0) {
      return true
    }
    if (options.props.columns.length > 0) {
      return true
    }
    for (const columnKey of requiredColumnKeys) {
      if (!runtimeColumnKeys.has(columnKey)) {
        return false
      }
    }
    return true
  }

  const canApplyUnifiedState = (state: DataGridUnifiedState<DataGridRowRecord>): boolean => {
    return canApplyColumnState(state.columns)
  }

  const applyColumnStateNow = (columnState: DataGridUnifiedColumnState): boolean => {
    const api = resolveActiveApi()
    if (!api) {
      return false
    }
    api.columns.setOrder(columnState.order)
    for (const [columnKey, visible] of Object.entries(columnState.visibility)) {
      api.columns.setVisibility(columnKey, visible)
    }
    for (const [columnKey, width] of Object.entries(columnState.widths)) {
      api.columns.setWidth(columnKey, normalizeWidth(width))
    }
    for (const [columnKey, pin] of Object.entries(columnState.pins)) {
      api.columns.setPin(columnKey, pin)
    }
    return true
  }

  const flushPendingApplications = (): void => {
    if (pendingUnifiedStateApplication) {
      const pending = pendingUnifiedStateApplication
      const api = resolveActiveApi()
      if (api) {
        const migrated = api.state.migrate(pending.state, { strict: pending.options?.strict })
        if (migrated && canApplyUnifiedState(migrated)) {
          pendingUnifiedStateApplication = null
          api.state.set(migrated, pending.options)
          lastAppliedStateInputKey = createSyncKey(pending.state)
        }
      }
    }

    if (pendingColumnStateApplication && canApplyColumnState(pendingColumnStateApplication.columnState)) {
      const pending = pendingColumnStateApplication
      pendingColumnStateApplication = null
      lastAppliedColumnInputsKey = createSyncKey({
        columnState: pending.columnState,
        columnOrder: null,
        hiddenColumnKeys: null,
        columnWidths: null,
        columnPins: null,
      })
      applyColumnStateNow(pending.columnState)
    }
  }

  const syncGroupBy = (): void => {
    const api = resolveActiveApi()
    if (!api || options.props.groupBy === undefined) {
      return
    }
    api.rows.setGroupBy(options.props.groupBy ?? null)
  }

  const syncAggregationModel = (): void => {
    const api = resolveActiveApi()
    if (!api || options.props.aggregationModel === undefined) {
      return
    }
    api.rows.setAggregationModel(options.props.aggregationModel ?? null)
  }

  const syncPivotModel = (): void => {
    const api = resolveActiveApi()
    if (!api || options.props.pivotModel === undefined) {
      return
    }
    api.pivot.setModel(options.props.pivotModel ?? null)
  }

  const syncColumnState = (): void => {
    const api = resolveActiveApi()
    if (!api) {
      return
    }
    if (
      options.props.columnState === undefined &&
      options.props.columnOrder === undefined &&
      options.props.hiddenColumnKeys === undefined &&
      options.props.columnWidths === undefined &&
      options.props.columnPins === undefined
    ) {
      return
    }

    const columnInputsKey = createSyncKey({
      columnState: options.props.columnState,
      columnOrder: options.props.columnOrder,
      hiddenColumnKeys: options.props.hiddenColumnKeys,
      columnWidths: options.props.columnWidths,
      columnPins: options.props.columnPins,
    })
    if (columnInputsKey === lastAppliedColumnInputsKey) {
      return
    }
    if (
      options.props.columnState &&
      !options.props.columnOrder &&
      !options.props.hiddenColumnKeys &&
      !options.props.columnWidths &&
      !options.props.columnPins &&
      createSyncKey(options.props.columnState) === lastObservedColumnStateKey
    ) {
      lastAppliedColumnInputsKey = columnInputsKey
      return
    }

    if (options.props.columnState) {
      api.columns.setOrder(options.props.columnState.order)
      for (const [columnKey, visible] of Object.entries(options.props.columnState.visibility)) {
        api.columns.setVisibility(columnKey, visible)
      }
      for (const [columnKey, width] of Object.entries(options.props.columnState.widths)) {
        api.columns.setWidth(columnKey, normalizeWidth(width))
      }
      for (const [columnKey, pin] of Object.entries(options.props.columnState.pins)) {
        api.columns.setPin(columnKey, pin)
      }
    }

    if (options.props.columnOrder) {
      api.columns.setOrder(options.props.columnOrder)
    }

    if (options.props.hiddenColumnKeys) {
      const hidden = new Set(options.props.hiddenColumnKeys)
      const snapshot = api.columns.getSnapshot()
      for (const column of snapshot.columns) {
        api.columns.setVisibility(column.key, !hidden.has(column.key))
      }
    }

    if (options.props.columnWidths) {
      for (const [columnKey, width] of Object.entries(options.props.columnWidths)) {
        api.columns.setWidth(columnKey, normalizeWidth(width))
      }
    }

    if (options.props.columnPins) {
      for (const [columnKey, pin] of Object.entries(options.props.columnPins)) {
        api.columns.setPin(columnKey, pin)
      }
    }

    lastAppliedColumnInputsKey = columnInputsKey
  }

  const syncUnifiedState = (): void => {
    const api = resolveActiveApi()
    if (!api || options.props.state == null) {
      return
    }
    const stateInputKey = createSyncKey(options.props.state)
    if (stateInputKey === lastAppliedStateInputKey) {
      return
    }
    if (stateInputKey === lastObservedUnifiedStateKey) {
      lastAppliedStateInputKey = stateInputKey
      return
    }
    const migrated = api.state.migrate(options.props.state, { strict: options.props.stateOptions?.strict })
    if (!migrated) {
      return
    }
    if (!canApplyUnifiedState(migrated)) {
      return
    }
    api.state.set(migrated, options.props.stateOptions ?? {})
    lastAppliedStateInputKey = stateInputKey
  }

  const syncRowHeight = (): void => {
    const api = resolveActiveApi()
    if (!api) {
      return
    }
    api.view.setRowHeightMode(options.props.rowHeightMode)
    api.view.setBaseRowHeight(Math.max(24, Math.trunc(options.props.baseRowHeight)))
  }

  const handleGridReady = (): void => {
    const grid = resolveActiveGrid()
    if (!grid) {
      return
    }
    lastAppliedColumnInputsKey = null
    lastAppliedStateInputKey = null
    disposeSubscriptions()
    unsubscribeRowModel = grid.rowModel.subscribe(() => {
      emitSnapshotUpdates()
    })
    unsubscribeColumnModel = grid.columnModel.subscribe(() => {
      emitSnapshotUpdates()
    })
    syncUnifiedState()
    syncColumnState()
    syncSortAndFilterModel()
    syncGroupBy()
    syncAggregationModel()
    syncPivotModel()
    syncRowHeight()
    flushPendingApplications()
    emitSnapshotUpdates()
    options.emit.ready({ api: grid.api })
  }

  const getState = (): DataGridUnifiedState<DataGridRowRecord> | null => {
    return resolveActiveApi()?.state.get() ?? null
  }

  const migrateState = (
    state: unknown,
    migrateOptions?: DataGridMigrateStateOptions,
  ): DataGridUnifiedState<DataGridRowRecord> | null => {
    return resolveActiveApi()?.state.migrate(state, migrateOptions) ?? null
  }

  const applyColumnState = (columnState: DataGridUnifiedColumnState): boolean => {
    if (!canApplyColumnState(columnState)) {
      pendingColumnStateApplication = { columnState }
      return true
    }
    lastAppliedColumnInputsKey = createSyncKey({
      columnState,
      columnOrder: null,
      hiddenColumnKeys: null,
      columnWidths: null,
      columnPins: null,
    })
    pendingColumnStateApplication = null
    if (!applyColumnStateNow(columnState)) {
      pendingColumnStateApplication = { columnState }
      return true
    }
    emitSnapshotUpdates()
    return true
  }

  const applyState = (
    state: DataGridUnifiedState<DataGridRowRecord>,
    setOptions?: DataGridSetStateOptions,
  ): boolean => {
    const api = resolveActiveApi()
    if (!api) {
      pendingUnifiedStateApplication = { state, options: setOptions }
      return true
    }
    const migrated = api.state.migrate(state, { strict: setOptions?.strict })
    if (!migrated) {
      return false
    }
    if (!canApplyUnifiedState(migrated)) {
      pendingUnifiedStateApplication = { state, options: setOptions }
      return true
    }
    api.state.set(migrated, setOptions)
    lastAppliedStateInputKey = createSyncKey(state)
    pendingUnifiedStateApplication = null
    emitSnapshotUpdates()
    return true
  }

  const exportPivotLayout = (): DataGridPivotLayoutSnapshot<DataGridRowRecord> | null => {
    return resolveActiveApi()?.pivot.exportLayout() ?? null
  }

  const exportPivotInterop = (): DataGridPivotInteropSnapshot<DataGridRowRecord> | null => {
    return resolveActiveApi()?.pivot.exportInterop() ?? null
  }

  const importPivotLayout = (
    layout: DataGridPivotLayoutSnapshot<DataGridRowRecord>,
    importOptions?: DataGridPivotLayoutImportOptions,
  ): boolean => {
    const api = resolveActiveApi()
    if (!api) {
      return false
    }
    api.pivot.importLayout(layout, importOptions)
    emitSnapshotUpdates()
    return true
  }

  const expandAllGroups = (): void => {
    resolveActiveApi()?.rows.expandAllGroups()
    emitSnapshotUpdates()
  }

  const collapseAllGroups = (): void => {
    resolveActiveApi()?.rows.collapseAllGroups()
    emitSnapshotUpdates()
  }

  watch(
    () => options.gridRef.value,
    () => {
      handleGridReady()
    },
    { immediate: true },
  )

  watch(
    () => options.props.columns,
    () => {
      lastAppliedColumnInputsKey = null
      lastAppliedStateInputKey = null
      syncUnifiedState()
      syncColumnState()
      flushPendingApplications()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => [options.props.state, options.props.stateOptions] as const,
    () => {
      syncUnifiedState()
      syncColumnState()
      syncSortAndFilterModel()
      syncGroupBy()
      syncAggregationModel()
      syncPivotModel()
      syncRowHeight()
      flushPendingApplications()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => [
      options.props.columnState,
      options.props.columnOrder,
      options.props.hiddenColumnKeys,
      options.props.columnWidths,
      options.props.columnPins,
    ] as const,
    () => {
      syncColumnState()
      flushPendingApplications()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => [options.props.sortModel, options.props.filterModel] as const,
    () => {
      syncSortAndFilterModel()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => options.props.groupBy,
    () => {
      syncGroupBy()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => options.props.aggregationModel,
    () => {
      syncAggregationModel()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => options.props.pivotModel,
    () => {
      syncPivotModel()
      emitSnapshotUpdates()
    },
    { deep: true },
  )

  watch(
    () => [options.props.rowHeightMode, options.props.baseRowHeight] as const,
    () => {
      syncRowHeight()
      emitSnapshotUpdates()
    },
  )

  const dispose = (): void => {
    disposeSubscriptions()
  }

  onBeforeUnmount(() => {
    dispose()
  })

  return {
    emitSnapshotUpdates,
    handleGridReady,
    dispose,
    getColumnState,
    getState,
    migrateState,
    applyColumnState,
    applyState,
    exportPivotLayout,
    exportPivotInterop,
    importPivotLayout,
    expandAllGroups,
    collapseAllGroups,
  }
}
