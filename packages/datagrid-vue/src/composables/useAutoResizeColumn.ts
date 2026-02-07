import type { ComputedRef, Ref } from "vue"
import type { UiTableColumn } from "@affino/datagrid-core/types"

interface UseAutoResizeColumnOptions {
  minWidth?: number
  maxWidth?: number
  horizontalPadding?: number
  sampleLimit?: number
  onWidthChange: (column: UiTableColumn, width: number) => void
}

function toDisplayText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function resolveRowList(rows: Ref<unknown[]> | ComputedRef<unknown[]>): unknown[] {
  return rows.value ?? []
}

export function useAutoResizeColumn(
  columns: Ref<UiTableColumn[]> | ComputedRef<UiTableColumn[]>,
  rows: Ref<unknown[]> | ComputedRef<unknown[]>,
  options: UseAutoResizeColumnOptions,
) {
  let canvasContext: CanvasRenderingContext2D | null = null

  function ensureContext(): CanvasRenderingContext2D | null {
    if (canvasContext) return canvasContext
    if (typeof document === "undefined") return null
    const canvas = document.createElement("canvas")
    canvasContext = canvas.getContext("2d")
    if (!canvasContext) return null
    const rootFont = getComputedStyle(document.documentElement).font
    canvasContext.font = rootFont || "14px system-ui"
    return canvasContext
  }

  function measureTextWidth(text: string): number {
    const context = ensureContext()
    if (!context) {
      return text.length * 8
    }
    return context.measureText(text).width
  }

  function autoResizeColumn(column: UiTableColumn) {
    const currentColumn = columns.value.find(entry => entry.key === column.key) ?? column
    const min = Math.max(40, options.minWidth ?? currentColumn.minWidth ?? 96)
    const max = Math.max(min, options.maxWidth ?? currentColumn.maxWidth ?? 960)
    const padding = Math.max(8, options.horizontalPadding ?? 28)
    const sampleLimit = Math.max(1, options.sampleLimit ?? 250)

    const labelText = toDisplayText(currentColumn.label || currentColumn.key)
    let measured = measureTextWidth(labelText)

    const sourceRows = resolveRowList(rows)
    const sample = sourceRows.slice(0, sampleLimit)
    for (const row of sample) {
      if (!row || typeof row !== "object") continue
      const value = (row as Record<string, unknown>)[currentColumn.key]
      const text = toDisplayText(value)
      measured = Math.max(measured, measureTextWidth(text))
    }

    const width = Math.min(max, Math.max(min, Math.ceil(measured + padding)))
    options.onWidthChange(currentColumn, width)
  }

  return {
    autoResizeColumn,
  }
}
