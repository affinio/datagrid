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

type StageWindowFlushSnapshot = {
  rowStart: number
  rowEnd: number
  rowCount: number
  topSpacerHeight: number
  bottomSpacerHeight: number
  scrollTop: number
  firstRowId: string
  lastRowId: string
}

function normalizeFiniteNumber(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback
}

function resolveStageWindowFlushSnapshot<TRow extends Record<string, unknown>>(
  options: UseDataGridPerfTraceOptions<TRow>,
): StageWindowFlushSnapshot {
  const rows = options.displayRows.value
  const rowStart = normalizeFiniteNumber(options.viewport.value.viewportRowStart)
  const rowCount = rows.length
  const explicitRowEnd = options.viewport.value.viewportRowEnd
  const rowEnd = Number.isFinite(explicitRowEnd)
    ? Math.max(rowStart, Math.trunc(Number(explicitRowEnd)))
    : rowCount > 0 ? rowStart + rowCount - 1 : rowStart - 1
  return {
    rowStart,
    rowEnd,
    rowCount,
    topSpacerHeight: normalizeFiniteNumber(options.viewport.value.topSpacerHeight),
    bottomSpacerHeight: normalizeFiniteNumber(options.viewport.value.bottomSpacerHeight),
    scrollTop: normalizeFiniteNumber(options.bodyViewportScrollTop.value),
    firstRowId: String(rows[0]?.rowId ?? "none"),
    lastRowId: String(rowCount > 0 ? rows[rowCount - 1]?.rowId ?? "none" : "none"),
  }
}

function resolveStageWindowFlushSignature(snapshot: StageWindowFlushSnapshot): string {
  return [
    snapshot.rowStart,
    snapshot.rowEnd,
    snapshot.rowCount,
    snapshot.topSpacerHeight,
    snapshot.bottomSpacerHeight,
    snapshot.firstRowId,
    snapshot.lastRowId,
  ].join("|")
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

  let lastWindowFlushSnapshot = resolveStageWindowFlushSnapshot(options)

  watch(
    () => resolveStageWindowFlushSignature(resolveStageWindowFlushSnapshot(options)),
    () => {
      const startedAt = resolveDataGridPerfNow()
      const previousSnapshot = lastWindowFlushSnapshot
      const snapshot = resolveStageWindowFlushSnapshot(options)
      lastWindowFlushSnapshot = snapshot
      void nextTick(() => {
        recordDataGridPerfSample({
          scope: "stageWindowFlush",
          ts: Date.now(),
          totalMs: resolveDataGridPerfNow() - startedAt,
          rowStart: snapshot.rowStart,
          rowEnd: snapshot.rowEnd,
          rowCount: snapshot.rowCount,
          topSpacerHeight: snapshot.topSpacerHeight,
          bottomSpacerHeight: snapshot.bottomSpacerHeight,
          scrollTop: snapshot.scrollTop,
          firstRowId: snapshot.firstRowId,
          lastRowId: snapshot.lastRowId,
          rowStartDelta: snapshot.rowStart - previousSnapshot.rowStart,
          rowEndDelta: snapshot.rowEnd - previousSnapshot.rowEnd,
          rowCountDelta: snapshot.rowCount - previousSnapshot.rowCount,
          topSpacerDelta: snapshot.topSpacerHeight - previousSnapshot.topSpacerHeight,
          bottomSpacerDelta: snapshot.bottomSpacerHeight - previousSnapshot.bottomSpacerHeight,
          firstRowChanged: snapshot.firstRowId === previousSnapshot.firstRowId ? 0 : 1,
          lastRowChanged: snapshot.lastRowId === previousSnapshot.lastRowId ? 0 : 1,
        })
      })
    },
  )

  return true
}
