import type { ChartDatum } from "./types"

export function isFiniteChartNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function getChartStringValue(row: ChartDatum, field: string): string {
  const value = row[field]
  if (value == null) {
    return ""
  }
  return String(value)
}

export function getChartNumberValue(row: ChartDatum, field: string): number | null {
  const value = row[field]
  if (!isFiniteChartNumber(value)) {
    return null
  }
  return value
}
