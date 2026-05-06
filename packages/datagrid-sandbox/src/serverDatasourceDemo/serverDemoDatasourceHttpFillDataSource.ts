import type { DataGridDataSource } from "@affino/datagrid-vue"
import type { ServerDemoMutationInvalidation, ServerDemoRow } from "./types"
import type {
  ServerDemoFillOperationRequest,
  ServerDemoFillOperationResult,
  ServerDemoUndoFillRequest,
  ServerDemoUndoFillResult,
} from "./types"
import { shouldRefreshHistoryStatusAfterCommit } from "./serverDemoHistoryState"

type ServerDemoHttpFillDatasource = {
  resolveFillBoundary?: NonNullable<DataGridDataSource<ServerDemoRow>["resolveFillBoundary"]>
  commitFillOperation?: (request: ServerDemoFillOperationRequest) => Promise<ServerDemoFillOperationResult>
  undoFillOperation?: (request: ServerDemoUndoFillRequest) => Promise<ServerDemoUndoFillResult>
  redoFillOperation?: (request: ServerDemoUndoFillRequest) => Promise<ServerDemoUndoFillResult>
}

export interface CreateServerDemoDatasourceHttpFillDataSourceOptions {
  enabled: boolean
  fallbackDataSource: DataGridDataSource<ServerDemoRow>
  httpDatasource: ServerDemoHttpFillDatasource | null
  refreshHistoryStatus?: () => Promise<void> | void
  applyInvalidation?: (invalidation: ServerDemoMutationInvalidation | null | undefined) => void | Promise<void>
}

export function createServerDemoDatasourceHttpFillDataSource(
  options: CreateServerDemoDatasourceHttpFillDataSourceOptions,
): DataGridDataSource<ServerDemoRow> {
  if (!options.enabled || !options.httpDatasource) {
    return options.fallbackDataSource
  }

  const { httpDatasource, fallbackDataSource } = options

  return {
    ...fallbackDataSource,
    async resolveFillBoundary(request) {
      const resolveFillBoundary = httpDatasource.resolveFillBoundary
      if (typeof resolveFillBoundary !== "function") {
        throw new Error("Server demo HTTP adapter does not implement resolveFillBoundary")
      }
      return await resolveFillBoundary(request)
    },
    async commitFillOperation(request) {
      const commitFillOperation = httpDatasource.commitFillOperation
      if (typeof commitFillOperation !== "function") {
        throw new Error("Server demo HTTP adapter does not implement commitFillOperation")
      }
      const result = await commitFillOperation(request)
      if (shouldRefreshHistoryStatusAfterCommit(result)) {
        await options.refreshHistoryStatus?.()
      }
      return result
    },
    async undoFillOperation(request) {
      const undoFillOperation = httpDatasource.undoFillOperation
      if (typeof undoFillOperation !== "function") {
        throw new Error("Server demo HTTP adapter does not implement undoFillOperation")
      }
      const result = await undoFillOperation(request)
      await options.applyInvalidation?.(result.serverInvalidation ?? { type: "dataset" })
      await options.refreshHistoryStatus?.()
      return result
    },
    async redoFillOperation(request) {
      const redoFillOperation = httpDatasource.redoFillOperation
      if (typeof redoFillOperation !== "function") {
        throw new Error("Server demo HTTP adapter does not implement redoFillOperation")
      }
      const result = await redoFillOperation(request)
      await options.applyInvalidation?.(result.serverInvalidation ?? { type: "dataset" })
      await options.refreshHistoryStatus?.()
      return result
    },
  }
}
