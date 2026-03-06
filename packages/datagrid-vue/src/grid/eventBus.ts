import type { GridEventHandler } from "./types"

export interface GridEventBus {
  on(event: string, handler: GridEventHandler): () => void
  off(event: string, handler: GridEventHandler): void
  emit(event: string, payload?: unknown): void
  clear(): void
}

export function createGridEventBus(): GridEventBus {
  const handlersByEvent = new Map<string, Set<GridEventHandler>>()

  const off = (event: string, handler: GridEventHandler): void => {
    const handlers = handlersByEvent.get(event)
    if (!handlers) {
      return
    }
    handlers.delete(handler)
    if (handlers.size === 0) {
      handlersByEvent.delete(event)
    }
  }

  const on = (event: string, handler: GridEventHandler): (() => void) => {
    const handlers = handlersByEvent.get(event) ?? new Set<GridEventHandler>()
    handlers.add(handler)
    handlersByEvent.set(event, handlers)
    return () => {
      off(event, handler)
    }
  }

  const emit = (event: string, payload?: unknown): void => {
    const handlers = handlersByEvent.get(event)
    if (!handlers || handlers.size === 0) {
      return
    }
    for (const handler of handlers) {
      handler(payload)
    }
  }

  const clear = (): void => {
    handlersByEvent.clear()
  }

  return {
    on,
    off,
    emit,
    clear,
  }
}
