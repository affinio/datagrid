import { nextTick, watch, type Ref } from "vue"
import type { DataGridTableRow, DataGridTableStageViewportSection } from "./dataGridTableStage.types"
import {
  recordDataGridPerfSample,
  resolveDataGridPerfNow,
  resolveDataGridPerfStore,
  resolveDataGridPerfTraceEnabled,
} from "../perf/dataGridPerfTrace"

export interface UseDataGridPerfTraceOptions<TRow extends Record<string, unknown>> {
  viewport: Ref<DataGridTableStageViewportSection>
  displayRows: Ref<readonly DataGridTableRow<TRow>[]>
  bodyViewportScrollTop: Ref<number>
  perfTraceEnabled?: boolean
}

export function useDataGridPerfTrace<TRow extends Record<string, unknown>>(
  options: UseDataGridPerfTraceOptions<TRow>,
): boolean {
  const perfTraceEnabled = options.perfTraceEnabled ?? resolveDataGridPerfTraceEnabled()
  if (!perfTraceEnabled) {
    return false
  }

  resolveDataGridPerfStore()

  watch(
    () => options.bodyViewportScrollTop.value,
    scrollTop => {
      const startedAt = resolveDataGridPerfNow()
      const rowStart = options.viewport.value.viewportRowStart
      const rowCount = options.displayRows.value.length
      void nextTick(() => {
        recordDataGridPerfSample({
          scope: "stageScrollFlush",
          ts: Date.now(),
          totalMs: resolveDataGridPerfNow() - startedAt,
          scrollTop,
          rowStart,
          rowCount,
        })
      })
    },
  )

  watch(
    () =>
      [
        options.viewport.value.viewportRowStart,
        options.viewport.value.topSpacerHeight,
        options.viewport.value.bottomSpacerHeight,
        options.displayRows.value.length,
      ].join("|"),
    () => {
      const startedAt = resolveDataGridPerfNow()
      const rowStart = options.viewport.value.viewportRowStart
      const rowCount = options.displayRows.value.length
      const topSpacerHeight = options.viewport.value.topSpacerHeight
      const bottomSpacerHeight = options.viewport.value.bottomSpacerHeight
      void nextTick(() => {
        recordDataGridPerfSample({
          scope: "stageWindowFlush",
          ts: Date.now(),
          totalMs: resolveDataGridPerfNow() - startedAt,
          rowStart,
          rowCount,
          topSpacerHeight,
          bottomSpacerHeight,
        })
      })
    },
  )

  return true
}
