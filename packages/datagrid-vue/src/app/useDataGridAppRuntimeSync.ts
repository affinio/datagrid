import { nextTick, watch, type Ref } from "vue"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode } from "./index"
import type { DataGridAppRowHeightMode } from "./useDataGridAppControls"

export interface UseDataGridAppRuntimeSyncOptions<TRow> {
  mode: Ref<DataGridAppMode>
  rows: Ref<readonly TRow[]>
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "api">
  totalRows: Ref<number>
  rowVersion: Ref<number>
  rowHeightMode: Ref<DataGridAppRowHeightMode>
  normalizedBaseRowHeight: Ref<number>
  syncSelectionSnapshotFromRuntime: () => void
  syncRowSelectionSnapshotFromRuntime?: () => void
  syncViewport: () => void
  scheduleViewportSync: () => void
  measureVisibleRowHeights: () => void
  applyRowHeightSettings: () => void
}

export function useDataGridAppRuntimeSync<TRow>(
  options: UseDataGridAppRuntimeSyncOptions<TRow>,
): void {
  const syncRowSelectionSnapshotFromRuntime = options.syncRowSelectionSnapshotFromRuntime ?? (() => undefined)

  watch(options.rows, () => {
    if (options.mode.value === "pivot") {
      options.runtime.api.rows.expandAllGroups()
    }
    void nextTick(() => {
      options.syncViewport()
    })
  }, { immediate: true })

  watch(options.totalRows, () => {
    options.syncSelectionSnapshotFromRuntime()
    syncRowSelectionSnapshotFromRuntime()
    void nextTick(() => {
      options.syncViewport()
    })
  })

  watch(options.rowVersion, () => {
    syncRowSelectionSnapshotFromRuntime()
    options.scheduleViewportSync()
  })

  watch([options.rowHeightMode, options.normalizedBaseRowHeight], () => {
    options.applyRowHeightSettings()
    void nextTick(() => {
      options.measureVisibleRowHeights()
      options.syncViewport()
    })
  }, { immediate: true })
}
