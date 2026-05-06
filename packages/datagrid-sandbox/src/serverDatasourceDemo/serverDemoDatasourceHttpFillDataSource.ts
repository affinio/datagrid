import type { DataGridDataSource } from "@affino/datagrid-vue"
import type { ServerDemoRow } from "./types"
import type { ServerDemoHttpDatasource } from "./serverDemoDatasourceHttpAdapter"
import { shouldRefreshHistoryStatusAfterCommit } from "./serverDemoHistoryState"

export interface CreateServerDemoDatasourceHttpFillDataSourceOptions {
  enabled: boolean
  fallbackDataSource: DataGridDataSource<ServerDemoRow>
  httpDatasource: Pick<
    ServerDemoHttpDatasource,
    "resolveFillBoundary" | "commitFillOperation" | "undoFillOperation" | "redoFillOperation"
  > | null
  refreshHistoryStatus?: () => Promise<void> | void
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
      await options.refreshHistoryStatus?.()
      return result
    },
    async redoFillOperation(request) {
      const redoFillOperation = httpDatasource.redoFillOperation
      if (typeof redoFillOperation !== "function") {
        throw new Error("Server demo HTTP adapter does not implement redoFillOperation")
      }
      const result = await redoFillOperation(request)
      await options.refreshHistoryStatus?.()
      return result
    },
  }
}
