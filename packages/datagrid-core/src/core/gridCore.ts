import type { DataGridColumnModel, DataGridEditModel, DataGridRowModel, DataGridViewportRange } from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type {
  DataGridTransactionInput,
  DataGridTransactionSnapshot,
} from "./transactionService"

export type DataGridCoreServiceName =
  | "event"
  | "rowModel"
  | "columnModel"
  | "edit"
  | "transaction"
  | "selection"
  | "viewport"

export type DataGridCoreLifecycleState =
  | "idle"
  | "initialized"
  | "started"
  | "stopped"
  | "disposed"

export interface DataGridCoreService {
  readonly name: DataGridCoreServiceName
  init?(context: DataGridCoreServiceContext): void | Promise<void>
  start?(context: DataGridCoreServiceContext): void | Promise<void>
  stop?(context: DataGridCoreServiceContext): void | Promise<void>
  dispose?(context: DataGridCoreServiceContext): void | Promise<void>
}

export interface DataGridCoreEventService extends DataGridCoreService {
  readonly name: "event"
}

export interface DataGridCoreRowModelService<TRow = any> extends DataGridCoreService {
  readonly name: "rowModel"
  model?: DataGridRowModel<TRow>
}

export interface DataGridCoreColumnModelService extends DataGridCoreService {
  readonly name: "columnModel"
  model?: DataGridColumnModel
}

export interface DataGridCoreEditService extends DataGridCoreService {
  readonly name: "edit"
  model?: DataGridEditModel
}

export interface DataGridCoreTransactionService extends DataGridCoreService {
  readonly name: "transaction"
  getTransactionSnapshot?(): DataGridTransactionSnapshot
  beginTransactionBatch?(label?: string): string
  commitTransactionBatch?(batchId?: string): Promise<readonly string[]>
  rollbackTransactionBatch?(batchId?: string): readonly string[]
  applyTransaction?(transaction: DataGridTransactionInput): Promise<string>
  canUndoTransaction?(): boolean
  canRedoTransaction?(): boolean
  undoTransaction?(): Promise<string | null>
  redoTransaction?(): Promise<string | null>
}

export interface DataGridCoreSelectionService extends DataGridCoreService {
  readonly name: "selection"
  getSelectionSnapshot?(): DataGridSelectionSnapshot | null
  setSelectionSnapshot?(snapshot: DataGridSelectionSnapshot): void
  clearSelection?(): void
}

export interface DataGridCoreViewportService extends DataGridCoreService {
  readonly name: "viewport"
  getViewportRange?(): DataGridViewportRange
  setViewportRange?(range: DataGridViewportRange): void
}

export interface DataGridCoreServiceByName {
  event: DataGridCoreEventService
  rowModel: DataGridCoreRowModelService<any>
  columnModel: DataGridCoreColumnModelService
  edit: DataGridCoreEditService
  transaction: DataGridCoreTransactionService
  selection: DataGridCoreSelectionService
  viewport: DataGridCoreViewportService
}

export type DataGridCoreServiceRegistry = DataGridCoreServiceByName

export interface DataGridCoreServiceContext {
  readonly state: DataGridCoreLifecycleState
  getService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName]
}

export interface CreateDataGridCoreOptions {
  services?: Partial<DataGridCoreServiceRegistry>
  startupOrder?: readonly DataGridCoreServiceName[]
}

export interface DataGridCore {
  readonly lifecycle: {
    readonly state: DataGridCoreLifecycleState
    readonly startupOrder: readonly DataGridCoreServiceName[]
  }
  readonly services: DataGridCoreServiceRegistry
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
  getService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName]
}

const CANONICAL_STARTUP_ORDER: readonly DataGridCoreServiceName[] = [
  "event",
  "rowModel",
  "columnModel",
  "edit",
  "transaction",
  "selection",
  "viewport",
]

function createNoopService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName] {
  return { name } as DataGridCoreServiceByName[TName]
}

function resolveStartupOrder(order: readonly DataGridCoreServiceName[] | undefined): DataGridCoreServiceName[] {
  if (!Array.isArray(order) || order.length === 0) {
    return [...CANONICAL_STARTUP_ORDER]
  }

  const seen = new Set<DataGridCoreServiceName>()
  const resolved: DataGridCoreServiceName[] = []
  for (const name of order) {
    if (!CANONICAL_STARTUP_ORDER.includes(name) || seen.has(name)) {
      continue
    }
    seen.add(name)
    resolved.push(name)
  }

  for (const name of CANONICAL_STARTUP_ORDER) {
    if (seen.has(name)) {
      continue
    }
    seen.add(name)
    resolved.push(name)
  }

  return resolved
}

function resolveServices(services: Partial<DataGridCoreServiceRegistry> | undefined): DataGridCoreServiceRegistry {
  const resolved = {} as Record<DataGridCoreServiceName, DataGridCoreService>
  for (const name of CANONICAL_STARTUP_ORDER) {
    const candidate = services?.[name]
    if (!candidate) {
      resolved[name] = createNoopService(name)
      continue
    }
    if (candidate.name !== name) {
      throw new Error(`[DataGridCore] service key "${name}" must match service.name "${candidate.name}".`)
    }
    resolved[name] = candidate as DataGridCoreServiceByName[typeof name]
  }
  return resolved as DataGridCoreServiceRegistry
}

export function createDataGridCore(options: CreateDataGridCoreOptions = {}): DataGridCore {
  const services = resolveServices(options.services)
  const startupOrder = resolveStartupOrder(options.startupOrder)
  let state: DataGridCoreLifecycleState = "idle"

  const context: DataGridCoreServiceContext = {
    get state() {
      return state
    },
    getService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName] {
      return services[name]
    },
  }

  async function runInOrder(
    method: "init" | "start",
    order: readonly DataGridCoreServiceName[],
  ): Promise<void> {
    for (const name of order) {
      const service = services[name]
      const handler = (service as DataGridCoreService)[method]
      if (!handler) {
        continue
      }
      await handler(context)
    }
  }

  async function runInReverseOrder(
    method: "stop" | "dispose",
    order: readonly DataGridCoreServiceName[],
  ): Promise<void> {
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const service = services[order[index] as DataGridCoreServiceName]
      const handler = (service as DataGridCoreService)[method]
      if (!handler) {
        continue
      }
      await handler(context)
    }
  }

  async function initCore(): Promise<void> {
    if (state === "disposed") {
      throw new Error("[DataGridCore] cannot init disposed core.")
    }
    if (state === "initialized" || state === "started" || state === "stopped") {
      return
    }
    await runInOrder("init", startupOrder)
    state = "initialized"
  }

  async function startCore(): Promise<void> {
    if (state === "disposed") {
      throw new Error("[DataGridCore] cannot start disposed core.")
    }
    if (state === "started") {
      return
    }
    await initCore()
    await runInOrder("start", startupOrder)
    state = "started"
  }

  async function stopCore(): Promise<void> {
    if (state === "disposed" || state === "idle" || state === "stopped") {
      return
    }
    await runInReverseOrder("stop", startupOrder)
    state = "stopped"
  }

  async function disposeCore(): Promise<void> {
    if (state === "disposed") {
      return
    }
    await stopCore()
    await runInReverseOrder("dispose", startupOrder)
    state = "disposed"
  }

  return {
    lifecycle: {
      get state() {
        return state
      },
      startupOrder,
    },
    services,
    init: initCore,
    start: startCore,
    stop: stopCore,
    dispose: disposeCore,
    getService<TName extends DataGridCoreServiceName>(name: TName): DataGridCoreServiceByName[TName] {
      return services[name]
    },
  }
}
