import { computed, unref, type ComputedRef, type CSSProperties, type Ref } from "vue"
import type { UiTableColumn, VisibleRow } from "@affino/datagrid-core/types"
import type { ColumnMetric } from "./useTableViewport"
import type { RowPoolItem } from "./useTableViewport"

interface UseTableStickyColumnsOptions {
  visibleColumns: ComputedRef<UiTableColumn[]>
  pinnedLeftEntries: Ref<ColumnMetric[]>
  pinnedRightEntries: Ref<ColumnMetric[]>
  columnWidthDomMap: ComputedRef<Map<string, number>>
  columnWidthMap: Ref<Map<string, number>>
  toDomUnits: (value: number) => number
  processedRows: ComputedRef<VisibleRow[]>
  rowHeightDom: ComputedRef<number>
  pooledRows: ComputedRef<RowPoolItem[]>
  viewportHeight: Ref<number>
  scrollTop: Ref<number>
  selectionColumnKey: string
  splitPinnedLayoutEnabled?: Ref<boolean> | ComputedRef<boolean> | boolean
}

export interface UseTableStickyColumnsResult {
  pinnedLeftKeys: ComputedRef<Set<string>>
  pinnedRightKeys: ComputedRef<Set<string>>
  stickyLeftOffsets: ComputedRef<Map<string, number>>
  stickyRightOffsets: ComputedRef<Map<string, number>>
  stickyBottomOffsets: ComputedRef<Map<number, number>>
  isColumnLeftSticky: (column: UiTableColumn) => boolean
  isColumnRightSticky: (column: UiTableColumn) => boolean
  isColumnSticky: (column: UiTableColumn) => boolean
  getStickySide: (column: UiTableColumn) => "left" | "right" | null
  getStickyLeftOffset: (column: UiTableColumn) => number | undefined
  getStickyRightOffset: (column: UiTableColumn) => number | undefined
  columnStickyStyle: (column: UiTableColumn, baseZIndex?: number) => CSSProperties
  systemColumnStyle: (column: UiTableColumn) => CSSProperties
  summaryCellStyle: (column: UiTableColumn) => CSSProperties
  getStickyTopOffset: (row: any) => number | undefined
}

