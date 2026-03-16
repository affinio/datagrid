/// <reference lib="webworker" />

import {
  createDataGridWorkerOwnedRowModelHost,
  type DataGridWorkerOwnedRowModelHost,
} from "@affino/datagrid-worker"
import type { DataGridRowNodeInput } from "@affino/datagrid-core"

interface DataGridWorkerHostInitMessage<TRow> {
  __datagridWorkerHostInit: true
  rows: readonly DataGridRowNodeInput<TRow>[]
}

function isHostInitMessage<TRow>(value: unknown): value is DataGridWorkerHostInitMessage<TRow> {
  return value !== null
    && typeof value === "object"
    && "__datagridWorkerHostInit" in value
    && (value as { __datagridWorkerHostInit?: unknown }).__datagridWorkerHostInit === true
    && "rows" in value
    && Array.isArray((value as { rows?: unknown }).rows)
}

const workerScope = self as DedicatedWorkerGlobalScope
let host: DataGridWorkerOwnedRowModelHost | null = null
const queuedMessages: MessageEvent[] = []

const bootstrapListener = (event: MessageEvent): void => {
  if (host) {
    return
  }
  if (isHostInitMessage(event.data)) {
    host = createDataGridWorkerOwnedRowModelHost({
      source: workerScope,
      target: workerScope,
      rows: event.data.rows,
    })
    for (const queuedEvent of queuedMessages.splice(0, queuedMessages.length)) {
      workerScope.dispatchEvent(new MessageEvent("message", { data: queuedEvent.data }))
    }
    return
  }
  queuedMessages.push(event)
}

workerScope.addEventListener("message", bootstrapListener)
