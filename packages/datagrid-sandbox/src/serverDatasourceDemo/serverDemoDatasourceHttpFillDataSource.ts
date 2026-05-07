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
  applyRowSnapshots?: (rows: readonly ServerDemoRow[]) => void | Promise<void>
  applyInvalidation?: (invalidation: ServerDemoMutationInvalidation | null | undefined) => void | Promise<void>
}

export function createServerDemoDatasourceHttpFillDataSource(
  options: CreateServerDemoDatasourceHttpFillDataSourceOptions,
): DataGridDataSource<ServerDemoRow> {
  if (!options.enabled || !options.httpDatasource) {
    return options.fallbackDataSource
  }

  const { httpDatasource, fallbackDataSource } = options
  const resolveFillBoundary = httpDatasource.resolveFillBoundary
  const commitFillOperation = httpDatasource.commitFillOperation
  const undoFillOperation = httpDatasource.undoFillOperation
  const redoFillOperation = httpDatasource.redoFillOperation

  if (
    typeof resolveFillBoundary !== "function"
    && typeof commitFillOperation !== "function"
    && typeof undoFillOperation !== "function"
    && typeof redoFillOperation !== "function"
  ) {
    return fallbackDataSource
  }

  return {
    ...fallbackDataSource,
    async resolveFillBoundary(request) {
      if (typeof resolveFillBoundary !== "function") {
        if (typeof fallbackDataSource.resolveFillBoundary === "function") {
          return await fallbackDataSource.resolveFillBoundary(request)
        }
        throw new Error("Server demo HTTP adapter does not implement resolveFillBoundary")
      }
      return await resolveFillBoundary(request)
    },
    async commitFillOperation(request) {
      if (typeof commitFillOperation !== "function") {
        if (typeof fallbackDataSource.commitFillOperation === "function") {
          return await fallbackDataSource.commitFillOperation(request)
        }
        throw new Error("Server demo HTTP adapter does not implement commitFillOperation")
      }
      const result = await commitFillOperation(request)
      if (shouldRefreshHistoryStatusAfterCommit(result)) {
        await options.refreshHistoryStatus?.()
      }
      return result
    },
    async undoFillOperation(request) {
      if (typeof undoFillOperation !== "function") {
        if (typeof fallbackDataSource.undoFillOperation === "function") {
          return await fallbackDataSource.undoFillOperation(request)
        }
        throw new Error("Server demo HTTP adapter does not implement undoFillOperation")
      }
      const result = await undoFillOperation(request)
      if (Array.isArray(result.rows) && result.rows.length > 0 && options.applyRowSnapshots) {
        await options.applyRowSnapshots(result.rows)
      } else {
        await options.applyInvalidation?.(result.serverInvalidation ?? { type: "dataset" })
      }
      await options.refreshHistoryStatus?.()
      return result
    },
    async redoFillOperation(request) {
      if (typeof redoFillOperation !== "function") {
        if (typeof fallbackDataSource.redoFillOperation === "function") {
          return await fallbackDataSource.redoFillOperation(request)
        }
        throw new Error("Server demo HTTP adapter does not implement redoFillOperation")
      }
      const result = await redoFillOperation(request)
      if (Array.isArray(result.rows) && result.rows.length > 0 && options.applyRowSnapshots) {
        await options.applyRowSnapshots(result.rows)
      } else {
        await options.applyInvalidation?.(result.serverInvalidation ?? { type: "dataset" })
      }
      await options.refreshHistoryStatus?.()
      return result
    },
  }
}
