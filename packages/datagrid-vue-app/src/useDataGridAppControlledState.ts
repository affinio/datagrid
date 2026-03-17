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

export type DataGridAppControlledApi = DataGridApi<unknown>

export interface DataGridAppControlledExpose {
  api: DataGridAppControlledApi
  rowModel: DataGridRowModel<unknown>
  columnModel: DataGridColumnModel
}

export interface UseDataGridAppControlledStateOptions {
  gridRef: Ref<DataGridAppControlledExpose | null>
  props: {
    state?: DataGridUnifiedState<unknown> | null
    stateOptions?: DataGridSetStateOptions | null
    columnState?: DataGridUnifiedColumnState | null
    columnOrder?: readonly string[] | null
    hiddenColumnKeys?: readonly string[] | null
    columnWidths?: Readonly<Record<string, number | null>> | null
    columnPins?: Readonly<Record<string, DataGridColumnPin>> | null
    sortModel?: readonly DataGridSortState[]
    filterModel?: DataGridFilterSnapshot | null
    groupBy?: DataGridGroupBySpec | null
    aggregationModel?: DataGridAggregationModel<unknown> | null
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
    state: (payload: DataGridUnifiedState<unknown>) => void
    ready: (payload: { api: DataGridAppControlledApi }) => void
  }
}

export interface UseDataGridAppControlledStateResult {
  emitSnapshotUpdates: () => void
  handleGridReady: () => void
  dispose: () => void
  getColumnState: () => DataGridUnifiedColumnState | null
  getState: () => DataGridUnifiedState<unknown> | null
  migrateState: (state: unknown, options?: DataGridMigrateStateOptions) => DataGridUnifiedState<unknown> | null
  applyColumnState: (columnState: DataGridUnifiedColumnState) => boolean
  applyState: (state: DataGridUnifiedState<unknown>, options?: DataGridSetStateOptions) => boolean
  exportPivotLayout: () => DataGridPivotLayoutSnapshot<unknown> | null
  exportPivotInterop: () => DataGridPivotInteropSnapshot<unknown> | null
  importPivotLayout: (
    layout: DataGridPivotLayoutSnapshot<unknown>,
    options?: DataGridPivotLayoutImportOptions,
  ) => boolean
  expandAllGroups: () => void
  collapseAllGroups: () => void
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

  const disposeSubscriptions = (): void => {
    unsubscribeRowModel?.()
    unsubscribeColumnModel?.()
    unsubscribeRowModel = null
    unsubscribeColumnModel = null
  }

  const getColumnState = (): DataGridUnifiedColumnState | null => {
    const columnsApi = options.gridRef.value?.api.columns
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
      const api = options.gridRef.value?.api
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
    const api = options.gridRef.value?.api
    if (!api || (options.props.sortModel === undefined && options.props.filterModel === undefined)) {
      return
    }
    api.rows.setSortAndFilterModel({
      sortModel: options.props.sortModel ?? [],
      filterModel: options.props.filterModel ?? null,
    })
  }

  const syncGroupBy = (): void => {
    const api = options.gridRef.value?.api
    if (!api || options.props.groupBy === undefined) {
      return
    }
    api.rows.setGroupBy(options.props.groupBy ?? null)
  }

  const syncAggregationModel = (): void => {
    const api = options.gridRef.value?.api
    if (!api || options.props.aggregationModel === undefined) {
      return
    }
    api.rows.setAggregationModel(options.props.aggregationModel ?? null)
  }

  const syncPivotModel = (): void => {
    const api = options.gridRef.value?.api
    if (!api || options.props.pivotModel === undefined) {
      return
    }
    api.pivot.setModel(options.props.pivotModel ?? null)
  }

  const syncColumnState = (): void => {
    const api = options.gridRef.value?.api
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
    const api = options.gridRef.value?.api
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
    api.state.set(migrated, options.props.stateOptions ?? {})
    lastAppliedStateInputKey = stateInputKey
  }

  const syncRowHeight = (): void => {
    const api = options.gridRef.value?.api
    if (!api) {
      return
    }
    api.view.setRowHeightMode(options.props.rowHeightMode)
    api.view.setBaseRowHeight(Math.max(24, Math.trunc(options.props.baseRowHeight)))
  }

  const handleGridReady = (): void => {
    const grid = options.gridRef.value
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
    emitSnapshotUpdates()
    options.emit.ready({ api: grid.api })
  }

  const getState = (): DataGridUnifiedState<unknown> | null => {
    return options.gridRef.value?.api.state.get() ?? null
  }

  const migrateState = (
    state: unknown,
    migrateOptions?: DataGridMigrateStateOptions,
  ): DataGridUnifiedState<unknown> | null => {
    return options.gridRef.value?.api.state.migrate(state, migrateOptions) ?? null
  }

  const applyColumnState = (columnState: DataGridUnifiedColumnState): boolean => {
    const api = options.gridRef.value?.api
    if (!api) {
      return false
    }
    lastAppliedColumnInputsKey = createSyncKey({
      columnState,
      columnOrder: null,
      hiddenColumnKeys: null,
      columnWidths: null,
      columnPins: null,
    })
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
    emitSnapshotUpdates()
    return true
  }

  const applyState = (
    state: DataGridUnifiedState<unknown>,
    setOptions?: DataGridSetStateOptions,
  ): boolean => {
    const api = options.gridRef.value?.api
    if (!api) {
      return false
    }
    const migrated = api.state.migrate(state, { strict: setOptions?.strict })
    if (!migrated) {
      return false
    }
    api.state.set(migrated, setOptions)
    lastAppliedStateInputKey = createSyncKey(state)
    emitSnapshotUpdates()
    return true
  }

  const exportPivotLayout = (): DataGridPivotLayoutSnapshot<unknown> | null => {
    return options.gridRef.value?.api.pivot.exportLayout() ?? null
  }

  const exportPivotInterop = (): DataGridPivotInteropSnapshot<unknown> | null => {
    return options.gridRef.value?.api.pivot.exportInterop() ?? null
  }

  const importPivotLayout = (
    layout: DataGridPivotLayoutSnapshot<unknown>,
    importOptions?: DataGridPivotLayoutImportOptions,
  ): boolean => {
    const api = options.gridRef.value?.api
    if (!api) {
      return false
    }
    api.pivot.importLayout(layout, importOptions)
    emitSnapshotUpdates()
    return true
  }

  const expandAllGroups = (): void => {
    options.gridRef.value?.api.rows.expandAllGroups()
    emitSnapshotUpdates()
  }

  const collapseAllGroups = (): void => {
    options.gridRef.value?.api.rows.collapseAllGroups()
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
