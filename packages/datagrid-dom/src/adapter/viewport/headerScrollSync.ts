import { useDataGridManagedWheelScroll } from "@affino/datagrid-orchestration"

/** The body owns horizontal position; the header is a synchronized peer. */
export function createHeaderScrollSync(grid: HTMLElement) {
  let body: HTMLElement | null = null
  let header: HTMLElement | null = null
  const resolvePinnedBottom = (): HTMLElement | null => grid.querySelector<HTMLElement>(".affino-grid-dom__pinned-bottom")
  let resizeObserver: ResizeObserver | null = null

  const syncFromBody = (): void => {
    if (body && header && header.scrollLeft !== body.scrollLeft) header.scrollLeft = body.scrollLeft
    const pinnedBottom = resolvePinnedBottom()
    if (body && pinnedBottom && pinnedBottom.scrollLeft !== body.scrollLeft) pinnedBottom.scrollLeft = body.scrollLeft
  }

  const syncFromPinnedBottom = (): void => {
    const pinnedBottom = resolvePinnedBottom()
    if (!pinnedBottom) return
    if (body && body.scrollLeft !== pinnedBottom.scrollLeft) body.scrollLeft = pinnedBottom.scrollLeft
    if (header && header.scrollLeft !== pinnedBottom.scrollLeft) header.scrollLeft = pinnedBottom.scrollLeft
  }

  const syncHeaderWidth = (): void => {
    if (!body) return
    const pinnedLeftWidth = Number.parseFloat(grid.style.getPropertyValue("--affino-grid-dom-pinned-left-width")) || 0
    const pinnedRightWidth = Number.parseFloat(grid.style.getPropertyValue("--affino-grid-dom-pinned-right-width")) || 0
    const width = Math.max(0, body.clientWidth - pinnedLeftWidth - pinnedRightWidth)
    if (width > 0 && grid.style.getPropertyValue("--affino-grid-dom-viewport-width") !== `${width}px`) {
      grid.style.setProperty("--affino-grid-dom-viewport-width", `${width}px`)
    }
    syncFromBody()
  }

  // Match Vue: consume horizontal wheel intent before native/compositor scroll
  // can move the body independently of its separately rendered header.
  const managedWheel = useDataGridManagedWheelScroll({
    resolveBodyViewport: () => body,
    resolveMainViewport: () => body,
    resolveWheelAxisLockMode: () => "horizontal-preferred",
    setHandledScrollTop: value => {
      if (body) body.scrollTop = value
    },
    setHandledScrollLeft: value => {
      if (!body) return
      body.scrollLeft = value
      syncFromBody()
    },
  })

  const onWheel = (event: WheelEvent): void => {
    const deltaX = Number.isFinite(event.deltaX) ? Math.abs(event.deltaX) : 0
    const deltaY = Number.isFinite(event.deltaY) ? Math.abs(event.deltaY) : 0
    if (event.ctrlKey || !event.cancelable || deltaX === 0 || deltaX < deltaY) {
      managedWheel.reset()
      return
    }
    managedWheel.onBodyViewportWheel(event)
  }

  return {
    refresh(): void {
      syncHeaderWidth()
    },
    attach(): void {
      body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")
      header = grid.querySelector<HTMLElement>(".affino-grid-dom__header-viewport")
      body?.addEventListener("scroll", syncFromBody, { passive: true })
      grid.addEventListener("scroll", onGridScroll, { passive: true, capture: true })
      body?.addEventListener("wheel", onWheel, { passive: false })
      header?.addEventListener("wheel", onWheel, { passive: false })
      syncHeaderWidth()
      const ResizeObserverCtor = grid.ownerDocument.defaultView?.ResizeObserver
      if (ResizeObserverCtor && body) {
        resizeObserver = new ResizeObserverCtor(syncHeaderWidth)
        resizeObserver.observe(body)
      }
    },
    detach(): void {
      resizeObserver?.disconnect()
      resizeObserver = null
      body?.removeEventListener("scroll", syncFromBody)
      grid.removeEventListener("scroll", onGridScroll, true)
      body?.removeEventListener("wheel", onWheel)
      header?.removeEventListener("wheel", onWheel)
      managedWheel.reset()
      grid.style.removeProperty("--affino-grid-dom-viewport-width")
      body = null
      header = null
    },
  }

  function onGridScroll(event: Event): void {
    if (event.target === resolvePinnedBottom()) syncFromPinnedBottom()
  }
}
