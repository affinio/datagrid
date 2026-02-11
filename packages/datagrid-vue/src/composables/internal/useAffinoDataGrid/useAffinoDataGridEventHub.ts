import { ref } from "vue"
import {
  createDataGridEventEnvelope,
  type DataGridEventTier,
  type DataGridEventSource,
  type DataGridEventPhase,
} from "@affino/datagrid-core"
import type {
  AffinoDataGridEventListener,
  AffinoDataGridEventRecord,
  AffinoDataGridEmitEventInput,
} from "../../useAffinoDataGrid.types"

export interface UseAffinoDataGridEventHubOptions {
  maxEvents: number
}

export interface UseAffinoDataGridEventHubResult {
  enabled: ReturnType<typeof ref<boolean>>
  last: ReturnType<typeof ref<AffinoDataGridEventRecord | null>>
  log: ReturnType<typeof ref<readonly AffinoDataGridEventRecord[]>>
  on: (name: string | "*", listener: AffinoDataGridEventListener) => () => void
  off: (name: string | "*", listener: AffinoDataGridEventListener) => void
  emit: (input: AffinoDataGridEmitEventInput) => AffinoDataGridEventRecord | null
  clear: () => void
}

function createListenerRegistry() {
  const named = new Map<string, Set<AffinoDataGridEventListener>>()
  const wildcard = new Set<AffinoDataGridEventListener>()

  const on = (name: string | "*", listener: AffinoDataGridEventListener): (() => void) => {
    if (name === "*") {
      wildcard.add(listener)
      return () => {
        wildcard.delete(listener)
      }
    }
    const listeners = named.get(name) ?? new Set<AffinoDataGridEventListener>()
    listeners.add(listener)
    named.set(name, listeners)
    return () => {
      const current = named.get(name)
      if (!current) {
        return
      }
      current.delete(listener)
      if (current.size === 0) {
        named.delete(name)
      }
    }
  }

  const off = (name: string | "*", listener: AffinoDataGridEventListener): void => {
    if (name === "*") {
      wildcard.delete(listener)
      return
    }
    const listeners = named.get(name)
    if (!listeners) {
      return
    }
    listeners.delete(listener)
    if (listeners.size === 0) {
      named.delete(name)
    }
  }

  const notify = (event: AffinoDataGridEventRecord): void => {
    const listeners = named.get(event.name)
    if (listeners) {
      for (const listener of listeners) {
        listener(event)
      }
    }
    for (const listener of wildcard) {
      listener(event)
    }
  }

  return {
    on,
    off,
    notify,
  }
}

export function useAffinoDataGridEventHub(
  options: UseAffinoDataGridEventHubOptions,
): UseAffinoDataGridEventHubResult {
  const enabled = ref(true)
  const last = ref<AffinoDataGridEventRecord | null>(null)
  const log = ref<readonly AffinoDataGridEventRecord[]>([])
  const registry = createListenerRegistry()
  const maxEvents = Number.isFinite(options.maxEvents)
    ? Math.max(10, Math.trunc(options.maxEvents))
    : 200
  let nextEventId = 1

  const emit = (input: {
    tier: DataGridEventTier
    name: string
    args: readonly unknown[]
    source: DataGridEventSource
    phase: DataGridEventPhase
    reason?: string
    affected?: {
      rowStart?: number
      rowEnd?: number
      columnStart?: number
      columnEnd?: number
    }
  }): AffinoDataGridEventRecord | null => {
    if (!enabled.value) {
      return null
    }
    const envelope = createDataGridEventEnvelope({
      tier: input.tier,
      name: input.name,
      args: input.args,
      source: input.source,
      phase: input.phase,
      reason: input.reason,
      affected: input.affected,
      timestampMs: Date.now(),
    })
    const event: AffinoDataGridEventRecord = {
      id: nextEventId++,
      ...envelope,
    }
    last.value = event
    const nextLog = [...log.value, event]
    log.value = nextLog.length > maxEvents
      ? nextLog.slice(nextLog.length - maxEvents)
      : nextLog
    registry.notify(event)
    return event
  }

  const clear = (): void => {
    log.value = []
  }

  return {
    enabled,
    last,
    log,
    on: registry.on,
    off: registry.off,
    emit,
    clear,
  }
}
