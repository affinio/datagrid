import type { DataGridRowId } from "../models/rowModel.js"
import {
  addDataGridRowSelectionModelRows,
  replaceDataGridRowSelectionModel,
  type DataGridRowSelectionModelSnapshot,
} from "./rowSelectionModel.js"
import {
  createDataGridRowSelectionInteractionSnapshot,
  type DataGridRowSelectionInteractionSnapshot,
  type DataGridSelectableRowRangeResolution,
} from "./rowSelectionInteraction.js"

export interface DataGridRowSelectionSession {
  readonly sessionId: string
  readonly projectionRevision: number
  readonly baseSelectionRevision: number
  readonly baseSelection: DataGridRowSelectionModelSnapshot
  readonly baseInteraction: DataGridRowSelectionInteractionSnapshot
  readonly anchorRowId: DataGridRowId
  readonly operation: "replace" | "add"
  readonly previewSelection: DataGridRowSelectionModelSnapshot | null
  readonly extentRowId: DataGridRowId | null
}

export interface DataGridRowSelectionSessionResult {
  readonly accepted: boolean
  readonly reason?: "incomplete-range" | "stale-projection" | "target-unselectable" | "selection-conflict"
  readonly session: DataGridRowSelectionSession | null
  readonly selection: DataGridRowSelectionModelSnapshot
  readonly interaction: DataGridRowSelectionInteractionSnapshot
}

export interface BeginDataGridRowSelectionSessionOptions {
  readonly sessionId: string
  readonly projectionRevision: number
  readonly selection: DataGridRowSelectionModelSnapshot
  readonly interaction: DataGridRowSelectionInteractionSnapshot
  readonly targetRowId: DataGridRowId
  readonly operation: "replace" | "add"
}

function makeSession(
  options: Omit<DataGridRowSelectionSession, never>,
): DataGridRowSelectionSession {
  return Object.freeze(options)
}

export function beginDataGridRowSelectionSession(
  options: BeginDataGridRowSelectionSessionOptions,
): DataGridRowSelectionSession {
  const anchorRowId = options.targetRowId
  return makeSession({
    sessionId: options.sessionId,
    projectionRevision: options.projectionRevision,
    baseSelectionRevision: options.selection.revision,
    baseSelection: options.selection,
    baseInteraction: options.interaction,
    anchorRowId,
    operation: options.operation,
    previewSelection: null,
    extentRowId: null,
  })
}

function rejected(
  selection: DataGridRowSelectionModelSnapshot,
  interaction: DataGridRowSelectionInteractionSnapshot,
  session: DataGridRowSelectionSession | null,
  reason: DataGridRowSelectionSessionResult["reason"],
): DataGridRowSelectionSessionResult {
  return Object.freeze({ accepted: false, reason, session, selection, interaction })
}

export function updateDataGridRowSelectionSession(
  session: DataGridRowSelectionSession,
  currentSelection: DataGridRowSelectionModelSnapshot,
  currentProjectionRevision: number,
  targetRowId: DataGridRowId,
  range: DataGridSelectableRowRangeResolution,
): DataGridRowSelectionSessionResult {
  if (currentSelection.revision !== session.baseSelectionRevision) {
    return rejected(currentSelection, session.baseInteraction, null, "selection-conflict")
  }
  if (currentProjectionRevision !== session.projectionRevision || range.status === "stale"
    || range.projectionRevision !== session.projectionRevision) {
    return rejected(currentSelection, session.baseInteraction, null, "stale-projection")
  }
  if (range.status === "incomplete") {
    return rejected(currentSelection, session.baseInteraction, session, "incomplete-range")
  }
  if (range.status === "target-unselectable" || !range.rowIds.includes(targetRowId)) {
    return rejected(currentSelection, session.baseInteraction, session, "target-unselectable")
  }

  const anchorRowId = range.status === "anchor-missing" ? targetRowId : session.anchorRowId
  const rangeIds = range.status === "anchor-missing" ? [targetRowId] : range.rowIds
  const previewSelection = session.operation === "add"
    ? addDataGridRowSelectionModelRows(session.baseSelection, rangeIds)
    : replaceDataGridRowSelectionModel(session.baseSelection, rangeIds)
  const nextSession = makeSession({
    ...session,
    anchorRowId,
    previewSelection,
    extentRowId: targetRowId,
  })

  return Object.freeze({
    accepted: true,
    session: nextSession,
    selection: currentSelection,
    interaction: createDataGridRowSelectionInteractionSnapshot(anchorRowId, targetRowId),
  })
}

export function commitDataGridRowSelectionSession(
  session: DataGridRowSelectionSession,
  currentSelection: DataGridRowSelectionModelSnapshot,
  currentProjectionRevision: number,
): DataGridRowSelectionSessionResult {
  if (currentSelection.revision !== session.baseSelectionRevision) {
    return rejected(currentSelection, session.baseInteraction, null, "selection-conflict")
  }
  if (currentProjectionRevision !== session.projectionRevision) {
    return rejected(currentSelection, session.baseInteraction, null, "stale-projection")
  }
  if (!session.previewSelection) {
    return rejected(currentSelection, session.baseInteraction, session, "incomplete-range")
  }

  const selection = replaceDataGridRowSelectionModel(currentSelection, session.previewSelection.selectedRowIds)
  const interaction = createDataGridRowSelectionInteractionSnapshot(session.anchorRowId, session.extentRowId)
  return Object.freeze({ accepted: true, session: null, selection, interaction })
}

export function cancelDataGridRowSelectionSession(
  session: DataGridRowSelectionSession,
  currentSelection: DataGridRowSelectionModelSnapshot,
): DataGridRowSelectionSessionResult {
  return Object.freeze({
    accepted: true,
    session: null,
    selection: currentSelection,
    interaction: session.baseInteraction,
  })
}
