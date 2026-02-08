import {
  useTableHeaderLayout,
  type UseTableHeaderLayoutOptions,
  type UseTableHeaderLayoutResult,
} from "../composables/useTableHeaderLayout"
import type { DataGridHeaderBindings } from "../context"

export function useDataGridHeaderOrchestration(
  options: UseTableHeaderLayoutOptions,
): UseTableHeaderLayoutResult {
  return useTableHeaderLayout(options)
}

export function createDataGridHeaderBindings(
  bindings: DataGridHeaderBindings,
): DataGridHeaderBindings {
  return bindings
}
