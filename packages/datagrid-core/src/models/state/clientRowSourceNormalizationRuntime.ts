import { findDuplicateRowIds } from "../clientRowModelHelpers.js"
import { reindexSourceRows } from "../clientRowRuntimeUtils.js"
import {
  normalizeRowNode,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
} from "../rowModel.js"
import type { ClientRowProjectionTransientStateRuntime } from "./clientRowProjectionTransientStateRuntime.js"
import { withResolvedRowIdentity } from "../rowModel.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export interface CreateClientRowSourceNormalizationRuntimeOptions<T> {
  resolveRowId?: DataGridRowIdResolver<T>
  treeDataEnabled: boolean
  projectionTransientStateRuntime: ClientRowProjectionTransientStateRuntime
}

export interface DataGridClientRowSourceNormalizationRuntime<T> {
  normalizeSourceRows(inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined): DataGridRowNode<T>[]
}

export function createClientRowSourceNormalizationRuntime<T>(
  options: CreateClientRowSourceNormalizationRuntimeOptions<T>,
): DataGridClientRowSourceNormalizationRuntime<T> {
  const cloneRowData = (value: T): T => {
    if (!isRecord(value)) {
      return value
    }
    const clone = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
    Object.defineProperties(clone, Object.getOwnPropertyDescriptors(value))
    return clone as T
  }

  const normalizeSourceRows = (
    inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined,
  ): DataGridRowNode<T>[] => {
    const normalized = Array.isArray(inputRows)
      ? reindexSourceRows(inputRows.map((row, index) => {
          const normalizedRow = normalizeRowNode(
            withResolvedRowIdentity(row, index, options.resolveRowId),
            index,
          )
          const isolatedRowData = cloneRowData(normalizedRow.data)
          return {
            ...normalizedRow,
            data: isolatedRowData,
            row: isolatedRowData,
          }
        }))
      : []
    if (!options.treeDataEnabled) {
      return normalized
    }
    const duplicates = findDuplicateRowIds(normalized)
    if (duplicates.length === 0) {
      return normalized
    }
    const message = `[DataGridTreeData] Duplicate rowId detected (${duplicates.map(value => String(value)).join(", ")}).`
    options.projectionTransientStateRuntime.updateTreeDataDuplicateDiagnostics(duplicates.length, message)
    throw new Error(message)
  }

  return {
    normalizeSourceRows,
  }
}
