export interface DataGridVirtualizationOptions {
  rows: boolean
  columns: boolean
  rowOverscan: number
  columnOverscan: number
}

export type DataGridVirtualizationProp =
  | boolean
  | {
      overscan?: number
      rows?: boolean
      columns?: boolean
      rowOverscan?: number
      columnOverscan?: number
    }

function normalizeOverscan(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.trunc(value as number))
}

export function resolveDataGridVirtualization(
  input: DataGridVirtualizationProp | undefined,
  renderMode: "virtualization" | "pagination",
): DataGridVirtualizationOptions {
  const defaults: DataGridVirtualizationOptions = {
    rows: true,
    columns: false,
    rowOverscan: 8,
    columnOverscan: 2,
  }

  if (input === true) {
    defaults.columns = true
  } else if (input === false) {
    defaults.rows = false
    defaults.columns = false
  } else if (input && typeof input === "object") {
    defaults.rows = input.rows ?? defaults.rows
    defaults.columns = input.columns ?? defaults.columns
    const sharedOverscan = normalizeOverscan(input.overscan, defaults.rowOverscan)
    defaults.rowOverscan = normalizeOverscan(input.rowOverscan, sharedOverscan)
    defaults.columnOverscan = normalizeOverscan(input.columnOverscan, normalizeOverscan(input.overscan, defaults.columnOverscan))
  }

  if (renderMode === "pagination") {
    defaults.rows = false
  }

  return defaults
}
