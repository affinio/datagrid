import type { DataGridDataSource } from "@affino/datagrid-vue"
import type { ServerDemoRow } from "./types"
import type { ServerDemoHttpDatasource } from "./serverDemoDatasourceHttpAdapter"

export interface CreateServerDemoDatasourceHttpFillDataSourceOptions {
  enabled: boolean
  fallbackDataSource: DataGridDataSource<ServerDemoRow>
  httpDatasource: Pick<
    ServerDemoHttpDatasource,
    "resolveFillBoundary" | "commitFillOperation" | "undoFillOperation" | "redoFillOperation"
  > | null
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
      return await commitFillOperation(request)
    },
    async undoFillOperation(request) {
      const undoFillOperation = httpDatasource.undoFillOperation
      if (typeof undoFillOperation !== "function") {
        throw new Error("Server demo HTTP adapter does not implement undoFillOperation")
      }
      return await undoFillOperation(request)
    },
    async redoFillOperation(request) {
      const redoFillOperation = httpDatasource.redoFillOperation
      if (typeof redoFillOperation !== "function") {
        throw new Error("Server demo HTTP adapter does not implement redoFillOperation")
      }
      return await redoFillOperation(request)
    },
  }
}
