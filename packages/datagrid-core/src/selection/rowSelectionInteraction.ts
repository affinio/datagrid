import type { DataGridRowId } from "../models/rowModel.js"
import {
  addDataGridRowSelectionModelRows,
  createDataGridRowSelectionModelSnapshot,
  replaceDataGridRowSelectionModel,
  toggleDataGridRowSelectionModelRow,
  type DataGridRowSelectionModelSnapshot,
} from "./rowSelectionModel.js"

export interface DataGridRowSelectionInteractionSnapshot {
  readonly anchorRowId: DataGridRowId | null
  readonly extentRowId: DataGridRowId | null
}

export interface DataGridSelectableRowRangeResolution {
  readonly status: "complete" | "incomplete" | "stale" | "anchor-missing" | "target-unselectable"
  readonly projectionRevision: number
  readonly rowIds: readonly DataGridRowId[]
}

export type DataGridRowSelectionIntent =
  | { readonly type: "replace"; readonly targetRowId: DataGridRowId }
  | { readonly type: "toggle"; readonly targetRowId: DataGridRowId }
  | {
      readonly type: "extend" | "add-range"
      readonly targetRowId: DataGridRowId
      readonly projectionRevision: number
      /** Latest committed revision observed by the active interaction session. */
      readonly expectedSelectionRevision?: number
      readonly range: DataGridSelectableRowRangeResolution
      /** Selection captured before an additive extension session began. */
      readonly baseSelection?: DataGridRowSelectionModelSnapshot
    }

export interface DataGridRowSelectionTransition {
  readonly accepted: boolean
  readonly reason?: "incomplete-range" | "stale-projection" | "target-unselectable" | "selection-conflict"
  readonly selection: DataGridRowSelectionModelSnapshot
  readonly interaction: DataGridRowSelectionInteractionSnapshot
}

export function createDataGridRowSelectionInteractionSnapshot(
  anchorRowId: DataGridRowId | null = null,
  extentRowId: DataGridRowId | null = anchorRowId,
): DataGridRowSelectionInteractionSnapshot {
  return Object.freeze({ anchorRowId, extentRowId })
}

function unchanged(
  selection: DataGridRowSelectionModelSnapshot,
  interaction: DataGridRowSelectionInteractionSnapshot,
  reason?: DataGridRowSelectionTransition["reason"],
): DataGridRowSelectionTransition {
  return Object.freeze({ accepted: false, ...(reason ? { reason } : {}), selection, interaction })
}

export function applyDataGridRowSelectionIntent(
  selection: DataGridRowSelectionModelSnapshot,
  interaction: DataGridRowSelectionInteractionSnapshot,
  intent: DataGridRowSelectionIntent,
): DataGridRowSelectionTransition {
  const { targetRowId } = intent

  if (intent.type === "replace") {
    return Object.freeze({
      accepted: true,
      selection: replaceDataGridRowSelectionModel(selection, [targetRowId]),
      interaction: createDataGridRowSelectionInteractionSnapshot(targetRowId, targetRowId),
    })
  }

  if (intent.type === "toggle") {
    return Object.freeze({
      accepted: true,
      selection: toggleDataGridRowSelectionModelRow(selection, targetRowId),
      interaction: createDataGridRowSelectionInteractionSnapshot(targetRowId, targetRowId),
    })
  }

  const { range, projectionRevision } = intent
  if (intent.expectedSelectionRevision != null && intent.expectedSelectionRevision !== selection.revision) {
    return unchanged(selection, interaction, "selection-conflict")
  }
  if (range.status === "incomplete") {
    return unchanged(selection, interaction, "incomplete-range")
  }
  if (range.status === "stale" || range.projectionRevision !== projectionRevision) {
    return unchanged(selection, interaction, "stale-projection")
  }
  if (range.status === "target-unselectable") {
    return unchanged(selection, interaction, "target-unselectable")
  }

  const anchorRowId = interaction.anchorRowId ?? targetRowId
  if (range.status === "anchor-missing" && interaction.anchorRowId != null) {
    return Object.freeze({
      accepted: true,
      selection: replaceDataGridRowSelectionModel(selection, [targetRowId]),
      interaction: createDataGridRowSelectionInteractionSnapshot(targetRowId, targetRowId),
    })
  }

  if (!range.rowIds.includes(targetRowId)) {
    return unchanged(selection, interaction, "target-unselectable")
  }

  const rangeSelection = intent.type === "add-range"
    ? addDataGridRowSelectionModelRows(intent.baseSelection ?? selection, range.rowIds)
    : createDataGridRowSelectionModelSnapshot(range.rowIds)
  const nextSelection = replaceDataGridRowSelectionModel(selection, rangeSelection.selectedRowIds)

  return Object.freeze({
    accepted: true,
    selection: nextSelection,
    interaction: createDataGridRowSelectionInteractionSnapshot(anchorRowId, targetRowId),
  })
}
