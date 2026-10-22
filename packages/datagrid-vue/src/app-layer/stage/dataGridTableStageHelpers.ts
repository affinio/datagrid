import type { CSSProperties } from "vue"
import type { DataGridTableStageBodyColumn } from "./dataGridTableStageBody.types"

export function parsePixelValue(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function resolveColumnWidth(
  column: DataGridTableStageBodyColumn,
  resolveColumnStyle: (key: string) => CSSProperties,
): number {
  const style = resolveColumnStyle(column.key)
  return parsePixelValue(style.width ?? style.minWidth ?? column.width, column.width ?? 140)
}

export function readPivotHeaderMeta(column: DataGridTableStageBodyColumn): { groupLabels?: readonly string[] } | null {
  const rawMeta = column.column.meta?.affinoPivotHeader
  if (!isRecord(rawMeta)) {
    return null
  }
  const groupLabels = Array.isArray(rawMeta.groupLabels)
    ? rawMeta.groupLabels.filter((value): value is string => typeof value === "string" && value.length > 0)
    : []
  return groupLabels.length > 0 ? { groupLabels } : null
}

export function resolveTextAlign(value: unknown): CSSProperties["textAlign"] | undefined {
  return value === "left" || value === "center" || value === "right"
    ? value
    : undefined
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

export function hasGroupCellRenderer(column: DataGridTableStageBodyColumn): boolean {
  const authoredColumn = column.column as typeof column.column & {
    groupCellRenderer?: unknown
  }
  return typeof authoredColumn.groupCellRenderer === "function"
}