export function useTableStickyColumns(options: UseTableStickyColumnsOptions): UseTableStickyColumnsResult {
  const splitPinnedLayoutEnabled = computed(() => {
    const candidate = unref(options.splitPinnedLayoutEnabled)
    return candidate !== false
  })
  const pinnedLeftKeys = computed(() => new Set(options.pinnedLeftEntries.value.map(entry => entry.column.key)))
  const pinnedRightKeys = computed(() => new Set(options.pinnedRightEntries.value.map(entry => entry.column.key)))

  const stickyLeftOffsets = computed(() => {
    const offsets = new Map<string, number>()
    let accumulated = 0
    options.pinnedLeftEntries.value.forEach(entry => {
      offsets.set(entry.column.key, accumulated)
      const width = options.columnWidthDomMap.value.get(entry.column.key) ?? options.toDomUnits(entry.width ?? 0)
      accumulated += width
    })
    return offsets
  })

  const stickyRightOffsets = computed(() => {
    const offsets = new Map<string, number>()
    let accumulated = 0
    const entries = [...options.pinnedRightEntries.value]
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      offsets.set(entry.column.key, accumulated)
      const width = options.columnWidthDomMap.value.get(entry.column.key) ?? options.toDomUnits(entry.width ?? 0)
      accumulated += width
    }
    return offsets
  })

  const stickyBottomOffsets = computed(() => {
    const offsets = new Map<number, number>()
    const stickyEntries = options.processedRows.value
      .map(entry => entry)
      .filter(entry => entry.stickyBottom)
    let accumulated = 0
    for (let index = stickyEntries.length - 1; index >= 0; index -= 1) {
      const entry = stickyEntries[index]
      const stickyValue = entry?.stickyBottom
      if (typeof stickyValue === "number") {
        offsets.set(entry.originalIndex, stickyValue)
        accumulated = stickyValue + options.rowHeightDom.value
      } else {
        offsets.set(entry.originalIndex, accumulated)
        accumulated += options.rowHeightDom.value
      }
    }
    return offsets
  })

  const isExplicitLeftSticky = (column: UiTableColumn): boolean => {
    return column.pin === "left"
  }

  const isExplicitRightSticky = (column: UiTableColumn): boolean => {
    return column.pin === "right"
  }

  const isColumnLeftSticky = (column: UiTableColumn): boolean => {
    let shouldStick = false

    if (isExplicitLeftSticky(column)) {
      shouldStick = true
    } else if (column.isSystem || pinnedLeftKeys.value.has(column.key)) {
      shouldStick = true
    }

    if (!shouldStick) {
      return false
    }

    if (!splitPinnedLayoutEnabled.value) {
      return true
    }

    return isExplicitLeftSticky(column)
  }

  const isColumnRightSticky = (column: UiTableColumn): boolean => {
    let shouldStick = false

    if (isExplicitRightSticky(column)) {
      shouldStick = true
    } else if (pinnedRightKeys.value.has(column.key)) {
      shouldStick = true
    }

    if (!shouldStick) {
      return false
    }

    if (!splitPinnedLayoutEnabled.value) {
      return true
    }

    return isExplicitRightSticky(column)
  }

  const isColumnSticky = (column: UiTableColumn): boolean => {
    return isColumnLeftSticky(column) || isColumnRightSticky(column)
  }

  const getStickySide = (column: UiTableColumn): "left" | "right" | null => {
    if (isColumnLeftSticky(column)) return "left"
    if (isColumnRightSticky(column)) return "right"
    return null
  }

  const getStickyLeftOffset = (column: UiTableColumn): number | undefined => {
    if (!isColumnLeftSticky(column)) return undefined
    const fromMap = stickyLeftOffsets.value.get(column.key)
    if (fromMap != null) return fromMap
    let offset = 0
    for (const col of options.visibleColumns.value) {
      if (col.key === column.key) break
      if (isColumnLeftSticky(col)) {
        offset += options.columnWidthDomMap.value.get(col.key) ?? 0
      }
    }
    return offset
  }

  const getStickyRightOffset = (column: UiTableColumn): number | undefined => {
    if (!isColumnRightSticky(column)) return undefined
    const fromMap = stickyRightOffsets.value.get(column.key)
    if (fromMap != null) return fromMap
    let offset = 0
    const reversed = [...options.visibleColumns.value].reverse()
    for (const col of reversed) {
      if (col.key === column.key) break
      if (isColumnRightSticky(col)) {
        offset += options.columnWidthDomMap.value.get(col.key) ?? 0
      }
    }
    return offset
  }

  const columnStickyStyle = (column: UiTableColumn, baseZIndex = 10): CSSProperties => {
    const style: CSSProperties = {}
    const domWidth = options.columnWidthDomMap.value.get(column.key)
    const layoutWidth = options.columnWidthMap.value.get(column.key)
    const resolvedWidth = domWidth ?? (layoutWidth != null ? options.toDomUnits(layoutWidth) : null)
    if (resolvedWidth != null) {
      style.width = `${resolvedWidth}px`
      style.minWidth = `${resolvedWidth}px`
    }
    const side = getStickySide(column)
    const pinnedSide = side ?? (pinnedLeftKeys.value.has(column.key) ? "left" : pinnedRightKeys.value.has(column.key) ? "right" : null)

    if (side === "left") {
      const offset = getStickyLeftOffset(column) ?? 0
      style.position = "sticky"
      style.left = `${offset}px`
      style.zIndex = String(baseZIndex)
    } else if (side === "right") {
      const offset = getStickyRightOffset(column) ?? 0
      style.position = "sticky"
      style.right = `${offset}px`
      style.zIndex = String(baseZIndex)
    }

    if (pinnedSide === "left" || pinnedSide === "right") {
      const baseBackground = pinnedSide === "left"
        ? "var(--ui-table-pinned-left-bg, var(--ui-table-pinned-bg, var(--ui-table-header-background-color)))"
        : "var(--ui-table-pinned-right-bg, var(--ui-table-pinned-bg, var(--ui-table-header-background-color)))"
      const dividerWidth = pinnedSide === "left"
        ? "var(--ui-table-pinned-left-divider-width, var(--ui-table-pinned-left-border-width, 1px))"
        : "var(--ui-table-pinned-right-divider-width, var(--ui-table-pinned-right-border-width, 1px))"
      const dividerColor = pinnedSide === "left"
        ? "var(--ui-table-pinned-left-divider-color, var(--ui-table-pinned-left-border-color, var(--ui-table-cell-border-color)))"
        : "var(--ui-table-pinned-right-divider-color, var(--ui-table-pinned-right-border-color, var(--ui-table-cell-border-color)))"

      style.backgroundColor = baseBackground
      style.backgroundImage = pinnedSide === "left"
        ? `linear-gradient(to left, transparent calc(100% - ${dividerWidth}), ${dividerColor} calc(100% - ${dividerWidth}))`
        : `linear-gradient(to right, transparent calc(100% - ${dividerWidth}), ${dividerColor} calc(100% - ${dividerWidth}))`
      style.backgroundRepeat = "no-repeat"
      style.backgroundSize = "100% 100%"
    }
    return style
  }

  const systemColumnStyle = (column: UiTableColumn): CSSProperties => {
    const style = columnStickyStyle(column, column.isSystem ? 35 : 15)
    if (column.isSystem && column.key === options.selectionColumnKey) {
      const currentZ = Number(style.zIndex ?? 0)
      style.zIndex = String(currentZ > 0 ? Math.max(currentZ, 40) : 40)
    }
    return style
  }

  const summaryCellStyle = (column: UiTableColumn): CSSProperties => {
    const style = columnStickyStyle(column, 12)
    const side = getStickySide(column)
    const pinnedSide = side ?? (pinnedLeftKeys.value.has(column.key) ? "left" : pinnedRightKeys.value.has(column.key) ? "right" : null)

    if (!side) {
      if (pinnedSide === "left" || pinnedSide === "right") {
        const summaryBackground = pinnedSide === "left"
          ? "var(--ui-table-pinned-left-bg, var(--ui-table-pinned-bg, var(--ui-table-summary-row-background-color)))"
          : "var(--ui-table-pinned-right-bg, var(--ui-table-pinned-bg, var(--ui-table-summary-row-background-color)))"
        const dividerWidth = pinnedSide === "left"
          ? "var(--ui-table-pinned-left-divider-width, var(--ui-table-pinned-left-border-width, 1px))"
          : "var(--ui-table-pinned-right-divider-width, var(--ui-table-pinned-right-border-width, 1px))"
        const dividerColor = pinnedSide === "left"
          ? "var(--ui-table-pinned-left-divider-color, var(--ui-table-pinned-left-border-color, var(--ui-table-cell-border-color)))"
          : "var(--ui-table-pinned-right-divider-color, var(--ui-table-pinned-right-border-color, var(--ui-table-cell-border-color)))"

        style.backgroundColor = summaryBackground
        style.backgroundImage = pinnedSide === "left"
          ? `linear-gradient(to left, transparent calc(100% - ${dividerWidth}), ${dividerColor} calc(100% - ${dividerWidth}))`
          : `linear-gradient(to right, transparent calc(100% - ${dividerWidth}), ${dividerColor} calc(100% - ${dividerWidth}))`
        style.backgroundRepeat = "no-repeat"
        style.backgroundSize = "100% 100%"
      } else {
        style.backgroundColor = "var(--ui-table-summary-row-background-color)"
      }
    }
    return style
  }

  const getStickyTopOffset = (row: any): number | undefined => {
    if (!row.stickyTop) return undefined
    if (typeof row.stickyTop === "number") return row.stickyTop
    let offset = 0
    for (const pooled of options.pooledRows.value) {
      if (!pooled.entry) continue
      if (pooled.entry.displayIndex === row.displayIndex) break
      if (pooled.entry.stickyTop) {
        offset += options.rowHeightDom.value
      }
    }
    return offset
  }

  return {
    pinnedLeftKeys,
    pinnedRightKeys,
    stickyLeftOffsets,
    stickyRightOffsets,
    stickyBottomOffsets,
    isColumnLeftSticky,
    isColumnRightSticky,
    isColumnSticky,
    getStickySide,
    getStickyLeftOffset,
    getStickyRightOffset,
    columnStickyStyle,
    systemColumnStyle,
    summaryCellStyle,
    getStickyTopOffset,
  }
}
