import { toRgb, toRgba, transparent } from "./colorUtils"
import type { DataGridThemeTokens } from "./types"

interface DataGridThemePresetSpec {
  fontFamily: string
  fontSize: string
  text: string
  textMuted: string
  textSoft: string
  background: string
  viewport: string
  surface: string
  surfaceSubtle: string
  surfaceMuted: string
  surfaceRaised: string
  header: string
  headerHover: string
  headerOpen: string
  border: string
  borderStrong: string
  accent: string
  accentStrong: string
  accentSoft: string
  accentMuted: string
  accentText: string
  groupBackground: string
  groupText: string
  summaryBackground: string
  summaryText: string
  pinnedBackground: string
  shadow: string
  rowHover: string
  rowSelected: string
  numericText: string
  headerPaddingX: string
  headerPaddingY: string
  bodyCellPaddingX: string
  bodyCellPaddingY: string
  gridLineSize?: string
}

const rgb = (hex: string): string => toRgb(hex)
const alpha = (hex: string, value: number): string => toRgba(hex, value)

export function createThemePresetTokens(spec: DataGridThemePresetSpec): DataGridThemeTokens {
  const gridLineSize = spec.gridLineSize ?? "1px"
  const overlayAccent = alpha(spec.accent, 0.12)
  const overlaySoft = alpha(spec.accent, 0.08)
  const neutralOverlay = alpha(spec.textMuted, 0.12)

  return {
    gridFontFamily: spec.fontFamily,
    gridFontSize: spec.fontSize,
    gridTextColor: rgb(spec.text),
    gridBackgroundColor: rgb(spec.background),
    gridTextPrimary: rgb(spec.text),
    gridTextMuted: rgb(spec.textMuted),
    gridTextSoft: rgb(spec.textSoft),
    gridGlassBorder: rgb(spec.border),
    gridAccentStrong: rgb(spec.accentStrong),
    headerBackgroundColor: rgb(spec.header),
    headerTextColor: rgb(spec.text),
    headerBorderColor: rgb(spec.borderStrong),
    headerPaddingX: spec.headerPaddingX,
    headerPaddingY: spec.headerPaddingY,
    headerHighlightBorderColor: rgb(spec.accent),
    headerHighlightTextColor: rgb(spec.accentText),
    headerSelectedTextColor: rgb(spec.text),
    headerSystemTextColor: rgb(spec.textMuted),
    bodyRowBackgroundColor: rgb(spec.surface),
    bodyRowTextColor: rgb(spec.text),
    bodyRowHoverBackgroundColor: rgb(spec.rowHover),
    bodyRowSelectedBackgroundColor: rgb(spec.rowSelected),
    bodyRowSelectedTextColor: rgb(spec.text),
    bodyCellPaddingX: spec.bodyCellPaddingX,
    bodyCellPaddingY: spec.bodyCellPaddingY,
    bodyCellBorderColor: rgb(spec.border),
    selectionCellBackgroundColor: rgb(spec.accentSoft),
    selectionCellTextColor: rgb(spec.text),
    indexCellBackgroundColor: rgb(spec.surfaceMuted),
    indexCellTextColor: rgb(spec.textMuted),
    rowDividerSize: gridLineSize,
    rowDividerColor: rgb(spec.border),
    columnDividerSize: gridLineSize,
    columnDividerColor: rgb(spec.border),
    headerDividerSize: gridLineSize,
    headerDividerColor: rgb(spec.borderStrong),
    summaryDividerSize: gridLineSize,
    summaryDividerColor: rgb(spec.border),
    groupRowBackgroundColor: rgb(spec.groupBackground),
    groupRowTextColor: rgb(spec.groupText),
    summaryRowBackgroundColor: rgb(spec.summaryBackground),
    summaryRowTextColor: rgb(spec.summaryText),
    summaryLabelTextColor: rgb(spec.textMuted),
    pinnedBackgroundColor: rgb(spec.pinnedBackground),
    pinnedLeftBackgroundColor: rgb(spec.pinnedBackground),
    pinnedRightBackgroundColor: rgb(spec.pinnedBackground),
    pinnedShadow: `0 0 0 0 ${transparent()}`,
    pinnedLeftShadow: `inset -1px 0 0 ${rgb(spec.borderStrong)}`,
    pinnedRightShadow: `inset 1px 0 0 ${rgb(spec.borderStrong)}`,
    pinnedLeftBorderColor: rgb(spec.borderStrong),
    pinnedLeftBorderWidth: gridLineSize,
    pinnedRightBorderColor: rgb(spec.borderStrong),
    pinnedRightBorderWidth: gridLineSize,
    gridHeroBackgroundStart: rgb(spec.background),
    gridHeroBackgroundEnd: rgb(spec.surfaceMuted),
    gridChipBackground: rgb(spec.surfaceMuted),
    gridControlsBackground: rgb(spec.background),
    gridControlsInputBackground: rgb(spec.surface),
    gridControlsSurfaceBackground: rgb(spec.surfaceRaised),
    gridFilterPanelBorderColor: rgb(spec.borderStrong),
    gridFilterPanelBackground: rgb(spec.surfaceRaised),
    gridFilterIndicatorActiveColor: rgb(spec.accent),
    gridMetricsCardBackground: rgb(spec.surfaceRaised),
    gridViewportBackground: rgb(spec.viewport),
    gridFocusOutlineColor: rgb(spec.accent),
    gridHeaderRowBackgroundColor: rgb(spec.header),
    gridHeaderCellBackgroundColor: rgb(spec.header),
    gridHeaderCellHoverBackgroundColor: rgb(spec.headerHover),
    gridHeaderFilterOpenBackgroundColor: rgb(spec.headerOpen),
    gridGroupRowBorderColor: rgb(spec.borderStrong),
    gridRowSelectedStickyBackgroundColor: rgb(spec.rowSelected),
    gridRowSelectedRangeBackgroundColor: rgb(spec.accentMuted),
    gridCheckboxAccentColor: rgb(spec.accent),
    gridSortIndicatorColor: rgb(spec.accent),
    gridSortPriorityBorderColor: rgb(spec.borderStrong),
    gridHeaderFilterHighlightColor: rgb(spec.accent),
    gridFilterTriggerBorderColor: rgb(spec.borderStrong),
    gridFilterTriggerBackgroundColor: rgb(spec.surface),
    gridFilterTriggerHoverBorderColor: rgb(spec.accent),
    gridFilterTriggerHoverTextColor: rgb(spec.accentText),
    gridFilterTriggerActiveBorderColor: rgb(spec.accent),
    gridFilterTriggerActiveBackgroundColor: rgb(spec.accentSoft),
    gridFilterTriggerActiveTextColor: rgb(spec.accentText),
    gridResizeHandleHoverColor: rgb(spec.accent),
    gridNumericTextColor: rgb(spec.numericText),
    gridEditableHoverBackgroundColor: rgb(spec.surfaceSubtle),
    gridSelectionRangeBackgroundColor: overlayAccent,
    gridSelectionCopiedBorderColor: rgb(spec.accent),
    gridSelectionCopiedBackgroundColor: overlaySoft,
    gridSelectionFillPreviewBackgroundColor: overlaySoft,
    gridSelectionMovePreviewBackgroundColor: neutralOverlay,
    gridSelectionAnchorBackgroundColor: alpha(spec.accent, 0.16),
    gridSelectionActiveBorderColor: rgb(spec.accent),
    gridEditorBorderColor: rgb(spec.borderStrong),
    gridEditorBackgroundColor: rgb(spec.surfaceRaised),
    gridEditorFocusBorderColor: rgb(spec.accent),
    gridEditorFocusRingColor: alpha(spec.accent, 0.18),
    gridEnumTriggerBorderColor: rgb(spec.borderStrong),
    gridEnumTriggerBackgroundColor: rgb(spec.surfaceRaised),
    gridEnumTriggerTextColor: rgb(spec.accentText),
    gridEnumTriggerHoverBorderColor: rgb(spec.accent),
    gridEnumTriggerHoverBackgroundColor: rgb(spec.surfaceSubtle),
    gridStickyBackgroundColor: rgb(spec.pinnedBackground),
    gridStickyShadowColor: alpha(spec.shadow, 0.18),
    gridStickyRangeBackgroundColor: rgb(spec.accentSoft),
    gridStickyRangeBorderColor: rgb(spec.accent),
    gridStickyAnchorBackgroundColor: rgb(spec.accentMuted),
    gridStickyAnchorBorderColor: rgb(spec.accent),
    gridStickyActiveBorderColor: rgb(spec.accent),
    gridHeaderStickyBackgroundColor: rgb(spec.header),
    gridGroupStartGradientStart: rgb(spec.groupBackground),
    gridGroupStartGradientEnd: rgb(spec.groupBackground),
    gridGroupBadgeTextColor: rgb(spec.groupText),
    gridSelectionOverlayBorderColor: rgb(spec.accent),
    gridSelectionOverlayBackgroundColor: overlaySoft,
    gridSelectionOverlayFillBorderColor: rgb(spec.accent),
    gridSelectionOverlayFillBackgroundColor: alpha(spec.accent, 0.06),
    gridSelectionOverlayMoveBorderColor: rgb(spec.textMuted),
    gridSelectionOverlayMoveBackgroundColor: alpha(spec.textMuted, 0.08),
    gridSelectionHandleBorderColor: rgb(spec.surfaceRaised),
    gridSelectionHandleBackgroundColor: rgb(spec.accent),
    gridMoveHandleHoverBackgroundColor: overlaySoft,
    gridHintBorderColor: rgb(spec.border),
    gridHintBackgroundColor: rgb(spec.surfaceSubtle),
    gridCopyMenuBorderColor: rgb(spec.borderStrong),
    gridCopyMenuBackgroundColor: rgb(spec.surfaceRaised),
    gridCopyMenuShadowColor: alpha(spec.shadow, 0.16),
    gridCopyMenuItemHoverBorderColor: rgb(spec.borderStrong),
    gridCopyMenuItemHoverBackgroundColor: rgb(spec.surfaceSubtle),
    gridColumnMenuBorderColor: rgb(spec.borderStrong),
    gridColumnMenuBackgroundColor: rgb(spec.surfaceRaised),
    gridColumnMenuShadowColor: alpha(spec.shadow, 0.16),
    gridColumnMenuItemHoverBackgroundColor: rgb(spec.surfaceSubtle),
    gridColumnMenuMutedTextColor: rgb(spec.textMuted),
    gridColumnMenuFocusRingColor: alpha(spec.accent, 0.18),
    gridColumnMenuSearchBorderColor: rgb(spec.borderStrong),
    gridColumnMenuSearchBackgroundColor: rgb(spec.surface),
  }
}
