import type { VNodeChild } from "vue"

export type DataGridEmptyStateReason = "no-rows" | "filtered"

export interface DataGridEmptyStateProps {
  reason: DataGridEmptyStateReason
  hasActiveFilters: boolean
  rowCount: 0
}

export type DataGridEmptyStateRenderer = (props: DataGridEmptyStateProps) => VNodeChild
