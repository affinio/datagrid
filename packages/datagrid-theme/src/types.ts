// src/datagrid/theme/types.ts
// Contains base interfaces for table theme tokens and style config.

export interface DataGridThemeTokens {
  gridFontFamily: string
  gridFontSize: string
  gridTextColor: string
  gridBackgroundColor: string
  gridTextPrimary: string
  gridTextMuted: string
  gridTextSoft: string
  gridGlassBorder: string
  gridAccentStrong: string
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
  gridHeroBackgroundStart: string
  gridHeroBackgroundEnd: string
  gridChipBackground: string
  gridControlsBackground: string
  gridControlsInputBackground: string
  gridControlsSurfaceBackground: string
  gridFilterPanelBorderColor: string
  gridFilterPanelBackground: string
  gridFilterIndicatorActiveColor: string
  gridMetricsCardBackground: string
  gridViewportBackground: string
  gridFocusOutlineColor: string
  gridHeaderRowBackgroundColor: string
  gridHeaderCellBackgroundColor: string
  gridHeaderCellHoverBackgroundColor: string
  gridHeaderFilterOpenBackgroundColor: string
  gridGroupRowBorderColor: string
  gridRowSelectedStickyBackgroundColor: string
  gridRowSelectedRangeBackgroundColor: string
  gridCheckboxAccentColor: string
  gridSortIndicatorColor: string
  gridSortPriorityBorderColor: string
  gridHeaderFilterHighlightColor: string
  gridFilterTriggerBorderColor: string
  gridFilterTriggerBackgroundColor: string
  gridFilterTriggerHoverBorderColor: string
  gridFilterTriggerHoverTextColor: string
  gridFilterTriggerActiveBorderColor: string
  gridFilterTriggerActiveBackgroundColor: string
  gridFilterTriggerActiveTextColor: string
  gridResizeHandleHoverColor: string
  gridNumericTextColor: string
  gridEditableHoverBackgroundColor: string
  gridSelectionRangeBackgroundColor: string
  gridSelectionCopiedBorderColor: string
  gridSelectionCopiedBackgroundColor: string
  gridSelectionFillPreviewBackgroundColor: string
  gridSelectionMovePreviewBackgroundColor: string
  gridSelectionAnchorBackgroundColor: string
  gridSelectionActiveBorderColor: string
  gridEditorBorderColor: string
  gridEditorBackgroundColor: string
  gridEditorFocusBorderColor: string
  gridEditorFocusRingColor: string
  gridEnumTriggerBorderColor: string
  gridEnumTriggerBackgroundColor: string
  gridEnumTriggerTextColor: string
  gridEnumTriggerHoverBorderColor: string
  gridEnumTriggerHoverBackgroundColor: string
  gridStickyBackgroundColor: string
  gridStickyShadowColor: string
  gridStickyRangeBackgroundColor: string
  gridStickyRangeBorderColor: string
  gridStickyAnchorBackgroundColor: string
  gridStickyAnchorBorderColor: string
  gridStickyActiveBorderColor: string
  gridHeaderStickyBackgroundColor: string
  gridGroupStartGradientStart: string
  gridGroupStartGradientEnd: string
  gridGroupBadgeTextColor: string
  gridSelectionOverlayBorderColor: string
  gridSelectionOverlayBackgroundColor: string
  gridSelectionOverlayFillBorderColor: string
  gridSelectionOverlayFillBackgroundColor: string
  gridSelectionOverlayMoveBorderColor: string
  gridSelectionOverlayMoveBackgroundColor: string
  gridSelectionHandleBorderColor: string
  gridSelectionHandleBackgroundColor: string
  gridMoveHandleHoverBackgroundColor: string
  gridHintBorderColor: string
  gridHintBackgroundColor: string
  gridCopyMenuBorderColor: string
  gridCopyMenuBackgroundColor: string
  gridCopyMenuShadowColor: string
  gridCopyMenuItemHoverBorderColor: string
  gridCopyMenuItemHoverBackgroundColor: string
}

export interface DataGridResolvedStyleConfig {
  grid: Record<string, string>
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
  grid?: DataGridStyleSection
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
