// Projection host wiring. This runtime owns the assembly of projection engine,
// handlers and orchestrator so the main row-model host does not construct them inline.
import {
  createClientRowProjectionEngine,
  type DataGridClientProjectionEngine,
} from "../projection/clientRowProjectionEngine.js"
import {
  createClientRowProjectionHandlersRuntime,
  type ClientRowProjectionHandlersRuntime,
  type ClientRowProjectionHandlersRuntimeContext,
} from "../projection/clientRowProjectionHandlersRuntime.js"
import {
  createClientRowProjectionOrchestrator,
  type DataGridClientRowProjectionOrchestrator,
} from "../projection/clientRowProjectionOrchestrator.js"

export interface CreateClientRowProjectionHostRuntimeOptions<T> {
  handlersContext: ClientRowProjectionHandlersRuntimeContext<T>
}

export interface DataGridClientRowProjectionHostRuntime<T> {
  getEngine: () => DataGridClientProjectionEngine<T>
  getHandlersRuntime: () => ClientRowProjectionHandlersRuntime<T>
  getOrchestrator: () => DataGridClientRowProjectionOrchestrator<T>
}

export function createClientRowProjectionHostRuntime<T>(
  options: CreateClientRowProjectionHostRuntimeOptions<T>,
): DataGridClientRowProjectionHostRuntime<T> {
  const projectionEngine = createClientRowProjectionEngine<T>()
  const projectionHandlersRuntime = createClientRowProjectionHandlersRuntime<T>(options.handlersContext)
  const projectionOrchestrator = createClientRowProjectionOrchestrator(
    projectionEngine,
    projectionHandlersRuntime.projectionStageHandlers,
  )

  return {
    getEngine: () => projectionEngine,
    getHandlersRuntime: () => projectionHandlersRuntime,
    getOrchestrator: () => projectionOrchestrator,
  }
}
