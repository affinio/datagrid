export type DataGridDeferredRendererPriority = "visible" | "overscan" | "pinned"

export interface DataGridDeferredRendererQueueEntry {
  key: string
  priority: DataGridDeferredRendererPriority
  render: () => void
}

export interface DataGridDeferredRendererQueue {
  readonly size: number
  enqueue(entry: DataGridDeferredRendererQueueEntry): boolean
  cancel(key: string): boolean
  flush(limit: number): number
  clear(): void
}

const PRIORITY_ORDER: Record<DataGridDeferredRendererPriority, number> = {
  pinned: 0,
  visible: 1,
  overscan: 2,
}

export function createDataGridDeferredRendererQueue(maxPending = 512): DataGridDeferredRendererQueue {
  const capacity = Math.max(1, Math.trunc(maxPending))
  const entries = new Map<string, DataGridDeferredRendererQueueEntry>()

  return {
    get size() {
      return entries.size
    },
    enqueue(entry) {
      if (entries.has(entry.key)) {
        entries.set(entry.key, entry)
        return true
      }
      if (entries.size >= capacity) {
        let worstKey: string | null = null
        let worstPriority = -1
        for (const [key, candidate] of entries) {
          const priority = PRIORITY_ORDER[candidate.priority]
          if (priority > worstPriority) {
            worstPriority = priority
            worstKey = key
          }
        }
        if (worstKey == null || PRIORITY_ORDER[entry.priority] >= worstPriority) {
          return false
        }
        entries.delete(worstKey)
      }
      entries.set(entry.key, entry)
      return true
    },
    cancel(key) {
      return entries.delete(key)
    },
    flush(limit) {
      const count = Math.max(0, Math.trunc(limit))
      if (count === 0 || entries.size === 0) return 0
      const batch = [...entries.values()]
        .sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority])
        .slice(0, count)
      for (const entry of batch) {
        entries.delete(entry.key)
        entry.render()
      }
      return batch.length
    },
    clear() {
      entries.clear()
    },
  }
}
