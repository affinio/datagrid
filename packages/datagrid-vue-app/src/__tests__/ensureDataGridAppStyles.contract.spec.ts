import { afterEach, describe, expect, it } from "vitest"
import { ensureDataGridAppStyles } from "../theme/ensureDataGridAppStyles"

const STYLE_ID = "affino-datagrid-vue-app-styles"

afterEach(() => {
  document.getElementById(STYLE_ID)?.remove()
})

describe("ensureDataGridAppStyles", () => {
  it("keeps column menu footer actions compact", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const footerStart = styleText.lastIndexOf(".datagrid-column-menu__footer {")
    const footerEnd = styleText.indexOf("}", footerStart)
    const footerRule = footerStart >= 0 && footerEnd > footerStart ? styleText.slice(footerStart, footerEnd) : ""
    const buttonStart = styleText.indexOf(".datagrid-column-menu__footer .datagrid-column-menu__button {")
    const buttonEnd = styleText.indexOf("}", buttonStart)
    const buttonRule = buttonStart >= 0 && buttonEnd > buttonStart ? styleText.slice(buttonStart, buttonEnd) : ""

    expect(footerRule).toContain("padding-top: 2px")
    expect(footerRule).toContain("gap: 4px")
    expect(buttonRule).toContain("height: 26px")
    expect(buttonRule).toContain("min-width: 64px")
  })

  it("matches filter panel action height and uses an underlined clear action", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const footerButtonsStart = styleText.indexOf(".datagrid-advanced-filter__footer > button,")
    const footerButtonsEnd = styleText.indexOf("}", footerButtonsStart)
    const footerButtonsRule = footerButtonsStart >= 0 && footerButtonsEnd > footerButtonsStart
      ? styleText.slice(footerButtonsStart, footerButtonsEnd)
      : ""
    const clearStart = styleText.indexOf(".datagrid-advanced-filter__clear-link {")
    const clearEnd = styleText.indexOf("}", clearStart)
    const clearRule = clearStart >= 0 && clearEnd > clearStart ? styleText.slice(clearStart, clearEnd) : ""

    expect(footerButtonsRule).toContain("height: 26px")
    expect(clearRule).toContain("text-decoration: underline")
    expect(clearRule).toContain("border: 0")
    expect(styleText).toContain(".datagrid-advanced-filter__close:hover")
  })

  it("uses compact menu items and text links for value filter actions", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const itemStart = styleText.lastIndexOf(".datagrid-column-menu__item {")
    const itemEnd = styleText.indexOf("}", itemStart)
    const itemRule = itemStart >= 0 && itemEnd > itemStart ? styleText.slice(itemStart, itemEnd) : ""
    const toolbarLinkStart = styleText.indexOf(".datagrid-column-menu__toolbar .datagrid-column-menu__link {")
    const toolbarLinkEnd = styleText.indexOf("}", toolbarLinkStart)
    const toolbarLinkRule = toolbarLinkStart >= 0 && toolbarLinkEnd > toolbarLinkStart
      ? styleText.slice(toolbarLinkStart, toolbarLinkEnd)
      : ""

    expect(itemRule).toContain("min-height: 28px")
    expect(itemRule).toContain("padding: 0.28rem 0.65rem")
    expect(toolbarLinkRule).toContain("color: var(--datagrid-accent-strong)")
    expect(toolbarLinkRule).toContain("text-decoration: underline")
    expect(toolbarLinkRule).toContain("border: 0")
  })

  it("keeps the value filter list and its checkboxes compact", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const readLastRule = (selector: string) => {
      const start = styleText.lastIndexOf(`${selector} {`)
      const end = styleText.indexOf("}", start)
      return start >= 0 && end > start ? styleText.slice(start, end) : ""
    }
    const valuesRule = readLastRule(".datagrid-column-menu__values")
    const valueRule = readLastRule(".datagrid-column-menu__value")
    const checkboxRule = readLastRule(".datagrid-column-menu__value input")

    expect(valuesRule).toContain("flex: 1 1 104px")
    expect(valuesRule).toContain("max-height: min(104px, calc(100vh - 390px))")
    expect(valueRule).toContain("min-height: 22px")
    expect(valueRule).toContain("padding: 2px 5px")
    expect(checkboxRule).toContain("width: 12px")
    expect(checkboxRule).toContain("height: 12px")
  })

  it("stretches header content so column menu buttons align to the right edge", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const colHeadStart = styleText.indexOf(".col-head {")
    const colHeadEnd = styleText.indexOf("}", colHeadStart)
    const colHeadRule = colHeadStart >= 0 && colHeadEnd > colHeadStart
      ? styleText.slice(colHeadStart, colHeadEnd)
      : ""

    expect(colHeadRule).toContain("flex: 1 1 auto")
    expect(colHeadRule).toContain("width: 100%")
  })

  it("removes the right padding from header cells with a column menu", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const menuHeaderStart = styleText.indexOf(".grid-cell--header-menu-enabled {")
    const menuHeaderEnd = styleText.indexOf("}", menuHeaderStart)
    const menuHeaderRule = menuHeaderStart >= 0 && menuHeaderEnd > menuHeaderStart
      ? styleText.slice(menuHeaderStart, menuHeaderEnd)
      : ""

    expect(menuHeaderRule).toContain("padding-right: 0")
  })

  it("distinguishes pinned panes and uses an accent strip for selected row indices", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const rootStart = styleText.indexOf(".affino-datagrid-app-root {")
    const rootEnd = styleText.indexOf("}", rootStart)
    const rootRule = rootStart >= 0 && rootEnd > rootStart ? styleText.slice(rootStart, rootEnd) : ""
    const selectedIndexStart = styleText.indexOf(".datagrid-stage__row-index-cell.grid-cell--index-selected::before {")
    const selectedIndexEnd = styleText.indexOf("}", selectedIndexStart)
    const selectedIndexRule = selectedIndexStart >= 0 && selectedIndexEnd > selectedIndexStart
      ? styleText.slice(selectedIndexStart, selectedIndexEnd)
      : ""

    expect(rootRule).toContain("--datagrid-pinned-pane-separator-size: 1px")
    expect(rootRule).toContain("var(--datagrid-accent-strong) 24%")
    expect(selectedIndexRule).toContain("linear-gradient(to right, var(--datagrid-accent-strong) 3px")
    expect(selectedIndexRule).not.toContain("border-radius")
  })

  it("uses the selected background and accent strip for keyboard focus on leaf headers", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const focusRuleStart = styleText.indexOf(".grid-header-shell .grid-cell--header:focus-visible {")
    const focusRuleEnd = styleText.indexOf("}", focusRuleStart)
    const focusRule = focusRuleStart >= 0 && focusRuleEnd > focusRuleStart
      ? styleText.slice(focusRuleStart, focusRuleEnd)
      : ""

    expect(focusRule).toContain("outline: none")
    expect(focusRule).toContain("background-color: var(--datagrid-selection-range-bg)")
    expect(focusRule).toContain("inset 0 3px 0 var(--datagrid-accent-strong)")
  })

  it("shows focus on the whole system checkbox header cell", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const cellFocusStart = styleText.indexOf(".grid-header-shell .grid-cell--row-selection:focus-within {")
    const cellFocusEnd = styleText.indexOf("}", cellFocusStart)
    const cellFocusRule = cellFocusStart >= 0 && cellFocusEnd > cellFocusStart
      ? styleText.slice(cellFocusStart, cellFocusEnd)
      : ""
    const buttonFocusStart = styleText.indexOf(".grid-header-shell .grid-cell--row-selection .grid-checkbox-trigger:focus-visible {")
    const buttonFocusEnd = styleText.indexOf("}", buttonFocusStart)
    const buttonFocusRule = buttonFocusStart >= 0 && buttonFocusEnd > buttonFocusStart
      ? styleText.slice(buttonFocusStart, buttonFocusEnd)
      : ""

    expect(cellFocusRule).toContain("outline: none")
    expect(cellFocusRule).toContain("background-color: var(--datagrid-selection-range-bg)")
    expect(cellFocusRule).toContain("inset 0 3px 0 var(--datagrid-accent-strong)")
    expect(buttonFocusRule).toContain("outline: none")
  })

  it("uses a background and accent strip for selected leaf headers", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const selectedHeaderStart = styleText.indexOf(".grid-cell--header-selected,")
    const selectedHeaderEnd = styleText.indexOf("}", selectedHeaderStart)
    const selectedHeaderRule = styleText.slice(selectedHeaderStart, selectedHeaderEnd)
    expect(selectedHeaderRule).toContain("background-color: var(--datagrid-selection-range-bg)")
    expect(selectedHeaderRule).toContain("inset 0 3px 0 var(--datagrid-accent-strong)")
    expect(selectedHeaderRule).not.toContain("var(--datagrid-selection-border-color)")
  })

  it("leaves the layout host transparent and assigns surface paint to the stage", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const rootStart = styleText.indexOf(".affino-datagrid-app-root {")
    const rootEnd = styleText.indexOf("}", rootStart)
    const rootRule = rootStart >= 0 && rootEnd > rootStart ? styleText.slice(rootStart, rootEnd) : ""
    const stageStart = styleText.indexOf(".grid-stage {\n  display: grid;")
    const stageEnd = styleText.indexOf("}", stageStart)
    const stageRule = stageStart >= 0 && stageEnd > stageStart ? styleText.slice(stageStart, stageEnd) : ""

    expect(rootRule).toContain("background: transparent")
    expect(rootRule).not.toContain("background: var(--datagrid-background-color)")
    expect(stageRule).toContain("background: var(--datagrid-background-color)")
  })

  it("uses the host height once and lets internal fill layers share the remaining space", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const readRule = (selector: string): string => {
      const start = styleText.indexOf(`${selector} {`)
      const end = styleText.indexOf("}", start)
      return start >= 0 && end > start ? styleText.slice(start, end) : ""
    }

    expect(readRule(".affino-datagrid-app-root--fill")).toContain("height: 100%")
    for (const selector of [
      ".datagrid-app-layout--fill",
      ".datagrid-app-workspace--fill",
      ".datagrid-app-stage-surface--fill",
      ".datagrid-app-stage--fill",
      ".grid-stage--layout-fill",
    ]) {
      expect(readRule(selector)).toContain("flex: 1 1 0%")
      expect(readRule(selector)).not.toContain("height: 100%")
    }
    expect(readRule(".datagrid-app-stage-surface--integrated")).toContain("box-sizing: border-box")
  })

  it("installs a touch fallback for canvas chrome rendering", () => {
    ensureDataGridAppStyles()

    const style = document.getElementById(STYLE_ID)
    expect(style?.textContent).toContain("@media (hover: none) and (pointer: coarse)")
    expect(style?.textContent).toContain(".grid-stage--canvas-chrome .grid-chrome-canvas")
    expect(style?.textContent).toContain("display: none !important")
    expect(style?.textContent).toContain("border-right: var(--datagrid-column-divider-size) solid var(--datagrid-column-divider-color)")
    expect(style?.textContent).toContain("background: var(--datagrid-row-background-color) !important")
    const mediaStart = style?.textContent?.indexOf("@media (hover: none) and (pointer: coarse)") ?? -1
    const coarseFallbackStart = style?.textContent?.indexOf(
      ".grid-stage--canvas-chrome .grid-header-shell .grid-cell,",
      mediaStart,
    ) ?? -1
    const coarseFallbackEnd = style?.textContent?.indexOf(".grid-stage--canvas-chrome .grid-row--hoverable", coarseFallbackStart) ?? -1
    const headerFallbackRule = coarseFallbackStart >= 0 && coarseFallbackEnd > coarseFallbackStart
      ? style?.textContent?.slice(coarseFallbackStart, coarseFallbackEnd)
      : ""
    expect(headerFallbackRule).not.toContain("border-bottom:")
  })

  it("styles sticky group rows with group and sticky theme tokens", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const start = styleText.indexOf(".grid-row--sticky-top {")
    const end = styleText.indexOf("}", start)
    const rule = start >= 0 && end > start ? styleText.slice(start, end) : ""

    expect(rule).toContain("background: var(--datagrid-group-row-background-color")
    expect(rule).toContain("box-shadow: 0 2px 4px var(--datagrid-sticky-shadow")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--sticky-top {")
    expect(styleText).toContain("background: var(--datagrid-group-row-background-color, var(--datagrid-row-background-color, #fff))")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--sticky-top > .grid-cell:not(:first-child)")
    expect(styleText).toContain("box-shadow: inset var(--datagrid-column-divider-size) 0 0 var(--datagrid-column-divider-color)")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--sticky-top > .grid-cell--index + .grid-cell")
  })

  it("keeps center header native-scrolled with native dividers and contained horizontal overscroll", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""

    expect(styleText).not.toContain(".grid-header-viewport .grid-center-track")
    expect(styleText).not.toContain("--datagrid-body-scroll-left, 0px)), 0, 0")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-header-viewport .grid-cell,")
    expect(styleText).toContain("border-right: 0")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-header-viewport .grid-cell:not(:first-child),")
    expect(styleText).toContain("border-left: var(--datagrid-header-column-divider-size) solid var(--datagrid-header-column-divider-color)")
    expect(styleText).toContain(".grid-body-center-horizontal-scrollport--scroll-owner")
    const horizontalOwnerStart = styleText.indexOf(".grid-body-center-horizontal-scrollport--scroll-owner {")
    const horizontalOwnerEnd = styleText.indexOf("}", horizontalOwnerStart)
    const horizontalOwnerRule = horizontalOwnerStart >= 0 && horizontalOwnerEnd > horizontalOwnerStart
      ? styleText.slice(horizontalOwnerStart, horizontalOwnerEnd)
      : ""
    expect(horizontalOwnerRule).toContain("overscroll-behavior-x: none")
    const stageStart = styleText.indexOf(".grid-stage {\n  display: grid;")
    const stageEnd = styleText.indexOf("}", stageStart)
    const stageRule = stageStart >= 0 && stageEnd > stageStart
      ? styleText.slice(stageStart, stageEnd)
      : ""
    expect(stageRule).toContain("overscroll-behavior-x: none")
    expect(styleText).toContain(".datagrid-empty-state--viewport")
    expect(styleText).toContain("position: sticky")
    expect(styleText).toContain("left: 0")
    expect(styleText).toContain("overscroll-behavior-x: contain")
  })

  it("keeps canvas chrome body cells transparent outside coarse fallback", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const pinnedOverrideStart = styleText.indexOf(".grid-stage--canvas-chrome .grid-body-shell .grid-cell--pinned-left")
    const pinnedOverrideEnd = styleText.indexOf("@media (hover: none) and (pointer: coarse)", pinnedOverrideStart)
    const pinnedOverrideRule = pinnedOverrideStart >= 0 && pinnedOverrideEnd > pinnedOverrideStart
      ? styleText.slice(pinnedOverrideStart, pinnedOverrideEnd)
      : ""

    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--striped .grid-cell")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-row--hoverable.grid-row--hovered .grid-cell")
    expect(styleText).toContain("background-image: none")
    expect(pinnedOverrideRule).toContain("background: transparent")
    expect(pinnedOverrideRule).toContain("box-shadow: none")
    expect(styleText).toContain(".grid-stage--canvas-chrome .grid-cell--pinned-divider-right")
    expect(styleText).toContain("box-shadow: inset calc(-1 * var(--datagrid-column-divider-size))")
  })

  it("keeps the grid viewport on native touch panning by default", () => {
    ensureDataGridAppStyles()

    const style = document.getElementById(STYLE_ID)
    const styleText = style?.textContent ?? ""
    const bodyViewportStart = styleText.indexOf(".grid-body-viewport {")
    const bodyViewportEnd = styleText.indexOf(".grid-body-viewport--pinned-bottom", bodyViewportStart)
    const bodyViewportRule = bodyViewportStart >= 0 && bodyViewportEnd > bodyViewportStart
      ? styleText.slice(bodyViewportStart, bodyViewportEnd)
      : ""
    const ganttTimelineViewportStart = styleText.indexOf(".datagrid-gantt-timeline__viewport {")
    const ganttTimelineViewportEnd = styleText.indexOf(".datagrid-gantt-timeline__viewport--header", ganttTimelineViewportStart)
    const ganttTimelineViewportRule = ganttTimelineViewportStart >= 0 && ganttTimelineViewportEnd > ganttTimelineViewportStart
      ? styleText.slice(ganttTimelineViewportStart, ganttTimelineViewportEnd)
      : ""

    expect(styleText).toContain(".grid-body-viewport")
    expect(styleText).toContain(".datagrid-gantt-timeline__viewport")
    expect(bodyViewportRule).not.toContain("overscroll-behavior")
    expect(ganttTimelineViewportRule).not.toContain("overscroll-behavior")
    expect(styleText).toContain("touch-action: pan-x pan-y")
    expect(styleText).toContain("-webkit-overflow-scrolling: touch")
    expect(styleText).toContain("content-visibility: auto")
    expect(styleText).toContain("contain-intrinsic-size: auto var(--datagrid-base-row-height, 31px)")
    expect(style?.textContent).toContain(".cell-fill-handle")
    expect(style?.textContent).toContain(".col-resize")
    expect(style?.textContent).toContain("touch-action: none")
    expect(style?.textContent).toContain("width: 28px")
    expect(style?.textContent).toContain("height: 28px")
    expect(style?.textContent).toContain("min-width: 28px")
    expect(style?.textContent).toContain(".cell-fill-handle::after")
    expect(style?.textContent).toContain(".grid-stage--scrolling .grid-cell--select")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .grid-cell--date")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .cell-fill-handle")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .grid-fill-action__trigger")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .row-resize-handle")
    const rowResizeRuleStart = styleText.indexOf("\n.row-resize-handle {\n")
    const rowResizeRuleEnd = styleText.indexOf("}", rowResizeRuleStart)
    const rowResizeRule = rowResizeRuleStart >= 0 && rowResizeRuleEnd > rowResizeRuleStart
      ? styleText.slice(rowResizeRuleStart, rowResizeRuleEnd)
      : ""
    expect(rowResizeRule).toContain("height: 6px")
    expect(styleText).toContain(".grid-stage--coarse-pointer .row-resize-handle {\n  height: 18px;")
    expect(styleText).toContain(".row-resize-handle {\n    height: 18px;")
    expect(style?.textContent).toContain(".grid-stage--coarse-pointer .col-resize")
    expect(style?.textContent).toContain(".datagrid-app-status")
    expect(style?.textContent).toContain("clip: rect(0 0 0 0)")
    expect(style?.textContent).toContain(".grid-stage--scrolling .grid-cell--clipboard-pending::after")
    expect(style?.textContent).toContain("animation-play-state: paused")
    expect(style?.textContent).toContain(
      ".grid-stage--scrolling .grid-checkbox-indicator,\n.grid-stage--scrolling .grid-checkbox-indicator__mark {\n  transition: none;",
    )
  })

  it("hides body column dividers behind the empty state message", () => {
    ensureDataGridAppStyles()

    const styleText = document.getElementById(STYLE_ID)?.textContent ?? ""
    const ruleStart = styleText.lastIndexOf(".grid-stage--empty-state .grid-chrome-layer__line--vertical {")
    const ruleEnd = styleText.indexOf("}", ruleStart)
    const rule = ruleStart >= 0 && ruleEnd > ruleStart ? styleText.slice(ruleStart, ruleEnd) : ""

    expect(rule).toContain("display: none")
  })
})
