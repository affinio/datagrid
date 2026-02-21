import type {
  DataGridRowModelListener,
  DataGridRowModelSnapshot,
} from "./rowModel.js"

export interface DataGridClientRowLifecycle<T> {
  ensureActive: () => void
  emit: (getSnapshot: () => DataGridRowModelSnapshot<T>) => void
  subscribe: (listener: DataGridRowModelListener<T>) => () => void
  dispose: () => boolean
  isDisposed: () => boolean
}

export function createClientRowLifecycle<T>(): DataGridClientRowLifecycle<T> {
  let disposed = false
  const listeners = new Set<DataGridRowModelListener<T>>()

  return {
    ensureActive: () => {
      if (disposed) {
        throw new Error("ClientRowModel has been disposed")
      }
    },
    emit: (getSnapshot: () => DataGridRowModelSnapshot<T>) => {
      if (disposed || listeners.size === 0) {
        return
      }
      const snapshot = getSnapshot()
      for (const listener of listeners) {
        listener(snapshot)
      }
    },
    subscribe: (listener: DataGridRowModelListener<T>) => {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose: () => {
      if (disposed) {
        return false
      }
      disposed = true
      listeners.clear()
      return true
    },
    isDisposed: () => disposed,
  }
}
