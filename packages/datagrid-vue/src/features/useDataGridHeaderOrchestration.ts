import {
  useTableHeaderLayout,
  type UseTableHeaderLayoutOptions,
  type UseTableHeaderLayoutResult,
} from "../composables/useTableHeaderLayout"
import type { UiTableHeaderBindings } from "../context"

export function useDataGridHeaderOrchestration(
  options: UseTableHeaderLayoutOptions,
): UseTableHeaderLayoutResult {
  return useTableHeaderLayout(options)
}

export function createDataGridHeaderBindings(
  bindings: UiTableHeaderBindings,
): UiTableHeaderBindings {
  return bindings
}
