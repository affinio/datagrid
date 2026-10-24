# DataGrid theme tokens

This reference lists every token accepted by `DataGridThemeTokens` in
`@affino/datagrid-theme`, alongside the CSS custom property written by
`applyGridTheme()`. The mapping is maintained in
`packages/datagrid-theme/src/tokens.ts`.

Use the typed token names in the `theme` prop or in a
`DataGridStyleConfig.tokens` object. Values are CSS strings: use colors for
color tokens, CSS lengths for spacing/radius/width tokens, and CSS shadow values
for shadow tokens. Presets provide defaults for all tokens.

`DataGrid` applies resolved tokens to its own root. Prefer the typed theme API
when configuring a grid; a custom property set on an ancestor can be overridden
by the grid's resolved inline token value.

### Live theme changes and canvas chrome

The grid refreshes its canvas palette when its `theme` prop changes or when the
document root's `data-theme` or `class` attribute changes. This includes the
default document-inheriting theme and configured document dark-mode classes.
The refresh invalidates cached canvas colors and redraws the chrome without
resetting grid state.

Changing CSS variables directly (for example, mutating an inline style,
changing an unrelated ancestor class, replacing a stylesheet, or calling
`applyGridTheme()` outside the grid's `theme` prop flow) is not a supported live
canvas invalidation signal. Use the `theme` prop or the observed document-root
theme attributes for runtime changes. A style config with
`inheritThemeFromDocument: false` remains fixed when the document theme changes.

Example:

```vue
<DataGrid
  :rows="rows"
  :columns="columns"
  :theme="{
    surfaceRadius: '12px',
    gridGlassBorder: '#cbd5e1',
    gridBackgroundColor: '#fff',
  }"
/>
```

## Typography and surface

Base type, text, stage surface, outer frame, and accent.

| Theme token | CSS custom property |
| --- | --- |
| `gridFontFamily` | `--datagrid-font-family` |
| `gridFontSize` | `--datagrid-font-size` |
| `gridTextColor` | `--datagrid-text-color` |
| `gridBackgroundColor` | `--datagrid-background-color` |
| `surfaceRadius` | `--datagrid-surface-radius` |
| `gridTextPrimary` | `--datagrid-text-primary` |
| `gridTextMuted` | `--datagrid-text-muted` |
| `gridTextSoft` | `--datagrid-text-soft` |
| `gridGlassBorder` | `--datagrid-glass-border` |
| `gridAccentStrong` | `--datagrid-accent-strong` |

## Header

Header cells, header filters, sort indicators, and resize affordances.

| Theme token | CSS custom property |
| --- | --- |
| `headerBackgroundColor` | `--datagrid-header-background-color` |
| `headerTextColor` | `--datagrid-header-text-color` |
| `headerBorderColor` | `--datagrid-header-border-color` |
| `headerPaddingX` | `--datagrid-header-padding-x` |
| `headerPaddingY` | `--datagrid-header-padding-y` |
| `headerHighlightBorderColor` | `--datagrid-header-highlight-border-color` |
| `headerHighlightTextColor` | `--datagrid-header-highlight-text-color` |
| `headerSelectedTextColor` | `--datagrid-header-selected-text-color` |
| `headerSystemTextColor` | `--datagrid-header-system-text-color` |
| `headerDividerSize` | `--datagrid-header-divider-size` |
| `headerDividerColor` | `--datagrid-header-divider-color` |
| `gridHeaderRowBackgroundColor` | `--datagrid-header-row-bg` |
| `gridHeaderCellBackgroundColor` | `--datagrid-header-cell-bg` |
| `gridHeaderCellHoverBackgroundColor` | `--datagrid-header-cell-hover-bg` |
| `gridHeaderFilterOpenBackgroundColor` | `--datagrid-header-filter-open-bg` |
| `gridSortIndicatorColor` | `--datagrid-sort-indicator-color` |
| `gridSortPriorityBorderColor` | `--datagrid-sort-priority-border` |
| `gridHeaderFilterHighlightColor` | `--datagrid-header-filter-highlight` |
| `gridFilterTriggerBorderColor` | `--datagrid-filter-trigger-border` |
| `gridFilterTriggerBackgroundColor` | `--datagrid-filter-trigger-bg` |
| `gridFilterTriggerHoverBorderColor` | `--datagrid-filter-trigger-hover-border` |
| `gridFilterTriggerHoverTextColor` | `--datagrid-filter-trigger-hover-text` |
| `gridFilterTriggerActiveBorderColor` | `--datagrid-filter-trigger-active-border` |
| `gridFilterTriggerActiveBackgroundColor` | `--datagrid-filter-trigger-active-bg` |
| `gridFilterTriggerActiveTextColor` | `--datagrid-filter-trigger-active-text` |
| `gridResizeHandleHoverColor` | `--datagrid-resize-handle-hover` |
| `gridHeaderStickyBackgroundColor` | `--datagrid-header-sticky-bg` |

## Body and rows

Body cells, row states, index/checkbox cells, and editable or numeric content.

| Theme token | CSS custom property |
| --- | --- |
| `bodyRowBackgroundColor` | `--datagrid-row-background-color` |
| `bodyRowTextColor` | `--datagrid-row-text-color` |
| `bodyRowHoverBackgroundColor` | `--datagrid-row-hover-background-color` |
| `bodyRowSelectedBackgroundColor` | `--datagrid-row-selected-background-color` |
| `bodyRowSelectedTextColor` | `--datagrid-row-selected-text-color` |
| `bodyCellPaddingX` | `--datagrid-body-cell-padding-x` |
| `bodyCellPaddingY` | `--datagrid-body-cell-padding-y` |
| `bodyCellBorderColor` | `--datagrid-cell-border-color` |
| `selectionCellBackgroundColor` | `--datagrid-selection-cell-background-color` |
| `selectionCellTextColor` | `--datagrid-selection-cell-text-color` |
| `indexCellBackgroundColor` | `--datagrid-index-cell-background-color` |
| `indexCellTextColor` | `--datagrid-index-cell-text-color` |
| `gridGroupRowBorderColor` | `--datagrid-group-row-border-color` |
| `gridNumericTextColor` | `--datagrid-numeric-text` |
| `gridEditableHoverBackgroundColor` | `--datagrid-editable-hover-bg` |

## Dividers

Grid lines and their widths.

| Theme token | CSS custom property |
| --- | --- |
| `rowDividerSize` | `--datagrid-row-divider-size` |
| `rowDividerColor` | `--datagrid-row-divider-color` |
| `columnDividerSize` | `--datagrid-column-divider-size` |
| `columnDividerColor` | `--datagrid-column-divider-color` |
| `summaryDividerSize` | `--datagrid-summary-divider-size` |
| `summaryDividerColor` | `--datagrid-summary-divider-color` |

## Pinned panes

Pinned pane backgrounds, shadows, and pane boundaries.

| Theme token | CSS custom property |
| --- | --- |
| `pinnedBackgroundColor` | `--datagrid-pinned-bg` |
| `pinnedLeftBackgroundColor` | `--datagrid-pinned-left-bg` |
| `pinnedRightBackgroundColor` | `--datagrid-pinned-right-bg` |
| `pinnedShadow` | `--datagrid-pinned-shadow` |
| `pinnedLeftShadow` | `--datagrid-pinned-left-shadow` |
| `pinnedRightShadow` | `--datagrid-pinned-right-shadow` |
| `pinnedLeftBorderColor` | `--datagrid-pinned-left-border-color` |
| `pinnedLeftBorderWidth` | `--datagrid-pinned-left-border-width` |
| `pinnedRightBorderColor` | `--datagrid-pinned-right-border-color` |
| `pinnedRightBorderWidth` | `--datagrid-pinned-right-border-width` |

## Viewport and focus

Viewport background and keyboard focus cues.

| Theme token | CSS custom property |
| --- | --- |
| `gridViewportBackground` | `--datagrid-viewport-bg` |
| `gridFocusOutlineColor` | `--datagrid-focus-outline` |
| `gridFocusAxisBackgroundColor` | `--datagrid-focus-axis-bg` |

## Grouping and summaries

Group rows, summary rows, group-start accents, indentation, and badges.

| Theme token | CSS custom property |
| --- | --- |
| `groupRowBackgroundColor` | `--datagrid-group-row-background-color` |
| `groupRowTextColor` | `--datagrid-group-row-text-color` |
| `summaryRowBackgroundColor` | `--datagrid-summary-row-background-color` |
| `summaryRowTextColor` | `--datagrid-summary-row-text-color` |
| `summaryLabelTextColor` | `--datagrid-summary-label-text-color` |
| `gridGroupStartGradientStart` | `--datagrid-group-start-gradient-start` |
| `gridGroupStartGradientEnd` | `--datagrid-group-start-gradient-end` |
| `gridGroupBadgeTextColor` | `--datagrid-group-badge-text` |

## Selection and overlays

Row and cell selection, copied/fill/move states, and selection handles.

| Theme token | CSS custom property |
| --- | --- |
| `gridRowSelectedStickyBackgroundColor` | `--datagrid-row-selected-sticky-bg` |
| `gridRowSelectedRangeBackgroundColor` | `--datagrid-row-selected-range-bg` |
| `gridCheckboxAccentColor` | `--datagrid-checkbox-accent` |
| `gridSelectionRangeBackgroundColor` | `--datagrid-selection-range-bg` |
| `gridSelectionCopiedBorderColor` | `--datagrid-selection-copied-border` |
| `gridSelectionCopiedBackgroundColor` | `--datagrid-selection-copied-bg` |
| `gridSelectionFillPreviewBackgroundColor` | `--datagrid-selection-fill-preview-bg` |
| `gridSelectionMovePreviewBackgroundColor` | `--datagrid-selection-move-preview-bg` |
| `gridSelectionAnchorBackgroundColor` | `--datagrid-selection-anchor-bg` |
| `gridSelectionActiveBorderColor` | `--datagrid-selection-active-border` |
| `gridSelectionOverlayBorderColor` | `--datagrid-selection-overlay-border` |
| `gridSelectionOverlayBackgroundColor` | `--datagrid-selection-overlay-bg` |
| `gridSelectionOverlayFillBorderColor` | `--datagrid-selection-overlay-fill-border` |
| `gridSelectionOverlayFillBackgroundColor` | `--datagrid-selection-overlay-fill-bg` |
| `gridSelectionOverlayMoveBorderColor` | `--datagrid-selection-overlay-move-border` |
| `gridSelectionOverlayMoveBackgroundColor` | `--datagrid-selection-overlay-move-bg` |
| `gridSelectionHandleBorderColor` | `--datagrid-selection-handle-border` |
| `gridSelectionHandleBackgroundColor` | `--datagrid-selection-handle-bg` |

## Editing

Cell editor surfaces, focus, and enum editor triggers.

| Theme token | CSS custom property |
| --- | --- |
| `gridEditorBorderColor` | `--datagrid-editor-border` |
| `gridEditorBackgroundColor` | `--datagrid-editor-bg` |
| `gridEditorFocusBorderColor` | `--datagrid-editor-focus-border` |
| `gridEditorFocusRingColor` | `--datagrid-editor-focus-ring` |
| `gridEnumTriggerBorderColor` | `--datagrid-enum-trigger-border` |
| `gridEnumTriggerBackgroundColor` | `--datagrid-enum-trigger-bg` |
| `gridEnumTriggerTextColor` | `--datagrid-enum-trigger-text` |
| `gridEnumTriggerHoverBorderColor` | `--datagrid-enum-trigger-hover-border` |
| `gridEnumTriggerHoverBackgroundColor` | `--datagrid-enum-trigger-hover-bg` |

## Sticky rows and headers

Sticky row/header backgrounds, shadows, and selection states.

| Theme token | CSS custom property |
| --- | --- |
| `gridStickyBackgroundColor` | `--datagrid-sticky-bg` |
| `gridStickyShadowColor` | `--datagrid-sticky-shadow` |
| `gridStickyRangeBackgroundColor` | `--datagrid-sticky-range-bg` |
| `gridStickyRangeBorderColor` | `--datagrid-sticky-range-border` |
| `gridStickyAnchorBackgroundColor` | `--datagrid-sticky-anchor-bg` |
| `gridStickyAnchorBorderColor` | `--datagrid-sticky-anchor-border` |
| `gridStickyActiveBorderColor` | `--datagrid-sticky-active-border` |

## Menus and hints

Context menus, column menu, and hint surfaces.

| Theme token | CSS custom property |
| --- | --- |
| `gridHintBorderColor` | `--datagrid-hint-border` |
| `gridHintBackgroundColor` | `--datagrid-hint-bg` |
| `gridCopyMenuBorderColor` | `--datagrid-copy-menu-border` |
| `gridCopyMenuBackgroundColor` | `--datagrid-copy-menu-bg` |
| `gridCopyMenuShadowColor` | `--datagrid-copy-menu-shadow` |
| `gridCopyMenuItemHoverBorderColor` | `--datagrid-copy-menu-item-hover-border` |
| `gridCopyMenuItemHoverBackgroundColor` | `--datagrid-copy-menu-item-hover-bg` |
| `gridColumnMenuBorderColor` | `--datagrid-column-menu-border` |
| `gridColumnMenuBackgroundColor` | `--datagrid-column-menu-bg` |
| `gridColumnMenuShadowColor` | `--datagrid-column-menu-shadow` |
| `gridColumnMenuItemHoverBackgroundColor` | `--datagrid-column-menu-item-hover-bg` |
| `gridColumnMenuMutedTextColor` | `--datagrid-column-menu-muted-text` |
| `gridColumnMenuFocusRingColor` | `--datagrid-column-menu-focus-ring` |
| `gridColumnMenuSearchBorderColor` | `--datagrid-column-menu-search-border` |
| `gridColumnMenuSearchBackgroundColor` | `--datagrid-column-menu-search-bg` |

## Toolbar

Toolbar and toolbar button states.

| Theme token | CSS custom property |
| --- | --- |
| `gridToolbarBackgroundColor` | `--datagrid-toolbar-background-color` |
| `gridToolbarBorderColor` | `--datagrid-toolbar-border-color` |
| `gridToolbarButtonBackgroundColor` | `--datagrid-toolbar-button-background-color` |
| `gridToolbarButtonTextColor` | `--datagrid-toolbar-button-text-color` |
| `gridToolbarButtonBorderColor` | `--datagrid-toolbar-button-border-color` |
| `gridToolbarButtonHoverBackgroundColor` | `--datagrid-toolbar-button-hover-background-color` |
| `gridToolbarButtonActiveBackgroundColor` | `--datagrid-toolbar-button-active-background-color` |

## Demo and controls

Optional demo/control surfaces used by the built-in examples.

| Theme token | CSS custom property |
| --- | --- |
| `gridHeroBackgroundStart` | `--datagrid-hero-bg-start` |
| `gridHeroBackgroundEnd` | `--datagrid-hero-bg-end` |
| `gridChipBackground` | `--datagrid-chip-bg` |
| `gridControlsBackground` | `--datagrid-controls-bg` |
| `gridControlsInputBackground` | `--datagrid-controls-input-bg` |
| `gridControlsSurfaceBackground` | `--datagrid-controls-surface-bg` |
| `gridFilterPanelBorderColor` | `--datagrid-filter-panel-border` |
| `gridFilterPanelBackground` | `--datagrid-filter-panel-bg` |
| `gridFilterIndicatorActiveColor` | `--datagrid-filter-indicator-active` |
| `gridMetricsCardBackground` | `--datagrid-metrics-card-bg` |

## Other

| Theme token | CSS custom property |
| --- | --- |
| `gridMoveHandleHoverBackgroundColor` | `--datagrid-move-handle-hover-bg` |
| `groupIndentSize` | `--datagrid-hierarchy-indent` |
