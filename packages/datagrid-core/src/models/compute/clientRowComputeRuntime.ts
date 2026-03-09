import type { DataGridClientProjectionRecomputeOptions } from "../projection/clientRowProjectionEngine.js"
import type {
  DataGridClientProjectionStagePlan,
  DataGridClientRowProjectionOrchestrator,
} from "../projection/clientRowProjectionOrchestrator.js"
import type { DataGridClientProjectionStage } from "../projection/projectionStages.js"
import type { DataGridPatchProjectionExecutionPlan } from "../mutation/rowPatchAnalyzer.js"

export type DataGridClientComputeMode = "sync" | "worker"
export type DataGridClientComputeStagePlan = DataGridClientProjectionStagePlan

export interface DataGridClientComputeExecutionPlanRequestOptions {
  patchChangedRowCount?: number
}

export type DataGridClientComputeRequest =
  | {
    kind: "recompute-from-stage"
    stage: DataGridClientProjectionStage
    options?: DataGridClientProjectionRecomputeOptions
  }
  | {
    kind: "recompute-with-stage-plan"
    plan: DataGridClientComputeStagePlan
  }
  | {
    kind: "recompute-with-execution-plan"
    plan: DataGridPatchProjectionExecutionPlan
    options?: DataGridClientComputeExecutionPlanRequestOptions
  }
  | {
    kind: "refresh"
  }

export interface DataGridClientComputeTransportResult {
  handled?: boolean
}

export interface DataGridClientComputeTransport {
  dispatch: (request: DataGridClientComputeRequest) => DataGridClientComputeTransportResult | null | undefined
  dispose?: () => void
}

export interface DataGridClientComputeDiagnostics {
  configuredMode: DataGridClientComputeMode
  effectiveMode: DataGridClientComputeMode
  transportKind: "none" | "loopback" | "custom"
  dispatchCount: number
  fallbackCount: number
}

export interface DataGridClientComputeRuntime {
  recomputeFromStage: (
    stage: DataGridClientProjectionStage,
    options?: DataGridClientProjectionRecomputeOptions,
  ) => void
  recomputeWithExecutionPlan: (
    plan: DataGridPatchProjectionExecutionPlan,
    options?: DataGridClientComputeExecutionPlanRequestOptions,
  ) => void
  recomputeWithStagePlan: (
    plan: DataGridClientComputeStagePlan,
  ) => void
  refresh: () => void
  getStaleStages: () => readonly DataGridClientProjectionStage[]
  getDiagnostics: () => DataGridClientComputeDiagnostics
  dispose: () => void
}

export interface CreateClientRowComputeRuntimeOptions<T> {
  mode?: DataGridClientComputeMode
  orchestrator: DataGridClientRowProjectionOrchestrator<T>
  transport?: DataGridClientComputeTransport | null
  workerPatchDispatchThreshold?: number | null
}

function createLoopbackComputeTransport<T>(
  orchestrator: DataGridClientRowProjectionOrchestrator<T>,
): DataGridClientComputeTransport {
  return {
    dispatch: (request: DataGridClientComputeRequest): DataGridClientComputeTransportResult => {
      if (request.kind === "recompute-from-stage") {
        orchestrator.recomputeFromStage(request.stage, request.options)
        return { handled: true }
      }
      if (request.kind === "recompute-with-stage-plan") {
        orchestrator.recomputeWithStagePlan(request.plan)
        return { handled: true }
      }
      if (request.kind === "recompute-with-execution-plan") {
        orchestrator.recomputeWithExecutionPlan(request.plan)
        return { handled: true }
      }
      orchestrator.refresh()
      return { handled: true }
    },
  }
}

export function createClientRowComputeRuntime<T>(
  options: CreateClientRowComputeRuntimeOptions<T>,
): DataGridClientComputeRuntime {
  const orchestrator = options.orchestrator
  const configuredMode: DataGridClientComputeMode = options.mode ?? "sync"
  const customTransport = options.transport ?? null
  const transport = configuredMode === "worker"
    ? (customTransport ?? createLoopbackComputeTransport(orchestrator))
    : null
  const effectiveMode: DataGridClientComputeMode = configuredMode === "worker" ? "worker" : "sync"
  const transportKind: DataGridClientComputeDiagnostics["transportKind"] = configuredMode !== "worker"
    ? "none"
    : (customTransport ? "custom" : "loopback")

  let dispatchCount = 0
  let fallbackCount = 0
  const workerPatchDispatchThreshold = (
    typeof options.workerPatchDispatchThreshold === "number"
    && Number.isFinite(options.workerPatchDispatchThreshold)
    && options.workerPatchDispatchThreshold > 0
  )
    ? Math.max(1, Math.trunc(options.workerPatchDispatchThreshold))
    : 64

  const runSynchronous = (request: DataGridClientComputeRequest): void => {
    if (request.kind === "recompute-from-stage") {
      orchestrator.recomputeFromStage(request.stage, request.options)
      return
    }
    if (request.kind === "recompute-with-stage-plan") {
      orchestrator.recomputeWithStagePlan(request.plan)
      return
    }
    if (request.kind === "recompute-with-execution-plan") {
      orchestrator.recomputeWithExecutionPlan(request.plan)
      return
    }
    orchestrator.refresh()
  }

  const run = (request: DataGridClientComputeRequest): void => {
    const shouldBypassTransport = (
      request.kind === "recompute-with-execution-plan"
      && typeof request.options?.patchChangedRowCount === "number"
      && request.options.patchChangedRowCount >= 0
      && request.options.patchChangedRowCount <= workerPatchDispatchThreshold
    )
    if (!transport || shouldBypassTransport) {
      runSynchronous(request)
      return
    }
    dispatchCount += 1
    const result = transport.dispatch(request)
    if (result?.handled === true) {
      return
    }
    fallbackCount += 1
    runSynchronous(request)
  }

  return {
    recomputeFromStage: (
      stage: DataGridClientProjectionStage,
      options: DataGridClientProjectionRecomputeOptions = {},
    ) => {
      run({
        kind: "recompute-from-stage",
        stage,
        options,
      })
    },
    recomputeWithExecutionPlan: (
      plan: DataGridPatchProjectionExecutionPlan,
      requestOptions?: DataGridClientComputeExecutionPlanRequestOptions,
    ): void => {
      run({
        kind: "recompute-with-execution-plan",
        plan,
        options: requestOptions,
      })
    },
    recomputeWithStagePlan: (plan: DataGridClientComputeStagePlan): void => {
      run({
        kind: "recompute-with-stage-plan",
        plan,
      })
    },
    refresh: (): void => {
      run({ kind: "refresh" })
    },
    getStaleStages: (): readonly DataGridClientProjectionStage[] => orchestrator.getStaleStages(),
    getDiagnostics: (): DataGridClientComputeDiagnostics => ({
      configuredMode,
      effectiveMode,
      transportKind,
      dispatchCount,
      fallbackCount,
    }),
    dispose: (): void => {
      transport?.dispose?.()
    },
  }
}
