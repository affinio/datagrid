import type { DataGridColumnFormat, DataGridFormatDataType } from "@affino/datagrid-format"
import type { DataGridCellTypeId } from "../cells/runtime.js"
import type { DataGridBivariantCallback } from "../types/bivariance.js"

export type {
  DataGridColumnDateTimeFormatOptions,
  DataGridColumnFormat,
  DataGridColumnNumberFormatOptions,
} from "@affino/datagrid-format"

export type DataGridColumnPin = "left" | "right" | "none"

export type DataGridColumnDataType = DataGridFormatDataType

export type DataGridColumnOptionsResult = readonly unknown[] | Promise<readonly unknown[]>

export type DataGridColumnOptionsSource<TRow = unknown> =
  | readonly unknown[]
  | DataGridBivariantCallback<[row: TRow], DataGridColumnOptionsResult>

export interface DataGridColumnPresentation<TRow = unknown> {
  align?: "left" | "center" | "right"
  headerAlign?: "left" | "center" | "right"
  format?: DataGridColumnFormat
  options?: DataGridColumnOptionsSource<TRow>
}

export interface DataGridColumnCapabilities {
  editable?: boolean
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  pivotable?: boolean
  aggregatable?: boolean
}

export type DataGridCellInteractionKeyboardTrigger = "enter" | "space"

export type DataGridCellInteractionInvocationTrigger = "keyboard-enter" | "keyboard-space" | "click"

export type DataGridCellInteractionRole = "button" | "checkbox" | "link" | "switch"

export type DataGridCellInteractionTriState = boolean | "mixed"

export interface DataGridColumnCellInteractionContext<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  row?: TRow
  rowId?: string | number | null
  value: unknown
  editable: boolean
}

export interface DataGridColumnCellInteractionInvokeContext<TRow = unknown>
  extends DataGridColumnCellInteractionContext<TRow> {
  trigger: DataGridCellInteractionInvocationTrigger
}

export interface DataGridColumnCellInteraction<TRow = unknown> {
  keyboard?: readonly DataGridCellInteractionKeyboardTrigger[]
  click?: boolean
  disabled?: boolean | DataGridBivariantCallback<[context: DataGridColumnCellInteractionContext<TRow>], boolean>
  role?: DataGridCellInteractionRole | DataGridBivariantCallback<[
    context: DataGridColumnCellInteractionContext<TRow>,
  ], DataGridCellInteractionRole | undefined>
  label?: string | DataGridBivariantCallback<[context: DataGridColumnCellInteractionContext<TRow>], string | undefined>
  pressed?: DataGridCellInteractionTriState | DataGridBivariantCallback<[
    context: DataGridColumnCellInteractionContext<TRow>,
  ], DataGridCellInteractionTriState | undefined>
  checked?: DataGridCellInteractionTriState | DataGridBivariantCallback<[
    context: DataGridColumnCellInteractionContext<TRow>,
  ], DataGridCellInteractionTriState | undefined>
  onInvoke: DataGridBivariantCallback<[context: DataGridColumnCellInteractionInvokeContext<TRow>], void>
}

export type DataGridColumnConstraintValue = number | Date | string

export interface DataGridColumnConstraints {
  min?: DataGridColumnConstraintValue
  max?: DataGridColumnConstraintValue
}

export interface DataGridColumnValueAccessors<TRow = unknown> {
  accessor?: DataGridBivariantCallback<[row: TRow], unknown>
  valueGetter?: DataGridBivariantCallback<[row: TRow], unknown>
  valueSetter?: DataGridBivariantCallback<[row: TRow, value: unknown], void>
}

export interface DataGridColumnOption {
  label: string
  value: unknown
}

