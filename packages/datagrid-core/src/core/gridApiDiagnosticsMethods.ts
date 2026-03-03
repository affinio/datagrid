import type {
  DataGridClientComputeDiagnostics,
  DataGridClientRowModelDerivedCacheDiagnostics,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridRowModel,
} from "../models"
import type { DataGridApiDiagnosticsSnapshot } from "./gridApiContracts"
import type { DataGridComputeCapability } from "./gridApiCapabilities"

type DerivedCacheCapability<TRow = unknown> = {
  getDerivedCacheDiagnostics: () => DataGridClientRowModelDerivedCacheDiagnostics
}

type BackpressureCapability = {
  getBackpressureDiagnostics: () => DataGridDataSourceBackpressureDiagnostics
}

export interface DataGridApiDiagnosticsMethods {
  getAllDiagnostics: () => DataGridApiDiagnosticsSnapshot
}

export interface CreateDataGridApiDiagnosticsMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  getComputeCapability: () => DataGridComputeCapability | null
}

function resolveDerivedCacheCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): DerivedCacheCapability<TRow> | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<DerivedCacheCapability<TRow>>
  if (typeof candidate.getDerivedCacheDiagnostics !== "function") {
    return null
  }
  return {
    getDerivedCacheDiagnostics: candidate.getDerivedCacheDiagnostics.bind(rowModel),
  }
}

function resolveBackpressureCapability<TRow>(
  rowModel: DataGridRowModel<TRow>,
): BackpressureCapability | null {
  const candidate = rowModel as DataGridRowModel<TRow> & Partial<BackpressureCapability>
  if (typeof candidate.getBackpressureDiagnostics !== "function") {
    return null
  }
  return {
    getBackpressureDiagnostics: candidate.getBackpressureDiagnostics.bind(rowModel),
  }
}

export function createDataGridApiDiagnosticsMethods<TRow = unknown>(
  input: CreateDataGridApiDiagnosticsMethodsInput<TRow>,
): DataGridApiDiagnosticsMethods {
  const { rowModel, getComputeCapability } = input
  const getDerivedCacheDiagnostics = resolveDerivedCacheCapability(rowModel)
  const getBackpressureDiagnostics = resolveBackpressureCapability(rowModel)

  const resolveComputeDiagnostics = (): DataGridClientComputeDiagnostics | null => {
    const capability = getComputeCapability()
    if (!capability) {
      return null
    }
    return capability.getComputeDiagnostics()
  }

  return {
    getAllDiagnostics() {
      const snapshot = rowModel.getSnapshot()
      return {
        rowModel: {
          kind: snapshot.kind,
          revision: typeof snapshot.revision === "number" ? snapshot.revision : null,
          rowCount: snapshot.rowCount,
          loading: snapshot.loading,
          warming: snapshot.warming === true,
          projection: snapshot.projection ?? null,
          treeData: snapshot.treeDataDiagnostics ?? null,
        },
        compute: resolveComputeDiagnostics(),
        derivedCache: getDerivedCacheDiagnostics?.getDerivedCacheDiagnostics() ?? null,
        backpressure: getBackpressureDiagnostics?.getBackpressureDiagnostics() ?? null,
      }
    },
  }
}
