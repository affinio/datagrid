import type { ColumnPinMode } from "../virtualization/types"

export interface CanonicalPinColumn {
  isSystem?: boolean
  pin?: unknown
}

/**
 * Runtime canonical pin resolver.
 * Legacy fields are intentionally excluded from this contract.
 */
export function resolveCanonicalPinMode(column: CanonicalPinColumn | null | undefined): ColumnPinMode {
  if (!column) return "none"
  if (column.isSystem === true) return "left"
  return column.pin === "left" || column.pin === "right" ? column.pin : "none"
}