export interface DataGridColumnDef<TRow = unknown> extends DataGridColumnValueAccessors<TRow> {
  key: string
  field?: Extract<keyof TRow, string> | string
  label?: string
  flex?: number
  minWidth?: number
  maxWidth?: number
  dataType?: DataGridColumnDataType
  presentation?: DataGridColumnPresentation<TRow>
  capabilities?: DataGridColumnCapabilities
  constraints?: DataGridColumnConstraints
  cellType?: DataGridCellTypeId | string
  cellInteraction?: DataGridColumnCellInteraction<TRow>
  placeholder?: string
  meta?: Record<string, unknown>
}

export interface DataGridColumnState {
  visible: boolean
  pin: DataGridColumnPin
  width: number | null
}

export interface DataGridColumnInitialState {
  visible?: boolean
  pin?: DataGridColumnPin
  width?: number | null
}

export interface DataGridColumnInput<TRow = unknown> extends DataGridColumnDef<TRow> {
  initialState?: DataGridColumnInitialState
}

export interface DataGridColumnSnapshot {
  key: string
  state: Readonly<DataGridColumnState>
  visible: boolean
  pin: DataGridColumnPin
  width: number | null
  column: DataGridColumnDef
}

export interface DataGridColumnModelSnapshot {
  columns: readonly DataGridColumnSnapshot[]
  order: readonly string[]
  visibleColumns: readonly DataGridColumnSnapshot[]
  byKey: Readonly<Record<string, DataGridColumnSnapshot>>
  pinnedLeftColumns: readonly DataGridColumnSnapshot[]
  centerColumns: readonly DataGridColumnSnapshot[]
  pinnedRightColumns: readonly DataGridColumnSnapshot[]
}

export type DataGridColumnModelListener = (snapshot: DataGridColumnModelSnapshot) => void

export interface DataGridColumnModel {
  getSnapshot(): DataGridColumnModelSnapshot
  getColumn(key: string): DataGridColumnSnapshot | undefined
  setColumns(columns: readonly DataGridColumnInput[]): void
  batch?<TResult>(fn: () => TResult): TResult
  setColumnOrder(keys: readonly string[]): void
  setColumnVisibility(key: string, visible: boolean): void
  setColumnWidth(key: string, width: number | null): void
  setColumnPin(key: string, pin: DataGridColumnPin): void
  subscribe(listener: DataGridColumnModelListener): () => void
  dispose(): void
}

export interface CreateDataGridColumnModelOptions {
  columns?: readonly DataGridColumnInput[]
}

interface MutableColumnState {
  column: DataGridColumnDef
  state: DataGridColumnState
}

interface CachedNormalizedColumnDefinition {
  normalizedKey: string
  definition: DataGridColumnDef<any>
}

const normalizedColumnDefinitionCache = new WeakMap<object, CachedNormalizedColumnDefinition>()

function normalizePin(pin: DataGridColumnPin | undefined): DataGridColumnPin {
  if (pin === "left" || pin === "right") {
    return pin
  }
  return "none"
}

function normalizeWidth(width: number | undefined | null): number | null {
  if (width == null) {
    return null
  }
  if (!Number.isFinite(width)) {
    return null
  }
  if ((width as number) <= 0) {
    return 0
  }
  return Math.trunc(width as number)
}

function normalizeWidthConstraint(width: number | undefined): number | null {
  if (width == null) {
    return null
  }
  if (!Number.isFinite(width)) {
    return null
  }
  return Math.max(0, Math.trunc(width as number))
}

function normalizeColumnKey(key: unknown, index: number): string {
  if (typeof key !== "string") {
    throw new Error(
      `[DataGridColumnModel] column key at index ${index} must be a non-empty string.`,
    )
  }
  const normalized = key.trim()
  if (normalized.length === 0) {
    throw new Error(
      `[DataGridColumnModel] column key at index ${index} must be a non-empty string.`,
    )
  }
  return normalized
}

function clampWidthToDefinition(width: number | null, column: DataGridColumnDef): number | null {
  if (width == null) {
    return null
  }
  const minWidth = normalizeWidthConstraint(column.minWidth) ?? 0
  const maxWidth = normalizeWidthConstraint(column.maxWidth)
  const clampedMin = Math.max(0, minWidth)
  const clampedMax = maxWidth == null ? Number.POSITIVE_INFINITY : Math.max(clampedMin, maxWidth)
  return Math.max(clampedMin, Math.min(clampedMax, width))
}

