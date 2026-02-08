// src/datagrid/theme/types.ts
// Contains base interfaces for table theme tokens and style config.

export interface DataGridThemeTokens {
  tableFontFamily: string
  tableFontSize: string
  tableTextColor: string
  tableBackgroundColor: string
  headerBackgroundColor: string
  headerTextColor: string
  headerBorderColor: string
  headerPaddingX: string
  headerPaddingY: string
  headerHighlightBorderColor: string
  headerHighlightTextColor: string
  headerSelectedTextColor: string
  headerSystemTextColor: string
  bodyRowBackgroundColor: string
  bodyRowTextColor: string
  bodyRowHoverBackgroundColor: string
  bodyRowSelectedBackgroundColor: string
  bodyRowSelectedTextColor: string
  bodyCellPaddingX: string
  bodyCellPaddingY: string
  bodyCellBorderColor: string
  selectionCellBackgroundColor: string
  selectionCellTextColor: string
  indexCellBackgroundColor: string
  indexCellTextColor: string
  rowDividerSize: string
  rowDividerColor: string
  columnDividerSize: string
  columnDividerColor: string
  headerDividerSize: string
  headerDividerColor: string
  summaryDividerSize: string
  summaryDividerColor: string
  groupRowBackgroundColor: string
  groupRowTextColor: string
  summaryRowBackgroundColor: string
  summaryRowTextColor: string
  summaryLabelTextColor: string
  pinnedBackgroundColor: string
  pinnedLeftBackgroundColor: string
  pinnedRightBackgroundColor: string
  pinnedShadow: string
  pinnedLeftShadow: string
  pinnedRightShadow: string
  pinnedLeftBorderColor: string
  pinnedLeftBorderWidth: string
  pinnedRightBorderColor: string
  pinnedRightBorderWidth: string
}

export interface DataGridResolvedStyleConfig {
  table: Record<string, string>
  header: Record<string, string>
  body: Record<string, string>
  group: Record<string, string>
  summary: Record<string, string>
  state: Record<string, string>
  tokens: DataGridThemeTokens
}

export interface DataGridStyleSection {
  wrapper?: string
  container?: string
}

export interface DataGridHeaderStyle {
  row?: string
  cell?: string
  selectionCell?: string
  indexCell?: string
}

export interface DataGridBodyStyle {
  row?: string
  cell?: string
  selectionCell?: string
  indexCell?: string
}

export interface DataGridGroupStyle {
  row?: string
  cell?: string
  caret?: string
}

export interface DataGridSummaryStyle {
  row?: string
  cell?: string
  labelCell?: string
}

export interface DataGridStateStyle {
  selectedRow?: string
}

export type DataGridThemeTokenVariants = Record<string, Partial<DataGridThemeTokens>>

export interface DataGridStyleConfig {
  table?: DataGridStyleSection
  header?: DataGridHeaderStyle
  body?: DataGridBodyStyle
  group?: DataGridGroupStyle
  summary?: DataGridSummaryStyle
  state?: DataGridStateStyle
  tokens?: Partial<DataGridThemeTokens>
  tokenVariants?: DataGridThemeTokenVariants
  activeTokenVariant?: string
  defaultTokenVariant?: string
  inheritThemeFromDocument?: boolean
  documentDarkClass?: string
}
