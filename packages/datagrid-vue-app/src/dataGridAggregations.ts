import type { DataGridAggOp } from "@affino/datagrid-vue"

export interface DataGridAggregationsOptions {
  enabled: boolean
  buttonLabel: string
}

export interface DataGridAggregationPanelItem {
  key: string
  label: string
  enabled: boolean
  op: DataGridAggOp
  allowedOps: readonly DataGridAggOp[]
}

export type DataGridAggregationsProp =
  | boolean
  | {
      enabled?: boolean
      buttonLabel?: string
    }
  | null

const DEFAULT_BUTTON_LABEL = "Aggregations"

export function resolveDataGridAggregations(
  input: DataGridAggregationsProp | undefined,
): DataGridAggregationsOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      buttonLabel: DEFAULT_BUTTON_LABEL,
    }
  }
  if (!input) {
    return {
      enabled: false,
      buttonLabel: DEFAULT_BUTTON_LABEL,
    }
  }
  return {
    enabled: input.enabled ?? true,
    buttonLabel: typeof input.buttonLabel === "string" && input.buttonLabel.trim().length > 0
      ? input.buttonLabel.trim()
      : DEFAULT_BUTTON_LABEL,
  }
}
