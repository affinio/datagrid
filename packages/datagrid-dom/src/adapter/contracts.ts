import type {
  DataGridApi,
  DataGridCellInteractionInvocationTrigger,
  DataGridCellInteractionKeyboardTrigger,
  DataGridCellInteractionRole,
  DataGridColumnInput,
  DataGridColumnSnapshot,
  DataGridFormulaFieldDefinition,
  DataGridQuickFilterMode,
  DataGridRowNode,
  DataGridRowModel,
  DataGridTreeDataSpec,
} from "@affino/datagrid-core"
import type { DataGridGanttOptions } from "@affino/datagrid-gantt"

export interface DataGridDomCellRendererInteractiveContext {
  readonly enabled: boolean
  readonly click: boolean
  readonly keyboard: readonly DataGridCellInteractionKeyboardTrigger[]
  readonly role?: DataGridCellInteractionRole
  readonly ariaLabel?: string
  readonly ariaPressed?: "true" | "false" | "mixed"
  readonly ariaChecked?: "true" | "false" | "mixed"
  readonly ariaDisabled?: "true"
  /** Invokes the column's Core cellInteraction policy for a renderer-owned sub-control. */
  activate(trigger?: DataGridCellInteractionInvocationTrigger): boolean
}

export interface DataGridDomCellRendererContext<TRow = unknown> {
  readonly document: Document
  readonly row: TRow
  readonly rowNode: DataGridRowNode<TRow>
  readonly column: DataGridColumnSnapshot
  readonly rowIndex: number
  readonly columnIndex: number
  /** Unformatted value after the column accessor or formula is applied. */
  readonly value: unknown
  /** Text produced by the standard Core cell formatter. */
  readonly displayValue: string
  /** Available when the column defines Core's `cellInteraction` policy. */
  readonly interactive: DataGridDomCellRendererInteractiveContext | null
}

export type DataGridDomCellRenderer<TRow = unknown> = (
  context: DataGridDomCellRendererContext<TRow>,
) => Node | string | null | undefined

export type DataGridDomEmptyStateReason = "no-rows" | "filtered"
export type DataGridDomEmptyStateAlignment = "content" | "viewport"

export interface DataGridDomEmptyStateProps {
  reason: DataGridDomEmptyStateReason
  hasActiveFilters: boolean
  rowCount: 0
}

/** Return a fresh Node when rendering DOM content. */
export type DataGridDomEmptyStateRenderer = (state: DataGridDomEmptyStateProps) => Node | string | null

export interface DataGridDomQuickFilterOptions {
  placeholder?: string
  columns?: readonly string[]
  mode?: DataGridQuickFilterMode
  applyMode?: "input" | "debounce" | "manual"
  debounceMs?: number
}

export type DataGridDomColumnMenuItem = "sort" | "group" | "pin" | "condition" | "filter"
export type DataGridDomColumnMenuTrigger = "button" | "contextmenu" | "button+contextmenu"

export interface DataGridDomColumnMenuOptions {
  enabled?: boolean
  trigger?: DataGridDomColumnMenuTrigger
  maxFilterValues?: number
  items?: readonly DataGridDomColumnMenuItem[]
}

export type DataGridDomColumnMenuProp = boolean | DataGridDomColumnMenuOptions | null

export type DataGridDomToolbarAction<TRow = unknown> = {
  key: string
  label: string
  onAction: (api: DataGridApi<TRow>) => void | Promise<void>
}

export interface DataGridDomToolbarOptions<TRow = unknown> {
  actions?: readonly DataGridDomToolbarAction<TRow>[]
}

export type DataGridDomCellClass =
  | string
  | readonly string[]
  | Readonly<Record<string, boolean>>

/** Inline CSS declarations keyed by CSS property name or custom property. */
export type DataGridDomCellStyle = Readonly<Record<string, string | null | undefined>>

export interface DataGridDomColumnExportOptions {
  header?: string
  dataType?: "text" | "number" | "boolean" | "date" | "datetime" | "currency" | "percent"
  numberFormat?: string
  width?: number
  style?: Readonly<{ fillColor?: string; fontColor?: string; bold?: boolean }>
}

export type DataGridDomCellClassResolver<TRow = unknown> = (
  row: DataGridRowNode<TRow>,
  rowIndex: number,
  column: DataGridColumnSnapshot,
  columnIndex: number,
) => DataGridDomCellClass | null | undefined

export type DataGridDomCellStyleResolver<TRow = unknown> = (
  row: DataGridRowNode<TRow>,
  rowIndex: number,
  column: DataGridColumnSnapshot,
  columnIndex: number,
) => DataGridDomCellStyle | null | undefined

