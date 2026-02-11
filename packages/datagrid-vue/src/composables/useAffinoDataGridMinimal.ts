import { useAffinoDataGrid } from "./useAffinoDataGrid"
import type {
  UseAffinoDataGridMinimalOptions,
  UseAffinoDataGridMinimalResult,
} from "./useAffinoDataGrid.types"

export function useAffinoDataGridMinimal<TRow>(
  options: UseAffinoDataGridMinimalOptions<TRow>,
): UseAffinoDataGridMinimalResult<TRow> {
  const grid = useAffinoDataGrid(options)
  const {
    events,
    layoutProfiles,
    statusBar,
    contextMenu,
    cellSelection,
    cellRange,
    columnState,
    history,
    rowReorder,
    ...minimal
  } = grid
  return minimal
}
