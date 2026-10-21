import type { DataGridRowId } from "../models/rowModel.js"
import type { DataGridSelectableRowRangeResolution } from "./rowSelectionInteraction.js"

export type DataGridRowSelectionRangeNodeKind = "data" | "group" | "unloaded" | "other"

export interface DataGridRowSelectionRangeNode {
  readonly rowId: DataGridRowId | null
  readonly kind: DataGridRowSelectionRangeNodeKind
  readonly selectable?: boolean
}

export interface ResolveDataGridSelectableRowRangeOptions {
  readonly anchorRowId: DataGridRowId
  readonly targetRowId: DataGridRowId
  readonly projectionRevision: number
  readonly currentProjectionRevision: number
  readonly resolveRowIndexById: (rowId: DataGridRowId) => number | null
  /** Reads from the logical projection, including rows outside the virtual DOM window. */
  readonly resolveRowAtIndex: (rowIndex: number) => DataGridRowSelectionRangeNode | null
}

/** Resolves a stable ID range from the logical projection, never from rendered DOM rows. */
export function resolveDataGridSelectableRowRange(
  options: ResolveDataGridSelectableRowRangeOptions,
): DataGridSelectableRowRangeResolution {
  const { projectionRevision } = options
  if (projectionRevision !== options.currentProjectionRevision) {
    return Object.freeze({ status: "stale", projectionRevision, rowIds: [] })
  }

  const anchorIndex = options.resolveRowIndexById(options.anchorRowId)
  const targetIndex = options.resolveRowIndexById(options.targetRowId)
  if (targetIndex == null || !Number.isInteger(targetIndex) || targetIndex < 0) {
    return Object.freeze({ status: "target-unselectable", projectionRevision, rowIds: [] })
  }

  const target = options.resolveRowAtIndex(targetIndex)
  if (!target) {
    return Object.freeze({ status: "incomplete", projectionRevision, rowIds: [] })
  }
  if (target.kind !== "data" || target.rowId !== options.targetRowId || target.selectable === false) {
    return Object.freeze({ status: "target-unselectable", projectionRevision, rowIds: [] })
  }

  if (anchorIndex == null || !Number.isInteger(anchorIndex) || anchorIndex < 0) {
    return Object.freeze({ status: "anchor-missing", projectionRevision, rowIds: [options.targetRowId] })
  }

  const rowIds: DataGridRowId[] = []
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
    const node = options.resolveRowAtIndex(rowIndex)
    if (!node || node.kind === "unloaded") {
      return Object.freeze({ status: "incomplete", projectionRevision, rowIds: [] })
    }
    if (node.kind !== "data" || node.rowId == null || node.selectable === false) {
      continue
    }
    rowIds.push(node.rowId)
  }

  if (!rowIds.includes(options.targetRowId)) {
    return Object.freeze({ status: "target-unselectable", projectionRevision, rowIds: [] })
  }
  return Object.freeze({ status: "complete", projectionRevision, rowIds })
}
