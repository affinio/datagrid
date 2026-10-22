export interface DataGridRowReorderOptions {
  enabled: boolean
}

export type DataGridRowReorderProp =
  | boolean
  | {
      enabled?: boolean
    }
  | null

export function resolveDataGridRowReorder(
  input: DataGridRowReorderProp | undefined,
): DataGridRowReorderOptions {
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