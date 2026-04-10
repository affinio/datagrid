export const DATAGRID_PLACEHOLDER_ROWS_POLICIES = ["fixed-tail"] as const
export type DataGridPlaceholderRowsPolicy = (typeof DATAGRID_PLACEHOLDER_ROWS_POLICIES)[number]

export const DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS = ["edit", "paste", "toggle"] as const
export type DataGridPlaceholderRowMaterializeTrigger = (typeof DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS)[number]

export interface DataGridPlaceholderRowCreateParams<TRow = Record<string, unknown>> {
  visualRowIndex: number
  materializedRowCount: number
  sourceRows: readonly TRow[]
  reason: DataGridPlaceholderRowMaterializeTrigger
}

export type DataGridPlaceholderRowFactory<TRow = Record<string, unknown>> = (
  params: DataGridPlaceholderRowCreateParams<TRow>,
) => TRow | null | undefined

export interface DataGridPlaceholderRowsOptions<TRow = Record<string, unknown>> {
  enabled: boolean
  policy: DataGridPlaceholderRowsPolicy
  count: number
  materializeOn: readonly DataGridPlaceholderRowMaterializeTrigger[]
  createRowAt: DataGridPlaceholderRowFactory<TRow> | null
}

export type DataGridPlaceholderRowsProp<TRow = Record<string, unknown>> =
  | number
  | {
      policy?: DataGridPlaceholderRowsPolicy
      count?: number
      materializeOn?: readonly DataGridPlaceholderRowMaterializeTrigger[]
      createRowAt?: DataGridPlaceholderRowFactory<TRow> | null
    }
  | null

function normalizePlaceholderRowCount(value: unknown): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.trunc(value as number))
}

function normalizeMaterializeOn(
  value: readonly DataGridPlaceholderRowMaterializeTrigger[] | undefined,
): readonly DataGridPlaceholderRowMaterializeTrigger[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS
  }
  const normalized = Array.from(new Set(
    value.filter((entry): entry is DataGridPlaceholderRowMaterializeTrigger => (
      DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS.includes(entry)
    )),
  ))
  return normalized.length > 0
    ? normalized
    : DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS
}

export function resolveDataGridPlaceholderRows<TRow = Record<string, unknown>>(
  input: DataGridPlaceholderRowsProp<TRow> | undefined,
): DataGridPlaceholderRowsOptions<TRow> {
  if (input == null) {
    return {
      enabled: false,
      policy: "fixed-tail",
      count: 0,
      materializeOn: DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS,
      createRowAt: null,
    }
  }

  if (typeof input === "number") {
    const count = normalizePlaceholderRowCount(input)
    return {
      enabled: count > 0,
      policy: "fixed-tail",
      count,
      materializeOn: DATAGRID_PLACEHOLDER_ROW_MATERIALIZE_TRIGGERS,
      createRowAt: null,
    }
  }

  const count = normalizePlaceholderRowCount(input.count)
  const createRowAt = typeof input.createRowAt === "function"
    ? input.createRowAt
    : null
  return {
    enabled: count > 0,
    policy: input.policy === "fixed-tail" ? "fixed-tail" : "fixed-tail",
    count,
    materializeOn: normalizeMaterializeOn(input.materializeOn),
    createRowAt,
  }
}

export function isDataGridPlaceholderMaterializeTriggerEnabled<TRow = Record<string, unknown>>(
  options: DataGridPlaceholderRowsOptions<TRow>,
  trigger: DataGridPlaceholderRowMaterializeTrigger,
): boolean {
  return options.enabled && options.materializeOn.includes(trigger)
}