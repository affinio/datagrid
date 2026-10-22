export interface DataGridColumnReorderOptions {
  enabled: boolean
}

export type DataGridColumnReorderProp =
  | boolean
  | {
      enabled?: boolean
    }
  | null

export function resolveDataGridColumnReorder(
  input: DataGridColumnReorderProp | undefined,
): DataGridColumnReorderOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
    }
  }
  if (!input) {
    return {
      enabled: false,
    }
  }
  return {
    enabled: input.enabled ?? true,
  }
}