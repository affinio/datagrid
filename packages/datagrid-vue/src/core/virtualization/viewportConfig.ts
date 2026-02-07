import type { UiTableColumn } from "@affino/datagrid-core/types"
import type { UseTableViewportOptions } from "../../composables/useTableViewport"
import type { ColumnPinMode } from "@affino/datagrid-core/virtualization/types"

export function resolveRowHeightModeValue(mode: UseTableViewportOptions["rowHeightMode"]): "fixed" | "auto" {
  if (typeof mode === "string") return mode === "auto" ? "auto" : "fixed"
  if (mode && typeof mode === "object" && "value" in mode) {
    return mode.value === "auto" ? "auto" : "fixed"
  }
  return "fixed"
}

export function resolvePinMode(column: UiTableColumn): ColumnPinMode {
  if (column.isSystem) {
    return "left"
  }
  if (column.pin === "left") {
    return "left"
  }
  if (column.pin === "right") {
    return "right"
  }
  return "none"
}