function cloneObjectRecord<TValue extends Record<string, unknown> | undefined>(value: TValue): TValue {
  if (!value || typeof value !== "object") {
    return value
  }
  return { ...value } as TValue
}

function freezeColumnCellInteraction<TRow>(
  interaction: DataGridColumnCellInteraction<TRow> | undefined,
): DataGridColumnCellInteraction<TRow> | undefined {
  if (!interaction) {
    return undefined
  }
  const keyboard = Array.isArray(interaction.keyboard)
    ? Object.freeze([...interaction.keyboard])
    : undefined
  return Object.freeze({
    ...interaction,
    ...(keyboard ? { keyboard } : {}),
  })
}

function normalizeCellTypeId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function inferColumnCellType<TRow>(column: DataGridColumnDef<TRow>): string | undefined {
  const explicitCellType = normalizeCellTypeId(column.cellType)
  if (explicitCellType) {
    return explicitCellType
  }
  if (column.presentation?.options) {
    return "select"
  }
  switch (column.dataType) {
    case "boolean":
      return "checkbox"
    case "number":
      return "number"
    case "currency":
      return "currency"
    case "percent":
      return "percent"
    case "date":
      return "date"
    case "datetime":
      return "datetime"
    default:
      return undefined
  }
}

function freezeColumnFormat(format: DataGridColumnFormat | undefined): DataGridColumnFormat | undefined {
  if (!format) {
    return undefined
  }
  const number = format.number ? Object.freeze({ ...format.number }) : undefined
  const dateTime = format.dateTime ? Object.freeze({ ...format.dateTime }) : undefined
  if (!number && !dateTime) {
    return undefined
  }
  return Object.freeze({
    ...(number ? { number } : {}),
    ...(dateTime ? { dateTime } : {}),
  })
}

function freezeColumnOptionsSource<TRow>(
  options: DataGridColumnOptionsSource<TRow> | undefined,
): DataGridColumnOptionsSource<TRow> | undefined {
  if (!options) {
    return undefined
  }
  return Array.isArray(options) ? Object.freeze([...options]) : options
}

function normalizeColumnPresentation<TRow>(
  column: DataGridColumnDef<TRow>,
  cellType: string | undefined,
): DataGridColumnPresentation<TRow> | undefined {
  const presentation = column.presentation
  const format = freezeColumnFormat({
    ...(presentation?.format?.number || cellType === "percent"
      ? {
          number: presentation?.format?.number ?? { style: "percent" },
        }
      : {}),
    ...(presentation?.format?.dateTime
      ? {
          dateTime: presentation?.format?.dateTime,
        }
      : {}),
  })
  const options = freezeColumnOptionsSource(presentation?.options)
  if (!presentation?.align && !presentation?.headerAlign && !format && !options) {
    return undefined
  }
  return Object.freeze({
    ...(presentation?.align ? { align: presentation.align } : {}),
    ...(presentation?.headerAlign ? { headerAlign: presentation.headerAlign } : {}),
    ...(format ? { format } : {}),
    ...(options ? { options } : {}),
  })
}

function resolveNormalizedValueGetter<TRow>(column: DataGridColumnDef<TRow>): ((row: TRow) => unknown) | undefined {
  return typeof column.accessor === "function"
    ? column.accessor
    : column.valueGetter
}

