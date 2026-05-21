export type DataSourceRuntimeLifecyclePhase =
  | "created"
  | "initialized"
  | "attached"
  | "suspended"
  | "disposed"

export interface DataSourceRuntimeLifecycleSnapshot {
  readonly service: string
  readonly phase: DataSourceRuntimeLifecyclePhase
}

export interface DataSourceRuntimeLifecycle {
  readonly service: string
  init(): void
  attach(): void
  suspend(): boolean
  resume(): boolean
  dispose(): void
  getLifecycleSnapshot(): DataSourceRuntimeLifecycleSnapshot
  isSuspended(): boolean
  isDisposed(): boolean
}

export interface DataSourceRuntimeLifecycleOptions {
  service: string
  onInit?: () => void
  onAttach?: () => void
  onSuspend?: () => void
  onResume?: () => void
  onDispose?: () => void
}

export function createDataSourceRuntimeLifecycle(
  options: DataSourceRuntimeLifecycleOptions,
): DataSourceRuntimeLifecycle {
  let phase: DataSourceRuntimeLifecyclePhase = "created"

  function isDisposed(): boolean {
    return phase === "disposed"
  }

  return {
    service: options.service,
    init() {
      if (isDisposed() || phase !== "created") {
        return
      }
      options.onInit?.()
      phase = "initialized"
    },
    attach() {
      if (isDisposed() || phase === "attached" || phase === "suspended") {
        return
      }
      if (phase === "created") {
        options.onInit?.()
        phase = "initialized"
      }
      options.onAttach?.()
      phase = "attached"
    },
    suspend() {
      if (isDisposed() || phase !== "attached") {
        return false
      }

      options.onSuspend?.()
      phase = "suspended"
      return true
    },
    resume() {
      if (isDisposed() || phase !== "suspended") {
        return false
      }
      options.onResume?.()
      phase = "attached"
      return true
    },
    dispose() {
      if (isDisposed()) {
        return
      }
      options.onDispose?.()
      phase = "disposed"
    },
    getLifecycleSnapshot() {
      return {
        service: options.service,
        phase,
      }
    },
    isSuspended() {
      return phase === "suspended"
    },
    isDisposed,
  }
}
