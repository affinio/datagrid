import { resolveAnimationFrameScheduler } from "../internal/browserAnimationFrame"
import {
  normalizeDataGridRecoveryMaxAttempts,
  resolveDataGridViewportRecoveryTick,
} from "../internal/dataGridViewportState"

export interface UseDataGridInitialViewportRecoveryOptions {
  resolveShouldRecover: () => boolean
  runRecoveryStep: () => void
  maxAttempts?: number
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridInitialViewportRecoveryResult {
  scheduleRecovery: (reset?: boolean) => void
  cancelRecovery: () => void
  isRecoveryScheduled: () => boolean
  getAttemptCount: () => number
}

export function useDataGridInitialViewportRecovery(
  options: UseDataGridInitialViewportRecoveryOptions,
): UseDataGridInitialViewportRecoveryResult {
  const maxAttempts = normalizeDataGridRecoveryMaxAttempts(options.maxAttempts)
  const { requestFrame, cancelFrame } = resolveAnimationFrameScheduler({
    requestAnimationFrame: options.requestAnimationFrame,
    cancelAnimationFrame: options.cancelAnimationFrame,
  })

  let recoveryFrame: number | null = null
  let attempts = 0

  function cancelRecovery(): void {
    if (recoveryFrame !== null) {
      cancelFrame(recoveryFrame)
      recoveryFrame = null
    }
    attempts = 0
  }

  function runRecoveryTick(): void {
    recoveryFrame = null
    const shouldRecoverBeforeStep = options.resolveShouldRecover()
    const shouldRecoverAfterStep = shouldRecoverBeforeStep ? (() => {
      options.runRecoveryStep()
      return options.resolveShouldRecover()
    })() : false
    const result = resolveDataGridViewportRecoveryTick(
      shouldRecoverBeforeStep,
      attempts,
      maxAttempts,
      shouldRecoverAfterStep,
    )
    attempts = result.nextAttempts
    if (result.shouldScheduleNext) {
      scheduleRecovery(false)
    }
  }

  function scheduleRecovery(reset = false): void {
    if (reset) {
      cancelRecovery()
    }
    if (recoveryFrame !== null) {
      return
    }
    recoveryFrame = requestFrame(runRecoveryTick)
  }

  return {
    scheduleRecovery,
    cancelRecovery,
    isRecoveryScheduled: () => recoveryFrame !== null,
    getAttemptCount: () => attempts,
  }
}