function freezeColumnDefinition<TRow = unknown>(column: DataGridColumnDef<TRow>): DataGridColumnDef<TRow> {
  if (typeof column === "object" && column !== null) {
    const cached = normalizedColumnDefinitionCache.get(column as object)
    if (cached && cached.normalizedKey === column.key) {
      return cached.definition as DataGridColumnDef<TRow>
    }
  }

  const normalizedCellType = inferColumnCellType(column)
  const normalizedPresentation = normalizeColumnPresentation(column, normalizedCellType)
  const normalizedValueGetter = resolveNormalizedValueGetter(column)
  const {
    initialState: _initialState,
    presentation: _presentation,
    capabilities,
    constraints,
    cellInteraction,
    meta,
    cellType: _cellType,
    accessor: _accessor,
    ...rest
  } = column as DataGridColumnDef<TRow> & { currency?: unknown; editor?: unknown; initialState?: unknown }
  const normalized: DataGridColumnDef<TRow> = {
    ...rest,
    ...(typeof normalizedValueGetter === "function" ? { valueGetter: normalizedValueGetter } : {}),
    cellType: normalizedCellType,
    presentation: normalizedPresentation,
    capabilities: capabilities ? Object.freeze({ ...capabilities }) : undefined,
    constraints: constraints ? Object.freeze({ ...constraints }) : undefined,
    cellInteraction: freezeColumnCellInteraction(cellInteraction),
    meta: cloneObjectRecord(meta),
  }
  if (normalized.meta) {
    Object.freeze(normalized.meta)
  }
  const frozen = Object.freeze(normalized)
  if (typeof column === "object" && column !== null) {
    normalizedColumnDefinitionCache.set(column as object, {
      normalizedKey: column.key,
      definition: frozen,
    })
  }
  return frozen
}

function resolveInitialColumnState(column: DataGridColumnInput, definition: DataGridColumnDef): DataGridColumnState {
  const initialState = column.initialState
  const visible = initialState?.visible ?? true
  const pin = normalizePin(initialState?.pin)
  const normalizedWidth = normalizeWidth(initialState?.width)
  return Object.freeze({
    visible: visible !== false,
    pin,
    width: clampWidthToDefinition(normalizedWidth, definition),
  })
}

function createColumnSnapshot(key: string, state: MutableColumnState): DataGridColumnSnapshot {
  return Object.freeze({
    key,
    state: state.state,
    visible: state.state.visible,
    pin: state.state.pin,
    width: state.state.width,
    column: state.column,
  })
}

