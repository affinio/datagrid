export type DataGridCoreServiceName =
  | "event"
  | "rowModel"
  | "columnModel"
  | "selection"
  | "viewport"

export type DataGridCoreLifecycleState =
  | "idle"
  | "initialized"
  | "started"
  | "stopped"
  | "disposed"

export interface DataGridCoreServiceContext {
  readonly state: DataGridCoreLifecycleState
  getService(name: DataGridCoreServiceName): DataGridCoreService
}

export interface DataGridCoreService {
  readonly name: DataGridCoreServiceName
  init?(context: DataGridCoreServiceContext): void | Promise<void>
  start?(context: DataGridCoreServiceContext): void | Promise<void>
  stop?(context: DataGridCoreServiceContext): void | Promise<void>
  dispose?(context: DataGridCoreServiceContext): void | Promise<void>
}

export type DataGridCoreServiceRegistry = Record<DataGridCoreServiceName, DataGridCoreService>

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
  getService(name: DataGridCoreServiceName): DataGridCoreService
}

const CANONICAL_STARTUP_ORDER: readonly DataGridCoreServiceName[] = [
  "event",
  "rowModel",
  "columnModel",
  "selection",
  "viewport",
]

function createNoopService(name: DataGridCoreServiceName): DataGridCoreService {
  return { name }
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
  const resolved = {} as DataGridCoreServiceRegistry
  for (const name of CANONICAL_STARTUP_ORDER) {
    const candidate = services?.[name]
    if (!candidate) {
      resolved[name] = createNoopService(name)
      continue
    }
    if (candidate.name !== name) {
      throw new Error(`[DataGridCore] service key "${name}" must match service.name "${candidate.name}".`)
    }
    resolved[name] = candidate
  }
  return resolved
}

export function createDataGridCore(options: CreateDataGridCoreOptions = {}): DataGridCore {
  const services = resolveServices(options.services)
  const startupOrder = resolveStartupOrder(options.startupOrder)
  let state: DataGridCoreLifecycleState = "idle"

  const context: DataGridCoreServiceContext = {
    get state() {
      return state
    },
    getService(name: DataGridCoreServiceName): DataGridCoreService {
      return services[name]
    },
  }

  async function runInOrder(
    method: "init" | "start",
    order: readonly DataGridCoreServiceName[],
  ): Promise<void> {
    for (const name of order) {
      const service = services[name]
      const handler = service[method]
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
      const handler = service[method]
      if (!handler) {
        continue
      }
      await handler(context)
    }
  }

  return {
    lifecycle: {
      get state() {
        return state
      },
      startupOrder,
    },
    services,
    async init() {
      if (state === "disposed") {
        throw new Error("[DataGridCore] cannot init disposed core.")
      }
      if (state === "initialized" || state === "started" || state === "stopped") {
        return
      }
      await runInOrder("init", startupOrder)
      state = "initialized"
    },
    async start() {
      if (state === "disposed") {
        throw new Error("[DataGridCore] cannot start disposed core.")
      }
      if (state === "started") {
        return
      }
      await this.init()
      await runInOrder("start", startupOrder)
      state = "started"
    },
    async stop() {
      if (state === "disposed" || state === "idle" || state === "stopped") {
        return
      }
      await runInReverseOrder("stop", startupOrder)
      state = "stopped"
    },
    async dispose() {
      if (state === "disposed") {
        return
      }
      await this.stop()
      await runInReverseOrder("dispose", startupOrder)
      state = "disposed"
    },
    getService(name: DataGridCoreServiceName): DataGridCoreService {
      return services[name]
    },
  }
}
