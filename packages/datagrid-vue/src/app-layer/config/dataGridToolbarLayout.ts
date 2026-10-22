export type DataGridToolbarAlignment = "start" | "center" | "end"

export type DataGridBuiltInToolbarItem =
  | "groupByLevels"
  | "undo"
  | "redo"
  | "columnLayout"
  | "quickFilter"
  | "advancedFilter"
  | "findReplace"
  | "aggregations"
  | "exportXlsx"

export interface DataGridToolbarItemPlacement {
  /** Zero-based toolbar row. Items default to row 0. */
  row?: number
  /** Horizontal position within the row. Items default to start. */
  align?: DataGridToolbarAlignment
}

export interface DataGridToolbarActionOptions {
  /** Render the action as text or as an accessible icon-only button. */
  presentation?: "label" | "icon"
  /** Visible label, or the accessible name when presentation is "icon". */
  label?: string
}

export interface DataGridToolbarLayoutOptions {
  /** Placement overrides for built-in toolbar items. With active group-by levels, they default to row 0 and other items to row 1. */
  items?: Partial<Record<DataGridBuiltInToolbarItem, DataGridToolbarItemPlacement>>
  /** Placement overrides for custom modules, keyed by DataGridAppToolbarModule.key. */
  custom?: Readonly<Record<string, DataGridToolbarItemPlacement>>
  undo?: DataGridToolbarActionOptions
  redo?: DataGridToolbarActionOptions
}

export type DataGridToolbarLayoutProp = DataGridToolbarLayoutOptions | null

const BUILT_IN_ITEM_KEYS: Readonly<Record<string, DataGridBuiltInToolbarItem>> = {
  "group-by-levels": "groupByLevels",
  "history-undo": "undo",
  "history-redo": "redo",
  "column-layout": "columnLayout",
  "quick-filter": "quickFilter",
  "advanced-filter": "advancedFilter",
  "find-replace": "findReplace",
  aggregations: "aggregations",
  "export-xlsx": "exportXlsx",
}

export function resolveDataGridToolbarItemPlacement(
  key: string,
  layout: DataGridToolbarLayoutProp | undefined,
  fallback: DataGridToolbarItemPlacement = {},
): Required<DataGridToolbarItemPlacement> {
  const builtInKey = BUILT_IN_ITEM_KEYS[key]
  const requested = builtInKey
    ? layout?.items?.[builtInKey]
    : layout?.custom?.[key]
  const row = Number.isFinite(requested?.row)
    ? Math.max(0, Math.trunc(requested?.row ?? 0))
    : Number.isFinite(fallback.row)
      ? Math.max(0, Math.trunc(fallback.row ?? 0))
      : 0
  const align = requested?.align === "center" || requested?.align === "end" || requested?.align === "start"
    ? requested.align
    : fallback.align === "center" || fallback.align === "end" || fallback.align === "start"
      ? fallback.align
      : "start"
  return { row, align }
}
