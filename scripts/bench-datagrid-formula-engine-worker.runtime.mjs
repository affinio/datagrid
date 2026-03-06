#!/usr/bin/env node

import { parentPort, workerData } from "node:worker_threads"

if (!parentPort) {
  throw new Error("[formula-worker-runtime] parentPort is unavailable")
}

const workerModuleUrl = workerData?.workerModuleUrl
if (typeof workerModuleUrl !== "string" || workerModuleUrl.length === 0) {
  throw new Error("[formula-worker-runtime] workerModuleUrl is required")
}

const workerModule = await import(workerModuleUrl)
if (typeof workerModule.createDataGridWorkerOwnedRowModelHost !== "function") {
  throw new Error("[formula-worker-runtime] datagrid-worker export createDataGridWorkerOwnedRowModelHost is missing")
}

const createDataGridWorkerOwnedRowModelHost = workerModule.createDataGridWorkerOwnedRowModelHost

const listeners = new Set()

const source = {
  addEventListener(type, listener) {
    if (type !== "message") {
      return
    }
    listeners.add(listener)
  },
  removeEventListener(type, listener) {
    if (type !== "message") {
      return
    }
    listeners.delete(listener)
  },
}

const target = {
  postMessage(message) {
    parentPort.postMessage(message)
  },
}

let host = null

function broadcast(message) {
  for (const listener of listeners) {
    try {
      listener({ data: message })
    } catch {
      // Keep worker event loop alive even if consumer listener throws.
    }
  }
}

function isControlMessage(message) {
  return Boolean(
    message
      && typeof message === "object"
      && message.__benchFormulaWorkerControl === true,
  )
}

function sendControlResponse(id, ok, payload) {
  parentPort.postMessage({
    __benchFormulaWorkerControl: true,
    id,
    ok,
    ...(payload ? { payload } : {}),
  })
}

async function handleControlMessage(message) {
  const id = Number(message?.id)
  const type = String(message?.type ?? "")
  try {
    if (type === "init") {
      if (host) {
        host.dispose()
      }
      const payload = message?.payload && typeof message.payload === "object"
        ? message.payload
        : {}
      host = createDataGridWorkerOwnedRowModelHost({
        ...payload,
        source,
        target,
      })
      sendControlResponse(id, true)
      return
    }

    if (type === "dispose") {
      if (host) {
        host.dispose()
        host = null
      }
      sendControlResponse(id, true)
      return
    }

    if (type === "ping") {
      sendControlResponse(id, true)
      return
    }

    throw new Error(`unsupported control message type '${type}'`)
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error)
    sendControlResponse(id, false, { error: messageText })
  }
}

parentPort.on("message", (message) => {
  if (isControlMessage(message)) {
    void handleControlMessage(message)
    return
  }
  broadcast(message)
})

process.on("exit", () => {
  if (host) {
    host.dispose()
    host = null
  }
})
