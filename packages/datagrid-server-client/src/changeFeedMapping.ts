import type { DataGridDataSourceInvalidation, DataGridDataSourceRowEntry } from "@affino/datagrid-core"
import { normalizeRowSnapshots, type ServerRowSnapshotLike } from "./rowSnapshot"

export interface ServerChangeEventLike<T> {
  type: "cell" | "row" | "range" | "dataset"
  rows?: readonly ServerRowSnapshotLike<T>[]
  invalidation?: unknown
}

export interface ServerChangeUpsertMappingResult<T> {
  kind: "upsert"
  rows: readonly DataGridDataSourceRowEntry<T>[]
  appliedCount: number
}

export interface ServerChangeInvalidateMappingResult {
  kind: "invalidate"
  invalidation: DataGridDataSourceInvalidation
  appliedCount: number
}

export type ServerChangeMappingResult<T> =
  | ServerChangeUpsertMappingResult<T>
  | ServerChangeInvalidateMappingResult

export function mapServerChangeEvent<T>(
  change: ServerChangeEventLike<T>,
  normalizeInvalidation: (value: unknown) => DataGridDataSourceInvalidation | null,
): ServerChangeMappingResult<T> {
  const normalizedRows = change.type !== "dataset" ? normalizeRowSnapshots(change.rows) : null
  if (normalizedRows && normalizedRows.length > 0) {
    return {
      kind: "upsert",
      rows: normalizedRows,
      appliedCount: normalizedRows.length,
    }
  }

  const invalidation = normalizeInvalidation(change.invalidation)
  if (invalidation) {
    return {
      kind: "invalidate",
      invalidation,
      appliedCount: 1,
    }
  }

  return {
    kind: "invalidate",
    invalidation: {
      kind: "all",
      reason: "change-feed",
    },
    appliedCount: 1,
  }
}
