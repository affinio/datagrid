import type {
  DataGridViewportHostEnvironment,
  DataGridViewportResizeObserver,
} from "./viewportHostEnvironment"

interface ManagedResizeObserver extends DataGridViewportResizeObserver {
  disconnect(): void
}

export function createManagedResizeObserver(
  hostEnvironment: DataGridViewportHostEnvironment,
  callback: () => void,
): DataGridViewportResizeObserver | null {
  const rawObserver = hostEnvironment.createResizeObserver?.(callback)
  if (!rawObserver) {
    return null
  }

  const observedTargets = new Set<Element>()

  const unobserveTarget = (target: Element) => {
    if (!observedTargets.has(target)) {
      return
    }
    hostEnvironment.removeResizeObserverTarget?.(rawObserver, target)
    rawObserver.unobserve?.(target)
    observedTargets.delete(target)
  }

  const adapter: ManagedResizeObserver = {
    observe(target: Element) {
      if (observedTargets.has(target)) {
        return
      }
      observedTargets.add(target)
      rawObserver.observe(target)
    },
    unobserve(target: Element) {
      unobserveTarget(target)
    },
    disconnect() {
      for (const target of observedTargets) {
        hostEnvironment.removeResizeObserverTarget?.(rawObserver, target)
        rawObserver.unobserve?.(target)
      }
      observedTargets.clear()
      rawObserver.disconnect()
    },
  }

  return adapter
}
