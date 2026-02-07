import { watch, type ComputedRef, type Ref } from "vue"

import type { NormalizedTableProps } from "@affino/datagrid-core/config/tableConfig"
import type { UiTableColumn } from "@affino/datagrid-core/types"
import type { VisibilitySnapshot } from "./useColumnVisibility"
import { normalizeColumnPinInput } from "../adapters/columnPinNormalization"

interface UseTableLocalColumnsOptions {
  normalizedProps: ComputedRef<NormalizedTableProps>
  selectionColumnVisible: ComputedRef<boolean>
  localColumns: Ref<UiTableColumn[]>
  ensureSystemColumns: (
    columns: UiTableColumn[],
    includeRowIndex: boolean,
    includeSelection: boolean,
  ) => UiTableColumn[]
  getSavedColumnWidth: (columnKey: string) => number | undefined
  loadColumnStateFromStorage: () => VisibilitySnapshot[] | null
  applyStoredColumnState: (snapshot: VisibilitySnapshot[]) => void
  updateVisibilityMapFromColumns: (columns: UiTableColumn[]) => VisibilitySnapshot[]
  persistColumnState: (snapshot?: VisibilitySnapshot[]) => void
  visibilityHydrated: Ref<boolean>
  autoColumnResizeReset: (columns?: UiTableColumn[]) => void
  scheduleAutoColumnResize: () => void
  applyStoredPinState: () => void
  reorderPinnedColumns: () => void
}

export function useTableLocalColumns(options: UseTableLocalColumnsOptions) {
  watch(
    [
      () => options.normalizedProps.value.columns,
      () => options.normalizedProps.value.showRowIndexColumn,
      () => options.normalizedProps.value.selection.enabled,
      () => options.normalizedProps.value.selection.showSelectionColumn,
    ],
    ([newColumns, includeRowIndex]) => {
      const incoming = (Array.isArray(newColumns) ? newColumns : []) as UiTableColumn[]
      const normalized = options
        .ensureSystemColumns(
          incoming,
          includeRowIndex !== false,
          options.selectionColumnVisible.value,
        )
        .map((column: UiTableColumn) => {
          const normalizedPinColumn = normalizeColumnPinInput(column) as UiTableColumn
          const savedWidth = options.getSavedColumnWidth(column.key)
          const resolvedWidth = savedWidth ?? normalizedPinColumn.width
          const userResized = normalizedPinColumn.userResized === true || typeof savedWidth === "number"
          return {
            ...normalizedPinColumn,
            width: resolvedWidth,
            userResized,
            visible: normalizedPinColumn.visible !== false,
          }
        })

      options.localColumns.value = normalized
      const stored = options.loadColumnStateFromStorage()
      if (stored) {
        options.applyStoredColumnState(stored)
      } else {
        const snapshot = options.updateVisibilityMapFromColumns(options.localColumns.value)
        options.persistColumnState(snapshot)
      }

      options.applyStoredPinState()
      options.reorderPinnedColumns()
      options.visibilityHydrated.value = true
      options.autoColumnResizeReset(options.localColumns.value)
      options.scheduleAutoColumnResize()
    },
    { immediate: true },
  )
}
