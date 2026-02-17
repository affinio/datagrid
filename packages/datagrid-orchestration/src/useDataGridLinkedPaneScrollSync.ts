export type DataGridLinkedPaneSyncMode = "direct-transform" | "css-var"

export interface UseDataGridLinkedPaneScrollSyncOptions {
  resolveSourceScrollTop: () => number
  mode?: DataGridLinkedPaneSyncMode
  resolvePaneElements?: () => readonly (HTMLElement | null | undefined)[]
  resolveCssVarHost?: () => HTMLElement | null
  cssVarName?: string
  clearOnReset?: boolean
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridLinkedPaneScrollSyncResult {
  syncNow: (scrollTop?: number) => number
  scheduleSyncLoop: () => void
  cancelSyncLoop: () => void
  isSyncLoopScheduled: () => boolean
  getLastAppliedScrollTop: () => number
  reset: () => void
}

export function useDataGridLinkedPaneScrollSync(
  options: UseDataGridLinkedPaneScrollSyncOptions,
): UseDataGridLinkedPaneScrollSyncResult {
  const mode = options.mode ?? "direct-transform"
  const cssVarName = options.cssVarName ?? "--ui-affino-linked-scroll-top"
  const clearOnReset = options.clearOnReset ?? true
  const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
  const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))

  let syncFrame: number | null = null
  let lastAppliedScrollTop = Number.NaN

  function normalizeScrollTop(value: number): number {
    return Math.max(0, Number.isFinite(value) ? value : 0)
  }

  function resolvePaneElements(): readonly (HTMLElement | null | undefined)[] {
    return options.resolvePaneElements?.() ?? []
  }

  function applyDirectTransform(scrollTop: number): void {
    const transform = `translate3d(0, ${-scrollTop}px, 0)`
    resolvePaneElements().forEach((element) => {
      if (!element) {
        return
      }
      if (element.style.transform !== transform) {
        element.style.transform = transform
      }
    })
  }

  function applyCssVar(scrollTop: number): void {
    const host = options.resolveCssVarHost?.()
    if (!host) {
      return
    }
    const value = `${-scrollTop}px`
    if (host.style.getPropertyValue(cssVarName) !== value) {
      host.style.setProperty(cssVarName, value)
    }
  }

  function clearAppliedState(): void {
    if (mode === "css-var") {
      options.resolveCssVarHost?.()?.style.removeProperty(cssVarName)
      return
    }
    resolvePaneElements().forEach((element) => {
      element?.style.removeProperty("transform")
    })
  }

  function apply(scrollTop: number): number {
    const normalizedTop = normalizeScrollTop(scrollTop)
    if (normalizedTop === lastAppliedScrollTop) {
      return normalizedTop
    }
    lastAppliedScrollTop = normalizedTop
    if (mode === "css-var") {
      applyCssVar(normalizedTop)
    } else {
      applyDirectTransform(normalizedTop)
    }
    return normalizedTop
  }

  function syncNow(scrollTop = options.resolveSourceScrollTop()): number {
    return apply(scrollTop)
  }

  function runSyncLoop(): void {
    syncFrame = null
    const sourceTop = normalizeScrollTop(options.resolveSourceScrollTop())
    const appliedTop = apply(sourceTop)
    if (sourceTop !== appliedTop) {
      scheduleSyncLoop()
      return
    }
    if (sourceTop !== lastAppliedScrollTop) {
      scheduleSyncLoop()
    }
  }

  function scheduleSyncLoop(): void {
    if (syncFrame !== null) {
      return
    }
    syncFrame = requestFrame(runSyncLoop)
  }

  function cancelSyncLoop(): void {
    if (syncFrame === null) {
      return
    }
    cancelFrame(syncFrame)
    syncFrame = null
  }

  function reset(): void {
    cancelSyncLoop()
    lastAppliedScrollTop = Number.NaN
    if (clearOnReset) {
      clearAppliedState()
    }
  }

  return {
    syncNow,
    scheduleSyncLoop,
    cancelSyncLoop,
    isSyncLoopScheduled: () => syncFrame !== null,
    getLastAppliedScrollTop: () => lastAppliedScrollTop,
    reset,
  }
}