export function createDataGridColumnModel(
  options: CreateDataGridColumnModelOptions = {},
): DataGridColumnModel {
  let disposed = false
  const listeners = new Set<DataGridColumnModelListener>()
  const columnsByKey = new Map<string, MutableColumnState>()
  let order: string[] = []
  let snapshotDirty = true
  let snapshotCache: DataGridColumnModelSnapshot | null = null
  let batchDepth = 0
  let emitPending = false

  function ensureActive() {
    if (disposed) {
      throw new Error("DataGridColumnModel has been disposed")
    }
  }

  function materializeSnapshot(): DataGridColumnModelSnapshot {
    if (!snapshotDirty && snapshotCache) {
      return snapshotCache
    }

    const byKey: Record<string, DataGridColumnSnapshot> = {}
    const columns = order
      .map(key => {
        const state = columnsByKey.get(key)
        if (!state) {
          return null
        }
        const snapshot = createColumnSnapshot(key, state)
        byKey[key] = snapshot
        return snapshot
      })
      .filter((entry): entry is DataGridColumnSnapshot => entry !== null)

    const visibleColumns = columns.filter(column => column.state.visible)
    const pinnedLeftColumns = columns.filter(column => column.state.visible && column.state.pin === "left")
    const pinnedRightColumns = columns.filter(column => column.state.visible && column.state.pin === "right")
    const centerColumns = columns.filter(column => column.state.visible && column.state.pin === "none")

    snapshotCache = Object.freeze({
      columns: Object.freeze(columns),
      order: Object.freeze([...order]),
      visibleColumns: Object.freeze(visibleColumns),
      byKey: Object.freeze(byKey),
      pinnedLeftColumns: Object.freeze(pinnedLeftColumns),
      centerColumns: Object.freeze(centerColumns),
      pinnedRightColumns: Object.freeze(pinnedRightColumns),
    })
    snapshotDirty = false
    return snapshotCache
  }

  function markSnapshotDirty() {
    snapshotDirty = true
    snapshotCache = null
  }

  function emit() {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = materializeSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function emitOrQueue() {
    if (batchDepth > 0) {
      emitPending = true
      return
    }
    emit()
  }

  function setColumnsValue(columns: readonly DataGridColumnInput[]) {
    columnsByKey.clear()
    order = []
    const seen = new Set<string>()
    columns.forEach((column, index) => {
      if (!column || typeof column !== "object") {
        throw new Error(
          `[DataGridColumnModel] column definition at index ${index} must be an object.`,
        )
      }
      const key = normalizeColumnKey(column.key, index)
      if (seen.has(key)) {
        throw new Error(
          `[DataGridColumnModel] duplicate column key "${key}" is not allowed.`,
        )
      }
      seen.add(key)
      const normalizedColumn = freezeColumnDefinition(
        key === column.key
          ? column as DataGridColumnDef
          : { ...column, key } as DataGridColumnDef,
      )
      columnsByKey.set(key, {
        column: normalizedColumn,
        state: resolveInitialColumnState(column, normalizedColumn),
      })
      order.push(key)
    })
    markSnapshotDirty()
    emitOrQueue()
  }

  setColumnsValue(Array.isArray(options.columns) ? options.columns : [])

  return {
    getSnapshot() {
      return materializeSnapshot()
    },
    getColumn(key: string) {
      return materializeSnapshot().byKey[key]
    },
    setColumns(columns: readonly DataGridColumnInput[]) {
      ensureActive()
      setColumnsValue(Array.isArray(columns) ? columns : [])
    },
    batch<TResult>(fn: () => TResult): TResult {
      ensureActive()
      batchDepth += 1
      try {
        return fn()
      } finally {
        batchDepth = Math.max(0, batchDepth - 1)
        if (batchDepth === 0 && emitPending) {
          emitPending = false
          emit()
        }
      }
    },
    setColumnOrder(keys: readonly string[]) {
      ensureActive()
      const nextOrder: string[] = []
      const seen = new Set<string>()

      for (const key of keys) {
        if (!columnsByKey.has(key) || seen.has(key)) {
          continue
        }
        seen.add(key)
        nextOrder.push(key)
      }

      for (const key of order) {
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        nextOrder.push(key)
      }

      if (nextOrder.length === order.length) {
        let unchanged = true
        for (let index = 0; index < nextOrder.length; index += 1) {
          if (nextOrder[index] !== order[index]) {
            unchanged = false
            break
          }
        }
        if (unchanged) {
          return
        }
      }

      order = nextOrder
      markSnapshotDirty()
      emitOrQueue()
    },
    setColumnVisibility(key: string, visible: boolean) {
      ensureActive()
      const state = columnsByKey.get(key)
      if (!state || state.state.visible === visible) {
        return
      }
      state.state = Object.freeze({
        ...state.state,
        visible,
      })
      markSnapshotDirty()
      emitOrQueue()
    },
    setColumnWidth(key: string, width: number | null) {
      ensureActive()
      const state = columnsByKey.get(key)
      if (!state) {
        return
      }
      const nextWidth = clampWidthToDefinition(normalizeWidth(width), state.column)
      if (state.state.width === nextWidth) {
        return
      }
      state.state = Object.freeze({
        ...state.state,
        width: nextWidth,
      })
      markSnapshotDirty()
      emitOrQueue()
    },
    setColumnPin(key: string, pin: DataGridColumnPin) {
      ensureActive()
      const state = columnsByKey.get(key)
      if (!state) {
        return
      }
      const nextPin = normalizePin(pin)
      if (state.state.pin === nextPin) {
        return
      }
      state.state = Object.freeze({
        ...state.state,
        pin: nextPin,
      })
      markSnapshotDirty()
      emitOrQueue()
    },
    subscribe(listener: DataGridColumnModelListener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      listeners.clear()
      columnsByKey.clear()
      order = []
      snapshotDirty = true
      snapshotCache = null
    },
  }
}
