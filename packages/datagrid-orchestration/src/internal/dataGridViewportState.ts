export interface DataGridPendingViewportScrollState {
  pendingTop: number | null
  pendingLeft: number | null
  pendingCloseContextMenu: boolean
  pendingCommitInlineEdit: boolean
}

export interface ResolveDataGridPendingScrollUpdateOptions {
  scrollTop: number
  scrollLeft: number
  isContextMenuVisible: boolean
  shouldCloseContextMenu: boolean
  hasInlineEditor: boolean
}

export interface DataGridPendingViewportScrollFlushPlan {
  nextState: DataGridPendingViewportScrollState
  shouldCloseContextMenu: boolean
  nextTop: number | null
  nextLeft: number | null
  shouldCommitInlineEdit: boolean
}

export interface DataGridViewportRecoveryTickResult {
  nextAttempts: number
  shouldRunRecoveryStep: boolean
  shouldScheduleNext: boolean
}

export function createDataGridPendingViewportScrollState(): DataGridPendingViewportScrollState {
  return {
    pendingTop: null,
    pendingLeft: null,
    pendingCloseContextMenu: false,
    pendingCommitInlineEdit: false,
  }
}

export function resolveDataGridPendingScrollUpdate(
  state: DataGridPendingViewportScrollState,
  options: ResolveDataGridPendingScrollUpdateOptions,
): DataGridPendingViewportScrollState {
  return {
    pendingTop: options.scrollTop,
    pendingLeft: options.scrollLeft,
    pendingCloseContextMenu: state.pendingCloseContextMenu || (options.isContextMenuVisible && options.shouldCloseContextMenu),
    pendingCommitInlineEdit: state.pendingCommitInlineEdit || options.hasInlineEditor,
  }
}

export function resolveDataGridPendingScrollFlushPlan(
  state: DataGridPendingViewportScrollState,
  isContextMenuVisible: boolean,
  hasInlineEditor: boolean,
): DataGridPendingViewportScrollFlushPlan {
  return {
    nextState: createDataGridPendingViewportScrollState(),
    shouldCloseContextMenu: state.pendingCloseContextMenu && isContextMenuVisible,
    nextTop: state.pendingTop,
    nextLeft: state.pendingLeft,
    shouldCommitInlineEdit: state.pendingCommitInlineEdit && hasInlineEditor,
  }
}

export function normalizeDataGridRecoveryMaxAttempts(value: number | undefined, fallback = 12): number {
  return Math.max(1, Math.trunc(value ?? fallback))
}

export function resolveDataGridViewportRecoveryTick(
  shouldRecoverBeforeStep: boolean,
  attempts: number,
  maxAttempts: number,
  shouldRecoverAfterStep: boolean,
): DataGridViewportRecoveryTickResult {
  if (!shouldRecoverBeforeStep) {
    return {
      nextAttempts: 0,
      shouldRunRecoveryStep: false,
      shouldScheduleNext: false,
    }
  }

  const nextAttempts = attempts + 1
  if (nextAttempts >= maxAttempts) {
    return {
      nextAttempts: 0,
      shouldRunRecoveryStep: true,
      shouldScheduleNext: false,
    }
  }

  return {
    nextAttempts: shouldRecoverAfterStep ? nextAttempts : 0,
    shouldRunRecoveryStep: true,
    shouldScheduleNext: shouldRecoverAfterStep,
  }
}