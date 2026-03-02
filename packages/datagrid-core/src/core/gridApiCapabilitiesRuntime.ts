import type { DataGridRowModel } from "../models"
import type {
  DataGridCoreSelectionService,
  DataGridCoreTransactionService,
} from "./gridCore"
import {
  type DataGridColumnHistogramCapability,
  type DataGridPatchCapability,
  type DataGridSelectionCapability,
  type DataGridSortFilterBatchCapability,
  type DataGridTransactionCapability,
  resolveColumnHistogramCapability,
  resolvePatchCapability,
  resolveSelectionCapability,
  resolveSortFilterBatchCapability,
  resolveTransactionCapability,
} from "./gridApiCapabilities"

export interface DataGridApiCapabilityFlags {
  readonly patch: boolean
  readonly selection: boolean
  readonly transaction: boolean
  readonly histogram: boolean
  readonly sortFilterBatch: boolean
}

export interface DataGridApiCapabilityRuntime<TRow = unknown> {
  capabilities: DataGridApiCapabilityFlags
  getSelectionCapability: () => DataGridSelectionCapability | null
  getTransactionCapability: () => DataGridTransactionCapability | null
  getPatchCapability: () => DataGridPatchCapability<TRow> | null
  getSortFilterBatchCapability: () => DataGridSortFilterBatchCapability | null
  getColumnHistogramCapability: () => DataGridColumnHistogramCapability | null
}

export interface CreateDataGridApiCapabilityRuntimeInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getSelectionService: () => DataGridCoreSelectionService | null
  getTransactionService: () => DataGridCoreTransactionService | null
}

function createLazyResolver<T>(resolveValue: () => T): () => T {
  let initialized = false
  let cached: T | undefined
  return () => {
    // GridCore service registry is expected to be stable for API lifetime.
    // Cache capability resolution to avoid repeated service probing on hot paths.
    if (!initialized) {
      cached = resolveValue()
      initialized = true
    }
    return cached as T
  }
}

export function createDataGridApiCapabilityRuntime<TRow = unknown>(
  input: CreateDataGridApiCapabilityRuntimeInput<TRow>,
): DataGridApiCapabilityRuntime<TRow> {
  const getSelectionCapability = createLazyResolver<DataGridSelectionCapability | null>(() =>
    resolveSelectionCapability(input.getSelectionService()),
  )
  const getTransactionCapability = createLazyResolver<DataGridTransactionCapability | null>(() =>
    resolveTransactionCapability(input.getTransactionService()),
  )
  const getPatchCapability = createLazyResolver<DataGridPatchCapability<TRow> | null>(() =>
    resolvePatchCapability(input.rowModel),
  )
  const getSortFilterBatchCapability = createLazyResolver<DataGridSortFilterBatchCapability | null>(() =>
    resolveSortFilterBatchCapability(input.rowModel),
  )
  const getColumnHistogramCapability = createLazyResolver<DataGridColumnHistogramCapability | null>(() =>
    resolveColumnHistogramCapability(input.rowModel),
  )

  const capabilities: DataGridApiCapabilityFlags = Object.freeze({
    get patch() {
      return getPatchCapability() !== null
    },
    get selection() {
      return getSelectionCapability() !== null
    },
    get transaction() {
      return getTransactionCapability() !== null
    },
    get histogram() {
      return getColumnHistogramCapability() !== null
    },
    get sortFilterBatch() {
      return getSortFilterBatchCapability() !== null
    },
  })

  return {
    capabilities,
    getSelectionCapability,
    getTransactionCapability,
    getPatchCapability,
    getSortFilterBatchCapability,
    getColumnHistogramCapability,
  }
}
