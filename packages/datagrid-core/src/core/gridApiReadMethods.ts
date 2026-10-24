import type {
  DataGridColumnModel,
  DataGridComputedFieldSnapshot,
  DataGridFormulaFieldSnapshot,
  DataGridRowModel,
  DataGridRowNode,
} from "../models/index.js"
import type { DataGridSelectionSnapshot } from "../selection/snapshot.js"
import type { DataGridRowSelectionSnapshot } from "../selection/rowSelection.js"
import type { DataGridColumnSelectionSnapshot } from "../selection/columnSelection.js"

export type DataGridReadViewPartName = "rows" | "columns" | "computed" | "selection"
export type DataGridReadCompleteness = "complete" | "partial" | "unknown"

export interface DataGridReadCoverage {
  readonly scope: "current-projection"
  readonly completeness: DataGridReadCompleteness
  readonly queryRevision: number | null
  readonly datasetVersion: string | number | null
  readonly totalRowCount: number
  readonly loadedRowCount: number | null
  /** Inclusive display-index intervals that are not present in the row cache. */
  readonly missingIntervals: readonly Readonly<{ start: number; end: number }>[] | null
}

export type DataGridReadViewPart<T> =
  | Readonly<{ status: "available"; revision: number | string | null; value: T }>
  | Readonly<{ status: "unsupported"; revision: null }>

export interface DataGridReadViewRow<TRow> extends Omit<DataGridRowNode<TRow>, "data" | "row"> {
  readonly data: TRow
  readonly row: TRow
}

export interface DataGridReadViewRows<TRow> {
  readonly snapshot: ReturnType<DataGridRowModel<TRow>["getSnapshot"]>
  readonly projection: readonly DataGridReadViewRow<TRow>[]
  readonly coverage: DataGridReadCoverage
}

export interface DataGridReadViewSelection {
  readonly cells: DataGridSelectionSnapshot | null
  readonly rows: DataGridRowSelectionSnapshot | null
  readonly columns: DataGridColumnSelectionSnapshot | null
}

export interface DataGridReadViewComputed {
  readonly fields: readonly DataGridComputedFieldSnapshot[]
  readonly formulas: readonly DataGridFormulaFieldSnapshot[]
}

export interface DataGridReadView<TRow> {
  readonly rows?: DataGridReadViewPart<DataGridReadViewRows<TRow>>
  readonly columns?: DataGridReadViewPart<ReturnType<DataGridColumnModel["getSnapshot"]>>
  readonly computed?: DataGridReadViewPart<DataGridReadViewComputed>
  readonly selection?: DataGridReadViewPart<DataGridReadViewSelection>
}

export interface DataGridCaptureReadViewOptions<TRow> {
  include: readonly DataGridReadViewPartName[]
  cloneRow?: { bivarianceHack(row: TRow): TRow }["bivarianceHack"]
}

export interface DataGridApiReadMethods<TRow> {
  captureReadView(options: DataGridCaptureReadViewOptions<TRow>): DataGridReadView<TRow>
}

export interface CreateDataGridApiReadMethodsInput<TRow> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  getCellSelection: () => { getSelectionSnapshot(): DataGridSelectionSnapshot | null } | null
  getRowSelection: () => { getRowSelectionSnapshot(): DataGridRowSelectionSnapshot | null } | null
  getColumnSelection: () => { getColumnSelectionSnapshot(): DataGridColumnSelectionSnapshot | null } | null
}

function cloneFreezeStructure<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== "object" || value instanceof Error) return value
  const existing = seen.get(value)
  if (existing) return existing as T
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const entry of value) copy.push(cloneFreezeStructure(entry, seen))
    return Object.freeze(copy) as T
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value
  const copy = Object.create(prototype) as Record<PropertyKey, unknown>
  seen.set(value, copy)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    copy[key] = cloneFreezeStructure((value as Record<PropertyKey, unknown>)[key], seen)
  }
  return Object.freeze(copy) as T
}