export interface DataGridDomColumnInput<TRow = unknown> extends DataGridColumnInput<TRow> {
  /** Replaces the display content for a leaf cell. Return a fresh Node when returning DOM. */
  cellRenderer?: DataGridDomCellRenderer<TRow> | null
  /** Optional XLSX metadata consumed by the `@affino/datagrid-dom/xlsx` entry point. */
  export?: DataGridDomColumnExportOptions
}

type DataGridDomRowVirtualization = {
  /** Fixed row height in CSS pixels. The row height must match the rendered cell layout. */
  rowHeight: number
  /** Minimum number of extra rows Core keeps around the visible viewport. */
  overscan?: number
}

type DataGridDomColumnVirtualization = {
  /** Minimum number of extra scrollable columns Core keeps around the viewport. */
  overscan?: number
}

interface DataGridDomOptionsBase<TRow> {
  columns: readonly DataGridDomColumnInput<TRow>[]
  className?: string
  label?: string
  /** Resolves additional classes for projected body cells. Avoid the reserved affino-grid-dom__ prefix. */
  cellClass?: DataGridDomCellClassResolver<TRow>
  /** Resolves inline visual styles for projected body cells. Use CSS property names or custom properties. */
  cellStyle?: DataGridDomCellStyleResolver<TRow>
  /** Renders content when the projected row set is empty. Defaults to a built-in message. */
  emptyState?: DataGridDomEmptyStateRenderer
  /** Aligns empty content to the body content or visible viewport. Defaults to `content`. */
  emptyStateAlignment?: DataGridDomEmptyStateAlignment
  /** Enables drag-and-drop column reordering in the header. Disabled by default. */
  columnReorder?: boolean
  /** Renders column-menu triggers. The app shell owns menu behavior and lifecycle. */
  columnMenu?: boolean
  /** Adds a pinned checkbox column for selecting records. Disabled by default. */
  rowSelection?: boolean
  /** Shows a drag handle on the active cell range for filling editable cells. Disabled by default. */
  fillHandle?: boolean
  /** Selects the mounted view. Gantt mode renders a synchronized timeline beside the same Core rows. */
  viewMode?: "table" | "gantt"
  /** Gantt timeline fields and scale. Used only when `viewMode` is `gantt`. */
  gantt?: DataGridGanttOptions
  rowVirtualization?: false | DataGridDomRowVirtualization
  /** Renders only Core's horizontal column window plus pinned columns. */
  columnVirtualization?: false | DataGridDomColumnVirtualization
}

type DataGridDomChromeOptions =
  | { /** Keeps grid lines on DOM cells. This is the default. */ gridChrome?: "dom" }
  | {
    /** Draws body grid lines on Canvas. Requires fixed row and column virtualization. */
    gridChrome: "canvas"
    rowVirtualization: DataGridDomRowVirtualization
    columnVirtualization: DataGridDomColumnVirtualization
  }

/**
 * Provide exactly one row source. A supplied row model remains caller-owned;
 * destroy the grid handle before disposing that model.
 */
export type DataGridDomOptions<TRow> = DataGridDomOptionsBase<TRow> & DataGridDomChromeOptions & (
  | {
    rows: readonly TRow[]
    rowModel?: never
    /** Projects client rows into a path or parent-linked tree before rendering. */
    treeData?: DataGridTreeDataSpec<TRow> | null
    /** Registers Core formula fields before the first render. */
    formulas?: readonly DataGridFormulaFieldDefinition[]
  }
  | {
    rowModel: DataGridRowModel<TRow>
    rows?: never
    treeData?: never
    formulas?: never
  }
)

export interface DataGridDomHandle<TRow> {
  readonly api: DataGridApi<TRow>
  readonly ready: Promise<void>
  destroy(): Promise<void>
}

type DataGridDomShellOptionsFor<TRow, TOptions> = TOptions extends unknown
  ? Omit<TOptions, "columnMenu"> & {
    quickFilter?: boolean | DataGridDomQuickFilterOptions | null
    columnMenu?: DataGridDomColumnMenuProp
    toolbar?: DataGridDomToolbarOptions<TRow>
  }
  : never

/** Vue-style DOM app shell options composed over the lower-level renderer options. */
export type DataGridDomShellOptions<TRow> = DataGridDomShellOptionsFor<TRow, DataGridDomOptions<TRow>>

export interface DataGridDomShellHandle<TRow> extends DataGridDomHandle<TRow> {
  readonly element: HTMLElement
  readonly toolbar: HTMLElement | null
}
