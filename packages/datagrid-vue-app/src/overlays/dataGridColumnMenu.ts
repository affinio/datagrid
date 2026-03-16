export interface DataGridColumnMenuOptions {
  enabled: boolean
  maxFilterValues: number
}

export type DataGridColumnMenuProp =
  | boolean
  | {
      enabled?: boolean
      maxFilterValues?: number
    }
  | null

const DEFAULT_MAX_FILTER_VALUES = 120

export function resolveDataGridColumnMenu(
  input: DataGridColumnMenuProp | undefined,
): DataGridColumnMenuOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
    }
  }
  if (!input) {
    return {
      enabled: false,
      maxFilterValues: DEFAULT_MAX_FILTER_VALUES,
    }
  }
  return {
    enabled: input.enabled ?? true,
    maxFilterValues: Number.isFinite(input.maxFilterValues)
      ? Math.max(20, Math.trunc(input.maxFilterValues as number))
      : DEFAULT_MAX_FILTER_VALUES,
  }
}
