import type {
  DataGridRowId,
  DataGridRowSelectionInteractionSnapshot,
  DataGridRowSelectionModelSnapshot,
  DataGridRowSelectionSession,
  DataGridRowSelectionSessionResult,
  DataGridSelectableRowRangeResolution,
} from "@affino/datagrid-core"
import {
  beginDataGridRowSelectionSession,
  cancelDataGridRowSelectionSession,
  commitDataGridRowSelectionSession,
  updateDataGridRowSelectionSession,
} from "@affino/datagrid-core"

export type DataGridRowSelectionInteractionOwner = "row-selection"

export interface DataGridRowSelectionSessionPreview {
  readonly selection: DataGridRowSelectionModelSnapshot
  readonly interaction: DataGridRowSelectionInteractionSnapshot
}

export interface CreateDataGridRowSelectionSessionControllerOptions {
  readonly getSelection: () => DataGridRowSelectionModelSnapshot
  readonly getInteraction: () => DataGridRowSelectionInteractionSnapshot
  readonly getProjectionRevision: () => number
  readonly resolveRange: (
    anchorRowId: DataGridRowId,
    targetRowId: DataGridRowId,
    projectionRevision: number,
  ) => DataGridSelectableRowRangeResolution
  /** Commits both logical states in one host transaction. */
  readonly commit: (
    selection: DataGridRowSelectionModelSnapshot,
    interaction: DataGridRowSelectionInteractionSnapshot,
  ) => void
  readonly publishPreview: (preview: DataGridRowSelectionSessionPreview | null) => void
  /** Returns a release function when this gesture exclusively acquires the grid interaction owner. */
  readonly acquireInteractionOwner: (
    owner: DataGridRowSelectionInteractionOwner,
  ) => (() => void) | null
}

export interface DataGridRowSelectionSessionController {
  begin: (targetRowId: DataGridRowId, operation: "replace" | "add") => boolean
  update: (targetRowId: DataGridRowId) => DataGridRowSelectionSessionResult | null
  commit: () => DataGridRowSelectionSessionResult | null
  cancel: () => DataGridRowSelectionSessionResult | null
  getSession: () => DataGridRowSelectionSession | null
  dispose: () => void
}

export function createDataGridRowSelectionSessionController(
  options: CreateDataGridRowSelectionSessionControllerOptions,
): DataGridRowSelectionSessionController {
  let session: DataGridRowSelectionSession | null = null
  let releaseInteractionOwner: (() => void) | null = null
  let sessionSequence = 0

  function releaseOwner(): void {
    releaseInteractionOwner?.()
    releaseInteractionOwner = null
  }

  function finish(): void {
    session = null
    options.publishPreview(null)
    releaseOwner()
  }

  function begin(targetRowId: DataGridRowId, operation: "replace" | "add"): boolean {
    if (session) {
      return false
    }
    const release = options.acquireInteractionOwner("row-selection")
    if (!release) {
      return false
    }
    try {
      sessionSequence += 1
      session = beginDataGridRowSelectionSession({
        sessionId: `row-selection:${sessionSequence}`,
        projectionRevision: options.getProjectionRevision(),
        selection: options.getSelection(),
        interaction: options.getInteraction(),
        targetRowId,
        operation,
      })
      releaseInteractionOwner = release
      return true
    } catch (error) {
      release()
      throw error
    }
  }

  function update(targetRowId: DataGridRowId): DataGridRowSelectionSessionResult | null {
    if (!session) {
      return null
    }
    const result = updateDataGridRowSelectionSession(
      session,
      options.getSelection(),
      options.getProjectionRevision(),
      targetRowId,
      options.resolveRange(session.anchorRowId, targetRowId, session.projectionRevision),
    )
    if (!result.session) {
      finish()
      return result
    }

    session = result.session
    options.publishPreview(session.previewSelection
      ? { selection: session.previewSelection, interaction: result.interaction }
      : null)
    return result
  }

  function commit(): DataGridRowSelectionSessionResult | null {
    if (!session) {
      return null
    }
    const result = commitDataGridRowSelectionSession(
      session,
      options.getSelection(),
      options.getProjectionRevision(),
    )
    try {
      if (result.accepted) {
        options.commit(result.selection, result.interaction)
      }
      return result
    } finally {
      finish()
    }
  }

  function cancel(): DataGridRowSelectionSessionResult | null {
    if (!session) {
      return null
    }
    const result = cancelDataGridRowSelectionSession(session, options.getSelection())
    finish()
    return result
  }

  return {
    begin,
    update,
    commit,
    cancel,
    getSession: () => session,
    dispose: () => {
      cancel()
      releaseOwner()
    },
  }
}
