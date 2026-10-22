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

const PRIORITIES: readonly DataGridDeferredRendererPriority[] = ["pinned", "visible", "overscan"]

export function createDataGridDeferredRendererQueue(maxPending = 512): DataGridDeferredRendererQueue {
  const capacity = Math.max(1, Math.trunc(maxPending))
  const entries = new Map<string, DataGridDeferredRendererQueueEntry>()
  const buckets: Record<DataGridDeferredRendererPriority, Set<string>> = {
    pinned: new Set(),
    visible: new Set(),
    overscan: new Set(),
  }

  const remove = (key: string) => {
    const entry = entries.get(key)
    if (entry == null) return false
    entries.delete(key)
    buckets[entry.priority].delete(key)
    return true
  }

  return {
    get size() {
      return entries.size
    },
    enqueue(entry) {
      if (entries.has(entry.key)) {
        remove(entry.key)
        entries.set(entry.key, entry)
        buckets[entry.priority].add(entry.key)
        return true
      }
      if (entries.size >= capacity) {
        const worstBucket = [...PRIORITIES].reverse().find(priority => buckets[priority].size > 0)
        if (worstBucket == null || PRIORITIES.indexOf(entry.priority) >= PRIORITIES.indexOf(worstBucket)) {
          return false
        }
        const worstKey = buckets[worstBucket].values().next().value as string | undefined
        if (worstKey != null) remove(worstKey)
      }
      entries.set(entry.key, entry)
      buckets[entry.priority].add(entry.key)
      return true
    },
    cancel(key) {
      return remove(key)
    },
    flush(limit) {
      const count = Math.max(0, Math.trunc(limit))
      if (count === 0 || entries.size === 0) return 0
      let flushed = 0
      for (const priority of PRIORITIES) {
        for (const key of buckets[priority]) {
          if (flushed >= count) return flushed
          const entry = entries.get(key)
          remove(key)
          entry?.render()
          flushed += 1
        }
      }
      return flushed
    },
    clear() {
      entries.clear()
      for (const bucket of Object.values(buckets)) bucket.clear()
    },
  }
}
