import type {
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridFilterCellStyleReader,
  DataGridRowNode,
} from "../rowModel.js"
import { buildColumnHistogram } from "./clientRowProjectionPrimitives.js"

export interface CreateClientRowColumnHistogramRuntimeOptions<T> {
  ensureActive: () => void
  getBaseSourceRows: () => readonly DataGridRowNode<T>[]
  getFilteredRowsProjection: () => readonly DataGridRowNode<T>[]
  readProjectionRowField: (rowNode: DataGridRowNode<T>, key: string, field?: string) => unknown
  readFilterCell?: (rowNode: DataGridRowNode<T>, columnKey: string) => unknown
  readFilterCellStyle?: DataGridFilterCellStyleReader<T>
  resolveFilterPredicate: (options?: { ignoreColumnFilterKey?: string }) => (row: DataGridRowNode<T>) => boolean
  getCacheKey?: () => string
}

export interface ClientRowColumnHistogramRuntime {
  getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
}

export function createClientRowColumnHistogramRuntime<T>(
  options: CreateClientRowColumnHistogramRuntimeOptions<T>,
): ClientRowColumnHistogramRuntime {
  const cache = new Map<string, DataGridColumnHistogram>()
  const cacheLimit = 32

  const storeResult = (key: string, result: DataGridColumnHistogram): DataGridColumnHistogram => {
    cache.set(key, result)
    if (cache.size > cacheLimit) {
      cache.delete(cache.keys().next().value as string)
    }
    return result
  }

  const buildHistogram = (
    rows: readonly DataGridRowNode<T>[],
    columnId: string,
    histogramOptions?: DataGridColumnHistogramOptions,
  ): DataGridColumnHistogram => {
    return buildColumnHistogram(rows, columnId, histogramOptions, {
      readField: options.readProjectionRowField,
      readFilterCell: options.readFilterCell,
      readFilterCellStyle: options.readFilterCellStyle,
    })
  }

  return {
    getColumnHistogram(columnId, histogramOptions) {
      options.ensureActive()
      const normalizedColumnId = columnId.trim()
      if (normalizedColumnId.length === 0) {
        return []
      }

      const cacheKey = JSON.stringify([
        options.getCacheKey?.() ?? "",
        normalizedColumnId,
        histogramOptions?.scope ?? "filtered",
        histogramOptions?.ignoreSelfFilter ?? false,
        histogramOptions?.styleKey,
        histogramOptions?.search,
        histogramOptions?.limit,
        histogramOptions?.orderBy,
      ])
      const cached = cache.get(cacheKey)
      if (cached) {
        cache.delete(cacheKey)
        cache.set(cacheKey, cached)
        return cached
      }

      const scope = histogramOptions?.scope ?? "filtered"
      if (scope === "sourceAll") {
        return storeResult(cacheKey, buildHistogram(options.getBaseSourceRows(), normalizedColumnId, histogramOptions))
      }

      if (histogramOptions?.ignoreSelfFilter === true) {
        const filterPredicate = options.resolveFilterPredicate({
          ignoreColumnFilterKey: normalizedColumnId,
        })
        const rowsForHistogram: DataGridRowNode<T>[] = []
        for (const row of options.getBaseSourceRows()) {
          if (filterPredicate(row)) {
            rowsForHistogram.push(row)
          }
        }
        return storeResult(cacheKey, buildHistogram(rowsForHistogram, normalizedColumnId, histogramOptions))
      }

      return storeResult(cacheKey, buildHistogram(
        options.getFilteredRowsProjection(),
        normalizedColumnId,
        histogramOptions,
      ))
    },
  }
}
