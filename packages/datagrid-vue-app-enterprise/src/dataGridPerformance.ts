import type {
  DataGridClientComputeMode,
  DataGridVirtualizationProp,
} from "@affino/datagrid-vue-app"

export type DataGridPerformancePresetName = "balanced" | "throughput"
  | "formulaHeavy"
  | "patchHeavy"

export interface DataGridPerformanceOptions {
  enabled: boolean
  preset: DataGridPerformancePresetName
  computeMode?: DataGridClientComputeMode
  workerPatchDispatchThreshold?: number | null
  formulaColumnCacheMaxColumns?: number | null
  virtualization?: DataGridVirtualizationProp
}

export type DataGridPerformanceProp =
  | boolean
  | DataGridPerformancePresetName
  | ({
      enabled?: boolean
      preset?: DataGridPerformancePresetName
    } & Partial<Omit<DataGridPerformanceOptions, "enabled" | "preset">>)
  | null

const DATAGRID_ENTERPRISE_PERFORMANCE_PRESETS: Readonly<
  Record<DataGridPerformancePresetName, Omit<DataGridPerformanceOptions, "enabled" | "preset">>
> = Object.freeze({
  balanced: {
    computeMode: "worker",
    workerPatchDispatchThreshold: 96,
    formulaColumnCacheMaxColumns: 64,
    virtualization: {
      rows: true,
      columns: true,
      rowOverscan: 8,
      columnOverscan: 3,
    },
  },
  throughput: {
    computeMode: "worker",
    workerPatchDispatchThreshold: 16,
    formulaColumnCacheMaxColumns: 128,
    virtualization: {
      rows: true,
      columns: true,
      rowOverscan: 14,
      columnOverscan: 4,
    },
  },
  formulaHeavy: {
    computeMode: "worker",
    workerPatchDispatchThreshold: 96,
    formulaColumnCacheMaxColumns: 192,
    virtualization: {
      rows: true,
      columns: true,
      rowOverscan: 6,
      columnOverscan: 2,
    },
  },
  patchHeavy: {
    computeMode: "worker",
    workerPatchDispatchThreshold: 8,
    formulaColumnCacheMaxColumns: 48,
    virtualization: {
      rows: true,
      columns: true,
      rowOverscan: 12,
      columnOverscan: 3,
    },
  },
})

export function resolveDataGridPerformance(
  input: DataGridPerformanceProp | undefined,
): DataGridPerformanceOptions {
  if (input === true) {
    return {
      enabled: true,
      preset: "balanced",
      ...DATAGRID_ENTERPRISE_PERFORMANCE_PRESETS.balanced,
    }
  }

  if (typeof input === "string") {
    return {
      enabled: true,
      preset: input,
      ...DATAGRID_ENTERPRISE_PERFORMANCE_PRESETS[input],
    }
  }

  if (!input) {
    return {
      enabled: false,
      preset: "balanced",
    }
  }

  const preset = input.preset ?? "balanced"
  return {
    enabled: input.enabled ?? true,
    preset,
    ...DATAGRID_ENTERPRISE_PERFORMANCE_PRESETS[preset],
    ...(input.computeMode !== undefined ? { computeMode: input.computeMode } : {}),
    ...(input.workerPatchDispatchThreshold !== undefined
      ? { workerPatchDispatchThreshold: input.workerPatchDispatchThreshold }
      : {}),
    ...(input.formulaColumnCacheMaxColumns !== undefined
      ? { formulaColumnCacheMaxColumns: input.formulaColumnCacheMaxColumns }
      : {}),
    ...(input.virtualization !== undefined ? { virtualization: input.virtualization } : {}),
  }
}