export function createDataGridApiReadMethods<TRow>(
  input: CreateDataGridApiReadMethodsInput<TRow>,
): DataGridApiReadMethods<TRow> {
  return {
    captureReadView(options) {
      const include = new Set(options.include)
      const cloneContext = new WeakMap<object, unknown>()
      const cloneCapturedValue = <T>(value: T): T => cloneFreezeStructure(value, cloneContext)
      const view: {
        rows?: DataGridReadView<TRow>["rows"]
        columns?: DataGridReadView<TRow>["columns"]
        computed?: DataGridReadView<TRow>["computed"]
        selection?: DataGridReadView<TRow>["selection"]
      } = {}

      if (include.has("rows")) {
        const snapshot = input.rowModel.getSnapshot()
        const count = input.rowModel.getRowCount()
        const nodes = count > 0 ? input.rowModel.getRowsInRange({ start: 0, end: count - 1 }) : []
        const loadedIntervals = input.rowModel.getLoadedRowIntervals?.({ start: 0, end: Math.max(0, count - 1) })
        let loadedRowCount: number | null = null
        let missingIntervals: readonly Readonly<{ start: number; end: number }>[] | null = null
        let completeness: DataGridReadCompleteness
        if (input.rowModel.kind === "client") {
          loadedRowCount = count
          missingIntervals = Object.freeze([])
          completeness = "complete"
        } else if (loadedIntervals) {
          const normalized = loadedIntervals
            .map(({ start, end }) => ({ start: Math.max(0, Math.trunc(start)), end: Math.min(count - 1, Math.trunc(end)) }))
            .filter(({ start, end }) => start <= end)
            .sort((a, b) => a.start - b.start)
          const merged: Array<{ start: number; end: number }> = []
          for (const interval of normalized) {
            const previous = merged[merged.length - 1]
            if (previous && interval.start <= previous.end + 1) previous.end = Math.max(previous.end, interval.end)
            else merged.push({ ...interval })
          }
          const missing: Array<{ start: number; end: number }> = []
          let cursor = 0
          for (const interval of merged) {
            if (cursor < interval.start) missing.push({ start: cursor, end: interval.start - 1 })
            cursor = Math.max(cursor, interval.end + 1)
          }
          if (cursor < count) missing.push({ start: cursor, end: count - 1 })
          loadedRowCount = merged.reduce((total, interval) => total + interval.end - interval.start + 1, 0)
          missingIntervals = Object.freeze(missing.map(interval => Object.freeze(interval)))
          completeness = count === 0 || missing.length === 0 ? "complete" : "partial"
        } else {
          completeness = "unknown"
        }
        const projection = nodes.map((node) => {
          const data = options.cloneRow
            ? cloneCapturedValue(options.cloneRow(node.data))
            : node.data
          return Object.freeze({
            kind: node.kind,
            data,
            row: data,
            rowKey: node.rowKey,
            rowId: node.rowId,
            sourceIndex: node.sourceIndex,
            originalIndex: node.originalIndex,
            displayIndex: node.displayIndex,
            state: cloneCapturedValue(node.state),
            ...(node.groupMeta ? { groupMeta: cloneCapturedValue(node.groupMeta) } : {}),
          })
        })
        view.rows = Object.freeze({
          status: "available",
          revision: typeof snapshot.revision === "number" ? snapshot.revision : null,
          value: Object.freeze({
            snapshot: cloneCapturedValue(snapshot),
            projection: Object.freeze(projection),
            coverage: Object.freeze({
              scope: "current-projection" as const,
              completeness,
              queryRevision: typeof snapshot.revision === "number" ? snapshot.revision : null,
              datasetVersion: snapshot.datasetVersion ?? null,
              totalRowCount: count,
              loadedRowCount,
              missingIntervals,
            }),
          }),
        })
      }

      if (include.has("columns")) {
        const snapshot = input.columnModel.getSnapshot()
        view.columns = Object.freeze({
          status: "available",
          revision: snapshot.revision,
          value: cloneCapturedValue(snapshot),
        })
      }

      if (include.has("computed")) {
        const getFields = input.rowModel.getComputedFields
        const getFormulas = input.rowModel.getFormulaFields
        if (typeof getFields === "function" || typeof getFormulas === "function") {
          const rowRevision = input.rowModel.getSnapshot().revision
          view.computed = Object.freeze({
            status: "available",
            revision: typeof rowRevision === "number" ? rowRevision : null,
            value: Object.freeze({
              fields: cloneCapturedValue(typeof getFields === "function" ? getFields.call(input.rowModel) : []),
              formulas: cloneCapturedValue(typeof getFormulas === "function" ? getFormulas.call(input.rowModel) : []),
            }),
          })
        } else {
          view.computed = Object.freeze({ status: "unsupported", revision: null })
        }
      }

      if (include.has("selection")) {
        const cellSelection = input.getCellSelection()
        const rowSelection = input.getRowSelection()
        const columnSelection = input.getColumnSelection()
        if (cellSelection || rowSelection || columnSelection) {
          view.selection = Object.freeze({
            status: "available",
            revision: null,
            value: Object.freeze({
              cells: cellSelection ? cloneFreezeStructure(cellSelection.getSelectionSnapshot()) : null,
              rows: rowSelection ? cloneFreezeStructure(rowSelection.getRowSelectionSnapshot()) : null,
              columns: columnSelection ? cloneFreezeStructure(columnSelection.getColumnSelectionSnapshot()) : null,
            }),
          })
        } else {
          view.selection = Object.freeze({ status: "unsupported", revision: null })
        }
      }

      return Object.freeze(view)
    },
  }
}
